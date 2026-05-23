#!/bin/bash
# Print conversation history stored in Upstash Redis for a given order.
# Truncates each message to 200 chars.
# Usage: scripts/redis-history.sh <orderId>
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

if [[ $# -lt 1 ]]; then
  err "Usage: $0 <orderId>"
  exit 2
fi
ORDER_ID="$1"

ENV_PATH="$(resolve_env_file)"
echo "=== redis-history ==="
echo "Reading env: $ENV_PATH"
echo "Order id:    $ORDER_ID"

REDIS_URL="$(get_env "$ENV_PATH" UPSTASH_REDIS_REST_URL)"
REDIS_TOKEN="$(get_env "$ENV_PATH" UPSTASH_REDIS_REST_TOKEN)"
if [[ -z "$REDIS_URL" || -z "$REDIS_TOKEN" ]]; then
  err "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found"
  exit 1
fi

KEY="history:$ORDER_ID"
resp=$(mktemp)
code=$(curl -sS -o "$resp" -w '%{http_code}' \
  -H "Authorization: Bearer $REDIS_TOKEN" \
  "$REDIS_URL/lrange/$KEY/0/-1")
echo "GET lrange $KEY -> HTTP $code"
if [[ "$code" != "200" ]]; then
  cat "$resp"; echo
  err "redis call failed"
  exit 1
fi

python3 - "$resp" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
items = d.get("result") or []
print(f"\n{len(items)} message(s) in history\n")
for i, raw in enumerate(items):
    # Upstash returns each entry as a JSON string; parse if possible.
    msg = raw
    if isinstance(raw, str):
        try:
            msg = json.loads(raw)
        except Exception:
            msg = {"role": "?", "content": raw}
    role = msg.get("role", "?") if isinstance(msg, dict) else "?"
    content = msg.get("content", "") if isinstance(msg, dict) else str(msg)
    if len(content) > 200:
        content = content[:200] + "..."
    print(f"[{i:>3}] {role:<10} {content}")
PY
rm -f "$resp"
