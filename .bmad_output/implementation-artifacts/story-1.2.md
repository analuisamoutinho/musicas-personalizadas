# Story 1.2: Supabase Storage Bucket Configuration

Status: done

GitHub Issue: [mgiovani/fotos#42](https://github.com/mgiovani/fotos/issues/42)

**NFRs covered:** NFR-09 (private buckets, signed URLs only), NFR-10 (env var isolation via `@mascotinhos/env`), NFR-11 (LGPD 30-day TTL design via DB-tracked expiry)

## Story

As the operator,
I want reference photos stored in a private TTL-enabled bucket and generated images in a separate permanent bucket,
so that client photos are automatically cleaned up for LGPD compliance while generated art is preserved indefinitely.

## Acceptance Criteria

1. **Given** a Supabase project is connected to the monorepo, **When** the `packages/storage` package is implemented, **Then** two buckets exist: `references` (private, no public access) and `generated` (private, no public access). **Prerequisite:** Both buckets MUST be created manually in the Supabase Dashboard before running tests — the code assumes they exist.

2. **Given** the storage package is implemented, **Then** it exports these typed functions:
   - `uploadReference(orderId: string, filename: string, file: Buffer | Uint8Array, mimeType: string): Promise<string>` — uploads to `references/{orderId}/{filename}`, returns storage path.
   - `uploadGenerated(orderId: string, attemptNumber: number, file: Buffer | Uint8Array): Promise<string>` — uploads to `generated/{orderId}/{attemptNumber}.png`, returns storage path.
   - `getSignedUrl(path: string): Promise<string>` — generates a time-limited signed URL (1-hour expiry) for private file access.
   - `deleteReferences(orderId: string): Promise<void>` — deletes all files under `references/{orderId}/`. Must be idempotent (safe to call even if no files exist).

3. **Given** a reference photo is uploaded, **Then** it is stored at path `references/{orderId}/{filename}`. TTL enforcement is database-driven, not storage metadata: Story 8.2's cleanup cron queries `Order WHERE createdAt < NOW() - 30 days` and calls `deleteReferences(orderId)`. No `metadata` field is passed to `upload()` — Supabase Storage JS does not support custom metadata on uploads.

4. **Given** a generated image is uploaded, **Then** it is stored at path `generated/{orderId}/{attemptNumber}.png` (permanent, no TTL).

5. **Given** a signed URL is requested, **Then** `getSignedUrl()` returns `data.signedUrl` from `createSignedUrl(path, 3600)` — valid for exactly 3600 seconds (1 hour).

6. **Given** the monorepo dependency rules, **Then** ONLY `packages/storage/src/client.ts` imports `@supabase/supabase-js` — no other package or app may import it directly.

7. **Given** the storage package is imported by other packages, **Then** it is available as `@mascotinhos/storage` with an `exports` field in `package.json`, and all public functions are re-exported from `src/index.ts`.

## Tasks / Subtasks

- [x] Create Supabase buckets as prerequisite (AC: #1)
  - [x] Log into Supabase Dashboard, create `references` bucket (private) and `generated` bucket (private)
  - [x] Confirm both buckets have "Restrict access to authenticated users" enabled (no public access)

- [x] Add `@supabase/supabase-js` to root `package.json` catalog (AC: #6)
  - [x] Add `"@supabase/supabase-js": "^2.43.0"` to `catalog` in `mascotinhos/package.json` (alongside other catalog entries like `zod`, `dotenv`)

- [x] Add Supabase env vars to `packages/env/src/server.ts` (AC: #1, #6)
  - [x] Add `SUPABASE_URL: z.string().url()` to server schema
  - [x] Add `SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)` to server schema
  - [x] Add both to `runtimeEnv`: `SUPABASE_URL: process.env.SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY`
  - [x] Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `mascotinhos/apps/web/.env` (local dev values from Supabase project settings)

- [x] Create `packages/storage` package scaffold (AC: #6, #7)
  - [x] Create `mascotinhos/packages/storage/package.json` — see exact format in Dev Notes
  - [x] Create `mascotinhos/packages/storage/tsconfig.json` extending `@mascotinhos/config/base`
  - [x] Add `"test": "bun test"` script to the new `package.json`

- [x] Implement Supabase Storage client (AC: #1, #6)
  - [x] Create `packages/storage/src/client.ts` — import path MUST be `@mascotinhos/env/server` (subpath export, not `@mascotinhos/env`)
  - [x] Export `storage` singleton (the `.storage` accessor from `createClient`)

- [x] Implement `uploadReference` (AC: #2, #3)
  - [x] Create `packages/storage/src/upload-reference.ts`
  - [x] Upload to `references/{orderId}/{filename}` with `{ contentType: mimeType, upsert: false }`
  - [x] `upsert: false` is intentional — each `{orderId}/{filename}` is unique by design; duplicates are a bug at the call site
  - [x] Throw on error (propagate Supabase error up); no silent failures
  - [x] Return the full storage path string

- [x] Implement `uploadGenerated` (AC: #2, #4)
  - [x] Create `packages/storage/src/upload-generated.ts`
  - [x] Upload to `generated/{orderId}/{attemptNumber}.png` with `{ contentType: 'image/png', upsert: false }`
  - [x] Return path string

- [x] Implement `getSignedUrl` (AC: #2, #5)
  - [x] Create `packages/storage/src/get-signed-url.ts`
  - [x] Validate path starts with `references/` or `generated/` — throw if neither (prevents silent string-parsing bugs)
  - [x] Route to correct bucket based on prefix: `references/` → `references` bucket, `generated/` → `generated` bucket
  - [x] Call `createSignedUrl(pathWithoutBucket, 3600)` and return `data.signedUrl` (not `data`)
  - [x] Throw if `error` or if `data.signedUrl` is null

- [x] Implement `deleteReferences` (AC: #2)
  - [x] Create `packages/storage/src/cleanup.ts`
  - [x] List files: `storage.from('references').list(orderId)` — lists files under `references/{orderId}/`
  - [x] If `files.length === 0`, return early (idempotent guard — already deleted or never uploaded)
  - [x] Build full paths: `files.map(f => \`${orderId}/${f.name}\`)`
  - [x] Delete: `storage.from('references').remove(paths)`
  - [x] Throw on error

- [x] Create `src/index.ts` public API (AC: #7)
  - [x] Re-export `uploadReference`, `uploadGenerated`, `getSignedUrl`, `deleteReferences`

- [x] Write co-located unit tests using `bun test` (AC: #2–#5)
  - [x] Add `"test": "bun test"` to `packages/storage/package.json` scripts
  - [x] `packages/storage/src/upload-reference.test.ts` — mock `client.ts`, assert path `references/{orderId}/{filename}`, assert `upsert: false`, assert no metadata field
  - [x] `packages/storage/src/upload-generated.test.ts` — assert path `generated/{orderId}/{attemptNumber}.png`
  - [x] `packages/storage/src/get-signed-url.test.ts` — assert bucket routing, assert 3600s expiry, assert throws on invalid path prefix
  - [x] `packages/storage/src/cleanup.test.ts` — assert idempotent empty-list early return, assert full path construction, assert remove called with correct paths

- [x] Verify package boundary enforcement (AC: #6)
  - [x] Grep entire monorepo for `@supabase/supabase-js` imports — only `packages/storage/src/client.ts` should appear

## Dev Notes

### Critical Architecture Rules (DO NOT VIOLATE)

1. **`@supabase/supabase-js` is ONLY imported in `packages/storage/src/client.ts`** — hard architecture boundary. Stories 2.5, 4.5, 8.2 import from `@mascotinhos/storage`, never supabase-js directly. [Source: architecture.md#Dependency Rules]

2. **Import path is `@mascotinhos/env/server`** (the `/server` subpath export) — NOT `@mascotinhos/env`. This is a conditional export defined in `packages/env/package.json` under `"./server"`. Using the wrong path will cause a module resolution error at runtime.

3. **`upsert: false` is intentional.** Do NOT change this to `true` "to be safe." Each `{orderId}/{filename}` is unique by design. If a client re-sends the same photo, the bot-engine layer handles deduplication before calling `uploadReference`. Retries should use a unique filename.

4. **`upload()` has NO `metadata` field.** Supabase Storage JS does not support custom metadata on uploads (only `cacheControl`, `contentType`, `upsert` are supported). TTL for reference photos is tracked via `Order.createdAt` in the database — Story 8.2's cron queries `Order WHERE createdAt < NOW() - 30 days` and calls `deleteReferences(orderId)` per result.

5. **Co-located tests** — test files live next to source files (e.g., `upload-reference.test.ts` beside `upload-reference.ts`). No top-level `tests/` directory. [Source: architecture.md#Testing Standards]

### Package Structure to Create

```
mascotinhos/packages/storage/
├── package.json            # name: @mascotinhos/storage (see exact format below)
├── tsconfig.json           # extends @mascotinhos/config/base
└── src/
    ├── client.ts           # Supabase Storage client singleton (ONLY @supabase/supabase-js import)
    ├── upload-reference.ts # uploadReference(orderId, filename, file, mimeType) -> path
    ├── upload-generated.ts # uploadGenerated(orderId, attemptNumber, file) -> path
    ├── get-signed-url.ts   # getSignedUrl(path) -> signedUrl string (3600s)
    ├── cleanup.ts          # deleteReferences(orderId) -> void (idempotent)
    ├── index.ts            # Public re-exports only
    ├── upload-reference.test.ts
    ├── upload-generated.test.ts
    ├── get-signed-url.test.ts
    └── cleanup.test.ts
```

### Exact `packages/storage/package.json` Format

Copy the pattern from `packages/db/package.json`. Key fields:

```json
{
  "name": "@mascotinhos/storage",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@mascotinhos/env": "workspace:*",
    "@supabase/supabase-js": "catalog:"
  }
}
```

**Critical:** use `"catalog:"` (not `"^2"`) for `@supabase/supabase-js` — this references the version pinned in the root `package.json` catalog. The root catalog entry to add:
```json
"catalog": {
  ...existing entries...,
  "@supabase/supabase-js": "^2.43.0"
}
```

### Files to Modify

| File | Change |
|------|--------|
| `mascotinhos/package.json` | Add `"@supabase/supabase-js": "^2.43.0"` to `catalog` object |
| `mascotinhos/packages/env/src/server.ts` | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` to schema and `runtimeEnv` |
| `mascotinhos/apps/web/.env` | Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` values |
| `mascotinhos/packages/storage/**` | Create entire package (does not exist yet) |

### Path Patterns (Exact)

| Bucket | Path Pattern | Notes |
|--------|-------------|-------|
| `references` | `references/{orderId}/{filename}` | Private, TTL tracked via DB |
| `generated` | `generated/{orderId}/{attemptNumber}.png` | Private, permanent |

### Supabase Storage API (Validated)

```typescript
// packages/storage/src/client.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '@mascotinhos/env/server'; // /server subpath is required

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
export const storage = supabase.storage;
```

```typescript
// Upload (no metadata field — intentional)
const { data, error } = await storage
  .from('references')
  .upload(path, file, { contentType: mimeType, upsert: false });
if (error) throw error;
return data.path;

// Signed URL — access data.signedUrl (not data directly)
const { data, error } = await storage
  .from(bucket)
  .createSignedUrl(pathWithinBucket, 3600);
if (error || !data?.signedUrl) throw error ?? new Error('No signed URL returned');
return data.signedUrl;

// List files in orderId folder
const { data: files, error } = await storage
  .from('references')
  .list(orderId); // lists files at references/{orderId}/
if (files?.length === 0) return; // idempotent

// Delete batch
const paths = files.map(f => `${orderId}/${f.name}`);
const { error: deleteError } = await storage.from('references').remove(paths);
if (deleteError) throw deleteError;
```

### Test Pattern (`bun test`)

The project uses **Bun's built-in test runner** (`bun test`). Import from `bun:test`, not `vitest` or `jest`.

```typescript
// packages/storage/src/upload-reference.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock the client module to isolate storage calls
const mockUpload = mock(() => Promise.resolve({ data: { path: 'references/order-1/photo.jpg' }, error: null }));
mock.module('./client', () => ({
  storage: { from: () => ({ upload: mockUpload }) },
}));

import { uploadReference } from './upload-reference';

describe('uploadReference', () => {
  it('uploads to correct path', async () => {
    const path = await uploadReference('order-1', 'photo.jpg', Buffer.from(''), 'image/jpeg');
    expect(path).toBe('references/order-1/photo.jpg');
    expect(mockUpload).toHaveBeenCalledWith(
      'references/order-1/photo.jpg',
      expect.any(Buffer),
      { contentType: 'image/jpeg', upsert: false }
    );
  });
});
```

### Dependency on Previous Story (1.1)

Story 1.1 defined:
- `Order.photosUrls` as `String[]` → populated by `uploadReference()` (returns path)
- `Generation.imageUrl` as `String` → populated by `uploadGenerated()` (returns path)
- `conversationState` and `orderStatus` as separate fields (D1 patch already applied)

Story 8.2 (TTL cleanup) will query: `prisma.order.findMany({ where: { createdAt: { lt: thirtyDaysAgo }, photosUrls: { isEmpty: false } } })` and call `deleteReferences(order.id)` per result. This story does NOT need to implement that logic — only `deleteReferences()`.

### Downstream Story Impact

| Story | Function Used |
|-------|--------------|
| 2.5 (Photo Collection) | `uploadReference()` |
| 4.5 (Generated Upload) | `uploadGenerated()` |
| 4.6 (WhatsApp Delivery) | `getSignedUrl()` |
| 8.2 (TTL Cleanup Cron) | `deleteReferences()` |

### References

- [Source: .bmad_output/planning-artifacts/epics.md#Story 1.2]
- [Source: .bmad_output/planning-artifacts/architecture.md#Supabase Storage Configuration]
- [Source: .bmad_output/planning-artifacts/architecture.md#Dependency Rules]
- [Source: .bmad_output/planning-artifacts/architecture.md#File Structure]
- [Source: .bmad_output/planning-artifacts/prd.md#FR-10, FR-26, FR-46, FR-48, NFR-09, NFR-10, NFR-11]
- [Source: .bmad_output/implementation-artifacts/story-1.1.md — schema defines Order.photosUrls, Generation.imageUrl]
- [Source: Supabase Storage JS v2 API — upload() supports only cacheControl/contentType/upsert; no metadata field]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- bun test initially failed for `cleanup.test.ts` because Bun's `mock.module` hoisting didn't intercept `client.ts → @mascotinhos/env/server` when cleanup.test.ts ran first (alphabetically). Fixed by adding `bunfig.toml` with a preload script (`src/test-setup.ts`) that sets minimum env vars before any test module loads. All 17 tests now pass.

### Completion Notes List

- Created `packages/storage` monorepo package with typed public API: `uploadReference`, `uploadGenerated`, `getSignedUrl`, `deleteReferences`.
- `@supabase/supabase-js` import is strictly isolated to `packages/storage/src/client.ts` (grep confirmed — 1 file).
- All four functions follow the Supabase Storage JS v2 API with intentional `upsert: false` and no `metadata` field (not supported by supabase-js uploads).
- `getSignedUrl` validates path prefix and routes to correct bucket; returns `data.signedUrl` (not `data`) for 3600s expiry.
- `deleteReferences` is idempotent: returns early when file list is empty or null.
- Added `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `packages/env/src/server.ts` schema and `apps/web/.env`.
- Added `@supabase/supabase-js: ^2.43.0` to root Bun catalog.
- 17 unit tests across 4 co-located test files; all pass.

### File List

- mascotinhos/package.json (modified — added `@supabase/supabase-js` to catalog)
- mascotinhos/packages/env/src/server.ts (modified — added SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- mascotinhos/apps/web/.env (modified — added SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- mascotinhos/packages/storage/package.json (created)
- mascotinhos/packages/storage/tsconfig.json (created)
- mascotinhos/packages/storage/bunfig.toml (created)
- mascotinhos/packages/storage/src/client.ts (created)
- mascotinhos/packages/storage/src/upload-reference.ts (created)
- mascotinhos/packages/storage/src/upload-generated.ts (created)
- mascotinhos/packages/storage/src/get-signed-url.ts (created)
- mascotinhos/packages/storage/src/cleanup.ts (created)
- mascotinhos/packages/storage/src/index.ts (created)
- mascotinhos/packages/storage/src/test-setup.ts (created)
- mascotinhos/packages/storage/src/upload-reference.test.ts (created)
- mascotinhos/packages/storage/src/upload-generated.test.ts (created)
- mascotinhos/packages/storage/src/get-signed-url.test.ts (created)
- mascotinhos/packages/storage/src/cleanup.test.ts (created)

### Review Findings

- [x] [Review][Patch] Upload path includes bucket prefix, causing `getSignedUrl` and `deleteReferences` to reference wrong object keys in Supabase [`upload-reference.ts:9`, `upload-generated.ts:8`, `cleanup.ts:4`, `get-signed-url.ts:17`] — fixed: upload path is now `orderId/filename`, return prepends bucket prefix
- [x] [Review][Patch] `deleteReferences` silently truncates at 100 files — Supabase `list()` default limit, LGPD cleanup broken for orders with 100+ photos [`cleanup.ts:4`] — fixed: added `{ limit: 1000 }` to list call
- [x] [Review][Patch] Test mocks do not assert bucket name passed to `from()` — regression could change bucket silently [`cleanup.test.ts`, `upload-reference.test.ts`, `upload-generated.test.ts`] — fixed: added `mockFrom` spy with `toHaveBeenCalledWith('references'/'generated')` assertions
- [x] [Review][Defer] Module-level Supabase singleton initialized at import time [`client.ts:4`] — deferred, pre-existing pattern (env package uses same approach)
- [x] [Review][Defer] `upsert: false` provides no "already exists" signal to caller [`upload-reference.ts:12`, `upload-generated.ts:11`] — deferred, intentional per spec
- [x] [Review][Defer] Signed URL TTL (3600s) may expire before WhatsApp delivery retry [`get-signed-url.ts:19`] — deferred, beyond story scope
- [x] [Review][Defer] No filename/orderId sanitization — path injection possible [`upload-reference.ts:9`] — deferred, caller responsibility (Story 2.5)
- [x] [Review][Defer] No retry logic on transient Supabase network errors — deferred, beyond story scope
- [x] [Review][Defer] `uploadGenerated` hardcodes `image/png` content type regardless of AI output [`upload-generated.ts:10`] — deferred, spec intent
- [x] [Review][Defer] No file size validation before upload — deferred, caller responsibility
- [x] [Review][Defer] Concurrent uploads for same `orderId/filename` with `upsert: false` — deferred, intentional (caller deduplicates)
- [x] [Review][Defer] `mock.module` hoisting order is fragile in Bun — deferred, handled by `bunfig.toml` preload

## Change Log

- 2026-03-28: Implemented `@mascotinhos/storage` package — Supabase Storage client with `uploadReference`, `uploadGenerated`, `getSignedUrl`, `deleteReferences`; added env vars to schema and .env; 17 unit tests passing (claude-sonnet-4-6)
