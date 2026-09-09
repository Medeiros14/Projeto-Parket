"""
Fiscal Laudo AI
================
Orquestra a interação com o fiscal no grupo WhatsApp pra preencher o laudo:

  1. Recebe mensagem (texto/áudio/imagem)
  2. Transcreve áudio / descreve imagem usando media_processor
  3. Carrega estado atual do laudo + checklist do tipo + histórico de mensagens
  4. Chama Claude com tool use estruturado pra:
     - Extrair valores de campos do laudo (checklist items, observações,
       medicao_obra, descritivo_reparo, etc.)
     - Decidir se ainda há lacunas
     - Gerar pergunta de follow-up amigável em português
  5. Atualiza fiscal_laudos com os campos extraídos
  6. Se houver lacunas → envia pergunta no grupo
  7. Se laudo estiver completo → marca status="concluido" e avisa no grupo
"""
from __future__ import annotations

import json
import re
import structlog
import httpx
from typing import Any

from app.config import settings

logger = structlog.get_logger(__name__)

SB_URL = settings.SUPABASE_URL
SB_KEY = settings.SUPABASE_SERVICE_KEY
SB_HDR = {
    "apikey": SB_KEY,
    "Authorization": f"Bearer {SB_KEY}",
    "Content-Type": "application/json",
}

EVO_URL = "https://conect.parket.works"
EVO_INSTANCE = "Parket"
EVO_KEY = "4eab105201410d6865b86dca76ee9fa3"


# ──────────────────────────────────────────────────────────────────────
#  Checklists por tipo de vistoria — espelho dos CK_* do frontend
# ──────────────────────────────────────────────────────────────────────

CHECKLISTS_1V = {
    "piso": [
        "Contrapiso nivelado e sem ondulações",
        "Contrapiso liso (sem arenoso)",
        "Sem buracos ou calombos",
        "Pisos frios finalizados",
        "Espessura adequada pro piso Parket",
        "Baguetes finalizadas",
        "Espaço pra dilatação do rodapé invertido",
        "Soleiras finalizadas",
        "Hidráulica finalizada",
        "Elétrica finalizada",
        "Gesso e massa corrida finalizados",
        "Pintura primeira demão finalizada",
        "Portas/janelas/vidros instalados",
        "Medição final realizada",
        "Caçamba disponível",
        "Área livre de objetos e pessoas",
        "Umidade no contrapiso (medição)",
        "Área liberada pra instalação",
    ],
    "deck": [
        "Hidráulica finalizada",
        "Elétrica finalizada",
        "Pisos frios finalizados",
        "Alçapões no contrapiso",
        "Espessura adequada",
        "Estrutura metálica finalizada (se houver)",
        "Encontro com piscinas/spas",
        "Vidros e esquadrias instalados",
        "Medição final realizada",
        "Caçamba disponível",
        "Área liberada pra instalação",
    ],
    "forro": [
        "Laje finalizada",
        "Tipo da laje + especificação",
        "Vai ter cortineiro/sanca",
        "Vai ter beiral",
        "Estrutura do beiral finalizada",
        "Paredes finalizadas",
        "Portas/janelas/vidros instalados",
        "Hidráulica finalizada",
        "Elétrica finalizada",
        "Medição final realizada",
        "Necessidade de andaime/escada",
        "Umidade na laje",
        "Área liberada pra instalação",
        "Projeto confere com a obra",
    ],
    "painel": [
        "Parede estruturada/requadrada",
        "Sem buracos, com massa",
        "Encontro com outros materiais",
        "Rodapé finalizado",
        "Caçamba disponível",
        "Necessidade de andaime/escada",
        "Forro/piso finalizado (se não-Parket)",
        "Medição final realizada",
    ],
}

