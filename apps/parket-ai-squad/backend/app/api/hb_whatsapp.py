"""
HOME BROKER WhatsApp — envio de mensagens pelo SDR/vendedor pelo número
Comercial Parket (instância "Comercial - Parket", 5511999600222).

A IA NUNCA envia. Só sugere — endpoint separado (Fase 3).
Aqui é apenas: humano clica enviar → vai pra Evolution → vira mensagem real.
"""
from __future__ import annotations

import base64
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.evolution_client import EvolutionAPIClient
from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/hb-whatsapp", tags=["hb-whatsapp"])

INSTANCE = "Comercial - Parket"


class SendInput(BaseModel):
    card_id: str
    mensagem: str
    telefone: Optional[str] = None  # se omitido, busca do card.details ou última msg
    sender_name: Optional[str] = None  # nome do SDR (pra registrar quem mandou)


def _normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) < 10:
        return None
    if not digits.startswith("55"):
        digits = "55" + digits
    return digits


def _phone_match_variants(raw: str) -> list[str]:
    """Todas as formas BR do número: com/sem DDI 55, com/sem 9º dígito.

    JID do WhatsApp pode vir sem o 9º dígito enquanto o card guarda com —
    match por sufixo de 11 dígitos falha nesses casos.
    """
    d = re.sub(r"\D", "", raw or "")
    if len(d) < 10:
        return []
    local = d[2:] if d.startswith("55") and len(d) in (12, 13) else d[-11:]
    if len(local) not in (10, 11):
        local = d[-11:]
    forms = {local}
    if len(local) == 11 and local[2] == "9":
        forms.add(local[:2] + local[3:])
    elif len(local) == 10:
        forms.add(local[:2] + "9" + local[2:])
    out: set[str] = set()
    for f in forms:
        out.add(f)
        out.add("55" + f)
    return sorted(out)


async def _resolve_phone(card_id: str, fallback: str | None) -> str | None:
    """Resolve o telefone do destinatário pra um card. Ordem:
    1) fallback explícito vindo do payload
    2) kanban_cards.details.telefone / .celular
    3) última mensagem do card em whatsapp_messages
    """
    if fallback:
        n = _normalize_phone(fallback)
        if n:
            return n
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return None
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    }
    async with httpx.AsyncClient(timeout=8.0) as c:
        # 1) card.details
        r = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/kanban_cards",
            headers=headers,
            params={"id": f"eq.{card_id}", "select": "details", "limit": "1"},
        )
        if r.status_code == 200 and r.json():
            det = (r.json()[0] or {}).get("details") or {}
            for k in ("telefone", "celular", "phone", "whatsapp"):
                v = det.get(k)
                if v:
                    n = _normalize_phone(str(v))
                    if n:
                        return n
        # 2) última mensagem do card
        r2 = await c.get(
            f"{settings.SUPABASE_URL}/rest/v1/whatsapp_messages",
            headers=headers,
            params={
                "card_id": f"eq.{card_id}",
                "phone": "not.is.null",
                "select": "phone",
                "order": "timestamp.desc",
                "limit": "1",
            },
        )
        if r2.status_code == 200 and r2.json():
            n = _normalize_phone(r2.json()[0].get("phone") or "")
            if n:
                return n
    return None


async def _log_message_to_supabase(card_id: str, phone: str, text: str, sender_name: str | None, evolution_msg_id: str | None):
    """Insere a mensagem enviada em whatsapp_messages pra realtime aparecer
    no chat do home broker imediatamente. Em paralelo a Evolution também
    vai mandar via webhook, mas inserir aqui garante que o user vê na hora."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return
    body = {
        "card_id": card_id,
        "phone": phone,
        "instance": INSTANCE,
        "direction": "out",
        "sender_name": sender_name or "SDR",
        "message_text": text,
        "message_type": "text",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "evolution_msg_id": evolution_msg_id,
        "metadata": {"origin": "homebroker", "sent_by": sender_name},
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            await c.post(
                f"{settings.SUPABASE_URL}/rest/v1/whatsapp_messages",
                headers={
                    "apikey": settings.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json=body,
            )
    except Exception as e:
        logger.warning("hb_msg_log_failed", error=str(e)[:200])


@router.post("/send")
async def send_message(payload: SendInput):
    """Envia uma mensagem pelo SDR/vendedor via instância Comercial - Parket."""
    if not payload.mensagem.strip():
        raise HTTPException(400, "Mensagem vazia")
    phone = await _resolve_phone(payload.card_id, payload.telefone)
    if not phone:
        raise HTTPException(404, "Telefone não encontrado pra esse card (e não foi passado no payload)")

    client = EvolutionAPIClient(instance=INSTANCE)
    try:
        result = await client.send_text(group_id=phone, text=payload.mensagem)
        msg_id = None
        try:
            msg_id = (result or {}).get("key", {}).get("id")
        except Exception:
            pass
        await _log_message_to_supabase(
            payload.card_id, phone, payload.mensagem.strip(), payload.sender_name, msg_id,
        )
        logger.info("hb_msg_sent", card_id=payload.card_id, phone=phone, sender=payload.sender_name)
        return {"ok": True, "phone": phone, "message_id": msg_id}
    except httpx.HTTPStatusError as e:
        body_err = ""
        try: body_err = e.response.text[:300]
        except Exception: pass
        logger.error("hb_send_http_error", status=e.response.status_code, body=body_err[:200])
        # Caso comum: número não cadastrado no WhatsApp. Evolution retorna 400 com
        # `exists: false`. Devolve 422 com mensagem clara pro front mostrar pro
        # vendedor — em vez de 502 (que perde CORS headers em alguns proxies).
        if e.response.status_code == 400 and ("exists\":false" in body_err or "exists': false" in body_err):
            raise HTTPException(422, "Esse número não está cadastrado no WhatsApp. Confirme o telefone do cliente.")
        raise HTTPException(502, f"Evolution {e.response.status_code}: {body_err}")
    except Exception as e:
        logger.error("hb_send_failed", error=str(e)[:300])
        raise HTTPException(500, str(e)[:300])


class TypingInput(BaseModel):
    card_id: str
    telefone: Optional[str] = None
    duration_ms: int = 3000


@router.post("/typing")
async def send_typing(payload: TypingInput):
    """Indicador 'digitando…' visível pro destinatário no WhatsApp dele.
    Best-effort — não bloqueia se falhar."""
    phone = await _resolve_phone(payload.card_id, payload.telefone)
    if not phone:
        return {"ok": False, "error": "no phone"}
    client = EvolutionAPIClient(instance=INSTANCE)
    try:
        await client.send_typing(group_id=phone, duration_ms=int(payload.duration_ms))
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


# ───── MÍDIA (envio + leitura) ────────────────────────────────────
def _detect_mediatype(mime: str) -> str:
    if mime.startswith("image/"):     return "image"
    if mime.startswith("video/"):     return "video"
    return "document"

@router.post("/send-media")
async def send_media(
    card_id: str = Form(...),
    caption: str = Form(""),
    telefone: Optional[str] = Form(None),
    sender_name: Optional[str] = Form(None),
    file: UploadFile = File(...),
):
    """Envia imagem/vídeo/documento pra um card. Multipart: file + card_id + caption."""
    phone = await _resolve_phone(card_id, telefone)
    if not phone:
        raise HTTPException(404, "Telefone não encontrado pra esse card")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Arquivo vazio")
    if len(raw) > 16 * 1024 * 1024:
        raise HTTPException(413, "Arquivo > 16MB (limite WhatsApp)")
    b64 = base64.b64encode(raw).decode("ascii")
    mime = file.content_type or "application/octet-stream"
    mediatype = _detect_mediatype(mime)
    filename = file.filename or f"arquivo.{mime.split('/')[-1]}"

    client = EvolutionAPIClient(instance=INSTANCE)
    try:
        result = await client.send_media(
            group_id=phone, media_base64=b64,
            mediatype=mediatype, mimetype=mime, filename=filename, caption=caption,
        )
        msg_id = None
        try: msg_id = (result or {}).get("key", {}).get("id")
        except Exception: pass
        await _log_message_to_supabase(
            card_id, phone,
            caption or f"📎 {filename}",
            sender_name, msg_id,
        )
        return {"ok": True, "phone": phone, "message_id": msg_id, "mediatype": mediatype, "filename": filename}
    except httpx.HTTPStatusError as e:
        body_err = ""
        try: body_err = e.response.text[:300]
        except Exception: pass
        logger.error("hb_send_media_http_error", status=e.response.status_code, body=body_err[:200])
        raise HTTPException(502, f"Evolution {e.response.status_code}: {body_err}")
    except Exception as e:
        logger.error("hb_send_media_failed", error=str(e)[:300])
        raise HTTPException(500, str(e)[:300])


@router.post("/send-audio")
async def send_audio(
    card_id: str = Form(...),
    telefone: Optional[str] = Form(None),
    sender_name: Optional[str] = Form(None),
    file: UploadFile = File(...),
):
    """Envia áudio gravado pelo SDR como mensagem de voz (PTT)."""
    phone = await _resolve_phone(card_id, telefone)
    if not phone:
        raise HTTPException(404, "Telefone não encontrado pra esse card")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Áudio vazio")
    b64 = base64.b64encode(raw).decode("ascii")
    client = EvolutionAPIClient(instance=INSTANCE)
    try:
        result = await client.send_audio(group_id=phone, audio_base64=b64)
        msg_id = None
        try: msg_id = (result or {}).get("key", {}).get("id")
        except Exception: pass
        await _log_message_to_supabase(card_id, phone, "🎤 áudio", sender_name, msg_id)
        return {"ok": True, "phone": phone, "message_id": msg_id}
    except httpx.HTTPStatusError as e:
        body_err = ""
        try: body_err = e.response.text[:300]
        except Exception: pass
        raise HTTPException(502, f"Evolution {e.response.status_code}: {body_err}")
    except Exception as e:
        logger.error("hb_send_audio_failed", error=str(e)[:300])
        raise HTTPException(500, str(e)[:300])


class CreateCardInput(BaseModel):
    phone: str                       # ex: "5511977357085" ou "11977357085"
    nome: Optional[str] = None       # nome do contato (sender_name do WA)
    instance: Optional[str] = None   # ex: "Comercial - Parket"


@router.post("/create-card")
async def create_card_for_phone(payload: CreateCardInput):
    """Cria card no funil comercial-entrada/leads-entrada para um número
    de WhatsApp que ainda não tem cadastro. Usado pela Sala ao Vivo quando
    o atendente clica 'Criar card'. Faz backfill: vincula todas as mensagens
    existentes desse telefone ao novo card."""
    import random
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(500, "Supabase não configurado")

    digits = re.sub(r"\D", "", payload.phone or "")
    if len(digits) < 10:
        raise HTTPException(400, "Telefone inválido")

    # Armazena no card no padrão "11977357085" (DDD+NN, sem 55), mesmo
    # padrão usado por leads_capture pra match futuro funcionar.
    phone_norm = digits[-11:] if len(digits) >= 11 else digits
    title = (payload.nome or "").strip() or f"WhatsApp +{digits}"
    sdr = random.choice(["Vinicius Arruda", "Rafael Calazans"])
    inst = (payload.instance or "Comercial - Parket")
    now_iso = datetime.now(timezone.utc).isoformat()

    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    card_payload = {
        "dept_id": "comercial-entrada",
        "column_id": "leads-entrada",
        "title": title,
        "subtitle": None,
        "responsavel": sdr,
        "priority": "normal",
        "tags": ["whatsapp", "lead-direto", f"sdr:{sdr.split()[0].lower()}"],
        "details": {
            "sdr": sdr,
            "nome": title,
            "status_lead": "novo",
            "nivel_lead": "",
            "criado_por": "Sala ao Vivo (Homebroker)",
            "data_criada": now_iso,
            "lead_captured_at": now_iso,
            "celular": phone_norm,
            "telefone_comercial": "",
            "origem": "whatsapp",
            "origem_lead": "WhatsApp Direto",
            "origem_detalhe": "lead_wa_direto",
            "platform": "whatsapp",
            "platform_label": "WhatsApp Direto",
            # Default TRUE: a Teca atende por default. Quando vendedor manda
            # mensagem pelo Comercial, `handle_outbound_dm` (webhooks.py:1155)
            # automaticamente seta False com reason='vendedor enviou mensagem',
            # pausando a Teca. O default antigo (False) bloqueava 100% dos leads
            # CTWA (Meta Ads) — o frontend chama esse endpoint automaticamente ao
            # receber primeira DM, então a Teca skipava antes mesmo de processar.
            "teka_ativa": True,
            "evo_instance": inst,
            "qualificacao_inicial": (
                f"Lead chegou direto pelo WhatsApp ({inst}). "
                "Card criado automaticamente pela Sala ao Vivo."
            ),
        },
    }

    variants = _phone_match_variants(digits)
    vlist = ",".join(variants)

    async with httpx.AsyncClient(timeout=15) as cli:
        # Idempotência: se já existe card pra esse número (qualquer variação
        # com/sem DDI ou 9º dígito), só vincula as mensagens órfãs e retorna.
        try:
            rq = await cli.get(
                f"{settings.SUPABASE_URL}/rest/v1/kanban_cards",
                headers=headers,
                params={
                    "select": "id,title",
                    "dept_id": "in.(comercial-entrada,comercial)",
                    "or": f"(details->>celular.in.({vlist}),details->>telefone.in.({vlist}))",
                    "order": "created_at.desc",
                    "limit": "1",
                },
            )
            if rq.status_code == 200 and rq.json():
                existing_id = rq.json()[0]["id"]
                await cli.patch(
                    f"{settings.SUPABASE_URL}/rest/v1/whatsapp_messages?card_id=is.null&phone=in.({vlist})",
                    headers={**headers, "Prefer": "return=minimal"},
                    json={"card_id": existing_id},
                )
                logger.info("hb_create_card_existed", card_id=existing_id, phone=phone_norm)
                return {"ok": True, "card_id": existing_id, "title": rq.json()[0].get("title"), "existed": True}
        except Exception as e:
            logger.warning("hb_create_card_dedup_failed", error=str(e)[:200])

        rc = await cli.post(f"{settings.SUPABASE_URL}/rest/v1/kanban_cards",
                            headers=headers, json=card_payload)
        if rc.status_code not in (200, 201):
            logger.warning("hb_create_card_failed", status=rc.status_code, body=rc.text[:200])
            raise HTTPException(502, f"Supabase {rc.status_code}: {rc.text[:200]}")
        body_json = rc.json()
        if not body_json:
            raise HTTPException(500, "Card não retornado pelo Supabase")
        new_card_id = body_json[0]["id"]

        # Backfill: vincula mensagens existentes desse phone (últimos 11 dígitos)
        # ao novo card via RPC ou PATCH em lote.
        try:
            # Vincula por qualquer variação do número (com/sem DDI, com/sem 9º dígito)
            await cli.patch(
                f"{settings.SUPABASE_URL}/rest/v1/whatsapp_messages?card_id=is.null&phone=in.({vlist})",
                headers={**headers, "Prefer": "return=minimal"},
                json={"card_id": new_card_id},
            )
        except Exception as e:
            logger.warning("hb_create_card_backfill_failed", error=str(e)[:200])

    logger.info("hb_create_card_ok", card_id=new_card_id, phone=phone_norm, sdr=sdr)
    return {"ok": True, "card_id": new_card_id, "title": title, "sdr": sdr}


@router.get("/media/{evolution_msg_id}")
async def get_media(evolution_msg_id: str):
    """Proxy pra baixar mídia recebida (WhatsApp manda URL .enc que precisa
    ser descriptografada pela Evolution API). Retorna o arquivo bruto."""
    client = EvolutionAPIClient(instance=INSTANCE)
    try:
        data = await client.get_media_base64(evolution_msg_id)
        b64 = data.get("base64") or data.get("media") or ""
        if not b64:
            raise HTTPException(404, "Mídia não disponível ou expirada")
        mime = data.get("mimetype") or "application/octet-stream"
        raw = base64.b64decode(b64)
        from io import BytesIO
        return StreamingResponse(BytesIO(raw), media_type=mime, headers={
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": f'inline; filename="{data.get("fileName") or "media"}"',
        })
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Evolution {e.response.status_code}")
    except Exception as e:
        logger.warning("hb_get_media_failed", msg_id=evolution_msg_id, error=str(e)[:200])
        raise HTTPException(500, str(e)[:200])
