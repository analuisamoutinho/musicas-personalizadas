#!/bin/bash
# List all PENDING payments and their order's conversation state via
# Supabase PostgREST. Spots orders waiting on payment vs paid-but-not-
# confirmed mismatches.
# Usage: scripts/db-stuck-payments.sh
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

env_file="$(resolve_env_file)"
SUPABASE_URL="$(get_env "$env_file" SUPABASE_URL)"
SUPABASE_KEY="$(get_env "$env_file" SUPABASE_SERVICE_ROLE_KEY)"

echo "=== db-stuck-payments ==="
echo "Reading env: $env_file"
echo

curl -sS \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  "$SUPABASE_URL/rest/v1/Payment?status=eq.PENDING&select=id,asaasId,status,createdAt,orderId,Order(id,conversationState,orderStatus,updatedAt)&order=createdAt.desc" \
  | python3 -c '
import sys, json
from datetime import datetime, timezone
rows = json.load(sys.stdin)
print(f"Found {len(rows)} PENDING payment(s)\n")
if not rows:
    sys.exit(0)
fmt = "{:<28} {:<28} {:<20} {:<13} {:>8}  {}"
print(fmt.format("PAYMENT_ID", "ORDER_ID", "CONV_STATE", "ORDER_STATUS", "AGE_MIN", "ASAAS_ID"))
print("-" * 120)
now = datetime.now(timezone.utc)
paid_with_pending = 0
for p in rows:
    created = datetime.fromisoformat(p["createdAt"].replace("Z", "+00:00"))
    age_min = int((now - created).total_seconds() / 60)
    o = p.get("Order") or {}
    if o.get("orderStatus") == "PAID":
        paid_with_pending += 1
    print(fmt.format(p["id"], o.get("id") or "-", o.get("conversationState") or "(no order)", o.get("orderStatus") or "-", age_min, p["asaasId"]))
if paid_with_pending:
    print(f"\nWARNING: {paid_with_pending} order(s) have orderStatus=PAID but still have a PENDING payment row.")
'
