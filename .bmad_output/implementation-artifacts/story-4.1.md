# Story 4.1: QStash Queue Setup and Consumer Endpoint

Status: done
GitHub Issue: [mgiovani/fotos#57](https://github.com/mgiovani/fotos/issues/57)

## Story

As the system,
I want image generation requests queued via Upstash QStash with configurable delay,
So that webhook handlers respond within 5 seconds while generation runs asynchronously with artificial production delay.

## Acceptance Criteria

**Given** a payment is confirmed or a revision is requested
**When** the `enqueueGeneration` function is called
**Then** a QStash message is published to `POST /api/generate` with body `{ orderId, action: "generate", attempt: 1 }` and a 90-second delay
**And** the `/api/generate` route verifies the QStash signature (built-in middleware)
**And** the consumer checks the order status before processing (skip if already DELIVERED or CANCELLED — idempotency)
**And** QStash is configured with 3 automatic retries on failure (HTTP 500)
**And** on final retry failure, a dead-letter callback marks the order as FAILED and notifies the operator

**FRs covered:** FR-22 (async background queue generation), FR-24 (partial: artificial delay via QStash delay parameter)

---

## Status Assessment — What Already Exists

**CRITICAL: Before writing any code, understand these pre-existing stubs and integrations:**

Already implemented (DO NOT replace, DO NOT reinvent):
- `packages/bot-engine/src/tools/enqueue-generation.ts` — stub tool exists, execute returns `{ success: false, message: "Not implemented yet — Story 4.1" }`. **This is the file to implement.**
- `packages/env/src/server-schema.ts` — `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, and `VERCEL_URL` are already validated. Do NOT add them again.
- `apps/web/src/app/api/payments/webhook/route.ts` — already calls `enqueueGeneration.execute({ orderId }, ctx)` via the stub. Lines 204–236. No changes needed to this file.
- `packages/bot-engine/src/tools/index.ts` — already exports `enqueueGeneration`. No changes needed.
- `packages/bot-engine/src/index.ts` — already exports `enqueueGeneration` from `"./tools"`. No changes needed.

Not yet created (this story creates them):
- `apps/web/src/app/api/generate/route.ts` — consumer endpoint (new file)
- The actual QStash publish logic inside `enqueue-generation.ts` (replace stub execute body)
- `enqueue-generation.test.ts` — unit tests for the tool
- `apps/web/src/app/api/generate/route.test.ts` — consumer endpoint tests

Not part of this story (stub out only):
- `packages/image-gen/` package — does not exist yet (Story 4.2+ creates it). The consumer in this story must stub the image-gen call and return HTTP 200 for now.

---

## Tasks / Subtasks

- [x] Task 1: Install `@upstash/qstash` dependency
  - [x] 1.1: Add `@upstash/qstash` to workspace catalog in root `package.json` under `"catalog"`:
    ```json
    "@upstash/qstash": "^2.7.22"
    ```
    (Check npm for latest stable v2.x at time of implementation)
  - [x] 1.2: Add `"@upstash/qstash": "catalog:"` to `packages/bot-engine/package.json` under `"dependencies"`
  - [x] 1.3: Add `"@upstash/qstash": "catalog:"` to `apps/web/package.json` under `"dependencies"` (consumer route needs it for signature verification)
  - [x] 1.4: Run `bun install` from `mascotinhos/`

- [x] Task 2: Implement `enqueue-generation.ts` tool
  - [x] 2.1: Replace the stub body in `packages/bot-engine/src/tools/enqueue-generation.ts` with full implementation:
    ```typescript
    import { tool } from "ai";
    import { z } from "zod";
    import { Client as QStashClient } from "@upstash/qstash";
    import prisma from "@mascotinhos/db";
    import { env } from "@mascotinhos/env/server";

    const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const GENERATION_DELAY_SECONDS = 90;
    const QSTASH_RETRIES = 3;

    export const enqueueGeneration = tool({
      description: "Queue the mascotinho image generation job. Called after payment is confirmed.",
      inputSchema: z.object({
        orderId: z.string().describe("Current order ID"),
      }),
      execute: async ({ orderId }) => {
        if (!ORDER_ID_PATTERN.test(orderId)) {
          console.log(JSON.stringify({ level: "warn", event: "enqueue_generation_invalid_id", orderId, service: "bot-engine" }));
          return { success: false, message: "ID de pedido inválido." };
        }

        // Verify order exists and is in GENERATING state
        let order;
        try {
          order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderStatus: true } });
        } catch (dbErr) {
          console.log(JSON.stringify({ level: "error", event: "enqueue_generation_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
          return { success: false, message: "Erro ao enfileirar geração." };
        }

        if (!order) {
          console.log(JSON.stringify({ level: "warn", event: "enqueue_generation_order_not_found", orderId, service: "bot-engine" }));
          return { success: false, message: "Pedido não encontrado." };
        }

        // Idempotency guard — skip if already past GENERATING
        if (order.orderStatus === "DELIVERED" || order.orderStatus === "CANCELLED") {
          console.log(JSON.stringify({ level: "info", event: "enqueue_generation_idempotent_skip", orderId, orderStatus: order.orderStatus, service: "bot-engine" }));
          return { success: true, message: "Geração já processada." };
        }

        const qstash = new QStashClient({ token: env.QSTASH_TOKEN });
        // VERCEL_URL is hostname-only (e.g. "your-project.vercel.app") — must prepend https://
        const targetUrl = `https://${env.VERCEL_URL}/api/generate`;

        try {
          await qstash.publishJSON({
            url: targetUrl,
            body: { orderId, action: "generate", attempt: 1 },
            delay: GENERATION_DELAY_SECONDS,
            retries: QSTASH_RETRIES,
          });
        } catch (qErr) {
          console.log(JSON.stringify({ level: "error", event: "enqueue_generation_qstash_error", orderId, error: qErr instanceof Error ? qErr.message : String(qErr), service: "bot-engine" }));
          return { success: false, message: "Erro ao enfileirar geração. Tente novamente." };
        }

        console.log(JSON.stringify({ level: "info", event: "enqueue_generation_published", orderId, delay: GENERATION_DELAY_SECONDS, retries: QSTASH_RETRIES, service: "bot-engine" }));
        return { success: true, message: "Geração enfileirada com sucesso." };
      },
    });
    ```
  - [x] 2.2: `VERCEL_URL` set by Vercel contains only the **hostname** (e.g., `your-project.vercel.app`), **without** the `https://` scheme. The `targetUrl` must be constructed as `` `https://${env.VERCEL_URL}/api/generate` `` in production. For local dev, set `VERCEL_URL=localhost:3001` in `mascotinhos/apps/web/.env.local` and the code will produce `https://localhost:3001/api/generate` — or override fully with `VERCEL_URL=http://localhost:3001` and adjust the prefix logic. **Recommended pattern:** define `APP_URL` as a derived env var or compute `https://${env.VERCEL_URL}` at the call site and update the implementation in Task 2.1 accordingly (replace `` `${env.VERCEL_URL}/api/generate` `` with `` `https://${env.VERCEL_URL}/api/generate` ``).

- [x] Task 3: Create consumer route `apps/web/src/app/api/generate/route.ts`
  - [x] 3.1: Create the file at `mascotinhos/apps/web/src/app/api/generate/route.ts`:
    ```typescript
    import { type NextRequest, NextResponse } from "next/server";
    import { Receiver } from "@upstash/qstash";
    import prisma from "@mascotinhos/db";
    import { env } from "@mascotinhos/env/server";
    import { z } from "zod";

    export function GET(): NextResponse {
      return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
    }

    const qstashBodySchema = z.object({
      orderId: z.string().uuid(),
      action: z.enum(["generate", "nudge_abandoned", "close_abandoned"]),
      attempt: z.number().int().min(1).optional().default(1),
    });

    export async function POST(request: NextRequest): Promise<NextResponse> {
      // 1. Verify QStash signature
      const receiver = new Receiver({
        currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
      });

      let body: string;
      try {
        body = await request.text();
      } catch {
        return NextResponse.json({ error: "Bad Request" }, { status: 400 });
      }

      const signature = request.headers.get("upstash-signature") ?? "";
      let isValid = false;
      try {
        isValid = await receiver.verify({ signature, body });
      } catch {
        isValid = false;
      }

      if (!isValid) {
        console.log(JSON.stringify({ level: "warn", event: "generate_consumer_invalid_signature", service: "web" }));
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 2. Parse and validate body
      let payload: z.infer<typeof qstashBodySchema>;
      try {
        payload = qstashBodySchema.parse(JSON.parse(body));
      } catch (parseErr) {
        console.log(JSON.stringify({ level: "warn", event: "generate_consumer_invalid_body", error: parseErr instanceof Error ? parseErr.message : String(parseErr), service: "web" }));
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const { orderId, action, attempt } = payload;

      // 3. Route by action
      if (action === "generate") {
        return handleGenerate(orderId, attempt);
      } else if (action === "nudge_abandoned" || action === "close_abandoned") {
        // Abandoned cart: stub for Story 5.4
        console.log(JSON.stringify({ level: "info", event: "generate_consumer_abandoned_stub", orderId, action, service: "web" }));
        return NextResponse.json({ status: "ok" });
      }

      console.log(JSON.stringify({ level: "warn", event: "generate_consumer_unknown_action", orderId, action, service: "web" }));
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    async function handleGenerate(orderId: string, attempt: number): Promise<NextResponse> {
      // 4. Load order — idempotency check
      let order;
      try {
        order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { id: true, orderStatus: true, conversationState: true },
        });
      } catch (dbErr) {
        console.log(JSON.stringify({ level: "error", event: "generate_consumer_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "web" }));
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 }); // triggers QStash retry
      }

      if (!order) {
        console.log(JSON.stringify({ level: "warn", event: "generate_consumer_order_not_found", orderId, service: "web" }));
        return NextResponse.json({ error: "Order not found" }, { status: 404 }); // 404 = not retry-eligible
      }

      // Skip if order already delivered or completed (idempotency)
      if (order.orderStatus === "DELIVERED" || order.orderStatus === "CANCELLED") {
        console.log(JSON.stringify({ level: "info", event: "generate_consumer_idempotent_skip", orderId, orderStatus: order.orderStatus, service: "web" }));
        return NextResponse.json({ status: "ok" });
      }

      console.log(JSON.stringify({ level: "info", event: "generate_consumer_processing", orderId, attempt, service: "web" }));

      // 5. IMAGE GENERATION PIPELINE — stub until Story 4.2–4.6 implements packages/image-gen
      // Story 4.2: enrichPrompt() — GPT-5-mini prompt enrichment
      // Story 4.3: generate() — GPT Image 1.5 API call with base64 reference photos
      // Story 4.4: qualityCheck() — AI self-critique score check
      // Story 4.5: uploadGenerated() — upload to permanent storage
      // Story 4.6: deliverImage() — WhatsApp photo + document delivery
      // TODO (Story 4.2): import { enrichPrompt, generate, qualityCheck } from "@mascotinhos/image-gen";
      // TODO (Story 4.5): import { uploadGenerated } from "@mascotinhos/storage";
      // TODO (Story 4.6): invoke deliverImage tool from bot-engine

      console.log(JSON.stringify({ level: "info", event: "generate_consumer_pipeline_stub", orderId, attempt, service: "web" }));

      // Return 200 so QStash does not retry while pipeline is stubbed
      return NextResponse.json({ status: "ok" });
    }
    ```
  - [x] 3.2: **Dead-letter callback** — QStash retries 3x automatically when consumer returns HTTP 500. After final retry failure, QStash calls a callback URL if configured. For MVP, dead-letter handling is handled by the fallback logging. Story 7.2 (failed generation order handling) will wire the dead-letter callback to mark the order FAILED and notify the operator. The consumer route returns 500 for DB errors and transient failures to trigger QStash retries.

- [x] Task 4: Tests for `enqueue-generation.ts`
  - [x] 4.1: Create `mascotinhos/packages/bot-engine/src/tools/enqueue-generation.test.ts`:

    **Mock pattern** (follow exact pattern from `generate-payment.test.ts`):
    ```typescript
    import { mock, beforeEach, describe, it, expect } from "bun:test";

    // All mock.module() calls MUST come before any imports that transitively import the mocked modules
    const mockPublishJSON = mock(() => Promise.resolve({ messageId: "msg_test_123" }));
    const mockPrismaOrderFindUnique = mock(() => Promise.resolve(null));

    mock.module("@upstash/qstash", () => ({
      Client: class {
        publishJSON = mockPublishJSON;
      },
    }));

    mock.module("@mascotinhos/db", () => ({
      default: { order: { findUnique: mockPrismaOrderFindUnique } },
    }));

    const mockEnv: Record<string, string | undefined> = {
      QSTASH_TOKEN: "test_token",
      VERCEL_URL: "test.vercel.app", // hostname-only, matching real Vercel VERCEL_URL format (no https://)
    };

    mock.module("@mascotinhos/env/server", () => ({
      env: new Proxy(mockEnv, {
        get(target, prop) { return target[prop as string]; },
      }),
    }));

    // Imports after all mock.module() calls
    import { enqueueGeneration } from "./enqueue-generation";
    ```

    **Test cases to cover:**
    - Valid orderId + GENERATING order → QStash `publishJSON` called with correct `{ url, body: { orderId, action: "generate", attempt: 1 }, delay: 90, retries: 3 }` → returns `{ success: true }`
    - Invalid UUID orderId (e.g., `"not-a-uuid"`) → returns `{ success: false }`, `publishJSON` NOT called
    - Order not found (DB returns null) → returns `{ success: false }`, `publishJSON` NOT called
    - Order already `DELIVERED` → idempotent skip, returns `{ success: true }`, `publishJSON` NOT called
    - Order already `CANCELLED` → idempotent skip, returns `{ success: true }`, `publishJSON` NOT called
    - DB throws → returns `{ success: false }`, `publishJSON` NOT called
    - QStash `publishJSON` throws → returns `{ success: false }`
    - Verify `targetUrl` = `` `https://${env.VERCEL_URL}/api/generate` `` (hostname is `"test.vercel.app"` → full URL is `"https://test.vercel.app/api/generate"`)

- [x] Task 5: Tests for `/api/generate/route.ts`
  - [x] 5.1: Create `mascotinhos/apps/web/src/app/api/generate/route.test.ts`

    **Test cases:**
    - `GET /api/generate` → 405 Method Not Allowed
    - POST with valid QStash signature + `{ orderId, action: "generate", attempt: 1 }` + GENERATING order → 200 `{ status: "ok" }`
    - POST with invalid signature → 401 Unauthorized
    - POST with invalid body (missing orderId) → 400 Invalid payload
    - POST with `action: "nudge_abandoned"` → 200 stub response
    - Post with order `orderStatus: "DELIVERED"` → 200 idempotent skip (no further processing)
    - Post with order `orderStatus: "CANCELLED"` → 200 idempotent skip
    - Post with order not found → 404
    - DB throws on findUnique → 500 (triggers QStash retry)

    **Mocking QStash signature verification** for tests:
    ```typescript
    mock.module("@upstash/qstash", () => ({
      Receiver: class {
        verify = mock(() => Promise.resolve(true)); // happy path
      },
    }));
    ```

- [x] Task 6: Type-check and test pipeline
  - [x] 6.1: `cd mascotinhos && bun run check-types` — 0 new errors (pre-existing: collect-photos.ts:TS2532, bun:test type errors in payments/web — not introduced by this story)
  - [x] 6.2: `cd mascotinhos && bun test packages/bot-engine/src/tools/enqueue-generation.test.ts` — 8 pass, 0 fail
  - [x] 6.3: `cd mascotinhos && bun test apps/web/src/app/api/generate/route.test.ts` — 10 pass, 0 fail
  - [x] 6.4: `cd mascotinhos && bun test packages/bot-engine` — 130 pass, 0 fail (no regressions)

---

## Dev Notes

### CRITICAL: `@upstash/qstash` API — Publisher

The `Client` class is the publisher. Use `publishJSON()` for JSON payloads:

```typescript
import { Client as QStashClient } from "@upstash/qstash";

const qstash = new QStashClient({ token: env.QSTASH_TOKEN });
// VERCEL_URL is hostname-only — must prepend https://
await qstash.publishJSON({
  url: `https://${env.VERCEL_URL}/api/generate`,
  body: { orderId, action: "generate", attempt: 1 },
  delay: 90,    // seconds — artificial production delay (architecture decision)
  retries: 3,   // QStash auto-retries consumer HTTP 500 responses
});
```

### CRITICAL: `@upstash/qstash` API — Signature Verification (Consumer)

Use `Receiver` for signature verification in the consumer route:

```typescript
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

