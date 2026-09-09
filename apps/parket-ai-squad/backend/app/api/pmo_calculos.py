"""
PMO — Agente de Cálculo de Prazo de Obra
==========================================
Agente de IA que calcula automaticamente o cronograma de obra em dias úteis
baseado na Tabela de Rendimento Padrão da Parket.

Ativado automaticamente quando um projeto chega ao setor PMO/Produtividade.
O agente lê as informações do projeto, interpreta via Claude os serviços e
metragens, calcula o prazo total e atualiza o kanban_card no Supabase.
"""

import math
import json
import httpx
import structlog
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.core.evolution_client import evolution_client

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/pmo", tags=["pmo"])

# ─── Tabela de Rendimento Padrão ────────────────────────────────────────────
# Fonte: "Tempo Padrão de obra - Transformar em planilha.csv"
# Fórmula: dias_necessarios = ceil(quantidade / rendimento_por_dia)

RENDIMENTO: list[dict] = [
    {"servico": "FORRO BARROTE",                       "rendimento": 30,   "unidade": "M²"},
    {"servico": "FORRO REVESTIMENTO RETA",             "rendimento": 15,   "unidade": "M²"},
    {"servico": "FORRO REVESTIMENTO RIPADO/TOBLERONE", "rendimento": 10,   "unidade": "M²"},
    {"servico": "PAINEL ESTRUTURA",                    "rendimento": 30,   "unidade": "M²"},
    {"servico": "PAINEL RIPADO/TOBLERONE",             "rendimento": 20,   "unidade": "M²"},
    {"servico": "PAINEL CARVALHO RETA",                "rendimento": 30,   "unidade": "M²"},
    {"servico": "PISO INSTALAÇÃO RETA",                "rendimento": 25,   "unidade": "M²"},
    {"servico": "PISO ESCAMA DE PEIXE",                "rendimento": 15,   "unidade": "M²"},
    {"servico": "PISO MACIÇO",                         "rendimento": 20,   "unidade": "M²"},
    {"servico": "PISO CHEVRON",                        "rendimento": 15,   "unidade": "M²"},
    {"servico": "PISO VERSAILLES",                     "rendimento": 10,   "unidade": "M²"},
    {"servico": "CORTINEIRO",                          "rendimento": 10,   "unidade": "M²"},
    {"servico": "SANCA/REFORÇO ESTRUTURA",             "rendimento": 10,   "unidade": "M²"},
    {"servico": "ESTRUTURA DECK",                      "rendimento": 30,   "unidade": "M²"},
    {"servico": "DECK",                                "rendimento": 20,   "unidade": "M²"},
    {"servico": "ESCADA",                              "rendimento": 2,    "unidade": "M²"},
    {"servico": "PERGOLADO",                           "rendimento": 4.16, "unidade": "M²"},
    {"servico": "BANCO",                               "rendimento": 12,   "unidade": "M²"},
    {"servico": "IMPERMEABILIZAÇÃO",                   "rendimento": 100,  "unidade": "M²"},
    {"servico": "SELADORA",                            "rendimento": 100,  "unidade": "M²"},
    {"servico": "ACABAMENTO",                         "rendimento": 100,  "unidade": "M²"},
    {"servico": "RASPAGEM/REVITALIZAÇÃO/LIXAMENTO",    "rendimento": 100,  "unidade": "M²"},
    {"servico": "RECORTES DIVERSOS",                   "rendimento": 10,   "unidade": "M²"},
    {"servico": "RECORTES DE GRELHAS",                 "rendimento": 30,   "unidade": "M²"},
    {"servico": "RECORTES DE LUMINÁRIAS",              "rendimento": 20,   "unidade": "M²"},
    {"servico": "ALÇAPÃO",                             "rendimento": 10,   "unidade": "M²"},
    {"servico": "RODAPÉ",                              "rendimento": 50,   "unidade": "ML"},
    {"servico": "REMOÇÃO DO FORRO",                    "rendimento": 30,   "unidade": "M²"},
    {"servico": "REMOÇÃO DO PISO",                     "rendimento": 6,    "unidade": "M²"},
    {"servico": "REGULARIZAÇÃO CONTRA PISO",           "rendimento": 10,   "unidade": "M²"},
    {"servico": "TABEIRA",                             "rendimento": 50,   "unidade": "ML"},
    {"servico": "PORTA PIVOTANTE",                     "rendimento": 2,    "unidade": "UNIDADE"},
    {"servico": "PORTA DE CORRER (TRILHOS)",           "rendimento": 2,    "unidade": "UNIDADE"},
    {"servico": "PORTA DE CORRER",                     "rendimento": 2,    "unidade": "UNIDADE"},
    {"servico": "PORTA DE ABRIR",                      "rendimento": 1,    "unidade": "UNIDADE"},
    {"servico": "PORTA CAMARÃO",                       "rendimento": 2,    "unidade": "UNIDADE"},
    {"servico": "PORTA COM BATENTE E GUARNIÇÃO",       "rendimento": 4,    "unidade": "UNIDADE"},
]

