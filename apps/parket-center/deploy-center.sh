#!/usr/bin/env bash
# Deploy da Central do Cliente — center.parket.works (stack parket-center).
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ 1/3  Build da imagem web"
docker build -t parket-center-web:latest ./frontend

echo "▶ 2/3  Stack deploy"
docker stack deploy -c deploy/stack.yml parket-center

echo "▶ 3/3  Force update (tag latest não reinicia sozinha)"
docker service update --force parket-center_web >/dev/null

echo "✅ Central do Cliente deployada — https://center.parket.works"
docker service ls | grep parket-center
