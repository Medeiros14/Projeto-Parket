# Dashboard Parket — Instruções para Agentes IA

## REGRAS CRÍTICAS — LEIA ANTES DE QUALQUER AÇÃO

1. **NUNCA** executar `docker build -t parket-dashboard:latest`
2. **NUNCA** executar `docker build -t parket-dashboard:staging`
3. **NUNCA** executar `docker tag ... parket-dashboard:latest`
4. **NUNCA** executar `docker tag ... parket-dashboard:golden`
5. **NUNCA** executar `docker tag ... parket-dashboard:golden-complete`
6. **NUNCA** executar `docker image prune -a` (destrói imagens necessárias)
7. **NUNCA** executar `docker stack rm parket-dashboard` (derruba frontend+backend do draw também)
8. **NUNCA** alterar `/root/.golden-id` manualmente
9. **NUNCA** alterar `/usr/local/bin/protect-dashboard.sh` manualmente
10. **NUNCA** executar `sed` nos scripts de deploy/backup

## Sistema de Golden ID

A fonte única de verdade para a imagem de produção é:
```
/root/.golden-id
```
Contém o ID curto (12 chars) da imagem Docker que deve estar rodando.
Todos os scripts leem desse arquivo. Ele só é atualizado por `deploy-dashboard.sh`.

## Deploy — Único caminho seguro

```bash
# Para mudanças no dashboard:
./deploy-dashboard.sh <imagem:tag>

# Para mudanças por setor:
./dev-sector.sh <setor> build
./dev-sector.sh <setor> preview
./dev-sector.sh <setor> merge
```

O `deploy-dashboard.sh`:
- Valida 15+ departamentos obrigatórios
- Faz backup versionado por ID (nunca sobrescreve)
- Atualiza `/root/.golden-id`
- Sincroniza todas as tags (golden-complete, golden, latest, stable)
- Rollback automático se container não subir

## Hotpatch (mudanças no JS compilado)

### REGRA CRÍTICA — sempre partir do container em produção

**NUNCA edite `patches/<arquivo>.js` direto sem antes sincronizar com a golden em prod.**

Por quê: vários agentes podem aplicar hotpatches no mesmo arquivo no mesmo dia. Se você editar `patches/<arquivo>.js` partindo de um snapshot velho (qualquer cópia antiga, mesmo de minutos atrás), você **sobrescreve hotpatches de outros agentes** sem perceber. Já aconteceu (11/05): o tracking de `user_sessions` foi apagado porque outro agente aplicou um perms-fix no `index-DZtetJYP.js` partindo da versão original da golden, sem incluir o tracking que tinha sido aplicado minutos antes.

### Procedimento obrigatório

```bash
# 1. EXTRAIR do container em produção (estado mais recente, com TODOS os hotpatches do dia)
CONTAINER=$(docker ps -q -f name=parket-dashboard_dashboard)
docker cp "$CONTAINER":/usr/share/nginx/html/assets/<arquivo>.js \
  /root/Dashboardparketapp/patches/<arquivo>.js

# 2. BACKUP imediato com timestamp
cp /root/Dashboardparketapp/patches/<arquivo>.js \
   /root/Dashboardparketapp/patches/<arquivo>.js.bak-<descricao>-$(date +%H%M)

# 3. Aplicar o patch
# (sed / python / Edit conforme necessário)

# 4. VALIDAR antes de buildar (se quebrar, abort)
cp /root/Dashboardparketapp/patches/<arquivo>.js /tmp/test.mjs
node --check /tmp/test.mjs || { echo "ABORT: JS inválido"; exit 1; }

# 5. Build + deploy
cd /root/Dashboardparketapp/patches
docker build -t parket-dashboard:staging .
/root/deploy-dashboard.sh parket-dashboard:staging
```

### Após o deploy, RE-SINCRONIZAR

Depois que você deploya, **outros agentes vão precisar partir da SUA versão nova**. O `deploy-dashboard.sh` já faz isso via `sync-golden` (extrai do container em prod pra `dist_golden/`), mas o `patches/<arquivo>.js` local não atualiza sozinho. Se você for fazer um segundo hotpatch na mesma sessão no mesmo arquivo: faça `docker cp` de novo do container (passo 1) antes do próximo patch.

### Assertion obrigatório no Python/sed

Sempre que substituir um trecho, **conte ocorrências antes**:
```python
assert src.count(old) == 1, f"FATAL: pattern count = {src.count(old)}, abort"
```
Se `count != 1`, **NÃO PROSSIGA** — o arquivo provavelmente já tem um hotpatch que mudou o trecho. Re-sincronize via `docker cp` e ajuste o pattern.

### Diretório `patches/` é build-input, não fonte de verdade

A **fonte de verdade do JS em produção é o container** (`parket-dashboard_dashboard`). O `patches/` é staging pra build. Pode ficar dessincronizado e isso é OK — desde que você re-sincronize antes de editar.

### Build base

O `patches/Dockerfile` usa `FROM parket-dashboard:golden` como base — então o `COPY` no Dockerfile só sobrescreve os arquivos listados; tudo que não está listado fica como na golden.

## Proteção automática

- `protect-dashboard.sh` roda a cada 30s verificando se o container correto está rodando
- `backup-dashboard.sh` roda a cada 2h — monitora e alerta, mas NUNCA restaura sozinho
- Ambos leem de `/root/.golden-id`

## Backups

- `/root/.docker-golden-backups/golden-<ID>.tar.gz` — backup por versão (nunca sobrescreve)
- `/root/parket-dashboard-golden.tar.gz` — cópia do backup mais recente
- `/root/parket-dashboard-GOLDEN-20abr-SAFE.tar.gz` — backup seguro manual

## Rollback de emergência

```bash
# 1. Ver backups disponíveis
ls -lt /root/.docker-golden-backups/golden-*.tar.gz | head -5

# 2. Carregar o backup desejado
docker load < /root/.docker-golden-backups/golden-<ID>.tar.gz

# 3. Retagear e atualizar golden-id
docker tag parket-dashboard:golden-complete parket-dashboard:golden-complete
NEW_ID=$(docker inspect parket-dashboard:golden-complete --format '{{.Id}}' | cut -c8-20)
echo "$NEW_ID" > /root/.golden-id

# 4. Forçar update
docker service update --image parket-dashboard:golden-complete --force parket-dashboard_dashboard
```

## Arquivos protegidos (NÃO ALTERAR sem admin)
- src/app/components/dept-layout.tsx
- src/app/components/sistema-ops-data.ts
- stack.yml
- Dockerfile
- nginx.conf

## Stack compartilhado

O stack `parket-dashboard` contém 3 serviços:
- `parket-dashboard_dashboard` — Space Parket (imagem golden-complete)
- `parket-dashboard_frontend` — draw.parket.works (imagem parket-draw-frontend)
- `parket-dashboard_backend` — API do draw (imagem parket-draw-backend)

**NUNCA remover o stack inteiro** — isso derruba draw.parket.works também.
