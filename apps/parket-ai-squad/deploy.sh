#!/usr/bin/env bash
# ============================================================
# Parket AI Squad - Portainer Auto-Deploy Script
# ============================================================
# Uses Portainer API to deploy/update the Docker Swarm stack.
# Usage: ./deploy.sh [--env /path/to/.env]
#
# Requirements: curl, jq
# ============================================================

set -euo pipefail

PORTAINER_URL="${PORTAINER_URL:-https://painel.parket.works}"
PORTAINER_USER="${PORTAINER_USERNAME:-admin}"
PORTAINER_PASS="${PORTAINER_PASSWORD:-@Parket_admsrvIA}"
STACK_NAME="parket-ai-squad"
STACK_FILE="$(dirname "$0")/stack.yml"
ENV_FILE="${ENV_FILE:-$(dirname "$0")/.env}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
ok()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

# ---- 1. Authenticate with Portainer ----
log "Authenticating with Portainer at ${PORTAINER_URL}..."

AUTH_RESPONSE=$(curl -sk -X POST \
  "${PORTAINER_URL}/api/auth" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${PORTAINER_USER}\",\"password\":\"${PORTAINER_PASS}\"}")

JWT=$(echo "$AUTH_RESPONSE" | jq -r '.jwt // empty')
if [ -z "$JWT" ]; then
  err "Authentication failed: $AUTH_RESPONSE"
fi
ok "Authenticated successfully"

# ---- 2. Get Swarm endpoint ----
log "Finding Docker Swarm endpoint..."

ENDPOINTS=$(curl -sk \
  "${PORTAINER_URL}/api/endpoints" \
  -H "Authorization: Bearer ${JWT}")

# Get the first endpoint with Swarm enabled (type=2 is Swarm)
ENDPOINT_ID=$(echo "$ENDPOINTS" | jq -r '.[] | select(.Snapshots[0].Swarm == true) | .Id' | head -1)

if [ -z "$ENDPOINT_ID" ]; then
  # Fallback: try any endpoint
  ENDPOINT_ID=$(echo "$ENDPOINTS" | jq -r '.[0].Id // empty')
fi

if [ -z "$ENDPOINT_ID" ]; then
  err "No Docker endpoint found in Portainer"
fi
ok "Using endpoint ID: ${ENDPOINT_ID}"

# ---- 3. Get Swarm ID ----
log "Getting Swarm ID..."

SWARM_INFO=$(curl -sk \
  "${PORTAINER_URL}/api/endpoints/${ENDPOINT_ID}/docker/swarm" \
  -H "Authorization: Bearer ${JWT}")

SWARM_ID=$(echo "$SWARM_INFO" | jq -r '.ID // empty')
if [ -z "$SWARM_ID" ]; then
  err "Could not get Swarm ID: $SWARM_INFO"
fi
ok "Swarm ID: ${SWARM_ID}"

# ---- 4. Read stack file ----
if [ ! -f "$STACK_FILE" ]; then
  err "Stack file not found: $STACK_FILE"
fi
STACK_CONTENT=$(cat "$STACK_FILE")

# ---- 5. Build environment variables array ----
ENV_VARS="[]"
if [ -f "$ENV_FILE" ]; then
  log "Loading environment from ${ENV_FILE}..."
  ENV_VARS=$(grep -v '^#' "$ENV_FILE" | grep -v '^$' | while IFS='=' read -r key val; do
    # Skip comments and empty lines
    [[ "$key" =~ ^# ]] && continue
    [ -z "$key" ] && continue
    echo "{\"name\":\"$key\",\"value\":\"$val\"}"
  done | jq -s '.')
  ok "Loaded $(echo "$ENV_VARS" | jq length) environment variables"
fi

# ---- 6. Check if stack already exists ----
log "Checking for existing stack '${STACK_NAME}'..."

STACKS=$(curl -sk \
  "${PORTAINER_URL}/api/stacks" \
  -H "Authorization: Bearer ${JWT}")

EXISTING_STACK_ID=$(echo "$STACKS" | jq -r ".[] | select(.Name == \"${STACK_NAME}\") | .Id" | head -1)

if [ -n "$EXISTING_STACK_ID" ]; then
  # ---- Update existing stack ----
  warn "Stack '${STACK_NAME}' already exists (ID: ${EXISTING_STACK_ID}). Updating..."

  UPDATE_RESPONSE=$(curl -sk -X PUT \
    "${PORTAINER_URL}/api/stacks/${EXISTING_STACK_ID}?endpointId=${ENDPOINT_ID}" \
    -H "Authorization: Bearer ${JWT}" \
    -H "Content-Type: application/json" \
    -d "{
      \"stackFileContent\": $(echo "$STACK_CONTENT" | jq -Rs .),
      \"env\": ${ENV_VARS},
      \"prune\": false,
      \"pullImage\": true
    }")

  if echo "$UPDATE_RESPONSE" | jq -e '.Id' > /dev/null 2>&1; then
    ok "Stack '${STACK_NAME}' updated successfully!"
  else
    err "Stack update failed: $UPDATE_RESPONSE"
  fi

else
  # ---- Create new stack ----
  log "Creating new stack '${STACK_NAME}'..."

  CREATE_RESPONSE=$(curl -sk -X POST \
    "${PORTAINER_URL}/api/stacks/create/swarm/string?endpointId=${ENDPOINT_ID}" \
    -H "Authorization: Bearer ${JWT}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${STACK_NAME}\",
      \"swarmID\": \"${SWARM_ID}\",
      \"stackFileContent\": $(echo "$STACK_CONTENT" | jq -Rs .),
      \"env\": ${ENV_VARS}
    }")

  if echo "$CREATE_RESPONSE" | jq -e '.Id' > /dev/null 2>&1; then
    CREATED_ID=$(echo "$CREATE_RESPONSE" | jq -r '.Id')
    ok "Stack '${STACK_NAME}' created! ID: ${CREATED_ID}"
  else
    err "Stack creation failed: $CREATE_RESPONSE"
  fi
fi

echo ""
ok "========================================"
ok "Deployment complete!"
ok "========================================"
echo ""
echo "  API:   https://agente.parket.works"
echo "  Admin: https://agente.parket.works"
echo "  Docs:  https://agente.parket.works/docs"
echo ""
warn "NEXT STEPS:"
echo "  1. Authenticate OpenCode accounts (run once per container):"
echo "     docker exec -it <opencode-1-container> opencode auth browser setup"
echo "     docker exec -it <opencode-2-container> opencode auth browser setup"
echo "     docker exec -it <opencode-3-container> opencode auth browser setup"
echo ""
echo "  2. Configure webhook in the admin panel:"
echo "     Settings → Webhook → Usar URL padrão → Configurar"
echo ""
echo "  3. Create agents and link them to WhatsApp groups"
echo "  4. Upload training data for each agent"
