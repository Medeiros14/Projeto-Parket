"""Worker WhatsApp — polla mensagens do Will e resolve tokens de confirmação.

Approach: lê `public.whatsapp_messages` no Supabase Cloud (via PostgREST) filtrado
por phone=Will + created_at > last_check. Extrai padrão `sim <token>` ou `não <token>`,
faz match com `eas.eas_confirmations` e resolve.

Não modifica `whatsapp_messages` (não precisa marcar processed) — mantemos last_check
em memória e usamos UNIQUE constraint do token na tabela de confirmações pra evitar dupla aprovação.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timedelta, timezone

import httpx
import structlog

from app.config import settings
from app.tools.confirm import resolve_confirmation

log = structlog.get_logger()

POLL_INTERVAL_SEC = 5
LOOKBACK_INITIAL_SEC = 60

TOKEN_RE = re.compile(r"\b(sim|nao|n[aã]o)\s+([0-9a-f]{4,8})\b", re.IGNORECASE)


def _normalize_decision(word: str) -> str:
    word = word.lower().strip()
    if word.startswith("s"):
        return "approved"
    return "denied"


async def _fetch_recent_messages(since_iso: str) -> list[dict]:
    """Lê whatsapp_messages do Supabase Cloud via PostgREST com service_role."""
    url = f"{settings.supabase_url}/rest/v1/whatsapp_messages"
    params = {
        "select": "id,phone,body,created_at,direction",
        "phone": f"eq.{settings.will_phone}",
        "direction": "eq.in",
        "created_at": f"gte.{since_iso}",
        "order": "created_at.asc",
        "limit": "50",
    }
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, params=params, headers=headers)
        if r.status_code >= 400:
            log.warning("whatsapp poll http error", status=r.status_code, body=r.text[:200])
            return []
        return r.json()
    except Exception as exc:  # noqa: BLE001
        log.warning("whatsapp poll exception", error=str(exc))
        return []


async def _loop(stop_event: asyncio.Event) -> None:
    """Loop principal — roda até stop_event ser setado."""
    last_check = datetime.now(timezone.utc) - timedelta(seconds=LOOKBACK_INITIAL_SEC)
    log.info("whatsapp poller started", will_phone=settings.will_phone, interval=POLL_INTERVAL_SEC)

    while not stop_event.is_set():
        try:
            now = datetime.now(timezone.utc)
            msgs = await _fetch_recent_messages(last_check.isoformat())
            for m in msgs:
                body = (m.get("body") or "").strip()
                match = TOKEN_RE.search(body)
                if not match:
                    continue
                decision = _normalize_decision(match.group(1))
                token = match.group(2).lower()
                result = resolve_confirmation(token, decision, notes=f"via WhatsApp msg {m.get('id')}")
                log.info("confirmation resolved", token=token, decision=decision, result=result)
            last_check = now
        except Exception as exc:  # noqa: BLE001
            log.error("whatsapp poller loop error", error=str(exc))

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=POLL_INTERVAL_SEC)
        except asyncio.TimeoutError:
            pass


_TASK: asyncio.Task | None = None
_STOP: asyncio.Event | None = None


async def start():
    global _TASK, _STOP
    if _TASK and not _TASK.done():
        return
    _STOP = asyncio.Event()
    _TASK = asyncio.create_task(_loop(_STOP))


async def stop():
    if _STOP:
        _STOP.set()
    if _TASK:
        try:
            await asyncio.wait_for(_TASK, timeout=10)
        except asyncio.TimeoutError:
            _TASK.cancel()
