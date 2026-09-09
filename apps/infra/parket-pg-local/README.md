# parket-pg-local

> Stack Postgres local: fonte de verdade operacional da Parket. Auth GoTrue + Storage + PostgREST + PG 15.

## O que faz

- **Postgres 15** com schemas dominio (`gestao`, `core`, `ops`, `producao`, `compras`, etc)
- **GoTrue** local pra auth (parket-supabase-proxy roda em cima)
- **Storage** local (Supabase storage-api)
- **PostgREST** exposto pra clientes internos
- **rest-stack.yml** e **storage-stack.yml** parametrizados com `${LOCAL_PG_PASSWORD}`
- **Backup diario** + log rotation ativa desde 08/09 (daemon.json 50m x3)
- **check-replication-lag.sh** monitor pra sync com Cloud

## Como se interliga com o ecossistema

- **Le de:** watchers cron do Cloud (sync bi-direcional)
- **E usado por:** todos os apps internos como fonte de verdade

## Stack

Docker Swarm stack, Postgres 15, Supabase gotrue/postgrest/storage-api open source

## Onde uso IA

Nao aplica.
