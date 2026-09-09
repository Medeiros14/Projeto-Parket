"""
Handoffs Notify API
====================
Recebe notificações de aceite/recusa de handoff e dispara mensagens WhatsApp
nos grupos do setor de origem (Fiscal) e destino (PMO) via Evolution API.
"""

import structlog
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.core.evolution_client import evolution_client

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/handoffs", tags=["handoffs"])

# Mapeamento dept_id → JID do grupo WhatsApp
DEPT_GROUP_IDS: dict[str, str] = {
    "fiscal":        "120363425769227152@g.us",    # 📊 Parket - Fiscal
    "produtividade": "120363405460675664@g.us",    # 📋 Parket - PMO
    "financeiro":    "120363407134075532@g.us",    # 💰 Parket - Financeiro
    "obras":         "120363427046305569@g.us",    # 🏗 Parket - Obras
    "comercial":     "120363423690432580@g.us",    # 💼 Parket - Comercial
    "projetos":      "120363406795322179@g.us",    # 📐 Parket - Projetos
    "compras":       "120363427283309459@g.us",    # 🛒 Parket - Compras
    "atendimento":   "120363407367929089@g.us",    # 🎧 Parket - Atendimento
}

# Setor Operacional — cada pessoa é vinculada a 1+ grupos WhatsApp.
# Quando um card muda de coluna no Operacional, a notificação é enviada
# nos grupos de todos os responsáveis da coluna destino (união dedup).
PESSOA_GRUPOS: dict[str, list[str]] = {
    "Felipe":   ["fiscal", "atendimento"],
    "Dany":     ["obras"],
    "Vinicius": ["atendimento"],
    "Natalia":  ["produtividade"],
    "Nati":     ["produtividade"],    # alias
    "Thaiane":  ["projetos"],
    "Thainara": ["projetos"],          # alias
}

# Responsáveis padrão por coluna do Kanban Operacional
OPERACIONAL_COLUMN_RESPONSAVEIS: dict[str, list[str]] = {
    "entrada":            ["Felipe"],
    "projeto":            ["Thaiane"],
    "pendente":           ["Felipe"],
    "primeira-vistoria":  ["Felipe"],
    "pre-cronograma":     ["Natalia"],
    "segunda-vistoria":   ["Felipe"],
    "entrega-material":   ["Vinicius", "Felipe"],
    "obras-liberadas":    ["Felipe"],
    "cronograma-final":   ["Natalia"],
    "acompanhamento":     ["Dany", "Felipe", "Vinicius", "Natalia"],
    "travado":            ["Felipe"],
    "obras-finalizadas":  ["Dany"],
    "reparos":            ["Dany"],
    "reparos-concluidos": ["Dany"],
}


def _grupos_dos_responsaveis(responsaveis: list[str]) -> list[str]:
    """Retorna lista deduplicada de JIDs dos grupos para os responsáveis."""
    jids = []
    seen = set()
    for pessoa in responsaveis:
        for dept in PESSOA_GRUPOS.get(pessoa, []):
            jid = DEPT_GROUP_IDS.get(dept)
            if jid and jid not in seen:
                seen.add(jid)
                jids.append(jid)
    return jids


class HandoffNotifyPayload(BaseModel):
    handoff_id: str
    action: str                     # "aceito" | "recusado"
    obra: Optional[str] = None
    title: Optional[str] = None
    dept_from: str
    dept_to: str
    responsavel_from: Optional[str] = None
    responsavel_to: Optional[str] = None
    observacao: Optional[str] = None
    negado_motivo: Optional[str] = None


