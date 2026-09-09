"""
Evolution API v2 Client
========================
Handles all communication with WhatsApp via Evolution API.
"""

import urllib.parse
import httpx
import structlog
from typing import Optional

from app.config import settings

logger = structlog.get_logger(__name__)

BASE_HEADERS = {
    "apikey": settings.EVOLUTION_API_KEY,
    "Content-Type": "application/json",
}


class EvolutionAPIClient:
    def __init__(self, instance: str | None = None, api_key: str | None = None):
        self.base_url = settings.EVOLUTION_API_URL.rstrip("/")
        self.instance = instance or settings.EVOLUTION_INSTANCE
        # URL-encoded instance pra usar no path (instâncias com espaços/acentos
        # como "Secretaria - Obras Parket" precisam virar "Secretaria%20-%20…").
        self.instance_enc = urllib.parse.quote(self.instance, safe="")
        self.headers = {
            "apikey": api_key or settings.EVOLUTION_API_KEY,
            "Content-Type": "application/json",
        }

    def _url(self, path: str) -> str:
        # Substitui {self.instance} pela versão encoded sempre que aparece
        # no caminho — chamadas usam f"…/{self.instance}" pra montar o path,
        # então precisamos garantir que a string final esteja URL-safe.
        if self.instance and self.instance != self.instance_enc:
            path = path.replace(self.instance, self.instance_enc)
        return f"{self.base_url}/{path.lstrip('/')}"

    # Grupos liberados do kill switch (texto apenas). Volume baixo e
    # autorizado pelo Will — não adicionar grupos de alto volume aqui.
    GROUP_SEND_ALLOWLIST = {
        "120363427283309459@g.us",  # 🛒 Parket - Compras (solicitações — reativado 10/07/2026)
    }

    @staticmethod
    def _is_group_destination(dest: str) -> bool:
        """JIDs de grupo terminam em @g.us. DMs são números (com/sem @s.whatsapp.net)."""
        return isinstance(dest, str) and dest.endswith("@g.us")

    async def send_text(self, group_id: str, text: str) -> dict:
        """Send a text message to a WhatsApp group or individual number."""
        # KILL SWITCH 2026-06-30: envios automáticos pra QUALQUER grupo WhatsApp
        # foram desligados — número da Parket estava sendo banido pela Meta por
        # volume excessivo de bots (ia_notifier 1440/dia, monitor 288/dia, etc).
        # DMs (números individuais) continuam funcionando normal.
        # Exceção: grupos na GROUP_SEND_ALLOWLIST (baixo volume, autorizados).
        if self._is_group_destination(group_id) and group_id not in self.GROUP_SEND_ALLOWLIST:
            logger.warning("group_send_skipped_kill_switch", group_id=group_id, chars=len(text or ""), preview=(text or "")[:200])
            return {"skipped": "group_send_disabled", "logged_only": True, "group_id": group_id}
        payload = {
            "number": group_id,
            "text": text,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self._url(f"/message/sendText/{self.instance}"),
                json=payload,
                headers=self.headers,
            )
            resp.raise_for_status()
            logger.info("evolution_message_sent", group_id=group_id, chars=len(text), instance=self.instance)
            return resp.json()

    async def send_media(self, group_id: str, media_base64: str, mediatype: str, mimetype: str, filename: str, caption: str = "") -> dict:
        """Envia imagem/vídeo/documento. media_base64 sem prefixo data:."""
        if self._is_group_destination(group_id):
            logger.warning("group_media_skipped_kill_switch", group_id=group_id, mediatype=mediatype)
            return {"skipped": "group_send_disabled", "logged_only": True, "group_id": group_id}
        payload = {
            "number": group_id,
            "mediatype": mediatype,   # image | video | document
            "mimetype": mimetype,
            "media": media_base64,
            "fileName": filename,
            "caption": caption,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                self._url(f"/message/sendMedia/{self.instance}"),
                json=payload, headers=self.headers,
            )
            resp.raise_for_status()
            logger.info("evolution_media_sent", group_id=group_id, mediatype=mediatype, instance=self.instance)
            return resp.json()

    async def send_audio(self, group_id: str, audio_base64: str) -> dict:
        """Envia áudio como mensagem de voz (PTT)."""
        if self._is_group_destination(group_id):
            logger.warning("group_audio_skipped_kill_switch", group_id=group_id)
            return {"skipped": "group_send_disabled", "logged_only": True, "group_id": group_id}
        payload = {
            "number": group_id,
            "audio": audio_base64,
            "encoding": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                self._url(f"/message/sendWhatsAppAudio/{self.instance}"),
                json=payload, headers=self.headers,
            )
            resp.raise_for_status()
            logger.info("evolution_audio_sent", group_id=group_id, instance=self.instance)
            return resp.json()

    async def get_media_base64(self, evolution_msg_id: str) -> dict:
        """Baixa base64 de uma mídia recebida (descriptografa a URL .enc do WhatsApp)."""
        payload = {"message": {"key": {"id": evolution_msg_id}}, "convertToMp4": False}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                self._url(f"/chat/getBase64FromMediaMessage/{self.instance}"),
                json=payload, headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def send_typing(self, group_id: str, duration_ms: int = 3000):
        """Send typing indicator to a group."""
        payload = {
            "number": group_id,
            "delay": duration_ms,
            "presence": "composing",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.post(
                    self._url(f"/chat/sendPresence/{self.instance}"),
                    json=payload,
                    headers=self.headers,
                )
                resp.raise_for_status()
            except Exception as e:
                logger.warning("evolution_typing_failed", error=str(e))

    async def get_groups(self) -> list[dict]:
        """Fetch all groups the WhatsApp instance is part of."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                self._url(f"/group/fetchAllGroups/{self.instance}"),
                headers=self.headers,
                params={"getParticipants": "false"},
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list):
                return data
            return data.get("groups", [])

    async def get_group_info(self, group_id: str) -> dict:
        """Get details about a specific group."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                self._url(f"/group/findGroupInfos/{self.instance}"),
                headers=self.headers,
                params={"groupJid": group_id},
            )
            resp.raise_for_status()
            return resp.json()

    async def configure_webhook(self, webhook_url: str) -> dict:
        """Configure the webhook for this Evolution instance."""
        payload = {
            "webhook": {
                "enabled": True,
                "url": webhook_url,
                "webhookByEvents": False,
                "webhookBase64": False,
                "events": ["MESSAGES_UPSERT"],
            }
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                self._url(f"/webhook/set/{self.instance}"),
                json=payload,
                headers=self.headers,
            )
            resp.raise_for_status()
            logger.info("evolution_webhook_configured", url=webhook_url)
            return resp.json()

    async def get_webhook(self) -> dict:
        """Get current webhook config."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                self._url(f"/webhook/find/{self.instance}"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def check_connection(self) -> dict:
        """Check WhatsApp connection status."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                self._url(f"/instance/connectionState/{self.instance}"),
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def send_long_text(self, group_id: str, text: str, chunk_size: int = 4000):
        """Split and send long messages in chunks."""
        if len(text) <= chunk_size:
            return await self.send_text(group_id, text)

        parts = []
        while text:
            # Try to split on newline or sentence boundary
            chunk = text[:chunk_size]
            split_pos = chunk.rfind("\n\n")
            if split_pos == -1:
                split_pos = chunk.rfind(". ")
            if split_pos == -1:
                split_pos = chunk_size
            else:
                split_pos += 1

            parts.append(text[:split_pos].strip())
            text = text[split_pos:].strip()

        results = []
        for i, part in enumerate(parts):
            if i > 0:
                import asyncio
                await asyncio.sleep(1)  # Brief delay between chunks
            result = await self.send_text(group_id, part)
            results.append(result)

        return results