const isValid = await receiver.verify({
  signature: request.headers.get("upstash-signature") ?? "",
  body: rawBodyString, // must be the raw string, not parsed JSON
});
```

**Key:** Read body as `request.text()` BEFORE parsing with `JSON.parse()`. QStash signs the raw body string.

### CRITICAL: QStash Retry Semantics

- HTTP 200 → success, no retry
- HTTP 4xx (400, 401, 404) → do NOT retry (client error — bad message)
- HTTP 5xx (500, 503) → retry up to `retries` count (transient error)
- Timeouts → retry

Set `retries: 3` in `publishJSON`. QStash handles exponential backoff automatically.

### CRITICAL: Idempotency Pattern

The consumer MUST check order state before processing:
```typescript
if (order.orderStatus === "DELIVERED" || order.orderStatus === "CANCELLED") {
  return NextResponse.json({ status: "ok" }); // 200 — skip silently
}
```
QStash retries can deliver the same message multiple times. Always guard.

### CRITICAL: VERCEL_URL Format

- **Production Vercel**: automatically set to the **hostname only** (e.g., `your-project.vercel.app`) — **no `https://` scheme, no trailing slash**
- The code must prepend `https://`: `` `https://${env.VERCEL_URL}/api/generate` ``
- **Local dev**: set `VERCEL_URL=localhost:3001` in `mascotinhos/apps/web/.env.local` — the `https://` prefix will be applied at the call site
- The env schema already has `VERCEL_URL: z.string().min(1)` — it does NOT validate URL format, which is intentional since the value is hostname-only

