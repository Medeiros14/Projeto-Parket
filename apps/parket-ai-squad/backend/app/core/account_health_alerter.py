"""
Account Health Alerter
========================
Vigia o estado de saúde das contas AI (Claude / Gemini / OpenAI) e dispara
notificação no grupo "🤖 Agente Parket IA" toda vez que uma conta:
  • cai (is_healthy passa de True → False)
  • volta (is_healthy passa de False → True)

Roda a cada 1 minuto. Usa Redis para guardar o último estado conhecido por
conta e só notificar nas transições — sem spam.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

logger = logging.getLogger("account_health_alerter")

SP_TZ = ZoneInfo("America/Sao_Paulo")
SQUAD_IA_GROUP_ID = "120363405979905444@g.us"  # 🤖 Agente Parket IA

# Providers que queremos vigiar
WATCHED_PROVIDERS = {"claude", "gemini", "openai"}

REDIS_KEY = "account_health:last_state"  # hash → {account_id: "healthy"|"unhealthy"}


def _redis_client():
    import redis as _redis
    from app.config import settings
    return _redis.from_url(settings.REDIS_URL)


PROVIDER_LABEL = {
    "claude": "Claude",
    "gemini": "Gemini",
    "openai": "OpenAI",
}

PROVIDER_EMOJI = {
    "claude": "🟣",
    "gemini": "🔵",
    "openai": "🟢",
}


def _short_err(msg: str | None) -> str:
    if not msg:
        return ""
    s = msg.strip()
    if len(s) > 200:
        s = s[:200] + "…"
    return s


async def check_account_health():
    """Cron 1min — alerta quando provider AI cai ou se recupera."""
    from app.database import AsyncSessionLocal
    from app.models.ai_account import AIAccount
    from app.core.evolution_client import evolution_client
    from sqlalchemy import select

    try:
        r = _redis_client()
    except Exception as e:
        logger.error(f"account_health_redis_error: {e}", exc_info=True)
        return

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AIAccount).where(AIAccount.is_active == True)
            )
            accounts = list(result.scalars().all())
    except Exception as e:
        logger.error(f"account_health_db_error: {e}", exc_info=True)
        return

    transitions: list[dict] = []  # eventos a notificar

    for a in accounts:
        if a.provider not in WATCHED_PROVIDERS:
            continue
        current = "healthy" if a.is_healthy else "unhealthy"
        key_field = str(a.id)
        try:
            previous_raw = r.hget(REDIS_KEY, key_field)
        except Exception as e:
            logger.warning(f"account_health_redis_hget_failed key={key_field} err={e}")
            continue
        previous = previous_raw.decode() if isinstance(previous_raw, (bytes, bytearray)) else previous_raw

        if previous is None:
            # Primeira observação — só seta o baseline, não notifica.
            try:
                r.hset(REDIS_KEY, key_field, current)
            except Exception:
                pass
            continue

        if previous != current:
            transitions.append({
                "id": str(a.id),
                "provider": a.provider,
                "label": a.label,
                "from": previous,
                "to": current,
                "consecutive_errors": a.consecutive_errors or 0,
                "last_error": _short_err(a.last_error),
                "auth_type": (a.extra or {}).get("auth_type", "?"),
                "model": (a.extra or {}).get("model", ""),
            })
            try:
                r.hset(REDIS_KEY, key_field, current)
            except Exception:
                pass

    if not transitions:
        return

    # Monta mensagem agrupada
    agora = datetime.now(SP_TZ)
    linhas: list[str] = []
    linhas.append("🚨 *Saúde das contas IA — alerta*")
    linhas.append(f"📅 {agora.strftime('%d/%m/%Y %H:%M:%S')}")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")

    for t in transitions:
        emoji = PROVIDER_EMOJI.get(t["provider"], "⚪")
        prov = PROVIDER_LABEL.get(t["provider"], t["provider"])
        linhas.append("")
        if t["to"] == "unhealthy":
            linhas.append(f"{emoji} *{prov} CAIU* — {t['label']}")
            linhas.append(f"  • auth: {t['auth_type']}" + (f" · model: {t['model']}" if t['model'] else ""))
            linhas.append(f"  • erros consecutivos: {t['consecutive_errors']}")
            if t["last_error"]:
                linhas.append(f"  • último erro: _{t['last_error']}_")
        else:
            linhas.append(f"{emoji} *{prov} VOLTOU* — {t['label']}")
            linhas.append(f"  • auth: {t['auth_type']}" + (f" · model: {t['model']}" if t['model'] else ""))
            linhas.append(f"  • estava down há {t['consecutive_errors']} erro(s)")

    linhas.append("")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━")
    linhas.append("🔗 agente.parket.works/accounts")

    texto = "\n".join(linhas)

    try:
        await evolution_client.send_text(SQUAD_IA_GROUP_ID, texto)
        logger.info(f"account_health_alerts_sent qtd={len(transitions)}")
    except Exception as e:
        logger.error(f"account_health_send_error: {e}", exc_info=True)
