"""
System Status API
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.core.evolution_client import evolution_client
from app.models.ai_account import AIAccount

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@router.get("/whatsapp/status")
async def whatsapp_status():
    try:
        conn = await evolution_client.check_connection()
        return {"status": "connected", "data": conn}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("/summary")
async def system_summary(db: AsyncSession = Depends(get_db)):
    """Overall system stats."""
    from app.models.agent import Agent
    from app.models.conversation import Message

    total_agents = (await db.execute(select(func.count(Agent.id)))).scalar() or 0
    active_agents = (await db.execute(select(func.count(Agent.id)).where(Agent.is_active == True))).scalar() or 0
    total_accounts = (await db.execute(select(func.count(AIAccount.id)))).scalar() or 0
    healthy_accounts = (await db.execute(select(func.count(AIAccount.id)).where(AIAccount.is_healthy == True))).scalar() or 0
    total_messages = (await db.execute(select(func.count(Message.id)))).scalar() or 0

    return {
        "agents": {"total": total_agents, "active": active_agents},
        "ai_accounts": {"total": total_accounts, "healthy": healthy_accounts},
        "messages": {"total": total_messages},
    }
