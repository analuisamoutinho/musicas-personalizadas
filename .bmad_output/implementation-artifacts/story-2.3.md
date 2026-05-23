# Story 2.3: AI Agent Definition with System Prompt

Status: done
GitHub Issue: [mgiovani/fotos#47](https://github.com/mgiovani/fotos/issues/47)

## Story

As a prospective client,
I want the bot to feel like a warm, caring human attendant who speaks casual Brazilian Portuguese with emojis,
So that I feel attended to and trust the service enough to share my child's photo and pay.

## Acceptance Criteria

1. **Given** the AI SDK v6 ToolLoopAgent is configured in `packages/bot-engine/src/agent.ts`
   **When** the agent processes any message
   **Then** it uses GPT-5-mini as the conversation model via `@ai-sdk/openai`

2. **Given** the agent receives a message
   **When** it responds
   **Then** the system prompt defines a warm, emoji-rich, casual PT-BR personality (FR-05)

3. **Given** the agent is configured
   **Then** it has access to all 7 tool stubs: collectPhotos, selectStyle, confirmOrder, generatePayment, enqueueGeneration, deliverImage, handleRevision

4. **Given** the agent is processing a message
   **When** it responds
   **Then** typing indicators are sent via Chat SDK before each response (FR-08)

5. **Given** the client asks an out-of-scope question (e.g. "Quanto custa?" mid-flow)
   **When** the agent handles it
   **Then** it answers the question and returns to the current conversation state (FR-07)

6. **Given** a webhook arrives
   **When** the agent is invoked
   **Then** the full conversation history is loaded from the database and passed as context (FR-09)

## Tasks / Subtasks

- [x] Task 1: Add AI SDK dependencies to bot-engine (AC: #1)
  - [x] 1.1: Added `ai ^6.0.3`, `@ai-sdk/openai ^3.0.48`, `zod catalog:` to package.json
  - [x] 1.2: `bun install` successful

- [x] Task 2: Create system prompt (AC: #2, #5)
  - [x] 2.1: Created `packages/bot-engine/src/prompts/system-prompt.ts`
  - [x] 2.2: PT-BR personality: warm, emoji-rich, "voce" form, "com carinho"/"fico feliz"
  - [x] 2.3: Dynamic state awareness via `buildSystemPrompt(orderContext)` — includes current state, client name, theme, photos count
  - [x] 2.4: Out-of-scope handling: "responda a pergunta e retorne ao ponto atual do fluxo"

- [x] Task 3: Create tool stubs (AC: #3)
  - [x] 3.1: Created `packages/bot-engine/src/tools/` with 7 files
  - [x] 3.2: Each stub uses `tool()` with `inputSchema` (Zod) and returns `{ success: false, message: "Not implemented yet" }`
  - [x] 3.3: Barrel export via `tools/index.ts` with `allTools` object

- [x] Task 4: Create agent module (AC: #1, #3, #6)
  - [x] 4.1: Created `packages/bot-engine/src/agent.ts`
  - [x] 4.2: `ToolLoopAgent` with `openai("gpt-5-mini")`, `stopWhen: stepCountIs(5)`, all 7 tools
  - [x] 4.3: `processMessage(order, userMessage, history)` calls `agent.generate()` with system prompt + history + user message
  - [x] 4.4: Returns `result.text`

- [x] Task 5: Create conversation history loader (AC: #6)
  - [x] 5.1-5.2: Created `packages/bot-engine/src/history.ts` — in-memory Map<orderId, messages[]>
  - [x] 5.3: Exports `getHistory()`, `appendMessage()`, `clearHistory()`

- [x] Task 6: Wire agent into bot handler (AC: #1-#6)
  - [x] 6.1: `onNewMention` now calls `processMessage()` with order context + history
  - [x] 6.2: `thread.startTyping()` before agent call
  - [x] 6.3: `thread.post(response)` with agent's text
  - [x] 6.4: User and assistant messages appended to history after processing

- [x] Task 7: Write tests (AC: #1-#6)
  - [x] 7.1: 6 system prompt tests (personality markers, price, state, out-of-scope, AI identity)
  - [x] 7.2: Agent module exports tested via index
  - [x] 7.3: 4 tool stub tests (count, names, execute function, not-implemented return)
  - [x] 7.4: 4 history tests (empty, append/retrieve, clear, separate per order)

- [x] Task 8: Verify pipeline
  - [x] 8.1: `bun run check-types` passes
  - [x] 8.2: 57 tests pass (35 bot-engine + 22 payments, 0 regressions)

## Dev Notes

### Architecture Compliance

**File locations per architecture doc:**
- `packages/bot-engine/src/agent.ts` — ToolLoopAgent definition
- `packages/bot-engine/src/prompts/system-prompt.ts` — PT-BR personality prompt
- `packages/bot-engine/src/tools/*.ts` — Individual tool stubs (7 files)

### AI SDK v6 Agent Pattern

```typescript
// packages/bot-engine/src/agent.ts
import { ToolLoopAgent, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { buildSystemPrompt } from "./prompts/system-prompt";
import { allTools } from "./tools";

const agent = new ToolLoopAgent({
  model: openai("gpt-5-mini"),
  tools: allTools,
  stopWhen: stepCountIs(5),
});
```

**IMPORTANT API notes (AI SDK v6):**
- Use `ToolLoopAgent` class (not `createToolLoopAgent` — architecture doc is outdated)
- Use `inputSchema` (not `parameters`) for tool definitions
- Use `stopWhen: stepCountIs(N)` (not `maxSteps`)
- Use `agent.generate()` (not `agent.generateText()`)
- Model: `openai("gpt-5-mini")` requires `@ai-sdk/openai` package

### Tool Stub Pattern

Each tool in `packages/bot-engine/src/tools/`:
```typescript
// tools/collect-photos.ts
import { tool } from "ai";
import { z } from "zod";

export const collectPhotos = tool({
  description: "Collect reference photos from client",
  inputSchema: z.object({
    photoUrls: z.array(z.string().url()),
    orderId: z.string(),
  }),
  execute: async () => ({ success: false, message: "Not implemented yet — Story 2.5" }),
});
```

### Tool Definitions (7 tools — all stubs for now)

| Tool | inputSchema | Implemented in Story |
|------|-------------|---------------------|
| `collectPhotos` | `{ photoUrls: string[], orderId: string }` | Story 2.5 |
| `selectStyle` | `{ styleInput: string, orderId: string }` | Story 2.6 |
| `confirmOrder` | `{ orderId: string, confirmed: boolean }` | Story 2.8 |
| `generatePayment` | `{ orderId: string }` | Story 3.1 |
| `enqueueGeneration` | `{ orderId: string }` | Story 4.1 |
| `deliverImage` | `{ orderId: string, imageUrl: string }` | Story 4.6 |
| `handleRevision` | `{ orderId: string, feedback: string }` | Story 5.2 |

### System Prompt Requirements (FR-05)

The system prompt MUST:
- Respond in informal Brazilian Portuguese (tu/voce forms)
- Include emoji in >50% of messages
- Use warm closing phrases ("com carinho", "fico feliz")
- Send typing indicators before each response
- Handle out-of-scope questions by answering then returning to flow
- Be aware of the current conversation state and guide the client through the flow
- Include the price R$29,90 when relevant
- Never share internal system details

The prompt should be a function `buildSystemPrompt(conversationState, orderContext)` that returns a string with dynamic state context.

### Conversation History (FR-09)

For MVP, use in-memory history (Map<orderId, message[]>). Messages are ModelMessage format:
```typescript
type HistoryMessage = { role: "user" | "assistant"; content: string };
```

The `processMessage` function receives the history and passes it to `agent.generate()`:
```typescript
export async function processMessage(
  order: { id: string; conversationState: string },
  userMessage: string,
  history: HistoryMessage[],
): Promise<string> {
  const result = await agent.generate({
    messages: [
      { role: "system", content: buildSystemPrompt(order.conversationState, order) },
      ...history,
      { role: "user", content: userMessage },
    ],
  });
  return result.text;
}
```

### Scope Boundaries

**NOT in this story:**
- Tool implementations (each tool is a stub — implemented in Stories 2.4-5.2)
- State transitions from tool calls (the agent calls tools but stubs return "not implemented")
- Persistent conversation history in DB (in-memory for MVP)
- Prompt enrichment for image generation (Story 4.2)
- `@mascotinhos/storage` or `@mascotinhos/payments` imports

**This story creates the agent scaffolding. Future stories fill in the tool implementations.**

### Dependencies to Add

```json
{
  "ai": "^6.0.3",
  "@ai-sdk/openai": "^1.0.0",
  "zod": "catalog:"
}
```

Note: `zod` should use the catalog version from root package.json (^4.1.13). Check if `@ai-sdk/openai` version matches — run `npm view @ai-sdk/openai version` to get latest.

### Previous Story Intelligence (Story 2.2)

- **ConversationState** defined locally in `state-machine.ts` (not from Prisma generated)
- **loadActiveOrder** returns `Order & { client: Client }` or null
- **bot.ts onNewMention** already loads/creates order — wire agent call after order loading
- **Error handling**: try/catch with structured JSON logging
- **Test mocking**: Use `mock.module()` BEFORE importing module under test, then `await import()`
- **Empty senderId guard**: Already in place in bot.ts

### References

- [Source: .bmad_output/planning-artifacts/epics.md — Epic 2, Story 2.3]
- [Source: .bmad_output/planning-artifacts/architecture.md — AI Agent Pattern, Tool Definitions]
- [Source: .bmad_output/planning-artifacts/prd.md — FR-05, FR-07, FR-08, FR-09]
- [Source: AI SDK v6 docs — ToolLoopAgent, tool(), inputSchema, stopWhen]
- [Source: .bmad_output/implementation-artifacts/story-2.2.md — State machine, conversation patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- ToolLoopAgent uses `instructions` field (not `system`) but we pass system prompt via messages array for dynamic per-request context
- Architecture doc said `createToolLoopAgent` but actual API is `new ToolLoopAgent({})` class
- `@ai-sdk/openai` v3.0.48 installed (not v1.x — major version jump)
- All 7 tool stubs return `{ success: false, message: "Not implemented yet" }` — future stories implement each
- In-memory conversation history via Map — acceptable for MVP, may need DB persistence for multi-instance deploy
- System prompt is a function `buildSystemPrompt(orderContext)` for dynamic state injection
- 57 total tests pass (35 bot-engine + 22 payments)

### File List

New:
- `mascotinhos/packages/bot-engine/src/agent.ts`
- `mascotinhos/packages/bot-engine/src/history.ts`
- `mascotinhos/packages/bot-engine/src/history.test.ts`
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts`
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.test.ts`
- `mascotinhos/packages/bot-engine/src/tools/collect-photos.ts`
- `mascotinhos/packages/bot-engine/src/tools/select-style.ts`
- `mascotinhos/packages/bot-engine/src/tools/confirm-order.ts`
- `mascotinhos/packages/bot-engine/src/tools/generate-payment.ts`
- `mascotinhos/packages/bot-engine/src/tools/enqueue-generation.ts`
- `mascotinhos/packages/bot-engine/src/tools/deliver-image.ts`
- `mascotinhos/packages/bot-engine/src/tools/handle-revision.ts`
- `mascotinhos/packages/bot-engine/src/tools/index.ts`
- `mascotinhos/packages/bot-engine/src/tools/tools.test.ts`

Modified:
- `mascotinhos/packages/bot-engine/src/bot.ts` (wired agent + history)
- `mascotinhos/packages/bot-engine/src/index.ts` (added exports)
- `mascotinhos/packages/bot-engine/package.json` (added ai, @ai-sdk/openai, zod)
- `mascotinhos/bun.lock`
