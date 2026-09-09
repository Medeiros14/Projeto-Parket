"""
Relatório diário 19:00 SP — Resumo do Dia (Atendimento)
========================================================
Envia 1 mensagem nos grupos:
  - 📋 Parket - PMO            (120363405460675664@g.us)
  - 📋 Parket - Gestão Douglas (120363425107346389@g.us)

Analisa conversas do dia (whatsapp_messages das últimas 24h) e classifica em 4
categorias com base em volume e quem está esperando resposta:

  🌪️ CAÓTICAS         — >30 msgs hoje E ≥10 do cliente
  ✅ FLUINDO BEM      — 4-30 msgs, ambos lados ativos
  🔇 CLIENTE NÃO RESP — última msg foi NOSSA há >2h (cliente sumiu)
  ⏳ EM ABERTO        — última msg foi do CLIENTE há >1h (nós devemos)
"""

import httpx
import structlog
import pytz
from collections import defaultdict
from datetime import datetime, timedelta

from app.config import settings
from app.core.supabase_kanban import _headers
from app.core.evolution_client import evolution_client

logger = structlog.get_logger(__name__)
_TZ_BR = pytz.timezone("America/Sao_Paulo")
SB_URL = settings.SUPABASE_URL

PMO_GROUP_ID = "120363405460675664@g.us"
GESTAO_GROUP_ID = "120363425107346389@g.us"
INSTANCE = "Secretaria - Obras Parket"


