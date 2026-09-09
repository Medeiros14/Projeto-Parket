"""Kanban tools — wrapper sobre tabelas do kanban Parket no Supabase.

F2 MVP: read-only consultas comuns. Mutações (criar card, mover, etc) ficam
pra próximas fases — Teca V2 já tem essa lógica em `parket-ai-squad/backend/app/core/kanban_tools.py`.
"""

from __future__ import annotations

import structlog
from agno.tools import tool

from app.tools.supabase_admin import _cloud_sql_read_impl as cloud_sql_read

log = structlog.get_logger()


@tool(name="kanban_count_cards_by_column", show_result=True)
def count_cards_by_column(coluna_id: str | None = None) -> dict:
    """Quantos cards em cada coluna (ou só na coluna_id se passar)."""
    if coluna_id:
        sql = f"SELECT COUNT(*) AS total FROM public.kanban_cards WHERE coluna_id = '{coluna_id}' AND deleted_at IS NULL"
    else:
        sql = "SELECT coluna_id, COUNT(*) AS total FROM public.kanban_cards WHERE deleted_at IS NULL GROUP BY coluna_id ORDER BY total DESC LIMIT 30"
    return cloud_sql_read(sql)


@tool(name="kanban_cards_pendentes", show_result=True)
def cards_pendentes(dias_minimos: int = 7, limit: int = 20) -> dict:
    """Cards parados há N dias sem movimentação.

    Args:
        dias_minimos: cards com last_moved_at < hoje - N dias.
        limit: máx N cards.
    """
    sql = f"""
        SELECT id, titulo, coluna_id, last_moved_at, created_at
        FROM public.kanban_cards
        WHERE deleted_at IS NULL
          AND COALESCE(last_moved_at, created_at) < now() - interval '{int(dias_minimos)} days'
        ORDER BY COALESCE(last_moved_at, created_at)
        LIMIT {int(limit)}
    """
    return cloud_sql_read(sql)


@tool(name="kanban_atividades_recentes", show_result=True)
def atividades_recentes(setor: str | None = None, limit: int = 20) -> dict:
    """Últimas atividades registradas em claude_atividades. Filtra por setor opcional."""
    where = f"WHERE setor = '{setor}'" if setor else ""
    sql = f"""
        SELECT created_at, titulo, setor, categoria
        FROM public.claude_atividades
        {where}
        ORDER BY created_at DESC
        LIMIT {int(limit)}
    """
    return cloud_sql_read(sql)
