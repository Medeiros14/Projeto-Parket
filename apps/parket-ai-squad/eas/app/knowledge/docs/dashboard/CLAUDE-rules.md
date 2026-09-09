# Dashboard Parket — Regras CRÍTICAS

A imagem `parket-dashboard:golden-complete` **é a produção** (Space + Draw + Proposta render). Qualquer ação que comprometa a golden quebra negócio. Regras inquebráveis:

## NUNCA executar

1. `docker build -t parket-dashboard:latest`
2. `docker build -t parket-dashboard:staging` (EXCETO quando Dockerfile em `patches/` com `FROM parket-dashboard:golden`)
3. `docker tag ... parket-dashboard:latest`
4. `docker tag ... parket-dashboard:golden`
5. `docker tag ... parket-dashboard:golden-complete`
6. `docker image prune -a` (destrói imagens necessárias)
7. `docker stack rm parket-dashboard` (derruba draw.parket.works também)
8. Alterar `/root/.golden-id` manualmente
9. Alterar `/usr/local/bin/protect-dashboard.sh` manualmente
10. `sed` nos scripts de deploy/backup

## Caminho ÚNICO seguro

Qualquer mudança no Dashboard deve passar por:

```bash
/root/deploy-dashboard.sh <imagem:tag>
```

Esse script:
- Valida 15+ departamentos obrigatórios
- Faz backup versionado por ID (nunca sobrescreve)
- Atualiza `/root/.golden-id`
- Sincroniza tags (golden-complete, golden, latest, stable)
- Rollback automático se container não subir

## Stack compartilhado

O stack `parket-dashboard` tem 3 services:
- `parket-dashboard_dashboard` — Space Parket (imagem golden-complete)
- `parket-dashboard_frontend` — draw.parket.works (parket-draw-frontend)
- `parket-dashboard_backend` — API do Draw (parket-draw-backend)

**Nunca remover stack inteiro** — derruba o Draw junto.

## Arquivos protegidos (não alterar sem admin Will)

- `src/app/components/dept-layout.tsx`
- `src/app/components/sistema-ops-data.ts`
- `stack.yml`
- `Dockerfile`
- `nginx.conf`

## Fonte de verdade

- `/root/.golden-id` — contém ID curto (12 chars) da imagem golden em produção. Todos os scripts leem daqui.
- Atualizado **apenas** pelo `deploy-dashboard.sh`.