@router.post("/notify")
async def notify_handoff(payload: HandoffNotifyPayload):
    """
    Chamado pelo frontend após aceite ou recusa de handoff.
    Envia mensagem nos grupos WhatsApp do setor de origem e destino.
    """
    projeto = payload.obra or payload.title or "Projeto"
    resp_from = payload.responsavel_from or payload.dept_from
    resp_to   = payload.responsavel_to   or payload.dept_to

    if payload.action == "aceito":
        msg_from = (
            f"✅ *Handoff Aceito!*\n"
            f"Projeto: *{projeto}*\n"
            f"O setor *{payload.dept_to.upper()}* ({resp_to}) aceitou a passagem de bastão.\n"
            f"O projeto está sob responsabilidade do PMO a partir de agora."
            + (f"\n\n💬 Observação: _{payload.observacao}_" if payload.observacao else "")
        )
        msg_to = (
            f"✅ *Novo Projeto Recebido via Handoff*\n"
            f"Projeto: *{projeto}*\n"
            f"Origem: *{payload.dept_from.upper()}* ({resp_from})\n"
            f"O projeto foi aceito e está em *Novo Projeto* no seu Kanban."
            + (f"\n\n💬 Observação: _{payload.observacao}_" if payload.observacao else "")
        )
    else:  # recusado
        motivo = payload.negado_motivo or payload.observacao or "Motivo não informado"
        msg_from = (
            f"❌ *Handoff Recusado*\n"
            f"Projeto: *{projeto}*\n"
            f"O setor *{payload.dept_to.upper()}* ({resp_to}) devolveu o projeto.\n"
            f"Motivo: _{motivo}_\n\n"
            f"O card voltou para o setor *{payload.dept_from.upper()}* para ajustes."
        )
        msg_to = (
            f"❌ *Handoff Recusado — Projeto devolvido*\n"
            f"Projeto: *{projeto}*\n"
            f"Motivo: _{motivo}_"
        )

    sent_to: list[str] = []

    group_from = DEPT_GROUP_IDS.get(payload.dept_from, "")
    group_to   = DEPT_GROUP_IDS.get(payload.dept_to, "")

    if group_from:
        try:
            await evolution_client.send_text(group_from, msg_from)
            sent_to.append(payload.dept_from)
        except Exception as e:
            logger.warning("handoff_notify_whatsapp_failed", dept=payload.dept_from, error=str(e))

    if group_to and group_to != group_from:
        try:
            await evolution_client.send_text(group_to, msg_to)
            sent_to.append(payload.dept_to)
        except Exception as e:
            logger.warning("handoff_notify_whatsapp_failed", dept=payload.dept_to, error=str(e))

    logger.info(
        "handoff_notified",
        handoff_id=payload.handoff_id,
        action=payload.action,
        obra=projeto,
        sent_to=sent_to,
    )
    return {"ok": True, "sent_to": sent_to}


class FiscalLiberaPayload(BaseModel):
    handoff_id: str
    obra: Optional[str] = None
    title: Optional[str] = None
    responsavel_from: Optional[str] = None


@router.post("/fiscal-libera")
async def fiscal_libera_notify(payload: FiscalLiberaPayload):
    """
    Chamado quando Fiscal move projeto para 'handoff-pmo' (Passagem de Bastão → Obras).
    - Notifica Obras: novo projeto aguardando aceite em Entrada
    - Notifica PMO: projeto passou pela 2ª vistoria, pronto para cronograma fixo
    """
    projeto = payload.obra or payload.title or "Projeto"
    resp_from = payload.responsavel_from or "Fiscal"

    msg_obras = (
        f"🏗 *Novo Projeto Aguardando Aceite — Obras*\n"
        f"Projeto: *{projeto}*\n"
        f"O setor *FISCAL* ({resp_from}) concluiu a 2ª vistoria e liberou o projeto.\n"
        f"Ele está em *Entrada* no seu Kanban de Obras aguardando seu aceite.\n\n"
        f"_Acesse o sistema para aceitar ou devolver o projeto._"
    )
    msg_pmo = (
        f"📋 *Projeto Pronto para Cronograma Fixo*\n"
        f"Projeto: *{projeto}*\n"
        f"O setor *FISCAL* concluiu a 2ª vistoria e liberou o projeto para Obras.\n"
        f"O projeto já pode ser incluído no *cronograma fixo de produtividade*.\n\n"
        f"_Acompanhe o andamento no sistema._"
    )

    sent_to: list[str] = []

    group_obras = DEPT_GROUP_IDS.get("obras", "")
    group_pmo   = DEPT_GROUP_IDS.get("produtividade", "")

    if group_obras:
        try:
            await evolution_client.send_text(group_obras, msg_obras)
            sent_to.append("obras")
        except Exception as e:
            logger.warning("fiscal_libera_obras_failed", error=str(e))

    if group_pmo:
        try:
            await evolution_client.send_text(group_pmo, msg_pmo)
            sent_to.append("produtividade")
        except Exception as e:
            logger.warning("fiscal_libera_pmo_failed", error=str(e))

    logger.info("fiscal_libera_notified", obra=projeto, sent_to=sent_to)
    return {"ok": True, "sent_to": sent_to}


# ── Notificação de Nova Solicitação de Compras ────────────────────────

