"""
Agent Groups API
================
Manage groups of collaborating agents.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models.agent_group import AgentGroup, AgentGroupMember, AgentGroupMessage
from app.models.agent import Agent

router = APIRouter(prefix="/agent-groups", tags=["agent-groups"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    shared_context: Optional[str] = None

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    shared_context: Optional[str] = None
    is_active: Optional[bool] = None

class MemberAdd(BaseModel):
    agent_id: str
    role: str = "member"

class TaskPost(BaseModel):
    content: str
    from_agent_id: Optional[str] = None
    message_type: str = "task"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _member_dict(m: AgentGroupMember) -> dict:
    return {
        "id": str(m.id),
        "agent_id": str(m.agent_id),
        "agent_name": m.agent.name if m.agent else None,
        "role": m.role,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }

def _group_dict(g: AgentGroup, include_members: bool = True) -> dict:
    d = {
        "id": str(g.id),
        "name": g.name,
        "description": g.description,
        "shared_context": g.shared_context,
        "is_active": g.is_active,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
        "member_count": len(g.members) if g.members else 0,
    }
    if include_members:
        d["members"] = [_member_dict(m) for m in (g.members or [])]
    return d

def _msg_dict(m: AgentGroupMessage) -> dict:
    return {
        "id": str(m.id),
        "group_id": str(m.group_id),
        "agent_id": str(m.agent_id) if m.agent_id else None,
        "agent_name": m.agent.name if m.agent else "Sistema",
        "message_type": m.message_type,
        "content": m.content,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
async def list_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentGroup)
        .options(selectinload(AgentGroup.members).selectinload(AgentGroupMember.agent))
        .order_by(AgentGroup.created_at.desc())
    )
    groups = result.scalars().all()
    return [_group_dict(g) for g in groups]


@router.post("/")
async def create_group(data: GroupCreate, db: AsyncSession = Depends(get_db)):
    group = AgentGroup(
        name=data.name,
        description=data.description,
        shared_context=data.shared_context,
    )
    db.add(group)
    await db.commit()
    # Reload with members eagerly to avoid lazy-load in async context
    result = await db.execute(
        select(AgentGroup)
        .where(AgentGroup.id == group.id)
        .options(selectinload(AgentGroup.members).selectinload(AgentGroupMember.agent))
    )
    group = result.scalar_one()
    return _group_dict(group)


@router.get("/{group_id}")
async def get_group(group_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentGroup)
        .where(AgentGroup.id == group_id)
        .options(selectinload(AgentGroup.members).selectinload(AgentGroupMember.agent))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Grupo não encontrado")
    return _group_dict(group)


@router.patch("/{group_id}")
async def update_group(group_id: str, data: GroupUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentGroup)
        .where(AgentGroup.id == group_id)
        .options(selectinload(AgentGroup.members).selectinload(AgentGroupMember.agent))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Grupo não encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(group, k, v)
    group.updated_at = datetime.utcnow()
    await db.commit()
    result = await db.execute(
        select(AgentGroup)
        .where(AgentGroup.id == group_id)
        .options(selectinload(AgentGroup.members).selectinload(AgentGroupMember.agent))
    )
    group = result.scalar_one()
    return _group_dict(group)


@router.delete("/{group_id}")
async def delete_group(group_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentGroup).where(AgentGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Grupo não encontrado")
    await db.delete(group)
    await db.commit()
    return {"ok": True}


# ── Members ──────────────────────────────────────────────────────────────────

@router.post("/{group_id}/members")
async def add_member(group_id: str, data: MemberAdd, db: AsyncSession = Depends(get_db)):
    # Verify group exists
    r = await db.execute(select(AgentGroup).where(AgentGroup.id == group_id))
    if not r.scalar_one_or_none():
        raise HTTPException(404, "Grupo não encontrado")

    # Verify agent exists
    r = await db.execute(select(Agent).where(Agent.id == data.agent_id))
    agent = r.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agente não encontrado")

    # Check if already member
    r = await db.execute(
        select(AgentGroupMember)
        .where(AgentGroupMember.group_id == group_id, AgentGroupMember.agent_id == data.agent_id)
    )
    if r.scalar_one_or_none():
        raise HTTPException(400, "Agente já é membro do grupo")

    member = AgentGroupMember(group_id=group_id, agent_id=data.agent_id, role=data.role)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    # Load agent for response
    r = await db.execute(
        select(AgentGroupMember)
        .where(AgentGroupMember.id == member.id)
        .options(selectinload(AgentGroupMember.agent))
    )
    member = r.scalar_one()
    return _member_dict(member)


@router.delete("/{group_id}/members/{agent_id}")
async def remove_member(group_id: str, agent_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(AgentGroupMember)
        .where(AgentGroupMember.group_id == group_id, AgentGroupMember.agent_id == agent_id)
    )
    await db.commit()
    return {"ok": True}


@router.patch("/{group_id}/members/{agent_id}/role")
async def update_member_role(
    group_id: str, agent_id: str, data: dict, db: AsyncSession = Depends(get_db)
):
    r = await db.execute(
        select(AgentGroupMember)
        .where(AgentGroupMember.group_id == group_id, AgentGroupMember.agent_id == agent_id)
        .options(selectinload(AgentGroupMember.agent))
    )
    member = r.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Membro não encontrado")
    member.role = data.get("role", member.role)
    await db.commit()
    return _member_dict(member)


# ── Group Messages (inter-agent communication) ────────────────────────────────

@router.get("/{group_id}/messages")
async def get_group_messages(
    group_id: str, limit: int = 50, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AgentGroupMessage)
        .where(AgentGroupMessage.group_id == group_id)
        .options(selectinload(AgentGroupMessage.agent))
        .order_by(AgentGroupMessage.created_at.desc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return [_msg_dict(m) for m in reversed(messages)]


@router.post("/{group_id}/messages")
async def post_group_message(
    group_id: str, data: TaskPost, db: AsyncSession = Depends(get_db)
):
    """Post a task or message to the group (inter-agent communication)."""
    r = await db.execute(select(AgentGroup).where(AgentGroup.id == group_id))
    if not r.scalar_one_or_none():
        raise HTTPException(404, "Grupo não encontrado")

    msg = AgentGroupMessage(
        group_id=group_id,
        agent_id=data.from_agent_id,
        message_type=data.message_type,
        content=data.content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return {"ok": True, "id": str(msg.id)}
