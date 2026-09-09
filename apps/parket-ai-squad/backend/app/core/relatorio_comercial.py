"""
Relatório Diário do Funil Comercial de Entrada
===============================================
Envia às 21h no grupo Parket — Comercial (mesmo grupo onde a TEKA notifica
novas oportunidades e escalações) um resumo do dia:

- Conversas iniciadas (cards criados hoje no dept comercial-entrada)
- Leads movidos para "Novas Oportunidades"
- Leads movidos para "Em Qualificação"
- Taxa de conversão em cada etapa
- Fontes dos leads (origem)
- Sugestão de melhoria comercial e das fontes (gerada por Gemini)
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger("relatorio_comercial")

SP_TZ = ZoneInfo("America/Sao_Paulo")


def _parse_ts(value: str) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=SP_TZ)
        return dt.astimezone(SP_TZ)
    except Exception:
        return None


def _is_today(ts: datetime | None, start: datetime, end: datetime) -> bool:
    return ts is not None and start <= ts < end


def _collect_metrics(sb, start: datetime, end: datetime) -> dict:
    """Lê todos os cards do dept comercial-entrada e apura as métricas do dia."""
    resp = (
        sb.table("kanban_cards")
        .select("id,title,column_id,created_at,details")
        .eq("dept_id", "comercial-entrada")
        .execute()
    )
    cards = resp.data or []

    iniciadas = 0
    qualificadas = 0  # movidas hoje para Novas Oportunidades
    em_qualificacao = 0  # movidas hoje para Em Qualificação
    escaladas_humano = 0
    timeouts = 0
    respondentes = 0  # cards iniciados hoje que tiveram resposta do cliente
    msgs_cliente_total = 0
    msgs_teka_total = 0

    fontes: dict[str, int] = {}
    cidades: dict[str, int] = {}
    produtos: dict[str, int] = {}
    faixas: dict[str, int] = {}
    motivos_escalacao: list[str] = []

    for card in cards:
        det = card.get("details", {}) or {}

        # Iniciadas hoje: teka_inicio no período ou created_at no período
        inicio_ts = _parse_ts(det.get("teka_inicio", "")) or _parse_ts(card.get("created_at", ""))
        foi_iniciada_hoje = _is_today(inicio_ts, start, end)
        if foi_iniciada_hoje:
            iniciadas += 1
            origem = (det.get("origem") or "desconhecida").lower()
            fontes[origem] = fontes.get(origem, 0) + 1

            cidade = det.get("cidade") or "—"
            cidades[cidade] = cidades.get(cidade, 0) + 1

            produto = det.get("produto_interesse") or "—"
            produtos[produto] = produtos.get(produto, 0) + 1

            faixa = det.get("faixa_investimento") or "—"
            faixas[faixa] = faixas.get(faixa, 0) + 1

            # Cliente respondeu?
            msgs = det.get("mensagens_ia") or []
            if any(m.get("de") == "cliente" for m in msgs):
                respondentes += 1
            msgs_cliente_total += sum(1 for m in msgs if m.get("de") == "cliente")
            msgs_teka_total += sum(1 for m in msgs if m.get("de") == "teka")

        # Movimentações hoje (encerramentos do TEKA)
        encerrado_ts = _parse_ts(det.get("teka_encerrado", ""))
        if _is_today(encerrado_ts, start, end):
            etapa = det.get("teka_etapa", "")
            status = det.get("status_lead", "")
            col = card.get("column_id", "")

            if etapa == "qualificado" or col == "qualificado":
                qualificadas += 1
            elif etapa == "escalado_humano" or status == "escalado_atendente":
                escaladas_humano += 1
                motivo = det.get("motivo_escalacao") or ""
                if motivo:
                    motivos_escalacao.append(motivo[:160])
                if col == "em-qualificacao":
                    em_qualificacao += 1
            elif etapa == "timeout_followup":
                timeouts += 1
                if col == "em-qualificacao":
                    em_qualificacao += 1
            elif col == "em-qualificacao":
                em_qualificacao += 1

    def pct(n, d):
        return (100.0 * n / d) if d else 0.0

    return {
        "iniciadas": iniciadas,
        "qualificadas": qualificadas,
        "em_qualificacao": em_qualificacao,
        "escaladas_humano": escaladas_humano,
        "timeouts": timeouts,
        "respondentes": respondentes,
        "msgs_cliente_total": msgs_cliente_total,
        "msgs_teka_total": msgs_teka_total,
        "taxa_resposta_pct": pct(respondentes, iniciadas),
        "taxa_qualificacao_pct": pct(qualificadas, iniciadas),
        "taxa_em_qualificacao_pct": pct(em_qualificacao, iniciadas),
        "taxa_escalacao_pct": pct(escaladas_humano, iniciadas),
        "taxa_timeout_pct": pct(timeouts, iniciadas),
        "fontes": fontes,
        "cidades": cidades,
        "produtos": produtos,
        "faixas": faixas,
        "motivos_escalacao": motivos_escalacao,
    }


async def _gerar_sugestoes_ia(metricas: dict) -> tuple[str, str]:
    """Chama Gemini para sugerir melhorias no atendimento comercial e nas fontes."""
    from app.config import settings
    from app.core.llm_client import GeminiClient

    api_key = getattr(settings, "GEMINI_API_KEY", "") or ""
    if not api_key:
        return (
            "_(Sugestões IA indisponíveis: GEMINI_API_KEY não configurada.)_",
            "",
        )

    def top(d: dict, n: int = 5) -> str:
        items = sorted(d.items(), key=lambda x: -x[1])[:n]
        return ", ".join(f"{k} ({v})" for k, v in items) or "—"

    prompt = f"""Você é consultor comercial da Parket (pisos de madeira engenheirada e laminados para obras residenciais e comerciais de alto padrão). Analise as métricas do funil de entrada de HOJE e devolva duas recomendações bem curtas e acionáveis, em português formal brasileiro, SEM jargão e SEM listas enormes.

