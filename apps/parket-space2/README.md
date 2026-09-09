# parket-space2

> Valoria (`valor.parket.works`), o workspace de propostas da Parket. Substitui o Space legado. Gera proposta detalhada por ambiente, com Teca IA embutida.

## O que faz

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

## Como se interliga com o ecossistema

- **Le de:** `orcamento_tabela_precos` (catalogo mestre), `kanban_cards` (HB), `ops.cards_solicitacao`
- **Escreve em:** `ops.simulacoes`, `ops.propostas`, chat da obra
- **E usado por:** orcamentistas, Teca IA, gestor comercial

## Stack

React + Vite + Tailwind (frontend gigante), FastAPI backend, PG local schemas `ops.*` e `teca.*`, deploy `parket-space2`, dominio `valor.parket.works`

## Onde uso IA

Teca IA embutida via `parket-valoria-teca` — chat direto no editor pra montar orcamento. Modelo Claude Opus 4.7.

## Notas

Fonte da verdade da proposta = ops.simulacoes.numero (numero de proposta). Card HB tem seq propria. Nao confundir.
