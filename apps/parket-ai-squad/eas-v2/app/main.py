"""AgentOS Parket — Agno 2.7 vanilla + ClaudeOAuth (única peça custom).

UI: os.agno.com (control plane oficial) apontando pra https://os.parket.works
com o Security Key (env OS_SECURITY_KEY → Bearer auth em todas as rotas).
"""

from __future__ import annotations

import copy
import logging
import os

from agno.agent import Agent
from agno.db.postgres import PostgresDb
from agno.guardrails import PIIDetectionGuardrail, PromptInjectionGuardrail
from agno.knowledge.embedder.fastembed import FastEmbedEmbedder
from agno.knowledge.knowledge import Knowledge
from agno.os import AgentOS
from agno.team import Team
from agno.vectordb.pgvector import PgVector

from app.claude_oauth import ClaudeOAuth
from app.dev_gestao import build_dev_gestao
from app.tools import catalogo_consultar, catalogo_editar_preco, log_atividade
from app.toolkits_admin import router as toolkits_router
from app.toolkits_registry import build_agent_tools
from app.valoria import build_valoria_assistant
from app.workflows import build_workflows

logging.basicConfig(level=logging.INFO)

MODEL_DEFAULT = os.environ.get("MODEL_DEFAULT", "claude-sonnet-4-6")

db = PostgresDb(db_url=os.environ["DATABASE_URL"], db_schema="agno")

# Knowledge base compartilhada — embeddings 100% locais (fastembed/ONNX, sem
# key externa; Anthropic não oferece API de embeddings). Modelo multilingual
# baked na imagem (Dockerfile) pra não baixar a cada restart.
knowledge = Knowledge(
    name="Parket Knowledge",
    description="Documentos e URLs de referência da Parket (catálogos, manuais, políticas)",
    contents_db=db,
    vector_db=PgVector(
        table_name="knowledge_vectors",
        schema="agno",
        db_url=os.environ["DATABASE_URL"],
        embedder=FastEmbedEmbedder(
            id="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            dimensions=384,
        ),
    ),
)

# Toolkits extras habilitados via /painel/toolkits (agno.toolkit_config)
extra_tools = build_agent_tools()

# Guardrails: prompt injection + PII só cartão de crédito — email/fone/CNPJ são
# dados legítimos de negócio (Valoria produção), não podem ser bloqueados.
# Regex custom (não o builtin): o builtin pega os 16 dígitos decimais de
# similarity_score (0.5726607023957341) das buscas na Knowledge e derrubava
# delegação em Team. Lookarounds ignoram dígitos dentro de números decimais.
# mask_pii=True: mascarar em vez de bloquear — docs colados (linha digitável de
# boleto etc.) casavam o regex e, como o chat reenvia histórico, TODA mensagem
# seguinte era rejeitada ("Potential PII detected"), travando a Teca (13/07/2026).
GUARDRAILS = [
    PIIDetectionGuardrail(
        mask_pii=True,
        enable_ssn_check=False,
        enable_credit_card_check=False,
        enable_email_check=False,
        enable_phone_check=False,
        custom_patterns={
            "Credit Card": r"(?<![\d.])\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\.?\d)",
        },
    ),
    PromptInjectionGuardrail(),
]

# HITL só no chat do painel: a Valoria não trata run pausada (front executa
# action blocks), então o valoria_assistant segue com a versão sem confirmação
# (permissão já é validada server-side na tool).
catalogo_editar_preco_hitl = copy.deepcopy(catalogo_editar_preco)
catalogo_editar_preco_hitl.requires_confirmation = True

assistant = Agent(
    id="assistant",
    name="Assistant",
    model=ClaudeOAuth(id=MODEL_DEFAULT, max_tokens=8192),
    db=db,
    knowledge=knowledge,
    search_knowledge=True,
    pre_hooks=list(GUARDRAILS),
    tools=[log_atividade, catalogo_consultar, catalogo_editar_preco_hitl,
           *extra_tools.get("assistant", [])],
    instructions=(
        "Você é o assistente geral do AgentOS da Parket (os.parket.works). "
        "Responda em português. Seja direto e prático. "
        "Registre mudanças relevantes via log_atividade."
    ),
    add_history_to_context=True,
    num_history_runs=6,
    markdown=True,
    telemetry=False,
)

valoria_assistant = build_valoria_assistant(
    db,
    knowledge=knowledge,
    extra_tools=extra_tools.get("valoria_assistant", []),
    pre_hooks=list(GUARDRAILS),
)

# Time Dev Gestão — agentes de suporte ao dev do gestao.parket.works
gestao_agents, time_dev_gestao, gestao_workflows = build_dev_gestao(
    db, knowledge=knowledge, pre_hooks=list(GUARDRAILS)
)

# Team = modo "Team" do UI (os.agno.com). O líder roteia cada mensagem pro
# membro certo (custo: 1 chamada extra de modelo por turno).
time_parket = Team(
    id="time-parket",
    name="Time Parket",
    members=[assistant, valoria_assistant],
    model=ClaudeOAuth(id=MODEL_DEFAULT, max_tokens=8192),
    db=db,
    instructions=(
        "Você coordena o Time Parket. Responda em português. "
        "Delegue pro Valoria Assistant tudo que envolver orçamentos, propostas, "
        "catálogo de preços ou a plataforma Valoria (valor.parket.works). "
        "Todo o resto vai pro Assistant geral."
    ),
    add_history_to_context=True,
    num_history_runs=6,
    markdown=True,
    telemetry=False,
)

agent_os = AgentOS(
    id="parket-os",
    name="Parket OS",
    description="AgentOS da Parket — assistente geral + Valoria Assistant",
    db=db,
    agents=[assistant, valoria_assistant, *gestao_agents],
    teams=[time_parket, time_dev_gestao],
    workflows=[*build_workflows(db), *gestao_workflows],
    cors_allowed_origins=["https://os.agno.com"],
    # executor de schedules (default False — sem isso as agendas nunca disparam);
    # base_url aponta pro próprio processo (default do Agno assume porta 7777)
    scheduler=True,
    scheduler_base_url="http://127.0.0.1:8000",
    enable_mcp_server=True,
    telemetry=False,
)

app = agent_os.get_app()
app.include_router(toolkits_router)

if __name__ == "__main__":
    agent_os.serve(app="app.main:app", host="0.0.0.0", port=8000)
