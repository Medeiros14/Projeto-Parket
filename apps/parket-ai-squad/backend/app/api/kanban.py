"""
Kanban Board API
"""

import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.kanban import KanbanBoard, KanbanColumn, KanbanCard

router = APIRouter(prefix="/kanban", tags=["kanban"])


# ---- Schemas ----

class BoardCreate(BaseModel):
    name: str
    description: str = ""


class ColumnCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    position: int = 0
    wip_limit: int = 0


class CardCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    tags: list = []
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    agent_id: Optional[uuid.UUID] = None
    conversation_id: Optional[uuid.UUID] = None
    extra: dict = {}


class CardMove(BaseModel):
    column_id: uuid.UUID
    position: int


# ---- Boards ----

@router.get("/boards")
async def list_boards(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KanbanBoard)
        .options(
            selectinload(KanbanBoard.columns).selectinload(KanbanColumn.cards)
        )
        .where(KanbanBoard.is_active == True)
        .order_by(KanbanBoard.created_at)
    )
    boards = result.scalars().all()
    return [_board_to_dict(b) for b in boards]


@router.post("/boards")
async def create_board(data: BoardCreate, db: AsyncSession = Depends(get_db)):
    board = KanbanBoard(**data.model_dump())
    db.add(board)
    await db.flush()

    # Create default columns
    default_columns = [
        ("Backlog", "#94a3b8", 0),
        ("Em Progresso", "#f59e0b", 1),
        ("Em Revisão", "#8b5cf6", 2),
        ("Concluído", "#22c55e", 3),
    ]
    for name, color, pos in default_columns:
        col = KanbanColumn(board_id=board.id, name=name, color=color, position=pos)
        db.add(col)

    await db.commit()
    await db.refresh(board)
    return _board_to_dict(board)


@router.delete("/boards/{board_id}")
async def delete_board(board_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KanbanBoard).where(KanbanBoard.id == board_id))
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    await db.delete(board)
    await db.commit()
    return {"status": "deleted"}


# ---- Columns ----

@router.post("/boards/{board_id}/columns")
async def add_column(board_id: uuid.UUID, data: ColumnCreate, db: AsyncSession = Depends(get_db)):
    col = KanbanColumn(board_id=board_id, **data.model_dump())
    db.add(col)
    await db.commit()
    await db.refresh(col)
    return {"id": str(col.id), "name": col.name, "color": col.color, "position": col.position}


# ---- Cards ----

@router.post("/columns/{column_id}/cards")
async def create_card(column_id: uuid.UUID, data: CardCreate, db: AsyncSession = Depends(get_db)):
    card = KanbanCard(column_id=column_id, **data.model_dump())
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return _card_to_dict(card)


@router.patch("/cards/{card_id}")
async def update_card(card_id: uuid.UUID, data: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KanbanCard).where(KanbanCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    for field, value in data.items():
        if hasattr(card, field):
            setattr(card, field, value)
    await db.commit()
    return {"status": "updated"}


@router.patch("/cards/{card_id}/move")
async def move_card(card_id: uuid.UUID, data: CardMove, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KanbanCard).where(KanbanCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    card.column_id = data.column_id
    card.position = data.position
    await db.commit()
    return {"status": "moved"}


@router.delete("/cards/{card_id}")
async def delete_card(card_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KanbanCard).where(KanbanCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    await db.delete(card)
    await db.commit()
    return {"status": "deleted"}


# ---- Helpers ----

def _board_to_dict(b: KanbanBoard) -> dict:
    return {
        "id": str(b.id),
        "name": b.name,
        "description": b.description,
        "is_active": b.is_active,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "columns": sorted(
            [_column_to_dict(c) for c in (b.columns or [])],
            key=lambda c: c["position"]
        ),
    }


def _column_to_dict(c: KanbanColumn) -> dict:
    return {
        "id": str(c.id),
        "board_id": str(c.board_id),
        "name": c.name,
        "color": c.color,
        "position": c.position,
        "wip_limit": c.wip_limit,
        "cards": sorted(
            [_card_to_dict(card) for card in (c.cards or [])],
            key=lambda card: card["position"]
        ),
    }


def _card_to_dict(c: KanbanCard) -> dict:
    return {
        "id": str(c.id),
        "column_id": str(c.column_id),
        "agent_id": str(c.agent_id) if c.agent_id else None,
        "title": c.title,
        "description": c.description,
        "priority": c.priority,
        "tags": c.tags or [],
        "assignee": c.assignee,
        "due_date": c.due_date.isoformat() if c.due_date else None,
        "position": c.position,
        "conversation_id": str(c.conversation_id) if c.conversation_id else None,
        "extra": c.extra or {},
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }
