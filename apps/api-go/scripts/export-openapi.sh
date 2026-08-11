#!/usr/bin/env bash
# export-openapi.sh — re-export OpenAPI spec from running NestJS API.
#
# Assumes the NestJS API is running at 127.0.0.1:8080 (or API_PORT).
# The .env at the repo root provides DATABASE_URL etc; we override JWT_SECRET
# with a fresh random so the server can boot past the assertStrongJwtSecret
# check (the dev .env's JWT_SECRET is the placeholder value).
#
# Usage:
#   bash scripts/export-openapi.sh
#
# Output:
#   apps/api-go/api/openapi.yaml — YAML form (via PyYAML) of the swagger JSON.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
API_PORT="${API_PORT:-8080}"
SPEC_JSON="/tmp/nestjs-swagger.json"
SPEC_YAML="${REPO_ROOT}/apps/api-go/api/openapi.yaml"

echo "[1/4] Booting NestJS API (port ${API_PORT})…"
JWT_SECRET="$(openssl rand -hex 32)" \
DATABASE_URL="mysql://ai_academy:ai_academy_pass@127.0.0.1:3307/ai_academy" \
API_PORT="${API_PORT}" \
API_HOST=127.0.0.1 \
NODE_ENV=development \
CORS_ORIGIN="http://localhost:3000" \
REDIS_HOST=127.0.0.1 \
REDIS_PORT=6380 \
S3_ENDPOINT="http://127.0.0.1:9010" \
S3_BUCKET=ai-academy \
S3_ACCESS_KEY=minioadmin \
S3_SECRET_KEY=minioadmin \
S3_REGION=us-east-1 \
S3_FORCE_PATH_STYLE=true \
STRIPE_SECRET_KEY="" \
GEMINI_API_KEY="" \
  nohup node "${REPO_ROOT}/apps/api/dist/src/main.js" > /tmp/nestjs-export.log 2>&1 &
NEST_PID=$!
trap "kill $NEST_PID 2>/dev/null || true" EXIT

echo "[2/4] Waiting for NestJS to log 'successfully started'…"
for i in $(seq 1 30); do
  if grep -q "successfully started" /tmp/nestjs-export.log 2>/dev/null; then
    echo "    ready in ${i}s"
    break
  fi
  sleep 1
done

echo "[3/4] GET /api/docs-json → ${SPEC_JSON}"
curl -sS "http://127.0.0.1:${API_PORT}/api/docs-json" -o "${SPEC_JSON}"
echo "    size: $(wc -c < "${SPEC_JSON}") bytes"

echo "[4/4] Converting to YAML → ${SPEC_YAML}"
python3 - <<PY
import json, sys
try:
    import yaml
except ImportError:
    print('PyYAML not installed; pip install pyyaml', file=sys.stderr)
    sys.exit(1)
with open("${SPEC_JSON}") as f:
    data = json.load(f)
with open("${SPEC_YAML}", "w") as f:
    yaml.dump(data, f, default_flow_style=False, sort_keys=False,
              allow_unicode=True, width=200)
PY

echo "Done. ${SPEC_YAML} written."
