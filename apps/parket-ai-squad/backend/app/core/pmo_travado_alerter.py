"""
PMO Travado/Não Liberado Alerter
==================================
Roda a cada 5 min e varre os cards do kanban PMO (`dept_id='produtividade'`)
procurando itens do cronograma com status `travado` ou `nao_liberado`.

Quando encontra um item *novo* nesse estado, dispara uma notificação no
grupo "📋 Parket - PMO" via Evolution. Cada combinação
(card_id, item_idx, status) só é notificada uma vez — dedupe via Redis com
TTL de 7 dias para evitar spam mas re-alertar se voltar a acontecer.

Texto é determinístico (mesmo princípio do `relatorio_pmo.py`): só usa o que
está no Supabase, sem LLM, sem invenção.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

logger = logging.getLogger("pmo_travado_alerter")

SP_TZ = ZoneInfo("America/Sao_Paulo")
PMO_GROUP_ID = "120363405460675664@g.us"  # 📋 Parket - PMO
PMO_DEPT_ID = "produtividade"

# Status que disparam alerta
ALERT_STATUS = {"travado", "nao_liberado"}

STATUS_LABEL = {
    "travado": "🟧 Travado",
    "nao_liberado": "🟪 Não Liberado",
}

REDIS_KEY_TPL = "pmo:travado_alert:{card_id}:{idx}:{status}"
REDIS_TTL_SECONDS = 7 * 24 * 3600  # 7 dias


def _redis_client():
    import redis as _redis
    from app.config import settings
    return _redis.from_url(settings.REDIS_URL)


def _safe_str(v) -> str:
    if v is None:
        return ""
    return str(v).strip()


async def check_pmo_travado():
    """Cron 5min — alerta no grupo PMO sobre serviços travados / não liberados."""
    from supabase import create_client
    from app.config import settings
    from app.core.evolution_client import evolution_client

    try:
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    except Exception as e:
        logger.error(f"pmo_travado_supabase_error: {e}", exc_info=True)
        return

    try:
        resp = (
            sb.table("kanban_cards")
            .select("id,title,obra,responsavel,column_id,details")
            .eq("dept_id", PMO_DEPT_ID)
            .execute()
        )
        cards = resp.data or []
    except Exception as e:
        logger.error(f"pmo_travado_fetch_error: {e}", exc_info=True)
        return

    try:
        r = _redis_client()
    except Exception as e:
        logger.error(f"pmo_travado_redis_error: {e}", exc_info=True)
        return

    novos: list[dict] = []
    for card in cards:
        details = card.get("details") or {}
        if not isinstance(details, dict):
            continue
        crono = details.get("cronograma_pmo") or {}
        if not isinstance(crono, dict):
            continue
        itens = crono.get("itens") or []
        if not isinstance(itens, list):
            continue

        for idx, it in enumerate(itens):
            if not isinstance(it, dict):
                continue
            status = _safe_str(it.get("status")).lower()
            if status not in ALERT_STATUS:
                continue

            key = REDIS_KEY_TPL.format(card_id=card.get("id"), idx=idx, status=status)
            try:
                # SET NX EX → só seta se não existir; retorna True se setou (ou seja, era novo)
                acquired = bool(r.set(key, "1", nx=True, ex=REDIS_TTL_SECONDS))
            except Exception as e:
                logger.warning(f"pmo_travado_redis_set_failed key={key} err={e}")
                continue
            if not acquired:
                continue  # já notificado dentro da janela TTL

            novos.append({
                "card_id": card.get("id"),
                "title": _safe_str(card.get("title")) or _safe_str(card.get("obra")) or "(sem nome)",
                "responsavel": _safe_str(card.get("responsavel")),
                "column_id": _safe_str(card.get("column_id")),
                "idx": idx + 1,
                "servico": _safe_str(it.get("servico")) or _safe_str(it.get("descricao")),
                "ambiente": _safe_str(it.get("ambiente")),
                "quantidade": it.get("quantidade"),
                "instalado": it.get("instalado"),
                "unidade": _safe_str(it.get("unidade")) or "m²",
                "observacao": _safe_str(it.get("observacao")),
                "status": status,
            })

    if not novos:
        logger.debug("pmo_travado_nenhum_novo")
        return

    # Monta mensagem agrupada por card
    agora = datetime.now(SP_TZ)
    linhas: list[str] = []
    linhas.append("⚠️ *PMO — SERVIÇO TRAVADO / NÃO LIBERADO*")
    linhas.append(f"📅 {agora.strftime('%d/%m/%Y %H:%M')}")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")

    # agrupa por card_id mantendo a ordem de descoberta
    por_card: dict[str, list[dict]] = {}
    for n in novos:
        por_card.setdefault(n["card_id"], []).append(n)

    for card_id, itens_card in por_card.items():
        first = itens_card[0]
        linhas.append("")
        linhas.append(f"🏗 *{first['title']}*")
        if first["responsavel"]:
            linhas.append(f"  👤 {first['responsavel']}")
        if first["column_id"]:
            linhas.append(f"  📍 {first['column_id'].replace('_', ' ').title()}")
        for it in itens_card:
            servico = it["servico"] or f"Serviço #{it['idx']}"
            linha = f"  • [{STATUS_LABEL[it['status']]}] {servico}"
            if it["ambiente"]:
                linha += f" — _{it['ambiente']}_"
            linhas.append(linha)
            if it["quantidade"]:
                inst = it["instalado"] or 0
                qt = it["quantidade"] or 0
                try:
                    linha2 = f"      📐 {float(inst):.1f}/{float(qt):.1f} {it['unidade']}"
                    linhas.append(linha2)
                except Exception:
                    pass
            if it["observacao"]:
                obs = it["observacao"][:120]
                linhas.append(f"      💬 _{obs}_")

    linhas.append("")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("🔗 space.parket.works")

    texto = "\n".join(linhas)

    try:
        await evolution_client.send_long_text(PMO_GROUP_ID, texto)
        logger.info(f"pmo_travado_alerts_sent qtd={len(novos)} cards={len(por_card)}")
    except Exception as e:
        logger.error(f"pmo_travado_send_error: {e}", exc_info=True)
        # Se falhou, libera o lock pra tentar de novo na próxima rodada
        for n in novos:
            try:
                r.delete(REDIS_KEY_TPL.format(card_id=n["card_id"], idx=n["idx"] - 1, status=n["status"]))
            except Exception:
                pass
