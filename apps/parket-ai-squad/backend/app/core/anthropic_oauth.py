"""
Anthropic (Claude) OAuth — PKCE Authorization Code Flow
=========================================================
Implements the same OAuth flow used by Claude Code to authenticate
with a Claude Pro/Max subscription.

References:
  - Auth URL:    https://claude.ai/oauth/authorize
  - Token URL:   https://api.anthropic.com/oauth/token
  - Redirect URI: https://platform.claude.com/oauth/code/callback
  - Client ID:   9d1c250a-e61b-44d9-88ed-5944d1962f5e  (Claude Code public client)

Flow:
  1. Backend generates PKCE verifier + challenge and returns authorization URL.
  2. User opens the URL, logs into claude.ai, and sees a code on the callback page.
     The page shows: "Paste this into Claude Code: CODE#STATE"
  3. User pastes CODE#STATE here; backend splits it and exchanges for tokens.
"""

import hashlib
import base64
import secrets
import re
import time
import urllib.parse
import httpx
import structlog

logger = structlog.get_logger(__name__)

# ── OAuth constants ──────────────────────────────────────────────────

CLIENT_ID    = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
AUTH_URL     = "https://claude.com/cai/oauth/authorize"
TOKEN_URL    = "https://platform.claude.com/v1/oauth/token"
REDIRECT_URI = "https://platform.claude.com/oauth/code/callback"
SCOPES       = "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload"

# In-memory store of pending flows: state → verifier
# (short-lived; expires naturally when process restarts)
_pending_flows: dict[str, dict] = {}


# ── PKCE helpers ───────────────────────────────────────────────────

def _generate_pkce() -> tuple[str, str]:
    """Returns (verifier, challenge) for PKCE S256."""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode()
    digest   = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


# ── Public API ─────────────────────────────────────────────────────

def start_anthropic_oauth() -> dict:
    """
    Generate authorization URL for Anthropic OAuth (PKCE).
    Returns the dict the accounts endpoint forwards to the frontend.
    """
    verifier, challenge = _generate_pkce()
    # Claude validates state min length (43 chars, same as code_challenge)
    state = secrets.token_urlsafe(32)[:43]
    while len(state) < 43:
        state += secrets.token_urlsafe(8)
    state = state[:43]

    _pending_flows[state] = {"verifier": verifier, "created_at": time.time()}
    # Clean up flows older than 10 min
    cutoff = time.time() - 600
    for s in list(_pending_flows.keys()):
        if _pending_flows[s]["created_at"] < cutoff:
            del _pending_flows[s]

    params = urllib.parse.urlencode({
        "code":                  "true",      # tells claude.ai to display the code manually
        "client_id":             CLIENT_ID,
        "response_type":         "code",
        "redirect_uri":          REDIRECT_URI,
        "scope":                 SCOPES,
        "code_challenge":        challenge,
        "code_challenge_method": "S256",
        "state":                 state,
    })
    url = f"{AUTH_URL}?{params}"

    logger.info("anthropic_oauth_started", state=state)
    return {
        "url": url,
        "method": "code",
        "instructions": (
            "Abra o link, faça login no Claude e autorize. "
            "A página vai exibir um código no formato CÓDIGO#ESTADO. "
            'Cole esse valor abaixo e clique em "Confirmar Conexão".'
        ),
        "user_code": "",
    }


async def complete_anthropic_oauth(code_and_state: str) -> dict:
    """
    Exchange the CODE#STATE string from the Claude callback page for tokens.
    Returns: {"access_token": str, "refresh_token": str|None, "expires_in": int}
    Raises: ValueError on failure.
    """
    code_and_state = code_and_state.strip()

    # Accept full callback URL too
    m = re.search(r"[?&]code=([^&\s#]+)", code_and_state)
    if m:
        code  = m.group(1)
        sm    = re.search(r"[?&]state=([^&\s]+)", code_and_state)
        state = sm.group(1) if sm else ""
    elif "#" in code_and_state:
        code, state = code_and_state.split("#", 1)
        code  = code.strip()
        state = state.strip()
    else:
        # No state provided — try without PKCE verification
        code  = code_and_state
        state = ""

    # Retrieve verifier
    flow = _pending_flows.pop(state, None) if state else None
    if flow is None and state:
        logger.warning("anthropic_oauth_state_not_found", state=state)
        # Attempt without verifier (may fail server-side, but worth trying)
        verifier = None
    else:
        verifier = flow["verifier"] if flow else None

    payload: dict = {
        "grant_type":    "authorization_code",
        "client_id":     CLIENT_ID,
        "code":          code,
        "redirect_uri":  REDIRECT_URI,
    }
    if verifier:
        payload["code_verifier"] = verifier
    if state:
        payload["state"] = state  # Anthropic requires state in the body

    headers = {"User-Agent": "claude-cli/2.1.81", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30) as c:
        # Anthropic expects JSON body with state included
        r = await c.post(TOKEN_URL, json=payload, headers={**headers, "Content-Type": "application/json"})
        if not r.is_success:
            # Fallback form-urlencoded (per OAuth 2.0 standard)
            r = await c.post(TOKEN_URL, data=payload, headers={**headers, "Content-Type": "application/x-www-form-urlencoded"})
        if not r.is_success:
            logger.error("anthropic_oauth_token_exchange_failed",
                         status=r.status_code, body=r.text[:500])
            raise ValueError(f"Token exchange falhou ({r.status_code}): {r.text[:300]}")

    data = r.json()
    access_token = data.get("access_token") or data.get("token")
    if not access_token:
        raise ValueError(f"Resposta sem access_token: {data}")

    logger.info("anthropic_oauth_completed")
    return {
        "access_token":  access_token,
        "refresh_token": data.get("refresh_token"),
        "expires_in":    data.get("expires_in", 0),
    }


async def refresh_anthropic_token(refresh_token: str) -> dict:
    """
    Use a refresh token to obtain a new access token.
    Returns: {"access_token": str, "refresh_token": str, "expires_in": int}
    Raises: ValueError on failure.
    """
    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": CLIENT_ID,
    }

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(TOKEN_URL, json=payload)
        if not r.is_success:
            logger.error("anthropic_oauth_refresh_failed",
                         status=r.status_code, body=r.text[:500])
            raise ValueError(f"Token refresh falhou ({r.status_code}): {r.text[:300]}")

    data = r.json()
    access_token = data.get("access_token")
    if not access_token:
        raise ValueError(f"Resposta sem access_token: {data}")

    logger.info("anthropic_oauth_token_refreshed")
    return {
        "access_token":  access_token,
        "refresh_token": data.get("refresh_token", refresh_token),
        "expires_in":    data.get("expires_in", 0),
    }
