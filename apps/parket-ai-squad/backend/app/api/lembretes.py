"""
Lembretes API — Agendamento de contatos no funil comercial
===========================================================
Endpoints para criar, listar e gerenciar lembretes de contato
com clientes na coluna 'lembretes' do kanban comercial-entrada.
"""

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/lembretes", tags=["lembretes"])


class LembreteCreate(BaseModel):
    card_id: str
    data: str           # DD/MM/YYYY
    hora: str           # HH:MM
    observacao: str = ""


class LembreteResponse(BaseModel):
    card_id: str
    title: str
    data: str
    hora: str
    observacao: str
    status: str


@router.post("/", response_model=LembreteResponse)
async def criar_lembrete(req: LembreteCreate):
    """Cria um lembrete de contato, move o card para a coluna 'lembretes'."""
    from app.core.lembrete_service import criar_lembrete as _criar

    try:
        card = await _criar(
            card_id=req.card_id,
            lembrete_data=req.data,
            lembrete_hora=req.hora,
            observacao=req.observacao,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("lembrete_create_error", error=str(e))
        raise HTTPException(status_code=500, detail="Erro ao criar lembrete")

    det = card.get("details", {}) or {}
    return LembreteResponse(
        card_id=card.get("id", req.card_id),
        title=card.get("title", ""),
        data=det.get("lembrete_data", req.data),
        hora=det.get("lembrete_hora", req.hora),
        observacao=det.get("lembrete_observacao", req.observacao),
        status=det.get("lembrete_status", "agendado"),
    )


@router.get("/")
async def listar_lembretes(status: Optional[str] = None):
    """Lista lembretes do funil comercial. Filtro opcional por status: agendado, notificado."""
    from app.core.lembrete_service import listar_lembretes as _listar

    cards = await _listar(status=status)
    result = []
    for card in cards:
        det = card.get("details", {}) or {}
        result.append({
            "card_id": card.get("id"),
            "title": card.get("title"),
            "data": det.get("lembrete_data", ""),
            "hora": det.get("lembrete_hora", ""),
            "observacao": det.get("lembrete_observacao", ""),
            "status": det.get("lembrete_status", ""),
            "nome": det.get("nome", ""),
            "celular": det.get("celular", ""),
            "cidade": det.get("cidade", ""),
            "created_at": card.get("created_at", ""),
        })
    return result


@router.patch("/{card_id}/reagendar")
async def reagendar_lembrete(card_id: str, req: LembreteCreate):
    """Reagenda um lembrete existente com nova data/hora."""
    from app.core.lembrete_service import criar_lembrete as _criar

    try:
        card = await _criar(
            card_id=card_id,
            lembrete_data=req.data,
            lembrete_hora=req.hora,
            observacao=req.observacao,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "reagendado", "card_id": card_id}


@router.patch("/{card_id}/concluir")
async def concluir_lembrete(card_id: str):
    """Marca lembrete como concluído e move card para coluna 'vendedor'."""
    from supabase import create_client
    from app.config import settings
    from app.core.teka_agent import move_card, update_card_details
    from datetime import datetime
    from zoneinfo import ZoneInfo

    SP_TZ = ZoneInfo("America/Sao_Paulo")
    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    card_resp = sb.table("kanban_cards").select("*").eq("id", card_id).single().execute()
    if not card_resp.data:
        raise HTTPException(status_code=404, detail="Card não encontrado")

    await update_card_details(card_id, {
        "lembrete_status": "concluido",
        "lembrete_concluido_em": datetime.now(SP_TZ).isoformat(),
    }, sb)

    await move_card(card_id, "vendedor", sb)

    return {"status": "concluido", "card_id": card_id, "moved_to": "vendedor"}
