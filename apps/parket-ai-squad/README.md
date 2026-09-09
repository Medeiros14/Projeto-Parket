  Parket AI Squad                                                                                                   
                                                                                                                    
  Sistema multi-agente de inteligência artificial integrado ao WhatsApp, desenvolvido para automatizar atendimento, 
  gestão de conhecimento e workflows operacionais via grupos do WhatsApp.

  ---
  Visão Geral

  O Parket AI Squad permite criar e gerenciar um time de agentes de IA, onde cada agente é vinculado a um grupo do
  WhatsApp e possui sua própria base de conhecimento, habilidades, ferramentas e instruções personalizadas. Os
  agentes respondem automaticamente às mensagens dos grupos, consultando sua base de conhecimento via busca vetorial
   (RAG) e usando o modelo de IA configurado.

  ---
  Funcionalidades

  Agentes de IA

  - Criação de múltiplos agentes, cada um vinculado a um grupo do WhatsApp
  - Configuração de instruções, descrição, idioma e comportamento individual por agente
  - Opção de responder apenas quando mencionado
  - Suporte a times de agentes (squads) que colaboram entre si

  Base de Conhecimento (RAG)

  - Upload de documentos por agente: PDF, DOCX, TXT, CSV, XLSX e URLs
  - Processamento e indexação automática dos documentos em chunks
  - Busca vetorial por similaridade coseno usando pgvector (PostgreSQL)
  - Embeddings locais com sentence-transformers (sem custo de API)
  - Contexto relevante injetado automaticamente no prompt do agente

  Skills (Habilidades)

  - Atribuição de habilidades customizadas por agente
  - Descrição de capacidades especiais injetadas no system prompt

  Tools (Ferramentas MCP)

  - Suporte a ferramentas via Model Context Protocol (MCP)
  - Configuração de servidores MCP HTTP ou stdio por agente

  Contas de IA — Pool Multi-provedor

  - Suporte a múltiplas contas e múltiplos provedores: Claude (Anthropic), ChatGPT (OpenAI) e Gemini (Google)
  - Prioridade OAuth via OpenCode: autenticação via sessão web (sem API key), com rotação automática entre contas ao
   atingir o limite de contexto e failover automático
  - Fallback API key: quando nenhuma conta OAuth estiver disponível, assume automaticamente uma conta com API key
  - Rastreamento de uso de tokens por conta e reset automático ao atingir o limite

  Histórico de Conversas

  - Armazenamento persistente de histórico por sessão (grupo do WhatsApp)
  - Histórico injetado automaticamente nas mensagens para manter continuidade de contexto
  - Utiliza PostgresAgentStorage do framework Agno

  Integração WhatsApp

  - Recebimento de mensagens via webhook da Evolution API
  - Envio de respostas automáticas nos grupos
  - Suporte a múltiplos grupos simultaneamente

  Kanban de Workflows

  - Board Kanban integrado para gestão dos workflows dos agentes
  - Colunas: Backlog, Em Progresso, Em Revisão, Concluído
  - Cards com título, descrição, prioridade e responsável

  Painel Administrativo

  - Interface web em Next.js para gerenciamento completo
  - Telas: Agentes, Treinamento, Contas de IA, Squads, Grupos, Kanban, Integrações, Monitoramento

  ---
  Arquitetura

  WhatsApp → Evolution API → Webhook → Backend (FastAPI)
                                           │
                                ┌──────────┴──────────┐
                                │                     │
                           RAG (pgvector)     Account Pool
                           knowledge_chunks         │
                                │            ┌──────┴──────┐
                                │         OAuth          API Key
                                │        (OpenCode)    (Anthropic/
                                │                      OpenAI/Google)
                                └──────────┬──────────┘
                                      Resposta
                                           │
                                WhatsApp ← Evolution API

  Stack Técnica

  ┌──────────────────────┬─────────────────────────────────────────────┐
  │        Camada        │                 Tecnologia                  │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Backend              │ Python 3.12, FastAPI, SQLAlchemy (async)    │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Frontend             │ Next.js 14, TypeScript, Tailwind CSS        │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Banco de dados       │ PostgreSQL 16 + pgvector                    │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Cache                │ Redis 7                                     │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Embeddings           │ sentence-transformers (local, multilingual) │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Framework de Agentes │ Agno 1.3.2                                  │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Proxy LLM / OAuth    │ OpenCode (anomalyco/opencode)               │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Integração WhatsApp  │ Evolution API                               │
  ├──────────────────────┼─────────────────────────────────────────────┤
  │ Infraestrutura       │ Docker Swarm, Traefik, Portainer            │
  └──────────────────────┴─────────────────────────────────────────────┘

  ---
  Estrutura do Projeto

  parket-ai-squad/
  ├── backend/
  │   ├── app/
  │   │   ├── api/          # Endpoints REST (agentes, treinamento, contas, webhooks...)
  │   │   ├── core/         # Motor de agentes, RAG, pool de contas, embeddings
  │   │   ├── models/       # Modelos SQLAlchemy (Agent, AIAccount, Knowledge, Kanban...)
  │   │   └── schemas/      # Schemas Pydantic
  │   ├── Dockerfile
  │   └── requirements.txt
  ├── frontend/
  │   ├── src/
  │   │   ├── app/          # Páginas Next.js (agentes, treinamento, contas...)
  │   │   ├── components/   # Componentes reutilizáveis
  │   │   └── lib/          # Cliente API
  │   └── Dockerfile
  ├── opencode/
  │   ├── Dockerfile
  │   └── config.json
  ├── stack.yml             # Docker Swarm stack
  ├── deploy.sh             # Script de deploy via Portainer API
  └── .env.example

  ---
  Versões

  ┌────────┬────────────────────────────────────────────────────────────────────────────┐
  │ Versão │                                 Descrição                                  │
  ├────────┼────────────────────────────────────────────────────────────────────────────┤
  │ v1.0.0 │ Versão inicial — agentes, conhecimento, skills, tools, integração WhatsApp │
  ├────────┼────────────────────────────────────────────────────────────────────────────┤
  │ v1.1.0 │ Migração para Agno Framework + OAuth prioritário com fallback API key      │
  └────────┴────────────────────────────────────────────────────────────────────────────┘

  ---
  Requisitos

  - Docker Swarm
  - PostgreSQL 16 com extensão pgvector
  - Evolution API configurada com instância WhatsApp ativa
  - Conta Claude, OpenAI ou Gemini (OAuth ou API key)

  ---
  Deploy

  cp .env.example .env
  # Edite o .env com suas credenciais

  # Build das imagens
  docker build -t parket-ai-backend:latest ./backend
  docker build -t parket-ai-frontend:latest ./frontend

  # Deploy no Swarm
  docker stack deploy -c stack.yml parket-ai-squad

  ---
  Cole isso diretamente no README do repositório em https://github.com/willzeiras/parket-ai-squad. Quer que eu faça
  o commit do README.md direto pelo servidor?
