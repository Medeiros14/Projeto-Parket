"""
OpenCode Client
================
HTTP client for the OpenCode API server (anomalyco/opencode).
Handles OAuth flows and LLM calls proxied via OpenCode.

OpenCode REST API reference:
  GET  /global/health
  GET  /provider/auth                     → available auth methods per provider
  POST /provider/:id/oauth/authorize      → start OAuth: {url, method, instructions}
  POST /provider/:id/oauth/callback       → complete OAuth with code
  PUT  /auth/:id                          → set API key  {type:"api", key:"..."}
  DELETE /auth/:id                        → remove credentials
  GET  /provider                          → list providers + connection status

OAuth method types:
  "code"  → user visits URL, copies code from callback page, pastes here
  "auto"  → server polls automatically (e.g. GitHub device code)
"""

import json
import asyncio
from pathlib import Path
from typing import Optional
import httpx
import structlog

logger = structlog.get_logger(__name__)

# Maps our provider names → OpenCode provider IDs
PROVIDER_MAP = {
    "claude":  "anthropic",
    "openai":  "openai",
    "gemini":  "google",
    "copilot": "github-copilot",
}

# Reverse map: opencode provider ID → our name
REVERSE_PROVIDER_MAP = {v: k for k, v in PROVIDER_MAP.items()}

# Path where OpenCode stores auth.json (mounted as read-only in backend)
OPENCODE_AUTH_FILE = Path("/opencode-auth/auth.json")


