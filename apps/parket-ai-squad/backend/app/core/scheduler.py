"""
Task Scheduler
==============
APScheduler-based background scheduler.
Checks every minute for due tasks and dispatches them:
  - reminder: send WhatsApp message
  - webhook: HTTP call to configured URL
"""

import httpx
import pytz
from datetime import datetime, timedelta
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler

_TZ_BR = pytz.timezone("America/Sao_Paulo")

from app.database import AsyncSessionLocal
from app.models.task import ScheduledTask
from sqlalchemy import select

logger = structlog.get_logger(__name__)

scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")


async def _run_due_tasks():
    """Called every minute. Finds pending tasks due now and executes them."""
    now = datetime.now(_TZ_BR).replace(tzinfo=None)  # São Paulo naive — matches stored due_at

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScheduledTask)
            .where(ScheduledTask.status == "pending")
            .where(ScheduledTask.due_at <= now)
        )
        tasks = result.scalars().all()

        for task in tasks:
            try:
                if task.action_type == "reminder":
                    await _send_reminder(task)
                elif task.action_type == "webhook":
                    await _call_webhook(task)

                # Handle recurrence
                if task.recurrence == "none":
                    task.status = "sent"
                elif task.recurrence == "daily":
                    task.due_at = task.due_at + timedelta(days=1)
                elif task.recurrence == "weekly":
                    task.due_at = task.due_at + timedelta(weeks=1)
                elif task.recurrence == "monthly":
                    # Add ~30 days
                    task.due_at = task.due_at + timedelta(days=30)

                task.sent_at = datetime.now(_TZ_BR).replace(tzinfo=None)
                await db.commit()
                logger.info("task_executed", task_id=str(task.id), title=task.title, type=task.action_type)

            except Exception as e:
                task.status = "failed"
                await db.commit()
                logger.error("task_execution_failed", task_id=str(task.id), error=str(e))


async def _send_reminder(task: ScheduledTask):
    """Send a WhatsApp reminder message."""
    from app.core.evolution_client import evolution_client, evolution_comercial_client, get_client_for_instance
    msg = f"🔔 *Lembrete*: {task.title}"
    if task.description:
        msg += f"\n\n{task.description}"
    await evolution_client.send_text(task.group_id, msg)


async def _call_webhook(task: ScheduledTask):
    """Make HTTP call to the configured webhook URL."""
    cfg = task.action_config or {}
    url = cfg.get("url")
    if not url:
        raise ValueError("webhook_url not configured")

    method = cfg.get("method", "POST").upper()
    headers = cfg.get("headers", {})
    body = cfg.get("body", "")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(method, url, headers=headers, content=body)
        resp.raise_for_status()
    logger.info("webhook_called", url=url, status=resp.status_code)


async def schedule_teka_followup(card_id: str, phone: str, delay_minutes: int = 30):
    """Compatibilidade: agora o cron job cuida de tudo. Não precisa agendar individualmente."""
    logger.info("teka_followup_will_be_checked_by_cron", card_id=card_id, phone=phone)


