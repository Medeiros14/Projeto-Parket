"""
Webhook Fiscal Laudo
====================
Recebe mensagens dos grupos WhatsApp dos fiscais (registrados em
fiscal_equipe.whatsapp_group_jid) e vincula automaticamente ao laudo
do agendamento mais recente para aquele fiscal.

Suporta texto, áudio, imagem e vídeo:
  - Texto      → salvo em fiscal_laudo_messages.content
  - Áudio/img/video → baixa do Evolution Storage, faz upload pro
                       Supabase Storage (bucket fiscal-media), salva URL.

A identificação do laudo segue:
  1. Pelo group_jid → encontra fiscal_id em fiscal_equipe
  2. Pelo fiscal_id → último fiscal_agenda ativo (status NOT IN finalizados)
  3. Pelo (card_id, tipo) do agendamento → fiscal_laudos
  4. Cria laudo-stub se não existir

Endpoint registrado em main.py: POST /webhook/fiscal-laudo
Encaminhado pelo agente.parket.works:/api/webhook/evolution → este handler.
"""
from __future__ import annotations

import base64
import httpx
import structlog
import uuid
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Request

from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["webhook-fiscal-laudo"])

SB_URL = settings.SUPABASE_URL
SB_KEY = settings.SUPABASE_SERVICE_KEY
SB_HDR = {
    "apikey": SB_KEY,
    "Authorization": f"Bearer {SB_KEY}",
    "Content-Type": "application/json",
}

EVO_URL = "https://conect.parket.works"
EVO_INSTANCE = "Parket"
EVO_KEY = "4eab105201410d6865b86dca76ee9fa3"

# Status finais — agendamentos nesses não são candidatos
DONE_AGENDA = {"realizado", "realizada", "cancelado", "cancelada"}


# ───────────────────────────────────────────────────────────────────────
#  Helpers
# ───────────────────────────────────────────────────────────────────────

async def sb_get(table: str, params: dict) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SB_URL}/rest/v1/{table}", headers=SB_HDR, params=params)
        if r.is_success:
            try:
                return r.json()
            except Exception:
                return []
        logger.warning("sb_get_failed", table=table, status=r.status_code, body=r.text[:200])
        return []


async def sb_insert(table: str, payload: dict, return_min: bool = False) -> dict | list:
    hdr = dict(SB_HDR)
    hdr["Prefer"] = "return=representation" if not return_min else "return=minimal"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{SB_URL}/rest/v1/{table}", headers=hdr, json=payload)
        if r.is_success:
            try:
                data = r.json()
                return data if isinstance(data, list) else [data]
            except Exception:
                return []
        logger.warning("sb_insert_failed", table=table, status=r.status_code, body=r.text[:300])
        return []


async def sb_update(table: str, match: dict, payload: dict) -> bool:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.patch(
            f"{SB_URL}/rest/v1/{table}",
            headers={**SB_HDR, "Prefer": "return=minimal"},
            params=match,
            json=payload,
        )
        return r.is_success


# ───────────────────────────────────────────────────────────────────────
#  Lookup: qual laudo essa mensagem pertence?
# ───────────────────────────────────────────────────────────────────────

async def _find_fiscal_for_jid(group_jid: str) -> dict | None:
    rows = await sb_get(
        "fiscal_equipe",
        {"select": "id,nome,whatsapp_group_jid", "whatsapp_group_jid": f"eq.{group_jid}", "limit": "1"},
    )
    return rows[0] if rows else None


