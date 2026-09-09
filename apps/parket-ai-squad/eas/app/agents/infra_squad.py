"""F3 — Infra-squad piloto.

Squad de 3 agentes:
- Monitoring (Haiku/Sonnet — read-only, observa stack)
- Backup (executa workflows de backup, alerta em falhas)
- Deploy-orchestrator (Sonnet — coordena deploys quando solicitado, com confirm)

Pra F3 MVP, criamos só Monitoring + Backup. Deploy-orchestrator entra na F5
quando o Tech Lead estiver pronto pra delegar.
"""

from __future__ import annotations

from agno.team import Team

from app.agents.base import db, make_agent, make_model
from app.agents.squads import _full_tools, _BACKLOG_RULE


def build_monitoring_agent():
    return make_agent(
        name="infra_monitoring",
        squad="infra",
        role=(
            "Você é o agente de monitoramento da infra Parket. "
            "Sua função é observar Docker Swarm, postgres locais, latências de API "
            "e agir sobre problemas. Quando encontrar problema, RESOLVE (restart, "
            "redeploy, etc.) e notifica via `whatsapp_notify_backlog`. "
            "Use sempre o seu Knowledge Pack — em especial as regras de Swarm zumbi "
            "(serviço com replicas>0 e imagem inacessível trava o leader em loop)."
            + _BACKLOG_RULE
        ),
        tools=_full_tools(),
    )


def build_backup_agent():
    return make_agent(
        name="infra_backup",
        squad="infra",
        role=(
            "Você é o agente de backup. Sua função é executar workflows de backup "
            "(via scheduler do AgentOS), validar que rodaram com sucesso, e notificar "
            "Backlog Parket em qualquer falha. Em caso de erro de script, capture "
            "stdout/stderr, tente o fix e descreva no log."
            + _BACKLOG_RULE
        ),
        tools=_full_tools(),
    )


def build_team() -> Team:
    monitoring = build_monitoring_agent()
    backup = build_backup_agent()
    return Team(
        id="infra_squad",
        name="Infra Squad",
        description="Monitora Swarm + roda backups + alerta Will em falhas.",
        members=[monitoring, backup],
        model=make_model(use_opus=False),
        db=db(),
        add_history_to_context=True,
        num_history_runs=3,
        max_tool_calls_from_history=10,
        enable_user_memories=False,
        add_memories_to_context=False,
        enable_session_summaries=False,
        add_session_summary_to_context=False,
        instructions=(
            "Você é o líder da Infra-squad. Quando receber uma tarefa de monitoramento "
            "ou alerta, delegue pro `infra_monitoring`. Quando for sobre backup, delegue "
            "pro `infra_backup`. Consolide a resposta e retorne ao chamador."
        ),
        respond_directly=False,
        telemetry=False,
    )