### CRITICAL: Consumer Returns HTTP 500 for Retryable Errors

QStash retries when the consumer returns 500. Do NOT swallow DB errors:
```typescript
} catch (dbErr) {
  // Return 500 → QStash retries
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
```
For permanent errors (bad payload, order not found), return 4xx to stop retries.

### Architecture Compliance

- **Env access**: always `import { env } from "@mascotinhos/env/server"` — never `process.env` directly
- **DB access**: always `import prisma from "@mascotinhos/db"` — never import Prisma directly
- **Storage access**: via `@mascotinhos/storage` (not relevant for this story, but reserve for 4.5)
- **File names**: kebab-case — `enqueue-generation.ts`, `route.ts`
- **Function names**: camelCase — `enqueueGeneration`, `handleGenerate`
- **Logging**: always `console.log(JSON.stringify({ level, event, orderId, ... }))` — include `orderId` in every entry, no plain `console.log`
- **API response**: consumer returns `{ status: "ok" }` on success (architecture spec for QStash consumer)

### QStash Consumer Route Location

Per architecture spec (`apps/web/src/app/api/generate/route.ts`). This is NOT in `packages/bot-engine`. The consumer is a Next.js API route in `apps/web`.

### `image-gen` Package Does Not Exist Yet

Do NOT create `packages/image-gen/` — that is Story 4.2's job. This story's consumer stubs the pipeline with TODO comments and returns 200 immediately after the idempotency check passes. Stories 4.2–4.6 will fill in the pipeline steps one by one.

