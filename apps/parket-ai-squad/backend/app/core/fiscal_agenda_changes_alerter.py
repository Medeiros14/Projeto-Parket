"""
Fiscal Agenda Changes Alerter
==============================
Roda a cada 2 min. Detecta mudanças em fiscal_agenda (cancelamento, alteração
de horário, tipo etc) e avisa no grupo WhatsApp do fiscal afetado.

Detecção:
  - Busca rows com updated_at >= now() - 5min
  - Pula rows recém-criadas (updated_at quase igual a created_at — usa
    margem de 30s pra cobrir delays entre INSERT e first SELECT)
  - Snapshot do estado anterior em Redis (chave fiscal_agenda_snap:<id>)
    pra comparar e identificar O QUE mudou (status, hora, tipo, notas)
  - Pula se não há diff real (defesa contra updates idempotentes)
"""

import hashlib
import json
import re
import structlog
import pytz
import httpx
from datetime import datetime, timedelta

from app.config import settings
from app.core.supabase_kanban import _headers
from app.core.evolution_client import evolution_client

logger = structlog.get_logger(__name__)

_TZ_BR = pytz.timezone("America/Sao_Paulo")
SUPABASE_URL = settings.SUPABASE_URL

_TIPO_LABEL = {
    "1vistoria": "1ª Vistoria",
    "2vistoria": "2ª Vistoria",
    "acompanhamento": "Acompanhamento",
    "entrega": "Entrega",
    "reparo": "Reparo",
}

# Reaproveita as regras de limpeza de notas (sem Trello, sem URLs)
_RX_TAG_TRELLO = re.compile(r"\s*\[\s*Lista\s+Trello[^\]]*\]\s*", re.IGNORECASE)
_RX_MD_IMG = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_RX_MD_LINK = re.compile(r"\[([^\]]*)\]\((?:https?:)?[^)]*\)")
_RX_URL = re.compile(r"https?://\S+", re.IGNORECASE)


def _clean_notas(s):
    if not s:
        return ""
    out = _RX_MD_IMG.sub(" ", str(s))
    out = _RX_MD_LINK.sub(r"\1", out)
    out = _RX_TAG_TRELLO.sub(" ", out)
    out = _RX_URL.sub(" ", out)
    out = re.sub(r"\s*\|\s*\|\s*", " | ", out)
    out = re.sub(r"^\s*\|\s*|\s*\|\s*$", "", out)
    out = re.sub(r"\s{2,}", " ", out)
    return out.strip()


def _fmt_when(iso):
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(_TZ_BR)
        return dt.strftime("%d/%m %H:%M")
    except Exception:
        return str(iso)


def _snapshot(row):
    """Resumo compacto pra comparar mudanças. Inclui apenas campos que importam
    pro fiscal saber (não inclui updated_at em si)."""
    return {
        "status": (row.get("status") or "").lower(),
        "data_inicio": row.get("data_inicio") or "",
        "tipo": row.get("tipo") or "",
        "obra": (row.get("obra") or "").strip(),
        "cliente": (row.get("cliente") or "").strip(),
        "notas": _clean_notas(row.get("notas") or ""),
        "fiscal_id": row.get("fiscal_id") or "",
    }


def _diff_changes(prev, cur):
    """Retorna lista de strings descrevendo o que mudou."""
    changes = []
    if prev["status"] != cur["status"]:
        if cur["status"] in ("cancelado", "cancelada"):
            changes.append("❌ *CANCELADA*")
        elif cur["status"] in ("concluido", "concluida", "concluído", "concluída"):
            changes.append("✅ marcada como concluída")
        else:
            changes.append(f"📌 status: *{prev['status'] or '—'}* → *{cur['status'] or '—'}*")
    if prev["data_inicio"] != cur["data_inicio"]:
        changes.append(f"⏰ horário: *{_fmt_when(prev['data_inicio'])}* → *{_fmt_when(cur['data_inicio'])}*")
    if prev["tipo"] != cur["tipo"]:
        old = _TIPO_LABEL.get(prev["tipo"], prev["tipo"]) or "—"
        new = _TIPO_LABEL.get(cur["tipo"], cur["tipo"]) or "—"
        changes.append(f"🔧 tipo: *{old}* → *{new}*")
    if prev["fiscal_id"] != cur["fiscal_id"]:
        changes.append("👷 fiscal reatribuído")
    if prev["notas"] != cur["notas"]:
        changes.append("📝 observações atualizadas")
    return changes


