"""Reunião Semanal do Cronograma — gravação por projeto, transcrição
Whisper self-hosted, extração de resumo+tarefas via Claude, review e
publicação como tarefa no parket-chat (obra_tasks).

Fluxo:
  1) POST /api/reuniao/nova                  → cria gestao.reuniao_semanal
  2) POST /api/reuniao/{rid}/bloco           → abre bloco (status=gravando)
  3) POST /api/reuniao/bloco/{bid}/audio     → upload + Whisper + Claude
  4) GET  /api/reuniao/bloco/{bid}/review    → resumo + tarefas sugeridas
  5) PATCH /api/reuniao/tarefa/{tid}         → editar título/responsável/prazo
  6) POST /api/reuniao/tarefa/{tid}/aprovar  → POST no chat + marca approved
  7) POST /api/reuniao/tarefa/{tid}/descartar
  8) POST /api/reuniao/bloco/{bid}/encerrar-review

Storage: bucket `reuniao-audios` (público) no Supabase Cloud.
Whisper: parket-whisper_api:8080 (interno).
Chat: parket-chat_chat:3210 (interno) via bot user 000...aa0001.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import time
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Optional

import httpx
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from .db import conn

log = logging.getLogger("gestao.reuniao")

router = APIRouter(prefix="/api/reuniao", tags=["reuniao"])

# ── Config ────────────────────────────────────────────────────────
WHISPER_URL = os.environ.get("WHISPER_URL", "http://parket-whisper_api:8080")
CHAT_INTERNAL_URL = os.environ.get("CHAT_INTERNAL_URL", "http://parket-chat_chat:3000")
CHAT_INTERNAL_SECRET = os.environ.get("CHAT_INTERNAL_SECRET", "")
BUCKET_AUDIO = os.environ.get("REUNIAO_AUDIO_BUCKET", "reuniao-audios")

# Modelo Claude — usa mesmo default do resto do backend
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")
CLAUDE_MAX_TOKENS = 2048

# Timeouts generosos: Whisper de 10min de áudio pode levar até 90s em CPU
WHISPER_TIMEOUT = 180.0
CLAUDE_TIMEOUT = 90.0


# ── Modelos Pydantic ──────────────────────────────────────────────
class NovaReuniaoIn(BaseModel):
    data: Optional[str] = None                # ISO YYYY-MM-DD; default = hoje
    conduzido_por: Optional[str] = None       # email
    titulo: Optional[str] = None


class NovoBlocoIn(BaseModel):
    projeto_id: Optional[str] = None          # gestao.projetos.id (UUID)
    projeto_nome: str                          # snapshot obrigatório
    card_id: Optional[str] = None              # kanban_cards.id (pra chat)


class TarefaPatchIn(BaseModel):
    titulo: Optional[str] = None
    responsavel_user_id: Optional[str] = None
    responsavel_nome_falado: Optional[str] = None
    responsavel_email: Optional[str] = None
    prazo_data: Optional[str] = None           # ISO YYYY-MM-DD
    prazo_texto: Optional[str] = None
    tipo: Optional[str] = None


class TarefaAprovarIn(BaseModel):
    aprovador_email: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────
def _user_email(x_user_email: Optional[str]) -> Optional[str]:
    """Extrai email do header injetado pelo frontend (mesma convenção do resto)."""
    if not x_user_email:
        return None
    return x_user_email.strip().lower() or None


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except Exception:
        return None


def _row_uuid(r: dict, field: str) -> Optional[str]:
    v = r.get(field)
    return str(v) if v is not None else None


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/health")
def reuniao_health():
    """Ping do serviço + estado do Whisper."""
    out: dict = {"ok": True, "whisper": None, "chat": None}
    try:
        with httpx.Client(timeout=3.0) as h:
            r = h.get(f"{WHISPER_URL}/health")
            out["whisper"] = r.json() if r.status_code == 200 else {"error": r.text[:120]}
    except Exception as e:
        out["whisper"] = {"error": str(e)[:120]}
    try:
        with httpx.Client(timeout=3.0) as h:
            r = h.get(f"{CHAT_INTERNAL_URL}/api/health")
            out["chat"] = {"status": r.status_code}
    except Exception as e:
        out["chat"] = {"error": str(e)[:120]}
    return out


# ── Sessão de reunião ──────────────────────────────
@router.post("/nova")
def reuniao_nova(inp: NovaReuniaoIn, x_user_email: Optional[str] = Header(None)):
    data = _parse_date(inp.data) or date.today()
    user = _user_email(x_user_email) or inp.conduzido_por
    titulo = inp.titulo or f"Reunião de {data.strftime('%d/%m/%Y')}"
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            INSERT INTO gestao.reuniao_semanal (data, conduzido_por, titulo)
            VALUES (%s, %s, %s)
            RETURNING id, data, conduzido_por, titulo, status, created_at
            """,
            (data, user, titulo),
        )
        return cur.fetchone()


@router.get("/hoje")
def reuniao_hoje():
    """Reunião de hoje se existir; senão null. Pra o front decidir 'continuar' ou 'nova'."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT id, data, conduzido_por, titulo, status, created_at, encerrada_em
              FROM gestao.reuniao_semanal
             WHERE data = CURRENT_DATE AND status = 'em_andamento'
             ORDER BY created_at DESC LIMIT 1
            """
        )
        row = cur.fetchone()
        return row or {}


@router.get("/lista")
def reuniao_lista(limit: int = 30):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT * FROM gestao.v_reuniao_resumo
             ORDER BY data DESC, created_at DESC
             LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


# ── Rotas específicas antes de /{rid} pra não colidirem ────
@router.get("/users")
def chat_users_early(q: str = ""):
    """Lista usuários do parket pra autocomplete de responsável de tarefa."""
    path = "/api/internal/users"
    if q: path += "?q=" + q
    return _chat_proxy("GET", path, None)


@router.get("/projetos-cronograma")
def projetos_cronograma_lista():
    """Lista projetos ativos no cronograma. Front usa pra Pamela escolher o próximo."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT p.id::text AS id, p.card_id::text AS card_id,
                   p.cliente, p.numero_proposta, p.status, p.column_id,
                   p.gestor_email, p.updated_at,
                   ck.titulo AS coluna_titulo,
                   COALESCE(v.pct_completo, 0) AS pct_completo
              FROM gestao.projetos p
              LEFT JOIN gestao.colunas_kanban ck ON ck.id = p.column_id
              LEFT JOIN gestao.v_projeto_progresso v ON v.projeto_id = p.id
             WHERE p.status NOT IN ('cancelado', 'entregue')
             ORDER BY COALESCE(p.updated_at, p.created_at) DESC
             LIMIT 200
            """
        )
        return cur.fetchall()


# ── Kanban PDCA geral de tarefas de reunião ─────────
# Agrega TODAS as tarefas aprovadas das reuniões (todas as obras) num
# quadro Planejar → Executar → Verificar → Agir. A fase mora em
# meta.pdca da própria tarefa sugerida (default 'plan'); o status de
# conclusão (done) vem do chat via chat_task_id quando disponível.
# IMPORTANTE: registrada ANTES de /{rid} pra rota não ser engolida.
_PDCA_FASES = ("plan", "do", "check", "act")


