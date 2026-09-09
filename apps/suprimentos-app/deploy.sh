#!/usr/bin/env bash
# ============================================================
# Deploy do Compras (frontend) com PORTÃO anti-crash.
# Uso: ./deploy.sh [tag-descritiva]
#   ex: ./deploy.sh bulk-fix
#
# Por que existe: o build Vite/esbuild NÃO checa tipos — um símbolo
# inexistente (ex: `sel is not defined`) passa no build e vira
# ReferenceError/tela-branca em produção. Este script roda tsc ANTES
# e BLOQUEIA o deploy se achar erro da classe ReferenceError.
# (07/07/2026 — crash "sel is not defined" ao montar orçamento.)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

SERVICE="parket-suprimentos_web"
IMAGE="parket-suprimentos:latest"
SUFFIX="${1:-deploy}"
TS="$(date +%s)"
ROLLBACK_TAG="parket-suprimentos:${SUFFIX}-${TS}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok(){ echo -e "${GREEN}[OK]${NC} $1"; }
warn(){ echo -e "${YELLOW}[..]${NC} $1"; }
die(){ echo -e "${RED}[BLOQUEADO]${NC} $1"; exit 1; }

# ---- 1. PORTÃO: tsc — barra erro de símbolo inexistente (= ReferenceError) ----
# TS2304/TS2552: Cannot find name 'X'  |  TS2448/TS2454: usado antes de declarar/atribuir.
# NÃO barramos ruído de tipo (SelectQueryError, módulo ausente, property does not exist).
warn "Rodando typecheck (portão anti-ReferenceError)..."
TSC_OUT="$(npx tsc --noEmit -p tsconfig.json 2>&1 || true)"
FATAL="$(echo "$TSC_OUT" | grep -E "error TS(2304|2552|2448|2454):" || true)"
if [ -n "$FATAL" ]; then
  echo "$FATAL"
  die "Símbolo inexistente/uso-antes-de-declarar detectado. Isso VIRA CRASH em produção. Corrija antes de deployar."
fi
ok "Typecheck limpo (sem erros de símbolo inexistente)."

# ---- 2. Build ----
warn "Buildando imagem $IMAGE ..."
docker build -t "$IMAGE" . >/tmp/compras-build.log 2>&1 || { tail -20 /tmp/compras-build.log; die "Build da imagem falhou."; }
ok "Imagem buildada."

# ---- 3. Tag de rollback ----
docker tag "$IMAGE" "$ROLLBACK_TAG"
ok "Rollback tag: $ROLLBACK_TAG"

# ---- 4. Deploy ----
warn "Deployando $SERVICE ..."
docker service update --force --image "$IMAGE" "$SERVICE" >/dev/null
until docker service ls --format '{{.Name}} {{.Replicas}}' | grep -qE "^${SERVICE} 1/1"; do sleep 2; done
ok "Serviço convergido 1/1."

# ---- 5. Smoke test ----
warn "Smoke test..."
CODE="$(curl -s -o /dev/null -w '%{http_code}' https://suprimentos.parket.works/)"
[ "$CODE" = "200" ] || die "suprimentos.parket.works retornou HTTP $CODE (esperado 200)."
JS="$(curl -s https://suprimentos.parket.works/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
[ -n "$JS" ] || die "Não achei o chunk JS no HTML servido."
JSCODE="$(curl -s -o /dev/null -w '%{http_code}' "https://suprimentos.parket.works/$JS")"
[ "$JSCODE" = "200" ] || die "Chunk $JS retornou HTTP $JSCODE."
ok "Smoke OK — HTTP 200, chunk servido: $JS"

echo ""
ok "Deploy concluído. Rollback: docker service update --force --image $ROLLBACK_TAG $SERVICE"
