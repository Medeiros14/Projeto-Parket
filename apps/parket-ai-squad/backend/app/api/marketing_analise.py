"""
MARKETING — análise IA da qualidade dos leads (relatório de Marketing do Homebroker).

POST /api/hb-ia/marketing-analise {dias} →
  coleta leads do comercial-entrada no período (com contexto de conversa WhatsApp),
  agendamentos e gasto Meta; Claude avalia a qualidade dos leads que estão CHEGANDO
  e dos que estão AGENDANDO; persiste em marketing_lead_analises (PG local via /rest).

O frontend lê a última análise direto da tabela; este endpoint só GERA.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.hb_copilot import _ask_claude, _extract_json
from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/hb-ia", tags=["hb-ia"])

# Brasil sem DST desde 2019 — offset fixo evita depender de tzdata no container.
TZ_BR = timezone(timedelta(hours=-3))

MAX_LEADS_DETALHADOS = 60
MAX_MSGS_POR_LEAD = 6


class MarketingAnaliseInput(BaseModel):
    dias: int = 7  # 0 = só hoje


class MarketingAnaliseOutput(BaseModel):
    id: str
    dias: int
    since_date: str
    analise: dict
    leads_total: int
    qualificados: int
    agendamentos: int
    created_at: str


def _rest_headers() -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


async def _rest_get(c: httpx.AsyncClient, table: str, params: dict) -> list[dict]:
    r = await c.get(f"{settings.SUPABASE_URL}/rest/v1/{table}",
                    headers=_rest_headers(), params=params)
    if r.status_code != 200:
        raise HTTPException(502, f"REST {table} HTTP {r.status_code}: {r.text[:200]}")
    return r.json() or []


async def _rest_count(c: httpx.AsyncClient, table: str, filters: dict) -> int:
    """HEAD-count exato (não sujeito a limit padrão do PostgREST). Usa header
    Range: 0-0 + Prefer: count=exact — retorna só Content-Range 'X-Y/TOTAL'.
    Crítico pra bater com o painel: sem isso os totais ficavam presos no
    limite da query que trazia a amostra (200 linhas → IA achava que 200
    eram o universo total, contradizia o painel que mostra 800+)."""
    r = await c.get(
        f"{settings.SUPABASE_URL}/rest/v1/{table}",
        headers={**_rest_headers(), "Prefer": "count=exact", "Range": "0-0"},
        params={**filters, "select": "id"},
    )
    if r.status_code not in (200, 206):
        raise HTTPException(502, f"REST count {table} HTTP {r.status_code}: {r.text[:200]}")
    cr = r.headers.get("Content-Range", "*/0")
    try:
        return int(cr.rsplit("/", 1)[-1])
    except (ValueError, IndexError):
        return 0


def _fmt_msgs(msgs: list[dict]) -> str:
    lines = []
    for m in msgs[-MAX_MSGS_POR_LEAD:]:
        who = "CLIENTE" if m.get("direction") == "in" else "PARKET"
        txt = (m.get("message_text") or "").strip().replace("\n", " ")[:200]
        if txt:
            lines.append(f"    {who}: {txt}")
    return "\n".join(lines) if lines else "    (sem conversa registrada)"


def _fmt_lead(card: dict, msgs: list[dict], agend: dict | None) -> str:
    det = card.get("details") or {}
    if not isinstance(det, dict):
        det = {}
    ia = det.get("ia_analise") or {}
    campanha = (det.get("campaign_name")
                or (det.get("attribution") or {}).get("utm_campaign")
                or det.get("origem") or "?")
    partes = [
        f"- {card.get('title') or '?'} | etapa: {card.get('column_id')}"
        f" | origem/campanha: {campanha}",
        f"  cidade: {det.get('cidade') or '?'} | produto: {det.get('produto_interesse') or det.get('produto') or '?'}"
        f" | metragem: {det.get('area_m2') or det.get('metragem') or '?'} m²"
        f" | perfil: {det.get('perfil') or '?'}",
    ]
    if ia:
        partes.append(f"  triagem IA individual: {ia.get('nivel', '?')} (score {ia.get('score', '?')}) — {str(ia.get('motivo') or '')[:140]}")
    if agend:
        partes.append(f"  AGENDOU: {agend.get('modalidade', '?')} em {agend.get('data', '?')} com {agend.get('vendedor', '?')} (status {agend.get('status', '?')})")
    partes.append("  conversa recente:")
    partes.append(_fmt_msgs(msgs))
    return "\n".join(partes)


SYSTEM_PROMPT = """Você é um analista sênior de marketing e vendas da Parket (madeira nobre —
pisos, decks, painéis, portas, marcenaria sob medida; ticket típico R$30k-500k; showroom em SP).

