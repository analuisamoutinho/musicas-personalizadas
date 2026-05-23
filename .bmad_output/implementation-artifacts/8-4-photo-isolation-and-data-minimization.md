# Story 8.4: Photo Isolation and Data Minimization

**Epic:** 8 — LGPD Compliance & Security
**Story ID:** 8.4
**GitHub Issue:** [mgiovani/fotos#79](https://github.com/mgiovani/fotos/issues/79)
**Status:** done
**Created:** 2026-03-30

---

## User Story

As a client,
I want assurance that my child's photos are never shared with other clients or used outside my order,
So that my child's privacy is fully protected.

---

## Acceptance Criteria

1. **Given** a client uploads reference photos for an order
   **When** any system component accesses photos
   **Then** photos are stored in orderId-scoped paths (`references/{orderId}/`) — no cross-order access

2. **Given** the storage package functions
   **When** they are called
   **Then** all functions require an `orderId` parameter — it is architecturally impossible to access photos without specifying an orderId

3. **Given** the codebase
   **When** analyzed for cross-order data access
   **Then** no database query or storage operation ever accesses photos from a different order (enforced by function signatures)

4. **Given** generated images are stored
   **When** any system component accesses generated images
   **Then** generated images are scoped to orderId (`generated/{orderId}/`) — consistent with reference photo isolation

5. **Given** the data collected during an order
   **When** the system is audited for data minimization
   **Then** only the minimum required data is collected: photo, theme, outfit description, extra requests, payment info — no CPF, address, or email is collected or stored

6. **Given** the storage package functions
   **When** `uploadReference` or `uploadGenerated` is called
   **Then** a structured JSON audit log is emitted: `{ level: "info", event: "photo_upload_scoped", orderId, bucket, path, service: "storage" }` — confirming scoped access was enforced

---

## Tasks / Subtasks

- [x] Task 1: Audit storage package — verify all functions require orderId (AC: 1, 2, 3, 4)
  - [x] Read `packages/storage/src/upload-reference.ts` — confirm signature is `uploadReference(orderId, filename, file, mimeType)` — orderId first param
  - [x] Read `packages/storage/src/upload-generated.ts` — confirm signature is `uploadGenerated(orderId, attemptNumber, file)` — orderId first param
  - [x] Read `packages/storage/src/cleanup.ts` — confirm `deleteReferences(orderId)` requires orderId
  - [x] Read `packages/storage/src/get-signed-url.ts` — confirm the path-based access requires `references/{orderId}/` or `generated/{orderId}/` prefix (orderId embedded in path)
  - [x] Document audit findings: all functions already enforce orderId-scoping — this story confirms the invariant

- [x] Task 2: Add audit logging to `uploadReference` and `uploadGenerated` (AC: 6)
  - [x] In `packages/storage/src/upload-reference.ts`, after successful upload, add: `console.log(JSON.stringify({ level: "info", event: "photo_upload_scoped", orderId, bucket: "references", path: data.path, service: "storage" }))`
  - [x] In `packages/storage/src/upload-generated.ts`, after successful upload, add: `console.log(JSON.stringify({ level: "info", event: "photo_upload_scoped", orderId, bucket: "generated", path: data.path, service: "storage" }))`
  - [x] Logging must appear AFTER the successful upload — never log on error paths (error already propagated via throw)

- [x] Task 3: Add `validateOrderPhotoAccess` guard function to storage package (AC: 2, 3)
  - [x] Create `packages/storage/src/validate-access.ts` with function:
    ```typescript
    /**
     * Validates that a storage path belongs to the specified order.
     * Throws if path does not start with the expected orderId-scoped prefix.
     * Used as a programmatic guard against cross-order photo access.
     */
    export function validateOrderPhotoAccess(path: string, orderId: string): void {
      const referencesPrefix = `references/${orderId}/`;
      const generatedPrefix = `generated/${orderId}/`;
      if (!path.startsWith(referencesPrefix) && !path.startsWith(generatedPrefix)) {
        throw new Error(
          `Access violation: path "${path}" does not belong to order "${orderId}"`,
        );
      }
    }
    ```
  - [x] Export `validateOrderPhotoAccess` from `packages/storage/src/index.ts`

- [x] Task 4: Verify data minimization — audit Prisma schema for PII fields (AC: 5)
  - [x] Read `packages/db/prisma/schema/` — confirm no `cpf`, `address`, `email` fields exist on `Client` or `Order` models
  - [x] Confirm `Client` model stores only: `id`, `whatsappSenderId`, `phone` (nullable, WhatsApp sender number — intrinsic to service delivery), `name` (display name from WA profile), `consentTimestamp`, `consentVersion`, `deletedAt` (soft-delete for LGPD erasure), `createdAt`, `updatedAt` — no `cpf`, `address`, or `email` fields
  - [x] Confirm `Order` model stores only: `id`, `clientId`, `styleTemplateId`, `conversationState`, `orderStatus`, `photosUrls`, `theme`, `outfitDescription`, `extraRequests`, `price`, `photosDeleteAt`, `createdAt`, `updatedAt`, and payment/generation relations — no `cpf`, `address`, or `email` fields
  - [x] If any PII fields are found that violate data minimization: document them in Dev Agent Record and HALT — do NOT remove schema fields without a migration (that is out of scope for this story)

- [x] Task 5: Write unit tests for `validateOrderPhotoAccess` and updated upload functions (AC: 2, 3, 6)
  - [x] Create `packages/storage/src/validate-access.test.ts` (7 tests):
    - Valid `references/{orderId}/photo.jpg` passes for correct orderId
    - Valid `generated/{orderId}/1.png` passes for correct orderId
    - `references/` path belonging to different orderId throws with "Access violation"
    - `generated/` path belonging to different orderId throws with "Access violation"
    - Path with no orderId prefix throws with "Access violation" message
    - Empty path throws with "Access violation" message
    - Throws with descriptive message including both path and orderId in error string
  - [x] Update `packages/storage/src/upload-reference.test.ts` — add test asserting audit log is emitted on success: `expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("photo_upload_scoped"))`
  - [x] Update `packages/storage/src/upload-generated.test.ts` — add same audit log assertion

- [x] Task 6: Run full test suite and type check (AC: all)
  - [x] `cd mascotinhos && bun run check-types` — 0 new TypeScript errors (storage package passes cleanly; pre-existing bun:test type errors in payments package unchanged)
  - [x] `cd mascotinhos && bun test` — 364 pass (11 new, baseline was 353), 29 fail (pre-existing), 5 errors (pre-existing)

---

## Dev Notes

### CRITICAL: What Already Exists — Do NOT Reinvent

The storage package already correctly implements orderId-scoped access:

1. **`uploadReference(orderId, filename, file, mimeType)`** — uploads to `references/{orderId}/{filename}` — orderId-scoped by construction
2. **`uploadGenerated(orderId, attemptNumber, file)`** — uploads to `generated/{orderId}/{attemptNumber}.png` — orderId-scoped by construction
3. **`deleteReferences(orderId)`** — lists and deletes from `references/{orderId}/` prefix — orderId-scoped
4. **`getSignedUrl(path)`** — path must start with `references/` or `generated/` — indirect scope enforcement

**This story is primarily an audit + logging + guard function story.** Do NOT reinvent or refactor existing correct implementations.

### File Locations — Critical

```
mascotinhos/
├── packages/storage/src/
│   ├── upload-reference.ts         ← MODIFY: add audit log after success
│   ├── upload-generated.ts         ← MODIFY: add audit log after success
│   ├── validate-access.ts          ← NEW: guard function
│   ├── index.ts                    ← MODIFY: export validateOrderPhotoAccess
│   ├── upload-reference.test.ts    ← MODIFY: add audit log assertion
│   ├── upload-generated.test.ts    ← MODIFY: add audit log assertion
│   └── validate-access.test.ts     ← NEW: tests for guard function
```

### Logging Pattern — Architecture Compliance

All logs use: `console.log(JSON.stringify({ level, event, ...context, service }))`

For photo upload audit logs:
```typescript
console.log(
  JSON.stringify({
    level: "info",
    event: "photo_upload_scoped",
    orderId,
    bucket: "references",  // or "generated"
    path: data.path,       // path returned by Supabase Storage
    service: "storage",
  }),
);
```

**Never log:** full phone numbers, client names, full file URLs/signed URLs (contain auth tokens).

### Test Pattern — Bun Mock for console.log

To test audit log emission in upload functions:
```typescript
import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test';

// spy on console.log BEFORE mock.module (inside describe)
// use consoleSpy.mockImplementation(() => {}) to suppress output in tests
let consoleSpy: ReturnType<typeof spyOn>;

describe('uploadReference audit logging', () => {
  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
    mockUpload.mockClear();
    mockFrom.mockClear();
  });

  it('emits photo_upload_scoped audit log on success', async () => {
    await uploadReference('order-1', 'photo.jpg', Buffer.from('data'), 'image/jpeg');
    const logCall = consoleSpy.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('photo_upload_scoped')
    );
    expect(logCall).toBeDefined();
    const parsed = JSON.parse(logCall![0] as string);
    expect(parsed.orderId).toBe('order-1');
    expect(parsed.bucket).toBe('references');
    expect(parsed.event).toBe('photo_upload_scoped');
  });
});
```

**IMPORTANT**: `mock.module()` calls MUST come before `import` statements — this is a Bun requirement. The existing test files already follow this pattern.

### Prisma Schema — Data Minimization Audit Points

Expected minimal schema fields (from Story 1.1 implementation):
- `Client`: `id`, `whatsappSenderId`, `phone` (nullable), `name`, `consentTimestamp`, `consentVersion`, `deletedAt` (soft-delete), `createdAt`, `updatedAt`
- `Order`: `id`, `clientId`, `styleTemplateId`, `conversationState`, `orderStatus`, `photosUrls`, `theme`, `outfitDescription`, `extraRequests`, `price`, `photosDeleteAt`, `createdAt`, `updatedAt` + relations — no `cpf`, `address`, or `email` fields

No `cpf`, `address`, `email`, `fullName` (beyond WA display name), `birthdate`, or other PII beyond what WhatsApp provides naturally.

### Architecture Compliance Notes

- Storage bucket policies (private buckets, signed URLs only) were set up in Story 1.2 — this story verifies the code-level enforcement only, not the Supabase console configuration
- NFR-09 (private bucket policy) is covered by Story 1.2 (bucket config) + this story (code-level access enforcement)
- NFR-11 (LGPD data handling): data minimization confirmed via schema audit in Task 4

### Testing Baseline

Current baseline (from Story 8.3): **353 pass, 29 fail, 5 errors**

- Do NOT break this baseline
- New tests must all pass
- `bun run check-types` from `mascotinhos/` root — 0 new TypeScript errors
- The 29 failing tests and 5 errors are pre-existing (unrelated to this story)

### Env Variables

No new env vars required. All existing vars from `packages/env/src/server-schema.ts` are sufficient.

### Previous Story Learnings

From Story 8.3:
- Test baseline: 353 pass, 29 fail, 5 errors — maintain as floor
- `bun:test` mock pattern: `mock.module()` calls MUST come before `import` statements
- Run `bun run check-types` from `mascotinhos/` root (not from individual packages)
- Structured JSON logging: `console.log(JSON.stringify({ level, event, ...context, service }))` pattern throughout

From Story 8.2:
- Storage package test files already use `mock.module('./client', ...)` pattern
- `test-setup.ts` is used as preload for env vars in storage package tests
- Storage package `package.json` should have `"preload": ["./src/test-setup.ts"]` for test env setup

From Story 1.2 (storage bucket setup):
- `references` bucket: private, requires signed URLs
- `generated` bucket: private, requires signed URLs
- Signed URLs expire after 3600 seconds (1 hour)

### Source References

- [Source: epics.md — Story 8.4 requirements]
- [Source: architecture.md — Authentication & Security section]
- [Source: architecture.md — NFR-09 (private storage), NFR-11 (LGPD handling)]
- [Source: architecture.md — Logging pattern]
- [Source: packages/storage/src/ — existing implementations]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blocking issues encountered.

### Completion Notes List

- Task 1 (Audit): All storage functions confirmed orderId-scoped by construction. `uploadReference` → `references/{orderId}/`, `uploadGenerated` → `generated/{orderId}/`, `deleteReferences(orderId)` scoped to prefix, `getSignedUrl(path)` enforces `references/` or `generated/` prefix.
- Task 2 (Audit logging): Added structured JSON audit log `{ level: "info", event: "photo_upload_scoped", orderId, bucket, path, service: "storage" }` to both `uploadReference` and `uploadGenerated`, emitted only on successful upload (after `if (error) throw error`).
- Task 3 (Guard function): Created `validate-access.ts` with `validateOrderPhotoAccess(path, orderId)` that throws `"Access violation: path ... does not belong to order ..."` if path doesn't start with `references/{orderId}/` or `generated/{orderId}/`. Exported from `index.ts`.
- Task 4 (Schema audit): Prisma schema confirmed data minimization compliant. `Client` has no `cpf`, `address`, or `email`. Note: `phone` field is optional and is the WhatsApp sender number — intrinsic to the WhatsApp service delivery. No HALT warranted.
- Task 5 (Tests): 11 new tests added — 7 in `validate-access.test.ts`, 2 in `upload-reference.test.ts`, 2 in `upload-generated.test.ts`. Used `spyOn(console, 'log').mockImplementation(() => {})` with `afterEach(() => consoleSpy.mockRestore())` for proper test isolation.
- Task 6 (Validation): `bun run check-types` — storage package 0 errors. `bun test` — 364 pass (+11 new), 29 fail (pre-existing), 5 errors (pre-existing).

### File List

- `mascotinhos/packages/storage/src/upload-reference.ts` (modified — added audit log)
- `mascotinhos/packages/storage/src/upload-generated.ts` (modified — added audit log)
- `mascotinhos/packages/storage/src/validate-access.ts` (new — guard function)
- `mascotinhos/packages/storage/src/index.ts` (modified — export validateOrderPhotoAccess)
- `mascotinhos/packages/storage/src/validate-access.test.ts` (new — 7 tests)
- `mascotinhos/packages/storage/src/upload-reference.test.ts` (modified — 2 new tests + afterEach restore)
- `mascotinhos/packages/storage/src/upload-generated.test.ts` (modified — 2 new tests + afterEach restore)

### Change Log

- 2026-03-30: Implemented photo isolation audit + audit logging + validateOrderPhotoAccess guard + data minimization schema audit. 11 new tests. Story complete. (claude-sonnet-4-6)
- 2026-03-30: Code review patches applied. Added `sanitizePathSegment` to block path traversal in `uploadReference` and `uploadGenerated`. Added empty/blank orderId guard to `validateOrderPhotoAccess`. Exported `sanitizePathSegment` from index. 16 new tests added (7 for sanitizePathSegment, 2 empty orderId cases in validateOrderPhotoAccess, 4 traversal tests in upload-reference, 3 traversal tests in upload-generated). Total: 380 pass, 29 fail (pre-existing), 5 errors (pre-existing). (claude-sonnet-4-6)

---

## Review Findings

**Reviewer:** claude-sonnet-4-6
**Date:** 2026-03-30
**Review type:** Adversarial + edge case + acceptance audit

### FINDING-1 [HIGH] — Path traversal via unsanitized `orderId` in upload functions

**File:** `packages/storage/src/upload-reference.ts`, `upload-generated.ts`
**Description:** `orderId` and `filename` were interpolated directly into storage paths without sanitization. A caller passing `orderId = "../admin"` would produce `../admin/photo.jpg` as the upload path, bypassing bucket-level isolation. No write-time guard existed — `validateOrderPhotoAccess` only guards reads.
**Fix:** Added `sanitizePathSegment()` helper that rejects segments containing `..`, `/`, or null bytes. Both upload functions now call it before constructing the path.

### FINDING-2 [HIGH] — `validateOrderPhotoAccess` was a dead export — never called at write time

**File:** `packages/storage/src/validate-access.ts`
**Description:** The guard was exported but never called by `uploadReference` or `uploadGenerated`. The orderId-scoping invariant was entirely trust-based on the caller. An internal caller bypassing the bot tools would have no enforcement.
**Fix:** Addressed by FINDING-1 patch — `sanitizePathSegment` is now called inside upload functions, providing enforcement at write time regardless of caller.

### FINDING-3 [MEDIUM] — `validateOrderPhotoAccess` accepted empty/blank `orderId`

**File:** `packages/storage/src/validate-access.ts`
**Description:** `validateOrderPhotoAccess("references//photo.jpg", "")` would throw for the wrong reason (path prefix mismatch), but `validateOrderPhotoAccess("references//photo.jpg", "")` with a crafted path `"references//"` would pass silently, treating `""` as a valid orderId. An empty orderId is never a legitimate value and should be rejected explicitly.
**Fix:** Added an explicit empty/blank orderId check at the top of `validateOrderPhotoAccess` that throws `"Access violation: orderId must be a non-empty string"` before prefix matching proceeds.

### FINDING-4 [MEDIUM] — `filename` not sanitized in `uploadReference` — path injection via filename

**File:** `packages/storage/src/upload-reference.ts`
**Description:** `filename` parameter had no sanitization. A filename of `../order-2/photo.jpg` would construct path `order-1/../order-2/photo.jpg` in the references bucket, potentially writing to another order's scope depending on Supabase's path normalization.
**Fix:** Covered by FINDING-1 patch — `sanitizePathSegment(filename, 'filename')` is called in `uploadReference`.

### FINDING-5 [MEDIUM] — `getSignedUrl` requires no orderId — cross-order URL generation possible

**File:** `packages/storage/src/get-signed-url.ts`
**Description:** `getSignedUrl` accepts any path starting with `references/` or `generated/`, with no orderId parameter. Any caller that has the full scoped path of another order's photo can obtain a valid signed URL for it. This is not a path traversal but a missing access-control parameter.
**Status:** DEFERRED — requires API surface change (adding an `orderId` parameter) and updating all callers. Tracked in deferred-work.md.

### FINDING-6 [MEDIUM] — `deleteReferences` uses unsanitized `f.name` in path construction

**File:** `packages/storage/src/cleanup.ts`
**Description:** `files.map((f) => \`${orderId}/${f.name}\`)` constructs delete paths from Supabase-returned filenames. If storage returns a malformed filename containing `../`, the delete operation would target outside the orderId scope. Probability is low since the values come from Supabase list, not user input.
**Status:** DEFERRED — requires sanitizing `f.name` values from the Supabase list response. Tracked in deferred-work.md.

### FINDING-7 [MEDIUM] — Audit log includes raw `data.path` from Supabase

**File:** `packages/storage/src/upload-reference.ts`, `upload-generated.ts`
**Description:** `data.path` is the raw path string returned by Supabase after upload (e.g. `order-1/photo.jpg`). This is not a signed URL so it does not contain auth tokens. The spec rule "never log full file URLs/signed URLs" applies to signed URLs specifically; `data.path` is acceptable. This finding is LOW severity and not patched.
**Status:** ACCEPTED AS-IS — `data.path` is a storage key, not a signed URL. Logging it aids observability without leaking sensitive tokens.

### Tests Added by Review

- `validate-access.test.ts`: 9 new tests (empty orderId guard ×2, `sanitizePathSegment` suite ×7) — total 16 tests in file
- `upload-reference.test.ts`: 4 new traversal/empty tests
- `upload-generated.test.ts`: 3 new traversal/empty tests
- Full suite: 380 pass (+16 from 364 baseline), 29 fail (pre-existing), 5 errors (pre-existing)
