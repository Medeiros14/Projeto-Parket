"""
Web LLM Client
===============
Calls each AI provider using the web session token obtained from the
browser — no API keys, uses the same context window as the web interface.

Supported providers:
  - claude    → claude.ai  (sessionKey cookie)
  - openai    → chatgpt.com (__Secure-next-auth.session-token cookie)
  - gemini    → gemini.google.com (__Secure-3PSID + __Secure-3PAPISID cookies)
"""

import json
import re
import uuid
import httpx
import structlog
from typing import Optional

logger = structlog.get_logger(__name__)


# ──────────────────────────────────────────────
# Claude (claude.ai)
# ──────────────────────────────────────────────

class ClaudeWebClient:
    BASE = "https://claude.ai"

    def __init__(self, session_key: str, org_id: Optional[str] = None):
        self.session_key = session_key
        self.org_id = org_id
        self._headers = {
            "Cookie": f"sessionKey={session_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Referer": "https://claude.ai/",
            "Origin": "https://claude.ai",
        }

    async def _get_org_id(self) -> str:
        if self.org_id:
            return self.org_id
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{self.BASE}/api/organizations", headers=self._headers)
            r.raise_for_status()
            orgs = r.json()
            self.org_id = orgs[0]["uuid"]
            return self.org_id

    async def chat(self, messages: list[dict], system_prompt: str = "") -> str:
        org_id = await self._get_org_id()

        # Create a new conversation
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{self.BASE}/api/organizations/{org_id}/chat_conversations",
                headers=self._headers,
                json={"uuid": str(uuid.uuid4()), "name": ""},
            )
            r.raise_for_status()
            conv_id = r.json()["uuid"]

        # Build the prompt from messages
        prompt = _messages_to_prompt(messages)

        # Send the message (streaming)
        payload = {
            "prompt": prompt,
            "timezone": "America/Sao_Paulo",
            "attachments": [],
            "files": [],
        }
        if system_prompt:
            payload["system_prompt"] = system_prompt

        full_response = ""
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.BASE}/api/organizations/{org_id}/chat_conversations/{conv_id}/completion",
                headers={**self._headers, "Accept": "text/event-stream"},
                json=payload,
            ) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if not data_str or data_str == "[DONE]":
                            continue
                        try:
                            data = json.loads(data_str)
                            chunk = (
                                data.get("completion")
                                or data.get("delta", {}).get("text")
                                or ""
                            )
                            full_response += chunk
                        except json.JSONDecodeError:
                            pass

        return full_response.strip()

    async def test_connection(self) -> dict:
        try:
            org_id = await self._get_org_id()
            return {"ok": True, "org_id": org_id, "provider": "claude"}
        except Exception as e:
            return {"ok": False, "error": str(e), "provider": "claude"}


# ──────────────────────────────────────────────
# OpenAI / ChatGPT (chatgpt.com)
# ──────────────────────────────────────────────

