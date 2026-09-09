"""Tools do AgentOS Parket — portadas do EAS antigo, sem app.config/structlog.

- `log_atividade`: registra em public.claude_atividades (Supabase principal).
- `catalogo_consultar` / `catalogo_editar_preco`: catálogo de preços no
  parket-pg-local (fonte de verdade — Space e Valoria leem via api.parket.works).
"""

from __future__ import annotations

import logging
import os
import re
import subprocess
from typing import Optional

import httpx
from agno.tools import tool

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# log_atividade
# ---------------------------------------------------------------------------

_VALID_CATEGORIES = {"fix", "feature", "config", "rollback", "data", "investigacao"}


@tool(name="log_atividade", show_result=False)
def log_atividade(
    titulo: str,
    descricao: str = "",
    setor: str = "Engenharia",
    categoria: str = "investigacao",
    tags: list[str] | None = None,
) -> dict:
    """Registra atividade em public.claude_atividades (visível pro time Parket).

    Args:
        titulo: 1 linha, com prefixo claro (ex: 'Fix:', 'Feat:').
        descricao: o que foi feito + por que + como verificar.
        setor: ex: 'Engenharia', 'Comercial', 'RH', etc.
        categoria: DEVE ser uma de: fix, feature, config, rollback, data, investigacao.
        tags: opcional, agrupa atividades correlatas.
    """
    if categoria not in _VALID_CATEGORIES:
        categoria = "investigacao"

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not supabase_url or not service_key:
        return {"ok": False, "error": "SUPABASE_URL/SUPABASE_SERVICE_KEY não configurados"}

    payload = {
        "titulo": titulo,
        "descricao": descricao,
        "setor": setor,
        "categoria": categoria,
        "criado_por": "eas",
    }
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    try:
        with httpx.Client(timeout=10) as client:
            r = client.post(f"{supabase_url}/rest/v1/claude_atividades", json=payload, headers=headers)
        ok = 200 <= r.status_code < 300
        log.info("atividade logged titulo=%s status=%s ok=%s", titulo, r.status_code, ok)
        return {"ok": ok, "status_code": r.status_code, "body": r.text[:300]}
    except Exception as exc:  # noqa: BLE001
        log.error("log_atividade failed: %s", exc)
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Catálogo (public.orcamento_tabela_precos no parket-pg-local)
# ---------------------------------------------------------------------------

PG_SERVICE = "parket-pg-local_postgres"


def _resolve_container() -> str | None:
    try:
        cp = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}", "--filter", f"name={PG_SERVICE}"],
            capture_output=True, text=True, timeout=5,
        )
        for name in cp.stdout.strip().splitlines():
            if name.startswith(PG_SERVICE):
                return name.strip()
    except Exception:  # noqa: BLE001
        return None
    return None


def _psql(sql: str, timeout: int = 30) -> subprocess.CompletedProcess:
    container = _resolve_container()
    if not container:
        return subprocess.CompletedProcess(
            args=[], returncode=1, stdout="",
            stderr=f"container do serviço {PG_SERVICE} não encontrado",
        )
    return subprocess.run(
        ["docker", "exec", "-i", container,
         "psql", "-U", "postgres", "-d", "postgres", "-tA", "-F", "|", "-c", sql],
        capture_output=True, text=True, timeout=timeout,
    )


def _safe_ilike(s: str) -> str:
    return s.replace("'", "''")


@tool(name="catalogo_consultar", show_result=False)
def catalogo_consultar(
    categoria: Optional[str] = None,
    especie_nome: Optional[str] = None,
    subtipo: Optional[str] = None,
    origem: Optional[str] = None,
    ativo_only: bool = True,
    limit: int = 40,
) -> dict:
    """Consulta o catálogo de preços (orcamento_tabela_precos).

    Args:
        categoria: filtro exato (ex: 'piso', 'forro', 'painel', 'porta', 'revestimento', 'marcenaria').
        especie_nome: filtro parcial ILIKE (ex: 'Carvalho', 'Ipê').
        subtipo: filtro exato (ex: 'regua', 'ripado', 'laca').
        origem: filtro exato (ex: 'nacional', 'importado').
        ativo_only: True (default) traz só produtos ativos.
        limit: máximo de rows (default 40, max 200).

    Retorna lista com id, categoria, subtipo, origem, especie_nome, dimensao_label, preco, ativo.
    """
    where = []
    if ativo_only:
        where.append("ativo = TRUE")
    if categoria:
        where.append(f"categoria = '{_safe_ilike(categoria)}'")
    if subtipo:
        where.append(f"subtipo = '{_safe_ilike(subtipo)}'")
    if origem:
        where.append(f"origem = '{_safe_ilike(origem)}'")
    if especie_nome:
        where.append(f"especie_nome ILIKE '%{_safe_ilike(especie_nome)}%'")
    where_sql = " AND ".join(where) or "TRUE"
    lim = max(1, min(200, int(limit)))

    sql = (
        "SELECT id::text, categoria, COALESCE(subtipo,'-') AS subtipo, "
        "COALESCE(origem,'-') AS origem, COALESCE(especie_nome,'-') AS especie_nome, "
        "COALESCE(dimensao_label,'-') AS dimensao_label, preco::text AS preco, ativo "
        f"FROM public.orcamento_tabela_precos WHERE {where_sql} "
        f"ORDER BY categoria, subtipo, especie_nome LIMIT {lim}"
    )

    cp = _psql(sql)
    if cp.returncode != 0:
        return {"ok": False, "error": (cp.stderr or "").strip()[:400]}

    rows = []
    for line in cp.stdout.strip().splitlines():
        parts = line.split("|")
        if len(parts) < 8:
            continue
        rows.append({
            "id": parts[0],
            "categoria": parts[1],
            "subtipo": parts[2],
            "origem": parts[3],
            "especie_nome": parts[4],
            "dimensao_label": parts[5],
            "preco": float(parts[6]) if parts[6] else 0.0,
            "ativo": parts[7].lower() == "t",
        })
    return {"ok": True, "count": len(rows), "rows": rows}


