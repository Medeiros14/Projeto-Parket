"""Claude client — reaproveita padrão OAuth do parket-ai-squad.
Suporta:
  - sk-ant-oat…  (OAuth Claude Code, header beta + billing)
  - sk-ant-api…  (API key normal)

Auto-refresh do OAuth via public.teca_oauth_tokens (ver app/oauth.py).
"""
from typing import AsyncIterator
import anthropic
from .settings import settings
from . import oauth


_CC_BILLING = "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"
_OAUTH_BETAS = "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14"


async def _pick_key() -> tuple[str, bool]:
    """Resolve token pra este request.

    Prioridade:
      1. oauth.get_token() — DB com refresh automático (recomendado)
      2. settings.anthropic_api_key — env estático (fallback dev/emergency)
    """
    try:
        token = await oauth.get_token()
        return token, True
    except Exception:
        if settings.anthropic_api_key:
            return settings.anthropic_api_key, settings.anthropic_api_key.startswith("sk-ant-oat")
        raise


def _client(is_oauth: bool, key: str) -> anthropic.AsyncAnthropic:
    if is_oauth:
        return anthropic.AsyncAnthropic(
            auth_token=key,
            api_key=None,
            default_headers={
                "anthropic-beta": _OAUTH_BETAS,
                "x-app": "cli",
                "User-Agent": "claude-cli/2.1.81 (external, cli)",
                "anthropic-dangerous-direct-browser-access": "true",
            },
        )
    return anthropic.AsyncAnthropic(api_key=key)


async def chat(messages: list[dict], system_prompt: str = "", max_tokens: int = 4096) -> str:
    key, is_oauth = await _pick_key()
    client = _client(is_oauth, key)
    filtered = [m for m in messages if m.get("role") in ("user", "assistant")]

    if is_oauth:
        system_parts = [{"type": "text", "text": _CC_BILLING}]
        if system_prompt:
            system_parts.append({"type": "text", "text": system_prompt})
        resp = await client.beta.messages.create(
            model=settings.claude_model,
            max_tokens=max_tokens,
            messages=filtered,
            system=system_parts,
            betas=_OAUTH_BETAS.split(","),
        )
    else:
        kwargs = dict(model=settings.claude_model, max_tokens=max_tokens, messages=filtered)
        if system_prompt:
            kwargs["system"] = system_prompt
        resp = await client.messages.create(**kwargs)

    for block in resp.content:
        if hasattr(block, "text"):
            return block.text
    return ""


async def stream(messages: list[dict], system_prompt: str = "", max_tokens: int = 4096) -> AsyncIterator[str]:
    """Streaming via SDK — usa create(stream=True) e itera eventos de content_block_delta.
    Funciona igual em beta.messages (OAuth) e messages (API key)."""
    key, is_oauth = await _pick_key()
    client = _client(is_oauth, key)
    filtered = [m for m in messages if m.get("role") in ("user", "assistant")]

    if is_oauth:
        system_parts = [{"type": "text", "text": _CC_BILLING}]
        if system_prompt:
            system_parts.append({"type": "text", "text": system_prompt})
        events = await client.beta.messages.create(
            model=settings.claude_model,
            max_tokens=max_tokens,
            messages=filtered,
            system=system_parts,
            betas=_OAUTH_BETAS.split(","),
            stream=True,
        )
    else:
        kwargs = dict(model=settings.claude_model, max_tokens=max_tokens, messages=filtered, stream=True)
        if system_prompt:
            kwargs["system"] = system_prompt
        events = await client.messages.create(**kwargs)

    async for ev in events:
        et = getattr(ev, "type", "")
        if et == "content_block_delta":
            delta = getattr(ev, "delta", None)
            if delta and getattr(delta, "type", "") == "text_delta":
                yield delta.text
