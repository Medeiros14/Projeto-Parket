# Zero regressão — Will exige 100% funcional pós-deploy

**Regra**: Will (CEO/dono Parket) exige que **toda mudança em produção seja 100% funcional imediatamente após deploy**. Não existe "deployo agora e ajusto amanhã". Smoke test obrigatório antes de fechar a tarefa.

## Smoke test mínimo (Dashboard)

1. **Container Up**: `docker service ls | grep parket-dashboard_dashboard` deve mostrar `1/1`
2. **CODE_VERSION**: verificar via grep no container que a versão nova subiu (`grep CODE_VERSION /usr/share/nginx/html/assets/*.js`)
3. **Chunks ativos**: confirmar que o chunk patcheado está sendo carregado pela página (via `curl https://<dominio>/ | grep <chunk-name>`)
4. **Fix presente (grep)**: o conteúdo do fix deve estar no JS minificado dentro do container
5. **HTTP 200**: rota principal responde 200 sem erro de JS no console
6. **md5 match**: ver `global/verificar-deploy-md5.md`

## Smoke test específico — proposta

1. Abrir uma proposta real via Playwright headless
2. Verificar que elementos UI esperados estão presentes (ex: LOGÍSTICA centered, frete linha, etc)
3. Conferir que `propostaGenerator-PGSTRUCTxx.js` correto está sendo importado por `proposta-publica-page-V12FIX.js`

## Smoke test específico — API

1. `curl https://api.parket.works/rest/v1/<tabela>?limit=1` — 200 + JSON válido
2. Latência abaixo de 200ms (gateway aponta pro PostgREST local)
3. Replicação local→cloud sem lag (`/root/parket-pg-local/scripts/check-replication-lag.sh`)

## O que isso muda no agente

- Toda tool de deploy DEVE ter um post-hook que roda smoke test antes de retornar sucesso
- Se smoke falhar: rollback automático (script de deploy já faz isso) ou alerta WhatsApp pro Will
- Nunca confiar em "deploy concluído" do script — confiar nos checks pós-deploy

## Memória relacionada
- `global/verificar-deploy-md5.md`
- `dashboard/checklist-deploy.md`