@router.get("/tarefas-kanban")
def tarefas_kanban():
    """Lista tarefas aprovadas de todas as reuniões com obra + fase PDCA.

    O done do chat é buscado em lote: 1 chamada interna por card distinto
    (poucas obras têm tarefas de reunião). Falha do chat não derruba o
    kanban — cards ficam sem o campo chat_done."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT t.id, t.titulo, t.tipo,
                   t.responsavel_nome_falado, t.responsavel_user_id, t.responsavel_email,
                   t.prazo_texto, t.prazo_data,
                   t.chat_task_id, t.chat_thread_id,
                   COALESCE(t.meta->>'pdca', 'plan') AS pdca,
                   t.decidido_por, t.decidido_em, t.created_at,
                   t.meta,
                   b.id::text AS bloco_id,
                   b.resumo AS bloco_resumo,
                   b.projeto_id::text AS projeto_id,
                   b.projeto_nome_snapshot AS projeto_nome,
                   b.card_id_snapshot::text AS card_id,
                   r.data AS reuniao_data
              FROM gestao.reuniao_tarefa_sugerida t
              JOIN gestao.reuniao_bloco b ON b.id = t.bloco_id
              JOIN gestao.reuniao_semanal r ON r.id = b.reuniao_id
             WHERE t.status = 'approved'
             ORDER BY t.decidido_em DESC NULLS LAST, t.created_at DESC
            """
        )
        tarefas = cur.fetchall()

    # Enriquece com done/done_at do chat: consulta por card distinto
    done_map: dict[int, dict] = {}
    cards = sorted({t["card_id"] for t in tarefas if t["card_id"] and t["chat_task_id"]})
    if CHAT_INTERNAL_SECRET and cards:
        headers = {"X-Internal-Secret": CHAT_INTERNAL_SECRET}
        try:
            with httpx.Client(timeout=8.0) as h:
                for cid in cards:
                    r = h.get(f"{CHAT_INTERNAL_URL}/api/internal/obra/{cid}/tarefas", headers=headers)
                    if r.status_code == 200:
                        for tk in (r.json().get("tasks") or []):
                            done_map[tk["id"]] = {"done": bool(tk.get("done")), "done_at": tk.get("done_at")}
        except Exception as e:
            log.warning("tarefas-kanban: chat enrich falhou: %s", e)

    for t in tarefas:
        chat = done_map.get(t["chat_task_id"]) if t["chat_task_id"] else None
        t["chat_done"] = chat["done"] if chat else None
        t["chat_done_at"] = chat["done_at"] if chat else None
    return tarefas


@router.get("/{rid}")
def reuniao_detalhe(rid: str):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT * FROM gestao.v_reuniao_resumo WHERE id = %s",
            (rid,),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "reunião não encontrada")
        cur.execute(
            """
            SELECT b.id, b.projeto_id::text AS projeto_id, b.projeto_nome_snapshot,
                   b.card_id_snapshot::text AS card_id_snapshot,
                   b.audio_url, b.duracao_seg, b.status, b.erro_msg,
                   b.transcricao, b.resumo, b.meta,
                   b.created_at, b.encerrado_em, b.aprovado_em,
                   (SELECT COUNT(*) FROM gestao.reuniao_tarefa_sugerida t WHERE t.bloco_id = b.id) AS n_tarefas,
                   (SELECT COUNT(*) FROM gestao.reuniao_tarefa_sugerida t WHERE t.bloco_id = b.id AND t.status='approved') AS n_tarefas_aprovadas
              FROM gestao.reuniao_bloco b
             WHERE b.reuniao_id = %s
             ORDER BY b.created_at
            """,
            (rid,),
        )
        r["blocos"] = cur.fetchall()
        return r


@router.post("/{rid}/encerrar")
def reuniao_encerrar(rid: str):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE gestao.reuniao_semanal
               SET status = 'encerrada', encerrada_em = now()
             WHERE id = %s
            RETURNING id, status, encerrada_em
            """,
            (rid,),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "reunião não encontrada")
        return r


# ── Bloco de projeto ────────────────────────────────
@router.post("/{rid}/bloco")
def bloco_novo(rid: str, inp: NovoBlocoIn):
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM gestao.reuniao_semanal WHERE id = %s", (rid,))
        if not cur.fetchone():
            raise HTTPException(404, "reunião não encontrada")

        # Se projeto_id veio, resolve card_id se não foi mandado
        card_id = inp.card_id
        if inp.projeto_id and not card_id:
            cur.execute("SELECT card_id::text FROM gestao.projetos WHERE id = %s", (inp.projeto_id,))
            r = cur.fetchone()
            if r:
                card_id = r["card_id"]

        cur.execute(
            """
            INSERT INTO gestao.reuniao_bloco (
                reuniao_id, projeto_id, projeto_nome_snapshot, card_id_snapshot, status
            ) VALUES (%s, %s, %s, %s, 'gravando')
            RETURNING id, reuniao_id, projeto_id::text AS projeto_id,
                      projeto_nome_snapshot, card_id_snapshot::text AS card_id_snapshot,
                      status, created_at
            """,
            (rid, inp.projeto_id, inp.projeto_nome, card_id),
        )
        return cur.fetchone()


@router.post("/bloco/{bid}/audio")
async def bloco_upload_audio(bid: str, file: UploadFile = File(...), duracao_seg: int = Form(0)):
    """Upload de áudio, dispara Whisper e Claude síncrono. Retorna review completo.

    Timeouts generosos: pipeline pode levar até ~3min pra áudio de 10min.
    Ordem: 1) upload storage 2) update bloco status=processando 3) whisper 4) claude 5) grava tarefas 6) status=review
    """
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, reuniao_id, projeto_nome_snapshot, status FROM gestao.reuniao_bloco WHERE id = %s", (bid,))
        b = cur.fetchone()
    if not b:
        raise HTTPException(404, "bloco não encontrado")
    if b["status"] not in ("gravando", "erro"):
        raise HTTPException(409, f"bloco em status {b['status']} — não aceita novo áudio")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "áudio vazio")
    if len(audio_bytes) > 100 * 1024 * 1024:
        raise HTTPException(413, "áudio > 100MB — 10min de webm cabe em 15MB")

    fname = file.filename or "audio.webm"
    ext = fname[fname.rfind("."):] if "." in fname else ".webm"
    storage_path = f"{b['reuniao_id']}/{bid}{ext}"
    content_type = file.content_type or "audio/webm"

    audio_url = _storage_upload(BUCKET_AUDIO, storage_path, audio_bytes, content_type)

    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE gestao.reuniao_bloco
               SET audio_url = %s, audio_bytes = %s, duracao_seg = %s,
                   status = 'processando', encerrado_em = now()
             WHERE id = %s
            """,
            (audio_url, len(audio_bytes), duracao_seg or None, bid),
        )

    try:
        t0 = time.time()
        w = _whisper_transcribe(audio_bytes, fname, content_type)
        whisper_ms = int((time.time() - t0) * 1000)
        transcricao = (w.get("text") or "").strip()
        if not transcricao:
            raise ValueError("Whisper devolveu texto vazio")

        t1 = time.time()
        ext_data = _claude_extract(b["projeto_nome_snapshot"], transcricao)
        claude_ms = int((time.time() - t1) * 1000)

        resumo = (ext_data.get("resumo") or "").strip()
        tarefas = ext_data.get("tarefas") or []
        alertas = ext_data.get("alertas_sugeridos") or []

        with conn() as c, c.cursor() as cur:
            cur.execute(
                """
                UPDATE gestao.reuniao_bloco
                   SET transcricao = %s, resumo = %s, status = 'review',
                       meta = COALESCE(meta, '{}'::jsonb) || %s::jsonb
                 WHERE id = %s
                """,
                (
                    transcricao, resumo,
                    json.dumps({
                        "whisper_ms": whisper_ms,
                        "claude_ms": claude_ms,
                        "whisper_lang": w.get("language"),
                        "whisper_duration": w.get("duration"),
                    }),
                    bid,
                ),
            )
            for i, t in enumerate(tarefas):
                titulo = (t.get("titulo") or "").strip()
                if not titulo:
                    continue
                cur.execute(
                    """
                    INSERT INTO gestao.reuniao_tarefa_sugerida (
                        bloco_id, ordem, titulo, titulo_original,
                        responsavel_nome_falado, prazo_texto, prazo_data, tipo
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        bid, i, titulo, titulo,
                        (t.get("responsavel") or "").strip() or None,
                        (t.get("prazo_texto") or "").strip() or None,
                        _resolver_prazo(t.get("prazo_texto")),
                        (t.get("tipo") or "livre").strip().lower(),
                    ),
                )
            for i, a in enumerate(alertas):
                descricao = (a.get("descricao") or "").strip()
                if not descricao:
                    continue
                grav = (a.get("gravidade") or "media").strip().lower()
                if grav not in ("leve", "media", "grave"):
                    grav = "media"
                cur.execute(
                    """
                    INSERT INTO gestao.reuniao_alerta_sugerido (
                        bloco_id, ordem, descricao, descricao_original, evidencia, gravidade
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        bid, i, descricao, descricao,
                        (a.get("evidencia") or "").strip() or None,
                        grav,
                    ),
                )
        return bloco_review(bid)

    except Exception as e:
        log.exception("bloco %s pipeline falhou", bid)
        with conn() as c, c.cursor() as cur:
            cur.execute(
                "UPDATE gestao.reuniao_bloco SET status='erro', erro_msg=%s WHERE id=%s",
                (str(e)[:800], bid),
            )
        raise HTTPException(500, f"pipeline falhou: {e}")


