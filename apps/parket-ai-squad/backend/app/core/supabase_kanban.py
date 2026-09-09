"""
Supabase Kanban Bridge
=======================
Acessa a tabela `kanban_cards` do dashboard Parket via Supabase REST API
usando a service key (bypass de RLS).
"""

import httpx
import structlog
from typing import Optional
from app.config import settings

logger = structlog.get_logger(__name__)

SUPABASE_URL = settings.SUPABASE_URL
SERVICE_KEY = settings.SUPABASE_SERVICE_KEY

# Mapeamento dept_id → nome legível
DEPT_NAMES = {
    "comercial": "Comercial",
    "projetos": "Projetos",
    "compras": "Compras",
    "producao": "Produção",
    "logistica": "Logística",
    "obras": "Obras",
    "atendimento": "Atendimento",
    "financeiro": "Financeiro",
    "fiscal": "Fiscal",
    "produtividade": "PMO",
    "rh": "RH",
    "ia": "Parket IA",
}

SLA_LABELS = {"ok": "No prazo", "warning": "Atenção", "expired": "Atrasado"}
PRIORITY_LABELS = {"alta": "Alta", "media": "Média", "baixa": "Baixa"}


def _headers() -> dict:
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def list_cards(
    dept_id: str,
    column_id: Optional[str] = None,
    sla_status: Optional[str] = None,
) -> list[dict]:
    """Lista cards de um departamento, opcionalmente filtrando por coluna ou SLA."""
    params: dict = {"dept_id": f"eq.{dept_id}", "select": "*", "order": "created_at.asc"}
    if column_id:
        params["column_id"] = f"eq.{column_id}"
    if sla_status:
        params["sla_status"] = f"eq.{sla_status}"

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers=_headers(),
            params=params,
        )
        r.raise_for_status()
        return r.json()


async def get_card(card_id: str) -> Optional[dict]:
    """Busca um card pelo ID."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers=_headers(),
            params={"id": f"eq.{card_id}", "select": "*", "limit": "1"},
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def create_card(card: dict) -> Optional[dict]:
    """Cria um card no Kanban. `card` deve seguir o schema DbCard (sem id)."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers=_headers(),
            json=card,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def move_card(card_id: str, to_column_id: str) -> bool:
    """Move um card para outra coluna."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers=_headers(),
            params={"id": f"eq.{card_id}"},
            json={"column_id": to_column_id},
        )
        r.raise_for_status()
        return True


async def update_card(card_id: str, fields: dict) -> bool:
    """Atualiza campos de um card existente."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers=_headers(),
            params={"id": f"eq.{card_id}"},
            json=fields,
        )
        r.raise_for_status()
        return True


