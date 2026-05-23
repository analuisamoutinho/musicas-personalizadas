# Story 5.2: Revision Handling with Prompt Re-enrichment

Status: done
GitHub Issue: [mgiovani/fotos#64](https://github.com/mgiovani/fotos/issues/64)

## Story

As a client who wants adjustments to her mascotinho,
I want to describe what I want changed in natural language and receive an updated illustration,
So that the final result matches my exact vision.

## Acceptance Criteria

**Given** the Order is in REVISION_1 or REVISION_2 state
**When** the client provides natural language feedback (e.g., "olhos mais escuros", "adiciona um balao")
**Then** the `handleRevision` tool captures the feedback text
**And** stores the revision feedback in the existing Generation record's `revisionFeedback` field (specifically: updates `attemptNumber: nextAttempt - 1` on the previous Generation record, so the `/api/generate` route can read it via `findUnique({ orderId, attemptNumber: attempt - 1 })`)
**And** calls `enrichPrompt()` again, incorporating the original prompt + revision feedback (handled by the existing `/api/generate` route — no code change needed here)
**And** enqueues a new generation via QStash (same async pipeline as initial generation)
**And** the new image goes through quality check, upload, and delivery (same as Story 4.3-4.6)
**And** after revision 1, if more feedback is provided, the order transitions to REVISION_2
**And** after revision 2, the final closing message ("Essa e a versao final! Espero que tenha amado") is Story 5.3's responsibility — this story only ensures REVISION_2 → GENERATING transition fires correctly
**And** the revision counter is tracked per order and each attempt is recorded in the Generation table

**FRs covered:** FR-29 (natural language revision with re-enrichment), FR-30 (max 2 revisions), FR-31 (revision async pipeline), FR-32 (revision count tracking + feedback storage)

---

## Status Assessment — What Already Exists

**CRITICAL: Before writing any code, understand these pre-existing implementations:**

### Already implemented (DO NOT replace, DO NOT reinvent):

- `packages/bot-engine/src/tools/handle-revision.ts` — **stub exists** with correct signature. This story REPLACES the stub body with real implementation. Do NOT change the file name or the tool's `description` or `inputSchema` — only replace `execute`.
- `packages/bot-engine/src/tools/index.ts` — `handleRevision` is already imported, exported, and added to `allTools`. **No changes needed**.
- `packages/bot-engine/src/agent.ts` — uses `allTools` from `./tools`. **No changes needed**.
- `packages/bot-engine/src/state-machine.ts` — `ALLOWED_TRANSITIONS` already has:
  - `AWAITING_FEEDBACK: ["REVISION_1", "REVISION_2", "COMPLETED"]`
  - `REVISION_1: ["GENERATING"]`
  - `REVISION_2: ["GENERATING"]`
  - **No schema or state-machine changes needed**.
- `packages/bot-engine/src/conversation.ts` — exports `updateOrderState(orderId, fromState, toState)`. Must be used for all state transitions — **do NOT call `prisma.order.update({ data: { conversationState } })` directly**.
- `packages/db/prisma/schema/schema.prisma` — `Generation` model already has `revisionFeedback String?` and `@@unique([orderId, attemptNumber])`. No schema changes needed.
- `packages/bot-engine/src/prompts/system-prompt.ts` — already has the AWAITING_FEEDBACK instruction block that calls `handleRevision`. This story adds a new instruction block for REVISION_1 and REVISION_2 states.
- `packages/bot-engine/src/bot.ts` — the AWAITING_FEEDBACK feedback buttons (Story 5.1) are already implemented. After agent processing in REVISION_1 or REVISION_2, no new interactive buttons are needed — the agent communicates via text.
- `apps/web/src/app/api/generate/route.ts` — the `handleGenerate` function already handles `attempt > 1` by loading `revisionFeedback` from the previous `Generation` record. **No route changes needed** — the route already supports revisions.
- `packages/image-gen/src/enrich-prompt.ts` — `enrichPrompt({ orderId, attemptNumber, revisionFeedback })` already accepts `revisionFeedback` and incorporates it into the prompt. **No changes to image-gen package**.

### This story creates/modifies:

- **MODIFY** `packages/bot-engine/src/tools/handle-revision.ts` — replace stub `execute` with real logic
- **CREATE** `packages/bot-engine/src/tools/handle-revision.test.ts` — unit tests
- **MODIFY** `packages/bot-engine/src/prompts/system-prompt.ts` — add REVISION_1/REVISION_2 instruction block

### Not part of this story (do NOT implement):

- Story 5.3 closing CTA — the final "Espero que tenha amado!" message on REVISION_2 completion is Story 5.3's responsibility. For this story, the system prompt just instructs: inform that revision is processing.
- Story 5.4 abandoned cart — QStash scheduled nudges are Story 5.4's responsibility.
- Any changes to `apps/web/src/app/api/generate/route.ts` — the route already supports revisions.
- Any changes to `packages/image-gen/` — `enrichPrompt` already handles `revisionFeedback`.

---

## Developer Context

### Critical Architecture: How Revisions Flow End-to-End

```
Client message in REVISION_1/REVISION_2
  → bot.ts onNewMention → processMessage (agent)
  → agent calls handleRevision(orderId, feedback)
  → handleRevision.execute:
      1. UUID guard
      2. Load order (check conversationState is REVISION_1 or REVISION_2)
      3. Determine next state: REVISION_1 → GENERATING (not REVISION_2, the route handles attempt numbering)
      4. updateOrderState(orderId, currentState, "GENERATING")
      5. Save revisionFeedback to the Generation record for the next attempt
         → prisma.generation.create({ orderId, attemptNumber: nextAttempt, revisionFeedback: feedback, promptUsed: "" })
         (promptUsed is set empty here — enrichPrompt in route.ts upserts with actual prompt)
      6. QStash publishJSON({ url: /api/generate, body: { orderId, action: "generate", attempt: nextAttempt } })
      7. Return { success: true, message: "..." }
```

**How attempt numbers map to states:**
- Initial generation: `attempt: 1`, no `revisionFeedback`
- Revision 1 (REVISION_1): `attempt: 2`, `revisionFeedback` = client's text
- Revision 2 (REVISION_2): `attempt: 3`, `revisionFeedback` = client's text

**How the route knows revision feedback:**
`apps/web/src/app/api/generate/route.ts` already does this for `attempt > 1`:
```typescript
const prevGeneration = await prisma.generation.findUnique({
  where: { orderId_attemptNumber: { orderId, attemptNumber: attempt - 1 } },
  select: { revisionFeedback: true },
});
revisionFeedback = prevGeneration?.revisionFeedback ?? null;
```
So `handleRevision` must write `revisionFeedback` to `Generation` record for `attempt - 1` (the current attempt, before re-enrichment). Example: for REVISION_1, write to `attemptNumber: 1` OR create a new record for `attemptNumber: 2` with `revisionFeedback`.

**IMPORTANT — Correct approach:** Create the Generation record for the **next** attempt (`attemptNumber: nextAttempt`) with `revisionFeedback` set. The route will upsert it with `promptUsed` via `enrichPrompt` (using upsert-on-conflict). This aligns with how the route loads feedback: `findUnique({ orderId, attemptNumber: attempt - 1 })`. So if enqueuing `attempt: 2`, write `revisionFeedback` to `attemptNumber: 1` (already exists from initial generation) OR write it to the record for `attempt: 2`. Wait — the route reads `attempt - 1`. So if we enqueue `attempt: 2`, the route reads `attemptNumber: 1`. **The simplest approach:** Update `revisionFeedback` on the **existing Generation record** at `attemptNumber: (nextAttempt - 1)` (the initial/previous generation) so the route finds it on `attempt - 1`.

Actually re-reading the route code carefully: it reads `revisionFeedback` from `attempt - 1` row. So for revision 1 (enqueue attempt 2), we update `Generation(orderId, attemptNumber: 1).revisionFeedback = feedback`. This is the correct approach — update the existing record.

### State Transitions for handleRevision

```
REVISION_1 → GENERATING  (when client provides revision feedback in REVISION_1)
REVISION_2 → GENERATING  (when client provides revision feedback in REVISION_2)
```

Both transitions are already in `ALLOWED_TRANSITIONS`. The `handleRevision` tool must:
1. Accept either `REVISION_1` or `REVISION_2` conversationState
2. Transition both to `GENERATING` (same target for both)
3. Determine `nextAttempt` based on current state: REVISION_1 → attempt 2, REVISION_2 → attempt 3

### Determining nextAttempt

```typescript
const nextAttempt = order.conversationState === "REVISION_1" ? 2 : 3;
```

### The Generation Record Strategy

To pass `revisionFeedback` to the `/api/generate` route, update the **previous** Generation record:
```typescript
// For REVISION_1: nextAttempt = 2, update record at attemptNumber 1
// For REVISION_2: nextAttempt = 3, update record at attemptNumber 2
await prisma.generation.updateMany({
  where: { orderId, attemptNumber: nextAttempt - 1 },
  data: { revisionFeedback: feedback },
});
```
This is `updateMany` (not `update`) because: if the generation record doesn't exist yet (edge case where previous generation failed before creating a record), it silently skips instead of throwing. The route handles missing `revisionFeedback` gracefully (defaults to null).

### QStash Enqueue Pattern — Reuse enqueue-generation.ts as Reference

Follow `packages/bot-engine/src/tools/enqueue-generation.ts` exactly for the QStash publish:
```typescript
import { Client as QStashClient } from "@upstash/qstash";
import { env } from "@mascotinhos/env/server";

// NOTE: QStashClient constructed per-call — Bun mock.module() patches apply at function-call time
const qstash = new QStashClient({ token: env.QSTASH_TOKEN });
const targetUrl = `https://${env.VERCEL_URL}/api/generate`;

await qstash.publishJSON({
  url: targetUrl,
  body: { orderId, action: "generate", attempt: nextAttempt },
  delay: GENERATION_DELAY_SECONDS,  // 90
  retries: QSTASH_RETRIES,          // 3
});
```

**IMPORTANT:** `VERCEL_URL` is hostname-only (e.g. "your-project.vercel.app"). Prepend `https://`. This is the exact pattern in `enqueue-generation.ts` — do not deviate.

### Full Implementation of handle-revision.ts

```typescript
import { tool } from "ai";
import { z } from "zod";
import { Client as QStashClient } from "@upstash/qstash";
import prisma from "@mascotinhos/db";
import { env } from "@mascotinhos/env/server";
import { updateOrderState } from "../conversation";

const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERATION_DELAY_SECONDS = 90;
const QSTASH_RETRIES = 3;

export const handleRevision = tool({
  description: "Process a revision request from the client after image delivery. Re-enriches prompt with feedback.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
    feedback: z.string().describe("Client's revision feedback in natural language"),
  }),
  execute: async ({ orderId, feedback }) => {
    // 1. UUID guard
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(JSON.stringify({ level: "warn", event: "handle_revision_invalid_id", orderId: orderId.slice(0, 40), service: "bot-engine" }));
      return { success: false, message: "ID de pedido inválido." };
    }

    // 2. Truncate feedback to prevent log injection / prompt injection
    const safeFeedback = feedback.slice(0, 500);

    // 3. Load order
    let order;
    try {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, conversationState: true },
      });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "handle_revision_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao buscar pedido. Tente novamente." };
    }

    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    // 4. Wrong-state guard — only REVISION_1 or REVISION_2 allowed
    if (order.conversationState !== "REVISION_1" && order.conversationState !== "REVISION_2") {
      console.log(JSON.stringify({ level: "warn", event: "handle_revision_wrong_state", orderId, state: order.conversationState, service: "bot-engine" }));
      return { success: false, message: "Pedido não está em estado de revisão." };
    }

    // 5. Determine next attempt number
    const nextAttempt = order.conversationState === "REVISION_1" ? 2 : 3;

    // 6. Store revisionFeedback on the previous Generation record so the /api/generate
    //    route can read it via: findUnique({ orderId, attemptNumber: attempt - 1 })
    try {
      await prisma.generation.updateMany({
        where: { orderId, attemptNumber: nextAttempt - 1 },
        data: { revisionFeedback: safeFeedback },
      });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "warn", event: "handle_revision_feedback_store_failed", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
      // Non-fatal: the generation pipeline will proceed with revisionFeedback=null
    }

    // 7. Transition conversationState to GENERATING
    let transitioned: boolean;
    try {
      transitioned = await updateOrderState(orderId, order.conversationState, "GENERATING");
    } catch (transitionErr) {
      console.log(JSON.stringify({ level: "error", event: "handle_revision_transition_error", orderId, error: transitionErr instanceof Error ? transitionErr.message : String(transitionErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao iniciar revisão. Tente novamente." };
    }
    if (!transitioned) {
      return { success: false, message: "Erro de concorrência ao iniciar revisão. Tente novamente." };
    }

    // 8. Enqueue new generation via QStash
    // NOTE: QStashClient constructed per-call — Bun mock.module() patches apply at function-call time
    const qstash = new QStashClient({ token: env.QSTASH_TOKEN });
    const targetUrl = `https://${env.VERCEL_URL}/api/generate`;

    try {
      await qstash.publishJSON({
        url: targetUrl,
        body: { orderId, action: "generate", attempt: nextAttempt },
        delay: GENERATION_DELAY_SECONDS,
        retries: QSTASH_RETRIES,
      });
    } catch (qErr) {
      console.log(JSON.stringify({ level: "error", event: "handle_revision_qstash_error", orderId, error: qErr instanceof Error ? qErr.message : String(qErr), service: "bot-engine" }));
      // State already transitioned to GENERATING. Log but return success — QStash retry
      // will happen at the HTTP level; operator can re-trigger if needed.
      return { success: false, message: "Erro ao enfileirar revisão. Tente novamente." };
    }

    console.log(JSON.stringify({ level: "info", event: "revision_enqueued", orderId, nextAttempt, from: order.conversationState, service: "bot-engine" }));
    return { success: true, message: "Sua revisão está sendo processada! Já já você receberá a nova versão ✨" };
  },
});
```

### System Prompt — REVISION_1 and REVISION_2 Instruction Blocks

Add these blocks to `buildSystemPrompt()` in `packages/bot-engine/src/prompts/system-prompt.ts`. Insert after the AWAITING_FEEDBACK block, before `## Regras Importantes`:

```typescript
`
## Instrucoes para os estados REVISION_1 e REVISION_2
Quando o estado for REVISION_1 ou REVISION_2:
1. Reconheca o pedido de revisao do cliente com empatia: "Claro! Vou ajustar para voce! 💜✨"
2. Chame IMEDIATAMENTE handleRevision com orderId = ID do pedido e feedback = descricao exata do ajuste solicitado
3. Apos handleRevision retornar success: true, envie: "Perfeito! Ja estou trabalhando no ajuste! Voce recebera a nova versao em instantes 🎨⏳"
4. Se o estado for REVISION_2, apos handleRevision retornar success: true, adicione: "Lembrando que este e o 2o e ultimo ajuste incluso no seu pedido 💕"
5. Se handleRevision retornar success: false, informe ao cliente o erro retornado e peca para tentar novamente
6. Nao tente fazer nenhum outro ajuste ou pergunte detalhes adicionais — use exatamente o texto que o cliente enviou como feedback
`
```

**Where to insert:** After the AWAITING_FEEDBACK instruction block (ends with the line about "Funcionalidade em preparacao!"), before `## Regras Importantes`.

**Also remove the stale "Not implemented yet" fallback for `handleRevision` in the AWAITING_FEEDBACK block.** Line 136 of `system-prompt.ts` currently reads:
```
4. Se handleApproval ou handleRevision retornar "Not implemented yet", informe: "Funcionalidade em preparacao! Ja ja estara disponivel 🌟"
```
Replace it with (handleApproval still unimplemented stub check removed since handleRevision is now real):
```
4. Se handleApproval retornar success: false por qualquer motivo, informe ao cliente o erro e peca para tentar novamente
```
This ensures the AWAITING_FEEDBACK block no longer silently swallows `handleRevision` failures with a stub message.

