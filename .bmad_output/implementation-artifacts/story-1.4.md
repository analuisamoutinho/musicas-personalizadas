# Story 1.4: Typed Asaas HTTP Wrapper

Status: done

GitHub Issue: [mgiovani/fotos#44](https://github.com/mgiovani/fotos/issues/44)

**FRs covered:** FR-16 (partial: PIX generation capability), FR-19 (partial: split configuration capability)

## Story

As a developer,
I want a thin, typed HTTP wrapper for the Asaas API,
so that payment-related code has type safety and consistent error handling without the overhead of a full SDK.

## Acceptance Criteria

1. **Given** the `packages/payments` package is created in the monorepo, **When** the Asaas client is implemented, **Then** the package exports: `createOrUpdateCustomer(phone, name)`, `createPixCharge(customerId, orderId, amount, splitConfig?)`, `getPaymentStatus(asaasId)`, `verifyWebhookSignature(token)`, `buildSplitConfig(walletId, percentualValue)`, and types `AppError`, `AsaasSplit`, `AsaasPaymentStatus`, `PixChargeResult`, `AsaasWebhookPayload`.

2. **Given** `NODE_ENV === 'production'`, **When** any Asaas API call is made, **Then** the base URL is `https://api.asaas.com/api/v3`. **Given** any other `NODE_ENV`, **Then** the base URL is `https://sandbox.asaas.com/api/v3`.

3. **Given** the Asaas API returns a non-2xx response, **When** any API call is made, **Then** the error body `{ errors: [{ code, description }] }` is parsed and thrown as `AppError` with `retryable: true` for 5xx and `retryable: false` for 4xx, with `message` set to the first error description (or HTTP status text as fallback).

4. **Given** `POST /payments` succeeds, **When** `createPixCharge` is called, **Then** it returns `{ chargeId: string, pixQrCodeBase64: string, pixCopyPaste: string }`. If `pixQrCode` is null/missing in the response, throw `AppError` with `code: 'PIX_QR_NOT_READY', retryable: true`.

5. **Given** a WhatsApp sender ID (`5511999999999`), **When** `createOrUpdateCustomer` is called, **Then** the `55` country code prefix is stripped before searching Asaas (`GET /customers?phone=11999999999`). If found, returns existing customer `id`. If not found, creates via `POST /customers` and returns new `id`.

6. **Given** `createPixCharge` is called with an `orderId`, **When** a PENDING charge already exists for that `orderId` (checked via `GET /payments?externalReference={orderId}&status=PENDING`), **Then** the existing charge data is returned without creating a duplicate.

7. **Given** an Asaas webhook arrives, **When** `verifyWebhookSignature(token)` is called with the `asaas-access-token` header value, **Then** it uses `crypto.timingSafeEqual` for constant-time comparison and returns `true` only if token matches `ASAAS_WEBHOOK_SECRET`.

8. **Given** the monorepo package boundary rules, **When** any package needs Asaas functionality, **Then** only `packages/payments` calls Asaas API endpoints — all other packages import from `@mascotinhos/payments`.

9. **Given** a new package `packages/payments` is created, **When** tests are run with `bun test`, **Then** all tests pass covering: PIX charge creation (success + duplicate idempotency), customer lookup/create (both branches), payment status check, webhook signature verification (valid + invalid + empty), and error wrapping for 4xx/5xx with parsed error body.

## Tasks / Subtasks

- [x] Create `packages/payments` package scaffold (AC: #8)
  - [x] Create `packages/payments/package.json` — `"name": "@mascotinhos/payments"`, `"type": "module"`, `"exports": { ".": { "default": "./src/index.ts" } }`, scripts: `{ "check-types": "tsc --noEmit", "test": "bun test" }`, dependencies: `{ "@mascotinhos/env": "workspace:*" }`, devDependencies: `{ "@mascotinhos/config": "workspace:*", "typescript": "^5" }`
  - [x] Create `packages/payments/tsconfig.json` — `{ "extends": "@mascotinhos/config/tsconfig.base.json", "compilerOptions": { "outDir": "dist" }, "include": ["src"] }`
  - [x] Create `packages/payments/bunfig.toml` — exact content: `[test]\npreload = ["./src/test-setup.ts"]`
  - [x] Create `packages/payments/src/test-setup.ts` — set all 16 required server env vars (exact content in Testing Strategy section below)

- [x] Implement Asaas HTTP client in `packages/payments/src/client.ts` (AC: #2, #3)
  - [x] Define `AppError` type: `{ code: string; message: string; orderId?: string; retryable: boolean; cause?: unknown }`
  - [x] Define `AsaasWebhookPayload` type: `{ event: "PAYMENT_CONFIRMED" | "PAYMENT_RECEIVED" | "PAYMENT_OVERDUE" | "PAYMENT_DELETED"; payment: { id: string; externalReference: string; status: AsaasPaymentStatus; value: number } }`
  - [x] Implement internal `getBaseUrl()` (NOT exported) — returns `https://api.asaas.com/api/v3` if `process.env.NODE_ENV === 'production'`, else `https://sandbox.asaas.com/api/v3`
  - [x] Implement `asaasRequest<T>(method, path, body?)` — sets `access_token: env.ASAAS_API_KEY` + `Content-Type: application/json` headers; on non-2xx: parse body as `{ errors: [{code, description}] }`, use first error description as message (fallback to `response.statusText`), log `console.log(JSON.stringify({ level: 'warn', event: 'asaas_api_error', status: response.status, path, message }))`, throw `Object.assign(new Error(message), { code: 'ASAAS_API_ERROR', retryable: response.status >= 500, cause: error } as AppError)`
  - [x] **No retry logic in `asaasRequest`** — callers (QStash, bot-engine) handle retry. Adding retry here would conflict with QStash's own retry policy.
  - [x] Use `import { env } from '@mascotinhos/env/server'` — never `process.env.ASAAS_API_KEY` directly

- [x] Implement customer management in `packages/payments/src/customer.ts` (AC: #5)
  - [x] `createOrUpdateCustomer(phone: string, name: string): Promise<{ id: string }>`
  - [x] Strip `55` country code prefix: `const localPhone = phone.startsWith('55') ? phone.slice(2) : phone`
  - [x] `GET /customers?phone={localPhone}&limit=1` — if `data.length > 0`, return `{ id: data[0].id }`
  - [x] Else `POST /customers` with `{ name, phone: localPhone, mobilePhone: localPhone }` — return `{ id: response.id }`

- [x] Implement PIX charge creation in `packages/payments/src/create-pix.ts` (AC: #4, #6)
  - [x] `createPixCharge(customerId, orderId, amount, splitConfig?)`:
    - First check for existing: `GET /payments?externalReference={orderId}&status=PENDING` — if `data[0]` exists, return mapped result from existing charge (re-fetch `GET /payments/{id}` for full `pixQrCode` if needed)
    - If none found: `POST /payments` with `{ billingType: "PIX", customer: customerId, value: amount, dueDate: tomorrowISO(), description: "Mascotinho - Pedido ${orderId}", externalReference: orderId, split: splitConfig }`
    - Map response: `{ chargeId: r.id, pixQrCodeBase64: r.pixQrCode?.encodedImage, pixCopyPaste: r.pixQrCode?.payload }`
    - If `!r.pixQrCode?.encodedImage`: throw `AppError { code: 'PIX_QR_NOT_READY', retryable: true }`
  - [x] Helper `tomorrowISO()` — returns `new Date(Date.now() + 86400000).toISOString().slice(0, 10)` (YYYY-MM-DD)
  - [x] `getPaymentStatus(asaasId: string): Promise<{ id: string; status: AsaasPaymentStatus; value: number }>` — `GET /payments/${asaasId}`, return `{ id, status, value }`
  - [x] `AsaasPaymentStatus` type: `"PENDING" | "CONFIRMED" | "RECEIVED" | "OVERDUE" | "REFUNDED" | "DELETED"` — `"RECEIVED"` = settled; `"CONFIRMED"` = confirmed, settling
  - [x] `PixChargeResult` type: `{ chargeId: string; pixQrCodeBase64: string; pixCopyPaste: string }`

- [x] Implement webhook verification in `packages/payments/src/verify-webhook.ts` (AC: #7)
  - [x] `verifyWebhookSignature(token: string): boolean`:
    ```typescript
    import { timingSafeEqual } from 'crypto';
    import { env } from '@mascotinhos/env/server';
    export function verifyWebhookSignature(token: string): boolean {
      try {
        const a = Buffer.from(token);
        const b = Buffer.from(env.ASAAS_WEBHOOK_SECRET);
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    }
    ```

- [x] Implement split config helper in `packages/payments/src/split.ts` (AC: #1)
  - [x] `AsaasSplit` type: `{ walletId: string; percentualValue?: number; fixedValue?: number }`
  - [x] `buildSplitConfig(walletId: string, percentualValue: number): AsaasSplit[]` — returns `[{ walletId, percentualValue }]`

- [x] Create package entry point `packages/payments/src/index.ts` (AC: #8)
  - [x] Export all: `createOrUpdateCustomer`, `createPixCharge`, `getPaymentStatus`, `verifyWebhookSignature`, `buildSplitConfig`
  - [x] Export all types: `AppError`, `AsaasSplit`, `AsaasPaymentStatus`, `PixChargeResult`, `AsaasWebhookPayload`

- [x] Write co-located unit tests with `bun test` (AC: #9)
  - [x] `packages/payments/src/client.test.ts` — mock `fetch`; test: 5xx throws `AppError` with `retryable: true`; 4xx throws `AppError` with `retryable: false`; error description from body used as message; 2xx returns parsed JSON
  - [x] `packages/payments/src/customer.test.ts` — mock `fetch`; test: phone with `55` prefix is stripped before search; existing customer returns `id` without POST; new customer calls POST and returns new `id`
  - [x] `packages/payments/src/create-pix.test.ts` — mock `fetch`; test: success path returns `{ chargeId, pixQrCodeBase64, pixCopyPaste }`; existing PENDING charge returned without creating duplicate; missing `pixQrCode` throws `AppError { retryable: true }`; test `getPaymentStatus` maps status correctly
  - [x] `packages/payments/src/verify-webhook.test.ts` — test: matching secret → `true`; wrong secret → `false`; empty string → `false`; different-length strings → `false`

## Dev Notes

### Asaas API Reference

**Authentication:** Header is `access_token` (NOT `Authorization: Bearer`):
```
access_token: $aact_...
Content-Type: application/json
```

**Base URLs:**
- Sandbox: `https://sandbox.asaas.com/api/v3`
- Production: `https://api.asaas.com/api/v3`
- Toggle via `NODE_ENV === 'production'` — no separate env var needed

**Error Response Body (4xx/5xx):**
```typescript
{ errors: [{ code: string, description: string }] }
// e.g. { errors: [{ code: "invalid.billing.type", description: "Tipo de cobrança inválido" }] }
// Use errors[0].description as AppError.message; fallback to response.statusText
```

**List Customers — `GET /customers?phone={localPhone}&limit=1`:**
```typescript
// ⚠️ Phone format: strip country code "55" → "5511999999999" becomes "11999999999"
// Response: { data: [{ id: string, name: string, phone: string }], totalCount: number }
```

**Create Customer — `POST /customers`:**
```typescript
// Request: { name: string, phone: string, mobilePhone: string }
// cpfCnpj is optional for sandbox; omit for MVP (not collected in conversation flow)
// Response: { id: string, ... }
```

**Check for Existing Charge (idempotency) — `GET /payments?externalReference={orderId}&status=PENDING`:**
```typescript
// Response: { data: [{ id, status, pixQrCode: { encodedImage, payload } }], totalCount: number }
// If data.length > 0: re-use existing charge instead of creating a new one
// This prevents duplicate Asaas charges on bot retries / double-taps
// Explicitly documented in Prisma schema comment: "enforce at app layer"
```

**Create PIX Charge — `POST /payments`:**
```typescript
// Request
{
  customer: string,          // Asaas customer ID (required)
  billingType: "PIX",
  value: number,             // 29.90
  dueDate: string,           // YYYY-MM-DD (tomorrow)
  description: string,       // "Mascotinho - Pedido {orderId}"
  externalReference: string, // orderId — used for idempotency lookup
  split?: AsaasSplit[]       // optional partner split
}

// Response (relevant fields)
{
  id: string,                // → Payment.asaasId
  status: "PENDING",
  pixQrCode: {
    encodedImage: string,    // base64 PNG → pixQrCodeBase64 → Story 3.1 uploads to Storage → Payment.pixQrImageUrl
    payload: string          // PIX EMV copy-paste → pixCopyPaste → Payment.pixQrCode
  }
}
```

**⚠️ Prisma Payment model field mapping:**
- `chargeId` (= `r.id`) → stored as `Payment.asaasId`
- `pixCopyPaste` (= `r.pixQrCode.payload`) → stored as `Payment.pixQrCode`
- `pixQrCodeBase64` (= `r.pixQrCode.encodedImage`) → Story 3.1 uploads this to Supabase Storage → URL stored as `Payment.pixQrImageUrl`
- This package does NOT create the Payment DB record — that's Story 3.1's job

**Get Payment Status — `GET /payments/{id}`:**
```typescript
// Status values: "PENDING" | "CONFIRMED" | "RECEIVED" | "OVERDUE" | "REFUNDED" | "DELETED"
// "RECEIVED" = money settled in Asaas account
// "CONFIRMED" = PIX confirmed, settlement pending
// Payment webhook sends "PAYMENT_RECEIVED" event when status becomes RECEIVED
```

**Webhook Signature — `asaas-access-token` header:**
```typescript
// Asaas sends: asaas-access-token: {value of ASAAS_WEBHOOK_SECRET}
// Must use crypto.timingSafeEqual to prevent timing attacks (NFR-08)
import { timingSafeEqual } from 'crypto';
export function verifyWebhookSignature(token: string): boolean {
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(env.ASAAS_WEBHOOK_SECRET);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false; // handles encoding errors gracefully
  }
}
```

### Critical Architecture Rules

1. **ONLY `packages/payments` calls Asaas API** — no other package imports Asaas URLs. [Source: architecture.md#Enforcement Guidelines]

2. **Use `@mascotinhos/env/server` for env access** — never `process.env.ASAAS_API_KEY` directly. [Source: story-1.3.md#Critical Architecture Rules]

3. **`NODE_ENV` controls base URL** — env schema from Story 1.3 is complete; do NOT add new env vars.

4. **AppError throw pattern** — architecture defines it as a `type`, not a class:
   ```typescript
   throw Object.assign(new Error(message), { code, retryable, orderId, cause } as AppError);
   ```

5. **No retry in `asaasRequest`** — QStash and bot-engine handle retries at their layer. Adding retry in this wrapper would conflict with QStash's retry policy (3x exponential backoff already configured). [Source: architecture.md#Error Handling Pattern]

6. **Use native `fetch`** — no `axios`, `node-fetch`, or any HTTP library. Bun + Node.js 18+ have it built-in. [Source: epics.md#Story 1.4 Technical Notes]

7. **Co-located tests** — test files next to source files, no top-level `tests/`. [Source: architecture.md#Test Organization]

8. **`bunfig.toml` preload is MANDATORY** — without it, `@mascotinhos/env/server` crashes on import because env vars aren't set during test. [Source: story-1.3.md#Debug Log, story-1.2.md]

9. **Package auto-discovered** — `workspaces: ["apps/*", "packages/*"]` in root `package.json` picks up `packages/payments` automatically. No changes to root `package.json` or `turbo.json`.

10. **Structured logging in errors** — architecture requires JSON logs. Log failed API calls as:
    ```typescript
    console.log(JSON.stringify({ level: 'warn', event: 'asaas_api_error', status, path, message }));
    ```

11. **`getBaseUrl()` is NOT exported** — internal helper only, prevents misuse from callers.

12. **`AsaasWebhookPayload` lives in `client.ts`** — alongside `AppError` type; exported via `index.ts` for Story 3.2 webhook handler.

### Testing Strategy

**`test-setup.ts` exact content** (copy verbatim from `packages/storage/src/test-setup.ts`):
```typescript
// Sets minimum required env vars for unit tests in the payments package.
// This preload runs before any test module is loaded, so even if a real
// module (not mocked) touches @mascotinhos/env/server, it won't throw.
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['DIRECT_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['SUPABASE_URL'] = 'http://localhost:54321';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';
process.env['OPENAI_API_KEY'] = 'sk-test-key-for-unit-tests';
process.env['ASAAS_API_KEY'] = 'test-asaas-key';
process.env['ASAAS_WEBHOOK_SECRET'] = 'test-asaas-secret';
process.env['WHATSAPP_WEBHOOK_TOKEN'] = 'test-whatsapp-token';
process.env['WHATSAPP_PHONE_NUMBER_ID'] = '123456789';
process.env['WHATSAPP_ACCESS_TOKEN'] = 'test-whatsapp-access';
process.env['QSTASH_TOKEN'] = 'test-qstash-token';
process.env['QSTASH_CURRENT_SIGNING_KEY'] = 'sig_test_current';
process.env['QSTASH_NEXT_SIGNING_KEY'] = 'sig_test_next';
process.env['VERCEL_URL'] = 'https://test.vercel.app';
process.env['OPERATOR_WHATSAPP_NUMBER'] = '5511999999999';
process.env['NODE_ENV'] = 'test';
```

**Mock `fetch` pattern in Bun:**
```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockFetch = mock((url: string, opts: RequestInit) => Promise.resolve({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: () => Promise.resolve({ id: 'pay_123', status: 'PENDING', pixQrCode: { encodedImage: 'base64==', payload: 'pix_emv_payload' } })
}));

beforeEach(() => { global.fetch = mockFetch as unknown as typeof fetch; });
```

**Complete test coverage required:**

| Test file | Cases |
|-----------|-------|
| `client.test.ts` | 5xx → `retryable: true`; 4xx → `retryable: false`; error description from body; 2xx returns JSON |
| `customer.test.ts` | `55` prefix stripped; found → returns existing id (no POST); not found → POST + new id |
| `create-pix.test.ts` | Success → `{chargeId, pixQrCodeBase64, pixCopyPaste}`; PENDING exists → reuse, no duplicate; `pixQrCode` null → `AppError {retryable: true}`; `getPaymentStatus` maps fields |
| `verify-webhook.test.ts` | Match → `true`; wrong → `false`; empty → `false`; different length → `false` |

### Package Structure to Create

```
packages/payments/
├── src/
│   ├── index.ts               # Exports all public API + types
│   ├── client.ts              # asaasRequest() + AppError + AsaasWebhookPayload + getBaseUrl() (internal)
│   ├── customer.ts            # createOrUpdateCustomer() — handles phone normalization
│   ├── create-pix.ts          # createPixCharge() + getPaymentStatus() + PixChargeResult + AsaasPaymentStatus
│   ├── verify-webhook.ts      # verifyWebhookSignature() — crypto.timingSafeEqual
│   ├── split.ts               # buildSplitConfig() + AsaasSplit type
│   ├── test-setup.ts          # Bun preload: all 16 required env vars
│   ├── client.test.ts
│   ├── customer.test.ts
│   ├── create-pix.test.ts
│   └── verify-webhook.test.ts
├── bunfig.toml                # [test] preload = ["./src/test-setup.ts"]
├── package.json               # @mascotinhos/payments
└── tsconfig.json
```

### Dependency on Previous Stories

- **Story 1.1** (done): `Payment.asaasId`, `Payment.pixQrCode`, `Payment.pixQrImageUrl` fields exist in schema — this story's return values map directly to those fields (see Prisma mapping note above)
- **Story 1.2** (done): `bunfig.toml` preload pattern established; `package.json`/`tsconfig.json` structure to follow
- **Story 1.3** (done): All env vars validated — `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET`, `ASAAS_SPLIT_WALLET_ID` (optional). Schema is complete; do NOT modify.

### Downstream Story Impact

| Story | Uses From This Package |
|-------|----------------------|
| 3.1 (PIX QR Code Generation & Delivery) | `createOrUpdateCustomer`, `createPixCharge`, `buildSplitConfig`; maps `pixQrCodeBase64` → Storage upload → `Payment.pixQrImageUrl`; maps `pixCopyPaste` → `Payment.pixQrCode` |
| 3.2 (Payment Webhook Handler) | `verifyWebhookSignature`, `AsaasWebhookPayload` type |
| 3.3 (Payment Confirmation Message) | `getPaymentStatus` |
| 3.4 (Payment Split Config) | `buildSplitConfig`, `AsaasSplit` type |

### Project Structure Notes

- **`packages/payments` does NOT exist** — create entirely from scratch
- **No env changes** — Story 1.3 schema is complete for all Asaas vars
- **No changes to `turbo.json`** — run `cd packages/payments && bun test` directly
- Naming conventions: files kebab-case, functions camelCase, types PascalCase [Source: architecture.md#Naming Patterns]

### References

- [Source: .bmad_output/planning-artifacts/epics.md#Story 1.4]
- [Source: .bmad_output/planning-artifacts/architecture.md#Error Response Structure]
- [Source: .bmad_output/planning-artifacts/architecture.md#Project Structure — payments/ directory]
- [Source: .bmad_output/planning-artifacts/architecture.md#Enforcement Guidelines]
- [Source: .bmad_output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: .bmad_output/planning-artifacts/architecture.md#Error Handling Pattern]
- [Source: .bmad_output/implementation-artifacts/story-1.3.md — env vars, import pattern, test-setup content]
- [Source: .bmad_output/implementation-artifacts/story-1.2.md — bunfig.toml preload, package.json structure]
- [Source: mascotinhos/packages/db/prisma/schema/schema.prisma — Payment model fields]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `tsc --noEmit` reports `Cannot find module 'bun:test'` — pre-existing pattern identical to `packages/storage` and `packages/env`. Bun resolves `bun:test` at runtime; TypeScript doesn't know about it. No fix needed; same behavior in all other packages.
- Initial `create-pix.ts` used `existing.data[0]` without a guard — TypeScript flagged it as possibly `undefined`. Fixed with `const existingPayment = existing.data[0]; if (existingPayment)` guard.
- Same issue in `customer.ts`: `list.data[0]` without guard. Fixed with `const existing = list.data[0]; if (existing)` guard.
- `makeFetch` helper in test files initially accessed `responses[callCount]` without bounds check — TypeScript flagged it as possibly `undefined` when `callCount >= responses.length`. Fixed with: `const idx = callCount < responses.length ? callCount : responses.length - 1; const r = responses[idx] as { status: number; body: unknown }`.
- Unused `url` parameter in `customer.test.ts` mock fixed with underscore prefix `_url`.

### Completion Notes List

- Created `packages/payments` entirely from scratch: 6 source files, 4 test files, 3 config files (17 total).
- `client.ts`: `asaasRequest<T>` generic wrapper with `access_token` header auth, Asaas error body parsing (`{ errors: [{code, description}] }`), structured JSON warn logging, and `retryable` flag based on HTTP status (5xx → true, 4xx → false).
- `customer.ts`: `createOrUpdateCustomer` strips `55` Brazil country code prefix before Asaas lookup; searches existing before creating.
- `create-pix.ts`: `createPixCharge` implements idempotency via `GET /payments?externalReference={orderId}&status=PENDING` before POST; re-fetches full payment if list response lacks `pixQrCode`; throws `PIX_QR_NOT_READY` (retryable) if QR code absent.
- `verify-webhook.ts`: Uses `crypto.timingSafeEqual` for constant-time comparison to prevent timing attacks (NFR-08).
- `split.ts`: `buildSplitConfig` helper for Asaas partner split configuration.
- 20 tests across 4 files, all passing. Storage regression: 17 tests still passing.
- PIX `pixCopyPaste` (copia e cola EMV string) is included in `PixChargeResult` alongside `pixQrCodeBase64` — required because some users cannot scan QR codes.
- `bunfig.toml` preload pattern from Story 1.2 applied correctly; all 16 env vars set in `test-setup.ts`.

### File List

- mascotinhos/packages/payments/package.json (created)
- mascotinhos/packages/payments/tsconfig.json (created)
- mascotinhos/packages/payments/bunfig.toml (created)
- mascotinhos/packages/payments/src/test-setup.ts (created)
- mascotinhos/packages/payments/src/client.ts (created)
- mascotinhos/packages/payments/src/customer.ts (created)
- mascotinhos/packages/payments/src/create-pix.ts (created)
- mascotinhos/packages/payments/src/verify-webhook.ts (created)
- mascotinhos/packages/payments/src/split.ts (created)
- mascotinhos/packages/payments/src/index.ts (created)
- mascotinhos/packages/payments/src/client.test.ts (created)
- mascotinhos/packages/payments/src/customer.test.ts (created)
- mascotinhos/packages/payments/src/create-pix.test.ts (created)
- mascotinhos/packages/payments/src/verify-webhook.test.ts (created)
- .bmad_output/implementation-artifacts/story-1.4.md (modified)
- .bmad_output/implementation-artifacts/sprint-status.yaml (modified)

### Review Findings

- [x] [Review][Patch] `normalizePhone` false-positive on DDD 55 local numbers + missing `+55` format [`customer.ts:14`] — fixed: length-13 guard + `+` prefix strip; 2 new tests added
- [x] [Review][Patch] `verifyWebhookSignature` — no `.trim()` on token/secret, HTTP headers can carry trailing whitespace [`verify-webhook.ts:6`] — fixed
- [x] [Review][Patch] `AsaasPaymentStatus` type incomplete — missing `AWAITING_RISK_ANALYSIS`, `AWAITING_CHARGEBACK_REVERSAL` [`client.ts:11`] — fixed
- [x] [Review][Defer] Race condition in `createPixCharge` GET-then-POST idempotency check — not atomic; Story 3.1 caller must guard against concurrent invocations — deferred, architectural
- [x] [Review][Defer] `createOrUpdateCustomer` name implies update but never PATCHes — MVP only requires find/create (AC5) — deferred, MVP scope
- [x] [Review][Defer] `tomorrowISO` UTC edge at midnight BRT — always ≥24h ahead, acceptable for MVP — deferred, MVP scope
- [x] [Review][Defer] `AsaasWebhookPayload.event` missing `PAYMENT_REFUNDED` and others — Story 3.2 webhook handler can extend — deferred, Story 3.2 concern
- [x] [Review][Defer] `createPixCharge` PENDING-only idempotency — CONFIRMED charge for same orderId creates duplicate — Story 3.1 must check payment status before calling — deferred, Story 3.1 concern

## Change Log

- 2026-03-29: Implemented typed Asaas HTTP wrapper — created `packages/payments` with `asaasRequest` client, customer management, PIX charge creation (with idempotency), webhook signature verification, and split config helper. 20 tests passing. Story moved to `review`.
- 2026-03-29: Code review patches applied — `normalizePhone` DDD-55 fix + `+55` format support (2 new tests, 22 total), `verifyWebhookSignature` `.trim()` normalization, `AsaasPaymentStatus` extended with Asaas risk-analysis statuses. Story moved to `done`.
