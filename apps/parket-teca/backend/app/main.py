"""Núcleo Teca — API FastAPI."""
import asyncio
import json
import logging
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .settings import settings
from .db import conn
from .introspect import build_graph
from . import ingest as ingest_mod
from . import chat as chat_mod
from . import claude_client
from . import insights as insights_mod
from . import persona as persona_mod
from . import graph_listener
from . import aprendizados as aprend_mod
from . import rows as rows_mod
from .embeddings import embed_one

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("teca")


WIKILINK_RE = re.compile(r"\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]")


def _slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "sem-titulo"


def _sync_note_to_graph(cur, note: dict):
    """Upsert note como node + reprocessa arestas wikilink."""
    node_id = f"note:{note['slug']}"
    body_preview = (note["conteudo_md"] or "")[:1500]
    vec = embed_one(f"{note['titulo']}\n\n{body_preview}")
    cur.execute("""
        INSERT INTO teca.nodes (id, kind, title, body, schema_name, setor, meta, embedding)
        VALUES (%s, 'note', %s, %s, NULL, 'notas', %s::jsonb, %s)
        ON CONFLICT (id) DO UPDATE
        SET title=EXCLUDED.title, body=EXCLUDED.body, meta=EXCLUDED.meta,
            embedding=EXCLUDED.embedding, updated_at=now()
    """, (node_id, note["titulo"], body_preview,
          json.dumps({"tags": note.get("tags") or []}), vec))

    # Remove edges wikilink antigas dessa nota
    cur.execute("DELETE FROM teca.edges WHERE src_id = %s AND kind = 'wikilink'", (node_id,))

    # Extrai [[targets]] do markdown
    targets = WIKILINK_RE.findall(note["conteudo_md"] or "")
    for raw in set(targets):
        target_slug = _slugify(raw)
        dst_id = f"note:{target_slug}"
        # Cria stub se a nota destino não existir (nó cinza no grafo até ser criada)
        cur.execute("""
            INSERT INTO teca.nodes (id, kind, title, body, schema_name, setor, meta, embedding)
            VALUES (%s, 'note', %s, '', NULL, 'notas', '{"stub":true}'::jsonb, NULL)
            ON CONFLICT (id) DO NOTHING
        """, (dst_id, raw))
        cur.execute("""
            INSERT INTO teca.edges (src_id, dst_id, kind, weight, meta)
            VALUES (%s, %s, 'wikilink', 1.0, '{}'::jsonb)
            ON CONFLICT (src_id, dst_id, kind) DO NOTHING
        """, (node_id, dst_id))


# ── Cache global do grafo (usado pelo endpoint + listener) ─────
_graph_cache: dict = {"ts": 0.0, "data": None}


def _invalidate_graph_cache(payload: dict):
    _graph_cache["ts"] = 0.0
    _graph_cache["data"] = None
    log.info("[teca] graph cache invalidado por NOTIFY: %s", payload)


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    task = asyncio.create_task(graph_listener.listen(_invalidate_graph_cache))
    log.info("[teca] listener asyncio iniciado")
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


app = FastAPI(title="Núcleo Teca Parket", version="0.3.0", lifespan=_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()] + ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            _ = cur.fetchone()
        return {"ok": True, "model": settings.claude_model}
    except Exception as e:
        return {"ok": False, "db_error": str(e)}


# ── Grafo do núcleo (world 3D) ─────────────────────────────────
@app.get("/api/graph")
def graph(fresh: bool = False):
    now = time.time()
    if not fresh and _graph_cache["data"] and now - _graph_cache["ts"] < 60:
        return _graph_cache["data"]
    data = build_graph()
    _graph_cache["ts"] = now
    _graph_cache["data"] = data
    return data


def _parse_table_id(node_id: str) -> tuple[str, str]:
    """`table:public.simulacao_projetos` → ('public', 'simulacao_projetos')."""
    if not node_id.startswith("table:"):
        raise HTTPException(400, "node_id não é uma tabela")
    ident = node_id[len("table:"):]
    if "." not in ident:
        raise HTTPException(400, "esperado schema.tabela")
    schema, table = ident.split(".", 1)
    return schema, table


