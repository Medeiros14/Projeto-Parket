"""Indexa docs (memórias, briefings, README) em teca.nodes com embeddings."""
import os
import re
from pathlib import Path
from .db import conn
from .embeddings import embed
from .introspect import build_graph, table_columns


def _chunk(text: str, max_chars: int = 1800) -> list[str]:
    """Chunking simples por parágrafo, agrupando até max_chars."""
    parts = re.split(r"\n{2,}", text.strip())
    out, buf = [], ""
    for p in parts:
        if len(buf) + len(p) + 2 > max_chars and buf:
            out.append(buf.strip())
            buf = p
        else:
            buf = (buf + "\n\n" + p) if buf else p
    if buf.strip():
        out.append(buf.strip())
    return out or [text[:max_chars]]


def _upsert_node(cur, node: dict):
    cur.execute("""
        INSERT INTO teca.nodes (id, kind, title, body, schema_name, setor, meta, embedding)
        VALUES (%(id)s, %(kind)s, %(title)s, %(body)s, %(schema_name)s, %(setor)s, %(meta)s::jsonb, %(embedding)s)
        ON CONFLICT (id) DO UPDATE
        SET title=EXCLUDED.title, body=EXCLUDED.body, meta=EXCLUDED.meta,
            setor=EXCLUDED.setor, embedding=EXCLUDED.embedding, updated_at=now()
    """, node)


def _upsert_edge(cur, src: str, dst: str, kind: str, weight: float = 1.0, meta: dict | None = None):
    import json
    cur.execute("""
        INSERT INTO teca.edges (src_id, dst_id, kind, weight, meta)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (src_id, dst_id, kind) DO UPDATE SET weight=EXCLUDED.weight
    """, (src, dst, kind, weight, json.dumps(meta or {})))


def _build_table_body(cur, schema: str, table: str, comment: str | None, rows: int, setor: str) -> str:
    """Body rico: comentário + setor + rows + colunas + até 3 sample rows.
    Isso é o que vai pro embedding — quanto mais concreto, melhor o RAG."""
    import json as _json
    parts: list[str] = [f"Tabela: {schema}.{table}", f"Setor: {setor}", f"Linhas aprox.: {rows}"]
    if comment:
        parts.append(f"Descrição: {comment}")

    try:
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            LIMIT 40
        """, (schema, table))
        cols = cur.fetchall()
        if cols:
            parts.append("Colunas:")
            parts.append(", ".join(f"{c['column_name']} ({c['data_type']})" for c in cols))
    except Exception:
        cols = []

    # Foreign tables (cloud_ro) reportam rows=-1 no reltuples; tenta sample igual.
    if (rows > 0 or rows == -1) and cols:
        try:
            preferred = [c["column_name"] for c in cols
                         if c["column_name"].lower() in
                         ("id","nome","name","titulo","title","slug","status","created_at","updated_at","email","descricao","description")]
            picked = preferred[:6] or [c["column_name"] for c in cols[:6]]
            picked_sql = ", ".join(f'"{p}"' for p in picked)
            cur.execute("SET LOCAL statement_timeout = '3s'")  # protege contra FDW lento
            cur.execute(f'SELECT {picked_sql} FROM "{schema}"."{table}" LIMIT 3')
            samples = cur.fetchall()
            cur.execute("SET LOCAL statement_timeout = 0")
            if samples:
                parts.append("Sample de rows:")
                for s in samples:
                    line = " | ".join(f"{k}={_shorten(v)}" for k, v in s.items())
                    parts.append(f"- {line}")
        except Exception:
            try:
                cur.execute("SET LOCAL statement_timeout = 0")
            except Exception:
                pass

    return "\n".join(parts)


def _shorten(v, maxlen: int = 60) -> str:
    if v is None:
        return "NULL"
    s = str(v)
    if len(s) > maxlen:
        return s[:maxlen] + "…"
    return s


def ingest_tables():
    """Cria nodes pra cada tabela + arestas FK.
    Body inclui colunas + sample rows → embeddings ficam MUITO mais precisos."""
    import json
    g = build_graph()
    with conn() as c, c.cursor() as cur:
        # Constrói bodies ricos primeiro (precisamos deles pra embedar)
        enriched = []
        for n in g["nodes"]:
            body = _build_table_body(
                cur,
                schema=n["schema"],
                table=n["title"],
                comment=n.get("comment"),
                rows=n["rows"] or 0,
                setor=n["setor"],
            )
            enriched.append({**n, "body": body})

        # Embed sobre title + body (título ancora, body enriquece)
        embed_texts = [f"{n['title']}\n\n{n['body']}" for n in enriched]
        vecs = embed(embed_texts) if embed_texts else []

        for n, v in zip(enriched, vecs):
            _upsert_node(cur, {
                "id": n["id"],
                "kind": "table",
                "title": n["title"],
                "body": n["body"],
                "schema_name": n["schema"],
                "setor": n["setor"],
                "meta": json.dumps({"rows": n["rows"]}),
                "embedding": v,
            })
        # edges
        for e in g["edges"]:
            _upsert_edge(cur, e["src"], e["dst"], "fk")
    return {"tables": len(g["nodes"]), "fks": len(g["edges"])}


def ingest_dir(base: str, kind: str, setor_default: str = "meta"):
    """Indexa arquivos .md/.txt de um diretório."""
    import json
    base_p = Path(base)
    if not base_p.exists():
        return {"skipped": True, "reason": f"{base} not found"}

    total = 0
    with conn() as c, c.cursor() as cur:
        for p in base_p.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix.lower() not in {".md", ".txt"}:
                continue
            if p.stat().st_size > 500_000:
                continue
            try:
                content = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            if not content.strip():
                continue

            rel = p.relative_to(base_p).as_posix()
            title = p.stem
            # Extrai title do frontmatter se existir
            m = re.search(r"^name:\s*(.+)$", content, re.MULTILINE)
            if m:
                title = m.group(1).strip()

            chunks = _chunk(content)
            vecs = embed([f"{title}\n\n{ch}" for ch in chunks])
            for i, (ch, v) in enumerate(zip(chunks, vecs)):
                nid = f"{kind}:{rel}#{i}"
                _upsert_node(cur, {
                    "id": nid,
                    "kind": kind,
                    "title": title if i == 0 else f"{title} (parte {i+1})",
                    "body": ch,
                    "schema_name": None,
                    "setor": setor_default,
                    "meta": json.dumps({"path": rel, "chunk": i}),
                    "embedding": v,
                })
                total += 1
    return {"kind": kind, "chunks_indexed": total}


def ingest_all(memory_dir: str, docs_dirs: list[str]):
    r1 = ingest_tables()
    r2 = ingest_dir(memory_dir, "memory", "meta")
    docs_stats = [ingest_dir(d, "doc", "docs") for d in docs_dirs]
    return {"tables": r1, "memory": r2, "docs": docs_stats}
