#!/bin/bash
# End-to-end Asaas API smoke test against PRODUCTION.
# Creates a R$5.00 PIX charge against a placeholder customer, fetches QR,
# then deletes both. Exits non-zero on any failure.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

ENV_PATH="$(resolve_env_file)"
echo "=== asaas-test-flow ==="
echo "Reading env: $ENV_PATH"

ASAAS_API_KEY="$(get_env "$ENV_PATH" ASAAS_API_KEY)"
if [[ -z "$ASAAS_API_KEY" ]]; then
  err "ASAAS_API_KEY not found in $ENV_PATH"
  exit 1
fi

BASE="https://api.asaas.com/v3"
HDR_AUTH="access_token: $ASAAS_API_KEY"
HDR_CT="Content-Type: application/json"

cleanup_charge_id=""
cleanup_customer_id=""

cleanup() {
  echo ""
  echo "=== cleanup ==="
  if [[ -n "$cleanup_charge_id" ]]; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE \
      -H "$HDR_AUTH" "$BASE/payments/$cleanup_charge_id" || true)
    echo "DELETE /payments/$cleanup_charge_id -> HTTP $code"
  fi
  if [[ -n "$cleanup_customer_id" ]]; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE \
      -H "$HDR_AUTH" "$BASE/customers/$cleanup_customer_id" || true)
    echo "DELETE /customers/$cleanup_customer_id -> HTTP $code"
  fi
}
trap cleanup EXIT

echo ""
echo "=== step 1: create customer ==="
resp=$(mktemp)
code=$(curl -sS -o "$resp" -w '%{http_code}' -X POST \
  -H "$HDR_AUTH" -H "$HDR_CT" \
  -d '{"name":"Mascotinhos Diagnostic","cpfCnpj":"00000000191","email":"diag@mascotinhos.test"}' \
  "$BASE/customers")
echo "POST /customers -> HTTP $code"
if [[ "$code" != "200" ]]; then
  cat "$resp"; echo
  err "create customer failed"
  exit 1
fi
cleanup_customer_id="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("id",""))' "$resp")"
echo "customer.id=$cleanup_customer_id"

echo ""
echo "=== step 2: create R\$5.00 PIX charge ==="
due=$(date -u -d '+3 days' +%Y-%m-%d 2>/dev/null || date -u -v+3d +%Y-%m-%d)
code=$(curl -sS -o "$resp" -w '%{http_code}' -X POST \
  -H "$HDR_AUTH" -H "$HDR_CT" \
  -d "{\"customer\":\"$cleanup_customer_id\",\"billingType\":\"PIX\",\"value\":5.00,\"dueDate\":\"$due\",\"description\":\"diagnostic\"}" \
  "$BASE/payments")
echo "POST /payments -> HTTP $code"
if [[ "$code" != "200" ]]; then
  cat "$resp"; echo
  err "create payment failed"
  exit 1
fi
cleanup_charge_id="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("id",""))' "$resp")"
status="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("status",""))' "$resp")"
echo "payment.id=$cleanup_charge_id status=$status"

echo ""
echo "=== step 3: fetch PIX QR code ==="
code=$(curl -sS -o "$resp" -w '%{http_code}' \
  -H "$HDR_AUTH" "$BASE/payments/$cleanup_charge_id/pixQrCode")
echo "GET /payments/$cleanup_charge_id/pixQrCode -> HTTP $code"
if [[ "$code" != "200" ]]; then
  cat "$resp"; echo
  err "fetch qr failed"
  exit 1
fi
python3 - "$resp" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
img = d.get("encodedImage") or ""
payload = d.get("payload") or ""
ok = bool(img) and payload.startswith("00020")
print(f"encodedImage.len={len(img)}")
print(f"payload.len={len(payload)} starts_with_00020={payload.startswith('00020')}")
sys.exit(0 if ok else 1)
PY

echo ""
echo "=== flow OK ==="
rm -f "$resp"
