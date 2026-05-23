# Story 1.3: Environment Variable Validation

Status: done

GitHub Issue: [mgiovani/fotos#43](https://github.com/mgiovani/fotos/issues/43)

**NFRs covered:** NFR-10 (env vars as Vercel env vars, never committed)

## Story

As a developer,
I want all required environment variables validated at startup with Zod schemas,
so that the application fails fast with clear error messages instead of crashing at runtime with cryptic errors.

## Acceptance Criteria

1. **Given** the `packages/env` package exists from the starter template, **When** the Zod validation schemas are extended with all project-required variables, **Then** the server schema validates: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET`, `WHATSAPP_WEBHOOK_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `VERCEL_URL`, `OPERATOR_WHATSAPP_NUMBER`, and optional `ASAAS_SPLIT_WALLET_ID`.

2. **Given** the client env schema exists, **When** it is extended, **Then** the client schema validates: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_WHATSAPP_NUMBER`.

3. **Given** any required variable is missing or malformed, **When** the app imports `@mascotinhos/env/server` or `@mascotinhos/env/web`, **Then** the app crashes on import with a descriptive Zod error showing which variable failed and why.

4. **Given** a new developer joins the project, **When** they look at `mascotinhos/.env.example`, **Then** they find all required variables documented with placeholder values and comments explaining each one.

5. **Given** the monorepo package boundary rules, **When** any package needs environment variables, **Then** only `packages/env` reads `process.env` — all other packages import from `@mascotinhos/env/server` or `@mascotinhos/env/web`.

## Tasks / Subtasks

- [x] Extend server schema in `packages/env/src/server.ts` (AC: #1, #3)
  - [x] Add `DATABASE_URL: z.string().url()` (upgrade from `.min(1)`)
  - [x] Add `DIRECT_URL: z.string().url()` (new — Prisma direct connection)
  - [x] Keep `SUPABASE_URL: z.string().url()` (already exists)
  - [x] Keep `SUPABASE_SERVICE_ROLE_KEY: z.string().min(1)` (already exists)
  - [x] Add `OPENAI_API_KEY: z.string().startsWith("sk-")` (new)
  - [x] Add `ASAAS_API_KEY: z.string().min(1)` (new)
  - [x] Add `ASAAS_WEBHOOK_SECRET: z.string().min(1)` (new)
  - [x] Add `WHATSAPP_WEBHOOK_TOKEN: z.string().min(1)` (new)
  - [x] Add `WHATSAPP_PHONE_NUMBER_ID: z.string().min(1)` (new)
  - [x] Add `WHATSAPP_ACCESS_TOKEN: z.string().min(1)` (new)
  - [x] Add `QSTASH_TOKEN: z.string().min(1)` (new)
  - [x] Add `QSTASH_CURRENT_SIGNING_KEY: z.string().min(1)` (new)
  - [x] Add `QSTASH_NEXT_SIGNING_KEY: z.string().min(1)` (new)
  - [x] Add `VERCEL_URL: z.string().min(1)` (new)
  - [x] Add `OPERATOR_WHATSAPP_NUMBER: z.string().regex(/^\d+$/)` (new)
  - [x] Add `ASAAS_SPLIT_WALLET_ID: z.string().optional()` (new, optional)
  - [x] Remove `CORS_ORIGIN` (not in architecture spec — leftover from starter)
  - [x] Keep `NODE_ENV` with `.default("development")` (useful, harmless)

- [x] Extend client schema in `packages/env/src/web.ts` (AC: #2, #3)
  - [x] Add `NEXT_PUBLIC_SUPABASE_URL: z.string().url()` to the `client` object
  - [x] Add `NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d+$/)` to the `client` object
  - [x] Wire both to `runtimeEnv` with `process.env.NEXT_PUBLIC_*` entries

- [x] Create `mascotinhos/.env.example` (AC: #4)
  - [x] Document every server variable with placeholder and comment
  - [x] Document every client variable with placeholder and comment
  - [x] Group by service (Supabase, OpenAI, Asaas, WhatsApp, QStash, Vercel, Operator)

- [x] Write co-located unit tests using `bun test` (AC: #1, #2, #3)
  - [x] Create `packages/env/src/server.test.ts` — test that missing required vars throw, malformed `OPENAI_API_KEY` (no `sk-` prefix) throws, valid env passes, optional `ASAAS_SPLIT_WALLET_ID` can be omitted
  - [x] Create `packages/env/src/web.test.ts` — test that missing `NEXT_PUBLIC_*` vars throw, valid client env passes, phone number regex rejects non-digits

- [x] Add `"test": "bun test"` to `packages/env/package.json` if not present (AC: #1)

- [x] Update `packages/storage/src/test-setup.ts` preload (side-effect fix)
  - [x] Remove `process.env['CORS_ORIGIN']` line (no longer in schema)
  - [x] Add ALL new required server env vars with test placeholder values (so storage tests don't crash when `@mascotinhos/env/server` is imported transitively)

## Dev Notes

### Current State of `packages/env`

The package already exists from the starter template + Story 1.2 modifications:

**`packages/env/src/server.ts` (current):**
- Uses `@t3-oss/env-core` `createEnv` (NOT raw `z.object().parse()`)
- Already has: `DATABASE_URL` (as `.min(1)` — upgrade to `.url()`), `CORS_ORIGIN` (remove), `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Uses `runtimeEnv: process.env` and `emptyStringAsUndefined: true`
- Has `import "dotenv/config"` at top for local dev

