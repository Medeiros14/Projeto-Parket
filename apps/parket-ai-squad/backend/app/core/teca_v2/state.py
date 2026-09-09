"""
Redis-backed conversation state.

Two keys per phone:
  - teca_v2:conv:{phone}    LIST of JSON messages (role, content, ts, meta)
  - teca_v2:state:{phone}   HASH/JSON: etapa, intent_atual, vendedor_atribuido,
                                       cidade_confirmada, ultima_proposta_horario, etc.
  - teca_v2:paused:{phone}  STRING flag (any value = paused). Set by manual pause
                            button or by Cortex when it detects escalate-to-human.

History is the *single source of truth* for the multi-agent chain — Cortex and
Conversational both read from it.
"""
from __future__ import annotations

import json
import time
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Keep last 80 messages (Teca + lead). Older are trimmed.
HISTORY_LIMIT = 80
HISTORY_TTL = 14 * 24 * 3600  # 14 dias
STATE_TTL = 30 * 24 * 3600    # 30 dias


def _conv_key(phone: str) -> str:
    return f"teca_v2:conv:{phone}"


def _state_key(phone: str) -> str:
    return f"teca_v2:state:{phone}"


def _pause_key(phone: str) -> str:
    return f"teca_v2:paused:{phone}"


def _phone_variants(phone: str) -> list[str]:
    """Variantes BR do número (com/sem DDI 55, com/sem 9º dígito).

    O JID do WhatsApp pode vir sem o 9º dígito (números antigos) enquanto o
    painel manda a forma cadastrada no card — pausar por UMA forma tem que
    valer pra TODAS, senão o pause do ChatPanel não afeta a pipeline.
    """
    import re
    raw = re.sub(r"\D", "", phone or "")
    if not raw:
        return []
    out = {raw}
    d = raw
    if len(d) in (10, 11) and not d.startswith("55"):
        d = "55" + d
        out.add(d)
    if d.startswith("55") and len(d) in (12, 13):
        rest = d[2:]
        if len(rest) == 11 and rest[2] == "9":
            out.add("55" + rest[:2] + rest[3:])
        elif len(rest) == 10:
            out.add("55" + rest[:2] + "9" + rest[2:])
    return sorted(out)


async def _get_redis():
    """Lazy import to keep module import-safe in sync contexts."""
    from redis.asyncio import Redis
    from app.config import settings
    return Redis.from_url(settings.REDIS_URL, decode_responses=True)


async def append_message(phone: str, role: str, content: str, meta: dict | None = None) -> None:
    r = await _get_redis()
    try:
        msg = {"role": role, "content": content, "ts": time.time(), "meta": meta or {}}
        await r.rpush(_conv_key(phone), json.dumps(msg, ensure_ascii=False))
        await r.ltrim(_conv_key(phone), -HISTORY_LIMIT, -1)
        await r.expire(_conv_key(phone), HISTORY_TTL)
    finally:
        await r.aclose()


async def get_history(phone: str, limit: int = HISTORY_LIMIT) -> list[dict]:
    r = await _get_redis()
    try:
        raw = await r.lrange(_conv_key(phone), -limit, -1)
        out = []
        for s in raw:
            try:
                out.append(json.loads(s))
            except Exception:
                continue
        return out
    finally:
        await r.aclose()


async def get_state(phone: str) -> dict[str, Any]:
    r = await _get_redis()
    try:
        s = await r.get(_state_key(phone))
        if not s:
            return {}
        try:
            return json.loads(s)
        except Exception:
            return {}
    finally:
        await r.aclose()


async def update_state(phone: str, patch: dict[str, Any]) -> dict[str, Any]:
    r = await _get_redis()
    try:
        cur_raw = await r.get(_state_key(phone))
        cur = {}
        if cur_raw:
            try:
                cur = json.loads(cur_raw)
            except Exception:
                cur = {}
        cur.update(patch or {})
        cur["_updated_at"] = time.time()
        await r.set(_state_key(phone), json.dumps(cur, ensure_ascii=False), ex=STATE_TTL)
        return cur
    finally:
        await r.aclose()


async def is_paused(phone: str) -> bool:
    variants = _phone_variants(phone)
    if not variants:
        return False
    r = await _get_redis()
    try:
        return bool(await r.exists(*[_pause_key(v) for v in variants]))
    finally:
        await r.aclose()


async def set_paused(phone: str, motivo: str = "") -> None:
    r = await _get_redis()
    try:
        for v in _phone_variants(phone) or [phone]:
            await r.set(_pause_key(v), motivo or "manual", ex=None)
        logger.info("teca_v2_paused phone=%s motivo=%s", phone, motivo)
    finally:
        await r.aclose()


async def clear_paused(phone: str) -> None:
    r = await _get_redis()
    try:
        for v in _phone_variants(phone) or [phone]:
            await r.delete(_pause_key(v))
        logger.info("teca_v2_resumed phone=%s", phone)
    finally:
        await r.aclose()
