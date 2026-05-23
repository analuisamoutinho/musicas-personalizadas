# Story 2.2: Conversation State Machine & Persistence

Status: done
GitHub Issue: [mgiovani/fotos#46](https://github.com/mgiovani/fotos/issues/46)

## Story

As the system,
I want to load, track, and update conversation state per client atomically,
So that the bot can resume conversations after interruptions and prevent race conditions from rapid duplicate webhooks.

## Acceptance Criteria

1. **Given** a WhatsApp message arrives with a sender ID
   **When** the bot engine processes the message
   **Then** it loads the active order for that sender (status NOT IN COMPLETED, FAILED, ABANDONED_24H) ordered by createdAt DESC

2. **Given** no active order exists for the sender
   **When** the bot engine processes the message
   **Then** it creates a new Client record (if needed) and a new Order in GREETING state

3. **Given** the bot engine has processed a message
   **When** it updates the order status
   **Then** the update uses optimistic concurrency: `WHERE id = $1 AND conversationState = $2`

4. **Given** 0 rows are updated (race condition from duplicate webhook)
   **When** the update returns
   **Then** the duplicate message is skipped silently (logged, not errored)

5. **Given** the ConversationState enum
   **Then** it contains exactly: GREETING, COLLECTING_PHOTOS, COLLECTING_THEME, COLLECTING_OUTFIT, CONFIRMING_ORDER, AWAITING_PAYMENT, ABANDONED_1H, ABANDONED_24H, GENERATING, DELIVERING, AWAITING_FEEDBACK, REVISION_1, REVISION_2, COMPLETED, FAILED

6. **Given** a state transition is requested
   **When** the transition is not in the allowed transitions map
   **Then** the transition is rejected and an error is logged

## Tasks / Subtasks

- [x] Task 1: Create state machine module (AC: #5, #6)
  - [x] 1.1: Created `packages/bot-engine/src/state-machine.ts` with `ConversationState` const object (mirrors Prisma enum exactly — defined locally to avoid generated client import path issues)
  - [x] 1.2: Defined `ALLOWED_TRANSITIONS` map with all 15 states including AWAITING_FEEDBACK→REVISION_2 for second revision
  - [x] 1.3: Exported `isValidTransition(from, to)` function
  - [x] 1.4: Written 10 tests in `state-machine.test.ts` (enum completeness, terminal states, valid/invalid transitions)

- [x] Task 2: Create conversation persistence module (AC: #1, #2, #3, #4)
  - [x] 2.1: Created `packages/bot-engine/src/conversation.ts`
  - [x] 2.2: Implemented `loadActiveOrder` — Prisma findFirst with notIn terminal states, ordered by createdAt desc, includes client
  - [x] 2.3: Implemented `findOrCreateClient` — upsert with update: {} no-op
  - [x] 2.4: Implemented `createOrder` — creates in GREETING state, includes client
  - [x] 2.5: Implemented `updateOrderState` — validates transition via isValidTransition, then optimistic concurrency via updateMany with fromState in WHERE
  - [x] 2.6: Added `@mascotinhos/db: workspace:*` to bot-engine/package.json

- [x] Task 3: Integrate with bot handler (AC: #1, #2, #3, #4)
  - [x] 3.1: Updated `onNewMention` in bot.ts to loadActiveOrder → findOrCreateClient + createOrder if none
  - [x] 3.2: Logs orderId and conversationState for both new and existing orders with PII-masked sender
  - [x] 3.3: No state update in placeholder handler (Story 2.3 will add agent-driven transitions)

- [x] Task 4: Write tests (AC: #1-#6)
  - [x] 4.1: Created `conversation.test.ts` with mock.module for @mascotinhos/db
  - [x] 4.2: Tests loadActiveOrder: null on no order, terminal states excluded, ABANDONED_1H NOT excluded
  - [x] 4.3: Tests findOrCreateClient: upsert called with correct params
  - [x] 4.4: Tests createOrder: GREETING state, correct clientId
  - [x] 4.5: Tests updateOrderState: true on success, false on race (count=0), false on invalid transition (no DB call)
  - [x] 4.6: Tests isValidTransition: 4 allowed, 5 rejected including terminal states

- [x] Task 5: Verify pipeline (AC: all)
  - [x] 5.1: `bun run check-types` passes for bot-engine
  - [x] 5.2: 43 tests pass (21 bot-engine + 22 payments, 0 regressions)

## Dev Notes

### Architecture Compliance

**File locations per architecture doc:**
- `packages/bot-engine/src/state-machine.ts` — ConversationState enum + transition validation
- `packages/bot-engine/src/conversation.ts` — State loading, client/order creation, state updates

**Data access rule:** All DB operations use Prisma via `@mascotinhos/db`. Never import Prisma directly — import from `@mascotinhos/db`.

### ConversationState Enum

Must mirror the Prisma schema enum exactly (already defined in `packages/db/prisma/schema/schema.prisma`):
```typescript
export enum ConversationState {
  GREETING = "GREETING",
  COLLECTING_PHOTOS = "COLLECTING_PHOTOS",
  COLLECTING_THEME = "COLLECTING_THEME",
  COLLECTING_OUTFIT = "COLLECTING_OUTFIT",
  CONFIRMING_ORDER = "CONFIRMING_ORDER",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  ABANDONED_1H = "ABANDONED_1H",
  ABANDONED_24H = "ABANDONED_24H",
  GENERATING = "GENERATING",
  DELIVERING = "DELIVERING",
  AWAITING_FEEDBACK = "AWAITING_FEEDBACK",
  REVISION_1 = "REVISION_1",
  REVISION_2 = "REVISION_2",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}
```

**Important:** The Prisma schema uses `conversationState` field (not `status`). The architecture doc SQL examples use `status` but the actual Prisma field is `conversationState`. Use the Prisma field name.

### Allowed Transitions Map

```typescript
export const ALLOWED_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  GREETING: [COLLECTING_PHOTOS, COLLECTING_THEME],
  COLLECTING_PHOTOS: [COLLECTING_THEME],
  COLLECTING_THEME: [COLLECTING_OUTFIT],
  COLLECTING_OUTFIT: [CONFIRMING_ORDER],
  CONFIRMING_ORDER: [AWAITING_PAYMENT, COLLECTING_PHOTOS, COLLECTING_THEME, COLLECTING_OUTFIT],
  AWAITING_PAYMENT: [GENERATING, ABANDONED_1H],
  ABANDONED_1H: [AWAITING_PAYMENT, ABANDONED_24H],
  ABANDONED_24H: [],  // terminal
  GENERATING: [DELIVERING, FAILED],
  DELIVERING: [AWAITING_FEEDBACK],
  AWAITING_FEEDBACK: [REVISION_1, REVISION_2, COMPLETED],  // REVISION_2 for 2nd revision after re-delivery
  REVISION_1: [GENERATING],   // re-generate after first revision feedback
  REVISION_2: [GENERATING],   // re-generate after second (final) revision
  COMPLETED: [],  // terminal
  FAILED: [],     // terminal
};
```

Note: `CONFIRMING_ORDER` can go back to collection states (client wants to alter order). `AWAITING_FEEDBACK` can go to `REVISION_1` (first revision) or `COMPLETED` (client loved it).

### State Loading Query (Prisma)

```typescript
// loadActiveOrder(whatsappSenderId: string)
const order = await prisma.order.findFirst({
  where: {
    client: { whatsappSenderId },
    conversationState: {
      notIn: ["COMPLETED", "FAILED", "ABANDONED_24H"],
    },
  },
  orderBy: { createdAt: "desc" },
  include: { client: true },
});
```

### Optimistic Concurrency Update (Prisma)

```typescript
// updateOrderState(orderId: string, fromState: ConversationState, toState: ConversationState)
const result = await prisma.order.updateMany({
  where: { id: orderId, conversationState: fromState },
  data: { conversationState: toState },
});
return result.count > 0;  // false = race condition, skip
```

Use `updateMany` (not `update`) because `update` throws if 0 rows match, while `updateMany` returns count.

### Create Order

```typescript
// createOrder(clientId: string)
const order = await prisma.order.create({
  data: {
    clientId,
    conversationState: "GREETING",
    // price defaults to 29.90 per schema
    // orderStatus defaults to PENDING per schema
  },
});
```

Return type: `Order`. The caller logs `orderId` and `conversationState`.

### Find or Create Client

```typescript
// findOrCreateClient(whatsappSenderId: string)
const client = await prisma.client.upsert({
  where: { whatsappSenderId },
  create: { whatsappSenderId },
  update: {},  // no-op on existing
});
```

### Bot Handler Integration

Update `onNewMention` in `bot.ts` to:
1. Extract `whatsappSenderId` from `message.author.userId`
2. Call `loadActiveOrder(whatsappSenderId)`
3. If no order: `findOrCreateClient(senderId)` → `createOrder(client.id)`
4. Log orderId and conversationState
5. Send placeholder response (still placeholder until Story 2.3)
6. After response, `updateOrderState(order.id, currentState, nextState)` — for placeholder, no state change needed yet

### Scope Boundaries

**NOT in this story:**
- AI Agent (Story 2.3)
- Tools that trigger state transitions (Stories 2.4-2.8)
- Conversation history loading for AI context (Story 2.3)
- The `onNewMention` handler remains a PLACEHOLDER — only state loading/creation is added

**Dependencies added:**
- `@mascotinhos/db` added to `packages/bot-engine/package.json`

### Previous Story Intelligence (Story 2.1)

- **Test preload**: `bunfig.toml` with `[test] preload = ["./src/test-setup.ts"]` — all 17 env vars required
- **Error handling**: try/catch with structured JSON logging
- **PII masking**: Phone numbers as `***${phone.slice(-4)}` with length guard
- **Package pattern**: Named exports from `src/index.ts`
- **Chat SDK adapter**: `verifyToken: env.WHATSAPP_WEBHOOK_TOKEN` passed explicitly
- **Prisma import**: `import prisma from "@mascotinhos/db"` (default export)

### Testing Strategy

Mock Prisma using `bun:test` `mock.module`. **CRITICAL**: `mock.module` MUST be called BEFORE importing the module under test. Use dynamic `await import()` after mocking:

```typescript
import { describe, expect, it, mock } from "bun:test";

// Mock BEFORE importing conversation.ts
mock.module("@mascotinhos/db", () => ({
  default: {
    order: {
      findFirst: mock(() => Promise.resolve(null)),
      create: mock(() => Promise.resolve({ id: "order-1", conversationState: "GREETING" })),
      updateMany: mock(() => Promise.resolve({ count: 1 })),
    },
    client: {
      upsert: mock(() => Promise.resolve({ id: "client-1", whatsappSenderId: "5511999999999" })),
    },
  },
}));

// THEN dynamic import
const { loadActiveOrder, findOrCreateClient } = await import("./conversation");
```

**Test cases to include:**
- `loadActiveOrder` returns active order, skips COMPLETED/FAILED/ABANDONED_24H
- `loadActiveOrder` returns ABANDONED_1H orders (they are resumable)
- `findOrCreateClient` creates new, returns existing
- `createOrder` creates in GREETING state with correct clientId
- `updateOrderState` returns true on success, false on race (count=0)
- `updateOrderState` calls `isValidTransition` and rejects invalid transitions
- `isValidTransition` allows GREETING→COLLECTING_PHOTOS, rejects COMPLETED→GREETING

### Transition Validation in updateOrderState

`updateOrderState` MUST call `isValidTransition(fromState, toState)` before the DB query. If invalid, throw an error instead of hitting the database:

```typescript
export async function updateOrderState(orderId: string, fromState: ConversationState, toState: ConversationState): Promise<boolean> {
  if (!isValidTransition(fromState, toState)) {
    console.log(JSON.stringify({ level: "error", event: "invalid_state_transition", orderId, from: fromState, to: toState, service: "bot-engine" }));
    return false;
  }
  const result = await prisma.order.updateMany({
    where: { id: orderId, conversationState: fromState },
    data: { conversationState: toState },
  });
  return result.count > 0;
}
```

### References

- [Source: .bmad_output/planning-artifacts/epics.md — Epic 2, Story 2.2]
- [Source: .bmad_output/planning-artifacts/architecture.md — State Machine, Conversation State, Optimistic Concurrency]
- [Source: .bmad_output/planning-artifacts/prd.md — FR-06, FR-09, NFR-05]
- [Source: .bmad_output/implementation-artifacts/story-2.1.md — Bot handler, test preload, error handling patterns]
- [Source: packages/db/prisma/schema/schema.prisma — Order model, ConversationState enum]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- ConversationState defined locally as const object (not imported from Prisma generated) — avoids package export path issue with `@mascotinhos/db`
- ALLOWED_TRANSITIONS includes AWAITING_FEEDBACK→REVISION_2 per validation fix (enables second revision path)
- updateOrderState validates transition BEFORE DB query — invalid transitions return false without hitting DB
- loadActiveOrder excludes COMPLETED/FAILED/ABANDONED_24H but includes ABANDONED_1H (resumable state)
- Bot handler now loads/creates conversation state on every message; state transitions deferred to Story 2.3 AI Agent
- All 43 tests pass (21 new + 22 existing, 0 regressions)

### File List

New:
- `mascotinhos/packages/bot-engine/src/state-machine.ts`
- `mascotinhos/packages/bot-engine/src/state-machine.test.ts`
- `mascotinhos/packages/bot-engine/src/conversation.ts`
- `mascotinhos/packages/bot-engine/src/conversation.test.ts`

Modified:
- `mascotinhos/packages/bot-engine/src/bot.ts` (added conversation state loading)
- `mascotinhos/packages/bot-engine/src/index.ts` (added exports)
- `mascotinhos/packages/bot-engine/package.json` (added @mascotinhos/db dep)
- `mascotinhos/bun.lock`