class OpenAIWebClient:
    BASE = "https://chatgpt.com"
    BACKEND = "https://chatgpt.com/backend-api"

    def __init__(self, session_token: str):
        self.session_token = session_token
        self._access_token: Optional[str] = None
        self._headers = {
            "Cookie": f"__Secure-next-auth.session-token={session_token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Referer": "https://chatgpt.com/",
            "Origin": "https://chatgpt.com",
        }

    async def _get_access_token(self) -> str:
        if self._access_token:
            return self._access_token
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{self.BASE}/api/auth/session",
                headers=self._headers,
            )
            r.raise_for_status()
            data = r.json()
            self._access_token = data.get("accessToken", "")
            return self._access_token

    async def chat(self, messages: list[dict], system_prompt: str = "") -> str:
        access_token = await self._get_access_token()
        auth_headers = {
            **self._headers,
            "Authorization": f"Bearer {access_token}",
        }

        payload = {
            "action": "next",
            "messages": [
                {
                    "id": str(uuid.uuid4()),
                    "role": m["role"],
                    "content": {"content_type": "text", "parts": [m["content"]]},
                }
                for m in messages
            ],
            "model": "auto",
            "parent_message_id": str(uuid.uuid4()),
            "timezone_offset_min": -180,
        }
        if system_prompt:
            payload["messages"].insert(0, {
                "id": str(uuid.uuid4()),
                "role": "system",
                "content": {"content_type": "text", "parts": [system_prompt]},
            })

        full_response = ""
        last_message_id = None

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.BACKEND}/conversation",
                headers={**auth_headers, "Accept": "text/event-stream"},
                json=payload,
            ) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if not data_str or data_str == "[DONE]":
                            continue
                        try:
                            data = json.loads(data_str)
                            msg = data.get("message", {})
                            if msg.get("status") == "finished_successfully":
                                content = msg.get("content", {})
                                parts = content.get("parts", [])
                                if parts and isinstance(parts[0], str):
                                    full_response = parts[0]
                        except json.JSONDecodeError:
                            pass

        return full_response.strip()

    async def test_connection(self) -> dict:
        try:
            token = await self._get_access_token()
            return {"ok": bool(token), "provider": "openai"}
        except Exception as e:
            return {"ok": False, "error": str(e), "provider": "openai"}


# ──────────────────────────────────────────────
# Google Gemini (gemini.google.com)
# ──────────────────────────────────────────────

class GeminiWebClient:
    # Uses Google AI Studio API with session cookies
    BASE = "https://generativelanguage.googleapis.com"
    STUDIO = "https://aistudio.google.com"

    def __init__(self, sid_cookie: str, sapisid_cookie: str):
        """
        sid_cookie: value of __Secure-3PSID cookie
        sapisid_cookie: value of __Secure-3PAPISID cookie
        """
        self.sid = sid_cookie
        self.sapisid = sapisid_cookie
        self._headers = {
            "Cookie": f"__Secure-3PSID={sid_cookie}; __Secure-3PAPISID={sapisid_cookie}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
            "Referer": "https://aistudio.google.com/",
            "Origin": "https://aistudio.google.com",
        }

    def _sapisid_hash(self) -> str:
        """Generate SAPISIDHASH for Google API authorization header."""
        import hashlib
        import time
        ts = int(time.time())
        hash_str = f"{ts} {self.sapisid} https://aistudio.google.com"
        h = hashlib.sha1(hash_str.encode()).hexdigest()
        return f"SAPISIDHASH {ts}_{h}"

    async def chat(self, messages: list[dict], system_prompt: str = "") -> str:
        headers = {
            **self._headers,
            "Authorization": self._sapisid_hash(),
            "X-Goog-AuthUser": "0",
        }

        # Build contents array for Gemini format
        contents = []
        for m in messages:
            role = "user" if m["role"] == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": m["content"]}]
            })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8192,
            },
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{self.BASE}/v1beta/models/gemini-2.0-flash:generateContent",
                headers=headers,
                json=payload,
            )
            r.raise_for_status()
            data = r.json()

        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            return str(data)

    async def test_connection(self) -> dict:
        try:
            response = await self.chat([{"role": "user", "content": "Olá"}])
            return {"ok": bool(response), "provider": "gemini"}
        except Exception as e:
            return {"ok": False, "error": str(e), "provider": "gemini"}


# ──────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────

def build_client(provider: str, session_token: str, extra: dict):
    """Build the appropriate web client from stored account data."""
    if provider == "claude":
        return ClaudeWebClient(
            session_key=session_token,
            org_id=extra.get("org_id"),
        )
    elif provider == "openai":
        return OpenAIWebClient(session_token=session_token)
    elif provider == "gemini":
        return GeminiWebClient(
            sid_cookie=session_token,
            sapisid_cookie=extra.get("sapisid", ""),
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _messages_to_prompt(messages: list[dict]) -> str:
    """Convert messages list to a single prompt string for Claude."""
    parts = []
    for m in messages:
        role = "Human" if m["role"] == "user" else "Assistant"
        parts.append(f"{role}: {m['content']}")
    return "\n\n".join(parts)
