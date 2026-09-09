"""OAuth Anthropic — reusa a mesma conta 'claude' que o EAS usa.

Copia da lógica de /root/parket-ai-squad/eas/app/auth/anthropic_oauth.py mas sem
depender do resto do app EAS. Lê ai_accounts do parket-ai-squad_postgres.
"""
from __future__ import annotations

import json
import time
from datetime import datetime
from typing import Optional

import httpx
import psycopg
import structlog

from app.settings import DATABASE_URL

log = structlog.get_logger()

OAUTH_TOKEN_URL = "https://platform.claude.com/v1/oauth/token"
CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
REFRESH_BUFFER_SEC = 300
CACHE_TTL_SEC = 60

_CACHE: dict = {"token": None, "expires_at": 0.0}


def _fetch_active_account() -> Optional[dict]:
    with psycopg.connect(DATABASE_URL, connect_timeout=5) as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT id::text, session_token, extra, updated_at
            FROM public.ai_accounts
            WHERE provider = 'claude'
              AND is_active = TRUE
              AND is_healthy = TRUE
              AND extra->>'auth_type' = 'oauth'
            ORDER BY last_used DESC NULLS LAST, updated_at DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row[0],
            "session_token": row[1],
            "extra": row[2],
            "updated_at": row[3],
        }


def _extra(extra) -> dict:
    if extra is None:
        return {}
    if isinstance(extra, dict):
        return extra
    try:
        return json.loads(extra)
    except Exception:
        return {}


def _estimate_expiry(extra: dict, updated_at) -> float:
    expires_in = int(extra.get("expires_in") or 86400 * 7)
    if isinstance(updated_at, datetime):
        return updated_at.timestamp() + expires_in
    return time.time() + expires_in


def _refresh(account_id: str, refresh_token: str) -> Optional[dict]:
    try:
        with httpx.Client(timeout=15) as client:
            r = client.post(
                OAUTH_TOKEN_URL,
                json={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": CLIENT_ID,
                },
                headers={"Content-Type": "application/json", "User-Agent": "claude-cli/2.1.81"},
            )
        if r.status_code >= 400:
            log.error("oauth_refresh_failed", status=r.status_code, body=r.text[:200])
            return None
        data = r.json()
    except Exception as exc:
        log.error("oauth_refresh_exception", error=str(exc))
        return None

    new_token = data.get("access_token")
    new_refresh = data.get("refresh_token", refresh_token)
    expires_in = data.get("expires_in", 28800)
    if not new_token:
        return None

    try:
        with psycopg.connect(DATABASE_URL, connect_timeout=5) as c, c.cursor() as cur:
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
                    updated_at = now(),
                    last_used = now(),
                    consecutive_errors = 0,
                    is_healthy = TRUE
                WHERE id = %s::uuid
                """,
                (new_token, new_refresh, expires_in, account_id),
            )
    except Exception as exc:
        log.warning("oauth_persist_failed", error=str(exc))

    return {"token": new_token, "expires_in": expires_in}


def get_token() -> Optional[str]:
    """Retorna access_token OAuth válido. Refresha quando falta <5min."""
    now = time.time()
    if _CACHE["token"] and _CACHE["expires_at"] - now > REFRESH_BUFFER_SEC:
        return _CACHE["token"]

    acc = _fetch_active_account()
    if not acc:
        log.warning("oauth_no_account")
        return None

    extra = _extra(acc["extra"])
    refresh_token = extra.get("refresh_token")
    expires_at = _estimate_expiry(extra, acc.get("updated_at"))

    if expires_at - now > REFRESH_BUFFER_SEC:
        _CACHE.update(token=acc["session_token"], expires_at=min(expires_at, now + CACHE_TTL_SEC))
        return acc["session_token"]

    if not refresh_token:
        return acc["session_token"]

    new = _refresh(acc["id"], refresh_token)
    if not new:
        return acc["session_token"]
    _CACHE.update(token=new["token"], expires_at=time.time() + min(new["expires_in"], CACHE_TTL_SEC))
    return new["token"]


def force_refresh() -> Optional[str]:
    """Refresh incondicional — usado após 401 da API.

    O estimador updated_at+expires_in mente quando outro consumidor (EAS)
    toca a linha em ai_accounts sem renovar o token; aqui ignoramos a
    estimativa e refreshamos direto com o refresh_token persistido."""
    _CACHE.update(token=None, expires_at=0.0)
    acc = _fetch_active_account()
    if not acc:
        log.warning("oauth_no_account")
        return None
    extra = _extra(acc["extra"])
    refresh_token = extra.get("refresh_token")
    if not refresh_token:
        log.warning("oauth_force_refresh_no_refresh_token")
        return None
    new = _refresh(acc["id"], refresh_token)
    if not new:
        return None
    _CACHE.update(token=new["token"], expires_at=time.time() + min(new["expires_in"], CACHE_TTL_SEC))
    return new["token"]


def status() -> dict:
    acc = _fetch_active_account()
    if not acc:
        return {"ok": False, "error": "no active claude oauth account"}
    extra = _extra(acc["extra"])
    expires_at = _estimate_expiry(extra, acc.get("updated_at"))
    return {
        "ok": True,
        "account_id": acc["id"],
        "token_preview": (acc["session_token"] or "")[:30],
        "expires_at_iso": datetime.fromtimestamp(expires_at).isoformat(),
        "expires_in_sec": int(expires_at - time.time()),
        "has_refresh_token": bool(extra.get("refresh_token")),
    }