CHECKLISTS_2V = {
    "piso": [
        "Contrapiso apto a instalação",
        "Pisos frios finalizados",
        "Espessura adequada",
        "Baguetes/soleiras finalizadas",
        "Hidráulica/elétrica finalizadas",
        "Gesso/massa/pintura finalizados",
        "Portas/janelas/vidros instalados",
        "Medição realizada",
        "Caçamba disponível",
        "Umidade no contrapiso",
        "Área liberada pra instalação",
    ],
    "deck": [
        "Hidráulica finalizada",
        "Elétrica finalizada",
        "Pisos frios finalizados",
        "Estrutura metálica finalizada",
        "Vidros/esquadrias instalados",
        "Medição realizada",
        "Caçamba disponível",
        "Área liberada",
    ],
    "forro": [
        "Laje finalizada",
        "Estrutura do beiral pronta",
        "Paredes finalizadas",
        "Portas/janelas instaladas",
        "Hidráulica/elétrica finalizadas",
        "Medição realizada",
        "Área liberada pra instalação",
    ],
    "painel": [
        "Parede pronta (estruturada, sem buracos)",
        "Rodapé finalizado",
        "Encontros pertinentes",
        "Medição realizada",
        "Área liberada pra instalação",
    ],
}

CHECKLIST_ACOMP = [
    "Equipe presente no canteiro",
    "Equipe produtiva (anote produtividade do dia)",
    "Materiais/insumos suficientes",
    "Pendências da obra-cliente travando",
    "Andamento conforme cronograma",
    "Próximas etapas necessárias",
]

CHECKLIST_ENTREGA = [
    "Tudo instalado conforme projeto",
    "Acabamentos finais (rodapé, soleira, encontros)",
    "Limpeza pós-instalação",
    "Termo de entrega assinado pelo cliente",
    "Pendências/ajustes apontados",
]

CHECKLIST_REPARO = [
    "Descritivo do problema",
    "Materiais/insumos necessários (lista)",
    "Prazo estimado",
    "Equipe alocada",
    "Reparo executado conforme combinado",
]


def _checklist_for(tipo: str) -> list[dict]:
    """Retorna lista [{section, items}] pra orientar a IA."""
    if tipo == "1vistoria":
        return [{"section": k, "items": v} for k, v in CHECKLISTS_1V.items()]
    if tipo == "2vistoria":
        return [{"section": k, "items": v} for k, v in CHECKLISTS_2V.items()]
    if tipo == "acompanhamento":
        return [{"section": "acompanhamento", "items": CHECKLIST_ACOMP}]
    if tipo == "entrega":
        return [{"section": "entrega", "items": CHECKLIST_ENTREGA}]
    if tipo == "reparo":
        return [{"section": "reparo", "items": CHECKLIST_REPARO}]
    return []


# ──────────────────────────────────────────────────────────────────────
#  Supabase helpers
# ──────────────────────────────────────────────────────────────────────

async def _sb(method: str, path: str, **kwargs) -> Any:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.request(method, f"{SB_URL}/rest/v1/{path}", headers=SB_HDR, **kwargs)
        if r.is_success:
            try:
                return r.json()
            except Exception:
                return None
        logger.warning("sb_failed", method=method, path=path, status=r.status_code, body=r.text[:200])
        return None


async def _load_laudo(laudo_id: str) -> dict | None:
    rows = await _sb("GET", "fiscal_laudos", params={"id": f"eq.{laudo_id}", "limit": "1"})
    return rows[0] if rows else None


async def _load_messages(laudo_id: str) -> list[dict]:
    rows = await _sb(
        "GET",
        "fiscal_laudo_messages",
        params={
            "laudo_id": f"eq.{laudo_id}",
            "select": "message_type,content,received_at",
            "order": "received_at.asc",
            "limit": "100",
        },
    )
    return rows or []


