#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ 1/3  Build parket-whisper:latest"
docker build -t parket-whisper:latest .

echo "▶ 2/3  Deploy stack parket-whisper"
docker stack deploy -c stack.yml parket-whisper --with-registry-auth --detach=true

echo "▶ 3/3  Aguardando modelo carregar (baixa ~460MB no primeiro boot)"
for i in $(seq 1 60); do
    CID=$(docker ps -q -f name=parket-whisper_api | head -1)
    if [ -n "$CID" ] && docker exec "$CID" curl -sf http://localhost:8080/health 2>/dev/null | grep -q '"ok": *true'; then
        echo "   → up após ${i}0s"
        docker exec "$CID" curl -s http://localhost:8080/health
        echo ""
        exit 0
    fi
    sleep 5
done
echo "⚠ timeout esperando health — cheque logs: docker service logs parket-whisper_api --tail=50"
exit 1