# Índice para lookup rápido
RENDIMENTO_MAP = {r["servico"]: r for r in RENDIMENTO}

# Grupo WhatsApp PMO/Produtividade
PMO_GROUP_ID = "120363405460675664@g.us"

# Supabase helpers
SUPABASE_URL = settings.SUPABASE_URL
SERVICE_KEY  = settings.SUPABASE_SERVICE_KEY


def _sb_headers() -> dict:
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# ─── Lógica de cálculo ───────────────────────────────────────────────────────

def calcular_dias(servico: str, quantidade: float) -> float:
    """Dias úteis necessários para um serviço."""
    r = RENDIMENTO_MAP.get(servico.upper().strip())
    if not r or r["rendimento"] <= 0:
        return 0.0
    return quantidade / r["rendimento"]


def dias_uteis_totais(itens: list[dict]) -> int:
    """
    Recebe lista de {servico, quantidade} e retorna total em dias úteis.
    Serviços em paralelo seriam somados; aqui tratamos como sequencial (soma simples).
    """
    total = sum(calcular_dias(i["servico"], float(i.get("quantidade", 0))) for i in itens)
    return max(1, math.ceil(total))


# ─── Schemas ────────────────────────────────────────────────────────────────

class ServicoItem(BaseModel):
    servico: str
    quantidade: float
    unidade: Optional[str] = None


class CalcularPrazoPayload(BaseModel):
    card_id: str
    previsao_inicio: Optional[str] = None   # "YYYY-MM-DD"
    itens: list[ServicoItem]


class AutoCalcularPayload(BaseModel):
    card_id: str
    dept_id: Optional[str] = "produtividade"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/tabela-rendimento")
async def get_tabela():
    """Retorna a tabela de rendimento padrão (para o frontend popular o formulário)."""
    return {"tabela": RENDIMENTO}


@router.post("/calcular-prazo")
async def calcular_prazo(payload: CalcularPrazoPayload):
    """
    Calcula o prazo em dias úteis a partir de uma lista explícita de serviços+quantidades.
    Atualiza o card no Supabase com prazo_dias_uteis e o cronograma detalhado.
    """
    itens = [{"servico": i.servico, "quantidade": i.quantidade} for i in payload.itens]
    total_du = dias_uteis_totais(itens)

    # Breakdown detalhado
    breakdown = []
    for i in payload.itens:
        r = RENDIMENTO_MAP.get(i.servico.upper().strip(), {})
        dias = calcular_dias(i.servico, i.quantidade)
        breakdown.append({
            "servico":    i.servico,
            "quantidade": i.quantidade,
            "unidade":    r.get("unidade", i.unidade or "M²"),
            "rendimento": r.get("rendimento", 0),
            "dias_uteis": round(dias, 2),
        })

    cronograma = {
        "itens":            breakdown,
        "total_dias_uteis": total_du,
        "calculado_por":    "PMO Agente",
    }
    if payload.previsao_inicio:
        cronograma["previsao_inicio"] = payload.previsao_inicio

    # Atualiza o card no Supabase
    await _update_card_prazo(payload.card_id, total_du, payload.previsao_inicio, cronograma)

    logger.info("pmo_prazo_calculado", card_id=payload.card_id, total_du=total_du)
    return {
        "ok": True,
        "total_dias_uteis": total_du,
        "cronograma": cronograma,
    }


