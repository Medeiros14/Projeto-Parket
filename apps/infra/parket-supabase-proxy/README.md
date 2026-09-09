# parket-supabase-proxy

> Proxy pro GoTrue local + rewrites necessarios pra clientes esperarem API Supabase. Fica em frente ao `parket-pg-local`.

## O que faz

- **GoTrue** (auth) + storage rewrites
- **Env vars** parametrizadas com `${LOCAL_PG_PASSWORD}`
- **Search path auth** configurado

## Como se interliga com o ecossistema

- **Le de:** `parket-pg-local` schema `auth.*`
- **E usado por:** todos os frontends que autenticam localmente

## Stack

Docker Swarm stack, GoTrue open source

## Onde uso IA

Nao aplica.
