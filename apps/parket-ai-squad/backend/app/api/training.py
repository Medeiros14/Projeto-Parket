"""
Training Data Management API
==============================
Upload and manage knowledge base for each agent.
Supports PDF, DOCX, TXT, JSON, URLs.
"""

import uuid
from io import BytesIO
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
import structlog

from app.database import get_db
from app.models.knowledge import KnowledgeChunk
from app.models.agent import Agent
from app.core.embedding import chunk_document, embed_texts

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/training", tags=["training"])


async def extract_text_from_file(file: UploadFile) -> str:
    """Extract text content from uploaded file."""
    content = await file.read()
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    if ext == "pdf":
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(BytesIO(content))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            logger.error("pdf_extract_failed", error=str(e))
            raise HTTPException(status_code=422, detail=f"Failed to extract PDF: {e}")

    elif ext in ("docx", "doc"):
        try:
            from docx import Document
            doc = Document(BytesIO(content))
            return "\n\n".join(para.text for para in doc.paragraphs if para.text.strip())
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Failed to extract DOCX: {e}")

    elif ext == "json":
        import json
        try:
            data = json.loads(content)
            if isinstance(data, list):
                return "\n\n".join(str(item) for item in data)
            return json.dumps(data, indent=2, ensure_ascii=False)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Invalid JSON: {e}")

    else:
        # Plain text / markdown / csv
        try:
            return content.decode("utf-8")
        except Exception:
            return content.decode("latin-1")


async def ingest_text(
    db: AsyncSession,
    agent_id: uuid.UUID,
    text: str,
    source_name: str,
    source_type: str = "text",
    chunk_strategy: str = "paragraph",
    chunk_size: int = 1000,
):
    """Chunk, embed, and store text for an agent's knowledge base."""
    # Delete existing chunks from same source
    await db.execute(
        delete(KnowledgeChunk)
        .where(KnowledgeChunk.agent_id == agent_id)
        .where(KnowledgeChunk.source_name == source_name)
    )

    # Chunk the text
    chunks = chunk_document(text, strategy=chunk_strategy, chunk_size=chunk_size)
    if not chunks:
        return 0

    # Generate embeddings in batch
    embeddings = embed_texts(chunks)

    # Store in DB
    records = []
    for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
        record = KnowledgeChunk(
            agent_id=agent_id,
            source_name=source_name,
            source_type=source_type,
            chunk_index=i,
            total_chunks=len(chunks),
            content=chunk_text,
            embedding=embedding,
        )
        records.append(record)

    db.add_all(records)
    await db.commit()
    logger.info("knowledge_ingested", agent_id=str(agent_id), source=source_name, chunks=len(records))
    return len(records)


# ---- Endpoints ----

@router.get("/{agent_id}")
async def list_sources(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """List all knowledge sources for an agent (grouped by source)."""
    result = await db.execute(
        select(
            KnowledgeChunk.source_name,
            KnowledgeChunk.source_type,
            func.count(KnowledgeChunk.id).label("chunk_count"),
            func.min(KnowledgeChunk.created_at).label("created_at"),
        )
        .where(KnowledgeChunk.agent_id == agent_id)
        .group_by(KnowledgeChunk.source_name, KnowledgeChunk.source_type)
        .order_by(func.min(KnowledgeChunk.created_at).desc())
    )
    rows = result.fetchall()
    return [
        {
            "source_name": row.source_name,
            "source_type": row.source_type,
            "chunk_count": row.chunk_count,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.post("/{agent_id}/upload")
async def upload_training_file(
    agent_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    chunk_strategy: str = Form("paragraph"),
    chunk_size: int = Form(1000),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file (PDF/DOCX/TXT/JSON) as training data for an agent."""
    # Verify agent exists
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent not found")

    text = await extract_text_from_file(file)
    if not text.strip():
        raise HTTPException(status_code=422, detail="File is empty or could not be parsed")

    source_name = file.filename or "upload"
    count = await ingest_text(
        db=db,
        agent_id=agent_id,
        text=text,
        source_name=source_name,
        source_type=file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "text",
        chunk_strategy=chunk_strategy,
        chunk_size=chunk_size,
    )

    return {"status": "ingested", "source": source_name, "chunks": count}


@router.post("/{agent_id}/text")
async def add_training_text(
    agent_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Add plain text as training data."""
    text = body.get("text", "")
    source_name = body.get("source_name", "manual-input")
    chunk_strategy = body.get("chunk_strategy", "paragraph")
    chunk_size = body.get("chunk_size", 1000)

    if not text.strip():
        raise HTTPException(status_code=422, detail="Text is empty")

    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent not found")

    count = await ingest_text(
        db=db,
        agent_id=agent_id,
        text=text,
        source_name=source_name,
        source_type="text",
        chunk_strategy=chunk_strategy,
        chunk_size=chunk_size,
    )
    return {"status": "ingested", "source": source_name, "chunks": count}


@router.delete("/{agent_id}/source/{source_name:path}")
async def delete_source(
    agent_id: uuid.UUID,
    source_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete all chunks from a specific source."""
    await db.execute(
        delete(KnowledgeChunk)
        .where(KnowledgeChunk.agent_id == agent_id)
        .where(KnowledgeChunk.source_name == source_name)
    )
    await db.commit()
    return {"status": "deleted", "source": source_name}


@router.delete("/{agent_id}/all")
async def delete_all_knowledge(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete ALL knowledge for an agent."""
    await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.agent_id == agent_id))
    await db.commit()
    return {"status": "cleared"}