---

## Files to Create/Modify

| Action | File | What changes |
|--------|------|-------------|
| MODIFY | `packages/bot-engine/src/tools/handle-revision.ts` | Replace stub `execute` with full implementation |
| CREATE | `packages/bot-engine/src/tools/handle-revision.test.ts` | Unit tests |
| MODIFY | `packages/bot-engine/src/prompts/system-prompt.ts` | Add REVISION_1/REVISION_2 instruction block; update AWAITING_FEEDBACK block to remove stale "Not implemented yet" handleRevision fallback |

**Files that DO NOT need changes:**
- `packages/bot-engine/src/tools/index.ts` — already exports `handleRevision` and includes in `allTools`
- `packages/bot-engine/src/agent.ts` — no changes needed
- `packages/bot-engine/src/bot.ts` — no changes needed (no new interactive buttons for revision states)
- `apps/web/src/app/api/generate/route.ts` — already handles attempt > 1 with revision feedback
- `packages/image-gen/src/enrich-prompt.ts` — already handles `revisionFeedback` parameter

---

## Tasks / Subtasks

- [x] Task 1: Implement `handleRevision` tool
  - [x] 1.1: Replace stub `execute` in `packages/bot-engine/src/tools/handle-revision.ts` with full implementation:
    - UUID guard with orderId truncation to 40 chars in log
    - Feedback truncation to 500 chars (`safeFeedback`)
    - DB load with try/catch
    - Wrong-state guard (must be REVISION_1 or REVISION_2)
    - `nextAttempt = order.conversationState === "REVISION_1" ? 2 : 3`
    - `prisma.generation.updateMany` to store `revisionFeedback` on `attemptNumber: nextAttempt - 1` record
    - `updateOrderState(orderId, order.conversationState, "GENERATING")` with try/catch
    - QStash `publishJSON` per-call QStashClient (not module-level), with `attempt: nextAttempt`
    - JSON structured logging at every branch

