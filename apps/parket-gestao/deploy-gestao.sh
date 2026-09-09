#!/bin/bash
# Deploy do Gestor de Projetos Parket — SQL + build + stack deploy
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ 1/6  Aplicando schema gestao.* no parket-pg-local"
PGCID=$(docker ps -q -f name=parket-pg-local_postgres | head -1)
if [ -z "$PGCID" ]; then
    echo "✗ parket-pg-local não encontrado"; exit 1
fi
docker cp sql/001_schema_gestao.sql "$PGCID:/tmp/001_schema_gestao.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/001_schema_gestao.sql
docker cp sql/005_obra_acompanhamento.sql "$PGCID:/tmp/005_obra_acompanhamento.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/005_obra_acompanhamento.sql
docker cp sql/008_reuniao_semanal.sql "$PGCID:/tmp/008_reuniao_semanal.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/008_reuniao_semanal.sql
docker cp sql/010_crises.sql "$PGCID:/tmp/010_crises.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/010_crises.sql
docker cp sql/011_reuniao_alerta_sugerido.sql "$PGCID:/tmp/011_reuniao_alerta_sugerido.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/011_reuniao_alerta_sugerido.sql
docker cp sql/012_crises_setor.sql "$PGCID:/tmp/012_crises_setor.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/012_crises_setor.sql
docker cp sql/013_crise_comentario.sql "$PGCID:/tmp/013_crise_comentario.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/013_crise_comentario.sql
docker cp sql/014_crise_anexos.sql "$PGCID:/tmp/014_crise_anexos.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/014_crise_anexos.sql
docker cp sql/015_crise_origem_fiscal.sql "$PGCID:/tmp/015_crise_origem_fiscal.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/015_crise_origem_fiscal.sql
docker cp sql/026_custos_terceiros.sql "$PGCID:/tmp/026_custos_terceiros.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/026_custos_terceiros.sql
docker cp sql/028_idx_eventos_projeto_tipo.sql "$PGCID:/tmp/028_idx_eventos_projeto_tipo.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/028_idx_eventos_projeto_tipo.sql
# 016 a 025 ficaram de fora de proposito: sao backfill e limpeza de uma vez
# so (017, 019, 025), ja aplicados a mao. Reexecutar a cada deploy nao
# ajuda e alguns nao sao idempotentes. So DDL idempotente entra aqui.
# 027 nao entra: roda no Supabase Cloud, nao neste Postgres.

echo "▶ 2/6  Build backend (parket-gestao-api:latest)"
docker build -t parket-gestao-api:latest ./backend

echo "▶ 3/6  Build frontend (parket-gestao-web:latest)"
docker build -t parket-gestao-web:latest ./frontend

echo "▶ 4/6  Deploy stack parket-gestao"
docker stack deploy -c deploy/stack.yml parket-gestao --with-registry-auth --detach=true

echo "▶ 5/6  Forçando restart das tasks (mesma tag latest não reinicia sozinha)"
docker service update --force --detach parket-gestao_api
docker service update --force --detach parket-gestao_web

echo "▶ 6/6  Aguardando API subir (até 60s)"
for i in $(seq 1 30); do
    if curl -sf http://localhost/api/health -H 'Host: gestao.parket.works' >/dev/null 2>&1; then
        echo "   → up após ${i}0s"
        break
    fi
    sleep 2
done

echo ""
echo "✅ Gestor deployado — https://gestao.parket.works"
docker service ls | grep parket-gestao_ || true
