"""F8b — Workflows proativos: dispara monitors/healers em schedule.

4 workflows:
- draw_monitor_sweep (30min): chama draw_monitor pra sweep saúde
- draw_healer_sweep (60min): chama draw_healer pra fix proativo de padrões conhecidos
- orcamento_monitor_sweep (30min): chama orcamento_monitor
- orcamento_healer_sweep (60min): chama orcamento_healer

Cada workflow:
1. Build do agent
2. Run com prompt fixo de sweep
3. Agent usa notify_backlog automaticamente (regra na role)
4. Log_atividade pra rastreabilidade

Cron registrado em PROACTIVE_CRONS dict (lido pelo schedule_init em main.py).
"""

from __future__ import annotations

import structlog
from agno.workflow import Step, Workflow

from app.tools.handoff import log_atividade
from app.tools.whatsapp_evolution import notify_backlog_impl

log = structlog.get_logger()


# ============================================================
# Prompts fixos por agente
# ============================================================

_DRAW_MONITOR_PROMPT = (
    "Faça um SWEEP COMPLETO de saúde do Draw Parket. Rode TODOS os 9 checks da sua role:\n"
    "1. draw.parket.works HTTP 200\n"
    "2. Container parket-dashboard_dashboard Up + healthy\n"
    "3. Supabase drawparket acessível (kstldkfhoiqepmuqmcmq)\n"
    "4. Chunks JS md5 patches/ vs container\n"
    "5. Sessões CAD persistindo\n"
    "6. Status → Wood handoff endpoint\n"
    "7. Container logs por warnings de mem leak\n"
    "8. CODE_VERSION divergente em chunks críticos\n"
    "9. drawBackgroundImage preservado no save\n\n"
    "Compile relatório ✅/⚠️/🔴 e poste no Backlog Parket via whatsapp_notify_backlog. "
    "Se achar padrão conhecido, sugira handoff pro draw_healer no relatório."
)

_DRAW_HEALER_PROMPT = (
    "Faça sweep proativo de fixes conhecidos no Draw. Sem esperar alerta — verifique "
    "padrões frequentes e aplique recipe se confirmar:\n"
    "1. CHUNK_DIVERGENTE: md5 patches/ vs container pros chunks ativos. Se diff: deploy.\n"
    "2. CONTAINER_DOWN: parket-dashboard_dashboard Up?\n"
    "3. Se nenhum padrão match: poste no Backlog '✅ Draw saudável, nada a corrigir'.\n\n"
    "Quando aplicar fix, valide com http_check + md5_in_container e poste resultado completo "
    "(problema + recipe aplicada + evidência) via whatsapp_notify_backlog."
)

_ORC_MONITOR_PROMPT = (
    "Faça um SWEEP COMPLETO de saúde do Orçamento. Rode TODOS os 8 checks da sua role:\n"
    "1. Propostas com valor zero últimas 24h\n"
    "2. Dupla cobrança suspeita (linha INSUMOS+INSTALAÇÃO+PRODUTO > m²×catálogo×1.1)\n"
    "3. Sync cron 1min Local→Cloud (alerta se >5min atrasado)\n"
    "4. Replicação Cloud→Local (subscription parket_de_cloud ativa?)\n"
    "5. Itens não gravados (proposta com 0 simulacao_itens — bug #704 padrão)\n"
    "6. CODE_VERSION divergente (md5 patches/ vs container)\n"
    "7. Healthcheck diário 07h rodou (log em /root/.health-orcamento/)\n"
    "8. Containers críticos (parket-dashboard, parket-valoria) Up\n\n"
    "Compile relatório ✅/⚠️/🔴 e poste no Backlog Parket via whatsapp_notify_backlog. "
    "Se padrão conhecido, sugira handoff pro orcamento_healer."
)

_ORC_HEALER_PROMPT = (
    "Faça sweep proativo de fixes conhecidos no Orçamento. Verifique padrões frequentes "
    "e aplique recipe se confirmar:\n"
    "1. ZERO_VALOR: propostas com valor=0 — restore PITR se padrão #704\n"
    "2. DUPLA_COBRANCA: __mergeInsumosInstalacao__ ativo no chunk em prod?\n"
    "3. SYNC_DOWN: cron 1min rodando?\n"
    "4. SUBSCRIPTION_PARKET_DE_CLOUD: slot ativo? Replication lag baixo?\n"
    "5. CONTAINER_DOWN: serviços críticos?\n"
    "6. MD5_DIVERGENTE: chunks ativos coerentes?\n"
    "7. Se nenhum padrão match: poste '✅ Orçamento saudável, nada a corrigir'.\n\n"
    "Quando aplicar fix, valide e poste resultado completo via whatsapp_notify_backlog."
)