class NovaSolicitacaoPayload(BaseModel):
    titulo: str
    solicitante: str
    itens: Optional[list[str]] = None
    prazo: Optional[str] = None
    projeto_vinculado: Optional[str] = None
    card_id: Optional[str] = None
    obra: Optional[str] = None


@router.post("/nova-solicitacao-compras")
async def notificar_nova_solicitacao_compras(payload: NovaSolicitacaoPayload):
    """Notifica o grupo de Compras sobre uma nova solicitação recebida."""
    group_compras = DEPT_GROUP_IDS.get("compras", "")
    if not group_compras:
        return {"ok": False, "error": "Grupo de compras não configurado"}

    itens_text = ""
    if payload.itens:
        itens_text = "\n".join(f"  - {item}" for item in payload.itens[:10])
        if len(payload.itens) > 10:
            itens_text += f"\n  ... +{len(payload.itens) - 10} itens"

    msg = f"📥 *Nova Solicitação de Compras*\n\n"
    msg += f"*Solicitante:* {payload.solicitante}\n"
    if payload.projeto_vinculado:
        msg += f"*Projeto:* {payload.projeto_vinculado}\n"
    if payload.obra:
        msg += f"*Código:* {payload.obra}\n"
    if payload.prazo:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(payload.prazo)
            prazo_fmt = dt.strftime("%d/%m/%Y")
        except Exception:
            prazo_fmt = payload.prazo
        msg += f"*Prazo estimado:* {prazo_fmt}\n"
    if itens_text:
        msg += f"\n*O que foi solicitado:*\n{itens_text}\n"
    else:
        msg += f"\n*Título:* {payload.titulo}\n"
    msg += "\n_Acesse o kanban de Compras para mais detalhes._"

    try:
        await evolution_client.send_text(group_compras, msg)
        logger.info("nova_solicitacao_compras_notificada", solicitante=payload.solicitante, titulo=payload.titulo)
        return {"ok": True, "sent_to": "compras"}
    except Exception as e:
        logger.error("nova_solicitacao_compras_falhou", error=str(e))
        return {"ok": False, "error": str(e)}


# ── Notificação de Card em Revisão (Projetos) ─────────────────────────

class CardRevisaoProjetosPayload(BaseModel):
    card_id: str
    titulo: str
    responsavel: Optional[str] = None
    obra: Optional[str] = None
    cliente: Optional[str] = None
    descricao: Optional[str] = None
    prioridade: Optional[str] = None
    movido_por: Optional[str] = None