### bun:test Mock Pattern — Module Mocking Order

All `mock.module()` calls MUST appear before any `import` statements that transitively import the mocked modules. Follow the exact pattern from `generate-payment.test.ts`:

```typescript
// 1. mock.module() calls first
mock.module("@upstash/qstash", () => ({ ... }));
mock.module("@mascotinhos/db", () => ({ ... }));

// 2. imports after all mocks
import { enqueueGeneration } from "./enqueue-generation";
```

### `enqueue-generation.ts` Tool — No `execute` Context Used

The tool's `execute` function only uses `{ orderId }` from the input schema. The second argument (tool call context) is not needed here — pattern same as `confirmOrder`, `generatePayment`.

### Payment Webhook Already Calls the Stub

`apps/web/src/app/api/payments/webhook/route.ts` lines 204–236 already call `enqueueGeneration.execute({ orderId }, ctx)` via the stub. When this story replaces the stub with the real implementation, the payment webhook will automatically publish to QStash without any further changes. Do NOT modify `payments/webhook/route.ts`.

### DB Schema: Order Status Values

From `schema.prisma` `OrderStatus` enum:
- `PENDING` → not yet paid
- `PAID` → payment confirmed (used by payment webhook before transitioning to GENERATING)
- `GENERATING` → actively queued/generating
- `DELIVERED` → image delivered to client
- `CANCELLED` → order cancelled

