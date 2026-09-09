"""OAuth token management — save/check Claude OAuth tokens in OpenCode."""
import json
import subprocess
import structlog
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = structlog.get_logger()
router = APIRouter(prefix="/oauth", tags=["oauth"])

# Path inside the container (mounted volume)
AUTH_JSON_PATH = Path("/opencode-auth/auth.json")


def _read_auth_json() -> dict:
    """Read current auth.json from OpenCode volume."""
    try:
        if AUTH_JSON_PATH.exists():
            return json.loads(AUTH_JSON_PATH.read_text())
        return {}
    except Exception:
        return {}


def _write_auth_json(data: dict) -> bool:
    """Write auth.json to OpenCode volume."""
    try:
        AUTH_JSON_PATH.write_text(json.dumps(data, indent=2))
        return True
    except Exception as e:
        logger.error("write_auth_json_failed", error=str(e))
        return False


class SaveTokenRequest(BaseModel):
    access_token: str


@router.get("/status")
async def oauth_status():
    """Check current OAuth token status."""
    auth = _read_auth_json()
    anthropic = auth.get("anthropic", {})
    key = anthropic.get("key", "")
    has_token = bool(key and key.startswith("sk-ant-"))
    return {
        "has_token": has_token,
        "token_preview": key[:20] + "..." if has_token else None,
        "type": anthropic.get("type", "unknown") if has_token else None
    }


@router.post("/save-token")
async def save_token(req: SaveTokenRequest):
    """Save a new OAuth access token to OpenCode auth.json."""
    token = req.access_token.strip()
    if not token:
        raise HTTPException(400, "Token vazio")

    auth = _read_auth_json()

    # Update anthropic entry
    auth["anthropic"] = {
        "type": "api",
        "key": token
    }

    # Keep google if exists
    if "google" not in auth:
        auth["google"] = {
            "type": "api",
            "key": ""
        }

    success = _write_auth_json(auth)
    if not success:
        raise HTTPException(500, "Falha ao gravar auth.json no OpenCode")

    logger.info("oauth_token_saved", preview=token[:20] + "...")
    return {"status": "ok", "preview": token[:20] + "..."}
