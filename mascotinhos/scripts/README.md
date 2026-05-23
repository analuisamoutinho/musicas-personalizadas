# Operational scripts

Diagnostic and recovery scripts for the Mascotinhos WhatsApp bot. These are
manual-use only; run them when investigating production issues.

## Env file

Every script reads env vars from a single file. Resolution order:

1. `$ENV_FILE` (if set and the path exists)
2. `mascotinhos/apps/web/.env`
3. `/tmp/.env.mascotinhos` (typical output of `vercel env pull`)

Values are read robustly: trailing literal `\n` characters and surrounding
whitespace are stripped, so secrets pulled from Vercel work without manual
clean-up. Run `scripts/inspect-env.sh` first if you suspect a malformed env.

Override with: `ENV_FILE=/path/to/.env scripts/some-script.sh ...`

## Scripts

### `inspect-env.sh`
Scans the env file for keys with stray `\n` literals or trailing whitespace.
Prints a table of `KEY | LEN | CLEAN? | LAST_5_CHARS`. Exits 1 if any value
needs cleaning, 0 otherwise. Run this first when something "should be working
but isn't" — a stray `\n` in `SUPABASE_URL` or `ASAAS_API_KEY` will silently
break HTTP calls.

```bash
scripts/inspect-env.sh
ENV_FILE=/tmp/.env.mascotinhos scripts/inspect-env.sh
```

### `asaas-test-flow.sh`
End-to-end Asaas API smoke test against PRODUCTION. Creates a test customer
(CPF `00000000191`), creates a R$5 PIX charge, fetches the QR code, and
deletes both. Confirms QR `payload` starts with `00020`. Cleans up on exit.

```bash
scripts/asaas-test-flow.sh
```

### `asaas-list-webhooks.sh`
Lists the Asaas webhooks registered for the account. Use to verify the bot's
production webhook is configured with `enabled=true` and an auth token.

```bash
scripts/asaas-list-webhooks.sh
```

### `asaas-payment-status.sh <pay_id>`
Fetches a single Asaas payment and prints its key fields (status, value,
paymentDate, externalReference, invoiceUrl). Use to check whether a charge
was actually paid in Asaas.

```bash
scripts/asaas-payment-status.sh pay_1234567890
```

### `db-order-state.sh <orderId>`
Prints full DB state for an order: business status, conversation state,
photos, theme/outfit/extras, all payments, and client info. The first place
to look when an order is stuck.

```bash
scripts/db-order-state.sh clxyz...
```

### `db-stuck-payments.sh`
Lists every `Payment` row with `status=PENDING`, joined with the order's
`conversationState` and `orderStatus`. Flags the dangerous case of a PAID
order with a still-PENDING payment row.

```bash
scripts/db-stuck-payments.sh
```

### `redis-history.sh <orderId>`
Pulls the conversation history from Upstash Redis (key `history:{orderId}`)
and prints it as `[N] role: content` lines, truncated to 200 chars each. Use
to debug what the user/LLM actually said.

```bash
scripts/redis-history.sh clxyz...
```

### `trigger-payment-webhook.sh <pay_id> <orderId>`
Manually fires `/api/payments/webhook` with a synthetic `PAYMENT_RECEIVED`
payload, signed with `ASAAS_WEBHOOK_SECRET`. Use when Asaas didn't fire (or
to verify the webhook handler in production). Override `TARGET_URL` for
preview deploys.

```bash
scripts/trigger-payment-webhook.sh pay_1234 clxyz...
TARGET_URL=https://preview.vercel.app/api/payments/webhook \
  scripts/trigger-payment-webhook.sh pay_1234 clxyz...
```

### `trigger-generation.sh <orderId>`
Publishes a QStash message (us-east-1 region) targeting `/api/generate` with
`{orderId, action: "generate", attempt: 1}` and zero delay. Unsticks orders
whose generation didn't kick off after payment. Override `TARGET_URL` for
preview deploys.

```bash
scripts/trigger-generation.sh clxyz...
```
