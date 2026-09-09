"""
Previsão de Obras Alerter
==========================
Alerta diário (08:00 SP) baseado em kanban_cards.details.previsao_inicio:

  • Lista geral pra Fiscal+PMO: projetos previstos pra iniciar em 30/60/90 dias
    e projetos atrasados (data passou e ainda em entrada/projeto).
  • Alertas individuais: projetos a 7 ou 15 dias do início — mensagem por projeto
    perguntando se está tudo certo pra iniciar dentro do prazo.

Apenas projetos do dept "operacional" são considerados.
"""

from __future__ import annotations

import asyncio
import re
import unicodedata
from datetime import date, datetime, timedelta
from typing import Optional

import httpx
import pytz
import structlog

from app.config import settings
from app.core.evolution_client import EvolutionAPIClient

logger = structlog.get_logger(__name__)

_TZ_BR = pytz.timezone("America/Sao_Paulo")

SUPABASE_URL = settings.SUPABASE_URL
SB_HEADERS = {
    "apikey": settings.SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

# Grupos WhatsApp que recebem o digest e os alertas individuais
GRUPO_FISCAL_JID = "120363425769227152@g.us"   # 📊 Parket - Fiscal
GRUPO_PMO_JID    = "120363405460675664@g.us"   # 📋 Parket - PMO
GRUPOS_DESTINO = [GRUPO_FISCAL_JID, GRUPO_PMO_JID]

# Janelas (dias até previsao_inicio); ordem importa pra montar o digest
WINDOW_30 = 30
WINDOW_60 = 60
WINDOW_90 = 90

# Janelas individuais — disparam mensagem por projeto
INDIVIDUAL_WINDOWS = (15, 7)


def _parse_date(value: object) -> Optional[date]:
    if not value:
        return None
    s = str(value).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except (ValueError, TypeError):
            continue
    return None


async def _fetch_obras_previsao() -> list[dict]:
    """Cards do dept=operacional com previsao_inicio populado em details."""
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers=SB_HEADERS,
            params={
                "select": "id,title,obra,column_id,details,responsavel,sla",
                "dept_id": "eq.operacional",
                "limit": "2000",
            },
        )
        r.raise_for_status()
        cards = r.json()

    out = []
    for c in cards:
        col = c.get("column_id") or ""
        if col in ("obras-finalizadas", "reparos-concluidos", "concluido"):
            continue
        det = c.get("details") if isinstance(c.get("details"), dict) else {}
        prev = _parse_date(det.get("previsao_inicio"))
        if not prev:
            continue
        out.append({
            "id": c["id"],
            "title": c.get("title") or "",
            "obra": c.get("obra"),
            "column_id": col,
            "previsao_inicio": prev,
            "vendedor": det.get("vendedor") or det.get("venda") or "",
            "estado": det.get("estado") or "",
            "fiscal_responsavel": det.get("fiscal_responsavel") or "",
        })
    return out


def _bucketize(cards: list[dict], today: date) -> dict[str, list[dict]]:
    """Distribui cards em buckets por janela de dias até inicio."""
    buckets = {
        "atrasados": [],   # previsao < hoje
        "d7": [],          # exatamente 7 dias (alerta individual)
        "d15": [],         # exatamente 15 dias (alerta individual)
        "d30": [],         # 0-30 dias (excluindo 7/15 que já vão como individual)
        "d60": [],         # 31-60 dias
        "d90": [],         # 61-90 dias
        "d90_plus": [],    # 91+ dias
    }
    for c in cards:
        delta = (c["previsao_inicio"] - today).days
        c["delta_dias"] = delta
        if delta < 0:
            buckets["atrasados"].append(c)
        elif delta == 7:
            buckets["d7"].append(c)
        elif delta == 15:
            buckets["d15"].append(c)
        elif 0 <= delta <= 30:
            buckets["d30"].append(c)
        elif 31 <= delta <= 60:
            buckets["d60"].append(c)
        elif 61 <= delta <= 90:
            buckets["d90"].append(c)
        else:
            buckets["d90_plus"].append(c)
    # ordena cada bucket por delta_dias
    for k in buckets:
        buckets[k].sort(key=lambda x: (x["delta_dias"], x["title"]))
    return buckets


def _fmt_date(d: date) -> str:
    return d.strftime("%d/%m")


def _fmt_card_line(c: dict) -> str:
    obra = f" · {c['obra']}" if c.get("obra") else ""
    estado = f" · {c['estado']}" if c.get("estado") else ""
    return f"  • {c['title'][:50]}{obra}{estado} — {_fmt_date(c['previsao_inicio'])}"


