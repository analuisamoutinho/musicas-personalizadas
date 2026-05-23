#!/bin/bash
# Manually fire the bot's /api/payments/webhook endpoint with a synthetic
# PAYMENT_RECEIVED payload. For when Asaas didn't fire (or to test locally).
# Usage: scripts/trigger-payment-webhook.sh <pay_id> <orderId>
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

if [[ $# -lt 2 ]]; then
  err "Usage: $0 <pay_id> <orderId>"
  exit 2
fi
PAY_ID="$1"
ORDER_ID="$2"

ENV_PATH="$(resolve_env_file)"
echo "=== trigger-payment-webhook ==="
echo "Reading env: $ENV_PATH"
echo "Payment id:  $PAY_ID"
echo "Order id:    $ORDER_ID"

WEBHOOK_SECRET="$(get_env "$ENV_PATH" ASAAS_WEBHOOK_SECRET)"
if [[ -z "$WEBHOOK_SECRET" ]]; then
  err "ASAAS_WEBHOOK_SECRET not found"
  exit 1
fi

TARGET_URL="${TARGET_URL:-https://mascotinhos.vercel.app/api/payments/webhook}"
echo "Target URL:  $TARGET_URL"

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BODY=$(cat <<JSON
{
  "id": "evt_diag_$(date +%s)",
  "event": "PAYMENT_RECEIVED",
  "dateCreated": "$NOW",
  "payment": {
    "id": "$PAY_ID",
    "status": "RECEIVED",
    "value": 29.90,
    "netValue": 29.90,
    "billingType": "PIX",
    "externalReference": "$ORDER_ID",
    "paymentDate": "$NOW",
    "confirmedDate": "$NOW"
  }
}
JSON
)

resp=$(mktemp)
code=$(curl -sS -o "$resp" -w '%{http_code}' -X POST \
  -H "asaas-access-token: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "$TARGET_URL")
echo "POST $TARGET_URL -> HTTP $code"
echo "--- response body ---"
cat "$resp"; echo
rm -f "$resp"

if [[ "$code" != "200" ]]; then
  err "webhook returned non-200"
  exit 1
fi
