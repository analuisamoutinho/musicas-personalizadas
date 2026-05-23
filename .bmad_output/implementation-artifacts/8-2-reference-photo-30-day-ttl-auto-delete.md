# Story 8.2: Reference Photo 30-Day TTL Auto-Delete

**Epic:** 8 — LGPD Compliance & Security
**Story ID:** 8.2
**GitHub Issue:** [mgiovani/fotos#77](https://github.com/mgiovani/fotos/issues/77)
**Status:** review
**Created:** 2026-03-30

---

## User Story

As the system,
I want reference photos automatically deleted from Supabase Storage 30 days after order completion,
So that the platform enforces LGPD data minimization without manual intervention.

---

## Acceptance Criteria

1. **Given** an order reaches `conversationState = COMPLETED`
   **When** the order is marked COMPLETED
   **Then** `Order.photosDeleteAt` is set to `now() + 30 days`

2. **Given** reference photos are stored in the `references` bucket
   **When** the scheduled cleanup job runs via Vercel Cron
   **Then** all orders with `photosDeleteAt < now()` have their reference photos deleted from Supabase Storage

3. **Given** the cleanup job runs
   **When** it processes each expired order
   **Then** the count of deleted orders and any errors are logged using structured JSON (no PII)

4. **Given** the cleanup job runs daily
   **When** it triggers via Vercel Cron at 02:00 UTC
   **Then** it calls `POST /api/cleanup` with header `Authorization: Bearer {CRON_SECRET}`

5. **Given** a `/api/cleanup` route exists
   **When** a request arrives without a valid `CRON_SECRET` in the `Authorization` header
   **Then** it returns HTTP 401

6. **Given** the cleanup function processes multiple orders
   **When** deletion of one order's photos fails
   **Then** the error is logged and the cleanup continues processing remaining orders (errors do not block the batch)

7. **Given** an order with `photosDeleteAt < now()` has its photos deleted
   **When** the deletion succeeds
   **Then** `Order.photosDeleteAt` is set to `null` (idempotent — prevents re-deletion on next cron run)

---

## Tasks / Subtasks

- [x] Task 1: Add `photosDeleteAt` field to Prisma schema and run migration (AC: 1, 2, 7)
  - [x] Add `photosDeleteAt DateTime?` to the `Order` model in `mascotinhos/packages/db/prisma/schema/schema.prisma`
  - [x] Add `@@index([photosDeleteAt])` to the `Order` model for efficient cron queries
  - [x] Run `cd mascotinhos && bun run db:migrate` to create migration — local DB not running; `db:generate` used to regenerate client
  - [x] Run `cd mascotinhos && bun run db:generate` to regenerate Prisma client

- [x] Task 2: Set `photosDeleteAt` when order completes (AC: 1)
  - [x] In `mascotinhos/apps/web/src/app/api/generate/route.ts`, find where `conversationState` is set to `AWAITING_FEEDBACK` (the state after DELIVERING — this is when the order is effectively complete from a storage perspective; use `AWAITING_FEEDBACK` as the trigger since it follows delivery)
  - [x] After the delivery success log, add a best-effort update: `await prisma.order.update({ where: { id: orderId }, data: { photosDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })` — wrap in try/catch, log at `level: "warn"` with `event: "set_photos_delete_at_failed"` on error, but never block delivery
  - [x] **IMPORTANT**: The `conversationState` transition to `AWAITING_FEEDBACK` is done inside `deliverImageToClient` in bot-engine — so the `photosDeleteAt` update should happen in `handleGenerate` immediately after `deliverImageToClient` returns `success: true`

- [x] Task 3: Extend `deleteExpiredReferences` in `packages/storage/src/cleanup.ts` (AC: 2, 3, 6, 7)
  - [x] The existing `deleteReferences(orderId)` function is already correct — it lists and removes all files under `references/{orderId}/`
  - [x] Add a new exported function `deleteExpiredReferences` that accepts `expiredOrderIds: string[]` and:
    - Iterates over each orderId in batches
    - Calls `deleteReferences(orderId)` for each
    - Catches errors per orderId and collects them (does NOT throw — errors should not block other deletions)
    - Returns `{ deletedCount: number, errorCount: number, errors: Array<{ orderId: string, message: string }> }`
  - [x] Log result using structured JSON: `JSON.stringify({ level: "info", event: "expired_references_deleted", deletedCount, errorCount, service: "storage" })`
  - [x] Export `deleteExpiredReferences` from `packages/storage/src/index.ts`

- [x] Task 4: Create `/api/cleanup` route (AC: 4, 5, 6, 7)
  - [x] Create `mascotinhos/apps/web/src/app/api/cleanup/route.ts`
  - [x] Add `export const maxDuration = 60;` (cron cleanup can be slow with many orders)
  - [x] Implement `GET()` for Vercel Cron (sends GET) — verifies CRON_SECRET from Authorization header
  - [x] Implement `POST(request: NextRequest)` for manual/testing invocations — same auth check
  - [x] Both handlers call shared `runCleanup()` that queries expired orders, deletes references, nulls `photosDeleteAt` for successes, logs result

- [x] Task 5: Add `CRON_SECRET` to env validation (AC: 5)
  - [x] Add `CRON_SECRET: z.string().min(1)` to `mascotinhos/packages/env/src/server-schema.ts`
  - [x] Add `CRON_SECRET=test-cron-secret-local` to `mascotinhos/apps/web/.env` (local dev)

- [x] Task 6: Configure Vercel Cron in `vercel.json` (AC: 4)
  - [x] Created `mascotinhos/apps/web/vercel.json` with cron schedule `"0 2 * * *"` pointing to `/api/cleanup`

- [x] Task 7: Write unit tests (AC: 2, 3, 5, 6, 7)
  - [x] Extended `mascotinhos/packages/storage/src/cleanup.test.ts` with 3 new tests for `deleteExpiredReferences`: empty input, successful multi-order deletion, error isolation
  - [x] Created `mascotinhos/apps/web/src/app/api/cleanup/route.test.ts` with 8 tests covering all auth and cleanup scenarios

- [x] Task 8: Run full test suite and type check (AC: all)
  - [x] `cd mascotinhos && bun run check-types` — 0 new TypeScript errors in new/modified files (only pre-existing bun:test errors remain)
  - [x] `cd mascotinhos && bun test` — 345 pass (+11 new), 29 fail (baseline unchanged), 5 errors (baseline unchanged)

---

## Dev Notes

### File Locations — Critical

```
mascotinhos/
├── apps/web/
│   ├── src/app/api/
│   │   └── cleanup/
│   │       ├── route.ts            ← NEW: cleanup cron handler
│   │       └── route.test.ts       ← NEW: tests
│   └── vercel.json                 ← NEW: Vercel Cron config
├── packages/
│   ├── db/prisma/schema/
│   │   └── schema.prisma           ← MODIFY: add photosDeleteAt + index to Order model
│   ├── env/src/
│   │   └── server-schema.ts        ← MODIFY: add CRON_SECRET
│   └── storage/src/
│       ├── cleanup.ts              ← MODIFY: add deleteExpiredReferences
│       ├── cleanup.test.ts         ← MODIFY: add tests for deleteExpiredReferences (keep existing)
│       └── index.ts                ← MODIFY: export deleteExpiredReferences
```

### Prisma Schema Change — Order Model

Add to `Order` model (after `updatedAt`):

```prisma
// LGPD: set to (completedAt + 30 days) when order delivers, nulled after photos deleted
photosDeleteAt DateTime?

@@index([photosDeleteAt])
```

**Migration required** — run `bun run db:migrate` then `bun run db:generate`. New nullable field, no default — safe migration, no data loss.

### Setting `photosDeleteAt` — Where in generate/route.ts

Find the delivery success block in `handleGenerate`:

```typescript
console.log(JSON.stringify({
  level: "info",
  event: "generate_consumer_delivery_success",
  orderId,
  attempt,
  service: "web",
}));

// ADD AFTER this log:
try {
  await prisma.order.update({
    where: { id: orderId },
    data: { photosDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
} catch (err) {
  console.log(JSON.stringify({
    level: "warn",
    event: "set_photos_delete_at_failed",
    orderId,
    error: err instanceof Error ? err.message : String(err),
    service: "web",
  }));
  // Non-fatal: cron can handle cleanup even without photosDeleteAt (fallback: query by updatedAt)
}

return NextResponse.json({ status: "ok" });
```

**Never throw** — this update is best-effort. The delivery has succeeded; `photosDeleteAt` failure is non-critical.

### `deleteExpiredReferences` Function Pattern

```typescript
export type DeleteExpiredResult = {
  deletedCount: number;
  errorCount: number;
  errors: Array<{ orderId: string; message: string }>;
};

export async function deleteExpiredReferences(
  expiredOrderIds: string[],
): Promise<DeleteExpiredResult> {
  const errors: Array<{ orderId: string; message: string }> = [];
  let deletedCount = 0;

  for (const orderId of expiredOrderIds) {
    try {
      await deleteReferences(orderId);
      deletedCount++;
    } catch (err) {
      errors.push({
        orderId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const errorCount = errors.length;
  console.log(
    JSON.stringify({
      level: "info",
      event: "expired_references_deleted",
      deletedCount,
      errorCount,
      service: "storage",
    }),
  );

  return { deletedCount, errorCount, errors };
}
```

### `/api/cleanup` Route Pattern

```typescript
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { deleteExpiredReferences } from "@mascotinhos/storage";
import { env } from "@mascotinhos/env/server";

export const maxDuration = 60;

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Vercel Cron sends GET requests
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCleanup();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCleanup();
}

async function runCleanup(): Promise<NextResponse> {
  const expiredOrders = await prisma.order.findMany({
    where: { photosDeleteAt: { lt: new Date(), not: null } },
    select: { id: true },
  });

  if (expiredOrders.length === 0) {
    console.log(JSON.stringify({ level: "info", event: "cleanup_no_expired_orders", service: "web" }));
    return NextResponse.json({ status: "ok", deletedCount: 0, errorCount: 0 });
  }

  const orderIds = expiredOrders.map((o) => o.id);
  const result = await deleteExpiredReferences(orderIds);

  const failedIds = new Set(result.errors.map((e) => e.orderId));
  const successfulIds = orderIds.filter((id) => !failedIds.has(id));

  if (successfulIds.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: successfulIds } },
      data: { photosDeleteAt: null },
    });
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "cleanup_completed",
      deletedCount: result.deletedCount,
      errorCount: result.errorCount,
      service: "web",
    }),
  );

  return NextResponse.json({
    status: "ok",
    deletedCount: result.deletedCount,
    errorCount: result.errorCount,
  });
}
```

### Vercel Cron — Key Facts

- Vercel Cron sends **GET** requests to the configured path (not POST)
- Use `Authorization: Bearer {CRON_SECRET}` — Vercel does NOT auto-inject this; it must be set in the Vercel dashboard as an env var and the route must verify it manually
- `CRON_SECRET` must be added to Vercel environment variables in production
- Cron schedule `"0 2 * * *"` = daily at 02:00 UTC (off-peak)
- `vercel.json` goes in `apps/web/` — the Next.js app root (NOT the monorepo root)
- Reference: https://vercel.com/docs/cron-jobs

### Prisma Query for Expired Orders

```typescript
// Correct Prisma v7 syntax for "photosDeleteAt is not null AND < now()"
prisma.order.findMany({
  where: {
    photosDeleteAt: {
      lt: new Date(),
      not: null,  // ← required to exclude null rows
    },
  },
  select: { id: true },
})
```

### Test Pattern — cleanup/route.test.ts

Follow the exact same pattern as `generate/route.test.ts`:

```typescript
import { mock, beforeEach, describe, it, expect } from "bun:test";

// mock.module() BEFORE imports
const mockPrismaOrderFindMany = mock(() => Promise.resolve([]));
const mockPrismaOrderUpdateMany = mock(() => Promise.resolve({ count: 0 }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: {
      findMany: mockPrismaOrderFindMany,
      updateMany: mockPrismaOrderUpdateMany,
    },
  },
}));

const mockDeleteExpiredReferences = mock(() =>
  Promise.resolve({ deletedCount: 0, errorCount: 0, errors: [] })
);

mock.module("@mascotinhos/storage", () => ({
  deleteExpiredReferences: mockDeleteExpiredReferences,
}));

mock.module("@mascotinhos/env/server", () => ({
  env: { CRON_SECRET: "test-secret" },
}));

import { GET, POST } from "./route";
// ...
```

Use CUID-format order IDs: `"clh1234567890abcdefghijk0"`.

### env/server-schema.ts — CRON_SECRET

Add to `serverSchemaSpec` in `packages/env/src/server-schema.ts`:

```typescript
CRON_SECRET: z.string().min(1),
```

Add to `apps/web/.env` for local dev (if file exists):
```
CRON_SECRET=test-cron-secret-local
```

### Testing Baseline

Current baseline (from Story 8.1): **334 pass, 29 fail, 5 errors**

- Do NOT break this baseline
- All new tests must pass
- `bun run check-types` from `mascotinhos/` root — 0 new errors in modified files
- Pre-existing errors in payments/storage packages are acceptable

### Architecture Compliance

- `cleanup.ts` lives in `packages/storage/src/` — this is the designated location per architecture
- `/api/cleanup` is a **new** route — does NOT reuse `/api/generate` (epics hint at reuse but a dedicated route is cleaner and avoids bloating the generate route's already-large action enum)
- Logging: always `console.log(JSON.stringify({ level, event, ...context, service }))` — never bare strings
- No PII in logs: only `orderId` (cuid, non-PII), `deletedCount`, `errorCount` — never log `whatsappSenderId`, `phone`, or file paths (they contain orderId which is acceptable)
- `@mascotinhos/storage` → `@mascotinhos/db` dependency is NOT allowed per architecture boundary rules. The `deleteExpiredReferences` function in storage package does NOT import prisma — it only operates on Supabase Storage. The DB query lives in `apps/web` route.

### Previous Story Learnings

From Story 8.1:
- Test baseline: 334 pass, 29 fail, 5 errors — keep this as floor
- `bun:test` mock pattern: `mock.module()` calls MUST come before `import` statements
- Run `bun run check-types` from `mascotinhos/` root (not from individual packages)
- Structured JSON logging: `console.log(JSON.stringify({ level, event, ...context, service }))` pattern throughout

From Story 7.4:
- bun test type errors are pre-existing — do not count as regressions
- Always run `check-types` from `mascotinhos/` root

From Story 2.5 (collect-photos, storage uploads):
- `packages/storage/src/` is the correct location for all storage operations
- Supabase Storage client: `import { storage } from './client'` (already exists)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `cleanup.test.ts` lines 89-90: TypeScript flagged `result.errors[0].orderId` as possibly undefined. Fixed by assigning to `const firstError = result.errors[0]` and using optional chaining `firstError?.orderId`. This is a strictNullChecks artifact with array access — not a logic issue.
- `db:migrate` failed because local Supabase is not running (port 54322 unreachable). Used `db:generate` instead to regenerate the Prisma client. The schema change (`photosDeleteAt DateTime?`) must be applied via `db:push` or `db:migrate` against the real database before production deployment.
- `generate/route.test.ts` in isolation fails env validation (CRON_SECRET now required) — confirmed this is the same pre-existing pattern (test passes fine when run via `bun test` from monorepo root due to bunfig.toml preload; the mock for `@mascotinhos/env/server` already returns a proxy, but running the file alone doesn't trigger that mock). Not a regression — baseline was already 29 fail.

### Completion Notes List

- Added `photosDeleteAt DateTime?` field + `@@index([photosDeleteAt])` to `Order` model in Prisma schema. Regenerated Prisma client (`db:generate`). Migration must be run against production DB before deploy.
- Added `CRON_SECRET: z.string().min(1)` to `packages/env/src/server-schema.ts` and `CRON_SECRET=test-cron-secret-local` to `apps/web/.env`.
- Extended `packages/storage/src/cleanup.ts`: added `deleteExpiredReferences(expiredOrderIds: string[])` that iterates per-orderId, calls existing `deleteReferences`, collects errors without throwing (error isolation), logs structured JSON, returns `{ deletedCount, errorCount, errors }`. Exported type `DeleteExpiredResult` and function from `index.ts`.
- Modified `apps/web/src/app/api/generate/route.ts` `handleGenerate`: after delivery success log, best-effort `prisma.order.update({ photosDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })` — wrapped in try/catch with `set_photos_delete_at_failed` warn log. Never blocks delivery response.
- Created `apps/web/src/app/api/cleanup/route.ts`: `maxDuration = 60`, both `GET` (Vercel Cron) and `POST` (manual/testing) handlers that verify `Authorization: Bearer {CRON_SECRET}`, share `runCleanup()` which queries `Order` where `photosDeleteAt < now()`, calls `deleteExpiredReferences`, nulls `photosDeleteAt` only for successes (idempotency), logs `cleanup_completed`.
- Created `apps/web/vercel.json` with cron `{ path: "/api/cleanup", schedule: "0 2 * * *" }` — daily at 02:00 UTC.
- Added 3 tests to `cleanup.test.ts` for `deleteExpiredReferences`. Created `cleanup/route.test.ts` with 8 tests (auth rejection, no-expired-orders, multi-order success, partial failure isolation, GET and POST handlers).
- Final: 345 pass (+11), 29 fail (baseline), 5 errors (baseline). 0 new TypeScript errors in modified files.

### File List

- `mascotinhos/packages/db/prisma/schema/schema.prisma` (modified — added `photosDeleteAt DateTime?` + `@@index([photosDeleteAt])` to Order model)
- `mascotinhos/packages/env/src/server-schema.ts` (modified — added `CRON_SECRET: z.string().min(1)`)
- `mascotinhos/apps/web/.env` (modified — added `CRON_SECRET=test-cron-secret-local`)
- `mascotinhos/packages/storage/src/cleanup.ts` (modified — added `deleteExpiredReferences` function + `DeleteExpiredResult` type)
- `mascotinhos/packages/storage/src/index.ts` (modified — exported `deleteExpiredReferences` and `DeleteExpiredResult`)
- `mascotinhos/packages/storage/src/cleanup.test.ts` (modified — added 3 tests for `deleteExpiredReferences`)
- `mascotinhos/apps/web/src/app/api/generate/route.ts` (modified — added best-effort `photosDeleteAt` update after delivery success)
- `mascotinhos/apps/web/src/app/api/cleanup/route.ts` (new)
- `mascotinhos/apps/web/src/app/api/cleanup/route.test.ts` (new)
- `mascotinhos/apps/web/vercel.json` (new — Vercel Cron config)
- `.bmad_output/implementation-artifacts/8-2-reference-photo-30-day-ttl-auto-delete.md` (this file)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` (modified — story status)

### Change Log

- 2026-03-30: Implemented Story 8.2 — LGPD reference photo 30-day TTL auto-delete. Added `photosDeleteAt` to Order Prisma schema; set it after delivery in generate route (best-effort, non-fatal); added `deleteExpiredReferences` to storage package; created `/api/cleanup` route with CRON_SECRET auth (both GET for Vercel Cron and POST for manual); created `vercel.json` with daily 02:00 UTC cron; added 11 unit tests. All 7 ACs satisfied. 345 pass, no new regressions.