# Global singletons
evolution_client = EvolutionAPIClient()

# Cliente dedicado ao funil comercial de entrada (leads via DM). Usa instância
# separada da Evolution para isolar o tráfego do setor comercial das demais
# funções internas que seguem rodando no número padrão (Parket).
evolution_comercial_client = EvolutionAPIClient(
    instance=settings.EVOLUTION_COMERCIAL_INSTANCE,
    api_key=settings.EVOLUTION_COMERCIAL_API_KEY or settings.EVOLUTION_API_KEY,
)

# Cliente da Secretaria de Obras — usado pra disparar mensagens pra
# prestadores de serviço (Check Diário e similares). Mantém as conversas
# isoladas do número Parket principal.
evolution_secretaria_client = EvolutionAPIClient(
    instance=settings.EVOLUTION_SECRETARIA_INSTANCE,
    api_key=settings.EVOLUTION_SECRETARIA_API_KEY or settings.EVOLUTION_API_KEY,
)


def get_client_for_instance(instance_name: str | None) -> EvolutionAPIClient:
    """Pick the correct Evolution client based on the instance that received the webhook.

    Commercial-funnel DMs arrive via the dedicated commercial instance; all other
    traffic keeps using the default (Parket) instance.
    """
    if instance_name and instance_name.strip() == settings.EVOLUTION_COMERCIAL_INSTANCE.strip():
        return evolution_comercial_client
    return evolution_client
