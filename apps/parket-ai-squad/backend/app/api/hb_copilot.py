"""
HOME BROKER COPILOT — endpoints de IA pra apoiar o SDR/vendedor.

A IA NUNCA envia mensagem. Só:
  - Classifica o lead em quente/morno/frio + score 0-100 (POST /api/hb-ia/analyze)
  - Sugere 3 respostas pro SDR escolher (POST /api/hb-ia/suggest)

Usa Claude Sonnet 4.5 (mesmo modelo do Space).
"""
from __future__ import annotations

import json
import re
from typing import Optional, Literal

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.account_pool import account_pool
from app.database import AsyncSessionLocal
from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/hb-ia", tags=["hb-ia"])


# ─── Modelos de I/O ─────────────────────────────────────────────
class AnalyzeInput(BaseModel):
    card_id: str
    # Contexto do card (passado pelo front pra evitar mais um round-trip ao Supabase)
    card_title: Optional[str] = None
    card_subtitle: Optional[str] = None
    slug: Optional[str] = None
    produto_interesse: Optional[str] = None
    metragem: Optional[float] = None
    valor_mesa: Optional[float] = None
    cidade: Optional[str] = None
    responsavel: Optional[str] = None
    # Últimas mensagens (cliente e SDR) pra dar contexto
    mensagens: list[dict] = []  # [{direction: "in"|"out", text: str, at: str}, ...]


class AnalyzeOutput(BaseModel):
    nivel: Literal["quente", "morno", "frio"]
    score: int           # 0-100
    motivo: str          # 1 frase explicando
    proxima_acao: str    # "ligar agora" / "enviar proposta" / etc


class SuggestInput(BaseModel):
    card_id: str
    objetivo: str        # "qualificar", "agendar visita", "enviar orçamento", "negociar", "fechar"
    card_title: Optional[str] = None
    slug: Optional[str] = None
    produto_interesse: Optional[str] = None
    metragem: Optional[float] = None
    valor_mesa: Optional[float] = None
    cidade: Optional[str] = None
    mensagens: list[dict] = []
    contexto_extra: Optional[str] = None


class ScriptSuggestInput(BaseModel):
    """Input pro co-pilot de criação de scripts."""
    titulo: Optional[str] = None
    etapa: Optional[str] = None
    funil: Optional[str] = None
    categoria: Optional[str] = None
    texto_atual: Optional[str] = None       # rascunho do user
    observacoes: Optional[str] = None
    modo: str = "variacoes"  # "variacoes" = 3 versões | "melhorar" = refina o texto atual


class ScriptSugestao(BaseModel):
    titulo: str
    texto: str
    motivo: str  # por que essa abordagem


class ScriptSuggestOutput(BaseModel):
    sugestoes: list[ScriptSugestao]


class Sugestao(BaseModel):
    titulo: str          # "Resposta direta", "Quebra-gelo", "Pedido de informação"
    texto: str           # mensagem completa pronta pra enviar


class SuggestOutput(BaseModel):
    sugestoes: list[Sugestao]


# ─── Helpers ────────────────────────────────────────────────────
def _format_msgs(msgs: list[dict], max_n: int = 12) -> str:
    if not msgs:
        return "(nenhuma mensagem trocada ainda)"
    recent = msgs[-max_n:]
    lines = []
    for m in recent:
        who = "CLIENTE" if m.get("direction") == "in" else "PARKET"
        txt = (m.get("text") or "").strip().replace("\n", " ")[:300]
        lines.append(f"  {who}: {txt}")
    return "\n".join(lines)


