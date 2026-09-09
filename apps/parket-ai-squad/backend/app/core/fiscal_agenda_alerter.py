"""
Fiscal Agenda Alerter
=====================
Roda 2x/dia. Pra cada fiscal ativo:
  - 18:00 SP (D-1): aviso prévio da agenda de AMANHÃ
  - 06:00 SP (D):   reforço da agenda de HOJE

Pula fiscal sem grupo WhatsApp cadastrado ou sem agendamentos.
Mensagem contém APENAS: horário, tipo de visita, cliente, endereço.
Nada de links externos (Trello, space.parket etc).
"""

import httpx
import re
import structlog
import pytz
from datetime import datetime, timedelta

from app.config import settings
from app.core.supabase_kanban import _headers
from app.core.evolution_client import evolution_client

logger = structlog.get_logger(__name__)

# Remove qualquer rastro de Trello vindo do sync externo:
#  - "[Lista Trello: QUINTA FEIRA 21/05]"
#  - "![foto.webp](https://trello.com/1/cards/.../download/foto.webp)" (anexo)
#  - "[texto](https://trello.com/...)" (link)
#  - URLs trello.com soltas
#  - URLs http(s) genéricas (fiscal não precisa de link no aviso)
_RX_TAG_TRELLO = re.compile(r"\s*\[\s*Lista\s+Trello[^\]]*\]\s*", re.IGNORECASE)
_RX_MD_IMG = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_RX_MD_LINK = re.compile(r"\[([^\]]*)\]\((?:https?:)?[^)]*\)")
_RX_URL = re.compile(r"https?://\S+", re.IGNORECASE)


def _limpar_notas(s: str) -> str:
    if not s:
        return ""
    out = _RX_MD_IMG.sub(" ", str(s))           # anexos markdown primeiro
    out = _RX_MD_LINK.sub(r"\1", out)            # links markdown → mantém só o texto
    out = _RX_TAG_TRELLO.sub(" ", out)
    out = _RX_URL.sub(" ", out)                  # URLs soltas
    # Limpa separadores quebrados ("foo |  | bar" → "foo | bar")
    out = re.sub(r"\s*\|\s*\|\s*", " | ", out)
    out = re.sub(r"^\s*\|\s*|\s*\|\s*$", "", out)
    out = re.sub(r"\s{2,}", " ", out)
    return out.strip()

_TZ_BR = pytz.timezone("America/Sao_Paulo")
SUPABASE_URL = settings.SUPABASE_URL

# Status que NÃO devem aparecer no aviso (cancelados/já feitos)
_STATUS_EXCLUIR = {"cancelado", "cancelada", "concluido", "concluida", "concluído", "concluída"}

# Labels amigáveis pros tipos de visita
_TIPO_LABEL = {
    "1vistoria": "1ª Vistoria",
    "2vistoria": "2ª Vistoria",
    "acompanhamento": "Acompanhamento",
    "entrega": "Entrega",
    "reparo": "Reparo",
}


async def _fetch_fiscais_ativos() -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/fiscal_equipe",
            headers=_headers(),
            params={
                "select": "id,nome,whatsapp_group_jid",
                "ativo": "eq.true",
            },
        )
        r.raise_for_status()
        return r.json() or []


async def _fetch_agenda_amanha(fiscal_id: str, inicio_iso: str, fim_iso: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/fiscal_agenda",
            headers=_headers(),
            params={
                "select": "id,tipo,data_inicio,obra,cliente,status,notas",
                "fiscal_id": f"eq.{fiscal_id}",
                "data_inicio": f"gte.{inicio_iso}",
                "and": f"(data_inicio.lte.{fim_iso})",
                "order": "data_inicio.asc",
            },
        )
        r.raise_for_status()
        return r.json() or []


def _formatar_mensagem(nome_fiscal: str, agendamentos: list[dict], alvo: datetime, quando: str = "amanha") -> str:
    data_label = alvo.strftime("%d/%m/%Y (%A)").replace(
        "Monday", "segunda"
    ).replace("Tuesday", "terça").replace("Wednesday", "quarta").replace(
        "Thursday", "quinta"
    ).replace("Friday", "sexta").replace("Saturday", "sábado").replace("Sunday", "domingo")

    nome_limpo = (nome_fiscal or "").strip().title() or "fiscal"
    titulo = "Agenda de hoje" if quando == "hoje" else "Agenda de amanhã"
    lines = [
        f"📅 *{titulo} — {nome_limpo}*",
        f"_{data_label}_",
        "",
    ]
    for ag in agendamentos:
        tipo = _TIPO_LABEL.get((ag.get("tipo") or "").lower(), ag.get("tipo") or "Visita")
        dt = ag.get("data_inicio")
        hora = ""
        if dt:
            try:
                hora = datetime.fromisoformat(dt.replace("Z", "+00:00")).astimezone(_TZ_BR).strftime("%H:%M")
            except Exception:
                hora = ""
        cliente = (ag.get("cliente") or "—").strip()
        obra = (ag.get("obra") or "").strip()
        notas = _limpar_notas(ag.get("notas") or "")

        bullet = [f"• *{hora or '—'}* — {tipo}", f"   👤 {cliente}"]
        if obra and obra.lower() != cliente.lower():
            bullet.append(f"   🏗️ {obra}")
        if notas:
            bullet.append(f"   📍 {notas}")
        lines.append("\n".join(bullet))

    lines.append("")
    lines.append("Bom trabalho! 🛠️")
    lines.append("🔗 https://verifica.parket.works/")
    return "\n".join(lines)


