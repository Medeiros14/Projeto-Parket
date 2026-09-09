# producao-app

> Kanban PCP da fabrica Parket (`producao.parket.works`). 8 fases,
> conferencia de estoque, chips liberado X/Y, sync auto com projetos.

## O que faz

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

## Como se interliga com o ecossistema

- **Le de:** `parket-gestao` (itens liberados), `projetos-app` (fase
  do board), `compras-app` (saldo Curitiba), `parket-space2` (anexos
  do card Valoria)
- **Escreve em:** `producao_ordens` (schema `producao.*`), pedido de
  compra pro `compras-app` quando falta MP/ferragem
- **Depende de:** watcher compras-contratos, api.parket.works
- **E usado por:** responsaveis de fabrica, projetos e compras

## Stack

- React + Vite + Tailwind
- FastAPI backend
- Postgres schema `producao.*`
- Deploy stack `producao-app`, producao.parket.works

## Onde uso IA

Nao diretamente.

## Como rodar localmente

```bash
cd apps/producao-app
cp .env.example .env
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
cd frontend && npm install && npm run dev
```

## O que aprendi

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
