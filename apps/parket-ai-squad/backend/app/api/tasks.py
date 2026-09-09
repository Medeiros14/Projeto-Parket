"""
Scheduled Tasks API
"""
import uuid
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.task import ScheduledTask

router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    agent_id: uuid.UUID
    group_id: str
    title: str
    description: str = ""
    due_at: datetime
    action_type: str = "reminder"
    action_config: dict = {}
    recurrence: str = "none"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_at: Optional[datetime] = None
    status: Optional[str] = None
    action_type: Optional[str] = None
    action_config: Optional[dict] = None
    recurrence: Optional[str] = None


def _to_dict(t: ScheduledTask) -> dict:
    return {
        "id": str(t.id),
        "agent_id": str(t.agent_id),
        "group_id": t.group_id,
        "title": t.title,
        "description": t.description,
        "due_at": t.due_at.isoformat() if t.due_at else None,
        "status": t.status,
        "action_type": t.action_type,
        "action_config": t.action_config,
        "recurrence": t.recurrence,
        "sent_at": t.sent_at.isoformat() if t.sent_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/")
async def list_tasks(
    agent_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(ScheduledTask).order_by(ScheduledTask.due_at.asc())
    if agent_id:
        q = q.where(ScheduledTask.agent_id == agent_id)
    if status:
        q = q.where(ScheduledTask.status == status)
    result = await db.execute(q)
    return [_to_dict(t) for t in result.scalars().all()]


@router.post("/")
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = ScheduledTask(**data.model_dump())
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return _to_dict(task)


@router.patch("/{task_id}")
async def update_task(task_id: uuid.UUID, data: TaskUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    await db.commit()
    return _to_dict(task)


@router.delete("/{task_id}")
async def delete_task(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduledTask).where(ScheduledTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    await db.delete(task)
    await db.commit()
    return {"status": "deleted"}