_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

# Regra do Will: orçamentista comum não edita dado mestre do catálogo.
_CATALOGO_ROLES_PERMITIDAS = {"superadmin", "admin", "dept_leader"}


def _lookup_user_role(email: str) -> tuple[str | None, str | None]:
    if not email:
        return (None, None)
    email_safe = email.replace("'", "''")
    sql = (
        "SELECT COALESCE(role,'') || '|' || COALESCE(full_name,'') "
        "FROM public.user_profiles "
        f"WHERE LOWER(email) = LOWER('{email_safe}') AND COALESCE(ativo, TRUE) LIMIT 1"
    )
    cp = _psql(sql)
    if cp.returncode != 0:
        return (None, None)
    line = cp.stdout.strip().splitlines()
    if not line:
        return (None, None)
    parts = line[0].split("|", 1)
    role = (parts[0] or None) if parts else None
    name = (parts[1] if len(parts) > 1 else None) or None
    return (role, name)


@tool(name="catalogo_editar_preco", show_result=False)
def catalogo_editar_preco(preco_id: str, novo_preco: float, motivo: str, user_email: str) -> dict:
    """Altera o preço de 1 linha do catálogo (orcamento_tabela_precos).

    RESTRITO: só superadmin, admin ou dept_leader (Raniere). Orçamentista comum
    NÃO pode editar catálogo — só a proposta em edição. Se o usuário atual não
    tem permissão, a tool RECUSA e devolve erro; nesse caso responda ao user
    dizendo pra pedir pra Raniere/admin.

    Args:
        preco_id: UUID da linha (retornado por catalogo_consultar).
        novo_preco: novo valor em R$ por m² (all-in).
        motivo: motivo curto, aparece no log claude_atividades.
        user_email: email do usuário logado (leia do `# Usuário atual` no contexto).

    Retorna row antes/depois. Loga em claude_atividades.
    """
    role, name = _lookup_user_role(user_email or "")
    if role not in _CATALOGO_ROLES_PERMITIDAS:
        return {
            "ok": False,
            "error": (
                f"Sem permissão. user={user_email} role={role or 'desconhecido'}. "
                "Editar catálogo é restrito a admin/superadmin/dept_leader (Raniere)."
            ),
        }
    if not _UUID_RE.match(preco_id or ""):
        return {"ok": False, "error": "preco_id não é UUID válido"}
    try:
        preco_val = float(novo_preco)
    except (TypeError, ValueError):
        return {"ok": False, "error": "novo_preco precisa ser numérico"}
    if preco_val < 0 or preco_val > 1_000_000:
        return {"ok": False, "error": f"novo_preco fora do range razoável: {preco_val}"}
    motivo = (motivo or "").strip()
    if not motivo:
        return {"ok": False, "error": "motivo é obrigatório (aparece no log)"}

    sql = f"""
        WITH before AS (
          SELECT id, categoria, especie_nome, dimensao_label, preco
          FROM public.orcamento_tabela_precos WHERE id = '{preco_id}'::uuid
        ),
        upd AS (
          UPDATE public.orcamento_tabela_precos
          SET preco = {preco_val}, updated_at = now()
          WHERE id = '{preco_id}'::uuid
          RETURNING id, preco AS preco_novo
        )
        SELECT
          COALESCE((SELECT categoria FROM before),'') AS categoria,
          COALESCE((SELECT especie_nome FROM before),'') AS especie,
          COALESCE((SELECT dimensao_label FROM before),'') AS dimensao,
          COALESCE((SELECT preco::text FROM before),'') AS preco_antes,
          COALESCE((SELECT preco_novo::text FROM upd),'') AS preco_depois;
    """
    cp = _psql(sql)
    if cp.returncode != 0:
        return {"ok": False, "error": (cp.stderr or "").strip()[:400]}
    line = cp.stdout.strip().splitlines()
    if not line:
        return {"ok": False, "error": "id não encontrado"}
    parts = line[0].split("|")
    if len(parts) < 5 or not parts[4]:
        return {"ok": False, "error": "id não encontrado (UPDATE não afetou linhas)"}
    result = {
        "ok": True,
        "categoria": parts[0],
        "especie": parts[1],
        "dimensao": parts[2],
        "preco_antes": float(parts[3]) if parts[3] else 0.0,
        "preco_depois": float(parts[4]) if parts[4] else 0.0,
    }

    try:
        log_atividade.entrypoint(
            titulo=f"Data: catálogo preço {result['categoria']} {result['especie']}".strip(),
            descricao=(
                f"{result['categoria']} · {result['especie']} · {result['dimensao']}: "
                f"R$ {result['preco_antes']:.2f} → R$ {result['preco_depois']:.2f}. "
                f"Motivo: {motivo} · Por: {name or user_email} ({role})"
            ),
            setor="Comercial",
            categoria="data",
            tags=["valoria", "catalogo", "preco"],
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("failed to log catalogo edit: %s", exc)

    return result