async def _load_card_context(card_id: str) -> dict:
    """Carrega o card operacional + tenta achar o card de projetos correspondente
    pra montar contexto rico do que será instalado."""
    if not card_id:
        return {}
    op = await _sb("GET", "kanban_cards", params={"id": f"eq.{card_id}", "limit": "1"})
    if not op:
        return {}
    op = op[0]
    op_det = op.get("details") if isinstance(op.get("details"), dict) else {}

    # Tenta casar projeto pelo título (obra é PKT mas projetos podem usar OS diferente)
    proj = None
    title = (op.get("title") or "").strip()
    if title:
        rows = await _sb("GET", "kanban_cards",
            params={"dept_id": "eq.projetos", "title": f"ilike.{title}", "limit": "1"})
        if rows:
            proj = rows[0]
    proj_det = (proj.get("details") if proj and isinstance(proj.get("details"), dict) else {})

    # Coleta info útil pra IA
    return {
        "obra": op.get("obra"),
        "title": op.get("title"),
        "endereco": op_det.get("endereco") or op_det.get("endereco_obra"),
        "estado": op_det.get("estado"),
        "area_m2": op_det.get("area_m2") or op_det.get("metragem"),
        "servicos": op_det.get("servicos") or op_det.get("servicos_detalhe"),
        "produtos": op_det.get("produtos") or op_det.get("descricao_produto"),
        "tipo_projeto": proj_det.get("tipo_projeto") or op_det.get("tipo_projeto"),
        "marcenaria": op_det.get("marcenaria"),
        "icamento": op_det.get("icamento"),
        "ref_porta": op_det.get("ref_porta"),
        "fiscal_responsavel": op_det.get("fiscal_responsavel"),
        "contato_obra": op_det.get("contato_obra"),
        "ocorrencias": op_det.get("ocorrencias"),
    }


def _detect_sections_from_context(ctx: dict, fallback_servicos: list[str]) -> list[str]:
    """Detecta as seções aplicáveis ao projeto. Prioridade:
       1. Texto de servicos/produtos do contrato (fonte da verdade)
       2. fallback_servicos (servicos_inclusos do laudo) só se não der pra inferir do texto
    """
    text = " ".join([
        str(ctx.get("servicos") or ""),
        str(ctx.get("produtos") or ""),
        str(ctx.get("tipo_projeto") or ""),
        str(ctx.get("title") or ""),
    ]).lower()
    # "piso" é genérico — só conta como assoalho/piso parket se vier acompanhado de termo explícito
    keywords = {
        "piso": ["assoalho", "tábua", "tabua", "régua", "regua", "tg ", "engenheirado", "shou sugi piso"],
        "deck": ["deck", "área externa", "externa"],
        "forro": ["forro", "ripado", "lambri ", "tabica", "sanca", "cortineiro", "beiral"],
        "painel": ["painel", "boiserie", "boiseries", "carvalho painel", "lambri parede"],
        "porta": ["porta ", "portas", "pivotante", "pivotantes"],
        "escada": ["escada", "degrau"],
        "bancos": ["banco ", "bancos", "banco em"],
    }
    detected = set()
    for sec, kws in keywords.items():
        if any(kw in text for kw in kws):
            detected.add(sec)
    # Se a marcenaria do contrato é "SIM", marca painel + porta
    if (str(ctx.get("marcenaria") or "")).upper() == "SIM":
        detected.update(["painel", "porta"])
    # Fallback: só aceita servicos_inclusos quando NÃO detectamos nada do texto
    if not detected and fallback_servicos:
        detected = set(fallback_servicos)
    return [s for s in ("piso", "deck", "forro", "painel", "porta", "escada", "bancos") if s in detected]


async def _update_laudo(laudo_id: str, fields: dict) -> bool:
    if not fields:
        return True
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.patch(
            f"{SB_URL}/rest/v1/fiscal_laudos",
            headers={**SB_HDR, "Prefer": "return=minimal"},
            params={"id": f"eq.{laudo_id}"},
            json=fields,
        )
        return r.is_success


async def _send_to_group(jid: str, text: str, fiscal_phone: str | None = None) -> None:
    """Envia texto pro grupo do fiscal. Quando fiscal_phone vem, marca o
    fiscal com @ no início da mensagem (campo `mentioned` no Evolution)."""
    import re as _re
    payload: dict = {"number": jid, "text": text}
    if fiscal_phone:
        digits = _re.sub(r"\D", "", fiscal_phone)
        if digits:
            payload["text"] = f"@{digits} {text}"
            payload["mentioned"] = [f"{digits}@s.whatsapp.net"]
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            await c.post(
                f"{EVO_URL}/message/sendText/{EVO_INSTANCE}",
                headers={"apikey": EVO_KEY, "Content-Type": "application/json"},
                json=payload,
            )
    except Exception as e:
        logger.warning("send_to_group_failed", jid=jid, error=str(e))


# ──────────────────────────────────────────────────────────────────────
#  Claude — extração estruturada via tool use
# ──────────────────────────────────────────────────────────────────────