async def _find_active_agenda(fiscal_id: str) -> dict | None:
    """Pega o agendamento "em andamento" do fiscal, PREFERINDO os COM
    card_id (sem card_id, o laudo não pode ser criado e a mensagem vira
    órfã — não atualiza o Dashboard). Ordem de preferência:
      A1) passado/atual mais recente COM card_id (data_inicio ≤ NOW)
      A2) próximo futuro COM card_id (data_inicio > NOW, no mesmo dia)
      B1) passado/atual mais recente sem card_id (fallback pra registrar mensagem)
      B2) próximo futuro sem card_id (último recurso)
    """
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    eod_iso = (now + timedelta(hours=18)).isoformat()  # janela curta de "próximo"
    base_params = {
        "select": "id,card_id,tipo,obra,cliente,status,data_inicio",
        "fiscal_id": f"eq.{fiscal_id}",
        "status": f"not.in.({','.join(DONE_AGENDA)})",
        "limit": "1",
    }

    # A1: passado/atual COM card_id
    rows = await sb_get("fiscal_agenda", {
        **base_params,
        "card_id": "not.is.null",
        "data_inicio": f"lte.{now_iso}",
        "order": "data_inicio.desc",
    })
    if rows: return rows[0]

    # A2: próximo futuro COM card_id (até 18h pra frente)
    rows = await sb_get("fiscal_agenda", {
        **base_params,
        "card_id": "not.is.null",
        "data_inicio": f"gt.{now_iso}",
        "order": "data_inicio.asc",
    })
    if rows: return rows[0]

    # B1: fallback sem card_id (passado/atual)
    rows = await sb_get("fiscal_agenda", {
        **base_params,
        "data_inicio": f"lte.{now_iso}",
        "order": "data_inicio.desc",
    })
    if rows: return rows[0]

    # B2: fallback sem card_id (futuro)
    rows = await sb_get("fiscal_agenda", {
        **base_params,
        "data_inicio": f"gt.{now_iso}",
        "order": "data_inicio.asc",
    })
    return rows[0] if rows else None


async def _find_or_create_laudo(agenda: dict, fiscal: dict) -> str | None:
    """Pega laudo do (card_id, tipo). Se não existe, cria um stub."""
    if not agenda.get("card_id") or not agenda.get("tipo"):
        return None
    rows = await sb_get(
        "fiscal_laudos",
        {
            "select": "id",
            "card_id": f"eq.{agenda['card_id']}",
            "tipo": f"eq.{agenda['tipo']}",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    if rows:
        return rows[0]["id"]
    # Deriva servicos_inclusos do card pra IA já saber o escopo de cara
    servicos = await _detect_servicos_from_card(agenda["card_id"])
    # Cria stub
    payload = {
        "card_id": agenda["card_id"],
        "obra": agenda.get("obra") or "",
        "cliente": agenda.get("cliente") or "",
        "tipo": agenda["tipo"],
        "fiscal_id": fiscal.get("id"),
        "fiscal_nome": fiscal.get("nome"),
        "data_vistoria": (agenda.get("data_inicio") or "")[:10] or None,
        "status": "pendente",
        "servicos_inclusos": servicos,
    }
    res = await sb_insert("fiscal_laudos", payload)
    if isinstance(res, list) and res:
        return res[0].get("id")
    return None


async def _detect_servicos_from_card(card_id: str) -> list[str]:
    """Lê o card e infere quais seções (piso/forro/deck/painel/escada/etc.)
    aparecem no escopo, casando palavras-chave em title/details.servicos."""
    if not card_id:
        return []
    rows = await sb_get(
        "kanban_cards",
        {"select": "id,title,details", "id": f"eq.{card_id}", "limit": "1"},
    )
    if not rows:
        return []
    card = rows[0] or {}
    details = card.get("details") or {}
    blob = " ".join([
        str(card.get("title") or ""),
        str(details.get("servicos") or ""),
        str(details.get("produtos") or ""),
        str(details.get("tipo_projeto") or ""),
    ]).lower()
    keywords = {
        "piso":   ["piso", "assoalho", "tábua", "tabua", "régua", "regua", " tg ", "engenheirado"],
        "forro":  ["forro", "ripado", "lambri", "tabica", "sanca", "cortineiro", "beiral"],
        "deck":   ["deck"],
        "painel": ["painel", "boiserie", "muxarabi"],
        "porta":  ["porta"],
        "escada": ["escada"],
    }
    found: list[str] = []
    for sec, words in keywords.items():
        if any(w in blob for w in words):
            found.append(sec)
    if details.get("marcenaria") == "SIM" and "painel" not in found:
        found.append("painel")
    return found


# ───────────────────────────────────────────────────────────────────────
#  Mídia: baixa do Evolution + sobe pro Supabase Storage
# ───────────────────────────────────────────────────────────────────────

async def _download_evo_media(message_id: str) -> tuple[bytes, str] | None:
    """Baixa mídia via /chat/getBase64FromMediaMessage. Retorna (bytes, mimetype)."""
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                f"{EVO_URL}/chat/getBase64FromMediaMessage/{EVO_INSTANCE}",
                headers={"apikey": EVO_KEY, "Content-Type": "application/json"},
                json={"message": {"key": {"id": message_id}}},
            )
            if not r.is_success:
                logger.warning("evo_media_failed", status=r.status_code, body=r.text[:200])
                return None
            data = r.json()
            b64 = data.get("base64") or data.get("data")
            mime = data.get("mimetype") or "application/octet-stream"
            if not b64:
                return None
            return base64.b64decode(b64), mime
    except Exception as e:
        logger.warning("evo_media_exception", error=str(e))
        return None


async def _upload_to_storage(content: bytes, mime: str, ext: str) -> str | None:
    """Upload no bucket fiscal-media. Retorna URL pública."""
    fname = f"{datetime.utcnow().strftime('%Y/%m')}/{uuid.uuid4().hex}.{ext}"
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                f"{SB_URL}/storage/v1/object/fiscal-media/{fname}",
                headers={
                    "apikey": SB_KEY,
                    "Authorization": f"Bearer {SB_KEY}",
                    "Content-Type": mime,
                    "x-upsert": "false",
                },
                content=content,
            )
            if not r.is_success:
                logger.warning("storage_upload_failed", status=r.status_code, body=r.text[:200])
                return None
        return f"{SB_URL}/storage/v1/object/public/fiscal-media/{fname}"
    except Exception as e:
        logger.warning("storage_upload_exception", error=str(e))
        return None


