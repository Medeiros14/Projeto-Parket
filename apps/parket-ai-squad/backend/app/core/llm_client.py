"""
LLM Client — Official SDKs + OpenCode OAuth
=============================================
- API key accounts: use official SDKs directly (Anthropic, OpenAI, Google)
- OAuth accounts: route through OpenCode, which manages token refresh automatically
"""

import asyncio
import structlog

logger = structlog.get_logger(__name__)


# ──────────────────────────────────────────────
# OpenCode proxy client (for OAuth accounts)
# ──────────────────────────────────────────────

class OpenCodeProxyClient:
    """Routes LLM calls through OpenCode, which handles OAuth token refresh."""

    PROVIDER_MODELS = {
        "claude":  "anthropic/claude-sonnet-4-5",
        "openai":  "openai/gpt-4o",
        "gemini":  "google/gemini-2.5-flash",
        "copilot": "github-copilot/gpt-4o",
    }

    def __init__(self, provider: str):
        self.provider = provider
        self.model = self.PROVIDER_MODELS.get(provider, f"{provider}/default")

    async def chat(self, messages: list[dict], system_prompt: str = "") -> str:
        from app.core.opencode_client import get_opencode_client
        oc = get_opencode_client()
        return await oc.chat(messages, system_prompt=system_prompt, model=self.model)

    async def test_connection(self) -> dict:
        from app.core.opencode_client import get_opencode_client, PROVIDER_MAP
        oc = get_opencode_client()
        oc_id = PROVIDER_MAP.get(self.provider, self.provider)

        # 1) Check stored credentials (reads local file — no network needed)
        connected = oc.is_provider_connected(oc_id)
        if not connected:
            return {
                "ok": False,
                "error": "Credenciais OAuth não encontradas — reconecte a conta",
                "provider": self.provider,
            }

        # 2) Verify OpenCode is reachable (same Docker internal network)
        health = await oc.health()  # always returns dict, never raises
        if "error" in health:
            return {
                "ok": False,
                "error": f"OpenCode indisponível: {health['error']}",
                "provider": self.provider,
            }

        return {"ok": True, "provider": self.provider, "model": self.model, "via": "opencode"}


# ──────────────────────────────────────────────
# Claude — Anthropic
# ──────────────────────────────────────────────

class ClaudeClient:
    DEFAULT_MODEL = "claude-sonnet-4-5-20250929"

    # Claude Code billing header — required for OAuth tokens to access Claude 4+ models
    _CC_BILLING = "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"
    _OAUTH_BETAS = "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def _is_oauth_token(self) -> bool:
        return self.api_key.startswith("sk-ant-oat")

    def _make_client(self):
        import anthropic
        if self._is_oauth_token():
            return anthropic.AsyncAnthropic(
                auth_token=self.api_key,
                api_key=None,
                default_headers={
                    "anthropic-beta": self._OAUTH_BETAS,
                    "x-app": "cli",
                    "User-Agent": "claude-cli/2.1.81 (external, cli)",
                    "anthropic-dangerous-direct-browser-access": "true",
                },
            )
        return anthropic.AsyncAnthropic(api_key=self.api_key)

    async def chat(self, messages: list[dict], system_prompt: str = "") -> str:
        client = self._make_client()
        filtered = [m for m in messages if m.get("role") in ("user", "assistant")]

        if self._is_oauth_token():
            # OAuth tokens require billing header in system and beta.messages endpoint
            system_parts = [{"type": "text", "text": self._CC_BILLING}]
            if system_prompt:
                system_parts.append({"type": "text", "text": system_prompt})
            response = await client.beta.messages.create(
                model=self.DEFAULT_MODEL,
                max_tokens=16384,
                messages=filtered,
                system=system_parts,
                betas=self._OAUTH_BETAS.split(","),
            )
        else:
            kwargs: dict = dict(
                model=self.DEFAULT_MODEL,
                max_tokens=8192,
                messages=filtered,
            )
            if system_prompt:
                kwargs["system"] = system_prompt
            response = await client.messages.create(**kwargs)

        # Handle thinking + text content blocks
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        return ""

    async def test_connection(self) -> dict:
        try:
            await self.chat([{"role": "user", "content": "ok"}])
            return {"ok": True, "provider": "claude", "model": self.DEFAULT_MODEL}
        except Exception as e:
            return {"ok": False, "error": str(e), "provider": "claude"}


# ──────────────────────────────────────────────
# ChatGPT — OpenAI
# ──────────────────────────────────────────────

