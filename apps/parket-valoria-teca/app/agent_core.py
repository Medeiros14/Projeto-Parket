"""Núcleo de execução de agente (usado por orchestrator/router/specialists).

Não sabe nada sobre roteamento — só recebe (prompt, msg, history, tools) e roda
o tool-use loop até o modelo parar de chamar tools. Duas variantes:
  - run_agent_stream_collect: async generator SSE (usado pelo shortcut)
  - run_agent_blocking: retorna string final (usado por specialists paralelos)

Este módulo herdou toda a mecânica OAuth/betas/cache do agent.py original.
"""
from __future__ import annotations

import base64
import json
from typing import AsyncGenerator, Optional

import anthropic
import structlog

from app.oauth import force_refresh, get_token
from app.settings import MAX_TOKENS, MODEL_ID, REQUEST_TIMEOUT
from app.tools import TOOLS, as_text, dispatch

log = structlog.get_logger()

OAUTH_BETAS = [
    "claude-code-20250219",
    "oauth-2025-04-20",
    "interleaved-thinking-2025-05-14",
]
CC_BILLING = "x-anthropic-billing-header: cc_version=2.1.81; cc_entrypoint=api; cch=00000;"
CC_HEADERS = {
    "x-app": "cli",
    "User-Agent": "claude-cli/2.1.81 (external, cli)",
    "anthropic-dangerous-direct-browser-access": "true",
}
MAX_TOOL_ITERATIONS = 12

_MIME_TO_KIND = {
    "image/jpeg": "image", "image/jpg": "image", "image/png": "image",
    "image/gif": "image", "image/webp": "image",
    "application/pdf": "document",
}


def _build_client() -> anthropic.Anthropic:
    token = get_token()
    if not token:
        raise RuntimeError("no OAuth token available (ai_accounts empty?)")
    return anthropic.Anthropic(
        auth_token=token, default_headers=CC_HEADERS, timeout=REQUEST_TIMEOUT
    )


def _create_retry_401(client: anthropic.Anthropic, **kwargs):
    """messages.create com retry único em 401.

    401 aqui = token morto no banco apesar da estimativa dizer que vale
    (linha ai_accounts compartilhada com o EAS). Força refresh e refaz a
    chamada com client novo. Retorna (client, resposta)."""
    try:
        return client, client.beta.messages.create(**kwargs)
    except anthropic.AuthenticationError:
        log.warning("anthropic_401_forcing_oauth_refresh")
        token = force_refresh()
        if not token:
            raise
        client = anthropic.Anthropic(
            auth_token=token, default_headers=CC_HEADERS, timeout=REQUEST_TIMEOUT
        )
        return client, client.beta.messages.create(**kwargs)


def _file_to_block(name: str, mime: str, data: bytes) -> Optional[dict]:
    kind = _MIME_TO_KIND.get(mime.lower())
    if not kind:
        return None
    b64 = base64.standard_b64encode(data).decode()
    if kind == "image":
        return {"type": "image", "source": {"type": "base64", "media_type": mime, "data": b64}}
    return {"type": "document", "source": {"type": "base64", "media_type": mime, "data": b64}, "title": name}


def _build_first_user_content(text: str, context: Optional[str], files: list[tuple[str, str, bytes]]) -> list[dict]:
    blocks: list[dict] = []
    for name, mime, data in files or []:
        b = _file_to_block(name, mime, data)
        if b:
            blocks.append(b)
    joined = f"<context>\n{context}\n</context>\n\n{text}" if context else text
    blocks.append({"type": "text", "text": joined, "cache_control": {"type": "ephemeral"}})
    return blocks


def _build_messages(
    user_text: str,
    history: list,
    context: Optional[str],
    files: list[tuple[str, str, bytes]],
) -> list[dict]:
    msgs: list[dict] = []
    for u, a in history:
        msgs.append({"role": "user", "content": u})
        msgs.append({"role": "assistant", "content": a})
    msgs.append({"role": "user", "content": _build_first_user_content(user_text, context, files)})
    return msgs


def _system_blocks(prompt: str) -> list[dict]:
    return [
        {"type": "text", "text": CC_BILLING},
        {"type": "text", "text": prompt, "cache_control": {"type": "ephemeral"}},
    ]


def _sse(evt: dict) -> str:
    return f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"


