# Story 2.8: Order Summary and Confirmation

Status: done
GitHub Issue: [mgiovani/fotos#52](https://github.com/mgiovani/fotos/issues/52)

## Story

As a client,
I want to see a summary of my order before paying,
So that I can verify all details are correct and feel confident proceeding.

## Acceptance Criteria

1. **Given** the conversation is in CONFIRMING_ORDER state
   **When** the `confirmOrder` tool is called with `confirmed: false` (present summary)
   **Then** the bot presents a formatted order summary: child's name (from `client.name` or "não informado"), selected theme, outfit description (or "sem roupa especial"), extra requests (or "sem extras"), number of photos received (`photosUrls.length`), and price (R$29,90)
   **And** the bot asks for confirmation with reply buttons: "Confirmar ✅" / "Quero alterar ✏️"

2. **Given** the summary is displayed and the client responds "Confirmar"
   **When** `confirmOrder` is called with `confirmed: true`
   **Then** `updateOrderState(orderId, "CONFIRMING_ORDER", "AWAITING_PAYMENT")` is called
   **And** `confirmOrder` returns `{ success: true, confirmed: true, message: "Pedido confirmado! ..." }`

3. **Given** the summary is displayed and the client responds "Quero alterar"
   **When** `confirmOrder` is called with `confirmed: false, alterRequest: "<what they want to change>"`
   **Then** the tool returns `{ success: true, confirmed: false, alterRequest: "<the request>", message: "Claro! O que você gostaria de alterar?" }`
   **And** NO state transition occurs — the AI agent determines which prior state to revert to based on `alterRequest`
   **And** the Order record is NOT modified (changes happen in the appropriate collection tool after revert)

4. **Given** `confirmOrder` is called with `orderId` that does not exist
   **Then** the tool returns `{ success: false, message: "Pedido não encontrado." }`

5. **Given** `confirmOrder` is called with an invalid UUID `orderId`
   **Then** the tool returns `{ success: false, message: "ID de pedido inválido." }` without calling the DB

6. **Given** `confirmOrder` is called in a wrong conversation state (not CONFIRMING_ORDER)
   **Then** the tool returns `{ success: false, message: "Estado inválido para confirmação." }` and logs a warning

7. **Given** `updateOrderState` throws an error during confirmation
   **Then** the tool returns `{ success: false, message: "Erro ao confirmar pedido. Tente novamente." }`
   **And** the error is logged with structured JSON logging

8. **Given** a DB error occurs while loading the order
   **Then** the tool returns `{ success: false, message: "Erro ao buscar pedido. Tente novamente." }`

**FRs covered:** FR-14 (order summary for confirmation before payment)
**Technical notes:** Summary message should be visually formatted with emojis. The "alter" path is flexible — the AI agent determines which state to return to. State reversion happens via `updateOrderState` called by the AI agent's next tool invocation (the collection tool for the changed field). `confirmOrder` itself only handles the CONFIRMING_ORDER → AWAITING_PAYMENT transition.

## Tasks / Subtasks

- [x] Task 1: Implement `confirmOrder` tool (AC: #1–#8)
  - [x] 1.1: Replace the entire file `packages/bot-engine/src/tools/confirm-order.ts` — **the stub already exists** (returns "Not implemented yet — Story 2.8"); replace the full file content with the implementation (description, inputSchema, and execute all change — see Dev Notes for full implementation reference)
  - [x] 1.2: Expand `inputSchema` to add `alterRequest` field:
    ```typescript
    inputSchema: z.object({
      orderId: z.string().describe("Current order ID"),
      confirmed: z.boolean().describe("True if client confirmed, false if wants to alter"),
      alterRequest: z.string().nullable().optional().describe("What the client wants to change, if confirmed=false"),
    })
    ```
  - [x] 1.3: `execute`: validate UUID format — if invalid, return `{ success: false, message: "ID de pedido inválido." }` (no DB call)
  - [x] 1.4: Load order with client join: `prisma.order.findUnique({ where: { id: orderId }, include: { client: true } })` — if null, return `{ success: false, message: "Pedido não encontrado." }`
  - [x] 1.5: Guard wrong state: if `order.conversationState !== "CONFIRMING_ORDER"`, return `{ success: false, message: "Estado inválido para confirmação." }` and log warning
  - [x] 1.6: If `confirmed === false` AND `alterRequest` is nullish (initial summary presentation): build and return summary message (see Dev Notes for exact format). Do NOT transition state.
  - [x] 1.7: If `confirmed === false` AND `alterRequest` is non-null (client wants to alter): return `{ success: true, confirmed: false, alterRequest, message: "Claro! O que você gostaria de alterar? ✏️ Me diga o que mudar e eu corrijo agora!" }`. Do NOT transition state.
  - [x] 1.8: If `confirmed === true`: call `updateOrderState(orderId, "CONFIRMING_ORDER", "AWAITING_PAYMENT")` — if it throws, return `{ success: false, message: "Erro ao confirmar pedido. Tente novamente." }`. On success, return `{ success: true, confirmed: true, message: "Pedido confirmado! 🎉 Agora vou gerar o seu PIX para pagamento..." }`.
  - [x] 1.9: Structured logging: log `order_summary_presented` (info), `order_confirmed` (info), `order_alter_requested` (info), `confirm_order_wrong_state` (warn), `confirm_order_db_error` (error), `confirm_order_state_transition_error` (error)
  - [x] 1.10: **Do NOT change `tools/index.ts`** — `confirmOrder` is already exported and in `allTools` (it was stubbed in Story 2.3, added to index then)
  - [x] 1.11: **Do NOT change `tools.test.ts` tool count** — `confirmOrder` is already counted in `toHaveLength(9)` from Story 2.7

- [x] Task 2: Update system prompt for CONFIRMING_ORDER state (AC: #1–#3)
  - [x] 2.1: Edit `packages/bot-engine/src/prompts/system-prompt.ts`
  - [x] 2.2: Add `## Instrucoes para o estado CONFIRMING_ORDER` block **AFTER** the `## Instrucoes para o estado COLLECTING_OUTFIT` block (line ~84, before `## Instrucoes para o estado COLLECTING_PHOTOS` at line ~93)
  - [x] 2.3: Instruction content:
    ```
    ## Instrucoes para o estado CONFIRMING_ORDER
    Quando o estado for CONFIRMING_ORDER:
    1. APRESENTAR RESUMO: Chame IMEDIATAMENTE confirmOrder com confirmed=false e alterRequest=null para obter o resumo formatado
    2. Envie o resumo retornado ao cliente e pergunte: "Esta tudo certinho? ✅ Posso confirmar seu pedido?"
    3. Apresente dois botoes de resposta: "Confirmar ✅" e "Quero alterar ✏️"
    4. Se o cliente confirmar: chame confirmOrder com confirmed=true
    5. Se o cliente quiser alterar: chame confirmOrder com confirmed=false, alterRequest=descricao do que quer mudar
       - Apos retornar, pergunte o que deseja alterar se nao ficou claro
       - Retorne ao estado de coleta adequado: COLLECTING_PHOTOS (fotos), COLLECTING_THEME (tema), COLLECTING_OUTFIT (roupa/extras)
       - Chame a ferramenta de coleta correspondente ao item que o cliente quer alterar
    6. Apos confirmOrder retornar confirmed=true, informe que o PIX sera gerado
    ```

- [x] Task 3: Write tests (AC: #1–#8)
  - [x] 3.1: Create `packages/bot-engine/src/tools/confirm-order.test.ts`
    - [x] 3.1.1: Mock `@mascotinhos/db` via `mock.module()` BEFORE any imports — follow exact pattern from `select-style.test.ts` and `collect-outfit.test.ts`
    - [x] 3.1.2: Mock `../conversation` for `updateOrderState` — same pattern
    - [x] 3.1.3: Static import AFTER all `mock.module()` calls: `import { confirmOrder } from "./confirm-order"`
    - [x] 3.1.4: Use a valid UUID v4 format constant for `TEST_ORDER_ID` — any well-formed UUID works; lesson from Story 2.7 review: non-UUID strings cause early rejection in the UUID validation guard
    - [x] 3.1.5: Test: `confirmed=false, alterRequest=null` → returns summary with all order fields, no state transition
    - [x] 3.1.6: Test: `confirmed=true` → calls `updateOrderState(CONFIRMING_ORDER → AWAITING_PAYMENT)`, returns `confirmed: true`
    - [x] 3.1.7: Test: `confirmed=false, alterRequest="quero mudar o tema"` → returns `{ confirmed: false, alterRequest }`, no state transition
    - [x] 3.1.8: Test: order not found → `{ success: false, message: "Pedido não encontrado." }`
    - [x] 3.1.9: Test: invalid UUID orderId → `{ success: false, message: "ID de pedido inválido." }`, DB NOT called
    - [x] 3.1.10: Test: wrong state (e.g. COLLECTING_THEME) → `{ success: false, message: "Estado inválido para confirmação." }`, no transition
    - [x] 3.1.11: Test: `updateOrderState` throws → `{ success: false, message: "Erro ao confirmar pedido. Tente novamente." }`
    - [x] 3.1.12: Test: DB error on `findUnique` → `{ success: false, message: "Erro ao buscar pedido. Tente novamente." }`
    - [x] 3.1.13: Test: summary includes client name when `client.name` is set
    - [x] 3.1.14: Test: summary shows "não informado" when `client.name` is null
  - [x] 3.2: Update `packages/bot-engine/src/prompts/system-prompt.test.ts`
    - [x] 3.2.1: Add test: when `conversationState === "CONFIRMING_ORDER"`, the prompt contains "confirmOrder" instruction

- [x] Task 4: Type-check and test pipeline (AC: #1–#8)
  - [x] 4.1: Run `bun run check-types` from `mascotinhos/` — must pass with 0 new errors (pre-existing errors from `@mascotinhos/storage` TS2307 in `collect-photos.ts` and `payments` package are pre-existing; do NOT fix them in this story)
  - [x] 4.2: Run `bun test` from `mascotinhos/packages/bot-engine/` — all new `confirm-order.test.ts` and system-prompt tests must pass

## Dev Notes

### CRITICAL: Stub Already Exists — Replace execute Only

`packages/bot-engine/src/tools/confirm-order.ts` already exists as a stub:
```typescript
import { tool } from "ai";
import { z } from "zod";

export const confirmOrder = tool({
  description: "Present order summary and process client confirmation. Call when client confirms or wants to alter the order.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
    confirmed: z.boolean().describe("True if client confirmed, false if wants to alter"),
  }),
  execute: async () => ({ success: false, message: "Not implemented yet — Story 2.8" }),
});
```

**Replace the entire file** with the full implementation (description and inputSchema can be updated too — the stub's inputSchema is missing `alterRequest`).

### CRITICAL: tools/index.ts — Do NOT Change

`confirmOrder` is already imported and exported in `tools/index.ts` and present in `allTools`. Adding it again will break the build. **Do not touch `tools/index.ts`**.

### CRITICAL: tools.test.ts — Do NOT Change tool count

Tool count is already `toHaveLength(9)` from Story 2.7 (9 tools: collectPhotos, selectStyle, confirmOrder, generatePayment, enqueueGeneration, deliverImage, handleRevision, getGreetingContext, collectOutfit). `confirmOrder` is already counted. **Do not modify the count**.

### Exact File Locations

- **Replace**: `packages/bot-engine/src/tools/confirm-order.ts` (stub → full implementation)
- **Create**: `packages/bot-engine/src/tools/confirm-order.test.ts`
- **Modify**: `packages/bot-engine/src/prompts/system-prompt.ts` (add CONFIRMING_ORDER block)
- **Modify**: `packages/bot-engine/src/prompts/system-prompt.test.ts` (add 1 test)
- **Do NOT touch**: `packages/bot-engine/src/tools/index.ts`
- **Do NOT touch**: `packages/bot-engine/src/tools/tools.test.ts`

### AI SDK v6: `inputSchema` NOT `parameters`

```typescript
// CORRECT (AI SDK v6):
export const confirmOrder = tool({
  description: "...",
  inputSchema: z.object({ ... }),
  execute: async (input) => { ... },
});
// WRONG: parameters: z.object({...})  ← DO NOT use (this was the architecture doc's example but it's outdated)
```

The existing stub already uses `inputSchema` correctly. The architecture doc shows `parameters` — **ignore that, the codebase uses `inputSchema`**.

### Order Summary Message Format

Build the summary using data from `order` (with `client` joined):

```typescript
function buildSummary(order: Order & { client: Client }): string {
  const clientName = order.client.name ?? "não informado";
  const theme = order.theme ?? "não selecionado";
  const outfit = order.outfitDescription ?? "sem roupa especial";
  const extras = order.extraRequests ?? "sem extras";
  const photoCount = order.photosUrls.length;
  const price = "R$29,90";

  return [
    `📋 *Resumo do seu pedido:*`,
    ``,
    `👶 *Cliente:* ${clientName}`,
    `🎨 *Tema:* ${theme}`,
    `👗 *Roupa:* ${outfit}`,
    `✨ *Extras:* ${extras}`,
    `📸 *Fotos:* ${photoCount} foto(s) recebida(s)`,
    `💰 *Valor:* ${price}`,
    ``,
    `Está tudo certinho? Me diz "Confirmar ✅" para seguir ou "Quero alterar ✏️" para mudar algo!`,
  ].join("\n");
}
```

### Full `confirmOrder` Implementation Reference

```typescript
import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { updateOrderState } from "../conversation";

const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const confirmOrder = tool({
  description: "Present order summary and process client confirmation. Call when in CONFIRMING_ORDER state to show summary (confirmed=false, alterRequest=null), when client confirms (confirmed=true), or when client wants to alter (confirmed=false, alterRequest='...').",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
    confirmed: z.boolean().describe("True if client confirmed the order, false if showing summary or client wants to alter"),
    alterRequest: z.string().nullable().optional().describe("What the client wants to change, only set when confirmed=false and client explicitly requested an alteration"),
  }),
  execute: async ({ orderId, confirmed, alterRequest }) => {
    // UUID validation — reject non-UUID orderId before any DB call
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(JSON.stringify({ level: "warn", event: "confirm_order_invalid_id", orderId, service: "bot-engine" }));
      return { success: false, message: "ID de pedido inválido." };
    }

    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId }, include: { client: true } });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "confirm_order_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao buscar pedido. Tente novamente." };
    }

    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    // Guard wrong conversation state
    if (order.conversationState !== "CONFIRMING_ORDER") {
      console.log(JSON.stringify({ level: "warn", event: "confirm_order_wrong_state", orderId, state: order.conversationState, service: "bot-engine" }));
      return { success: false, message: "Estado inválido para confirmação." };
    }

    // Client wants to alter something
    if (!confirmed && alterRequest) {
      console.log(JSON.stringify({ level: "info", event: "order_alter_requested", orderId, alterRequest, service: "bot-engine" }));
      return {
        success: true,
        confirmed: false,
        alterRequest,
        message: "Claro! O que você gostaria de alterar? ✏️ Me diga o que mudar e eu corrijo agora!",
      };
    }

    // Initial summary presentation (confirmed=false, alterRequest null/undefined)
    if (!confirmed) {
      const clientName = order.client.name ?? "não informado";
      const theme = order.theme ?? "não selecionado";
      const outfit = order.outfitDescription ?? "sem roupa especial";
      const extras = order.extraRequests ?? "sem extras";
      const photoCount = order.photosUrls.length;

      const summary = [
        `📋 *Resumo do seu pedido:*`,
        ``,
        `👶 *Cliente:* ${clientName}`,
        `🎨 *Tema:* ${theme}`,
        `👗 *Roupa:* ${outfit}`,
        `✨ *Extras:* ${extras}`,
        `📸 *Fotos:* ${photoCount} foto(s) recebida(s)`,
        `💰 *Valor:* R$29,90`,
        ``,
        `Está tudo certinho? Me diz "Confirmar ✅" para seguir ou "Quero alterar ✏️" para mudar algo!`,
      ].join("\n");

      console.log(JSON.stringify({ level: "info", event: "order_summary_presented", orderId, photoCount, service: "bot-engine" }));

      return {
        success: true,
        confirmed: false,
        summary,
        message: summary,
      };
    }

    // confirmed === true: transition to AWAITING_PAYMENT
    try {
      await updateOrderState(orderId, "CONFIRMING_ORDER", "AWAITING_PAYMENT");
    } catch (stateErr) {
      console.log(JSON.stringify({ level: "error", event: "confirm_order_state_transition_error", orderId, from: "CONFIRMING_ORDER", to: "AWAITING_PAYMENT", error: stateErr instanceof Error ? stateErr.message : String(stateErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao confirmar pedido. Tente novamente." };
    }

    console.log(JSON.stringify({ level: "info", event: "order_confirmed", orderId, service: "bot-engine" }));

    return {
      success: true,
      confirmed: true,
      message: "Pedido confirmado! 🎉 Agora vou gerar o seu PIX para pagamento...",
    };
  },
});
```

### Key Difference from Other Tools: `updateOrderState` is FATAL here

In Story 2.7 (`collectOutfit`), `updateOrderState` was non-fatal (try/catch, log, continue). For `confirmOrder`, the transition CONFIRMING_ORDER → AWAITING_PAYMENT is **critical** — if it fails, we must NOT tell the client their order is confirmed (that would trigger payment that can't be tracked). So **the error is fatal** — return `{ success: false }` on transition failure.

### Order.photosUrls is String[] (not a count)

The schema uses `photosUrls String[]`. Access count via `order.photosUrls.length`. The `include: { client: true }` join is needed to get `client.name` for the summary.

### State Transition Scope (Complete Epic 2 Map)

```
Story 2.1: (webhook entry) → GREETING
Story 2.2: state machine + persistence
Story 2.3: agent scaffolding (stubs for all tools)
Story 2.4: GREETING → COLLECTING_PHOTOS (via getGreetingContext)
Story 2.5: COLLECTING_PHOTOS → COLLECTING_THEME (via collectPhotos)
Story 2.6: COLLECTING_THEME → COLLECTING_OUTFIT (via selectStyle)
Story 2.7: COLLECTING_OUTFIT → CONFIRMING_ORDER (via collectOutfit, phase="extras")
Story 2.8: CONFIRMING_ORDER → AWAITING_PAYMENT (via confirmOrder, confirmed=true)  ← THIS STORY
Epic 3:    AWAITING_PAYMENT → payment + generation pipeline
```

### Alter Flow — No State Reversion in This Tool

When `confirmed=false` with `alterRequest`, the AI agent must:
1. Call `confirmOrder(confirmed: false, alterRequest: "...")` → get back the alter message
2. Determine which state to revert to based on what the client wants to change:
   - Photos → `updateOrderState(CONFIRMING_ORDER, COLLECTING_PHOTOS)` then agent calls `collectPhotos`
   - Theme → `updateOrderState(CONFIRMING_ORDER, COLLECTING_THEME)` then agent calls `selectStyle`
   - Outfit/Extras → `updateOrderState(CONFIRMING_ORDER, COLLECTING_OUTFIT)` then agent calls `collectOutfit`
3. The `confirmOrder` tool does NOT perform the reversion itself — the AI agent handles this via its instructions in the system prompt

**NOTE:** The state machine must allow the reverse transitions (CONFIRMING_ORDER → COLLECTING_*). Check `packages/bot-engine/src/state-machine.ts` to verify these transitions are valid — if not, you may need to add them. Do NOT assume they exist.

### State Machine — Check Before Running

```bash
# Check what transitions are allowed from CONFIRMING_ORDER:
grep -A 5 "CONFIRMING_ORDER" mascotinhos/packages/bot-engine/src/state-machine.ts
```

If `CONFIRMING_ORDER → COLLECTING_PHOTOS/THEME/OUTFIT` transitions are missing, add them. The alter flow requires these reverse transitions.

### Mock Pattern (Follow collect-outfit.test.ts Exactly)

```typescript
import { describe, expect, it, mock, beforeEach } from "bun:test";

// TEST_ORDER_ID: use any valid UUID v4 string here
const TEST_ORDER_ID = crypto.randomUUID(); // or hardcode a valid UUID literal

// IMPORTANT: mock.module() BEFORE any module imports
const mockFindUnique = mock(() =>
  Promise.resolve({
    id: TEST_ORDER_ID,
    conversationState: "CONFIRMING_ORDER",
    photosUrls: ["path/photo1.jpg", "path/photo2.jpg"],
    theme: "Disney 3D",
    outfitDescription: "vestido azul",
    extraRequests: "balão amarelo",
    client: { id: "client-1", name: "Maria" },
  }),
);

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique },
  },
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Static import AFTER all mock.module() calls
import { confirmOrder } from "./confirm-order";

describe("confirmOrder", () => {
  beforeEach(() => {
    mockFindUnique.mockClear();
    mockUpdateOrderState.mockClear();

    // Reset defaults
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "CONFIRMING_ORDER",
        photosUrls: ["path/photo1.jpg", "path/photo2.jpg"],
        theme: "Disney 3D",
        outfitDescription: "vestido azul",
        extraRequests: "balão amarelo",
        client: { id: "client-1", name: "Maria" },
      }),
    );
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(true));
  });
  // ... tests
});
```

### Structured Logging Pattern

```typescript
// Summary presented
console.log(JSON.stringify({ level: "info", event: "order_summary_presented", orderId, photoCount, service: "bot-engine" }));

// Order confirmed
console.log(JSON.stringify({ level: "info", event: "order_confirmed", orderId, service: "bot-engine" }));

// Alter requested
console.log(JSON.stringify({ level: "info", event: "order_alter_requested", orderId, alterRequest, service: "bot-engine" }));

// Wrong state
console.log(JSON.stringify({ level: "warn", event: "confirm_order_wrong_state", orderId, state: order.conversationState, service: "bot-engine" }));

// DB error
console.log(JSON.stringify({ level: "error", event: "confirm_order_db_error", orderId, error: "...", service: "bot-engine" }));

// State transition error
console.log(JSON.stringify({ level: "error", event: "confirm_order_state_transition_error", orderId, from: "CONFIRMING_ORDER", to: "AWAITING_PAYMENT", error: "...", service: "bot-engine" }));
```

### Key Patterns From Previous Stories (Mandatory — Do NOT Reinvent)

1. **`inputSchema`** not `parameters` — AI SDK v6 (enforced throughout Epic 2)
2. **`mock.module()` BEFORE static imports** — bun test mocking requirement (confirmed critical in Story 2.7)
3. **UUID validation with regex** before DB calls — added in Story 2.7 review (security fix)
4. **Wrong state guard** — added in Story 2.7 review (prevent silent data corruption)
5. **Structured JSON logging** — `JSON.stringify({ level, event, service: "bot-engine", ...})` always
6. **DB error handling** — wrap each DB call in try/catch; return `{ success: false, message }` on failure
7. **No `process.env` directly** — use `@mascotinhos/env/server` for env vars
8. **`updateOrderState` import** from `../conversation` — already exists and is battle-tested
9. **`include: { client: true }`** in `findUnique` — needed to get client name for summary
10. **`confirmOrder` is FATAL on state transition** — unlike `collectOutfit`'s non-fatal pattern; payment integrity requires confirmed transition

### Test Count Context

- Before Story 2.7: 80 pass (per story-2.7 dev notes)
- After Story 2.7 review: 82 pass (2 new security tests added)
- Current (at story 2.8 start): 50 pass, 4 fail (4 pre-existing env/DB failures — these are environment issues in CI, not test logic errors; do NOT attempt to fix them)
- **Your tests should add new passing tests on top of existing count**

### GitHub Issue Reference

Story 2.8 GitHub Issue: [mgiovani/fotos#52](https://github.com/mgiovani/fotos/issues/52)

### References

- `.bmad_output/planning-artifacts/epics.md` — Epic 2, Story 2.8 (AC, FRs, technical notes)
- `.bmad_output/planning-artifacts/architecture.md` — Tool Inventory, State Machine, Data Patterns
- `.bmad_output/implementation-artifacts/story-2.7.md` — Previous story (security patterns, mock setup, review findings)
- `mascotinhos/packages/bot-engine/src/tools/confirm-order.ts` — Stub to replace
- `mascotinhos/packages/bot-engine/src/tools/collect-outfit.ts` — Implementation reference (two-phase pattern)
- `mascotinhos/packages/bot-engine/src/tools/collect-outfit.test.ts` — Test mock pattern to follow exactly
- `mascotinhos/packages/bot-engine/src/tools/select-style.test.ts` — Alternative mock pattern reference
- `mascotinhos/packages/bot-engine/src/tools/index.ts` — DO NOT MODIFY (confirmOrder already there)
- `mascotinhos/packages/bot-engine/src/tools/tools.test.ts` — DO NOT MODIFY (count already 9)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` — Add CONFIRMING_ORDER block
- `mascotinhos/packages/bot-engine/src/conversation.ts` — `updateOrderState` function
- `mascotinhos/packages/bot-engine/src/state-machine.ts` — **CHECK transitions from CONFIRMING_ORDER before implementing alter flow**
- `mascotinhos/packages/db/prisma/schema/schema.prisma` — Order model (photosUrls, theme, outfitDescription, extraRequests, conversationState)

## File List

- `mascotinhos/packages/bot-engine/src/tools/confirm-order.ts` — **replaced** (stub → full implementation)
- `mascotinhos/packages/bot-engine/src/tools/confirm-order.test.ts` — **created** (10 new tests)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` — **modified** (added CONFIRMING_ORDER state instructions block)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.test.ts` — **modified** (added 1 CONFIRMING_ORDER test)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` — **modified** (status: ready-for-dev → review)

## Review Findings (2026.03.30)

Adversarial + edge-case + acceptance audit. 3 HIGH/MEDIUM patches applied; 1 deferred item.

### MEDIUM-1 — Race condition: `updateOrderState` return value ignored (FIXED)
**File:** `confirm-order.ts` lines 119–135
**Issue:** `updateOrderState` returns `boolean` — `false` means 0 rows matched (another process already transitioned the state). The original code discarded the return value and unconditionally returned `{ success: true, confirmed: true }`, falsely claiming the order was confirmed even when the DB state was unchanged. For payment integrity, this is a critical semantic gap.
**Fix:** Capture the return value; if `false`, return `{ success: false, message: "Pedido já foi confirmado ou estado mudou..." }` and log `confirm_order_already_transitioned` warn.

### MEDIUM-2 — Log injection / flooding via unbounded `alterRequest` (FIXED)
**File:** `confirm-order.ts` line 70
**Issue:** `alterRequest` was echoed verbatim into the structured JSON log. A misbehaving LLM or a crafted input could inject a 10,000-char string into logs or embed newlines/JSON control chars that corrupt log parsers.
**Fix:** Truncate to 300 chars (`slice(0, 300)`) before logging and before including in the return value.

### MEDIUM-3 — Null `order.client` causes unhandled TypeError in summary path (FIXED)
**File:** `confirm-order.ts` line 82
**Issue:** `include: { client: true }` tells Prisma's TypeScript types that `client` is always present, but at runtime an orphaned order (client deleted) returns `client: null`. The original `order.client.name` access would throw `TypeError: Cannot read properties of null`, which escapes the outer try/catch (that only wraps `findUnique`) and propagates as an unhandled exception.
**Fix:** Use optional chaining `order.client?.name ?? "não informado"`.

### Tests added (3 new, 96 total)
- `updateOrderState returns false (race condition) → { success: false }`
- `alterRequest > 300 chars is truncated to 300 chars in returned alterRequest`
- `null client relation → summary shows "não informado" without throwing`

## Change Log

- 2026-03-30: Implemented `confirmOrder` tool replacing stub — full UUID validation, order summary presentation, alter path, confirmation flow, DB/state-transition error handling, and structured JSON logging (Story 2.8)
- 2026-03-30: Added CONFIRMING_ORDER instructions block to system prompt (after COLLECTING_OUTFIT block)
- 2026-03-30: Created `confirm-order.test.ts` with 10 tests covering all 8 ACs; added 1 system-prompt test — 93 total passing, 0 regressions
- 2026-03-30: Applied code review patches — race condition guard, alterRequest truncation, null client safety — 96 total tests, 0 regressions

## Dev Agent Record

### Implementation Plan

1. Verified state machine already has CONFIRMING_ORDER → COLLECTING_* reverse transitions (no changes needed)
2. Replaced stub `confirm-order.ts` with full implementation following the Dev Notes reference exactly:
   - UUID regex guard before any DB call
   - `findUnique` with `include: { client: true }` in try/catch
   - Wrong-state guard (CONFIRMING_ORDER check)
   - Three execution branches: alter-request, summary presentation, confirmation
   - Fatal error handling on state transition (unlike collectOutfit's non-fatal pattern)
   - All 6 structured log events
3. Added CONFIRMING_ORDER instructions block to system-prompt.ts between COLLECTING_OUTFIT and COLLECTING_PHOTOS blocks
4. Created test file following collect-outfit.test.ts mock pattern exactly (mock.module before imports, valid UUID constant, beforeEach reset)
5. Added system-prompt test for CONFIRMING_ORDER state

### Completion Notes

All 4 tasks and all subtasks completed. 93 tests pass (10 new, 0 regressions). Type-check passes with 0 new errors (only pre-existing errors in collect-photos.ts and payments package, as documented in Dev Notes). All 8 ACs verified via tests. story-2.8 implements the final state in Epic 2's conversation flow: CONFIRMING_ORDER → AWAITING_PAYMENT.