@router.post("/auto-calcular")
async def auto_calcular(payload: AutoCalcularPayload):
    """
    Endpoint chamado automaticamente quando um projeto chega ao PMO.
    O agente Claude lê todas as informações do card e decide quais
    serviços e metragens aplicar, calcula o prazo e atualiza o card.
    """
    # 1. Buscar card no Supabase
    card = await _fetch_card(payload.card_id)
    if not card:
        return {"ok": False, "error": "Card não encontrado"}

    details  = card.get("details") or {}
    tipo     = details.get("tipo_projeto") or ""
    area_m2  = details.get("area_m2")
    desc     = card.get("subtitle") or ""
    titulo   = card.get("title") or ""
    tags     = card.get("tags") or []
    checklist_items = card.get("checklist_items") or []
    proj_itens      = details.get("projeto_executivo_itens") or []
    previsao_inicio = details.get("previsao_inicio") or None

    # Contexto completo para o agente
    contexto = f"""Projeto: {titulo}
Descrição: {desc}
Tipo de projeto: {tipo}
Área total (m²): {area_m2 or 'NÃO INFORMADO'}
Tags: {', '.join(tags) if tags else 'nenhuma'}
Itens do projeto executivo: {', '.join(proj_itens) if proj_itens else 'nenhum'}
Checklist de etapas: {', '.join(i['item'] if isinstance(i, dict) else str(i) for i in checklist_items[:15])}
"""

    tabela_txt = "\n".join(
        f"- {r['servico']}: {r['rendimento']} {r['unidade']}/dia"
        for r in RENDIMENTO
    )

    prompt = f"""Você é o Agente PMO da Parket. Seu trabalho é calcular o prazo de execução de uma obra em dias úteis.

TABELA DE RENDIMENTO PADRÃO (serviços disponíveis):
{tabela_txt}

INFORMAÇÕES DO PROJETO:
{contexto}

INSTRUÇÕES:
1. Com base nas informações acima, identifique quais serviços da tabela serão executados neste projeto.
2. Para cada serviço, estime a quantidade (m², ML ou unidades) com base na área informada ou no tipo de projeto.
3. Se a área (m²) não foi informada, use 1 m² como referência e INDIQUE que a área precisa ser confirmada.
4. Responda EXCLUSIVAMENTE com um JSON válido no formato abaixo, sem explicações extras:

{{
  "servicos": [
    {{"servico": "NOME_EXATO_DA_TABELA", "quantidade": 00.0, "unidade": "M²"}},
    ...
  ],
  "observacao": "texto breve explicando as premissas adotadas",
  "area_confirmada": true/false
}}

Use apenas serviços que existem EXATAMENTE na tabela. Se a área não for informada, use quantidade 1 para cada serviço e marque area_confirmada como false."""

    # 2. Chamar Claude via account_pool
    itens_calculados = []
    observacao = ""
    area_confirmada = bool(area_m2)

    try:
        from app.database import AsyncSessionLocal
        from app.core.account_pool import account_pool

        async with AsyncSessionLocal() as db:
            resposta = await account_pool.chat(
                db=db,
                messages=[{"role": "user", "content": prompt}],
                system_prompt=(
                    "Você é o Agente PMO da Parket. Responda sempre com JSON válido, "
                    "sem markdown, sem texto antes ou depois do JSON."
                ),
            )

        # Parse do JSON retornado pelo Claude
        resposta_limpa = (resposta or "").strip()
        if resposta_limpa.startswith("```"):
            resposta_limpa = resposta_limpa.split("```")[1]
            if resposta_limpa.startswith("json"):
                resposta_limpa = resposta_limpa[4:]
        parsed = json.loads(resposta_limpa)
        itens_calculados = parsed.get("servicos", [])
        observacao = parsed.get("observacao", "")
        area_confirmada = parsed.get("area_confirmada", area_confirmada)

        logger.info("pmo_agente_respondeu", card_id=payload.card_id,
                    itens=len(itens_calculados), area_confirmada=area_confirmada)

    except Exception as e:
        logger.warning("pmo_agente_falhou", card_id=payload.card_id, error=str(e))
        # Fallback: serviços padrão por tipo_projeto
        itens_calculados = _fallback_por_tipo(tipo, area_m2)
        observacao = f"Cálculo pelo fallback (tipo: {tipo}). Erro IA: {e}"
        area_confirmada = bool(area_m2)

    if not itens_calculados:
        logger.warning("pmo_sem_servicos", card_id=payload.card_id)
        await _notify_pmo_sem_dados(titulo, payload.card_id)
        return {"ok": False, "error": "Nenhum serviço identificado", "card_id": payload.card_id}

    # 3. Calcular prazo total
    total_du = dias_uteis_totais(itens_calculados)

    # 4. Breakdown
    breakdown = []
    for i in itens_calculados:
        r = RENDIMENTO_MAP.get(i["servico"].upper().strip(), {})
        dias = calcular_dias(i["servico"], float(i.get("quantidade", 0)))
        breakdown.append({
            "servico":    i["servico"],
            "quantidade": i.get("quantidade"),
            "unidade":    r.get("unidade", i.get("unidade", "M²")),
            "rendimento": r.get("rendimento", 0),
            "dias_uteis": round(dias, 2),
        })

    cronograma = {
        "itens":            breakdown,
        "total_dias_uteis": total_du,
        "calculado_por":    "PMO Agente (Claude)",
        "observacao":       observacao,
        "area_confirmada":  area_confirmada,
    }
    if previsao_inicio:
        cronograma["previsao_inicio"] = previsao_inicio

    # 5. Atualizar card no Supabase
    await _update_card_prazo(payload.card_id, total_du, previsao_inicio, cronograma)

    # 6. Notificar grupo PMO via WhatsApp
    await _notify_pmo_cronograma(titulo, card.get("obra"), total_du, breakdown,
                                  previsao_inicio, area_confirmada, observacao)

    logger.info("pmo_auto_calculado", card_id=payload.card_id,
                total_du=total_du, area_confirmada=area_confirmada)

    return {
        "ok": True,
        "total_dias_uteis": total_du,
        "area_confirmada": area_confirmada,
        "cronograma": cronograma,
    }


