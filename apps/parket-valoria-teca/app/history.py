"""Session history — in-memory por processo.

Guarda últimas N rodadas de (user_message, assistant_response) por session_id.
Um dict simples com TTL de 6h. Se o processo reinicia, sessões somem — Valoria
UI sempre cria session_id novo por conversa nova, então isso é OK.

Se precisar sobreviver a restart, plugar Redis aqui.
"""
from __future__ import annotations

import time
import uuid
from typing import Dict, List, Tuple

from app.settings import NUM_HISTORY_RUNS

TTL_SEC = 6 * 3600
MAX_SESSIONS = 5000

# session_id -> (last_access, [(user_msg, assistant_msg)])
_STORE: Dict[str, Tuple[float, List[Tuple[str, str]]]] = {}


def _gc() -> None:
    now = time.time()
    dead = [sid for sid, (ts, _) in _STORE.items() if now - ts > TTL_SEC]
    for sid in dead:
        _STORE.pop(sid, None)
    if len(_STORE) > MAX_SESSIONS:
        # Descarta os mais velhos
        by_age = sorted(_STORE.items(), key=lambda kv: kv[1][0])
        for sid, _ in by_age[: len(_STORE) - MAX_SESSIONS]:
            _STORE.pop(sid, None)


def new_session_id() -> str:
    return str(uuid.uuid4())


def get_history(session_id: str) -> List[Tuple[str, str]]:
    entry = _STORE.get(session_id)
    if not entry:
        return []
    _STORE[session_id] = (time.time(), entry[1])
    return entry[1][-NUM_HISTORY_RUNS:]


def append_turn(session_id: str, user_msg: str, assistant_msg: str) -> None:
    entry = _STORE.get(session_id)
    lst = entry[1] if entry else []
    lst.append((user_msg, assistant_msg))
    # Trim: mantém sempre no máx 2x o número de runs pra permitir sliding window.
    if len(lst) > NUM_HISTORY_RUNS * 2:
        lst = lst[-NUM_HISTORY_RUNS * 2 :]
    _STORE[session_id] = (time.time(), lst)
    _gc()
