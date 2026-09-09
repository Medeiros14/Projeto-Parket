"""
Relatório Diário do Setor de Projetos
======================================
Envia todos os dias às 21h no grupo Parket — Projetos um relatório macro
e micro de cada membro da equipe: o que foi *feito hoje* (cards que
mudaram de coluna ou foram concluídos) e o que está *em andamento*.

Coleta os dados de `kanban_cards` (dept_id='projetos') no Supabase e
delega a redação ao agente Projetos do squad vinculado ao grupo. Em caso
de falha do squad, cai num texto fallback construído localmente.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger("relatorio_projetos")

SP_TZ = ZoneInfo("America/Sao_Paulo")

PROJETOS_GROUP_ID = "120363406795322179@g.us"  # 📐 Parket - Projetos
PROJETOS_DEPT_ID = "projetos"

# Colunas que indicam trabalho concluído / entregue
COLUMNS_FEITO = {"aprovado", "bom", "handoff-compras", "concluido", "finalizado"}

# Colunas que indicam trabalho em andamento (não conta o que está parado)
COLUMNS_ANDAMENTO = {"briefing", "desenvolvimento", "revisao"}


def _parse_ts(value):
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


def _collect_metrics(sb, start: datetime, end: datetime) -> dict:
    """Coleta cards do dept Projetos e agrega por responsável."""
    resp = (
        sb.table("kanban_cards")
        .select("id,title,column_id,responsavel,obra,priority,created_at,updated_at,details")
        .eq("dept_id", PROJETOS_DEPT_ID)
        .execute()
    )
    cards = resp.data or []

    # Estrutura por responsável
    by_member: dict[str, dict] = {}

    total_cards = 0
    feitos_total = 0
    andamento_total = 0

    for card in cards:
        responsavel = (card.get("responsavel") or "Sem responsável").strip()
        if not responsavel:
            responsavel = "Sem responsável"

        col = card.get("column_id", "")
        upd_ts = _parse_ts(card.get("updated_at", ""))

        if responsavel not in by_member:
            by_member[responsavel] = {
                "feitos_hoje": [],   # cards que entraram em coluna 'concluído' hoje
                "em_andamento": [],  # cards atualmente em andamento
                "total": 0,
            }
        by_member[responsavel]["total"] += 1
        total_cards += 1

        item = {
            "id": card.get("id"),
            "title": card.get("title", ""),
            "obra": card.get("obra", ""),
            "column": col,
            "priority": card.get("priority", ""),
        }

        # Feito hoje: card está numa coluna de "concluído" e foi atualizado hoje
        if col in COLUMNS_FEITO and _in_range(upd_ts, start, end):
            by_member[responsavel]["feitos_hoje"].append(item)
            feitos_total += 1

        # Em andamento: card está numa coluna ativa
        if col in COLUMNS_ANDAMENTO:
            by_member[responsavel]["em_andamento"].append(item)
            andamento_total += 1

    return {
        "by_member": by_member,
        "total_cards": total_cards,
        "feitos_total": feitos_total,
        "andamento_total": andamento_total,
    }


def _build_fallback_text(metrics: dict, agora: datetime) -> str:
    DIAS_PT = {
        "Monday": "Segunda", "Tuesday": "Terça", "Wednesday": "Quarta",
        "Thursday": "Quinta", "Friday": "Sexta", "Saturday": "Sábado", "Sunday": "Domingo",
    }
    dia_semana = DIAS_PT.get(agora.strftime("%A"), agora.strftime("%A"))

    linhas = []
    linhas.append("📐 *FECHAMENTO DO DIA — PROJETOS*")
    linhas.append(f"📅 {agora.strftime('%d/%m/%Y')} — {dia_semana}")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("")

    # MACRO
    linhas.append("*VISÃO MACRO*")
    linhas.append(f"  📊 Cards ativos: *{metrics['total_cards']}*")
    linhas.append(f"  ✅ Concluídos hoje: *{metrics['feitos_total']}*")
    linhas.append(f"  🔄 Em andamento: *{metrics['andamento_total']}*")
    linhas.append("")

    # MICRO por membro
    by_member = metrics["by_member"]
    if not by_member:
        linhas.append("_Nenhum card no setor._")
    else:
        linhas.append("*POR MEMBRO*")
        for nome in sorted(by_member.keys()):
            dados = by_member[nome]
            linhas.append("")
            linhas.append(f"👤 *{nome}* ({dados['total']} cards)")

            # Feitos hoje
            if dados["feitos_hoje"]:
                linhas.append("  ✅ _Feito hoje:_")
                for item in dados["feitos_hoje"][:5]:
                    obra = f" — {item['obra']}" if item["obra"] else ""
                    linhas.append(f"    • {item['title'][:60]}{obra}")
                if len(dados["feitos_hoje"]) > 5:
                    linhas.append(f"    _+{len(dados['feitos_hoje']) - 5} outros_")
            else:
                linhas.append("  ✅ _Feito hoje:_ —")

            # Em andamento
            if dados["em_andamento"]:
                linhas.append("  🔄 _Em andamento:_")
                for item in dados["em_andamento"][:5]:
                    obra = f" — {item['obra']}" if item["obra"] else ""
                    linhas.append(f"    • [{item['column']}] {item['title'][:55]}{obra}")
                if len(dados["em_andamento"]) > 5:
                    linhas.append(f"    _+{len(dados['em_andamento']) - 5} outros_")
            else:
                linhas.append("  🔄 _Em andamento:_ —")

    linhas.append("")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("🔗 space.parket.works")
    return "\n".join(linhas)


def _build_squad_context(metrics: dict, agora: datetime) -> str:
    """Monta o contexto que será passado ao agente Projetos do squad."""
    by_member = metrics["by_member"]
    linhas = [
        f"Data: {agora.strftime('%d/%m/%Y %H:%M')}",
        f"Total de cards ativos no setor: {metrics['total_cards']}",
        f"Concluídos hoje (todos os membros): {metrics['feitos_total']}",
        f"Em andamento (todos os membros): {metrics['andamento_total']}",
        "",
        "DETALHE POR MEMBRO:",
    ]

    if not by_member:
        linhas.append("(nenhum card no setor)")
    else:
        for nome in sorted(by_member.keys()):
            d = by_member[nome]
            linhas.append("")
            linhas.append(f"### {nome} ({d['total']} cards)")
            linhas.append("Feitos hoje:")
            if d["feitos_hoje"]:
                for it in d["feitos_hoje"][:8]:
                    obra = f" — {it['obra']}" if it["obra"] else ""
                    linhas.append(f"  - {it['title']}{obra}")
            else:
                linhas.append("  (nenhum)")
            linhas.append("Em andamento:")
            if d["em_andamento"]:
                for it in d["em_andamento"][:8]:
                    obra = f" — {it['obra']}" if it["obra"] else ""
                    linhas.append(f"  - [{it['column']}] {it['title']}{obra}")
            else:
                linhas.append("  (nenhum)")

    return "\n".join(linhas)


async def _gerar_via_squad(metrics: dict, agora: datetime) -> str:
    """Pede ao agente Projetos do squad para redigir o relatório do dia."""
    from app.database import AsyncSessionLocal
    from app.core.agno_engine import agent_squad

    contexto = _build_squad_context(metrics, agora)

    prompt = (
        "Gere o RELATÓRIO DIÁRIO do setor de Projetos para o grupo WhatsApp de "
        "Projetos. Estrutura obrigatória:\n"
        "1) Cabeçalho com data e dia da semana.\n"
        "2) Bloco *VISÃO MACRO* com totais (cards ativos, concluídos hoje, em andamento).\n"
        "3) Bloco *POR MEMBRO* com micro-relatório de cada responsável: o que foi "
        "feito hoje e o que está em andamento (com obra/cliente quando houver).\n"
        "4) Encerramento com 1 frase de orientação para amanhã.\n\n"
        "Use português brasileiro, formatação WhatsApp (*negrito*), emojis "
        "comedidos. Seja objetivo e completo. Não invente dados — use SOMENTE "
        "o contexto abaixo.\n\n"
        f"{contexto}"
    )

    try:
        async with AsyncSessionLocal() as db:
            resp = await agent_squad.dispatch(
                db=db,
                group_id=PROJETOS_GROUP_ID,
                user_message=prompt,
                sender_name="Relatório Diário",
                sender_phone="cron@21h",
            )
        if resp and resp.strip():
            return resp.strip()
    except Exception as e:
        logger.warning(f"squad_dispatch_projetos_falhou err={e}")

    # Fallback: texto montado localmente
    return _build_fallback_text(metrics, agora)


async def enviar_relatorio_projetos():
    """Cron job: 21h SP — gera e envia o relatório diário no grupo de Projetos."""
    from supabase import create_client
    from app.config import settings
    from app.core.evolution_client import evolution_client

    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    except Exception as e:
        logger.error(f"relatorio_projetos_supabase_error: {e}", exc_info=True)
        return

    agora = datetime.now(SP_TZ)
    start = agora.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    try:
        metrics = _collect_metrics(sb, start, end)
        texto = await _gerar_via_squad(metrics, agora)
        await evolution_client.send_long_text(PROJETOS_GROUP_ID, texto)
        logger.info(
            f"relatorio_projetos_sent total={metrics['total_cards']} "
            f"feitos_hoje={metrics['feitos_total']} "
            f"em_andamento={metrics['andamento_total']} "
            f"membros={len(metrics['by_member'])}"
        )
    except Exception as e:
        logger.error(f"relatorio_projetos_error: {e}", exc_info=True)