async def _enviar_agenda(quando: str):
    """Envia agenda pra cada fiscal. `quando` controla qual dia consultar:
    - "amanha": pega o dia seguinte (usado no cron 18:00 dia anterior)
    - "hoje":   pega o próprio dia (usado no cron 06:00 dia da visita)
    Pula fiscal sem grupo configurado ou sem agendamentos no período."""
    agora = datetime.now(_TZ_BR)
    alvo = agora + timedelta(days=1) if quando == "amanha" else agora
    inicio = alvo.replace(hour=0, minute=0, second=0, microsecond=0)
    fim = alvo.replace(hour=23, minute=59, second=59, microsecond=0)
    inicio_iso = inicio.astimezone(pytz.UTC).isoformat()
    fim_iso = fim.astimezone(pytz.UTC).isoformat()

    fiscais = await _fetch_fiscais_ativos()
    enviados = 0
    pulados = 0

    for fiscal in fiscais:
        nome = fiscal.get("nome") or "Fiscal"
        jid = fiscal.get("whatsapp_group_jid")
        if not jid:
            logger.info("fiscal_sem_grupo_wpp", fiscal=nome, quando=quando)
            pulados += 1
            continue

        ags = await _fetch_agenda_amanha(fiscal["id"], inicio_iso, fim_iso)
        ativos = [a for a in ags if (a.get("status") or "").lower() not in _STATUS_EXCLUIR]
        if not ativos:
            logger.info("fiscal_sem_agenda", fiscal=nome, quando=quando)
            pulados += 1
            continue

        msg = _formatar_mensagem(nome, ativos, alvo, quando)
        try:
            await evolution_client.send_text(jid, msg)
            enviados += 1
            logger.info("fiscal_agenda_enviada", fiscal=nome, group=jid, itens=len(ativos), quando=quando)
        except Exception as e:
            logger.error("fiscal_agenda_envio_falhou", fiscal=nome, group=jid, error=str(e), quando=quando)

    logger.info("fiscal_agenda_alerter_done", enviados=enviados, pulados=pulados, total=len(fiscais), quando=quando)
    return {"enviados": enviados, "pulados": pulados, "total": len(fiscais)}


async def enviar_agenda_amanha_fiscal():
    """Cron 18:00 SP do dia anterior — aviso prévio."""
    return await _enviar_agenda("amanha")


async def enviar_agenda_hoje_fiscal():
    """Cron 06:00 SP do dia da visita — lembrete do dia."""
    return await _enviar_agenda("hoje")


# ─── Status de fechamento do dia ────────────────────────────────────────────

async def _fetch_laudos_dia(fiscal_id: str, card_ids: list[str]) -> list[dict]:
    """Busca laudos do fiscal nos card_ids dados (sem filtrar por data —
    pega qualquer laudo aberto/concluido relacionado às visitas de hoje)."""
    if not card_ids:
        return []
    in_clause = ",".join(card_ids)
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/fiscal_laudos",
            headers=_headers(),
            params={
                "select": "id,card_id,tipo,status,data_vistoria,updated_at,created_at",
                "fiscal_id": f"eq.{fiscal_id}",
                "card_id": f"in.({in_clause})",
                "order": "updated_at.desc",
            },
        )
        r.raise_for_status()
        return r.json() or []


def _status_visita(agendamento: dict, laudos: list[dict]) -> tuple[str, str]:
    """Retorna (emoji, label) do status atual da visita.
    - ✅ Concluído: tem laudo concluido pro mesmo card+tipo
    - 🟡 Em andamento: tem laudo em_andamento
    - ⏳ Iniciado: tem laudo pendente criado hoje
    - ❌ Não feito: agenda existe mas nenhum laudo correspondente
    - 🚫 Cancelado: agenda com status cancelado/cancelada
    Match preferencial é pelo tipo (1vistoria etc) — se não bater tipo,
    cai em qualquer laudo do mesmo card."""
    st_ag = (agendamento.get("status") or "").lower()
    if st_ag in ("cancelado", "cancelada"):
        return ("🚫", "Cancelada")

    card_id = agendamento.get("card_id")
    tipo = (agendamento.get("tipo") or "").lower()
    candidatos = [l for l in laudos if l.get("card_id") == card_id]
    same_tipo = [l for l in candidatos if (l.get("tipo") or "").lower() == tipo]
    pool = same_tipo or candidatos

    if not pool:
        return ("❌", "Não feito")

    for st_label, emoji, label in [
        ("concluido", "✅", "Concluído"),
        ("em_andamento", "🟡", "Em andamento"),
        ("pendente", "⏳", "Iniciado"),
    ]:
        if any((l.get("status") or "").lower() == st_label for l in pool):
            return (emoji, label)

    return ("❌", "Não feito")


