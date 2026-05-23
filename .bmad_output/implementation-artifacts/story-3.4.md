# Story 3.4: Payment Split Configuration

Status: done
GitHub Issue: [mgiovani/fotos#56](https://github.com/mgiovani/fotos/issues/56)

## Story

As the operator,
I want PIX payments to automatically split revenue with the business partner,
So that partner payouts are handled automatically without manual transfers.

## Acceptance Criteria

1. **Given** the `ASAAS_SPLIT_WALLET_ID` environment variable is configured (optional)
   **When** a PIX charge is created via the Asaas API
   **Then** if the split wallet ID is present, the charge includes split configuration directing the configured percentage to the partner wallet
   **And** if the split wallet ID is not configured, the charge is created without split (100% to primary account)
   **And** the split configuration is logged in the Payment record for auditing

**FRs covered:** FR-19 (partner payment split)

## Status Assessment — What Already Exists

**CRITICAL: Most of the split logic was already built in Stories 1.4 and 3.1. Do NOT reinvent or duplicate anything below.**

Already implemented and working:
- `packages/payments/src/split.ts` — `buildSplitConfig(walletId, percentualValue)` → `AsaasSplit[]` and `AsaasSplit` type
- `packages/payments/src/create-pix.ts` — `createPixCharge()` already accepts optional `splitConfig?: AsaasSplit[]` and includes `payload.split = splitConfig` when non-empty
- `packages/payments/src/index.ts` — `buildSplitConfig` and `AsaasSplit` already exported
- `packages/env/src/server-schema.ts` — `ASAAS_SPLIT_WALLET_ID: z.string().optional()` already validated
- `packages/bot-engine/src/tools/generate-payment.ts` — already calls `buildSplitConfig(env.ASAAS_SPLIT_WALLET_ID, 10)` and passes it to `createPixCharge`

**The split config is correctly passed to Asaas. The ONLY missing piece is auditing it in the Payment record.**

## Tasks / Subtasks

- [x] Task 1: Add `splitConfig` audit field to the Payment model (AC: #1 — "logged in the Payment record for auditing")
  - [x] 1.1: Edit `mascotinhos/packages/db/prisma/schema/schema.prisma` — add optional field to `Payment` model:
    ```prisma
    model Payment {
      id            String        @id @default(cuid())
      orderId       String
      asaasId       String        @unique
      pixQrCode     String?
      pixQrImageUrl String?
      amount        Decimal
      status        PaymentStatus @default(PENDING)
      confirmedAt   DateTime?
      splitConfig   Json?         // Audit: stores the split array sent to Asaas (null if no split)
      createdAt     DateTime      @default(now())
      updatedAt     DateTime      @updatedAt

      order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

      @@index([orderId])
    }
    ```
    Add ONLY `splitConfig   Json?` to the existing model. Do NOT remove any existing field.
  - [x] 1.2: Run migration from `mascotinhos/`:
    ```bash
    bun run db:migrate
    # Or if using push flow:
    bun run db:push
    # Then regenerate client:
    bun run db:generate
    ```
    This adds a nullable JSON column — it's a backward-compatible migration (no data loss, no downtime).

- [x] Task 2: Persist split config when creating Payment record in `generate-payment.ts` (AC: #1)
  - [x] 2.1: In `mascotinhos/packages/bot-engine/src/tools/generate-payment.ts`, update the `prisma.payment.create` call to include `splitConfig`:
    ```typescript
    // BEFORE (current code):
    await prisma.payment.create({
      data: {
        orderId,
        asaasId: chargeResult.chargeId,
        pixQrCode: chargeResult.pixCopyPaste,
        pixQrImageUrl: chargeResult.pixQrCodeBase64,
        amount: order.price,
        status: "PENDING",
      },
    });

    // AFTER — add splitConfig for audit:
    await prisma.payment.create({
      data: {
        orderId,
        asaasId: chargeResult.chargeId,
        pixQrCode: chargeResult.pixCopyPaste,
        pixQrImageUrl: chargeResult.pixQrCodeBase64,
        amount: order.price,
        status: "PENDING",
        splitConfig: splitConfig ?? null,  // JSON? — null when no split configured
      },
    });
    ```
    `splitConfig` is already in scope (built above the `createPixCharge` call). When `env.ASAAS_SPLIT_WALLET_ID` is absent, `splitConfig` is `undefined` — use `?? null` to store `null` explicitly.
  - [x] 2.2: TypeScript: `splitConfig` is `AsaasSplit[] | undefined`. Prisma `Json?` accepts arrays natively. No casting needed.

- [x] Task 3: Update `generate-payment.test.ts` to assert split config persistence (AC: #1)
  - [x] 3.1: File: `mascotinhos/packages/bot-engine/src/tools/generate-payment.test.ts`
  - [x] 3.2: Update the two existing tests that assert `mockPaymentCreate` is called to verify `splitConfig` is included in the data:
    - **Happy path (no split, test 3.1.5)**: `ASAAS_SPLIT_WALLET_ID` is `undefined` in `beforeEach`, so `splitConfig` must be `null`:
      ```typescript
      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            splitConfig: null,
          }),
        })
      );
      ```
    - **Split path (test 3.1.15 — "ASAAS_SPLIT_WALLET_ID set")**: `mockEnv.ASAAS_SPLIT_WALLET_ID = "wallet_test_123"` is already set in that test. Add:
      ```typescript
      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            splitConfig: [{ walletId: "wallet_123", percentualValue: 10 }],
          }),
        })
      );
      ```
    Note: `mockBuildSplitConfig` is already mocked to return `[{ walletId: "wallet_123", percentualValue: 10 }]`.
  - [x] 3.3: Add a test for no-split path (when `ASAAS_SPLIT_WALLET_ID` is absent):
    ```typescript
    it("persists null splitConfig when ASAAS_SPLIT_WALLET_ID is not configured", async () => {
      mockEnv.ASAAS_SPLIT_WALLET_ID = undefined;
      await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);
      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            splitConfig: null,
          }),
        })
      );
    });
    ```
  - [x] 3.4: ~~Add a test asserting split path sends split config to `createPixCharge`~~ — **ALREADY EXISTS** as test 3.1.15 ("ASAAS_SPLIT_WALLET_ID set: buildSplitConfig called and split config passed to createPixCharge") at line 209 of the test file. Do NOT add a duplicate.
  - [x] 3.5: ~~Add a test for no-split path passing `undefined` to `createPixCharge`~~ — **ALREADY EXISTS** in the happy-path test (test 3.1.5) at line 96: `expect(mockCreatePixCharge).toHaveBeenCalledWith("cus_123", TEST_ORDER_ID, 29.9, undefined)`. Do NOT add a duplicate.

- [x] Task 4: Type-check and test pipeline
  - [x] 4.1: Run `cd mascotinhos && bun run check-types` — must pass with 0 new errors
  - [x] 4.2: Run `cd mascotinhos && bun test packages/bot-engine/src/tools/generate-payment.test.ts` — all tests pass
  - [x] 4.3: Run `cd mascotinhos && bun test packages/payments/src/create-pix.test.ts` — no regressions (these tests do NOT need changes — `createPixCharge` already has split config test at line 101)

## Dev Notes

### Scope Boundaries — What to Modify

- **MODIFY**: `mascotinhos/packages/db/prisma/schema/schema.prisma` — add `splitConfig Json?` field to Payment model
- **MODIFY**: `mascotinhos/packages/bot-engine/src/tools/generate-payment.ts` — add `splitConfig` to `prisma.payment.create` call
- **MODIFY**: `mascotinhos/packages/bot-engine/src/tools/generate-payment.test.ts` — add split audit assertions

Do NOT modify:
- `packages/payments/src/split.ts` — already correct, no changes needed
- `packages/payments/src/create-pix.ts` — already correctly handles `splitConfig?: AsaasSplit[]`, no changes needed
- `packages/payments/src/index.ts` — already exports `buildSplitConfig` and `AsaasSplit`
- `packages/env/src/server-schema.ts` — already has `ASAAS_SPLIT_WALLET_ID: z.string().optional()`
- Any file under `packages/bot-engine/src/tools/` other than `generate-payment.ts` and its test
- Any webhook routes or other payment routes
- `packages/payments/src/create-pix.test.ts` — it already has a passing split config test (line 101); do not break it

### CRITICAL: The Split Logic Is Already Complete — Only Audit Is Missing

`generate-payment.ts` lines 139-142 already do:
```typescript
const splitConfig = env.ASAAS_SPLIT_WALLET_ID
  ? buildSplitConfig(env.ASAAS_SPLIT_WALLET_ID, 10)
  : undefined;
```
And line 148 already passes `splitConfig` to `createPixCharge`. This is fully working. The ONLY task is persisting it to the DB for auditing.

### CRITICAL: Split Percentage Is Hardcoded at 10%

The split percentage is `10` (hardcoded in `generate-payment.ts`). This is the correct value — do NOT change it. No env var for the percentage is needed in this story.

### CRITICAL: JSON? Field in Prisma

Prisma `Json?` accepts any JSON-serializable value including arrays like `[{ walletId: "...", percentualValue: 10 }]`. No special serialization is needed — pass `splitConfig` directly:
```typescript
splitConfig: splitConfig ?? null,
```
TypeScript will not complain: `AsaasSplit[] | undefined` → Prisma `Json?` accepts `JsonValue | null | undefined`. Use `?? null` to store `null` explicitly when no split is configured (clearer audit trail than `undefined`).

### CRITICAL: bun:test Mock Pattern — Env Override Per Test

The existing test file uses a mutable `mockEnv` proxy so individual tests can override `ASAAS_SPLIT_WALLET_ID`:
```typescript
const mockEnv: Record<string, string | undefined> = {
  ASAAS_SPLIT_WALLET_ID: undefined,
};
mock.module("@mascotinhos/env/server", () => ({
  env: new Proxy(mockEnv, {
    get(target, prop) { return target[prop as string]; },
  }),
}));
```
To test with split configured: `mockEnv.ASAAS_SPLIT_WALLET_ID = "wallet_test_123";` inside the `it()` block. Reset in `beforeEach` to `undefined`.

### CRITICAL: Check Existing Test Coverage Before Adding Tests

Run `cd mascotinhos && bun test packages/bot-engine/src/tools/generate-payment.test.ts --verbose` first. Some of the split assertions (e.g., `createPixCharge` called with split) may already exist. Do not duplicate passing tests.

### Architecture Compliance

- **DB access**: All Prisma operations via `@mascotinhos/db` — do NOT import Prisma directly
- **Env access**: Use `env` from `@mascotinhos/env/server` — `ASAAS_SPLIT_WALLET_ID` is already loaded
- **Logging**: Structured JSON via `console.log(JSON.stringify({ level, event, ... }))` — no new logging needed for this story (split is included transparently)
- **File naming**: kebab-case — no new files needed

### DB Schema Reference

**Payment model** (current, before this story):
- `id`: String @id
- `orderId`: String (FK to Order)
- `asaasId`: String @unique
- `pixQrCode`: String?
- `pixQrImageUrl`: String?
- `amount`: Decimal
- `status`: PaymentStatus @default(PENDING)
- `confirmedAt`: DateTime?
- `createdAt`: DateTime @default(now())
- `updatedAt`: DateTime @updatedAt

**After this story**: add `splitConfig Json?`

Migration is backward-compatible (nullable column, default null). No existing Payment rows are affected.

### Previous Story Learnings (from Story 3.3)

- **bun:test `mock.module()` before imports**: All `mock.module()` calls must precede static `import` statements. The `generate-payment.test.ts` already follows this pattern.
- **`mockEnv` proxy pattern**: The env mock uses `new Proxy(mockEnv, ...)` — mutate `mockEnv` properties in individual tests, not via `mock.module()` again.
- **Test invocation from `mascotinhos/`**: Always run `cd mascotinhos && bun test <path>`. Do NOT run from project root.
- **`generate-payment.ts` status type**: Story 3.3 review noted that `status: string` was tightened to the enum literal union. Current file may already have this — check before modifying the `prisma.payment.create` call shape.

### Project Structure Reference

```
mascotinhos/
├── packages/
│   ├── db/prisma/schema/schema.prisma    ← MODIFY (Task 1)
│   ├── bot-engine/src/tools/
│   │   ├── generate-payment.ts           ← MODIFY (Task 2)
│   │   └── generate-payment.test.ts      ← MODIFY (Task 3)
│   └── payments/src/
│       ├── split.ts                      ← DO NOT MODIFY (already complete)
│       ├── create-pix.ts                 ← DO NOT MODIFY (already complete)
│       └── create-pix.test.ts            ← DO NOT MODIFY (passing, no regressions)
```

### References

- Story 3.3 (previous): `/home/mgiovani/projects/fotos/.bmad_output/implementation-artifacts/story-3.3.md` — mock patterns, test invocation, payment webhook structure
- Epics: `/home/mgiovani/projects/fotos/.bmad_output/planning-artifacts/epics.md` — Epic 3, Story 3.4, FR-19
- Architecture: `/home/mgiovani/projects/fotos/.bmad_output/planning-artifacts/architecture.md` — env pattern, DB access rules
- `generate-payment.ts`: `mascotinhos/packages/bot-engine/src/tools/generate-payment.ts` — full current implementation
- `split.ts`: `mascotinhos/packages/payments/src/split.ts` — `buildSplitConfig` implementation
- `create-pix.ts`: `mascotinhos/packages/payments/src/create-pix.ts` — `createPixCharge` with split support

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Task 1.2: `bun run db:push` failed — Docker daemon not running in WSL2 environment. Used `bun run db:generate` instead to regenerate the Prisma client from the updated schema (sufficient for type safety; `db:push` should be run when the DB is available).
- Task 2.2: Prisma 7 `Json?` field accepts `NullableJsonNullValueInput | InputJsonValue` — TypeScript does not accept plain `null`. Used `(splitConfig ?? null) as any` cast since `AsaasSplit[]` is a valid JSON-serializable type and the cast is safe. This avoids importing the Prisma namespace (which triggers env validation at module load time in tests).
- Task 4.1: Pre-existing type error in `collect-photos.ts` (TS2532 — unrelated to this story). Zero new errors introduced.

### Completion Notes List

- Added `splitConfig Json?` field to the `Payment` model in `schema.prisma` for auditing the split configuration sent to Asaas on each PIX charge creation.
- Ran `bun run db:generate` to regenerate the Prisma client with the new field.
- Updated `generate-payment.ts` to persist `splitConfig ?? null` in `prisma.payment.create` — `null` is stored when no split is configured (clearer audit trail than omitting the field).
- Updated `generate-payment.test.ts` with 3 new assertions: happy path asserts `splitConfig: null`, split path asserts `splitConfig: [{walletId, percentualValue}]`, and a dedicated new test for the no-split case.
- All 14 `generate-payment` tests pass; all 121 bot-engine tests pass; all 7 `create-pix` tests pass (no regressions).
- AC #1 fully satisfied: split config is logged in the Payment record for auditing when present, and null when absent.

### File List

- `mascotinhos/packages/db/prisma/schema/schema.prisma` (modified — added `splitConfig Json?` to Payment model)
- `mascotinhos/packages/db/prisma/generated/` (regenerated — Prisma client rebuilt with new field)
- `mascotinhos/packages/bot-engine/src/tools/generate-payment.ts` (modified — added `splitConfig` to `prisma.payment.create`)
- `mascotinhos/packages/bot-engine/src/tools/generate-payment.test.ts` (modified — added split config audit assertions and new test)

## Review Findings

Code review performed 2026-03-30 (adversarial + edge case + acceptance audit). 2 patches applied directly; 2 items deferred.

### F1 — MEDIUM | `as any` cast on `splitConfig` (FIXED)

**File:** `generate-payment.ts:173`
**Issue:** The implementation used `(splitConfig ?? null) as any` with an `eslint-disable` comment. While runtime-correct, the blanket `any` suppresses TypeScript's type checking on a financial audit field and leaves a lint suppression in production code.
**Root cause:** `Prisma` namespace not re-exported from `@mascotinhos/db`; direct import from generated client triggers env validation at module load time in tests.
**Fix applied:** Replaced with `(splitConfig ?? null) as Parameters<typeof prisma.payment.create>[0]["data"]["splitConfig"]` — uses typeof-based type extraction, zero runtime cost, no imports, no eslint suppressions. Type-check still passes with zero new errors.

### F2 — MEDIUM | No test documenting audit-loss on non-unique DB persist failure (FIXED)

**File:** `generate-payment.test.ts`
**Issue:** When `payment.create` throws a non-unique-constraint error, the code logs at error level and returns `success: true` (user gets QR code). This design trade-off (user experience over audit completeness) was not documented in the test suite, leaving future maintainers unaware that the Payment record (including `splitConfig` audit) may be absent for charges that exist in Asaas.
**Fix applied:** Added test `3.4.1` — "payment.create throws non-unique DB error: returns success (charge exists in Asaas, audit record lost)". Explicitly asserts the trade-off and documents it with a comment.

### F3 — MEDIUM | `splitConfig` audit silently lost on non-unique DB persist error (DEFERRED)

**Issue:** When `payment.create` throws a non-unique-constraint error after a successful Asaas charge, the Payment record is never created — the split configuration sent to Asaas (the core AC requirement) is unrecorded. The operator has no audit trail for that charge's split.
**Rationale for deferral:** Changing the error path to return `success: false` would cause the user to see an error despite having a valid QR code. This is a deliberate UX trade-off. Mitigation: Asaas itself records the split at charge creation time; the DB audit is supplementary. Post-MVP: implement a reconciliation job that backfills Payment records from Asaas API for charges with no corresponding DB record.
**Deferred to:** `/home/mgiovani/projects/fotos/.bmad_output/implementation-artifacts/deferred-work.md`

### F4 — MEDIUM | Acceptance criteria coverage: `ASAAS_SPLIT_PERCENTAGE` env var not added (DEFERRED — overridden by story spec)

**Issue:** `deferred-work.md` from story-3.1 explicitly listed "Add `ASAAS_SPLIT_PERCENTAGE` env var (default `10`) in Story 3.4". The story spec for 3.4 countermands this: "The split percentage is `10` (hardcoded). This is the correct value — do NOT change it. No env var for the percentage is needed in this story." The story spec takes precedence. The deferred item remains open for a future operator configuration story.
**Deferred to:** Remains in `deferred-work.md` (originally from story-3.1 review).

## Change Log

- 2026-03-30: Story 3.4 created — payment split configuration audit field.
- 2026-03-30: Story 3.4 implemented — added `splitConfig Json?` to Payment model, persisted in generate-payment.ts, and validated with tests. Status → review.
- 2026-03-30: Code review patches applied — replaced `as any` with typed cast, added audit-loss documentation test. Status → done.
