#!/bin/bash
# Publish a QStash message that delivers to /api/generate to unstick an order
# whose generation never started. Uses the us-east-1 region.
# Usage: scripts/trigger-generation.sh <orderId>
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

if [[ $# -lt 1 ]]; then
  err "Usage: $0 <orderId>"
  exit 2
fi
ORDER_ID="$1"

ENV_PATH="$(resolve_env_file)"
echo "=== trigger-generation ==="
echo "Reading env: $ENV_PATH"
echo "Order id:    $ORDER_ID"

QSTASH_TOKEN="$(get_env "$ENV_PATH" QSTASH_TOKEN)"
if [[ -z "$QSTASH_TOKEN" ]]; then
  err "QSTASH_TOKEN not found"
  exit 1
fi

TARGET_URL="${TARGET_URL:-https://mascotinhos.vercel.app/api/generate}"
QSTASH_BASE="https://qstash-us-east-1.upstash.io/v2/publish"
echo "Target URL:  $TARGET_URL"

BODY="{\"orderId\":\"$ORDER_ID\",\"action\":\"generate\",\"attempt\":1}"

resp=$(mktemp)
code=$(curl -sS -o "$resp" -w '%{http_code}' -X POST \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Upstash-Delay: 0s" \
  -H "Upstash-Retries: 3" \
  -d "$BODY" \
  "$QSTASH_BASE/$TARGET_URL")
echo "POST $QSTASH_BASE/$TARGET_URL -> HTTP $code"
echo "--- response body ---"
cat "$resp"; echo
rm -f "$resp"

if [[ "$code" != "200" && "$code" != "202" ]]; then
  err "publish failed"
  exit 1
fi
