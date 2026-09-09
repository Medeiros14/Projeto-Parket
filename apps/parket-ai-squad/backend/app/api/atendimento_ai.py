"""
Atendimento AI Copilot — endpoints chamados pelo edge function `wa-ai-copilot`.

Fluxo:
  Dashboard (Operacional/Atendimento) → Supabase Edge `wa-ai-copilot`
    → POST /api/atendimento/{resumir|sugerir|sensibilidade}

Cada endpoint recebe o histórico de uma conversa de WhatsApp + contexto da obra
e devolve análise via Claude (account_pool OAuth).
"""
from __future__ import annotations

import json
import re
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.account_pool import account_pool
from app.database import AsyncSessionLocal

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/atendimento", tags=["atendimento-ai"])


class Message(BaseModel):
    direction: str | None = None      # "in" / "out"
    sender_name: str | None = None
    message_text: str | None = None
    timestamp: str | None = None


class Payload(BaseModel):
    grupo: str | None = None
    cliente: str | None = None
    obra: str | None = None
    cidade: str | None = None
    prestadores: list[str] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)


def _format_messages(msgs: list[Message]) -> str:
    lines = []
    for m in msgs[-30:]:
        who = (m.sender_name or "").strip() or ("Cliente" if m.direction == "in" else "Parket")
        prefix = "→" if m.direction == "out" else "←"
        text = (m.message_text or "").strip().replace("\n", " ")
        if not text:
            continue
        lines.append(f"{prefix} {who}: {text}")
    return "\n".join(lines) or "(sem mensagens)"


def _format_context(p: Payload) -> str:
    parts = []
    if p.cliente:
        parts.append(f"Cliente: {p.cliente}")
    if p.obra:
        parts.append(f"Obra: {p.obra}")
    if p.cidade:
        parts.append(f"Cidade: {p.cidade}")
    if p.grupo:
        parts.append(f"Grupo: {p.grupo}")
    if p.prestadores:
        parts.append("Prestadores: " + ", ".join(p.prestadores[:8]))
    return "\n".join(parts) or "(sem contexto)"


async def _ask(system_prompt: str, user_prompt: str) -> str:
    async with AsyncSessionLocal() as db:
        return await account_pool.chat(
            db=db,
            messages=[{"role": "user", "content": user_prompt}],
            system_prompt=system_prompt,
        )


def _extract_json(raw: str) -> dict | None:
    if not raw:
        return None
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE)
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return None
    return None


# ─── RESUMIR ─────────────────────────────────────────────────────────────────

@router.post("/resumir")
async def resumir(payload: Payload):
    system = (
        "Você é um copiloto de atendimento ao cliente da Parket (instalação de pisos). "
        "Resuma a conversa de WhatsApp em até 3 frases curtas focando no estado atual "
        "da obra, pedidos pendentes do cliente e próximos passos. Português brasileiro, "
        "tom objetivo. Responda APENAS com JSON: {\"resumo\":\"...\"}"
    )
    user = (
        f"Contexto:\n{_format_context(payload)}\n\n"
        f"Conversa (mais recente embaixo):\n{_format_messages(payload.messages)}"
    )
    try:
        raw = await _ask(system, user)
    except Exception as e:
        logger.error("atendimento_resumir_failed", error=str(e))
        raise HTTPException(status_code=502, detail=f"falha LLM: {e}")
    data = _extract_json(raw) or {}
    return {"resumo": data.get("resumo") or raw.strip()}


# ─── SUGERIR ─────────────────────────────────────────────────────────────────

@router.post("/sugerir")
async def sugerir(payload: Payload):
    system = (
        "Você é um copiloto de atendimento ao cliente da Parket. "
        "Com base no histórico, gere 3 sugestões curtas e práticas de respostas "
        "que o atendente pode mandar pro cliente AGORA. Cada sugestão deve ter no máximo "
        "2 frases, tom cordial e profissional, em português brasileiro. "
        "Responda APENAS com JSON: {\"sugestoes\":[\"...\",\"...\",\"...\"]}"
    )
    user = (
        f"Contexto:\n{_format_context(payload)}\n\n"
        f"Conversa (mais recente embaixo):\n{_format_messages(payload.messages)}"
    )
    try:
        raw = await _ask(system, user)
    except Exception as e:
        logger.error("atendimento_sugerir_failed", error=str(e))
        raise HTTPException(status_code=502, detail=f"falha LLM: {e}")
    data = _extract_json(raw) or {}
    sug = data.get("sugestoes") or data.get("suggestions") or []
    if isinstance(sug, str):
        sug = [sug]
    sug = [s for s in (sug or []) if isinstance(s, str) and s.strip()]
    return {"sugestoes": sug[:5]}


# ─── SENSIBILIDADE ───────────────────────────────────────────────────────────

@router.post("/sensibilidade")
async def sensibilidade(payload: Payload):
    system = (
        "Você é um copiloto que avalia o sentimento e a urgência de uma conversa de "
        "atendimento ao cliente da Parket. Classifique e responda APENAS com JSON: "
        "{\"sentimento\":\"positivo|neutro|negativo\","
        "\"urgencia\":\"baixa|media|alta\","
        "\"alertas\":[\"...\"],"
        "\"resumo\":\"frase curta sobre o estado emocional\"}"
        " Os alertas listam riscos concretos (atraso, falta material, reclamação, "
        "ameaça de cancelamento, etc). Português brasileiro."
    )
    user = (
        f"Contexto:\n{_format_context(payload)}\n\n"
        f"Conversa (mais recente embaixo):\n{_format_messages(payload.messages)}"
    )
    try:
        raw = await _ask(system, user)
    except Exception as e:
        logger.error("atendimento_sensibilidade_failed", error=str(e))
        raise HTTPException(status_code=502, detail=f"falha LLM: {e}")
    data = _extract_json(raw) or {}
    return {
        "sentimento": data.get("sentimento") or "neutro",
        "urgencia": data.get("urgencia") or "baixa",
        "alertas": data.get("alertas") or [],
        "resumo": data.get("resumo") or "",
    }
