"""
Kanban Bridge API
==================
Endpoints chamados pelo Dashboard Next.js para:
  - Fazer perguntas ao agente sobre o Kanban (/ask)
  - Receber notificações de handoff (/notify)
  - Gerar resumo de um departamento (/summary/{dept_id})
"""

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.supabase_kanban import dept_summary, DEPT_NAMES
from app.config import settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/kanban-bridge", tags=["kanban-bridge"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str
    dept_id: Optional[str] = None         # contexto opcional de qual dept
    card_id: Optional[str] = None          # se pergunta for sobre um card específico
    agent_name: Optional[str] = "Assistente Parket"
    _context_override: Optional[str] = None  # contexto completo já montado pelo dashboard


class AskResponse(BaseModel):
    answer: str
    dept_id: Optional[str] = None


class NotifyRequest(BaseModel):
    """Enviado pelo dashboard quando um card muda de estado relevante."""
    event: str           # 'card_moved', 'handoff_created', 'sla_expired'
    dept_id: str
    column_id: str
    card_title: str
    card_id: str
    responsavel: str
    to_dept_id: Optional[str] = None    # para handoffs
    to_column_id: Optional[str] = None


class SummaryResponse(BaseModel):
    dept_id: str
    dept_name: str
    summary: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=AskResponse)
async def ask_agent(req: AskRequest):
    """
    O dashboard envia uma pergunta sobre o Kanban e recebe resposta do agente IA.
    Inclui o contexto do departamento se dept_id for informado.
    """
    context = ""

    # Se veio contexto override do dashboard (ex: CardDetailModal com dados completos)
    if req._context_override:
        context = req._context_override
    # Se veio card_id específico, busca detalhes completos do card
    elif req.card_id:
        from app.core.supabase_kanban import get_card, format_card_full
        try:
            card = await get_card(req.card_id)
            if card:
                context = format_card_full(card)
        except Exception as e:
            logger.warning("card_detail_fetch_failed", card_id=req.card_id, error=str(e))
            if req.dept_id:
                context = await dept_summary(req.dept_id)
    # Senão usa resumo do departamento
    elif req.dept_id:
        context = await dept_summary(req.dept_id)

    # Monta o prompt para o LLM
    system_prompt = (
        f"Você é {req.agent_name}, assistente especializado em operações Parket. "
        "Responda de forma clara, objetiva e em português do Brasil. "
        "Você tem acesso ao status atual do Kanban operacional da empresa."
    )
    if context:
        system_prompt += f"\n\nCONTEXTO DO PROJETO:\n{context}"

    user_message = req.question

    # Chama a IA via account pool (OAuth → API key fallback)
    try:
        from app.database import AsyncSessionLocal
        from app.core.account_pool import account_pool

        async with AsyncSessionLocal() as db:
            response = await account_pool.chat(
                db=db,
                messages=[{"role": "user", "content": user_message}],
                system_prompt=system_prompt,
            )
        answer = response or "Não consegui processar sua pergunta no momento."
    except Exception as e:
        logger.error("kanban_bridge_ask_error", error=str(e))
        # Fallback: resposta baseada apenas no contexto estático
        answer = context if context else f"Erro ao consultar a IA: {e}"

    return AskResponse(answer=answer, dept_id=req.dept_id)


@router.post("/notify")
async def notify_event(req: NotifyRequest):
    """
    Recebe eventos do dashboard (handoffs, SLA expirado, etc.)
    e pode disparar ações automáticas via WhatsApp.
    """
    logger.info(
        "kanban_event_received",
        event=req.event,
        dept=req.dept_id,
        card=req.card_title,
    )

    # Handoff: notificar grupo WhatsApp do departamento destino
    if req.event in ("handoff_created", "card_moved") and req.to_dept_id:
        message = (
            f"📋 *Handoff recebido!*\n"
            f"Card: *{req.card_title}*\n"
            f"De: {DEPT_NAMES.get(req.dept_id, req.dept_id)} → {DEPT_NAMES.get(req.to_dept_id, req.to_dept_id)}\n"
            f"Coluna destino: {req.to_column_id}\n"
            f"Responsável: {req.responsavel}"
        )
        await _try_send_to_dept(req.to_dept_id, message)

    # SLA expirado: alertar grupo do departamento
    elif req.event == "sla_expired":
        message = (
            f"⚠️ *SLA Vencido!*\n"
            f"Card: *{req.card_title}*\n"
            f"Departamento: {DEPT_NAMES.get(req.dept_id, req.dept_id)}\n"
            f"Coluna: {req.column_id}\n"
            f"Responsável: {req.responsavel}"
        )
        await _try_send_to_dept(req.dept_id, message)

    return {"status": "processed", "event": req.event}


@router.get("/summary/{dept_id}", response_model=SummaryResponse)
async def get_dept_summary(dept_id: str):
    """
    Retorna um resumo textual do estado atual do departamento.
    Chamado pelo dashboard para exibir o painel de IA.
    """
    if dept_id not in DEPT_NAMES and dept_id != "all":
        raise HTTPException(status_code=404, detail=f"Departamento '{dept_id}' não encontrado.")

    if dept_id == "all":
        # Resumo geral de todos os depts
        parts = []
        for did in DEPT_NAMES:
            s = await dept_summary(did)
            if s:
                parts.append(s)
        summary = "\n\n" + ("=" * 50) + "\n\n".join(parts)
    else:
        summary = await dept_summary(dept_id)

    return SummaryResponse(
        dept_id=dept_id,
        dept_name=DEPT_NAMES.get(dept_id, dept_id),
        summary=summary,
    )


@router.get("/health")
async def bridge_health():
    return {"status": "ok", "supabase_url": settings.SUPABASE_URL[:40] + "..."}


# ── Helper ─────────────────────────────────────────────────────────────────────

# Mapeamento dept_id → group_id WhatsApp (configurável)
# O grupo WhatsApp precisa ter um agente vinculado.
# Por enquanto tenta encontrar um agente pelo nome do dept.
async def _try_send_to_dept(dept_id: str, message: str):
    """Tenta enviar mensagem para o grupo WhatsApp vinculado ao departamento."""
    try:
        from app.database import AsyncSessionLocal
        from app.models.agent import Agent
        from sqlalchemy import select
        from app.core.evolution_client import evolution_client

        async with AsyncSessionLocal() as db:
            dept_name = DEPT_NAMES.get(dept_id, dept_id).lower()
            result = await db.execute(
                select(Agent)
                .where(Agent.is_active == True)
                .where(Agent.group_id.isnot(None))
            )
            agents = result.scalars().all()

            # Tenta encontrar agente cujo nome contém o dept
            target = next(
                (a for a in agents if dept_name in (a.name or "").lower()
                 or dept_name in (a.description or "").lower()),
                None,
            )
            if target and target.group_id:
                await evolution_client.send_long_text(target.group_id, message)
                logger.info("dept_notification_sent", dept=dept_id, group=target.group_id)
            else:
                logger.info("no_whatsapp_group_for_dept", dept=dept_id)
    except Exception as e:
        logger.warning("dept_notification_failed", dept=dept_id, error=str(e))