- [x] Task 2: Update system prompt for REVISION_1/REVISION_2 states
  - [x] 2.1: Add REVISION_1/REVISION_2 instruction block to `buildSystemPrompt()` in `packages/bot-engine/src/prompts/system-prompt.ts`, after the AWAITING_FEEDBACK block, before `## Regras Importantes`
  - [x] 2.2: In the same file, update the AWAITING_FEEDBACK instruction block — replace the stale combined `handleApproval or handleRevision` "Not implemented yet" fallback (currently item 4 in that block) with a `handleApproval`-only error handler. `handleRevision` now returns real results and must not be silenced by this stub message.

- [x] Task 3: Write unit tests
  - [x] 3.1: Create `packages/bot-engine/src/tools/handle-revision.test.ts`:
    - Mock pattern: `mock.module()` BEFORE any imports (same as enqueue-generation.test.ts)
    - Mock `@mascotinhos/db` with `{ order: { findUnique }, generation: { updateMany } }`
    - Mock `../conversation` with `{ updateOrderState }`
    - Mock `@upstash/qstash` with `{ Client: class { publishJSON } }`
    - Mock `@mascotinhos/env/server` with `{ env: { QSTASH_TOKEN, VERCEL_URL } }`
    - Test cases (see Testing section below)

---

## Testing Requirements

