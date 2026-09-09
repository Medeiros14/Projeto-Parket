"""Tools da Teca Valoria — portadas do EAS sem Agno.

Cada tool tem 2 partes:
1. SCHEMA JSON (compatível com Anthropic function-calling)
2. função Python que executa

O agent.py consome `TOOLS` (lista de schemas) e `dispatch(name, args)` (executor).
"""
from __future__ import annotations

import json
import re
import subprocess
from typing import Any, Optional

import httpx
import structlog

from app.settings import (
    PARKET_ANON_KEY,
    PARKET_API_URL,
    VALORIA_SUPABASE_KEY,
    VALORIA_SUPABASE_URL,
)

log = structlog.get_logger()


# ---------------------------------------------------------------------------
# 1. catalogo_consultar
# ---------------------------------------------------------------------------
def _valoria_select(select: str, table: str, filters: dict[str, str], limit: int) -> list | None:
    """Query PostgREST direto no Supabase Valoria (anon key, respeita RLS)."""
    if not VALORIA_SUPABASE_URL or not VALORIA_SUPABASE_KEY:
        return None
    try:
        params: dict[str, str] = {"select": select, "limit": str(limit)}
        params.update(filters)
        r = httpx.get(
            f"{VALORIA_SUPABASE_URL}/rest/v1/{table}",
            params=params,
            headers={
                "apikey": VALORIA_SUPABASE_KEY,
                "Authorization": f"Bearer {VALORIA_SUPABASE_KEY}",
                "Accept-Profile": "catalogo",
            },
            timeout=15,
        )
        if r.status_code == 200:
            return r.json()
        log.warning("valoria_select_error", status=r.status_code, body=r.text[:200])
    except Exception as exc:
        log.warning("valoria_select_exception", error=str(exc))
    return None


def catalogo_consultar(
    categoria: Optional[str] = None,
    especie_nome: Optional[str] = None,
    subtipo: Optional[str] = None,
    origem: Optional[str] = None,
    ativo_only: bool = True,
    limit: int = 40,
) -> dict:
    filters: dict[str, str] = {}
    if ativo_only:
        filters["ativo"] = "eq.true"
    if categoria:
        filters["categoria"] = f"eq.{categoria}"
    if subtipo:
        filters["subtipo"] = f"eq.{subtipo}"
    if origem:
        filters["origem"] = f"eq.{origem}"
    if especie_nome:
        filters["especie_nome"] = f"ilike.*{especie_nome}*"
    filters["order"] = "categoria,subtipo,especie_nome"

    lim = max(1, min(200, int(limit)))
    rows = _valoria_select(
        select="external_id,id,categoria,subtipo,origem,especie_nome,dimensao_label,preco,ativo",
        table="tabela_precos",
        filters=filters,
        limit=lim,
    )
    if rows is None:
        return {"ok": False, "error": "falha ao consultar catálogo da Valoria (PostgREST)"}

    out = []
    for r in rows:
        out.append(
            {
                "id": r.get("external_id") or str(r.get("id") or ""),
                "categoria": r.get("categoria"),
                "subtipo": r.get("subtipo") or "-",
                "origem": r.get("origem") or "-",
                "especie_nome": r.get("especie_nome") or "-",
                "dimensao_label": r.get("dimensao_label") or "-",
                "preco": float(r.get("preco") or 0),
                "ativo": bool(r.get("ativo")),
            }
        )
    return {
        "ok": True,
        "count": len(out),
        "rows": out,
        "fonte": "valoria.catalogo.tabela_precos",
    }


# ---------------------------------------------------------------------------
# 2. catalogo_editar_preco (usa docker exec no parket-pg-local)
# ---------------------------------------------------------------------------
PG_SERVICE = "parket-pg-local_postgres"
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
_CATALOGO_ROLES_PERMITIDAS = {"superadmin", "admin", "dept_leader"}


def _resolve_pg_container() -> str | None:
    try:
        cp = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}", "--filter", f"name={PG_SERVICE}"],
            capture_output=True, text=True, timeout=5,
        )
        for name in cp.stdout.strip().splitlines():
            if name.startswith(PG_SERVICE):
                return name.strip()
    except Exception:
        return None
    return None


def _psql(sql: str, timeout: int = 30) -> subprocess.CompletedProcess:
    container = _resolve_pg_container()
    if not container:
        return subprocess.CompletedProcess(
            args=[], returncode=1, stdout="",
            stderr=f"container {PG_SERVICE} não encontrado",
        )
    return subprocess.run(
        ["docker", "exec", "-i", container,
         "psql", "-U", "postgres", "-d", "postgres", "-tA", "-F", "|", "-c", sql],
        capture_output=True, text=True, timeout=timeout,
    )


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


