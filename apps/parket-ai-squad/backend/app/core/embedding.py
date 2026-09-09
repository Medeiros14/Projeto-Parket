"""
Embedding & Chunking Engine
============================
Uses local sentence-transformers for embedding generation (no API key needed).
Supports multiple chunking strategies.
"""

import re
from typing import Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

# Lazy-loaded model singleton
_model: Optional[SentenceTransformer] = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("loading_embedding_model", model=settings.EMBEDDING_MODEL)
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info("embedding_model_loaded")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts and return as list of float vectors."""
    if not texts:
        return []
    model = get_model()
    embeddings = model.encode(texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True)
    return embeddings.tolist()


def embed_single(text: str) -> list[float]:
    """Embed a single text."""
    return embed_texts([text])[0]


# ---- Chunking Strategies ----

def chunk_fixed(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    """Fixed-size chunking with overlap."""
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap

    return [c.strip() for c in chunks if c.strip()]


def chunk_by_paragraph(text: str, max_chars: int = 2000) -> list[str]:
    """Split by paragraphs, merging small ones up to max_chars."""
    paragraphs = re.split(r"\n{2,}", text.strip())
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 2 <= max_chars:
            current = (current + "\n\n" + para).strip() if current else para
        else:
            if current:
                chunks.append(current)
            if len(para) > max_chars:
                # Para is too big — split it
                chunks.extend(chunk_fixed(para, chunk_size=max_chars, overlap=100))
                current = ""
            else:
                current = para

    if current:
        chunks.append(current)

    return chunks


def chunk_by_sentence(text: str, max_chars: int = 1500) -> list[str]:
    """Split by sentences, grouping them to stay within max_chars."""
    # Simple sentence splitter
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    chunks = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) + 1 <= max_chars:
            current = (current + " " + sent).strip() if current else sent
        else:
            if current:
                chunks.append(current)
            current = sent

    if current:
        chunks.append(current)

    return chunks


def chunk_document(
    text: str,
    strategy: str = "paragraph",
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[str]:
    """Main chunking entry point."""
    if strategy == "fixed":
        return chunk_fixed(text, chunk_size=chunk_size, overlap=overlap)
    elif strategy == "sentence":
        return chunk_by_sentence(text, max_chars=chunk_size)
    else:
        return chunk_by_paragraph(text, max_chars=chunk_size)


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(vec_a)
    b = np.array(vec_b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))