### Test Setup Pattern (copy from enqueue-generation.test.ts)

```typescript
import { mock, beforeEach, describe, it, expect } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
const TEST_ORDER_ID = crypto.randomUUID(); // stable test UUID

const mockPublishJSON = mock(() => Promise.resolve({ messageId: "msg_revision_test" }));
const mockPrismaOrderFindUnique = mock(() => Promise.resolve(null));
const mockPrismaGenerationUpdateMany = mock(() => Promise.resolve({ count: 1 }));

mock.module("@upstash/qstash", () => ({
  Client: class {
    publishJSON = mockPublishJSON;
  },
}));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockPrismaOrderFindUnique },
    generation: { updateMany: mockPrismaGenerationUpdateMany },
  },
}));

const mockEnv: Record<string, string | undefined> = {
  QSTASH_TOKEN: "test_token",
  VERCEL_URL: "test.vercel.app",
};

mock.module("@mascotinhos/env/server", () => ({
  env: new Proxy(mockEnv, { get(target, prop) { return target[prop as string]; } }),
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Static imports AFTER all mock.module() calls
import { handleRevision } from "./handle-revision";

const ctx = { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal };
```

### Required Test Cases

```
1. invalid UUID orderId → { success: false }, no DB calls
2. order not found (findUnique returns null) → { success: false, message: "Pedido não encontrado." }
3. wrong state (e.g. AWAITING_FEEDBACK, COMPLETED) → { success: false, message: "...estado de revisão" }
4. REVISION_1 happy path:
   - updateOrderState called with (orderId, "REVISION_1", "GENERATING")  ← orderId is first arg
   - publishJSON called with { body: { orderId, action: "generate", attempt: 2 }, delay: 90, retries: 3 }
   - targetUrl is "https://test.vercel.app/api/generate"
   - returns { success: true }
5. REVISION_2 happy path:
   - updateOrderState called with (orderId, "REVISION_2", "GENERATING")  ← orderId is first arg
   - publishJSON called with { body: { orderId, action: "generate", attempt: 3 } }
   - returns { success: true }
6. updateOrderState returns false (race condition) → { success: false, message: "Erro de concorrência..." }
7. updateOrderState throws → { success: false, message: "Erro ao iniciar revisão..." }
8. QStash publishJSON throws → { success: false, message: "Erro ao enfileirar revisão..." }
9. generation.updateMany throws → non-fatal, still returns { success: true } (updateOrderState + QStash proceed)
10. DB findUnique throws → { success: false, message: "Erro ao buscar pedido..." }
11. revisionFeedback stored on correct attemptNumber:
    - REVISION_1: updateMany with { where: { orderId, attemptNumber: 1 } }
    - REVISION_2: updateMany with { where: { orderId, attemptNumber: 2 } }
```

