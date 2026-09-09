"""
Lembretes 30min antes do agendamento.

Roda em loop interno (asyncio task). A cada N segundos:
  1. Consulta agendamentos com data+hora_inicio entre [agora+25min, agora+35min]
     E lembrete_enviado=false E status='agendado'.
  2. Pra cada agendamento, envia DM pro cliente e msg no grupo comercial.
  3. Marca lembrete_enviado=true (idempotência).

Iniciado pelo main.py via lifespan startup.
"""
from __future__ import annotations

import asyncio
import datetime
import logging
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)
TZ_BR = ZoneInfo("America/Sao_Paulo")
COMERCIAL_GROUP = "120363423690432580@g.us"
CHECK_INTERVAL_SEC = 60          # checa a cada 1 min
WINDOW_MIN_AHEAD = 25            # janela de 25..35min à frente
WINDOW_MAX_AHEAD = 35


async def _supabase_rest(method: str, path: str, body=None, params=None):
    import httpx
    from app.config import settings
    url = f"{settings.SUPABASE_URL}/rest/v1/{path.lstrip('/')}"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    async with httpx.AsyncClient(timeout=20) as cli:
        r = await cli.request(method, url, json=body, params=params, headers=headers)
        if r.status_code >= 400:
            raise RuntimeError(f"supabase {method} {path}: {r.status_code} {r.text[:300]}")
        if r.status_code == 204 or not r.text:
            return None
        return r.json()


def _normalize_phone_br(digits: str) -> str:
    """Garante que o phone tem código do país 55. Adiciona se faltar."""
    if not digits:
        return digits
    if digits.startswith("55") and len(digits) >= 12:
        return digits
    # Se tem 10 ou 11 dígitos (sem código país), adiciona 55
    if len(digits) in (10, 11):
        return "55" + digits
    return digits


async def _phone_from_card(card_id: str | None) -> str | None:
    """Lê o telefone do lead a partir do kanban_cards.details.celular."""
    if not card_id:
        return None
    try:
        rows = await _supabase_rest("GET", "kanban_cards",
                                     params={"select": "details", "id": f"eq.{card_id}", "limit": 1})
        if not rows:
            return None
        det = rows[0].get("details") or {}
        raw = det.get("celular") or det.get("phone") or det.get("telefone") or ""
        digits = "".join(c for c in str(raw) if c.isdigit())
        return _normalize_phone_br(digits) if digits else None
    except Exception:
        return None


# Gênero por primeiro nome — usado pra escolher Consultor/Consultora
_MASC_OVERRIDES = {"davi", "andre", "andré", "miquéias", "isaías", "elias", "moisés"}
_FEM_OVERRIDES = set()  # adicione aqui se algum nome terminar em consoante mas for fem


def consultor_label(vendedor: str | None) -> str:
    first = (vendedor or "").strip().split()[0].lower() if vendedor else ""
    if not first:
        return "Consultor(a)"
    if first in _MASC_OVERRIDES:
        return "Consultor"
    if first in _FEM_OVERRIDES:
        return "Consultora"
    return "Consultora" if first.endswith(("a", "e")) else "Consultor"


def _fmt_data_br(d: str) -> str:
    """'2026-06-02' → '02/06 (terça)'."""
    try:
        dt = datetime.date.fromisoformat(d[:10])
        dias = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
        return f"{dt.strftime('%d/%m')} ({dias[dt.weekday()]})"
    except Exception:
        return d