async def _teka_cron_followup():
    """
    CRON JOB: roda a cada minuto, verifica TODOS os cards TEKA ativos
    e aplica as regras de follow-up baseado no tempo desde a última mensagem.

    Regras:
    - 30 min sem resposta → Follow-up 1
    - +3 horas sem resposta após follow-up 1 → Follow-up 2
    - +10 min sem resposta após follow-up 2 → Timeout (move para Em Qualificação)
    """
    import os as _os
    import redis as _redis
    from app.config import settings

    # Kill-switch opcional via env (default OFF). Cards anteriores foram
    # marcados teka_ativa=false, então o cron só age em leads NOVOS.
    if _os.environ.get("TEKA_FOLLOWUP_DISABLED", "0") == "1":
        return

    # Lock para evitar duplicação entre réplicas
    try:
        r = _redis.from_url(settings.REDIS_URL)
        lock = r.set("teka_cron_lock", "1", nx=True, ex=55)  # lock 55s, cron roda a cada 60s
        if not lock:
            return  # Outra réplica já está executando
    except Exception:
        pass  # Se Redis falhar, continua (melhor duplicar do que não rodar)

    from supabase import create_client
    from app.core.teka_agent import (
        is_teka_active, update_card_details, move_card,
        notify_comercial_group, COL_EM_QUALIFICACAO, COL_QUALIFICADO_IA, COL_LEADS_ENTRADA,
    )
    from app.core.evolution_client import evolution_client, evolution_comercial_client, get_client_for_instance

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    now = datetime.now(_TZ_BR)

    try:
        # Busca todos os cards TEKA ativos. Inclui triagem-ia porque é onde
        # o card fica enquanto TEKA está conduzindo a conversa — antes ela
        # estava de fora e cards travavam quando o cliente parava de responder.
        from app.core.teka_agent import COL_TRIAGEM_IA
        result = sb.table("kanban_cards") \
            .select("id,title,column_id,details") \
            .eq("dept_id", "comercial-entrada") \
            .in_("column_id", [COL_LEADS_ENTRADA, COL_TRIAGEM_IA, COL_QUALIFICADO_IA]) \
            .execute()

        cards = result.data or []
        for card in cards:
            det = card.get("details", {}) or {}

            # Só processa cards com TEKA ativa
            if not det.get("teka_ativa", False):
                continue

            phone = det.get("celular", "")
            if not phone:
                continue

            # Pausa manual do painel vale pra QUALQUER automação (V1 e V2)
            try:
                from app.core.teca_v2 import state as _v2_state
                if await _v2_state.is_paused(phone):
                    continue
            except Exception:
                pass

            # Calcula tempo desde última mensagem
            ultima_str = det.get("teka_ultima_msg", "")
            if not ultima_str:
                continue

            try:
                ultima = datetime.fromisoformat(ultima_str)
                if ultima.tzinfo is None:
                    ultima = ultima.replace(tzinfo=_TZ_BR)
            except Exception:
                continue

            minutos_sem_resposta = (now - ultima).total_seconds() / 60
            followup_count = det.get("teka_followup_count", 0)
            card_id = card["id"]
            jid = f"{phone}@s.whatsapp.net"
            # Cron processa SÓ cards do dept "comercial-entrada" — todos os envios
            # têm que sair pela instância "Comercial - Parket" (5511999600222).
            # Why: cards antigos / criados sem evo_instance caíam no padrão (Parket
            # interno 5511971975808) — número errado, gera ruído pro cliente.
            lead_client = evolution_comercial_client

            # ── Monta contexto da última interação ──
            msgs_ia = det.get("mensagens_ia", [])
            ultima_msg_cliente = ""
            ultima_msg_teka = ""
            for m in reversed(msgs_ia):
                if m.get("de") == "cliente" and not ultima_msg_cliente:
                    ultima_msg_cliente = m.get("texto", "")[:200]
                if m.get("de") == "teka" and not ultima_msg_teka:
                    ultima_msg_teka = m.get("texto", "")[:200]
                if ultima_msg_cliente and ultima_msg_teka:
                    break

            # ── FOLLOW-UP 1: 30 min sem resposta ──
            # FIX 2026-06-15 (loop Maria Paula): idempotência por timestamp.
            # Se teka_followup_1_at já está set e ainda recente (<24h), pula —
            # independente do contador. Previne loop quando contador zerar.
            _f1_at = det.get("teka_followup_1_at", "")
            _f1_recent = False
            if _f1_at:
                try:
                    _t = datetime.fromisoformat(_f1_at)
                    if _t.tzinfo is None: _t = _t.replace(tzinfo=_TZ_BR)
                    if (now - _t).total_seconds() < 24 * 3600:
                        _f1_recent = True
                except Exception:
                    pass

            if followup_count == 0 and minutos_sem_resposta >= 30 and not _f1_recent:
                logger.info("teka_followup_1", card_id=card_id, phone=phone, mins=int(minutos_sem_resposta))
                update_card_details_sync(card_id, {
                    "teka_followup_count": 1,
                    "teka_followup_1_at": now.isoformat(),
                }, sb)

                # Mensagem fixa e curta — UMA única pergunta
                msg = "Ficou alguma dúvida sobre o que conversamos? Estou por aqui para continuar quando quiser."
                await lead_client.send_typing(jid, 2000)
                await lead_client.send_text(jid, msg)

                msgs = det.get("mensagens_ia", [])
                msgs.append({"de": "teka", "texto": msg, "ts": now.isoformat()})
                update_card_details_sync(card_id, {"mensagens_ia": msgs, "teka_ultima_msg_teka": now.isoformat()}, sb)
                logger.info("teka_followup_1_sent", card_id=card_id, phone=phone)

            # ── FOLLOW-UP 2: 3h (180min) após follow-up 1 ──
            elif followup_count == 1:
                followup1_str = det.get("teka_followup_1_at", "")
                if followup1_str:
                    try:
                        f1_time = datetime.fromisoformat(followup1_str)
                        if f1_time.tzinfo is None: f1_time = f1_time.replace(tzinfo=_TZ_BR)
                        mins_since_f1 = (now - f1_time).total_seconds() / 60
                    except Exception:
                        mins_since_f1 = 0

                    if mins_since_f1 >= 180:
                        logger.info("teka_followup_2", card_id=card_id, phone=phone, mins=int(mins_since_f1))
                        update_card_details_sync(card_id, {
                            "teka_followup_count": 2,
                            "teka_followup_2_at": now.isoformat(),
                        }, sb)

                        # Mensagem fixa e curta — UMA única frase
                        msg2 = "Sei que a rotina de obra e projeto é corrida. Quando tiver um momento, retomamos daqui. As informações que já tenho ficam salvas."
                        await lead_client.send_typing(jid, 2000)
                        await lead_client.send_text(jid, msg2)

                        msgs = det.get("mensagens_ia", [])
                        msgs.append({"de": "teka", "texto": msg2, "ts": now.isoformat()})
                        update_card_details_sync(card_id, {"mensagens_ia": msgs, "teka_ultima_msg_teka": now.isoformat()}, sb)
                        logger.info("teka_followup_2_sent", card_id=card_id, phone=phone)

            # ── TIMEOUT: 10 min após follow-up 2 → move para Em Qualificação ──
            elif followup_count >= 2:
                followup2_str = det.get("teka_followup_2_at", "")
                if followup2_str:
                    try:
                        f2_time = datetime.fromisoformat(followup2_str)
                        if f2_time.tzinfo is None: f2_time = f2_time.replace(tzinfo=_TZ_BR)
                        mins_since_f2 = (now - f2_time).total_seconds() / 60
                    except Exception:
                        mins_since_f2 = 0

                    if mins_since_f2 >= 10:
                        logger.info("teka_timeout", card_id=card_id, phone=phone)
                        update_card_details_sync(card_id, {
                            "teka_ativa": False,
                            "teka_etapa": "timeout_followup",
                            "teka_encerrado": now.isoformat(),
                        }, sb)
                        move_card_sync(card_id, COL_EM_QUALIFICACAO, sb)
                        await notify_comercial_group(card, "em_qualificacao", evolution_client)

    except Exception as e:
        logger.error("teka_cron_error", error=str(e), exc_info=True)


