"""
HTTP endpoints para controle e monitoramento da Teca V2.

Rotas:
  POST /api/teca/pause/{phone}       — pausa manual (botão no ChatPanel do Homebroker)
  POST /api/teca/resume/{phone}      — reativa
  GET  /api/teca/status/{phone}      — status + histórico recente do lead
  GET  /api/teca/queue                — fila atual (telefones ativos nas últimas N horas)
  GET  /api/teca/metrics              — métricas agregadas (taxa agend., escalações, etc.)
"""
from __future__ import annotations

import time
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.teca_v2 import state as state_mod
from app.core.teca_v2.sandbox import normalize_phone, is_v2_enabled_for_phone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/teca", tags=["teca-v2"])


class PauseRequest(BaseModel):
    motivo: str | None = None


@router.post("/pause/{phone}")
async def pause_teca(phone: str, body: PauseRequest | None = None):
    phone = normalize_phone(phone)
    motivo = (body.motivo if body else None) or "pausada manualmente"
    await state_mod.set_paused(phone, motivo=motivo)
    return {"ok": True, "phone": phone, "paused": True, "motivo": motivo}


@router.post("/resume/{phone}")
async def resume_teca(phone: str):
    phone = normalize_phone(phone)
    await state_mod.clear_paused(phone)
    return {"ok": True, "phone": phone, "paused": False}


@router.get("/status/{phone}")
async def get_status(phone: str):
    phone = normalize_phone(phone)
    paused = await state_mod.is_paused(phone)
    state = await state_mod.get_state(phone)
    history = await state_mod.get_history(phone, limit=40)
    return {
        "phone": phone,
        "paused": paused,
        "v2_enabled": is_v2_enabled_for_phone(phone),
        "state": state,
        "history": history,
        "messages_count": len(history),
    }


@router.get("/queue")
async def queue_active(window_hours: int = Query(24, ge=1, le=168)):
    """
    Lista telefones com atividade na janela de N horas.
    Itera as chaves teca_v2:conv:* e olha o timestamp da última mensagem.
    """
    from redis.asyncio import Redis
    from app.config import settings

    r = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    cutoff = time.time() - window_hours * 3600
    items: list[dict] = []
    try:
        async for key in r.scan_iter(match="teca_v2:conv:*", count=200):
            phone = key.split(":", 2)[-1]
            raw_last = await r.lindex(key, -1)
            if not raw_last:
                continue
            try:
                last = json.loads(raw_last)
            except Exception:
                continue
            ts = last.get("ts", 0)
            if ts < cutoff:
                continue
            count = await r.llen(key)
            state = await r.get(f"teca_v2:state:{phone}")
            try:
                state = json.loads(state) if state else {}
            except Exception:
                state = {}
            paused = bool(await r.exists(f"teca_v2:paused:{phone}"))
            items.append({
                "phone": phone,
                "last_msg_ts": ts,
                "last_msg_role": last.get("role"),
                "last_msg_preview": (last.get("content") or "")[:120],
                "messages_count": count,
                "etapa": state.get("etapa", ""),
                "intent_atual": state.get("intent_atual", ""),
                "paused": paused,
            })
    finally:
        await r.aclose()
    items.sort(key=lambda x: x["last_msg_ts"], reverse=True)
    return {"window_hours": window_hours, "count": len(items), "items": items}


@router.get("/metrics")
async def metrics(window_hours: int = Query(24, ge=1, le=168)):
    """
    Métricas agregadas: total de leads ativos, escalações, agendamentos criados,
    tempo médio de resposta (placeholder), distribuição por intent.
    """
    from redis.asyncio import Redis
    from app.config import settings

    r = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    cutoff = time.time() - window_hours * 3600

    total_leads = 0
    paused_count = 0
    intents: dict[str, int] = {}
    etapas: dict[str, int] = {}
    agendados = 0
    escalados = 0
    msgs_total = 0

    try:
        async for key in r.scan_iter(match="teca_v2:conv:*", count=200):
            phone = key.split(":", 2)[-1]
            raw_last = await r.lindex(key, -1)
            if not raw_last:
                continue
            try:
                last = json.loads(raw_last)
            except Exception:
                continue
            if last.get("ts", 0) < cutoff:
                continue
            total_leads += 1
            msgs_total += await r.llen(key)
            state_raw = await r.get(f"teca_v2:state:{phone}")
            try:
                state = json.loads(state_raw) if state_raw else {}
            except Exception:
                state = {}
            etapa = state.get("etapa", "")
            if etapa:
                etapas[etapa] = etapas.get(etapa, 0) + 1
                if etapa == "agendado":
                    agendados += 1
                if etapa == "escalado_humano":
                    escalados += 1
            if bool(await r.exists(f"teca_v2:paused:{phone}")):
                paused_count += 1
            # intent — derivado da meta da última msg assistant
            # Itera últimas 5 msgs assistant pra pegar última intent registrada
            tail = await r.lrange(key, -10, -1)
            for s in reversed(tail):
                try:
                    m = json.loads(s)
                    if m.get("role") == "assistant":
                        i = ((m.get("meta") or {}).get("intent")) or ""
                        if i:
                            intents[i] = intents.get(i, 0) + 1
                            break
                except Exception:
                    continue
    finally:
        await r.aclose()

    taxa_agendamento = (agendados / total_leads * 100) if total_leads else 0.0
    taxa_escalacao = (escalados / total_leads * 100) if total_leads else 0.0
    return {
        "window_hours": window_hours,
        "total_leads": total_leads,
        "paused": paused_count,
        "agendados": agendados,
        "escalados": escalados,
        "taxa_agendamento_pct": round(taxa_agendamento, 1),
        "taxa_escalacao_pct": round(taxa_escalacao, 1),
        "messages_total": msgs_total,
        "messages_avg_per_lead": round(msgs_total / total_leads, 1) if total_leads else 0,
        "intents_distribuicao": intents,
        "etapas_distribuicao": etapas,
    }


# ── Atribuição de especialista a um agendamento ──
@router.post("/agendamentos/{agendamento_id}/atribuir")
async def atribuir_especialista(agendamento_id: str, payload: dict):
    """Atribui um especialista a um agendamento criado sem vendedor ('A definir').
    Atualiza a linha, reseta a flag de alerta e notifica o grupo comercial.
    Payload: {"vendedor": "Marina Torino"}"""
    from app.core.teca_v2 import lembretes as _lemb
    import httpx as _httpx
    from app.config import settings as _cfg

    novo = (payload.get("vendedor") or "").strip()
    if not novo:
        from fastapi import HTTPException
        raise HTTPException(400, "vendedor é obrigatório")

    headers = {
        "apikey": _cfg.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {_cfg.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    async with _httpx.AsyncClient(timeout=15) as cli:
        r = await cli.patch(
            f"{_cfg.SUPABASE_URL}/rest/v1/agendamentos?id=eq.{agendamento_id}",
            headers=headers,
            json={"vendedor": novo, "atribuicao_alerta_enviado": False},
        )
        if r.status_code >= 400:
            from fastapi import HTTPException
            raise HTTPException(502, f"Supabase {r.status_code}: {r.text[:200]}")

    notif_ok = await _lemb.notificar_atribuicao(agendamento_id, novo)
    return {"ok": True, "notificacao_enviada": notif_ok}
