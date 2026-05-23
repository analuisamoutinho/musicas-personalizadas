# Story 3.3: Payment Confirmation Message to Client

Status: done
GitHub Issue: [mgiovani/fotos#55](https://github.com/mgiovani/fotos/issues/55)

## Story

As a client who just paid,
I want to receive immediate confirmation that my payment was received,
So that I know the process is moving forward and feel reassured.

## Acceptance Criteria

1. **Given** the payment webhook processes a `PAYMENT_CONFIRMED` or `PAYMENT_RECEIVED` event and the `$transaction` succeeds
   **When** the Order status transitions to `GENERATING`
   **Then** a WhatsApp message is sent to the client's phone (`client.whatsappSenderId`): `"Pagamento confirmado! Vou comecar a preparar sua arte agora 🎨"`
   **And** the message is preceded by a typing indicator (WhatsApp "typing" action) before the confirmation message

2. **Given** the confirmation message was sent
   **When** a brief artificial delay has elapsed
   **Then** a warm follow-up message is sent: `"Estou preparando a arte da [client.name] com carinho... Voce sera avisada assim que ficar pronta! 💕"`
   **And** if `client.name` is null or empty, the follow-up uses a generic form: `"Estou preparando a arte com carinho... Voce sera avisada assim que ficar pronta! 💕"`

3. **Given** the WhatsApp API call to send either message fails
   **When** any network or API error occurs
   **Then** the error is logged at `warn` level with `event: "payment_confirmation_whatsapp_failed"` and `orderId`
   **And** the webhook still returns `{ received: true }` HTTP 200 — WhatsApp delivery failure MUST NOT fail the payment webhook

4. **Given** the `findFirst` query with `include: { order: { include: { client: true } } }` returns a payment where `order` or `client` is null/missing
   **When** `payment.order?.client?.whatsappSenderId` is null or empty after the `$transaction` succeeds
   **Then** the error is logged at `warn` level with `event: "payment_confirmation_missing_phone"`, `orderId`
   **And** the webhook still returns `{ received: true }` HTTP 200 — missing client phone MUST NOT fail the webhook

5. **Given** the `PAYMENT_CONFIRMED` path (idempotent skip — payment already `CONFIRMED`)
   **When** the webhook is a duplicate delivery and processing is skipped
   **Then** NO confirmation message is sent (idempotent — message was already sent on first delivery)

**FRs covered:** FR-18 (payment confirmation message)

## Tasks / Subtasks

- [x] Task 1: Add a `sendPaymentConfirmationMessages` utility function to `packages/bot-engine/src/` (AC: #1, #2, #3, #4)
  - [x] 1.1: Create a NEW file `packages/bot-engine/src/send-payment-confirmation.ts`
    - This is a standalone async function, NOT an AI tool — it uses direct WhatsApp Cloud API
    - Do NOT add it to `packages/bot-engine/src/tools/` (that directory is for AI SDK tools only)
    - Export it from the package's `src/index.ts` so `apps/web` can import it
  - [x] 1.2: Implement the function signature:
    ```typescript
    import { env } from "@mascotinhos/env/server";

    const WHATSAPP_API_VERSION = "v21.0";
    const WHATSAPP_MESSAGES_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    /**
     * Send payment confirmation messages to client via WhatsApp Cloud API.
     * Called from payment webhook handler after payment is confirmed.
     * Never throws — all errors are caught and logged.
     */
    export async function sendPaymentConfirmationMessages(
      orderId: string,
      recipientPhone: string,  // client.whatsappSenderId
      clientName: string | null | undefined,
    ): Promise<void>
    ```
  - [x] 1.3: Implement typing indicator — send `action: "typing"` status before the first message:
    ```typescript
    // Step 1: Send typing indicator
    await fetch(WHATSAPP_MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "action",
        action: { type: "typing", duration: 1500 },
      }),
    });
    ```
    Note: Typing indicator failure is non-fatal — catch silently and proceed to message send.
  - [x] 1.4: Send the confirmation message:
    ```typescript
    // Step 2: Send confirmation message
    const confirmResponse = await fetch(WHATSAPP_MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: "Pagamento confirmado! Vou comecar a preparar sua arte agora 🎨" },
      }),
    });

    if (!confirmResponse.ok) {
      throw new Error(`WhatsApp API error: ${confirmResponse.status}`);
    }
    ```
  - [x] 1.5: Send the follow-up message with personalization:
    ```typescript
    // Step 3: Send warm follow-up
    const name = clientName?.trim() || null;
    const followUpBody = name
      ? `Estou preparando a arte da ${name} com carinho... Voce sera avisada assim que ficar pronta! 💕`
      : "Estou preparando a arte com carinho... Voce sera avisada assim que ficar pronta! 💕";

    const followUpResponse = await fetch(WHATSAPP_MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: followUpBody },
      }),
    });

    if (!followUpResponse.ok) {
      throw new Error(`WhatsApp follow-up API error: ${followUpResponse.status}`);
    }
    ```
  - [x] 1.6: Wrap the entire function body in try/catch so it NEVER throws:
    ```typescript
    export async function sendPaymentConfirmationMessages(
      orderId: string,
      recipientPhone: string,
      clientName: string | null | undefined,
    ): Promise<void> {
      try {
        // typing + confirmation + follow-up (steps 1.3, 1.4, 1.5)
      } catch (err) {
        console.log(JSON.stringify({
          level: "warn",
          event: "payment_confirmation_whatsapp_failed",
          orderId,
          error: err instanceof Error ? err.message : String(err),
          service: "bot-engine",
        }));
        // Do NOT rethrow — caller must still return { received: true } HTTP 200
      }
    }
    ```

- [x] Task 2: Export `sendPaymentConfirmationMessages` from `packages/bot-engine/src/index.ts` (AC: #1, #2)
  - [x] 2.1: Add to `packages/bot-engine/src/index.ts`:
    ```typescript
    export { sendPaymentConfirmationMessages } from "./send-payment-confirmation";
    ```
    Current exports in `index.ts`: `bot`, `ConversationState`, `ALLOWED_TRANSITIONS`, `isValidTransition`, `loadActiveOrder`, `findOrCreateClient`, `createOrder`, `updateOrderState`, `processMessage`, `getHistory`, `appendMessage`, `clearHistory`, `allTools`, `enqueueGeneration`. Add to this list — do NOT replace existing exports.

- [x] Task 3: Integrate into payment webhook handler (AC: #1, #2, #3, #4, #5)
  - [x] 3.1: In `apps/web/src/app/api/payments/webhook/route.ts`, update the import to include `sendPaymentConfirmationMessages`:
    ```typescript
    import { enqueueGeneration, sendPaymentConfirmationMessages } from "@mascotinhos/bot-engine";
    ```
  - [x] 3.2: Update the Payment lookup to include client data. Currently the webhook looks up Payment by `asaasId` and then uses `payment.orderId`. Change the Prisma query to also fetch the order with client. Also update the manual TypeScript type annotation for `payment` to include the nested shape:
    ```typescript
    // BEFORE (current code):
    let payment: {
      id: string;
      orderId: string;
      asaasId: string;
      status: string;
    } | null;
    // ...
    payment = await prisma.payment.findFirst({ where: { asaasId } });

    // AFTER — update both the type annotation and the query:
    let payment: {
      id: string;
      orderId: string;
      asaasId: string;
      status: string;
      order: {
        id: string;
        client: {
          id: string;
          whatsappSenderId: string;
          name: string | null;
        } | null;
      } | null;
    } | null;
    // ...
    payment = await prisma.payment.findFirst({
      where: { asaasId },
      include: { order: { include: { client: true } } },
    });
    ```
    The `Payment` model has `order Order` relation. `Order` has `client Client` relation. Both exist in the Prisma schema. **IMPORTANT:** The manual type annotation in `route.ts` must be updated alongside the query — TypeScript will error if the annotation does not match the Prisma return shape with `include`.
  - [x] 3.3: After the `$transaction` succeeds (and BEFORE calling `enqueueGeneration`), call the confirmation message function:
    ```typescript
    // After successful $transaction — send confirmation to client
    const recipientPhone = payment.order?.client?.whatsappSenderId ?? "";
    const clientName = payment.order?.client?.name ?? null;

    if (recipientPhone) {
      // Non-blocking — sendPaymentConfirmationMessages never throws
      await sendPaymentConfirmationMessages(orderId, recipientPhone, clientName);
    } else {
      console.log(JSON.stringify({
        level: "warn",
        event: "payment_confirmation_missing_phone",
        orderId,
        service: "web",
      }));
    }
    ```
    Place this AFTER the transaction and BEFORE the `enqueueGeneration` call. Message delivery failure must not block enqueue.
  - [x] 3.4: The idempotent path (payment already `CONFIRMED`) must NOT call `sendPaymentConfirmationMessages`. The existing early-return for idempotency already handles this — no change needed. Just ensure the new call in 3.3 is only in the new-confirmation path.

- [x] Task 4: Write tests (AC: #1–#5)
  - [x] 4.1: Create `packages/bot-engine/src/send-payment-confirmation.test.ts`
    - Run with: `cd mascotinhos && bun test packages/bot-engine/src/send-payment-confirmation.test.ts`
  - [x] 4.2: Test file structure — env vars and mocks BEFORE imports (bun:test critical requirement):
    ```typescript
    import { describe, it, expect, mock, beforeEach } from "bun:test";

    // Set env vars before all imports
    process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
    process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";
    process.env["SUPABASE_URL"] = "http://localhost:54321";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key";
    process.env["OPENAI_API_KEY"] = "sk-test-key-for-unit-tests";
    process.env["ASAAS_API_KEY"] = "test-asaas-key";
    process.env["ASAAS_WEBHOOK_SECRET"] = "test-asaas-secret";
    process.env["WHATSAPP_WEBHOOK_TOKEN"] = "test-whatsapp-token";
    process.env["WHATSAPP_APP_SECRET"] = "test-whatsapp-app-secret";
    process.env["WHATSAPP_PHONE_NUMBER_ID"] = "123456789";
    process.env["WHATSAPP_ACCESS_TOKEN"] = "test-whatsapp-access";
    process.env["QSTASH_TOKEN"] = "test-qstash-token";
    process.env["QSTASH_CURRENT_SIGNING_KEY"] = "sig_test_current";
    process.env["QSTASH_NEXT_SIGNING_KEY"] = "sig_test_next";
    process.env["VERCEL_URL"] = "https://test.vercel.app";
    process.env["OPERATOR_WHATSAPP_NUMBER"] = "5511999999999";
    // NODE_ENV is read-only in TypeScript types but settable at runtime
    (process.env as Record<string, string>)["NODE_ENV"] = "test";

    const mockFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }))
    );
    global.fetch = mockFetch;

    import { sendPaymentConfirmationMessages } from "./send-payment-confirmation";
    ```
    Critical: `mock.module()` calls and global assignments BEFORE the static import line. See `packages/bot-engine/src/tools/collect-photos.test.ts` for the exact pattern.
  - [x] 4.3: `beforeEach` — reset fetch mock to default success:
    ```typescript
    beforeEach(() => {
      mockFetch.mockClear();
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }))
      );
    });
    ```
  - [x] 4.4: Tests to implement:
    - **AC #1 — happy path with client name**: `await sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana")` → `mockFetch` called 3 times (typing, confirmation, follow-up), confirmation body contains "Pagamento confirmado", follow-up body contains "Ana"
    - **AC #2 — null client name**: `await sendPaymentConfirmationMessages("order-123", "5511999999999", null)` → `mockFetch` called 3 times, follow-up body contains "Estou preparando a arte com carinho" (no name substitution)
    - **AC #3 — API error returns non-200**: `mockFetch.mockImplementation(() => Promise.resolve(new Response("error", { status: 500 })))` → function resolves (does NOT throw), `mockFetch` called at least once (typing succeeds, confirmation fails and is caught)
    - **AC #3 — network error (fetch throws)**: `mockFetch.mockImplementation(() => Promise.reject(new Error("network error")))` → function resolves (does NOT throw)
    - **AC #3 — follow-up message failure is also caught**: mock first two calls to succeed and third to fail → function resolves (does NOT throw)
    - **Correct recipients**: verify `mockFetch` is called with `to: "5511999999999"` in the body payload
    - **Correct API URL**: verify fetch is called with URL containing `123456789/messages` (the phone number ID)

- [x] Task 5: Update payment webhook handler tests (AC: #3, #5)
  - [x] 5.1: Update `apps/web/src/app/api/payments/webhook/route.test.ts` to mock `sendPaymentConfirmationMessages` from `@mascotinhos/bot-engine`:
    ```typescript
    const mockSendPaymentConfirmationMessages = mock(() => Promise.resolve());
    mock.module("@mascotinhos/bot-engine", () => ({
      enqueueGeneration: { execute: mockEnqueueExecute },
      sendPaymentConfirmationMessages: mockSendPaymentConfirmationMessages,
    }));
    ```
    Add `mockSendPaymentConfirmationMessages.mockClear()` to `beforeEach`.
  - [x] 5.2: Update the `findFirst` mock to return the new shape with `order.client`:
    ```typescript
    const mockPaymentFindFirst = mock(() =>
      Promise.resolve({
        id: "payment-db-id",
        orderId: TEST_ORDER_ID,
        asaasId: TEST_ASAAS_ID,
        status: "PENDING",
        order: {
          id: TEST_ORDER_ID,
          client: {
            id: "client-db-id",
            whatsappSenderId: "5511888888888",
            name: "Ana",
          },
        },
      })
    );
    ```
  - [x] 5.3: Add assertion to the existing happy path test: `mockSendPaymentConfirmationMessages` called once after `mockTransaction` succeeds.
  - [x] 5.4: Add assertion for idempotent skip test: `mockSendPaymentConfirmationMessages` is NOT called when payment is already `CONFIRMED`.
  - [x] 5.5: Add a test: `sendPaymentConfirmationMessages` throws internally → `mockSendPaymentConfirmationMessages.mockRejectedValue(new Error("wa error"))` → webhook still returns `{ received: true }` HTTP 200 (this should already pass since the function never throws, but test for safety).

- [x] Task 6: Type-check and test pipeline
  - [x] 6.1: Run `bun run check-types` from `mascotinhos/` — must pass with 0 new errors
  - [x] 6.2: Run `bun test packages/bot-engine/src/send-payment-confirmation.test.ts` from `mascotinhos/` — all tests must pass
  - [x] 6.3: Run `bun test apps/web/src/app/api/payments/webhook/route.test.ts` from `mascotinhos/` — all tests must pass (including new assertions and no regressions)

## Dev Notes

### Scope Boundaries — What NOT to Modify

This story touches only these files:
- **CREATE**: `packages/bot-engine/src/send-payment-confirmation.ts`
- **CREATE**: `packages/bot-engine/src/send-payment-confirmation.test.ts`
- **MODIFY**: `packages/bot-engine/src/index.ts` — add one export line only
- **MODIFY**: `apps/web/src/app/api/payments/webhook/route.ts` — update `payment` type annotation + `findFirst` query + add call after `$transaction`
- **MODIFY**: `apps/web/src/app/api/payments/webhook/route.test.ts` — update mock shape + add new assertions

Do NOT modify:
- Any file under `packages/bot-engine/src/tools/` (AI SDK tools only)
- The `PAYMENT_OVERDUE` / `PAYMENT_DELETED` path in `route.ts`
- The error-return paths (signature failure, DB errors before `$transaction`) in `route.ts`
- The `enqueueGeneration` mock shape in `route.test.ts` (extend it, don't replace it)

### CRITICAL: No Existing Direct WhatsApp Utility — Create From Scratch

There is NO existing utility for sending WhatsApp messages outside of the Chat SDK `thread.post()` context. The Chat SDK is only available during the `onNewMention` handler (Story 2.1). Since payment webhooks are server-side events (no active thread), direct WhatsApp Cloud API calls via `fetch` are required.

The only existing direct-fetch pattern is in `packages/bot-engine/src/bot.ts` (media URL resolution), which establishes `WHATSAPP_API_VERSION = "v21.0"` and the `graph.facebook.com` base URL. Use the same version.

### CRITICAL: WhatsApp Cloud API — Sending Messages Endpoint

Direct WhatsApp message sends use:
```
POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
Content-Type: application/json
```

Body for a text message:
```json
{
  "messaging_product": "whatsapp",
  "to": "{recipientPhone}",
  "type": "text",
  "text": { "body": "message text" }
}
```

Body for a typing indicator:
```json
{
  "messaging_product": "whatsapp",
  "to": "{recipientPhone}",
  "type": "action",
  "action": { "type": "typing", "duration": 1500 }
}
```

Both `env.WHATSAPP_PHONE_NUMBER_ID` and `env.WHATSAPP_ACCESS_TOKEN` are available in `@mascotinhos/env/server`. NEVER read `process.env` directly — always use the typed `env` object.

### CRITICAL: File Location — Not an AI Tool

`sendPaymentConfirmationMessages` is NOT an AI SDK tool and does NOT use the `tool()` function from `"ai"`. It belongs in `packages/bot-engine/src/send-payment-confirmation.ts` (top-level src, not `src/tools/`). The `src/tools/` directory is exclusively for AI SDK tool definitions.

### CRITICAL: Payment Webhook — Include Order + Client in Prisma Query

The existing `prisma.payment.findFirst({ where: { asaasId: payload.payment.id } })` in `route.ts` does NOT include `order` or `client`. Story 3.3 requires updating this query to:

```typescript
await prisma.payment.findFirst({
  where: { asaasId: payload.payment.id },
  include: {
    order: { include: { client: true } },
  },
})
```

The `Payment` model has `order Order @relation(...)`. The `Order` model has `client Client @relation(...)`. Both exist in the generated Prisma client. Type-check will catch any mismatch.

**CRITICAL: Also update the manual `payment` type annotation** in `route.ts` (the `let payment: { ... } | null` block above the `prisma.payment.findFirst` call). It currently declares `{ id, orderId, asaasId, status }`. It must be extended to include `order: { id, client: { id, whatsappSenderId, name } | null } | null`. Failure to update the annotation will cause a TypeScript compile error. See Task 3.2 for the exact new shape.

### CRITICAL: Ordering — Confirmation BEFORE Enqueue

The call sequence in the PAYMENT_CONFIRMED path must be:
1. `$transaction` (update Payment + Order status)
2. `sendPaymentConfirmationMessages(...)` — tell the client their payment was received
3. `enqueueGeneration.execute(...)` — queue the generation job

This ordering ensures the client sees "Pagamento confirmado!" before the generation starts, which is the correct UX.

### CRITICAL: Never-Throw Contract

`sendPaymentConfirmationMessages` MUST never throw. The payment webhook must always return `{ received: true }` HTTP 200 — a WhatsApp delivery failure is non-critical (client can check order status; generation still proceeds). Wrap the entire function body in try/catch.

### CRITICAL: Test Mock Shape for `payment.findFirst`

The existing test mocks in `route.test.ts` return:
```typescript
{ id: "payment-db-id", orderId: TEST_ORDER_ID, asaasId: TEST_ASAAS_ID, status: "PENDING" }
```

This must be updated to include the nested `order.client` structure now that the Prisma query includes it. All existing tests continue to pass if the mock is updated correctly.

### Architecture Compliance

- **DB access**: All Prisma queries go through `@mascotinhos/db` — do NOT import Prisma directly
- **Env access**: Use `env` from `@mascotinhos/env/server` — do NOT read `process.env` directly
- **Logging**: Structured JSON via `console.log(JSON.stringify({ level, event, orderId, ...data }))`; PII redaction: if logging phone, mask to last 4 digits only
- **Error handling**: warn level for non-critical failures (WhatsApp delivery, DB fetch for client data); the webhook must still return 200
- **File naming**: kebab-case (`send-payment-confirmation.ts`) — matches existing convention

### DB Schema Reference

**Payment** model fields relevant to this story:
- `id`: String (internal DB id)
- `orderId`: String (FK to Order)
- `asaasId`: String @unique
- `status`: PaymentStatus enum (`PENDING | CONFIRMED | FAILED | REFUNDED`)
- `order`: Order relation (add `include: { order: { include: { client: true } } }`)

**Order** model relevant fields:
- `conversationState`: ConversationState enum (set to `GENERATING` by Story 3.2's transaction)
- `orderStatus`: OrderStatus enum (set to `GENERATING` by Story 3.2's transaction)
- `client`: Client relation

**Client** model relevant fields:
- `whatsappSenderId`: String @unique — this is the recipient phone for WhatsApp API
- `name`: String? — optional client name, used in follow-up message personalization

### Previous Story Learnings (from Story 3.2)

- **Mock module shape matters**: When mocking `@mascotinhos/bot-engine`, include ALL exported symbols the module under test imports. Missing a symbol causes a runtime error. The existing mock in `route.test.ts` has `enqueueGeneration: { execute: mockEnqueueExecute }` — add `sendPaymentConfirmationMessages: mockSendPaymentConfirmationMessages` to the same mock object.
- **bun:test mock pattern**: All `mock.module()` calls must appear in the file BEFORE the static `import` statements. Env var assignments also before imports. See `packages/bot-engine/src/tools/collect-photos.test.ts` for the canonical pattern.
- **`global.fetch` mocking in bun:test**: For testing code that calls `fetch`, assign `global.fetch = mockFetch` before the import. Bun does not auto-mock `fetch`; explicit assignment is required.
- **Test invocation**: Always run tests from `mascotinhos/` directory: `cd mascotinhos && bun test <path>`. The `bunfig.toml` preload in `apps/web/` only fires when Bun is invoked from that directory (deferred work #1 in deferred-work.md).
- **`asaas-access-token` header**: Lowercase, hyphenated. Tests use `"asaas-access-token": "test-asaas-secret"` in request headers. No change needed here; this story only adds to the success path after verification.
- **Response format**: Payment webhook always returns `{ received: true }` HTTP 200 on all success paths. This story does not change that contract.

### Project Structure Reference

```
mascotinhos/
├── apps/
│   └── web/
│       └── src/app/api/payments/webhook/
│           ├── route.ts          ← MODIFY (Task 3)
│           └── route.test.ts     ← MODIFY (Task 5)
└── packages/
    └── bot-engine/
        └── src/
            ├── index.ts          ← MODIFY to export new function (Task 2)
            ├── send-payment-confirmation.ts    ← CREATE (Task 1)
            └── send-payment-confirmation.test.ts  ← CREATE (Task 4)
```

### References

- Story 3.2 (previous): `/home/mgiovani/projects/fotos/.bmad_output/implementation-artifacts/story-3.2.md` — established webhook handler structure, mock patterns, test file setup
- Epics: `/home/mgiovani/projects/fotos/.bmad_output/planning-artifacts/epics.md` — Epic 3, Story 3.3, FR-18
- Architecture: `/home/mgiovani/projects/fotos/.bmad_output/planning-artifacts/architecture.md` — API patterns, WhatsApp API version, logging format, env access rules
- Bot.ts: `mascotinhos/packages/bot-engine/src/bot.ts` — shows `WHATSAPP_API_VERSION = "v21.0"` and direct Graph API fetch pattern
- Webhook route: `mascotinhos/apps/web/src/app/api/payments/webhook/route.ts` — shows full handler structure to integrate into

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation completed without debugging issues.

### Completion Notes List

- Created `packages/bot-engine/src/send-payment-confirmation.ts`: standalone async function `sendPaymentConfirmationMessages` that sends typing indicator + confirmation message + personalized follow-up via WhatsApp Cloud API (direct `fetch`, not AI SDK). Wrapped in try/catch — never throws.
- Exported `sendPaymentConfirmationMessages` from `packages/bot-engine/src/index.ts`.
- Updated `apps/web/src/app/api/payments/webhook/route.ts`: updated `payment` type annotation and `prisma.payment.findFirst` query to include `order.client` via `include`. Added call to `sendPaymentConfirmationMessages` after `$transaction` and before `enqueueGeneration`, with `payment_confirmation_missing_phone` warn log when phone is absent. Added outer try/catch around the call for defense-in-depth.
- Created 8 unit tests in `packages/bot-engine/src/send-payment-confirmation.test.ts` covering all ACs: happy path with/without name, API error, network error, follow-up failure, correct recipient, correct API URL. Used `mock.module("@mascotinhos/env/server")` pattern (not process.env assignment) since the package bunfig preload only fires when run from the package directory.
- Updated `apps/web/src/app/api/payments/webhook/route.test.ts`: added `mockSendPaymentConfirmationMessages` mock, updated `findFirst` mock shape to include `order.client`, added assertions to happy path tests (called once), idempotency tests (not called), plus 2 new tests for throws-internally and missing-phone scenarios.
- All 8 new bot-engine tests pass; all 18 webhook route tests pass; 0 new TypeScript errors introduced.

### File List

- `mascotinhos/packages/bot-engine/src/send-payment-confirmation.ts` (CREATED)
- `mascotinhos/packages/bot-engine/src/send-payment-confirmation.test.ts` (CREATED)
- `mascotinhos/packages/bot-engine/src/index.ts` (MODIFIED)
- `mascotinhos/apps/web/src/app/api/payments/webhook/route.ts` (MODIFIED)
- `mascotinhos/apps/web/src/app/api/payments/webhook/route.test.ts` (MODIFIED)

## Review Findings

Code review performed: 2026-03-30. Model: claude-sonnet-4-6. Adversarial + edge case + acceptance audit.

### Finding 1 — HIGH: Dead idempotency guard `payment.status === "RECEIVED"` (`route.ts:118`)
- `PaymentStatus` enum has no `RECEIVED` value (`PENDING | CONFIRMED | FAILED | REFUNDED`). The check was permanently false, meaning `FAILED`/`REFUNDED` payments receiving a `PAYMENT_CONFIRMED` retry would have been re-processed.
- **Patched**: Changed guard to `payment.status !== "PENDING"` — now correctly skips all non-PENDING terminal states. Idempotency test updated to cover `REFUNDED`.

### Finding 2 — HIGH: No `fetch` timeout on WhatsApp API calls (`send-payment-confirmation.ts`)
- All three `fetch` calls had no `AbortSignal`/timeout. An unresponsive WhatsApp API would block the webhook handler indefinitely, causing Asaas to retry.
- **Patched**: Added `makeTimeoutSignal()` helper using `AbortSignal.timeout(10_000)` with graceful fallback for older runtimes. Applied to all three fetch calls.

### Finding 3 — MEDIUM: `clientName` inserted into message body without sanitization (`send-payment-confirmation.ts`)
- User-supplied `clientName` (from WhatsApp conversation) could contain `\n`, `\r`, or control characters, splitting the WhatsApp message body into unexpected segments.
- **Patched**: Added `sanitizeName()` that replaces `\r\n\t\x00-\x1F\x7F` with spaces. Applied before interpolation. Two new sanitization tests added.

### Finding 4 — MEDIUM: `payment.status` typed as `string` instead of enum literal union (`route.ts:70`)
- Manual type annotation `status: string` lost narrowing, preventing TypeScript from catching invalid enum values (e.g. `"RECEIVED"` in the idempotency check and in `generate-payment.ts:70`).
- **Patched**: Updated to `status: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED"`. Also fixed `generate-payment.ts:70` which used `"RECEIVED"` in a Prisma filter (was a pre-existing compile error that this change surfaced and fixed).

### Finding 5 — MEDIUM: Duplicate `payment_confirmation_whatsapp_failed` event name across two services (`route.ts` + `send-payment-confirmation.ts`)
- Both the inner function and the outer catch in `route.ts` used the same event name, producing confusing duplicate log lines per failure.
- **Patched**: Renamed the outer catch event to `payment_confirmation_wa_outer_catch` (distinct from the inner `payment_confirmation_whatsapp_failed`).

### Finding 6 — MEDIUM: No test asserts `sendPaymentConfirmationMessages` is called BEFORE `enqueueGeneration`
- The story spec requires ordering: confirmation → enqueue. Tests only asserted call counts, not sequence.
- **Patched**: Added `callOrder` array tracker to the happy-path PAYMENT_CONFIRMED test to assert `["sendConfirmation", "enqueue"]`.

### Deferred (no patch applied)
- **MEDIUM**: Module-level `WHATSAPP_MESSAGES_URL` constant evaluated at import time — consistent with existing project pattern (`@mascotinhos/env/server` validates at startup); deferred to infrastructure/DX story.

## Change Log

- 2026-03-30: Implemented Story 3.3 — payment confirmation WhatsApp messages. Created `sendPaymentConfirmationMessages` utility in bot-engine, integrated into payment webhook handler (after transaction, before enqueue), wrote 8 unit tests for utility, updated webhook route tests with new mock shape and assertions (26 total tests pass, 0 regressions).
- 2026-03-30: Code review patches applied — fixed dead idempotency guard (RECEIVED not in enum), added fetch timeouts (10s AbortSignal), sanitized clientName against control chars/newlines, tightened status type annotation, renamed duplicate log event, added call-ordering assertion. Fixed pre-existing `generate-payment.ts` compile error (`"RECEIVED"` in PaymentStatus filter). All 28 tests pass.
