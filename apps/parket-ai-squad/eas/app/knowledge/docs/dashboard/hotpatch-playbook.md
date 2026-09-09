# Hotpatch playbook — Dashboard Parket

Procedimento obrigatório pra alterar JS/CSS minificado no Dashboard sem quebrar produção e sem sobrescrever hotpatches de outros agentes.

## Por que essa regra existe

Vários agentes podem aplicar hotpatches no mesmo arquivo no mesmo dia. Se você editar `patches/<arquivo>.js` partindo de um snapshot velho (cópia antiga, mesmo de minutos atrás), **sobrescreve hotpatches recentes**. Já aconteceu (11/05): tracking de `user_sessions` apagado porque outro agente aplicou perms-fix no `index-DZtetJYP.js` partindo da versão original da golden, sem incluir tracking que tinha sido aplicado minutos antes.

## Procedimento obrigatório

```bash
# 1. EXTRAIR do container em produção (estado mais recente, com TODOS os hotpatches do dia)
CONTAINER=$(docker ps -q -f name=parket-dashboard_dashboard)
docker cp "$CONTAINER":/usr/share/nginx/html/assets/<arquivo>.js \
  /root/Dashboardparketapp/patches/<arquivo>.js

# 2. BACKUP imediato com timestamp
cp /root/Dashboardparketapp/patches/<arquivo>.js \
   /root/Dashboardparketapp/patches/<arquivo>.js.bak-<descricao>-$(date +%H%M)

# 3. Aplicar o patch (sed / python / Edit)

# 4. VALIDAR antes de buildar
cp /root/Dashboardparketapp/patches/<arquivo>.js /tmp/test.mjs
node --check /tmp/test.mjs || { echo "ABORT: JS inválido"; exit 1; }

# 5. Build + deploy
cd /root/Dashboardparketapp/patches
docker build -t parket-dashboard:staging .
/root/deploy-dashboard.sh parket-dashboard:staging
```

## Após o deploy: re-sincronizar

Depois que você deploya, **outros agentes vão precisar partir da SUA versão nova**. O `deploy-dashboard.sh` faz isso via `sync-golden` (extrai do container em prod pra `dist_golden/`), mas o `patches/<arquivo>.js` local NÃO atualiza sozinho.

Se vai fazer segundo hotpatch no mesmo arquivo na mesma sessão: rode `docker cp` de novo (passo 1) antes do próximo patch.

## Assertion obrigatório no Python/sed

Ao substituir um trecho, **conte ocorrências antes**:

```python
assert src.count(old) == 1, f"FATAL: pattern count = {src.count(old)}, abort"
```

Se `count != 1`, **NÃO PROSSIGA** — o arquivo provavelmente já tem hotpatch que mudou o trecho. Re-sincronize via `docker cp` e ajuste o pattern.

## Quando build dá "mount options is too long"

Ver `dashboard/squash-procedure.md`.

## Build base

O `patches/Dockerfile` usa `FROM parket-dashboard:golden` como base. O `COPY` no Dockerfile só sobrescreve os arquivos listados — tudo que não está listado fica como na golden.

## Diretório `patches/` é build-input, não fonte de verdade

A **fonte de verdade** do JS em produção é o container (`parket-dashboard_dashboard`). O `patches/` é staging pra build. Pode ficar dessincronizado e isso é OK — desde que você re-sincronize antes de editar.