# ───────────────────────────────────────────────────────────────────────
#  Roteamento da mensagem do Evolution
# ───────────────────────────────────────────────────────────────────────

def _extract_message_content(msg: dict) -> tuple[str, str | None, str | None]:
    """
    Retorna (kind, text, ext) onde:
      kind in {"text","audio","image","video","unknown"}
      text  = texto livre (se kind=text) ou caption (se kind in image/video)
      ext   = extensão preferida pra mídia (mp3/jpg/mp4)
    """
    if not isinstance(msg, dict):
        return "unknown", None, None
    if "conversation" in msg and msg["conversation"]:
        return "text", msg["conversation"], None
    if msg.get("extendedTextMessage", {}).get("text"):
        return "text", msg["extendedTextMessage"]["text"], None
    if "audioMessage" in msg:
        return "audio", None, "ogg"  # WhatsApp PTT é ogg
    if "imageMessage" in msg:
        cap = msg["imageMessage"].get("caption")
        return "image", cap, "jpg"
    if "videoMessage" in msg:
        cap = msg["videoMessage"].get("caption")
        return "video", cap, "mp4"
    if "documentMessage" in msg:
        return "image", msg["documentMessage"].get("caption"), "pdf"
    return "unknown", None, None


# ───────────────────────────────────────────────────────────────────────
#  Endpoint
# ───────────────────────────────────────────────────────────────────────

