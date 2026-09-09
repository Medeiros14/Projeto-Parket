"""
Teca V2 orchestrator — entry point called by the webhook.

Flow:
  1. Check sandbox/pause: if disabled or paused, return None (V1 takes over or nothing).
  2. Append incoming user message to Redis history.
  3. Cortex thinks → returns analysis + tool_calls.
  4. Execute each tool. (Can be empty.)
  5. If Cortex said should_respond=False → done.
  6. Conversational writes the reply.
  7. Append assistant reply to history.
  8. Return reply text. (Webhook is responsible for sending via WhatsApp.)

The orchestrator is *idempotent-ish*: it doesn't lock per phone. If you need
debounce, do it in the webhook before calling this.
"""
from __future__ import annotations

import logging
from typing import Optional

import structlog

from . import state as state_mod
from . import state_machine
from . import cortex as cortex_mod
from . import conversational as conv_mod
from . import tools as tools_mod
from .sandbox import is_v2_enabled_for_phone, normalize_phone

logger = logging.getLogger(__name__)
# structlog é o único logger capturado no `docker service logs` (o stdlib acima
# não aparece). Usado só pra observabilidade das decisões de agendamento.
slog = structlog.get_logger("teca_v2.orchestrator")


async def _aplicar_transicoes_implicitas(phone: str, card_id: str | None,
                                         tool_results: list[dict]) -> None:
    """agendado/escalado_humano nunca dependem do Cortex lembrar do marcar_etapa:
    tools bem-sucedidas disparam a etapa automaticamente."""
    for r in tool_results:
        if r.get("_implicita_aplicada"):
            continue
        nova = state_machine.transicao_implicita(r.get("name"), r.get("result"))
        if not nova:
            continue
        r["_implicita_aplicada"] = True
        try:
            atual = (await state_mod.get_state(phone) or {}).get("etapa")
            if atual == nova:
                continue
            await tools_mod.aplicar_etapa(phone, card_id, nova)
            slog.info("teca_v2_transicao", phone=phone, de=atual or "?", para=nova,
                      ok=True, motivo="implicita")
        except Exception:
            logger.exception("teca_v2 transicao implicita %s falhou", nova)


def _marcar_etapa_rejeitada(r: dict) -> bool:
    res = r.get("result")
    return r.get("name") == "marcar_etapa" and isinstance(res, dict) and res.get("ok") is False


