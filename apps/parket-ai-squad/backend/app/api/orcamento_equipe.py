"""
Notificações de demandas de orçamento via Teka (instância Parket).
Quando o orçamentista aceita/recusa uma demanda, dispara WhatsApp pro
vendedor que atribuiu o card.

POST /api/orcamento-equipe/notify-vendedor
  body: {
    vendedor_nome: "Guilherme",         # primeiro nome ou completo
    evento: "aceito" | "recusado" | "concluido",
    orcamentista_nome: "Bruno",
    titulo_card: "ALARICO NAVES",
    prazo_horas?: int,
    prazo_unidade?: "horas" | "dias",
    motivo_recusa?: str
  }

Mapeamento vendedor → WhatsApp (match por PRIMEIRO NOME case-insensitive):
"""
from __future__ import annotations
import re
from typing import Optional, Literal, Any
import httpx
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.evolution_client import EvolutionAPIClient
from app.config import settings

SB_URL = settings.SUPABASE_URL
SB_SK = settings.SUPABASE_SERVICE_KEY
SB_HEAD = {"apikey": SB_SK, "Authorization": f"Bearer {SB_SK}", "Content-Type": "application/json", "Prefer": "return=representation"}

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/orcamento-equipe", tags=["orcamento-equipe"])

INSTANCE = "Parket"   # Teka usa instância Parket (5511971975808)

# Mapa primeiro nome → WhatsApp (já com DDI 55)
VENDEDOR_PHONES: dict[str, str] = {
    "guilherme":  "5519989139000",
    "felipe":     "5511966617276",
    "sueli":      "5561994578650",
    "gustavo":    "5541973109090",
    "cris":       "5511951231249",
    "marina":     "5511960687222",
    "davi":       "5511966474058",
}


def _first_name(full: str) -> str:
    return (full or "").strip().split()[0].lower() if full else ""


def _phone_for_vendedor(nome: str) -> Optional[str]:
    fn = _first_name(nome)
    return VENDEDOR_PHONES.get(fn)


def _format_prazo(horas: Optional[int], unidade: str) -> str:
    if not horas:
        return "prazo não informado"
    if unidade == "dias":
        return f"{horas} dia(s)"
    if horas >= 24:
        dias = horas // 24
        rest_h = horas % 24
        return f"{dias}d{(' ' + str(rest_h) + 'h') if rest_h else ''}"
    return f"{horas}h"


class NotifyInput(BaseModel):
    vendedor_nome: str
    evento: Literal["aceito", "recusado", "concluido"]
    orcamentista_nome: str
    titulo_card: str
    prazo_horas: Optional[int] = None
    prazo_unidade: Optional[str] = "horas"
    motivo_recusa: Optional[str] = None


@router.post("/notify-vendedor")
async def notify_vendedor(body: NotifyInput):
    phone = _phone_for_vendedor(body.vendedor_nome)
    if not phone:
        logger.warning("orcamento_notify_vendedor_sem_phone",
                       vendedor=body.vendedor_nome)
        return {"ok": False, "error": f"Vendedor '{body.vendedor_nome}' não mapeado"}

    cliente = (body.titulo_card or "").strip()
    if body.evento == "aceito":
        prazo = _format_prazo(body.prazo_horas, body.prazo_unidade or "horas")
        msg = (
            f"🎯 *Orçamento aceito*\n\n"
            f"Cliente: *{cliente}*\n"
            f"Orçamentista: {body.orcamentista_nome}\n"
            f"Prazo estimado: *{prazo}*\n\n"
            f"Você acompanha o status pelo Space."
        )
    elif body.evento == "recusado":
        motivo = body.motivo_recusa or "Sem detalhes"
        msg = (
            f"⚠️ *Orçamento recusado*\n\n"
            f"Cliente: *{cliente}*\n"
            f"Orçamentista: {body.orcamentista_nome}\n"
            f"Motivo: {motivo}\n\n"
            f"Redirecione no Space pra outro orçamentista."
        )
    elif body.evento == "concluido":
        msg = (
            f"✅ *Orçamento pronto*\n\n"
            f"Cliente: *{cliente}*\n"
            f"Orçamentista: {body.orcamentista_nome}\n\n"
            f"Já disponível no Space pra você encaminhar ao cliente."
        )
    else:
        raise HTTPException(400, "evento inválido")

    client = EvolutionAPIClient(instance=INSTANCE)
    try:
        result = await client.send_text(group_id=phone, text=msg)
        msg_id = (result or {}).get("key", {}).get("id")
        logger.info("orcamento_notify_vendedor_ok",
                    vendedor=body.vendedor_nome, evento=body.evento, phone=phone)
        return {"ok": True, "telefone": phone, "message_id": msg_id}
    except Exception as e:
        logger.error("orcamento_notify_vendedor_fail", error=str(e)[:200])
        return {"ok": False, "error": str(e)[:200]}


