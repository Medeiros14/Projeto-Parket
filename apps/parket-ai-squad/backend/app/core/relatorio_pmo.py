"""
Relatório Diário PMO — Acompanhamento de Obras
================================================
Roda todo dia às 21h SP no grupo "📋 Parket - PMO" e mostra o estado real
dos cards do setor `dept_id='produtividade'` no Dashboardparket — sem inventar
nada: lê direto do JSON `details.cronograma_pmo` salvo pelo time no kanban.

Para cada obra calcula:
  • % de execução   = soma(instalado) / soma(quantidade)
  • alertas abertos = nº de entradas em `alertas` com status != concluído
  • atraso          = item com status='atrasado' OU data_termino vencida
  • farol           = 🟢 / 🟡 / 🔴 / ⚪ conforme as regras abaixo

Não usa o squad / LLM — texto é determinístico para garantir que só apareça
o que está de fato no Supabase, como o usuário pediu.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

logger = logging.getLogger("relatorio_pmo")

SP_TZ = ZoneInfo("America/Sao_Paulo")
PMO_GROUP_ID = "120363405460675664@g.us"  # 📋 Parket - PMO
PMO_DEPT_ID = "produtividade"

# Status de alerta que conta como "aberto" (não resolvido)
ALERTA_ABERTO = {"em_analise", "fazendo", "aguardando"}

# Mapeamento de fase do kanban → label legível e ordem de prioridade
COLUMN_LABELS: dict[str, str] = {
    "planejamento": "Planejamento",
    "compras": "Compras",
    "agendamento": "Agendamento",
    "execucao": "Em Execução",
    "execução": "Em Execução",
    "em_andamento": "Em Execução",
    "acompanhamento": "Acompanhamento",
    "ajustes": "Ajustes",
    "vistoria": "Vistoria",
    "concluido": "Concluído",
    "concluído": "Concluído",
    "finalizado": "Concluído",
    "entregue": "Entregue",
}

# Cor do farol por categoria de cor
FAROL_VERDE = "🟢"
FAROL_AMARELO = "🟡"
FAROL_VERMELHO = "🔴"
FAROL_CINZA = "⚪"


def _parse_date(value) -> date | None:
    """Converte string ISO (YYYY-MM-DD ou YYYY-MM-DDTHH...) em date."""
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except Exception:
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").date()
        except Exception:
            return None


def _safe_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coluna_label(col_id: str | None) -> str:
    if not col_id:
        return "Sem fase"
    key = col_id.strip().lower()
    return COLUMN_LABELS.get(key, col_id.replace("_", " ").replace("-", " ").title())


def _analisar_card(card: dict, hoje: date) -> dict | None:
    """
    Lê o JSON do card e devolve um dict com os campos consolidados.
    Retorna None se o card não tem cronograma_pmo (não conta no relatório).
    """
    details = card.get("details") or {}
    if not isinstance(details, dict):
        return None
    crono = details.get("cronograma_pmo") or {}
    if not isinstance(crono, dict):
        return None
    itens = crono.get("itens") or []
    alertas = crono.get("alertas") or []

    # Soma m² contratado / instalado / pendente
    total_contratado = 0.0
    total_instalado = 0.0
    item_atrasado = False
    item_concluido = 0
    item_total = 0
    primeira_data_inicio: date | None = None
    ultima_data_termino: date | None = None

    for it in itens:
        if not isinstance(it, dict):
            continue
        item_total += 1
        qtd = _safe_float(it.get("quantidade"))
        inst = _safe_float(it.get("instalado"))
        total_contratado += qtd
        total_instalado += inst

        st = (it.get("status") or "").strip().lower()
        if st == "atrasado":
            item_atrasado = True
        if st == "concluido":
            item_concluido += 1

        di = _parse_date(it.get("data_inicio"))
        if di and (primeira_data_inicio is None or di < primeira_data_inicio):
            primeira_data_inicio = di
        df = _parse_date(it.get("data_termino"))
        if df and (ultima_data_termino is None or df > ultima_data_termino):
            ultima_data_termino = df
        # Item com data de término vencida e não concluído também é atraso
        if df and df < hoje and st != "concluido":
            item_atrasado = True

    pct = (total_instalado / total_contratado * 100.0) if total_contratado > 0 else 0.0

    # Alertas abertos
    alertas_abertos = 0
    for a in alertas:
        if not isinstance(a, dict):
            continue
        st = (a.get("status") or "").strip().lower()
        if st in ALERTA_ABERTO:
            alertas_abertos += 1

    # Define farol
    if item_total == 0 and not alertas:
        farol = FAROL_CINZA
        farol_motivo = "sem cronograma"
    elif item_atrasado or alertas_abertos > 0:
        farol = FAROL_VERMELHO
        farol_motivo = (
            f"{alertas_abertos} alerta{'s' if alertas_abertos != 1 else ''} aberto{'s' if alertas_abertos != 1 else ''}"
            if alertas_abertos else "item atrasado"
        )
    elif item_total > 0 and item_concluido == item_total:
        farol = FAROL_VERDE
        farol_motivo = "tudo concluído"
    elif pct >= 80:
        farol = FAROL_VERDE
        farol_motivo = "no ritmo"
    elif pct >= 30:
        farol = FAROL_AMARELO
        farol_motivo = "em execução"
    elif pct > 0:
        farol = FAROL_AMARELO
        farol_motivo = "início recente"
    else:
        farol = FAROL_CINZA
        farol_motivo = "ainda não iniciou"

    return {
        "id": card.get("id"),
        "title": (card.get("title") or "").strip(),
        "obra": (card.get("obra") or "").strip(),
        "responsavel": (card.get("responsavel") or "").strip(),
        "column_label": _coluna_label(card.get("column_id")),
        "column_id": card.get("column_id") or "",
        "total_contratado": round(total_contratado, 2),
        "total_instalado": round(total_instalado, 2),
        "pct": round(pct, 1),
        "item_total": item_total,
        "item_concluido": item_concluido,
        "alertas_abertos": alertas_abertos,
        "data_inicio": primeira_data_inicio,
        "data_termino": ultima_data_termino,
        "farol": farol,
        "farol_motivo": farol_motivo,
    }


def _coletar(sb) -> list[dict]:
    resp = (
        sb.table("kanban_cards")
        .select("id,title,obra,responsavel,column_id,details,updated_at")
        .eq("dept_id", PMO_DEPT_ID)
        .execute()
    )
    cards = resp.data or []
    hoje = datetime.now(SP_TZ).date()
    out: list[dict] = []
    for card in cards:
        analise = _analisar_card(card, hoje)
        if analise is None:
            continue
        out.append(analise)
    return out


# Ordem de prioridade dos faróis na listagem
FAROL_ORDER = {FAROL_VERMELHO: 0, FAROL_AMARELO: 1, FAROL_VERDE: 2, FAROL_CINZA: 3}


def _build_text(obras: list[dict], agora: datetime) -> str:
    DIAS_PT = {
        "Monday": "Segunda", "Tuesday": "Terça", "Wednesday": "Quarta",
        "Thursday": "Quinta", "Friday": "Sexta", "Saturday": "Sábado", "Sunday": "Domingo",
    }
    dia_semana = DIAS_PT.get(agora.strftime("%A"), agora.strftime("%A"))

    linhas: list[str] = []
    linhas.append("📋 *PMO — ACOMPANHAMENTO DIÁRIO*")
    linhas.append(f"📅 {agora.strftime('%d/%m/%Y')} — {dia_semana}")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("")

    if not obras:
        linhas.append("_Nenhuma obra com cronograma cadastrado no setor PMO._")
        linhas.append("")
        linhas.append("━━━━━━━━━━━━━━━━━━━━━")
        linhas.append("🔗 space.parket.works")
        return "\n".join(linhas)

    # Visão macro
    cnt_v = sum(1 for o in obras if o["farol"] == FAROL_VERDE)
    cnt_a = sum(1 for o in obras if o["farol"] == FAROL_AMARELO)
    cnt_r = sum(1 for o in obras if o["farol"] == FAROL_VERMELHO)
    cnt_c = sum(1 for o in obras if o["farol"] == FAROL_CINZA)

    total_contratado = sum(o["total_contratado"] for o in obras)
    total_instalado = sum(o["total_instalado"] for o in obras)
    pct_geral = (total_instalado / total_contratado * 100.0) if total_contratado > 0 else 0.0
    total_alertas = sum(o["alertas_abertos"] for o in obras)

    linhas.append("*VISÃO GERAL*")
    linhas.append(f"  🏗 Obras acompanhadas: *{len(obras)}*")
    linhas.append(f"  📐 Contratado: *{total_contratado:,.1f} m²*".replace(",", "."))
    linhas.append(f"  ✅ Instalado: *{total_instalado:,.1f} m²* ({pct_geral:.1f}%)".replace(",", "."))
    linhas.append(f"  ⚠️ Alertas abertos: *{total_alertas}*")
    linhas.append("")
    linhas.append("*FAROL*")
    linhas.append(f"  {FAROL_VERDE} No ritmo / concluídas: *{cnt_v}*")
    linhas.append(f"  {FAROL_AMARELO} Em execução: *{cnt_a}*")
    linhas.append(f"  {FAROL_VERMELHO} Com atraso ou alerta: *{cnt_r}*")
    linhas.append(f"  {FAROL_CINZA} Sem início: *{cnt_c}*")
    linhas.append("")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("*OBRAS*")

    # Ordena: vermelho → amarelo → verde → cinza, depois por nome
    obras_ord = sorted(obras, key=lambda o: (FAROL_ORDER[o["farol"]], o["title"].lower()))

    for o in obras_ord:
        nome = o["title"] or o["obra"] or "(sem nome)"
        linhas.append("")
        linhas.append(f"{o['farol']} *{nome}*")
        info_bits = []
        if o["responsavel"]:
            info_bits.append(f"👤 {o['responsavel']}")
        if o["column_label"]:
            info_bits.append(f"📍 {o['column_label']}")
        if info_bits:
            linhas.append("  " + " · ".join(info_bits))

        if o["item_total"] > 0:
            linhas.append(
                f"  📐 {o['total_instalado']:.1f}/{o['total_contratado']:.1f} m² · "
                f"*{o['pct']:.0f}%* · {o['item_concluido']}/{o['item_total']} serviços"
            )
        if o["data_inicio"] or o["data_termino"]:
            di = o["data_inicio"].strftime("%d/%m") if o["data_inicio"] else "—"
            df = o["data_termino"].strftime("%d/%m") if o["data_termino"] else "—"
            linhas.append(f"  🗓 {di} → {df}")
        if o["alertas_abertos"] > 0:
            linhas.append(f"  ⚠️ {o['alertas_abertos']} alerta(s) aberto(s)")
        # Curtinho explicando o farol
        linhas.append(f"  _farol: {o['farol_motivo']}_")

    linhas.append("")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("🔗 space.parket.works")
    return "\n".join(linhas)


async def enviar_relatorio_pmo():
    """Cron 21h SP — gera e envia o relatório diário no grupo Parket - PMO."""
    from supabase import create_client
    from app.config import settings
    from app.core.evolution_client import evolution_client

    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    except Exception as e:
        logger.error(f"relatorio_pmo_supabase_error: {e}", exc_info=True)
        return

    agora = datetime.now(SP_TZ)
    try:
        obras = _coletar(sb)
        texto = _build_text(obras, agora)
        await evolution_client.send_long_text(PMO_GROUP_ID, texto)
        logger.info(
            f"relatorio_pmo_sent obras={len(obras)} "
            f"vermelho={sum(1 for o in obras if o['farol'] == FAROL_VERMELHO)} "
            f"amarelo={sum(1 for o in obras if o['farol'] == FAROL_AMARELO)} "
            f"verde={sum(1 for o in obras if o['farol'] == FAROL_VERDE)} "
            f"cinza={sum(1 for o in obras if o['farol'] == FAROL_CINZA)}"
        )
    except Exception as e:
        logger.error(f"relatorio_pmo_error: {e}", exc_info=True)
