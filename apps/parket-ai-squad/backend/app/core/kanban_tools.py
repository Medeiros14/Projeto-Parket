"""
Kanban Agno Tools
==================
Funções que os agentes Agno podem chamar para interagir com o
Dashboard Kanban (via Supabase).

Cada função tem docstring clara para o LLM entender quando usá-la.
"""

from app.core.supabase_kanban import (
    list_cards,
    get_card,
    create_card,
    move_card,
    update_card,
    format_card_full,
    dept_summary,
    DEPT_NAMES,
    SLA_LABELS,
    PRIORITY_LABELS,
)


async def kanban_listar_cards(dept_id: str, coluna: str = "", status_sla: str = "") -> str:
    """
    Lista os cards de um departamento do Kanban.
    Use quando o usuário perguntar sobre tarefas, projetos ou status de um setor.

    Parâmetros:
    - dept_id: ID do departamento (ex: 'comercial', 'projetos', 'compras', 'producao',
               'logistica', 'obras', 'atendimento', 'financeiro', 'fiscal', 'produtividade')
    - coluna: (opcional) ID da coluna para filtrar
    - status_sla: (opcional) 'ok', 'warning' ou 'expired' para filtrar por SLA
    """
    try:
        cards = await list_cards(
            dept_id=dept_id,
            column_id=coluna or None,
            sla_status=status_sla or None,
        )
    except Exception as e:
        return f"Erro ao buscar cards: {e}"

    if not cards:
        filtro = f" na coluna '{coluna}'" if coluna else ""
        filtro += f" com SLA '{status_sla}'" if status_sla else ""
        return f"Nenhum card encontrado no departamento '{dept_id}'{filtro}."

    lines = [f"Cards do departamento {DEPT_NAMES.get(dept_id, dept_id)} ({len(cards)} total):"]
    for c in cards:
        sla = SLA_LABELS.get(c.get("sla_status", ""), "")
        prio = PRIORITY_LABELS.get(c.get("priority", ""), "")
        status_badge = f" [{sla}]" if sla else ""
        prio_badge = f" [P:{prio}]" if prio else ""
        lines.append(
            f"• ID: {c['id'][:8]}... | {c['title']}{status_badge}{prio_badge}"
            f"\n  Coluna: {c.get('column_id')} | Responsável: {c.get('responsavel')} | SLA: {c.get('sla')}"
        )
    return "\n".join(lines)


async def kanban_resumo_departamento(dept_id: str) -> str:
    """
    Gera um resumo executivo do status atual de um departamento.
    Use para responder perguntas como "Como está o Comercial?" ou
    "Quantas tarefas atrasadas tem em Obras?".

    Parâmetros:
    - dept_id: ID do departamento (ex: 'comercial', 'projetos', 'obras', etc.)
    """
    return await dept_summary(dept_id)


async def kanban_criar_card(
    dept_id: str,
    coluna_id: str,
    titulo: str,
    responsavel: str,
    sla: str,
    prioridade: str = "media",
    obra: str = "",
    subtitulo: str = "",
) -> str:
    """
    Cria um novo card no Kanban de um departamento.
    Use quando o usuário pedir para criar uma tarefa, projeto ou atividade.

    Parâmetros:
    - dept_id: ID do departamento destino
    - coluna_id: ID da coluna onde criar o card
    - titulo: Título do card (obrigatório)
    - responsavel: Nome do responsável (obrigatório)
    - sla: Prazo no formato '3d', '1sem', '2026-03-15', etc.
    - prioridade: 'alta', 'media' ou 'baixa' (padrão: 'media')
    - obra: Nome da obra/cliente (opcional)
    - subtitulo: Subtítulo descritivo (opcional)
    """
    card = {
        "dept_id": dept_id,
        "column_id": coluna_id,
        "title": titulo,
        "responsavel": responsavel,
        "sla": sla,
        "sla_status": "ok",
        "priority": prioridade,
    }
    if obra:
        card["obra"] = obra
    if subtitulo:
        card["subtitle"] = subtitulo

    try:
        result = await create_card(card)
    except Exception as e:
        return f"Erro ao criar card: {e}"

    if result:
        return (
            f"Card criado com sucesso!\n"
            f"ID: {result['id']}\n"
            f"Título: {result['title']}\n"
            f"Departamento: {DEPT_NAMES.get(dept_id, dept_id)} → Coluna: {coluna_id}\n"
            f"Responsável: {responsavel} | SLA: {sla}"
        )
    return "Falha ao criar o card."


