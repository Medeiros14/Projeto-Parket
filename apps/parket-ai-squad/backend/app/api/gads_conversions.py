"""
Google Ads Data Manager — HTTPS pull endpoint (Offline Conversion Import).

O Google Ads bate periodicamente em GET /api/gads/conversions.csv,
autenticado via Basic Auth (GADS_BASIC_USER / GADS_BASIC_PASS), e recebe
um CSV com os leads qualificados pelo time SDR que têm gclid capturado
na captura do formulário.

Formato do CSV (Offline Conversion Import legacy — aceito pelo Data Manager):

    Parameters:TimeZone=-0300
    Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
    <gclid>,Lead Qualificado,2026-07-20 14:30:00-0300,0,

Fonte de dados: kanban_cards.details.qualified_event_sent=true
                + details.attribution.gclid presente
                + qualified_at dentro da janela de 90 dias (limite Google).

Escopo atual: só qualificados. Purchase entra depois.
"""
from __future__ import annotations
import base64
import csv
import io
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, Header, HTTPException, Response

from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/gads", tags=["gads"])

SB_URL = settings.SUPABASE_URL
SB_SK = settings.SUPABASE_SERVICE_KEY
SB_HEAD = {"apikey": SB_SK, "Authorization": f"Bearer {SB_SK}"}

GADS_USER = (getattr(settings, "GADS_BASIC_USER", "") or "").strip()
GADS_PASS = (getattr(settings, "GADS_BASIC_PASS", "") or "").strip()

# Nome LITERAL da Conversion Action criada no painel Google Ads.
# Case-sensitive: precisa bater EXATAMENTE com o nome lá. Configurável
# via env pra caso o time de marketing crie com outro nome.
CA_QUALIFIED = (getattr(settings, "GADS_CONV_ACTION_QUALIFIED", "") or "Lead Qualificado").strip()

# Timezone dos timestamps no CSV — America/Sao_Paulo (UTC-03, sem DST desde 2019).
SP_TZ = timezone(timedelta(hours=-3))
SP_OFFSET = "-0300"

# Janela de 90 dias: Google Ads rejeita conversões mais antigas.
WINDOW_DAYS = 90


def _check_basic_auth(authorization: Optional[str]) -> None:
    if not GADS_USER or not GADS_PASS:
        # Sem credencial configurada = endpoint travado (não devolver dados).
        raise HTTPException(500, "gads basic auth not configured")
    challenge = {"WWW-Authenticate": 'Basic realm="gads"'}
    if not authorization or not authorization.lower().startswith("basic "):
        raise HTTPException(401, "basic auth required", headers=challenge)
    try:
        decoded = base64.b64decode(authorization.split(" ", 1)[1]).decode()
        user, _, pw = decoded.partition(":")
    except Exception:
        raise HTTPException(401, "invalid basic auth", headers=challenge)
    ok_u = secrets.compare_digest(user, GADS_USER)
    ok_p = secrets.compare_digest(pw, GADS_PASS)
    if not (ok_u and ok_p):
        raise HTTPException(401, "bad credentials", headers=challenge)


def _fmt_ts_sp(iso_str: str) -> str:
    """ISO UTC → 'yyyy-MM-dd HH:mm:ss-0300' (America/Sao_Paulo)."""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(SP_TZ).strftime(f"%Y-%m-%d %H:%M:%S{SP_OFFSET}")
    except Exception:
        return ""


@router.get("/conversions.csv")
async def gads_conversions_csv(authorization: Optional[str] = Header(None)):
    """
    Endpoint pulled pelo Google Ads Data Manager (integração HTTPS).

    URL final: https://agente.parket.works/api/gads/conversions.csv
    """
    _check_basic_auth(authorization)

    # ISO "Z" sem microssegundos — PostgREST recebe via querystring e o "+"
    # do offset ISO seria interpretado como espaço na URL.
    cutoff = (datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    # Cards qualificados com CAPI OK nos últimos 90d. Filtro de gclid é feito
    # em Python — PostgREST não tem operador nested pra details->attribution->>gclid
    # com IS NOT NULL sem virar query complicada.
    q = (
        f"{SB_URL}/rest/v1/kanban_cards"
        "?select=id,details,updated_at"
        "&details->>qualified_event_sent=eq.true"
        f"&updated_at=gte.{cutoff}"
        "&order=updated_at.desc"
        "&limit=50000"
    )
    try:
        async with httpx.AsyncClient(timeout=30) as cli:
            r = await cli.get(q, headers=SB_HEAD)
            r.raise_for_status()
            cards = r.json()
    except Exception as e:
        logger.error("gads_fetch_cards_fail", error=str(e))
        raise HTTPException(500, "supabase fetch failed")

    out = io.StringIO()
    out.write(f"Parameters:TimeZone={SP_OFFSET}\n")
    w = csv.writer(out)
    # Colunas Google Ads Offline Conversion Import: um identificador por linha
    # (gclid OU gbraid OU wbraid), o resto fica vazio.
    w.writerow([
        "Google Click ID", "WBRAID", "GBRAID",
        "Conversion Name", "Conversion Time",
        "Conversion Value", "Conversion Currency",
    ])

    n_gclid = n_gbraid = n_wbraid = 0
    n_skipped_no_id = 0
    n_skipped_no_ts = 0
    for c in cards:
        det = c.get("details") or {}
        attrib = det.get("attribution") or {}
        gclid = (attrib.get("gclid") or "").strip()
        gbraid = (attrib.get("gbraid") or "").strip()
        wbraid = (attrib.get("wbraid") or "").strip()
        if not (gclid or gbraid or wbraid):
            n_skipped_no_id += 1
            continue
        ts = _fmt_ts_sp(det.get("qualified_at") or "")
        if not ts:
            n_skipped_no_ts += 1
            continue
        # Precedência: gclid (mais preciso) > gbraid > wbraid.
        if gclid:
            w.writerow([gclid, "", "", CA_QUALIFIED, ts, "0", ""])
            n_gclid += 1
        elif gbraid:
            w.writerow(["", "", gbraid, CA_QUALIFIED, ts, "0", ""])
            n_gbraid += 1
        else:
            w.writerow(["", wbraid, "", CA_QUALIFIED, ts, "0", ""])
            n_wbraid += 1

    logger.info(
        "gads_conversions_served",
        gclid_rows=n_gclid,
        gbraid_rows=n_gbraid,
        wbraid_rows=n_wbraid,
        skipped_no_id=n_skipped_no_id,
        skipped_no_ts=n_skipped_no_ts,
        total_scanned=len(cards),
        window_days=WINDOW_DAYS,
    )

    return Response(
        content=out.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="conversions.csv"'},
    )