**`packages/env/src/web.ts` (current):**
- Uses `@t3-oss/env-nextjs` `createEnv`
- Empty `client: {}` and `runtimeEnv: {}`

**`packages/env/package.json`:**
- Exports: `"./server": "./src/server.ts"`, `"./web": "./src/web.ts"`
- Dependencies: `@t3-oss/env-core`, `@t3-oss/env-nextjs`, `dotenv`, `zod`

### Critical Architecture Rules (DO NOT VIOLATE)

1. **Keep using `@t3-oss/env-core` `createEnv`** — do NOT replace with raw `z.object().parse()`. The architecture doc shows a simplified example, but the actual codebase uses `@t3-oss/env-core` which provides better error messages and Next.js integration. The `createEnv` function already validates at import time (fail-fast behavior).

2. **Keep `import "dotenv/config"` at top of `server.ts`** — this loads `.env` files in local dev. Without it, env vars are undefined when running `bun test` or `bun run dev` locally.

3. **Import path is `@mascotinhos/env/server`** — the `/server` subpath export, NOT `@mascotinhos/env`. Other packages already use this import path (Story 1.2 established this). [Source: story-1.2.md#Critical Architecture Rules]

4. **`CORS_ORIGIN` should be removed** — it was part of the starter template but is NOT listed in the architecture spec's env vars. The project uses webhook handlers, not a REST API with CORS. If it breaks existing code in `apps/web`, check if anything imports it — if yes, remove the consumer too (the starter AI example is being replaced).

5. **`OPENAI_API_KEY` must validate with `.startsWith("sk-")`** — explicitly stated in the architecture spec and epics acceptance criteria. [Source: architecture.md#Environment Variable Pattern]

6. **Phone numbers validate with regex `/^\d+$/`** — `OPERATOR_WHATSAPP_NUMBER` and `NEXT_PUBLIC_WHATSAPP_NUMBER` must be digit-only strings (no `+` prefix, no spaces). [Source: architecture.md#Environment Variable Pattern, epics.md#Story 1.3]

7. **`ASAAS_SPLIT_WALLET_ID` is the ONLY optional variable** — all other server vars are required and will crash the app if missing.

8. **`runtimeEnv` in `@t3-oss/env-core`** — use `runtimeEnv: process.env` (pass the whole object). This is the current pattern. For `@t3-oss/env-nextjs` (web.ts), you need to explicitly map: `runtimeEnv: { NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, ... }`.

9. **Co-located tests** — test files live next to source files (`server.test.ts` beside `server.ts`). No top-level `tests/` directory. [Source: architecture.md#Test Organization]

10. **Cascading validation: every package importing `@mascotinhos/env/server` will now validate ALL server vars.** Currently `packages/db` and `packages/storage` both import from `@mascotinhos/env/server`. After extending the schema, running `bun run db:push`, `bun test` in storage, or any command that triggers env import will fail unless ALL required vars are set. This is by design (fail-fast), but: (a) `.env.example` must be comprehensive so developers can copy it, (b) `packages/storage/src/test-setup.ts` must set ALL vars, (c) the `.env.local` or `.env` file used in dev must have all vars too (placeholder values are fine for unused services during early development).

11. **Do NOT add `GOOGLE_GENERATIVE_AI_API_KEY`** — the current `apps/web/src/app/api/ai/route.ts` uses `@ai-sdk/google` which reads this env var implicitly. This is a starter template remnant. The architecture specifies OpenAI (not Google) for the production bot. This route will be replaced in Epic 2.

### Testing Strategy

Testing `createEnv` validation requires careful mocking because `createEnv` reads `process.env` at module load time. Approaches:

**Option A (Recommended): Test the Zod schemas directly.** Extract the Zod schema record into a named export, then test it with `z.object(schema).safeParse()` without needing to mock `createEnv` or `process.env`. The `createEnv` wrapper uses the same Zod validation internally — testing the schema record validates the same logic.

```typescript
// In server.ts, export the schema record for testing:
export const serverSchemaSpec = {
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  // ... all other fields ...
} as const;

// Then pass it to createEnv:
export const env = createEnv({
  server: serverSchemaSpec,
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

// In server.test.ts:
import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { serverSchemaSpec } from './server';

const schema = z.object(serverSchemaSpec);

describe('server env schema', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
    SUPABASE_URL: 'https://xxx.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    OPENAI_API_KEY: 'sk-test-key-123',
    ASAAS_API_KEY: 'test-key',
    ASAAS_WEBHOOK_SECRET: 'test-secret',
    WHATSAPP_WEBHOOK_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    QSTASH_TOKEN: 'test-token',
    QSTASH_CURRENT_SIGNING_KEY: 'sig_test',
    QSTASH_NEXT_SIGNING_KEY: 'sig_test',
    VERCEL_URL: 'https://app.vercel.app',
    OPERATOR_WHATSAPP_NUMBER: '5511999999999',
    NODE_ENV: 'test',
  };

  it('accepts valid env', () => {
    expect(schema.safeParse(validEnv).success).toBe(true);
  });

  it('rejects OPENAI_API_KEY without sk- prefix', () => {
    const result = schema.safeParse({ ...validEnv, OPENAI_API_KEY: 'bad-key' });
    expect(result.success).toBe(false);
  });

  it('allows optional ASAAS_SPLIT_WALLET_ID', () => {
    expect(schema.safeParse(validEnv).success).toBe(true); // omitted = OK
    expect(schema.safeParse({ ...validEnv, ASAAS_SPLIT_WALLET_ID: 'wallet123' }).success).toBe(true);
  });

  it('rejects non-digit OPERATOR_WHATSAPP_NUMBER', () => {
    const result = schema.safeParse({ ...validEnv, OPERATOR_WHATSAPP_NUMBER: '+55-11-999' });
    expect(result.success).toBe(false);
  });
});
```

**IMPORTANT:** The test file MUST NOT import `./server` directly at top level (that triggers `createEnv` which reads real `process.env`). Only import the schema spec. If using a default import on `server.ts` is unavoidable, use dynamic `import()` after setting up `process.env` in the test. But the schema-only approach avoids this entirely.

**Option B: Mock `process.env` before dynamic import.** Set `process.env` values, then dynamically import the module. This is fragile with Bun's module caching.

Use Option A — it is simpler and more reliable.

### `.env.example` Format

```
# Supabase (Database + Storage)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (AI SDK - conversation + image generation)
OPENAI_API_KEY=sk-...

# Asaas (PIX payments)
ASAAS_API_KEY=your_asaas_api_key
ASAAS_WEBHOOK_SECRET=your_asaas_webhook_secret
ASAAS_SPLIT_WALLET_ID=  # Optional: partner wallet ID for payment split

# WhatsApp Business API (Chat SDK)
WHATSAPP_WEBHOOK_TOKEN=your_webhook_verification_token
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token

# Upstash QStash (async job queue)
QSTASH_TOKEN=your_qstash_token
QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...

# Vercel
VERCEL_URL=https://your-app.vercel.app

# Operator
OPERATOR_WHATSAPP_NUMBER=5511999999999

# Node
NODE_ENV=development

# Client-side (prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999
```

### Files to Modify

| File | Change |
|------|--------|
| `mascotinhos/packages/env/src/server.ts` | Extend schema with all server env vars; remove `CORS_ORIGIN` |
| `mascotinhos/packages/env/src/web.ts` | Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_WHATSAPP_NUMBER` |
| `mascotinhos/packages/env/package.json` | Add `"test": "bun test"` script if missing |
| `mascotinhos/.env.example` | Create with all variables documented |
| `mascotinhos/packages/env/src/server.test.ts` | Create unit tests for server schema |
| `mascotinhos/packages/env/src/web.test.ts` | Create unit tests for client schema |
| `mascotinhos/packages/storage/src/test-setup.ts` | Update preload: remove `CORS_ORIGIN`, add all new required server env vars |

### Files to Check / Modify (side effects of this story)

| File | Why | Action |
|------|-----|--------|
| `mascotinhos/packages/storage/src/test-setup.ts` | Sets `process.env['CORS_ORIGIN']` for test preload — will be stale after `CORS_ORIGIN` removal; new required vars must be added | **MUST update**: remove `CORS_ORIGIN`, add ALL new required server env vars with test placeholder values |
| `mascotinhos/apps/web/src/**` | Check if anything imports `env.CORS_ORIGIN` | Grep confirmed: no code uses `CORS_ORIGIN` outside `packages/env/src/server.ts` and `packages/storage/src/test-setup.ts` |
| `mascotinhos/apps/web/next.config.ts` | Imports `@mascotinhos/env/web` for side-effect validation — after adding `NEXT_PUBLIC_*` vars, Next.js build will crash without them | Ensure `apps/web/.env.local` (or `.env`) has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_WHATSAPP_NUMBER` |
| `mascotinhos/apps/web/src/app/ai/page.tsx` | Imports `env` from `@mascotinhos/env/web` — starter template AI demo; will trigger client validation after schema changes | No action needed (starter code, will be replaced); do NOT add `GOOGLE_GENERATIVE_AI_API_KEY` — project uses OpenAI per architecture, not Google |

### `packages/storage/src/test-setup.ts` Update

Current content (must be updated — `CORS_ORIGIN` removed, new vars added):

```typescript
// Current (Story 1.2):
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['CORS_ORIGIN'] = 'http://localhost:3000';  // REMOVE THIS
process.env['SUPABASE_URL'] = 'http://localhost:54321';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';

// After Story 1.3 — must set ALL required server env vars:
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

### Dependency on Previous Stories

- **Story 1.1** (done): Prisma schema uses `DATABASE_URL` and `DIRECT_URL` via `packages/db`
- **Story 1.2** (done): Added `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to server.ts; `packages/storage` imports from `@mascotinhos/env/server`
- **Story 1.2 learnings**: Bun's `mock.module` hoisting can be fragile — Story 1.2 needed a `bunfig.toml` preload script. Consider whether env tests need similar treatment (likely not if using Option A schema-only testing).

### Downstream Story Impact

| Story | Variables Used |
|-------|--------------|
| 1.4 (Asaas Wrapper) | `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET`, `ASAAS_SPLIT_WALLET_ID` |
| 2.1 (WhatsApp Webhook) | `WHATSAPP_WEBHOOK_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` |
| 2.3 (AI Agent) | `OPENAI_API_KEY` |
| 4.1 (QStash Queue) | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `VERCEL_URL` |
| 7.1 (Error Handling) | `OPERATOR_WHATSAPP_NUMBER` |

### Project Structure Notes

- `packages/env` is a shared internal package consumed by all other packages
- The `./server` and `./web` subpath exports are defined in `package.json` `exports` field — these MUST be preserved
- `@t3-oss/env-nextjs` is used for `web.ts` because it integrates with Next.js client-side env handling; `@t3-oss/env-core` is used for `server.ts` because it works in any runtime context

### References

- [Source: .bmad_output/planning-artifacts/epics.md#Story 1.3]
- [Source: .bmad_output/planning-artifacts/architecture.md#Environment Variable Pattern]
- [Source: .bmad_output/planning-artifacts/architecture.md#Enforcement Guidelines]
- [Source: .bmad_output/planning-artifacts/architecture.md#Anti-Patterns]
- [Source: .bmad_output/planning-artifacts/prd.md#NFR-10]
- [Source: .bmad_output/implementation-artifacts/story-1.2.md — established @mascotinhos/env/server import pattern]

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

- `bun install` fails without env vars because `@mascotinhos/db` postinstall (Prisma generate) triggers `@mascotinhos/env/server` import. Fixed by setting all required env vars before `bun install`.
- Initial test run: `web.test.ts` failed because importing `clientSchemaSpec` from `./web` also executed the `createEnv` side-effect which requires `NEXT_PUBLIC_*` env vars at import time. Fixed by extracting schema specs into separate side-effect-free files (`server-schema.ts`, `client-schema.ts`) that tests import directly.
- `tsc --noEmit` reports `Cannot find module 'bun:test'` for test files — this is expected and matches the pre-existing pattern in `packages/storage` (Story 1.2). Bun resolves `bun:test` at runtime; TypeScript doesn't know about it without `@types/bun`.

### Completion Notes List

- Extended `packages/env/src/server.ts` with all 16 required + 1 optional server env vars per architecture spec.
- Extracted Zod schema specs into separate files (`server-schema.ts`, `client-schema.ts`) to allow tests to validate schemas without triggering `createEnv` side effects. The main `server.ts` and `web.ts` re-export the specs for backward compatibility.
- Extended `packages/env/src/web.ts` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_WHATSAPP_NUMBER` client vars.
- Created `mascotinhos/.env.example` with all variables grouped by service and commented.
- Added `"test": "bun test"` script to `packages/env/package.json`.
- 22 unit tests across 2 test files: 16 server schema tests + 6 client schema tests. All pass.
- Updated `packages/storage/src/test-setup.ts`: removed `CORS_ORIGIN`, added all 16 new required server env vars. All 17 storage tests still pass (no regressions).
- Removed `CORS_ORIGIN` from server schema (starter template leftover, not in architecture spec, confirmed no code uses it).
- `DATABASE_URL` validation upgraded from `.min(1)` to `.url()` for stricter validation.

### File List

- mascotinhos/packages/env/src/server.ts (modified — extended schema, imports from server-schema.ts)
- mascotinhos/packages/env/src/web.ts (modified — extended client schema, imports from client-schema.ts)
- mascotinhos/packages/env/src/server-schema.ts (created — side-effect-free server schema spec)
- mascotinhos/packages/env/src/client-schema.ts (created — side-effect-free client schema spec)
- mascotinhos/packages/env/src/server.test.ts (created — 16 unit tests for server schema)
- mascotinhos/packages/env/src/web.test.ts (created — 6 unit tests for client schema)
- mascotinhos/packages/env/package.json (modified — added test script)
- mascotinhos/packages/storage/src/test-setup.ts (modified — updated env vars for new schema)
- mascotinhos/.env.example (created — all variables documented with placeholders)
- .bmad_output/implementation-artifacts/story-1.3.md (modified — story file)
- .bmad_output/implementation-artifacts/sprint-status.yaml (modified — status updates)

## Change Log

- 2026-03-29: Implemented environment variable validation — extended server schema (16 required + 1 optional vars), client schema (2 vars), created .env.example, 22 unit tests, updated storage test-setup for compatibility (claude-opus-4-6)