@router.get("/bloco/{bid}/review")
def bloco_review(bid: str):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT id, reuniao_id, projeto_id::text AS projeto_id,
                   projeto_nome_snapshot, card_id_snapshot::text AS card_id_snapshot,
                   audio_url, duracao_seg, transcricao, resumo,
                   status, erro_msg, meta,
                   created_at, encerrado_em, aprovado_em
              FROM gestao.reuniao_bloco WHERE id = %s
            """,
            (bid,),
        )
        b = cur.fetchone()
        if not b:
            raise HTTPException(404, "bloco não encontrado")
        cur.execute(
            """
            SELECT id, ordem, titulo, titulo_original,
                   responsavel_user_id, responsavel_nome_falado, responsavel_email,
                   prazo_texto, prazo_data, tipo, status, chat_task_id, decidido_em
              FROM gestao.reuniao_tarefa_sugerida
             WHERE bloco_id = %s ORDER BY ordem
            """,
            (bid,),
        )
        b["tarefas"] = cur.fetchall()
        cur.execute(
            """
            SELECT id, ordem, descricao, descricao_original, evidencia,
                   gravidade, status, crise_id::text AS crise_id, decidido_em
              FROM gestao.reuniao_alerta_sugerido
             WHERE bloco_id = %s ORDER BY ordem
            """,
            (bid,),
        )
        b["alertas"] = cur.fetchall()
        return b


@router.post("/bloco/{bid}/encerrar-review")
def bloco_encerrar_review(bid: str, x_user_email: Optional[str] = Header(None)):
    """Fecha o review do bloco. Bloco vira 'aprovado' se não tem mais pending."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS n FROM gestao.reuniao_tarefa_sugerida WHERE bloco_id=%s AND status='pending'",
            (bid,),
        )
        n = cur.fetchone()["n"]
        if n > 0:
            raise HTTPException(409, f"ainda tem {n} tarefas pending — decida antes de encerrar")
        cur.execute(
            """
            UPDATE gestao.reuniao_bloco
               SET status='aprovado', aprovado_em=now()
             WHERE id=%s
            RETURNING id, status, aprovado_em
            """,
            (bid,),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "bloco não encontrado")
        return r


# ── Tarefas ────────────────────────────────
@router.patch("/tarefa/{tid}")
def tarefa_patch(tid: str, inp: TarefaPatchIn):
    sets, args = [], []
    if inp.titulo is not None:
        sets.append("titulo = %s"); args.append(inp.titulo.strip())
        # Marca 'edited' SÓ quando ainda está pendente (fluxo de review).
        # Tarefa já aprovada continua approved — senão editar o título pelo
        # kanban PDCA a faria sumir do quadro (que filtra status='approved').
        sets.append("status = CASE WHEN status = 'pending' THEN 'edited' ELSE status END")
    if inp.responsavel_user_id is not None:
        sets.append("responsavel_user_id = %s"); args.append(inp.responsavel_user_id.strip() or None)
    if inp.responsavel_nome_falado is not None:
        sets.append("responsavel_nome_falado = %s"); args.append(inp.responsavel_nome_falado.strip() or None)
    if inp.responsavel_email is not None:
        sets.append("responsavel_email = %s"); args.append(inp.responsavel_email.strip() or None)
    if inp.prazo_data is not None:
        sets.append("prazo_data = %s"); args.append(_parse_date(inp.prazo_data))
    if inp.prazo_texto is not None:
        sets.append("prazo_texto = %s"); args.append(inp.prazo_texto.strip() or None)
    if inp.tipo is not None:
        sets.append("tipo = %s"); args.append(inp.tipo.strip().lower())
    if not sets:
        raise HTTPException(400, "nada pra atualizar")
    args.append(tid)
    with conn() as c, c.cursor() as cur:
        cur.execute(
            f"UPDATE gestao.reuniao_tarefa_sugerida SET {', '.join(sets)} WHERE id=%s RETURNING *",
            tuple(args),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "tarefa não encontrada")
        return r


