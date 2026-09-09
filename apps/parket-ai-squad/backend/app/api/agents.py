"""
Agent CRUD API
"""

import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.agent import Agent, AgentMCP, AgentSkill
from app.core.agno_engine import agent_squad

router = APIRouter(prefix="/agents", tags=["agents"])


# ---- Schemas ----

class AgentCreate(BaseModel):
    name: str
    description: str = ""
    instructions: str = ""
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    language: str = "pt-BR"
    reply_only_mentions: bool = False
    config: dict = {}


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    language: Optional[str] = None
    is_active: Optional[bool] = None
    reply_only_mentions: Optional[bool] = None
    config: Optional[dict] = None


class MCPCreate(BaseModel):
    name: str
    description: str = ""
    server_url: Optional[str] = None
    command: Optional[str] = None
    args: list = []
    env: dict = {}
    headers: dict = {}
    mcp_type: str = "http"  # http | stdio


class SkillCreate(BaseModel):
    name: str
    description: str = ""
    skill_type: str = "custom"
    config: dict = {}


# ---- Endpoints ----

@router.get("/")
async def list_agents(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    q = select(Agent).options(selectinload(Agent.mcps), selectinload(Agent.skills))
    if active_only:
        q = q.where(Agent.is_active == True)
    result = await db.execute(q.order_by(Agent.created_at.desc()))
    agents = result.scalars().all()
    return [_agent_to_dict(a) for a in agents]


@router.post("/")
async def create_agent(data: AgentCreate, db: AsyncSession = Depends(get_db)):
    agent = Agent(**data.model_dump())
    db.add(agent)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        if "ix_agents_group_id" in str(e) or "unique" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail="Este grupo já possui um agente vinculado. Edite o agente existente ou desvincule o grupo primeiro.",
            )
        raise HTTPException(status_code=400, detail=str(e))
    agent_squad.invalidate_cache()

    # Add default MCPs to every new agent
    from app.core.default_mcps import DEFAULT_MCPS
    for mcp_data in DEFAULT_MCPS:
        db.add(AgentMCP(agent_id=agent.id, **mcp_data))
    await db.commit()

    # Reload with eager-loaded relationships to avoid lazy-load in async context
    result = await db.execute(
        select(Agent).where(Agent.id == agent.id)
        .options(selectinload(Agent.mcps), selectinload(Agent.skills))
    )
    agent = result.scalar_one()
    return _agent_to_dict(agent)


@router.get("/{agent_id}")
async def get_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Agent)
        .where(Agent.id == agent_id)
        .options(selectinload(Agent.mcps), selectinload(Agent.skills))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_to_dict(agent)


@router.patch("/{agent_id}")
async def update_agent(agent_id: uuid.UUID, data: AgentUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(agent, field, value)

    await db.commit()
    agent_squad.invalidate_cache()
    return {"status": "updated"}


@router.delete("/{agent_id}")
async def delete_agent(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()
    agent_squad.invalidate_cache()
    return {"status": "deleted"}


# ---- MCPs ----

@router.get("/{agent_id}/mcps")
async def list_mcps(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentMCP).where(AgentMCP.agent_id == agent_id))
    mcps = result.scalars().all()
    return [_mcp_to_dict(m) for m in mcps]


@router.post("/{agent_id}/mcps")
async def add_mcp(agent_id: uuid.UUID, data: MCPCreate, db: AsyncSession = Depends(get_db)):
    mcp = AgentMCP(agent_id=agent_id, **data.model_dump())
    db.add(mcp)
    await db.commit()
    await db.refresh(mcp)
    agent_squad.invalidate_cache()
    return _mcp_to_dict(mcp)


@router.delete("/{agent_id}/mcps/{mcp_id}")
async def delete_mcp(agent_id: uuid.UUID, mcp_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentMCP).where(AgentMCP.id == mcp_id, AgentMCP.agent_id == agent_id)
    )
    mcp = result.scalar_one_or_none()
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found")
    await db.delete(mcp)
    await db.commit()
    return {"status": "deleted"}


# ---- Skills ----

@router.get("/{agent_id}/skills")
async def list_skills(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentSkill).where(AgentSkill.agent_id == agent_id))
    skills = result.scalars().all()
    return [_skill_to_dict(s) for s in skills]


@router.post("/{agent_id}/skills")
async def add_skill(agent_id: uuid.UUID, data: SkillCreate, db: AsyncSession = Depends(get_db)):
    skill = AgentSkill(agent_id=agent_id, **data.model_dump())
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return _skill_to_dict(skill)


@router.delete("/{agent_id}/skills/{skill_id}")
async def delete_skill(agent_id: uuid.UUID, skill_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentSkill).where(AgentSkill.id == skill_id, AgentSkill.agent_id == agent_id)
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.delete(skill)
    await db.commit()
    return {"status": "deleted"}


# ---- Helpers ----

def _agent_to_dict(a: Agent) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "description": a.description,
        "instructions": a.instructions,
        "group_id": a.group_id,
        "group_name": a.group_name,
        "is_active": a.is_active,
        "language": a.language,
        "reply_only_mentions": a.reply_only_mentions,
        "config": a.config,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        "mcps": [_mcp_to_dict(m) for m in (a.mcps or [])],
        "skills": [_skill_to_dict(s) for s in (a.skills or [])],
    }


def _mcp_to_dict(m: AgentMCP) -> dict:
    return {
        "id": str(m.id),
        "agent_id": str(m.agent_id),
        "name": m.name,
        "description": m.description,
        "server_url": m.server_url,
        "command": m.command,
        "args": m.args,
        "env": m.env,
        "headers": m.headers,
        "mcp_type": m.mcp_type,
        "is_active": m.is_active,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _skill_to_dict(s: AgentSkill) -> dict:
    return {
        "id": str(s.id),
        "agent_id": str(s.agent_id),
        "name": s.name,
        "description": s.description,
        "skill_type": s.skill_type,
        "config": s.config,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
