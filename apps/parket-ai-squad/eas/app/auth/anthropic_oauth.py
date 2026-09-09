"""Auth Anthropic via OAuth — reusa contas do parket-ai-squad (tabela ai_accounts).

Mesma estratégia da Teca V2: lê o `session_token` da conta `claude` ativa+healthy
em `public.ai_accounts`. Quando o token estiver pra expirar, usa o `refresh_token`
no `extra` JSON pra renovar via endpoint OAuth do claude.com.

Sem chamadas Anthropic Console API key — tudo OAuth (Claude Pro/Max).
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timedelta
from typing import Optional

import httpx
import structlog

from app.tools._db import conn, fetch_one

log = structlog.get_logger()

OAUTH_TOKEN_URL = "https://platform.claude.com/v1/oauth/token"  # certo — testado e funciona
CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

# Refresh quando token vai expirar em menos de 5min
REFRESH_BUFFER_SEC = 300

# Cache em memória — TTL curto pra sincronizar workers uvicorn.
# Se worker A refresha o token OAuth, worker B precisa perceber rápido (o access_token
# antigo é invalidado pelo Anthropic imediatamente e vira 401). O token real tem 8h,
# mas revalidar o DB a cada 60s custa ~1ms e evita 401 crônico multi-worker.
CACHE_TTL_SEC = 60
_CACHE: dict = {"token": None, "expires_at": 0.0, "account_id": None}


def _select_active_account() -> Optional[dict]:
    """Pega a conta `claude` ativa+saudável mais recentemente usada."""
    return fetch_one(
        """
        SELECT id::text AS id, session_token, extra, updated_at
        FROM public.ai_accounts
        WHERE provider = 'claude'
          AND is_active = TRUE
          AND is_healthy = TRUE
          AND extra->>'auth_type' = 'oauth'
        ORDER BY last_used DESC NULLS LAST, updated_at DESC
        LIMIT 1
        """,
    )


def _extra_json(extra) -> dict:
    if extra is None:
        return {}
    if isinstance(extra, dict):
        return extra
    try:
        return json.loads(extra)
    except Exception:
        return {}


def _estimate_expiry(extra: dict, updated_at) -> float:
    """expires_at = updated_at + expires_in. Se faltar, assume 7 dias."""
    expires_in = int(extra.get("expires_in") or 86400 * 7)
    if isinstance(updated_at, datetime):
        return updated_at.timestamp() + expires_in
    return time.time() + expires_in


def _refresh(account_id: str, refresh_token: str) -> Optional[dict]:
    """Troca refresh_token por novo access_token. Atualiza row em ai_accounts."""
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
            log.error("oauth refresh failed", status=r.status_code, body=r.text[:300])
            return None
        data = r.json()
    except Exception as exc:  # noqa: BLE001
        log.error("oauth refresh exception", error=str(exc))
        return None

    new_token = data.get("access_token")
    new_refresh = data.get("refresh_token", refresh_token)
    expires_in = data.get("expires_in", 28800)
    if not new_token:
        return None

    # Persiste no DB
    try:
        with conn() as c, c.cursor() as cur:
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
    except Exception as exc:  # noqa: BLE001
        log.warning("failed to persist refreshed token", error=str(exc))

    return {"token": new_token, "expires_in": expires_in}


def get_anthropic_oauth_token() -> Optional[str]:
    """Retorna access_token Anthropic OAuth válido. Faz refresh quando necessário.

    Em caso de falha, retorna None. Caller deve fallback (ou logar e abortar).
    """
    now = time.time()
    if _CACHE["token"] and _CACHE["expires_at"] - now > REFRESH_BUFFER_SEC:
        return _CACHE["token"]

    account = _select_active_account()
    if not account:
        log.warning("no active claude oauth account in ai_accounts")
        return None

    extra = _extra_json(account["extra"])
    refresh_token = extra.get("refresh_token")
    expires_at = _estimate_expiry(extra, account.get("updated_at"))

    if expires_at - now > REFRESH_BUFFER_SEC:
        _CACHE.update(
            token=account["session_token"],
            expires_at=min(expires_at, now + CACHE_TTL_SEC),
            account_id=account["id"],
        )
        return account["session_token"]

    if not refresh_token:
        log.warning("token expired and no refresh_token available", account_id=account["id"])
        return account["session_token"]  # tenta usar mesmo assim

    new = _refresh(account["id"], refresh_token)
    if not new:
        return account["session_token"]
    _CACHE.update(
        token=new["token"],
        expires_at=time.time() + min(new["expires_in"], CACHE_TTL_SEC),
        account_id=account["id"],
    )
    return new["token"]


def status() -> dict:
    """Status pra endpoint debug."""
    account = _select_active_account()
    if not account:
        return {"ok": False, "error": "no active claude oauth account"}
    extra = _extra_json(account["extra"])
    expires_at = _estimate_expiry(extra, account.get("updated_at"))
    return {
        "ok": True,
        "account_id": account["id"],
        "token_preview": (account["session_token"] or "")[:30],
        "expires_at_iso": datetime.fromtimestamp(expires_at).isoformat(),
        "expires_in_sec": int(expires_at - time.time()),
        "has_refresh_token": bool(extra.get("refresh_token")),
    }
