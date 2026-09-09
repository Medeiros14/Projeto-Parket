"""
Contracts API — Squad Financeiro
=================================
Recebe upload de contrato (PDF/imagem), analisa com o Agente Analisador de Contratos
(membro do Squad Financeiro) e salva o resultado na tabela projeto_contratos do Supabase.

Após a análise:
  - Posta AgentGroupMessage no Squad Financeiro (registro interno)
  - Envia notificação no grupo WhatsApp Financeiro
"""

import base64
import httpx
import structlog
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.supabase_kanban import _headers
from app.database import AsyncSessionLocal
from app.models.agent import Agent as DBAgent
from app.models.agent_group import AgentGroup, AgentGroupMember, AgentGroupMessage

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/contracts", tags=["contracts"])

SUPABASE_URL = settings.SUPABASE_URL

# Nome canônico do agente e do squad — usados para lookup
AGENT_NAME = "Analisador de Contratos"
SQUAD_NAME = "Squad Financeiro"

# ── Prompt de extração ────────────────────────────────────────────────────────

EXTRACT_PROMPT = """Você é um especialista do Squad Financeiro da Parket, especializado em análise de contratos de construção e reforma.
Analise o documento anexado e retorne um JSON com EXATAMENTE esta estrutura:

{
  "resumo": "Parágrafo curto com o essencial do contrato (2-4 frases)",
  "cliente": "Nome completo do cliente/contratante",
  "contratada": "Nome da empresa contratada",
  "data_assinatura": "DD/MM/AAAA ou null",
  "data_inicio_prevista": "DD/MM/AAAA ou null",
  "data_entrega_prevista": "DD/MM/AAAA ou null",
  "prazo_dias": número inteiro ou null,
  "valor_total": "R$ X.XXX,XX ou null",
  "condicoes_pagamento": "Descrição das parcelas/forma de pagamento",
  "metragem_m2": número decimal ou null,
  "endereco_obra": "Endereço completo ou null",
  "materiais": [
    {"item": "Nome do material", "especificacao": "Marca/modelo/detalhe", "quantidade": "X m² / X un"}
  ],
  "servicos": ["Lista de serviços contratados"],
  "garantia": "Prazo e condições de garantia ou null",
  "multas_penalidades": "Descrição de multas ou null",
  "observacoes_importantes": ["Cláusulas ou pontos relevantes"],
  "pontos_atencao": ["Itens que merecem atenção especial do gestor financeiro"]
}

Retorne APENAS o JSON, sem texto antes ou depois. Se alguma informação não estiver no documento, use null ou lista vazia.
Datas SEMPRE no formato DD/MM/AAAA."""


# ── Supabase Storage helpers ──────────────────────────────────────────────────

async def _upload_to_storage(card_id: str, filename: str, content: bytes, content_type: str) -> str:
    path = f"{card_id}/{filename}"
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/contratos/{path}",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=content,
        )
        r.raise_for_status()
    return path


async def _save_contrato(record: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/projeto_contratos",
            headers=_headers(),
            json=record,
        )
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else record


async def _get_contratos(card_id: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/projeto_contratos",
            headers=_headers(),
            params={"card_id": f"eq.{card_id}", "select": "*", "order": "created_at.desc"},
        )
        r.raise_for_status()
        return r.json()