def catalogo_editar_preco(preco_id: str, novo_preco: float, motivo: str, user_email: str) -> dict:
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
        return {"ok": False, "error": "motivo é obrigatório"}

    # Resolve id mestre se o preco_id vier do catálogo Valoria (external_id).
    chk = _psql(f"SELECT 1 FROM public.orcamento_tabela_precos WHERE id = '{preco_id}'::uuid")
    if chk.returncode == 0 and not chk.stdout.strip():
        rows = _valoria_select(
            select="external_id",
            table="tabela_precos",
            filters={"id": f"eq.{preco_id}"},
            limit=1,
        )
        ext = rows[0].get("external_id") if rows else None
        if ext and _UUID_RE.match(ext):
            preco_id = ext
        else:
            return {
                "ok": False,
                "error": "linha sem vínculo com mestre (external_id vazio). "
                         "Espera ~1min do sync e tenta de novo.",
            }

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
        return {"ok": False, "error": "UPDATE não afetou linhas"}

    result = {
        "ok": True,
        "categoria": parts[0],
        "especie": parts[1],
        "dimensao": parts[2],
        "preco_antes": float(parts[3]) if parts[3] else 0.0,
        "preco_depois": float(parts[4]) if parts[4] else 0.0,
    }

    # Propaga imediato pra Valoria (sync 1x/min reafirma de qualquer forma).
    try:
        r = httpx.patch(
            f"{VALORIA_SUPABASE_URL}/rest/v1/tabela_precos",
            params={"external_id": f"eq.{preco_id}"},
            headers={
                "apikey": VALORIA_SUPABASE_KEY,
                "Authorization": f"Bearer {VALORIA_SUPABASE_KEY}",
                "Content-Profile": "catalogo",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json={"preco": preco_val},
            timeout=10,
        )
        result["valoria_atualizada"] = 200 <= r.status_code < 300
    except Exception as exc:
        log.warning("propagate_valoria_failed", error=str(exc))
        result["valoria_atualizada"] = False

    # Log em claude_atividades (best-effort).
    log_atividade(
        titulo=f"Data: catálogo preço {result['categoria']} {result['especie']}".strip(),
        descricao=(
            f"{result['categoria']} · {result['especie']} · {result['dimensao']}: "
            f"R$ {result['preco_antes']:.2f} → R$ {result['preco_depois']:.2f}. "
            f"Motivo: {motivo} · Por: {name or user_email} ({role})"
        ),
        setor="Comercial",
        categoria="data",
    )
    return result


# ---------------------------------------------------------------------------
# 3-4. Teca Núcleo aprendizados
# ---------------------------------------------------------------------------
TECA_BASE = "https://teca.parket.works/api"
TECA_HEADERS = {"x-user-email": "valoria-teca@parket.works"}


def teca_aprendizados_listar(
    app: Optional[str] = None,
    categoria: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 30,
) -> Any:
    try:
        with httpx.Client(timeout=15, headers=TECA_HEADERS) as c:
            r = c.get(
                f"{TECA_BASE}/aprendizados",
                params={k: v for k, v in {
                    "app": app, "categoria": categoria, "status": status, "limit": limit
                }.items() if v is not None},
            )
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def teca_aprendizado_criar(
    app: str,
    categoria: str,
    titulo: str,
    descricao: str,
    prioridade: str = "media",
    tags: Optional[list[str]] = None,
) -> dict:
    try:
        with httpx.Client(timeout=15, headers=TECA_HEADERS) as c:
            r = c.post(f"{TECA_BASE}/aprendizados", json={
                "app": app, "categoria": categoria, "titulo": titulo,
                "descricao": descricao, "fonte": "valoria-teca",
                "prioridade": prioridade, "tags": tags or [],
            })
            r.raise_for_status()
            data = r.json()
        return {"ok": True, "id": str(data.get("id"))}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# 5. log_atividade — public.claude_atividades via gateway PostgREST
# ---------------------------------------------------------------------------
_VALID_CATEGORIES = {"fix", "feature", "config", "rollback", "data", "investigacao"}


def log_atividade(
    titulo: str,
    descricao: str = "",
    setor: str = "IA",
    categoria: str = "investigacao",
    tags: Optional[list[str]] = None,
) -> dict:
    if categoria not in _VALID_CATEGORIES:
        categoria = "investigacao"
    if not PARKET_ANON_KEY:
        return {"ok": False, "error": "PARKET_ANON_KEY não configurada"}
    payload = {
        "titulo": titulo,
        "descricao": descricao,
        "setor": setor,
        "categoria": categoria,
        "criado_por": "valoria-teca",
    }
    try:
        with httpx.Client(timeout=10) as c:
            r = c.post(
                f"{PARKET_API_URL}/rest/v1/claude_atividades",
                headers={
                    "apikey": PARKET_ANON_KEY,
                    "Authorization": f"Bearer {PARKET_ANON_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
                json=payload,
            )
        return {"ok": 200 <= r.status_code < 300, "status_code": r.status_code, "body": r.text[:200]}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Schemas + dispatcher
# ---------------------------------------------------------------------------
TOOLS = [
    {
        "name": "catalogo_consultar",
        "description": (
            "Consulta o catálogo de preços DA VALORIA (catalogo.tabela_precos). "
            "Mesmo banco que a proposta usa — o preço retornado aqui é o que vai pro orçamento. "
            "Retorna id, categoria, subtipo, origem, especie_nome, dimensao_label, preco, ativo."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "categoria": {"type": "string", "description": "Ex: piso, forro, painel, porta, revestimento, marcenaria"},
                "especie_nome": {"type": "string", "description": "Filtro parcial ILIKE (ex: 'Carvalho', 'Ipê')"},
                "subtipo": {"type": "string", "description": "Ex: regua, ripado, espinha, chevron, laca"},
                "origem": {"type": "string", "description": "nacional | importado"},
                "ativo_only": {"type": "boolean", "default": True},
                "limit": {"type": "integer", "default": 40, "maximum": 200},
            },
        },
    },
    {
        "name": "catalogo_editar_preco",
        "description": (
            "Altera preço no catálogo mestre (orcamento_tabela_precos) e propaga pra Valoria. "
            "RESTRITO: admin/superadmin/dept_leader. Loga em claude_atividades."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "preco_id": {"type": "string", "description": "UUID retornado por catalogo_consultar"},
                "novo_preco": {"type": "number", "description": "Novo preço R$/m² (all-in)"},
                "motivo": {"type": "string", "description": "Motivo curto, entra no log"},
                "user_email": {"type": "string", "description": "Email do usuário logado (do contexto)"},
            },
            "required": ["preco_id", "novo_preco", "motivo", "user_email"],
        },
    },
    {
        "name": "teca_aprendizados_listar",
        "description": "Lista aprendizados registrados no Teca Núcleo (histórico de erros/acertos/melhorias).",
        "input_schema": {
            "type": "object",
            "properties": {
                "app": {"type": "string", "description": "valoria, draw, status, etc"},
                "categoria": {"type": "string", "description": "erro|acerto|melhoria|automacao|padrao_repetitivo"},
                "status": {"type": "string", "description": "aberto|em_analise|automatizado|implementado|descartado"},
                "limit": {"type": "integer", "default": 30},
            },
        },
    },
    {
        "name": "teca_aprendizado_criar",
        "description": (
            "Registra um aprendizado no Teca Núcleo. Use quando o Will reportar um erro "
            "recorrente da Teca ou quando encontrar uma melhoria/padrão."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "app": {"type": "string", "description": "valoria (default pra Teca)", "default": "valoria"},
                "categoria": {"type": "string", "description": "erro|acerto|melhoria|automacao|padrao_repetitivo"},
                "titulo": {"type": "string"},
                "descricao": {"type": "string", "description": "Contexto + causa + o que fazer"},
                "prioridade": {"type": "string", "default": "media", "description": "baixa|media|alta"},
                "tags": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["categoria", "titulo", "descricao"],
        },
    },
    {
        "name": "log_atividade",
        "description": (
            "Registra atividade em public.claude_atividades (dashboard do time Parket). "
            "Use após ações relevantes: proposta gerada, catálogo alterado, etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "titulo": {"type": "string", "description": "1 linha objetiva"},
                "descricao": {"type": "string"},
                "setor": {"type": "string", "default": "IA"},
                "categoria": {"type": "string", "description": "fix|feature|config|rollback|data|investigacao"},
                "tags": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["titulo"],
        },
    },
]

_HANDLERS = {
    "catalogo_consultar": catalogo_consultar,
    "catalogo_editar_preco": catalogo_editar_preco,
    "teca_aprendizados_listar": teca_aprendizados_listar,
    "teca_aprendizado_criar": teca_aprendizado_criar,
    "log_atividade": log_atividade,
}


def dispatch(name: str, args: dict) -> Any:
    """Executa uma tool pelo nome. Argumentos vêm do modelo (JSON)."""
    fn = _HANDLERS.get(name)
    if not fn:
        return {"ok": False, "error": f"tool desconhecida: {name}"}
    try:
        return fn(**(args or {}))
    except TypeError as exc:
        return {"ok": False, "error": f"args inválidos pra {name}: {exc}"}
    except Exception as exc:
        log.exception("tool_dispatch_failed", tool=name)
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


def as_text(result: Any) -> str:
    """Serializa retorno de tool pra string (tool_result content precisa ser texto)."""
    if isinstance(result, str):
        return result
    return json.dumps(result, ensure_ascii=False, default=str)