def _formatar_status_dia(nome_fiscal: str, agendamentos: list[dict], laudos: list[dict], dia: datetime) -> str:
    data_label = dia.strftime("%d/%m/%Y (%A)").replace(
        "Monday", "segunda"
    ).replace("Tuesday", "terça").replace("Wednesday", "quarta").replace(
        "Thursday", "quinta"
    ).replace("Friday", "sexta").replace("Saturday", "sábado").replace("Sunday", "domingo")

    nome_limpo = (nome_fiscal or "").strip().title() or "fiscal"
    lines = [
        f"📊 *Fechamento do dia — {nome_limpo}*",
        f"_{data_label}_",
        "",
    ]
    contagem = {"✅": 0, "🟡": 0, "⏳": 0, "❌": 0, "🚫": 0}
    for ag in agendamentos:
        tipo = _TIPO_LABEL.get((ag.get("tipo") or "").lower(), ag.get("tipo") or "Visita")
        hora = ""
        if ag.get("data_inicio"):
            try:
                hora = datetime.fromisoformat(ag["data_inicio"].replace("Z", "+00:00")).astimezone(_TZ_BR).strftime("%H:%M")
            except Exception:
                hora = ""
        cliente = (ag.get("cliente") or ag.get("obra") or "—").strip()
        emoji, label = _status_visita(ag, laudos)
        contagem[emoji] = contagem.get(emoji, 0) + 1
        lines.append(f"{emoji} *{hora or '—'}* — {cliente}  _({tipo} · {label})_")

    # Resumo
    lines.append("")
    resumo_parts = []
    if contagem["✅"]:
        resumo_parts.append(f"{contagem['✅']} concluída(s)")
    if contagem["🟡"]:
        resumo_parts.append(f"{contagem['🟡']} em andamento")
    if contagem["⏳"]:
        resumo_parts.append(f"{contagem['⏳']} iniciada(s)")
    if contagem["❌"]:
        resumo_parts.append(f"{contagem['❌']} sem laudo")
    if contagem["🚫"]:
        resumo_parts.append(f"{contagem['🚫']} cancelada(s)")
    if resumo_parts:
        lines.append("📌 " + " · ".join(resumo_parts))
    lines.append("")
    lines.append("🔗 https://verifica.parket.works/")
    return "\n".join(lines)


async def enviar_status_dia_fiscal():
    """Cron 18:00 SP — recap do dia. Pra cada fiscal com visitas hoje,
    manda no grupo o status de cada uma (feita / em andamento / não feita)."""
    agora = datetime.now(_TZ_BR)
    inicio = agora.replace(hour=0, minute=0, second=0, microsecond=0)
    fim = agora.replace(hour=23, minute=59, second=59, microsecond=0)
    inicio_iso = inicio.astimezone(pytz.UTC).isoformat()
    fim_iso = fim.astimezone(pytz.UTC).isoformat()

    fiscais = await _fetch_fiscais_ativos()
    enviados = 0
    pulados = 0

    for fiscal in fiscais:
        nome = fiscal.get("nome") or "Fiscal"
        jid = fiscal.get("whatsapp_group_jid")
        if not jid:
            pulados += 1
            continue

        ags = await _fetch_agenda_amanha(fiscal["id"], inicio_iso, fim_iso)
        if not ags:
            pulados += 1
            continue

        # Carrega laudos dos cards das visitas do dia
        card_ids = [a["card_id"] for a in ags if a.get("card_id")]
        laudos = await _fetch_laudos_dia(fiscal["id"], card_ids)

        msg = _formatar_status_dia(nome, ags, laudos, agora)
        try:
            await evolution_client.send_text(jid, msg)
            enviados += 1
            logger.info("fiscal_status_dia_enviado", fiscal=nome, group=jid, itens=len(ags))
        except Exception as e:
            logger.error("fiscal_status_dia_falhou", fiscal=nome, group=jid, error=str(e))

    logger.info("fiscal_status_dia_done", enviados=enviados, pulados=pulados, total=len(fiscais))
    return {"enviados": enviados, "pulados": pulados, "total": len(fiscais)}
