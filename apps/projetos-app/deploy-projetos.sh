#!/bin/bash
# Deploy do Setor de Projetos (espelho Trello) — SQL + build + stack deploy
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ 1/6  Aplicando schema trello_projetos.* no parket-pg-local"
PGCID=$(docker ps -q -f name=parket-pg-local_postgres | head -1)
if [ -z "$PGCID" ]; then
    echo "✗ parket-pg-local não encontrado"; exit 1
fi
docker cp sql/001_schema.sql "$PGCID:/tmp/projetos_001_schema.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_001_schema.sql
docker cp sql/002_projetista.sql "$PGCID:/tmp/projetos_002_projetista.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_002_projetista.sql
docker cp sql/003_notif_seen.sql "$PGCID:/tmp/projetos_003_notif_seen.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_003_notif_seen.sql
docker cp sql/004_calendar_v2.sql "$PGCID:/tmp/projetos_004_calendar_v2.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_004_calendar_v2.sql
docker cp sql/005_calendar_responsavel.sql "$PGCID:/tmp/projetos_005_calendar_responsavel.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_005_calendar_responsavel.sql
docker cp sql/006_card_override_dados.sql "$PGCID:/tmp/projetos_006_card_override.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_006_card_override.sql
docker cp sql/007_tipos_delegacao.sql "$PGCID:/tmp/projetos_007_tipos_delegacao.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_007_tipos_delegacao.sql
docker cp sql/008_atribuicao_campos.sql "$PGCID:/tmp/projetos_008_atribuicao_campos.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_008_atribuicao_campos.sql
docker cp sql/009_comentarios_locais.sql "$PGCID:/tmp/projetos_009_comentarios_locais.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_009_comentarios_locais.sql
docker cp sql/010_space_card_irmaos.sql "$PGCID:/tmp/projetos_010_space_card_irmaos.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_010_space_card_irmaos.sql
docker cp sql/011_etapa_projetista.sql "$PGCID:/tmp/projetos_011_etapa_projetista.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_011_etapa_projetista.sql
docker cp sql/012_card_projetistas_multi.sql "$PGCID:/tmp/projetos_012_card_projetistas_multi.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_012_card_projetistas_multi.sql
docker cp sql/013_relatorio.sql "$PGCID:/tmp/projetos_013_relatorio.sql"
docker exec "$PGCID" psql -U postgres -d postgres -f /tmp/projetos_013_relatorio.sql

echo "▶ 2/6  Build backend (parket-projetos-api:latest)"
docker build -t parket-projetos-api:latest ./backend

echo "▶ 3/6  Build frontend (parket-projetos-web:latest)"
docker build -t parket-projetos-web:latest ./frontend

echo "▶ 4/6  Deploy stack parket-projetos"
docker stack deploy -c deploy/stack.yml parket-projetos --with-registry-auth --detach=true

echo "▶ 5/6  Forçando restart das tasks"
docker service update --force --detach parket-projetos_api
docker service update --force --detach parket-projetos_web

echo "▶ 6/6  Aguardando API subir (até 60s)"
for i in $(seq 1 30); do
    if curl -sf http://localhost/api/health -H 'Host: projetos.parket.works' >/dev/null 2>&1; then
        echo "   → up após ${i}x2s"
        break
    fi
    sleep 2
done

echo ""
echo "✅ Projetos deployado — https://projetos.parket.works"
docker service ls | grep parket-projetos_ || true
