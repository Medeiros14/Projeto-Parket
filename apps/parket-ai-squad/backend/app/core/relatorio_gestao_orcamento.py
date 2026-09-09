"""
Relatório diário 21:00 SP — Volume de orçamentos + funil comercial
====================================================================
Envia 1 mensagem curta e direta nos grupos:
  - 📋 Parket - Gestão Douglas (120363425107346389@g.us)
  - 💸 Parket - Orçamentos      (120363425314205066@g.us)

Conteúdo:
  1. Total de orçamentos gerados HOJE (e breakdown por vendedor/orcamentista)
  2. Leads novos HOJE (cards criados em comercial-entrada)
  3. Quantos viraram oportunidade HOJE (cards entraram no funil 'comercial')
"""

import httpx
import structlog
import pytz
from collections import Counter
from datetime import datetime

from app.config import settings
from app.core.supabase_kanban import _headers
from app.core.evolution_client import evolution_client

logger = structlog.get_logger(__name__)
_TZ_BR = pytz.timezone("America/Sao_Paulo")
SUPABASE_URL = settings.SUPABASE_URL

GESTAO_GROUP_ID = "120363425107346389@g.us"
ORCAMENTO_GROUP_ID = "120363425314205066@g.us"


def _hoje_range_iso():
    agora = datetime.now(_TZ_BR)
    inicio = agora.replace(hour=0, minute=0, second=0, microsecond=0)
    return inicio.astimezone(pytz.UTC).isoformat(), agora.astimezone(pytz.UTC).isoformat()


async def _count_orcamentos_hoje():
    desde, ate = _hoje_range_iso()
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SUPABASE_URL}/rest/v1/simulacao_projetos",
            headers=_headers(),
            params={
                "select": "id,vendedor,orcamentista,created_at",
                "created_at": f"gte.{desde}",
            },
        )
        r.raise_for_status()
        rows = r.json() or []
    por_pessoa = Counter()
    for row in rows:
        # prioridade: orcamentista > vendedor > "Sem responsável"
        nome = (row.get("orcamentista") or row.get("vendedor") or "Sem responsável").strip() or "Sem responsável"
        por_pessoa[nome] += 1
    return len(rows), por_pessoa


async def _count_kanban_hoje(dept_id: str) -> int:
    desde, ate = _hoje_range_iso()
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            f"{SUPABASE_URL}/rest/v1/kanban_cards",
            headers={**_headers(), "Prefer": "count=exact"},
            params={
                "select": "id",
                "dept_id": f"eq.{dept_id}",
                "created_at": f"gte.{desde}",
                "limit": "1",
            },
        )
        r.raise_for_status()
        cr = r.headers.get("content-range", "0/0")
        total = cr.split("/")[-1]
        try:
            return int(total)
        except Exception:
            return len(r.json() or [])


def _format(total_orc, por_pessoa, leads_novos, oportunidades, data_label):
    lines = [
        f"📊 *Relatório do dia — {data_label}*",
        "",
        f"📝 Orçamentos gerados: *{total_orc}*",
    ]
    if total_orc > 0:
        # Lista ordenada do maior pro menor
        for nome, qtd in por_pessoa.most_common():
            lines.append(f"  • {nome}: {qtd}")
    lines.append("")
    lines.append(f"🆕 Leads novos: *{leads_novos}*")
    lines.append(f"🎯 Viraram oportunidade: *{oportunidades}*")
    lines.append("")
    lines.append("🔗 https://space.parket.works/")
    return "\n".join(lines)


async def enviar_relatorio_gestao_orcamento():
    """Cron diário 21:00 SP — relatório nos 2 grupos."""
    total_orc, por_pessoa = await _count_orcamentos_hoje()
    leads_novos = await _count_kanban_hoje("comercial-entrada")
    oportunidades = await _count_kanban_hoje("comercial")
    data_label = datetime.now(_TZ_BR).strftime("%d/%m/%Y")

    msg = _format(total_orc, por_pessoa, leads_novos, oportunidades, data_label)

    sent = 0
    for jid in (GESTAO_GROUP_ID, ORCAMENTO_GROUP_ID):
        try:
            await evolution_client.send_text(jid, msg)
            sent += 1
            logger.info("relatorio_gestao_orcamento_enviado", group=jid, chars=len(msg))
        except Exception as e:
            logger.error("relatorio_gestao_orcamento_falhou", group=jid, error=str(e))

    return {
        "grupos_enviados": sent,
        "orcamentos": total_orc,
        "leads_novos": leads_novos,
        "oportunidades": oportunidades,
    }