async def _fetch_recent_changes():
    """Busca rows alteradas nos últimos 5min, exclui as recém-criadas."""
    desde = (datetime.now(_TZ_BR) - timedelta(minutes=5)).astimezone(pytz.UTC).isoformat()
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/fiscal_agenda",
            headers=_headers(),
            params={
                "select": "id,fiscal_id,tipo,data_inicio,obra,cliente,status,notas,created_at,updated_at",
                "updated_at": f"gte.{desde}",
                "order": "updated_at.desc",
            },
        )
        r.raise_for_status()
        return r.json() or []


async def _fetch_fiscal_group(fiscal_id):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/fiscal_equipe",
            headers=_headers(),
            params={
                "select": "nome,whatsapp_group_jid",
                "id": f"eq.{fiscal_id}",
                "limit": "1",
            },
        )
        r.raise_for_status()
        rows = r.json() or []
        return rows[0] if rows else None


def _build_msg(nome, cur, changes):
    tipo_label = _TIPO_LABEL.get(cur["tipo"], cur["tipo"]) or "Visita"
    cliente = cur["cliente"] or cur["obra"] or "—"
    quando = _fmt_when(cur["data_inicio"])
    lines = [
        "🔔 *Alteração na agenda*",
        f"_{(nome or 'fiscal').strip().title()}_",
        "",
        f"👤 {cliente}",
        f"🛠️ {tipo_label} · {quando}",
        "",
    ]
    for c in changes:
        lines.append(f"  • {c}")
    lines.append("")
    lines.append("🔗 https://verifica.parket.works/")
    return "\n".join(lines)


async def check_fiscal_agenda_changes():
    """Cron principal. Compara cada row alterada com snapshot Redis e dispara
    aviso se houve mudança real desde a última observação."""
    import redis as _redis
    try:
        r = _redis.from_url(settings.REDIS_URL)
    except Exception as e:
        logger.error("redis_unavailable", error=str(e))
        return {"erro": "redis"}

    # Lock pra evitar duplicar entre réplicas (TTL 110s, cron roda a cada 120s)
    if not r.set("fiscal_changes_lock", "1", nx=True, ex=110):
        return {"skip": "lock"}

    rows = await _fetch_recent_changes()
    enviadas = 0
    sem_diff = 0
    novas = 0
    pulou_recente = 0

    for row in rows:
        rid = row["id"]
        try:
            created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            updated = datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
        except Exception:
            continue

        # Pula se updated é praticamente igual ao created (registro novo, não modificado)
        if (updated - created).total_seconds() < 30:
            pulou_recente += 1
            continue

        cur_snap = _snapshot(row)
        key = f"fiscal_agenda_snap:{rid}"
        prev_raw = r.get(key)

        if prev_raw is None:
            # 1ª vez vendo essa row — só salva snapshot, não avisa
            r.setex(key, 60 * 60 * 24 * 30, json.dumps(cur_snap))
            novas += 1
            continue

        try:
            prev_snap = json.loads(prev_raw)
        except Exception:
            prev_snap = None

        if prev_snap == cur_snap:
            sem_diff += 1
            continue

        # Dedup por (id, updated_at) — evita reenvio se o mesmo cron rodar 2x
        dedup_key = f"fiscal_change_notif:{rid}:{row['updated_at']}"
        if r.get(dedup_key):
            r.setex(key, 60 * 60 * 24 * 30, json.dumps(cur_snap))
            continue

        changes = _diff_changes(prev_snap or _snapshot({}), cur_snap)
        if not changes:
            r.setex(key, 60 * 60 * 24 * 30, json.dumps(cur_snap))
            sem_diff += 1
            continue

        fiscal = await _fetch_fiscal_group(row.get("fiscal_id"))
        if not fiscal or not fiscal.get("whatsapp_group_jid"):
            r.setex(key, 60 * 60 * 24 * 30, json.dumps(cur_snap))
            continue

        msg = _build_msg(fiscal.get("nome"), cur_snap, changes)
        try:
            await evolution_client.send_text(fiscal["whatsapp_group_jid"], msg)
            enviadas += 1
            r.setex(dedup_key, 60 * 60 * 24 * 7, "1")
            r.setex(key, 60 * 60 * 24 * 30, json.dumps(cur_snap))
            logger.info(
                "fiscal_agenda_change_notif",
                row_id=rid,
                fiscal=fiscal.get("nome"),
                changes=changes,
            )
        except Exception as e:
            logger.error("fiscal_change_send_failed", row_id=rid, error=str(e))

    logger.info(
        "fiscal_agenda_changes_done",
        rows=len(rows),
        enviadas=enviadas,
        sem_diff=sem_diff,
        novas_snapshot=novas,
        pulou_recente=pulou_recente,
    )
    return {
        "rows": len(rows),
        "enviadas": enviadas,
        "sem_diff": sem_diff,
        "novas_snapshot": novas,
        "pulou_recente": pulou_recente,
    }