# ─── Helpers Supabase ────────────────────────────────────────────────────────

async def _fetch_card(card_id: str) -> Optional[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers=_sb_headers(),
            params={"id": f"eq.{card_id}", "select": "*"},
        )
    if r.status_code == 200:
        data = r.json()
        return data[0] if data else None
    logger.warning("supabase_fetch_failed", status=r.status_code, body=r.text[:200])
    return None


async def _update_card_prazo(
    card_id: str,
    total_du: int,
    previsao_inicio: Optional[str],
    cronograma: dict,
):
    """Atualiza details.prazo_dias_uteis e details.cronograma_pmo no card."""
    # Primeiro busca details atuais para merge
    card = await _fetch_card(card_id)
    if not card:
        return
    details = card.get("details") or {}
    details["prazo_dias_uteis"] = total_du
    details["cronograma_pmo"] = cronograma
    if previsao_inicio:
        details["previsao_inicio"] = previsao_inicio

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers=_sb_headers(),
            params={"id": f"eq.{card_id}"},
            json={"details": details},
        )
    if r.status_code not in (200, 204):
        logger.warning("supabase_update_failed", status=r.status_code, body=r.text[:200])


# ─── Helpers WhatsApp ────────────────────────────────────────────────────────

async def _notify_pmo_cronograma(
    titulo: str,
    obra: Optional[str],
    total_du: int,
    breakdown: list[dict],
    previsao_inicio: Optional[str],
    area_confirmada: bool,
    observacao: str,
):
    linhas = "\n".join(
        f"  • {b['servico']}: {b['quantidade']} {b['unidade']} → {b['dias_uteis']:.1f} d.u."
        for b in breakdown[:12]   # máx 12 linhas para não ficar muito longo
    )
    aviso_area = "\n⚠️ _Área não confirmada — quantities são estimadas. Confirme o m² e recalcule._" if not area_confirmada else ""
    inicio_txt = f"\nInício previsto: *{previsao_inicio}*" if previsao_inicio else ""

    msg = (
        f"📋 *Cronograma PMO Calculado*\n"
        f"Projeto: *{titulo}*"
        + (f" — {obra}" if obra else "") +
        f"\n\n*Serviços identificados:*\n{linhas}\n\n"
        f"*Total: {total_du} dias úteis*"
        f"{inicio_txt}"
        f"{aviso_area}"
        + (f"\n\n📝 _{observacao}_" if observacao else "")
    )

    try:
        await evolution_client.send_text(PMO_GROUP_ID, msg)
        logger.info("pmo_whatsapp_enviado", obra=obra)
    except Exception as e:
        logger.warning("pmo_whatsapp_failed", error=str(e))


