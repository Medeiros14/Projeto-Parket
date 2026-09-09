"""
Relatório Diário do Funil Comercial — versão Homebroker
========================================================
Substitui o `relatorio_comercial.py` antigo. Roda às 21:00 SP e envia 3
mensagens separadas no grupo comercial:

1) Agendamentos da Teca IA (do dia)
2) Performance dos SDRs (Rafael Calazans + Vinicius Arruda)
3) Performance Comercial (funil, ganhos, pipeline 7 dias)
"""
import asyncio
import logging
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

logger = logging.getLogger("relatorio_comercial_hb")
SP_TZ = ZoneInfo("America/Sao_Paulo")

SDRS = ["Rafael Calazans", "Vinicius Arruda"]


def _now_sp() -> datetime:
    return datetime.now(SP_TZ)


def _today_str() -> str:
    return _now_sp().date().isoformat()


def _today_br() -> str:
    d = _now_sp()
    dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    return f"{d.day:02d}/{d.month:02d}/{d.year} — {dias[d.weekday()]}"


def _brl(v) -> str:
    try:
        v = float(v or 0)
    except Exception:
        v = 0
    return f"R$ {v:,.0f}".replace(",", ".")


# ─────────────────────────────────────────────────────────────────────────
# 1) Agendamentos da Teca IA
# ─────────────────────────────────────────────────────────────────────────
async def _msg_agendamentos_teca() -> str:
    from app.core.teca_v2.tools import _supabase_rest

    hoje = _today_str()
    ags = await _supabase_rest(
        "GET", "agendamentos",
        params={
            "select": "id,cliente_nome,vendedor,data,hora_inicio,modalidade,status,created_by,created_at",
            "created_at": f"gte.{hoje}T00:00:00",
            "order": "hora_inicio.asc",
        },
    ) or []
    ags = [a for a in ags if (a.get("created_by") or "").startswith("teca")]

    total = len(ags)
    com_vend = sum(1 for a in ags if (a.get("vendedor") or "A definir") != "A definir")
    sem_vend = total - com_vend
    meet = sum(1 for a in ags if a.get("modalidade") == "meet")
    presencial = total - meet

    linhas = [
        "🤖 *TECA IA — AGENDAMENTOS DO DIA*",
        f"📅 {_today_br()}",
        "━━━━━━━━━━━━━━━━━━━━━",
        "",
        f"📊 Total criado hoje: *{total}*",
        f"✅ Com especialista atribuído: *{com_vend}*",
        f"⚠️ Aguardando atribuição: *{sem_vend}*",
        f"🎥 Meet: {meet}  |  📍 Presencial: {presencial}",
    ]

    if ags:
        linhas.append("")
        linhas.append("📋 *Lista:*")
        for a in ags[:15]:
            cli = a.get("cliente_nome") or "—"
            try:
                d_obj = date.fromisoformat(a.get("data"))
                dt_str = f"{d_obj.day:02d}/{d_obj.month:02d}"
            except Exception:
                dt_str = a.get("data") or "—"
            h = (a.get("hora_inicio") or "")[:5]
            vend = a.get("vendedor") or "A definir"
            vend_str = "⚠️ aguardando" if vend == "A definir" else vend
            mod = "🎥 meet" if a.get("modalidade") == "meet" else "📍 presencial"
            linhas.append(f"• {cli} — {dt_str} {h} — {vend_str} ({mod})")
        if len(ags) > 15:
            linhas.append(f"... e mais {len(ags) - 15}")
    else:
        linhas.append("")
        linhas.append("_Nenhum agendamento criado hoje._")

    return "\n".join(linhas)


# ─────────────────────────────────────────────────────────────────────────
# 2) Performance dos SDRs
# ─────────────────────────────────────────────────────────────────────────
async def _msg_sdr() -> str:
    from app.core.teca_v2.tools import _supabase_rest

    hoje = _today_str()

    # cards criados hoje no comercial-entrada
    cards = await _supabase_rest(
        "GET", "kanban_cards",
        params={
            "select": "id,column_id,created_at,updated_at,details",
            "dept_id": "eq.comercial-entrada",
            "created_at": f"gte.{hoje}T00:00:00",
        },
    ) or []

    # resolve column_id (uuid ou slug) → slug
    cols = await _supabase_rest(
        "GET", "kanban_columns",
        params={"select": "id,slug", "dept_id": "eq.comercial-entrada"},
    ) or []
    col_id_to_slug = {c.get("id"): c.get("slug") for c in cols if c.get("id")}

    def _slug_of(col_id):
        if not col_id:
            return ""
        return col_id_to_slug.get(col_id) or str(col_id)

    QUAL_SLUGS = {"qualificado-ia", "qualificado", "em-qualificacao", "em-qualificacao-2"}
    AGENDADO_SLUGS = {"agendado"}

    # agendamentos hoje pra cross-ref por sdr (cards criados hoje que viraram agendamento)
    ags_hoje = await _supabase_rest(
        "GET", "agendamentos",
        params={
            "select": "card_id",
            "created_at": f"gte.{hoje}T00:00:00",
        },
    ) or []
    cards_agendados = {a.get("card_id") for a in ags_hoje if a.get("card_id")}

    linhas = [
        "👥 *SDR — PERFORMANCE DO DIA*",
        f"📅 {_today_br()}",
        "━━━━━━━━━━━━━━━━━━━━━",
        "",
    ]

    for sdr in SDRS:
        do_sdr = [c for c in cards if (c.get("details") or {}).get("sdr") == sdr]
        leads = len(do_sdr)
        qualif = sum(1 for c in do_sdr if _slug_of(c.get("column_id")) in QUAL_SLUGS)
        agendou = sum(1 for c in do_sdr if c.get("id") in cards_agendados or _slug_of(c.get("column_id")) in AGENDADO_SLUGS)
        tx = (agendou / leads * 100) if leads else 0
        linhas.append(f"• *{sdr}*")
        linhas.append(f"   📥 {leads} leads  |  ✅ {qualif} qualif  |  📅 {agendou} agendou ({tx:.0f}%)")
        linhas.append("")

    # total geral
    leads_all = sum(1 for c in cards if (c.get("details") or {}).get("sdr") in SDRS)
    qualif_all = sum(1 for c in cards if (c.get("details") or {}).get("sdr") in SDRS and _slug_of(c.get("column_id")) in QUAL_SLUGS)
    agendou_all = sum(1 for c in cards if (c.get("details") or {}).get("sdr") in SDRS and (c.get("id") in cards_agendados or _slug_of(c.get("column_id")) in AGENDADO_SLUGS))
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append(f"📊 *Total*: {leads_all} leads  |  {qualif_all} qualif  |  {agendou_all} agendou")

    return "\n".join(linhas)


