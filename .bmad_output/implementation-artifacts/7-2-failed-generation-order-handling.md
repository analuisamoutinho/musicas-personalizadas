# Story 7.2: Failed Generation Order Handling

**Epic:** 7 — Resilience & Operator Tools
**Story ID:** 7.2
**GitHub Issue:** [mgiovani/fotos#73](https://github.com/mgiovani/fotos/issues/73)
**Status:** review
**Created:** 2026-03-30

---

## User Story

As the operator,
I want failed generation orders clearly marked in the database with enough context to diagnose the issue,
So that I can manually resolve edge cases (e.g., blurry photos, API errors).

---

## Acceptance Criteria

1. **Given** an image generation fails after all retries (QStash exhausts its 3-attempt retry policy)
   **When** the final attempt returns HTTP 500 (dead-letter scenario — QStash stops retrying)
   **Then** `Order.conversationState` is set to `FAILED` with `updatedAt` auto-updated
   **And** `Order.orderStatus` is set to `CANCELLED` (the schema has no FAILED value in OrderStatus — see Dev Notes)

2. **Given** the generation failure is being persisted
   **When** the `Generation` record for the final attempt is saved/upserted
   **Then** it stores: error code (e.g. `"GENERATION_FAILED"`), last prompt used (already in `promptUsed`), attempt number (already in `attemptNumber`)
   **And** the error detail is stored in `Generation.revisionFeedback` field (re-purposed as error context for failed generations — see Dev Notes)

3. **Given** the order is marked FAILED
   **When** the database write succeeds
   **Then** the operator is notified via `notifyOperator(orderId, "ERROR", "Generation failed after all retries")` (from Story 7.1)

4. **Given** the order is marked FAILED
   **When** the client's `whatsappSenderId` is available
   **Then** the client receives a graceful WhatsApp message: `"Desculpa, tivemos um probleminha tecnico. O Giovani vai resolver pessoalmente!"`
   **And** this message is sent via a new function `sendGenerationFailureMessage` in `packages/bot-engine/src/send-generation-failure-message.ts`
   **And** the function never throws (same never-throws contract as other send-* functions)

5. **Given** the operator accesses Supabase dashboard
   **When** they run a monitoring query
   **Then** they can find all FAILED orders with:
   ```sql
   SELECT o.id, o."updatedAt", g."revisionFeedback" AS error_context, g."attemptNumber", g."promptUsed"
   FROM "Order" o
   LEFT JOIN "Generation" g ON g."orderId" = o.id
   WHERE o."conversationState" = 'FAILED'
   ORDER BY o."updatedAt" DESC;
   ```

6. **Given** the `handleGenerate` function in `/api/generate/route.ts`
   **When** `attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS` (currently 3) AND the generation pipeline fails at any stage AFTER enrichment
   **Then** the FAILED state logic described above runs (mark DB, notify operator, message client)
   **And** for earlier attempts (attempt < QSTASH_MAX_DELIVERY_ATTEMPTS), the existing behavior (return 500 for QStash retry) is preserved unchanged

7. **Given** the `handleGenerate` function already has partial handling (upload failure marks CANCELLED)
   **When** story 7.2 is implemented
   **Then** ALL terminal failure points in `handleGenerate` are updated to use the new `markOrderFailed` helper instead of ad-hoc `prisma.order.update` calls

---

## Tasks / Subtasks

- [x] Task 1: Create `packages/bot-engine/src/send-generation-failure-message.ts` (AC: 4)
  - [x] Implement `sendGenerationFailureMessage(orderId: string, recipientPhone: string): Promise<void>`
  - [x] Send message body: `"Desculpa, tivemos um probleminha tecnico. O Giovani vai resolver pessoalmente!"`
  - [x] Use the same WhatsApp Graph API direct fetch pattern as `send-abandoned-cart-messages.ts` (WHATSAPP_API_VERSION, makeTimeoutSignal, env.WHATSAPP_PHONE_NUMBER_ID, env.WHATSAPP_ACCESS_TOKEN)
  - [x] Never throws — catch all errors and log via structured JSON: `{ level: "warn", event: "generation_failure_message_failed", orderId }`
  - [x] Export from `packages/bot-engine/src/index.ts`

- [x] Task 2: Create `markOrderFailed` helper in `apps/web/src/app/api/generate/route.ts` (AC: 1, 2, 3, 4)
  - [x] Add private async function `markOrderFailed(orderId: string, attempt: number, errorCode: string, promptUsed: string | null, clientPhone: string | null): Promise<void>`
  - [x] DB update 1: `prisma.order.update({ where: { id: orderId }, data: { conversationState: "FAILED", orderStatus: "CANCELLED" } })` — wrap in try/catch, log on failure but don't throw
  - [x] DB update 2: Upsert the `Generation` record using `prisma.generation.upsert({ where: { orderId_attemptNumber: { orderId, attemptNumber: attempt } }, update: { revisionFeedback: errorCode }, create: { orderId, attemptNumber: attempt, promptUsed: promptUsed ?? "unknown", revisionFeedback: errorCode } })` — wrap in try/catch, log on failure but don't throw
  - [x] Call `await notifyOperator(orderId, "ERROR", "Generation failed after all retries")` (already imported)
  - [x] Call `await sendGenerationFailureMessage(orderId, clientPhone)` when `clientPhone` is non-null — import from `@mascotinhos/bot-engine`
  - [x] Log structured JSON: `{ level: "error", event: "generation_failed_permanently", orderId, attempt, errorCode }`

- [x] Task 3: Wire `markOrderFailed` into `handleGenerate` failure paths (AC: 6, 7)
  - [x] Enrich failure path: when `!enrichResult.success` AND `attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS` → call `markOrderFailed` before returning 500
  - [x] Generation failure path: when `!genResult.success` AND `attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS` → call `markOrderFailed`
  - [x] Upload failure path: replace the existing ad-hoc `prisma.order.update({ data: { orderStatus: "CANCELLED" } })` + `notifyOperator` block with `markOrderFailed` call (AC: 7)
  - [x] Delivery failure path: when `!deliveryResult.success` AND `attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS` → call `markOrderFailed`
  - [x] For ALL failure paths at `attempt < QSTASH_MAX_DELIVERY_ATTEMPTS`: keep existing 500 return (no `markOrderFailed`) so QStash retries
  - [x] Pass `enrichResult.promptUsed` (or `null` if not yet enriched) and `order.client?.whatsappSenderId ?? null` to `markOrderFailed`

- [x] Task 4: Write unit tests for `send-generation-failure-message.ts` (AC: 4)
  - [x] Test: sends correct message body `"Desculpa, tivemos um probleminha tecnico. O Giovani vai resolver pessoalmente!"`
  - [x] Test: calls WhatsApp API with correct `to` field (recipientPhone)
  - [x] Test: never throws when fetch fails (API returns error status)
  - [x] Test: never throws when fetch rejects (network error)
  - [x] Use `mock.module("@mascotinhos/env/server", ...)` and `mock.module("node-fetch", ...)` pattern from `send-abandoned-cart-messages.test.ts`

- [x] Task 5: Write unit tests for `markOrderFailed` logic in `route.ts` (AC: 1, 2, 3, 6)
  - [x] Test: sets `conversationState = "FAILED"` and `orderStatus = "CANCELLED"` in DB
  - [x] Test: upserts Generation record with `revisionFeedback = errorCode`
  - [x] Test: calls `notifyOperator` with correct args
  - [x] Test: calls `sendGenerationFailureMessage` when clientPhone is provided
  - [x] Test: does NOT call `markOrderFailed` on attempt < QSTASH_MAX_DELIVERY_ATTEMPTS (returns 500 for retry)
  - [x] Test: DOES call `markOrderFailed` on attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS
  - [x] Follow existing test pattern in `apps/web/src/app/api/generate/route.test.ts`

- [x] Task 6: Run full test suite and verify no regressions (AC: all)
  - [x] `cd mascotinhos/packages/bot-engine && bun test` — 227 pass, 0 fail (includes 5 new send-generation-failure-message tests)
  - [x] `cd mascotinhos/apps/web && bun test` — 54 pass, 0 fail (includes 7 new Story 7.2 tests)
  - [x] `cd mascotinhos && bunx tsc --noEmit` — 0 new errors in web or bot-engine (pre-existing bun:test type errors in payments package unchanged)

---

## Dev Notes

### CRITICAL: OrderStatus.FAILED Does NOT Exist in Prisma Schema

The architecture doc says "mark order as FAILED" but the `OrderStatus` enum in `schema.prisma` only has: `PENDING | PAID | GENERATING | DELIVERED | CANCELLED`.

**Decision (already established in Story 7.1 route.ts NOTE comment at line ~319):**
- Set `Order.orderStatus = "CANCELLED"` (terminal failure state)
- Set `Order.conversationState = "FAILED"` (this enum DOES have FAILED — see `ConversationState` in schema)
- The comment in `generate/route.ts` documents this: `// NOTE: OrderStatus enum has no FAILED value (schema: PENDING|PAID|GENERATING|DELIVERED|CANCELLED). Architecture says "mark as FAILED" but CANCELLED is the correct terminal failure state to use.`

DO NOT add a new `FAILED` value to the `OrderStatus` enum (requires `ALTER TYPE ... ADD VALUE` which cannot run in a transaction — see schema.prisma NOTE at line 12).

### CRITICAL: Generation.revisionFeedback Re-Purposed for Error Context

The `Generation` model has no dedicated `errorCode` field. Use `revisionFeedback` to store error context for failed generations (e.g., `"GENERATION_FAILED"`, `"UPLOAD_FAILED"`, `"DELIVERY_FAILED"`). This is safe because:
- `revisionFeedback` is only populated in revision flows (attempt > 1 with user feedback)
- When a terminal failure occurs, the generation is not a revision — it's a failure record
- The operator query in AC-5 relies on this convention

DO NOT add a new schema field — no migration needed.

### QStash Dead-Letter Pattern in This Codebase

QStash does NOT have a built-in dead-letter callback URL configured in this project. The "dead-letter" behavior is simulated by:
1. QStash retries the consumer up to `QSTASH_MAX_DELIVERY_ATTEMPTS = 3` times (configured in route.ts)
2. The `attempt` field in the QStash payload increments on each retry
3. When `attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS`, this IS the final attempt
4. The consumer detects this and runs `markOrderFailed` instead of just returning 500

This is already the pattern for delivery failures (see route.ts line ~381: `if (attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS)`). Story 7.2 extends this to ALL failure paths in `handleGenerate`.

### Existing Upload Failure Code to Replace (Task 3)

Current code in `handleGenerate` (around line 308-329):
```typescript
} catch (uploadErr) {
  // ...logging...
  try {
    // NOTE: OrderStatus enum has no FAILED value...
    await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: "CANCELLED" },
    });
  } catch (dbErr) {
    console.log(JSON.stringify({ level: "warn", event: "generate_consumer_order_status_update_failed", ... }));
  }
  await notifyOperator(orderId, "ERROR", "Upload failed after retries");
  return NextResponse.json({ error: "Storage upload failed after retries" }, { status: 500 });
}
```

Replace with a `markOrderFailed` call. This upload failure always happens after all upload retries are exhausted — it is always a terminal failure regardless of `attempt` value (upload retries are internal to `uploadGeneratedWithRetry`, not QStash-level retries). Apply `markOrderFailed` unconditionally here.

### WhatsApp Message Function Pattern (copy from `send-abandoned-cart-messages.ts`)

All `send-*.ts` files follow this exact pattern:
```typescript
import { env } from "@mascotinhos/env/server";

const WHATSAPP_API_VERSION = "v21.0";
// NOTE: Do NOT define WHATSAPP_MESSAGES_URL at module level — build it inside each function
// so Bun test mocks on env can apply.

const WA_FETCH_TIMEOUT_MS = 10_000;

function makeTimeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(WA_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

export async function sendGenerationFailureMessage(
  orderId: string,
  recipientPhone: string,
): Promise<void> {
  try {
    const messagesUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const messageBody = "Desculpa, tivemos um probleminha tecnico. O Giovani vai resolver pessoalmente!";
    const response = await fetch(messagesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      signal: makeTimeoutSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: messageBody },
      }),
    });
    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }
    console.log(JSON.stringify({ level: "info", event: "generation_failure_message_sent", orderId, service: "bot-engine" }));
  } catch (err) {
    console.log(JSON.stringify({
      level: "warn",
      event: "generation_failure_message_failed",
      orderId,
      error: err instanceof Error ? err.message : String(err),
      service: "bot-engine",
    }));
    // Never rethrow — client notification failure must not mask the original error
  }
}
```

### markOrderFailed Design

`markOrderFailed` is a private async helper inside `route.ts` (NOT exported, NOT in bot-engine). It:
1. Updates Order (conversationState + orderStatus) — DB error: log warn, continue
2. Upserts Generation record with error code in `revisionFeedback` — DB error: log warn, continue
3. Calls `notifyOperator` (never throws)
4. Calls `sendGenerationFailureMessage` if phone available (never throws)

All steps are best-effort — `markOrderFailed` itself never throws. Even if the DB write fails, operator notification still fires.

### Generation Upsert — Unique Constraint

`Generation` has `@@unique([orderId, attemptNumber])`. Use Prisma `upsert` with `where: { orderId_attemptNumber: { orderId, attemptNumber: attempt } }` to handle cases where the Generation row already exists (e.g., enrichment succeeded, generation failed).

### Idempotency

If the same `attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS` is retried (e.g., QStash retries despite 500), calling `markOrderFailed` again is safe:
- `prisma.order.update` with same FAILED/CANCELLED data = no-op effect
- `prisma.generation.upsert` = idempotent by design

### File Naming Conventions

- `packages/bot-engine/src/send-generation-failure-message.ts` (kebab-case, matches existing)
- `packages/bot-engine/src/send-generation-failure-message.test.ts` (co-located)
- Do NOT create a separate file for `markOrderFailed` — it's a private helper in `route.ts`

### Existing Test File for route.ts

Check `apps/web/src/app/api/generate/route.test.ts` for the existing mock setup. Follow the exact same patterns for mocking `prisma`, `notifyOperator`, and the image-gen functions.

### Testing Commands

```bash
cd mascotinhos

# Type check
bun run check-types

# Bot-engine tests
bun test packages/bot-engine

# Web app tests
bun test apps/web

# All tests
bun test
```

### Environment Variables (no changes needed)

All required env vars are already defined:
- `WHATSAPP_PHONE_NUMBER_ID` — already in `packages/env/src/server-schema.ts`
- `WHATSAPP_ACCESS_TOKEN` — already in `packages/env/src/server-schema.ts`
- `OPERATOR_WHATSAPP_NUMBER` — already in `packages/env/src/server-schema.ts`

### Structured Log Events for This Story

New structured log events to introduce:
- `generation_failed_permanently` — level: error — in `markOrderFailed`
- `generation_failure_message_sent` — level: info — in `sendGenerationFailureMessage`
- `generation_failure_message_failed` — level: warn — in `sendGenerationFailureMessage`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `packages/bot-engine/src/send-generation-failure-message.ts` with `sendGenerationFailureMessage(orderId, recipientPhone)` — sends `"Desculpa, tivemos um probleminha tecnico. O Giovani vai resolver pessoalmente!"` via direct WhatsApp Graph API fetch. Never throws. Exported from `packages/bot-engine/src/index.ts`.
- Created private `markOrderFailed(orderId, attempt, errorCode, promptUsed, clientPhone)` helper in `apps/web/src/app/api/generate/route.ts` — sets `conversationState=FAILED` + `orderStatus=CANCELLED`, upserts Generation with error code in `revisionFeedback`, calls `notifyOperator`, sends client failure message. All steps best-effort, never throws.
- Wired `markOrderFailed` into all four terminal failure paths in `handleGenerate`: enrich failure, generation failure, upload failure (unconditional — internal retries already exhausted), delivery failure. All paths respect `attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS` guard except upload (which is always terminal).
- Updated existing upload failure test to check new `{ conversationState: "FAILED", orderStatus: "CANCELLED" }` data shape. Added 7 new Story 7.2 tests covering: attempt-gating (no markOrderFailed on attempt=1), GENERATION_FAILED on attempt=3, ENRICH_FAILED on attempt=3, DELIVERY_FAILED on attempt=3, no client message when phone is null, DB failure resilience.
- 5 new bot-engine tests + 7 new route tests. 227 bot-engine pass, 54 route pass. Zero new type errors.

### File List

- `mascotinhos/packages/bot-engine/src/send-generation-failure-message.ts` (new)
- `mascotinhos/packages/bot-engine/src/send-generation-failure-message.test.ts` (new)
- `mascotinhos/packages/bot-engine/src/index.ts` (modified — added `sendGenerationFailureMessage` export)
- `mascotinhos/apps/web/src/app/api/generate/route.ts` (modified — added `markOrderFailed` helper, wired into all failure paths, imported `sendGenerationFailureMessage`)
- `mascotinhos/apps/web/src/app/api/generate/route.test.ts` (modified — added upsert mock, notifyOperator/sendGenerationFailureMessage mocks, 7 new tests, updated 2 existing tests)
- `.bmad_output/implementation-artifacts/7-2-failed-generation-order-handling.md` (this file)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` (modified — story status)

### Change Log

- 2026-03-30: Implemented Story 7.2 — failed generation order handling. Created `sendGenerationFailureMessage` in bot-engine. Added `markOrderFailed` private helper in generate route, wired into all terminal failure paths. 12 new tests added across bot-engine and web packages.