async def _fetch_convs():
    """Conversas ativas da instância de atendimento."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/atendimento_conversas",
            headers=_headers(),
            params={
                "select": "id,grupo_jid,status,last_msg_at,last_msg_from_me,last_msg_preview,"
                          "atendimento_grupos!atend_conv_grupo_fk(subject,cliente),"
                          "kanban_cards(title)",
                "instance_name": f"eq.{INSTANCE}",
                "limit": "1000",
            },
        )
        r.raise_for_status()
        return r.json() or []


async def _fetch_msgs_24h():
    """Mensagens das últimas 24h agregadas por grupo_jid."""
    desde = (datetime.now(_TZ_BR) - timedelta(hours=24)).astimezone(pytz.UTC).isoformat()
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.get(
            f"{SB_URL}/rest/v1/whatsapp_messages",
            headers=_headers(),
            params={
                "select": "phone,direction,timestamp",
                "instance": f"eq.{INSTANCE}",
                "timestamp": f"gte.{desde}",
                "limit": "10000",
            },
        )
        if not r.is_success:
            logger.error("relatorio_msgs_fetch_failed", status=r.status_code)
            return []
        return r.json() or []


def _nome(conv):
    kc = conv.get("kanban_cards") or {}
    ag = conv.get("atendimento_grupos") or {}
    return (
        (kc.get("title") if isinstance(kc, dict) else None)
        or (ag.get("cliente") if isinstance(ag, dict) else None)
        or (ag.get("subject") if isinstance(ag, dict) else None)
        or "—"
    )[:42]


def _classifica(convs: list, msgs: list, agora: datetime):
    """Agrupa msgs por phone e classifica cada conv."""
    contagem = defaultdict(lambda: {"inbound": 0, "outbound": 0})
    for m in msgs:
        ph = m.get("phone")
        if not ph:
            continue
        if m.get("direction") == "outbound":
            contagem[ph]["outbound"] += 1
        else:
            contagem[ph]["inbound"] += 1

    caotic = []
    fluindo = []
    sem_resp_cliente = []
    em_aberto = []

    for conv in convs:
        jid = conv.get("grupo_jid")
        if not jid:
            continue
        cnt = contagem.get(jid, {"inbound": 0, "outbound": 0})
        total = cnt["inbound"] + cnt["outbound"]

        last_at_str = conv.get("last_msg_at")
        delta = None
        if last_at_str:
            try:
                ts = datetime.fromisoformat(last_at_str.replace("Z", "+00:00")).astimezone(_TZ_BR)
                delta = agora - ts
            except Exception:
                pass

        from_me = bool(conv.get("last_msg_from_me"))
        nome = _nome(conv)

        # CAÓTICAS: muito volume hoje E cliente bombardeando
        if total > 30 and cnt["inbound"] >= 10:
            caotic.append((nome, total, cnt["inbound"], cnt["outbound"]))
            continue

        # CLIENTE NÃO RESPONDEU: última msg nossa há >2h, sem retorno
        if from_me and delta and delta > timedelta(hours=2) and delta < timedelta(hours=72):
            sem_resp_cliente.append((nome, delta))
            continue

        # EM ABERTO: cliente esperando nossa resposta há >1h
        if (not from_me) and delta and delta > timedelta(hours=1) and delta < timedelta(hours=24):
            em_aberto.append((nome, delta))
            continue

        # FLUINDO BEM: atividade hoje, dois lados, dentro de volume saudável
        if 4 <= total <= 30 and cnt["inbound"] >= 1 and cnt["outbound"] >= 1:
            fluindo.append((nome, total, cnt["inbound"], cnt["outbound"]))

    # Ordenações
    caotic.sort(key=lambda x: -x[1])
    fluindo.sort(key=lambda x: -x[1])
    sem_resp_cliente.sort(key=lambda x: -x[1].total_seconds())
    em_aberto.sort(key=lambda x: -x[1].total_seconds())
    return caotic, fluindo, sem_resp_cliente, em_aberto


def _fmt_delta(td: timedelta) -> str:
    h = int(td.total_seconds() // 3600)
    m = int((td.total_seconds() % 3600) // 60)
    return f"{h}h{m:02d}min" if h else f"{m}min"


def _format(caotic, fluindo, sem_resp, em_aberto, data_label):
    lines = [f"📊 *Resumo do Dia — Atendimento ({data_label})*", ""]

    if caotic:
        lines.append(f"🌪️ *CAÓTICAS* ({len(caotic)})")
        for nome, total, ib, ob in caotic[:8]:
            lines.append(f"  • {nome} — {total} msgs ({ib} cliente / {ob} nós)")
        if len(caotic) > 8:
            lines.append(f"  … +{len(caotic) - 8} outras")
        lines.append("")

    if em_aberto:
        lines.append(f"⏳ *EM ABERTO* — esperando nossa resposta ({len(em_aberto)})")
        for nome, td in em_aberto[:10]:
            lines.append(f"  • {nome} — há {_fmt_delta(td)}")
        if len(em_aberto) > 10:
            lines.append(f"  … +{len(em_aberto) - 10} outras")
        lines.append("")

    if sem_resp:
        lines.append(f"🔇 *CLIENTE NÃO RESPONDEU* ({len(sem_resp)})")
        for nome, td in sem_resp[:10]:
            lines.append(f"  • {nome} — última nossa há {_fmt_delta(td)}")
        if len(sem_resp) > 10:
            lines.append(f"  … +{len(sem_resp) - 10} outras")
        lines.append("")

    if fluindo:
        lines.append(f"✅ *FLUINDO BEM* ({len(fluindo)})")
        for nome, total, ib, ob in fluindo[:8]:
            lines.append(f"  • {nome} — {total} msgs ({ib}/{ob})")
        if len(fluindo) > 8:
            lines.append(f"  … +{len(fluindo) - 8} outras")
        lines.append("")

    if not (caotic or em_aberto or sem_resp or fluindo):
        lines.append("_Sem movimentação relevante nas últimas 24h._")
        lines.append("")

    lines.append("🔗 https://space.parket.works/operacional/spec-atend")
    return "\n".join(lines)


async def enviar_relatorio_diario_atendimento():
    """Cron 19:00 SP — envia resumo do dia pros grupos PMO + Gestão."""
    agora = datetime.now(_TZ_BR)
    convs = await _fetch_convs()
    msgs = await _fetch_msgs_24h()
    caotic, fluindo, sem_resp, em_aberto = _classifica(convs, msgs, agora)

    msg = _format(caotic, fluindo, sem_resp, em_aberto, agora.strftime("%d/%m"))

    enviados = 0
    for jid in (PMO_GROUP_ID, GESTAO_GROUP_ID):
        try:
            await evolution_client.send_long_text(jid, msg)
            enviados += 1
            logger.info("relatorio_atend_enviado", group=jid, chars=len(msg))
        except Exception as e:
            logger.error("relatorio_atend_falhou", group=jid, error=str(e))

    return {
        "enviados": enviados,
        "caotic": len(caotic),
        "fluindo": len(fluindo),
        "sem_resp": len(sem_resp),
        "em_aberto": len(em_aberto),
    }
