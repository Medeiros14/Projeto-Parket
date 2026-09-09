# expedicao-app

> Logistica de expedicao (`expedicao.parket.works`). Agenda do dia + carta de frete nativas (sem Hercules legado).

## O que faz

- **Agenda do dia** com fretes vinculados a obras
- **Carta de frete** gerada nativamente (fim do Hercules)
- **Sync delta Convex → Supabase** (dados historicos do app Hercules)
- **Vincular fretes a obras** (UI + backfill)
- **Sync com outros setores** (compras, producao, gestao)

## Como se interliga com o ecossistema

- **Le de:** obras via `core.obras`, dados Hercules (delta sync)
- **Escreve em:** `expedicao.*` schema Cloud, `parket-chat` (notif entrega)
- **Depende de:** api.parket.works

## Stack

React + Vite (clonando compras-app layout), FastAPI backend, PG Cloud + local, deploy `expedicao-app`

## Onde uso IA

Nao usa IA.