@router.post("/tarefa/{tid}/aprovar")
def tarefa_aprovar(tid: str, inp: TarefaAprovarIn, x_user_email: Optional[str] = Header(None)):
    """Aprova a tarefa e POSTa no chat.parket.works na obra do card.

    Se não tem card_id_snapshot no bloco, ainda marca approved mas sem
    chat_task_id (front avisa que caiu órfão).
    """
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT t.*, b.card_id_snapshot::text AS card_id, b.projeto_nome_snapshot
              FROM gestao.reuniao_tarefa_sugerida t
              JOIN gestao.reuniao_bloco b ON b.id = t.bloco_id
             WHERE t.id = %s
            """,
            (tid,),
        )
        t = cur.fetchone()
        if not t:
            raise HTTPException(404, "tarefa não encontrada")
        if t["status"] == "approved":
            return t

        card_id = t["card_id"]
        # Sem card ligado o post no chat da obra é impossível — barrar antes de
        # marcar approved (senão a tarefa some no banco sem chegar no chat, foi
        # o que aconteceu com ESSENZA MOEMA/SM DISTRIBUIDORA 26/08 e Will
        # pediu que TODA tarefa aprovada apareça no grupo do projeto).
        if not card_id:
            raise HTTPException(
                409,
                "bloco sem card do projeto vinculado — abra o projeto no gestão "
                "e ligue o card antes de aprovar (senão a tarefa não posta no chat)",
            )
        chat_task_id = None
        chat_thread_id = None
        try:
            chat_task = _chat_post_task(
                card_id=card_id,
                title=t["titulo"],
                assignee_id=t.get("responsavel_user_id"),
                due_date=str(t["prazo_data"]) if t.get("prazo_data") else None,
                created_by_email=_user_email(x_user_email) or inp.aprovador_email,
            )
            chat_task_id = chat_task.get("id")
            chat_thread_id = chat_task.get("obra_thread_id")
        except Exception as e:
            log.warning("chat post tarefa %s falhou: %s", tid, e)
            raise HTTPException(502, f"chat.parket.works recusou: {e}")

        cur.execute(
            """
            UPDATE gestao.reuniao_tarefa_sugerida
               SET status = 'approved', chat_task_id = %s, chat_thread_id = %s,
                   decidido_por = %s, decidido_em = now()
             WHERE id = %s
             RETURNING *
            """,
            (chat_task_id, chat_thread_id, _user_email(x_user_email) or inp.aprovador_email, tid),
        )
        return cur.fetchone()


@router.post("/tarefa/{tid}/descartar")
def tarefa_descartar(tid: str, x_user_email: Optional[str] = Header(None)):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE gestao.reuniao_tarefa_sugerida
               SET status='discarded', decidido_por=%s, decidido_em=now()
             WHERE id=%s
             RETURNING *
            """,
            (_user_email(x_user_email), tid),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "tarefa não encontrada")
        return r


# ── Anexos + Análise IA (modelo do /crises) ─────────────────────────
def _fmt_bytes(n: Optional[int]) -> str:
    if not n:
        return ""
    if n < 1024:
        return f"{n}B"
    if n < 1024 * 1024:
        return f"{n // 1024}KB"
    return f"{n / (1024 * 1024):.1f}MB"


