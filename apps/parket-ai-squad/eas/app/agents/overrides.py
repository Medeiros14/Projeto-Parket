"""Overrides de instructions com cache em memória.

Lookup é hot-path (chamado a cada `run/arun`), então cacheamos com TTL curto.
Invalidação manual via `invalidate(agent_id)` quando admin salva via API.
"""

from __future__ import annotations

import time
from threading import Lock
from typing import Optional

import structlog

from app.tools._db import execute, fetch_one

log = structlog.get_logger()

_CACHE_TTL_SEC = 30
_CACHE: dict[str, tuple[float, Optional[str]]] = {}
_LOCK = Lock()


def get_override(agent_id: str) -> Optional[str]:
    """Retorna texto do override, ou None se não há."""
    now = time.time()
    with _LOCK:
        cached = _CACHE.get(agent_id)
        if cached and now - cached[0] < _CACHE_TTL_SEC:
            return cached[1]

    row = fetch_one(
        "SELECT instructions FROM eas.agent_overrides WHERE agent_id = %s",
        (agent_id,),
    )
    value = row["instructions"] if row else None
    with _LOCK:
        _CACHE[agent_id] = (now, value)
    return value


def invalidate(agent_id: str) -> None:
    with _LOCK:
        _CACHE.pop(agent_id, None)


def get_override_meta(agent_id: str) -> Optional[dict]:
    """Retorna metadata completa (instructions + note + updated_at + updated_by) ou None."""
    return fetch_one(
        "SELECT agent_id, instructions, note, updated_at, updated_by "
        "FROM eas.agent_overrides WHERE agent_id = %s",
        (agent_id,),
    )


def set_override(agent_id: str, instructions: str, updated_by: str = "will", note: str | None = None) -> dict:
    execute(
        """
        INSERT INTO eas.agent_overrides (agent_id, instructions, note, updated_by, updated_at)
        VALUES (%s, %s, %s, %s, now())
        ON CONFLICT (agent_id) DO UPDATE
        SET instructions = EXCLUDED.instructions,
            note         = EXCLUDED.note,
            updated_by   = EXCLUDED.updated_by,
            updated_at   = now()
        """,
        (agent_id, instructions, note, updated_by),
    )
    invalidate(agent_id)
    log.info("override saved", agent_id=agent_id, chars=len(instructions))
    return {"ok": True, "agent_id": agent_id, "chars": len(instructions)}


def clear_override(agent_id: str) -> dict:
    n = execute("DELETE FROM eas.agent_overrides WHERE agent_id = %s", (agent_id,))
    invalidate(agent_id)
    log.info("override cleared", agent_id=agent_id, rows=n)
    return {"ok": True, "agent_id": agent_id, "rows": n}


# ============================================================
# Model overrides (eas.model_overrides) — mesmo padrão de cache
# ============================================================

_MODEL_CACHE: dict[str, tuple[float, Optional[str]]] = {}


def get_model_override(agent_id: str) -> Optional[str]:
    """Retorna model id do override, ou None se não há."""
    now = time.time()
    with _LOCK:
        cached = _MODEL_CACHE.get(agent_id)
        if cached and now - cached[0] < _CACHE_TTL_SEC:
            return cached[1]

    row = fetch_one(
        "SELECT model FROM eas.model_overrides WHERE agent_id = %s",
        (agent_id,),
    )
    value = row["model"] if row else None
    with _LOCK:
        _MODEL_CACHE[agent_id] = (now, value)
    return value


def invalidate_model(agent_id: str) -> None:
    with _LOCK:
        _MODEL_CACHE.pop(agent_id, None)


def set_model_override(agent_id: str, model: str, updated_by: str = "will") -> dict:
    execute(
        """
        INSERT INTO eas.model_overrides (agent_id, model, updated_by, updated_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (agent_id) DO UPDATE
        SET model      = EXCLUDED.model,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
        """,
        (agent_id, model, updated_by),
    )
    invalidate_model(agent_id)
    log.info("model override saved", agent_id=agent_id, model=model)
    return {"ok": True, "agent_id": agent_id, "model": model}


def clear_model_override(agent_id: str) -> dict:
    n = execute("DELETE FROM eas.model_overrides WHERE agent_id = %s", (agent_id,))
    invalidate_model(agent_id)
    log.info("model override cleared", agent_id=agent_id, rows=n)
    return {"ok": True, "agent_id": agent_id, "rows": n}