def _filter_checklist_by_sections(checklist: list[dict], sections: list[str]) -> list[dict]:
    """Filtra checklist mantendo SOMENTE seções que o projeto realmente terá."""
    if not sections:
        return checklist
    keep = set(sections)
    keep.update({"acompanhamento", "entrega", "reparo"})  # tipos especiais sempre passam
    return [s for s in checklist if s["section"] in keep]


def _ctx_summary(ctx: dict, sections: list[str]) -> str:
    """Resumo legível do contexto do projeto pra colocar no prompt."""
    lines = []
    if ctx.get("obra"): lines.append(f"- OS/Obra: {ctx['obra']}")
    if ctx.get("title"): lines.append(f"- Cliente/Projeto: {ctx['title']}")
    if ctx.get("endereco"): lines.append(f"- Endereço: {ctx['endereco']}")
    if ctx.get("estado"): lines.append(f"- Estado: {ctx['estado']}")
    if ctx.get("area_m2"): lines.append(f"- Área: {ctx['area_m2']} m²")
    if ctx.get("servicos"):
        sv = ctx["servicos"]
        if isinstance(sv, list):
            sv = ", ".join(str(x) for x in sv)
        lines.append(f"- Serviços contratados: {sv}")
    if ctx.get("produtos"):
        pr = ctx["produtos"]
        if isinstance(pr, list):
            pr = ", ".join(str(x) for x in pr)
        lines.append(f"- Produtos: {pr}")
    if ctx.get("tipo_projeto"): lines.append(f"- Tipo de projeto: {ctx['tipo_projeto']}")
    if ctx.get("marcenaria"): lines.append(f"- Marcenaria: {ctx['marcenaria']}")
    if ctx.get("icamento"): lines.append(f"- Içamento: {ctx['icamento']}")
    if ctx.get("ref_porta"): lines.append(f"- Refs porta: {ctx['ref_porta']}")
    if ctx.get("contato_obra"): lines.append(f"- Contato obra: {ctx['contato_obra']}")
    if ctx.get("ocorrencias"): lines.append(f"- Ocorrências prévias: {ctx['ocorrencias']}")
    if sections:
        lines.append(f"- *Seções aplicáveis (deduzidas): {', '.join(sections)}*")
    return "\n".join(lines) if lines else "(sem contexto adicional)"


