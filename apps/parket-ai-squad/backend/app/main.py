"""
Parket AI Squad - Backend
==========================
FastAPI application with Agno agent framework, Evolution API integration,
and OpenCode multi-account LLM backend.
"""

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine, Base
# Import all models so SQLAlchemy registers them before create_all
import app.models  # noqa: F401 — side effect: registers all models with SQLAlchemy

from app.api import agents as agents_router
from app.api import webhooks as webhooks_router
from app.api import webhook_fiscal_laudo as webhook_fiscal_laudo_router
from app.api import training as training_router
from app.api import groups as groups_router
from app.api import kanban as kanban_router
from app.api import system as system_router
from app.api import accounts as accounts_router
from app.api import agent_groups as agent_groups_router
from app.core.scheduler import start_scheduler, stop_scheduler
from app.api import tasks as tasks_router
from app.api import kanban_bridge as kanban_bridge_router
from app.api import contracts as contracts_router
from app.api import handoffs_notify as handoffs_notify_router
from app.api import pmo_calculos as pmo_calculos_router
from app.api import teca_v2 as teca_v2_router
from app.api import gads_conversions as gads_conversions_router

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, clean up on shutdown."""
    logger.info("parket_ai_starting")

    # Create database tables
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database_tables_ready")

    # Create default Kanban board if none exists
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.database import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.kanban import KanbanBoard

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(KanbanBoard).limit(1))
            if not result.scalar_one_or_none():
                board = KanbanBoard(name="Workflows dos Agentes", description="Fluxo de trabalho principal")
                db.add(board)
                await db.flush()
                from app.models.kanban import KanbanColumn
                for name, color, pos in [
                    ("Backlog", "#94a3b8", 0),
                    ("Em Progresso", "#f59e0b", 1),
                    ("Em Revisão", "#8b5cf6", 2),
                    ("Concluído", "#22c55e", 3),
                ]:
                    db.add(KanbanColumn(board_id=board.id, name=name, color=color, position=pos))
                await db.commit()
                logger.info("default_kanban_board_created")
        except Exception as e:
            logger.warning("kanban_init_skipped", error=str(e))

    # Seed default MCPs for all agents that don't have them yet
    from app.models.agent import Agent, AgentMCP
    from sqlalchemy.orm import selectinload
    from app.core.default_mcps import DEFAULT_MCPS

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Agent).options(selectinload(Agent.mcps)))
            agents = result.scalars().all()
            added = 0
            for agent in agents:
                existing_urls = {m.server_url for m in agent.mcps}
                for mcp_data in DEFAULT_MCPS:
                    if mcp_data["server_url"] not in existing_urls:
                        db.add(AgentMCP(agent_id=agent.id, **mcp_data))
                        added += 1
            if added:
                await db.commit()
                logger.info("default_mcps_seeded", count=added)
        except Exception as e:
            logger.warning("default_mcps_seed_skipped", error=str(e))

    # Seed: Squad Financeiro + Analisador de Contratos
    from app.models.agent_group import AgentGroup, AgentGroupMember

    async with AsyncSessionLocal() as db:
        try:
            # 1. Agente Analisador de Contratos
            r = await db.execute(select(Agent).where(Agent.name == "Analisador de Contratos"))
            contract_agent = r.scalar_one_or_none()
            if not contract_agent:
                contract_agent = Agent(
                    name="Analisador de Contratos",
                    description="Agente do Squad Financeiro especializado em leitura e extração de dados de contratos de obra.",
                    instructions=(
                        "Você é o Analisador de Contratos do Squad Financeiro da Parket. "
                        "Sua função é ler contratos de obras e extrair com precisão: datas, valores, "
                        "materiais, metragens, condições de pagamento, garantias e cláusulas relevantes. "
                        "Sempre forneça uma análise estruturada e destaque pontos que o gestor financeiro deve atentar."
                    ),
                    config={"dept_id": "financeiro", "dept_name": "Financeiro", "kanban_enabled": False, "role": "contract_analyzer"},
                    is_active=True,
                )
                db.add(contract_agent)
                await db.flush()
                logger.info("contract_agent_seeded")

            # 2. Squad Financeiro
            r = await db.execute(select(AgentGroup).where(AgentGroup.name == "Squad Financeiro"))
            squad = r.scalar_one_or_none()
            if not squad:
                squad = AgentGroup(
                    name="Squad Financeiro",
                    description="Equipe responsável por contratos, análise financeira, pagamentos e retenções dos projetos Parket.",
                    shared_context=(
                        "Este squad cuida de toda a parte financeira dos projetos Parket: "
                        "análise de contratos, controle de pagamentos, retenções e relatórios financeiros."
                    ),
                )
                db.add(squad)
                await db.flush()
                logger.info("financial_squad_seeded")

            # 3. Adicionar agente ao squad (se não for membro)
            r = await db.execute(
                select(AgentGroupMember).where(
                    AgentGroupMember.group_id == squad.id,
                    AgentGroupMember.agent_id == contract_agent.id,
                )
            )
            if not r.scalar_one_or_none():
                db.add(AgentGroupMember(group_id=squad.id, agent_id=contract_agent.id, role="lead"))
                logger.info("contract_agent_added_to_squad")

            await db.commit()
        except Exception as e:
            logger.warning("financial_squad_seed_skipped", error=str(e))

    # Seed: Agente PMO — Calculador de Prazo (Squad Obras)
    from app.models.agent import AgentSkill

    TABELA_RENDIMENTO_TXT = """