Você vai receber os leads que CHEGARAM no período no funil de entrada do comercial, com o
contexto de conversa de WhatsApp de cada um, quem qualificou/desqualificou, quem AGENDOU
visita/reunião, e o gasto de mídia do período.

Sua tarefa é avaliar a QUALIDADE dos leads, respondendo principalmente:
1. Como está a qualidade dos leads que estão CHEGANDO? (fit de produto, metragem, cidade,
   perfil, engajamento real na conversa — não só volume)
2. Como está a qualidade dos que estão AGENDANDO visita/reunião? (são os leads certos?)
3. Que padrões aparecem nas conversas? (objeções comuns, leads só pesquisando preço,
   campanhas trazendo lead ruim, demora de resposta do time, etc.)

Seja concreto e cite exemplos pelos nomes dos leads quando relevante. Escreva em português
brasileiro, direto, pra um gestor comercial ler em 1 minuto.

REGRA DE NÚMEROS (crítica):
Use SEMPRE os totais oficiais que aparecem no bloco "NÚMEROS OFICIAIS DO PAINEL DE MARKETING"
do prompt do usuário — esses batem exatamente com o painel que o gestor está olhando.
A lista de leads que vem depois é uma AMOSTRA (60 mais recentes) só pra você ler CONVERSAS.
NUNCA calcule "N leads chegaram" a partir do tamanho da amostra. Se falar em taxa
(ex.: "X% dos leads chegam sem produto"), use fração sobre o TOTAL do período, não sobre
a amostra. Se contar exemplos concretos ("como Erika Terenzi, Luiz Lopes..."), deixe claro
que são casos representativos, não o universo. Contradizer os totais do painel quebra a
confiança do gestor.

RESPONDA APENAS COM JSON VÁLIDO (sem markdown, sem texto extra) no formato:
{
  "resumo": "parágrafo executivo de 3-5 frases sobre o período",
  "nota_qualidade": 0-100,
  "leads_chegando": "avaliação da qualidade de quem está chegando (2-4 frases)",
  "leads_agendando": "avaliação da qualidade de quem está agendando (2-4 frases; se ninguém agendou, diga isso)",
  "padroes": ["padrão observado 1", "padrão 2", "..."],
  "alertas": ["problema que merece atenção imediata", "..."],
  "recomendacoes": ["ação concreta pro time de marketing/SDR", "..."]
}"""


@router.post("/marketing-analise", response_model=MarketingAnaliseOutput)
async def gerar_marketing_analise(payload: MarketingAnaliseInput):
    dias = max(0, min(90, payload.dias))
    agora_br = datetime.now(TZ_BR)
    meia_noite = agora_br.replace(hour=0, minute=0, second=0, microsecond=0)
    since_dt = meia_noite - timedelta(days=dias)
    since_iso = since_dt.isoformat()
    since_date = since_dt.date().isoformat()

    async with httpx.AsyncClient(timeout=30.0) as c:
        # TOTAIS via count exato (não sujeitos a limit) — batem com o painel do Marketing.
        # Painel: `all.filter(c => inRange(c.created_at))` sobre TODOS os cards do dept.
        leads_total = await _rest_count(c, "kanban_cards", {
            "dept_id": "eq.comercial-entrada",
            "created_at": f"gte.{since_iso}",
        })
        qualificados = await _rest_count(c, "kanban_cards", {
            "dept_id": "eq.comercial-entrada",
            "column_id": "eq.qualificado",
            "created_at": f"gte.{since_iso}",
        })
        nao_qualificados = await _rest_count(c, "kanban_cards", {
            "dept_id": "eq.comercial-entrada",
            "column_id": "eq.nao-qualificado",
            "created_at": f"gte.{since_iso}",
        })
        agendamentos_total = await _rest_count(c, "agendamentos", {
            "created_at": f"gte.{since_iso}",
        })

        # AMOSTRA pra dar contexto qualitativo ao Claude (60 mais recentes).
        # NÃO é usada pra estatística — só pra ler conversas e nomes concretos.
        detalhados = await _rest_get(c, "kanban_cards", {
            "dept_id": "eq.comercial-entrada",
            "created_at": f"gte.{since_iso}",
            "select": "id,title,column_id,created_at,details",
            "order": "created_at.desc",
            "limit": str(MAX_LEADS_DETALHADOS),
        })
        # Distribuição por etapa: paginar tudo pra bater com o painel.
        # PostgREST tem max-rows ~1000 — paginamos até esgotar.
        cards_para_etapa: list[dict] = []
        PAGE = 1000
        for offset in range(0, 10000, PAGE):
            page = await _rest_get(c, "kanban_cards", {
                "dept_id": "eq.comercial-entrada",
                "created_at": f"gte.{since_iso}",
                "select": "id,column_id",
                "order": "created_at.desc",
                "offset": str(offset),
                "limit": str(PAGE),
            })
            cards_para_etapa.extend(page)
            if len(page) < PAGE:
                break
        agends = await _rest_get(c, "agendamentos", {
            "created_at": f"gte.{since_iso}",
            "select": "card_id,vendedor,cliente_nome,data,modalidade,status",
            "limit": "1000",
        })
        insights = await _rest_get(c, "marketing_ads_insights", {
            "date": f"gte.{since_date}",
            "select": "spend,leads_meta,campaign_name",
        })

        msgs_por_card: dict[str, list[dict]] = {}
        if detalhados:
            ids = ",".join(x["id"] for x in detalhados)
            msgs = await _rest_get(c, "whatsapp_messages", {
                "card_id": f"in.({ids})",
                "select": "card_id,direction,message_text,timestamp",
                "order": "timestamp.asc",
                "limit": "3000",
            })
            for m in msgs:
                msgs_por_card.setdefault(m["card_id"], []).append(m)

    agend_por_card = {a["card_id"]: a for a in agends if a.get("card_id")}
    por_etapa: dict[str, int] = {}
    for card in cards_para_etapa:
        por_etapa[card["column_id"]] = por_etapa.get(card["column_id"], 0) + 1
    gasto = sum(float(r.get("spend") or 0) for r in insights)

    etapas_txt = ", ".join(f"{k}: {v}" for k, v in sorted(por_etapa.items(), key=lambda x: -x[1]))
    leads_txt = "\n\n".join(
        _fmt_lead(card, msgs_por_card.get(card["id"], []), agend_por_card.get(card["id"]))
        for card in detalhados
    ) or "(nenhum lead no período)"
    amostra_nota = (
        f"(amostra dos {len(detalhados)} leads mais recentes de {leads_total} totais — "
        f"os totais acima cobrem TODO o período)"
        if leads_total > len(detalhados) else ""
    )

    periodo_lbl = "hoje" if dias == 0 else f"últimos {dias} dias"
    cpl = (gasto / leads_total) if leads_total > 0 else 0
    if leads_total > 0:
        user_prompt = f"""PERÍODO: {periodo_lbl} (desde {since_date})

