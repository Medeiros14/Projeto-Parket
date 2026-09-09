"""
Relatório Diário do Setor de Compras
=====================================
Envia todos os dias às 21h no grupo Parket — Compras um fechamento por board
(Ronaldo / Taiara / Marco Antônio). As métricas do dia são coletadas direto do
Supabase (kanban_cards) e passadas como contexto para o agente do squad
configurado no grupo de Compras, que redige a mensagem final.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger("relatorio_compras")

SP_TZ = ZoneInfo("America/Sao_Paulo")

COMPRAS_GROUP_ID = "120363427283309459@g.us"  # 🛒 Parket - Compras

# Boards do setor de Compras: dept_id no kanban → rótulo e responsável
BOARDS = [
    {"dept_id": "compras",        "label": "Marcenaria / Lalamove", "responsavel": "Ronaldo"},
    {"dept_id": "compras-taiane", "label": "Instalação",            "responsavel": "Taiara"},
    {"dept_id": "compras-marco",  "label": "Amostras Marcenaria",   "responsavel": "Marco Antônio"},
]


def _parse_ts(value: str):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=SP_TZ)
        return dt.astimezone(SP_TZ)
    except Exception:
        return None


def _in_range(ts, start, end) -> bool:
    return ts is not None and start <= ts < end


def _collect_board_metrics(sb, dept_id: str, start: datetime, end: datetime) -> dict:
    """Coleta métricas do dia para um board específico de compras."""
    resp = (
        sb.table("kanban_cards")
        .select("id,title,column_id,created_at,updated_at,details")
        .eq("dept_id", dept_id)
        .execute()
    )
    cards = resp.data or []

    novas_solic = 0
    aceitas = 0
    rejeitadas = 0
    entregues = 0
    em_cotacao = 0
    pendentes = 0
    origens: dict[str, int] = {}
    solicitantes: dict[str, int] = {}
    itens_destaque: list[str] = []
    rejeicoes_motivos: list[str] = []

    ativos_total = 0
    atrasados = 0

    for card in cards:
        det = card.get("details", {}) or {}
        col = card.get("column_id", "")

        criado_ts = _parse_ts(det.get("data_solicitacao") or card.get("created_at", ""))
        atualizado_ts = _parse_ts(card.get("updated_at", ""))

        # Status geral atual
        ativos_total += 1
        if col == "entrada":
            pendentes += 1
        elif col == "cotacao":
            em_cotacao += 1
        elif col in ("entregue", "finalizado"):
            if _in_range(atualizado_ts, start, end):
                entregues += 1

        # SLA simples: pendente há mais de 48h
        if col == "entrada" and criado_ts and (datetime.now(SP_TZ) - criado_ts).total_seconds() > 48 * 3600:
            atrasados += 1

        # Novas solicitações criadas hoje
        if _in_range(criado_ts, start, end):
            novas_solic += 1
            origem = (det.get("origem") or "desconhecida").lower()
            origens[origem] = origens.get(origem, 0) + 1
            solicitante = det.get("solicitante") or "—"
            solicitantes[solicitante] = solicitantes.get(solicitante, 0) + 1
            for item in (det.get("itens") or [])[:2]:
                if len(itens_destaque) < 8:
                    itens_destaque.append(str(item)[:80])

        # Aceites / rejeições de hoje
        aceito_ts = _parse_ts(det.get("aceito_em", ""))
        if _in_range(aceito_ts, start, end):
            aceitas += 1
        rejeitado_ts = _parse_ts(det.get("rejeitado_em", ""))
        if _in_range(rejeitado_ts, start, end):
            rejeitadas += 1
            motivo = det.get("motivo_rejeicao") or ""
            if motivo:
                rejeicoes_motivos.append(motivo[:160])

    return {
        "novas_solic": novas_solic,
        "aceitas": aceitas,
        "rejeitadas": rejeitadas,
        "entregues_hoje": entregues,
        "em_cotacao": em_cotacao,
        "pendentes": pendentes,
        "ativos_total": ativos_total,
        "atrasados": atrasados,
        "origens": origens,
        "solicitantes": solicitantes,
        "itens_destaque": itens_destaque,
        "rejeicoes_motivos": rejeicoes_motivos,
    }


def _fmt_dict(d: dict, top_n: int = 5) -> list[str]:
    if not d:
        return ["  _(sem dados)_"]
    items = sorted(d.items(), key=lambda x: -x[1])[:top_n]
    out = []
    for k, v in items:
        out.append(f"  • {k}: *{v}*")
    return out


def _build_fallback_text(board: dict, m: dict, agora: datetime) -> str:
    DIAS_PT = {
        "Monday": "Segunda", "Tuesday": "Terça", "Wednesday": "Quarta",
        "Thursday": "Quinta", "Friday": "Sexta", "Saturday": "Sábado", "Sunday": "Domingo",
    }
    dia_semana = DIAS_PT.get(agora.strftime("%A"), agora.strftime("%A"))

    linhas = []
    linhas.append(f"🛒 *FECHAMENTO DO DIA — COMPRAS / {board['label'].upper()}*")
    linhas.append(f"👤 {board['responsavel']}")
    linhas.append(f"📅 {agora.strftime('%d/%m/%Y')} — {dia_semana}")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("")
    linhas.append("*MOVIMENTO DO DIA*")
    linhas.append(f"  📥 Novas solicitações: *{m['novas_solic']}*")
    linhas.append(f"  ✅ Aceitas: *{m['aceitas']}*")
    if m["rejeitadas"]:
        linhas.append(f"  ❌ Rejeitadas: *{m['rejeitadas']}*")
    linhas.append(f"  📦 Entregues hoje: *{m['entregues_hoje']}*")
    linhas.append("")
    linhas.append("*SITUAÇÃO ATUAL*")
    linhas.append(f"  🟡 Em cotação: *{m['em_cotacao']}*")
    linhas.append(f"  🔵 Pendentes (entrada): *{m['pendentes']}*")
    if m["atrasados"]:
        linhas.append(f"  🚨 Atrasados (>48h em entrada): *{m['atrasados']}*")
    linhas.append(f"  📊 Total ativo no board: *{m['ativos_total']}*")
    linhas.append("")
    if m["solicitantes"]:
        linhas.append("*TOP SOLICITANTES*")
        linhas.extend(_fmt_dict(m["solicitantes"]))
        linhas.append("")
    if m["itens_destaque"]:
        linhas.append("*ITENS DO DIA*")
        for i in m["itens_destaque"][:6]:
            linhas.append(f"  • {i}")
        linhas.append("")
    if m["rejeicoes_motivos"]:
        linhas.append("*MOTIVOS DE REJEIÇÃO*")
        for mot in m["rejeicoes_motivos"][:3]:
            linhas.append(f"  • _{mot}_")
        linhas.append("")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("🔗 space.parket.works")
    return "\n".join(linhas)


async def _gerar_via_squad(board: dict, m: dict, agora: datetime) -> str:
    """Pede ao agente do squad de Compras para redigir o fechamento do dia.

    Usa agent_squad.dispatch com o group_id do WhatsApp de Compras — o squad
    resolve sozinho qual agente está configurado naquele grupo e aplica as
    skills/MCPs cadastradas.
    """
    from app.database import AsyncSessionLocal
    from app.core.agno_engine import agent_squad

    metricas_txt = (
        f"Board: {board['label']} ({board['responsavel']})\n"
        f"Data: {agora.strftime('%d/%m/%Y %H:%M')}\n"
        f"- Novas solicitações: {m['novas_solic']}\n"
        f"- Aceitas hoje: {m['aceitas']}\n"
        f"- Rejeitadas hoje: {m['rejeitadas']}\n"
        f"- Entregues hoje: {m['entregues_hoje']}\n"
        f"- Em cotação (atual): {m['em_cotacao']}\n"
        f"- Pendentes em entrada: {m['pendentes']}\n"
        f"- Atrasados >48h em entrada: {m['atrasados']}\n"
        f"- Total ativo no board: {m['ativos_total']}\n"
        f"- Solicitantes do dia: "
        + (", ".join(f"{k}({v})" for k, v in sorted(m['solicitantes'].items(), key=lambda x: -x[1])[:5]) or "—")
        + "\n"
        f"- Itens do dia: " + ("; ".join(m['itens_destaque'][:6]) or "—") + "\n"
        f"- Motivos de rejeição: " + (" | ".join(m['rejeicoes_motivos'][:3]) or "—")
    )

    prompt = (
        "Gere o FECHAMENTO DIÁRIO do setor de Compras para o board abaixo, no padrão "
        "das mensagens do grupo WhatsApp de Compras. Use português formal brasileiro, "
        "emojis comedidos e formatação WhatsApp (*negrito*). Inclua um cabeçalho com o "
        "board e responsável, um bloco de movimento do dia, um bloco de situação atual, "
        "destaque pontos de atenção (atrasados e rejeições) e feche com 1 recomendação "
        "curta e acionável para amanhã. Seja objetivo: no máximo 20 linhas. "
        "Não invente dados — use SOMENTE as métricas abaixo.\n\n"
        f"{metricas_txt}"
    )

    try:
        async with AsyncSessionLocal() as db:
            resp = await agent_squad.dispatch(
                db=db,
                group_id=COMPRAS_GROUP_ID,
                user_message=prompt,
                sender_name="Relatório Diário",
                sender_phone="cron@21h",
            )
        if resp and resp.strip():
            return resp.strip()
    except Exception as e:
        logger.warning(f"squad_dispatch_compras_falhou dept={board['dept_id']} err={e}")

    # Fallback: texto montado localmente
    return _build_fallback_text(board, m, agora)


async def enviar_relatorio_compras():
    """Cron job: 21h SP — gera e envia um fechamento por board no grupo de Compras."""
    from supabase import create_client
    from app.config import settings
    from app.core.evolution_client import evolution_client

    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    except Exception as e:
        logger.error(f"relatorio_compras_supabase_error: {e}", exc_info=True)
        return

    agora = datetime.now(SP_TZ)
    start = agora.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    enviados = 0
    for board in BOARDS:
        try:
            m = _collect_board_metrics(sb, board["dept_id"], start, end)
            texto = await _gerar_via_squad(board, m, agora)
            await evolution_client.send_long_text(COMPRAS_GROUP_ID, texto)
            enviados += 1
            logger.info(
                f"relatorio_compras_sent dept={board['dept_id']} "
                f"novas={m['novas_solic']} aceitas={m['aceitas']} "
                f"entregues={m['entregues_hoje']} atrasados={m['atrasados']}"
            )
        except Exception as e:
            logger.error(f"relatorio_compras_board_error dept={board['dept_id']}: {e}", exc_info=True)

    logger.info(f"relatorio_compras_done boards_enviados={enviados}/{len(BOARDS)}")
