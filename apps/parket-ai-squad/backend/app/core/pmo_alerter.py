"""
PMO Alerter
============
Verifica diariamente obras com prazo crítico (≤ 14 dias) ou atrasadas.
Ações:
  1. Envia alerta no grupo WhatsApp de Produtividade
  2. Insere notificações no Supabase (tabela notificacoes) para o dashboard Parket
"""

import httpx
import structlog
import pytz
from datetime import datetime, date, timedelta
from typing import Optional

from app.config import settings
from app.core.supabase_kanban import _headers

logger = structlog.get_logger(__name__)

_TZ_BR = pytz.timezone("America/Sao_Paulo")
SUPABASE_URL = settings.SUPABASE_URL

# Obras nesses status são consideradas encerradas e ignoradas
_DONE_STATUSES = {"concluido", "encerrado", "cancelado", "concluída", "finalizado"}

# Quantos dias restantes disparam o alerta
ALERT_DAYS = 14


# ── Supabase helpers ──────────────────────────────────────────────────────────

async def _fetch_active_obras() -> list[dict]:
    """Retorna obras ainda ativas (não encerradas/canceladas)."""
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/obras",
            headers=_headers(),
            params={"select": "id,cliente,obra_code,status,localizacao,progresso", "limit": "500"},
        )
        r.raise_for_status()
        obras = r.json()
    return [
        o for o in obras
        if (o.get("status") or "").strip().lower() not in _DONE_STATUSES
    ]


async def _fetch_cronograma(obra_code: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/obras_cronograma",
            headers=_headers(),
            params={"obra_code": f"eq.{obra_code}", "select": "*", "order": "etapa.asc"},
        )
        r.raise_for_status()
        return r.json()


async def _fetch_all_user_ids() -> list[str]:
    """Retorna todos os user_ids cadastrados em user_profiles."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_profiles",
            headers=_headers(),
            params={"select": "id", "limit": "200"},
        )
        r.raise_for_status()
        return [row["id"] for row in r.json() if row.get("id")]


async def _insert_notificacao(
    user_id: str,
    titulo: str,
    mensagem: str,
    referencia_id: Optional[str] = None,
):
    payload: dict = {
        "user_id": user_id,
        "tipo": "alerta",
        "titulo": titulo,
        "mensagem": mensagem,
        "lida": False,
    }
    if referencia_id:
        payload["referencia_id"] = referencia_id
        payload["referencia_tipo"] = "obra"

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/notificacoes",
            headers=_headers(),
            json=payload,
        )
        r.raise_for_status()


# ── Date parsing ──────────────────────────────────────────────────────────────

def _parse_date(value: str) -> Optional[date]:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(value).strip()[:10], fmt).date()
        except (ValueError, TypeError):
            continue
    return None


# ── Main alerter ──────────────────────────────────────────────────────────────

async def check_and_alert_pmo():
    """
    Ponto de entrada do scheduler diário (08:00 São Paulo).
    - Analisa obras ativas
    - Detecta etapas com prazo ≤ 14 dias (ou vencidas)
    - Envia mensagem no WhatsApp do grupo Produtividade
    - Cria notificações no dashboard Parket para todos os usuários
    """
    today = datetime.now(_TZ_BR).date()
    logger.info("pmo_alerter_start", today=str(today))

    # 1. Obras ativas
    try:
        obras = await _fetch_active_obras()
    except Exception as e:
        logger.error("pmo_alerter_fetch_obras_error", error=str(e))
        return

    # 2. Verificar prazos
    urgent: list[dict] = []

    for obra in obras:
        obra_code = obra.get("obra_code")
        if not obra_code:
            continue
        try:
            cronograma = await _fetch_cronograma(obra_code)
        except Exception:
            continue

        # Procura a etapa pendente mais próxima do prazo
        for etapa in cronograma:
            status = (etapa.get("status") or "").lower()
            if status in ("done", "concluido", "concluída", "finalizado"):
                continue
            prazo_raw = etapa.get("prazo") or etapa.get("data_fim") or etapa.get("data_prevista")
            if not prazo_raw:
                continue
            prazo = _parse_date(str(prazo_raw))
            if prazo is None:
                continue

            days_left = (prazo - today).days
            if days_left <= ALERT_DAYS:
                if days_left < 0:
                    status_label = f"ATRASADA {abs(days_left)} dia(s)"
                elif days_left == 0:
                    status_label = "VENCE HOJE"
                else:
                    status_label = f"faltando {days_left} dia(s)"

                urgent.append({
                    "obra": obra,
                    "etapa": etapa,
                    "days_left": days_left,
                    "prazo": prazo,
                    "status_label": status_label,
                })
                break  # um alerta por obra é suficiente

    if not urgent:
        logger.info("pmo_alerter_no_critical_obras")
        return

    logger.info("pmo_alerter_critical_found", count=len(urgent))

    # 3. Montar mensagem WhatsApp
    urgent.sort(key=lambda x: x["days_left"])
    lines = [
        f"⚠️ *ALERTA PMO — {today.strftime('%d/%m/%Y')}*",
        f"_{len(urgent)} obra(s) com prazo crítico (≤ {ALERT_DAYS} dias):_",
        "",
    ]
    for item in urgent:
        o = item["obra"]
        e = item["etapa"]
        icon = "🔴" if item["days_left"] < 0 else ("🟠" if item["days_left"] <= 3 else "🟡")
        etapa_desc = e.get("descricao") or f"Etapa {e.get('etapa', '?')}"
        lines.append(
            f"{icon} *{o.get('cliente', o.get('obra_code', '?'))}* ({o.get('obra_code', '')})\n"
            f"   {etapa_desc} | Prazo: {item['prazo'].strftime('%d/%m/%Y')} | {item['status_label']}"
        )

    wpp_msg = "\n".join(lines)

    # 4. Enviar WhatsApp
    group_id = getattr(settings, "PMO_WHATSAPP_GROUP_ID", "")
    if group_id:
        try:
            from app.core.evolution_client import evolution_client
            await evolution_client.send_long_text(group_id, wpp_msg)
            logger.info("pmo_alert_whatsapp_sent", group_id=group_id, obras=len(urgent))
        except Exception as e:
            logger.error("pmo_alert_whatsapp_failed", error=str(e))
    else:
        logger.warning("pmo_alerter_group_id_not_set", hint="Configure PMO_WHATSAPP_GROUP_ID no .env")

    # Fan-out pro Gestão Douglas desativado a pedido — agora só o relatório
    # diário das 21h vai pro grupo de Gestão. PMO continua no grupo PMO.

    # 5. Notificações no dashboard
    try:
        user_ids = await _fetch_all_user_ids()
        if not user_ids:
            logger.warning("pmo_alerter_no_users_found")
            return

        for item in urgent:
            o = item["obra"]
            titulo = f"Prazo crítico: {o.get('cliente') or o.get('obra_code', '?')}"
            mensagem = (
                f"Obra {o.get('obra_code', '')} — {item['status_label']} "
                f"(prazo: {item['prazo'].strftime('%d/%m/%Y')})"
            )
            for uid in user_ids:
                try:
                    await _insert_notificacao(uid, titulo, mensagem, referencia_id=o.get("id"))
                except Exception as e:
                    logger.warning("pmo_notif_insert_failed", user_id=uid, error=str(e))

        logger.info(
            "pmo_alert_notificacoes_inserted",
            obras=len(urgent),
            users=len(user_ids),
            total=len(urgent) * len(user_ids),
        )
    except Exception as e:
        logger.error("pmo_alert_notificacoes_error", error=str(e))
