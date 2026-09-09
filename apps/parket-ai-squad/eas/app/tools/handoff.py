"""Handoff entre squads + log de atividades (claude_atividades público).

Cada squad chama:
- `log_atividade` ao terminar uma ação relevante (pra time Parket ver)
- `delegate_to_squad` quando passa o bastão pra outra squad
"""

from __future__ import annotations

import structlog
from agno.tools import tool
import httpx

from app.config import settings
from app.tools._db import execute, fetch_all

log = structlog.get_logger()

SUPABASE_MGMT_URL = "https://api.supabase.com/v1/projects/hbxpilrxmitvzebluoom/database/query"


def _supabase_sql(sql: str) -> dict:
    """Roda SQL no Supabase principal via Management API. Pra escrita em claude_atividades."""
    token = settings.supabase_service_key or ""
    # claude_atividades vive no Supabase principal — usa Mgmt API token (precisa de SBP token)
    # Pra F2 MVP, usamos PGREST direto via service_role no api.parket.works
    pgrest = f"{settings.supabase_url}/rest/v1/claude_atividades"
    headers = {
        "apikey": token,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    return {"sql_alt_path": pgrest, "headers": headers}


_VALID_CATEGORIES = {"fix", "feature", "config", "rollback", "data", "investigacao"}


@tool(name="log_atividade", show_result=False)
def log_atividade(titulo: str, descricao: str = "", setor: str = "Engenharia", categoria: str = "investigacao", tags: list[str] | None = None) -> dict:
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

    payload = {
        "titulo": titulo,
        "descricao": descricao,
        "setor": setor,
        "categoria": categoria,
        "criado_por": "eas",
    }

    url = f"{settings.supabase_url}/rest/v1/claude_atividades"
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    try:
        with httpx.Client(timeout=10) as client:
            r = client.post(url, json=payload, headers=headers)
        ok = 200 <= r.status_code < 300
        log.info("atividade logged", titulo=titulo, status=r.status_code, ok=ok)
        return {"ok": ok, "status_code": r.status_code, "body": r.text[:300]}
    except Exception as exc:  # noqa: BLE001
        log.error("log_atividade failed", error=str(exc))
        return {"ok": False, "error": str(exc)}


@tool(name="delegate_to_squad", show_result=True)
def delegate_to_squad(from_agent: str, to_squad: str, payload: dict, ticket_id: str | None = None) -> dict:
    """Cria handoff pra outra squad. Squad-destino pega via `pull_handoffs`.

    Args:
        from_agent: nome do agente origem (ex: 'tech_lead', 'dashboard_squad').
        to_squad: nome da squad destino (dashboard, infra, api, whatsapp, setor_apps, proposta, space_v2).
        payload: dict com a tarefa (descrição, contexto, links).
        ticket_id: opcional, pra rastrear ticket original.
    """
    import json
    n = execute(
        """
        INSERT INTO eas.eas_handoffs (from_agent, to_squad, ticket_id, payload, status)
        VALUES (%s,%s,%s,%s,'open')
        RETURNING id::text
        """,
        (from_agent, to_squad, ticket_id, json.dumps(payload, ensure_ascii=False, default=str)),
    )
    return {"ok": n >= 1, "to_squad": to_squad, "ticket_id": ticket_id}


def pull_handoffs(to_squad: str, limit: int = 5) -> list[dict]:
    """Lista handoffs abertos pra uma squad. Não-tool — chamado pelo worker da squad."""
    return fetch_all(
        """
        SELECT id::text, from_agent, payload::jsonb AS payload, ticket_id, created_at
        FROM eas.eas_handoffs
        WHERE to_squad=%s AND status='open'
        ORDER BY created_at
        LIMIT %s
        """,
        (to_squad, limit),
    )


def close_handoff(handoff_id: str, status: str, notes: str | None = None) -> dict:
    n = execute(
        "UPDATE eas.eas_handoffs SET status=%s, closed_at=now(), notes=%s WHERE id=%s",
        (status, notes, handoff_id),
    )
    return {"ok": n == 1}