def update_card_details_sync(card_id: str, updates: dict, sb):
    """Helper sync para atualizar details."""
    existing = sb.table("kanban_cards").select("details").eq("id", card_id).single().execute()
    current = (existing.data or {}).get("details", {}) or {}
    merged = {**current, **updates}
    sb.table("kanban_cards").update({"details": merged}).eq("id", card_id).execute()


def move_card_sync(card_id: str, column: str, sb):
    """Helper sync para mover card."""
    sb.table("kanban_cards").update({"column_id": column}).eq("id", card_id).execute()


def start_scheduler():
    scheduler.add_job(_run_due_tasks, "interval", minutes=1, id="due_tasks", replace_existing=True)

    # TEKA: verifica follow-ups a cada minuto
    scheduler.add_job(
        _teka_cron_followup,
        "interval",
        minutes=1,
        id="teka_followup_cron",
        replace_existing=True,
    )

    # PMO diário: verifica obras com prazo crítico às 08:00 São Paulo
    from app.core.pmo_alerter import check_and_alert_pmo
    scheduler.add_job(
        check_and_alert_pmo,
        "cron",
        hour=8,
        minute=0,
        id="pmo_daily_alert",
        replace_existing=True,
    )

    # Previsão de Obras: digest 30/60/90d + alertas individuais 7/15d
    # → grupos Fiscal e PMO. Roda 08:05 SP (5 min após o pmo_alerter).
    from app.core.previsao_obras_alerter import check_and_alert_previsao_obras
    scheduler.add_job(
        check_and_alert_previsao_obras,
        "cron",
        hour=8,
        minute=5,
        id="previsao_obras_daily_alert",
        replace_existing=True,
    )

    # Check Diário de Obras: gera checks e dispara WhatsApp pra todos os prestadores
    # das obras em acompanhamento. Roda 08:10 SP.
    # PAUSADO POR DECISÃO DO GESTOR — disparo agora é MANUAL via
    # POST /api/check-obras/disparar (botão no operacional). Pra reativar
    # o cron automático, defina env CHECK_DIARIO_AUTO_DISABLED=0.
    import os as _os_chk
    if _os_chk.getenv("CHECK_DIARIO_AUTO_DISABLED", "1") != "1":
        from app.core.check_diario_alerter import run_check_diario_diario
        scheduler.add_job(
            run_check_diario_diario,
            "cron",
            hour=8,
            minute=10,
            id="check_diario_daily",
            replace_existing=True,
        )
    else:
        logger.warning(
            "check_diario_daily_DISABLED_via_env",
            hint="manual only — POST /api/check-obras/disparar",
        )

    # Lembretes comerciais: verifica lembretes vencidos a cada minuto
    from app.core.lembrete_service import check_lembretes_vencidos
    scheduler.add_job(
        check_lembretes_vencidos,
        "interval",
        minutes=1,
        id="lembretes_comercial_cron",
        replace_existing=True,
    )

    # IA: notifica grupo quando novo card é criado no setor IA
    from app.core.ia_notifier import check_novos_cards_ia
    scheduler.add_job(
        check_novos_cards_ia,
        "interval",
        minutes=1,
        id="ia_new_card_notifier",
        replace_existing=True,
    )

    # Relatório diário TI: envia resumo às 21:00 São Paulo
    from app.core.daily_report import enviar_relatorio_diario
    scheduler.add_job(
        enviar_relatorio_diario,
        "cron",
        hour=21,
        minute=0,
        id="daily_report_ti",
        replace_existing=True,
    )

    # Forms Meta — relatório horário pros grupos Parket IA + Comercial
    # Conta leads chegados na última hora, lista 5 mais recentes, valida saúde
    from app.core.meta_lead_monitor import hourly_meta_lead_report
    scheduler.add_job(
        hourly_meta_lead_report,
        "cron",
        minute=0,                # de hora em hora cheia
        timezone="America/Sao_Paulo",
        id="meta_lead_hourly_report",
        replace_existing=True,
    )

    # Relatório diário do Funil Comercial de Entrada — DESATIVADO 2026-06-05 a pedido do Will.
    # Será substituído por novo relatório com dados do Homebroker (Teca agendamentos + SDR + performance).
    # Pra reativar provisoriamente: descomente o bloco abaixo.
    # from app.core.relatorio_comercial import enviar_relatorio_comercial
    # scheduler.add_job(
    #     enviar_relatorio_comercial,
    #     "cron",
    #     hour=21, minute=0, timezone="America/Sao_Paulo",
    #     id="relatorio_comercial_diario",
    #     replace_existing=True,
    # )
    # Remove explicitamente o job se já estava agendado (após restart com versão anterior)
    try:
        scheduler.remove_job("relatorio_comercial_diario")
    except Exception:
        pass

    # Relatório Comercial Homebroker — 21h SP, 3 mensagens (Teca / SDR / Performance)
    from app.core.relatorio_comercial_hb import enviar_relatorio_comercial_hb
    scheduler.add_job(
        enviar_relatorio_comercial_hb,
        "cron",
        hour=21, minute=0, timezone="America/Sao_Paulo",
        id="relatorio_comercial_hb",
        replace_existing=True,
    )

    # Relatório diário de Compras: 21:00 SP — um fechamento por board (Ronaldo/Taiara/Marco)
    # gerado pelo agente do squad configurado no grupo WhatsApp de Compras.
    from app.core.relatorio_compras import enviar_relatorio_compras
    scheduler.add_job(
        enviar_relatorio_compras,
        "cron",
        hour=21,
        minute=0,
        timezone="America/Sao_Paulo",
        id="relatorio_compras_diario",
        replace_existing=True,
    )

    # Relatório diário de Projetos: 21:00 SP — macro+micro por membro,
    # gerado pelo Agente Projetos do squad no grupo WhatsApp de Projetos.
    from app.core.relatorio_projetos import enviar_relatorio_projetos
    scheduler.add_job(
        enviar_relatorio_projetos,
        "cron",
        hour=21,
        minute=0,
        timezone="America/Sao_Paulo",
        id="relatorio_projetos_diario",
        replace_existing=True,
    )

    # Relatório diário do PMO (Acompanhamento de Obras): 21:00 SP no grupo
    # 📋 Parket - PMO. Texto determinístico — só dados reais do Supabase
    # (kanban_cards.dept_id='produtividade' / details.cronograma_pmo) com
    # farol verde/amarelo/vermelho/cinza por obra.
    from app.core.relatorio_pmo import enviar_relatorio_pmo
    scheduler.add_job(
        enviar_relatorio_pmo,
        "cron",
        hour=21,
        minute=0,
        timezone="America/Sao_Paulo",
        id="relatorio_pmo_diario",
        replace_existing=True,
    )

    # Alerta PMO: serviços com status `travado` ou `nao_liberado` no kanban
    # disparam notificação no grupo Parket - PMO. Roda a cada 5 min e usa
    # Redis (TTL 7d) para garantir que cada item só seja avisado uma vez.
    from app.core.pmo_travado_alerter import check_pmo_travado
    scheduler.add_job(
        check_pmo_travado,
        "interval",
        minutes=5,
        id="pmo_travado_alerter",
        replace_existing=True,
    )

    # Saúde das contas IA: notifica o grupo Squad Parket IA quando uma conta
    # Claude/Gemini/OpenAI cai (is_healthy: True → False) ou volta. Roda 1×/min.
    from app.core.account_health_alerter import check_account_health
    scheduler.add_job(
        check_account_health,
        "interval",
        minutes=1,
        id="account_health_alerter",
        replace_existing=True,
    )

    # Gestão Douglas + Orçamentos: 1 mensagem/dia às 21:00 SP com volume
    # de orçamentos (por pessoa), leads novos e oportunidades. Substitui o
    # antigo gestao_relay_scan (que mandava notificação de cada card a cada 5min).
    from app.core.relatorio_gestao_orcamento import enviar_relatorio_gestao_orcamento
    scheduler.add_job(
        enviar_relatorio_gestao_orcamento,
        "cron",
        hour=21,
        minute=0,
        timezone="America/Sao_Paulo",
        id="relatorio_gestao_orcamento_diario",
        replace_existing=True,
    )

    # Fiscal: agenda do dia (07:00 SP) — único envio diário. Manda no grupo
    # de cada fiscal (Alvaro / Davi / Cristiano) os agendamentos de HOJE.
    # Pula fiscal sem grupo configurado ou sem visitas. Mudanças posteriores
    # (cancelamento, troca de horário) caem no fiscal_agenda_changes alerter.
    from app.core.fiscal_agenda_alerter import enviar_agenda_hoje_fiscal, enviar_status_dia_fiscal
    scheduler.add_job(
        enviar_agenda_hoje_fiscal,
        "cron",
        hour=7,
        minute=0,
        timezone="America/Sao_Paulo",
        id="fiscal_agenda_hoje",
        replace_existing=True,
    )
    # Fiscal: fechamento do dia (18:00 SP) — recap. Lista cada visita
    # agendada de hoje com status (✅ concluída / 🟡 em andamento / ⏳ iniciada
    # / ❌ não feita / 🚫 cancelada) baseado em fiscal_laudos.
    scheduler.add_job(
        enviar_status_dia_fiscal,
        "cron",
        hour=18,
        minute=0,
        timezone="America/Sao_Paulo",
        id="fiscal_status_dia",
        replace_existing=True,
    )
    # Fiscal: alterações na agenda — roda a cada 2 min, detecta mudanças
    # em fiscal_agenda (cancelamento, hora, tipo, notas) e avisa o grupo
    # do fiscal responsável. Snapshot em Redis pra evitar duplicar.
    from app.core.fiscal_agenda_changes_alerter import check_fiscal_agenda_changes
    scheduler.add_job(
        check_fiscal_agenda_changes,
        "interval",
        minutes=2,
        id="fiscal_agenda_changes",
        replace_existing=True,
    )
    # CS Alertas — grupo 🎧 Parket - Atendimento:
    # - cliente esperando >1h (com sugestão IA)
    # - promessa nossa não cumprida >4h ("vou conferir/verificar/retorno")
    from app.core.cs_alertas_atendimento import check_cs_alertas
    scheduler.add_job(
        check_cs_alertas,
        "interval",
        minutes=10,
        id="cs_alertas_atendimento",
        replace_existing=True,
    )
    # Cronograma: card que entra em operacional/obras-liberadas cria linha
    # automática em cronograma_obras preenchendo campos derivados.
    from app.core.cronograma_auto_inserter import auto_inserir_cronograma
    scheduler.add_job(
        auto_inserir_cronograma,
        "interval",
        minutes=5,
        id="cronograma_auto_inserter",
        replace_existing=True,
    )
    # Relatório diário 19:00 SP — resumo dos grupos de atendimento pro
    # PMO + Gestão Douglas (caóticos, em aberto, sem resposta, fluindo bem)
    from app.core.relatorio_diario_atendimento import enviar_relatorio_diario_atendimento
    scheduler.add_job(
        enviar_relatorio_diario_atendimento,
        "cron",
        hour=19,
        minute=0,
        timezone="America/Sao_Paulo",
        id="relatorio_diario_atendimento",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("task_scheduler_started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("task_scheduler_stopped")
