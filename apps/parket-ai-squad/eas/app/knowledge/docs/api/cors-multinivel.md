# api.parket.works CORS multi-nível

## Default

O gateway nginx do `parket-api_gateway` aceita CORS **só** de `https://X.parket.works` (1 nível de subdomínio).

## Quando aparece `staging.X.parket.works` ou multi-nível

Pra liberar staging (ex: `staging.space.parket.works`), trocar a regex `(?)` por `(*)` na config do nginx:

```nginx
# Antes (1 nível)
if ($http_origin ~* "^https://(?:[a-z0-9-]+)\.parket\.works$") { ... }

# Depois (qualquer profundidade)
if ($http_origin ~* "^https://(?:[a-z0-9.-]+)\.parket\.works$") { ... }
```

## NUNCA usar `docker cp` pra editar nginx

Causa bug do volume montado: o `docker cp` substitui o inode dentro do container mas o nginx ainda lê via mount original → conflito de fd → segfault.

**Caminho correto**:

```bash
# 1. Ler config atual do container
CONT=$(docker ps -q -f name=parket-api_gateway)
docker exec "$CONT" cat /etc/nginx/conf.d/default.conf > /tmp/nginx.conf

# 2. Editar local (sed/Edit)

# 3. Reescrever via exec + tee (NÃO docker cp)
docker exec -i "$CONT" tee /etc/nginx/conf.d/default.conf < /tmp/nginx.conf

# 4. Reload
docker exec "$CONT" nginx -s reload
```

## Validar

```bash
curl -sI -H "Origin: https://staging.space.parket.works" https://api.parket.works/rest/v1/<tabela> | grep -i access-control
```

Esperado: `Access-Control-Allow-Origin: https://staging.space.parket.works`

## Quando o staging tá em domínio próprio

Adicionar explicitamente no nginx via `if ($http_origin = "https://novodominio.com")`.
