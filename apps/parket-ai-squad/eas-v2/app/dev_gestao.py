"""Time Dev Gestão — agentes de suporte ao desenvolvimento do gestao.parket.works.

3 agentes por função + Team + workflow de auditoria diária:
- gestao_pm        → transforma pedidos em specs/briefings com critério de aceite
- gestao_arquiteto → briefings técnicos baseados na Knowledge (doc de arquitetura)
- gestao_qa        → smoke tests HTTP + logs + SELECTs read-only no schema gestao

Briefings persistem em agno.dev_briefings e são consumidos pelo Claude Code
via MCP (Fase 1 — executor humano-no-loop). Fase 2 (executor headless) só
com go explícito do Will.
"""

from __future__ import annotations

import copy
import json
import logging
import os
import re
import subprocess
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

import httpx
import psycopg
from agno.agent import Agent
from agno.team import Team
from agno.tools import tool
from agno.workflow import Step, Workflow
from agno.workflow.types import StepInput, StepOutput

from app.claude_oauth import ClaudeOAuth
from app.tools import _psql, log_atividade
from app.workflows import enviar_dm

log = logging.getLogger(__name__)

TZ = ZoneInfo("America/Sao_Paulo")
GESTAO_BASE = os.environ.get("GESTAO_BASE_URL", "https://gestao.parket.works")

# ---------------------------------------------------------------------------
# Briefings (agno.dev_briefings — mesmo banco do AgentOS)
# ---------------------------------------------------------------------------

_BRIEFING_TIPOS = {"feature", "fix", "refactor", "investigacao", "qa"}
_BRIEFING_STATUS = {"aberto", "em_execucao", "concluido", "descartado"}
_PRIORIDADES = {"alta", "media", "baixa"}


def _agno_conn() -> psycopg.Connection:
    dsn = os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
    return psycopg.connect(dsn, autocommit=True)


