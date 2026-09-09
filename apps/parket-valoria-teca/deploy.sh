#!/bin/bash
# Build + deploy do parket-valoria-teca.
# Uso: ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Build imagem parket-valoria-teca:latest"
docker build -t parket-valoria-teca:latest .

echo "→ Deploy stack"
docker stack deploy -c stack.yml parket-valoria-teca

# stack deploy com o mesmo tag :latest não reinicia a task — força o restart
echo "→ Forçando restart com a imagem nova"
docker service update --force parket-valoria-teca_api --detach=false >/dev/null

echo "→ Esperando convergência do serviço..."
for i in $(seq 1 60); do
  state=$(docker service ls --format '{{.Name}} {{.Replicas}}' | grep '^parket-valoria-teca_api ' || true)
  if [[ "$state" == *"1/1"* ]]; then
    echo "  ✓ $state"
    break
  fi
  echo "  ...aguardando ($i/60): ${state:-not-yet}"
  sleep 2
done

echo "→ Smoke test /health"
sleep 2
curl -sf https://api.parket.works/valoria-teca/health || {
  echo "  ⚠ /health falhou — checar traefik/DNS"
  exit 1
}
echo ""

echo "→ /debug/oauth"
curl -sf https://api.parket.works/valoria-teca/debug/oauth | python3 -m json.tool || true
echo ""

echo "✓ Deploy concluído. URL: https://api.parket.works/valoria-teca"
