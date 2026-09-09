"""
AI Accounts API — OpenCode OAuth Integration
=============================================
Manages LLM provider connections via OpenCode's OAuth flow.
Providers: Claude (OAuth), OpenAI (OAuth/API key), Gemini (API key)
"""

import re
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.ai_account import AIAccount
from app.core.account_pool import account_pool
from app.core.opencode_client import get_opencode_client, PROVIDER_MAP, REVERSE_PROVIDER_MAP

router = APIRouter(prefix="/accounts", tags=["accounts"])


# ── Schemas ──────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    provider: str       # claude | openai | gemini
    label: str
    session_token: str  # API key OR OAuth access token
    extra: dict = {}

class AccountUpdate(BaseModel):
    label: Optional[str] = None
    session_token: Optional[str] = None
    extra: Optional[dict] = None
    is_active: Optional[bool] = None
    token_limit: Optional[int] = None

class OAuthStartRequest(BaseModel):
    provider: str       # claude | openai | gemini | copilot
    method_index: int = 0

class OAuthCallbackRequest(BaseModel):
    provider: str
    method_index: int = 0
    code: Optional[str] = None      # code OR full callback URL
    label: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────

def _extract_code(raw: str) -> str:
    """
    Accept either:
      - Full callback URL: https://platform.claude.com/oauth/code/callback?code=XxLat...&state=...
        → returns "code#state" (OpenCode needs both combined)
      - Already combined: XxLat3lo...#V7YfpPqR...
        → returned as-is
      - Just the code (no state): XxLat3loPI4pOqaP0HO0f8fgiDHZtRZZIN2I11hfj2qxJsVf
        → returned as-is

    Note: platform.claude.com/oauth/code/callback shows "Paste this into Claude Code: CODE#STATE"
    OpenCode expects the full "CODE#STATE" string, not just the code.
    """
    raw = raw.strip()
    # If it's a URL, extract code + state and combine as "code#state"
    code_m = re.search(r'[?&]code=([^&\s]+)', raw)
    if code_m:
        code = code_m.group(1)
        state_m = re.search(r'[?&]state=([^&\s]+)', raw)
        if state_m:
            return f"{code}#{state_m.group(1)}"
        return code
    # Otherwise assume it's already the "code#state" or bare code
    return raw


