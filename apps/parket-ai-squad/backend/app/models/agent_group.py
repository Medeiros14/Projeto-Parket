"""
Agent Groups Model
==================
Groups of agents that can collaborate, share context, and send tasks between them.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AgentGroup(Base):
    __tablename__ = "agent_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    shared_context = Column(Text, nullable=True)  # Instructions shared by all agents in the group
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("AgentGroupMember", back_populates="group", cascade="all, delete-orphan")
    group_messages = relationship("AgentGroupMessage", back_populates="group", cascade="all, delete-orphan")


class AgentGroupMember(Base):
    __tablename__ = "agent_group_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("agent_groups.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="member")  # "lead" | "member" | "observer"
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("AgentGroup", back_populates="members")
    agent = relationship("Agent", backref="group_memberships")


class AgentGroupMessage(Base):
    """Inter-agent messages shared within a group."""
    __tablename__ = "agent_group_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("agent_groups.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    message_type = Column(String(50), default="output")  # "output" | "task" | "status" | "result"
    content = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)  # JSON metadata
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("AgentGroup", back_populates="group_messages")
    agent = relationship("Agent", backref="group_outputs")
