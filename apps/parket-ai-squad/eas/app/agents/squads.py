"""F4 — Squads especialistas (Dashboard, Proposta, Space-v2, API, WhatsApp, Setor-apps).

Cada squad é um Team com 1 agente especializado. Toolset full por padrão —
filtros por superfície de código ficam na role/instructions, não na lista de tools.
"""

from __future__ import annotations

from agno.team import Team

from app.agents.base import db, make_agent, make_model
from app.tools import (
    claude_skills,
    deploy,
    docker_ops,
    git_ops,
    handoff,
    kanban,
    opencode_sandbox,
    supabase_admin,
    teca_nucleo,
    testbed,
    whatsapp_evolution,
)


# Toolset completo — toda squad recebe o mesmo. Diferenciação fica na role.
def _full_tools() -> list:
    return [
        # Docker (read + write, sem confirmação)
        docker_ops.list_services, docker_ops.inspect_service, docker_ops.service_ps,
        docker_ops.container_logs, docker_ops.exec_read,
        docker_ops.service_update, docker_ops.service_scale, docker_ops.exec_write,
        # Git
        git_ops.git_status, git_ops.git_diff, git_ops.git_log, git_ops.current_branch,
        git_ops.git_add, git_ops.git_commit, git_ops.git_push,
        # Opencode (editar source + shell)
        opencode_sandbox.edit_file_in_place, opencode_sandbox.run_shell_in_repo,
        # Deploy
        deploy.deploy_dashboard, deploy.deploy_eas, deploy.run_script,
        # Supabase
        supabase_admin.cloud_sql_read, supabase_admin.cloud_sql_ddl,
        supabase_admin.local_sql_read, supabase_admin.mgmt_get,
        # Testbed
        testbed.http_check, testbed.md5_local, testbed.md5_in_container,
        testbed.compare_md5, testbed.node_check, testbed.playwright_screenshot,
        # WhatsApp — só notify_backlog (sem notify_will: agente não pede aprovação,
        # só registra execução no grupo Backlog Parket)
        whatsapp_evolution.whatsapp_send,
        whatsapp_evolution.notify_backlog,
        # Kanban
        kanban.count_cards_by_column, kanban.cards_pendentes, kanban.atividades_recentes,
        # Teca Núcleo (grafo mapeado, notas, Pulsar, aprendizados)
        *teca_nucleo.ALL_TOOLS,
        # Skills (MDs de memória do terminal — design system, deploy, armadilhas)
        *claude_skills.ALL_TOOLS,
    ]


_BACKLOG_RULE = (
    "\n\n## REGRA OPERACIONAL — EXECUÇÃO DIRETA\n"
    "Você tem permissão TOTAL de execução. NUNCA peça confirmação ao Will. NUNCA "
    "use `whatsapp_send` pra mandar mensagem direta pro número 5511939213329 (Will). "
    "NUNCA escreva no chat 'aguardo sua aprovação', 'confirma?', 'autoriza?', etc. — "
    "execute direto.\n\n"
    "## NOTIFICAÇÃO BACKLOG PARKET — UMA SÓ POR TAREFA\n"
    "Chame `whatsapp_notify_backlog` UMA ÚNICA VEZ ao FINAL da tarefa inteira (NUNCA "
    "no meio, NUNCA por tool individual, NUNCA pra log de passo intermediário).\n\n"
    "Formato da mensagem:\n"
    "• *Pedido:* (1 linha do que o Will pediu)\n"
    "• *Feito:* (1-3 bullets do que foi entregue)\n"
    "• *Resultado:* OK/falhou + 1 evidência curta (container Up, HTTP 200, md5 X)\n\n"
    "Se a tarefa for só leitura/diagnóstico sem alteração, ainda assim notifique 1× "
    "ao final com o achado.\n\n"
    "É fire-and-forget pro grupo Backlog Parket — não responde, não espera, não bloqueia."
    "\n\n## SKILLS E NÚCLEO TECA — CONSULTAR E FECHAR O LOOP\n"
    "ANTES de mexer em layout/UI, deploy ou área que não domina: rode `skills_listar` "
    "com um filtro do tema e leia a skill relevante com `skill_ler` (ex: layout → "
    "'project_so_parket_design_system'). São regras validadas em produção — seguir à risca.\n"
    "Pra contexto de dados/processos da empresa, use `teca_buscar` no Núcleo.\n\n"
    "AO CONCLUIR trabalho relevante (fix, feature, causa raiz, padrão repetitivo), "
    "registre 1 aprendizado via `teca_aprendizado_criar` (app correto, categoria "
    "erro|acerto|melhoria|automacao|padrao_repetitivo). Se detectar algo acionável que o "
    "time precisa ACOMPANHAR (gargalo, anomalia, risco, oportunidade), crie/atualize um "
    "insight no Pulsar via `teca_insight_criar` com slug estável `eas:<tema>` — reuse o "
    "slug, não duplique. Diagnóstico trivial não precisa."
)