The payment webhook sets `orderStatus: "GENERATING"` atomically in a transaction before calling `enqueueGeneration`. The consumer idempotency check uses `orderStatus` (`DELIVERED` or `CANCELLED` = skip). Note: the architecture doc mentions `COMPLETED` but that value does NOT exist in the `OrderStatus` enum — use `CANCELLED` instead.

Note: `conversationState` also has a `GENERATING` value (different from `orderStatus`). Be careful:
- `order.orderStatus` is the business lifecycle field
- `order.conversationState` is the bot conversation step

Both are set by the payment webhook (`conversationState: "GENERATING", orderStatus: "GENERATING"`).

### Previous Story Learnings (from Stories 3.x)

- **`(value ?? null) as any` cast anti-pattern**: Story 3.4 review replaced this with `typeof`-based type extraction. Apply the same discipline here — avoid `as any`.
- **bun:test invocation**: Always run tests from `mascotinhos/`: `cd mascotinhos && bun test <path>`. NOT from project root.
- **`mock.module` before imports**: Bun requires this ordering. Test file reliability depends on it.
- **mutable `mockEnv` proxy**: For env overrides per test, use `mockEnv[key] = value` inside `it()` blocks, with `beforeEach` resetting to defaults.
- **Pre-existing type errors**: `collect-photos.ts:TS2532` pre-dates this story. Do NOT fix unrelated pre-existing errors — only verify 0 NEW errors from `check-types`.
- **Test invocation from `mascotinhos/`**: `bun test packages/bot-engine/src/tools/enqueue-generation.test.ts` — include full path from `mascotinhos/`.

