# monitor-app

> Status page dos 43 dominios `parket.works` (`monitor.parket.works`).
> Estilo `status.claude.com`.

## O que faz

- Backend Node em runtime — checker HTTP a cada 60s
- API expondo status atual + historico
- Frontend estatico SPA no estilo status.claude.com
- Schema `monitor.*` no PG local + seed dos 44 dominios
- Editar `monitor.apps` no PG local muda a pagina **sem redeploy**

## Como se interliga com o ecossistema

- **Le de:** ping HTTP em cada dominio parket.works
- **Escreve em:** `monitor.status_snapshots` + `monitor.status_events`
- **E usado por:** todo mundo Parket ve o status visual de cada app
  e watchers de crons

## Stack

- Node/Express backend
- SPA estatica com Tailwind
- Postgres schema `monitor.*`
- Docker Swarm stack `monitor-app`

## Onde uso IA

Nao usa.

## Como rodar localmente

```bash
cd apps/monitor-app
npm install
node checker.js  # roda checker + api
```

## O que aprendi

- **Editar tabela > redeploy.** Adicionar/remover app da pagina
  status = UPDATE em `monitor.apps`, nao commit. Zero downtime.
- **Smoke test dos watchers/crons** virou dado versionavel (rodada
  20/08 monitorada por este app).
