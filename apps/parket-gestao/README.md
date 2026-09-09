# parket-gestao

> Core operacional da Parket: obras, projetos, equipes, reunioes, tarefas,
> cronograma, fiscal, custos de terceiros.

## O que faz

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

## Como se interliga com o ecossistema

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

## Stack

- **Frontend:** React + Vite + Tailwind, TypeScript
- **Backend:** FastAPI (Python 3.11)
- **Banco:** Postgres local schemas `gestao.*` e `ops.*`
- **Deploy:** Docker Swarm stack `parket-gestao`, dominio `gestao.parket.works`
- **Auth:** GoTrue via `api.parket.works`
- **Bibliotecas:** SQLAlchemy, Pydantic, tanstack query, radix-ui,
  react-router, react-pdf, xlsx (importacao planilha), openpyxl,
  faster-whisper (client), anthropic

## Onde uso IA (Claude)

- **Extracao de PDFs escaneados** (18 PDFs virarem linhas estruturadas
  via document blocks)
- **Reuniao semanal:** `parket-whisper` transcreve audio, Claude extrai
  resumo + tarefas por bloco, aprovar posta no chat
- **Backfill de projetos flat** para hierarquico (~148 projetos migrados
  com ajuda de Claude)
- **Cronograma:** Teca sugere prazo/equipe pros 380 projetos sem cronograma
- **Detector de crises**: identifica por contexto conversacional

Modelo default: Claude Opus 4.7 (extracao pesada), Sonnet 4.6 (bulk).

## Como rodar localmente

```bash
cd apps/parket-gestao
cp backend/.env.example backend/.env   # preencher SUPABASE_URL, SERVICE_KEY, ANTHROPIC_API_KEY
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# em outro terminal
cd frontend && npm install && npm run dev
```

## Estrutura resumida

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

## O que aprendi construindo isso

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
