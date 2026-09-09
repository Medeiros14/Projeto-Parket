"""Factory pra criar agentes EAS com defaults sensatos.

Centraliza:
- Modelo Claude default (Sonnet 4.5 ou Opus 4.7).
- DB compartilhado (PostgresDb no schema eas).
- Instructions com Knowledge Pack da squad (cache_control implícito do Anthropic).
- Tools comuns: handoff.log_atividade.
"""

from __future__ import annotations

from typing import Iterable

import asyncio
from threading import Lock

from agno.agent import Agent
from agno.db.postgres import PostgresDb
from agno.models.anthropic import Claude

from app.agents.claude_cli import CC_HEADERS, ClaudeCLI
from app.agents.db_normalized import NormalizedRunsPostgresDb
from app.agents.overrides import get_model_override, get_override
from app.auth.anthropic_oauth import get_anthropic_oauth_token
from app.config import settings
from app.knowledge.loader import build_pack
from app.tools import claude_skills, handoff, teca_nucleo


def build_db() -> PostgresDb:
    return NormalizedRunsPostgresDb(
        db_url=settings.db_url,
        db_schema=settings.db_schema,
        session_table="agent_sessions",
        memory_table="agent_memories",
        metrics_table="agent_metrics",
        eval_table="agent_evals",
        knowledge_table="knowledge_contents",
    )


_DB_SINGLETON: PostgresDb | None = None


def db() -> PostgresDb:
    global _DB_SINGLETON
    if _DB_SINGLETON is None:
        _DB_SINGLETON = build_db()
    return _DB_SINGLETON


def make_model(use_opus: bool = False, max_tokens: int = 4096, model_id: str | None = None,
               timeout: float | None = None) -> Claude:
    """Sonnet 4.6 default; Opus 4.7 pra Tech Lead.

    Auth: OAuth via Claude Code (ai_accounts). Usa ClaudeCLI (subclasse) que
    força beta.messages.create + billing header + betas list (sem isso o token
    OAuth recebe 429 fake do Anthropic).

    Cache Anthropic ativado:
    - cache_system_prompt: cacheia instructions + KB pack (5K tok dashboard)
    - cache_tools: cacheia schemas de tools (pode ser MB)
    - extended_cache_time: TTL 1h em vez de 5min default (mais hits)
    """
    model_id = model_id or (settings.model_tech_lead if use_opus else settings.model_default)
    oauth_token = get_anthropic_oauth_token()

    # Anthropic prompt cache: TTL 5min default.
    # extended_cache_time (1h) causou 400 — Agno coloca breakpoints fora de
    # ordem (precisa ttl=1h antes de ttl=5m). 5min é suficiente pra interativo.
    cache_kwargs = dict(
        cache_system_prompt=True,
        cache_tools=True,
    )
    if timeout is not None:
        # Timeout explícito no client desliga o check "streaming required >10min"
        # do SDK — necessário pra max_tokens grande em run não-streamed (anexos).
        cache_kwargs["timeout"] = timeout

    if oauth_token:
        return ClaudeCLI(
            id=model_id,
            max_tokens=max_tokens,
            auth_token=oauth_token,
            default_headers=CC_HEADERS,
            **cache_kwargs,
        )
    if settings.anthropic_api_key:
        return Claude(id=model_id, max_tokens=max_tokens, api_key=settings.anthropic_api_key, **cache_kwargs)
    return Claude(id=model_id, max_tokens=max_tokens, **cache_kwargs)