def _build_prompt(laudo: dict, tipo: str, checklist: list[dict], messages: list[dict],
                  ctx: dict, sections: list[str]) -> str:
    filtered = _filter_checklist_by_sections(checklist, sections)
    cl_str = "\n".join(
        f"  • {sec['section'].upper()}:\n" + "\n".join(f"    - {it}" for it in sec["items"])
        for sec in filtered
    ) or "(checklist vazio)"
    # Formata o diálogo distinguindo quem disse o quê (IA vs fiscal). Isso
    # evita a IA repetir perguntas que ela mesma já fez.
    def _fmt(m: dict) -> str:
        mt = (m.get("message_type") or "").lower()
        ts = (m.get("received_at") or "")[:16]
        c = (m.get("content") or "(sem texto)").strip()
        if mt == "ia_followup":
            return f"[IA → fiscal · {ts}] {c}"
        if mt == "audio":
            return f"[FISCAL áudio · {ts}] {c}"
        if mt == "image":
            return f"[FISCAL foto · {ts}] {c}"
        return f"[FISCAL texto · {ts}] {c}"
    msgs_str = "\n".join(_fmt(m) for m in messages)
    cur_ck = {
        k: laudo.get(k)
        for k in ("checklist_piso", "checklist_deck", "checklist_forro", "checklist_painel", "checklist_extra")
        if laudo.get(k)
    }
    return f"""Você é um assistente de campo do setor Fiscal da Parket. Está ajudando o fiscal a preencher o laudo de vistoria através de mensagens em um grupo WhatsApp.

CONTEXTO DO PROJETO (use isso pra fazer perguntas direcionadas — se a obra é só piso, não pergunte sobre forro):
{_ctx_summary(ctx, sections)}

LAUDO ATUAL:
- Tipo de vistoria: {tipo}
- Status: {laudo.get('status') or 'pendente'}

CHECKLIST APLICÁVEL (apenas as seções que esse projeto realmente tem):
{cl_str}

MENSAGENS DO FISCAL ATÉ AGORA:
{msgs_str or '(nenhuma ainda)'}

ESTADO ATUAL DO LAUDO:
- observacoes: {laudo.get('observacoes') or '(vazio)'}
- medicao_obra: {laudo.get('medicao_obra') or '(vazio)'}
- descritivo_reparo: {laudo.get('descritivo_reparo') or '(vazio)'}
- checklists já preenchidos: {json.dumps(cur_ck, ensure_ascii=False) if cur_ck else '(vazio)'}

SUA TAREFA:
1. Use o CONTEXTO DO PROJETO pra entender exatamente o que está sendo instalado. NÃO pergunte sobre seções que não fazem parte do escopo.
2. Inferir respostas do checklist conservadoramente. Quando o fiscal responder "sim/ok/blz/positivo" sem texto extra, INTERPRETE como confirmação do(s) item(ns) que VOCÊ acabou de perguntar na ÚLTIMA mensagem [IA → fiscal] do diálogo. Atualize o checklist correspondente em "checklist_updates".
3. **NUNCA repita uma pergunta que você já fez** (verifique o histórico [IA → fiscal]). Sempre AVANCE pra próximos itens não cobertos.
4. Anotar observações livres do fiscal em "observacoes".
5. Capturar números/medidas em "medicao_obra" (m², dimensões, alturas, umidade).
6. Identificar lacunas importantes ainda não cobertas — só dentro do escopo aplicável.
7. Gerar 1 a 3 perguntas curtas e específicas em "follow_up", AGRUPANDO itens correlatos. Use o nome exato do(s) item(ns) do checklist pra ficar fácil casar a resposta depois. Tom amigável, português coloquial, máx 4 linhas, 1-2 emojis. Se você acabou de receber uma confirmação, AGRADEÇA brevemente e prossiga pro próximo bloco não-respondido.
8. Marque "completo": true APENAS quando todos os itens APLICÁVEIS estiverem cobertos. Caso contrário false.

RETORNE EXATAMENTE este JSON (sem texto antes ou depois, sem ```):

{{
  "checklist_updates": {{
    "<nome do item exatamente como na lista>": {{"valor": "sim"|"nao"|"na", "obs": "contexto livre"}}
  }},
  "observacoes": "<resumo consolidado das obs do fiscal, ou string vazia>",
  "medicao_obra": "<texto sobre medições, ou string vazia>",
  "descritivo_reparo": "<apenas se tipo=reparo, senão string vazia>",
  "completo": <true|false>,
  "follow_up": "<mensagem amigável pro fiscal no WhatsApp>"
}}"""


async def _get_claude_oauth_token() -> str | None:
    """Pega o session_token (OAuth) da AIAccount Claude ativa."""
    try:
        from app.database import AsyncSessionLocal
        from sqlalchemy import select
        from app.models.ai_account import AIAccount
        async with AsyncSessionLocal() as db:
            r = await db.execute(
                select(AIAccount).where(
                    AIAccount.provider == "claude",
                    AIAccount.is_active == True,
                )
            )
            for a in r.scalars().all():
                if a.session_token and (a.session_token.startswith("sk-ant-oat") or a.session_token.startswith("sk-ant-")):
                    return a.session_token
    except Exception as e:
        logger.warning("claude_token_fetch_failed", error=str(e))
    return None