MÉTRICAS DO DIA:
- Conversas iniciadas: {metricas['iniciadas']}
- Respondidas pelo lead: {metricas['respondentes']} ({metricas['taxa_resposta_pct']:.0f}%)
- Mensagens totais do cliente: {metricas['msgs_cliente_total']}
- Mensagens totais da TEKA: {metricas['msgs_teka_total']}
- Qualificadas (Novas Oportunidades): {metricas['qualificadas']} ({metricas['taxa_qualificacao_pct']:.0f}%)
- Em Qualificação (atendente): {metricas['em_qualificacao']} ({metricas['taxa_em_qualificacao_pct']:.0f}%)
- Escaladas para humano: {metricas['escaladas_humano']} ({metricas['taxa_escalacao_pct']:.0f}%)
- Timeouts sem resposta: {metricas['timeouts']} ({metricas['taxa_timeout_pct']:.0f}%)

FONTES dos leads: {top(metricas['fontes'])}
CIDADES: {top(metricas['cidades'])}
PRODUTOS de interesse: {top(metricas['produtos'])}
FAIXAS de investimento: {top(metricas['faixas'])}
MOTIVOS de escalação: {'; '.join(metricas['motivos_escalacao'][:3]) or '—'}

Responda estritamente neste formato (sem markdown, sem bullets, sem asteriscos):

