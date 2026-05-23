#!/bin/bash
# List configured Asaas webhooks. Verifies the bot's webhook is registered
# and shows the auth-token presence (without revealing it).
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

ENV_PATH="$(resolve_env_file)"
echo "=== asaas-list-webhooks ==="
echo "Reading env: $ENV_PATH"

ASAAS_API_KEY="$(get_env "$ENV_PATH" ASAAS_API_KEY)"
if [[ -z "$ASAAS_API_KEY" ]]; then
  err "ASAAS_API_KEY not found"
  exit 1
fi

BASE="https://api.asaas.com/v3"

resp=$(mktemp)
code=$(curl -sS -o "$resp" -w '%{http_code}' \
  -H "access_token: $ASAAS_API_KEY" "$BASE/webhooks?limit=100")
echo "GET /webhooks -> HTTP $code"
if [[ "$code" != "200" ]]; then
  cat "$resp"; echo
  err "list failed"
  exit 1
fi

python3 - "$resp" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
items = d.get("data") or []
print(f"\n{'ID':<26} {'ENABLED':<8} {'AUTH':<6} URL  EVENTS")
print("-" * 100)
for w in items:
    wid = w.get("id","")
    enabled = str(w.get("enabled", w.get("interrupted") is False))
    has_auth = "yes" if w.get("authToken") else "no"
    url = w.get("url","")
    events = ",".join(w.get("events") or []) or "-"
    print(f"{wid:<26} {enabled:<8} {has_auth:<6} {url}")
    print(f"{'':<26} {'':<8} {'':<6}   events: {events}")
print(f"\nTotal: {len(items)}")
PY
rm -f "$resp"
