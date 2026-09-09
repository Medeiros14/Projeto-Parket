"""
Lembrete Service — Agendamento de contatos no funil comercial
=============================================================
Gerencia lembretes (reminders) para cards na coluna "lembretes"
do kanban comercial-entrada. Quando o dia/hora chega, dispara
alertas no grupo comercial e no grupo de agentes (squads).
"""

import structlog
from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings

logger = structlog.get_logger(__name__)

SP_TZ = ZoneInfo("America/Sao_Paulo")

# Grupo do squad de agentes comercial
SQUADS_COMERCIAL_GROUP_ID = "120363423690432580@g.us"  # mesmo grupo comercial


async def criar_lembrete(
    card_id: str,
    lembrete_data: str,
    lembrete_hora: str,
    observacao: str = "",
) -> dict:
    """
    Move card para coluna 'follow-up-1' e salva data/hora do agendamento nos details.

    Args:
        card_id: ID do card no Supabase
        lembrete_data: Data no formato DD/MM/YYYY
        lembrete_hora: Hora no formato HH:MM
        observacao: Texto opcional do lembrete
    """
    from supabase import create_client
    from app.core.teka_agent import (
        COL_LEMBRETES, notify_lembrete_agendado, update_card_details, move_card,
    )
    from app.core.evolution_client import evolution_client

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    # Busca card atual
    card_resp = sb.table("kanban_cards").select("*").eq("id", card_id).single().execute()
    if not card_resp.data:
        raise ValueError(f"Card {card_id} não encontrado")

    card = card_resp.data

    # Converte data/hora para ISO
    try:
        dt = datetime.strptime(f"{lembrete_data} {lembrete_hora}", "%d/%m/%Y %H:%M")
        dt = dt.replace(tzinfo=SP_TZ)
        lembrete_iso = dt.isoformat()
    except ValueError:
        raise ValueError(f"Data/hora inválida: {lembrete_data} {lembrete_hora}. Use DD/MM/YYYY HH:MM")

    # Atualiza details com dados do lembrete
    await update_card_details(card_id, {
        "lembrete_data": lembrete_data,
        "lembrete_hora": lembrete_hora,
        "lembrete_iso": lembrete_iso,
        "lembrete_observacao": observacao,
        "lembrete_status": "agendado",
        "lembrete_criado_em": datetime.now(SP_TZ).isoformat(),
    }, sb)

    # Move para coluna follow-up-1
    await move_card(card_id, COL_LEMBRETES, sb)

    # Notifica grupo comercial
    # Recarrega card com details atualizados
    card_atualizado = sb.table("kanban_cards").select("*").eq("id", card_id).single().execute()
    if card_atualizado.data:
        await notify_lembrete_agendado(card_atualizado.data, lembrete_data, lembrete_hora, evolution_client)
        # Notifica squad de agentes
        await _notify_squad_agendamento(card_atualizado.data, lembrete_data, lembrete_hora)

    logger.info("lembrete_criado", card_id=card_id, data=lembrete_data, hora=lembrete_hora)
    return card_atualizado.data if card_atualizado.data else card


async def _notify_squad_agendamento(card: dict, lembrete_data: str, lembrete_hora: str):
    """Notifica o grupo de squads/agentes sobre o agendamento."""
    from app.core.evolution_client import evolution_client
    from app.api.kanban_bridge import _try_send_to_dept

    det = card.get("details", {}) or {}
    nome = det.get("nome") or card.get("title", "Lead")
    celular = det.get("celular", "")

    msg = (
        f"📅 *LEMBRETE AGENDADO — AGENTE COMERCIAL*\n\n"
        f"👤 *{nome}*\n"
        f"📱 {celular}\n"
        f"🗓 Data: *{lembrete_data}* às *{lembrete_hora}*\n\n"
        f"O agente comercial agendou um contato com este lead."
    )

    # Envia para o grupo squads via dept notification
    await _try_send_to_dept("comercial", msg)


