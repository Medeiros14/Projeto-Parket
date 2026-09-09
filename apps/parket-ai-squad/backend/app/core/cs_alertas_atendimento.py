"""
CS Alertas — Grupo "🎧 Parket - Atendimento"
=============================================
Roda a cada 10 min. 2 tipos de alerta no grupo da equipe de atendimento:

1. Cliente esperando > 1h:
   - last_msg_from_me=false E last_msg_at >= 1h E < 24h
   - Manda 1x por janela de 1h (dedup Redis 4h)
   - Inclui sugestão de resposta via wa-ai-copilot

2. Promessa não cumprida > 4h:
   - Última msg OUTBOUND nossa contém "vou conferir/verificar/checar/consultar/retorno"
   - E não houve outra OUTBOUND nossa depois (não retornamos com a info)
   - last_msg_at (cliente) ou nossa promessa >= 4h
   - Dedup Redis 24h
"""

import asyncio
import httpx
import re
import json
import structlog
import pytz
from datetime import datetime, timedelta

from app.config import settings
from app.core.supabase_kanban import _headers
from app.core.evolution_client import evolution_client

logger = structlog.get_logger(__name__)
_TZ_BR = pytz.timezone("America/Sao_Paulo")
SB_URL = settings.SUPABASE_URL

ATENDIMENTO_GROUP_ID = "120363407367929089@g.us"  # 🎧 Parket - Atendimento
AI_URL = f"{SB_URL}/functions/v1/wa-ai-copilot"
WA_SECRET = "d0-_Ei-DRKJqQIRfrySmBXvbFCYbh9BcgSFaJ_gYcS4"

# Regex pra detectar promessas — "vou conferir", "te retorno", "deixa eu ver", etc
_RX_PROMESSA = re.compile(
    r"\b(vou\s+(conferir|verificar|checar|consultar|olhar|ver|chamar|falar|alinhar|perguntar)|"
    r"te\s+(retorno|aviso|respondo|chamo|falo|trago)|"
    r"deixa\s+(eu\s+)?(ver|conferir|verificar|checar)|"
    r"(j[áa]\s+)?j[áa]\s+(retorno|aviso|respondo|trago)|"
    r"vou\s+verificar|vou\s+procurar|aguarde\s+um\s+(momento|pouco)|"
    r"em\s+(instantes|breve)\s+(te\s+)?(retorno|aviso))",
    re.IGNORECASE,
)


def _redis():
    import redis
    return redis.from_url(settings.REDIS_URL)


async def _fetch_convs_ativas():
    """Conversas com status aberta/pendente e última msg do cliente."""
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/atendimento_conversas",
            headers=_headers(),
            params={
                "select": "id,grupo_jid,status,last_msg_at,last_msg_from_me,last_msg_preview,card_id,"
                          "atendimento_grupos!atend_conv_grupo_fk(subject,cliente),"
                          "kanban_cards(title,obra)",
                "instance_name": "eq.Secretaria - Obras Parket",
                "status": "in.(aberta,pendente,aguardando_cliente)",
                "limit": "500",
            },
        )
        r.raise_for_status()
        return r.json() or []


async def _ai_sugerir(conv_id: str) -> str | None:
    """Pede sugestão de resposta ao wa-ai-copilot."""
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                AI_URL,
                headers={"Content-Type": "application/json", "x-wa-secret": WA_SECRET},
                json={"action": "sugerir", "conversa_id": conv_id},
            )
            if not r.is_success:
                return None
            d = r.json() or {}
            sugs = d.get("sugestoes") or []
            if not sugs:
                return None
            # Pega a 1ª sugestão (mais provável)
            first = sugs[0]
            if isinstance(first, dict):
                return first.get("texto") or first.get("text") or None
            if isinstance(first, str):
                return first
            return None
    except Exception as e:
        logger.warning("ai_sugerir_falhou", conv_id=conv_id, error=str(e))
        return None


async def _ultima_promessa_outbound(grupo_jid: str) -> dict | None:
    """Retorna a última msg outbound nossa que contém promessa,
    SE não houve outra outbound depois (ou seja, não cumprimos ainda)."""
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/whatsapp_messages",
            headers=_headers(),
            params={
                "select": "id,message_text,timestamp,direction",
                "phone": f"eq.{grupo_jid}",
                "direction": "eq.outbound",
                "order": "timestamp.desc",
                "limit": "10",
            },
        )
        if not r.is_success:
            return None
        msgs = r.json() or []
    if not msgs:
        return None
    ultima = msgs[0]
    txt = (ultima.get("message_text") or "")
    if not _RX_PROMESSA.search(txt):
        return None
    # Se a última outbound JÁ é uma promessa e não há outbound posterior, é candidata.
    return ultima


def _nome_curto(conv):
    kc = conv.get("kanban_cards") or {}
    ag = conv.get("atendimento_grupos") or {}
    return (
        (kc.get("title") if isinstance(kc, dict) else None)
        or (ag.get("cliente") if isinstance(ag, dict) else None)
        or (ag.get("subject") if isinstance(ag, dict) else None)
        or "—"
    )


