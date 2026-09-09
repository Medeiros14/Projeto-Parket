# Verificar deploy por MD5 — nunca dizer "deployei" sem provar

**Regra**: nunca declarar "deploy concluído" baseado só na saída do script `deploy-*.sh`. Comparar **md5 do arquivo dentro do container rodando** com o md5 do arquivo em `patches/` (ou o arquivo source). Se diferentes, deploy NÃO entregou — o script pode ter cacheado, o build pode ter ignorado, o container pode ainda estar antigo.

## Procedimento padrão

```bash
# 1. md5 do patches/ (source da verdade local)
md5sum /root/Dashboardparketapp/patches/<arquivo>.js

# 2. md5 do container em produção
CONTAINER=$(docker ps -q -f name=parket-dashboard_dashboard)
docker exec "$CONTAINER" md5sum /usr/share/nginx/html/assets/<arquivo>.js

# 3. md5 servido publicamente (cache busting)
curl -s "https://<domínio>/assets/<arquivo>.js" | md5sum

# Todos os 3 valores DEVEM coincidir.
```

## O que valida cada md5

| md5 | O que prova |
|---|---|
| patches/ | Você editou o que pretendia |
| container | A imagem nova está rodando (Swarm não deixou container velho) |
| curl público | CDN/nginx não está servindo cache antigo |

## Sinais de falha

- container = patches mas curl ≠ → cache CDN/nginx (forçar Cache-Control no Dockerfile)
- patches ≠ container → deploy falhou, container velho (verificar `docker service ps`)
- curl ≠ container → nginx servindo arquivo errado, ou rota errada

## Aplicável a

- Dashboard Parket (golden + hotpatches)
- Space-v2 (Vite build)
- Proposta-render (V12FIX + PGSTRUCTxx)
- Qualquer hotpatch JS/CSS minificado

## Checklist completo de deploy: ver `dashboard/checklist-deploy.md`
