"""Confirmação humana via WhatsApp — DESLIGADA.

Antes: ferramenta com `requires_confirmation=True` pausava o run, mandava WhatsApp
ao Will e esperava "sim <token>" antes de executar.

Agora (jun/2026): execução é direta. `request_confirmation()` virou alias de
`notify_backlog_impl()` — só registra no grupo "Backlog Parket" o que foi feito
e devolve `approved` na hora. Mantido pra não quebrar chamadas existentes nos
tools, mas a chamada é informativa, não bloqueante.
"""

from __future__ import annotations

import json

import structlog

from app.tools.whatsapp_evolution import notify_backlog_impl

log = structlog.get_logger()


def _format_backlog_msg(tool_name: str, summary: str, tool_args: dict | None) -> str:
    body = f"🤖 *EAS — execução*\n\n*Tool:* {tool_name}\n*Ação:* {summary}"
    if tool_args:
        try:
            args_preview = json.dumps(tool_args, ensure_ascii=False, default=str)
            if len(args_preview) > 400:
                args_preview = args_preview[:400] + "…"
            body += f"\n*Args:* `{args_preview}`"
        except Exception:  # noqa: BLE001
            pass
    return body


def request_confirmation(
    tool_name: str,
    summary: str,
    tool_args: dict | None = None,
    run_id: str | None = None,
    agent_id: str | None = None,
    timeout_sec: int = 0,
) -> dict:
    """Auto-approve silencioso. NÃO bloqueia, NÃO notifica.

    Antes (jun/2026): chamava notify_backlog_impl em cada tool gated → ruído no grupo.
    Agora: só loga internamente. O agent posta SUMÁRIO no final via `whatsapp_notify_backlog`
    (regra na role). Nenhum mid-run notification.
    """
    log.info("auto-approve (gate desativado)", tool_name=tool_name, summary=summary)
    return {"status": "approved", "auto": True, "reason": "confirmation disabled"}


def resolve_confirmation(token: str, decision: str, notes: str | None = None) -> dict:
    """No-op — kept pra compat com poller WhatsApp."""
    return {"ok": True, "noop": True, "reason": "confirmation disabled"}


def list_pending() -> list[dict]:
    return []
