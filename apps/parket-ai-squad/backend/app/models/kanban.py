import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class KanbanBoard(Base):
    __tablename__ = "kanban_boards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    columns: Mapped[list["KanbanColumn"]] = relationship(
        "KanbanColumn", back_populates="board",
        cascade="all, delete-orphan",
        order_by="KanbanColumn.position"
    )


class KanbanColumn(Base):
    __tablename__ = "kanban_columns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    board_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("kanban_boards.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    position: Mapped[int] = mapped_column(Integer, default=0)
    wip_limit: Mapped[int] = mapped_column(Integer, default=0)  # 0 = no limit

    board: Mapped["KanbanBoard"] = relationship("KanbanBoard", back_populates="columns")
    cards: Mapped[list["KanbanCard"]] = relationship(
        "KanbanCard", back_populates="column",
        cascade="all, delete-orphan",
        order_by="KanbanCard.position"
    )


class KanbanCard(Base):
    __tablename__ = "kanban_cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    column_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("kanban_columns.id"), nullable=False)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(20), default="medium")  # low | medium | high | critical
    tags: Mapped[list] = mapped_column(JSON, default=list)
    assignee: Mapped[str] = mapped_column(String(200), nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    # Link to WhatsApp conversation if applicable
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)

    extra: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    column: Mapped["KanbanColumn"] = relationship("KanbanColumn", back_populates="cards")
