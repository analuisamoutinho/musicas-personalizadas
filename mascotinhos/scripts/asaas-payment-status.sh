#!/bin/bash
# Fetch a single Asaas payment by id and print key fields.
# Usage: scripts/asaas-payment-status.sh <pay_id>
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

if [[ $# -lt 1 ]]; then
  err "Usage: $0 <pay_id>"
  exit 2
fi
PAY_ID="$1"

ENV_PATH="$(resolve_env_file)"
echo "=== asaas-payment-status ==="
echo "Reading env: $ENV_PATH"
echo "Payment id:  $PAY_ID"

ASAAS_API_KEY="$(get_env "$ENV_PATH" ASAAS_API_KEY)"
if [[ -z "$ASAAS_API_KEY" ]]; then
  err "ASAAS_API_KEY not found"
  exit 1
fi

BASE="https://api.asaas.com/v3"
resp=$(mktemp)
code=$(curl -sS -o "$resp" -w '%{http_code}' \
  -H "access_token: $ASAAS_API_KEY" "$BASE/payments/$PAY_ID")
echo "GET /payments/$PAY_ID -> HTTP $code"
if [[ "$code" != "200" ]]; then
  cat "$resp"; echo
  err "fetch failed"
  exit 1
fi

python3 - "$resp" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
fields = ["id", "status", "value", "netValue", "billingType", "dueDate",
          "paymentDate", "clientPaymentDate", "confirmedDate",
          "externalReference", "invoiceUrl", "transactionReceiptUrl",
          "customer", "deleted"]
for k in fields:
    v = d.get(k)
    if v is None:
        continue
    print(f"  {k:<22} = {v}")
PY
rm -f "$resp"
