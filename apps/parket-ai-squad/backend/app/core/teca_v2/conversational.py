"""
Conversational agent — writer. Calls Sonnet 4.6 via OpenCode.
Receives Cortex's brief + tool results + history. Outputs ONE message text.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from .prompts import CONVERSATIONAL_SYSTEM

logger = logging.getLogger(__name__)

CONV_MODEL = "anthropic/claude-sonnet-4-6"


def _format_history_for_writer(history: list[dict]) -> str:
    if not history:
        return "(sem histórico — primeira mensagem)"
    out = []
    for m in history[-12:]:
        role = "Lead" if m.get("role") == "user" else "Teca"
        out.append(f"{role}: {m.get('content', '')[:300]}")
    return "\n".join(out)


def _format_tool_results(tool_results: list[dict]) -> str:
    if not tool_results:
        return "(nenhuma ferramenta executada nesta rodada)"
    out = []
    for r in tool_results:
        name = r.get("name")
        res = r.get("result")
        if isinstance(res, (dict, list)):
            res_s = json.dumps(res, ensure_ascii=False)[:700]
        else:
            res_s = str(res)[:700]
        out.append(f"• {name} → {res_s}")
    return "\n".join(out)


async def respond(
    *,
    incoming_message: str,
    history: list[dict],
    cortex_brief: str,
    cortex_analysis: str,
    tool_results: list[dict],
    lead_name: str | None = None,
) -> str:
    user_prompt = (
        "═══ ANÁLISE DO CORTEX ═══\n" + (cortex_analysis or "(sem análise)") + "\n\n"
        "═══ BRIEFING DO CORTEX (o que você deve fazer agora) ═══\n" + (cortex_brief or "(sem briefing — responda algo curto e útil)") + "\n\n"
        "═══ RESULTADO DAS FERRAMENTAS ═══\n" + _format_tool_results(tool_results) + "\n\n"
        "═══ HISTÓRICO RECENTE ═══\n" + _format_history_for_writer(history) + "\n\n"
        "═══ ÚLTIMA MENSAGEM DO LEAD ═══\n" + (incoming_message or "(vazia)") + "\n\n"
        f"Nome do lead (se souber): {lead_name or '(não confirmado)'}\n\n"
        "Gere AGORA a próxima mensagem da Teca. APENAS o texto, sem aspas, sem prefixo, sem formatação extra."
    )

    try:
        from app.core.account_pool import account_pool
        from app.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            text = await asyncio.wait_for(
                account_pool.chat(
                    db=db,
                    messages=[{"role": "user", "content": user_prompt}],
                    system_prompt=CONVERSATIONAL_SYSTEM,
                    preferred_provider="claude",
                ),
                timeout=60,
            )
        return (text or "").strip().strip('"').strip("'")
    except Exception as e:
        logger.exception("conversational llm call failed: %s", e)
        return "Desculpa, tive um probleminha agora. Pode repetir?"