def _extract_text(content_list: list) -> str:
    parts = []
    for b in content_list:
        if isinstance(b, dict) and b.get("type") == "text":
            parts.append(b.get("text", ""))
        elif getattr(b, "type", None) == "text":
            parts.append(getattr(b, "text", ""))
    return "".join(parts)


def _to_serializable_blocks(content_list: list) -> list[dict]:
    out = []
    for b in content_list:
        if isinstance(b, dict):
            out.append(b)
            continue
        t = getattr(b, "type", None)
        if t == "text":
            out.append({"type": "text", "text": getattr(b, "text", "")})
        elif t == "tool_use":
            out.append({
                "type": "tool_use",
                "id": getattr(b, "id", ""),
                "name": getattr(b, "name", ""),
                "input": getattr(b, "input", {}) or {},
            })
        elif t == "thinking":
            out.append({
                "type": "thinking",
                "thinking": getattr(b, "thinking", ""),
                "signature": getattr(b, "signature", ""),
            })
    return out


async def run_agent_stream_collect(
    system_prompt: str,
    user_msg: str,
    history: list,
    context: Optional[str],
    files: list[tuple[str, str, bytes]],
    agent_label: str,
    session_id: str,
) -> AsyncGenerator[bytes, None]:
    """Streaming SSE compat Agno pra um único agente (usado pelo atalho single-cat)."""
    client = _build_client()
    system = _system_blocks(system_prompt)
    messages = _build_messages(user_msg, history, context, files)

    total_input = 0
    total_output = 0
    total_cache_read = 0
    total_cache_write = 0

    try:
        for iteration in range(MAX_TOOL_ITERATIONS):
            client, stream = _create_retry_401(
                client,
                model=MODEL_ID,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,
                betas=OAUTH_BETAS,
                tools=TOOLS,
                stream=True,
            )
            resp_blocks: list[dict] = []
            current_block: Optional[dict] = None
            input_json_buffers: dict[int, list[str]] = {}
            stop_reason: Optional[str] = None
            msg_usage = None
            msg_start_usage = None  # trazido pelo evento message_start (input/cache)

            for event in stream:
                etype = getattr(event, "type", "")
                if etype == "message_start":
                    m = getattr(event, "message", None)
                    if m is not None:
                        msg_start_usage = getattr(m, "usage", None)
                if etype == "content_block_start":
                    idx = getattr(event, "index", 0)
                    cb = getattr(event, "content_block", None)
                    ct = getattr(cb, "type", None)
                    if ct == "text":
                        current_block = {"type": "text", "text": ""}
                    elif ct == "tool_use":
                        current_block = {
                            "type": "tool_use",
                            "id": getattr(cb, "id", ""),
                            "name": getattr(cb, "name", ""),
                            "input": {},
                        }
                        input_json_buffers[idx] = []
                        yield _sse({
                            "event": "ToolCallStarted",
                            "session_id": session_id,
                            "agent": agent_label,
                            "tool": current_block["name"],
                        }).encode()
                    elif ct == "thinking":
                        current_block = {"type": "thinking", "thinking": "", "signature": ""}
                    else:
                        current_block = {"type": ct or "unknown"}
                elif etype == "content_block_delta":
                    delta = getattr(event, "delta", None)
                    dtype = getattr(delta, "type", None)
                    if dtype == "text_delta":
                        text = getattr(delta, "text", "") or ""
                        if text:
                            if current_block is not None and current_block.get("type") == "text":
                                current_block["text"] = current_block.get("text", "") + text
                            yield _sse({
                                "event": "RunContent",
                                "content": text,
                                "session_id": session_id,
                            }).encode()
                    elif dtype == "input_json_delta":
                        partial = getattr(delta, "partial_json", "") or ""
                        idx = getattr(event, "index", 0)
                        input_json_buffers.setdefault(idx, []).append(partial)
                elif etype == "content_block_stop":
                    idx = getattr(event, "index", 0)
                    if current_block is not None:
                        if current_block.get("type") == "tool_use":
                            raw = "".join(input_json_buffers.get(idx, []))
                            try:
                                current_block["input"] = json.loads(raw) if raw else {}
                            except json.JSONDecodeError:
                                current_block["input"] = {"_raw": raw}
                        resp_blocks.append(current_block)
                        current_block = None
                elif etype == "message_delta":
                    delta = getattr(event, "delta", None)
                    sr = getattr(delta, "stop_reason", None) if delta else None
                    if sr:
                        stop_reason = sr
                    u = getattr(event, "usage", None)
                    if u:
                        msg_usage = u

            # Acumula métricas de token.
            # - output_tokens: vem no message_delta (final)
            # - input_tokens / cache_read / cache_write: vêm no message_start (início)
            if msg_usage:
                total_output += getattr(msg_usage, "output_tokens", 0) or 0
            if msg_start_usage:
                total_input += getattr(msg_start_usage, "input_tokens", 0) or 0
                total_cache_read += getattr(msg_start_usage, "cache_read_input_tokens", 0) or 0
                total_cache_write += getattr(msg_start_usage, "cache_creation_input_tokens", 0) or 0

            messages.append({"role": "assistant", "content": resp_blocks})

            tool_uses = [b for b in resp_blocks if b.get("type") == "tool_use"]
            if stop_reason == "tool_use" and tool_uses:
                tool_results = []
                for tu in tool_uses:
                    result = dispatch(tu["name"], tu.get("input") or {})
                    yield _sse({
                        "event": "ToolCallCompleted",
                        "session_id": session_id,
                        "agent": agent_label,
                        "tool": tu["name"],
                        "ok": bool(isinstance(result, dict) and result.get("ok", True)),
                    }).encode()
                    tool_results.append({
                        "type": "tool_result", "tool_use_id": tu["id"], "content": as_text(result),
                    })
                messages.append({"role": "user", "content": tool_results})
                continue
            break

        log.info(
            "agent_stream_done",
            agent=agent_label,
            session_id=session_id,
            input_tokens=total_input,
            output_tokens=total_output,
            cache_read=total_cache_read,
            cache_write=total_cache_write,
        )
    except anthropic.APIStatusError as exc:
        yield _sse({
            "event": "RunError",
            "content": f"Anthropic {exc.status_code}: {str(exc)[:200]}",
            "session_id": session_id,
        }).encode()
    except Exception as exc:
        log.exception("agent_stream_failed", agent=agent_label)
        yield _sse({
            "event": "RunError",
            "content": f"{type(exc).__name__}: {exc}",
            "session_id": session_id,
        }).encode()