async def _send_lembrete(ag: dict):
    from app.core.evolution_client import evolution_client, evolution_comercial_client
    cliente_nome = ag.get("cliente_nome") or "cliente"
    vendedor = ag.get("vendedor") or "vendedor"
    data = ag.get("data") or ""
    hi = (ag.get("hora_inicio") or "")[:5]
    hf = (ag.get("hora_fim") or "")[:5]
    modalidade = ag.get("modalidade") or "presencial"
    link = ag.get("meet_link") or ""
    endereco = ag.get("endereco") or ""
    # Linha de local — trata meet sem link como "Em breve" em vez de virar presencial vazio
    if modalidade == "meet":
        if link:
            linha_local_cliente = f"🎥 Link Meet: {link}"
            linha_local_grupo = f"🎥 {link}"
        else:
            linha_local_cliente = "🎥 Link Meet: _será enviado pela consultora em instantes_"
            linha_local_grupo = "🎥 _Meet link: enviar ao cliente_"
    else:
        linha_local_cliente = f"📍 Local: {endereco or 'Showroom Parket — Rua Circular do Bosque, 628 - Casa Millan, Jardim Guedala, São Paulo - SP, CEP 05604-010'}"
        linha_local_grupo = f"📍 {endereco or 'Showroom Parket — Rua Circular do Bosque, 628 - Casa Millan, Jardim Guedala, São Paulo - SP, CEP 05604-010'}"

    # ── Mensagem pro cliente (DM via Comercial - Parket) ──
    phone = await _phone_from_card(ag.get("card_id"))
    if phone:
        msg_cliente = (
            f"Oi {cliente_nome.split()[0] if cliente_nome else ''} 👋, passando aqui só pra lembrar:\n\n"
            f"📅 Sua conversa com a Parket é *hoje às {hi}*.\n"
            f"🧑‍💼 {consultor_label(vendedor)}: *{vendedor}*\n"
            f"{linha_local_cliente}\n\n"
            f"Faltam *30 minutos*. Até já!"
        )
        try:
            jid = f"{phone}@s.whatsapp.net"
            await evolution_comercial_client.send_text(jid, msg_cliente)
            logger.info("teca_v2_lembrete_cliente_enviado phone=%s ag=%s", phone, ag.get("id"))
        except Exception as e:
            logger.warning("teca_v2_lembrete_cliente_falhou phone=%s err=%s", phone, e)

    # ── Mensagem pro grupo comercial ──
    msg_grupo = (
        f"⏰ *Lembrete: agendamento em 30min*\n\n"
        f"👤 Cliente: *{cliente_nome}*\n"
        f"📅 {_fmt_data_br(data)} às *{hi}–{hf}*\n"
        f"🧑‍💼 Vendedor: *{vendedor}*\n"
        f"{linha_local_grupo}\n"
        + (f"📞 Cliente: +{phone}\n" if phone else "")
    )
    try:
        await evolution_comercial_client.send_text(COMERCIAL_GROUP, msg_grupo)
        logger.info("teca_v2_lembrete_grupo_enviado ag=%s", ag.get("id"))
    except Exception as e:
        logger.warning("teca_v2_lembrete_grupo_falhou err=%s", e)

    # ── Marca como enviado ──
    try:
        await _supabase_rest("PATCH", "agendamentos",
                              body={"lembrete_enviado": True},
                              params={"id": f"eq.{ag.get('id')}"})
    except Exception as e:
        logger.warning("teca_v2_lembrete_mark_falhou ag=%s err=%s", ag.get("id"), e)


async def _tick():
    """Uma passada do loop. Busca agendamentos na janela e dispara lembretes pendentes."""
    now = datetime.datetime.now(TZ_BR)
    de = now + datetime.timedelta(minutes=WINDOW_MIN_AHEAD)
    ate = now + datetime.timedelta(minutes=WINDOW_MAX_AHEAD)
    # Como `data` é date e `hora_inicio` é time, filtramos com OR amplo e checamos no Python
    # pra não complicar com timezone na query.
    try:
        rows = await _supabase_rest(
            "GET", "agendamentos",
            params={
                "select": "id,card_id,cliente_nome,vendedor,data,hora_inicio,hora_fim,modalidade,meet_link,endereco,status,lembrete_enviado",
                "status": "eq.agendado",
                "lembrete_enviado": "eq.false",
                "data": f"gte.{de.date().isoformat()}",
            },
        ) or []
    except Exception as e:
        logger.warning("teca_v2_lembrete_query_falhou err=%s", e)
        return

    for ag in rows:
        try:
            d = ag.get("data") or ""
            hi = ag.get("hora_inicio") or ""
            if not d or not hi:
                continue
            dt = datetime.datetime.fromisoformat(f"{d}T{hi}").replace(tzinfo=TZ_BR)
            if de <= dt <= ate:
                await _send_lembrete(ag)
        except Exception as e:
            logger.warning("teca_v2_lembrete_proc_err ag=%s err=%s", ag.get("id"), e)

    # ── Alerta 6h sem atribuição ──
    await _check_atribuicao_pendente()


ATRIBUICAO_ALERTA_HORAS = 6  # 6h sem especialista → alerta no grupo


