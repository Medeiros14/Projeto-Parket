"""Token OAuth do Teca Copiloto — lê public.ai_accounts do parket-ai-squad.

O EAS (os.parket.works) refresca as contas a cada request, então aqui somos
read-mostly: usamos o session_token corrente e só refrescamos se estiver a
<5min de expirar — com SELECT ... FOR UPDATE pra não competir com o EAS
(refresh_token da Anthropic é single-use; corrida = chain queimada).
Fallback fica no chamador (env ANTHROPIC_OAUTH_TOKEN via secret).
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime

import httpx
import psycopg
from psycopg.rows import dict_row

log = logging.getLogger("gestao.claude_token")

OAUTH_TOKEN_URL = "https://platform.claude.com/v1/oauth/token"
CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
REFRESH_BUFFER_SEC = 300
CACHE_TTL_SEC = 60
_CACHE: dict = {"token": None, "expires_at": 0.0}

_SELECT = """
    SELECT id::text AS id, session_token, extra, updated_at
    FROM public.ai_accounts
    WHERE provider = 'claude'
      AND is_active = TRUE
      AND is_healthy = TRUE
      AND extra->>'auth_type' = 'oauth'
    ORDER BY last_used DESC NULLS LAST, updated_at DESC
    LIMIT 1
"""


def _dsn() -> str | None:
    return os.environ.get("AI_ACCOUNTS_DSN") or None


def _extra_json(extra) -> dict:
    if isinstance(extra, dict):
        return extra
    try:
        return json.loads(extra or "{}")
    except Exception:
        return {}


def _expiry(extra: dict, updated_at) -> float:
    expires_in = int(extra.get("expires_in") or 86400 * 7)
    base = updated_at.timestamp() if isinstance(updated_at, datetime) else time.time()
    return base + expires_in


def _refresh_locked(dsn: str, account_id: str) -> str | None:
    """Refresca segurando FOR UPDATE na linha; se outro processo (EAS)
    refrescou enquanto esperávamos o lock, usa o token novo dele."""
    with psycopg.connect(dsn, connect_timeout=5) as c, c.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT session_token, extra, updated_at FROM public.ai_accounts WHERE id = %s::uuid FOR UPDATE",
            (account_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        extra = _extra_json(row["extra"])
        if _expiry(extra, row["updated_at"]) - time.time() > REFRESH_BUFFER_SEC:
            return row["session_token"]

        refresh_token = extra.get("refresh_token")
        if not refresh_token:
            return row["session_token"]
        with httpx.Client(timeout=15) as h:
            r = h.post(
                OAUTH_TOKEN_URL,
                json={"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": CLIENT_ID},
                headers={"Content-Type": "application/json", "User-Agent": "claude-cli/2.1.81"},
            )
        if r.status_code >= 400:
            log.warning("oauth refresh falhou status=%s body=%s", r.status_code, r.text[:300])
            return row["session_token"]
        data = r.json()
        new_token = data.get("access_token")
        if not new_token:
            return row["session_token"]
        cur.execute(
            """
            UPDATE public.ai_accounts
            SET session_token = %s,
                extra = jsonb_build_object(
                    'auth_type','oauth',
                    'opencode_id','anthropic',
                    'refresh_token', %s::text,
                    'expires_in', %s::int
                )::json,
                updated_at = now(), last_used = now(),
                consecutive_errors = 0, is_healthy = TRUE
            WHERE id = %s::uuid
            """,
            (new_token, data.get("refresh_token", refresh_token), data.get("expires_in", 28800), account_id),
        )
        c.commit()
        log.info("oauth token refrescado pelo gestao (account=%s)", account_id)
        return new_token


def get_oauth_token() -> str | None:
    """Access token OAuth válido do ai_accounts, ou None (chamador usa fallback)."""
    dsn = _dsn()
    if not dsn:
        return None
    now = time.time()
    if _CACHE["token"] and _CACHE["expires_at"] > now:
        return _CACHE["token"]
    try:
        with psycopg.connect(dsn, connect_timeout=3, autocommit=True) as c, \
                c.cursor(row_factory=dict_row) as cur:
            cur.execute(_SELECT)
            account = cur.fetchone()
        if not account:
            log.warning("nenhuma conta claude oauth healthy em ai_accounts")
            return None
        extra = _extra_json(account["extra"])
        if _expiry(extra, account.get("updated_at")) - now > REFRESH_BUFFER_SEC:
            token = account["session_token"]
        else:
            token = _refresh_locked(dsn, account["id"]) or account["session_token"]
        _CACHE.update(token=token, expires_at=now + CACHE_TTL_SEC)
        return token
    except Exception as e:
        log.warning("ai_accounts indisponível: %s", e)
        return None