@router.post("/tarefa/{tid}/anexo")
async def tarefa_anexo_upload(tid: str, file: UploadFile = File(...)):
    """Upload de anexo (qualquer tipo) pra tarefa PDCA. Arquivo vai pro bucket
    `obra-media` do Supabase Cloud (mesmo bucket do /crises) e devolve
    {url, name, mime, size} pro front concatenar no comentário do chat."""
    import random
    import string
    from .main import (
        STORAGE_BUCKET,
        SUPABASE_URL,
        _storage_client,
    )

    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM gestao.reuniao_tarefa_sugerida WHERE id::text = %s", (tid,))
        if not cur.fetchone():
            raise HTTPException(404, "tarefa não encontrada")
    fname = file.filename or "arquivo"
    data = await file.read()
    if not data:
        raise HTTPException(400, "arquivo vazio")
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(400, "arquivo acima de 50MB")
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "bin"
    ext = "".join(ch for ch in ext if ch.isalnum())[:8] or "bin"
    safe_name = "".join(ch if ch.isalnum() or ch in "._- " else "_" for ch in fname)[:120]
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    path = f"tarefas/{tid}/{int(time.time() * 1000)}_{rand}.{ext}"
    mime = file.content_type or "application/octet-stream"
    with _storage_client() as st:
        r = st.post(
            f"/object/{STORAGE_BUCKET}/{path}",
            content=data,
            headers={"Content-Type": mime, "x-upsert": "true"},
        )
        if r.status_code >= 400:
            raise HTTPException(502, f"storage upload falhou: {r.text[:300]}")
    url = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
    anexo = {"url": url, "name": safe_name, "mime": mime, "size": len(data)}
    # guarda no meta.anexos pra listar no card mesmo depois que comentário rola
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE gestao.reuniao_tarefa_sugerida
               SET meta = jsonb_set(
                       coalesce(meta,'{}'::jsonb),
                       '{anexos}',
                       coalesce(meta->'anexos','[]'::jsonb) || %s::jsonb
                   )
             WHERE id::text = %s
            """,
            (json.dumps([anexo]), tid),
        )
    return anexo


@router.post("/tarefa/{tid}/analise-ia")
def tarefa_analise_ia(tid: str, force: bool = False):
    """Puxa a tarefa + resumo/transcricao do bloco + comentários do chat da
    tarefa e chama Claude pra devolver diagnóstico + 3 próximos passos. Grava
    em meta.analise_ia. Se já tem análise e force=false, devolve a última."""
    from .main import _anthropic_token

    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT t.*, b.resumo AS bloco_resumo, b.transcricao AS bloco_transc,
                   b.projeto_nome_snapshot AS projeto, b.card_id_snapshot::text AS card_id
              FROM gestao.reuniao_tarefa_sugerida t
              JOIN gestao.reuniao_bloco b ON b.id = t.bloco_id
             WHERE t.id::text = %s
            """,
            (tid,),
        )
        t = cur.fetchone()
        if not t:
            raise HTTPException(404, "tarefa não encontrada")

    meta = t.get("meta") or {}
    if not force and isinstance(meta, dict) and meta.get("analise_ia"):
        return meta["analise_ia"]

    # Comentários do chat da tarefa (best-effort)
    comentarios: list[dict] = []
    chat_task_id = t.get("chat_task_id")
    if chat_task_id and CHAT_INTERNAL_SECRET:
        try:
            with httpx.Client(timeout=8.0) as h:
                r = h.get(
                    f"{CHAT_INTERNAL_URL}/api/internal/tarefa/{chat_task_id}/comments",
                    headers={"X-Internal-Secret": CHAT_INTERNAL_SECRET},
                )
            if r.status_code < 400:
                payload = r.json() or {}
                # endpoint retorna {source_msg_id, comments: [...]} — extrai a lista
                comentarios = payload.get("comments") or [] if isinstance(payload, dict) else (payload or [])
        except Exception:
            log.warning("analise_ia_tarefa_chat_fail tid=%s", tid, exc_info=True)

    linhas_com = []
    for m in comentarios[-40:]:
        who = (m.get("sender_name") or m.get("author") or "??").strip()
        txt = (m.get("content") or m.get("texto") or "").strip().replace("\n", " ")
        if not txt:
            continue
        linhas_com.append(f"- {who}: {txt}")
    conversa = "\n".join(linhas_com) or "(sem comentários ainda)"

    transc = (t.get("bloco_transc") or "").strip()
    if len(transc) > 3000:
        transc = transc[:3000] + " … [truncado]"

    projeto = (t.get("projeto") or "obra sem nome").strip()
    titulo = (t.get("titulo") or "").strip()
    prazo = t.get("prazo_data")
    prazo_s = prazo.isoformat() if hasattr(prazo, "isoformat") else (str(prazo) if prazo else "não definido")

    system_prompt = """Você é analista sênior de operações da Parket (marcenaria e piso premium).
Sua função: dado uma tarefa que saiu da reunião semanal de cronograma, entregar
diagnóstico curto do estado dela + 3 próximos passos concretos.

REGRAS:
• Baseie-se estritamente no contexto (tarefa + resumo da reunião + transcrição + comentários).
• Se não tem comentário no chat ainda, diga "sem tratativas registradas" no diagnóstico.
• Passos devem ser AÇÕES executáveis com dono aproximado e prazo.
• Sem floreio, sem "vamos ver". Vai direto ao ponto.
• Se detectar risco (cliente reclamando, prazo vencido, falta de material), a primeira sugestão endereça isso.

DIAGNÓSTICO: 2-3 bullets curtos (máx 20 palavras cada).
PROXIMOS_PASSOS: 3 objetos com titulo, quem, prazo_sugerido, detalhe."""

    user_prompt = f"""TAREFA:
Obra: {projeto}
Título: {titulo}
Prazo: {prazo_s}

RESUMO DA REUNIÃO DE ORIGEM:
{(t.get('bloco_resumo') or '').strip() or '(vazio)'}

TRANSCRIÇÃO PARCIAL DA REUNIÃO:
{transc or '(vazia)'}

COMENTÁRIOS NA THREAD DA TAREFA NO CHAT:
{conversa}

Analise pela ferramenta analise_tarefa."""

    tool = {
        "name": "analise_tarefa",
        "description": "Diagnóstico curto da tarefa + 3 próximos passos.",
        "input_schema": {
            "type": "object",
            "properties": {
                "diagnostico": {"type": "string", "description": "2-3 bullets separados por \\n"},
                "proximos_passos": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 3,
                    "items": {
                        "type": "object",
                        "properties": {
                            "titulo": {"type": "string"},
                            "quem": {"type": "string"},
                            "prazo_sugerido": {"type": "string"},
                            "detalhe": {"type": "string"},
                        },
                        "required": ["titulo", "quem"],
                    },
                },
            },
            "required": ["diagnostico", "proximos_passos"],
        },
    }

    token = _anthropic_token()
    is_oauth = token.startswith("sk-ant-oat")
    headers = {"anthropic-version": "2023-06-01", "content-type": "application/json"}
    if is_oauth:
        headers["authorization"] = f"Bearer {token}"
        headers["anthropic-beta"] = "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14"
        headers["x-app"] = "cli"
        headers["user-agent"] = "claude-cli/2.1.81 (external, cli)"
        headers["anthropic-dangerous-direct-browser-access"] = "true"
    else:
        headers["x-api-key"] = token

    system_block = system_prompt
    if is_oauth:
        system_block = [
            {"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"},
            {"type": "text", "text": system_prompt},
        ]

    body = {
        "model": CLAUDE_MODEL,
        "max_tokens": CLAUDE_MAX_TOKENS,
        "system": system_block,
        "tools": [tool],
        "tool_choice": {"type": "tool", "name": "analise_tarefa"},
        "messages": [{"role": "user", "content": user_prompt}],
    }
    try:
        with httpx.Client(timeout=CLAUDE_TIMEOUT) as h:
            r = h.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        if r.status_code >= 400:
            log.warning("tarefa_analise_ia_fail status=%s body=%s", r.status_code, r.text[:400])
            raise HTTPException(502, f"claude HTTP {r.status_code}")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"claude indisponível: {e}")

    analise = None
    for block in data.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == "analise_tarefa":
            analise = block.get("input") or {}
            break
    if not analise:
        raise HTTPException(502, "claude não devolveu análise estruturada")

    # Formata texto amigável pra colar direto na UI
    linhas_out = ["Diagnóstico:"]
    linhas_out.append((analise.get("diagnostico") or "").strip())
    linhas_out.append("")
    linhas_out.append("Próximos passos:")
    for i, p in enumerate(analise.get("proximos_passos") or [], 1):
        titulo_p = (p.get("titulo") or "").strip()
        quem = (p.get("quem") or "").strip()
        prazo_p = (p.get("prazo_sugerido") or "").strip()
        detalhe = (p.get("detalhe") or "").strip()
        linhas_out.append(f"{i}. {titulo_p}")
        if quem or prazo_p:
            linhas_out.append(f"   → {quem}" + (f" · {prazo_p}" if prazo_p else ""))
        if detalhe:
            linhas_out.append(f"   • {detalhe}")
    texto = "\n".join(l for l in linhas_out if l is not None)

    resultado = {
        "texto": texto,
        "raw": analise,
        "conv_msgs": len(comentarios),
        "gerada_em": datetime.utcnow().isoformat() + "Z",
    }
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE gestao.reuniao_tarefa_sugerida
               SET meta = jsonb_set(coalesce(meta,'{}'::jsonb), '{analise_ia}', %s::jsonb)
             WHERE id::text = %s
            """,
            (json.dumps(resultado), tid),
        )
    return resultado


# ── Alertas de risco sugeridos ──────────────
class AlertaPatchIn(BaseModel):
    descricao: Optional[str] = None
    gravidade: Optional[str] = None
    evidencia: Optional[str] = None


@router.patch("/alerta/{aid}")
def alerta_patch(aid: str, inp: AlertaPatchIn):
    sets, args = [], []
    if inp.descricao is not None:
        sets.append("descricao = %s"); args.append(inp.descricao.strip())
        sets.append("status = 'edited'")
    if inp.gravidade is not None:
        g = inp.gravidade.strip().lower()
        if g not in ("leve", "media", "grave"):
            raise HTTPException(400, "gravidade inválida")
        sets.append("gravidade = %s"); args.append(g)
    if inp.evidencia is not None:
        sets.append("evidencia = %s"); args.append(inp.evidencia.strip() or None)
    if not sets:
        raise HTTPException(400, "nada pra atualizar")
    args.append(aid)
    with conn() as c, c.cursor() as cur:
        cur.execute(
            f"UPDATE gestao.reuniao_alerta_sugerido SET {', '.join(sets)} WHERE id=%s RETURNING *",
            tuple(args),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "alerta não encontrado")
        return r


@router.post("/alerta/{aid}/aprovar")
def alerta_aprovar(aid: str, x_user_email: Optional[str] = Header(None)):
    """Aprova o alerta e cria uma crise em gestao.crises com origem=projeto,
    prefill do card/projeto do bloco. Idempotente: se já aprovado, devolve
    o mesmo registro."""
    email = _user_email(x_user_email)
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            SELECT a.*, b.card_id_snapshot::text AS card_id,
                   b.projeto_id::text AS projeto_id,
                   b.projeto_nome_snapshot AS cliente
              FROM gestao.reuniao_alerta_sugerido a
              JOIN gestao.reuniao_bloco b ON b.id = a.bloco_id
             WHERE a.id = %s
            """,
            (aid,),
        )
        a = cur.fetchone()
        if not a:
            raise HTTPException(404, "alerta não encontrado")
        if a["status"] == "approved":
            return a

        cur.execute(
            """
            INSERT INTO gestao.crises (
                descricao, gravidade, origem, card_id, projeto_id, cliente,
                responsavel_email, responsavel_nome, coluna, criado_por
            ) VALUES (%s, %s, 'projeto', %s, %s, %s, %s, %s, 'entrada', %s)
            RETURNING id
            """,
            (
                a["descricao"],
                a["gravidade"],
                a["card_id"],
                a["projeto_id"],
                a["cliente"],
                email,
                None,
                email,
            ),
        )
        crise_id = cur.fetchone()["id"]

        cur.execute(
            """
            UPDATE gestao.reuniao_alerta_sugerido
               SET status='approved', crise_id=%s, decidido_por=%s, decidido_em=now()
             WHERE id=%s
             RETURNING *
            """,
            (crise_id, email, aid),
        )
        return cur.fetchone()