async def check_cs_alertas():
    agora = datetime.now(_TZ_BR)
    try:
        r = _redis()
    except Exception as e:
        logger.error("redis_unavailable", error=str(e))
        return {"erro": "redis"}

    # Lock pra evitar duplicar entre réplicas
    if not r.set("cs_alertas_lock", "1", nx=True, ex=540):  # 9min, cron roda 10min
        return {"skip": "lock"}

    convs = await _fetch_convs_ativas()
    alert_sem_resposta = 0
    alert_promessa = 0
    pulou_dedup = 0

    for conv in convs:
        cid = conv["id"]
        last_msg_at = conv.get("last_msg_at")
        if not last_msg_at:
            continue
        try:
            ts = datetime.fromisoformat(last_msg_at.replace("Z", "+00:00")).astimezone(_TZ_BR)
        except Exception:
            continue

        delta = agora - ts
        nome = _nome_curto(conv)
        grupo_jid = conv.get("grupo_jid")
        from_me = bool(conv.get("last_msg_from_me"))

        # --- Alerta 1: cliente esperando > 1h (e < 24h pra não spammar histórico) ---
        if (not from_me) and (timedelta(hours=1) <= delta < timedelta(hours=24)):
            # Dedup: 1 alerta por conv a cada 4h
            dedup_key = f"cs_alert_resp_1h:{cid}:{ts.isoformat()}"
            if r.get(dedup_key):
                pulou_dedup += 1
            else:
                horas = int(delta.total_seconds() // 3600)
                mins = int((delta.total_seconds() % 3600) // 60)
                tempo = f"{horas}h{mins:02d}min" if horas else f"{mins}min"
                preview = (conv.get("last_msg_preview") or "").strip()[:120]

                # Sugestão de resposta IA (opcional, não bloqueia o alerta)
                sugestao = await _ai_sugerir(cid)

                msg_parts = [
                    f"🟡 *Cliente esperando há {tempo}*",
                    f"_{nome}_",
                ]
                if preview:
                    msg_parts.append(f"💬 _{preview}_")
                if sugestao:
                    msg_parts += ["", "💡 *Sugestão de resposta:*", sugestao]
                msg_parts.append("")
                msg_parts.append("🔗 https://space.parket.works/operacional/spec-atend")

                msg = "\n".join(msg_parts)
                try:
                    await evolution_client.send_text(ATENDIMENTO_GROUP_ID, msg)
                    r.setex(dedup_key, 60 * 60 * 4, "1")
                    alert_sem_resposta += 1
                    logger.info("cs_alert_sem_resposta_1h", conv_id=cid, tempo=tempo)
                except Exception as e:
                    logger.error("cs_alert_send_failed", conv_id=cid, error=str(e))

        # --- Alerta 2: promessa não cumprida > 4h ---
        # Considera: última msg outbound contém promessa E foi enviada há >= 4h
        # (independente de from_me — se cliente respondeu depois ainda tá pendente do nosso lado)
        try:
            ultima_prom = await _ultima_promessa_outbound(grupo_jid)
        except Exception:
            ultima_prom = None
        if ultima_prom:
            try:
                prom_ts_raw = ultima_prom.get("timestamp")
                prom_ts = datetime.fromisoformat(str(prom_ts_raw).replace("Z", "+00:00")).astimezone(_TZ_BR)
            except Exception:
                prom_ts = None
            if prom_ts and (agora - prom_ts) >= timedelta(hours=4) and (agora - prom_ts) < timedelta(hours=48):
                msg_id = ultima_prom.get("id")
                dedup_key = f"cs_alert_promessa_4h:{cid}:{msg_id}"
                if r.get(dedup_key):
                    pulou_dedup += 1
                else:
                    horas = int((agora - prom_ts).total_seconds() // 3600)
                    snippet = (ultima_prom.get("message_text") or "").strip()[:150]
                    msg = "\n".join([
                        f"⏳ *Promessa em aberto há {horas}h*",
                        f"_{nome}_",
                        "",
                        f"📝 _Disse:_ \"{snippet}\"",
                        "",
                        "👉 Precisamos retornar com a info pro cliente.",
                        "",
                        "🔗 https://space.parket.works/operacional/spec-atend",
                    ])
                    try:
                        await evolution_client.send_text(ATENDIMENTO_GROUP_ID, msg)
                        r.setex(dedup_key, 60 * 60 * 24, "1")
                        alert_promessa += 1
                        logger.info("cs_alert_promessa_4h", conv_id=cid, horas=horas)
                    except Exception as e:
                        logger.error("cs_alert_promessa_send_failed", conv_id=cid, error=str(e))

    logger.info(
        "cs_alertas_done",
        total_convs=len(convs),
        sem_resposta=alert_sem_resposta,
        promessa=alert_promessa,
        pulou_dedup=pulou_dedup,
    )
    return {
        "total_convs": len(convs),
        "sem_resposta": alert_sem_resposta,
        "promessa": alert_promessa,
        "pulou_dedup": pulou_dedup,
    }
