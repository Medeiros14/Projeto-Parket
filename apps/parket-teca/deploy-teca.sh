#!/bin/bash
# Deploy do Núcleo Teca — build + stack deploy + ingest inicial
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ 1/6  Aplicando schema teca.* no parket-pg-local"
PGCID=$(docker ps -q -f name=parket-pg-local_postgres | head -1)
docker cp sql/001_schema_teca.sql "$PGCID:/tmp/001_schema_teca.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/001_schema_teca.sql

echo "▶ 2/6  Criando secret Anthropic OAuth (se não existir)"
if ! docker secret ls --format '{{.Name}}' | grep -qx teca_anthropic_oauth; then
    TOKEN=$(python3 -c 'import json;print(json.load(open("/root/.claude/.credentials.json"))["claudeAiOauth"]["accessToken"])')
    echo -n "$TOKEN" | docker secret create teca_anthropic_oauth -
    echo "   → secret teca_anthropic_oauth criado"
else
    echo "   → secret teca_anthropic_oauth já existe"
fi

echo "▶ 3/6  Build backend (parket-teca-api:latest)"
docker build -t parket-teca-api:latest ./backend

echo "▶ 4/6  Build frontend (parket-teca-web:latest)"
docker build -t parket-teca-web:latest ./frontend

echo "▶ 5/6  Deploy stack parket-teca"
docker stack deploy -c deploy/stack.yml parket-teca --with-registry-auth --detach=true

echo "▶ 6/6  Aguardando API subir (até 60s)"
for i in $(seq 1 30); do
    if curl -sf http://localhost/api/health -H 'Host: teca.parket.works' >/dev/null 2>&1; then
        echo "   → up após ${i}0s"
        break
    fi
    sleep 2
done

echo ""
echo "▶ Ingest inicial (tabelas + memórias)"
docker exec "$(docker ps -q -f name=parket-teca_api | head -1)" curl -sf -X POST http://localhost:8000/api/ingest/tables && echo
docker exec "$(docker ps -q -f name=parket-teca_api | head -1)" curl -sf -X POST http://localhost:8000/api/ingest/docs && echo

echo ""
echo "✅ Núcleo Teca deployado — https://teca.parket.works"
docker service ls | grep parket-teca_