async def check_lembretes_vencidos():
    """
    Verifica todos os cards na coluna 'follow-up-1' e dispara alertas
    para os que já chegaram na data/hora agendada.
    Chamado pelo cron job a cada minuto.
    """
    import redis as _redis
    from supabase import create_client
    from app.core.teka_agent import COL_LEMBRETES, notify_lembrete_vencido
    from app.core.evolution_client import evolution_client

    # Lock para evitar duplicação entre réplicas
    try:
        r = _redis.from_url(settings.REDIS_URL)
        lock = r.set("lembrete_cron_lock", "1", nx=True, ex=55)
        if not lock:
            return
    except Exception:
        pass

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    now = datetime.now(SP_TZ)

    try:
        # Busca todos os cards na coluna follow-up-1
        result = sb.table("kanban_cards") \
            .select("id,title,column_id,details") \
            .eq("dept_id", "comercial-entrada") \
            .eq("column_id", COL_LEMBRETES) \
            .execute()

        cards = result.data or []
        for card in cards:
            det = card.get("details", {}) or {}

            # Só processa lembretes com status "agendado"
            if det.get("lembrete_status") != "agendado":
                continue

            lembrete_iso = det.get("lembrete_iso", "")
            if not lembrete_iso:
                continue

            try:
                lembrete_dt = datetime.fromisoformat(lembrete_iso)
                if lembrete_dt.tzinfo is None:
                    lembrete_dt = lembrete_dt.replace(tzinfo=SP_TZ)
            except Exception:
                continue

            # Se o horário do lembrete já passou
            if now >= lembrete_dt:
                card_id = card["id"]
                logger.info("lembrete_vencido", card_id=card_id, title=card.get("title"))

                # Busca card completo para notificação
                card_full = sb.table("kanban_cards").select("*").eq("id", card_id).single().execute()
                if not card_full.data:
                    continue

                # Envia alerta para grupo comercial
                await notify_lembrete_vencido(card_full.data, evolution_client)

                # Envia alerta para grupo de squads/agentes
                await _notify_squad_lembrete_vencido(card_full.data)

                # Cria alerta no dashboard (aparece em Meu Departamento > Alertas)
                nome = det.get("nome_completo") or card.get("title", "")
                obs = det.get("lembrete_observacao") or ""
                hora = det.get("lembrete_hora", "")
                data = det.get("lembrete_data", "")
                try:
                    sb.table("alertas").insert({
                        "severity": "warning",
                        "rule": "lembrete_vencido",
                        "message": f"Lembrete de contato com {nome} — {data} às {hora}. {obs}".strip(),
                        "dept": "Comercial",
                        "auto_generated": True,
                        "resolved": False,
                        "status": "pendente",
                        "description": f"O lembrete agendado para {nome} chegou ao horário. Entre em contato com o cliente agora.",
                    }).execute()
                    logger.info("lembrete_alerta_criado", card_id=card_id, nome=nome)
                except Exception as ae:
                    logger.warning("lembrete_alerta_insert_failed", error=str(ae))

                # Atualiza status do lembrete
                existing = sb.table("kanban_cards").select("details").eq("id", card_id).single().execute()
                current = (existing.data or {}).get("details", {}) or {}
                current["lembrete_status"] = "notificado"
                current["lembrete_notificado_em"] = now.isoformat()
                sb.table("kanban_cards").update({"details": current}).eq("id", card_id).execute()

                logger.info("lembrete_alerta_enviado", card_id=card_id)

    except Exception as e:
        logger.error("lembrete_cron_error", error=str(e), exc_info=True)


async def _notify_squad_lembrete_vencido(card: dict):
    """Notifica o grupo de squads/agentes que o lembrete venceu."""
    from app.api.kanban_bridge import _try_send_to_dept

    det = card.get("details", {}) or {}
    nome = det.get("nome") or card.get("title", "Lead")
    celular = det.get("celular", "")
    observacao = det.get("lembrete_observacao", "")

    msg = (
        f"🔔 *ALERTA — LEMBRETE DE CONTATO AGORA!*\n\n"
        f"👤 *{nome}*\n"
        f"📱 {celular}\n"
    )
    if observacao:
        msg += f"📝 {observacao}\n"
    msg += (
        f"\n⚡ O agente comercial precisa entrar em contato com este lead AGORA!"
    )

    await _try_send_to_dept("comercial", msg)


async def listar_lembretes(status: str = None) -> list[dict]:
    """Lista todos os lembretes ativos no funil comercial."""
    from supabase import create_client
    from app.core.teka_agent import COL_LEMBRETES

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    result = sb.table("kanban_cards") \
        .select("*") \
        .eq("dept_id", "comercial-entrada") \
        .eq("column_id", COL_LEMBRETES) \
        .order("created_at", desc=False) \
        .execute()

    cards = result.data or []

    if status:
        cards = [c for c in cards if (c.get("details", {}) or {}).get("lembrete_status") == status]

    return cards