def ensure_briefings_table() -> None:
    with _agno_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS agno.dev_briefings (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              projeto text NOT NULL DEFAULT 'gestao',
              titulo text NOT NULL,
              tipo text NOT NULL DEFAULT 'feature',
              prioridade text NOT NULL DEFAULT 'media',
              status text NOT NULL DEFAULT 'aberto',
              conteudo text NOT NULL,
              autor text,
              created_at timestamptz DEFAULT now(),
              updated_at timestamptz DEFAULT now()
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS agno.dev_exec_runs (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              briefing_id uuid NOT NULL,
              container text NOT NULL,
              status text NOT NULL DEFAULT 'rodando',
              workspace text,
              custo jsonb,
              resumo text,
              started_at timestamptz DEFAULT now(),
              finished_at timestamptz
            )
            """
        )


@tool(name="briefing_salvar", show_result=False)
def briefing_salvar(
    titulo: str,
    conteudo: str,
    tipo: str = "feature",
    prioridade: str = "media",
    autor: str = "",
) -> dict:
    """Salva um briefing de desenvolvimento em agno.dev_briefings.

    O briefing é a entrega final do time: spec/diagnóstico pronto pra execução
    pelo Claude Code (via MCP). Escreva conteúdo COMPLETO e autocontido.

    Args:
        titulo: 1 linha, imperativo (ex: 'Adicionar retry no webhook Evolution').
        conteudo: markdown com contexto, arquivos afetados (paths), passos e
            critério de aceite. Deve ser executável sem acesso a esta conversa.
        tipo: feature | fix | refactor | investigacao | qa.
        prioridade: alta | media | baixa.
        autor: qual agente gerou (ex: 'gestao_pm').
    """
    tipo = tipo if tipo in _BRIEFING_TIPOS else "feature"
    prioridade = prioridade if prioridade in _PRIORIDADES else "media"
    if not (titulo or "").strip() or not (conteudo or "").strip():
        return {"ok": False, "error": "titulo e conteudo são obrigatórios"}
    try:
        with _agno_conn() as conn:
            row = conn.execute(
                "INSERT INTO agno.dev_briefings (titulo, tipo, prioridade, conteudo, autor) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id::text, created_at::text",
                (titulo.strip(), tipo, prioridade, conteudo, autor or None),
            ).fetchone()
        return {"ok": True, "id": row[0], "created_at": row[1]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:400]}


@tool(name="briefing_listar", show_result=False)
def briefing_listar(status: str = "aberto", limit: int = 20) -> dict:
    """Lista briefings de desenvolvimento (agno.dev_briefings).

    Args:
        status: aberto | em_execucao | concluido | descartado | todos.
        limit: máximo de rows (default 20, max 100).
    """
    lim = max(1, min(100, int(limit)))
    where = "TRUE" if status == "todos" else "status = %s"
    params: tuple = () if status == "todos" else (status if status in _BRIEFING_STATUS else "aberto",)
    try:
        with _agno_conn() as conn:
            rows = conn.execute(
                "SELECT id::text, titulo, tipo, prioridade, status, COALESCE(autor,''), "
                "created_at::text, LEFT(conteudo, 300) "
                f"FROM agno.dev_briefings WHERE {where} "
                f"ORDER BY created_at DESC LIMIT {lim}",
                params,
            ).fetchall()
        return {"ok": True, "count": len(rows), "briefings": [
            {"id": r[0], "titulo": r[1], "tipo": r[2], "prioridade": r[3],
             "status": r[4], "autor": r[5], "created_at": r[6], "resumo": r[7]}
            for r in rows
        ]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:400]}


@tool(name="briefing_obter", show_result=False)
def briefing_obter(briefing_id: str) -> dict:
    """Retorna um briefing completo (conteúdo integral) pelo id.

    Args:
        briefing_id: UUID retornado por briefing_listar/briefing_salvar.
    """
    try:
        with _agno_conn() as conn:
            r = conn.execute(
                "SELECT id::text, titulo, tipo, prioridade, status, COALESCE(autor,''), "
                "created_at::text, conteudo FROM agno.dev_briefings WHERE id = %s::uuid",
                (briefing_id,),
            ).fetchone()
        if not r:
            return {"ok": False, "error": "briefing não encontrado"}
        return {"ok": True, "id": r[0], "titulo": r[1], "tipo": r[2], "prioridade": r[3],
                "status": r[4], "autor": r[5], "created_at": r[6], "conteudo": r[7]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:400]}


@tool(name="briefing_atualizar_status", show_result=False)
def briefing_atualizar_status(briefing_id: str, status: str) -> dict:
    """Atualiza o status de um briefing.

    Args:
        briefing_id: UUID do briefing.
        status: aberto | em_execucao | concluido | descartado.
    """
    if status not in _BRIEFING_STATUS:
        return {"ok": False, "error": f"status inválido: {status}"}
    try:
        with _agno_conn() as conn:
            r = conn.execute(
                "UPDATE agno.dev_briefings SET status = %s, updated_at = now() "
                "WHERE id = %s::uuid RETURNING id::text",
                (status, briefing_id),
            ).fetchone()
        if not r:
            return {"ok": False, "error": "briefing não encontrado"}
        return {"ok": True, "id": r[0], "status": status}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:400]}


# ---------------------------------------------------------------------------
# Ferramentas de inspeção do gestao (QA / arquiteto)
# ---------------------------------------------------------------------------

_SQL_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do)\b", re.I
)


@tool(name="gestao_api_get", show_result=False)
def gestao_api_get(path: str) -> dict:
    """Faz GET na API do gestao.parket.works (somente leitura, smoke test).

    Args:
        path: caminho começando com /api/ (ex: '/api/health', '/api/projetos?limit=5').
    """
    path = (path or "").strip()
    if not path.startswith("/api/"):
        return {"ok": False, "error": "path deve começar com /api/"}
    try:
        with httpx.Client(timeout=20) as client:
            r = client.get(f"{GESTAO_BASE}{path}")
        return {"ok": r.status_code < 400, "status_code": r.status_code,
                "body": r.text[:4000]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:400]}


@tool(name="gestao_logs", show_result=False)
def gestao_logs(servico: str = "api", linhas: int = 60) -> dict:
    """Últimas linhas de log dos serviços do gestao (Docker Swarm).

    Args:
        servico: 'api' ou 'web'.
        linhas: quantas linhas (default 60, max 200).
    """
    import subprocess

    if servico not in {"api", "web"}:
        return {"ok": False, "error": "servico deve ser 'api' ou 'web'"}
    n = max(10, min(200, int(linhas)))
    try:
        cp = subprocess.run(
            ["docker", "service", "logs", "--raw", "--tail", str(n),
             f"parket-gestao_{servico}"],
            capture_output=True, text=True, timeout=30,
        )
        out = (cp.stdout or "") + (cp.stderr or "")
        return {"ok": cp.returncode == 0, "logs": out[-6000:]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:400]}


@tool(name="gestao_sql", show_result=False)
def gestao_sql(query: str, limit: int = 50) -> dict:
    """Roda um SELECT read-only no banco do gestao (schema gestao, parket-pg-local).

    Somente SELECT/WITH de UMA statement. Tabelas: gestao.projetos, gestao.itens,
    gestao.projeto_etapas, gestao.item_etapa_status, gestao.eventos,
    gestao.documentos, gestao.fotos, gestao.colunas_kanban, gestao.etapas_catalogo,
    view gestao.v_projeto_progresso.

    Args:
        query: SELECT ... (sem ponto-e-vírgula). LIMIT é aplicado automaticamente.
        limit: máximo de rows (default 50, max 200).
    """
    q = (query or "").strip().rstrip(";")
    if ";" in q:
        return {"ok": False, "error": "apenas 1 statement (sem ';')"}
    if not re.match(r"^(select|with)\b", q, re.I):
        return {"ok": False, "error": "apenas SELECT/WITH"}
    if _SQL_FORBIDDEN.search(q):
        return {"ok": False, "error": "query contém keyword de escrita — apenas leitura"}
    lim = max(1, min(200, int(limit)))
    if not re.search(r"\blimit\s+\d+\s*$", q, re.I):
        q = f"{q} LIMIT {lim}"

    cp = _psql(q)
    if cp.returncode != 0:
        return {"ok": False, "error": (cp.stderr or "").strip()[:400]}
    lines = cp.stdout.strip().splitlines()[:lim]
    return {"ok": True, "count": len(lines), "rows_pipe_separated": lines}


# ---------------------------------------------------------------------------
# Executor headless (Fase 2) — Claude Code em container sandbox
# ---------------------------------------------------------------------------
# Paths de HOST (o docker run fala com o daemon do host via socket):
#   /root/dev-exec/<id8>/       workspace do briefing (briefing.md, patch, result)
#   /root/dev-exec/claude-home  credenciais OAuth do executor (chain própria)
#   /root/parket-gestao         repo fonte, montado :ro (executor clona, nunca toca)

EXEC_IMAGE = os.environ.get("DEV_EXEC_IMAGE", "parket-dev-executor:latest")
EXEC_HOST_ROOT = "/root/dev-exec"
REPO_HOST = "/root/parket-gestao"


def _docker(args: list[str], input_text: str | None = None,
            timeout: int = 60) -> subprocess.CompletedProcess:
    return subprocess.run(["docker", *args], capture_output=True, text=True,
                          input=input_text, timeout=timeout)


def _ws_read(short: str, arquivo: str, max_bytes: int = 8000) -> str:
    cp = _docker(["run", "--rm", "--entrypoint", "sh",
                  "-v", f"{EXEC_HOST_ROOT}:/d", EXEC_IMAGE,
                  "-c", f"head -c {int(max_bytes)} /d/{short}/{arquivo} 2>/dev/null"])
    return cp.stdout if cp.returncode == 0 else ""


@tool(name="executar_briefing", show_result=False)
def executar_briefing(briefing_id: str) -> dict:
    """Dispara o executor headless (Claude Code) pra implementar um briefing.

    O executor roda em container ISOLADO (sem docker socket, user não-root,
    2GB/1.5 CPU), clona o repo do gestao e implementa o briefing. Ele NUNCA
    deploya: entrega mudancas.patch + RESULTADO.md no workspace pra revisão
    do Will. Execução demora minutos — acompanhe com executor_status.

    Args:
        briefing_id: UUID de um briefing com status aberto ou em_execucao.
    """
    try:
        with _agno_conn() as conn:
            b = conn.execute(
                "SELECT titulo, conteudo, status FROM agno.dev_briefings WHERE id = %s::uuid",
                (briefing_id,),
            ).fetchone()
            if not b:
                return {"ok": False, "error": "briefing não encontrado"}
            if b[2] not in {"aberto", "em_execucao"}:
                return {"ok": False, "error": f"briefing com status '{b[2]}' não é executável"}
            ativo = conn.execute(
                "SELECT container FROM agno.dev_exec_runs WHERE status = 'rodando' LIMIT 1"
            ).fetchone()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:400]}

    short = briefing_id[:8]
    container = f"dev-exec-{short}"

    # 1 execução por vez: os runs compartilham a chain OAuth do executor
    # (refresh token rotaciona — corrida entre 2 containers queima a conta).
    if ativo and ativo[0] != container:
        cp = _docker(["inspect", "--format", "{{.State.Running}}", ativo[0]])
        if cp.returncode == 0 and cp.stdout.strip() == "true":
            return {"ok": False, "error": f"já existe execução ativa ({ativo[0]}) — aguarde"}

    _docker(["rm", "-f", container])
    cp = _docker(["run", "-i", "--rm", "--entrypoint", "sh",
                  "-v", f"{EXEC_HOST_ROOT}:/d", EXEC_IMAGE,
                  "-c", f"mkdir -p /d/{short} && cat > /d/{short}/briefing.md"],
                 input_text=f"# {b[0]}\n\n{b[1]}")
    if cp.returncode != 0:
        return {"ok": False, "error": f"falha preparando workspace: {cp.stderr[:300]}"}

    modelo = os.environ.get("DEV_EXEC_MODEL",
                            os.environ.get("DEV_GESTAO_MODEL", "claude-fable-5"))
    cp = _docker([
        "run", "-d", "--name", container,
        "--memory", "2g", "--cpus", "1.5", "--pids-limit", "512",
        "-e", f"CLAUDE_MODEL={modelo}",
        "-v", f"{EXEC_HOST_ROOT}/{short}:/workspace",
        "-v", f"{REPO_HOST}:/repo:ro",
        "-v", f"{EXEC_HOST_ROOT}/claude-home:/home/exec/.claude",
        EXEC_IMAGE,
    ])
    if cp.returncode != 0:
        return {"ok": False, "error": f"falha iniciando executor: {cp.stderr[:300]}"}

    try:
        with _agno_conn() as conn:
            conn.execute(
                "UPDATE agno.dev_exec_runs SET status = 'substituido', finished_at = now() "
                "WHERE briefing_id = %s::uuid AND status = 'rodando'",
                (briefing_id,),
            )
            conn.execute(
                "INSERT INTO agno.dev_exec_runs (briefing_id, container, workspace) "
                "VALUES (%s::uuid, %s, %s)",
                (briefing_id, container, f"{EXEC_HOST_ROOT}/{short}"),
            )
            conn.execute(
                "UPDATE agno.dev_briefings SET status = 'em_execucao', updated_at = now() "
                "WHERE id = %s::uuid",
                (briefing_id,),
            )
    except Exception as exc:  # noqa: BLE001
        log.warning("dev-exec: falha registrando run: %s", exc)

    return {"ok": True, "container": container, "modelo": modelo,
            "workspace": f"{EXEC_HOST_ROOT}/{short}",
            "dica": "acompanhe com executor_status; resultado em mudancas.patch + RESULTADO.md"}


@tool(name="executor_status", show_result=False)
def executor_status(briefing_id: str) -> dict:
    """Status da execução headless de um briefing (container, custo, mudanças).

    Args:
        briefing_id: UUID do briefing disparado com executar_briefing.
    """
    short = briefing_id[:8]
    container = f"dev-exec-{short}"
    cp = _docker(["inspect", "--format",
                  "{{.State.Status}}|{{.State.ExitCode}}", container])
    rodando = cp.returncode == 0 and cp.stdout.strip().startswith("running")
    state = cp.stdout.strip() if cp.returncode == 0 else "container não existe (já finalizado?)"

    out: dict = {"ok": True, "container": container, "state": state, "rodando": rodando}
    out["status_txt"] = _ws_read(short, "status.txt", 500)

    if not rodando:
        out["mudancas_stat"] = _ws_read(short, "mudancas-stat.txt", 2000)
        raw = _ws_read(short, "result.json", 60000)
        custo = None
        if raw:
            try:
                r = json.loads(raw)
                custo = {k: r.get(k) for k in
                         ("total_cost_usd", "num_turns", "duration_ms", "usage")}
                out["custo"] = custo
                out["resultado_final"] = str(r.get("result") or "")[:1500]
                out["is_error"] = r.get("is_error", False)
            except Exception:  # noqa: BLE001
                out["result_json_raw"] = raw[:800]
        if not raw:
            out["stderr"] = _ws_read(short, "claude-stderr.log", 1500)
        try:
            with _agno_conn() as conn:
                fim = "concluido" if "exit=0" in out["status_txt"] else "falhou"
                conn.execute(
                    "UPDATE agno.dev_exec_runs SET status = %s, finished_at = now(), "
                    "custo = %s::jsonb, resumo = %s WHERE briefing_id = %s::uuid "
                    "AND status = 'rodando'",
                    (fim, json.dumps(custo) if custo else None,
                     (out.get("mudancas_stat") or "")[:1000], briefing_id),
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("dev-exec: falha atualizando run: %s", exc)

    return out


@tool(name="executor_diff", show_result=False)
def executor_diff(briefing_id: str) -> dict:
    """Retorna o patch (git diff) gerado pelo executor + o RESULTADO.md.

    Args:
        briefing_id: UUID do briefing executado.
    """
    short = briefing_id[:8]
    return {
        "ok": True,
        "resultado_md": _ws_read(short, "RESULTADO.md", 6000),
        "patch": _ws_read(short, "mudancas.patch", 14000),
        "workspace": f"{EXEC_HOST_ROOT}/{short}",
        "aplicar": f"cd {REPO_HOST} && git apply {EXEC_HOST_ROOT}/{short}/mudancas.patch",
    }


# ---------------------------------------------------------------------------
# Workflow: auditoria diária do gestao
# ---------------------------------------------------------------------------

def coletar_saude_gestao(step_input: StepInput) -> StepOutput:
    import subprocess

    dados: dict = {"data": datetime.now(TZ).strftime("%d/%m/%Y %H:%M")}

    try:
        with httpx.Client(timeout=15) as client:
            r = client.get(f"{GESTAO_BASE}/api/health")
        dados["health"] = {"status_code": r.status_code, "body": r.text[:200]}
    except Exception as exc:  # noqa: BLE001
        dados["health"] = {"error": str(exc)[:200]}

    servicos = {}
    for svc in ("parket-gestao_api", "parket-gestao_web"):
        try:
            cp = subprocess.run(
                ["docker", "service", "ps", svc, "--format",
                 "{{.CurrentState}} {{.Error}}", "--filter", "desired-state=running"],
                capture_output=True, text=True, timeout=15,
            )
            servicos[svc] = cp.stdout.strip()[:300] or cp.stderr.strip()[:300]
        except Exception as exc:  # noqa: BLE001
            servicos[svc] = f"erro: {exc}"
    dados["servicos"] = servicos

    try:
        cp = subprocess.run(
            ["docker", "service", "logs", "--raw", "--tail", "300", "parket-gestao_api"],
            capture_output=True, text=True, timeout=30,
        )
        todas = (cp.stdout or "").splitlines()
        erros = [l for l in todas if re.search(r"error|exception|traceback|failed", l, re.I)
                 and "GET /api/health" not in l]
        dados["erros_log_api"] = erros[-15:]
    except Exception as exc:  # noqa: BLE001
        dados["erros_log_api"] = [f"erro coletando logs: {exc}"]

    cp = _psql(
        "SELECT json_build_object("
        "'projetos_por_status', (SELECT COALESCE(json_object_agg(status, n), '{}'::json) FROM "
        "  (SELECT status, count(*) AS n FROM gestao.projetos GROUP BY status) s),"
        "'projetos_atualizados_24h', (SELECT count(*) FROM gestao.projetos WHERE updated_at > now() - interval '24 hours'),"
        "'eventos_24h', (SELECT count(*) FROM gestao.eventos WHERE created_at > now() - interval '24 hours'),"
        "'itens_total', (SELECT count(*) FROM gestao.itens)"
        ")"
    )
    if cp.returncode == 0 and cp.stdout.strip():
        try:
            dados["banco"] = json.loads(cp.stdout.strip().splitlines()[0])
        except Exception:  # noqa: BLE001
            dados["banco"] = {"raw": cp.stdout.strip()[:500]}
    else:
        dados["banco"] = {"error": (cp.stderr or "sem output").strip()[:300]}

    return StepOutput(content=json.dumps(dados, ensure_ascii=False))


def build_dev_gestao(db, knowledge=None, pre_hooks=None):
    """Retorna (agents, team, workflows) do Time Dev Gestão."""
    ensure_briefings_table()

    # Pedido do Will (10/07): Time Dev Gestão roda no fable-5 (não no Sonnet).
    model_id = os.environ.get("DEV_GESTAO_MODEL", "claude-fable-5")

    def _model(max_tokens: int = 8192) -> ClaudeOAuth:
        return ClaudeOAuth(id=model_id, max_tokens=max_tokens)

    # Fase 2: disparo do executor headless SEMPRE atrás de aprovação humana
    # (card Aprovar/Rejeitar no chat do gestao_pm).
    executar_briefing_hitl = copy.deepcopy(executar_briefing)
    executar_briefing_hitl.requires_confirmation = True

    base_ctx = (
        "Você faz parte do Time Dev Gestão, que dá suporte ao desenvolvimento do "
        "gestao.parket.works (gestão de projetos/obras da Parket — pisos de madeira). "
        "Fonte: /root/parket-gestao (FastAPI + React + schema Postgres 'gestao'). "
        "A arquitetura completa está na Knowledge ('Arquitetura gestao.parket.works') — "
        "SEMPRE consulte antes de afirmar como o sistema funciona. "
        "Responda em português. A entrega final do time são BRIEFINGS salvos via "
        "briefing_salvar: autocontidos, com paths de arquivo e critério de aceite, "
        "prontos pra execução pelo Claude Code (Will roda via MCP). "
        "O time NÃO edita código nem faz deploy — quem executa é o Claude Code."
    )

    gestao_pm = Agent(
        id="gestao_pm",
        name="Gestão PM",
        model=_model(),
        db=db,
        knowledge=knowledge,
        search_knowledge=True,
        pre_hooks=pre_hooks,
        tools=[briefing_salvar, briefing_listar, briefing_obter,
               briefing_atualizar_status, executar_briefing_hitl,
               executor_status, executor_diff, log_atividade],
        instructions=(
            f"{base_ctx}\n\n"
            "Você é o PM do time. Sua função: transformar pedidos vagos em specs "
            "estruturadas. Toda spec tem: contexto/problema, escopo (o que entra e o "
            "que NÃO entra), passos sugeridos, critério de aceite verificável e "
            "prioridade justificada. Faça no máximo 2-3 perguntas de esclarecimento "
            "quando o pedido for ambíguo; senão, proponha e marque premissas. "
            "Salve a spec final com briefing_salvar (tipo feature/fix, autor gestao_pm) "
            "e informe o id ao usuário. Gerencie o backlog com briefing_listar/"
            "briefing_atualizar_status quando pedido.\n"
            "EXECUÇÃO (Fase 2): quando pedirem pra executar um briefing, use "
            "executar_briefing (vai pausar pra aprovação humana — é o esperado). "
            "Depois acompanhe com executor_status e apresente executor_diff quando "
            "concluir. O executor entrega patch pra revisão; quem aplica e deploya "
            "é o Will. Nunca marque o briefing como concluido só porque o executor "
            "terminou — isso é papel do QA após validar."
        ),
        add_history_to_context=True,
        num_history_runs=6,
        markdown=True,
        telemetry=False,
    )

    gestao_arquiteto = Agent(
        id="gestao_arquiteto",
        name="Gestão Arquiteto",
        model=_model(),
        db=db,
        knowledge=knowledge,
        search_knowledge=True,
        pre_hooks=pre_hooks,
        tools=[gestao_sql, gestao_api_get, briefing_salvar, briefing_listar,
               briefing_obter],
        instructions=(
            f"{base_ctx}\n\n"
            "Você é o arquiteto do time. Sua função: análise técnica profunda — como "
            "implementar algo, impacto em tabelas/RPCs/endpoints, riscos e "
            "acoplamentos (o gestao depende do schema public do Space via trigger "
            "_on_contrato_assinado e da RPC gestao.projetar_de_proposta; Supabase "
            "Cloud pra whatsapp_messages; Evolution; OAuth Claude no copiloto). "
            "Use gestao_sql pra inspecionar dados reais e gestao_api_get pra conferir "
            "comportamento atual. Briefings técnicos (autor gestao_arquiteto) devem "
            "citar arquivos com path (ex: backend/app/main.py, sql/004_projetar_"
            "hierarquico.sql) e listar exatamente o que muda em cada um."
        ),
        add_history_to_context=True,
        num_history_runs=6,
        markdown=True,
        telemetry=False,
    )

    gestao_qa = Agent(
        id="gestao_qa",
        name="Gestão QA",
        model=_model(),
        db=db,
        knowledge=knowledge,
        search_knowledge=True,
        pre_hooks=pre_hooks,
        tools=[gestao_api_get, gestao_logs, gestao_sql, briefing_salvar,
               briefing_listar, briefing_obter, briefing_atualizar_status,
               executor_status, executor_diff],
        instructions=(
            f"{base_ctx}\n\n"
            "Você é o QA do time. Sua função: validar o gestao em produção — smoke "
            "tests com gestao_api_get (/api/health, /api/colunas, /api/projetos, "
            "/api/fiscal/equipe, /api/obras/equipes...), erros recentes com "
            "gestao_logs, consistência de dados com gestao_sql (ex: projetos sem "
            "itens, etapas órfãs, itens sem status). Ao validar um briefing "
            "executado, teste o critério de aceite e use briefing_atualizar_status "
            "(concluido se passou). Bugs encontrados viram briefing tipo fix com "
            "passos de reprodução (autor gestao_qa). Reporte SEMPRE com evidência "
            "(status HTTP, linha de log, row do banco) — nunca 'parece ok'."
        ),
        add_history_to_context=True,
        num_history_runs=6,
        markdown=True,
        telemetry=False,
    )

    time_dev_gestao = Team(
        id="time-dev-gestao",
        name="Time Dev Gestão",
        members=[gestao_pm, gestao_arquiteto, gestao_qa],
        model=_model(),
        db=db,
        instructions=(
            "Você coordena o Time Dev Gestão (desenvolvimento do gestao.parket.works). "
            "Responda em português. Roteamento: pedidos de funcionalidade/priorização/"
            "backlog → Gestão PM; dúvidas técnicas de implementação/impacto/arquitetura "
            "→ Gestão Arquiteto; verificação em produção/bugs/testes → Gestão QA. "
            "Pedidos grandes podem encadear PM → Arquiteto. A entrega final são "
            "briefings salvos (o Claude Code executa via MCP)."
        ),
        add_history_to_context=True,
        num_history_runs=6,
        markdown=True,
        telemetry=False,
    )

    diagnostico = Agent(
        id="diagnostico-gestao",
        name="Diagnóstico Gestão",
        model=_model(max_tokens=2048),
        instructions=(
            "Você recebe um JSON com a saúde do gestao.parket.works (health check, "
            "estado dos serviços Swarm, erros de log, contadores do banco). "
            "Escreva UMA mensagem de WhatsApp em português: auditoria diária. "
            "Formato WhatsApp: *negrito*, bullets com •. Sem cabeçalhos #. "
            "Estrutura: título '*🔍 Auditoria Gestão*' + data/hora; estado geral "
            "(✅ saudável / ⚠️ atenção / 🔴 problema); 3-5 bullets com os fatos "
            "(health, serviços, erros de log se houver, atividade no banco). "
            "Se houver erro, destaque com a linha de log. Máximo ~1000 caracteres. "
            "Responda SOMENTE com a mensagem final, sem preâmbulo."
        ),
        markdown=False,
        telemetry=False,
    )

    auditoria_gestao = Workflow(
        id="auditoria-gestao",
        name="Auditoria Diária do Gestão",
        description=(
            "Coleta saúde do gestao.parket.works (health, serviços Swarm, logs, "
            "banco), agente diagnostica e envia DM WhatsApp. Disparo por schedule."
        ),
        db=db,
        steps=[
            Step(name="coletar", executor=coletar_saude_gestao),
            Step(name="diagnosticar", agent=diagnostico),
            Step(name="enviar", executor=enviar_dm),
        ],
    )

    return (
        [gestao_pm, gestao_arquiteto, gestao_qa],
        time_dev_gestao,
        [auditoria_gestao],
    )