def _extract_json(text: str) -> dict:
    """Extrai JSON da resposta do Claude. Lida com:
      - JSON puro
      - JSON dentro de markdown ```json ... ```
      - JSON misturado com texto
      - JSON aninhado (objetos dentro de arrays dentro de objetos)
    Estratégia: encontra todo {...} usando balanceamento de chaves, tenta cada um."""
    if not text:
        raise ValueError("Resposta vazia do Claude")
    t = text.strip()
    # Tira markdown ```json``` ou ```
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```\s*$", "", t)
    # Tenta JSON puro primeiro
    try:
        return json.loads(t)
    except Exception:
        pass
    # Procura blocos {...} balanceados (respeitando string com escape)
    candidates: list[str] = []
    for start in range(len(t)):
        if t[start] != "{":
            continue
        depth = 0
        in_str = False
        escape = False
        for end in range(start, len(t)):
            ch = t[end]
            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        candidates.append(t[start:end + 1])
                        break
    # Tenta os candidatos do maior pro menor (objetos top-level são mais longos)
    for c in sorted(set(candidates), key=len, reverse=True):
        try:
            return json.loads(c)
        except Exception:
            continue
    raise ValueError(f"Não conseguiu extrair JSON. Resposta começou com: {text[:200]}")


async def _scripts_da_etapa(slug: str | None, funil_hint: str | None = None, limit: int = 6) -> list[dict]:
    """Busca scripts ativos da DB pra usar como base de conhecimento."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return []
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    }
    params = {
        "select": "titulo,etapa,categoria,texto,observacoes,funil",
        "ativo": "eq.true",
        "order": "uso_count.desc",
        "limit": str(limit),
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            # Primeira tentativa: scripts da etapa específica
            if slug:
                r = await c.get(
                    f"{settings.SUPABASE_URL}/rest/v1/hb_scripts",
                    headers=headers, params={**params, "etapa": f"eq.{slug}"},
                )
                if r.status_code == 200 and r.json():
                    return r.json()
            # Fallback: scripts genéricos (etapa null) do mesmo funil
            r = await c.get(
                f"{settings.SUPABASE_URL}/rest/v1/hb_scripts",
                headers=headers, params={**params, "etapa": "is.null"},
            )
            return r.json() if r.status_code == 200 else []
    except Exception as e:
        logger.warning("hb_scripts_lookup_failed", error=str(e)[:200])
        return []


async def _ask_claude(system_prompt: str, user_prompt: str) -> str:
    """Usa account_pool (OAuth-first com fallback API key) — mesmo padrão do Space."""
    async with AsyncSessionLocal() as db:
        return await account_pool.chat(
            db=db,
            messages=[{"role": "user", "content": user_prompt}],
            system_prompt=system_prompt,
            preferred_provider="claude",
        )


# ─── ENDPOINTS ──────────────────────────────────────────────────
@router.post("/analyze", response_model=AnalyzeOutput)
async def analyze_lead(payload: AnalyzeInput):
    """Classifica o lead como quente/morno/frio + score 0-100 + próxima ação."""
    ctx = f"""
DADOS DO LEAD (Parket — venda de pisos, decks, painéis, marcenaria de madeira nobre):
- Nome: {payload.card_title or "?"}
- Etapa atual: {payload.slug or "?"}
- Produto de interesse: {payload.produto_interesse or "?"}
- Metragem estimada: {payload.metragem or "?"} m²
- Valor estimado na mesa: R$ {payload.valor_mesa or 0:,.0f}
- Cidade: {payload.cidade or "?"}
- Responsável: {payload.responsavel or "?"}

HISTÓRICO RECENTE DE CONVERSA (mais antigo → mais recente):
{_format_msgs(payload.mensagens)}
""".strip()

    system = """Você é um analista de leads sênior da Parket, especialista em venda
de revestimentos de madeira nobre (pisos, decks, painéis, marcenaria sob medida).

Sua tarefa é classificar o lead em QUENTE, MORNO ou FRIO com base no contexto
e sugerir a próxima ação tática pro SDR/vendedor.

CRITÉRIOS:
- QUENTE: cliente engajado, projeto definido, prazos curtos, valor relevante (>R$100k),
  está respondendo rápido, demonstra urgência ou já está em proposta/negociação.
- MORNO: interesse claro mas faltam dados (metragem, prazo, decisor), respondendo
  mas com latência, valor médio (R$30-100k), ainda em qualificação/briefing.
- FRIO: lead sem retorno há muito tempo, valor baixo (<R$30k), pesquisando preço apenas,
  ou já em estado de "perda iminente" / "não-qualificado".

RESPONDA APENAS COM UM JSON VÁLIDO (sem markdown, sem texto extra) no formato:
{
  "nivel": "quente" | "morno" | "frio",
  "score": 0-100,
  "motivo": "frase curta de até 140 chars explicando a classificação",
  "proxima_acao": "ação concreta e direta pro SDR/vendedor fazer agora"
}"""

    try:
        resp = await _ask_claude(system, ctx)
        data = _extract_json(resp)
        nivel = str(data.get("nivel", "morno")).lower()
        if nivel not in ("quente", "morno", "frio"):
            nivel = "morno"
        score = int(max(0, min(100, data.get("score", 50))))
        motivo = str(data.get("motivo", ""))[:200]
        proxima_acao = str(data.get("proxima_acao", ""))[:200]

        # PERSISTE a análise em kanban_cards.details.ia_analise (merge)
        await _persist_analise(payload.card_id, {
            "nivel": nivel, "score": score,
            "motivo": motivo, "proxima_acao": proxima_acao,
            "feita_at": datetime.now(timezone.utc).isoformat(),
            "feita_por": "claude-sonnet-4-5",
        })

        return AnalyzeOutput(
            nivel=nivel,  # type: ignore
            score=score, motivo=motivo, proxima_acao=proxima_acao,
        )
    except Exception as e:
        logger.error("hb_ia_analyze_failed", card_id=payload.card_id, error=str(e)[:300])
        raise HTTPException(500, f"Análise falhou: {str(e)[:200]}")


@router.post("/sugerir-script", response_model=ScriptSuggestOutput)
async def sugerir_script(payload: ScriptSuggestInput):
    """Co-pilot pra criação de scripts. Gera variações ou melhora um draft.
    Considera scripts já cadastrados pra manter consistência de tom."""
    cadastrados = await _scripts_da_etapa(payload.etapa, limit=8)
    cad_section = ""
    if cadastrados:
        lines = ["", "SCRIPTS JÁ CADASTRADOS PRA ESSA MESMA ETAPA/CATEGORIA (mantenha o tom mas traga abordagem nova):"]
        for s in cadastrados[:6]:
            lines.append(f"  • {s['titulo']} — {s.get('texto', '')[:200]}")
        cad_section = "\n".join(lines)

    if payload.modo == "melhorar":
        instrucao = f"""
TAREFA: melhorar o texto do script abaixo mantendo a essência mas:
  - mais conciso e direto
  - tom consultivo Parket
  - pelo menos 1 placeholder de variável ({{nome}}, {{produto}}, {{metragem}}, {{valor}}, {{cidade}}, {{prazo}})
  - termina com pergunta ou CTA concreto

TEXTO ATUAL:
{payload.texto_atual or "(vazio)"}

ENTREGUE EXATAMENTE 3 VERSÕES REFINADAS DIFERENTES."""
    else:
        instrucao = f"""
TAREFA: criar 3 variações DIFERENTES de um script comercial Parket pra a etapa "{payload.etapa or '?'}",
categoria "{payload.categoria or '?'}", funil "{payload.funil or 'ambos'}".

TÍTULO DESEJADO: {payload.titulo or '(livre)'}
RASCUNHO DO USER (se houver): {payload.texto_atual or '(começar do zero)'}
OBSERVAÇÕES: {payload.observacoes or '(nenhuma)'}

CADA VARIAÇÃO DEVE TER ABORDAGEM DIFERENTE:
  1. Direta — vai ao ponto, ótima pra leads frios/morno
  2. Consultiva — pergunta antes de propor, ótima pra leads engajados
  3. Valor — usa credibilidade Parket + prova social
"""

    system = """Você é especialista em copywriting comercial Parket (madeira nobre brasileira —
pisos, decks, painéis, marcenaria sob medida). Você ajuda gestores a criar scripts pro WhatsApp
que sejam usados pelos SDRs e vendedores.

REGRAS DOS SCRIPTS:
- Mensagens curtas (1-3 frases, max ~70 palavras). É WhatsApp.
- Tom CONSULTIVO, profissional mas humano. Nunca robótico.
- Use placeholders: {nome}, {produto}, {metragem}, {valor}, {cidade}, {prazo}, {sdr}
- Termine com pergunta concreta ou CTA específico.
- Foco em mover o lead pra próxima etapa do funil (qualificar → visita → orçamento → fechar).

RESPONDA APENAS COM JSON VÁLIDO (sem markdown), formato:
{
  "sugestoes": [
    { "titulo": "Direta", "texto": "...", "motivo": "frase curta explicando a abordagem" },
    { "titulo": "Consultiva", "texto": "...", "motivo": "..." },
    { "titulo": "Valor", "texto": "...", "motivo": "..." }
  ]
}"""

    try:
        resp = await _ask_claude(system, instrucao + cad_section)
        data = _extract_json(resp)
        raws = data.get("sugestoes") or []
        sugs: list[ScriptSugestao] = []
        for s in raws[:5]:
            if not isinstance(s, dict): continue
            t = str(s.get("titulo", "")).strip()[:50]
            txt = str(s.get("texto", "")).strip()[:1500]
            motivo = str(s.get("motivo", "")).strip()[:200]
            if t and txt:
                sugs.append(ScriptSugestao(titulo=t, texto=txt, motivo=motivo))
        if not sugs:
            raise ValueError("Nenhuma sugestão de script extraída")
        return ScriptSuggestOutput(sugestoes=sugs)
    except Exception as e:
        logger.error("hb_ia_sugerir_script_failed", error=str(e)[:300])
        raise HTTPException(500, f"Sugestões de script falharam: {str(e)[:200]}")


async def _persist_analise(card_id: str, analise: dict):
    """Salva a análise IA dentro de kanban_cards.details.ia_analise (merge JSONB).
    Usa jsonb_set via RPC ou re-merge no backend."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            # 1) Lê details atual
            r = await c.get(
                f"{settings.SUPABASE_URL}/rest/v1/kanban_cards",
                headers=headers,
                params={"id": f"eq.{card_id}", "select": "details", "limit": "1"},
            )
            if r.status_code != 200 or not r.json():
                return
            det = (r.json()[0] or {}).get("details") or {}
            if not isinstance(det, dict):
                det = {}
            det["ia_analise"] = analise
            # 2) Update merge
            await c.patch(
                f"{settings.SUPABASE_URL}/rest/v1/kanban_cards",
                headers={**headers, "Prefer": "return=minimal"},
                params={"id": f"eq.{card_id}"},
                json={"details": det},
            )
    except Exception as e:
        logger.warning("hb_ia_persist_failed", card_id=card_id, error=str(e)[:200])
# Importação tardia (já existe `httpx` lá no topo)
from datetime import datetime, timezone  # garante disponibilidade do datetime aqui também


@router.post("/suggest", response_model=SuggestOutput)
async def suggest_responses(payload: SuggestInput):
    """3 sugestões de resposta personalizadas pro objetivo do SDR/vendedor.
    Injeta scripts cadastrados em hb_scripts como base de conhecimento."""
    scripts = await _scripts_da_etapa(payload.slug)
    objetivo_desc = {
        "qualificar": "qualificar o lead — descobrir metragem, prazo, decisor e budget",
        "agendar visita": "agendar uma visita ao showroom Parket pra ele ver a madeira ao vivo",
        "enviar orcamento": "enviar uma proposta/orçamento personalizado",
        "negociar": "avançar a negociação — superar objeções e fechar",
        "fechar": "fechar a venda agora — pedido de assinatura ou pagamento",
        "reativar": "reativar lead frio — quebrar gelo sem ser invasivo",
        "followup": "fazer follow-up educado depois de silêncio",
    }.get(payload.objetivo, payload.objetivo)

    # Formata scripts cadastrados como exemplos do tom Parket
    scripts_section = ""
    if scripts:
        lines = ["", "SCRIPTS PARKET CADASTRADOS PRA ESTA ETAPA (use como referência de tom, NÃO copie literal):"]
        for s in scripts:
            lines.append(f"  • [{s.get('categoria', '?')}] \"{s['titulo']}\"")
            lines.append(f"    Texto: {s.get('texto', '')[:300]}")
            if s.get("observacoes"):
                lines.append(f"    Quando usar: {s['observacoes'][:200]}")
        scripts_section = "\n".join(lines)

    ctx = f"""
DADOS DO LEAD:
- Nome: {payload.card_title or "?"}
- Etapa atual: {payload.slug or "?"}
- Produto: {payload.produto_interesse or "?"}
- Metragem: {payload.metragem or "?"} m²
- Valor estimado: R$ {payload.valor_mesa or 0:,.0f}
- Cidade: {payload.cidade or "?"}

OBJETIVO DESTA INTERAÇÃO: {objetivo_desc}

HISTÓRICO RECENTE:
{_format_msgs(payload.mensagens)}

{'CONTEXTO EXTRA: ' + payload.contexto_extra if payload.contexto_extra else ''}
{scripts_section}
""".strip()

    system = """Você é o copiloto comercial da Parket (madeira nobre — pisos, decks,
painéis, marcenaria sob medida). Você ajuda SDRs e vendedores a responder leads no WhatsApp
de forma CONSULTIVA, sempre guiando o lead pro PRÓXIMO PASSO concreto da jornada de vendas.

JORNADA COMERCIAL PARKET (use isso pra construir as sugestões):
  Lead novo → Triagem IA → Qualificação → Qualificado → Agendar visita ao showroom
  → Briefing → Orçamento → Apresentação proposta → Negociação → Ganho

REGRAS PRA SUAS SUGESTÕES:
- Tom CONSULTIVO (não pressão de venda) — você está ajudando o cliente a comprar bem.
- Toda mensagem precisa GUIAR pro próximo passo da jornada (sem queimar etapa).
- Português brasileiro, profissional mas humano. NUNCA robótico.
- NUNCA comece com "Olá! Tudo bem?" — vá direto ao ponto.
- Mensagens curtas (1-4 linhas, max ~80 palavras). WhatsApp.
- Personalize com o nome do cliente quando souber.
- Termine SEMPRE com uma pergunta concreta OU CTA específico (agendar, enviar, decidir).
- Reflita o que o cliente DISSE — não invente informação.
- Se faltar info, peça UMA coisa só por vez.
- Use credibilidade Parket sem exagerar: madeira nobre brasileira, showroom em SP,
  obras de referência, atendimento personalizado.

ENTREGUE EXATAMENTE 3 SUGESTÕES, todas consultivas mas com ABORDAGEM diferente:
1. "Pergunta-chave" — uma pergunta inteligente que extrai info crítica pra avançar
2. "Próximo passo" — propõe diretamente a ação que move o lead pra próxima etapa
3. "Valor + CTA" — agrega contexto técnico/social da Parket E pede um próximo passo

RESPONDA APENAS COM JSON VÁLIDO (sem markdown), formato:
{
  "sugestoes": [
    { "titulo": "Pergunta-chave", "texto": "..." },
    { "titulo": "Próximo passo", "texto": "..." },
    { "titulo": "Valor + CTA", "texto": "..." }
  ]
}"""

    try:
        resp = await _ask_claude(system, ctx)
        data = _extract_json(resp)
        raws = data.get("sugestoes") or []
        sugs: list[Sugestao] = []
        for s in raws[:5]:
            if not isinstance(s, dict): continue
            t = str(s.get("titulo", "")).strip()[:50]
            txt = str(s.get("texto", "")).strip()[:1500]
            if t and txt:
                sugs.append(Sugestao(titulo=t, texto=txt))
        if not sugs:
            raise ValueError("Nenhuma sugestão extraída")
        return SuggestOutput(sugestoes=sugs)
    except Exception as e:
        logger.error("hb_ia_suggest_failed", card_id=payload.card_id, error=str(e)[:300])
        raise HTTPException(500, f"Sugestões falharam: {str(e)[:200]}")