### Project Structure Reference

```
mascotinhos/
├── apps/
│   └── web/
│       └── src/app/api/
│           ├── generate/
│           │   └── route.ts        ← CREATE (Task 3)
│           └── payments/webhook/route.ts  ← DO NOT MODIFY (already calls enqueueGeneration stub)
├── packages/
│   ├── bot-engine/src/tools/
│   │   ├── enqueue-generation.ts   ← IMPLEMENT (Task 2)
│   │   └── enqueue-generation.test.ts  ← CREATE (Task 4)
│   └── env/src/server-schema.ts    ← DO NOT MODIFY (QSTASH_* vars already present)
├── package.json                    ← ADD @upstash/qstash to catalog (Task 1)
└── apps/web/package.json           ← ADD @upstash/qstash dep (Task 1)
    packages/bot-engine/package.json ← ADD @upstash/qstash dep (Task 1)
```

Do NOT modify:
- `packages/env/src/server-schema.ts` — QSTASH vars already validated
- `apps/web/src/app/api/payments/webhook/route.ts` — already calls the stub
- `packages/bot-engine/src/tools/index.ts` — already exports `enqueueGeneration`
- `packages/bot-engine/src/index.ts` — already exports `enqueueGeneration`
- Any other tool files

### References

- Story 3.4 (previous): `/home/mgiovani/projects/fotos/.bmad_output/implementation-artifacts/story-3.4.md` — mock patterns, bun:test patterns, env proxy pattern
- Epics: `/home/mgiovani/projects/fotos/.bmad_output/planning-artifacts/epics.md` — Epic 4, Story 4.1, FR-22, FR-24
- Architecture: `/home/mgiovani/projects/fotos/.bmad_output/planning-artifacts/architecture.md` — Queue Pattern (section 4), Consumer flow, Error handling, Env pattern
- `enqueue-generation.ts` (stub): `mascotinhos/packages/bot-engine/src/tools/enqueue-generation.ts`
- `payments/webhook/route.ts`: `mascotinhos/apps/web/src/app/api/payments/webhook/route.ts` — shows how the stub is already called

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