@router.post("/alerta/{aid}/descartar")
def alerta_descartar(aid: str, x_user_email: Optional[str] = Header(None)):
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE gestao.reuniao_alerta_sugerido
               SET status='discarded', decidido_por=%s, decidido_em=now()
             WHERE id=%s
             RETURNING *
            """,
            (_user_email(x_user_email), aid),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "alerta não encontrado")
        return r


@router.post("/bloco/{bid}/alerta")
def alerta_adicionar_manual(bid: str, inp: AlertaPatchIn):
    """Adiciona alerta manual no bloco (Pamela pode incluir no review)."""
    if not inp.descricao or not inp.descricao.strip():
        raise HTTPException(400, "descricao obrigatória")
    grav = (inp.gravidade or "media").strip().lower()
    if grav not in ("leve", "media", "grave"):
        grav = "media"
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM gestao.reuniao_bloco WHERE id=%s", (bid,))
        if not cur.fetchone():
            raise HTTPException(404, "bloco não encontrado")
        cur.execute("SELECT COALESCE(MAX(ordem), -1) + 1 AS ord FROM gestao.reuniao_alerta_sugerido WHERE bloco_id=%s", (bid,))
        ord_ = cur.fetchone()["ord"]
        cur.execute(
            """
            INSERT INTO gestao.reuniao_alerta_sugerido (
                bloco_id, ordem, descricao, descricao_original, evidencia, gravidade
            ) VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (bid, ord_, inp.descricao.strip(), inp.descricao.strip(),
             (inp.evidencia or "").strip() or None, grav),
        )
        return cur.fetchone()


@router.post("/bloco/{bid}/tarefa")
def tarefa_adicionar_manual(bid: str, inp: TarefaPatchIn):
    """Cria tarefa manual pendente no bloco (Pamela pode adicionar no review)."""
    with conn() as c, c.cursor() as cur:
        cur.execute("SELECT id FROM gestao.reuniao_bloco WHERE id=%s", (bid,))
        if not cur.fetchone():
            raise HTTPException(404, "bloco não encontrado")
        cur.execute("SELECT COALESCE(MAX(ordem), -1) + 1 AS ord FROM gestao.reuniao_tarefa_sugerida WHERE bloco_id=%s", (bid,))
        ord_ = cur.fetchone()["ord"]
        cur.execute(
            """
            INSERT INTO gestao.reuniao_tarefa_sugerida (
                bloco_id, ordem, titulo, titulo_original, responsavel_nome_falado,
                responsavel_user_id, responsavel_email, prazo_texto, prazo_data, tipo
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                bid, ord_, (inp.titulo or "").strip(), (inp.titulo or "").strip(),
                inp.responsavel_nome_falado, inp.responsavel_user_id, inp.responsavel_email,
                inp.prazo_texto, _parse_date(inp.prazo_data), (inp.tipo or "livre").lower(),
            ),
        )
        return cur.fetchone()


# ── Mover fase PDCA da tarefa ─────────
class PdcaIn(BaseModel):
    pdca: str                                  # plan|do|check|act


@router.patch("/tarefa/{tid}/pdca")
def tarefa_pdca(tid: str, inp: PdcaIn, x_user_email: Optional[str] = Header(None)):
    """Move a tarefa de fase no kanban PDCA (grava em meta.pdca)."""
    fase = (inp.pdca or "").strip().lower()
    if fase not in _PDCA_FASES:
        raise HTTPException(400, f"fase inválida: use {'/'.join(_PDCA_FASES)}")
    with conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE gestao.reuniao_tarefa_sugerida
               SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
                       'pdca', %s::text,
                       'pdca_movido_por', %s::text,
                       'pdca_movido_em', now()::text)
             WHERE id = %s
             RETURNING id, COALESCE(meta->>'pdca', 'plan') AS pdca
            """,
            (fase, _user_email(x_user_email), tid),
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "tarefa não encontrada")
        return r


# ── Proxy pro chat: tarefas do card no obra_tasks ─────────
@router.get("/card/{card_id}/tarefas")
def card_tarefas(card_id: str):
    """Proxy que consulta o parket-chat pelas tarefas da obra vinculada.
    Retorna {obra_thread_id, tasks[], open_count}. Sempre 200 (tasks=[] se n/a)."""
    if not CHAT_INTERNAL_SECRET:
        return {"obra_thread_id": None, "tasks": [], "open_count": 0, "error": "sem secret"}
    headers = {"X-Internal-Secret": CHAT_INTERNAL_SECRET}
    try:
        with httpx.Client(timeout=6.0) as h:
            r = h.get(f"{CHAT_INTERNAL_URL}/api/internal/obra/{card_id}/tarefas", headers=headers)
        if r.status_code >= 400:
            return {"obra_thread_id": None, "tasks": [], "open_count": 0, "error": r.text[:120]}
        return r.json()
    except Exception as e:
        return {"obra_thread_id": None, "tasks": [], "open_count": 0, "error": str(e)[:120]}


@router.post("/tarefa-chat/{task_id}/toggle")
def card_tarefa_toggle(task_id: int, x_user_email: Optional[str] = Header(None)):
    return _chat_proxy("POST", f"/api/internal/tarefa/{task_id}/toggle", {})


class ChatTaskPatchIn(BaseModel):
    title: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None


class ChatTaskManualIn(BaseModel):
    title: str
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None


class ChatTaskCommentIn(BaseModel):
    content: str
    sender_user_id: Optional[str] = None
    # anexos: [{url,name,mime,size}] — front upa via /tarefa/{tid}/anexo e
    # passa junto no comentário; a gente anexa markdown de imagem/link no
    # content antes de proxy pro chat (mesmo padrão das crises).
    anexos: list[dict] = []


class ChatReorderIn(BaseModel):
    ordered_ids: list[int]


@router.patch("/tarefa-chat/{task_id}")
def card_tarefa_patch(task_id: int, inp: ChatTaskPatchIn):
    body: dict = {}
    if inp.title is not None:      body["title"] = inp.title
    if inp.assignee_id is not None:body["assignee_id"] = inp.assignee_id or None
    if inp.due_date is not None:   body["due_date"] = inp.due_date or None
    if not body:
        raise HTTPException(400, "nada pra atualizar")
    return _chat_proxy("PATCH", f"/api/internal/tarefa/{task_id}", body)


@router.delete("/tarefa-chat/{task_id}")
def card_tarefa_delete(task_id: int):
    return _chat_proxy("DELETE", f"/api/internal/tarefa/{task_id}", None)


@router.post("/card/{card_id}/tarefa-manual")
def card_tarefa_manual(card_id: str, inp: ChatTaskManualIn, x_user_email: Optional[str] = Header(None)):
    """Cria tarefa direto no chat sem passar por bloco de reunião. Usado pelo
    botão '+ Nova tarefa' na aba Tarefas do card."""
    body = {
        "title": inp.title.strip(),
        "assignee_id": inp.assignee_id,
        "due_date": inp.due_date,
    }
    # Se veio email de quem tá criando, tenta resolver pra user_id via lookup
    if x_user_email:
        try:
            uid = _user_id_by_email(x_user_email)
            if uid:
                body["created_by_user_id"] = uid
        except Exception:
            pass
    return _chat_proxy("POST", f"/api/internal/obra/{card_id}/tarefa", body)


