import uuid
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    instructions: Mapped[str] = mapped_column(Text, default="")  # System prompt

    # WhatsApp group binding
    group_id: Mapped[str] = mapped_column(String(200), nullable=True, unique=True, index=True)
    group_name: Mapped[str] = mapped_column(String(200), nullable=True)

    # Behavior settings
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    reply_only_mentions: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[str] = mapped_column(String(10), default="pt-BR")

    # Context window tracking (for opencode account rotation)
    context_token_count: Mapped[int] = mapped_column(Integer, default=0)

    # Extra config as JSON
    config: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    mcps: Mapped[list["AgentMCP"]] = relationship("AgentMCP", back_populates="agent", cascade="all, delete-orphan")
    skills: Mapped[list["AgentSkill"]] = relationship("AgentSkill", back_populates="agent", cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship("Conversation", back_populates="agent", cascade="all, delete-orphan")
    knowledge_chunks: Mapped[list["KnowledgeChunk"]] = relationship("KnowledgeChunk", back_populates="agent", cascade="all, delete-orphan")


class AgentMCP(Base):
    """MCP (Model Context Protocol) server configuration per agent."""
    __tablename__ = "agent_mcps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    server_url: Mapped[str] = mapped_column(String(500), nullable=True)   # For remote HTTP MCP
    command: Mapped[str] = mapped_column(String(500), nullable=True)       # For local stdio MCP
    args: Mapped[list] = mapped_column(JSON, default=list)
    env: Mapped[dict] = mapped_column(JSON, default=dict)
    headers: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mcp_type: Mapped[str] = mapped_column(String(20), default="http")  # http | stdio

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="mcps")


class AgentSkill(Base):
    """Custom skill/capability assigned to an agent."""
    __tablename__ = "agent_skills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    skill_type: Mapped[str] = mapped_column(String(50), default="custom")  # custom | builtin
    # For builtin skills: lookup key. For custom: code/prompt template
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="skills")
