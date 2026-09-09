# Apps do Projeto Parket, catalogo consolidado

Todos os READMEs de `apps/` reunidos num arquivo so (48 documentos). Gerado em 2026-09-09. Fonte: cada `apps/<app>/README.md` deste monorepo.

## Indice

- [compras-app](#compras-app)
- [Dashboardparketapp](#dashboardparketapp)
- [Dashboardparketapp/patches](#dashboardparketapp-patches)
- [expedicao-app](#expedicao-app)
- [instala-app](#instala-app)
- [monitor-app](#monitor-app)
- [parket-ai-squad](#parket-ai-squad)
- [parket-ai-squad/agent-ui](#parket-ai-squad-agent-ui)
- [parket-ai-squad/eas-v2-ui](#parket-ai-squad-eas-v2-ui)
- [parket-center](#parket-center)
- [parket-chat](#parket-chat)
- [parket-contratos](#parket-contratos)
- [parket-core](#parket-core)
- [parket-docusign](#parket-docusign)
- [parket-fiscal](#parket-fiscal)
- [parket-gestao](#parket-gestao)
- [parket-homebroker](#parket-homebroker)
- [parket-insta](#parket-insta)
- [parket-mkt](#parket-mkt)
- [parket-nfe](#parket-nfe)
- [parket-rh](#parket-rh)
- [parket-space-portal](#parket-space-portal)
- [parket-space2](#parket-space2)
- [parket-teca](#parket-teca)
- [parket-valoria-teca](#parket-valoria-teca)
- [parket-wavoip](#parket-wavoip)
- [parket-whisper](#parket-whisper)
- [producao-app](#producao-app)
- [projetos-app](#projetos-app)
- [suprimentos-app](#suprimentos-app)
- [infra](#infra)
- [infra/parket-api](#infra-parket-api)
- [infra/parket-auth-guard](#infra-parket-auth-guard)
- [infra/parket-pg-local](#infra-parket-pg-local)
- [infra/parket-supabase-proxy](#infra-parket-supabase-proxy)
- [infra/parket-waha](#infra-parket-waha)
- [legado](#legado)
- [legado/cronograma-app](#legado-cronograma-app)
- [legado/parket-2026](#legado-parket-2026)
- [legado/parket-app](#legado-parket-app)
- [legado/parket-cs](#legado-parket-cs)
- [legado/parket-devportal](#legado-parket-devportal)
- [legado/parket-emergency-auth](#legado-parket-emergency-auth)
- [legado/parket-guia](#legado-parket-guia)
- [legado/parket-proposta-b](#legado-parket-proposta-b)
- [legado/parket-rh-api](#legado-parket-rh-api)
- [legado/parket-site](#legado-parket-site)
- [legado/parket-skills](#legado-parket-skills)

---

## compras-app

## compras-app

> ERP de compras (`compras.parket.works`). Fornecedores, XML NF-e,
> estoque real, financeiro (contas a pagar), 2 depositos, relatorios.

### O que faz

- **Cadastros** — Clientes, Produtos, Transportadoras, Projetos
  (fonte obras via `core.obras`), 2 depositos Almoxarifado (Curitiba +
  outro), dedup automatico.
- **Solicitar Compras** — projeto vinculado obrigatorio; gastos
  acumulados do cliente dentro do card da solicitacao; historico
  de compras.
- **Import XML NF-e** — escolher tipo (MP / Ferragens) na hora do
  import; fix re-import apos exclusao (nota orfa bloqueava chave).
- **Estoque real** — saldo + entrada manual + saida + XML NF-e.
- **Financeiro (Contas a Pagar)** — aba Faturamentos com upload de
  boleto por parcela, envio Financeiro com PIX/banco condicional a
  forma de pagamento; boleto NF pelo compras direto.
- **Aba Compras Itens** — status individual + trigger gargalo,
  frete avulso como linha, agenda (comprar_em), orcamentos PDF
  por item.
- **Kanban Compras** — badge 3/5 + andamento misto no card + editor
  de itens + notifier chat (#financeiro aguardando, #compras pago).
- **Modulo Relatorios** — pedidos, entradas, saidas, por projeto.
- **PDF card Compras** — projeto + obra completos + categoria
  EMBALAGEM no Almoxarifado.
- **Categoria EMBALAGEM** no Almoxarifado.
- **Optimizacao mobile** — shell + paginas compactas.

### Como se interliga com o ecossistema

- **Le de:** `core.obras` (projetos), XML NF-e enviado, `producao-app`
  (solicitacao de MP faltante).
- **Escreve em:** `parket-core` (contas a pagar), `parket-chat`
  (notif fluxo compras), `parket-nfe` (NF fiscal), estoque
  Almoxarifado, `producao-app` (baixa quando entra estoque).
- **Depende de:** api.parket.works, parser XML NFe.
- **E usado por:** contador, responsavel de compras, financeiro.

### Stack

- React + Vite + Tailwind
- FastAPI + lxml (parser XML)
- Postgres schema `compras.*` (Cloud) + espelho local
- Deploy stack `compras-app`, compras.parket.works

### Onde uso IA

Nao diretamente.

### Como rodar localmente

```bash
cd apps/compras-app
cp .env.example .env
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
cd frontend && npm install && npm run dev
```

### O que aprendi

- **Solicitacao com projeto obrigatorio.** Sem projeto vinculado,
  compra vira orfa e o core nao consegue atribuir ao custo da obra.
- **Compras guarda pagamento por forma.** Envio Financeiro: PIX/banco
  so se forma != faturado (boleto depois); modal fornecedor nao
  bloqueia sem PIX/banco.
- **Frete avulso sempre visivel** — botao "Lancar frete" cria linha
  FRETE avulsa; frete sempre flui como linha em `compras_itens`.

---

## Dashboardparketapp


  # DASHBORD PARKET APP

  This is a code bundle for DASHBORD PARKET APP. The original project is available at https://www.figma.com/design/lxNUcKHvKzrK87WEbeI1EO/DASHBORD-PARKET-APP.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

---

## Dashboardparketapp/patches

## Patches aplicados na imagem golden

Estes arquivos são patches aplicados sobre a imagem Docker golden (82db7f52afb6).
Para reconstruir a imagem:
  docker build -t parket-dashboard:latest ./patches/

### Patches:
- **dept-layout**: botões Qualificado/Não Qualificado no funil de entrada, sem Perdido no funil de vendas, abas Levantamento e Gerar Orçamento no card Comercial, seletor equipes, WhatsApp prestadores
- **orcamento-simulador-tab**: botão "Gerar Link" (era "HTML"), URL proposta.parket.works
- **proposta-publica-page**: vídeo Heromobile-v3, contrato coluna única responsivo
- **propostaGenerator**: contrato column-fill balance
- **solicitar-compras-page**: expedição vai para logística
- **index.html**: tracking de propostas, script de botões

---

## expedicao-app

## expedicao-app

> Logistica de expedicao (`expedicao.parket.works`). Agenda do dia + carta de frete nativas (sem Hercules legado).

### O que faz

- **Agenda do dia** com fretes vinculados a obras
- **Carta de frete** gerada nativamente (fim do Hercules)
- **Sync delta Convex → Supabase** (dados historicos do app Hercules)
- **Vincular fretes a obras** (UI + backfill)
- **Sync com outros setores** (compras, producao, gestao)

### Como se interliga com o ecossistema

- **Le de:** obras via `core.obras`, dados Hercules (delta sync)
- **Escreve em:** `expedicao.*` schema Cloud, `parket-chat` (notif entrega)
- **Depende de:** api.parket.works

### Stack

React + Vite (clonando compras-app layout), FastAPI backend, PG Cloud + local, deploy `expedicao-app`

### Onde uso IA

Nao usa IA.

---

## instala-app

## instala-app

> App mobile-first do instalador (`instala.parket.works`). Roda no
> celular do instalador em canteiro de obra: check-in, foto,
> progresso por item, ficha tecnica, pagamento.

### O que faz

Bottom nav estilo Tripos: **HOJE | AGENDA | INICIAR | EQUIPE | RECEBER**.

- **HOJE** — obras do dia, chip "FAZENDO HOJE" abre camera in-app, X
  separado pra parar, feedback "parou as HH:MM".
- **AGENDA** — 4 abas Agenda/Iniciar/Equipe/Ranking.
- **INICIAR** — check-in com GPS + camera obrigatorios, contrato
  geral prestador (F4 ativacao por obra com OTP).
- **Progresso diario** — qtd do dia obrigatoria (parcial e finalizar
  ja com foto), barra por item, falta em destaque, historico de dias
  no card do item.
- **Ficha tecnica v2** — chave_match, markdown, cola, video, cache offline.
- **Conferencia de material** volume a volume.
- **Fila offline** completa (IndexedDB) — check-in, medicao, finalizar,
  backoff, badge, atencao.
- **RECEBER (Pagamentos)** — R$/m² + ganhos por obra, extrato do pago.
- **Ocorrencias** + solicitar material — pedido cai no verifica pro
  fiscal aprovar antes de virar compra.
- **Meus custos** — no /mais, endpoint app + CORS core.
- **Ditado por voz** em todos os textos.
- **Camera in-app** via `getUserMedia` (visor + permissao) nos 4 pontos
  de foto.
- **Card de obra simplificado** — UUID oculto, icones lucide, chips
  maiores.
- **Login por email e senha** (era PIN antes).
- **URL reflete perfil logado** (`/david` na Hoje).

### Como se interliga com o ecossistema

- **Le de:** `parket-gestao` (obras do instalador via
  `vw_instala_minhas_obras`), fiscal (feedback), gestao/ficha_tecnica.
- **Escreve em:** `gestao.eventos` (progresso), `parket-chat` (msg
  no thread da obra), `parket-fiscal` (pedido de material vai pro
  fiscal aprovar).
- **Depende de:** api.parket.works (auth), IndexedDB, MediaDevices,
  Web Speech, service worker (PWA).
- **E usado por:** instaladores em campo.

### Stack

- React + Vite + Tailwind + PWA
- Backend compartilha `parket-gestao` (namespace `/instala`)
- Postgres schema `instala.*`
- Deploy stack `instala-app`, instala.parket.works

### Onde uso IA

- Ditado por voz Web Speech pt-BR (browser-side)
- Notificacoes de novidades (task 2065 em progresso)

### Como rodar localmente

```bash
cd apps/instala-app
cp .env.example .env
npm install && npm run dev
```

### O que aprendi

- **Fotos com feedback + gate de check-in visivel.** Instalador que
  nao ve confirmacao envia 5x a mesma foto.
- **Camera in-app > input=file.** Input abre app externo em Android,
  perde contexto.
- **Fila offline resistente.** Rede em obra e instavel; toda escrita
  vai pra IndexedDB primeiro, backoff exponencial, badge no icone
  do bottom nav mostra quantos itens pendentes.
- **URL personalizada** (`/david`) evita instalador logar como colega
  por acidente.
- **Compressao antes de subir foto** — foto de celular sem compressao
  esgota upload em rede ruim.

---

## monitor-app

## monitor-app

> Status page dos 43 dominios `parket.works` (`monitor.parket.works`).
> Estilo `status.claude.com`.

### O que faz

- Backend Node em runtime — checker HTTP a cada 60s
- API expondo status atual + historico
- Frontend estatico SPA no estilo status.claude.com
- Schema `monitor.*` no PG local + seed dos 44 dominios
- Editar `monitor.apps` no PG local muda a pagina **sem redeploy**

### Como se interliga com o ecossistema

- **Le de:** ping HTTP em cada dominio parket.works
- **Escreve em:** `monitor.status_snapshots` + `monitor.status_events`
- **E usado por:** todo mundo Parket ve o status visual de cada app
  e watchers de crons

### Stack

- Node/Express backend
- SPA estatica com Tailwind
- Postgres schema `monitor.*`
- Docker Swarm stack `monitor-app`

### Onde uso IA

Nao usa.

### Como rodar localmente

```bash
cd apps/monitor-app
npm install
node checker.js  # roda checker + api
```

### O que aprendi

- **Editar tabela > redeploy.** Adicionar/remover app da pagina
  status = UPDATE em `monitor.apps`, nao commit. Zero downtime.
- **Smoke test dos watchers/crons** virou dado versionavel (rodada
  20/08 monitorada por este app).

---

## parket-ai-squad

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

---

## parket-ai-squad/agent-ui

## Agent UI

A modern chat interface for AgentOS built with Next.js, Tailwind CSS, and TypeScript. This template provides a ready-to-use UI for connecting to and interacting with your AgentOS instances through the Agno platform.

<img src="https://agno-public.s3.us-east-1.amazonaws.com/assets/agent_ui_banner.svg" alt="agent-ui" style="border-radius: 10px; width: 100%; max-width: 800px;" />

### Features

- 🔗 **AgentOS Integration**: Seamlessly connect to local and live AgentOS instances
- 💬 **Modern Chat Interface**: Clean design with real-time streaming support
- 🧩 **Tool Calls Support**: Visualizes agent tool calls and their results
- 🧠 **Reasoning Steps**: Displays agent reasoning process (when available)
- 📚 **References Support**: Show sources used by the agent
- 🖼️ **Multi-modality Support**: Handles various content types including images, video, and audio
- 🎨 **Customizable UI**: Built with Tailwind CSS for easy styling
- 🧰 **Built with Modern Stack**: Next.js, TypeScript, shadcn/ui, Framer Motion, and more

### Version Support

- **Main Branch**: Supports Agno v2.x (recommended)
- **v1 Branch**: Supports Agno v1.x for legacy compatibility

### Getting Started

#### Prerequisites

Before setting up Agent UI, you need a running AgentOS instance. If you haven't created one yet, check out our [Creating Your First OS](/agent-os/creating-your-first-os) guide.

> **Note**: Agent UI connects to AgentOS instances through the Agno platform. Make sure your AgentOS is running before attempting to connect.

#### Installation

#### Automatic Installation (Recommended)

```bash
npx create-agent-ui@latest
```

#### Manual Installation

1. Clone the repository:

```bash
git clone https://github.com/agno-agi/agent-ui.git
cd agent-ui
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Connecting to Your AgentOS

Agent UI connects directly to your AgentOS instance, allowing you to interact with your agents through a modern chat interface.

> **Prerequisites**: You need a running AgentOS instance before you can connect Agent UI to it. If you haven't created one yet, check out our [Creating Your First OS](https://docs.agno.com/agent-os/creating-your-first-os) guide.

### Step-by-Step Connection Process

#### 1. Configure the Endpoint

By default, Agent UI connects to `http://localhost:7777`. You can easily change this by:

1. Hovering over the endpoint URL in the left sidebar
2. Clicking the edit option to modify the connection settings

#### 2. Choose Your Environment

- **Local Development**: Use `http://localhost:7777` (default) or your custom local port
- **Production**: Enter your production AgentOS HTTPS URL

> **Warning**: Make sure your AgentOS is actually running on the specified endpoint before attempting to connect.

#### 3. Configure Authentication (Optional)

If your AgentOS instance requires authentication, you can configure it in two ways:

##### Option 1: Environment Variable (Recommended)

Set the `OS_SECURITY_KEY` environment variable:

```bash
# In your .env.local file or shell environment
NEXT_PUBLIC_OS_SECURITY_KEY=your_auth_token_here
```

> **Note**: This uses the same environment variable as AgentOS, so if you're running both on the same machine, you only need to set it once. The token will be automatically loaded when the application starts.

##### Option 2: UI Configuration

1. In the left sidebar, locate the "Auth Token" section
2. Click on the token field to edit it
3. Enter your authentication token
4. The token will be securely stored and included in all API requests

> **Security Note**: Authentication tokens are stored locally in global store and are included as Bearer tokens in API requests to your AgentOS instance.

#### 4. Test the Connection

Once you've configured the endpoint:

1. The Agent UI will automatically attempt to connect to your AgentOS
2. If successful, you'll see your agents available in the chat interface
3. If there are connection issues, check that your AgentOS is running and accessible. Check out the troubleshooting guide [here](https://docs.agno.com/faq/agentos-connection)

### Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

### License

This project is licensed under the [MIT License](./LICENSE).

---

## parket-ai-squad/eas-v2-ui

## Agent UI

A modern chat interface for AgentOS built with Next.js, Tailwind CSS, and TypeScript. This template provides a ready-to-use UI for connecting to and interacting with your AgentOS instances through the Agno platform.

<img src="https://agno-public.s3.us-east-1.amazonaws.com/assets/agent_ui_banner.svg" alt="agent-ui" style="border-radius: 10px; width: 100%; max-width: 800px;" />

### Features

- 🔗 **AgentOS Integration**: Seamlessly connect to local and live AgentOS instances
- 💬 **Modern Chat Interface**: Clean design with real-time streaming support
- 🧩 **Tool Calls Support**: Visualizes agent tool calls and their results
- 🧠 **Reasoning Steps**: Displays agent reasoning process (when available)
- 📚 **References Support**: Show sources used by the agent
- 🖼️ **Multi-modality Support**: Handles various content types including images, video, and audio
- 🎨 **Customizable UI**: Built with Tailwind CSS for easy styling
- 🧰 **Built with Modern Stack**: Next.js, TypeScript, shadcn/ui, Framer Motion, and more

### Version Support

- **Main Branch**: Supports Agno v2.x (recommended)
- **v1 Branch**: Supports Agno v1.x for legacy compatibility

### Getting Started

#### Prerequisites

Before setting up Agent UI, you need a running AgentOS instance. If you haven't created one yet, check out our [Creating Your First OS](/agent-os/creating-your-first-os) guide.

> **Note**: Agent UI connects to AgentOS instances through the Agno platform. Make sure your AgentOS is running before attempting to connect.

#### Installation

#### Automatic Installation (Recommended)

```bash
npx create-agent-ui@latest
```

#### Manual Installation

1. Clone the repository:

```bash
git clone https://github.com/agno-agi/agent-ui.git
cd agent-ui
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Connecting to Your AgentOS

Agent UI connects directly to your AgentOS instance, allowing you to interact with your agents through a modern chat interface.

> **Prerequisites**: You need a running AgentOS instance before you can connect Agent UI to it. If you haven't created one yet, check out our [Creating Your First OS](https://docs.agno.com/agent-os/creating-your-first-os) guide.

### Step-by-Step Connection Process

#### 1. Configure the Endpoint

By default, Agent UI connects to `http://localhost:7777`. You can easily change this by:

1. Hovering over the endpoint URL in the left sidebar
2. Clicking the edit option to modify the connection settings

#### 2. Choose Your Environment

- **Local Development**: Use `http://localhost:7777` (default) or your custom local port
- **Production**: Enter your production AgentOS HTTPS URL

> **Warning**: Make sure your AgentOS is actually running on the specified endpoint before attempting to connect.

#### 3. Configure Authentication (Optional)

If your AgentOS instance requires authentication, you can configure it in two ways:

##### Option 1: Environment Variable (Recommended)

Set the `OS_SECURITY_KEY` environment variable:

```bash
# In your .env.local file or shell environment
NEXT_PUBLIC_OS_SECURITY_KEY=your_auth_token_here
```

> **Note**: This uses the same environment variable as AgentOS, so if you're running both on the same machine, you only need to set it once. The token will be automatically loaded when the application starts.

##### Option 2: UI Configuration

1. In the left sidebar, locate the "Auth Token" section
2. Click on the token field to edit it
3. Enter your authentication token
4. The token will be securely stored and included in all API requests

> **Security Note**: Authentication tokens are stored locally in global store and are included as Bearer tokens in API requests to your AgentOS instance.

#### 4. Test the Connection

Once you've configured the endpoint:

1. The Agent UI will automatically attempt to connect to your AgentOS
2. If successful, you'll see your agents available in the chat interface
3. If there are connection issues, check that your AgentOS is running and accessible. Check out the troubleshooting guide [here](https://docs.agno.com/faq/agentos-connection)

### Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

### License

This project is licensed under the [MIT License](./LICENSE).

---

## parket-center

## parket-center

> Central do Cliente. Cliente final ve sua obra: cronograma, itens contratados, definicoes tecnicas, docs, fotos, financeiro.

### O que faz

- **Cronograma+lista** com numeracao 1.1 igual PDF orcamento
- **Itens contratados** com aba Financeiro (parcelas, boleto, pix via docusign)
- **Definicoes tecnicas** por servico (Porsche-style responsivo mobile)
- **Documentos** agregado (docs-unificados: mapa + executivo + docs)
- **Fotos** selecionadas com ambiente + material
- **Mapa da obra** visivel pro cliente
- **URL por center_token** — cliente abre sem login pelo link

### Como se interliga com o ecossistema

- **Le de:** `gestao.itens` (deriva sempre, nunca hardcodar CRONOGRAMA_OVERRIDE), `center.docs_fiscais`, propostas Valoria, `compras` (financeiro)
- **Escreve em:** center.definicoes, feedback do cliente
- **E usado por:** cliente final via link publico com token

### Stack

React + Vite + Tailwind (mobile-first), FastAPI backend, PG local schemas `center.*` e `gestao.*`, deploy stack `parket-center`

### Onde uso IA

Nao usa IA diretamente. Definicoes tecnicas puxam de catalogo automatico.

### Notas

- Layout tec do Catalogo-parket com paginas sequenciais por item
- Financeiro = ABA do card 01 CONTRATO, nao card separado
- Editor de contrato admin (`/admin/contrato`) gera clausulas versionadas

---

## parket-chat

## Parket Chat

Backend único de mensagens da Parket + widget de chat embutível nas 9 plataformas de setor
(homebroker, valor, compras, gestao, projetos, instala, verifica, contrato, core `.parket.works`).

O chat **não é um site separado**: é um ícone flutuante dentro de cada plataforma que abre um
painel estilo Slack. Todas as plataformas conversam com o mesmo backend.

### Como rodar

```bash
npm install
npm start        # builda o frontend (esbuild) e sobe tudo na porta 3000
```

- Exemplo de plataforma com o widget embutido: **http://localhost:3000/exemplo-plataforma.html**
- Usuários de teste: `ana@parket.com.br`, `carla@parket.com.br`, `elisa@parket.com.br`, …
  (ver `server/repository.js`) — senha de todos: **`parket123`**

Scripts:

| Comando         | O que faz                                              |
|-----------------|--------------------------------------------------------|
| `npm run build` | Empacota o React em `public/app.js` via esbuild        |
| `npm start`     | Build + servidor Express/Socket.io na porta 3000       |
| `npm test`      | Testes ponta-a-ponta com Playwright (chromium headless)|

### Os dois tipos de conversa

#### 1. Conversa de OBRA/CLIENTE — regra de visibilidade (o coração do sistema)

Cada obra tem **uma** conversa (`obra_threads`), criada quando alguém a abre pela primeira vez
(botão **"Nova conversa de obra"** → autocomplete das obras que **já existem** no banco da Parket).

**Quem vê a conversa de uma obra?** Somente quem está em `obra_members`:

- **Quem criou** a conversa entra como membro automaticamente.
- **Marcar `@Setor` ou `@Pessoa` numa mensagem da obra adiciona esse setor/pessoa como membro.**
  A partir daí, ele vê **todo o histórico da obra desde o começo** (como entrar num grupo) e
  recebe as próximas mensagens em tempo real (evento `obra:acesso` + entrada na room).
- Um usuário tem acesso se **o setor dele** está em `obra_members` **OU** se **ele próprio** está.
- Quem não foi marcado **não vê nada** daquela obra — a regra é validada **no servidor** em todas
  as rotas REST e eventos de socket (`GET /api/messages?obra=ID` devolve **403** para não-membros).

#### 2. Conversa entre setores

- Canais gerais `#geral` e `#avisos` (todos veem).
- Canal privado do próprio setor (`#homebroker`, `#valoria`, …) — isolamento validado no servidor.
- Mensagens diretas (DM) entre quaisquer duas pessoas.
- Aqui, marcar `@Setor`/`@Pessoa` **apenas notifica** (badge laranja) — não altera acesso.

### Conectar ao banco real da Parket

O chat **não duplica** usuários, setores nem obras. Todo o acesso a esses dados está isolado em
**`server/repository.js`** — procure os comentários **`// TODO Parket: conectar ao banco real`**.

Funções a implementar com SQL real (exemplos de query já no arquivo):

- `getUser(id)`, `getUserByEmail(email)` (esta última só para o login de teste)
- `getSectors()`, `getSector(id)`, `getUsers()`, `getUsersBySector(sectorId)`
- `getObras(query)` — busca usada no **autocomplete de obras**
- `getObra(id)`

As **tabelas novas do chat** (`channels`, `dms`, `obra_threads`, `obra_members`, `messages`,
`reads`, `mentions`) ficam em SQLite (`data/chat.db`) via `server/chatdb.js`. Se preferir tê-las
no Postgres da empresa, troque apenas as queries desse módulo — o resto do código não conhece SQLite.

### Como embutir o widget

#### Forma 1 — `<script>` + `<div>` (recomendada; ver `public/exemplo-plataforma.html`)

```html
<div id="parket-chat"></div>
<script src="https://chat.parket.works/app.js" data-parket-chat
        data-api="https://chat.parket.works"
        data-token="<JWT emitido pelo SSO da plataforma>"></script>
```

Sem `data-token`, o widget mostra o login de teste local. Também dá pra montar por código:

```html
<script src="https://chat.parket.works/app.js"></script>
<script>ParketChat.init({ token: jwtDoUsuario, api: 'https://chat.parket.works' });</script>
```

#### Forma 2 — `<iframe>`

```html
<iframe src="https://chat.parket.works/widget.html#token=<JWT>"
        style="position:fixed;right:24px;bottom:24px;width:760px;height:560px;
               border:0;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.35);z-index:99999">
</iframe>
```

No modo iframe o painel fica sempre aberto (o botão flutuante fica por conta da página).
O servidor já envia `Content-Security-Policy: frame-ancestors` liberando `*.parket.works`.

### SSO por JWT

A pessoa já está logada na plataforma do setor. A plataforma assina um JWT com o **mesmo
`JWT_SECRET`** do chat, com o payload:

```json
{ "id": <id do usuário no banco da Parket> }
```

…e o passa ao widget (`data-token` / `ParketChat.init` / fragmento do iframe). O chat valida o
token e carrega o usuário via `repository.getUser(id)`. O login por e-mail/senha
(`POST /api/login`) existe **somente para testes locais**.

### API

| Rota | Descrição |
|---|---|
| `POST /api/login` | Só teste local → `{ token, user }` |
| `GET /api/bootstrap` | `{ me, sectors, users, channels, dms, obras_visiveis, online }` com `unread`/`mentions` por conversa |
| `GET /api/obras/buscar?q=…` | Autocomplete de obras do sistema |
| `POST /api/obras/:obraId/abrir` | Cria/retorna a thread da obra; quem abre vira membro |
| `GET /api/messages?channel=ID \| dm=ID \| obra=ID` | Últimas 100 mensagens (**403** sem acesso) |
| `POST /api/dms { userId }` | Cria/retorna a DM com o usuário |
| `POST /api/read { convType, convId, lastMsgId }` | Persiste última mensagem lida |
| `POST /api/upload` (multipart) | → `{ file_path, file_name, file_type }` (máx. **15 MB**) |

Todas as rotas (exceto login) exigem `Authorization: Bearer <jwt>`.

**Socket.io** (JWT no handshake, `auth: { token }`): rooms `channel:<id>`, `dm:<id>`,
`user:<id>`, `sector:<id>`, `obra:<threadId>`. Eventos:

- `message:send` → persiste, processa menções (em obra: concede acesso), emite `message:new` na room
- `message:new`, `obra:acesso` (setor/pessoa ganhou acesso — sidebar atualiza na hora),
  `obra:membros`, `dm:new` / `dm:join`, `presence` / `presence:all`, `read:update`

Limites: mensagens **4000 caracteres**, uploads **15 MB** — aplicados no servidor.

### Produção

- **`JWT_SECRET`** via variável de ambiente (obrigatório — o mesmo usado pelas plataformas):
  `JWT_SECRET=... PORT=3000 node server/index.js`
- **HTTPS** com Nginx/Caddy na frente (o Socket.io precisa de upgrade de WebSocket):

  ```nginx
  server {
    server_name chat.parket.works;
    location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
    client_max_body_size 16m;
  }
  ```

- **pm2** para manter o processo vivo:

  ```bash
  npm run build
  JWT_SECRET=... pm2 start server/index.js --name parket-chat
  pm2 save
  ```

### Testes

```bash
npm test
```

Suíte Playwright (chromium headless) com 3 usuários de setores diferentes em contextos isolados:
histórico da obra visível ao setor recém-marcado, 403 para não-membros (API direta), menção a
pessoa e a setor, badges vermelho/laranja (inclusive com o widget fechado), #geral em tempo real,
DM com presença e isolamento de canal de setor (403).

---

## parket-contratos

## parket-contratos

> App de contratos (`contrato.parket.works`) — assinatura eletronica
> via DocuSign + pagamento inicial (Pix ou Boleto Itau) no mesmo fluxo.

### O que faz

Fluxo end-to-end de contrato:

1. **Slide 4 da proposta publica** grava `contrato_cliente` no Valoria
   E no Cloud (via api.parket.works). Redirect Space fica off ate
   cliente preencher.
2. **Editor de contrato** admin (`/admin/contrato`) edita HTML
   versionado em `contrato_clausulas` (parket-pg-local).
3. **Envelope DocuSign** gerado com PDF do contrato + slide de
   pagamento (Pix ou Boleto Itau v3).
4. **Cliente assina** no navegador (DocuSign JS embed).
5. **Webhook DocuSign** → grava compensacao durable → dispara perna 6
   do watcher → cria projeto no `parket-gestao` + parcelas no
   `parket-core`.
6. **Termo pagamento** (backend parket-docusign) baixa parcela ou
   marca boleto pago via webhook Itau.

Regra: **Novo Contrato manual removido.** Entrada so via HB (fonte
unica de card).

### Como se interliga com o ecossistema

- **Le de:** `parket-space2` (sim fechada → contrato), `parket-homebroker`
  (card ganho vira contrato), `contrato_clausulas` (versionadas).
- **Escreve em:** `parket-gestao` (projeto novo via perna 6), 
  `parket-core` (parcelas, comissao, RT, impostos), `parket-docusign`
  (envelope), Itau (Pix/boleto).
- **Depende de:** DocuSign JS embed, Itau API (Pix Recebimentos +
  Boletos v3), api.parket.works.
- **E usado por:** cliente final (assina no navegador),
  equipe comercial (acompanha status).

### Stack

- React + Vite frontend
- Backend leve compartilha `parket-docusign`
- Postgres schemas `contratos.*` e `core.*`
- Deploy stack `parket-contratos`, contrato.parket.works

### Onde uso IA

Nao diretamente. Regras de contrato sao juridicas e deterministicas.
Copy que vende (marketing tone) e reescrita manualmente.

### Como rodar localmente

```bash
cd apps/parket-contratos
cp .env.example .env
npm install && npm run dev
```

### O que aprendi

- **Copy que vende, nao juridica.** Pagina de cliente = mentalidade
  marketing+copy; fato contratual reframado como beneficio, nunca
  tom de alerta.
- **Sem travessao "—" em pagina visivel** e sem jargao juridico na
  camada de leitura (decisao de 21/08).
- **Contrato geral prestador** — F1 schema Cloud + OTP WhatsApp, F2
  termos versionados, F3 onboarding no Instala, F4 ativacao por obra
  no Iniciar com OTP, F5 UI gestao.
- **Chave RSA privada docusign** MORA fora do repo (bind mount).
  Removida do staging antes de subir.

---

## parket-core

## parket-core

> Financeiro da Parket: comissoes, RT, impostos, aprovacoes cross-plataforma,
> contas a pagar/receber, com UX inspirada no Nubank.

### O que faz

O **coracao financeiro da operacao**:

- **/aprovacoes** — fila unificada de aprovacoes (Contas a Receber,
  Prestadores, Compras, Terceiros). Fluxo cross-plataforma: quem pede
  fica no app de origem, quem aprova ve tudo aqui.
- **/pagamentos** — Atrasados / Hoje / Futuros, aba Terceiros pra
  pagar com comprovante, integracao boleto NF via Compras.
- **/recebimentos** — parcelas contrato, boleto/Pix, dar baixa, alterar
  vencimento, reenviar boleto.
- **/comissoes** — regras por vendedor (faixas por volume × RT), gate
  50% (sem retroativo), 28% guia unica de impostos.
- **/contratos** — contratos fechados, custos por obra, subida de compras/NF/frete.
- **/obras** — visao 360 do custo por obra (compras + NF + prestadores + comissao).

Foi um dos apps mais dificeis de construir porque envolve **regras de
negocio muito especificas da Parket** (comissao com gate, retencao
tecnica de 10% no liquido, impostos consolidados) e **integra 6+ outros
apps** via write-back (nao duplica workflow — le cross-schema e
escreve de volta na origem).

### Como se interliga com o ecossistema

- **Le de:** `parket-contratos` (contratos assinados → parcelas),
  `compras-app` (compras aprovadas → aparecem na obra),
  `parket-nfe` (NF-e → contas a pagar),
  `parket-gestao` (obras, prestadores, custos terceiros).
- **Escreve em:** `parket-chat` (notif de aprovacao pendente),
  tabelas de origem (aprovacao dispara update no schema origem, nao aqui).
- **Depende de:** `parket-pg-local` schema `core.*`, Docusign webhook
  → perna 6 do watcher.
- **E usado por:** financeiro (contas), CEO (aprovacoes), vendedores
  (comissoes acumuladas).

### Stack

- **Frontend:** React + Vite + Tailwind, identidade visual padrao Parket
  (SO Parket) — mesmo look-and-feel do gestao
- **Backend:** compartilha o backend do parket-gestao (namespace `/core`)
- **Banco:** Postgres local schema `core.*` (lancamentos, aprovacoes_notif_log,
  comissoes, regras, retencoes, impostos)
- **Deploy:** Docker Swarm stack `parket-core`
- **Bibliotecas:** react-hook-form, decimal.js (calculos financeiros
  sem erro de float), tanstack table

### Onde uso IA

Nao usa IA diretamente. Regras de negocio sao deterministicas
(comissao com gate, RT 10%, 28% impostos) — nao ha valor em jogar
Claude aqui.

### Como rodar localmente

```bash
cd apps/parket-core
cp .env.example .env
npm install
npm run dev  # frontend
# backend roda dentro do parket-gestao/backend, namespace /api/core
```

### O que aprendi construindo isso

- **Espelho + write-back, nao duplicacao.** Core nao replica o workflow
  de outros apps: le cross-schema e aprovacao escreve de volta na tabela
  origem. Isso mantem 1 fonte de verdade por dominio.
- **`sql STABLE + SECURITY DEFINER` sao inlineadas pelo Postgres.**
  `current_user` vaza do caller. Usar VOLATILE ou PL/pgSQL em checks
  de role. Aprendi debugando permissao "invisivel".
- **`psql -tAc` imprime command tag no stdout.** `INSERT 0 0` conta como
  linha mesmo com 0 rows afetados. Contar `stdout | wc -l` cru = falso
  positivo. Sempre filtrar por padrao.
- **Chat notif de aprovacoes:** poll 60s + bot user + dedup em
  `core.aprovacoes_notif_log`. Sem pg_net (que exige extension nao
  disponivel no Cloud). Escala trocando o callback.

---

## parket-docusign

## parket-docusign

> Backend de assinatura eletronica DocuSign + pagamento (Pix +
> Boleto Itau sandbox e prod). Serve o parket-contratos e
> parket-nfe.

### O que faz

Servico dedicado que orquestra:

- **DocuSign envelope** — cria envelope com PDF + slide pagamento,
  encaminha assinatura, grava webhook.
- **Pix Recebimentos Itau** — cria cobranca instantanea, poll de
  status.
- **Boleto Itau v3** — emite boleto, gera PDF, associa a parcela.
- **Webhook Itau** — recebe baixa e grava compensacao durable no
  Cloud (via parket-core.perna 6 e perna 7 do watcher).
- **Termo pagamento** — endpoint `/pix` e `/boleto` que o termo-v2.html
  chama pos-aceite do cliente.

### Como se interliga com o ecossistema

- **Le de:** `parket-contratos` (contrato assinado gera envelope),
  `parket-space2` (sim fechada), `parket-nfe` (NF gera boleto).
- **Escreve em:** `core.lancamentos` (parcelas, baixa), `parket-gestao`
  (projeto novo pos-assinatura), webhook Itau grava compensacao.
- **Depende de:** DocuSign API + chave RSA privada (bind mount fora
  do repo), Itau API (2 padroes: sandbox antigo + Boleto v3 prod).

### Stack

- FastAPI + Python
- Postgres schema `docusign.*` e `core.*`
- Deploy stack `parket-docusign`

### Onde uso IA

Nao usa.

### Como rodar localmente

```bash
cd apps/parket-docusign
cp .env.example .env  # ITAU_CLIENT_ID/SECRET, DOCUSIGN_INTEGRATION_KEY etc.
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### O que aprendi

- **Itau tem 2 padroes de sandbox.** APIs antigas: `/sandboxapi/` +
  `x-sandbox-token`. Novas (Boleto com Pix): path 1:1 prod +
  `Authorization: Bearer`. Nunca assumir universal.
- **Webhook grava compensacao durable.** Serviro nao pode ficar
  esperando webhook em memoria; se cair, perde. Grava e watcher
  processa depois.
- **Chave RSA privada NUNCA no repo.** Vive em bind mount
  `/etc/parket/docusign-private.key` com chmod 600, montada no
  container so quando faz falta.

---

## parket-fiscal

## parket-fiscal

> App do fiscal de obra (`verifica.parket.works`). O fiscal aprova
> material, faz vistorias, tira fotos, resolve ocorrencias e valida
> instaladores.

### O que faz

Interface mobile-first pro fiscal Parket que visita as obras:

- **Home / Hoje** — obras em Acompanhamento hoje (coluna, nao funil
  inteiro), obras online no calendario, ordenacao inteligente.
- **Card da obra** — abas: Documentos (visor in-app), Fiscal (laudos +
  vistorias + ocorrencias), Prestadores, Validacao, Historico.
- **Validacao fiscal** — Instala manda pedido de material → Verifica
  aprova/reprova → volta pro instalador com feedback do fiscal.
- **Laudos** — multiplos por obra (Parket + Cliente/aditivo), campo
  livre pra distinguir reparos.
- **Ocorrencias** — historico + resolver do Instala. Fiscal cria
  crise so pelo alerta (Ocorrencias virou historico).
- **Camera in-app** — visor fullscreen com lista, contador, arraste,
  compressao. Nunca abre aba de navegador.
- **Ditado por voz** em todos os campos de texto.
- **Fila offline** com IndexedDB pros envios (backoff + badge +
  atencao).
- **Meus custos** — lancamentos do fiscal (hotel, km, litro), memoria
  de valores por lancamento.
- **HIST** — laudos concluidos + abrir PDF.
- **Chip endereco** — Maps, Waze (`navigate=yes`), Copiar (sem
  WhatsApp, decisao de 04/09).

### Como se interliga com o ecossistema

- **Le de:** `parket-gestao` (agendamento, obras, laudos, prestadores),
  `parket-pg-local` schema `fiscal.*`.
- **Escreve em:** `gestao.eventos` (payload fiscal), `parket-chat`
  (notif de crise ou ocorrencia), `parket-instala` (feedback do
  fiscal pro instalador).
- **Depende de:** api.parket.works (auth), Web Speech (ditado),
  MediaDevices.getUserMedia (camera).
- **E usado por:** equipe de fiscais de obra.

### Stack

- **Frontend:** React + Vite + Tailwind, PWA
- **Backend:** compartilha `parket-gestao/backend` (namespace `/fiscal`)
- **Banco:** Postgres local schemas `fiscal.*` e `gestao.*`
- **Deploy:** stack `parket-fiscal` (verifica.parket.works)
- **Bibliotecas:** IndexedDB (fila offline), radix-ui, react-router,
  browser-image-compression

### Onde uso IA

- **Ditado por voz pt-BR** via Web Speech API (browser-side).
- **Analise de fotos** — nao usa Claude ainda; historico versionado
  das anotacoes (feito em 27/08).

### Como rodar localmente

```bash
cd apps/parket-fiscal
cp .env.example .env
npm install
npm run dev
```

### O que aprendi construindo isso

- **App de campo nao abre aba.** Documento tem que abrir num visor
  fullscreen dentro do proprio app, com lista/contador/arraste.
  Abrir aba nova em mobile perde o contexto e o fiscal desiste.
- **Zoom `--pkz` vs 100vh:** `body{zoom}` + Chrome sem compensar `vh`
  = tela corta no meio e vao vazio embaixo. Nunca `100vh` cru.
- **Fetch com timeout+retry e erro com proximo passo.** Fiscal em obra
  tem rede ruim; falha silenciosa deixa ele perdido. Toda chamada
  fala o que aconteceu e o que fazer.
- **Fiscal ve todas as obras dele** (ramo `details.fiscais` na
  `vw_instala_minhas_obras`), nao so as suas atribuidas manualmente.
- **Aviso de pendencia so apos o evento.** Chip "nao foi feito" so
  aparece depois que o fluxo rodou 1x; nunca default da lista.

---

## parket-gestao

## parket-gestao

> Core operacional da Parket: obras, projetos, equipes, reunioes, tarefas,
> cronograma, fiscal, custos de terceiros.

### O que faz

E o **hub interno de operacoes**. Rodando em `gestao.parket.works`, aqui
vive quase tudo que nao e vendas (que fica no `parket-homebroker`) ou
financeiro puro (que fica no `parket-core`):

- **/obras** — kanban de projetos em andamento, cronograma por servico,
  aba Fiscal (laudos + vistorias + ocorrencias), aba Projetos (Mapa +
  Anteprojeto + Executivo), aba Documentos (Drive nativo),
  Registro fotografico com abas Fiscal/Instalador.
- **/reuniao** — grava reuniao semanal, `parket-whisper` transcreve,
  Claude extrai resumo + tarefas por bloco, e o usuario aprova pra
  postar no chat da obra.
- **/tarefas** — kanban PDCA de tarefas de reuniao (Entrada, Analisando,
  Fazendo, Finalizado) com detalhe estilo Trello.
- **/equipes** — gestao de acessos: cria/reseta senha, atribui obra a
  fiscal ou instalador, escopo de itens por prestador.
- **/prestadores** — score, avaliacoes, mancadas, bloqueio.
- **/crises** — kanban de 4 colunas + modal detalhe com FormatBar rich text.
- **/definicoes** — editor por servico (PISO, DECK, FORRO, PAINEL, PORTA,
  MARCENARIA, REVESTIMENTO) com obrigatorias/essenciais/sugestoes cruzadas.
- **/anteprojeto** — geracao automatica de prancha A1 via IA
  (item → FloorParams via catalogo).
- **/custos** — Custos de Terceiros com 6 etapas (hotel, km, litro,
  memoria de valores, PDF ordem de pagamento).

E o app com mais funcionalidade da Parket — funciona como o **sistema
operacional da operacao**.

### Como se interliga com o ecossistema

- **Le de:** `parket-homebroker` (cards ganhos que viram projetos),
  `parket-space2` / Valoria (sims fechadas → gestao.projetos + gestao.itens),
  `parket-core` (financeiro visivel na aba Financeiro),
  `parket-whisper` (transcricao de audio).
- **Escreve em:** `parket-chat` (tarefas + notif de aprovacao),
  `producao-app` (OP automatica na assinatura + liberacao pra fabrica),
  `parket-center` (Central do Cliente espelha itens).
- **Depende de:** `parket-pg-local` (fonte de verdade), `api.parket.works`
  (GoTrue auth), `parket-whisper` (self-hosted).
- **E usado por:** todos os setores internos. E o app mais aberto do
  ecossistema.

### Stack

- **Frontend:** React + Vite + Tailwind, TypeScript
- **Backend:** FastAPI (Python 3.11)
- **Banco:** Postgres local schemas `gestao.*` e `ops.*`
- **Deploy:** Docker Swarm stack `parket-gestao`, dominio `gestao.parket.works`
- **Auth:** GoTrue via `api.parket.works`
- **Bibliotecas:** SQLAlchemy, Pydantic, tanstack query, radix-ui,
  react-router, react-pdf, xlsx (importacao planilha), openpyxl,
  faster-whisper (client), anthropic

### Onde uso IA (Claude)

- **Extracao de PDFs escaneados** (18 PDFs virarem linhas estruturadas
  via document blocks)
- **Reuniao semanal:** `parket-whisper` transcreve audio, Claude extrai
  resumo + tarefas por bloco, aprovar posta no chat
- **Backfill de projetos flat** para hierarquico (~148 projetos migrados
  com ajuda de Claude)
- **Cronograma:** Teca sugere prazo/equipe pros 380 projetos sem cronograma
- **Detector de crises**: identifica por contexto conversacional

Modelo default: Claude Opus 4.7 (extracao pesada), Sonnet 4.6 (bulk).

### Como rodar localmente

```bash
cd apps/parket-gestao
cp backend/.env.example backend/.env   # preencher SUPABASE_URL, SERVICE_KEY, ANTHROPIC_API_KEY
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# em outro terminal
cd frontend && npm install && npm run dev
```

### Estrutura resumida

```
parket-gestao/
  backend/
    app/
      main.py                 # FastAPI entry
      hb_drive.py             # HB Drive: pasta cliente + upload de anexos
      docs_unificados.py      # agregador (Mapa + Executivo + Docs)
      anteprojeto_defs.py     # geracao automatica de prancha via IA
      reuniao.py              # reuniao → whisper → Claude
      crises.py               # kanban de crises
      custos.py               # Custos de Terceiros
      ...
    requirements.txt
  frontend/
    src/
      pages/
        Obras.tsx  Projeto.tsx  Equipes.tsx  Reuniao.tsx
        Crises.tsx  Custos.tsx  Tarefas.tsx  Definicoes.tsx
      components/
        DrivePanel.tsx  CronogramaPanel.tsx  ...
      lib/supabase.ts
    package.json
```

### O que aprendi construindo isso

- **Nao punir pra suporte, entregar self-service.** Fiscal precisando
  ver senha do instalador ganhou pagina propria; nao vira ticket pra mim.
- **Comentar codigo em portugues detalhado.** Codebase dessa escala com
  6 meses ja pede o "quando e porque", nao so o "o que". Aprendi na marra
  quando voltei ao codigo do docs_unificados e nao lembrava por que tinha
  filtro cross-dept.
- **Tombstone > delete.** `gestao.projetos_excluidos` bloqueia
  ressurreicao no sync. Merge de duplicados de 08/09 (93 fantasmas +
  NAROOMA fundido) so foi possivel com isso.
- **Central espelha, nunca hardcoda.** Central do Cliente deriva de
  `gestao.itens`; qualquer `CRONOGRAMA_OVERRIDE` quebra o vinculo com
  edicoes do gestao.

---

## parket-homebroker

## parket-homebroker

> CRM comercial da Parket. Kanban de vendas do funil inteiro, das novas
> oportunidades ate o contrato assinado. Fonte unica de criacao de
> cards no ecossistema.

### O que faz

- **Kanban de vendas** por setor (SDR, Comercial, Sucesso do Cliente)
  com etapas: Novas Oportunidades → Qualificado → Handoff → Analise
  do Gestor → Handoff-Com → Ganho.
- **CardDetail** com edicao de vendedor + orcamentista (admin), aba
  Amostras, aba Sucesso do Cliente, chip PDF proposta Valoria embutido.
- **Solicitar Orcamento** com metragem por produto — dispara demanda
  em `ops.cards_solicitacao` que o Valoria consome.
- **Handoff-com** ja mostra a proposta gerada (sem esperar aceite formal).
- **HB Drive** — pasta Google Drive por cliente, upload de anexo do
  vendedor vai direto pro Drive (nao pro Supabase), orcamento (PDF) sobe
  automaticamente. Card ganho move pasta de "Home Broker" pra "Projetos".
  Cron limpa perdidos >90d pra "_Arquivo" (nunca trash).
- **Analise de Custo** (frontend HB): painel na OrcamentoAprovacao.
- **Marketing HB**: sync Meta Ads insights, CAC por etapa, dashboard
  vendedor.
- **Social Selling** — 3 abas kanban dos pipelines de arquitetos.
- **Contatos e Relacionamento** no estilo atendimento (contadores +
  filtro grupos/clientes).
- **HB Raport** — dashboard vendedor com CAC por etapa.

Regra dura: **card novo nasce SO no homebroker.** Todos os outros
apps consomem via sync, mas nenhum cria card por conta propria
(evita orfaos).

### Como se interliga com o ecossistema

- **Le de:** WhatsApp (novos leads via WAHA), Meta Ads (marketing_ads_insights),
  planilha Google (arquitetos).
- **Escreve em:** `ops.cards_solicitacao` (demanda pro Valoria),
  `kanban_cards` (fonte de verdade de card), Meta CAPI (Qualificado →
  Purchase), Google Ads (Click Conversion), Google Drive (pasta cliente).
- **Depende de:** `parket-pg-local`, api.parket.works, WAHA, Meta APIs,
  Google Drive Apps Script v2.2.
- **E usado por:** vendedores, SDR, gestores comerciais.

### Stack

- **Frontend:** React + Vite + Tailwind
- **Backend:** FastAPI Python
- **Banco:** Postgres local schemas `ops.*` e `kanban.*`
- **Deploy:** stack `parket-homebroker`, hb.parket.works
- **Bibliotecas:** anthropic (analise de leads), google-api-python-client,
  requests (Meta APIs)

### Onde uso IA (Claude)

- **Analise IA da qualidade dos leads** (chegando + agendando):
  Claude classifica prioridade e sugere proxima acao.
- **Teca Blacklist:** LLM confundia assinatura da equipe com nome do
  cliente (319 cards viraram "Parket" em 28/08). Blacklist + placeholder
  guard resolveram.

### Como rodar localmente

```bash
cd apps/parket-homebroker
cp backend/.env.example backend/.env
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
cd ../frontend && npm install && npm run dev
```

### O que aprendi construindo isso

- **Atribuicao Meta rejeita event_time > 7d.** Backfill retroativo (40
  leads qualificados 111→152 em 29/08) tem gate rigido. Pixel e sempre
  producao — mesmo em teste local.
- **Contratos fake RANIERE-BULK-*:** envelope forcava card comercial
  pra ganho a cada 3min. So Casa Miragem era erro — os outros 8 sao
  fechamentos reais.
- **HB Drive: sessao resumable > direct upload.** Anexo >35MB
  quebrava direct upload; fluxo com sessao resumable resolveu (sem
  limite, sem Supabase intermediario).

---

## parket-insta

## parket-insta

> InstaParket: feed interno estilo Instagram por obra. Time de Sucesso do Cliente posta na hora, o cliente ve carrossel+video via link, com notificacao no chat.

### O que faz

- **Feed interno** (`insta.parket.works`) com perfil por cliente
- **Cliente ve so o dele** via link com `center_token`
- **Curadoria do time de Sucesso do Cliente** — aba Acompanhamento no `gestao.parket.works`
- **Notificacoes** — post/comentario → chat da obra (parket-chat)
- **Posts** com carrossel + video, curtir, comentar
- **Endpoints** `/api/insta/*` no gestao API

### Como se interliga com o ecossistema

- **Le de:** `insta.posts`, `insta.midias`, `kanban_cards` pra vincular cliente
- **Escreve em:** `parket-chat` (notificacoes)
- **Depende de:** api.parket.works, Supabase Storage (midia)

### Stack

React + Vite (mobile-first), backend no gestao API, schema `insta.*` no PG local, deploy stack `parket-insta`

### Onde uso IA

Nao usa IA. Curadoria e humana.

---

## parket-mkt

## parket-mkt

> Marketing: pipeline Meta Ads + Google Ads + CAPI + analise IA de qualidade de leads.

### O que faz

- **Sync Meta Ads insights** (gasto por campanha/dia)
- **CAPI Qualificado → Meta** com backfill retroativo (gate 7 dias)
- **CAPI Ganho → Purchase** com backfill 90d
- **Google Ads Click Conversion** (HTTPS pull)
- **CAPI CTWA** com backfill historico + metadata
- **Analise IA da qualidade dos leads** (chegando + agendando)
- **HB Raport** — dashboard vendedor + CAC por etapa

### Como se interliga com o ecossistema

- **Le de:** Meta Graph API, Google Ads API, WhatsApp CTWA referrals
- **Escreve em:** `marketing_ads_insights` no PG local, evento pixel Meta CAPI
- **Depende de:** `parket-homebroker` (funil), Anthropic (analise qualidade)

### Stack

Python (scripts + FastAPI), Postgres schema `mkt.*`, deploy stack `parket-mkt`

### Onde uso IA

Claude Sonnet 4.6 pra analisar contexto do WhatsApp e classificar prioridade do lead.

### Notas

CAC por campanha depende de ter campaign_id no card (#1655).

---

## parket-nfe

## parket-nfe

> App fiscal (`fiscal.parket.works`) pro responsavel fiscal subir XML NF-e da
> Parket. NAO confundir com `parket-fiscal` (fiscal de obra em
> verifica.parket.works).

### O que faz

Interface simples pra sobra fiscal manual do ERP:

- **Etapa 1** — responsavel fiscal sobe XML NFe
- **Etapa 2** — parser XML valida chave, extrai dados, vincula obra
- **Etapa 3** — aba NFe aparece na obra do parket-core (contas a
  pagar/comissao) 
- **Etapa 4** — NFe visivel na Central do Cliente (parket-center)

### Como se interliga com o ecossistema

- **Le de:** XML enviado pelo responsavel fiscal, obras do `parket-core`
- **Escreve em:** `nfe.notas`, `core.lancamentos` (contas a pagar
  categoria NF-), `center.docs_fiscais`
- **Depende de:** api.parket.works, parser XML nfe brasileiro
- **E usado por:** responsavel fiscal

### Stack

- FastAPI (Python), lxml, xmltodict
- React + Vite frontend
- Postgres schema `nfe.*`
- Deploy stack `parket-nfe`, dominio `fiscal.parket.works`

### Onde uso IA

Nao usa. Parser XML e deterministico.

### Como rodar localmente

```bash
cd apps/parket-nfe
cp .env.example .env
pip install -r requirements.txt && uvicorn app.main:app --reload
```

---

## parket-rh

## Parket RH — DDL + Migração

### Estrutura

```
sql/
  001_schema_rh.sql            # Identidade, Org, Colaboradores, Contratos, Admissão
  002_schema_rh_operacao.sql   # Ponto, Banco horas, Férias, Folha, Desligamento, Treinamento, Avaliação, eSocial, Notificações
  003_schema_signer.sql        # Assinatura PAdES + TSA modular
  004_rls_policies.sql         # Row Level Security (admin/rh/gestor/colaborador)

scripts/
  migrate_admissoes.py         # Importa admissoes.xlsx → rh.colaboradores + rh.contratos
```

### Aplicar o schema

```bash
# Schemas + tabelas + triggers
SUPABASE_TOKEN=sbp_xxx
for f in sql/001_schema_rh.sql sql/002_schema_rh_operacao.sql sql/003_schema_signer.sql sql/004_rls_policies.sql; do
  echo ">>> $f"
  curl -s -X POST "https://api.supabase.com/v1/projects/<SUPABASE_PROJECT_REF>/database/query" \
    -H "Authorization: Bearer $SUPABASE_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$(python3 -c "import json; print(json.dumps({'query': open('$f').read()}))")"
  echo
done

# Expor schemas no PostgREST (uma vez só)
curl -X PATCH "https://api.supabase.com/v1/projects/<SUPABASE_PROJECT_REF>/postgrest" \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"db_schema":"public,graphql_public,core,rh,signer","db_extra_search_path":"public, extensions, core, rh, signer"}'
```

### Importar a base do Convenia

```bash
export SUPABASE_MGMT_TOKEN=sbp_xxx
python3 scripts/migrate_admissoes.py --dry-run        # preview, não escreve
python3 scripts/migrate_admissoes.py                  # executa de fato
```

### Mapa de tabelas (50)

#### Schema `rh`
- **Identidade**: `app_users`
- **Catálogos eSocial**: `cbos`, `lotacoes_tributarias`, `rubricas`
- **Organização**: `departamentos`, `times`, `cargos`
- **Pessoa**: `colaboradores`, `dependentes`, `dados_bancarios`, `documentos_pessoais`
- **Vínculos**: `contratos`, `contrato_alteracoes`, `beneficios`
- **Admissão**: `admissoes`, `admissao_documentos`
- **Ponto**: `escalas`, `escala_horarios`, `colaborador_escala`, `batidas_ponto`, `justificativas_ponto`, `banco_horas_movimentos`, `banco_horas_saldos`
- **Férias**: `ferias_periodos_aquisitivos`, `ferias_periodos_concessivos`, `ferias_solicitacoes`
- **Folha**: `competencias`, `folhas_pagamento`, `holerites_lotes`, `holerites`, `holerite_eventos`, `adiantamentos`
- **Desligamento**: `desligamentos`, `checklist_templates`, `checklist_template_itens`, `checklist_execucoes`, `checklist_execucao_itens`, `verbas_rescisorias`
- **Treinamentos**: `treinamentos_catalogo`, `trilhas`, `trilha_treinamentos`, `colaborador_treinamentos`
- **Avaliação**: `ciclos_avaliacao`, `avaliacao_formularios`, `avaliacao_perguntas`, `avaliacoes`, `avaliacao_respostas`
- **eSocial**: `esocial_lotes`, `esocial_eventos`
- **Notificações**: `notificacoes_canal_preferencias`, `notificacoes`

#### Schema `signer`
- `documentos`, `signatarios`, `signatario_links`, `otp_codes`, `assinaturas`, `audit_logs`
- `certificados_parket`, `tsa_providers` (Strategy modular), `tsa_carimbos`

---

## parket-space-portal

## parket-space-portal

> Portal intranet da Parket (`space.parket.works`). Menu por
> departamento que decide quais apps o usuario ve.

### O que faz

- Login unico via GoTrue
- Home no formato `NavonaDashboard` com apps reais + Biblioteca
- Setor de cada usuario decide quais apps aparecem
- Tela admin de acessos (app ↔ departamento + overrides por usuario)
- Overrides por usuario NAO cria login — so libera app no portal
  (login precisa existir no auth GoTrue antes)
- Priority 150 no Traefik — nao colide com dashboard antigo

### Como se interliga com o ecossistema

- **Le de:** `user_profiles` (dept), `portal_apps` (catalogo de apps),
  `portal_departamentos_apps` (mapa dept→apps), `portal_overrides`.
- **Escreve em:** ele proprio — nao dispara nada em outros apps.
- **E usado por:** todos os funcionarios como ponto de entrada.

### Stack

- React + Vite + Tailwind
- Backend leve (Node ou FastAPI) so pra list/config
- Postgres schema `portal.*`
- Deploy stack `parket-space-portal`, space.parket.works

### Onde uso IA

Nao usa.

### Como rodar localmente

```bash
cd apps/parket-space-portal
npm install && npm run dev
```

### O que aprendi

- **Cadastro de fiscal exige 7 pontos.** Fiscal novo passa por 7
  registros em 3 bancos. Space "Overrides por usuario" nao cria
  login, so libera app no portal.
- Priority Traefik >100 evita conflito com Dashboard golden legado.

---

## parket-space2

## parket-space2

> Valoria (`valor.parket.works`), o workspace de propostas da Parket. Substitui o Space legado. Gera proposta detalhada por ambiente, com Teca IA embutida.

### O que faz

- **Wizard por servico** (PISO, DECK, FORRO, PAINEL, PORTA, MARCENARIA, REVESTIMENTO, ADEGA) com abas por subtipo/formato
- **Dimensao exclusiva** universal por proposta
- **Especie exclusiva + Acabamento exclusivo** — vira variacao no catalogo
- **Porta Exclusiva** — acabamento custom herdando modelo
- **Versailles + Paginacao Exclusiva** como abas fixas
- **BOM porta 15 listas Excel** — insumos escalam por m²/porta
- **Marcenaria ALL-IN** (sem perda/insumos/MO)
- **Renderer proposta publica** unificado (nao em GH Pages, nao em espelho Space)
- **Link estavel + fallback** via `meta.valoria_simulacao_id`
- **Aditivo com numeracao continua** da sim pai
- **Fechamento automatico** via webhook DocuSign

### Como se interliga com o ecossistema

- **Le de:** `orcamento_tabela_precos` (catalogo mestre), `kanban_cards` (HB), `ops.cards_solicitacao`
- **Escreve em:** `ops.simulacoes`, `ops.propostas`, chat da obra
- **E usado por:** orcamentistas, Teca IA, gestor comercial

### Stack

React + Vite + Tailwind (frontend gigante), FastAPI backend, PG local schemas `ops.*` e `teca.*`, deploy `parket-space2`, dominio `valor.parket.works`

### Onde uso IA

Teca IA embutida via `parket-valoria-teca` — chat direto no editor pra montar orcamento. Modelo Claude Opus 4.7.

### Notas

Fonte da verdade da proposta = ops.simulacoes.numero (numero de proposta). Card HB tem seq propria. Nao confundir.

---

## parket-teca

## parket-teca

> Agente IA (Claude) que monta orcamento inteiro por linguagem natural.
> Backend em FastAPI + Anthropic SDK. Substituiu `valoria_assistant`
> mobile (EAS) por uma solucao mais controlavel.

### O que faz

Voce fala com a Teca em portugues normal:

> "Preciso de 150m² de piso chevron carvalho europeu naturalle, 40m²
> de deck cumaru pro varandao, 3 portas camarao MDF pra suite. Cliente
> Bruno Colodetti, obra em Campinas."

E ela monta o orcamento completo com:

- Itens estruturados por ambiente
- BOM de insumos por m² (regra Excel base 5m² pra portas, escala por
  m²/porta, laminas 2.8/m² ou 1.2 pra laca)
- Dedup de portas identicas (consolida em linha "N PORTAS")
- Descritivos comerciais em CAPS por categoria
- Validacao de matematica (3 linhas somam ao valor_total do item)
- Preco por m² com regra da Parket (perda, RT, comissao)
- **Sem inventar dado**: se falta cor ou espécie, ela pergunta.

Tem uma state machine (`state_machine.py`) que garante ordem correta
das acoes: `pedir_dados_faltantes` → `montar_orcamento` → `revisar` →
`fechar_total`. Sem regex fallbacks (removidos na Teca 2.0), so
LLM decidindo com prompt bem escrito.

### Como se interliga com o ecossistema

- **Le de:** `teca.aprendizados` (memoria de decisoes anteriores),
  `orcamento_tabela_precos` (catalogo mestre no PG local), sim do
  Valoria em andamento.
- **Escreve em:** simulacao do Valoria (nova sim ou continuacao),
  `teca.audit` (log de decisoes pra revisao humana), chat da obra
  (posta rascunho pro time revisar).
- **Depende de:** Anthropic API (Claude Opus 4.7 ou Sonnet 4.6),
  `parket-whisper` (audio → texto quando Teca e chamada por audio),
  catalogo Cloud (PG local espelhado).
- **E usado por:** orcamentistas, gestor comercial, Teca
  Reuniao (extracao de tarefas), Teca Copiloto no chat.

### Stack

- **Backend:** FastAPI + Anthropic SDK (`anthropic==0.34+`)
- **Modelo:** Claude Opus 4.7 (`claude-opus-4-7`) como default;
  Sonnet 4.6 pra bulk; Haiku 4.5 pra background.
- **Banco:** Postgres local schema `teca.*`
- **Deploy:** stack `parket-teca`

### Onde uso IA (Claude)

E o app inteiro. Padroes que evolui:

- **Prompt Cortex + Conversational** (Teca 2.0): 2 personas
  distintas — Cortex resolve tarefa, Conversational conversa com
  usuario. Ambas leem `teca.aprendizados`.
- **Regra ambiguidade catalogo**: se 2+ produtos batem a descricao
  do cliente, Teca pergunta (nunca chuta).
- **buildAgentContext**: lista subtipo/cor quando NAO estao embutidos
  na especie + tags `[dim oculta]` `[metragem oculta]`. Sem isso a
  Teca perdia item TOBLERONE Tauari.
- **fable-5 → opus-4-7** (17/07 e depois 24/07 no assistente mobile):
  ganho notavel em decisao complexa.
- **Bulk approve/discard** na tela IA Review — humano corrige em lote.
- **Funcao "desfazer"** na conversa: usuario pode reverter proximo
  passo com 1 clique.

### Como rodar localmente

```bash
cd apps/parket-teca
cp .env.example .env  # preencher ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### O que aprendi construindo isso

- **Teca nao calcula valor, executor recalcula sempre.** LLM tem risco
  de erro de ponto flutuante em campo financeiro; toda soma passa
  por Python.
- **Cor RAW stale:** encodeCategoria reusava `meta.space_categoria_raw`
  sem checar cor atual → cor velha (Naturalle) reaparecia mesmo com
  cor="Mont Blanc" no banco. Fix: invalidar cache no update_item ao
  mudar subtipo/especie/cor/dim.
- **Perda=0 ponto final:** proposta emite "Metragem real Xm²." com
  ponto quando `p=0`. Sem isso a regex force-perda quebrava.
- **[CONTINUA] multi-turno**: lista grande por SERVICO precisa
  continuar em varios turnos — prompt explicito no fim se detectar
  truncamento.
- **Descritivo dos itens caia em silencio** (marcenaria/porta vazias):
  fix em `montar_orcamento` com validacao explicita.

---

## parket-valoria-teca

## parket-valoria-teca

> Backend FastAPI + Anthropic SDK que roda dentro do Valoria (Space2)
> como servico dedicado. Extraido do parket-teca pra ficar
> independente do agente conversacional generico.

### O que faz

Endpoints internos pro Valoria falar com Claude sem passar pelo Teca
generico:

- `POST /valoria/montar_orcamento` — recebe descricao livre + sim_id
  existente e retorna itens estruturados
- `POST /valoria/audit` — audit da proposta (detecta divergencia de
  matematica + alerta)
- `POST /valoria/descritivo` — geracao de descritivo de porta,
  revestimento, painel
- `POST /valoria/fechar_total` — fechar proposta no valor exato pedido

Mesmo modelo Anthropic (Claude Opus 4.7 default), mas prompts
especificos do dominio Valoria.

### Como se interliga com o ecossistema

- **Le de:** `orcamento_tabela_precos`, sim ativa do Valoria.
- **Escreve em:** `simulacao_itens`, `teca.audit`.
- **Depende de:** Anthropic API, PG local, `parket-teca` (compartilha
  algumas regras).
- **E usado por:** Valoria (parket-space2) via HTTP interno.

### Stack

- FastAPI + Python 3.11
- Anthropic SDK (claude-opus-4-7)
- Docker Swarm stack proprio

### Onde uso IA (Claude)

Igual `parket-teca` mas dedicado ao dominio Valoria. Prompts sao
especificos: por exemplo, `montar_orcamento` do Valoria sabe sobre
Versailles (aba fixa), Paginacao Exclusiva, Porta Exclusiva,
Adega (categoria propria com own catalog), regra ALL-IN da
marcenaria (sem perda, sem insumos, sem MO).

### Como rodar localmente

```bash
cd apps/parket-valoria-teca
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

---

## parket-wavoip

## parket-wavoip

> Integracao WhatsApp voice. Aprovacao individual de proposta pelo gestor comercial via mensagem de voz no WhatsApp.

### O que faz

- **gestor comercial aprova/reprova sim** direto por voz no WhatsApp
- **Link estavel** SEMPRE via `propostas.url_publica` (Space renderer)
- **Filtrar por status de analise do gestor** + write-back + ordenacao por orcamentista/data
- **Paralelizar /pendentes** com asyncio.gather
- **Backend com bloco analise_custo** + itens na resposta de aprovacao
- **Dedup sims por numero** + fallback pro workspace de propostas
- **PATCH cards_solicitacao Valoria** + HB mostra orcamento em handoff-com

### Como se interliga com o ecossistema

- **Le de:** `ops.propostas`, `ops.simulacoes`, WAHA WhatsApp
- **Escreve em:** `ops.cards_solicitacao`, decisoes do gestor comercial, `parket-chat`
- **Depende de:** WAHA, api.parket.works

### Stack

FastAPI + Python, integracao WAHA, PG local, deploy stack `parket-wavoip`

### Onde uso IA

Nao usa IA diretamente. E o interface humana do gestor comercial.

---

## parket-whisper

## parket-whisper

> Servico self-hosted de transcricao de audio via faster-whisper.
> Usado por reunioes semanais (parket-gestao) e Teca (audio message
> → texto).

### O que faz

- Recebe audio (mp3, ogg, m4a, webm)
- Roda faster-whisper (`large-v3`) em GPU local ou CPU
- Retorna transcricao pt-BR estruturada por segmento (com timestamp)
- Cache por hash do arquivo (nao retranscreve o mesmo audio)

Substituiu Whisper OpenAI hosted por 3 motivos: (1) custo, (2)
privacidade (audio de reuniao gerencial nao sai da Parket), (3)
latencia (roda no proprio servidor).

### Como se interliga com o ecossistema

- **Le de:** audio via HTTP upload
- **Escreve em:** cache local (nao mexe em outros bancos)
- **E usado por:** `parket-gestao` (/reuniao), `parket-teca` (audio
  messages), `parket-chat` (transcricao pt-BR de audios do composer
  — no chat e Web Speech browser-side, mas transcricao offline usa
  este servico)
- **Depende de:** faster-whisper (`>=1.0`), ffmpeg

### Stack

- Python + faster-whisper + FastAPI
- Docker Swarm stack `parket-whisper`
- Modelo baixado uma vez em volume Docker persistente

### Onde uso IA

E o proprio servico de IA (ASR).

### Como rodar localmente

```bash
cd apps/parket-whisper
docker compose up  # ou pip install -r requirements.txt && uvicorn app:app
```

### O que aprendi

- **large-v3 vale a pena mesmo em CPU** — pt-BR fica notavelmente
  melhor que medium.
- **Fila unica** — 1 audio de cada vez pra nao estourar memoria.

---

## producao-app

## producao-app

> Kanban PCP da fabrica Parket (`producao.parket.works`). 8 fases,
> conferencia de estoque, chips liberado X/Y, sync auto com projetos.

### O que faz

Kanban de 8 fases da producao com toolbar de fases sticky no topo:

- Ordem de Producao (OP) automatica na assinatura do contrato
  (perna 4 do compras-contratos-watcher, com itens porta/marcenaria +
  anexos do card Valoria)
- **numero da OP = numeracao da proposta** + qtd de portas do texto
- **Watcher:** numero 1.1 + qtd portas + tipo insumo (FERRAGEM/MP)
- **ListaFabricacao** colapsavel + blocos MP/FERRAGENS + kit
  conferencia + status por item
- **Chip LIBERADO PROJETOS** puxa do board Projetos
- **Chip PROJ:<fase>** via `producao_ordens.projetos_fase` +
  `sync_projetos_fase()` no watcher 3min
- **KPIs em tempo real** do `status_producao` dos itens
- **Conferir estoque** — blocos MP/Ferragens + envio em rodadas +
  banner pendente; no card da OP mostra resumo × saldo Curitiba →
  gera solicitacao Compras do que falta
- **Chips qtd portas** no Kanban
- **Auto-avanco etapa PCP** a partir da fase do board Projetos
- **Conferir estoque no card da OP** (resumo × saldo Curitiba →
  solicitacao Compras do que falta)
- **Marcar "atendido do estoque"** no card do responsavel de compras

### Como se interliga com o ecossistema

- **Le de:** `parket-gestao` (itens liberados), `projetos-app` (fase
  do board), `compras-app` (saldo Curitiba), `parket-space2` (anexos
  do card Valoria)
- **Escreve em:** `producao_ordens` (schema `producao.*`), pedido de
  compra pro `compras-app` quando falta MP/ferragem
- **Depende de:** watcher compras-contratos, api.parket.works
- **E usado por:** responsaveis de fabrica, projetos e compras

### Stack

- React + Vite + Tailwind
- FastAPI backend
- Postgres schema `producao.*`
- Deploy stack `producao-app`, producao.parket.works

### Onde uso IA

Nao diretamente.

### Como rodar localmente

```bash
cd apps/producao-app
cp .env.example .env
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
cd frontend && npm install && npm run dev
```

### O que aprendi

- **Producao espelha fase do Projetos.** Chip PROJ:<lista> vem do
  Trello board projetos via watcher 3min. Sem duplicacao — Projetos
  e a fonte da fase.
- **Producao autoriza (nao decide).** OP auto pra projeto gestao com
  fab (porta/marc/painel/forro lam); fallback `gestao.itens` se sim
  morta, dedup por `gestao_projeto_id`; OK = Liberar de Projetos.
- **Topbar sticky.** Titulo+KPIs+alertas+nomes das 8 fases fixos ao
  rolar. Layout: wrapper flex-col + topbar shrink-0 + rolante flex-1.
- **CAT_PRODUCAO expandida:** inclui PAINEL RIPADO, LAMINA, FORRO
  LAMINADO.

---

## projetos-app

## projetos-app

> Kanban de projetos executivos (`projetos.parket.works`). Setor
> Projetos gerencia medicao fina, upload de executivo, delegacao
> por projetista, aba Fiscal cross-departamento.

### O que faz

- **Kanban** com colunas: Novos → Medicao fina → Fazendo → Aprovacao →
  Aprovado → Entregue. 5 fases internas do projetista.
- **Views:** Todos | Revestimento | Marcenaria (mesmo padrao do gestao).
- **Card com abas:** Produtos (liberar + edicao medida marcenaria),
  Aditivo (le `meta.eh_aditivo` do Valor + tag automatica), Fiscal
  (busca por TODOS os card_ids Cloud do mesmo cliente — fiscal
  registra no dept operacional).
- **Delegacao** — a coordenacao de projetos atribui obra pra projetista, ou membro
  Trello vira projetista Space via sync.
- **Medicao fina** — 1 arquivo por item, upload substitui anterior;
  virou card-level (multi-doc) + ambiente inline; task de dividir
  itens agregados.
- **Kanban interno do projetista** com 5 fases.
- **Chip PENDENTES** no card quando falta liberar produto.
- **Chip PROJ:<fase>** aparece no card do PCP puxando fase do
  board Projetos (sync 3min).
- **Comentarios locais** com nome real do login + edit/delete.
- **Filtros estado/cidade** no kanban.
- **Pagina Relatorio** (BI saude do setor + insights IA).
- **CORTINEIRO/ALCAPAO** viram itens de fabrica.

Regra: **Novo Card removido do projetos-app** (backend + modal). Card
so nasce no HB.

### Como se interliga com o ecossistema

- **Le de:** `parket-space2` (sim do Valor → aditivos), `parket-gestao`
  (fiscal), `kanban_cards`, `contrato assinado`, planilha original
  quando havia Trello.
- **Escreve em:** `producao-app` (liberacao parcial: qtd + obs vira
  ordem de fabrica), `parket-gestao` (item liberado_projetos),
  `parket-chat` (comentarios locais).
- **Depende de:** api.parket.works, board local (`board_local.py`)
  desde 02/09 (sem Trello vivo).
- **E usado por:** setor Projetos (a coordenacao de projetos + projetistas).

### Stack

- React + Vite + Tailwind
- FastAPI backend
- Postgres schemas `projetos.*` e `gestao.*`
- Deploy stack `projetos-app`, projetos.parket.works
- Web Push VAPID (settings.vapid_public_key)

### Onde uso IA (Claude)

- **Pagina Relatorio** — BI saude do setor + insights (Claude
  Sonnet 4.6 em analise agregada).

### Como rodar localmente

```bash
cd apps/projetos-app
cp .env.example .env
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
# outro terminal
cd frontend && npm install && npm run dev
```

### O que aprendi

- **Sync-kanban-cards apaga obra/endereco.** Decisao de 03/09 foi
  nao mexer. Fica documentado em memory.
- **Projetos sem Trello:** 02/09 board Projetos passou 100% local via
  `board_local.py`; schema segue `trello_projetos` por heranca, sem
  vinculo vivo.
- **CONFERIR ITEM != LIBERAR PRA PRODUCAO.** Conferir grava
  `liberado_projetos` e NAO chega no PCP; so Liberar pra Producao
  (com qtd, pode ser parcial) vira ordem de fabrica.
- **Backfill Trello space_card_id** — 507 cards com match por nome so.
- **CONFIRMACAO Kanban** — card com projeto no gestao fecha como
  ganho (comercial) ou proposta-aceita (orcamento).

---

## suprimentos-app

## suprimentos-app

> Emprestimo/devolucao de ferramentas (`suprimentos.parket.works`). Termos em PDF, controle incremental.

### O que faz

- **Termos de emprestimo/devolucao** em PDF assinaveis
- **Devolucao gera novo Nº CONTROLE** incremental (referencia termo original)
- **Migracao dados Apps Script** feita
- **Tabelas suprimentos_*** no Supabase Cloud

### Como se interliga com o ecossistema

- **Le de:** funcionarios (`user_profiles`), ferramentas (`suprimentos.*`)
- **Escreve em:** `suprimentos.termos`, PDFs
- **E usado por:** almoxarifado, coordenadores

### Stack

React + Vite (clonando compras-app), FastAPI backend, PG Cloud schema `suprimentos.*`, deploy `suprimentos-app`

### Onde uso IA

Nao usa IA.

---

## infra

## apps/infra/

Componentes de infraestrutura da Parket. Nao sao "apps" no sentido
de UI/UX — sao pecas que fazem o ecossistema funcionar.

### Conteudo

- **parket-api/** — Gateway nginx + PostgREST pro Cloud Supabase.
  Serve `api.parket.works`.
- **parket-pg-local/** — Stack Postgres 15 local + GoTrue auth +
  Storage + PostgREST. Fonte de verdade operacional da Parket.
- **parket-supabase-proxy/** — Proxy pro GoTrue local com rewrites
  pra clientes esperarem shape da API Supabase.
- **parket-waha/** — Gateway WhatsApp official API via WAHA.
- **parket-auth-guard/** — OTP WhatsApp de aprovacao pra transacoes
  financeiras sensiveis.

Ver `../../ARQUITETURA.md` pra entender como esses pecas se
encaixam no ecossistema completo.

---

## infra/parket-api

## parket-api

> Gateway HTTP: nginx + PostgREST pro Cloud (`<SUPABASE_PROJECT_REF>`). Nao proxa pro PG local; e um proxy pro pooler do Cloud.

### O que faz

- Nginx + PostgREST configurados
- Roteia `/valoria` pro cluster skbj... (Cloud secundario)
- Serve `api.parket.works`

### Como se interliga com o ecossistema

- **Le de:** Cloud pooler (`<SUPABASE_PROJECT_REF>`)
- **E usado por:** frontends de todos os apps pra falar com o Cloud sem exposer o PG local

### Stack

nginx + PostgREST, Docker Swarm stack `parket-api`

### Onde uso IA

Nao aplica.

### Notas

Sempre conferir `PGRST_DB_URI` antes de assumir que aponta pro PG local — nao aponta.

---

## infra/parket-auth-guard

## parket-auth-guard

> OTP WhatsApp de aprovacao. Codigo de 6 digitos pra aprovacoes financeiras sensiveis.

### O que faz

- Gera codigo OTP
- Envia via WhatsApp (WAHA)
- Valida no backend do app que pede aprovacao
- **NUNCA** expor codigo no chat interno (regra rigida — quebra seguranca)

### Como se interliga com o ecossistema

- **Le de:** app que pede aprovacao (compras acima de X, aditivos)
- **Escreve em:** log de aprovacoes
- **E usado por:** `parket-core`, `compras-app`, `parket-contratos` (prestador OTP)

### Stack

Node/Express, WhatsApp via WAHA, Docker Swarm stack `parket-auth-guard`

### Onde uso IA

Nao aplica.

---

## infra/parket-pg-local

## parket-pg-local

> Stack Postgres local: fonte de verdade operacional da Parket. Auth GoTrue + Storage + PostgREST + PG 15.

### O que faz

- **Postgres 15** com schemas dominio (`gestao`, `core`, `ops`, `producao`, `compras`, etc)
- **GoTrue** local pra auth (parket-supabase-proxy roda em cima)
- **Storage** local (Supabase storage-api)
- **PostgREST** exposto pra clientes internos
- **rest-stack.yml** e **storage-stack.yml** parametrizados com `${LOCAL_PG_PASSWORD}`
- **Backup diario** + log rotation ativa desde 08/09 (daemon.json 50m x3)
- **check-replication-lag.sh** monitor pra sync com Cloud

### Como se interliga com o ecossistema

- **Le de:** watchers cron do Cloud (sync bi-direcional)
- **E usado por:** todos os apps internos como fonte de verdade

### Stack

Docker Swarm stack, Postgres 15, Supabase gotrue/postgrest/storage-api open source

### Onde uso IA

Nao aplica.

---

## infra/parket-supabase-proxy

## parket-supabase-proxy

> Proxy pro GoTrue local + rewrites necessarios pra clientes esperarem API Supabase. Fica em frente ao `parket-pg-local`.

### O que faz

- **GoTrue** (auth) + storage rewrites
- **Env vars** parametrizadas com `${LOCAL_PG_PASSWORD}`
- **Search path auth** configurado

### Como se interliga com o ecossistema

- **Le de:** `parket-pg-local` schema `auth.*`
- **E usado por:** todos os frontends que autenticam localmente

### Stack

Docker Swarm stack, GoTrue open source

### Onde uso IA

Nao aplica.

---

## infra/parket-waha

## parket-waha

> Gateway WhatsApp official API via WAHA (WhatsApp HTTP API). Serve como fonte de eventos pro homebroker (lead novo, mensagem).

### O que faz

- WAHA instance rodando
- Webhook pra parket-homebroker (novo lead cai em Novas Oportunidades)
- Rodando em instancia dedicada da Evolution API pra atendimento comercial
- Repointar numero move grupos + conversas juntos (FK composta em 2 bancos)

### Como se interliga com o ecossistema

- **Le de:** WhatsApp (API official via WAHA)
- **Escreve em:** `parket-homebroker` (lead novo), `parket-chat` (notif Atendimento)
- **E usado por:** SDR, Sucesso do Cliente

### Stack

WAHA container Docker (upstream), Docker Swarm stack `parket-waha`

### Onde uso IA

Nao aplica. WAHA e proxy transparente.

---

## legado

## apps/legado/

Versoes antigas de aplicativos, mantidas pra referencia historica
no portfolio.

Motivos pra manter (nao apagar):
- **Mostra evolucao das ideias** — recrutador ve como resolvi o
  mesmo problema no v1 e depois no v2
- **Codigo referencia e reciclado** — muitas ideias e trechos foram
  aproveitados nos apps atuais
- **Padroes de solucao ainda valem** mesmo com a stack renovada

### Conteudo

- **parket-2026/** — proposta publica standalone (antes do fluxo unificado
  em `parket-space2`)
- **parket-app/** — primeira versao do app mobile antes do
  `instala-app` React
- **parket-cs/** — customer success v1 (hoje absorvido em `parket-homebroker`)
- **parket-devportal/** — v1 do portal de skills e ferramentas dev
- **parket-emergency-auth/** — fallback auth v1
- **parket-guia/** — guia de instalacao v1 (hoje ficha_tecnica no
  `instala-app`)
- **parket-proposta-b/** — proposta opcao B, experimento standalone
- **parket-rh-api/** — backend RH primeira versao (hoje `parket-rh`)
- **parket-site/** — site marketing antigo
- **parket-skills/** — portal de skills v1
- **cronograma-app/** — cronograma standalone antes de virar aba
  do `parket-gestao`

Cada pasta tem seu proprio README stub explicando o contexto.

---

## legado/cronograma-app

## cronograma-app (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-2026

## Parket - Website Institucional

Site institucional premium da Parket, marca especializada em produtos de madeira de alta qualidade. Inspirado no design editorial da Monofloor, com foco em estética minimalista e apresentação premium dos produtos.

### 🎨 Design System

O projeto utiliza um design system personalizado com:

- **Paleta de cores**: Tons naturais de madeira e tema dark (#1A1A1A / #0D0D0D)
- **Tipografia**: Fontes thin/light para elegância editorial
- **Estilo**: Zero border-radius, zero shadows, design minimalista
- **Tema**: Dark mode premium com contraste suave

### 🚀 Tecnologias

- **React 18** - Biblioteca JavaScript para interfaces
- **Vite** - Build tool e dev server
- **React Router 7** - Roteamento com Data Mode
- **TypeScript** - Tipagem estática
- **Tailwind CSS v4** - Framework CSS utility-first
- **Motion (Framer Motion)** - Animações e parallax
- **Lucide React** - Ícones
- **React Helmet Async** - Meta tags e SEO

### 📁 Estrutura do Projeto

```
parket-website/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── sections/      # Seções da Home
│   │   │   ├── layouts/       # Layouts compartilhados
│   │   │   ├── shared/        # Componentes reutilizáveis
│   │   │   ├── modals/        # Modais e overlays
│   │   │   ├── ui/            # Design system base
│   │   │   └── figma/         # Componentes do Figma
│   │   ├── pages/
│   │   │   ├── products/      # Páginas de produtos
│   │   │   └── blog/          # Artigos do blog
│   │   ├── hooks/             # Custom hooks
│   │   ├── routes.ts          # Configuração de rotas
│   │   └── App.tsx            # Componente raiz
│   ├── styles/
│   │   ├── index.css          # Estilos globais
│   │   ├── theme.css          # Variáveis CSS
│   │   ├── fonts.css          # Fontes customizadas
│   │   └── tailwind.css       # Config Tailwind v4
│   └── imports/               # Assets e conteúdo
├── public/                     # Arquivos públicos
└── package.json
```

### 🏗️ Seções da Home

A página inicial é uma single-page com as seguintes seções:

1. **Header** - Navegação fixa com logo e menu
2. **Hero** - Vídeo em fullscreen com efeito Ken Burns
3. **About** - Apresentação da empresa
4. **Categories** - 10 categorias de produtos em grids
5. **Revestimentos** - Carousel de revestimentos
6. **ProductsCTA** - Call-to-action para produtos
7. **Inspiração** - Galeria de projetos
8. **Philosophy** - Filosofia da marca
9. **Testimonial** - Depoimentos de clientes
10. **Blog** - Últimos artigos
11. **Contact** - Formulário de contato
12. **Footer** - Rodapé com links e informações

### 📄 Páginas de Produto

10 subpáginas com layouts customizados:

- Pisos de Madeira
- Decks
- Forros
- Painéis
- Portas
- Escadas
- Fachadas
- Marcenaria Arquitetônica
- Shou Sugi Ban
- SPA

Cada página possui:
- Galeria de imagens com lightbox
- Especificações técnicas
- CTAs para contato

### 📝 Blog

8 artigos otimizados para SEO:

- Piso de Madeira: Guia Completo
- Deck de Madeira: Tipos e Manutenção
- Cumaru vs Ipê: Qual Escolher?
- Escadas de Madeira: Design e Segurança
- Forro de Madeira: Tendências
- Forro Ripado vs Contínuo
- Marcenaria Arquitetônica sob Medida
- Como Escolher Empresa de Madeira

### 🎯 Features Especiais

- **Parallax Scrolling**: Efeitos suaves em várias seções
- **Ken Burns Effect**: Zoom/pan sutil no vídeo hero
- **Scroll Reveal**: Animações ao rolar a página
- **Floating CTA**: Botão flutuante verde após scroll
- **Lead Form Modal**: Modal de contato com validação
- **Lightbox**: Galeria de imagens em fullscreen
- **SEO Otimizado**: Meta tags dinâmicas por página

### 🔧 Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/parket-website.git

# Entre na pasta
cd parket-website

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

### 📦 Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build de produção
npm run lint         # Executa linting
```

### 🌐 Deploy

O projeto está configurado para deploy em:

- **Vercel** (recomendado)
- **Netlify**
- **GitHub Pages**

Basta conectar o repositório à plataforma escolhida e o deploy será automático.

### 📱 Responsividade

O site é totalmente responsivo com breakpoints:

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### 🎨 Personalização

#### Cores

Edite as variáveis em `/src/styles/theme.css`:

```css
:root {
  --color-primary: #8B7355;
  --color-secondary: #A0826D;
  /* ... */
}
```

#### Fontes

Adicione fontes em `/src/styles/fonts.css`

#### Componentes

Componentes UI base estão em `/src/app/components/ui/`

### 📄 Licença

© 2025 Parket. Todos os direitos reservados.

### 🤝 Contribuindo

Este é um projeto privado. Para contribuir, entre em contato com a equipe de desenvolvimento.

### 📧 Contato

- Website: [www.parket.com.br](https://www.parket.com.br)
- Email: contato@parket.com.br

---

Desenvolvido com ❤️ para Parket

---

## legado/parket-app

## parket-app (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-cs

## parket-cs (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-devportal

## parket-devportal (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-emergency-auth

## parket-emergency-auth (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-guia

## parket-guia (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-proposta-b

## parket-proposta-b (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-rh-api

## parket-rh-api (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-site

## parket-site (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

---

## legado/parket-skills

## parket-skills (legado)

> Versao antiga, mantida pra referencia historica no portfolio.

Esta app foi substituida por outra na versao atual do ecossistema.
Ver `../../README.md` na raiz do repo pra saber qual e o substituto.

Motivos para manter no portfolio:
- Mostra evolucao das ideias
- Codigo referencia e reciclado em novos apps
- Padroes de solucao ainda valem