COMERCIAL: <uma recomendação de melhoria no atendimento/qualificação da TEKA ou no handoff para vendedor, em até 2 frases>
FONTES: <uma recomendação sobre captação/qualidade das fontes de lead, em até 2 frases>
"""
    try:
        gemini = GeminiClient(api_key=api_key, model="gemini-2.5-flash")
        resp = await gemini.chat([{"role": "user", "content": prompt}])
        texto = (resp or "").strip()

        comercial = ""
        fontes = ""
        for line in texto.splitlines():
            line = line.strip()
            if line.upper().startswith("COMERCIAL:"):
                comercial = line.split(":", 1)[1].strip()
            elif line.upper().startswith("FONTES:"):
                fontes = line.split(":", 1)[1].strip()
        if not comercial and not fontes:
            # Fallback: usa o texto bruto
            comercial = texto[:300]
        return comercial or "—", fontes or "—"
    except Exception as e:
        logger.warning(f"sugestoes_ia_falhou: {e}")
        return f"_(Sugestões IA indisponíveis: {str(e)[:120]})_", ""


def _fmt_dict(d: dict, top_n: int = 5) -> list[str]:
    if not d:
        return ["  _(sem dados)_"]
    items = sorted(d.items(), key=lambda x: -x[1])[:top_n]
    total = sum(d.values()) or 1
    out = []
    for k, v in items:
        pct = 100.0 * v / total
        out.append(f"  • {k}: *{v}* ({pct:.0f}%)")
    return out


async def formatar_relatorio_comercial(sb) -> tuple[str, dict]:
    agora = datetime.now(SP_TZ)
    start = agora.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    m = _collect_metrics(sb, start, end)

    comercial_sug, fontes_sug = await _gerar_sugestoes_ia(m)

    DIAS_PT = {
        "Monday": "Segunda", "Tuesday": "Terça", "Wednesday": "Quarta",
        "Thursday": "Quinta", "Friday": "Sexta", "Saturday": "Sábado", "Sunday": "Domingo",
    }
    dia_semana = DIAS_PT.get(agora.strftime("%A"), agora.strftime("%A"))

    linhas = []
    linhas.append("📊 *RELATÓRIO DIÁRIO — FUNIL COMERCIAL DE ENTRADA*")
    linhas.append(f"📅 {agora.strftime('%d/%m/%Y')} — {dia_semana}")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("")

    linhas.append("*VOLUME DO DIA*")
    linhas.append(f"  🟢 Conversas iniciadas: *{m['iniciadas']}*")
    linhas.append(f"  💬 Leads que responderam: *{m['respondentes']}*")
    linhas.append(f"  ⭐ Novas Oportunidades: *{m['qualificadas']}*")
    linhas.append(f"  📋 Em Qualificação: *{m['em_qualificacao']}*")
    if m["escaladas_humano"]:
        linhas.append(f"  🚨 Escaladas p/ humano: *{m['escaladas_humano']}*")
    if m["timeouts"]:
        linhas.append(f"  ⏱ Timeouts (sem resposta): *{m['timeouts']}*")
    linhas.append("")

    linhas.append("*TAXAS DE CONVERSÃO*")
    linhas.append(f"  • Iniciada → Respondida: *{m['taxa_resposta_pct']:.0f}%*")
    linhas.append(f"  • Iniciada → Nova Oportunidade: *{m['taxa_qualificacao_pct']:.0f}%*")
    linhas.append(f"  • Iniciada → Em Qualificação: *{m['taxa_em_qualificacao_pct']:.0f}%*")
    if m["iniciadas"]:
        linhas.append(f"  • Escalação para humano: *{m['taxa_escalacao_pct']:.0f}%*")
        linhas.append(f"  • Timeout sem resposta: *{m['taxa_timeout_pct']:.0f}%*")
    linhas.append("")

    linhas.append("*FONTES DO LEAD*")
    linhas.extend(_fmt_dict(m["fontes"]))
    linhas.append("")

    linhas.append("*PRODUTOS DE INTERESSE*")
    linhas.extend(_fmt_dict(m["produtos"]))
    linhas.append("")

    linhas.append("*CIDADES*")
    linhas.extend(_fmt_dict(m["cidades"]))
    linhas.append("")

    linhas.append("*💡 SUGESTÕES IA*")
    linhas.append(f"▸ Comercial: {comercial_sug}")
    if fontes_sug:
        linhas.append(f"▸ Fontes: {fontes_sug}")
    linhas.append("")

    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("🔗 dashboard.parket.works")

    return "\n".join(linhas), m


async def enviar_relatorio_comercial():
    """Cron job: roda às 21h SP e envia o relatório no grupo comercial."""
    from supabase import create_client
    from app.config import settings
    from app.core.evolution_client import evolution_client
    from app.core.teka_agent import COMERCIAL_GROUP_ID

    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        texto, metricas = await formatar_relatorio_comercial(sb)
        # Sempre enviar pelo cliente padrão (Parket) — grupo pertence a essa instância.
        await evolution_client.send_long_text(COMERCIAL_GROUP_ID, texto)
        logger.info(
            f"relatorio_comercial_sent chars={len(texto)} "
            f"iniciadas={metricas['iniciadas']} "
            f"qualificadas={metricas['qualificadas']} "
            f"em_qualificacao={metricas['em_qualificacao']}"
        )
    except Exception as e:
        logger.error(f"relatorio_comercial_error: {e}", exc_info=True)