# ─────────────────────────────────────────────────────────────────────────
# 3) Performance Comercial (funil, ganhos, pipeline 7 dias)
# ─────────────────────────────────────────────────────────────────────────
async def _msg_performance() -> str:
    from app.core.teca_v2.tools import _supabase_rest

    hoje = _today_str()
    hoje_dt = date.fromisoformat(hoje)
    em7 = (hoje_dt + timedelta(days=7)).isoformat()

    cards = await _supabase_rest(
        "GET", "kanban_cards",
        params={
            "select": "id,column_id,value,created_at,updated_at",
            "dept_id": "eq.comercial-entrada",
        },
    ) or []
    cols = await _supabase_rest(
        "GET", "kanban_columns",
        params={"select": "id,slug", "dept_id": "eq.comercial-entrada"},
    ) or []
    col_id_to_slug = {c.get("id"): c.get("slug") for c in cols if c.get("id")}

    def _slug_of(col_id):
        if not col_id:
            return ""
        return col_id_to_slug.get(col_id) or str(col_id)

    def _is_today_iso(ts):
        return (ts or "").startswith(hoje)

    entrada_hoje = sum(1 for c in cards if _is_today_iso(c.get("created_at")))
    qualif_hoje = sum(
        1 for c in cards
        if _is_today_iso(c.get("updated_at"))
        and _slug_of(c.get("column_id")) in {"qualificado", "qualificado-ia", "em-qualificacao-2"}
    )
    agendado_atual = sum(1 for c in cards if _slug_of(c.get("column_id")) == "agendado")
    ganhos_hoje = [c for c in cards if _is_today_iso(c.get("updated_at")) and _slug_of(c.get("column_id")) == "ganho"]
    valor_ganho = sum(float(c.get("value") or 0) for c in ganhos_hoje)

    # pipeline próximos 7 dias (agendamentos)
    ags = await _supabase_rest(
        "GET", "agendamentos",
        params={
            "select": "data,status",
            "data": f"gte.{hoje}",
            "and": f"(data.lte.{em7})",
        },
    ) or []
    pipe7 = sum(1 for a in ags if a.get("status") in ("agendado", "reagendado"))

    tx_qualif = (qualif_hoje / entrada_hoje * 100) if entrada_hoje else 0

    linhas = [
        "💼 *PERFORMANCE COMERCIAL*",
        f"📅 {_today_br()}",
        "━━━━━━━━━━━━━━━━━━━━━",
        "",
        "🎯 *Funil de hoje:*",
        f"   📥 Leads entrada: *{entrada_hoje}*",
        f"   ✅ Qualificados: *{qualif_hoje}* ({tx_qualif:.0f}%)",
        f"   📅 Em Agendado (atual): *{agendado_atual}*",
        f"   🏆 Ganhos: *{len(ganhos_hoje)}*  —  {_brl(valor_ganho)}",
        "",
        "📅 *Pipeline próximos 7 dias:*",
        f"   • {pipe7} agendamentos confirmados",
    ]
    return "\n".join(linhas)


# ─────────────────────────────────────────────────────────────────────────
# Cron principal
# ─────────────────────────────────────────────────────────────────────────
async def enviar_relatorio_comercial_hb():
    """Roda às 21h SP e envia 3 mensagens no grupo comercial."""
    try:
        from app.core.evolution_client import evolution_client
        from app.core.teka_agent import COMERCIAL_GROUP_ID
    except Exception as e:
        logger.error("relatorio_comercial_hb: import falhou: %s", e)
        return

    try:
        m1 = await _msg_agendamentos_teca()
        await evolution_client.send_text(COMERCIAL_GROUP_ID, m1)
        await asyncio.sleep(2)

        m2 = await _msg_sdr()
        await evolution_client.send_text(COMERCIAL_GROUP_ID, m2)
        await asyncio.sleep(2)

        m3 = await _msg_performance()
        await evolution_client.send_text(COMERCIAL_GROUP_ID, m3)

        logger.info("relatorio_comercial_hb enviado com sucesso (3 mensagens)")
    except Exception as e:
        logger.error("relatorio_comercial_hb falhou: %s", e, exc_info=True)