def format_card_full(card: dict) -> str:
    """Formata um card com TODOS os seus dados para contexto do agente."""
    lines = [
        f"═══ CARD: {card.get('title', '?')} ═══",
        f"ID: {card.get('id', '?')}",
        f"Departamento: {DEPT_NAMES.get(card.get('dept_id',''), card.get('dept_id','?'))} | Coluna: {card.get('column_id','?')}",
        f"Responsável: {card.get('responsavel','?')} | SLA: {card.get('sla','?')} [{SLA_LABELS.get(card.get('sla_status',''),'?')}]",
        f"Prioridade: {PRIORITY_LABELS.get(card.get('priority',''),'?')} | Valor: {card.get('value','—')}",
    ]
    if card.get("obra"):
        lines.append(f"Obra/Código: {card['obra']}")
    if card.get("subtitle"):
        lines.append(f"Observação: {card['subtitle']}")
    if card.get("tags"):
        lines.append(f"Tags: {', '.join(card['tags'])}")
    if card.get("progress") is not None:
        lines.append(f"Progresso: {card['progress']}%")
    if card.get("checklist_total"):
        lines.append(f"Checklist contadores: {card.get('checklist_done',0)}/{card['checklist_total']}")

    # Gates / Timeline
    gates = card.get("gates_data") or []
    if gates:
        lines.append("\n── TIMELINE DE GATES ──")
        for g in gates:
            status_txt = {"done": "✓ Concluído", "current": "▶ Em andamento", "pending": "○ Pendente", "blocked": "✗ Bloqueado"}.get(g.get("status",""), g.get("status",""))
            date_txt = f" ({g['date']})" if g.get("date") else ""
            resp_txt = f" | {g['responsible']}" if g.get("responsible") else ""
            lines.append(f"  Gate {g.get('gate','')} — {g.get('label','')}: {status_txt}{date_txt}{resp_txt}")

    # Checklist items
    checklist = card.get("checklist_items") or []
    if checklist:
        done_count = sum(1 for c in checklist if c.get("done"))
        lines.append(f"\n── CHECKLIST ({done_count}/{len(checklist)}) ──")
        for c in checklist:
            mark = "✓" if c.get("done") else "○"
            lines.append(f"  {mark} {c.get('item','')}")

    # Handoffs
    handoffs = card.get("handoffs_data") or []
    if handoffs:
        lines.append("\n── HANDOFFS ──")
        for h in handoffs:
            status_txt = {"done": "✓", "current": "▶", "pending": "○"}.get(h.get("status",""), "")
            lines.append(f"  {status_txt} {h.get('from','')} → {h.get('to','')}: {h.get('item','')} [{h.get('date','')}]")

    # Financeiro
    fin = card.get("financeiro_data") or {}
    if fin:
        lines.append("\n── FINANCEIRO ──")
        if fin.get("valorContrato"): lines.append(f"  Contrato: {fin['valorContrato']}")
        if fin.get("orcado"):        lines.append(f"  Custo orçado: {fin['orcado']} (margem {fin.get('margemOrc','?')})")
        if fin.get("realizado"):     lines.append(f"  Custo real: {fin['realizado']} (margem {fin.get('margemReal','?')})")
        for p in fin.get("parcelas") or []:
            lines.append(f"  Parcela {p.get('num')}: {p.get('valor')} — {p.get('status')} (venc: {p.get('venc')})")

    # RACI
    raci = card.get("raci_data") or []
    if raci:
        lines.append("\n── RACI ──")
        for r in raci:
            lines.append(f"  {r.get('atividade','')}: R={r.get('r','')} A={r.get('a','')} C={r.get('c','')} I={r.get('i','')}")

    # Descrição e detalhes livres
    if card.get("description"):
        lines.append(f"\n── DESCRIÇÃO DO PROJETO ──\n{card['description']}")
    if card.get("details") and card["details"]:
        lines.append("\n── DETALHES ESTRUTURADOS ──")
        for k, v in card["details"].items():
            lines.append(f"  {k.upper().replace('_',' ')}: {v}")

    if card.get("created_at"):
        lines.append(f"\nCriado em: {card['created_at'][:19].replace('T',' ')}")
    if card.get("updated_at"):
        lines.append(f"Atualizado em: {card['updated_at'][:19].replace('T',' ')}")
    return "\n".join(lines)


async def get_obra(obra_id: str) -> Optional[dict]:
    """Busca uma obra pelo UUID na tabela obras."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/obras",
            headers=_headers(),
            params={"id": f"eq.{obra_id}", "select": "*", "limit": "1"},
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None


async def find_obras(term: str, limit: int = 5) -> list[dict]:
    """Busca obras por nome de cliente ou obra_code (busca textual)."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/obras",
            headers=_headers(),
            params={
                "or": f"cliente.ilike.*{term}*,localizacao.ilike.*{term}*,obra_code.ilike.*{term}*",
                "select": "*",
                "limit": str(limit),
            },
        )
        r.raise_for_status()
        return r.json()


async def get_obra_cronograma(obra_code: str) -> list[dict]:
    """Busca cronograma de uma obra pelo obra_code."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/obras_cronograma",
            headers=_headers(),
            params={"obra_code": f"eq.{obra_code}", "select": "*", "order": "etapa.asc"},
        )
        r.raise_for_status()
        return r.json()


async def get_obra_diarios(obra_code: str, limit: int = 5) -> list[dict]:
    """Busca diários de campo de uma obra (mais recentes primeiro)."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/obras_diarios",
            headers=_headers(),
            params={
                "obra_code": f"eq.{obra_code}",
                "select": "*",
                "order": "data.desc",
                "limit": str(limit),
            },
        )
        r.raise_for_status()
        return r.json()