NÚMEROS OFICIAIS DO PAINEL DE MARKETING (use SEMPRE estes números — não estime a partir da amostra):
- Total de leads que chegaram no funil de entrada: {leads_total}
- Distribuição por etapa atual: {etapas_txt or "-"}
- Qualificados no período: {qualificados}
- Não-qualificados no período: {nao_qualificados}
- Agendamentos criados no período: {agendamentos_total}
- Gasto em mídia Meta (todos canais): R$ {gasto:,.0f}
- CPL (Custo por Lead) geral: R$ {cpl:,.0f}

IMPORTANTE: os números acima são os TOTAIS DO PERÍODO INTEIRO, iguais aos que o gestor vê
no painel do Marketing. A lista de leads abaixo é uma AMOSTRA (últimos {len(detalhados)})
usada só pra você ler o CONTEÚDO das conversas — nunca calcule estatística a partir dela
nem cite "N leads" com N diferente do total acima."""
    else:
        user_prompt = f"""PERÍODO: {periodo_lbl} (desde {since_date})

Nenhum lead chegou no período. Gasto em mídia Meta: R$ {gasto:,.0f}."""
    user_prompt += f"""

LEADS DO PERÍODO (amostra pra contexto qualitativo de conversas): {amostra_nota}

{leads_txt}"""

    try:
        resp = await _ask_claude(SYSTEM_PROMPT, user_prompt)
        analise = _extract_json(resp)
    except Exception as e:
        logger.error("marketing_analise_claude_failed", error=str(e)[:300])
        raise HTTPException(500, f"Análise falhou: {str(e)[:200]}")

    nota = analise.get("nota_qualidade")
    analise["nota_qualidade"] = int(max(0, min(100, nota))) if isinstance(nota, (int, float)) else None

    row = {
        "dias": dias,
        "since_date": since_date,
        "analise": analise,
        "leads_total": leads_total,
        "qualificados": qualificados,
        "agendamentos": agendamentos_total,
        "modelo": "claude (account_pool)",
    }
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.post(
            f"{settings.SUPABASE_URL}/rest/v1/marketing_lead_analises",
            headers={**_rest_headers(), "Prefer": "return=representation"},
            json=row,
        )
        if r.status_code not in (200, 201):
            logger.warning("marketing_analise_persist_failed", status=r.status_code, body=r.text[:200])
            saved = {**row, "id": "", "created_at": datetime.now(timezone.utc).isoformat()}
        else:
            saved = r.json()[0]

    return MarketingAnaliseOutput(
        id=str(saved.get("id") or ""),
        dias=dias,
        since_date=since_date,
        analise=analise,
        leads_total=leads_total,
        qualificados=qualificados,
        agendamentos=agendamentos_total,
        created_at=str(saved.get("created_at") or ""),
    )
