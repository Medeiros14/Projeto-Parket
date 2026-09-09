#!/bin/bash
# Deploy do stack parket-ai-squad com segredos do EAS expostos como env vars.
# Uso: ./deploy-eas.sh
#
# A senha do basic auth do Will fica no .env-eas (não comitar no git).

set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env-eas ]; then
  echo "ERRO: .env-eas não encontrado. Crie com EAS_BASIC_AUTH_HTPASSWD=..."
  exit 1
fi

. ./.env-eas

echo "Re-deploy parket-ai-squad com EAS habilitado..."
docker stack deploy -c stack.yml parket-ai-squad

echo ""
echo "Esperando convergência do eas..."
until docker service ls --format '{{.Name}} {{.Replicas}}' | grep -E '^parket-ai-squad_eas 1/1' >/dev/null; do
  sleep 2
done
echo "✓ eas 1/1"
echo ""
echo "Smoke: /health (público)"
curl -sf https://os.parket.works/health && echo ""
echo ""
echo "Smoke: /agents com Bearer (deve listar agentes)"
curl -sf -H "Authorization: Bearer ${OS_SECURITY_KEY}" https://os.parket.works/agents | head -c 300 && echo ""
echo ""
echo "Smoke: /agents sem auth (deve dar 401)"
code=$(curl -s -o /dev/null -w '%{http_code}' https://os.parket.works/agents)
echo "HTTP $code"
[ "$code" = "401" ] || { echo "ERRO: rota sem auth deveria ser 401"; exit 1; }
echo ""
echo "Deploy concluído."