async def kanban_mover_card(card_id: str, nova_coluna: str) -> str:
    """
    Move um card para outra coluna do Kanban.
    Use quando o usuário informar que uma tarefa avançou de etapa.

    Parâmetros:
    - card_id: ID completo do card (UUID)
    - nova_coluna: ID da coluna destino
    """
    try:
        ok = await move_card(card_id, nova_coluna)
    except Exception as e:
        return f"Erro ao mover card: {e}"

    return f"Card {card_id[:8]}... movido para coluna '{nova_coluna}' com sucesso."


async def kanban_atualizar_sla(card_id: str, novo_sla: str, novo_status: str = "ok") -> str:
    """
    Atualiza o SLA e status de um card.
    Use quando o usuário informar que o prazo mudou.

    Parâmetros:
    - card_id: ID completo do card (UUID)
    - novo_sla: Novo prazo (ex: '5d', '2026-03-20')
    - novo_status: 'ok', 'warning' ou 'expired'
    """
    try:
        ok = await update_card(card_id, {"sla": novo_sla, "sla_status": novo_status})
    except Exception as e:
        return f"Erro ao atualizar SLA: {e}"

    return f"SLA do card {card_id[:8]}... atualizado para '{novo_sla}' (status: {novo_status})."


async def kanban_detalhes_card(card_id: str) -> str:
    """
    Retorna as informações COMPLETAS de um card específico: descrição detalhada do
    projeto, dados estruturados (cliente, endereço, metragem, tipo de piso, etc.),
    histórico, checklist, responsável, SLA e todos os campos preenchidos.

    Use quando o usuário perguntar sobre um projeto específico, pedir detalhes de
    um card, quiser saber o status completo de uma obra, cliente ou tarefa.

    Parâmetros:
    - card_id: ID UUID do card (obtenha via kanban_listar_cards primeiro)
    """
    try:
        card = await get_card(card_id)
    except Exception as e:
        return f"Erro ao buscar card: {e}"

    if not card:
        return f"Card '{card_id}' não encontrado."

    return format_card_full(card)


async def kanban_buscar_projeto(dept_id: str, termo: str) -> str:
    """
    Busca cards por texto no título, obra, responsável ou tags em um departamento.
    Use quando o usuário mencionar o nome de um projeto, cliente ou obra específica.

    Parâmetros:
    - dept_id: ID do departamento
    - termo: Texto a buscar (nome do projeto, cliente, obra, responsável)
    """
    try:
        cards = await list_cards(dept_id)
    except Exception as e:
        return f"Erro ao buscar: {e}"

    termo_lower = termo.lower()
    found = [
        c for c in cards
        if termo_lower in (c.get("title") or "").lower()
        or termo_lower in (c.get("obra") or "").lower()
        or termo_lower in (c.get("responsavel") or "").lower()
        or termo_lower in (c.get("subtitle") or "").lower()
        or any(termo_lower in t.lower() for t in (c.get("tags") or []))
        or termo_lower in str(c.get("details") or {}).lower()
        or termo_lower in (c.get("description") or "").lower()
    ]

    if not found:
        return f"Nenhum card encontrado com o termo '{termo}' no departamento {DEPT_NAMES.get(dept_id, dept_id)}."

    lines = [f"Encontrado(s) {len(found)} card(s) com '{termo}':"]
    for c in found:
        lines.append(format_card_full(c))
        lines.append("─" * 40)
    return "\n".join(lines)


async def kanban_cards_atrasados_todos() -> str:
    """
    Lista todos os cards atrasados (SLA expirado) em TODOS os departamentos.
    Use quando o usuário perguntar sobre situação geral da empresa ou cards vencidos.
    """
    from app.core.supabase_kanban import list_cards as _list
    import httpx

    lines = ["Cards com SLA vencido em todos os departamentos:"]
    total_expired = 0

    for dept_id, dept_name in DEPT_NAMES.items():
        try:
            cards = await _list(dept_id=dept_id, sla_status="expired")
            if cards:
                total_expired += len(cards)
                lines.append(f"\n{dept_name} ({len(cards)}):")
                for c in cards:
                    lines.append(f"  • {c['title']} — {c.get('responsavel')} | SLA: {c.get('sla')}")
        except Exception:
            pass

    if total_expired == 0:
        return "Nenhum card com SLA vencido encontrado."

    lines.insert(1, f"Total: {total_expired} cards atrasados\n")
    return "\n".join(lines)


# Lista de ferramentas para registrar no agente
KANBAN_TOOLS = [
    kanban_listar_cards,
    kanban_resumo_departamento,
    kanban_detalhes_card,
    kanban_buscar_projeto,
    kanban_criar_card,
    kanban_mover_card,
    kanban_atualizar_sla,
    kanban_cards_atrasados_todos,
]
