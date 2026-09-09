"""Tools de catálogo pra Valoria Assistant.

- `catalogo_consultar`: lê o catálogo DA VALORIA (`catalogo.tabela_precos`, projeto
  Supabase skbjmlzgaeupflujomzw) — é o que o app da Valoria usa pra montar orçamento
  (Will 14/07/2026: "usar o banco do valoria pra tudo"). Os nomes/subtipos aqui já
  passaram pelas regras de limpeza do sync (ex: subtipo singular 'regua').
- `catalogo_editar_preco`: UPDATE no MESTRE (orcamento_tabela_precos no
  parket-pg-local) + propagação imediata pra Valoria via external_id. Editar só na
  Valoria não funciona: o sync Parket→Valoria (1x/min) sobrescreveria.
"""

from __future__ import annotations

import subprocess
import json
import re
from typing import Optional

import httpx
import structlog
from agno.tools import tool

log = structlog.get_logger()

PG_SERVICE = "parket-pg-local_postgres"

# Mesmo PAT/projeto dos syncs oficiais (/root/valoria-app/db/sync_*.py).
_SUPA_PAT = "sbp_01ac2cd076c0a0f6f21eaa4404bc0af1c2ddbe63"
_VALORIA_PROJECT = "skbjmlzgaeupflujomzw"


def _valoria_sql(query: str, timeout: float = 30.0) -> list | None:
    """Roda SQL no projeto Supabase da Valoria via Management API. None em erro."""
    try:
        r = httpx.post(
            f"https://api.supabase.com/v1/projects/{_VALORIA_PROJECT}/database/query",
            headers={"Authorization": f"Bearer {_SUPA_PAT}", "Content-Type": "application/json"},
            json={"query": query},
            timeout=timeout,
        )
        if r.status_code in (200, 201):
            return r.json()
        log.warning("valoria_sql error", status=r.status_code, body=r.text[:300])
    except Exception as exc:  # noqa: BLE001
        log.warning("valoria_sql exception", error=str(exc))
    return None


def _resolve_container() -> str | None:
    """Resolve o container atual do serviço parket-pg-local (nome inclui task id)."""
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
    # Escapa aspas simples para embedding direto em SQL literal.
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
    """Consulta o catálogo de preços DA VALORIA (catalogo.tabela_precos).

    É o mesmo banco que o app da Valoria usa pra montar orçamento — o preço
    retornado aqui é EXATAMENTE o que a proposta vai usar.

    Args:
        categoria: filtro exato minúsculo (ex: 'piso', 'forro', 'painel', 'porta', 'revestimento', 'marcenaria').
        especie_nome: filtro parcial ILIKE (ex: 'Carvalho', 'Ipê').
        subtipo: filtro exato singular (ex: 'regua', 'ripado', 'laca', 'espinha', 'chevron').
        origem: filtro exato (ex: 'nacional', 'importado').
        ativo_only: True (default) traz só produtos ativos.
        limit: máximo de rows (default 40, max 200).

    Retorna lista com id (usar em catalogo_editar_preco), categoria, subtipo,
    origem, especie_nome, dimensao_label, preco, ativo.
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

    data = _valoria_sql(
        "SELECT COALESCE(external_id, id::text) AS id, categoria, "
        "COALESCE(subtipo,'-') AS subtipo, COALESCE(origem,'-') AS origem, "
        "COALESCE(especie_nome,'-') AS especie_nome, "
        "COALESCE(dimensao_label,'-') AS dimensao_label, preco, ativo "
        f"FROM catalogo.tabela_precos WHERE {where_sql} "
        f"ORDER BY categoria, subtipo, especie_nome LIMIT {lim}"
    )
    if data is None:
        return {"ok": False, "error": "falha ao consultar catálogo da Valoria (Management API)"}

    rows = []
    for r in data:
        rows.append({
            "id": r.get("id"),
            "categoria": r.get("categoria"),
            "subtipo": r.get("subtipo"),
            "origem": r.get("origem"),
            "especie_nome": r.get("especie_nome"),
            "dimensao_label": r.get("dimensao_label"),
            "preco": float(r.get("preco") or 0),
            "ativo": bool(r.get("ativo")),
        })
    return {"ok": True, "count": len(rows), "rows": rows, "fonte": "valoria.catalogo.tabela_precos"}


_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

# Roles com permissão pra editar catálogo (dado mestre). Orçamentista comum
# ('viewer' e demais) só mexe na proposta dele. Regra dada pelo Will.
_CATALOGO_ROLES_PERMITIDAS = {"superadmin", "admin", "dept_leader"}


def _lookup_user_role(email: str) -> tuple[str | None, str | None]:
    """Retorna (role, full_name) de user_profiles ou (None, None)."""
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
    """Altera o preço de 1 linha do catálogo mestre (orcamento_tabela_precos)
    e propaga imediato pro catálogo da Valoria (catalogo.tabela_precos).

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
    # catalogo_consultar retorna COALESCE(external_id, id) da Valoria. Se o id não
    # existe no mestre, é o id da linha na Valoria — resolve pro mestre via external_id.
    chk = _psql(f"SELECT 1 FROM public.orcamento_tabela_precos WHERE id = '{preco_id}'::uuid")
    if chk.returncode == 0 and not chk.stdout.strip():
        v = _valoria_sql(
            f"SELECT external_id FROM catalogo.tabela_precos WHERE id = '{preco_id}'"
        )
        ext = (v[0].get("external_id") if v else None)
        if ext and _UUID_RE.match(ext):
            preco_id = ext
        else:
            return {
                "ok": False,
                "error": (
                    "linha ainda sem vínculo com o catálogo mestre (external_id vazio). "
                    "Aguarde ~1 min (sync) e consulte de novo antes de editar."
                ),
            }
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

    # Propaga imediato pro catálogo da Valoria (o sync 1x/min re-afirmaria de
    # qualquer forma, mas o orçamentista não precisa esperar).
    prop = _valoria_sql(
        f"UPDATE catalogo.tabela_precos SET preco = {preco_val}, updated_at = now() "
        f"WHERE external_id = '{preco_id}' RETURNING id"
    )
    result["valoria_atualizada"] = bool(prop)

    # Log em claude_atividades (best-effort).
    try:
        from app.tools.handoff import log_atividade
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
        log.warning("failed to log catalogo edit", error=str(exc))

    return result
