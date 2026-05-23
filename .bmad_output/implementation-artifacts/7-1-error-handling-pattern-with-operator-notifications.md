# Story 7.1: Error Handling Pattern with Operator Notifications

**Epic:** 7 — Resilience & Operator Tools
**Story ID:** 7.1
**GitHub Issue:** [mgiovani/fotos#72](https://github.com/mgiovani/fotos/issues/72)
**Status:** review
**Created:** 2026-03-30

---

## User Story

As the operator,
I want to be notified immediately via WhatsApp when critical failures occur,
So that I can intervene on stuck orders before clients notice.

---

## Acceptance Criteria

1. **Given** a critical failure occurs (generation failed after all retries, payment webhook verification failed, QStash consumer error)
   **When** the error handling pattern detects the failure
   **Then** the operator receives a notification formatted as: `[MASCOTINHOS] {severity}: {message} | Order: {orderId}`

2. **Given** a critical failure notification is triggered
   **When** `notifyOperator` is called
   **Then** the notification is sent via WhatsApp (using the Graph API directly) to `OPERATOR_WHATSAPP_NUMBER`
   **And** `OPERATOR_WHATSAPP_NUMBER` is already defined in `packages/env/src/server-schema.ts` with `z.string().regex(/^\d+$/)`

3. **Given** any error is logged
   **When** the log entry is written
   **Then** the error is logged with structured JSON including `orderId`, `error code`, `service name`, and `stack trace` (when available)
   **And** PII is redacted from logs — phone numbers appear as last 4 digits only (e.g. `***1234`)

4. **Given** an external API call fails transiently
   **When** `callWithRetry` is called
   **Then** the retry pattern follows: try 3x with exponential backoff (1s, 2s, 4s), then notify operator on final failure

5. **Given** the `notifyOperator` utility exists in `packages/bot-engine/src/notify-operator.ts`
   **When** it is called from any package
   **Then** it is exported from `packages/bot-engine/src/index.ts` and callable cross-package
   **And** `notifyOperator` never throws — all WhatsApp API errors are caught and logged internally

6. **Given** the existing TODO stubs in `apps/web/src/app/api/generate/route.ts`
   **When** story 7.1 is implemented
   **Then** the `// TODO (Story 7.1): notifyOperator(orderId, "Upload failed after retries");` comment is replaced with a real `notifyOperator` call

7. **Given** the `callWithRetry` utility exists in `packages/bot-engine/src/retry.ts`
   **When** it is exported
   **Then** it handles exponential backoff with configurable `maxRetries` and `baseDelayMs` (for test overrides)
   **And** it classifies retryable vs permanent errors (permanent = 400, 401, 403 status codes)

---

## Tasks / Subtasks

- [x] Task 1: Create `packages/bot-engine/src/notify-operator.ts` (AC: 1, 2, 5)
  - [x] Implement `notifyOperator(orderId: string, severity: "ERROR" | "WARN", message: string): Promise<void>` function
  - [x] Send message via WhatsApp Graph API to `env.OPERATOR_WHATSAPP_NUMBER` using the same pattern as `send-abandoned-cart-messages.ts` (direct fetch, not Chat SDK bot)
  - [x] Format message body: `[MASCOTINHOS] {severity}: {message} | Order: {orderId}`
  - [x] Never throws — catch all errors and log internally using structured JSON
  - [x] Export `notifyOperator` from `packages/bot-engine/src/index.ts`

- [x] Task 2: Create `packages/bot-engine/src/retry.ts` with generic `callWithRetry` utility (AC: 4, 7)
  - [x] Export `callWithRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T>` where `RetryOptions = { maxRetries?: number; baseDelayMs?: number; orderId?: string; service?: string }`
  - [x] Default: `maxRetries = 3`, `baseDelayMs = 1000` (exponential: 1s, 2s, 4s)
  - [x] Classify errors by HTTP status: permanent (400, 401, 403) — throw immediately; retryable (429, 500-504) — retry; unknown — retry
  - [x] Log retries with structured JSON: `{ level: "warn", event: "retry_attempt", attempt, delayMs, service, orderId }`
  - [x] Accept `baseDelayMs: 0` override for unit test speed
  - [x] Export from `packages/bot-engine/src/index.ts`

- [x] Task 3: Wire `notifyOperator` into `apps/web/src/app/api/generate/route.ts` (AC: 6)
  - [x] Replace the `// TODO (Story 7.1): notifyOperator(...)` stub comment with a real call: `await notifyOperator(orderId, "ERROR", "Upload failed after retries")`
  - [x] Add `notifyOperator` import from `@mascotinhos/bot-engine`
  - [x] Also call `notifyOperator` after final delivery failure (when `deliveryResult.success === false` and it's the last retry — check `attempt >= 3`)

- [x] Task 4: Add PII redaction helper and use it in structured logs (AC: 3)
  - [x] Create `redactPhone(phone: string): string` helper in `packages/bot-engine/src/notify-operator.ts` — returns `***${phone.slice(-4)}`
  - [x] Verify existing logs in `bot.ts`, `conversation.ts`, `send-abandoned-cart-messages.ts` do NOT log raw phone numbers (audit confirmed — existing code does not log raw phone numbers)
  - [x] Document the PII redaction convention in a code comment

- [x] Task 5: Write unit tests for `notify-operator.ts` (AC: 1, 2, 5)
  - [x] Test: formats message correctly as `[MASCOTINHOS] ERROR: ... | Order: ...`
  - [x] Test: sends to `OPERATOR_WHATSAPP_NUMBER` from env
  - [x] Test: never throws when WhatsApp API returns error (catches internally)
  - [x] Test: never throws when WhatsApp API call rejects (network error)
  - [x] Mock `env.OPERATOR_WHATSAPP_NUMBER`, `env.WHATSAPP_PHONE_NUMBER_ID`, `env.WHATSAPP_ACCESS_TOKEN` using Bun's `mock.module()`

- [x] Task 6: Write unit tests for `retry.ts` (AC: 4, 7)
  - [x] Test: retries 3x on retryable status (500), then throws
  - [x] Test: does NOT retry on permanent status (400, 401, 403)
  - [x] Test: returns result on first success (no retry needed)
  - [x] Test: exponential backoff timing (use `baseDelayMs: 0` to skip real delays)
  - [x] Test: logs retry attempts as structured JSON warn events

- [x] Task 7: Run full test suite and verify no regressions (AC: all)
  - [x] `cd mascotinhos/packages/bot-engine && bun test` — 219 pass, 0 fail
  - [x] `cd mascotinhos/apps/web && bunx tsc --noEmit` — 0 new errors (2 pre-existing bun:test type errors unchanged)
  - [x] All pre-existing tests still pass (315 pass, 29 fail before and after — same counts)

---

## Dev Notes

### Architecture Decisions (Do NOT deviate)

**Operator Notification Channel:** WhatsApp only (not Telegram) for MVP. The architecture doc lists "WhatsApp (using Chat SDK to the OPERATOR_WHATSAPP_NUMBER) or Telegram bot" but `OPERATOR_WHATSAPP_NUMBER` is already in the env schema and the project only has WhatsApp set up. Use the same direct Graph API fetch pattern already used in `send-abandoned-cart-messages.ts` — do NOT use the Chat SDK `bot` instance (it's for client conversation, not operator alerting).

**Never-Throws Contract:** `notifyOperator` must never throw. If the operator notification fails, it should log the failure and return — this prevents a secondary failure from masking the original error. See `sendAbandonedNudgeMessage` for the exact pattern.

**callWithRetry Location:** Create the generic utility in `packages/bot-engine/src/retry.ts`. The existing `callWithRetry` in `packages/image-gen/src/generate.ts` is private and OpenAI-specific. Do NOT modify `generate.ts` — create a separate, more generic version in `bot-engine`.

**`callWithRetry` is not required to be wired into ALL existing callers in this story.** Story 7.1 creates the pattern. Future refactoring stories can adopt it. The only required wiring is the `notifyOperator` replacement in `generate/route.ts`.

### Environment Variables (already configured — no schema changes needed)

```typescript
// packages/env/src/server-schema.ts — already has:
OPERATOR_WHATSAPP_NUMBER: z.string().regex(/^\d+$/),
WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
WHATSAPP_ACCESS_TOKEN: z.string().min(1),
```

### WhatsApp Direct API Pattern (copy from `send-abandoned-cart-messages.ts`)

```typescript
// packages/bot-engine/src/notify-operator.ts
import { env } from "@mascotinhos/env/server";

const WHATSAPP_API_VERSION = "v21.0";
const WA_FETCH_TIMEOUT_MS = 10_000;

function makeTimeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(WA_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

export async function notifyOperator(
  orderId: string,
  severity: "ERROR" | "WARN",
  message: string,
): Promise<void> {
  try {
    const messagesUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const body = `[MASCOTINHOS] ${severity}: ${message} | Order: ${orderId}`;
    const response = await fetch(messagesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      signal: makeTimeoutSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: env.OPERATOR_WHATSAPP_NUMBER,
        type: "text",
        text: { body },
      }),
    });
    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }
    console.log(JSON.stringify({ level: "info", event: "operator_notified", orderId, severity, service: "bot-engine" }));
  } catch (err) {
    console.log(JSON.stringify({
      level: "warn",
      event: "operator_notify_failed",
      orderId,
      severity,
      error: err instanceof Error ? err.message : String(err),
      service: "bot-engine",
    }));
    // Never rethrow — operator notification failure must not mask the original error
  }
}
```

### Retry Utility Pattern

```typescript
// packages/bot-engine/src/retry.ts
const PERMANENT_STATUS_CODES = new Set([400, 401, 403]);
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export type RetryOptions = {
  maxRetries?: number;       // Default: 3
  baseDelayMs?: number;      // Default: 1000ms; pass 0 in tests
  orderId?: string;          // For structured logging
  service?: string;          // For structured logging
};

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, orderId, service } = opts;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status !== undefined && PERMANENT_STATUS_CODES.has(status)) throw err;
      if (attempt > maxRetries) throw err;
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(JSON.stringify({ level: "warn", event: "retry_attempt", attempt, delayMs, orderId, service }));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Unreachable");
}
```

### PII Redaction Helper

```typescript
export function redactPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `***${phone.slice(-4)}`;
}
```

This helper should live in `notify-operator.ts` (or `retry.ts`) and be exported for use in other files that log phone numbers.

### Structured Log Format (Do NOT change)

All logs follow: `console.log(JSON.stringify({ level, event, orderId, ...data }))`

Levels: `info` (happy path), `warn` (retryable failures / notification issues), `error` (terminal failures)

### File Naming Conventions

- `packages/bot-engine/src/notify-operator.ts` (kebab-case, matches existing pattern)
- `packages/bot-engine/src/retry.ts` (kebab-case)
- Test files co-located: `notify-operator.test.ts`, `retry.test.ts`

### Test Setup Pattern

Bot-engine tests use `packages/bot-engine/src/test-setup.ts`. Follow the mock pattern from `send-abandoned-cart-messages.test.ts` for mocking `fetch` and env vars. Use `mock.module("@mascotinhos/env/server", ...)` from Bun's test utilities.

### Existing TODO Stubs to Replace

In `apps/web/src/app/api/generate/route.ts` line ~323:
```typescript
// Operator notification stub — Story 7.1 implements full operator alerts
// TODO (Story 7.1): notifyOperator(orderId, "Upload failed after retries");
```
Replace with:
```typescript
await notifyOperator(orderId, "ERROR", "Upload failed after retries");
```
And add the import at the top:
```typescript
import { notifyOperator } from "@mascotinhos/bot-engine";
```

### Package Structure Notes

- `packages/bot-engine/src/index.ts` — add exports for `notifyOperator`, `callWithRetry`, `redactPhone`
- Do NOT touch `packages/image-gen/src/generate.ts` — its internal `callWithRetry` remains as-is
- Do NOT add new env vars — `OPERATOR_WHATSAPP_NUMBER` is already in schema
- No new npm packages required — uses existing `fetch` (native in Bun/Node 18+)

### Testing Commands

```bash
cd mascotinhos

# Type check
bun run check-types

# All tests
bun test

# Specific package tests
bun test packages/bot-engine

# Check for regressions
bun test apps/web
```

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `packages/bot-engine/src/notify-operator.ts` with `notifyOperator(orderId, severity, message)` — sends `[MASCOTINHOS] {severity}: {message} | Order: {orderId}` to `OPERATOR_WHATSAPP_NUMBER` via direct WhatsApp Graph API fetch. Never throws. Also exports `redactPhone(phone)` PII helper.
- Created `packages/bot-engine/src/retry.ts` with generic `callWithRetry<T>` — exponential backoff (1s/2s/4s), permanent error detection (400/401/403), structured JSON warn logging per retry attempt.
- Both utilities exported from `packages/bot-engine/src/index.ts` (plus `RetryOptions` type).
- Replaced `// TODO (Story 7.1)` stub in `apps/web/src/app/api/generate/route.ts` with real `await notifyOperator(orderId, "ERROR", "Upload failed after retries")`. Also added operator notification on final delivery failure (`attempt >= 3`).
- PII audit: confirmed `bot.ts`, `conversation.ts`, `send-abandoned-cart-messages.ts` do not log raw phone numbers. `redactPhone` exported for use by future stories.
- 25 new unit tests: 14 in `notify-operator.test.ts`, 11 in `retry.test.ts`. All pass. Zero regressions confirmed.

### File List

- `mascotinhos/packages/bot-engine/src/notify-operator.ts` (new)
- `mascotinhos/packages/bot-engine/src/notify-operator.test.ts` (new)
- `mascotinhos/packages/bot-engine/src/retry.ts` (new)
- `mascotinhos/packages/bot-engine/src/retry.test.ts` (new)
- `mascotinhos/packages/bot-engine/src/index.ts` (modified — added exports)
- `mascotinhos/apps/web/src/app/api/generate/route.ts` (modified — replaced TODO stub, added delivery failure notification)
- `.bmad_output/implementation-artifacts/7-1-error-handling-pattern-with-operator-notifications.md` (this file)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` (modified — story status)