# ============================================================
# Dashboard squad
# ============================================================

def build_dashboard_squad() -> Team:
    agent = make_agent(
        name="dashboard_agent",
        squad="dashboard",
        role=(
            "Você é o agente do Dashboard Parket. Cobre Space (golden-complete) + Draw + Proposta-render. "
            "REGRA INVIOLÁVEL: golden é produção. Mudanças SÓ via hotpatch flow (sync container → "
            "edit em patches/ → build → /root/deploy-dashboard.sh). Antes de editar patches/<arquivo>.js, "
            "SEMPRE docker cp do container em prod. Pós-deploy: md5 check + smoke test obrigatórios."
            + _BACKLOG_RULE
        ),
        tools=_full_tools(),
    )
    return Team(
        id="dashboard_squad", name="Dashboard Squad",
        description="Space golden + hotpatches via deploy-dashboard.sh.",
        members=[agent], model=make_model(use_opus=False), db=db(),
        add_history_to_context=True, num_history_runs=3, max_tool_calls_from_history=10, enable_user_memories=False, enable_session_summaries=False,
        instructions="Aplica hotpatches no Dashboard seguindo o playbook. Notifica Backlog Parket no fim.",
        respond_directly=False, telemetry=False,
    )


# ============================================================
# Proposta-render squad
# ============================================================

def build_proposta_render_squad() -> Team:
    agent = make_agent(
        name="proposta_render_agent",
        squad="proposta",
        role=(
            "Você cuida do renderer público de propostas (proposta.parket.works). Files-chave: "
            "proposta-publica-page-V*FIX.js e propostaGenerator-PGSTRUCT*.js. SEMPRE preservar regra "
            "&v=<timestamp> nos links (OG preview WhatsApp). Hotpatches via mesmo flow do Dashboard."
            + _BACKLOG_RULE
        ),
        tools=_full_tools(),
    )
    return Team(
        id="proposta_render_squad", name="Proposta Render Squad",
        description="Renderer V12FIX + propostaGenerator PGSTRUCTxx.",
        members=[agent], model=make_model(use_opus=False), db=db(),
        add_history_to_context=True, num_history_runs=3, max_tool_calls_from_history=10, enable_user_memories=False, enable_session_summaries=False,
        instructions="Renderer de proposta. Preserve OG preview. Smoke test via Playwright pra cada deploy.",
        respond_directly=False, telemetry=False,
    )


# ============================================================
# Space-v2 squad
# ============================================================

def build_space_v2_squad() -> Team:
    agent = make_agent(
        name="space_v2_agent",
        squad="space_v2",
        role=(
            "Você é o agente do rebuild Space v2 (Vite+React+TS). Repo: /root/space-navona-v2/. "
            "Tema Navona (Bege Travertino #D8D3C7 + Preto #050505 + Cinza Pedra #77736A). "
            "Deploy direto via sistema de staging do Space. Phase 3 atual: portar simulador/PDF/WhatsApp/ClickSign."
            + _BACKLOG_RULE
        ),
        tools=_full_tools(),
    )
    return Team(
        id="space_v2_squad", name="Space v2 Squad",
        description="Rebuild Figma do Space (Vite+React) — space.parket.works/v2/.",
        members=[agent], model=make_model(use_opus=False), db=db(),
        add_history_to_context=True, num_history_runs=3, max_tool_calls_from_history=10, enable_user_memories=False, enable_session_summaries=False,
        instructions="Trabalha em /root/space-navona-v2/. Respeite tokens Navona. Phase 3 = portar módulos faltantes.",
        respond_directly=False, telemetry=False,
    )