---

## Dev Notes

### Critical Architecture Compliance

- **Tool pattern:** Use `import { tool } from "ai"` with `inputSchema: z.object(...)`. **Never use `parameters`** (AI SDK v5 deprecated API). All existing tools use `inputSchema` (AI SDK v6).
- **DB access:** Only via `import prisma from "@mascotinhos/db"`. Never `import { PrismaClient } from "@prisma/client"`.
- **State transitions:** Always via `updateOrderState()` from `../conversation` — validates transition and uses optimistic concurrency. Direct `prisma.order.update({ data: { conversationState } })` is an anti-pattern.
- **Env vars:** Only via `import { env } from "@mascotinhos/env/server"`. Never `process.env.X`.
- **QStashClient:** Construct per-call inside `execute`, not at module level — required for Bun test mocks.
- **Logging:** JSON structured pattern: `console.log(JSON.stringify({ level, event, orderId, service: "bot-engine" }))`. Never log raw feedback text (privacy). Log `orderId` as primary correlation key.
- **Webhook handler:** `bot.ts onNewMention` must never throw — all errors must be caught inside tools. This tool must always return `{ success: boolean, message: string }`.

### Idempotency Considerations

QStash may deliver the same message twice on retry. If `handleRevision` is called twice for the same order in REVISION_1:
- First call: `updateOrderState(REVISION_1 → GENERATING)` succeeds (returns true)
- Second call: `updateOrderState(REVISION_1 → GENERATING)` returns false (0 rows matched — already GENERATING)
- Tool correctly returns `{ success: false, message: "Erro de concorrência..." }` on second call
- QStash second attempt to publish is harmless — the `/api/generate` route has idempotency via `orderId_attemptNumber` unique constraint in Generation table

### REVISION_2 Boundary — No More Revisions

After REVISION_2, the order goes through GENERATING → DELIVERING → AWAITING_FEEDBACK again. At that point Story 5.1's AWAITING_FEEDBACK handler runs. The system prompt for AWAITING_FEEDBACK does NOT yet know this is "the final version" (that's Story 5.3's responsibility). For Story 5.2, just ensure the state machine correctly transitions REVISION_2 → GENERATING and the QStash publish fires with `attempt: 3`. Story 5.3 will handle the closing message.

### No Interactive Buttons for REVISION_1/REVISION_2

Unlike AWAITING_FEEDBACK (which shows "Amei!" / "Quero ajustar" buttons), the REVISION_1 and REVISION_2 states do NOT send interactive buttons after the agent response. The client's natural language message IS the revision request; the agent processes it and calls `handleRevision`. No changes to `bot.ts` are needed.

### Cross-Story Dependencies

- **Story 5.1** (done): Set the AWAITING_FEEDBACK → REVISION_1 transition via the existing `handleRevision` stub. Now Story 5.2 implements the full logic.
- **Story 5.3** (backlog): Will add the closing CTA message when the order reaches COMPLETED after revisions.
- **Stories 4.3-4.6** (done): The generation pipeline (`/api/generate` route) is fully operational and handles revisions via `attempt > 1`.
- **The `handleRevision` stub** in `bot.ts` system prompt's AWAITING_FEEDBACK block previously returned `{ success: false, message: "Not implemented yet — Story 5.2" }`. After this story, it returns real results.

### References

