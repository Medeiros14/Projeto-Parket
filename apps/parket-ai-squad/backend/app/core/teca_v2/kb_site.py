"""
Knowledge base for parket.com.br — pgvector-backed retrieval.

Two responsibilities:
  1. `search(query, k=4)` — embeds query, runs cosine kNN over teca_v2_kb.
     Used by the Cortex tool `consultar_kb_site`.
  2. `ingest_chunks(rows)` — bulk insert. Used by the ingestion CLI.

Table schema (created by hand earlier):
  teca_v2_kb (id, source, title, content, embedding vector(384), meta, created_at)
"""
from __future__ import annotations

import logging
from typing import Any

from app.core.embedding import embed_texts, embed_single

logger = logging.getLogger(__name__)


def _get_sync_conn():
    """Synchronous pg connection — used in ingestion CLI. Uses psycopg 3."""
    import psycopg
    from app.config import settings
    url = settings.SYNC_DATABASE_URL
    # Strip SQLAlchemy driver suffix if present
    for prefix in ("postgresql+psycopg://", "postgresql+psycopg2://"):
        if url.startswith(prefix):
            url = "postgresql://" + url[len(prefix):]
    return psycopg.connect(url)


async def _get_async_conn():
    """Async connection for search path."""
    import asyncpg
    from app.config import settings
    url = settings.DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        url = "postgresql://" + url[len("postgresql+asyncpg://"):]
    elif url.startswith("postgresql+psycopg2://"):
        url = "postgresql://" + url[len("postgresql+psycopg2://"):]
    return await asyncpg.connect(url)


MIN_SIMILARITY = 0.35  # corta resultados ruim (JS noise, etc)


async def search(query: str, k: int = 4) -> list[dict]:
    """Return top-k chunks similar to the query. Filtra resultados com baixa similaridade."""
    q = (query or "").strip()
    if not q:
        return []
    try:
        emb = embed_single(q)
    except Exception as e:
        logger.warning("kb_site embed failed: %s", e)
        return []

    emb_str = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
    sql = """
        SELECT id::text, source, title, content,
               1 - (embedding <=> $1::vector) as similarity
        FROM teca_v2_kb
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
    """
    conn = None
    try:
        conn = await _get_async_conn()
        rows = await conn.fetch(sql, emb_str, k * 2)  # pega 2x e filtra
        out = []
        for r in rows:
            sim = float(r["similarity"])
            if sim < MIN_SIMILARITY:
                continue
            out.append({
                "source": r["source"], "title": r["title"],
                "content": r["content"][:800],
                "similarity": sim,
            })
            if len(out) >= k:
                break
        return out
    except Exception as e:
        logger.warning("kb_site search failed: %s", e)
        return []
    finally:
        if conn:
            await conn.close()


def ingest_chunks(rows: list[dict]) -> int:
    """
    Insert a batch of chunks. Each row: {source, title?, content, meta?}.
    Embeddings are computed in this call.
    Returns number of rows inserted.
    """
    if not rows:
        return 0
    texts = [r["content"] for r in rows]
    try:
        embs = embed_texts(texts)
    except Exception as e:
        logger.error("kb_site ingest embed failed: %s", e)
        return 0

    import json
    conn = _get_sync_conn()
    inserted = 0
    try:
        with conn.cursor() as cur:
            for r, emb in zip(rows, embs):
                emb_str = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
                cur.execute(
                    "INSERT INTO teca_v2_kb (source, title, content, embedding, meta) VALUES (%s, %s, %s, %s::vector, %s::jsonb)",
                    (r["source"], r.get("title"), r["content"], emb_str, json.dumps(r.get("meta") or {})),
                )
                inserted += 1
        conn.commit()
    finally:
        conn.close()
    return inserted


def wipe_source(source: str) -> int:
    """Delete all chunks from a specific source. Useful for re-ingestion."""
    conn = _get_sync_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM teca_v2_kb WHERE source = %s", (source,))
            n = cur.rowcount
        conn.commit()
    finally:
        conn.close()
    return n


def count_chunks() -> dict:
    conn = _get_sync_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT source, COUNT(*) FROM teca_v2_kb GROUP BY source ORDER BY 2 DESC")
            return {src: n for src, n in cur.fetchall()}
    finally:
        conn.close()
