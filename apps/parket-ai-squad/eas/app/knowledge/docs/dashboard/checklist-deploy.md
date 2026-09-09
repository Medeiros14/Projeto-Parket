# Checklist deploy Dashboard — 6 checks pré-fechamento

Antes de declarar "deployei", confirmar **todos os 6**. Falhar 1 = deploy quebrado.

## 1. md5 match (container × patches × curl)

```bash
md5sum /root/Dashboardparketapp/patches/<arquivo>.js
docker exec $(docker ps -q -f name=parket-dashboard_dashboard) \
  md5sum /usr/share/nginx/html/assets/<arquivo>.js
curl -s "https://<dominio>/assets/<arquivo>.js" | md5sum
```

Os 3 valores **devem coincidir**.

## 2. Headers no-cache

Verificar que o nginx não está cacheando o arquivo crítico (especialmente o `index.html`):

```bash
curl -sI "https://<dominio>/" | grep -iE "cache-control"
```

Deve ter `no-cache` ou `max-age=0` no index.

## 3. `node --check` do JS

```bash
cp /root/Dashboardparketapp/patches/<arquivo>.js /tmp/check.mjs
node --check /tmp/check.mjs
```

Se JS é inválido, abort imediato — Swarm vai entrar em loop de container caindo.

## 4. TODOS os chunks que referenciam a versão atualizados

Quando muda versão (ex: PGSTRUCT24 → PGSTRUCT25), todos chunks que importam o anterior precisam ser atualizados:

```bash
docker exec $(docker ps -q -f name=parket-dashboard_dashboard) \
  grep -lE "PGSTRUCT24" /usr/share/nginx/html/assets/*.js
```

Resultado deve ser vazio depois do deploy.

## 5. `default.conf` no Dockerfile

Confirmar que `nginx/default.conf` está no Dockerfile e foi atualizado se preciso:

```bash
grep -E "default\.conf" /root/Dashboardparketapp/patches/Dockerfile
```

## 6. Smoke HTTP 200 + Playwright

- `curl -sI https://<dominio>/` → 200
- Abrir página crítica em Playwright headless e verificar fix aplicado
- Console JS sem erros vermelhos

## Após os 6 checks

Logar atividade em `claude_atividades` (ver `global/log-de-atividades.md`) e fechar.
