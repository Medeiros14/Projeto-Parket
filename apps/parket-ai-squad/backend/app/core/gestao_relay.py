"""
Gestão Relay
============
Tudo o que precisa de execução, aprovação ou alerta no Dashboardparket é
encaminhado para o grupo "Parket - Gestão Douglas" para o Douglas ter
visibilidade macro de tudo que está acontecendo.

Dois caminhos:
1. notify_gestao(text)              — chamada direta usada pelos demais
                                       notificadores (ia_notifier, pmo_alerter etc).
2. check_pendencias_gestao()        — varredura periódica do kanban: cards com
                                       prioridade alta, em colunas de aprovação,
                                       ou marcados como urgente/alerta.
"""
import os
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger("gestao_relay")

SP_TZ = ZoneInfo("America/Sao_Paulo")

GESTAO_GROUP_ID = os.environ.get(
    "GESTAO_WHATSAPP_GROUP_ID", "120363425107346389@g.us"
)

# Cache de cards já encaminhados (evita repetir)
_relayed_cards: set = set()

# Colunas (column_id) que indicam que algo precisa de atenção do gestor.
# Mantemos amplo de propósito — qualquer coisa parecida com "aprov", "alerta",
# "urgente", "pendente" entra. Comparação case-insensitive.
# Setores que NÃO devem encaminhar pro Douglas (têm outro responsável).
# IA é responsabilidade do Will, não do Douglas.
_EXCLUDED_DEPTS = {"ia"}

_ATTENTION_KEYWORDS = (
    "aprov",      # aprovacao, aprovar, aprovado_pendente
    "alerta",
    "urgente",
    "pendente",
    "revisao",
    "validacao",
    "executar",
    "bloqueado",
    "atrasado",
)

# Mapeamento dept_id → nome legível pro Douglas
_DEPT_LABELS = {
    "comercial": "Comercial",
    "comercial-entrada": "Comercial (Funil de Entrada)",
    "compras": "Compras",
    "obras": "Obras",
    "financeiro": "Financeiro",
    "marcenaria": "Marcenaria",
    "produtividade": "PMO / Produtividade",
    "ia": "TI / IA",
    "rh": "RH",
    "logistica": "Logística",
    "projetos": "Projetos",
    "ux": "UX / Design",
    "atendimento": "Atendimento",
}


async def notify_gestao(text: str) -> None:
    """Encaminha uma mensagem livre para o grupo de Gestão Douglas."""
    if not text or not text.strip():
        return
    try:
        from app.core.evolution_client import evolution_client
        await evolution_client.send_text(GESTAO_GROUP_ID, text)
        logger.info("gestao_relay_sent", chars=len(text))
    except Exception as e:
        logger.error("gestao_relay_send_failed", error=str(e))


def _is_attention(card: dict) -> bool:
    col = (card.get("column_id") or "").lower()
    if any(k in col for k in _ATTENTION_KEYWORDS):
        return True
    if (card.get("priority") or "").lower() == "alta":
        return True
    tags = card.get("tags") or []
    if isinstance(tags, list) and any(
        any(k in str(t).lower() for k in _ATTENTION_KEYWORDS) for t in tags
    ):
        return True
    return False


async def check_pendencias_gestao():
    """Varre o kanban procurando cards que precisam de atenção do Douglas."""
    from supabase import create_client
    from app.config import settings

    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        agora = datetime.now(SP_TZ)
        # Janela maior que o ia_notifier porque rodamos a cada 5 min
        janela = (agora - timedelta(minutes=10)).isoformat()

        # Pega cards criados OU atualizados recentemente em qualquer setor.
        # Filtramos a "atenção" em memória pra não acoplar à convenção de
        # nomes de coluna de cada setor.
        result = (
            sb.table("kanban_cards")
            .select(
                "id,title,subtitle,column_id,dept_id,priority,tags,responsavel,updated_at,created_at"
            )
            .or_(f"updated_at.gte.{janela},created_at.gte.{janela}")
            .limit(200)
            .execute()
        )
        cards = result.data or []

        novos: list[dict] = []
        for c in cards:
            cid = c.get("id")
            if not cid or cid in _relayed_cards:
                continue
            if (c.get("dept_id") or "").lower() in _EXCLUDED_DEPTS:
                continue
            if not _is_attention(c):
                continue
            _relayed_cards.add(cid)
            novos.append(c)

        if not novos:
            return

        # Agrupa por setor pra dar uma síntese executiva
        por_setor: dict[str, list[dict]] = {}
        for c in novos:
            dept = c.get("dept_id") or "outros"
            por_setor.setdefault(dept, []).append(c)

        linhas: list[str] = ["⚠️ *Pendências para o Douglas*", ""]
        for dept, items in por_setor.items():
            label = _DEPT_LABELS.get(dept, dept.title())
            linhas.append(f"*{label}* ({len(items)})")
            for c in items[:6]:
                title = c.get("title", "Sem título")
                col = c.get("column_id", "")
                resp = c.get("responsavel") or "—"
                prio = (c.get("priority") or "").lower()
                emoji = "🔴" if prio == "alta" else "🟡" if prio == "media" else "🟢"
                linhas.append(f"  {emoji} {title}  _({col} · {resp})_")
            if len(items) > 6:
                linhas.append(f"  … +{len(items) - 6} outros")
            linhas.append("")
        linhas.append("🔗 dashboard.parket.works")

        await notify_gestao("\n".join(linhas))

        # Cap do cache
        if len(_relayed_cards) > 500:
            _relayed_cards.clear()

    except Exception as e:
        logger.error("gestao_relay_scan_failed", error=str(e), exc_info=True)