_HB_MONITOR_PROMPT = (
    "Faça SWEEP COMPLETO de saúde do setor Comercial. Rode TODOS os 10 checks da sua role:\n"
    "1. parket-homebroker_web Up + HTTP 200 em homebroker.parket.works\n"
    "2. Cards travados em em-qualificacao > 7 dias sem updated_at\n"
    "3. Cards em comercial-entrada > 48h sem contato (Teca falhou?)\n"
    "4. Teca V2: container parket-rh-api + Evolution conectada (TECA_V2_FORCE_ALL=1)\n"
    "5. Evolution status anômalo últimas 1h em whatsapp_messages\n"
    "6. Wavoip parket-wavoip_api respondendo /health\n"
    "7. whatsapp_messages parou de crescer em horário comercial (>30min sem insert)\n"
    "8. notificacoes pendentes (lida=false) > 100 por user\n"
    "9. Site form /_legacy/ responde + Pixel handler registrado\n"
    "10. Containers críticos do stack comercial Up\n\n"
    "Compile relatório ✅/⚠️/🔴 e poste no Backlog Parket via whatsapp_notify_backlog. "
    "Se padrão conhecido, sugira handoff pro homebroker_healer."
)

_HB_HEALER_PROMPT = (
    "Faça sweep proativo de fixes conhecidos no setor Comercial. Verifique padrões "
    "frequentes e aplique recipe se confirmar:\n"
    "1. CARD_TRAVADO: cards estourando SLA — alertar SDR (NÃO mover sozinho)\n"
    "2. TECA_DOWN: parket-rh-api zumbi? force update\n"
    "3. EVOLUTION_ERROR: rate limit? backoff. instância desconectada? alertar Will\n"
    "4. WAVOIP_DOWN: parket-wavoip_api Pending? update --image stable\n"
    "5. PIXEL_SILENCIOSO: form responde? handler registrado?\n"
    "6. HOMEBROKER_DOWN: container Pending/OOM? aumentar limit/rollback\n"
    "7. Se nenhum padrão match: poste '✅ Comercial saudável, nada a corrigir'.\n\n"
    "Quando aplicar fix, valide com smoke + http_check e poste resultado completo "
    "via whatsapp_notify_backlog. Conservador — prefere rollback a fix incerto."
)

_GESTAO_MONITOR_PROMPT = (
    "Faça SWEEP COMPLETO de saúde da Gestão & Obras. Rode TODOS os 9 checks da sua role:\n"
    "1. parket-gestao Up + HTTP 200 em gestao.parket.works\n"
    "2. PROJETO ÓRFÃO: contratos_docusign assinado sem linha em gestao.projetos\n"
    "3. ETAPA TRAVADA: projeto_etapas em andamento sem evento novo > 14 dias\n"
    "4. ITEM SEM RESPONSÁVEL: gestao.itens em execução com responsavel NULL\n"
    "5. TIMELINE PAROU: gestao.eventos sem insert > 48h úteis\n"
    "6. Dashboard /obras e /operacional: chunks ativos + HTTP 200\n"
    "7. kanban_cards obras/projetos com SLA estourado\n"
    "8. parket-pg-local: schema gestao acessível\n"
    "9. PostgREST local respondendo (api.parket.works /rest/v1)\n\n"
    "Compile relatório ✅/⚠️/🔴 e poste no Backlog Parket via whatsapp_notify_backlog. "
    "Se padrão conhecido, sugira handoff pro gestao_healer."
)

_GESTAO_HEALER_PROMPT = (
    "Faça sweep proativo de fixes conhecidos na Gestão & Obras. Verifique padrões "
    "frequentes e aplique recipe se confirmar:\n"
    "1. GESTAO_DOWN: container Complete/zumbi? docker service update --force\n"
    "2. PROJETO_ORFAO: contrato assinado sem projeto? RPC projetar_de_proposta (idempotente)\n"
    "3. POSTGREST_STALE: GET []/200 após DDL? restart parket-pg-rest_rest-local\n"
    "4. ETAPA_TRAVADA/SLA: NÃO mover nada — só listar no Backlog\n"
    "5. CHUNK_DIVERGENTE (/obras, /operacional): reportar pro lead ANTES de deployar\n"
    "6. Se nenhum padrão match: poste '✅ Gestão & Obras saudável, nada a corrigir'.\n\n"
    "Quando aplicar fix, valide com http_check e poste resultado completo via "
    "whatsapp_notify_backlog. Conservador — NUNCA avance etapa ou mova card sozinho."
)


# ============================================================
# Builder genérico
# ============================================================

