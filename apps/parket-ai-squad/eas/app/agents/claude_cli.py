"""ClaudeCLI — subclasse do Agno Claude que usa o endpoint Claude Code.

OAuth tokens (sk-ant-oat01-...) só funcionam via beta.messages.create do
endpoint Claude Code, com:
  - betas=["claude-code-20250219","oauth-2025-04-20","interleaved-thinking-2025-05-14"]
  - system message como array, com primeiro item sendo billing header
  - headers especiais (x-app, User-Agent, dangerous-direct-browser-access)

Sem isso, Anthropic retorna 429 'rate_limit_error' fake (na verdade é unauthorized
do scope OAuth — eles disfarçam de rate limit).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Type, Union

import agno.models.anthropic.claude as _agno_claude_mod
from agno.models.anthropic import Claude
from pydantic import BaseModel

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

# Blocos que aceitam cache_control (thinking/redacted_thinking não aceitam)
_CACHEABLE_BLOCK_TYPES = {"text", "tool_result", "tool_use", "image", "document"}


def _mark_last_message_cache(chat_messages: list) -> None:
    """Marca cache_control ephemeral no último bloco elegível da conversa.

    O Agno só cacheia system prompt + tools. Em tool loops longos (100+
    iterações) o histórico de mensagens cresce e é re-enviado inteiro sem
    cache a cada iteração — custo quadrático (runs de 6M+ input tokens).
    Um breakpoint na última mensagem faz a Anthropic reaproveitar o prefixo
    da iteração anterior (lookback automático de ~20 blocos).
    """
    # Remove marcas anteriores — se o Agno reusar referências de blocos entre
    # iterações, breakpoints acumulariam e estourariam o limite de 4 da API.
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


# Patch no namespace do módulo claude do Agno — é o nome que invoke/ainvoke/
# invoke_stream/ainvoke_stream resolvem. Idempotente (guard no __wrapped_eas__).
if not getattr(_agno_claude_mod.format_messages, "__wrapped_eas__", False):
    _format_messages_with_cache.__wrapped_eas__ = True  # type: ignore[attr-defined]
    _agno_claude_mod.format_messages = _format_messages_with_cache


class ClaudeCLI(Claude):
    """Force beta.messages.create + billing system part + betas list."""

    def _has_beta_features(self, **kwargs) -> bool:  # type: ignore[override]
        return True

    def _refresh_auth(self) -> None:
        # Token OAuth expira em ~8h; sem isso o processo inteiro vira 401
        # até restart. get_anthropic_oauth_token tem cache de 60s (barato).
        if not (self.auth_token or "").startswith("sk-ant-oat"):
            return
        try:
            from app.auth.anthropic_oauth import get_anthropic_oauth_token

            fresh = get_anthropic_oauth_token()
        except Exception:
            return
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
        # Garante presença dos 3 betas
        existing_betas = kwargs.get("betas") or []
        merged_betas: list[str] = []
        for b in OAUTH_BETAS + list(existing_betas):
            if b not in merged_betas:
                merged_betas.append(b)
        kwargs["betas"] = merged_betas

        # Reescreve system pra prefixar billing header como primeiro bloco
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