@router.get("/tarefa-chat/{task_id}/comments")
def card_tarefa_comments(task_id: int):
    return _chat_proxy("GET", f"/api/internal/tarefa/{task_id}/comments", None)


@router.post("/tarefa-chat/{task_id}/comment")
def card_tarefa_comment(task_id: int, inp: ChatTaskCommentIn, x_user_email: Optional[str] = Header(None)):
    texto = inp.content.strip()
    # Anexos viram markdown no fim do texto: imagem inline, resto vira link.
    if inp.anexos:
        linhas = []
        for a in inp.anexos:
            url = (a.get("url") or "").strip()
            nome = (a.get("name") or "arquivo").strip()
            mime = (a.get("mime") or "").lower()
            sz = _fmt_bytes(a.get("size"))
            if not url:
                continue
            if mime.startswith("image/"):
                linhas.append(f"![{nome}]({url})")
            else:
                rot = f"[{nome}{f' ({sz})' if sz else ''}]({url})"
                linhas.append(rot)
        if linhas:
            texto = (texto + "\n\n" + "\n".join(linhas)).strip()
    if not texto:
        raise HTTPException(400, "comentário vazio")
    body = {"content": texto}
    sender = inp.sender_user_id
    if not sender and x_user_email:
        try: sender = _user_id_by_email(x_user_email)
        except Exception: pass
    if sender: body["sender_user_id"] = sender
    return _chat_proxy("POST", f"/api/internal/tarefa/{task_id}/comment", body)


@router.post("/tarefas/reorder")
def card_tarefas_reorder(inp: ChatReorderIn):
    return _chat_proxy("POST", "/api/internal/tarefas/reorder", {"ordered_ids": inp.ordered_ids})


def _chat_proxy(method: str, path: str, body: Optional[dict]) -> Any:
    if not CHAT_INTERNAL_SECRET:
        raise HTTPException(500, "sem secret")
    headers = {"X-Internal-Secret": CHAT_INTERNAL_SECRET}
    if body is not None:
        headers["Content-Type"] = "application/json"
    url = f"{CHAT_INTERNAL_URL}{path}"
    with httpx.Client(timeout=8.0) as h:
        r = h.request(method, url, headers=headers, json=body if body is not None else None)
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text[:300])
    if not r.content:
        return {"ok": True}
    return r.json()


def _user_id_by_email(email: str) -> Optional[str]:
    """Lookup rápido em user_profiles pra resolver email -> user_id."""
    with conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT id::text AS id FROM public.user_profiles WHERE lower(email) = lower(%s) AND ativo = true LIMIT 1",
            (email.strip(),),
        )
        r = cur.fetchone()
        return r["id"] if r else None


# ── Whisper + Claude + Chat integrations ──────────────────

def _whisper_transcribe(audio_bytes: bytes, filename: str, content_type: str) -> dict:
    files = {"file": (filename, audio_bytes, content_type)}
    data = {
        "language": "pt",
        "beam_size": "5",
        "vad_filter": "true",
        "initial_prompt": "Reunião de obra da Parket. Marcenaria, piso, forro, cliente, fiscal.",
    }
    with httpx.Client(timeout=WHISPER_TIMEOUT) as h:
        r = h.post(f"{WHISPER_URL}/transcribe", files=files, data=data)
    if r.status_code >= 400:
        raise RuntimeError(f"whisper HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


def _claude_extract(projeto_nome: str, transcricao: str) -> dict:
    """Chama Claude com tool-use estruturado devolvendo resumo + tarefas.

    Prompt CONSERVADOR: só cria tarefa quando tem verbo de ação claro E
    responsável (implícito ou explícito) E intenção. 'Vamos ver' NÃO conta.
    """
    from .main import _anthropic_token  # late import pra evitar circular
    token = _anthropic_token()
    is_oauth = token.startswith("sk-ant-oat")

    headers = {"anthropic-version": "2023-06-01", "content-type": "application/json"}
    if is_oauth:
        headers["authorization"] = f"Bearer {token}"
        headers["anthropic-beta"] = "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14"
        headers["x-app"] = "cli"
        headers["user-agent"] = "claude-cli/2.1.81 (external, cli)"
        headers["anthropic-dangerous-direct-browser-access"] = "true"
    else:
        headers["x-api-key"] = token

    system_prompt = f"""Você processa transcrições de reunião semanal de OBRA da Parket (marcenaria e piso premium).

REGRAS DE OURO — sub-extraia em vez de super-extrair:
• Só crie TAREFA quando tem verbo de ação claro + intenção real + (idealmente) responsável.
• "Vamos ver isso", "temos que pensar", "não sei" → NÃO é tarefa. Ignore.
• Fofoca, conversa lateral, "obrigada", "tchau" → ignore.
• Dúvida honesta? Deixe de fora. Pamela adiciona no review se quiser.

FORMATO DE RESUMO: 3-5 bullets curtos (máximo 15 palavras cada), objetivos.
Foque em: o que foi decidido, pendências reais, marcos alcançados, riscos.

TAREFAS:
• titulo: imperativo curto ("Confirmar entrega do piso com fornecedor", NUNCA "Vamos confirmar...")
• responsavel: nome próprio falado ("Pamela", "Douglas", "Rafa") ou "não especificado"
• prazo_texto: literal do áudio ("sexta", "semana que vem", "até dia 20", "quando chegar o material") ou null
• tipo: prazo|bloqueio|followup|livre

ALERTAS DE RISCO — quando emitir:
Detecte pelo CONTEXTO da conversa, não por palavra-chave isolada. Emita alerta
quando a obra está em situação que precisa de atenção fora do fluxo normal.
Sinais típicos (avalie o contexto todo, não frase solta):
• Obra travada / parada há tempo, cliente sumido, arquiteto não libera algo crítico.
• Cliente ou arquiteto claramente insatisfeito ("está uma bagunça", "não aguento mais", "vou processar").
• Prazo estourando de forma preocupante (não apenas "atrasou 2 dias").
• Retrabalho grande, produto com defeito reincidente, fiscal apontando problema sério.
• Briga/atrito relevante entre equipe Parket e cliente/arquiteto/fiscal.
• Risco financeiro (cliente não pagou, cobrança escalando, ameaça de rescisão).

NÃO emita alerta pra:
• Pequeno atraso ou pendência normal — isso é tarefa, não crise.
• Reclamação leve resolvida na própria conversa.
• Preocupação genérica ("tô meio preocupada com esse").

Cada alerta:
• descricao: 1 frase objetiva do problema real ("Cliente ameaçou rescindir contrato por atraso da marcenaria").
• evidencia: trecho LITERAL da transcrição (~1-2 frases) que motivou o alerta.
• gravidade: leve|media|grave. Grave = risco de perder cliente/receita/imagem. Média = precisa atenção essa semana. Leve = só monitorar.

Se não houver sinal claro de crise, devolva alertas_sugeridos: [].

Projeto sendo discutido: {projeto_nome}
"""

    user_prompt = f"""Transcrição da reunião sobre o projeto acima:

{transcricao}

Extraia resumo + tarefas pela ferramenta processar_reuniao."""

    tool = {
        "name": "processar_reuniao",
        "description": "Estrutura resumo semanal + tarefas + alertas de risco de um bloco de reunião de obra.",
        "input_schema": {
            "type": "object",
            "properties": {
                "resumo": {"type": "string", "description": "3-5 bullets curtos separados por \\n"},
                "tarefas": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "titulo": {"type": "string"},
                            "responsavel": {"type": "string"},
                            "prazo_texto": {"type": ["string", "null"]},
                            "tipo": {"type": "string", "enum": ["prazo", "bloqueio", "followup", "livre"]},
                        },
                        "required": ["titulo", "tipo"],
                    },
                },
                "alertas_sugeridos": {
                    "type": "array",
                    "description": "Riscos/crises detectados pelo contexto. Vazio quando não há sinal claro.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "descricao": {"type": "string", "description": "1 frase objetiva do problema real"},
                            "evidencia": {"type": "string", "description": "trecho literal da transcrição que motivou o alerta"},
                            "gravidade": {"type": "string", "enum": ["leve", "media", "grave"]},
                        },
                        "required": ["descricao", "gravidade"],
                    },
                },
            },
            "required": ["resumo", "tarefas"],
        },
    }

    if is_oauth:
        system = [
            {"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"},
            {"type": "text", "text": system_prompt},
        ]
    else:
        system = system_prompt

    body = {
        "model": CLAUDE_MODEL,
        "max_tokens": CLAUDE_MAX_TOKENS,
        "system": system,
        "tools": [tool],
        "tool_choice": {"type": "tool", "name": "processar_reuniao"},
        "messages": [{"role": "user", "content": user_prompt}],
    }

    with httpx.Client(timeout=CLAUDE_TIMEOUT) as h:
        r = h.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
    if r.status_code >= 400:
        log.warning("claude extract fail status=%s body=%s", r.status_code, r.text[:400])
        raise RuntimeError(f"claude HTTP {r.status_code}")
    data = r.json()
    for block in data.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == "processar_reuniao":
            return block.get("input") or {}
    # Fallback: parse texto solto
    raise RuntimeError("Claude não devolveu tool_use processar_reuniao")


