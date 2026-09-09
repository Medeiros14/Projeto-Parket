"""
WhatsApp Groups API
"""

from fastapi import APIRouter, HTTPException
from app.core.evolution_client import evolution_client

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("/")
async def list_groups():
    """Fetch all WhatsApp groups from Evolution API."""
    try:
        groups = await evolution_client.get_groups()
        return [
            {
                "id": g.get("id") or g.get("remoteJid", ""),
                "name": g.get("subject") or g.get("name", ""),
                "description": g.get("desc", ""),
                "participants_count": len(g.get("participants", [])),
                "creation": g.get("creation"),
            }
            for g in groups
        ]
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Evolution API error: {e}")


@router.get("/connection")
async def check_connection():
    """Check WhatsApp connection status."""
    try:
        return await evolution_client.check_connection()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/configure-webhook")
async def configure_webhook(body: dict):
    """Configure the Evolution API webhook URL."""
    url = body.get("url")
    if not url:
        raise HTTPException(status_code=422, detail="Missing webhook URL")
    try:
        return await evolution_client.configure_webhook(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