def _to_dict(a: AIAccount, hide_token: bool = True) -> dict:
    token = a.session_token or ""
    masked = ("••••" + token[-6:]) if token else "••••••••"
    return {
        "id": str(a.id),
        "provider": a.provider,
        "label": a.label,
        "session_token": masked if hide_token else token,
        "extra": {k: v for k, v in (a.extra or {}).items() if k not in ("sapisid",)},
        "auth_type": (a.extra or {}).get("auth_type", "api_key"),
        "is_active": a.is_active,
        "is_healthy": a.is_healthy,
        "token_count": a.token_count,
        "token_limit": a.token_limit,
        "usage_pct": round(a.token_count / max(a.token_limit, 1) * 100, 1),
        "last_used": a.last_used.isoformat() if a.last_used else None,
        "last_error": a.last_error,
        "consecutive_errors": a.consecutive_errors,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ── OAuth endpoints ───────────────────────────────────────────────

@router.get("/oauth/providers")
async def list_oauth_providers():
    """
    Returns providers with their available auth methods from OpenCode.
    Includes which ones are already connected.
    """
    oc = get_opencode_client()
    try:
        methods = await oc.get_provider_auth_methods()
    except Exception as e:
        # OpenCode may not be ready yet
        methods = {}

    result = []
    for our_name, oc_id in PROVIDER_MAP.items():
        provider_methods = methods.get(oc_id, [])
        connected = oc.is_provider_connected(oc_id)
        expired = oc.is_token_expired(oc_id) if connected else False

        result.append({
            "id": our_name,
            "opencode_id": oc_id,
            "name": {
                "claude": "Claude (Anthropic)",
                "openai": "ChatGPT (OpenAI)",
                "gemini": "Gemini (Google)",
                "copilot": "GitHub Copilot",
            }.get(our_name, our_name.title()),
            "connected": connected,
            "expired": expired,
            "auth_methods": provider_methods,
            "has_oauth": our_name in ("claude", "openai", "gemini") or any(m.get("type") == "oauth" for m in provider_methods),
        })

    return result


@router.post("/oauth/start")
async def start_oauth(data: OAuthStartRequest):
    """
    Initiate OAuth flow.
    - Gemini: uses direct Google OAuth2 device flow (no OpenCode)
    - Others: route through OpenCode
    """
    oc_id = PROVIDER_MAP.get(data.provider)
    if not oc_id:
        raise HTTPException(422, f"Provedor desconhecido: {data.provider}")

    # ── Claude: direct Anthropic PKCE OAuth flow (OpenCode fork doesn't support it) ──
    if data.provider == "claude":
        from app.core.anthropic_oauth import start_anthropic_oauth
        try:
            result = start_anthropic_oauth()
            return {
                "url": result["url"],
                "method": result["method"],
                "instructions": result["instructions"],
                "user_code": result["user_code"],
                "provider": data.provider,
                "opencode_id": oc_id,
                "method_index": 0,
                "flow_id": "",
            }
        except Exception as e:
            raise HTTPException(503, f"Anthropic OAuth falhou: {str(e)}")

    # ── Gemini: direct Google OAuth2 device flow ──
    if data.provider == "gemini":
        from app.core.google_oauth import start_device_flow
        from app.config import settings
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
        if not client_id:
            raise HTTPException(422, "Configure GOOGLE_CLIENT_ID no .env para usar OAuth do Gemini")
        try:
            result = await start_device_flow(client_id)
            return {
                "url": result["url"],
                "method": result["method"],
                "instructions": result["instructions"],
                "user_code": result["user_code"],
                "provider": data.provider,
                "opencode_id": oc_id,
                "method_index": 0,
                "flow_id": result.get("flow_id", ""),
            }
        except Exception as e:
            raise HTTPException(503, f"Google OAuth falhou: {str(e)}")

    # ── Others: route through OpenCode ──
    oc = get_opencode_client()

    method_index = data.method_index

    try:
        result = await oc.start_oauth(oc_id, method_index)
    except Exception as e:
        raise HTTPException(503, f"OpenCode indisponível: {str(e)}")

    url = result.get("url", "")
    flow_method = result.get("method", "code")

    # Detect incompatible browser OAuth: either the URL itself is localhost,
    # or the redirect_uri parameter inside the URL points to localhost.
    def _has_localhost(u: str) -> bool:
        return (
            u.startswith("http://localhost") or
            u.startswith("http://127.0.0.1") or
            "redirect_uri=http%3A%2F%2Flocalhost" in u or
            "redirect_uri=http%3A%2F%2F127.0.0.1" in u
        )

    if _has_localhost(url):
        try:
            result2 = await oc.start_oauth(oc_id, method_index + 1)
            alt_url = result2.get("url", "")
            if alt_url and not _has_localhost(alt_url):
                url = alt_url
                flow_method = result2.get("method", flow_method)
                result = result2
                method_index = method_index + 1  # use this method for the callback too
        except Exception:
            pass  # keep original

    # Extract device code from instructions if not returned as user_code
    user_code = result.get("user_code", "")
    if not user_code:
        import re as _re
        m = _re.search(r'(?:Enter code|code):\s*([A-Z0-9]{4}-[A-Z0-9]{4,})', result.get("instructions", ""), _re.IGNORECASE)
        if m:
            user_code = m.group(1)

    return {
        "url": url,
        "method": flow_method,               # "code" | "auto"
        "instructions": result.get("instructions", ""),
        "user_code": user_code,
        "provider": data.provider,
        "opencode_id": oc_id,
        "method_index": method_index,
    }


@router.post("/oauth/callback")
async def complete_oauth(data: OAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    """
    Complete OAuth flow.
    - Gemini: polls Google directly for device flow token
    - Others: route through OpenCode
    """
    oc_id = PROVIDER_MAP.get(data.provider)
    if not oc_id:
        raise HTTPException(422, f"Provedor desconhecido: {data.provider}")

    # ── Claude: direct Anthropic PKCE OAuth completion ──
    if data.provider == "claude":
        from app.core.anthropic_oauth import complete_anthropic_oauth
        code_raw = data.code or ""
        if not code_raw.strip():
            raise HTTPException(422, "Cole o código exibido na página do Claude (ex: CÓDIGO#ESTADO)")
        try:
            token_data = await complete_anthropic_oauth(code_raw)
        except Exception as e:
            raise HTTPException(400, f"Anthropic OAuth falhou: {str(e)}")

        token = token_data.get("access_token", "")
        # Also register the token in OpenCode so it can proxy requests (best-effort)
        try:
            oc = get_opencode_client()
            await oc.set_api_key(oc_id, token)
        except Exception:
            pass  # OpenCode doesn't support anthropic provider; skip

        count_result = await db.execute(
            select(AIAccount).where(AIAccount.provider == data.provider)
        )
        existing_oauth = [
            a for a in count_result.scalars().all()
            if (a.extra or {}).get("auth_type") == "oauth"
        ]
        existing_count = len(existing_oauth)
        suffix = f" {existing_count + 1}" if existing_count > 0 else ""
        label = data.label or f"Claude OAuth{suffix}"

        account = AIAccount(
            provider=data.provider,
            label=label,
            session_token=token,
            is_healthy=True,
            extra={
                "auth_type": "oauth",
                "refresh_token": token_data.get("refresh_token", ""),
                "expires_in": token_data.get("expires_in", 0),
                "opencode_id": oc_id,
            },
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)

        return {
            "ok": True,
            "account": _to_dict(account, hide_token=True),
            "auth_type": "oauth",
        }

    # ── Gemini: direct Google OAuth2 completion ──
    if data.provider == "gemini":
        from app.core.google_oauth import complete_device_flow
        from app.config import settings
        client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
        client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "")
        device_code = data.code or ""  # flow_id = device_code
        if not device_code:
            raise HTTPException(422, "device_code (flow_id) é obrigatório")
        try:
            token_data = await complete_device_flow(client_id, client_secret, device_code, timeout=180)
        except Exception as e:
            raise HTTPException(400, f"Google OAuth falhou: {str(e)}")

        token = token_data.get("access_token", "")
        auth_type = "oauth"

        # Count existing OAuth accounts for this provider to auto-generate label
        count_result = await db.execute(
            select(AIAccount).where(AIAccount.provider == data.provider)
        )
        existing_oauth = [
            a for a in count_result.scalars().all()
            if (a.extra or {}).get("auth_type") == "oauth"
        ]
        existing_count = len(existing_oauth)
        suffix = f" {existing_count + 1}" if existing_count > 0 else ""
        label = data.label or f"Gemini OAuth{suffix}"

        account = AIAccount(
            provider=data.provider,
            label=label,
            session_token=token,
            is_healthy=True,
            extra={
                "auth_type": auth_type,
                "refresh_token": token_data.get("refresh_token", ""),
                "model": "gemini-2.5-flash",
            },
        )
        db.add(account)
        await db.commit()
        await db.refresh(account)

        return {
            "ok": True,
            "account": _to_dict(account, hide_token=True),
            "auth_type": auth_type,
        }

    # ── Others: route through OpenCode ──
    oc = get_opencode_client()

    # Extract code from full URL or raw code string
    code = _extract_code(data.code) if data.code else None

    try:
        success = await oc.complete_oauth(oc_id, data.method_index, code)
    except Exception as e:
        raise HTTPException(400, f"OAuth falhou: {str(e)}")

    if not success:
        raise HTTPException(400, "OAuth falhou — tente novamente")

    # Read the stored token from auth.json
    token = oc.get_access_token(oc_id) or ""
    cred = oc.read_stored_token(oc_id) or {}
    auth_type = "oauth" if cred.get("type") == "oauth" else "api_key"

    # Count existing OAuth accounts for this provider to auto-generate label
    count_result = await db.execute(
        select(AIAccount).where(AIAccount.provider == data.provider)
    )
    existing_oauth = [
        a for a in count_result.scalars().all()
        if (a.extra or {}).get("auth_type") == "oauth"
    ]
    existing_count = len(existing_oauth)
    suffix = f" {existing_count + 1}" if existing_count > 0 else ""
    label = data.label or f"{data.provider.title()} OAuth{suffix}"

    # Always create a new account — allows multiple per provider
    account = AIAccount(
        provider=data.provider,
        label=label,
        session_token=token,
        is_healthy=True,
        extra={"auth_type": auth_type, "opencode_id": oc_id},
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    return {
        "ok": True,
        "account": _to_dict(account, hide_token=True),
        "auth_type": auth_type,
    }


@router.delete("/oauth/{provider}")
async def disconnect_oauth(provider: str, db: AsyncSession = Depends(get_db)):
    """Remove OAuth credentials for a provider (from OpenCode + DB)."""
    oc_id = PROVIDER_MAP.get(provider)
    if not oc_id:
        raise HTTPException(422, f"Provedor desconhecido: {provider}")

    oc = get_opencode_client()
    await oc.remove_auth(oc_id)

    # Remove from DB
    result = await db.execute(
        select(AIAccount).where(AIAccount.provider == provider)
    )
    for acc in result.scalars().all():
        if (acc.extra or {}).get("auth_type") == "oauth":
            await db.delete(acc)
    await db.commit()

    return {"ok": True}




@router.get("/models/{provider}")
async def list_models(provider: str):
    """Return available models for a provider."""
    if provider == "gemini":
        from app.core.llm_client import GeminiClient
        return {
            "provider": "gemini",
            "default": GeminiClient.DEFAULT_MODEL,
            "models": [
                {"id": k, **v} for k, v in GeminiClient.AVAILABLE_MODELS.items()
            ],
        }
    return {"provider": provider, "default": None, "models": []}


@router.patch("/{account_id}/model")
async def set_account_model(account_id: uuid.UUID, data: dict, db: AsyncSession = Depends(get_db)):
    """Update the model for a Gemini account."""
    model = data.get("model")
    if not model:
        raise HTTPException(422, "model is required")

    result = await db.execute(select(AIAccount).where(AIAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    extra = dict(account.extra or {})
    extra["model"] = model
    account.extra = extra
    await db.commit()
    return {"ok": True, "model": model}

# ── Standard CRUD (API key accounts) ──────────────────────────────

@router.get("/")
async def list_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIAccount).order_by(AIAccount.provider, AIAccount.created_at))
    return [_to_dict(a) for a in result.scalars().all()]


@router.post("/")
async def add_account(data: AccountCreate, db: AsyncSession = Depends(get_db)):
    """Add an account using an API key (non-OAuth path)."""
    if data.provider not in ("claude", "openai", "gemini"):
        raise HTTPException(422, "provider deve ser: claude, openai ou gemini")

    # Also register the API key in OpenCode so it can be used for routing
    oc = get_opencode_client()
    oc_id = PROVIDER_MAP.get(data.provider, data.provider)
    try:
        await oc.set_api_key(oc_id, data.session_token)
    except Exception as e:
        # OpenCode may be starting up — log but continue
        import structlog
        structlog.get_logger(__name__).warning("opencode_set_key_failed", error=str(e))

    account = AIAccount(
        provider=data.provider,
        label=data.label,
        session_token=data.session_token,
        extra={**data.extra, "auth_type": "api_key"},
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    test = await account_pool.test_account(account)
    account.is_healthy = test.get("ok", False)
    if not account.is_healthy:
        account.last_error = test.get("error", "")
    await db.commit()

    result_dict = _to_dict(account)
    result_dict["test"] = test
    return result_dict


@router.delete("/{account_id}")
async def delete_account(account_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIAccount).where(AIAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")
    await db.delete(account)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{account_id}/test")
async def test_account(account_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIAccount).where(AIAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")
    test = await account_pool.test_account(account)
    account.is_healthy = test.get("ok", False)
    account.last_error = test.get("error") if not account.is_healthy else None
    await db.commit()
    return test


@router.post("/{account_id}/reset")
async def reset_account(account_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(AIAccount)
        .where(AIAccount.id == account_id)
        .values(token_count=0, consecutive_errors=0, is_healthy=True, last_error=None)
    )
    await db.commit()
    return {"status": "reset"}