class OpenCodeClient:
    def __init__(self, base_url: str, password: str = "", username: str = "opencode"):
        self.base_url = base_url.rstrip("/")
        self._auth = (username, password) if password else None

    # ── Internal helpers ───────────────────────────────────────────

    async def _get(self, path: str, timeout: int = 15) -> dict:
        async with httpx.AsyncClient(timeout=timeout, auth=self._auth) as c:
            r = await c.get(f"{self.base_url}{path}")
            r.raise_for_status()
            return r.json()

    async def _post(self, path: str, body: dict = {}, timeout: int = 30) -> dict:
        async with httpx.AsyncClient(timeout=timeout, auth=self._auth) as c:
            r = await c.post(f"{self.base_url}{path}", json=body)
            r.raise_for_status()
            return r.json()

    async def _put(self, path: str, body: dict, timeout: int = 15) -> dict:
        async with httpx.AsyncClient(timeout=timeout, auth=self._auth) as c:
            r = await c.put(f"{self.base_url}{path}", json=body)
            r.raise_for_status()
            return r.json()

    async def _delete(self, path: str, timeout: int = 15):
        async with httpx.AsyncClient(timeout=timeout, auth=self._auth) as c:
            r = await c.delete(f"{self.base_url}{path}")
            r.raise_for_status()

    # ── Health ────────────────────────────────────────────────────

    async def health(self) -> dict:
        try:
            return await self._get("/global/health")
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # ── Provider discovery ────────────────────────────────────────

    async def get_provider_auth_methods(self) -> dict:
        """
        Returns auth methods per provider.
        e.g. {"anthropic": [{"type":"oauth","label":"Claude Pro/Max"}]}
        """
        return await self._get("/provider/auth")

    async def get_providers(self) -> list:
        """List all available providers with their connection status."""
        return await self._get("/provider")

    # ── OAuth flow ────────────────────────────────────────────────

    async def start_oauth(self, provider_id: str, method_index: int = 0) -> dict:
        """
        Initiate OAuth flow for a provider.
        Returns: {"url": "https://...", "method": "code"|"auto", "instructions": "..."}
        """
        return await self._post(
            f"/provider/{provider_id}/oauth/authorize",
            {"method": method_index},
            timeout=20,
        )

    async def complete_oauth(
        self, provider_id: str, method_index: int = 0, code: Optional[str] = None
    ) -> bool:
        """
        Complete OAuth flow.
        - method="code": pass the code extracted from the callback URL
        - method="auto": call without code (OpenCode polls internally — allow up to 3 min)
        """
        body: dict = {"method": method_index}
        if code:
            body["code"] = code
        # Device/auto flows need more time — user must authorize in browser
        timeout = 180 if not code else 30
        result = await self._post(
            f"/provider/{provider_id}/oauth/callback",
            body,
            timeout=timeout,
        )
        return bool(result)

    # ── API key auth ──────────────────────────────────────────────

    async def set_api_key(self, provider_id: str, api_key: str) -> bool:
        """Set an API key credential for a provider in OpenCode."""
        await self._put(f"/auth/{provider_id}", {"type": "api", "key": api_key})
        return True

    async def remove_auth(self, provider_id: str) -> bool:
        try:
            await self._delete(f"/auth/{provider_id}")
            return True
        except Exception:
            return False

    # ── Read stored tokens (from shared volume) ───────────────────

    def read_stored_token(self, provider_id: str) -> Optional[dict]:
        """Read the stored credential from auth.json (mounted volume)."""
        try:
            if not OPENCODE_AUTH_FILE.exists():
                return None
            data = json.loads(OPENCODE_AUTH_FILE.read_text())
            return data.get(provider_id)
        except Exception as e:
            logger.warning("opencode_auth_read_failed", error=str(e))
            return None

    def get_access_token(self, provider_id: str) -> Optional[str]:
        """Extract the usable token for official SDKs."""
        cred = self.read_stored_token(provider_id)
        if not cred:
            return None
        if cred.get("type") == "api":
            return cred.get("key")
        if cred.get("type") == "oauth":
            return cred.get("access") or cred.get("refresh")
        return None

    def is_provider_connected(self, provider_id: str) -> bool:
        """Check if a provider has valid stored credentials."""
        cred = self.read_stored_token(provider_id)
        return cred is not None

    def is_token_expired(self, provider_id: str) -> bool:
        """Check if the OAuth token is expired."""
        import time
        cred = self.read_stored_token(provider_id)
        if not cred or cred.get("type") != "oauth":
            return False
        expires = cred.get("expires", 0)
        if not expires:
            return False
        return time.time() > expires

    # ── LLM Chat via OpenCode sessions ───────────────────────────

    async def chat(
        self,
        messages: list,
        system_prompt: str = "",
        model: str = "anthropic/claude-sonnet-4-5",
        timeout: int = 180,
    ) -> str:
        """
        Send a chat request through an OpenCode session.
        Creates a session, sends a message using the parts[] format,
        and returns the assistant's text response directly.
        """
        # Create session — pass modelID + providerID so OpenCode routes to the correct provider
        provider_id = model.split("/")[0] if "/" in model else model
        session_data = await self._post("/session", {"modelID": model, "providerID": provider_id}, timeout=15)
        session_id = session_data.get("id")
        if not session_id:
            raise RuntimeError(f"OpenCode session creation failed: {session_data}")

        # Build the text prompt (system + conversation history collapsed into one user message)
        lines = []
        if system_prompt:
            lines.append(f"<system>\n{system_prompt}\n</system>\n")
        for m in messages:
            role = "Human" if m.get("role") == "user" else "Assistant"
            lines.append(f"{role}: {m.get('content', '')}")
        prompt_text = "\n\n".join(lines)

        # Send message using the parts[] format required by this version of OpenCode
        result = await self._post(
            f"/session/{session_id}/message",
            {"parts": [{"type": "text", "text": prompt_text}]},
            timeout=timeout,
        )

        # Response is returned directly (no polling needed)
        parts = result.get("parts", [])
        for part in parts:
            if isinstance(part, dict) and part.get("type") == "text":
                text = part.get("text", "").strip()
                if text:
                    return text

        raise RuntimeError(f"OpenCode returned no text in response: {result}")


# ── Global singleton ──────────────────────────────────────────────

_client: Optional[OpenCodeClient] = None


def get_opencode_client() -> OpenCodeClient:
    """Return the global OpenCode client singleton."""
    global _client
    if _client is None:
        from app.config import settings
        _client = OpenCodeClient(
            base_url=getattr(settings, "OPENCODE_URL", "http://opencode:4096"),
            password=getattr(settings, "OPENCODE_PASSWORD", ""),
            username=getattr(settings, "OPENCODE_USERNAME", "opencode"),
        )
    return _client