async def _delete_contrato(contrato_id: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.delete(
            f"{SUPABASE_URL}/rest/v1/projeto_contratos",
            headers=_headers(),
            params={"id": f"eq.{contrato_id}"},
        )
        r.raise_for_status()


# ── Squad Financeiro helpers ──────────────────────────────────────────────────

async def _get_financial_squad_agent() -> tuple[DBAgent | None, AgentGroup | None]:
    """Retorna (agente_analisador, squad_financeiro) do banco."""
    async with AsyncSessionLocal() as db:
        # Agent
        r = await db.execute(select(DBAgent).where(DBAgent.name == AGENT_NAME, DBAgent.is_active == True))
        agent = r.scalar_one_or_none()

        # Squad
        r2 = await db.execute(
            select(AgentGroup)
            .where(AgentGroup.name == SQUAD_NAME)
            .options(selectinload(AgentGroup.members))
        )
        squad = r2.scalar_one_or_none()

        return agent, squad


async def _post_squad_message(squad: AgentGroup, agent: DBAgent | None, content: str, msg_type: str = "result"):
    """Posta mensagem de resultado no Squad Financeiro."""
    async with AsyncSessionLocal() as db:
        msg = AgentGroupMessage(
            group_id=squad.id,
            agent_id=agent.id if agent else None,
            message_type=msg_type,
            content=content,
        )
        db.add(msg)
        await db.commit()


async def _notify_whatsapp_financial(text: str):
    """Envia notificação no grupo WhatsApp Financeiro."""
    group_id = getattr(settings, "FINANCEIRO_WHATSAPP_GROUP_ID", "")
    if not group_id:
        logger.warning("financeiro_whatsapp_not_configured")
        return
    try:
        from app.core.evolution_client import evolution_client
        await evolution_client.send_long_text(group_id, text)
        logger.info("financeiro_whatsapp_sent", chars=len(text))
    except Exception as e:
        logger.warning("financeiro_whatsapp_failed", error=str(e))


# ── Claude PDF analysis (via Squad Financeiro agent account) ─────────────────

async def _analyze_with_claude(file_bytes: bytes, media_type: str, filename: str) -> dict:
    """Envia o arquivo para Claude (via conta do Squad Financeiro) e retorna o JSON extraído."""
    import anthropic, json

    # Pick a Claude API key account
    from app.core.account_pool import account_pool
    async with AsyncSessionLocal() as db:
        account = await account_pool._pick(db, provider="claude", auth_type="api_key")
        if not account:
            # Fallback: any active account
            account = await account_pool._pick(db)

    if not account:
        raise HTTPException(status_code=503, detail="Nenhuma conta de IA disponível para análise")

    client = anthropic.AsyncAnthropic(api_key=account.session_token)
    b64 = base64.standard_b64encode(file_bytes).decode("utf-8")

    if media_type == "application/pdf":
        content_block: dict = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
        }
    else:
        content_block = {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": b64},
        }

    msg_payload = [{
        "role": "user",
        "content": [
            content_block,
            {"type": "text", "text": f"Arquivo: {filename}\n\n{EXTRACT_PROMPT}"},
        ],
    }]

    response = await client.messages.create(model="claude-sonnet-4-5-20250514", max_tokens=4096, messages=msg_payload)

    raw = response.content[0].text.strip()

    # Strip markdown code fences if present
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        return json.loads(raw.strip())
    except Exception:
        return {
            "resumo": raw[:500],
            "pontos_atencao": ["Não foi possível estruturar a análise automaticamente"],
        }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_contract(
    card_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Recebe contrato, analisa via Squad Financeiro (Agente Analisador de Contratos)
    e salva no Supabase. Posta resultado no Squad e notifica WhatsApp Financeiro.
    """
    MAX_SIZE = 50 * 1024 * 1024
    allowed_types = {
        "application/pdf": "pdf",
        "image/jpeg": "image",
        "image/jpg": "image",
        "image/png": "image",
        "image/webp": "image",
    }

    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_types:
        raise HTTPException(400, f"Tipo não suportado: {content_type}. Use PDF ou imagem.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande. Máximo 50 MB.")
    if len(file_bytes) == 0:
        raise HTTPException(400, "Arquivo vazio.")

    filename = file.filename or f"contrato_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    logger.info("contract_analyze_start", card_id=card_id, filename=filename, agent=AGENT_NAME)

    # 1. Lookup Squad Financeiro agent
    agent, squad = await _get_financial_squad_agent()
    if not agent:
        logger.warning("contract_analyzer_agent_not_found", hint="Run startup seeding")
    if not squad:
        logger.warning("financial_squad_not_found")

    # 2. Upload to storage
    storage_path: str | None = None
    try:
        storage_path = await _upload_to_storage(card_id, filename, file_bytes, content_type)
    except Exception as e:
        logger.warning("contract_upload_failed", error=str(e))

    # 3. Analyze with Claude (Squad Financeiro account)
    try:
        ai_details = await _analyze_with_claude(file_bytes, content_type, filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("contract_claude_failed", error=str(e))
        raise HTTPException(500, f"Erro na análise IA: {str(e)}")

    # 4. Save to Supabase
    record = {
        "card_id": card_id,
        "filename": filename,
        "file_type": allowed_types[content_type],
        "file_size": len(file_bytes),
        "storage_path": storage_path,
        "ai_summary": ai_details.get("resumo", ""),
        "ai_details": ai_details,
        "analyzed_at": datetime.utcnow().isoformat(),
    }
    try:
        saved = await _save_contrato(record)
    except Exception as e:
        logger.error("contract_save_failed", error=str(e))
        saved = {**record, "id": None}

    # 5. Post to Squad Financeiro group messages
    if squad:
        det = ai_details
        squad_msg = (
            f"📄 Novo contrato analisado — {filename}\n"
            f"Projeto ID: {card_id}\n"
            f"Cliente: {det.get('cliente') or '—'} | Valor: {det.get('valor_total') or '—'} | "
            f"m²: {det.get('metragem_m2') or '—'} | Entrega: {det.get('data_entrega_prevista') or '—'}\n"
            f"Resumo: {det.get('resumo') or '—'}"
        )
        try:
            await _post_squad_message(squad, agent, squad_msg, msg_type="result")
        except Exception as e:
            logger.warning("squad_message_post_failed", error=str(e))

        # 6. WhatsApp notification
        det = ai_details
        wpp_msg = (
            f"📄 *Novo Contrato Analisado*\n"
            f"Arquivo: {filename}\n\n"
            f"Cliente: {det.get('cliente') or '—'}\n"
            f"Valor: {det.get('valor_total') or '—'}\n"
            f"Metragem: {str(det['metragem_m2']) + ' m²' if det.get('metragem_m2') else '—'}\n"
            f"Entrega prevista: {det.get('data_entrega_prevista') or '—'}\n"
            f"Início previsto: {det.get('data_inicio_prevista') or '—'}\n\n"
            f"_{det.get('resumo') or ''}_"
        )
        if det.get("pontos_atencao"):
            wpp_msg += "\n\n⚠️ *Pontos de atenção:*\n" + "\n".join(f"• {p}" for p in det["pontos_atencao"])

        await _notify_whatsapp_financial(wpp_msg)

    logger.info("contract_analyze_done", card_id=card_id, squad=SQUAD_NAME, agent=AGENT_NAME)
    return saved


@router.get("/{card_id}")
async def list_contracts(card_id: str):
    try:
        return await _get_contratos(card_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/{contrato_id}")
async def delete_contract(contrato_id: str):
    try:
        await _delete_contrato(contrato_id)
        return {"deleted": True}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{card_id}/storage-url/{contrato_id}")
async def get_storage_url(card_id: str, contrato_id: str):
    contratos = await _get_contratos(card_id)
    contrato = next((c for c in contratos if c["id"] == contrato_id), None)
    if not contrato or not contrato.get("storage_path"):
        raise HTTPException(404, "Arquivo não encontrado")

    path = contrato["storage_path"]
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/contratos/{path}",
            headers={
                "apikey": settings.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            },
            json={"expiresIn": 3600},
        )
        r.raise_for_status()
        data = r.json()
        signed_url = f"{SUPABASE_URL}/storage/v1{data.get('signedURL', '')}"
        return {"url": signed_url, "expires_in": 3600}


# ─── DocuSign notify ────────────────────────────────────────────────
# Endpoint chamado pelo parket-docusign quando um envelope muda de estado.
# Centraliza o envio WhatsApp pro grupo Financeiro nesta API.

class DocuSignNotifyPayload(BaseModel):
    action: str  # "enviado" | "assinado" | "recusado" | "vencido" | "cancelado"
    card_id: Optional[str] = None
    envelope_id: Optional[str] = None
    obra: Optional[str] = None
    cliente: Optional[str] = None
    signatarios: Optional[list[dict]] = None
    extra: Optional[str] = None


@router.post("/docusign-notify")
async def docusign_notify(payload: DocuSignNotifyPayload):
    """Notifica o grupo Financeiro sobre mudança de status de envelope DocuSign."""
    icons = {
        "enviado": "📤",
        "assinado": "✅",
        "recusado": "❌",
        "vencido": "⏰",
        "cancelado": "🚫",
    }
    ico = icons.get(payload.action, "📄")
    label = payload.action.upper()

    lines = [f"{ico} *Contrato {label}*"]
    if payload.obra:
        lines.append(f"📋 *Obra*: {payload.obra}")
    if payload.cliente:
        lines.append(f"👤 *Cliente*: {payload.cliente}")
    if payload.signatarios:
        lines.append("\n*Signatários*:")
        for s in payload.signatarios:
            nome = s.get("nome", "?")
            papel = s.get("papel", "?")
            lines.append(f"  • {papel}: {nome}")
    if payload.envelope_id:
        lines.append(f"\n_envelope: `{payload.envelope_id[:12]}…`_")
    if payload.extra:
        lines.append(f"\n{payload.extra}")

    msg = "\n".join(lines)
    await _notify_whatsapp_financial(msg)
    logger.info("docusign_notify_sent", action=payload.action, card_id=payload.card_id)
    return {"ok": True}