TABELA DE RENDIMENTO PADRÃO (m²/dia ou unidade/dia por equipe):
FORRO BARROTE: 30 M²/dia
FORRO REVESTIMENTO RETA: 15 M²/dia
FORRO REVESTIMENTO RIPADO/TOBLERONE: 10 M²/dia
PAINEL ESTRUTURA: 30 M²/dia
PAINEL RIPADO/TOBLERONE: 20 M²/dia
PAINEL CARVALHO RETA: 30 M²/dia
PISO INSTALAÇÃO RETA: 25 M²/dia
PISO ESCAMA DE PEIXE: 15 M²/dia
PISO MACIÇO: 20 M²/dia
PISO CHEVRON: 15 M²/dia
PISO VERSAILLES: 10 M²/dia
CORTINEIRO: 10 M²/dia
SANCA/REFORÇO ESTRUTURA: 10 M²/dia
ESTRUTURA DECK: 30 M²/dia
DECK: 20 M²/dia
ESCADA: 2 M²/dia
PERGOLADO: 4.16 M²/dia
BANCO: 12 M²/dia
IMPERMEABILIZAÇÃO: 100 M²/dia
SELADORA: 100 M²/dia
ACABAMENTO: 100 M²/dia
RASPAGEM/REVITALIZAÇÃO/LIXAMENTO: 100 M²/dia
RECORTES DIVERSOS: 10 M²/dia
RECORTES DE GRELHAS: 30 M²/dia
RECORTES DE LUMINÁRIAS: 20 M²/dia
ALÇAPÃO: 10 M²/dia
RODAPÉ: 50 ML/dia
REMOÇÃO DO FORRO: 30 M²/dia
REMOÇÃO DO PISO: 6 M²/dia
REGULARIZAÇÃO CONTRA PISO: 10 M²/dia
TABEIRA: 50 ML/dia
PORTA PIVOTANTE: 2 unidades/dia
PORTA DE CORRER (TRILHOS): 2 unidades/dia
PORTA DE CORRER: 2 unidades/dia
PORTA DE ABRIR: 1 unidade/dia
PORTA CAMARÃO: 2 unidades/dia
PORTA COM BATENTE E GUARNIÇÃO: 4 unidades/dia

