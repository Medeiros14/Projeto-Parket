"""Cliente Evolution API — enviar WhatsApp via Parket instance.

Em ENV=dev, todo destinatário é forçado pro Will (regra `whatsapp/debug-phone-rule.md`).
"""

from __future__ import annotations

import structlog
from agno.tools import tool
import httpx

from app.config import settings

log = structlog.get_logger()


def _normalize_phone(raw: str) -> str:
    """Normaliza pra E.164 sem '+' (ex: 5511939213329) — formato Evolution."""
    return "".join(ch for ch in raw if ch.isdigit())


def _send(phone: str, text: str, instance: str | None = None) -> dict:
    # KILL SWITCH 2026-06-30: envios pra grupos WhatsApp (@g.us) desligados —
    # número da Parket estava sendo banido pela Meta. DMs continuam funcionando.
    if isinstance(phone, str) and phone.endswith("@g.us"):
        log.warning("group send skipped (kill switch)", to=phone, chars=len(text or ""), preview=(text or "")[:200])
        return {"skipped": "group_send_disabled", "logged_only": True, "to": phone}
    instance = instance or settings.evolution_instance
    url = f"{settings.evolution_url}/message/sendText/{instance}"
    payload = {"number": _normalize_phone(phone), "text": text}
    headers = {"apikey": settings.evolution_api_key, "Content-Type": "application/json"}
    with httpx.Client(timeout=15.0) as client:
        r = client.post(url, json=payload, headers=headers)
    log.info("evolution send", to=phone, instance=instance, status=r.status_code)
    return {"status_code": r.status_code, "body": r.text[:500]}


@tool(name="whatsapp_send", show_result=True)
def whatsapp_send(phone: str, text: str, instance: str | None = None) -> dict:
    """Envia mensagem WhatsApp via Evolution.

    Args:
        phone: número de telefone (com DDI/DDD). Em ENV=dev é IGNORADO e força Will.
        text: corpo da mensagem.
        instance: instância Evolution (default 'Parket'). Outras: 'Comercial - Parket', 'Secretaria - Obras Parket'.
    """
    target = phone if settings.is_prod else settings.will_phone
    if not settings.is_prod and phone != settings.will_phone:
        log.warning("dev mode — redirecting to Will", original=phone, will=settings.will_phone)
    return _send(target, text, instance)


def notify_will_impl(text: str) -> dict:
    """Implementação pura de envio pro Will — chamável por confirm.py e outros."""
    return _send(settings.will_phone, text, settings.evolution_instance)


@tool(name="whatsapp_notify_will", show_result=True)
def notify_will(text: str) -> dict:
    """Envia mensagem direta pro Will (5511939213329, instance Parket)."""
    return notify_will_impl(text)


def notify_backlog_impl(text: str) -> dict:
    """DESLIGADO em 2026-06-30 — envios pro grupo Backlog Parket estavam fazendo
    o número do WhatsApp da Parket ser banido pela Meta. Continua aceitando chamadas
    pra não quebrar agentes, mas só loga localmente sem enviar HTTP."""
    log.info("backlog notify skipped (disabled)", chars=len(text or ""), preview=(text or "")[:200])
    return {"ok": True, "skipped": "backlog_disabled", "logged_only": True}


@tool(name="whatsapp_notify_backlog", show_result=True)
def notify_backlog(text: str) -> dict:
    """[DESLIGADO] Notifica o grupo Backlog Parket sobre execução. Atualmente só loga,
    não envia — desabilitado pra evitar ban da Meta no número Parket."""
    return notify_backlog_impl(text)