# ============================================================
# API squad
# ============================================================

def build_api_squad() -> Team:
    agent = make_agent(
        name="api_agent",
        squad="api",
        role=(
            "Você cuida da camada API (parket-api: gateway nginx + GoTrue + PostgREST) e "
            "dos postgres locais (parket-pg, parket-pg-local, replicação). REGRA: pra editar "
            "nginx config use `docker exec cat` + tee, NUNCA `docker cp` (causa segfault). "
            "Replicação local é espelho — read-only."
            + _BACKLOG_RULE
        ),
        tools=_full_tools(),
    )
    return Team(
        id="api_squad", name="API Squad",
        description="Gateway + GoTrue + PostgREST + replicação postgres.",
        members=[agent], model=make_model(use_opus=False), db=db(),
        add_history_to_context=True, num_history_runs=3, max_tool_calls_from_history=10, enable_user_memories=False, enable_session_summaries=False,
        instructions="Editar nginx sempre via exec+tee. CORS multi-nivel: trocar (?) por (*).",
        respond_directly=False, telemetry=False,
    )


# ============================================================
# WhatsApp squad
# ============================================================

def build_whatsapp_squad() -> Team:
    agent = make_agent(
        name="whatsapp_agent",
        squad="whatsapp",
        role=(
            "Você gerencia o ecossistema WhatsApp Parket: Evolution API (3 instâncias: Parket, "
            "Comercial-Parket, Secretaria), Teca V2 (conversational+cortex), Wavoip (voip), "
            "Homebroker. REGRA TÉCNICA: em teste de produção, destinatário SEMPRE é Will "
            "(5511939213329), NUNCA lead real. NÃO peça aprovação pra mass-send — execute e "
            "registre no Backlog Parket."
            + _BACKLOG_RULE
        ),
        tools=_full_tools(),
    )
    return Team(
        id="whatsapp_squad", name="WhatsApp Squad",
        description="Evolution + Teca V2 + Wavoip + Homebroker.",
        members=[agent], model=make_model(use_opus=False), db=db(),
        add_history_to_context=True, num_history_runs=3, max_tool_calls_from_history=10, enable_user_memories=False, enable_session_summaries=False,
        instructions="Em teste: sempre número do Will. Logs Teca → V2 path nunca atualiza teka_ultima_msg (bug conhecido).",
        respond_directly=False, telemetry=False,
    )


# ============================================================
# Setor-apps squad
# ============================================================

def build_setor_apps_squad() -> Team:
    agent = make_agent(
        name="setor_apps_agent",
        squad="setor_apps",
        role=(
            "Você cuida dos apps de setor: parket-rh (+ rh-api), parket-fiscal, parket-cs, "
            "parket-instala, parket-cronograma, parket-valoria, parket-docusign, parket-emergency. "
            "Cada um tem seu próprio repo + deploy. Lembretes: RH-Clicksign usa N tokens por empresa "
            "(clicksign_contas), Fiscal NÃO libera pagamento (Produtividade/Natália faz), "
            "Valoria-bridge insere em simulacao_projetos/itens do Parket."
            + _BACKLOG_RULE
        ),
        tools=_full_tools(),
    )
    return Team(
        id="setor_apps_squad", name="Setor Apps Squad",
        description="RH, Fiscal, CS, Instala, Cronograma, Valoria, DocuSign, Emergency.",
        members=[agent], model=make_model(use_opus=False), db=db(),
        add_history_to_context=True, num_history_runs=3, max_tool_calls_from_history=10, enable_user_memories=False, enable_session_summaries=False,
        instructions="Cada app tem seu deploy. Fiscal ≠ Produtividade. Notifica Backlog Parket no fim.",
        respond_directly=False, telemetry=False,
    )