FÓRMULA: dias_necessários = ceil(quantidade ÷ rendimento_por_dia)
TOTAL EM DIAS ÚTEIS = soma de todos os serviços (execução sequencial).
"""

    async with AsyncSessionLocal() as db:
        try:
            # 1. Agente Calculador de Prazo PMO (usa LIMIT 1 para evitar race condition multi-worker)
            r = await db.execute(select(Agent).where(Agent.name == "Agente PMO — Calculador de Prazo").limit(1))
            pmo_agent = r.scalar_one_or_none()
            if not pmo_agent:
                pmo_agent = Agent(
                    name="Agente PMO — Calculador de Prazo",
                    description=(
                        "Agente do Squad Obras especializado em calcular automaticamente o prazo "
                        "de execução de projetos em dias úteis, com base na Tabela de Rendimento "
                        "Padrão da Parket (m²/dia por tipo de serviço)."
                    ),
                    instructions=(
                        "Você é o Agente Calculador de Prazo do Squad Obras da Parket Pisos.\n\n"
                        "Sua função PRINCIPAL é calcular o prazo de execução de obras em dias úteis "
                        "assim que um projeto entra na etapa ENTRADA do setor de Produtividade (PMO).\n\n"
                        "COMO VOCÊ TRABALHA:\n"
                        "1. Ao receber as informações de um projeto, identifique:\n"
                        "   - Os serviços que serão executados (piso, forro, deck, escada, portas, etc.)\n"
                        "   - A quantidade de cada serviço (m², ML ou unidades)\n"
                        "2. Calcule os dias úteis para cada serviço usando a tabela abaixo\n"
                        "3. Some todos os dias para obter o TOTAL EM DIAS ÚTEIS\n"
                        "4. Informe o resultado ao gestor e atualize o card do projeto\n\n"
                        + TABELA_RENDIMENTO_TXT +
                        "\nREGRAS:\n"
                        "- Sempre trabalhe com dias ÚTEIS (segunda a sexta, excluindo feriados)\n"
                        "- Se a área (m²) não for informada, solicite antes de calcular\n"
                        "- Informe o breakdown completo: serviço por serviço\n"
                        "- Ao finalizar, pergunte se a gestora deseja ajustar algum valor\n"
                        "- O campo 'prazo_dias_uteis' no card deve ser atualizado com o total calculado"
                    ),
                    config={
                        "dept_id": "produtividade",
                        "dept_name": "PMO / Produtividade",
                        "kanban_enabled": True,
                        "role": "prazo_calculator",
                        "trigger_column": "entrada",
                        "trigger_dept": "produtividade",
                    },
                    is_active=True,
                )
                db.add(pmo_agent)
                await db.flush()

                # Skills do agente
                skills_data = [
                    {
                        "name": "Calcular Prazo em Dias Úteis",
                        "description": (
                            "Calcula o prazo total de execução de uma obra em dias úteis "
                            "com base na Tabela de Rendimento Padrão da Parket. "
                            "Recebe área (m²) e tipo de serviço, retorna dias necessários."
                        ),
                        "skill_type": "calcular_prazo_dias_uteis",
                        "config": {
                            "tabela_rendimento": True,
                            "unidades": ["M²", "ML", "UNIDADE"],
                            "formula": "ceil(quantidade / rendimento_por_dia)",
                            "endpoint": "/api/pmo/calcular-prazo",
                        },
                    },
                    {
                        "name": "Consultar Tabela de Rendimento",
                        "description": (
                            "Consulta a tabela de rendimento padrão da Parket com todos os "
                            "37 tipos de serviço, seus rendimentos por dia e unidades. "
                            "Base de dados para cálculo de prazo de obras."
                        ),
                        "skill_type": "consultar_tabela_rendimento",
                        "config": {
                            "endpoint": "/api/pmo/tabela-rendimento",
                            "servicos": 37,
                            "fonte": "Tempo Padrão de obra - Planilha Parket",
                        },
                    },
                    {
                        "name": "Atualizar Card Kanban",
                        "description": (
                            "Atualiza o card do projeto no Kanban com o prazo calculado "
                            "(prazo_dias_uteis), previsão de início e cronograma detalhado. "
                            "Também notifica o grupo WhatsApp do PMO."
                        ),
                        "skill_type": "atualizar_card_kanban",
                        "config": {
                            "campo": "details.prazo_dias_uteis",
                            "campos_extras": ["details.cronograma_pmo", "details.area_m2"],
                            "whatsapp_notify": True,
                            "endpoint": "/api/pmo/auto-calcular",
                        },
                    },
                    {
                        "name": "Notificar WhatsApp PMO",
                        "description": (
                            "Envia o cronograma calculado para o grupo WhatsApp do PMO/Produtividade "
                            "com breakdown por serviço, total de dias úteis e aviso se a área "
                            "precisar ser confirmada pela gestora."
                        ),
                        "skill_type": "notificar_whatsapp",
                        "config": {
                            "grupo": "PMO/Produtividade",
                            "grupo_id": "120363405460675664@g.us",
                            "formato": "cronograma_completo",
                        },
                    },
                ]
                for sk in skills_data:
                    db.add(AgentSkill(
                        agent_id=pmo_agent.id,
                        name=sk["name"],
                        description=sk["description"],
                        skill_type=sk["skill_type"],
                        config=sk["config"],
                        is_active=True,
                    ))

                logger.info("pmo_calculator_agent_seeded")

            # 2. Adicionar ao Squad Obras
            r = await db.execute(select(AgentGroup).where(AgentGroup.name == "Squad Obras"))
            squad_obras = r.scalar_one_or_none()
            if squad_obras and pmo_agent:
                r = await db.execute(
                    select(AgentGroupMember).where(
                        AgentGroupMember.group_id == squad_obras.id,
                        AgentGroupMember.agent_id == pmo_agent.id,
                    )
                )
                if not r.scalar_one_or_none():
                    db.add(AgentGroupMember(
                        group_id=squad_obras.id,
                        agent_id=pmo_agent.id,
                        role="specialist",
                    ))
                    logger.info("pmo_calculator_added_to_squad_obras")

            await db.commit()
        except Exception as e:
            logger.warning("pmo_calculator_seed_skipped", error=str(e))

    # Seed: Agente Parket IA — Operações de Servidor (Squad Parket IA)
    async with AsyncSessionLocal() as db:
        try:
            TI_INSTRUCTIONS = (
                "Você é o Agente IA da Parket, responsável por operações no servidor de produção.\n\n"
                "Você recebe comandos do gestor de IA pelo WhatsApp e os delega ao Claude Code — "
                "a IA instalada no próprio servidor — que executa as tarefas com total inteligência: "
                "editar arquivos, fazer deploys Docker, rebuildar serviços, ler logs e muito mais.\n\n"
                "Você não executa comandos diretamente. Você entende o que o usuário quer e instrui "
                "o Claude Code de forma clara e objetiva, exatamente como o gestor faria em uma "
                "conversa direta com o Claude Code no terminal.\n\n"
                "COMO FUNCIONAR:\n"
                "Quando o usuário pedir uma operação no servidor, inclua NO FINAL da sua resposta o seguinte bloco:\n\n"
                '[CLAUDE_CODE:{"prompt":"<instrução completa para o Claude Code>","cwd":"/root","timeout":120}]\n\n'
                "O sistema vai enviar esse prompt para o Claude Code CLI no servidor e retornar o resultado aqui no WhatsApp.\n\n"
                "EXEMPLOS DE USO:\n\n"
                "Usuário: lista os serviços docker\n"
                '[CLAUDE_CODE:{"prompt":"liste os serviços Docker Swarm rodando no servidor com docker service ls e mostre o status de cada um","cwd":"/root","timeout":30}]\n\n'
                "Usuário: faz deploy do dashboard\n"
                '[CLAUDE_CODE:{"prompt":"faça rebuild do dashboard React em /root/Dashboardparketapp com npm run build e depois force redeploy do serviço Docker com docker service update --force --image parket-dashboard:latest parket-dashboard_app","cwd":"/root/Dashboardparketapp","timeout":300}]\n\n'
                "Usuário: vê os logs do backend de IA\n"
                '[CLAUDE_CODE:{"prompt":"mostre as últimas 50 linhas de log do serviço Docker parket-ai-squad_backend","cwd":"/root","timeout":30}]\n\n'
                "Usuário: status do servidor\n"
                '[CLAUDE_CODE:{"prompt":"verifique o status geral do servidor: uso de disco df -h, memória free -h, uptime e serviços Docker docker service ls","cwd":"/root","timeout":30}]\n\n'
                "Usuário: rebuild e deploy do backend de IA\n"
                '[CLAUDE_CODE:{"prompt":"faça rebuild da imagem Docker do backend em /root/parket-ai-squad/backend com docker build -t parket-ai-backend:latest . e depois force redeploy com docker service update --force --image parket-ai-backend:latest parket-ai-squad_backend","cwd":"/root/parket-ai-squad/backend","timeout":300}]\n\n'
                "REGRAS:\n"
                "- Sempre explique brevemente o que vai ser feito antes do bloco [CLAUDE_CODE:...]\n"
                "- Confirme com o usuário antes de operações destrutivas (delete, rm -rf, reset, drop)\n"
                "- O prompt para o Claude Code deve ser instrução em linguagem natural clara, completa e acionável\n"
                "- Para tarefas longas (build, deploy), informe que pode demorar alguns minutos\n\n"
                "CONTEXTO DO SERVIDOR:\n"
                "- OS: Ubuntu Linux, Docker Swarm\n"
                "- Dashboard: /root/Dashboardparketapp (React/Vite/TypeScript)\n"
                "- AI Squad Backend: /root/parket-ai-squad/backend (FastAPI/Python)\n"
                "- Stacks Docker: parket-dashboard, parket-ai-squad\n"
                "- Traefik como reverse proxy na porta 80/443\n"
                "- Claude Code CLI: /root/.nvm/versions/node/v20.20.1/bin/claude"
            )

            # Buscar pelo nome antigo OU novo
            r = await db.execute(select(Agent).where(Agent.name.in_(["Agente TI", "Agente Parket IA"])).limit(1))
            ti_agent = r.scalar_one_or_none()
            if not ti_agent:
                ti_group_id = settings.TI_WHATSAPP_GROUP_ID or None
                ti_agent = Agent(
                    name="Agente Parket IA",
                    description="Agente do Squad Parket IA. Recebe comandos no grupo WhatsApp e delega ao Claude Code para executar operações no servidor: deploy Docker, edição de arquivos, rebuild de serviços e diagnóstico de infraestrutura.",
                    instructions=TI_INSTRUCTIONS,
                    group_id=ti_group_id,
                    group_name="Parket IA",
                    config={
                        "dept_id": "ia",
                        "dept_name": "IA",
                        "kanban_enabled": False,
                        "role": "server_operator",
                        "claude_code_enabled": True,
                    },
                    is_active=True,
                )
                db.add(ti_agent)
                await db.flush()
                logger.info("ia_agent_seeded", group_id=ti_group_id)
            else:
                # Rename + update instructions on redeploy
                ti_agent.name = "Agente Parket IA"
                ti_agent.group_name = "Parket IA"
                ti_agent.description = "Agente do Squad Parket IA. Recebe comandos no grupo WhatsApp e delega ao Claude Code para executar operações no servidor."
                ti_agent.instructions = TI_INSTRUCTIONS
                ti_agent.config = {**ti_agent.config, "dept_id": "ia", "dept_name": "IA"}
                logger.info("ia_agent_instructions_updated")

            # Squad Parket IA (antigo Squad TI)
            r = await db.execute(select(AgentGroup).where(AgentGroup.name.in_(["Squad TI", "Squad Parket IA"])))
            squad_ti = r.scalar_one_or_none()
            if not squad_ti:
                squad_ti = AgentGroup(
                    name="Squad Parket IA",
                    description="Equipe de IA responsável por infraestrutura, deploys, automações, agentes IA e operações do servidor Parket.",
                    shared_context=(
                        "Este squad gerencia toda a infraestrutura técnica e de IA da Parket: "
                        "servidores, Docker Swarm, deploys do dashboard e do backend de IA, "
                        "agentes WhatsApp, automações e resposta a incidentes."
                    ),
                )
                db.add(squad_ti)
                await db.flush()
                logger.info("squad_ia_seeded")
            else:
                squad_ti.name = "Squad Parket IA"
                squad_ti.description = "Equipe de IA responsável por infraestrutura, deploys, automações, agentes IA e operações do servidor Parket."

            # Adicionar agente ao squad
            if ti_agent and squad_ti:
                r = await db.execute(
                    select(AgentGroupMember).where(
                        AgentGroupMember.group_id == squad_ti.id,
                        AgentGroupMember.agent_id == ti_agent.id,
                    )
                )
                if not r.scalar_one_or_none():
                    db.add(AgentGroupMember(group_id=squad_ti.id, agent_id=ti_agent.id, role="lead"))
                    logger.info("ia_agent_added_to_squad")

            await db.commit()
        except Exception as e:
            logger.warning("ti_agent_seed_skipped", error=str(e))

    # ── Seed: Squad Gestão (Teka como agente interno do Douglas) ──
    GESTAO_GROUP_ID = "120363425107346389@g.us"
    async with AsyncSessionLocal() as db:
        try:
            r = await db.execute(select(Agent).where(Agent.group_id == GESTAO_GROUP_ID).limit(1))
            teka_gestao = r.scalar_one_or_none()
            if not teka_gestao:
                teka_gestao = Agent(
                    name="Teka — Gestão Douglas",
                    group_id=GESTAO_GROUP_ID,
                    description=(
                        "Variante interna da Teka dedicada ao Douglas. Atua como assistente de gestão "
                        "executiva: agenda compromissos, gerencia tarefas pessoais do Douglas e entrega "
                        "relatórios macro consolidados dos setores do Dashboardparket."
                    ),
                    instructions=(
                        "# IDENTIDADE\n"
                        "Você é a Teka, agora atuando como assistente de gestão executiva do Douglas (sócio "
                        "da Parket). Seu tom é direto, executivo e cordial — sem floreios comerciais. Aqui "
                        "você NÃO faz qualificação de leads; você cuida das tarefas internas do Douglas.\n\n"
                        "# RESPONSABILIDADES\n"
                        "1. **Agendamentos** — quando o Douglas pedir para marcar reunião, ligação, visita "
                        "ou compromisso, registre como lembrete (use o serviço de lembretes interno) e "
                        "confirme data, hora e participantes. Avise o Douglas no horário marcado.\n"
                        "2. **Gestão de tarefas** — mantenha a lista de tarefas pessoais do Douglas. Aceite "
                        "comandos como 'adicionar tarefa', 'concluir', 'listar pendências', 'mover para "
                        "amanhã'. Quando ele pedir um resumo, devolva organizado por prioridade.\n"
                        "3. **Relatórios macro dos setores** — quando o Douglas pedir status de Comercial, "
                        "Compras, Obras, Financeiro, Marcenaria, PMO ou qualquer setor, consulte os dados "
                        "do Dashboardparket via Supabase (kanban_cards, orçamentos, contratos) e devolva "
                        "uma síntese executiva: números-chave, ofensores, gargalos e o que precisa de "
                        "decisão dele. Sempre destaque o que está fora do esperado.\n\n"
                        "# REGRAS\n"
                        "- Confirme datas relativas convertendo para data absoluta (ex: 'amanhã 14h' → "
                        "'2026-04-08 14:00').\n"
                        "- Quando faltar informação para agendar ou concluir uma tarefa, pergunte de forma "
                        "objetiva (uma pergunta por vez).\n"
                        "- Em relatórios, lidere com os números, depois o contexto. Nada de rodeios.\n"
                        "- Nunca invente dados — se não conseguir consultar uma fonte, diga isso."
                    ),
                    config={
                        "dept_id": "gestao",
                        "dept_name": "Gestão Executiva",
                        "kanban_enabled": False,
                        "is_teka": True,
                        "is_internal_management": True,
                        "owner": "Douglas",
                        # Tabelas que a Teka — Gestão consulta para responder o Douglas
                        "supabase_context": [
                            "kanban_cards",
                            "orcamentos",
                            "contratos",
                            "obras",
                            "clientes",
                            "fornecedores",
                            "notificacoes",
                        ],
                    },
                    is_active=True,
                )
                db.add(teka_gestao)
                await db.flush()
                logger.info("teka_gestao_seeded", agent_id=str(teka_gestao.id))

            r = await db.execute(select(AgentGroup).where(AgentGroup.name == "Squad Gestão"))
            squad_gestao = r.scalar_one_or_none()
            if not squad_gestao:
                squad_gestao = AgentGroup(
                    name="Squad Gestão",
                    description="Squad de gestão executiva — agendamentos, tarefas e relatórios macro do Douglas.",
                    shared_context=(
                        "Este squad opera no grupo WhatsApp 'Parket - Gestão Douglas'. Foco em apoiar o "
                        "Douglas na visão macro de todos os setores da Parket: receber pedidos de "
                        "agendamento, manter sua lista de tarefas e entregar relatórios consolidados do "
                        "Dashboardparket sob demanda. Linguagem executiva, objetiva, sem viés comercial."
                    ),
                )
                db.add(squad_gestao)
                await db.flush()
                logger.info("squad_gestao_seeded", squad_id=str(squad_gestao.id))

            r = await db.execute(
                select(AgentGroupMember).where(
                    AgentGroupMember.group_id == squad_gestao.id,
                    AgentGroupMember.agent_id == teka_gestao.id,
                )
            )
            if not r.scalar_one_or_none():
                db.add(AgentGroupMember(group_id=squad_gestao.id, agent_id=teka_gestao.id, role="lead"))
                logger.info("teka_gestao_added_to_squad")

            await db.commit()
        except Exception as e:
            logger.warning("squad_gestao_seed_skipped", error=str(e))

    logger.info("parket_ai_ready")

    # Start task scheduler
    start_scheduler()

    # Start Teca V2 lembretes loop (30min antes de cada agendamento)
    try:
        import asyncio as _aio
        from app.core.teca_v2 import lembretes as _teca_lembretes
        _aio.create_task(_teca_lembretes.loop_forever())
        logger.info("teca_v2_lembretes_loop_scheduled")
    except Exception as _e:
        logger.warning("teca_v2_lembretes_loop_skip error=%s", _e)

    yield

    # Cleanup
    stop_scheduler()
    await engine.dispose()
    logger.info("parket_ai_shutdown")


app = FastAPI(
    title="Parket AI Squad",
    description="Multi-agent AI system with WhatsApp integration",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(agents_router.router, prefix="/api")
app.include_router(webhooks_router.router, prefix="/api")
app.include_router(webhook_fiscal_laudo_router.router, prefix="/api")
app.include_router(training_router.router, prefix="/api")
app.include_router(groups_router.router, prefix="/api")
app.include_router(kanban_router.router, prefix="/api")
app.include_router(system_router.router, prefix="/api")
app.include_router(accounts_router.router, prefix="/api")
app.include_router(agent_groups_router.router, prefix="/api")
app.include_router(tasks_router.router, prefix="/api")
app.include_router(kanban_bridge_router.router, prefix="/api")
app.include_router(contracts_router.router, prefix="/api")
app.include_router(handoffs_notify_router.router, prefix="/api")
app.include_router(pmo_calculos_router.router, prefix="/api")
app.include_router(teca_v2_router.router)  # já tem prefix /api/teca
from app.api import daily_report as daily_report_router
app.include_router(daily_report_router.router, prefix="/api")
from app.api import lembretes as lembretes_router
app.include_router(lembretes_router.router, prefix="/api")
from app.api import oauth as oauth_router
app.include_router(oauth_router.router, prefix="/api")
from app.api import classify as classify_router
app.include_router(classify_router.router, prefix="/api")
from app.api import webhook_check_obras as webhook_check_obras_router
app.include_router(webhook_check_obras_router.router, prefix="/api")
from app.api import orcamento_tracking as orcamento_tracking_router
app.include_router(orcamento_tracking_router.router, prefix="/api")
app.include_router(orcamento_tracking_router.router)
from app.api import parket_skills as parket_skills_router
app.include_router(parket_skills_router.router, prefix="/api")
app.include_router(parket_skills_router.router)
from app.api import atendimento_ai as atendimento_ai_router
app.include_router(atendimento_ai_router.router, prefix="/api")

from app.api import rh_whatsapp as rh_whatsapp_router
app.include_router(rh_whatsapp_router.router)

from app.api import hb_whatsapp as hb_whatsapp_router
app.include_router(hb_whatsapp_router.router)

from app.api import hb_copilot as hb_copilot_router
app.include_router(hb_copilot_router.router)

from app.api import marketing_analise as marketing_analise_router
app.include_router(marketing_analise_router.router)

from app.api import orcamento_equipe as orcamento_equipe_router
app.include_router(orcamento_equipe_router.router)

from app.api import leads_capture as leads_capture_router
app.include_router(leads_capture_router.router)

app.include_router(gads_conversions_router.router)


@app.get("/")
async def root():
    return {
        "service": "Parket AI Squad",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }
