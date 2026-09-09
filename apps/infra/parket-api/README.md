# parket-api

> Gateway HTTP: nginx + PostgREST pro Cloud (`<SUPABASE_PROJECT_REF>`). Nao proxa pro PG local; e um proxy pro pooler do Cloud.

## O que faz

- Nginx + PostgREST configurados
- Roteia `/valoria` pro cluster skbj... (Cloud secundario)
- Serve `api.parket.works`

## Como se interliga com o ecossistema

- **Le de:** Cloud pooler (`<SUPABASE_PROJECT_REF>`)
- **E usado por:** frontends de todos os apps pra falar com o Cloud sem exposer o PG local

## Stack

nginx + PostgREST, Docker Swarm stack `parket-api`

## Onde uso IA

Nao aplica.

## Notas

Sempre conferir `PGRST_DB_URI` antes de assumir que aponta pro PG local — nao aponta.