async def _notify_pmo_sem_dados(titulo: str, card_id: str):
    msg = (
        f"⚠️ *PMO — Dados insuficientes*\n"
        f"Projeto: *{titulo}*\n\n"
        f"O Agente PMO não conseguiu identificar os serviços e metragens deste projeto.\n"
        f"Por favor, acesse o card e preencha:\n"
        f"• Área total (m²)\n"
        f"• Tipo de projeto / serviços\n\n"
        f"Após preencher, clique em *Calcular Prazo* para gerar o cronograma."
    )
    try:
        await evolution_client.send_text(PMO_GROUP_ID, msg)
    except Exception as e:
        logger.warning("pmo_whatsapp_failed", error=str(e))


# ─── Fallback por tipo_projeto ───────────────────────────────────────────────

def _fallback_por_tipo(tipo: str, area_m2) -> list[dict]:
    """Serviços padrão quando Claude falha, baseado no tipo_projeto."""
    area = float(area_m2) if area_m2 else 1.0
    mapa = {
        "piso_forro":          [{"servico": "PISO INSTALAÇÃO RETA", "quantidade": area},
                                 {"servico": "FORRO BARROTE",         "quantidade": area * 0.5}],
        "deck":                [{"servico": "ESTRUTURA DECK",          "quantidade": area},
                                 {"servico": "DECK",                   "quantidade": area}],
        "escada":              [{"servico": "ESCADA",                  "quantidade": area}],
        "marcenaria":          [{"servico": "PAINEL ESTRUTURA",        "quantidade": area},
                                 {"servico": "PAINEL RIPADO/TOBLERONE", "quantidade": area}],
        "marcenaria_instalacao":[{"servico": "PAINEL ESTRUTURA",       "quantidade": area},
                                 {"servico": "PISO INSTALAÇÃO RETA",   "quantidade": area}],
        "instalacao":          [{"servico": "PISO INSTALAÇÃO RETA",    "quantidade": area}],
        "guarnicoes":          [{"servico": "RODAPÉ",                  "quantidade": area * 4},
                                 {"servico": "TABEIRA",                 "quantidade": area * 2}],
    }
    return mapa.get(tipo, [{"servico": "PISO INSTALAÇÃO RETA", "quantidade": area}])