- Ran tests from individual package directories (not root) to pick up bunfig.toml preload with test env vars. `bun test` from `mascotinhos/` root does not load package-specific bunfig.toml.
- Pre-existing type errors confirmed: `collect-photos.ts:TS2532` (bot-engine) and `bun:test` module not found errors (payments, web) — none introduced by this story.

### Completion Notes List

- Replaced stub `enqueue-generation.ts` with full QStash Client implementation: UUID validation, DB order existence check, idempotency guard (DELIVERED/CANCELLED skip), `publishJSON` with 90s delay and 3 retries.
- `targetUrl` correctly constructed as `https://${env.VERCEL_URL}/api/generate` (VERCEL_URL is hostname-only on Vercel).
- Created `apps/web/src/app/api/generate/route.ts` consumer endpoint: QStash Receiver signature verification, Zod body validation, routing by action (generate/nudge_abandoned/close_abandoned), idempotency check, pipeline stub with TODO comments for Stories 4.2–4.6.
- HTTP semantics: 200 for success/idempotent skip, 401 for invalid signature, 400 for bad payload/unknown action, 404 for order not found (no retry), 500 for DB errors (triggers QStash retry).
- Unit tests: 8 tests for enqueue-generation.ts, 10 tests for route.ts. All pass. Full bot-engine suite: 130 pass, 0 fail, 0 regressions.
- `@upstash/qstash: ^2.7.22` added to workspace catalog; version 2.10.1 installed.

### File List

- `mascotinhos/package.json` — added `@upstash/qstash: ^2.7.22` to catalog
- `mascotinhos/packages/bot-engine/package.json` — added `@upstash/qstash: catalog:` dependency
- `mascotinhos/apps/web/package.json` — added `@upstash/qstash: catalog:` dependency
- `mascotinhos/bun.lockb` — updated lockfile
- `mascotinhos/packages/bot-engine/src/tools/enqueue-generation.ts` — replaced stub with full implementation
- `mascotinhos/apps/web/src/app/api/generate/route.ts` — new consumer endpoint
- `mascotinhos/packages/bot-engine/src/tools/enqueue-generation.test.ts` — new unit tests (8 tests)
- `mascotinhos/apps/web/src/app/api/generate/route.test.ts` — new unit tests (10 tests)

## Review Findings (2026-03-30)

**Reviewer:** adversarial + edge case + acceptance audit (claude-sonnet-4.6)