def _chat_post_task(
    card_id: str,
    title: str,
    assignee_id: Optional[str] = None,
    due_date: Optional[str] = None,
    created_by_email: Optional[str] = None,
) -> dict:
    """POST no endpoint interno do parket-chat.
    /api/internal/obra/:card_id/tarefa cria obra_thread se necessário,
    insere task, anuncia como bot no chat da obra e devolve o registro."""
    if not CHAT_INTERNAL_SECRET:
        raise RuntimeError("CHAT_INTERNAL_SECRET não configurado no gestao")
    headers = {
        "Content-Type": "application/json",
        "X-Internal-Secret": CHAT_INTERNAL_SECRET,
    }
    payload: dict = {"title": title}
    if assignee_id:
        payload["assignee_id"] = assignee_id
    if due_date:
        payload["due_date"] = due_date
    with httpx.Client(timeout=15.0) as h:
        r = h.post(
            f"{CHAT_INTERNAL_URL}/api/internal/obra/{card_id}/tarefa",
            headers=headers,
            json=payload,
        )
    if r.status_code >= 400:
        raise RuntimeError(f"chat HTTP {r.status_code}: {r.text[:200]}")
    return r.json()


def _storage_upload(bucket: str, path: str, content: bytes, content_type: str) -> str:
    """Copia lógica do main._upload_supabase_bucket sem import circular."""
    from .main import SUPABASE_URL, SUPABASE_KEY  # ambos são module-level
    if not SUPABASE_KEY:
        raise HTTPException(500, "SUPABASE_SERVICE_KEY não configurada")
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    hdrs = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    with httpx.Client(timeout=60.0) as cli:
        r = cli.put(url, content=content, headers=hdrs)
        # Supabase Storage devolve HTTP 400 com body {"code":"NoSuchBucket"} quando
        # o bucket não existe (não 404). Cria e tenta de novo.
        if r.status_code >= 400 and ("NoSuchBucket" in r.text or "Bucket not found" in r.text):
            cli.post(
                f"{SUPABASE_URL}/storage/v1/bucket",
                json={"id": bucket, "name": bucket, "public": True, "file_size_limit": 104857600},
                headers={"Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"},
            )
            r = cli.put(url, content=content, headers=hdrs)
        if r.status_code >= 400:
            raise HTTPException(500, f"upload {bucket}/{path} falhou: {r.text[:200]}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


# ── Resolver prazo relativo → data absoluta ────────
_MESES_PT = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
    "outubro": 10, "novembro": 11, "dezembro": 12,
}
_DIAS_SEMANA = {
    "segunda": 0, "terça": 1, "terca": 1, "quarta": 2, "quinta": 3,
    "sexta": 4, "sábado": 5, "sabado": 5, "domingo": 6,
}


def _resolver_prazo(prazo_texto: Optional[str], hoje: Optional[date] = None) -> Optional[date]:
    """Converte texto humano de prazo em data absoluta. Best-effort — retorna None se não entender."""
    if not prazo_texto:
        return None
    p = prazo_texto.lower().strip()
    hoje = hoje or date.today()

    if "hoje" in p:
        return hoje
    if "amanha" in p or "amanhã" in p:
        return hoje + timedelta(days=1)
    if "depois de amanha" in p or "depois de amanhã" in p:
        return hoje + timedelta(days=2)

    m = re.search(r"(\d+)\s*dias?", p)
    if m:
        return hoje + timedelta(days=int(m.group(1)))
    m = re.search(r"(\d+)\s*semanas?", p)
    if m:
        return hoje + timedelta(weeks=int(m.group(1)))

    if "semana que vem" in p or "proxima semana" in p or "próxima semana" in p:
        return hoje + timedelta(days=7 - hoje.weekday())  # segunda que vem
    if "essa semana" in p or "esta semana" in p:
        return hoje + timedelta(days=(4 - hoje.weekday()) % 7)  # sexta dessa semana

    for nome, wd in _DIAS_SEMANA.items():
        if nome in p:
            delta = (wd - hoje.weekday()) % 7
            return hoje + timedelta(days=delta or 7)

    # "dia 15", "até 20", "no dia 25/09"
    m = re.search(r"(?:dia\s+)?(\d{1,2})\s*(?:de\s+)?([a-zç]+)?", p)
    if m:
        dia = int(m.group(1))
        mes_txt = (m.group(2) or "")[:3]
        if 1 <= dia <= 31:
            if mes_txt and mes_txt in _MESES_PT:
                mes = _MESES_PT[mes_txt]
                ano = hoje.year + (1 if mes < hoje.month else 0)
                try:
                    return date(ano, mes, dia)
                except Exception:
                    return None
            # mesmo mês; se já passou, próximo
            for offset in range(0, 2):
                mes = ((hoje.month - 1 + offset) % 12) + 1
                ano = hoje.year + ((hoje.month - 1 + offset) // 12)
                try:
                    d = date(ano, mes, dia)
                    if d >= hoje:
                        return d
                except Exception:
                    pass
    return None