- Tool pattern: `packages/bot-engine/src/tools/handle-approval.ts`
- QStash publish pattern: `packages/bot-engine/src/tools/enqueue-generation.ts`
- Test mock pattern: `packages/bot-engine/src/tools/enqueue-generation.test.ts`
- State machine: `packages/bot-engine/src/state-machine.ts`
- Conversation helpers: `packages/bot-engine/src/conversation.ts`
- Revision feedback loading in route: `apps/web/src/app/api/generate/route.ts` (around lines 90 to 110)
- `enrichPrompt` with revisionFeedback: `packages/image-gen/src/enrich-prompt.ts`
- System prompt structure: `packages/bot-engine/src/prompts/system-prompt.ts`
- Previous story (5.1) review findings: `.bmad_output/implementation-artifacts/story-5.1.md#Review-Findings`

---

## Review Findings (2026-03-30 code review)

Reviewer model: claude-sonnet-4.6

### Findings Applied as Patches

**MEDIUM — Empty feedback string not guarded at execute level** (`handle-revision.ts`)
The `inputSchema` uses `z.string().min(1)`, which the AI SDK enforces before calling `execute`. However, tests call `execute` directly, bypassing Zod. An agent passing an empty string from a button tap ("Quero ajustar" with no description text) would store `""` as `revisionFeedback`, triggering a re-generation with no actual instruction. Fix: added `!feedback.trim()` runtime guard inside `execute` returning `{ success: false, message: "Feedback de revisão não pode ser vazio." }`. Added corresponding test (Test 1b). Covered by 15 passing tests.

**MEDIUM — AWAITING_FEEDBACK block had no error branch for `handleRevision` failure** (`system-prompt.ts`)
Item 3 in the AWAITING_FEEDBACK instruction block said "after handleRevision returns, inform the adjustment is being processed" — no `success: false` path. The agent would always confirm processing even on errors. Fix: replaced item 3 with explicit branches: ask for description if client only tapped the button without describing the change; call `handleRevision` only after description is provided; branch on `success: true` vs `success: false`.

**MEDIUM — Agent could call `handleRevision` with button text as feedback** (`system-prompt.ts`)
If the client taps "Quero ajustar" without typing a description, the agent (following the old prompt) could immediately call `handleRevision({ feedback: "Quero ajustar" })`. This stores a meaningless string as the revision instruction. Fix: the updated AWAITING_FEEDBACK block now instructs the agent to ask for the specific change description before calling the tool.

### Findings Deferred

**MEDIUM — Stuck-state when QStash enqueue fails after state transition** (`handle-revision.ts`)
After `updateOrderState` transitions the order to `GENERATING`, a `publishJSON` failure leaves the order permanently stuck — retrying `handleRevision` fails with "not in revision state." No rollback is possible without adding reverse transitions to the state machine. Deferred to Epic 7 hardening (reverse transitions + operator recovery tool). See deferred-work.md.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

No blockers. Pre-existing TypeScript error in `collect-photos.ts` (unrelated to this story) confirmed via git stash verification.

### Completion Notes List

- Implemented `handleRevision` tool replacing the stub with full logic: UUID guard, feedback truncation (500 chars), DB load with try/catch, wrong-state guard (REVISION_1/REVISION_2 only), nextAttempt calculation, revisionFeedback stored via `prisma.generation.updateMany` on `attemptNumber: nextAttempt - 1`, state transition via `updateOrderState`, QStash publish with per-call client construction.
- Updated `system-prompt.ts`: replaced stale `handleApproval or handleRevision` "Not implemented yet" fallback in AWAITING_FEEDBACK block with `handleApproval`-only error handler; added new REVISION_1/REVISION_2 instruction block after AWAITING_FEEDBACK, before `## Regras Importantes`.
- Created `handle-revision.test.ts` with 14 tests covering all 11 required test cases (some cases split into multiple tests): invalid UUID, order not found, wrong states (AWAITING_FEEDBACK, COMPLETED), REVISION_1 happy path, REVISION_2 happy path, race condition (updateOrderState returns false), updateOrderState throws, QStash throws, generation.updateMany throws (non-fatal), DB findUnique throws, revisionFeedback stored on correct attemptNumber for both states.
- All 171 bot-engine tests pass (0 failures, 492 expect() calls).

### File List

- `mascotinhos/packages/bot-engine/src/tools/handle-revision.ts` (modified)
- `mascotinhos/packages/bot-engine/src/tools/handle-revision.test.ts` (created)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` (modified)

### Change Log

- 2026-03-30: Implemented handleRevision tool with full revision logic, updated system prompt for REVISION_1/REVISION_2 states, created 14 unit tests — all ACs satisfied.
