# Story 2.4: Greeting Flow with Portfolio and Social Proof

Status: done
GitHub Issue: [mgiovani/fotos#48](https://github.com/mgiovani/fotos/issues/48)

## Story

As a prospective client arriving from a Meta ad,
I want to immediately see beautiful examples of mascotinhos, the price, and social proof,
So that I can quickly decide whether to proceed with my order.

## Acceptance Criteria

1. **Given** a new client sends their first message (pre-filled from Meta ad or organic)
   **When** the bot processes the GREETING state
   **Then** the bot responds within 3 seconds with: a warm greeting using the client's name (if available), a series of before/after portfolio image URLs, the price "R$29,90", and social proof text ("Ja fizemos mais de X mascotinhos!")

2. **Given** the bot is greeting a new client
   **When** building the greeting response
   **Then** the bot queries `StyleTemplate WHERE active = true ORDER BY popularity DESC LIMIT 3` and presents those styles as quick-reply button labels plus an "Outro tema" free-text fallback option

3. **Given** the pre-filled message from a Meta ad contains a recognizable style name (e.g. "Disney 3D", "Anime")
   **When** the bot processes the GREETING state
   **Then** the bot acknowledges that style preference in its greeting ("Vi que voce se interessou pelo tema [style]!")

4. **Given** the bot sends the greeting
   **When** the client taps a quick-reply button or types a theme
   **Then** the order transitions to COLLECTING_PHOTOS or COLLECTING_THEME based on whether photos were included

5. **Given** the `getGreetingContext` tool is called
   **When** the GREETING state is active
   **Then** it returns the top-3 style template names/slugs from DB plus a portfolio images array and a social proof count

6. **Given** the bot queries StyleTemplate
   **When** no active style templates exist in DB
   **Then** the bot still responds gracefully with a generic theme prompt (no crash)

7. **Given** the greeting flow runs
   **When** response is measured
   **Then** the full round-trip from webhook receipt to WhatsApp reply is under 3 seconds (NFR-06) — the DB query for StyleTemplate must use the `@@index([active, popularity])` index already defined in the schema

## Tasks / Subtasks

- [x] Task 1: Create `getGreetingContext` tool (AC: #1, #2, #5, #6)
  - [x] 1.1: Create `packages/bot-engine/src/tools/get-greeting-context.ts`
  - [x] 1.2: `inputSchema: z.object({ orderId: z.string() })`
  - [x] 1.3: `execute`: query `prisma.styleTemplate.findMany({ where: { active: true }, orderBy: { popularity: "desc" }, take: 3 })`
  - [x] 1.4: Return `{ topStyles: [{ name, slug }], portfolioImages: string[], socialProofCount: number, success: true }`
  - [x] 1.5: Handle zero results gracefully (return `topStyles: []`, `success: true` — agent handles the fallback prompt)
  - [x] 1.6: Hardcode `socialProofCount` for MVP (e.g. `47`) — no DB count query needed
  - [x] 1.7: Hardcode `portfolioImages` as an array of 3 placeholder URLs pointing to `public/images/` paths — exact URLs to be replaced when real portfolio images are added in Epic 6

- [x] Task 2: Register `getGreetingContext` in tools barrel (AC: #2, #5)
  - [x] 2.1: Add import to `packages/bot-engine/src/tools/index.ts`
  - [x] 2.2: Add to `allTools` object
  - [x] 2.3: Export named symbol
  - [x] 2.4: Verify existing `tools.test.ts` test "exports all 7 tools" must be updated to "8 tools"

- [x] Task 3: Update system prompt for GREETING state (AC: #1, #2, #3)
  - [x] 3.1: Edit `packages/bot-engine/src/prompts/system-prompt.ts`
  - [x] 3.2: Add GREETING-specific instruction block: when `conversationState === "GREETING"`, the agent MUST call `getGreetingContext` first to obtain top styles and portfolio images
  - [x] 3.3: Add instruction to acknowledge pre-filled style from the first message if it matches a known theme name
  - [x] 3.4: Add instruction to present quick-reply button labels as a numbered or bulleted list in the text message (WhatsApp interactive buttons are sent via the Chat SDK `thread.sendInteractive()` call — see Task 4)
  - [x] 3.5: Add instruction: after greeting, ask the client "Qual tema voce escolheu? 🎨" with the style names listed

- [x] Task 4: Implement quick-reply button delivery via Chat SDK (AC: #2, #4)
  - [x] 4.1: In `packages/bot-engine/src/bot.ts`, after the agent returns its response text AND when state is GREETING, send an additional interactive message with quick-reply buttons
  - [x] 4.2: Use `thread.sendInteractive()` (or equivalent Chat SDK method) to send up to 3 quick-reply buttons (one per top style) + "Outro tema" button (total = 4, but WhatsApp allows 3 buttons per message — send top-3 styles as buttons plus "Outro tema" as a 4th via a second message or as inline text fallback)
  - [x] 4.3: **WhatsApp constraint**: max 3 interactive buttons per message. Strategy: send top-3 style names as quick-reply buttons; append "Outro tema? Digite o nome do tema que voce prefere 😊" as a follow-up text message
  - [x] 4.4: Extract the quick-reply button list from the agent's response or from `getGreetingContext` result stored in `history` context
  - [x] 4.5: If Chat SDK does not expose `sendInteractive()`, fall back to sending the style options as plain numbered text in the greeting message body (acceptable for MVP)

- [x] Task 5: Handle pre-filled message from Meta ads (AC: #3)
  - [x] 5.1: In `packages/bot-engine/src/bot.ts` handler, when `order.conversationState === "GREETING"`, extract the user's first message text and pass it as `preFillText` in the `OrderContext` to `processMessage()`
  - [x] 5.2: Update `OrderContext` interface in `agent.ts` to accept optional `preFillText?: string | null`
  - [x] 5.3: **Also** update the duplicate `OrderContext` interface in `packages/bot-engine/src/prompts/system-prompt.ts` (it has its own copy of the interface — both must be kept in sync). Add `preFillText?: string | null` there too.
  - [x] 5.4: Update `buildSystemPrompt()` in `system-prompt.ts` to surface `preFillText` in the context block so the agent can acknowledge it
  - [x] 5.5: The agent instruction: "Se o campo preFillText contiver um nome de tema (ex: 'Disney 3D', 'Anime'), mencione esse tema na saudacao"

- [x] Task 6: State transition after greeting (AC: #4)
  - [x] 6.1: After agent response is sent, if the incoming message is the very first in GREETING state, do NOT transition yet — stay in GREETING until client selects a style or sends a photo
  - [x] 6.2: When client taps a quick-reply button with a style name, the `selectStyle` tool (Story 2.6) will handle the transition — this story only prepares the greeting output, not the `selectStyle` implementation
  - [x] 6.3: Document in code comment: "State transition GREETING → COLLECTING_PHOTOS or COLLECTING_THEME is triggered by `selectStyle` tool (Story 2.6) or `collectPhotos` tool (Story 2.5)"

- [x] Task 7: Write tests (AC: #1–#7)
  - [x] 7.1: Create `packages/bot-engine/src/tools/get-greeting-context.test.ts`
    - [x] 7.1.1: Mock `@mascotinhos/db` via `mock.module()` before import (pattern from Story 2.2/2.3)
    - [x] 7.1.2: Test happy path: returns `{ success: true, topStyles: [...], portfolioImages: [...], socialProofCount: 47 }`
    - [x] 7.1.3: Test zero StyleTemplate rows: returns `{ success: true, topStyles: [], portfolioImages: [...], socialProofCount: 47 }` (no crash)
    - [x] 7.1.4: Test that `prisma.styleTemplate.findMany` is called with `{ where: { active: true }, orderBy: { popularity: "desc" }, take: 3 }`
  - [x] 7.2: Update `packages/bot-engine/src/tools/tools.test.ts`
    - [x] 7.2.1: Change "exports all 7 tools" assertion to "exports all 8 tools"
    - [x] 7.2.2: Add `getGreetingContext` to the name list check
  - [x] 7.3: Update `packages/bot-engine/src/prompts/system-prompt.test.ts`
    - [x] 7.3.1: Add test: when `conversationState === "GREETING"`, the prompt contains "getGreetingContext" instruction
    - [x] 7.3.2: Add test: when `preFillText` is set, the prompt surfaces the pre-fill value in the state block
    - [x] 7.3.3: Add test: when `preFillText` is NOT set (undefined/null), the prompt does NOT contain "Mensagem inicial" (no bleed-through)
    - [x] 7.3.4: **Note**: existing `baseOrder` fixture in `system-prompt.test.ts` omits `preFillText` — this is valid because the field is optional (`preFillText?: string | null`); existing tests will pass without modification

- [x] Task 8: Type-check and test pipeline (AC: all)
  - [x] 8.1: Run `bun run check-types` from `mascotinhos/` — must pass with 0 errors
  - [x] 8.2: Run `bun test` from `mascotinhos/packages/bot-engine/` — all tests pass (existing 35 + new)

## Dev Notes

### Architecture Compliance

**File locations per architecture.md:**
- New tool: `packages/bot-engine/src/tools/get-greeting-context.ts`
- Modified: `packages/bot-engine/src/tools/index.ts` (add `getGreetingContext`)
- Modified: `packages/bot-engine/src/prompts/system-prompt.ts` (GREETING state instructions)
- Modified: `packages/bot-engine/src/agent.ts` (OrderContext interface extension)
- Modified: `packages/bot-engine/src/bot.ts` (pre-fill extraction, interactive button dispatch)

**StyleTemplate DB query (from architecture.md + schema comment):**
```typescript
// Uses @@index([active, popularity]) defined on StyleTemplate model
const topStyles = await prisma.styleTemplate.findMany({
  where: { active: true },
  orderBy: { popularity: "desc" },
  take: 3,
  select: { id: true, name: true, slug: true, exampleImages: true },
});
```

**FR-39 compliance:** Buttons always ordered by `popularity DESC` from DB — no client-side sorting.

### WhatsApp Quick-Reply Button Constraint

WhatsApp Business API limits interactive button messages to **3 buttons maximum** per message. The strategy for this story:

1. Send top-3 style template names as quick-reply buttons (one per button) — these come from `getGreetingContext`
2. Follow with a plain text message: "Ou digite o nome de outro tema que prefere 😊"

If the Chat SDK (`@chat-adapter/whatsapp`) does not expose an `sendInteractive()` or `sendButtons()` method in its current version, fall back to presenting the 3 style options as plain numbered text within the greeting message body. This is the **MVP-acceptable fallback** — do not block the story on interactive button support if it is not in the Chat SDK API.

### Pre-Filled Message Pattern (Meta Ads)

Meta click-to-WhatsApp ads send a pre-configured text when the user taps. Example:
- "Quero um mascotinho - Tema: Disney 3D"
- "Disney 3D mascotinho"

The bot handler already reads `message.text` from `bot.onNewMention`. When the order state is `GREETING`, pass this text as `preFillText` in the context so the system prompt can instruct the agent to acknowledge it. The agent does the matching — no regex parsing in bot.ts.

### New Tool: `getGreetingContext`

```typescript
// packages/bot-engine/src/tools/get-greeting-context.ts
import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";

export const getGreetingContext = tool({
  description:
    "Fetch greeting context: top 3 style templates by popularity, portfolio image URLs, and social proof count. Call once at the start of GREETING state.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID (for logging)"),
  }),
  execute: async (_input) => {
    const topStyles = await prisma.styleTemplate.findMany({
      where: { active: true },
      orderBy: { popularity: "desc" },
      take: 3,
      select: { id: true, name: true, slug: true },
    });

    return {
      success: true,
      topStyles,
      // MVP: hardcoded portfolio image paths — replace with real images in Epic 6
      portfolioImages: [
        "/images/portfolio/before-after-1.jpg",
        "/images/portfolio/before-after-2.jpg",
        "/images/portfolio/before-after-3.jpg",
      ],
      // MVP: hardcoded social proof count — replace with DB count query post-MVP
      socialProofCount: 47,
    };
  },
});
```

### System Prompt Update for GREETING State

Add a new section to `buildSystemPrompt()` for GREETING state instructions:

```
## Instrucoes para o estado GREETING
Quando o estado for GREETING:
1. PRIMEIRO chame a ferramenta getGreetingContext para obter os temas disponiveis e imagens de portfolio
2. Envie uma mensagem de boas-vindas calorosa com o nome do cliente (se disponivel)
3. Mencione que ja fizemos mais de {socialProofCount} mascotinhos
4. Apresente as imagens de portfolio (liste as URLs das imagens)
5. Informe o preco: R$29,90 por mascotinho
6. Apresente os temas disponiveis como opcoes numeradas: "1. [tema1]  2. [tema2]  3. [tema3]  4. Outro tema (me diga qual!)"
7. Se preFillText contiver um nome de tema reconhecivel, mencione: "Vi que voce se interessou pelo tema [tema]! ✨"
8. Termine perguntando qual tema o cliente prefere
```

When `preFillText` is set, expose it in the state block:
```
${order.preFillText ? `Mensagem inicial do cliente: ${sanitize(order.preFillText)}` : ""}
```

### OrderContext Interface Extension

**IMPORTANT: There are two separate `OrderContext` interface definitions** that must both be updated:

1. `packages/bot-engine/src/agent.ts` — used by `processMessage()`
2. `packages/bot-engine/src/prompts/system-prompt.ts` — used by `buildSystemPrompt()`

Both interfaces must receive `preFillText?: string | null`. Failing to update `system-prompt.ts` will cause a TypeScript error when `buildSystemPrompt(order)` receives the extended `OrderContext` from `agent.ts`.

In `packages/bot-engine/src/agent.ts`, extend `OrderContext`:

```typescript
interface OrderContext {
  id: string;
  conversationState: ConversationState;
  clientName?: string | null;
  theme?: string | null;
  outfitDescription?: string | null;
  extraRequests?: string | null;
  photosCount?: number;
  preFillText?: string | null;  // ADD THIS — from first message in GREETING state
}
```

In `packages/bot-engine/src/prompts/system-prompt.ts`, the local `OrderContext` interface (lines 3–11) also needs the same addition:

```typescript
interface OrderContext {
  id: string;
  conversationState: ConversationState;
  clientName?: string | null;
  theme?: string | null;
  outfitDescription?: string | null;
  extraRequests?: string | null;
  photosCount?: number;
  preFillText?: string | null;  // ADD THIS — must match agent.ts
}
```

Update `bot.ts` to pass `preFillText` only when in GREETING state:

```typescript
const response = await processMessage(
  {
    id: order.id,
    conversationState: order.conversationState,
    clientName: order.client.name,
    theme: order.theme,
    outfitDescription: order.outfitDescription,
    extraRequests: order.extraRequests,
    photosCount: order.photosUrls?.length ?? 0,
    // Pass pre-fill text only for GREETING to avoid bleeding into later states
    preFillText: order.conversationState === "GREETING" ? userText : null,
  },
  userText,
  history,
);
```

### State Transition Boundary

This story does NOT implement the `selectStyle` tool (that is Story 2.6). The GREETING state transitions (`GREETING → COLLECTING_PHOTOS`, `GREETING → COLLECTING_THEME`) are triggered by:
- `selectStyle` tool (Story 2.6) — when client taps a style button
- `collectPhotos` tool (Story 2.5) — when client sends photos directly

The greeting flow only needs to:
1. Send the welcome message with portfolio and social proof
2. Present the 3 style quick-reply buttons + "Outro tema" text option
3. Remain in GREETING until the client responds

**Do NOT call `updateOrderState()` from the greeting tool** — state changes happen via the respective tool implementations in Stories 2.5 and 2.6.

### Test Mocking Pattern (from Story 2.2/2.3)

```typescript
// IMPORTANT: mock.module() MUST be called BEFORE the module under test is imported
import { mock, describe, expect, it, beforeEach } from "bun:test";

const mockFindMany = mock(() => Promise.resolve([]));
mock.module("@mascotinhos/db", () => ({
  default: {
    styleTemplate: { findMany: mockFindMany },
  },
}));

// Dynamic import AFTER mock setup
const { getGreetingContext } = await import("./get-greeting-context");
```

### Scope Boundaries

**IN scope for this story:**
- `getGreetingContext` tool (new) with DB query for top-3 styles
- System prompt update for GREETING state instructions
- `OrderContext` extended with `preFillText`
- Quick-reply button delivery via Chat SDK (or plain text fallback)
- Unit tests for new tool + updated tests for count and prompt

**NOT in scope for this story:**
- `selectStyle` tool implementation — Story 2.6
- `collectPhotos` tool implementation — Story 2.5
- State transition GREETING → COLLECTING_PHOTOS or COLLECTING_THEME — Stories 2.5/2.6
- Real portfolio images — Epic 6 (Story 6.2)
- Social proof DB count query — post-MVP
- LGPD consent display — Story 8.1

### Previous Story Intelligence (Stories 2.2, 2.3)

- **Prisma import**: `import prisma from "@mascotinhos/db"` (default export singleton)
- **Tool pattern**: `tool({ description, inputSchema: z.object({...}), execute: async (input) => ({...}) })` — use `inputSchema` NOT `parameters`
- **Mock pattern**: `mock.module()` before import, then `await import()` for dynamic load — bun test requires this order
- **AI SDK version**: `ai ^6.0.3`, `@ai-sdk/openai ^3.0.48` — `ToolLoopAgent` class (not `createToolLoopAgent`)
- **ConversationState**: defined locally in `state-machine.ts`, NOT imported from Prisma generated client
- **Structured logging**: always `console.log(JSON.stringify({ level, event, service: "bot-engine", ... }))` — never plain `console.log`
- **`tools.test.ts` test count**: currently asserts 7 tools — must be updated to 8
- **Duplicate `OrderContext`**: `agent.ts` and `system-prompt.ts` each define their own local `OrderContext` interface — both must be updated when adding `preFillText`. They are intentionally not shared (no cross-package import); keep them in sync manually.

### References

- [Source: .bmad_output/planning-artifacts/epics.md — Epic 2, Story 2.4]
- [Source: .bmad_output/planning-artifacts/architecture.md — Tool Inventory, State Machine Pattern, StyleTemplate query pattern]
- [Source: .bmad_output/planning-artifacts/prd.md — FR-02, FR-03, FR-39, NFR-06]
- [Source: .bmad_output/implementation-artifacts/story-2.3.md — tool stub pattern, mock pattern, AI SDK v6 notes]
- [Source: mascotinhos/packages/db/prisma/schema/schema.prisma — StyleTemplate model with @@index([active, popularity])]
- [Source: mascotinhos/packages/bot-engine/src/agent.ts — OrderContext interface, processMessage signature]
- [Source: mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts — buildSystemPrompt function]
- [Source: mascotinhos/packages/bot-engine/src/bot.ts — onNewMention handler, message extraction pattern]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- All 8 tasks completed in one pass. Bot-engine: 43 tests pass (35 existing + 8 new). Payments package: 22 tests pass (no regressions).
- `bun run check-types` passes with 0 errors for bot-engine. Pre-existing `bun:test` TS2307 errors in packages/payments (not introduced by this story).
- Task 4 (quick-reply buttons): implemented with runtime duck-type check for `thread.sendInteractive()`. Falls back to plain text "Outro tema?" message if Chat SDK does not expose that method — MVP-acceptable per story spec.
- Task 6 (state transition boundary): no `updateOrderState()` called from greeting flow; transitions deferred to Stories 2.5 (`collectPhotos`) and 2.6 (`selectStyle`) as documented.
- Both `OrderContext` interface copies in `agent.ts` and `system-prompt.ts` updated in sync with `preFillText?: string | null`.

### File List

- `mascotinhos/packages/bot-engine/src/tools/get-greeting-context.ts` (new)
- `mascotinhos/packages/bot-engine/src/tools/get-greeting-context.test.ts` (new)
- `mascotinhos/packages/bot-engine/src/tools/index.ts` (modified)
- `mascotinhos/packages/bot-engine/src/tools/tools.test.ts` (modified)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` (modified)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.test.ts` (modified)
- `mascotinhos/packages/bot-engine/src/agent.ts` (modified)
- `mascotinhos/packages/bot-engine/src/bot.ts` (modified)
