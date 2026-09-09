"""Orchestrator multi-agent: Router → Specialist(s).

Fluxo:
1. Regex de atalho: se a mensagem cai claramente em 1 specialist (ex: link/PDF
   → lista_arquiteto), pula o router e chama direto (economia de 1 hop).
2. Senão, chama Router (Sonnet ou Opus) com prompt curto. Router pode:
   a) responder direto (ajustes triviais: desconto, renomear, ver total).
   b) chamar `route_to_specialist` (tool_use) N vezes → executamos os
      specialists em paralelo, concatenamos as respostas.
3. Streaming SSE em formato Agno-compat pro frontend consumir zero-touch.

Cada agente (router + specialists) tem tool loop próprio pra tools de
catálogo/aprendizados/log.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import AsyncGenerator, Optional

import anthropic
import structlog

from app.agent_core import _build_client, run_agent_stream_collect
from app.history import append_turn, get_history, new_session_id
from app.prompts import router_prompt, specialist_prompt

log = structlog.get_logger()

# Tool que só o router expõe pra despachar pra specialist.
ROUTER_ROUTE_TOOL = {
    "name": "route_to_specialist",
    "description": (
        "Despacha o pedido do usuário pra um specialist. Pode chamar múltiplos "
        "specialists no mesmo turno (paralelo)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "specialist": {
                "type": "string",
                "enum": ["porta", "marcenaria", "lista_arquiteto", "sauna", "generico"],
                "description": "Nome do specialist",
            },
            "user_message": {
                "type": "string",
                "description": "Trecho da mensagem original relevante pro specialist (ou msg inteira se single-cat)",
            },
        },
        "required": ["specialist", "user_message"],
    },
}


# ─────────── Regex atalhos ───────────
_URL_RE = re.compile(r"https?://[^\s]+")
_UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
_SAUNA_BLOCK = re.compile(r"(?im)^\s*SAUNA\b.*(FORRO|PAINEL|BANCO|PORTA)", re.S)
_LISTA_BLOCO = re.compile(
    r"(?im)^\s*(PISO|FORRO|PAINEL|DECK|REVEST|PORTA|MARCENARIA|SÓ MATERIAL|SO MATERIAL)\b.*\n.+:\s*\d",
    re.S,
)


def shortcut_specialist(user_msg: str, has_files: bool) -> Optional[str]:
    """Detecta specialist óbvio pra pular router. Retorna None se ambíguo."""
    if has_files:
        return "lista_arquiteto"  # PDF/imagem sempre é import
    if _URL_RE.search(user_msg) and _UUID_RE.search(user_msg):
        return "lista_arquiteto"  # link de proposta
    if _SAUNA_BLOCK.search(user_msg):
        return "sauna"
    if _LISTA_BLOCO.search(user_msg):
        return "lista_arquiteto"
    return None


def _sse(evt: dict) -> str:
    return f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"


async def run_orchestrated(
    user_msg: str,
    session_id: Optional[str],
    context: Optional[str] = None,
    files: list[tuple[str, str, bytes]] | None = None,
) -> AsyncGenerator[bytes, None]:
    """Fluxo principal. Emite SSE em formato Agno."""
    sid = session_id or new_session_id()
    files = files or []
    yield _sse({"event": "RunStarted", "session_id": sid}).encode()

    history = get_history(sid)
    hop = shortcut_specialist(user_msg, has_files=bool(files))

    try:
        if hop:
            log.info("shortcut_specialist", session_id=sid, specialist=hop)
            yield _sse(
                {"event": "SpecialistStart", "session_id": sid, "specialist": hop, "reason": "shortcut"}
            ).encode()
            async for chunk in run_agent_stream_collect(
                system_prompt=specialist_prompt(hop),
                user_msg=user_msg,
                history=history,
                context=context,
                files=files,
                agent_label=f"specialist_{hop}",
                session_id=sid,
            ):
                yield chunk
        else:
            # Router primeiro
            router_out = await _run_router(sid, user_msg, history, context)

            # Emite o texto do router (ajustes triviais, perguntas, confirmações
            # antes/depois das actions de tool). BUG anterior: esse texto era
            # coletado mas nunca emitido — user via resposta vazia quando router
            # decidia responder direto sem chamar specialist.
            router_text = router_out.get("router_text", "")
            if router_text:
                yield _sse(
                    {"event": "RunContent", "content": router_text, "session_id": sid}
                ).encode()

            if router_out["specialists"]:
                # Executa specialists em paralelo
                tasks = []
                for spec, msg in router_out["specialists"]:
                    yield _sse(
                        {"event": "SpecialistStart", "session_id": sid, "specialist": spec}
                    ).encode()
                    tasks.append(
                        _collect_specialist(spec, msg, history, context, sid)
                    )
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, (spec, _) in enumerate(router_out["specialists"]):
                    res = results[i]
                    if isinstance(res, Exception):
                        yield _sse(
                            {"event": "RunContent", "content": f"\n\n[erro em {spec}: {res}]\n\n", "session_id": sid}
                        ).encode()
                        continue
                    if res.strip():
                        yield _sse(
                            {"event": "RunContent", "content": res, "session_id": sid}
                        ).encode()
                    yield _sse(
                        {"event": "SpecialistComplete", "session_id": sid, "specialist": spec}
                    ).encode()
    except Exception as exc:
        log.exception("orchestrator_failed")
        yield _sse(
            {"event": "RunError", "content": f"{type(exc).__name__}: {exc}", "session_id": sid}
        ).encode()

    # append no history — texto completo do turno reconstruído
    # (nesta versão inicial guardamos só a msg do user pra não inflar; assistant volta vazio)
    # Se quiser guardar assistant completo, buffer os deltas emitidos aqui.
    yield _sse({"event": "RunCompleted", "content": "", "session_id": sid}).encode()
    yield b"data: [DONE]\n\n"


async def _run_router(
    sid: str,
    user_msg: str,
    history: list,
    context: Optional[str],
) -> dict:
    """Executa router não-streamed. Retorna:
    { specialists: [(name, message), ...], router_text: str }
    """
    from app.tools import TOOLS as USER_TOOLS

    # Router tem TODAS as tools (pra responder direto ajustes triviais) + a de rota.
    tools = list(USER_TOOLS) + [ROUTER_ROUTE_TOOL]

    client = _build_client()
    from app.agent_core import (
        _system_blocks, _build_messages, _to_serializable_blocks, _create_retry_401,
        MAX_TOOL_ITERATIONS, OAUTH_BETAS, MODEL_ID, MAX_TOKENS,
    )
    from app.tools import dispatch, as_text

    system = _system_blocks(router_prompt())
    messages = _build_messages(user_msg, history, context, [])

    specialists: list[tuple[str, str]] = []
    router_text_parts: list[str] = []

    for _ in range(MAX_TOOL_ITERATIONS):
        client, resp = _create_retry_401(
            client,
            model=MODEL_ID,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=messages,
            betas=OAUTH_BETAS,
            tools=tools,
        )
        blocks = _to_serializable_blocks(resp.content)
        messages.append({"role": "assistant", "content": blocks})

        # Colhe texto do router
        for b in blocks:
            if b.get("type") == "text" and b.get("text"):
                router_text_parts.append(b["text"])

        if resp.stop_reason != "tool_use":
            break

        # Executa tools — separa route_to_specialist das demais
        tool_results = []
        for b in blocks:
            if b.get("type") != "tool_use":
                continue
            if b["name"] == "route_to_specialist":
                inp = b.get("input") or {}
                spec = inp.get("specialist")
                msg = inp.get("user_message", "")
                if spec and msg:
                    specialists.append((spec, msg))
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": b["id"], "content": f"OK — {spec} enfileirado"}
                )
            else:
                result = dispatch(b["name"], b.get("input") or {})
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": b["id"], "content": as_text(result)}
                )
        messages.append({"role": "user", "content": tool_results})

    return {"specialists": specialists, "router_text": "".join(router_text_parts)}


async def _collect_specialist(
    spec: str,
    user_msg: str,
    history: list,
    context: Optional[str],
    sid: str,
) -> str:
    """Roda specialist non-streamed, retorna texto final concatenado."""
    from app.agent_core import run_agent_blocking
    return await asyncio.to_thread(
        run_agent_blocking,
        specialist_prompt(spec),
        user_msg,
        history,
        context,
        [],
        f"specialist_{spec}",
        sid,
    )
