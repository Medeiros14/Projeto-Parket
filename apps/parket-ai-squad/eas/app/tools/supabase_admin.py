"""Supabase tools — leitura via PostgREST/SQL local, DDL via Mgmt API (confirm).

- `cloud_sql_read`: SELECT no Supabase Cloud via Mgmt API.
- `cloud_sql_ddl`: ALTER/CREATE/DROP no Cloud — EXIGE confirmação.
- `local_sql_read`: SELECT no postgres local (parket-pg-local).
- `mgmt_get`: GET na Management API (config, status, etc).
"""

from __future__ import annotations

import structlog
from agno.tools import tool
import httpx

from app.config import settings
from app.tools.confirm import request_confirmation

log = structlog.get_logger()

SUPABASE_MGMT_TOKEN = "SUPABASE_MGMT_TOKEN_REMOVIDO"
SUPABASE_PROJECT_REF = "hbxpilrxmitvzebluoom"
MGMT_BASE = f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_REF}"


def _mgmt_post_sql(sql: str) -> dict:
    headers = {
        "Authorization": f"Bearer {SUPABASE_MGMT_TOKEN}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=30) as client:
            r = client.post(f"{MGMT_BASE}/database/query", json={"query": sql}, headers=headers)
        ok = 200 <= r.status_code < 300
        return {"ok": ok, "status_code": r.status_code, "body": r.json() if ok else r.text[:1000]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def _is_read_only_sql(sql: str) -> bool:
    head = sql.strip().lower().split()[0] if sql.strip() else ""
    return head in {"select", "show", "explain", "with"}


def _cloud_sql_read_impl(sql: str) -> dict:
    """Implementação pura — chamável por outras tools sem erro de Function wrap."""
    if not _is_read_only_sql(sql):
        return {"ok": False, "error": "Apenas SQL read-only. Use cloud_sql_ddl pra escrita."}
    return _mgmt_post_sql(sql)


@tool(name="supabase_cloud_sql_read", show_result=True)
def cloud_sql_read(sql: str) -> dict:
    """SELECT/SHOW/EXPLAIN no Supabase Cloud (principal). Recusa qualquer DML/DDL."""
    return _cloud_sql_read_impl(sql)


@tool(name="supabase_cloud_sql_ddl", show_result=True)
def cloud_sql_ddl(sql: str, why: str) -> dict:
    """ALTER/INSERT/UPDATE/CREATE/DROP no Cloud. EXIGE confirmação Will.

    Args:
        sql: comando SQL.
        why: descrição clara do motivo (vai no WhatsApp pro Will).
    """
    if _is_read_only_sql(sql):
        return {"ok": False, "error": "Para SELECT, use cloud_sql_read (sem confirm)."}
    summary = f"SQL DDL no Cloud: {why}\nSQL: {sql[:300]}"
    conf = request_confirmation(
        tool_name="supabase_cloud_sql_ddl",
        summary=summary,
        tool_args={"sql_preview": sql[:500], "why": why},
    )
    if conf["status"] != "approved":
        return {"ok": False, "denied": True, "confirmation": conf}
    return _mgmt_post_sql(sql)


@tool(name="supabase_mgmt_get", show_result=True)
def mgmt_get(path: str) -> dict:
    """GET na Management API (ex: '/config/auth', '/health'). Path relativo a /projects/<ref>/."""
    if not path.startswith("/"):
        path = "/" + path
    headers = {"Authorization": f"Bearer {SUPABASE_MGMT_TOKEN}"}
    try:
        with httpx.Client(timeout=15) as client:
            r = client.get(f"{MGMT_BASE}{path}", headers=headers)
        return {"ok": 200 <= r.status_code < 300, "status_code": r.status_code, "body": r.text[:2000]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


@tool(name="supabase_local_sql_read", show_result=True)
def local_sql_read(sql: str) -> dict:
    """SELECT no postgres local (parket-pg-local). Pra checar replicação/dados sem latência cloud."""
    if not _is_read_only_sql(sql):
        return {"ok": False, "error": "Apenas read-only. Sem write no local (espelho do cloud)."}
    # parket-pg-local roda na network parket_internal — acessamos via psql interno
    import subprocess
    try:
        cp = subprocess.run(
            ["docker", "exec", "-i", "parket-pg-local_postgres", "psql", "-U", "postgres", "-d", "postgres", "-tA", "-c", sql],
            capture_output=True, text=True, timeout=30,
        )
        return {"ok": cp.returncode == 0, "rows": cp.stdout.strip().splitlines(), "stderr": cp.stderr[:500]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