@router.post("/webhook/fiscal-laudo")
async def webhook_fiscal_laudo(request: Request):
    """Endpoint chamado pelo agente.parket.works (que recebe da Evolution)
    quando há mensagem em algum grupo de fiscal.
    Pode também ser configurado direto na Evolution se quiser."""
    body = await request.json()
    event = body.get("event", "")
    if event not in ("messages.upsert", "MESSAGES_UPSERT"):
        return {"ok": True, "skip": "wrong event"}

    data = body.get("data", {}) or {}
    key = data.get("key", {}) or {}
    if not isinstance(key, dict):
        return {"ok": True, "skip": "no key"}

    if key.get("fromMe"):
        return {"ok": True, "skip": "fromMe"}

    remote_jid = key.get("remoteJid") or ""
    if not remote_jid.endswith("@g.us"):
        return {"ok": True, "skip": "not group"}

    # Identifica fiscal pelo group_jid
    fiscal = await _find_fiscal_for_jid(remote_jid)
    if not fiscal:
        return {"ok": True, "skip": "fiscal not registered"}

    # Gate de menção: nos grupos dos fiscais a IA só responde quando marcada.
    # Why: fiscais reportaram ruído — IA respondia em conversas internas. Mensagens
    # continuam sendo salvas/vinculadas ao laudo, só os envios outbound são pulados.
    msg_obj = data.get("message") or {}
    ext_text = msg_obj.get("extendedTextMessage") or {}
    ctx_info = ext_text.get("contextInfo") or {}
    mentioned_jids = ctx_info.get("mentionedJid") or []
    msg_text_raw = (
        msg_obj.get("conversation")
        or ext_text.get("text")
        or (msg_obj.get("imageMessage") or {}).get("caption")
        or (msg_obj.get("videoMessage") or {}).get("caption")
        or ""
    )
    BOT_NUMS = ("5511971975808", "173787714732087")
    bot_mentioned = any(any(n in j for n in BOT_NUMS) for j in mentioned_jids)
    text_has_mention = (
        any(n in msg_text_raw for n in BOT_NUMS)
        or "@parket" in msg_text_raw.lower()
    )
    ia_pode_responder = bot_mentioned or text_has_mention

    # Identifica agendamento ativo
    agenda = await _find_active_agenda(fiscal["id"])
    if not agenda:
        # Sem agendamento ativo, mas ainda salvamos a mensagem (sem laudo_id) pra debug
        logger.info("no_active_agenda", fiscal_id=fiscal["id"])
        agenda = {}

    laudo_id = None
    if agenda.get("card_id"):
        laudo_id = await _find_or_create_laudo(agenda, fiscal)

    # Extrai conteúdo
    msg = data.get("message") or {}
    kind, text_content, ext = _extract_message_content(msg)

    media_url = None
    if kind in ("audio", "image", "video"):
        media = await _download_evo_media(key.get("id") or "")
        if media:
            content_bytes, mime = media
            ext_to_use = ext or mime.split("/")[-1].split(";")[0]
            media_url = await _upload_to_storage(content_bytes, mime, ext_to_use)

            # Transcreve áudio / descreve imagem pra alimentar a IA com texto
            try:
                from app.core.media_processor import transcribe_audio, describe_image
                if kind == "audio":
                    txt = await transcribe_audio(content_bytes, mime)
                    if txt:
                        text_content = (text_content or "") + (
                            f"\n[transcrição do áudio]\n{txt}" if text_content else f"[transcrição do áudio] {txt}"
                        )
                elif kind == "image":
                    desc = await describe_image(content_bytes, caption=text_content or "", mime_type=mime)
                    if desc:
                        text_content = (text_content + "\n" if text_content else "") + f"[descrição da imagem] {desc}"
            except Exception as e:
                logger.warning("media_ai_processing_failed", error=str(e))

    # Insere row no fiscal_laudo_messages
    payload = {
        "laudo_id": laudo_id,
        "agenda_id": agenda.get("id"),
        "fiscal_id": fiscal["id"],
        "group_jid": remote_jid,
        "sender_jid": data.get("participant") or key.get("participant") or remote_jid,
        "message_type": kind,
        "content": text_content,
        "media_url": media_url,
        "evolution_message_id": key.get("id"),
    }
    await sb_insert("fiscal_laudo_messages", payload, return_min=True)

    # Se imagem com laudo: também grava em fiscal_fotos pra UI antiga continuar mostrando
    if kind == "image" and laudo_id and media_url:
        await sb_insert(
            "fiscal_fotos",
            {
                "laudo_id": laudo_id,
                "card_id": agenda.get("card_id"),
                "ambiente": text_content or "Foto WhatsApp",
                "url": media_url,
                "descricao": text_content or "",
            },
            return_min=True,
        )

    # IA: analisa mensagens, atualiza laudo, gera follow-up se faltar info.
    # Skip se for kind="unknown" (sticker, reaction, etc.) ou se não há laudo.
    if not ia_pode_responder:
        logger.info("fiscal_ia_skipped_no_mention", group_jid=remote_jid, fiscal=fiscal.get("nome"))
        return {"ok": True, "kind": kind, "laudo_id": laudo_id, "ia": "skipped_no_mention"}

    if laudo_id and kind in ("text", "audio", "image", "video"):
        try:
            from app.core.fiscal_laudo_ai import process_fiscal_message
            await process_fiscal_message(laudo_id, remote_jid)
        except Exception as e:
            logger.warning("fiscal_ai_failed", error=str(e), laudo_id=laudo_id)
            # Fallback: confirmação simples
            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    await c.post(
                        f"{EVO_URL}/message/sendText/{EVO_INSTANCE}",
                        headers={"apikey": EVO_KEY, "Content-Type": "application/json"},
                        json={"number": remote_jid, "text": "✅ Recebido — anexado ao laudo."},
                    )
            except Exception:
                pass
    elif not laudo_id:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                await c.post(
                    f"{EVO_URL}/message/sendText/{EVO_INSTANCE}",
                    headers={"apikey": EVO_KEY, "Content-Type": "application/json"},
                    json={"number": remote_jid, "text": "✅ Recebido (sem agendamento ativo agora — agende uma vistoria pra eu vincular)."},
                )
        except Exception:
            pass

    return {"ok": True, "kind": kind, "laudo_id": laudo_id}