@router.get("/vendedores")
async def list_vendedores_mapeados():
    """Retorna mapa primeiro nome → telefone. Pro frontend conferir cobertura."""
    return {"items": [{"primeiro_nome": k.capitalize(), "telefone": v} for k, v in VENDEDOR_PHONES.items()]}


# ════════════════════════════════════════════════════════════════════════
# Atribuir orçamentista a um card comercial — contorna RLS via service_key.
# Frontend chama este endpoint ao invés de fazer INSERT direto via REST.
# ════════════════════════════════════════════════════════════════════════
class AtribuirInput(BaseModel):
    card_id: str                # ID do card comercial
    orcamentista_id: str        # UUID do orçamentista
    orcamentista_nome: str
    criar_demanda: bool = False # Se true: cria demanda + card no orcamento (após mover pra criacao-orcamento)

@router.post("/atribuir")
async def atribuir_orcamentista(body: AtribuirInput):
    """Atribui orçamentista ao card comercial.
    Por default (criar_demanda=False): SÓ atualiza details.orcamentista_id/nome no card.
    Quando criar_demanda=True: também cria demanda + card clone no kanban orçamento.
    A demanda/card só são criados quando vendedor move pra "criacao-orcamento".
    Retorna {ok, demanda_id?, card_orc_id?, novo: bool}.
    """
    async with httpx.AsyncClient(timeout=15) as cli:
        # 1. Pega card comercial
        r = await cli.get(f"{SB_URL}/rest/v1/kanban_cards?id=eq.{body.card_id}&select=*", headers=SB_HEAD)
        if r.status_code >= 400 or not r.json():
            raise HTTPException(404, f"card não encontrado: {r.text[:200]}")
        com_card = r.json()[0]
        com_det = com_card.get("details") or {}

        # 2. PATCH no card comercial com orcamentista
        merged = {**com_det, "orcamentista_id": body.orcamentista_id, "orcamentista_nome": body.orcamentista_nome}
        r = await cli.patch(
            f"{SB_URL}/rest/v1/kanban_cards?id=eq.{body.card_id}",
            headers=SB_HEAD, json={"details": merged}
        )
        if r.status_code >= 400:
            raise HTTPException(r.status_code, f"PATCH card: {r.text[:200]}")

        # Se não foi pedido pra criar demanda, retorna aqui — só atualizou o card.
        if not body.criar_demanda:
            return {"ok": True, "novo": False, "demanda_id": None, "card_orc_id": None, "apenas_atribuicao": True}

        # 3. INSERT demanda (idempotente via unique index)
        produto = (com_det.get("produto_interesse") or "").split(",")[0].strip() or None
        demanda_payload = {
            "orcamentista_id": body.orcamentista_id,
            "kanban_card_id": body.card_id,
            "obra_code": com_card.get("obra"),
            "titulo": com_card.get("title") or "(sem título)",
            "tipo": produto,
            "prioridade": com_card.get("priority") or "normal",
            "status": "aguarda_aceite",
            "details": {
                "vendedor_nome": com_det.get("vendedor") or "",
                "cidade": com_det.get("cidade"),
                "estado": com_det.get("estado"),
                "endereco_obra": com_det.get("endereco_obra"),
                "area_m2": com_det.get("area_m2"),
                "produto_interesse": com_det.get("produto_interesse"),
                "coluna_origem": com_card.get("column_id"),
            },
        }
        r = await cli.post(f"{SB_URL}/rest/v1/orcamento_demandas", headers=SB_HEAD, json=demanda_payload)
        novo = False
        demanda = None
        if r.status_code == 201:
            demanda = r.json()[0]
            novo = True
        elif r.status_code == 409 or "duplicate" in r.text.lower():
            # Já existia — busca
            r2 = await cli.get(
                f"{SB_URL}/rest/v1/orcamento_demandas?kanban_card_id=eq.{body.card_id}&orcamentista_id=eq.{body.orcamentista_id}",
                headers=SB_HEAD
            )
            if r2.status_code < 400 and r2.json():
                demanda = r2.json()[0]
        else:
            raise HTTPException(r.status_code, f"INSERT demanda: {r.text[:200]}")

        if not demanda:
            raise HTTPException(500, "demanda não encontrada após insert")

        # 4. INSERT card orçamento se ainda não tem kanban_card_orc_id
        card_orc_id = demanda.get("kanban_card_orc_id")
        if not card_orc_id:
            orc_payload = {
                "dept_id": "orcamento",
                "column_id": "solicitacao",
                "title": com_card.get("title") or "(sem título)",
                "subtitle": com_card.get("subtitle"),
                "obra": com_card.get("obra"),
                "responsavel": body.orcamentista_nome or "A definir",
                "priority": com_card.get("priority") or "normal",
                "tags": com_card.get("tags") or [],
                "description": com_card.get("description"),
                "details": {
                    **com_det,
                    "parent_card_id": body.card_id,
                    "parent_dept": "comercial",
                    "orcamentista_id": body.orcamentista_id,
                    "orcamentista_nome": body.orcamentista_nome,
                    "orcamentista": body.orcamentista_nome,
                    "demanda_id": demanda["id"],
                    "criado_via": "orcamento-picker",
                },
            }
            r = await cli.post(f"{SB_URL}/rest/v1/kanban_cards", headers=SB_HEAD, json=orc_payload)
            if r.status_code >= 400:
                logger.warning("create_card_orc_failed", err=r.text[:300])
                # Não bloqueia — demanda foi criada
            else:
                card_orc = r.json()[0]
                card_orc_id = card_orc["id"]
                # 5. Vincula demanda
                await cli.patch(
                    f"{SB_URL}/rest/v1/orcamento_demandas?id=eq.{demanda['id']}",
                    headers=SB_HEAD, json={"kanban_card_orc_id": card_orc_id}
                )

        return {"ok": True, "novo": novo, "demanda_id": demanda["id"], "card_orc_id": card_orc_id}


class DesatribuirInput(BaseModel):
    card_id: str

@router.post("/desatribuir")
async def desatribuir_orcamentista(body: DesatribuirInput):
    """Remove orçamentista do card comercial (não apaga demanda/card)."""
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(f"{SB_URL}/rest/v1/kanban_cards?id=eq.{body.card_id}&select=details", headers=SB_HEAD)
        if r.status_code >= 400 or not r.json():
            raise HTTPException(404, "card não encontrado")
        det = (r.json()[0].get("details") or {}).copy()
        det.pop("orcamentista_id", None)
        det.pop("orcamentista_nome", None)
        r = await cli.patch(f"{SB_URL}/rest/v1/kanban_cards?id=eq.{body.card_id}", headers=SB_HEAD, json={"details": det})
        if r.status_code >= 400:
            raise HTTPException(r.status_code, f"PATCH: {r.text[:200]}")
        return {"ok": True}
