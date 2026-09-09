"""F5 — Tech Lead + Engineering Team coordenador.

Tech Lead é um agente Opus 4.7 que:
- Recebe pedidos em linguagem natural
- Roteia pra squad certa (via Team mode=coordinate)
- Consolida output das squads
- Loga atividade

Engineering Team é o Team raiz que tem o Tech Lead + as 7 squads como sub-times.
"""

from __future__ import annotations

from agno.team import Team

from app.agents.base import db, make_agent, make_model
from app.agents.infra_squad import build_team as build_infra_team
from app.agents.squads import (
    build_api_squad,
    build_dashboard_squad,
    build_proposta_render_squad,
    build_setor_apps_squad,
    build_space_v2_squad,
    build_whatsapp_squad,
)
from app.tools import handoff, kanban, whatsapp_evolution
from app.agents.squads import _BACKLOG_RULE


def build_tech_lead():
    return make_agent(
        name="tech_lead",
        squad="global",  # Tech Lead lê só globais; sub-squads têm packs próprios
        role=(
            "Você é o *Tech Lead* do EAS — orquestrador de engenharia Parket. Recebe "
            "tarefas em linguagem natural (do Will via Kanban/WhatsApp) e decide pra "
            "qual squad delegar. Squads disponíveis: dashboard (Space golden, hotpatches), "
            "proposta_render (V12FIX), space_v2 (rebuild Vite), api (gateway+pg), whatsapp "
            "(Evolution/Teca), setor_apps (RH/Fiscal/CS/etc), infra (Swarm/backup/replicação). "
            "\n\nPriorize ESCOPO MÍNIMO: nunca delegue refactors voluntários. Se a tarefa toca "
            "Dashboard ou Proposta-render, lembre da regra hotpatch (golden = prod). Antes de "
            "fechar, consolide e use `log_atividade` com categoria correta."
            + _BACKLOG_RULE
        ),
        tools=[
            handoff.log_atividade, handoff.delegate_to_squad,
            kanban.atividades_recentes, kanban.cards_pendentes,
            whatsapp_evolution.notify_backlog,
        ],
        use_opus=True,  # Opus 4.7 pra planejamento
    )


def build_engineering_team() -> Team:
    """Team raiz: Tech Lead + 7 squads como members.

    Mode 'coordinate' (default): Tech Lead delega via `delegate_task_to_member`
    e consolida.
    """
    tech_lead = build_tech_lead()
    return Team(
        id="engineering",
        name="Parket Engineering",
        description="Tech Lead Opus 4.7 + 7 squads (dashboard, proposta, space_v2, api, whatsapp, setor_apps, infra).",
        members=[
            tech_lead,
            build_dashboard_squad(),
            build_proposta_render_squad(),
            build_space_v2_squad(),
            build_api_squad(),
            build_whatsapp_squad(),
            build_setor_apps_squad(),
            build_infra_team(),
        ],
        model=make_model(use_opus=True),
        db=db(),
        add_history_to_context=True,
        num_history_runs=3,
        max_tool_calls_from_history=10,
        add_team_history_to_members=False,
        enable_user_memories=False,
        add_memories_to_context=False,
        enable_session_summaries=False,
        add_session_summary_to_context=False,
        instructions=(
            "Você é o orquestrador da equipe de engenharia EAS. Receba pedidos do Will, "
            "delegue pra squad apropriada via `delegate_task_to_member` e consolide as respostas. "
            "Em dúvida sobre escopo, pergunte antes de delegar. Logue em `log_atividade` ao fechar."
        ),
        respond_directly=False,
        telemetry=False,
    )