async def get_obra_equipes(obra_code: str) -> list[dict]:
    """Busca equipes de campo alocadas em uma obra."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/obras_equipes_campo",
            headers=_headers(),
            params={"obra_code": f"eq.{obra_code}", "select": "*"},
        )
        r.raise_for_status()
        return r.json()


def format_obra_full(obra: dict, cronograma: list = None, diarios: list = None, equipes: list = None) -> str:
    """Formata os dados completos de uma obra para contexto do agente."""
    lines = [
        f"PROJETO: {obra.get('cliente', '?')}",
        f"ID: {obra.get('id', '?')}",
        f"Código: {obra.get('obra_code', '?')} | Status: {obra.get('status', '?')}",
        f"Localização: {obra.get('localizacao', '?')}",
        f"Progresso: {obra.get('progresso', 0)}% | Prioridade: {obra.get('prioridade', '?')}",
    ]
    if obra.get("m2_total"):
        lines.append(f"Área total: {obra['m2_total']} m²")
    if obra.get("valor_num"):
        lines.append(f"Valor contrato: R$ {obra['valor_num']:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
    if obra.get("margem_real") is not None:
        lines.append(f"Margem real: {obra['margem_real']}%")
    if obra.get("risk_score") is not None:
        lines.append(f"Risk score: {obra['risk_score']}")
    if obra.get("gate"):
        lines.append(f"Gate atual: {obra['gate']}")

    if cronograma:
        lines.append("\nCRONOGRAMA:")
        for etapa in cronograma:
            status = etapa.get("status", "?")
            lines.append(f"  {etapa.get('etapa','?')} — {etapa.get('descricao','?')} | Prazo: {etapa.get('prazo','?')} | Status: {status}")

    if diarios:
        lines.append(f"\nDIÁRIOS DE CAMPO (últimos {len(diarios)}):")
        for d in diarios:
            lines.append(f"  {d.get('data','?')}: Avanço {d.get('avanco_pct','?')}% | Horas: {d.get('horas','?')} | Equipe: {d.get('equipe','?')}")
            if d.get("observacao"):
                lines.append(f"    Obs: {d['observacao']}")

    if equipes:
        lines.append(f"\nEQUIPES ALOCADAS ({len(equipes)}):")
        for e in equipes:
            lines.append(f"  {e.get('equipe','?')} — {e.get('funcao','?')} | Entrada: {e.get('data_entrada','?')}")

    return "\n".join(lines)


async def dept_summary(dept_id: str) -> str:
    """
    Gera um resumo textual do estado atual do departamento.
    Usado como contexto para os agentes.
    """
    try:
        cards = await list_cards(dept_id)
    except Exception as e:
        logger.warning("dept_summary_failed", dept_id=dept_id, error=str(e))
        return ""

    if not cards:
        return f"Nenhum card encontrado no departamento {DEPT_NAMES.get(dept_id, dept_id)}."

    total = len(cards)
    expired = [c for c in cards if c.get("sla_status") == "expired"]
    warning = [c for c in cards if c.get("sla_status") == "warning"]

    # Agrupar por coluna
    by_col: dict[str, list] = {}
    for c in cards:
        col = c.get("column_id", "?")
        by_col.setdefault(col, []).append(c)

    lines = [
        f"Departamento: {DEPT_NAMES.get(dept_id, dept_id)}",
        f"Total de cards: {total} | Atrasados: {len(expired)} | Atenção: {len(warning)}",
        "",
        "Por coluna:",
    ]
    for col, col_cards in by_col.items():
        lines.append(f"  [{col}] — {len(col_cards)} card(s)")
        for card in col_cards:
            sla = SLA_LABELS.get(card.get("sla_status", ""), "")
            prio = PRIORITY_LABELS.get(card.get("priority", ""), "")
            badge = f" [{sla}]" if sla else ""
            prio_badge = f" [P:{prio}]" if prio else ""
            obra_badge = f" | Obra: {card['obra']}" if card.get("obra") else ""
            lines.append(f"    • {card['title']}{badge}{prio_badge} — {card.get('responsavel', '?')}{obra_badge}")

    if expired:
        lines += ["", "⚠️  Cards atrasados:"]
        for c in expired:
            lines.append(f"  • [{c.get('column_id')}] {c['title']} — {c.get('responsavel')} (SLA: {c.get('sla')})")

    return "\n".join(lines)
