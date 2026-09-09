"""
Check Diário de Obras — disparo automático
==========================================
Cron diário (08:00 SP) que dispara o check diário pra todos os prestadores
das obras na coluna "Acompanhamento" do kanban operacional.

Fluxo:
  1. Lê kanban_cards onde dept_id=operacional e column_id=acompanhamento
  2. Extrai prestadores de details.prestadores / details.equipe / details.equipes / details.equipe_obras
  3. Resolve telefone via tabela prestadores quando ausente
  4. Upsert na obras_check_diario (data, obra_id, prestador_id) — não duplica
  5. Pra cada check status=pendente com telefone, envia WhatsApp via Evolution
     com delay aleatório 45–150s e marca status=enviado
"""

from __future__ import annotations

import asyncio
import random
from datetime import datetime
from typing import Any, Optional

import httpx
import pytz
import structlog

from app.config import settings
from app.core.evolution_client import EvolutionAPIClient

logger = structlog.get_logger(__name__)

_TZ_BR = pytz.timezone("America/Sao_Paulo")

SUPABASE_URL = settings.SUPABASE_URL
SB_HEADERS = {
    "apikey": settings.SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

DELAY_MIN_S = 45
DELAY_MAX_S = 150

MENSAGENS = [
    "Bom dia, {nome}! 👋 Como tá indo a obra na {obra}? Tudo certo pra hoje?",
    "Oi {nome}, beleza? 🌞 Tudo tranquilo na obra {obra}?",
    "E aí {nome}! Como tá o pique hoje aí na {obra}?",
    "{nome}, bom dia! Tudo certo na {obra}? Algum apoio que precise?",
    "Salve {nome}! 🛠 Como tá indo a {obra} hoje?",
    "Oi {nome}, bom dia 👷 Como anda o serviço na {obra}?",
    "{nome}, tudo bem? Como tá hoje na {obra}? Algo pendente?",
    "Bom dia {nome}! Hoje é dia de produção firme aí na {obra}? 💪",
    "Oi {nome}! Conseguimos um status rápido da obra {obra}?",
    "{nome}, e aí? Tudo certinho na {obra} pra continuar hoje?",
]


def _phone_digits(phone: str) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if not digits:
        return ""
    if not digits.startswith("55"):
        digits = "55" + digits
    return digits


def _extract_prestadores(details: dict) -> list[dict]:
    """Coleta prestadores do details (mesma lógica do frontend gerarChecksDoDia)."""
    out: list[dict] = []
    seen: set[str] = set()

    def _push(c: dict):
        nm = (c.get("nome") or "").strip()
        if not nm:
            return
        key = nm.upper()
        if key in seen:
            return
        seen.add(key)
        out.append({
            "nome": nm,
            "id": c.get("id"),
            "telefone": c.get("telefone"),
            "categoria": c.get("categoria"),
        })

    pr = details.get("prestadores")
    if isinstance(pr, list):
        for a in pr:
            if isinstance(a, dict) and a.get("nome"):
                _push(a)

    eq = details.get("equipe")
    if isinstance(eq, str):
        s = eq.strip()
        if s and s != "-" and "/" not in s:
            _push({"nome": s})
    elif isinstance(eq, list):
        for a in eq:
            if isinstance(a, dict) and a.get("nome"):
                _push({"nome": a["nome"]})

    eqs = details.get("equipes")
    if isinstance(eqs, list):
        for a in eqs:
            if isinstance(a, dict) and a.get("nome"):
                _push({"nome": a["nome"]})

    eo = details.get("equipe_obras")
    if isinstance(eo, dict) and eo.get("nome"):
        _push({"nome": eo["nome"]})

    return out


async def _sb_get(client: httpx.AsyncClient, path: str, params: dict | None = None) -> Any:
    r = await client.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=SB_HEADERS, params=params or {})
    r.raise_for_status()
    return r.json()


async def _sb_upsert(client: httpx.AsyncClient, table: str, rows: list[dict], on_conflict: str) -> None:
    if not rows:
        return
    headers = {**SB_HEADERS, "Prefer": "resolution=ignore-duplicates"}
    r = await client.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers,
        params={"on_conflict": on_conflict},
        json=rows,
    )
    if r.status_code >= 400:
        logger.error("check_diario_upsert_failed", status=r.status_code, body=r.text[:500])


async def _sb_patch(client: httpx.AsyncClient, table: str, params: dict, data: dict) -> None:
    r = await client.patch(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=SB_HEADERS,
        params=params,
        json=data,
    )
    if r.status_code >= 400:
        logger.error("check_diario_patch_failed", status=r.status_code, body=r.text[:300])


