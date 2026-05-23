# Story 4.5: Generated Image Upload to Permanent Storage

Status: done
GitHub Issue: [mgiovani/fotos#61](https://github.com/mgiovani/fotos/issues/61)

## Story

As the system,
I want to store the final generated mascotinho in permanent Supabase Storage,
So that the image is preserved indefinitely and can be re-delivered if needed.

## Acceptance Criteria

**Given** the generated image passes quality check (or quality check fails open)
**When** `uploadGenerated()` is called
**Then** the image is uploaded to the `generated` bucket at path `generated/{orderId}/{attemptNumber}.png`
**And** the existing Generation record is updated in the database with `imageUrl` set to the returned storage path
**And** the upload retries 2x inline on failure (fast operation)
**And** if upload fails after retries, the order is marked `CANCELLED` (terminal failure state — `OrderStatus` enum has no `FAILED` value; see schema note below) and the operator is notified
**And** on upload success, the route proceeds to Step 9 (Story 4.6 delivery stub)

**FRs covered:** FR-26 (permanent storage + Generation record imageUrl)

---

## Status Assessment — What Already Exists

**CRITICAL: Before writing any code, understand these pre-existing implementations:**

### Already implemented (DO NOT replace, DO NOT reinvent):

- `packages/storage/src/upload-generated.ts` — **FULLY IMPLEMENTED**. Accepts `(orderId: string, attemptNumber: number, file: Buffer | Uint8Array): Promise<string>`. Returns `"generated/{orderId}/{attemptNumber}.png"`. Uploads to `generated` bucket. **DO NOT modify this file.**
- `packages/storage/src/index.ts` — already exports `uploadGenerated`. Import as `import { uploadGenerated } from "@mascotinhos/storage"`.
- `packages/storage/src/upload-generated.test.ts` — already has 3 passing tests covering happy path, attempt number in path, and error throwing. **DO NOT modify.**
- `packages/image-gen/src/generate.ts` — returns `{ success: boolean, imageBase64?: string, message: string }`. `imageBase64` is raw base64 (no `data:` prefix). To convert to Buffer for upload: `Buffer.from(genResult.imageBase64!, "base64")`.
- `@mascotinhos/db` — `Generation` model has `imageUrl String?`. Currently set to `null` after Story 4.4. **This story sets it.**
- `apps/web/src/app/api/generate/route.ts` — pipeline through Step 7 (qualityCheck) is complete. Steps 8–9 are stubs:
  ```typescript
  // TODO (Story 4.5): import { uploadGenerated } from "@mascotinhos/storage";
  // TODO (Story 4.6): invoke deliverImage tool from bot-engine

  console.log(JSON.stringify({ level: "info", event: "generate_consumer_pipeline_stub_4_5_onward", orderId, attempt, generationId: enrichResult.generationId, service: "web" }));
  return NextResponse.json({ status: "ok" });
  ```
  **This story replaces the Story 4.5 TODO stub.**
- `apps/web/package.json` — already has `@mascotinhos/storage: "workspace:*"` as a dependency (used by other routes). **No new dependencies needed.**
- `apps/web/src/app/api/generate/route.test.ts` — 24 tests currently passing (18 base + 6 for quality check). **This story adds new tests without modifying existing ones.**
- `@mascotinhos/env/server` — all required env vars already validated. No changes to env package needed.
- `@mascotinhos/storage` package — already has `@supabase/supabase-js` as its sole external dependency. Do NOT add `@supabase/supabase-js` anywhere else.

### Not yet created (this story creates them):

- Wire `uploadGenerated()` into `apps/web/src/app/api/generate/route.ts` (replace the Story 4.5 TODO stub).
- New tests in `apps/web/src/app/api/generate/route.test.ts` covering the upload step.

### Not part of this story (stub out or leave for later):

- `deliverImage` tool — Story 4.6 wires WhatsApp delivery. Keep the `// TODO (Story 4.6)` stub in place after upload.
- Order status transitions (`DELIVERING`, `AWAITING_FEEDBACK`) — Story 4.6.
- WhatsApp photo + document sending — Story 4.6.

---

## Developer Context

### Schema Note: OrderStatus Enum

The `OrderStatus` enum in `schema.prisma` is: `PENDING | PAID | GENERATING | DELIVERED | CANCELLED`. There is **no `FAILED` value**. The architecture document says "mark as FAILED" on upload failure — this is an architecture/schema inconsistency. Use `CANCELLED` as the terminal failure state throughout this story.

> `ConversationState` does have a `FAILED` value, but `orderStatus` and `conversationState` are separate fields on `Order`. Never mix them.

### Pipeline Position

```
QStash → POST /api/generate → handleGenerate()
  Step 4: Load order (idempotency check) — done ✓
  Step 5: enrichPrompt() — done ✓  (Story 4.2)
  Step 6: generate()     — done ✓  (Story 4.3)
  Step 7: qualityCheck() — done ✓  (Story 4.4)
  Step 8: uploadGenerated() ← THIS STORY (Story 4.5)
  Step 9: deliverImage tool — Story 4.6 (stub remains)
```

### Route Integration — Exact Code

Replace in `apps/web/src/app/api/generate/route.ts`:

**Import** (at the top with other imports):
```typescript
import { uploadGenerated } from "@mascotinhos/storage";
```
Remove the `// TODO (Story 4.5): import { uploadGenerated } from "@mascotinhos/storage";` comment.

**Step 8 implementation** (replace the stub block after the quality check):
```typescript
// 8. UPLOAD TO PERMANENT STORAGE (Story 4.5)
const imageBuffer = Buffer.from(genResult.imageBase64!, "base64");
let imageUrl: string;
try {
  imageUrl = await uploadGeneratedWithRetry(imageBuffer, orderId, attempt, enrichResult.generationId!);
} catch (uploadErr) {
  // Upload failed after retries — mark order as CANCELLED, notify operator
  console.log(JSON.stringify({
    level: "error",
    event: "generate_consumer_upload_failed",
    orderId,
    attempt,
    generationId: enrichResult.generationId,
    error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
    service: "web",
  }));
  try {
    // NOTE: OrderStatus enum has no FAILED value (schema: PENDING|PAID|GENERATING|DELIVERED|CANCELLED).
    // Architecture says "mark as FAILED" but CANCELLED is the correct terminal failure state to use.
    await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: "CANCELLED" },
    });
  } catch (dbErr) {
    console.log(JSON.stringify({ level: "warn", event: "generate_consumer_order_status_update_failed", orderId, service: "web" }));
  }
  // Operator notification stub — Story 7.1 implements full operator alerts
  // TODO (Story 7.1): notifyOperator(orderId, "Upload failed after retries");
  return NextResponse.json({ error: "Storage upload failed after retries" }, { status: 500 });
}
console.log(JSON.stringify({
  level: "info",
  event: "generate_consumer_upload_success",
  orderId,
  attempt,
  generationId: enrichResult.generationId,
  imageUrl,
  service: "web",
}));

// TODO (Story 4.6): invoke deliverImage tool from bot-engine

console.log(JSON.stringify({ level: "info", event: "generate_consumer_pipeline_stub_4_6_onward", orderId, attempt, generationId: enrichResult.generationId, imageUrl, service: "web" }));
return NextResponse.json({ status: "ok" });
```

**Helper function** — add at the bottom of `route.ts` (outside `handleGenerate`):
```typescript
/** Retry uploadGenerated up to 2 times inline, then throw on final failure. */
async function uploadGeneratedWithRetry(
  imageBuffer: Buffer,
  orderId: string,
  attempt: number,
  generationId: string,
): Promise<string> {
  const MAX_UPLOAD_RETRIES = 2;
  let lastErr: unknown;
  for (let i = 0; i <= MAX_UPLOAD_RETRIES; i++) {
    try {
      const imageUrl = await uploadGenerated(orderId, attempt, imageBuffer);
      // Update Generation record with imageUrl on success
      await prisma.generation.update({
        where: { id: generationId },
        data: { imageUrl },
      });
      return imageUrl;
    } catch (err) {
      lastErr = err;
      if (i < MAX_UPLOAD_RETRIES) {
        console.log(JSON.stringify({
          level: "warn",
          event: "generate_consumer_upload_retry",
          orderId,
          attempt,
          generationId,
          retryAttempt: i + 1,
          error: err instanceof Error ? err.message : String(err),
          service: "web",
        }));
      }
    }
  }
  throw lastErr;
}
```

### Key Implementation Details

**Converting base64 to Buffer:**
```typescript
const imageBuffer = Buffer.from(genResult.imageBase64!, "base64");
```
`genResult.imageBase64` is raw base64 (no `data:image/png;base64,` prefix) — that prefix was only used for the AI SDK vision call in Story 4.4. Here you convert directly with `"base64"` encoding.

**Storage path returned:** `uploadGenerated()` already prepends `"generated/"` internally. It returns `"generated/{orderId}/{attemptNumber}.png"`. Store this directly in `Generation.imageUrl`.

**DB update inside retry loop:** The `prisma.generation.update` call MUST happen inside the retry loop after a successful upload (not after the loop). If the upload succeeds but the DB update fails, throw — the outer try/catch marks the order as `CANCELLED`, which is correct. The DB write is part of atomically completing the upload step.

**`attemptNumber` for storage path:** Use `attempt` (the pipeline attempt number from the QStash payload) as `attemptNumber`. This is already the correct field — `Generation.attemptNumber` equals `attempt` (set by Story 4.2 `enrichPrompt`). Storage path becomes `generated/{orderId}/{attempt}.png`.

**Order status on upload failure:** Set `orderStatus = "CANCELLED"`. The architecture says "mark as FAILED" but the `OrderStatus` enum in `schema.prisma` does NOT have a `FAILED` value — it only has `PENDING | PAID | GENERATING | DELIVERED | CANCELLED`. Use `CANCELLED` as the terminal failure state. Do NOT set `conversationState` here — that requires bot interaction and is beyond scope.

**Idempotency note:** `uploadGenerated()` uses `upsert: false`. If QStash retries this exact step (same orderId + attempt), the second upload call will throw a Supabase conflict error. This is acceptable — the outer retry logic in `uploadGeneratedWithRetry` will also fail, causing the order to be marked `CANCELLED`. Real idempotency for storage retries is not required for MVP since QStash retries at pipeline level already handle the full regeneration path.

### Architecture Compliance

- **Package boundaries:** `uploadGenerated` is called from `apps/web` — the only place that should import `@mascotinhos/storage`. Do NOT add a storage import to `packages/image-gen`.
- **DB access:** All Prisma calls via `prisma` imported from `@mascotinhos/db` (already imported in route). Never construct Supabase URLs directly.
- **Structured logging:** ALL logs MUST include `orderId` and `service: "web"`. Include `generationId` when available. Pattern: `console.log(JSON.stringify({ level, event, orderId, ... }))`.
- **Error propagation:** Return HTTP 500 for upload failure (not 4xx) — this is a retry-eligible server error. QStash will auto-retry on 500.
- **NFR-02:** This step should complete well under 30 seconds. No timeout needed for the upload itself — the architecture specifies "retry 2x inline (fast operation)".

### Log Events for This Story

| Event | Level | When |
|---|---|---|
| `generate_consumer_upload_retry` | warn | Each retry attempt before final attempt |
| `generate_consumer_upload_success` | info | Upload + DB update succeeded |
| `generate_consumer_upload_failed` | error | All retries exhausted |
| `generate_consumer_order_status_update_failed` | warn | DB update for FAILED status itself fails |
| `generate_consumer_pipeline_stub_4_6_onward` | info | After successful upload, before delivery stub |

### Test Pattern

Add to `apps/web/src/app/api/generate/route.test.ts`. Follow the EXACT same mock pattern as existing tests — `mock.module()` calls are at the top of the file before static imports.

**Mock addition needed:** `@mascotinhos/storage` must be added to the existing mock setup block. Check the current mock setup — if `@mascotinhos/storage` is not already mocked, add it:
```typescript
const mockUploadGenerated = mock(() => Promise.resolve("generated/test-order-id/1.png"));

mock.module("@mascotinhos/storage", () => ({
  uploadGenerated: mockUploadGenerated,
}));
```

Add `mockUploadGenerated.mockClear()` in the `beforeEach` block alongside existing mock clears.

**Test cases to add:**

```typescript
// Story 4.5: uploadGenerated() integration
it("uploadGenerated called with correct args after quality check passes", ...);
// Verify: mockUploadGenerated called with (orderId, 1, expect.any(Buffer))
// Verify: response status 200 { status: "ok" }

it("uploadGenerated success → Generation.imageUrl updated in DB", ...);
// Verify: mockPrismaGenerationUpdate called with { where: { id: "gen-uuid-1" }, data: { imageUrl: "generated/..." } }

it("uploadGenerated fails once → retries → succeeds on 2nd attempt → 200", ...);
// mockUploadGenerated: fail once, then succeed
// Verify: response 200

it("uploadGenerated fails all retries → 500 and order marked CANCELLED", ...);
// mockUploadGenerated: always throws Error("Supabase upload error")
// Verify: response 500 { error: "Storage upload failed after retries" }
// Verify: mockPrismaOrderUpdate called with { where: { id: orderId }, data: { orderStatus: "CANCELLED" } }

it("uploadGenerated not called when quality check triggers retry (attempt <= MAX_QUALITY_RETRIES)", ...);
// Set mockQualityCheck to return passed: false, attempt: 1
// Verify: mockUploadGenerated not called
```

**Prisma mock awareness:** The existing DB mock (in `mock.module("@mascotinhos/db", ...)`) only exposes:
```typescript
{
  order: { findUnique: mockPrismaOrderFindUnique },
  generation: { findUnique: mockPrismaGenerationFindUnique },
}
```
This story needs two new mock functions added to that same mock:
- `mockPrismaOrderUpdate` — for `prisma.order.update` (marking order `CANCELLED` on upload failure)
- `mockPrismaGenerationUpdate` — for `prisma.generation.update` (setting `imageUrl` on success)

Both must be declared before the `mock.module("@mascotinhos/db", ...)` call and the mock object must be updated to:
```typescript
{
  order: { findUnique: mockPrismaOrderFindUnique, update: mockPrismaOrderUpdate },
  generation: { findUnique: mockPrismaGenerationFindUnique, update: mockPrismaGenerationUpdate },
}
```
Add both `.mockClear()` calls in `beforeEach`, and set default implementations (resolve `{}`) there as well.

### Previous Story Intelligence

From Story 4.4 (the immediately prior story — read the complete file above):
- The `generate()` function returns `imageBase64` as raw base64 (no `data:` prefix). Confirmed: add `"base64"` encoding to `Buffer.from()`.
- The route's `handleGenerate` uses `enrichResult.generationId!` and `genResult.imageBase64!` non-null assertions after success checks. Follow same pattern.
- `order.photosUrls` is already in `prisma.order.findUnique` select — no need to add fields.
- Bun test mock ordering is non-negotiable: `mock.module()` before static imports.
- The `// TODO (Story 4.5): ...` comment in route.ts is the exact replacement point.

From Story 4.3:
- `@mascotinhos/storage` was added to `packages/image-gen/package.json` in Story 4.3. It is already available in the workspace. `apps/web` already imports from it in other files.
- `getSignedUrl` validates that path starts with `references/` or `generated/`. The path returned by `uploadGenerated` starts with `generated/` — this is safe for future signed URL retrieval.

From Story 4.4 Review Findings:
- Two deferred items to be aware of (but NOT fix in this story):
  - Prompt injection via `promptUsed` in quality check — Epic 7/8.
  - `Promise.all` on `photosUrls` failure handling — Epic 7.
- Do NOT add `references/` prefix validation for `photosUrls` here — already handled in `quality-check.ts`.

### Git Commit Message

When done: `feat(image-gen): generated image upload to permanent storage (closes #61)`

---

## Tasks / Subtasks

- [x] Task 1: Wire `uploadGenerated()` into `/api/generate` route
  - [x] 1.1: Add `import { uploadGenerated } from "@mascotinhos/storage"` at the top of `apps/web/src/app/api/generate/route.ts`. Remove the `// TODO (Story 4.5): import...` comment.
  - [x] 1.2: Add `uploadGeneratedWithRetry` helper function at the bottom of `route.ts` (outside `handleGenerate`). It accepts `(imageBuffer: Buffer, orderId: string, attempt: number, generationId: string): Promise<string>`, retries up to 2x, updates `Generation.imageUrl` on success, throws on final failure.
  - [x] 1.3: Replace the stub block (the `// TODO (Story 4.5)` comment through the `console.log` + `return NextResponse.json({ status: "ok" })`) in `handleGenerate` with Step 8 implementation (convert base64 to Buffer, call `uploadGeneratedWithRetry`, handle failure by marking order `CANCELLED`, log appropriately). The `// TODO (Story 4.5): import ...` comment at the top of the function body also gets removed — the actual import is added at the top of the file (Task 1.1).
  - [x] 1.4: Update the remaining stub log event from `generate_consumer_pipeline_stub_4_5_onward` to `generate_consumer_pipeline_stub_4_6_onward` and include `imageUrl` in the log context.
  - [x] 1.5: Keep `// TODO (Story 4.6): invoke deliverImage tool from bot-engine` comment after the upload success log.

- [x] Task 2: Tests in `apps/web/src/app/api/generate/route.test.ts`
  - [x] 2.1: Add `mockUploadGenerated` mock and `mock.module("@mascotinhos/storage", ...)` in the mock setup block at the top (before static imports). Add mock clear in `beforeEach`.
  - [x] 2.2: Add both `mockPrismaOrderUpdate` (for `CANCELLED` status marking) and `mockPrismaGenerationUpdate` (for `imageUrl` update) to the `mock.module("@mascotinhos/db", ...)` block — neither exists in the current test file. Update the mock shape to include `order.update` and `generation.update`. Add `.mockClear()` and default implementations in `beforeEach`.
  - [x] 2.3: Add test: upload called with correct args → 200.
  - [x] 2.4: Add test: upload success → `Generation.imageUrl` updated in DB.
  - [x] 2.5: Add test: upload fails once → retries → success → 200.
  - [x] 2.6: Add test: upload fails all retries → 500, order marked `CANCELLED`.
  - [x] 2.7: Add test: upload not called when quality check triggers retry.
  - [x] 2.8: Run `bun test` from `mascotinhos/apps/web` and confirm all tests pass (including the 24 pre-existing tests).

---

## NFR Compliance

- **NFR-02:** Upload + DB update are fast operations (< 10 seconds total). Inline 2x retry is appropriate — no QStash-level retry for this step alone.
- **NFR-19:** Auto-retry 2x inline for upload failures as specified in architecture. If all retries fail, mark order `CANCELLED` (separate from the QStash retry mechanism).
- **NFR-26:** Structured JSON logging for all upload events with `orderId`, `generationId`, `service`.

---

## Dev Agent Record

### Implementation Plan

Replaced the Story 4.5 TODO stub in `handleGenerate` with Step 8 (upload to permanent storage). Added `uploadGeneratedWithRetry` helper that loops up to 3 attempts (initial + 2 retries), calls `uploadGenerated` from `@mascotinhos/storage`, updates `Generation.imageUrl` on success, and throws on exhaustion. On final upload failure the handler marks the order `CANCELLED` (using the correct terminal state from the `OrderStatus` enum) and returns HTTP 500. Added `@mascotinhos/storage` as a `workspace:*` dependency to `apps/web/package.json` since it was missing despite the story notes indicating otherwise.

### Completion Notes

- All tasks and subtasks completed and verified.
- 5 new tests added for Story 4.5 upload step; all 29 tests (24 pre-existing + 5 new) pass.
- `@mascotinhos/storage` workspace dependency added to `apps/web/package.json` (was missing from the file despite story notes).
- `uploadGeneratedWithRetry` implements exactly 2x inline retry (3 total attempts) as specified.
- On success: `Generation.imageUrl` set to path returned by `uploadGenerated` (e.g. `generated/{orderId}/{attempt}.png`).
- On failure: order marked `CANCELLED`, HTTP 500 returned for QStash retry eligibility.
- `// TODO (Story 4.6)` stub preserved after upload success log.
- Stub log event updated from `generate_consumer_pipeline_stub_4_5_onward` to `generate_consumer_pipeline_stub_4_6_onward` with `imageUrl` in context.

---

## File List

- `mascotinhos/apps/web/src/app/api/generate/route.ts` — modified: added `uploadGenerated` import, Step 8 upload block, `uploadGeneratedWithRetry` helper
- `mascotinhos/apps/web/src/app/api/generate/route.test.ts` — modified: added `@mascotinhos/storage` mock, `mockPrismaOrderUpdate`/`mockPrismaGenerationUpdate` mocks, 5 new Story 4.5 tests
- `mascotinhos/apps/web/package.json` — modified: added `@mascotinhos/storage: "workspace:*"` dependency

---

## Review Findings

Reviewed: 2026-03-30. Reviewer: adversarial + edge case audit.

### [HIGH] DB write inside upload retry loop — duplicate upload on DB failure (FIXED)

**File:** `apps/web/src/app/api/generate/route.ts` — `uploadGeneratedWithRetry`

`prisma.generation.update` was inside the same `try/catch` block as `uploadGenerated`. A successful upload followed by a DB write failure would re-enter the retry loop and call `uploadGenerated` again on the same path. Because Supabase uses `upsert: false`, the second upload attempt throws a conflict error, cascading to order `CANCELLED` despite the image having been successfully stored.

**Fix applied:** Moved `prisma.generation.update` outside the retry loop. The loop now covers only the storage upload. After the loop exits with a successful URL, the DB update runs once in its own `await` call. If the DB write throws, the outer `catch` in `handleGenerate` marks the order `CANCELLED` without re-uploading.

### [HIGH] Missing `imageBase64` guard — 0-byte upload on unexpected `generate()` contract change (FIXED)

**File:** `apps/web/src/app/api/generate/route.ts` — `handleGenerate`

`genResult.imageBase64` was asserted non-null with `!` and passed directly to `Buffer.from()`. A future `generate()` implementation returning `{ success: true, imageBase64: undefined }` would produce a 0-byte buffer and upload a corrupt file. Added an explicit falsy guard that returns HTTP 500 with a structured log event before touching storage.

### [MEDIUM] Upload retries fired with zero delay (FIXED)

**File:** `apps/web/src/app/api/generate/route.ts` — `uploadGeneratedWithRetry`

Back-to-back retry attempts had no delay, hitting a transiently overloaded or rate-limited Supabase endpoint immediately. Added a 500ms `setTimeout` between retry attempts. This runs well within the 300s `maxDuration` set on the route.

### [MEDIUM] No test for DB-update failure after successful upload (FIXED)

**File:** `apps/web/src/app/api/generate/route.test.ts`

Added test: `"upload succeeds but Generation DB update fails → 500 and order marked CANCELLED (upload not retried)"`. Asserts `mockUploadGenerated` called exactly once even when DB throws, verifying the structural fix above.

### [MEDIUM] Missing `imageBase64` guard had no test coverage (FIXED)

Added test: `"generate returns success=true with missing imageBase64 → 500 without calling upload"`. Asserts the new early-exit path fires and `mockUploadGenerated` is never called.

### [MEDIUM] CANCELLED marking before QStash retry exhaustion (DEFERRED)

**File:** `apps/web/src/app/api/generate/route.ts` — `handleGenerate`

When upload fails after retries, the handler marks `orderStatus = "CANCELLED"` then returns HTTP 500. Returning 500 signals QStash to retry the full `handleGenerate` function. However on that retry, the idempotency check at line 100 (`orderStatus === "CANCELLED"`) causes an immediate skip, effectively silencing all QStash-level retry escalation. The 2 inline upload retries are the only real attempts. The AC explicitly requires CANCELLED marking on upload failure, so this is deferred to Epic 7 rather than changed here. See deferred-work.md.

### Test count after review patches

31 pass, 0 fail (29 original + 2 new review-patch tests).

---

## Change Log

- 2026-03-30: Implemented Story 4.5 — wire `uploadGenerated()` into `/api/generate` route with 2x inline retry, `Generation.imageUrl` DB update, order `CANCELLED` on failure, and 5 new tests (29 total passing).
- 2026-03-30: Code review applied — 3 bugs fixed (DB-write inside retry loop, missing imageBase64 guard, zero-delay retries), 2 new tests added (31 total passing). Status set to done.