def run_agent_blocking(
    system_prompt: str,
    user_msg: str,
    history: list,
    context: Optional[str],
    files: list[tuple[str, str, bytes]],
    agent_label: str,
    session_id: str,
) -> str:
    """Non-stream. Retorna o texto final concatenado (útil pra rodar
    specialists em paralelo com asyncio.gather+to_thread)."""
    client = _build_client()
    system = _system_blocks(system_prompt)
    messages = _build_messages(user_msg, history, context, files)

    try:
        for _ in range(MAX_TOOL_ITERATIONS):
            client, resp = _create_retry_401(
                client,
                model=MODEL_ID,
                max_tokens=MAX_TOKENS,
                system=system,
                messages=messages,
                betas=OAUTH_BETAS,
                tools=TOOLS,
            )
            blocks = _to_serializable_blocks(resp.content)
            messages.append({"role": "assistant", "content": blocks})
            if resp.stop_reason == "tool_use":
                tool_results = []
                for b in blocks:
                    if b.get("type") != "tool_use":
                        continue
                    result = dispatch(b["name"], b.get("input") or {})
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": b["id"],
                        "content": as_text(result),
                    })
                messages.append({"role": "user", "content": tool_results})
                continue

            usage = getattr(resp, "usage", None)
            if usage:
                log.info(
                    "agent_blocking_done",
                    agent=agent_label,
                    session_id=session_id,
                    input_tokens=getattr(usage, "input_tokens", 0),
                    output_tokens=getattr(usage, "output_tokens", 0),
                    cache_read=getattr(usage, "cache_read_input_tokens", 0),
                    cache_write=getattr(usage, "cache_creation_input_tokens", 0),
                )
            return _extract_text(blocks)
        return ""
    except anthropic.APIStatusError as exc:
        return f"[erro Anthropic {exc.status_code}: {str(exc)[:200]}]"
    except Exception as exc:
        log.exception("agent_blocking_failed", agent=agent_label)
        return f"[erro {type(exc).__name__}: {exc}]"
