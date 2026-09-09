"""
IA Notifier — Notifica grupo WhatsApp quando novo card é criado no setor IA.
Roda a cada minuto via scheduler, verifica cards criados nos últimos 2 minutos.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import os

logger = logging.getLogger("ia_notifier")

SP_TZ = ZoneInfo("America/Sao_Paulo")
TI_GROUP_ID = os.environ.get("TI_WHATSAPP_GROUP_ID", "120363405979905444@g.us")

# Cache de IDs já notificados (evita duplicata)
_notified_ids: set = set()


async def check_novos_cards_ia():
    """Verifica se há novos cards no setor IA e envia notificação."""
    from supabase import create_client
    from app.config import settings
    from app.core.evolution_client import evolution_client

    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        agora = datetime.now(SP_TZ)
        dois_min_atras = (agora - timedelta(minutes=2)).isoformat()

        result = sb.table("kanban_cards") \
            .select("id,title,column_id,responsavel,priority,tags,subtitle,created_at") \
            .eq("dept_id", "ia") \
            .gte("created_at", dois_min_atras) \
            .execute()

        cards = result.data or []

        for card in cards:
            card_id = card.get("id", "")
            if card_id in _notified_ids:
                continue

            _notified_ids.add(card_id)

            title = card.get("title", "Sem título")
            coluna = card.get("column_id", "backlog")
            responsavel = card.get("responsavel", "—")
            priority = card.get("priority", "media")
            subtitle = card.get("subtitle", "") or ""
            tags = card.get("tags") or []

            # Mapear coluna para label legível
            col_labels = {
                "backlog": "Backlog",
                "planejamento": "Planejamento",
                "desenvolvendo": "Desenvolvendo",
                "verificando": "Verificando",
                "aprovado": "Aprovado",
                "finalizado": "Finalizado",
            }
            col_label = col_labels.get(coluna, coluna)

            # Emoji de prioridade
            prio_emoji = "🔴" if priority == "alta" else "🟡" if priority == "media" else "🟢"

            msg = f"🆕 *Nova tarefa no setor IA*\n"
            msg += f"\n"
            msg += f"📋 *{title}*\n"
            if subtitle:
                msg += f"_{subtitle}_\n"
            msg += f"\n"
            msg += f"📌 Coluna: {col_label}\n"
            msg += f"👤 Responsável: {responsavel}\n"
            msg += f"{prio_emoji} Prioridade: {priority.capitalize()}\n"
            if tags:
                msg += f"🏷️ Tags: {', '.join(tags)}\n"
            msg += f"\n"
            msg += f"🔗 dashboard.parket.works/ia"

            await evolution_client.send_text(TI_GROUP_ID, msg)
            logger.info("ia_new_card_notified", card_id=card_id, title=title)

        # Limpa cache antigo (mantém últimos 200)
        if len(_notified_ids) > 200:
            _notified_ids.clear()

    except Exception as e:
        logger.error("ia_notifier_error", error=str(e), exc_info=True)
