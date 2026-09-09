#!/bin/bash
# Deploy parket-contratos — build + stack deploy
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ 1/3  Build frontend (parket-contratos-web:latest)"
docker build -t parket-contratos-web:latest ./frontend

echo "▶ 2/3  Deploy stack parket-contratos"
docker stack deploy -c deploy/stack.yml parket-contratos --with-registry-auth --detach=true

echo "▶ 3/3  Aguardando web subir (até 40s)"
for i in $(seq 1 20); do
    if curl -sf http://localhost -H 'Host: contrato.parket.works' >/dev/null 2>&1; then
        echo "   → up após ${i}0s"
        break
    fi
    sleep 2
done

echo ""
echo "✅ Contratos deployado — https://contrato.parket.works"
docker service ls | grep parket-contratos_