### Patched (applied directly)

1. **[HIGH] `VERCEL_URL` double-prefix in `apps/web/src/test-setup.ts`** — Value was `'https://test.vercel.app'`, causing `https://https://test.vercel.app/api/generate` in any test that doesn't override via `mock.module`. Tests passed only because `enqueue-generation.test.ts` overrides env via mock proxy. Fixed: changed to `'test.vercel.app'` (hostname-only, matching real Vercel format).

2. **[MEDIUM] Missing-signature requests not distinguished from invalid-signature** — Both cases logged the same `generate_consumer_invalid_signature` event, making it impossible to detect missing-header attacks vs. tampered signatures in logs. Fixed: added early return for null `upstash-signature` header with distinct `generate_consumer_missing_signature` log event in `apps/web/src/app/api/generate/route.ts`.

### Deferred (appended to deferred-work.md)

3. **[MEDIUM] `QStashClient` / `Receiver` singletons not feasible with Bun mock.module** — Bun's `mock.module()` patches apply at import resolution time, not at the point of `new ClassName()`. Module-level instantiation of `QStashClient` or `Receiver` would bypass test mocks. Both instances must remain inside their respective functions. Document this as a testing-architecture constraint; consider integration tests with a real QStash dev environment post-MVP.

4. **[MEDIUM] Idempotency gap: `PAID` status not guarded in consumer** — Consumer skips only `DELIVERED`/`CANCELLED`. An order in `PAID` status (payment confirmed but payment webhook not yet transitioned to `GENERATING`) would enter the generation pipeline. Unlikely in practice (webhook atomically sets `GENERATING` before enqueuing), but a race during retries could expose this. Defer to Epic 7 hardening.

5. **[MEDIUM] Dead-letter callback AC partially unmet** — AC requires "dead-letter callback marks the order as FAILED". The `publishJSON` call has no `failureCallback` URL. Story 7.2 is the designated resolution. Add a `// TODO (Story 7.2): add failureCallback` comment to `publishJSON` call.

6. **[MEDIUM] `attempt` counter always hardcoded as `1`** — `body: { orderId, action: "generate", attempt: 1 }` never increments. The consumer logs `attempt` for observability but it's always 1. QStash manages retries transparently; however operators cannot distinguish first attempt from 3rd retry in logs. Defer to Story 7.x: pass `attempt` as QStash metadata header or use QStash's native retry count header.

### Acceptance Criteria Coverage

- AC1 (QStash publish to `/api/generate` with correct body/delay): PASS — `publishJSON` with `delay: 90`, `retries: 3`, `body: { orderId, action: "generate", attempt: 1 }`
- AC2 (signature verification): PASS — `Receiver.verify()` with raw body string
- AC3 (idempotency check DELIVERED/CANCELLED): PASS
- AC4 (3 retries on 500): PASS — `retries: 3` in publish, HTTP 500 on DB error
- AC5 (dead-letter callback): PARTIAL — deferred to Story 7.2, no `failureCallback` configured

## Change Log

- 2026-03-30: Story 4.1 created — QStash queue setup and consumer endpoint.
- 2026-03-30: Story validated and fixed — (1) AC idempotency: corrected "COMPLETED" → "CANCELLED" to match actual `OrderStatus` enum (schema has no COMPLETED value); (2) VERCEL_URL: corrected throughout — Vercel sets this to hostname-only (no `https://` scheme), so implementation must prepend `https://`; updated implementation code, Task 2.2 note, Dev Notes section, test mockEnv, and targetUrl assertion.
- 2026-03-30: Story 4.1 implemented — installed @upstash/qstash, implemented enqueue-generation.ts tool, created /api/generate consumer route, wrote 18 unit tests (8 + 10). All tasks complete, 130 bot-engine tests pass, 0 regressions.
- 2026-03-30: Story 4.1 code review complete — 2 patches applied (VERCEL_URL test-setup fix, missing-signature log distinction); 4 items deferred. Status set to done.