class OpenAIClient:
    DEFAULT_MODEL = "gpt-4o"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def chat(self, messages: list[dict], system_prompt: str = "") -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=self.api_key)
        msgs: list[dict] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.extend([m for m in messages if m.get("role") in ("user", "assistant")])
        response = await client.chat.completions.create(
            model=self.DEFAULT_MODEL,
            messages=msgs,
            max_tokens=8192,
        )
        return response.choices[0].message.content or ""

    async def test_connection(self) -> dict:
        try:
            await self.chat([{"role": "user", "content": "ok"}])
            return {"ok": True, "provider": "openai", "model": self.DEFAULT_MODEL}
        except Exception as e:
            error_str = str(e)
            if any(x in error_str for x in ("Name or service not known", "Errno -2", "gaierror", "ConnectError", "Connection refused")):
                try:
                    from app.core.opencode_client import get_opencode_client
                    oc = get_opencode_client()
                    await oc.set_api_key("openai", self.api_key)
                    result = await OpenCodeProxyClient(provider="openai").chat([{"role": "user", "content": "ok"}])
                    return {"ok": True, "provider": "openai", "model": self.DEFAULT_MODEL, "via": "opencode"}
                except Exception as e2:
                    return {"ok": False, "error": str(e2), "provider": "openai"}
            return {"ok": False, "error": error_str, "provider": "openai"}


# ──────────────────────────────────────────────
# Gemini — Google
# ──────────────────────────────────────────────

class GeminiClient:
    DEFAULT_MODEL = "gemini-2.5-flash"
    AVAILABLE_MODELS = {
        # Gemini 2.5
        "gemini-2.5-pro":        {"label": "Gemini 2.5 Pro",        "context": 1_000_000},
        "gemini-2.5-flash":      {"label": "Gemini 2.5 Flash",      "context": 1_000_000},
        "gemini-2.5-flash-lite": {"label": "Gemini 2.5 Flash Lite", "context": 1_000_000},
        # Gemini 2.0
        "gemini-2.0-flash":      {"label": "Gemini 2.0 Flash",      "context": 1_000_000},
        # Gemini 1.5
        "gemini-1.5-pro":        {"label": "Gemini 1.5 Pro",        "context": 2_000_000},
        "gemini-1.5-flash":      {"label": "Gemini 1.5 Flash",      "context": 1_000_000},
    }

    def __init__(self, api_key: str, model: str | None = None):
        self.api_key = api_key
        self.model = model or self.DEFAULT_MODEL

    async def chat(self, messages: list[dict], system_prompt: str = "") -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.api_key)

        contents = []
        for m in messages:
            role = "user" if m.get("role") == "user" else "model"
            contents.append(types.Content(role=role, parts=[types.Part(text=str(m.get("content", "")))]))

        config = types.GenerateContentConfig(max_output_tokens=8192)
        if system_prompt:
            config.system_instruction = system_prompt

        # Try primary model, fallback to flash on 503
        models_to_try = [self.model]
        if self.model == "gemini-2.5-pro":
            models_to_try.append("gemini-2.5-flash")

        last_error = None
        for model in models_to_try:
            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda m=model: client.models.generate_content(
                        model=m,
                        contents=contents,
                        config=config,
                    ),
                )
                return response.text
            except Exception as e:
                last_error = e
                if "503" in str(e) or "UNAVAILABLE" in str(e):
                    continue
                raise
        raise last_error

    async def test_connection(self) -> dict:
        try:
            await self.chat([{"role": "user", "content": "ok"}])
            return {"ok": True, "provider": "gemini", "model": self.model}
        except Exception as e:
            return {"ok": False, "error": str(e), "provider": "gemini"}


# ──────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────

def build_client(provider: str, api_key: str, extra: dict | None = None):
    """
    Return the appropriate LLM client.
    OAuth accounts are routed through OpenCode (handles token refresh).
    API key accounts use the official SDKs directly.
    """
    auth_type = (extra or {}).get("auth_type", "api_key")
    if auth_type == "oauth":
        # Claude OAuth tokens are used directly via ClaudeClient (OpenCode fork doesn't support Anthropic OAuth)
        if provider == "claude":
            return ClaudeClient(api_key=api_key)
        return OpenCodeProxyClient(provider=provider)

    if provider == "claude":
        return ClaudeClient(api_key=api_key)
    elif provider == "openai":
        return OpenAIClient(api_key=api_key)
    elif provider == "gemini":
        model = (extra or {}).get("model")
        return GeminiClient(api_key=api_key, model=model)
    raise ValueError(f"Unknown provider: {provider}")
