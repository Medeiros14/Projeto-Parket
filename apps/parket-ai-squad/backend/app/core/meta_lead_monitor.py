"""
Meta Lead Monitor — alerta horário pros grupos Parket IA + Comercial.

Roda a cada hora (cron). Verifica:
  1. Quantos leads Forms Meta chegaram na última hora
  2. Lista os 5 mais recentes
  3. Saúde da integração (Apps Script trigger ativo? webhook OK?)
  4. Stats agregadas (total no funil, distribuição por coluna)

Manda 1 mensagem resumida nos grupos do WhatsApp via Evolution.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any

import httpx
import structlog

from app.config import settings

logger = structlog.get_logger(__name__)

SP_TZ = ZoneInfo("America/Sao_Paulo")

# JIDs dos grupos de destino
GRUPO_PARKET_IA = "120363405979905444@g.us"        # 🤖 Parket IA
GRUPO_COMERCIAL = "120363423690432580@g.us"        # 🏢 Parket — Comercial

# Evolution API (instância Parket — usada pra postar nos grupos internos)
EVO_URL = os.environ.get("EVOLUTION_URL", "https://conect.parket.works")
EVO_INSTANCE = os.environ.get("EVOLUTION_INSTANCE", "Parket")
EVO_API_KEY = os.environ.get("EVOLUTION_API_KEY", "4eab105201410d6865b86dca76ee9fa3")


def _sb_headers() -> dict:
    return {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    }


async def _send_text(jid: str, text: str) -> bool:
    url = f"{EVO_URL}/message/sendText/{EVO_INSTANCE}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, headers={"apikey": EVO_API_KEY}, json={
                "number": jid,
                "text": text,
            })
            ok = r.status_code < 300
            if not ok:
                logger.warning("meta_monitor_send_failed", jid=jid, status=r.status_code,
                               body=r.text[:200])
            return ok
    except Exception as e:
        logger.error("meta_monitor_send_exception", jid=jid, error=str(e))
        return False


async def _fetch_leads_last_hour(now: datetime) -> list[dict]:
    """Cards Forms Meta criados/atualizados na última hora."""
    cutoff = (now - timedelta(hours=1)).isoformat()
    url = f"{settings.SUPABASE_URL}/rest/v1/kanban_cards"
    params = {
        "dept_id": "eq.comercial-entrada",
        "tags": "cs.{Forms Meta}",
        "created_at": f"gte.{cutoff}",
        "select": "id,title,column_id,details,created_at",
        "order": "created_at.desc",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, headers=_sb_headers(), params=params)
        if r.status_code >= 400:
            logger.warning("meta_monitor_supabase_failed", status=r.status_code, body=r.text[:200])
            return []
        return r.json() or []


async def _fetch_total_forms_meta() -> int:
    """Total de cards com tag Forms Meta (todos os tempos)."""
    url = f"{settings.SUPABASE_URL}/rest/v1/kanban_cards"
    params = {
        "dept_id": "eq.comercial-entrada",
        "tags": "cs.{Forms Meta}",
        "select": "id",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(url, headers={**_sb_headers(), "Prefer": "count=exact"}, params=params)
        cr = r.headers.get("content-range", "")
        # formato: "0-N/total"
        try:
            return int(cr.split("/")[-1])
        except Exception:
            return 0


def _format_leads(leads: list[dict]) -> str:
    if not leads:
        return "_Nenhum lead novo na última hora_"
    lines = []
    for l in leads[:5]:
        d = l.get("details") or {}
        plat = (d.get("platform_label") or "Meta")[:9]
        camp = (d.get("campaign_name") or "")[:30]
        nome = l.get("title") or "Sem nome"
        tel = d.get("celular") or "-"
        lines.append(f"• *{nome[:32]}* — {plat}\n   📞 {tel}  · {camp}")
    extra = ""
    if len(leads) > 5:
        extra = f"\n_...e mais {len(leads)-5}_"
    return "\n".join(lines) + extra


async def _check_integration_health() -> tuple[str, str]:
    """Verifica se a integração tá saudável.
    Retorna (status_emoji, mensagem)."""
    # 1. Webhook do agente.parket.works responde?
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get("https://agente.parket.works/")
            if r.status_code != 200:
                return ("⚠️", f"Backend agente: HTTP {r.status_code}")
    except Exception as e:
        return ("❌", f"Backend agente offline ({type(e).__name__})")

    # 2. Houve algum lead nas últimas 24h? (Apps Script ativo)
    cutoff_24h = (datetime.now(SP_TZ) - timedelta(hours=24)).isoformat()
    url = f"{settings.SUPABASE_URL}/rest/v1/kanban_cards"
    params = {
        "tags": "cs.{Forms Meta}",
        "created_at": f"gte.{cutoff_24h}",
        "select": "id",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(url, headers={**_sb_headers(), "Prefer": "count=exact"}, params=params)
            cr = r.headers.get("content-range", "")
            try:
                cnt_24h = int(cr.split("/")[-1])
            except Exception:
                cnt_24h = 0
    except Exception:
        cnt_24h = 0

    if cnt_24h == 0:
        return ("⚠️", "0 leads em 24h — Apps Script pode estar parado")
    return ("✅", f"OK — {cnt_24h} leads sincronizados nas últimas 24h")


async def hourly_meta_lead_report():
    """Job principal — chamado pelo scheduler 1x/hora."""
    now = datetime.now(SP_TZ)
    hh = now.strftime("%H:%M")

    leads = await _fetch_leads_last_hour(now)
    total = await _fetch_total_forms_meta()
    health_emoji, health_msg = await _check_integration_health()

    msg = (
        f"📥 *Forms Meta — Relatório horário* ({hh})\n"
        f"\n"
        f"*{len(leads)}* leads chegaram na última hora\n"
        f"*{total}* leads Forms Meta no total no funil\n"
        f"\n"
        f"{health_emoji} Integração: {health_msg}\n"
    )
    if leads:
        msg += "\n*Últimos leads:*\n" + _format_leads(leads)

    sent_ia = await _send_text(GRUPO_PARKET_IA, msg)
    # Grupo Comercial NÃO recebe mais relatório de Forms Meta — só agendamentos da Teca V2
    # (decisão do Will 2026-06-02). Relatório segue indo só pro grupo Parket IA.
    sent_co = False

    logger.info("meta_lead_hourly_report",
                leads_last_hour=len(leads), total=total, health=health_emoji,
                sent_ia=sent_ia, sent_comercial=sent_co)
    return {"ok": True, "leads_last_hour": len(leads), "total": total,
            "sent_ia": sent_ia, "sent_comercial": sent_co}