async def _call_claude(prompt: str) -> dict | None:
    """Chama Claude (OAuth via account_pool ou ANTHROPIC_API_KEY) e parseia JSON."""
    api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or await _get_claude_oauth_token()
    if not api_key:
        logger.warning("claude_no_credentials")
        return None
    text = ""
    try:
        from app.core.llm_client import ClaudeClient
        client = ClaudeClient(api_key=api_key)
        text = await client.chat(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="Você responde APENAS com um objeto JSON válido — sem markdown, sem texto antes ou depois, sem ``` envolvendo.",
        )
        # Extrai JSON: tenta direto, depois com regex de bloco
        text = (text or "").strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```\s*$", "", text)
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("claude_json_parse_failed", error=str(e), text_prefix=text[:200])
        # Fallback: tenta extrair JSON via regex
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    except Exception as e:
        logger.warning("claude_call_failed", error=str(e))
    return None


# ──────────────────────────────────────────────────────────────────────
#  Aplicação dos updates no laudo
# ──────────────────────────────────────────────────────────────────────

def _normalize_section(name: str) -> str:
    n = name.lower()
    for k in ("piso", "deck", "forro", "painel", "porta", "escada", "bancos"):
        if k in n:
            return k
    return ""


def _merge_checklist_updates(laudo: dict, updates: dict, section_hint: str | None = None) -> dict:
    """Distribui checklist_updates entre checklist_piso/deck/forro/painel/extra.

    Estratégia (em ordem):
      1) Se `section_hint` foi inferido da mensagem (ex: fiscal mandou header
         '*PISO*' antes das respostas), TODOS os itens vão pra essa seção.
         É a fonte mais confiável — o fiscal disse a seção.
      2) Match por palavras-chave no nome do item, mas com PRECEDÊNCIA pra
         palavras MAIS ESPECÍFICAS (ex: "contrapiso" antes de "laje").
      3) Itens contendo APENAS palavras genéricas dos serviços CASADOS no
         laudo (servicos_inclusos) → mapeados pro 1º serviço incluso.
      4) Fallback: extra.
    """
    by_section: dict[str, dict] = {
        "piso": dict(laudo.get("checklist_piso") or {}),
        "deck": dict(laudo.get("checklist_deck") or {}),
        "forro": dict(laudo.get("checklist_forro") or {}),
        "painel": dict(laudo.get("checklist_painel") or {}),
        "extra": dict(laudo.get("checklist_extra") or {}),
    }
    # Keywords STRONG (alta confiança — ganha sobre weak): específicas
    keys_strong = {
        "piso": ["contrapiso", "rodapé", "rodape", "soleira", "baguete", "espessura do piso", "espessura deixada"],
        "deck": ["deck", "alçapão", "alcapao", "piscina", "spa"],
        "forro": ["forro", "cortineiro", "sanca", "beiral", "umidade na laje"],
        "painel": ["painel", "muxarabi", "boiserie"],
    }
    # Keywords WEAK (genérico — só usado se nada strong casou)
    keys_weak = {
        "piso": ["piso", "umidade no contra"],
        "forro": ["laje"],
        "painel": ["parede"],
    }
    extras: dict = {}
    for item, info in (updates or {}).items():
        if not isinstance(info, dict):
            continue
        item_l = item.lower()
        target = None
        # 1) section_hint do contexto da mensagem (header *PISO*, *FORRO*...)
        if section_hint and section_hint in by_section:
            target = section_hint
        # 2) Strong match
        if not target:
            for sec, kws in keys_strong.items():
                if any(kw in item_l for kw in kws):
                    target = sec
                    break
        # 3) Weak match
        if not target:
            for sec, kws in keys_weak.items():
                if any(kw in item_l for kw in kws):
                    target = sec
                    break
        if not target:
            extras[item] = info
        else:
            by_section[target][item] = info
    by_section["extra"].update(extras)

    out = {}
    if by_section["piso"]: out["checklist_piso"] = by_section["piso"]
    if by_section["deck"]: out["checklist_deck"] = by_section["deck"]
    if by_section["forro"]: out["checklist_forro"] = by_section["forro"]
    if by_section["painel"]: out["checklist_painel"] = by_section["painel"]
    if by_section["extra"]: out["checklist_extra"] = by_section["extra"]
    return out


def _infer_section_hint(messages: list[dict]) -> str | None:
    """Olha as mensagens mais recentes do fiscal procurando por header tipo
    '*PISO*' / '*FORRO*' / '*DECK*' / '*PAINEL*'. Se encontrou, todos os
    itens da resposta IA são roteados pra essa seção (mais confiável que
    keyword matching no nome inventado pela IA)."""
    import re as _re
    for msg in reversed(messages or []):
        if (msg.get("message_type") or "").startswith("ia"):
            continue
        content = (msg.get("content") or "").upper()
        # Procura headers em qualquer posição: *PISO*, **PISO**, _PISO_
        m = _re.search(r"\*+\s*(PISO|DECK|FORRO|PAINEL|PORTA|ESCADA|BANCOS)\s*\*+", content)
        if m:
            return m.group(1).lower()
    return None


# ──────────────────────────────────────────────────────────────────────
#  Entry point chamado pelo webhook
# ──────────────────────────────────────────────────────────────────────

async def process_fiscal_message(laudo_id: str, group_jid: str) -> None:
    """Carrega laudo + histórico, chama Claude, aplica updates e envia follow-up."""
    if not laudo_id:
        return
    laudo = await _load_laudo(laudo_id)
    if not laudo:
        logger.warning("laudo_not_found", laudo_id=laudo_id)
        return
    if laudo.get("status") == "concluido":
        return  # já fechado, não interage mais

    tipo = laudo.get("tipo") or "1vistoria"
    checklist = _checklist_for(tipo)
    messages = await _load_messages(laudo_id)
    if not messages:
        return

    # Carrega contexto do card/projeto pra IA fazer perguntas direcionadas
    ctx = await _load_card_context(laudo.get("card_id"))
    sections = _detect_sections_from_context(ctx, laudo.get("servicos_inclusos") or [])

    prompt = _build_prompt(laudo, tipo, checklist, messages, ctx, sections)
    result = await _call_claude(prompt)
    if not result:
        return

    # Aplica updates de campos textuais
    update_payload = {}
    if result.get("observacoes"):
        old = laudo.get("observacoes") or ""
        new = result["observacoes"]
        if new and new != old:
            update_payload["observacoes"] = new
    if result.get("medicao_obra"):
        update_payload["medicao_obra"] = result["medicao_obra"]
    if result.get("descritivo_reparo") and tipo == "reparo":
        update_payload["descritivo_reparo"] = result["descritivo_reparo"]

    # Merge checklist_updates — passa section_hint da última msg do fiscal
    cl = result.get("checklist_updates") or {}
    if cl:
        section_hint = _infer_section_hint(messages)
        if section_hint:
            logger.info("section_hint_inferido", laudo_id=laudo_id, section=section_hint)
        update_payload.update(_merge_checklist_updates(laudo, cl, section_hint=section_hint))

    # Status final
    if result.get("completo"):
        update_payload["status"] = "concluido"

    if update_payload:
        await _update_laudo(laudo_id, update_payload)
        logger.info("laudo_updated_by_ai", laudo_id=laudo_id, fields=list(update_payload.keys()))

    # Envia follow-up no grupo — sempre marca o fiscal com @ pra ele saber
    # que a IA está perguntando algo direto pra ele.
    fu = (result.get("follow_up") or "").strip()
    if fu:
        fiscal_phone = await _fetch_fiscal_phone(group_jid)
        await _send_to_group(group_jid, fu, fiscal_phone=fiscal_phone)
        # Persiste o follow-up no histórico do laudo pra que na próxima
        # chamada a IA veja sua própria pergunta e não repita.
        try:
            await _sb(
                "POST",
                "fiscal_laudo_messages",
                json={
                    "laudo_id": laudo_id,
                    "group_jid": group_jid,
                    "message_type": "ia_followup",
                    "content": fu,
                },
            )
        except Exception as e:
            logger.warning("followup_persist_failed", error=str(e))
        logger.info("followup_sent", laudo_id=laudo_id, chars=len(fu), mention=bool(fiscal_phone))


async def _fetch_fiscal_phone(group_jid: str) -> str | None:
    """Resolve telefone do fiscal a partir do JID do grupo (via fiscal_equipe)."""
    if not group_jid:
        return None
    try:
        from app.config import settings as _s
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(
                f"{_s.SUPABASE_URL}/rest/v1/fiscal_equipe",
                headers={
                    "apikey": _s.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {_s.SUPABASE_SERVICE_KEY}",
                },
                params={"select": "telefone", "whatsapp_group_jid": f"eq.{group_jid}", "limit": "1"},
            )
            if r.is_success:
                rows = r.json() or []
                if rows:
                    return rows[0].get("telefone")
    except Exception as e:
        logger.warning("fetch_fiscal_phone_failed", group_jid=group_jid, error=str(e))
    return None