@router.post("/card-revisao-projetos")
async def notificar_card_revisao_projetos(payload: CardRevisaoProjetosPayload):
    """Notifica o grupo de Projetos quando um card vai para a etapa de Revisão.

    O texto da mensagem é redigido pelo Agente Projetos do squad (vinculado ao
    grupo) para manter consistência de tom; em caso de falha cai num texto
    fallback construído localmente.
    """
    group_projetos = DEPT_GROUP_IDS.get("projetos", "")
    if not group_projetos:
        return {"ok": False, "error": "Grupo de projetos não configurado"}

    # Texto fallback (caso o squad falhe)
    linhas = ["📐 *Card em Revisão — Projetos*", ""]
    linhas.append(f"*{payload.titulo}*")
    if payload.cliente:
        linhas.append(f"👤 Cliente: {payload.cliente}")
    if payload.obra:
        linhas.append(f"🏗 Obra: {payload.obra}")
    if payload.responsavel:
        linhas.append(f"🧑‍💻 Responsável: {payload.responsavel}")
    if payload.prioridade:
        linhas.append(f"⚡ Prioridade: {payload.prioridade}")
    if payload.descricao:
        linhas.append("")
        linhas.append(f"_{payload.descricao[:300]}_")
    linhas.append("")
    linhas.append("_O card foi movido para a coluna *Revisão / Bloqueado*. Validem e devolvam o feedback._")
    linhas.append("🔗 space.parket.works")
    fallback_text = "\n".join(linhas)

    # Tentar gerar via agente Projetos do squad
    final_text = fallback_text
    try:
        from app.database import AsyncSessionLocal
        from app.core.agno_engine import agent_squad

        contexto = (
            f"Card: {payload.titulo}\n"
            f"Cliente: {payload.cliente or '—'}\n"
            f"Obra: {payload.obra or '—'}\n"
            f"Responsável: {payload.responsavel or '—'}\n"
            f"Prioridade: {payload.prioridade or '—'}\n"
            f"Movido por: {payload.movido_por or '—'}\n"
            f"Descrição: {payload.descricao or '—'}"
        )
        prompt = (
            "Um card de Projetos acabou de entrar na etapa REVISÃO / BLOQUEADO. "
            "Redija uma mensagem curta para o grupo WhatsApp de Projetos avisando "
            "a equipe. Use português brasileiro, formatação WhatsApp (*negrito*) "
            "e emojis comedidos. Inclua título, responsável, cliente/obra se houver, "
            "e finalize com 1 frase pedindo a validação. Máximo 10 linhas. Não "
            "invente dados — use SOMENTE o contexto abaixo.\n\n"
            f"{contexto}"
        )
        async with AsyncSessionLocal() as db:
            resp = await agent_squad.dispatch(
                db=db,
                group_id=group_projetos,
                user_message=prompt,
                sender_name="Sistema Kanban",
                sender_phone="kanban@revisao",
            )
        if resp and resp.strip():
            final_text = resp.strip()
    except Exception as e:
        logger.warning("squad_dispatch_revisao_projetos_falhou", error=str(e))

    try:
        await evolution_client.send_long_text(group_projetos, final_text)
        logger.info(
            "card_revisao_projetos_notificado",
            card_id=payload.card_id,
            titulo=payload.titulo,
            responsavel=payload.responsavel,
        )
        return {"ok": True, "sent_to": "projetos"}
    except Exception as e:
        logger.error("card_revisao_projetos_falhou", error=str(e))
        return {"ok": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════
#  SETOR OPERACIONAL — notificação multi-grupo + auto-handoff Projeto
# ═══════════════════════════════════════════════════════════════════

class OperacionalCardMovidoPayload(BaseModel):
    card_id: str
    titulo: str
    coluna_de: Optional[str] = None      # slug da coluna antiga
    coluna_para: str                     # slug da coluna nova
    obra: Optional[str] = None
    cliente: Optional[str] = None
    responsaveis: Optional[list[str]] = None  # override dos responsáveis padrão
    movido_por: Optional[str] = None
    prioridade: Optional[str] = None


@router.post("/operacional/card-movido")
async def notificar_card_movido_operacional(payload: OperacionalCardMovidoPayload):
    """Notifica nos grupos WhatsApp dos responsáveis da nova coluna quando
    um card do setor Operacional muda de etapa no kanban.

    Cada coluna tem 1+ responsáveis fixos (Felipe, Dany, Vinicius, etc).
    Cada responsável pertence a 1+ grupos (Fiscal+Atendimento no caso do Felipe).
    A notificação é enviada em TODOS os grupos de TODOS os responsáveis (dedup).
    """
    # Escolhe responsáveis: override > default da coluna
    resps = payload.responsaveis or OPERACIONAL_COLUMN_RESPONSAVEIS.get(
        payload.coluna_para, []
    )
    if not resps:
        return {"ok": False, "error": f"Coluna '{payload.coluna_para}' não tem responsáveis configurados"}

    jids = _grupos_dos_responsaveis(resps)
    if not jids:
        return {"ok": False, "error": "Nenhum grupo WhatsApp encontrado para os responsáveis"}

    # Mensagem
    coluna_titulo = payload.coluna_para.replace("-", " ").title()
    linhas = [f"📌 *Card em {coluna_titulo}* — Operacional", ""]
    linhas.append(f"*{payload.titulo}*")
    if payload.cliente:
        linhas.append(f"👤 Cliente: {payload.cliente}")
    if payload.obra:
        linhas.append(f"🏗 Obra: {payload.obra}")
    linhas.append(f"🧑‍💻 Responsável: {', '.join(resps)}")
    if payload.prioridade and payload.prioridade != "media":
        linhas.append(f"⚡ Prioridade: {payload.prioridade}")
    if payload.movido_por:
        linhas.append(f"↪️ Movido por: {payload.movido_por}")
    linhas.append("")
    linhas.append("🔗 space.parket.works")
    text = "\n".join(linhas)

    sent = []
    failed = []
    for jid in jids:
        try:
            await evolution_client.send_text(jid, text)
            sent.append(jid)
        except Exception as e:
            failed.append({"jid": jid, "error": str(e)})
            logger.warning("operacional_notify_falhou", jid=jid, error=str(e))

    logger.info(
        "operacional_card_movido_notificado",
        card_id=payload.card_id,
        coluna_para=payload.coluna_para,
        responsaveis=resps,
        grupos_notificados=len(sent),
    )
    return {
        "ok": len(sent) > 0,
        "responsaveis": resps,
        "grupos_notificados": sent,
        "falhas": failed,
    }


class OperacionalHandoffProjetoPayload(BaseModel):
    card_id: str        # card no operacional que foi movido pra coluna "projeto"
    titulo: str
    obra: Optional[str] = None
    cliente: Optional[str] = None
    descricao: Optional[str] = None
    prioridade: Optional[str] = None
    movido_por: Optional[str] = None


@router.post("/operacional/handoff-projeto")
async def criar_handoff_para_projetos(payload: OperacionalHandoffProjetoPayload):
    """Quando um card no Operacional é movido para a coluna 'Projeto',
    automaticamente:
      1. Cria uma CÓPIA do card em dept_id=projetos (column_id=novo)
      2. Registra um handoff em handoffs_data
      3. Notifica o grupo de Projetos
    O card original permanece no Operacional para rastreamento.
    """
    from app.core.supabase_kanban import create_card, get_card, update_card
    import uuid

    # 1. Busca card original
    try:
        original = await get_card(payload.card_id)
    except Exception:
        original = None

    if not original:
        return {"ok": False, "error": f"Card {payload.card_id} não encontrado"}

    # 2. Cria cópia em dept_id=projetos
    original_details = original.get("details") or {}
    novo_card = {
        "dept_id": "projetos",
        "column_id": "novo",
        "title": payload.titulo,
        "responsavel": "Thaiane",
        "sla": original.get("sla") or "7d",
        "sla_status": "ok",
        "priority": payload.prioridade or original.get("priority") or "media",
        "obra": payload.obra or original.get("obra"),
        "description": payload.descricao or original.get("description"),
        "details": {
            **{k: v for k, v in original_details.items() if k not in ("archived", "merged_into")},
            "handoff_from": {
                "source_card_id": payload.card_id,
                "source_dept": "operacional",
                "source_column": "projeto",
                "movido_por": payload.movido_por,
                "created_at": "now",
            },
        },
    }

    try:
        novo = await create_card(novo_card)
    except Exception as e:
        logger.error("handoff_projeto_create_card_falhou", error=str(e))
        return {"ok": False, "error": f"Erro ao criar card: {e}"}

    if not novo:
        return {"ok": False, "error": "Falha ao criar card em projetos"}

    # 3. Atualiza card original com referência ao handoff
    handoff_entry = {
        "handoff_id": str(uuid.uuid4()),
        "target_card_id": novo["id"],
        "target_dept": "projetos",
        "target_column": "novo",
        "created_at": "now",
        "movido_por": payload.movido_por,
    }
    try:
        handoffs_data = original.get("handoffs_data") or []
        if not isinstance(handoffs_data, list):
            handoffs_data = []
        handoffs_data.append(handoff_entry)
        await update_card(payload.card_id, {"handoffs_data": handoffs_data})
    except Exception as e:
        logger.warning("handoff_projeto_update_original_falhou", error=str(e))

    # 4. Notifica grupo de Projetos
    group_projetos = DEPT_GROUP_IDS.get("projetos")
    if group_projetos:
        linhas = ["📐 *Novo Projeto — vindo do Operacional*", ""]
        linhas.append(f"*{payload.titulo}*")
        if payload.cliente:
            linhas.append(f"👤 Cliente: {payload.cliente}")
        if payload.obra:
            linhas.append(f"🏗 Obra: {payload.obra}")
        linhas.append(f"🧑‍💻 Responsável: Thaiane")
        if payload.prioridade and payload.prioridade != "media":
            linhas.append(f"⚡ Prioridade: {payload.prioridade}")
        if payload.descricao:
            linhas.append("")
            linhas.append(f"_{payload.descricao[:300]}_")
        linhas.append("")
        linhas.append("_Card criado na coluna *Novo Projeto* — verificar e dar andamento._")
        linhas.append("🔗 space.parket.works")
        try:
            await evolution_client.send_text(group_projetos, "\n".join(linhas))
        except Exception as e:
            logger.warning("handoff_projeto_whatsapp_falhou", error=str(e))

    logger.info(
        "handoff_projeto_criado",
        card_original=payload.card_id,
        card_novo=novo["id"],
        titulo=payload.titulo,
    )
    return {
        "ok": True,
        "card_original_id": payload.card_id,
        "card_novo_id": novo["id"],
        "handoff_id": handoff_entry["handoff_id"],
    }