async def _check_atribuicao_pendente():
    """Pra cada agendamento com vendedor='A definir' criado há ≥6h e ainda sem alerta,
    dispara mensagem no grupo Comercial cobrando atribuição. Idempotente via flag."""
    try:
        rows = await _supabase_rest(
            "GET", "agendamentos",
            params={
                "select": "id,card_id,cliente_nome,vendedor,data,hora_inicio,hora_fim,modalidade,created_at,atribuicao_alerta_enviado,status",
                "status": "eq.agendado",
                "vendedor": "eq.A definir",
                "atribuicao_alerta_enviado": "eq.false",
            },
        ) or []
    except Exception as e:
        logger.warning("teca_v2_atrib_query_falhou err=%s", e)
        return

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    cutoff = now_utc - datetime.timedelta(hours=ATRIBUICAO_ALERTA_HORAS)
    from app.core.evolution_client import evolution_client, evolution_comercial_client

    for ag in rows:
        try:
            created_at_str = ag.get("created_at") or ""
            created_at = datetime.datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            if created_at > cutoff:
                continue  # ainda dentro da janela de 6h, paciência
            cliente = ag.get("cliente_nome") or "Cliente"
            d = ag.get("data") or ""
            hi = (ag.get("hora_inicio") or "")[:5]
            hf = (ag.get("hora_fim") or "")[:5]
            modalidade = ag.get("modalidade") or "presencial"
            horas = int((now_utc - created_at).total_seconds() / 3600)
            msg = (
                f"⚠️ *Agendamento sem especialista há {horas}h*\n\n"
                f"👤 Cliente: *{cliente}*\n"
                f"📅 {_fmt_data_br(d)} às *{hi}–{hf}*\n"
                f"{'🎥' if modalidade == 'meet' else '📍'} Modalidade: *{modalidade}*\n\n"
                f"Por favor atribuam um(a) especialista no Homebroker (/agendamentos)."
            )
            await evolution_comercial_client.send_text(COMERCIAL_GROUP, msg)
            await _supabase_rest("PATCH", "agendamentos",
                                  body={"atribuicao_alerta_enviado": True},
                                  params={"id": f"eq.{ag.get('id')}"})
            logger.info("teca_v2_atrib_alerta_enviado ag=%s cliente=%s horas=%d",
                        ag.get("id"), cliente, horas)
        except Exception as e:
            logger.warning("teca_v2_atrib_alerta_falhou ag=%s err=%s", ag.get("id"), e)


async def notificar_atribuicao(agendamento_id: str, novo_vendedor: str) -> bool:
    """Dispara mensagem no grupo comercial confirmando que `novo_vendedor` foi
    atribuído ao agendamento. Chamado pelo endpoint quando o SDR edita o card."""
    try:
        rows = await _supabase_rest(
            "GET", "agendamentos",
            params={"select": "id,cliente_nome,data,hora_inicio,hora_fim,modalidade",
                    "id": f"eq.{agendamento_id}", "limit": "1"},
        ) or []
        if not rows:
            return False
        ag = rows[0]
        from app.core.evolution_client import evolution_client, evolution_comercial_client
        cliente = ag.get("cliente_nome") or "Cliente"
        d = ag.get("data") or ""
        hi = (ag.get("hora_inicio") or "")[:5]
        hf = (ag.get("hora_fim") or "")[:5]
        modalidade = ag.get("modalidade") or "presencial"
        msg = (
            f"✅ *Especialista atribuído*\n\n"
            f"👤 Cliente: *{cliente}*\n"
            f"📅 {_fmt_data_br(d)} às *{hi}–{hf}*\n"
            f"🧑‍💼 {consultor_label(novo_vendedor)}: *{novo_vendedor}*\n"
            f"{'🎥' if modalidade == 'meet' else '📍'} Modalidade: *{modalidade}*"
        )
        await evolution_comercial_client.send_text(COMERCIAL_GROUP, msg)
        return True
    except Exception as e:
        logger.warning("teca_v2_notificar_atrib_falhou ag=%s err=%s", agendamento_id, e)
        return False


async def loop_forever():
    """Background task — fica rodando enquanto o backend estiver up."""
    logger.info("teca_v2_lembretes_loop_started interval=%ds window=%d..%dmin",
                CHECK_INTERVAL_SEC, WINDOW_MIN_AHEAD, WINDOW_MAX_AHEAD)
    while True:
        try:
            await _tick()
        except Exception as e:
            logger.exception("teca_v2_lembretes_tick_crashed: %s", e)
        await asyncio.sleep(CHECK_INTERVAL_SEC)