def _build_digest_message(buckets: dict, today: date) -> str:
    parts: list[str] = []
    parts.append("📅 *Previsão de Obras — resumo diário*")
    parts.append(f"_Atualizado em {today.strftime('%d/%m/%Y')}_\n")

    # Atrasadas são intencionalmente omitidas: o digest é forward-looking
    # (só obras com previsão futura ainda não cumprida). Atrasadas aparecem
    # na aba "📅 Previsão de Obras" pra limpeza manual.

    if buckets["d30"]:
        parts.append(f"🟡 *Iniciando em até 30 dias ({len(buckets['d30'])})*")
        for c in buckets["d30"]:
            parts.append(_fmt_card_line(c) + f"  ({c['delta_dias']}d)")
        parts.append("")

    if buckets["d60"]:
        parts.append(f"🟠 *Iniciando em 31–60 dias ({len(buckets['d60'])})*")
        for c in buckets["d60"]:
            parts.append(_fmt_card_line(c) + f"  ({c['delta_dias']}d)")
        parts.append("")

    if buckets["d90"]:
        parts.append(f"🔵 *Iniciando em 61–90 dias ({len(buckets['d90'])})*")
        for c in buckets["d90"]:
            parts.append(_fmt_card_line(c) + f"  ({c['delta_dias']}d)")
        parts.append("")

    if buckets["d90_plus"]:
        parts.append(f"⚪ *Iniciando em 90+ dias ({len(buckets['d90_plus'])})*")
        for c in buckets["d90_plus"][:20]:
            parts.append(_fmt_card_line(c) + f"  ({c['delta_dias']}d)")
        if len(buckets["d90_plus"]) > 20:
            parts.append(f"  …e mais {len(buckets['d90_plus']) - 20} obra(s)")

    return "\n".join(parts).strip()


def _build_individual_message(c: dict, dias: int) -> str:
    obra = f" ({c['obra']})" if c.get("obra") else ""
    fiscal = f"\n🧑‍💼 Fiscal: {c['fiscal_responsavel']}" if c.get("fiscal_responsavel") else ""
    return (
        f"⏰ *Previsão de início em {dias} dia{'s' if dias > 1 else ''}*\n"
        f"\n"
        f"🏗 *{c['title']}*{obra}\n"
        f"📅 Previsão: {c['previsao_inicio'].strftime('%d/%m/%Y')}{fiscal}\n"
        f"\n"
        f"Tudo certo pra iniciar dentro da previsão? Se houver pendência (vistoria, "
        f"liberação de obra, materiais), favor sinalizar pra ajustarmos o cronograma."
    )


async def _send_to_groups(text: str) -> None:
    """Envia a mesma mensagem pros 2 grupos (Fiscal e PMO)."""
    client = EvolutionAPIClient()
    for jid in GRUPOS_DESTINO:
        try:
            await client.send_text(jid, text)
            logger.info("previsao_obras_msg_sent", group=jid, chars=len(text))
        except Exception as e:
            logger.error("previsao_obras_msg_failed", group=jid, error=str(e))


async def check_and_alert_previsao_obras() -> None:
    """Entry point do scheduler diário (08:00 SP)."""
    today = datetime.now(_TZ_BR).date()
    logger.info("previsao_obras_alerter_start", today=str(today))

    try:
        cards = await _fetch_obras_previsao()
    except Exception as e:
        logger.error("previsao_obras_fetch_failed", error=str(e))
        return

    if not cards:
        logger.info("previsao_obras_no_cards_with_previsao_inicio")
        return

    buckets = _bucketize(cards, today)
    # Total considerado pra decidir se manda digest: só janelas futuras
    total_geral = sum(len(buckets[k]) for k in ("d30", "d60", "d90", "d90_plus"))
    logger.info(
        "previsao_obras_buckets",
        atrasados=len(buckets["atrasados"]),
        d7=len(buckets["d7"]),
        d15=len(buckets["d15"]),
        d30=len(buckets["d30"]),
        d60=len(buckets["d60"]),
        d90=len(buckets["d90"]),
        d90_plus=len(buckets["d90_plus"]),
    )

    # 1) Digest geral pra ambos grupos (se houver alguma obra em qualquer janela)
    if total_geral > 0:
        digest = _build_digest_message(buckets, today)
        await _send_to_groups(digest)
    else:
        logger.info("previsao_obras_no_general_alerts")

    # 2) Alertas individuais (15 dias e 7 dias)
    for c in buckets["d15"]:
        msg = _build_individual_message(c, 15)
        await _send_to_groups(msg)
        await asyncio.sleep(2)  # respiro entre envios pra não saturar
    for c in buckets["d7"]:
        msg = _build_individual_message(c, 7)
        await _send_to_groups(msg)
        await asyncio.sleep(2)

    logger.info("previsao_obras_alerter_done")
