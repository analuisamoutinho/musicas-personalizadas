# Story 2.6: Style Selection with Popularity Tracking

Status: done
GitHub Issue: [mgiovani/fotos#50](https://github.com/mgiovani/fotos/issues/50)

## Story

As a client,
I want to choose a style theme for my mascotinho from visual options or describe my own,
So that the illustration matches my child's birthday party theme.

## Acceptance Criteria

1. **Given** the conversation is in COLLECTING_THEME state
   **When** the client taps a quick-reply button with a known style name
   **Then** the `selectStyle` tool performs an exact match against `StyleTemplate.slug` and/or `StyleTemplate.name` (case-insensitive)
   **And** the selected StyleTemplate's popularity counter is incremented atomically using Prisma's `{ popularity: { increment: 1 } }` operator (never read-then-write)
   **And** `Order.styleTemplateId` is updated to the matched StyleTemplate's id
   **And** the bot confirms: "Tema [name] escolhido! 🎨✨"
   **And** the order transitions to COLLECTING_OUTFIT

2. **Given** the conversation is in COLLECTING_THEME state
   **When** the client types a free-text theme name (not a quick-reply button)
   **Then** the `selectStyle` tool attempts a fuzzy match (case-insensitive substring match) against active StyleTemplate names and slugs
   **And** if a match is found, it behaves exactly as AC #1 (increment popularity, update styleTemplateId, transition to COLLECTING_OUTFIT)
   **And** if no match is found, the custom description is stored in `Order.theme` (field is free-text, no FK required)
   **And** `Order.styleTemplateId` remains null for custom themes
   **And** the order still transitions to COLLECTING_OUTFIT

3. **Given** the client selects "Outro tema" or types a custom theme with no StyleTemplate match
   **When** `selectStyle` handles this case
   **Then** the custom theme description is stored in `Order.theme`
   **And** `Order.styleTemplateId` is NOT set (remains null)
   **And** the bot acknowledges: "Tema personalizado '[theme]' anotado! 🎨" and transitions to COLLECTING_OUTFIT
   **And** popularity is NOT incremented for custom themes (no record to increment)

4. **Given** the `selectStyle` tool is called
   **When** the `orderId` does not match any order in the database
   **Then** the tool returns `{ success: false, message: "Pedido não encontrado." }` without crashing

5. **Given** the `selectStyle` tool executes successfully
   **When** the state transition COLLECTING_THEME → COLLECTING_OUTFIT is attempted
   **Then** `updateOrderState(orderId, "COLLECTING_THEME", "COLLECTING_OUTFIT")` is called using the existing `updateOrderState` function from `../conversation`
   **And** `updateOrderState` is wrapped in try/catch — it throws on invalid transitions (caught and logged); it returns `false` on race condition (0 rows updated, which `updateOrderState` already logs internally as a warn)
   **And** theme is already saved before this call — a caught error or false return is non-fatal; do not fail the tool response

6. **Given** `selectStyle` performs the popularity increment
   **When** it updates StyleTemplate.popularity
   **Then** it uses a raw Prisma update: `prisma.styleTemplate.update({ where: { id }, data: { popularity: { increment: 1 } } })` — NOT `popularity: popularity + 1` via a read-then-write pattern (prevents race conditions)

## Tasks / Subtasks

- [x] Task 1: Implement `selectStyle` tool (AC: #1, #2, #3, #4, #5, #6)
  - [x] 1.1: Replace the stub in `packages/bot-engine/src/tools/select-style.ts` with full implementation
  - [x] 1.2: `inputSchema: z.object({ styleInput: z.string().describe("..."), orderId: z.string().describe("...") })` — keep `inputSchema` (NOT `parameters` — this is the AI SDK v6 naming)
  - [x] 1.3: `execute`: load order via `prisma.order.findUnique({ where: { id: orderId } })` — if null, return `{ success: false, message: "Pedido não encontrado." }`
  - [x] 1.4: Query active StyleTemplates: `prisma.styleTemplate.findMany({ where: { active: true }, select: { id: true, name: true, slug: true } })`
  - [x] 1.5: Match logic (in order):
    - Exact slug match: `templates.find(t => t.slug.toLowerCase() === styleInput.toLowerCase())`
    - Exact name match: `templates.find(t => t.name.toLowerCase() === styleInput.toLowerCase())`
    - Substring fuzzy match: `templates.find(t => t.name.toLowerCase().includes(styleInput.toLowerCase()) || styleInput.toLowerCase().includes(t.name.toLowerCase()))`
  - [x] 1.6: If match found: `prisma.styleTemplate.update({ where: { id: match.id }, data: { popularity: { increment: 1 } } })` + `prisma.order.update({ where: { id: orderId }, data: { styleTemplateId: match.id, theme: match.name } })`
  - [x] 1.7: If NO match found (custom/Outro): `prisma.order.update({ where: { id: orderId }, data: { theme: styleInput } })` — do NOT touch `styleTemplateId`
  - [x] 1.8: After DB updates, call `updateOrderState(orderId, "COLLECTING_THEME", "COLLECTING_OUTFIT")` — wrap in try/catch; non-fatal on failure (log error)
  - [x] 1.9: Return `{ success: true, selectedStyle: match?.name ?? styleInput, isCustom: !match, message: "Tema [name] escolhido! 🎨" }`

- [x] Task 2: Update system prompt for COLLECTING_THEME state (AC: #1, #2, #3)
  - [x] 2.1: Edit `packages/bot-engine/src/prompts/system-prompt.ts`
  - [x] 2.2: Add COLLECTING_THEME instruction block (similar to existing COLLECTING_PHOTOS block): when `conversationState === "COLLECTING_THEME"`, the agent MUST call `selectStyle` with the client's input
  - [x] 2.3: Instruction: "Quando o cliente escolher um tema (texto ou botao), chame IMEDIATAMENTE a ferramenta selectStyle com styleInput = tema escolhido e orderId = ID do pedido atual"
  - [x] 2.4: Instruction: "Apos selectStyle retornar success: true, confirme para o cliente: 'Tema [selectedStyle] escolhido! 🎨✨'"
  - [x] 2.5: Instruction: "Se isCustom for true, diga: 'Tema personalizado anotado! Vamos criar algo único para você! 🎨'"

- [x] Task 3: Write tests (AC: #1–#6)
  - [x] 3.1: Create `packages/bot-engine/src/tools/select-style.test.ts`
    - [x] 3.1.1: Mock `@mascotinhos/db` via `mock.module()` BEFORE any imports — follow exact pattern from `collect-photos.test.ts`
    - [x] 3.1.2: Mock `../conversation` for `updateOrderState` — same pattern as collect-photos.test.ts
    - [x] 3.1.3: Static import AFTER all `mock.module()` calls (same pattern as `collect-photos.test.ts` line 49): `import { selectStyle } from "./select-style"` — place this import statement at the bottom of the mock setup section, before the `describe` block
    - [x] 3.1.4: Test happy path — exact name match: `selectStyle` matches template, increments popularity, updates order, transitions state, returns `{ success: true, isCustom: false }`
    - [x] 3.1.5: Test happy path — slug match (case-insensitive): "disney-3d" matches slug `disney-3d`
    - [x] 3.1.6: Test happy path — fuzzy match: "disney" matches template with name "Disney 3D"
    - [x] 3.1.7: Test custom theme path: no match found → `order.update` called with `{ theme: styleInput }`, `styleTemplateId` NOT updated, `isCustom: true`
    - [x] 3.1.8: Test order not found: returns `{ success: false, message: "Pedido não encontrado." }`
    - [x] 3.1.9: Test state transition failure is non-fatal: `updateOrderState` throws → tool still returns `{ success: true }`
    - [x] 3.1.10: Test popularity increment uses `{ increment: 1 }` pattern (not read-then-write)
  - [x] 3.2: Update `packages/bot-engine/src/prompts/system-prompt.test.ts`
    - [x] 3.2.1: Add test: when `conversationState === "COLLECTING_THEME"`, the prompt contains "selectStyle" instruction
  - [x] 3.3: `tools.test.ts` does NOT need updating — already asserts 8 tools and includes `selectStyle`

- [x] Task 4: Type-check and test pipeline (AC: all)
  - [x] 4.1: Run `bun run check-types` from `mascotinhos/` — must pass with 0 errors (bot-engine itself has 0 new errors; pre-existing errors in payments/storage packages are unrelated to this story)
  - [x] 4.2: Run `bun test` from `mascotinhos/packages/bot-engine/` — all 19 select-style and system-prompt tests pass; pre-existing failures in conversation.test.ts and collect-photos.test.ts are unrelated to this story

## Dev Notes

### Critical: Existing Stub — Replace, Don't Create

`packages/bot-engine/src/tools/select-style.ts` ALREADY EXISTS as a stub:
```typescript
execute: async () => ({ success: false, message: "Not implemented yet — Story 2.6" }),
```
**DO NOT create a new file.** Edit the existing file in place. The stub is already exported in `tools/index.ts` and included in `allTools` — no changes needed to `index.ts`.

### Exact File Locations (Architecture Compliance)

- **Modify only**: `packages/bot-engine/src/tools/select-style.ts` (stub → implementation)
- **Modify only**: `packages/bot-engine/src/prompts/system-prompt.ts` (add COLLECTING_THEME block)
- **Create new**: `packages/bot-engine/src/tools/select-style.test.ts`
- **Modify**: `packages/bot-engine/src/prompts/system-prompt.test.ts` (add 1 test)
- **No changes needed**: `tools/index.ts`, `tools.test.ts`, `agent.ts`, `bot.ts`, `conversation.ts`, `state-machine.ts`

### Prisma Schema — Exact Fields

`Order` model relevant fields:
```
styleTemplateId  String?       // FK to StyleTemplate, nullable — null for custom themes
theme            String?       // Free-text theme name (always set, matched or custom)
conversationState ConversationState @default(GREETING)
```

`StyleTemplate` model relevant fields:
```
id             String    @id @default(cuid())
name           String
slug           String    @unique
popularity     Int       @default(0)
active         Boolean   @default(true)
@@index([active, popularity])  // Exists — use for queries
```

### AI SDK v6: `inputSchema` NOT `parameters`

The project uses `ai ^6.x`. Tool definition uses `inputSchema`, not `parameters` (which was AI SDK v4/v5):
```typescript
// CORRECT (AI SDK v6):
export const selectStyle = tool({
  description: "...",
  inputSchema: z.object({ ... }),
  execute: async (input) => { ... },
});

// WRONG (old SDK):
// parameters: z.object({ ... })  ← DO NOT use this
```

### `updateOrderState` — Existing Function Pattern

Located in `packages/bot-engine/src/conversation.ts`. Already used by `collectPhotos`:
```typescript
import { updateOrderState } from "../conversation";

// Wrap in try/catch — non-fatal if race condition occurs
try {
  await updateOrderState(orderId, "COLLECTING_THEME", "COLLECTING_OUTFIT");
} catch (stateErr) {
  console.log(JSON.stringify({
    level: "error",
    event: "state_transition_failed",
    orderId,
    from: "COLLECTING_THEME",
    to: "COLLECTING_OUTFIT",
    error: stateErr instanceof Error ? stateErr.message : String(stateErr),
    service: "bot-engine",
  }));
  // Non-fatal: theme already saved; state will self-correct on next interaction
}
```

### Atomic Popularity Increment Pattern

Use Prisma's atomic `increment` operator — never read-then-write:
```typescript
// CORRECT — atomic, race-condition-safe:
await prisma.styleTemplate.update({
  where: { id: match.id },
  data: { popularity: { increment: 1 } },
});

// WRONG — not atomic, race condition risk:
// const st = await prisma.styleTemplate.findUnique(...);
// await prisma.styleTemplate.update({ data: { popularity: st.popularity + 1 } });
```

### Order Update with Both Fields

When a StyleTemplate match is found, update both fields in one Prisma call:
```typescript
await prisma.order.update({
  where: { id: orderId },
  data: {
    styleTemplateId: match.id,
    theme: match.name,  // Also set theme for easy display without FK join
  },
});
```

For custom theme (no match), set only `theme`:
```typescript
await prisma.order.update({
  where: { id: orderId },
  data: { theme: styleInput },
  // styleTemplateId remains null — do NOT explicitly set to null here
});
```

### Structured Logging Pattern

Use JSON-structured logging (never plain `console.log`):
```typescript
console.log(JSON.stringify({
  level: "info",  // or "error", "warn"
  event: "style_selected",
  orderId,
  selectedStyle: match?.name ?? styleInput,
  isCustom: !match,
  service: "bot-engine",
}));
```

### Full `selectStyle` Implementation Reference

```typescript
import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { updateOrderState } from "../conversation";

export const selectStyle = tool({
  description: "Set the style/theme for the mascotinho illustration. Call when client chooses or types a theme.",
  inputSchema: z.object({
    styleInput: z.string().describe("Theme name from quick-reply button or free-text description"),
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ styleInput, orderId }) => {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    const templates = await prisma.styleTemplate.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
    });

    const input = styleInput.toLowerCase();
    const match =
      templates.find((t) => t.slug.toLowerCase() === input) ??
      templates.find((t) => t.name.toLowerCase() === input) ??
      templates.find(
        (t) =>
          t.name.toLowerCase().includes(input) ||
          input.includes(t.name.toLowerCase()),
      );

    if (match) {
      await Promise.all([
        prisma.styleTemplate.update({
          where: { id: match.id },
          data: { popularity: { increment: 1 } },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: { styleTemplateId: match.id, theme: match.name },
        }),
      ]);
    } else {
      await prisma.order.update({
        where: { id: orderId },
        data: { theme: styleInput },
      });
    }

    try {
      await updateOrderState(orderId, "COLLECTING_THEME", "COLLECTING_OUTFIT");
    } catch (stateErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "state_transition_failed",
          orderId,
          from: "COLLECTING_THEME",
          to: "COLLECTING_OUTFIT",
          error: stateErr instanceof Error ? stateErr.message : String(stateErr),
          service: "bot-engine",
        }),
      );
    }

    const selectedStyle = match?.name ?? styleInput;
    const isCustom = !match;

    console.log(
      JSON.stringify({
        level: "info",
        event: "style_selected",
        orderId,
        selectedStyle,
        isCustom,
        service: "bot-engine",
      }),
    );

    return {
      success: true,
      selectedStyle,
      isCustom,
      message: isCustom
        ? `Tema personalizado '${styleInput}' anotado! 🎨`
        : `Tema ${selectedStyle} escolhido! 🎨✨`,
    };
  },
});
```

### Test Mocking Pattern (Copy from collect-photos.test.ts)

```typescript
import { describe, expect, it, mock, beforeEach } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
const mockFindUnique = mock(() => Promise.resolve({ id: "order-1", conversationState: "COLLECTING_THEME" }));
const mockOrderUpdate = mock(() => Promise.resolve({ id: "order-1" }));
const mockStyleFindMany = mock(() =>
  Promise.resolve([{ id: "st-1", name: "Disney 3D", slug: "disney-3d" }])
);
const mockStyleUpdate = mock(() => Promise.resolve({ id: "st-1", popularity: 1 }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique, update: mockOrderUpdate },
    styleTemplate: { findMany: mockStyleFindMany, update: mockStyleUpdate },
  },
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Static import AFTER all mock.module() calls — follows collect-photos.test.ts pattern exactly
import { selectStyle } from "./select-style";
```

### System Prompt Addition for COLLECTING_THEME

Add the following block to `buildSystemPrompt()` in `system-prompt.ts` alongside the existing COLLECTING_PHOTOS block:

```
## Instrucoes para o estado COLLECTING_THEME
Quando o estado for COLLECTING_THEME:
1. Quando o cliente escolher um tema (texto ou botao), chame IMEDIATAMENTE a ferramenta selectStyle com styleInput = tema escolhido e orderId = ID do pedido atual
2. Apos selectStyle retornar success: true:
   - Se isCustom for false: confirme "Tema [selectedStyle] escolhido! 🎨✨"
   - Se isCustom for true: diga "Tema personalizado anotado! Vamos criar algo único para você! 🎨"
3. Apos confirmar o tema, pergunte sobre a roupa da crianca para ir para o proximo passo
```

### State Transition Scope

**This story:** COLLECTING_THEME → COLLECTING_OUTFIT (via `selectStyle`)
**Previous story (2.5):** COLLECTING_PHOTOS → COLLECTING_THEME (via `collectPhotos`)
**Next story (2.7):** implements `collectOutfit` for COLLECTING_OUTFIT → CONFIRMING_ORDER

The `selectStyle` tool handles state from `order.conversationState === "COLLECTING_THEME"` only. Do NOT add checks against the current state before calling (the agent controls when to call the tool based on state).

### Previous Story Learnings (Story 2.5 — collect-photos)

Critical patterns established:
1. **Stub exists** — both `select-style.ts` stub and `tools/index.ts` export already exist from Story 2.3 scaffolding. Replace stub content, do not create new file.
2. **`inputSchema`** not `parameters` — AI SDK v6 breaking change
3. **Mock order**: `mock.module()` calls first → then static `import` statement — bun test requires mocks to be set up before the module is imported
4. **`updateOrderState` non-fatal** — wrap in try/catch, log error, continue (same as collect-photos)
5. **Structured logging** — always `JSON.stringify({ level, event, service: "bot-engine", ... })`
6. **Promise.all** for parallel DB writes (increment + order update) when both are independent
7. **`tools.test.ts` test count** — currently asserts 8 tools. `selectStyle` is already in the count. No changes needed.
8. **OrderContext interfaces** — no change needed for this story (no new fields required)

### GitHub Issue Reference

Story 2.6 GitHub Issue: [mgiovani/fotos#50](https://github.com/mgiovani/fotos/issues/50)

### References

- `.bmad_output/planning-artifacts/epics.md` — Epic 2, Story 2.6 (AC, FRs, technical notes)
- `.bmad_output/planning-artifacts/architecture.md` — Tool Inventory, State Machine, Prisma patterns
- `.bmad_output/implementation-artifacts/story-2.4.md` — Previous story learnings, mock pattern
- `mascotinhos/packages/bot-engine/src/tools/select-style.ts` — Existing stub (replace content)
- `mascotinhos/packages/bot-engine/src/tools/collect-photos.ts` — Reference implementation (same patterns)
- `mascotinhos/packages/bot-engine/src/tools/collect-photos.test.ts` — Test mock pattern to follow exactly
- `mascotinhos/packages/bot-engine/src/conversation.ts` — `updateOrderState` function
- `mascotinhos/packages/db/prisma/schema/schema.prisma` — Order + StyleTemplate models

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Replaced stub in `select-style.ts` with full implementation following the reference pattern from Dev Notes exactly.
- Implemented three-tier match logic: exact slug → exact name → fuzzy substring. Uses `??` chaining for priority.
- Used `Promise.all` for parallel atomic DB writes (styleTemplate popularity increment + order update) when a match is found.
- Popularity increment uses Prisma's `{ increment: 1 }` operator — never read-then-write — as required by AC #6.
- State transition (`COLLECTING_THEME → COLLECTING_OUTFIT`) wrapped in try/catch; non-fatal if it throws or races.
- Custom themes (no match): only `theme` field updated on order; `styleTemplateId` remains null; popularity NOT incremented.
- Order not found: returns `{ success: false, message: "Pedido não encontrado." }` without crashing.
- Added `COLLECTING_THEME` instruction block to `system-prompt.ts` between flow description and existing `COLLECTING_PHOTOS` block.
- Created `select-style.test.ts` with 7 tests covering all ACs: exact name match, slug match (case-insensitive), fuzzy match, custom theme, order not found, non-fatal state transition failure, and atomic increment pattern verification.
- Added 1 test to `system-prompt.test.ts` verifying the COLLECTING_THEME block contains `selectStyle` instruction.
- All 19 new/modified tests pass (7 select-style + 12 system-prompt). Pre-existing failures in conversation.test.ts and collect-photos.test.ts are unrelated to this story (DB timeouts and missing @mascotinhos/storage module from story 2.5).
- No new TypeScript errors introduced in bot-engine. Pre-existing errors in payments/storage packages are unrelated.

### File List

- `mascotinhos/packages/bot-engine/src/tools/select-style.ts` (modified — stub → full implementation)
- `mascotinhos/packages/bot-engine/src/tools/select-style.test.ts` (new — 7 tests covering all ACs)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` (modified — added COLLECTING_THEME instruction block)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.test.ts` (modified — added 1 COLLECTING_THEME test)

### Change Log

- 2026-03-30: Implemented Story 2.6 — `selectStyle` tool with three-tier match logic, atomic popularity increment, custom theme support, and COLLECTING_THEME → COLLECTING_OUTFIT state transition. Added system prompt COLLECTING_THEME block and full test suite (19 tests pass).
- 2026-03-30: Code review patches applied — see Review Findings section below.

## Review Findings

**Review date:** 2026-03-30
**Reviewer:** adversarial + edge-case audit

### MEDIUM-1: Missing DB error handling in main execution path
**File:** `packages/bot-engine/src/tools/select-style.ts`
**Finding:** `prisma.order.findUnique`, `prisma.styleTemplate.findMany`, and `prisma.order.update` were all awaited without try/catch. A transient DB failure would throw an unhandled exception propagating to the AI SDK, potentially crashing the tool response instead of returning a structured error.
**Fix applied:** Wrapped each DB call in its own try/catch; each returns `{ success: false, message: "..." }` on failure. State transition is only attempted after a successful DB write.

### MEDIUM-2: Partial failure on parallel DB writes leaves data inconsistent
**File:** `packages/bot-engine/src/tools/select-style.ts`
**Finding:** `Promise.all([styleTemplate.update, order.update])` — if the second operation failed after the first succeeded, `styleTemplate.popularity` would be incremented without `Order.styleTemplateId` being set, creating a silent data inconsistency.
**Fix applied:** Replaced `Promise.all` with `prisma.$transaction([...])` for atomic batch execution on the match path.

### MEDIUM-3: No `styleInput` length guard — potential DB column overflow and log pollution
**File:** `packages/bot-engine/src/tools/select-style.ts`
**Finding:** `styleInput` was stored directly into `Order.theme` without length capping. WhatsApp allows messages up to 65536 chars; if `Order.theme` column has no DB-level limit, an oversized string could cause a Prisma error or bloat structured logs.
**Fix applied:** Added `sanitizedInput = styleInput.trim().slice(0, 200)` (constant `MAX_STYLE_INPUT_LENGTH = 200`) before all processing. `sanitizedInput` is used consistently throughout.

### MEDIUM-4: Overly broad fuzzy match creates false positive template associations
**File:** `packages/bot-engine/src/tools/select-style.ts`
**Finding:** The fuzzy match `input.includes(t.name.toLowerCase())` would trigger for very short template names (e.g. a template named "3D" matches any input containing the substring "3d"), incorrectly associating a custom theme with a known template and incrementing its popularity counter.
**Fix applied:** Added a guard `t.name.toLowerCase().length >= MIN_FUZZY_MATCH_LENGTH` (constant `MIN_FUZZY_MATCH_LENGTH = 3`) on the fuzzy match tier. Slugs and exact name matches are unaffected.

### LOW-5: Leading/trailing whitespace on `styleInput` prevents all three match tiers from resolving
**File:** `packages/bot-engine/src/tools/select-style.ts`
**Finding:** Whitespace around user input (common from button presses or copy-paste) caused slug, exact-name, and fuzzy matches all to fail, silently routing the theme as custom.
**Fix applied:** Covered by the `.trim()` applied in the MEDIUM-3 fix (`sanitizedInput = styleInput.trim().slice(0, 200)`).

### Tests added for review findings (12 total, up from 7)
- `input trimming: leading/trailing whitespace does not prevent match`
- `input sanitization: input exceeding 200 chars is truncated and stored as custom theme`
- `DB error on findUnique: returns { success: false } with error message`
- `DB error on order/styleTemplate update: returns { success: false } with error message`
- `fuzzy match guard: template name shorter than MIN_FUZZY_MATCH_LENGTH does not match via fuzzy path`
