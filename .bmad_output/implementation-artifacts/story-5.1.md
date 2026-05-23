# Story 5.1: Feedback Collection After Delivery

Status: done
GitHub Issue: [mgiovani/fotos#63](https://github.com/mgiovani/fotos/issues/63)

## Story

As a client who received her mascotinho,
I want to be asked if I'm happy with the result and offered the option to request adjustments,
So that I can get the illustration exactly right before my child's party.

## Acceptance Criteria

**Given** the Order is in AWAITING_FEEDBACK state (image just delivered by Story 4.6)
**When** the bot processes the post-delivery interaction (client taps a reply button or sends any message)
**Then** the bot asks: "Gostou? Posso ajustar algo? (2 ajustes inclusos)"
**And** reply buttons are presented: "Amei!" / "Quero ajustar"
**And** if the client taps "Amei!" or expresses natural language approval ("ficou perfeito!", "amei!", "lindo!"), a `handleApproval` tool is called:
  - Order `conversationState` transitions from `AWAITING_FEEDBACK` → `COMPLETED`
  - Order `orderStatus` transitions to `DELIVERED` (the terminal delivered status in the schema — `OrderStatus` enum has no `COMPLETED` value)
**And** if the client taps "Quero ajustar" or describes a change, the order transitions `AWAITING_FEEDBACK` → `REVISION_1` (Story 5.2 handles the revision pipeline)

**FRs covered:** FR-28 (feedback collection with reply buttons)

---

## Status Assessment — What Already Exists

**CRITICAL: Before writing any code, understand these pre-existing implementations:**

### Already implemented (DO NOT replace, DO NOT reinvent):

- `packages/bot-engine/src/state-machine.ts` — `ConversationState` object and `ALLOWED_TRANSITIONS`. The transition `AWAITING_FEEDBACK → COMPLETED` is **already valid** in the state machine. The transition `AWAITING_FEEDBACK → REVISION_1` is also already valid.
- `packages/bot-engine/src/conversation.ts` — exports `updateOrderState(orderId, fromState, toState)`. Uses optimistic concurrency via `updateMany` WHERE clause. **This is the required DB update pattern — use it, do NOT call `prisma.order.update` directly.**
- `packages/bot-engine/src/tools/handle-revision.ts` — stub exists, returns `{ success: false, message: "Not implemented yet — Story 5.2" }`. Do NOT implement this story's logic here; Story 5.2 owns it. This story only needs to trigger the `AWAITING_FEEDBACK → REVISION_1` transition.
- `packages/bot-engine/src/tools/index.ts` — already exports `handleRevision`. No changes needed.
- `packages/bot-engine/src/agent.ts` — `processMessage` drives the agent with `allTools`. The agent already has `handleRevision` in its tool list.
- `packages/bot-engine/src/prompts/system-prompt.ts` — the AWAITING_FEEDBACK state is mentioned in the flow list (`9. AWAITING_FEEDBACK → Pergunte se gostou, ofereca ajustes`) but has **NO dedicated instruction block**. This story adds that block.
- `packages/bot-engine/src/bot.ts` — after GREETING, the bot sends interactive reply buttons. The same `(thread as any).sendInteractive()` with plain-text fallback pattern must be used here for the "Amei!" / "Quero ajustar" buttons.
- `packages/bot-engine/src/tools/confirm-order.ts` — reference implementation for the tool pattern: UUID guard → DB load → wrong-state guard → business logic → `updateOrderState` → return result.
- `packages/db/prisma/schema/schema.prisma` — `Order` model has `orderStatus` (`OrderStatus` enum) and `conversationState` (`ConversationState` enum). The `OrderStatus.COMPLETED` value exists in the schema.

### Not yet created (this story creates them):

- `packages/bot-engine/src/tools/handle-approval.ts` — new AI SDK `tool` that transitions `AWAITING_FEEDBACK → COMPLETED` and updates `orderStatus` to `COMPLETED`
- Export `handleApproval` added to `packages/bot-engine/src/tools/index.ts`
- `handleApproval` added to `allTools` object in `packages/bot-engine/src/tools/index.ts`
- `handleApproval` added to agent wiring in `packages/bot-engine/src/agent.ts`
- AWAITING_FEEDBACK instruction block added to `packages/bot-engine/src/prompts/system-prompt.ts`
- Post-feedback interactive buttons in `packages/bot-engine/src/bot.ts`
- Test file: `packages/bot-engine/src/tools/handle-approval.test.ts`

### Not part of this story (do NOT implement):

- Story 5.2 revision pipeline — `handleRevision` tool already exists as a stub. Do NOT implement the revision logic; only trigger `AWAITING_FEEDBACK → REVISION_1` by calling the existing stub.
- Story 5.3 closing CTA message — the warm "Que bom que voce amou!" closing message is Story 5.3's responsibility.
- Story 5.4 abandoned cart — QStash scheduled nudge messages are Story 5.4's responsibility.
- Any changes to `apps/web/src/app/api/generate/route.ts` — no route changes needed.

---

## Developer Context

### Critical Architecture Decision: handleApproval is called via the AI agent

Unlike `deliverImage` (which was called directly from the QStash consumer route), `handleApproval` is invoked through the normal `processMessage` agent flow in `bot.ts`. When the client sends a message or taps a button in AWAITING_FEEDBACK state, the WhatsApp webhook fires → `bot.ts` loads the order → passes to `processMessage` → agent recognizes approval intent → calls `handleApproval` tool.

### Tool Pattern — Follow confirm-order.ts Exactly

```typescript
// packages/bot-engine/src/tools/handle-approval.ts
import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { updateOrderState } from "../conversation";

const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handleApproval = tool({
  description:
    "Mark the order as completed when the client approves the mascotinho. Call when client expresses satisfaction in AWAITING_FEEDBACK state.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ orderId }) => {
    // 1. UUID guard
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(JSON.stringify({ level: "warn", event: "handle_approval_invalid_id", orderId, service: "bot-engine" }));
      return { success: false, message: "ID de pedido inválido." };
    }

    // 2. Load order
    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "handle_approval_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao buscar pedido. Tente novamente." };
    }

    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    // 3. Wrong-state guard
    if (order.conversationState !== "AWAITING_FEEDBACK") {
      console.log(JSON.stringify({ level: "warn", event: "handle_approval_wrong_state", orderId, state: order.conversationState, service: "bot-engine" }));
      return { success: false, message: "Pedido não está aguardando feedback." };
    }

    // 4. Update conversationState: AWAITING_FEEDBACK → COMPLETED
    const updated = await updateOrderState(orderId, "AWAITING_FEEDBACK", "COMPLETED");
    if (!updated) {
      return { success: false, message: "Erro de concorrência. Tente novamente." };
    }

    // 5. Update orderStatus to COMPLETED
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { orderStatus: "COMPLETED" },
      });
    } catch (err) {
      console.log(JSON.stringify({ level: "error", event: "handle_approval_status_update_failed", orderId, error: err instanceof Error ? err.message : String(err), service: "bot-engine" }));
      // conversationState already updated; log but return success to avoid duplicate processing
    }

    console.log(JSON.stringify({ level: "info", event: "order_completed", orderId, service: "bot-engine" }));
    return { success: true, message: "Pedido concluído com sucesso!" };
  },
});
```

### System Prompt — AWAITING_FEEDBACK Instruction Block

Add this block to `buildSystemPrompt()` in `packages/bot-engine/src/prompts/system-prompt.ts`. Insert it after the CONFIRMING_ORDER block, before `## Regras Importantes`:

```typescript
// Add inside the template literal:
`
## Instrucoes para o estado AWAITING_FEEDBACK
Quando o estado for AWAITING_FEEDBACK:
1. Assim que o cliente enviar qualquer mensagem, pergunte: "Gostou? Posso ajustar algo? (2 ajustes inclusos) 💕"
2. Se o cliente expressar aprovacao (toque em "Amei!", ou escreva "amei", "ficou perfeito", "lindo", "adorei", "gostei", "perfeito", "otimo"):
   - Chame IMEDIATAMENTE handleApproval com orderId = ID do pedido atual
   - Apos handleApproval retornar success: true, envie a mensagem de encerramento (Story 5.3 ira lidar com isso, por enquanto envie: "Que alegria! Fico feliz que tenha amado! 💜🎉")
3. Se o cliente solicitar ajuste (toque em "Quero ajustar", ou descreva uma mudanca):
   - Chame IMEDIATAMENTE handleRevision com orderId = ID do pedido e feedback = descricao do ajuste
   - Apos handleRevision retornar, informe que o ajuste esta sendo processado
4. Se handleApproval ou handleRevision retornar "Not implemented yet", informe: "Funcionalidade em preparacao! Ja ja estara disponivel 🌟"
`
```

### Interactive Buttons in bot.ts — AWAITING_FEEDBACK

After the agent sends its response, if `order.conversationState === "AWAITING_FEEDBACK"`, send reply buttons. Follow the **exact same pattern** as the GREETING button block in `bot.ts`:

```typescript
// Add after the existing GREETING interactive button block in bot.ts:
if (order.conversationState === "AWAITING_FEEDBACK") {
  try {
    if (typeof (thread as any).sendInteractive === "function") {
      await (thread as any).sendInteractive({
        type: "button",
        body: { text: "Como ficou seu mascotinho?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "feedback_approved", title: "Amei! 💜" } },
            { type: "reply", reply: { id: "feedback_revise", title: "Quero ajustar ✏️" } },
          ],
        },
      });
    }
    // No plain-text fallback needed — the system prompt already invites a response
  } catch (buttonError) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "feedback_buttons_failed",
        service: "bot-engine",
        error: buttonError instanceof Error ? buttonError.message : String(buttonError),
      }),
    );
  }
}
```

**Important:** The button is sent only when the current state is `AWAITING_FEEDBACK` (before processing — the agent may already transition the state). Use `order.conversationState` (loaded at the start of `bot.ts onNewMention`) not a post-agent re-load, because the agent may have already changed the state internally.

### State Transition Summary for This Story

```
AWAITING_FEEDBACK + "Amei!" → handleApproval tool → COMPLETED
AWAITING_FEEDBACK + "Quero ajustar [text]" → handleRevision tool (stub) → REVISION_1 (Story 5.2)
```

Both transitions are already defined in `ALLOWED_TRANSITIONS` in `state-machine.ts` — no schema changes needed.

### Logging Pattern

All log entries must follow the JSON structured pattern used throughout the codebase:
```typescript
console.log(JSON.stringify({ level: "info|warn|error", event: "snake_case_event_name", orderId, service: "bot-engine" }));
```
Never log raw phone numbers or client names — use `orderId` as the primary correlation key.

### Prisma Schema — No Changes Required

The `OrderStatus.COMPLETED` enum value and the `AWAITING_FEEDBACK`, `REVISION_1`, `COMPLETED` `ConversationState` values are already in `packages/db/prisma/schema/schema.prisma`. Do NOT run `bun run db:push` or modify the schema.

### Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `packages/bot-engine/src/tools/handle-approval.ts` |
| CREATE | `packages/bot-engine/src/tools/handle-approval.test.ts` |
| MODIFY | `packages/bot-engine/src/tools/index.ts` — add `handleApproval` import + export + to `allTools` |
| MODIFY | `packages/bot-engine/src/agent.ts` — NOT needed (agent gets tools from `allTools` dynamically) |
| MODIFY | `packages/bot-engine/src/prompts/system-prompt.ts` — add AWAITING_FEEDBACK instruction block |
| MODIFY | `packages/bot-engine/src/bot.ts` — add AWAITING_FEEDBACK interactive button block |

**Note on agent.ts:** The agent uses `allTools` which is imported from `./tools`. Adding `handleApproval` to `allTools` in `tools/index.ts` is sufficient — no changes to `agent.ts` needed.

---

## Tasks / Subtasks

- [ ] Task 1: Create `handleApproval` tool (AC: #1)
  - [ ] 1.1: Create `packages/bot-engine/src/tools/handle-approval.ts` with UUID guard, DB load, wrong-state guard, `updateOrderState(AWAITING_FEEDBACK → COMPLETED)`, `prisma.order.update(orderStatus: COMPLETED)`, structured JSON logging
  - [ ] 1.2: Export `handleApproval` from `packages/bot-engine/src/tools/index.ts` and add to `allTools` object

- [ ] Task 2: Update system prompt for AWAITING_FEEDBACK state (AC: #1, #2, #3)
  - [ ] 2.1: Add AWAITING_FEEDBACK instruction block to `buildSystemPrompt()` in `packages/bot-engine/src/prompts/system-prompt.ts`, covering: detection of approval/revision intent, calling `handleApproval` or `handleRevision`, handling "Not implemented yet" gracefully

- [ ] Task 3: Add AWAITING_FEEDBACK reply buttons in bot.ts (AC: #2)
  - [ ] 3.1: Add conditional button send after agent response when `order.conversationState === "AWAITING_FEEDBACK"`, using the same `(thread as any).sendInteractive()` pattern with try/catch/warn-log fallback as the GREETING block

- [ ] Task 4: Write tests (AC: all)
  - [ ] 4.1: Create `packages/bot-engine/src/tools/handle-approval.test.ts`:
    - Unit test: invalid UUID returns `{ success: false }`
    - Unit test: order not found returns `{ success: false }`
    - Unit test: wrong state (not AWAITING_FEEDBACK) returns `{ success: false }`
    - Unit test: success path — `updateOrderState` called with correct args, `orderStatus` updated to COMPLETED, returns `{ success: true }`
    - Unit test: race condition (updateOrderState returns false) returns `{ success: false }`

---

## Dev Notes

### Architecture Compliance

- **Tool pattern:** Every tool uses `import { tool } from "ai"` with `inputSchema: z.object(...)`. Never use `parameters` (deprecated AI SDK v5 API) — use `inputSchema` (AI SDK v6). All existing tools in this codebase use `inputSchema`.
- **DB access:** All database operations via `@mascotinhos/db` (Prisma client). Never import `@prisma/client` directly.
- **State transitions:** Always use `updateOrderState()` from `conversation.ts` — it validates the transition against `ALLOWED_TRANSITIONS` and uses optimistic concurrency. Direct `prisma.order.update({ data: { conversationState } })` is an anti-pattern.
- **Env vars:** Access only via `@mascotinhos/env/server` — never `process.env.X` directly.
- **Webhook handler:** `bot.ts` onNewMention must NEVER throw — all errors caught inside. HTTP 200 must always be returned to Meta.

### Testing Pattern

Look at `packages/bot-engine/src/tools/confirm-order.test.ts` and `collect-photos.test.ts` for the test setup pattern. The project uses `vi.mock("@mascotinhos/db")` and `vi.mock("../conversation")` to mock Prisma and `updateOrderState`.

### WhatsApp Interactive Button Constraint

WhatsApp Business API supports max 3 buttons per interactive message. The AWAITING_FEEDBACK buttons use only 2 ("Amei! 💜" / "Quero ajustar ✏️"), which is within limits.

Button IDs (`feedback_approved`, `feedback_revise`) will arrive as the message text when the client taps them. The agent's system prompt and `handleApproval`/`handleRevision` tools will handle this naturally via the agent's intent recognition.

### Cross-Story Dependencies

- **Story 5.2** owns the full revision pipeline — `REVISION_1` state handling, `handleRevision` implementation, prompt re-enrichment, re-queuing via QStash. This story only transitions to REVISION_1 via the existing stub.
- **Story 5.3** owns the closing CTA message (after COMPLETED). This story's `handleApproval` tool only transitions state; the warm closing message will be added in Story 5.3 (for now the system prompt instructs a basic "Que alegria!" message).
- **Story 4.6** (done) set `conversationState = AWAITING_FEEDBACK` after delivery — that's the entry point for this story.

### Project Structure Notes

- Alignment with directory structure: new `handle-approval.ts` follows the exact naming convention of existing tools (`kebab-case.ts`)
- Package boundary: all new code stays in `packages/bot-engine/src/tools/` — no cross-package changes needed
- No new dependencies required

### References

- Tool pattern: `packages/bot-engine/src/tools/confirm-order.ts`
- State machine: `packages/bot-engine/src/state-machine.ts`
- Conversation helpers: `packages/bot-engine/src/conversation.ts`
- Interactive button pattern: `packages/bot-engine/src/bot.ts` (GREETING block, lines ~145-175)
- System prompt template: `packages/bot-engine/src/prompts/system-prompt.ts`
- Epic 5 AC: `.bmad_output/planning-artifacts/epics.md#Story-5.1` (line 669)
- Architecture tool inventory: `.bmad_output/planning-artifacts/architecture.md#Tool-inventory` (line 359)
- State machine transitions: `.bmad_output/planning-artifacts/architecture.md#Conversation-State-Machine` (line 306)

---

## Review Findings

Code review performed: 2026-03-30. Model: claude-sonnet-4.6. Adversarial + edge case + acceptance audit.

### Finding 1 — HIGH: `updateOrderState` throws not caught in `handleApproval`

**File:** `packages/bot-engine/src/tools/handle-approval.ts`
**Issue:** `updateOrderState()` can throw (e.g. if Prisma's `updateMany` encounters a DB error or if `isValidTransition` throws). The call on line 59 had no try/catch, causing an unhandled rejection to propagate through `execute()` — the AI SDK would receive a rejected promise instead of a `{ success: false }` result.
**Fix Applied:** Wrapped `updateOrderState` call in try/catch; returns `{ success: false, message: "Erro ao atualizar estado do pedido. Tente novamente." }` on error. Added corresponding test case.

### Finding 2 — MEDIUM: Feedback buttons resent after client approval (button loop)

**File:** `packages/bot-engine/src/bot.ts`
**Issue:** The AWAITING_FEEDBACK button block used `order.conversationState` (loaded before `processMessage`). If the agent called `handleApproval` during that invocation (transitioning state to COMPLETED), the pre-loaded state still read `AWAITING_FEEDBACK`, causing feedback buttons to be resent to a client who just approved their mascotinho.
**Fix Applied:** After `processMessage`, re-loads current order state via `loadActiveOrder(senderId)` and sends buttons only if the post-process state is still `AWAITING_FEEDBACK`.

### Finding 3 — MEDIUM: Attacker-controlled `orderId` logged verbatim on UUID validation failure

**File:** `packages/bot-engine/src/tools/handle-approval.ts`
**Issue:** On UUID format check failure, the raw (potentially arbitrarily long or injection-crafted) `orderId` was logged in full. An agent hallucination or a crafted payload could produce very long strings in logs.
**Fix Applied:** `orderId` is truncated to 40 characters before logging in the invalid-ID warn path.

### Finding 4 — MEDIUM: Missing test for `updateOrderState` throwing

**File:** `packages/bot-engine/src/tools/handle-approval.test.ts`
**Issue:** Tests covered `updateOrderState` returning `false` but not the case where it throws. Without the test, the unhandled-rejection bug (Finding 1) would not have been caught by CI.
**Fix Applied:** Added test case: `mockUpdateOrderState` rejects with a DB timeout error; asserts `{ success: false, message: "Erro ao atualizar estado do pedido. Tente novamente." }` and that `prisma.order.update` is not called.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
