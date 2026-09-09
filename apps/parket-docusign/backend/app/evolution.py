"""Cliente Evolution API pra enviar WhatsApp via instância Parket."""
from __future__ import annotations
import os
import httpx
import structlog

log = structlog.get_logger(__name__)

EVOLUTION_BASE = os.getenv("EVOLUTION_BASE", "https://conect.parket.works")
EVOLUTION_APIKEY = os.getenv("EVOLUTION_APIKEY", "4eab105201410d6865b86dca76ee9fa3")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "Parket")

# Grupo destino pra notificações de contrato. Pode sobrescrever via env.
GROUP_FINANCEIRO_ID = os.getenv(
    "EVOLUTION_GROUP_FINANCEIRO",
    "120363407134075532@g.us",
)


async def send_text(number: str, text: str, instance: str | None = None) -> bool:
    """Envia mensagem de texto. `number` pode ser DDDNNNNNNN ou um ID
    de grupo (com sufixo `@g.us`). Retorna True se HTTP 200/201."""
    url = f"{EVOLUTION_BASE}/message/sendText/{instance or EVOLUTION_INSTANCE}"
    payload = {"number": number, "text": text}
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                url,
                headers={"apikey": EVOLUTION_APIKEY, "Content-Type": "application/json"},
                json=payload,
            )
        if r.status_code in (200, 201):
            log.info("evolution_sent", to=number, len=len(text))
            return True
        log.warning("evolution_failed", status=r.status_code, body=r.text[:200])
        return False
    except Exception as exc:
        log.exception("evolution_exception", err=str(exc))
        return False


async def notify_financeiro(text: str) -> bool:
    """Envia mensagem pro grupo 💰 Parket - Financeiro."""
    return await send_text(GROUP_FINANCEIRO_ID, text)
