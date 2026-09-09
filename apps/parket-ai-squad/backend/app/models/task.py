import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    group_id: Mapped[str] = mapped_column(String(200), nullable=False)  # WhatsApp group JID

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")

    due_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # pending | sent | cancelled | failed
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)

    # reminder | webhook
    action_type: Mapped[str] = mapped_column(String(30), default="reminder")

    # For webhook: {"url": "...", "method": "POST", "headers": {}, "body": "..."}
    action_config: Mapped[dict] = mapped_column(JSON, default=dict)

    # none | daily | weekly | monthly
    recurrence: Mapped[str] = mapped_column(String(20), default="none")

    sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent: Mapped["Agent"] = relationship("Agent", backref="scheduled_tasks")
