"""
Cortex agent — reasoner. Calls Opus 4.7 via OpenCode.
Output is strict JSON parsed into a TyperdDict-ish dict.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from .prompts import CORTEX_SYSTEM, now_br_iso, next_business_day_iso
from .ddd_locator import is_sp_ddd, guessed_region_label

logger = logging.getLogger(__name__)

CORTEX_MODEL = "anthropic/claude-opus-4-7"


CAMPOS_OBRIGATORIOS_AGENDAMENTO = [
    ("nome", "Nome completo"),
    ("cidade", "Cidade (e estado)"),
    ("area_m2", "Área aproximada do projeto em m²"),
    ("produto_interesse", "Produtos de interesse (piso/deck/painel/porta/escada/marcenaria…)"),
    ("perfil", "Perfil (cliente final / arquiteto / construtora)"),
    ("atendimento", "Tipo de atendimento (só material OU material + instalação)"),
]


def _build_context_block(*, phone: str, card: dict, state: dict, history: list[dict]) -> str:
    """Block appended to the system prompt with all the live context."""
    lines = []
    lines.append(f"AGORA: {now_br_iso()} (America/Sao_Paulo)")
    lines.append(f"PRÓXIMO DIA ÚTIL: {next_business_day_iso()}")
    lines.append("")
    lines.append("LEAD:")
    lines.append(f"  Telefone: +{phone}")
    lines.append(f"  Região (inferida pelo DDD): {guessed_region_label(phone)}")
    det = (card or {}).get("details") or {}
    card_title = (card or {}).get("title") or det.get("nome") or "(desconhecido)"
    lines.append(f"  Nome (card title): {card_title}")
    lines.append(f"  Card ID: {(card or {}).get('id') or '(novo lead)'}")
    lines.append("")
    lines.append("DADOS COLETADOS DO LEAD (card.details — fonte de verdade):")
    if det:
        for k, v in det.items():
            if k.startswith("_") or k in ("mensagens_ia", "gates_data", "handoffs_data", "raci_data", "chat_messages"):
                continue
            preview = str(v)[:200] if v is not None else "(vazio)"
            lines.append(f"  {k}: {preview}")
    else:
        lines.append("  (lead novo — nenhum dado coletado ainda)")
    lines.append("")
    lines.append("CAMPOS OBRIGATÓRIOS PRO AGENDAMENTO (precisam estar todos preenchidos):")
    faltam = []
    for chave, label in CAMPOS_OBRIGATORIOS_AGENDAMENTO:
        val = det.get(chave) or (state or {}).get(chave)
        status = "✓" if val else "✗ FALTA"
        if not val:
            faltam.append(label)
        lines.append(f"  [{status}] {chave}: {val or '(faltando)'}")
    if faltam:
        lines.append(f"  → AINDA FALTAM: {', '.join(faltam)}")
    else:
        lines.append("  → TODOS OS CAMPOS COLETADOS — pode prosseguir pra agendamento")
    lines.append("")
    lines.append("ESTADO DA CONVERSA (Redis):")
    if state:
        for k, v in state.items():
            if k.startswith("_"):
                continue
            lines.append(f"  {k}: {v}")
    else:
        lines.append("  (vazio — primeira interação)")
    lines.append("")
    lines.append("HISTÓRICO (últimas mensagens):")
    if not history:
        lines.append("  (sem histórico)")
    else:
        # Mostra últimas 20 mensagens
        for m in history[-20:]:
            role = "LEAD" if m.get("role") == "user" else "TECA"
            lines.append(f"  [{role}] {m.get('content','')[:300]}")
    return "\n".join(lines)


async def _call_llm(system: str, user_prompt: str) -> str:
    """Usa o account_pool igual a V1 — OAuth primeiro, API key como fallback."""
    from app.core.account_pool import account_pool
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        return await account_pool.chat(
            db=db,
            messages=[{"role": "user", "content": user_prompt}],
            system_prompt=system,
            preferred_provider="claude",
        )


def _try_parse_json(raw: str) -> dict | None:
    """Try to extract a JSON object from the LLM response."""
    raw = (raw or "").strip()
    # Strip code fences if present
    if raw.startswith("```"):
        # remove first fence line
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.rstrip().endswith("```"):
            raw = raw.rstrip()[:-3]
    # Find first '{' and last '}'
    i = raw.find("{")
    j = raw.rfind("}")
    if i < 0 or j < 0 or j <= i:
        return None
    try:
        return json.loads(raw[i : j + 1])
    except Exception as e:
        logger.warning("cortex JSON parse failed: %s — raw=%r", e, raw[:300])
        return None


async def think(
    *,
    phone: str,
    card: dict,
    state: dict,
    history: list[dict],
    incoming_message: str,
    last_tool_results: list[dict] | None = None,
) -> dict:
    """
    Run the reasoner.

    Returns:
        {
          "analysis": str,
          "intent": str,
          "tool_calls": [{"name": str, "args": dict}],
          "should_respond": bool,
          "response_brief": str,
        }
    """
    ctx_block = _build_context_block(phone=phone, card=card, state=state, history=history)

    user_prompt_parts = [
        ctx_block,
        "",
        "═══ ÚLTIMA MENSAGEM DO LEAD (a que você precisa responder agora) ═══",
        incoming_message or "(vazia)",
    ]
    if last_tool_results:
        user_prompt_parts.append("")
        user_prompt_parts.append("═══ RESULTADO DAS FERRAMENTAS NA RODADA ANTERIOR ═══")
        for r in last_tool_results:
            user_prompt_parts.append(f"- {r.get('name')}({json.dumps(r.get('args', {}), ensure_ascii=False)[:200]}) → {json.dumps(r.get('result'), ensure_ascii=False)[:400]}")
    user_prompt_parts.append("")
    user_prompt_parts.append("Responda agora com o JSON exato no formato especificado. Apenas o JSON, nada mais.")

    user_prompt = "\n".join(user_prompt_parts)

    try:
        raw = await asyncio.wait_for(_call_llm(CORTEX_SYSTEM, user_prompt), timeout=90)
    except Exception as e:
        logger.exception("cortex llm call failed: %s", e)
        return {
            "analysis": f"erro chamando LLM: {e}",
            "intent": "outro",
            "tool_calls": [],
            "should_respond": False,
            "response_brief": "",
        }

    parsed = _try_parse_json(raw)
    if not parsed:
        return {
            "analysis": "JSON inválido do cortex",
            "intent": "outro",
            "tool_calls": [],
            "should_respond": False,
            "response_brief": "",
            "_raw": raw[:500],
        }

    # Defensive defaults
    parsed.setdefault("analysis", "")
    parsed.setdefault("intent", "outro")
    parsed.setdefault("tool_calls", [])
    parsed.setdefault("should_respond", True)
    parsed.setdefault("response_brief", "")
    if not isinstance(parsed["tool_calls"], list):
        parsed["tool_calls"] = []
    return parsed