def _build_agent_runner(agent_factory, prompt: str, label: str, setor: str = "Engenharia"):
    """Factory de step que chama um agent com prompt fixo."""
    def _execute(step_input):
        log.info("proactive sweep started", agent=label)
        try:
            agent = agent_factory()
            result = agent.run(prompt)
            response = getattr(result, "content", None) or str(result)
            response = response[:2000]  # cap
            log_atividade.entrypoint(
                titulo=f"EAS — sweep {label}",
                descricao=f"Proactive sweep executado. Output preview: {response[:500]}",
                setor=setor,
                categoria="config",
            )
            return {"ok": True, "agent": label, "preview": response[:300]}
        except Exception as exc:  # noqa: BLE001
            err = str(exc)[:500]
            log.error("proactive sweep failed", agent=label, error=err)
            try:
                notify_backlog_impl(f"🚨 *EAS — proactive sweep falhou*\n\n*Agente:* {label}\n*Erro:* {err}")
            except Exception:
                pass
            return {"ok": False, "agent": label, "error": err}
    return _execute


# ============================================================
# Workflows
# ============================================================

def build_workflows() -> dict[str, Workflow]:
    """Retorna dict {name: Workflow} dos 6 proativos (Draw, Orçamento, Homebroker)."""
    from app.agents.draw_studio import build_draw_monitor, build_draw_healer
    from app.agents.orcamento_studio import build_orc_monitor, build_orc_healer
    from app.agents.homebroker_studio import build_hb_monitor, build_hb_healer
    from app.agents.gestao_studio import build_gestao_monitor, build_gestao_healer

    return {
        "draw_monitor_sweep": Workflow(
            name="draw_monitor_sweep",
            description="Sweep periódico do draw_monitor (saúde Draw Parket).",
            steps=[Step(name="run", executor=_build_agent_runner(
                build_draw_monitor, _DRAW_MONITOR_PROMPT, "draw_monitor"
            ))],
        ),
        "draw_healer_sweep": Workflow(
            name="draw_healer_sweep",
            description="Sweep periódico do draw_healer (fix proativo Draw).",
            steps=[Step(name="run", executor=_build_agent_runner(
                build_draw_healer, _DRAW_HEALER_PROMPT, "draw_healer"
            ))],
        ),
        "orcamento_monitor_sweep": Workflow(
            name="orcamento_monitor_sweep",
            description="Sweep periódico do orcamento_monitor (saúde Orçamento).",
            steps=[Step(name="run", executor=_build_agent_runner(
                build_orc_monitor, _ORC_MONITOR_PROMPT, "orcamento_monitor"
            ))],
        ),
        "orcamento_healer_sweep": Workflow(
            name="orcamento_healer_sweep",
            description="Sweep periódico do orcamento_healer (fix proativo Orçamento).",
            steps=[Step(name="run", executor=_build_agent_runner(
                build_orc_healer, _ORC_HEALER_PROMPT, "orcamento_healer"
            ))],
        ),
        "homebroker_monitor_sweep": Workflow(
            name="homebroker_monitor_sweep",
            description="Sweep periódico do homebroker_monitor (saúde setor Comercial).",
            steps=[Step(name="run", executor=_build_agent_runner(
                build_hb_monitor, _HB_MONITOR_PROMPT, "homebroker_monitor", "Comercial"
            ))],
        ),
        "homebroker_healer_sweep": Workflow(
            name="homebroker_healer_sweep",
            description="Sweep periódico do homebroker_healer (fix proativo setor Comercial).",
            steps=[Step(name="run", executor=_build_agent_runner(
                build_hb_healer, _HB_HEALER_PROMPT, "homebroker_healer", "Comercial"
            ))],
        ),
        "gestao_monitor_sweep": Workflow(
            name="gestao_monitor_sweep",
            description="Sweep periódico do gestao_monitor (saúde Gestão & Obras).",
            steps=[Step(name="run", executor=_build_agent_runner(
                build_gestao_monitor, _GESTAO_MONITOR_PROMPT, "gestao_monitor", "Operacional"
            ))],
        ),
        "gestao_healer_sweep": Workflow(
            name="gestao_healer_sweep",
            description="Sweep periódico do gestao_healer (fix proativo Gestão & Obras).",
            steps=[Step(name="run", executor=_build_agent_runner(
                build_gestao_healer, _GESTAO_HEALER_PROMPT, "gestao_healer", "Operacional"
            ))],
        ),
    }


# Mapa nome → cron (registrado no schedule_init)
PROACTIVE_CRONS = {
    "draw_monitor_sweep": "*/30 * * * *",       # a cada 30min
    "draw_healer_sweep": "15 * * * *",          # toda hora aos :15
    "orcamento_monitor_sweep": "*/30 * * * *",  # a cada 30min
    "orcamento_healer_sweep": "45 * * * *",     # toda hora aos :45
    "homebroker_monitor_sweep": "*/30 * * * *", # a cada 30min
    "homebroker_healer_sweep": "20 * * * *",    # toda hora aos :20
    "gestao_monitor_sweep": "*/30 * * * *",     # a cada 30min
    "gestao_healer_sweep": "35 * * * *",        # toda hora aos :35
}
