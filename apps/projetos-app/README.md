# projetos-app

> Kanban de projetos executivos (`projetos.parket.works`). Setor
> Projetos gerencia medicao fina, upload de executivo, delegacao
> por projetista, aba Fiscal cross-departamento.

## O que faz

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

## Como se interliga com o ecossistema

- **Le de:** `parket-space2` (sim do Valor → aditivos), `parket-gestao`
  (fiscal), `kanban_cards`, `contrato assinado`, planilha original
  quando havia Trello.
- **Escreve em:** `producao-app` (liberacao parcial: qtd + obs vira
  ordem de fabrica), `parket-gestao` (item liberado_projetos),
  `parket-chat` (comentarios locais).
- **Depende de:** api.parket.works, board local (`board_local.py`)
  desde 02/09 (sem Trello vivo).
- **E usado por:** setor Projetos (a coordenacao de projetos + projetistas).

## Stack

- React + Vite + Tailwind
- FastAPI backend
- Postgres schemas `projetos.*` e `gestao.*`
- Deploy stack `projetos-app`, projetos.parket.works
- Web Push VAPID (settings.vapid_public_key)

## Onde uso IA (Claude)

- **Pagina Relatorio** — BI saude do setor + insights (Claude
  Sonnet 4.6 em analise agregada).

## Como rodar localmente

```bash
cd apps/projetos-app
cp .env.example .env
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
# outro terminal
cd frontend && npm install && npm run dev
```

## O que aprendi

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