@app.get("/api/graph/node/{node_id}/rows")
def graph_node_rows(node_id: str, q: str | None = None, limit: int = 50):
    schema, table = _parse_table_id(node_id)
    res = rows_mod.list_rows(schema, table, q=q, limit=limit)
    if res.get("error"):
        raise HTTPException(400, res["error"])
    return res


@app.get("/api/graph/node/{node_id}/rows/{pk_value}")
def graph_node_row_detail(node_id: str, pk_value: str):
    schema, table = _parse_table_id(node_id)
    res = rows_mod.get_row(schema, table, pk_value)
    if res.get("error"):
        raise HTTPException(404, res["error"])
    return res


@app.get("/api/graph/node/{node_id:path}")
def graph_node(node_id: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, kind, title, body, schema_name, setor, meta, embedding, updated_at FROM teca.nodes WHERE id = %s", (node_id,))
        n = cur.fetchone()
        if not n:
            raise HTTPException(404, "node não encontrado")

        # Conexões por edge (FK, wikilink, tag, ref)
        cur.execute("""
            SELECT e.kind, e.dst_id AS other_id, m.title AS other_title, m.setor AS other_setor
            FROM teca.edges e JOIN teca.nodes m ON m.id = e.dst_id
            WHERE e.src_id = %s
            UNION
            SELECT e.kind, e.src_id AS other_id, m.title AS other_title, m.setor AS other_setor
            FROM teca.edges e JOIN teca.nodes m ON m.id = e.src_id
            WHERE e.dst_id = %s
            LIMIT 40
        """, (node_id, node_id))
        rel = cur.fetchall()

        # Conexões semânticas (top-N por embedding cosine, excluindo já-relacionadas)
        related_semantic: list[dict] = []
        emb = n.get("embedding") if isinstance(n, dict) else None
        if emb is not None:
            already = {r["other_id"] for r in rel} | {node_id}
            cur.execute("""
                SELECT id, title, setor, kind,
                       1 - (embedding <=> %s::vector) AS score
                FROM teca.nodes
                WHERE embedding IS NOT NULL
                  AND id <> ALL(%s)
                ORDER BY embedding <=> %s::vector
                LIMIT 12
            """, (emb, list(already), emb))
            for r in cur.fetchall():
                if r["score"] >= 0.35:   # limiar mínimo pra não trazer ruído
                    related_semantic.append({
                        "other_id":    r["id"],
                        "other_title": r["title"],
                        "other_setor": r["setor"],
                        "other_kind":  r["kind"],
                        "score":       round(float(r["score"]), 3),
                    })

    # Remove embedding do node retornado (payload pesado)
    n.pop("embedding", None)
    return {"node": n, "related": rel, "related_semantic": related_semantic[:6]}


# ── Busca semântica ─────────────────────────────────────────────
@app.get("/api/search")
def search(q: str = Query(..., min_length=2), k: int = 10):
    hits = chat_mod.semantic_search(q, k=k)
    return {"query": q, "hits": hits}


# ── Busca por registros (linhas em tabelas-entidade) ───────────
@app.get("/api/search/rows")
def search_rows_api(q: str = Query(..., min_length=2), k: int = 5):
    return {"query": q, "hits": rows_mod.search_rows(q, limit_per=k)}


# ── Dossiê consolidado do cliente (agrega propostas + cards + msgs) ──
@app.get("/api/client/dossier")
def client_dossier_api(nome: str = Query(..., min_length=2), limit: int = 8):
    r = rows_mod.client_dossier(nome, limit=limit)
    if r.get("error"):
        raise HTTPException(400, r["error"])
    return r


# ── Chat ────────────────────────────────────────────────────────
class ChatIn(BaseModel):
    pergunta: str


@app.post("/api/chat")
async def api_chat(payload: ChatIn, x_user_email: str | None = Header(default=None)):
    t0 = time.time()
    persona = persona_mod.get_persona(x_user_email)
    try:
        res = await chat_mod.answer(payload.pergunta, usuario_email=x_user_email, persona=persona)
    except Exception as e:
        raise HTTPException(500, str(e))
    res["persona"] = persona
    latency = int((time.time() - t0) * 1000)
    # log
    try:
        with conn() as c, c.cursor() as cur:
            cur.execute("""
                INSERT INTO teca.consultas (usuario_email, pergunta, resposta, node_ids, modo, latency_ms)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (x_user_email, payload.pergunta, res["resposta"], res["context_nodes"], res["modo"], latency))
    except Exception:
        pass
    res["latency_ms"] = latency
    return res


@app.post("/api/chat/stream")
async def api_chat_stream(payload: ChatIn, x_user_email: str | None = Header(default=None)):
    """Loop com SQL real E streaming.
    Eventos SSE:
      - context   : nodes RAG + persona (uma vez, no início)
      - delta     : tokens da resposta atual (só o texto VISÍVEL — filtra <sql> em stream)
      - sql       : quando detecta <sql>, emite a query pra UI mostrar spinner
      - sql_result: resumo do resultado (linhas, erro se houver)
      - reset     : "vou refazer" — o texto do turno anterior era só raciocínio pra emitir SQL, UI deve limpar
      - done      : encerra
    """
    persona = persona_mod.get_persona(x_user_email)

    async def gen():
        hits = chat_mod.semantic_search(payload.pergunta, k=6)
        yield "event: context\ndata: " + json.dumps({
            "nodes": [h["id"] for h in hits],
            "persona": persona,
        }) + "\n\n"

        ctx = "\n\n".join([
            f"### [{h['id']}] {h['title']} (setor={h['setor']})\n{(h['body'] or '')[:900]}"
            for h in hits
        ]) or "(sem contexto)"
        persona_block = persona_mod.persona_prompt(persona)
        prompt = (
            f"## Persona\n{persona_block}\n\n"
            f"## Contexto recuperado (RAG)\n{ctx}\n\n"
            f"## Pergunta\n{payload.pergunta}\n\n"
            "Se precisar de dados do banco, emita <sql>SELECT …</sql> SEM texto antes."
        )
        convo: list[dict] = [{"role": "user", "content": prompt}]

        MAX_ITERS = 5
        for it in range(MAX_ITERS):
            text_acc = ""
            saw_sql_open = False   # já detectamos "<sql>"? paramos de emitir deltas
            visible_buf = ""       # buffer pra segurar deltas até termos certeza que não estão dentro de <sql>

            async for delta in claude_client.stream(
                convo, system_prompt=chat_mod.SYSTEM_BASE, max_tokens=2500,
            ):
                text_acc += delta

                if saw_sql_open:
                    # já estamos dentro de <sql>… — não emite nada, só acumula
                    continue

                # Detecta abertura de <sql> no acumulado; ao detectar, envia RESET pra UI
                # descartar o texto do turno (era só narração que precedia a query)
                low = text_acc.lower()
                idx = low.find("<sql")
                if idx != -1:
                    saw_sql_open = True
                    # emite reset — pede pra UI descartar o texto parcial deste turno
                    yield "event: reset\ndata: {}\n\n"
                    visible_buf = ""
                    continue

                # Não achou <sql> — emite delta bufferizado com segurança
                visible_buf += delta
                # segura o buffer se termina com prefixo suspeito de "<sq…"
                safe_len = len(visible_buf) - 4  # protege últimos 4 chars
                if safe_len > 0:
                    emit, visible_buf = visible_buf[:safe_len], visible_buf[safe_len:]
                    yield "event: delta\ndata: " + json.dumps({"t": emit}) + "\n\n"

            # Terminou o stream do turno.
            m = re.search(r"<sql>(.+?)</sql>", text_acc, re.DOTALL | re.IGNORECASE)
            if not m:
                # não pediu SQL — flusha o resto do buffer visível
                if visible_buf:
                    yield "event: delta\ndata: " + json.dumps({"t": visible_buf}) + "\n\n"
                convo.append({"role": "assistant", "content": text_acc})
                break

            # Pediu SQL: executa e realimenta o convo
            sql = m.group(1).strip()
            yield "event: sql\ndata: " + json.dumps({"sql": sql[:600]}) + "\n\n"
            result = chat_mod.run_sql(sql)
            yield "event: sql_result\ndata: " + json.dumps({
                "count": result.get("count", 0),
                "error": result.get("error"),
                "columns": result.get("columns", [])[:12],
            }) + "\n\n"

            convo.append({"role": "assistant", "content": text_acc})
            payload_txt = json.dumps(result, default=str, ensure_ascii=False)[:6000]
            allow_more = it < MAX_ITERS - 2
            followup = (
                f"Resultado da query ({result.get('count', 0)} linhas):\n{payload_txt}\n\n"
                + ("Se precisar de mais um SELECT, emita <sql>…</sql>. "
                   if allow_more else "Agora responda ao usuário SEM mais <sql>. ")
                + "Cite fontes RAG com [id] quando relevante."
            )
            convo.append({"role": "user", "content": followup})
            # próxima iteração continua o loop

        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


# ── Notas (second-brain) ────────────────────────────────────────
class NotaIn(BaseModel):
    slug: str
    titulo: str
    conteudo_md: str = ""
    tags: list[str] = []


@app.get("/api/notas")
def notas_list():
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, slug, titulo, tags, updated_at FROM teca.notas ORDER BY updated_at DESC")
        return cur.fetchall()


@app.get("/api/notas/{slug}")
def nota_get(slug: str):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM teca.notas WHERE slug = %s", (slug,))
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "nota não encontrada")
        return r


@app.put("/api/notas/{slug}")
def nota_upsert(slug: str, payload: NotaIn, x_user_email: str | None = Header(default=None)):
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            INSERT INTO teca.notas (slug, titulo, conteudo_md, tags, autor_email)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE
              SET titulo = EXCLUDED.titulo, conteudo_md = EXCLUDED.conteudo_md,
                  tags = EXCLUDED.tags, updated_at = now()
            RETURNING *
        """, (payload.slug, payload.titulo, payload.conteudo_md, payload.tags, x_user_email))
        note = cur.fetchone()
        _sync_note_to_graph(cur, note)
        return note


@app.get("/api/notas/{slug}/backlinks")
def nota_backlinks(slug: str):
    node_id = f"note:{slug}"
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            SELECT n.id, n.title, n.meta
            FROM teca.edges e
            JOIN teca.nodes n ON n.id = e.src_id
            WHERE e.dst_id = %s AND e.kind = 'wikilink'
            ORDER BY n.updated_at DESC
        """, (node_id,))
        return {"slug": slug, "backlinks": cur.fetchall()}


# ── Insights (pulsar) ───────────────────────────────────────────
@app.get("/api/insights")
def insights_list(limit: int = 50, setor: str | None = None, severidade: str | None = None):
    where = ["dismissed_at IS NULL"]
    args: list = []
    if setor:
        where.append("setor = %s")
        args.append(setor)
    if severidade:
        where.append("severidade = %s")
        args.append(severidade)
    with conn() as c, c.cursor() as cur:
        cur.execute(f"""
            SELECT * FROM teca.insights
            WHERE {' AND '.join(where)}
            ORDER BY
              CASE severidade WHEN 'crit' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END,
              created_at DESC
            LIMIT %s
        """, (*args, limit))
        return cur.fetchall()


class InsightIn(BaseModel):
    titulo: str
    corpo: str
    severidade: str = "info"               # info|warn|crit
    setor: str = "geral"
    slug: str | None = None                # opcional; sempre normalizado pro namespace eas:/manual:
    node_ids: list[str] = []
    payload: dict = {}


@app.post("/api/insights")
def insight_create(payload: InsightIn, x_user_email: str | None = Header(default=None)):
    if payload.severidade not in ("info", "warn", "crit"):
        raise HTTPException(400, "severidade deve ser info|warn|crit")
    base = payload.slug or re.sub(r"[^a-z0-9-]+", "-", payload.titulo.lower())[:60].strip("-")
    slug = base if base.startswith(("eas:", "manual:")) else f"eas:{base}"
    body = dict(payload.payload or {})
    if x_user_email:
        body.setdefault("autor", x_user_email)
    # slug não tem UNIQUE (histórico dismissado repete slug) — upsert manual no ativo
    with conn() as c, c.cursor() as cur:
        cur.execute("""
            UPDATE teca.insights
               SET titulo=%s, corpo=%s, severidade=%s, setor=%s,
                   node_ids=%s, payload=%s::jsonb
             WHERE slug=%s AND dismissed_at IS NULL
            RETURNING *
        """, (payload.titulo, payload.corpo, payload.severidade, payload.setor,
              payload.node_ids, json.dumps(body), slug))
        row = cur.fetchone()
        if row is None:
            cur.execute("""
                INSERT INTO teca.insights (slug, titulo, corpo, severidade, setor, node_ids, payload)
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING *
            """, (slug, payload.titulo, payload.corpo, payload.severidade,
                  payload.setor, payload.node_ids, json.dumps(body)))
            row = cur.fetchone()
        return row


@app.post("/api/insights/sweep")
def insights_sweep():
    return insights_mod.sweep()


@app.post("/api/insights/{insight_id}/dismiss")
def insights_dismiss(insight_id: str):
    ok = insights_mod.dismiss(insight_id)
    if not ok:
        raise HTTPException(404, "insight não encontrado ou já dispensado")
    return {"ok": True}


# ── Aprendizados (sessão por app) ───────────────────────────────
class AprendizadoIn(BaseModel):
    app: str
    categoria: str                         # erro|acerto|melhoria|automacao|padrao_repetitivo
    titulo: str
    descricao: str | None = None
    contexto: dict | None = None
    fonte: str = "user_report"
    prioridade: str = "media"
    tags: list[str] = []


class AprendizadoPatch(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    contexto: dict | None = None
    app: str | None = None
    categoria: str | None = None
    prioridade: str | None = None
    status: str | None = None
    tags: list[str] | None = None


@app.get("/api/aprendizados/apps")
def aprendizados_apps():
    return aprend_mod.list_apps()


@app.get("/api/aprendizados")
def aprendizados_list(app: str | None = None, categoria: str | None = None,
                       status: str | None = None, limit: int = 200):
    return aprend_mod.list_aprendizados(app=app, categoria=categoria, status=status, limit=limit)


@app.get("/api/aprendizados/history")
def aprendizados_history_early(app: str | None = None, limit: int = 100):
    return aprend_mod.history(app=app, limit=limit)


@app.get("/api/aprendizados/{aid}")
def aprendizados_get(aid: str):
    r = aprend_mod.get(aid)
    if not r:
        raise HTTPException(404, "aprendizado não encontrado")
    return r


@app.post("/api/aprendizados")
def aprendizados_create(payload: AprendizadoIn, x_user_email: str | None = Header(default=None)):
    try:
        return aprend_mod.create(
            app=payload.app, categoria=payload.categoria, titulo=payload.titulo,
            descricao=payload.descricao, contexto=payload.contexto, fonte=payload.fonte,
            prioridade=payload.prioridade, tags=payload.tags, autor_email=x_user_email,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.patch("/api/aprendizados/{aid}")
def aprendizados_update(aid: str, payload: AprendizadoPatch):
    try:
        patch = {k: v for k, v in payload.dict().items() if v is not None}
        r = aprend_mod.update(aid, patch)
        if not r:
            raise HTTPException(404, "aprendizado não encontrado")
        return r
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/api/aprendizados/{aid}")
def aprendizados_delete(aid: str):
    ok = aprend_mod.delete(aid)
    if not ok:
        raise HTTPException(404, "aprendizado não encontrado")
    return {"ok": True}


@app.post("/api/aprendizados/reindex")
def aprendizados_reindex():
    return aprend_mod.reindex_all()


@app.post("/api/aprendizados/sweep")
def aprendizados_sweep(horas: int = 6):
    return aprend_mod.sweep_from_consultas(horas=horas)


@app.post("/api/aprendizados/sweep-teca-v2")
def aprendizados_sweep_teca_v2(horas: int = 24):
    return aprend_mod.sweep_teca_v2(horas=horas)


@app.get("/api/aprendizados/{aid}/analysis-prompt")
def aprendizados_analysis_prompt(aid: str):
    r = aprend_mod.build_analysis_prompt(aid)
    if not r:
        raise HTTPException(404, "aprendizado não encontrado")
    return r


# ── Ingest (admin) ──────────────────────────────────────────────
@app.post("/api/ingest/tables")
def api_ingest_tables():
    return ingest_mod.ingest_tables()


@app.post("/api/ingest/docs")
def api_ingest_docs():
    dirs = [d.strip() for d in settings.docs_dirs.split(",") if d.strip()]
    return ingest_mod.ingest_all(settings.memory_dir, dirs)


@app.get("/api/ingest/status")
def ingest_status():
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT kind, COUNT(*) AS n FROM teca.nodes GROUP BY kind ORDER BY 1")
        by_kind = cur.fetchall()
        cur.execute("SELECT COUNT(*) AS n FROM teca.edges")
        edges = cur.fetchone()
    return {"by_kind": by_kind, "edges": edges}