def make_agent(
    *,
    name: str,
    squad: str,
    role: str,
    extra_instructions: str = "",
    tools: Iterable | None = None,
    use_opus: bool = False,
) -> Agent:
    """Agente EAS padrão.

    Args:
        name: nome único (vira agent_id no AgentOS).
        squad: nome da squad (carrega Knowledge Pack apropriado).
        role: descrição curta do papel (ex: 'Monitora services Swarm e alerta').
        extra_instructions: instruções específicas além do KB pack.
        tools: lista de tools/objetos.
        use_opus: True pra Opus 4.7 (Tech Lead, planning crítico).
    """
    pack = build_pack(squad)
    base_tools = list(tools or [])
    # log_atividade + Teca Núcleo (busca no grafo, notas, Pulsar, aprendizados) sempre disponíveis
    have = {getattr(t, "name", None) for t in base_tools}
    for t in [handoff.log_atividade, *teca_nucleo.ALL_TOOLS, *claude_skills.ALL_TOOLS]:
        if getattr(t, "name", None) not in have:
            base_tools.append(t)

    instructions = (
        f"# Papel\n\nVocê é o agente *{name}* da squad *{squad}* no EAS Parket.\n\n"
        f"## Função\n{role}\n\n"
        f"## Knowledge Pack\n{pack.system_text}\n"
    )
    if extra_instructions:
        instructions += f"\n## Instruções extras\n\n{extra_instructions}\n"

    agent = Agent(
        id=name,
        name=name,
        model=make_model(use_opus=use_opus),
        db=db(),
        tools=base_tools,
        instructions=instructions,
        markdown=False,
        add_history_to_context=True,
        num_history_runs=6,                # 2 dava amnésia no chat; tool calls do histórico ficam cortados abaixo
        max_tool_calls_from_history=10,    # tool results grandes (docker ps/psql) eram MB
        enable_user_memories=False,
        telemetry=False,
    )
    _wire_override_hotswap(agent, base_instructions=instructions)
    return agent


# ============================================================
# Hot-swap de instructions via eas.agent_overrides (sem restart)
# ============================================================

def _wire_override_hotswap(agent: Agent, base_instructions: str) -> None:
    """Envolve agent.run e agent.arun pra swap dinâmico de instructions.

    Antes de cada run: lê override do DB (com cache TTL 30s) e troca
    agent.instructions. Após run: volta ao base. Lock per-agent garante
    safety em runs concorrentes do mesmo agent.
    """
    agent._base_instructions = base_instructions  # type: ignore[attr-defined]
    agent._override_lock_sync = Lock()  # type: ignore[attr-defined]
    agent._override_lock_async = asyncio.Lock()  # type: ignore[attr-defined]

    base_model_id = agent.model.id
    orig_run = agent.run
    orig_arun = agent.arun

    def run_with_override(*args, **kwargs):  # type: ignore[no-untyped-def]
        with agent._override_lock_sync:  # type: ignore[attr-defined]
            agent.instructions = _resolve_instructions(agent.id, base_instructions)
            agent.model.id = _resolve_model(agent.id, base_model_id)
            try:
                return orig_run(*args, **kwargs)
            finally:
                agent.instructions = base_instructions
                agent.model.id = base_model_id

    async def arun_with_override(*args, **kwargs):  # type: ignore[no-untyped-def]
        async with agent._override_lock_async:  # type: ignore[attr-defined]
            agent.instructions = _resolve_instructions(agent.id, base_instructions)
            agent.model.id = _resolve_model(agent.id, base_model_id)
            try:
                return await orig_arun(*args, **kwargs)
            finally:
                agent.instructions = base_instructions
                agent.model.id = base_model_id

    agent.run = run_with_override  # type: ignore[assignment]
    agent.arun = arun_with_override  # type: ignore[assignment]


def wire_model_hotswap(entity) -> None:
    """Hot-swap de modelo pra Teams (coordinator). Agents já são cobertos
    pelo _wire_override_hotswap dentro do make_agent."""
    base_model_id = entity.model.id
    lock_sync = Lock()
    lock_async = asyncio.Lock()
    orig_run = entity.run
    orig_arun = entity.arun

    def run_with_model(*args, **kwargs):  # type: ignore[no-untyped-def]
        with lock_sync:
            entity.model.id = _resolve_model(entity.id, base_model_id)
            try:
                return orig_run(*args, **kwargs)
            finally:
                entity.model.id = base_model_id

    async def arun_with_model(*args, **kwargs):  # type: ignore[no-untyped-def]
        async with lock_async:
            entity.model.id = _resolve_model(entity.id, base_model_id)
            try:
                return await orig_arun(*args, **kwargs)
            finally:
                entity.model.id = base_model_id

    entity.run = run_with_model  # type: ignore[assignment]
    entity.arun = arun_with_model  # type: ignore[assignment]


def _resolve_instructions(agent_id: str, fallback: str) -> str:
    """Retorna override do DB se existir; senão, fallback."""
    try:
        override = get_override(agent_id)
        return override if override else fallback
    except Exception:  # noqa: BLE001
        return fallback


def _resolve_model(agent_id: str, fallback: str) -> str:
    """Retorna model override do DB se existir; senão, fallback."""
    try:
        override = get_model_override(agent_id)
        return override if override else fallback
    except Exception:  # noqa: BLE001
        return fallback
