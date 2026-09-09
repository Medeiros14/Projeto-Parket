"""ClaudeOAuth — ÚNICA peça custom do AgentOS Parket.

Consumo da API Anthropic via OAuth da assinatura Claude (Pro/Max), reutilizando
as contas de `public.ai_accounts` (mesma estratégia da Teca V2). O Agno vanilla
só suporta API key; tokens OAuth (sk-ant-oat01-...) exigem:

  - endpoint beta.messages.create com betas ["claude-code-20250219",
    "oauth-2025-04-20", "interleaved-thinking-2025-05-14"]
  - primeiro bloco do system = billing header do Claude Code
  - headers x-app/User-Agent/dangerous-direct-browser-access

Sem isso a Anthropic devolve 429 "rate_limit_error" fake (unauthorized disfarçado).

Inclui também o cache incremental de mensagens: o Agno cacheia só system+tools;
em tool loops longos o histórico era re-enviado sem cache a cada iteração
(runs de 6M+ input tokens). Um breakpoint ephemeral na última mensagem faz a
Anthropic reaproveitar o prefixo da iteração anterior (~85% de economia).
"""

from __future__ import annotations

import json
import logging
import os
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional, Type, Union

import httpx
import psycopg
from psycopg.rows import dict_row

import agno.models.anthropic.claude as _agno_claude_mod
from agno.models.anthropic import Claude
from pydantic import BaseModel

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Token OAuth (public.ai_accounts)
# ---------------------------------------------------------------------------

OAUTH_TOKEN_URL = "https://platform.claude.com/v1/oauth/token"
CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
REFRESH_BUFFER_SEC = 300
CACHE_TTL_SEC = 60
_CACHE: dict = {"token": None, "expires_at": 0.0, "account_id": None}


def _pg_url() -> str:
    url = os.environ["DATABASE_URL"]
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


@contextmanager
def _conn():
    with psycopg.connect(_pg_url(), autocommit=True) as c:
        yield c


def _select_active_account() -> Optional[dict]:
    with _conn() as c, c.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id::text AS id, session_token, extra, updated_at
            FROM public.ai_accounts
            WHERE provider = 'claude'
              AND is_active = TRUE
              AND is_healthy = TRUE
              AND extra->>'auth_type' = 'oauth'
            ORDER BY last_used DESC NULLS LAST, updated_at DESC
            LIMIT 1
            """
        )
        return cur.fetchone()


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
            log.error("oauth refresh failed status=%s body=%s", r.status_code, r.text[:300])
            return None
        data = r.json()
    except Exception as exc:  # noqa: BLE001
        log.error("oauth refresh exception: %s", exc)
        return None

    new_token = data.get("access_token")
    new_refresh = data.get("refresh_token", refresh_token)
    expires_in = data.get("expires_in", 28800)
    if not new_token:
        return None

    try:
        with _conn() as c, c.cursor() as cur:
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
        log.warning("failed to persist refreshed token: %s", exc)

    return {"token": new_token, "expires_in": expires_in}


def get_oauth_token() -> Optional[str]:
    """Access token OAuth válido, com refresh automático e cache de 60s."""
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
        log.warning("token expired and no refresh_token (account=%s)", account["id"])
        return account["session_token"]

    new = _refresh(account["id"], refresh_token)
    if not new:
        return account["session_token"]
    _CACHE.update(
        token=new["token"],
        expires_at=time.time() + min(new["expires_in"], CACHE_TTL_SEC),
        account_id=account["id"],
    )
    return new["token"]


# ---------------------------------------------------------------------------
# Cache incremental de mensagens (patch em format_messages)
# ---------------------------------------------------------------------------

_CACHEABLE_BLOCK_TYPES = {"text", "tool_result", "tool_use", "image", "document"}


def _mark_last_message_cache(chat_messages: list) -> None:
    for msg in chat_messages:
        content = msg.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    block.pop("cache_control", None)
    for msg in reversed(chat_messages):
        content = msg.get("content")
        if isinstance(content, str):
            if not content:
                continue
            msg["content"] = [
                {"type": "text", "text": content, "cache_control": {"type": "ephemeral"}}
            ]
            return
        if isinstance(content, list):
            for block in reversed(content):
                if isinstance(block, dict) and block.get("type") in _CACHEABLE_BLOCK_TYPES:
                    block["cache_control"] = {"type": "ephemeral"}
                    return


_orig_format_messages = _agno_claude_mod.format_messages


def _format_messages_with_cache(messages, **kwargs):
    chat_messages, system_message = _orig_format_messages(messages, **kwargs)
    _mark_last_message_cache(chat_messages)
    return chat_messages, system_message


if not getattr(_agno_claude_mod.format_messages, "__wrapped_parket__", False):
    _format_messages_with_cache.__wrapped_parket__ = True  # type: ignore[attr-defined]
    _agno_claude_mod.format_messages = _format_messages_with_cache


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

OAUTH_BETAS = [
    "claude-code-20250219",
    "oauth-2025-04-20",
    "interleaved-thinking-2025-05-14",
]
CC_BILLING = "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"
CC_HEADERS = {
    "x-app": "cli",
    "User-Agent": "claude-cli/2.1.81 (external, cli)",
    "anthropic-dangerous-direct-browser-access": "true",
}


class ClaudeOAuth(Claude):
    """Claude do Agno autenticado via OAuth da assinatura (beta endpoint)."""

    def __init__(self, **kwargs):
        kwargs.setdefault("auth_token", get_oauth_token())
        kwargs.setdefault("default_headers", CC_HEADERS)
        kwargs.setdefault("cache_system_prompt", True)
        kwargs.setdefault("cache_tools", True)
        super().__init__(**kwargs)

    def _has_beta_features(self, **kwargs) -> bool:  # type: ignore[override]
        return True

    def _refresh_auth(self) -> None:
        # Token OAuth expira em ~8h; renovar por request evita 401 crônico.
        if not (self.auth_token or "").startswith("sk-ant-oat"):
            fresh_any = get_oauth_token()
            if fresh_any:
                self.auth_token = fresh_any
                self.client = None
                self.async_client = None
            return
        fresh = get_oauth_token()
        if fresh and fresh != self.auth_token:
            self.auth_token = fresh
            self.client = None
            self.async_client = None

    def get_client(self):  # type: ignore[override]
        self._refresh_auth()
        return super().get_client()

    def get_async_client(self):  # type: ignore[override]
        self._refresh_auth()
        return super().get_async_client()

    def _prepare_request_kwargs(
        self,
        system_message: Optional[str],
        tools: Optional[List[Dict[str, Any]]] = None,
        response_format: Optional[Union[Dict, Type[BaseModel]]] = None,
        messages: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        kwargs = super()._prepare_request_kwargs(
            system_message=system_message,
            tools=tools,
            response_format=response_format,
            messages=messages,
        )
        existing_betas = kwargs.get("betas") or []
        merged_betas: list[str] = []
        for b in OAUTH_BETAS + list(existing_betas):
            if b not in merged_betas:
                merged_betas.append(b)
        kwargs["betas"] = merged_betas

        orig_system = kwargs.get("system")
        system_parts: list[dict] = [{"type": "text", "text": CC_BILLING}]
        if isinstance(orig_system, str) and orig_system:
            system_parts.append({"type": "text", "text": orig_system})
        elif isinstance(orig_system, list):
            for item in orig_system:
                if isinstance(item, dict):
                    system_parts.append(item)
                elif isinstance(item, str) and item:
                    system_parts.append({"type": "text", "text": item})
        kwargs["system"] = system_parts
        return kwargs