async def gerar_checks_do_dia() -> int:
    """Lista prestadores das obras em acompanhamento e cria checks pendentes."""
    hoje = datetime.now(_TZ_BR).date().isoformat()

    async with httpx.AsyncClient(timeout=30.0) as client:
        cards = await _sb_get(
            client,
            "kanban_cards",
            {
                "dept_id": "eq.operacional",
                "column_id": "eq.acompanhamento",
                "select": "id,title,obra,details",
            },
        )

        prestadores_raw = await _sb_get(
            client,
            "prestadores",
            {"ativo": "eq.true", "select": "id,nome,telefone,categoria"},
        )
        by_name = {(p.get("nome") or "").strip().upper(): p for p in prestadores_raw if p.get("nome")}

        rows: list[dict] = []
        skipped: list[str] = []
        for card in cards or []:
            details = card.get("details") or {}
            for c in _extract_prestadores(details):
                nm = c["nome"]
                tel = c.get("telefone")
                pid = c.get("id")
                cat = c.get("categoria")
                if not tel:
                    found = by_name.get(nm.upper())
                    if found:
                        pid = found.get("id")
                        tel = found.get("telefone")
                        cat = found.get("categoria")
                if not tel:
                    skipped.append(f"{card.get('title')} → {nm}")
                    continue
                rows.append({
                    "data": hoje,
                    "obra_id": card["id"],
                    "obra_titulo": card.get("title"),
                    "obra_codigo": card.get("obra"),
                    "prestador_id": pid,
                    "prestador_nome": nm,
                    "prestador_telefone": tel,
                    "prestador_categoria": cat,
                    "status": "pendente",
                })

        if skipped:
            logger.warning("check_diario_skipped_no_phone", items=skipped[:20], total=len(skipped))

        await _sb_upsert(client, "obras_check_diario", rows, "data,obra_id,prestador_id")
        logger.info("check_diario_gerado", data=hoje, total=len(rows), cards=len(cards or []))
        return len(rows)


async def disparar_pendentes() -> dict:
    """Envia WhatsApp pra todos os checks de hoje com status=pendente.

    Disparo sai da instância da Secretaria de Obras (5511986750532), não do
    número Parket principal — mantém o tráfego com prestadores isolado.
    """
    hoje = datetime.now(_TZ_BR).date().isoformat()
    from app.core.evolution_client import evolution_secretaria_client
    evo = evolution_secretaria_client

    enviados = 0
    erros = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        pendentes = await _sb_get(
            client,
            "obras_check_diario",
            {
                "data": f"eq.{hoje}",
                "status": "eq.pendente",
                "select": "id,prestador_nome,prestador_telefone,obra_titulo",
                "order": "obra_titulo,prestador_nome",
            },
        )

        total = len(pendentes or [])
        logger.info("check_diario_disparo_inicio", data=hoje, total=total)

        for idx, chk in enumerate(pendentes or []):
            tel = _phone_digits(chk.get("prestador_telefone") or "")
            nome = chk.get("prestador_nome") or "amigo"
            obra = chk.get("obra_titulo") or "obra"
            check_id = chk.get("id")
            if not tel:
                continue

            template = random.choice(MENSAGENS)
            texto = template.format(nome=nome.split()[0].capitalize(), obra=obra)

            try:
                await evo.send_text(tel, texto)
                await _sb_patch(
                    client,
                    "obras_check_diario",
                    {"id": f"eq.{check_id}"},
                    {
                        "status": "enviado",
                        "mensagem_enviada": texto,
                        "enviado_em": datetime.now(_TZ_BR).isoformat(),
                    },
                )
                enviados += 1
            except Exception as e:
                logger.warning("check_diario_envio_falhou", check_id=check_id, error=str(e))
                await _sb_patch(
                    client,
                    "obras_check_diario",
                    {"id": f"eq.{check_id}"},
                    {"status": "erro_envio"},
                )
                erros += 1

            if idx < total - 1:
                delay = random.uniform(DELAY_MIN_S, DELAY_MAX_S)
                await asyncio.sleep(delay)

    logger.info("check_diario_disparo_fim", enviados=enviados, erros=erros)
    return {"total": total, "enviados": enviados, "erros": erros}


async def run_check_diario_diario() -> None:
    """Entry-point chamado pelo APScheduler — gera checks e dispara."""
    try:
        await gerar_checks_do_dia()
    except Exception as e:
        logger.error("check_diario_gerar_falhou", error=str(e))
        return

    try:
        await disparar_pendentes()
    except Exception as e:
        logger.error("check_diario_disparar_falhou", error=str(e))