async def handle_message_v2(
    *,
    phone: str,
    incoming_message: str,
    card: dict | None = None,
) -> Optional[str]:
    """
    Main entry. Returns the assistant text to send back, or None if Teca V2
    chose not to respond (paused, escalated, off for this phone).
    """
    phone = normalize_phone(phone)
    card = card or {}

    # 1. Sandbox gate
    if not is_v2_enabled_for_phone(phone):
        return None

    # 2. Pause gate
    if await state_mod.is_paused(phone):
        logger.info("teca_v2: paused — phone=%s", phone)
        return None

    # 3. Append user message
    await state_mod.append_message(phone, "user", incoming_message)

    # 4. Load context
    history = await state_mod.get_history(phone)
    state_dict = await state_mod.get_state(phone)

    # 5. Cortex thinks
    decision = await cortex_mod.think(
        phone=phone,
        card=card,
        state=state_dict,
        history=history,
        incoming_message=incoming_message,
    )
    logger.info("teca_v2_cortex_pass1 phone=%s intent=%s tools=%d resp=%s brief=%r",
                phone, decision.get("intent"), len(decision.get("tool_calls", [])),
                decision.get("should_respond"), (decision.get("response_brief") or "")[:120])
    if decision.get("_raw"):
        logger.warning("teca_v2_cortex_raw_unparsed phone=%s raw=%r", phone, decision["_raw"][:300])

    # 6. Execute tools
    tool_results: list[dict] = []
    for tc in decision.get("tool_calls", []):
        name = tc.get("name")
        args = tc.get("args") or {}
        result = await tools_mod.execute_tool(
            name, args, phone=phone, card_id=card.get("id"), tool_results=tool_results)
        tool_results.append({"name": name, "args": args, "result": result})

    # Transições automáticas de etapa disparadas por tools (agendado/escalado)
    await _aplicar_transicoes_implicitas(phone, card.get("id"), tool_results)

    # If a tool already paused the lead (escalou pra humano), bail out
    if await state_mod.is_paused(phone):
        return None

    # 7. SEMPRE responde se não estiver pausada — somos conversacional, não chatbot.
    # `should_respond=False` da Cortex é IGNORADO. Único caminho pra não responder
    # é o lead ter sido pausado por uma tool (escalar humano), tratado acima.

    # 8. Optionally let Cortex re-think after tool results — inclui transição
    # rejeitada pela máquina de estados (Cortex precisa corrigir o plano).
    needs_second_pass = any(
        r["name"] in ("verificar_disponibilidade", "vendedores_livres_em", "criar_agendamento", "listar_vendedores", "consultar_kb_site")
        or _marcar_etapa_rejeitada(r)
        for r in tool_results
    )
    if needs_second_pass:
        decision2 = await cortex_mod.think(
            phone=phone,
            card=card,
            state=await state_mod.get_state(phone),
            history=history,
            incoming_message=incoming_message,
            last_tool_results=tool_results,
        )
        logger.info("teca_v2_cortex_pass2 phone=%s intent=%s tools=%d resp=%s brief=%r",
                    phone, decision2.get("intent"), len(decision2.get("tool_calls", [])),
                    decision2.get("should_respond"), (decision2.get("response_brief") or "")[:120])
        # Execute any follow-up tool calls from the second pass
        for tc in decision2.get("tool_calls", []):
            name = tc.get("name")
            args = tc.get("args") or {}
            result = await tools_mod.execute_tool(
                name, args, phone=phone, card_id=card.get("id"), tool_results=tool_results)
            tool_results.append({"name": name, "args": args, "result": result})

        await _aplicar_transicoes_implicitas(phone, card.get("id"), tool_results)

        decision["analysis"] = decision2.get("analysis", decision.get("analysis"))
        decision["response_brief"] = decision2.get("response_brief", decision.get("response_brief"))
        # should_respond do pass2 também é IGNORADO. Se não pausou, responde.
        if await state_mod.is_paused(phone):
            return None

    # Observabilidade: emite via structlog (único capturado no docker service logs)
    # o resultado do agendamento — pra enxergar em prod se a Cortex chamou
    # criar_agendamento e, se sim, por que deu skip (metragem_ausente etc).
    try:
        ag = next((r for r in tool_results if r.get("name") == "criar_agendamento"), None)
        ag_res = (ag or {}).get("result") if isinstance((ag or {}).get("result"), dict) else {}
        slog.info(
            "teca_v2_tools_done",
            phone=phone,
            tools=[r.get("name") for r in tool_results],
            agendou=("id" in (ag_res or {})) or (ag_res or {}).get("ok") is True,
            agendamento_skip=(ag_res or {}).get("skip_motivo"),
            metragem=(ag_res or {}).get("metragem"),
        )
    except Exception:
        pass

    # 9. Conversational writes reply
    det = (card or {}).get("details") or {}
    lead_name = (card or {}).get("title") or det.get("nome") or None
    reply = await conv_mod.respond(
        incoming_message=incoming_message,
        history=history,
        cortex_brief=decision.get("response_brief", ""),
        cortex_analysis=decision.get("analysis", ""),
        tool_results=tool_results,
        lead_name=lead_name,
    )
    if not reply:
        logger.warning("teca_v2_empty_reply phone=%s — conversational devolveu vazio", phone)
        return None
    logger.info("teca_v2_conv_built phone=%s chars=%d preview=%r", phone, len(reply), reply[:120])

    # 10. Append assistant reply
    await state_mod.append_message(phone, "assistant", reply, meta={
        "intent": decision.get("intent"),
        "tools": [r["name"] for r in tool_results],
    })

    return reply


__all__ = ["handle_message_v2", "is_v2_enabled_for_phone"]
