# Story 2.1: Chat SDK WhatsApp Adapter & Webhook Endpoint

Status: done
GitHub Issue: [mgiovani/fotos#45](https://github.com/mgiovani/fotos/issues/45)

## Story

As the system,
I want to receive WhatsApp messages via the official Business API and respond through the Chat SDK,
So that the bot has a reliable, policy-compliant communication channel with clients.

## Acceptance Criteria

1. **Given** the Chat SDK and @chat-adapter/whatsapp packages are installed
   **When** a WhatsApp message arrives at `POST /api/whatsapp/webhook`
   **Then** the endpoint responds with `{ status: "ok" }` and HTTP 200 within 5 seconds

2. **Given** a POST request arrives at the webhook endpoint
   **When** the `X-Hub-Signature-256` header is missing or invalid
   **Then** the request is rejected with HTTP 401 (handled automatically by Chat SDK adapter)

3. **Given** a GET request arrives at the webhook endpoint
   **When** Meta sends a verification challenge with `hub.mode`, `hub.verify_token`, and `hub.challenge`
   **Then** the endpoint responds with the challenge value (handled by Chat SDK adapter)

4. **Given** a valid webhook event is received
   **When** the message is processed
   **Then** all business logic is deferred — no inline processing blocks the HTTP response

5. **Given** incoming message data is extracted
   **When** passed to the bot engine
   **Then** sender ID, text content, and media attachments (images) are correctly available

6. **Given** duplicate webhook deliveries arrive
   **When** the handler processes them
   **Then** they are handled idempotently (no duplicate side effects)

## Tasks / Subtasks

- [x] Task 1: Create `packages/bot-engine` package scaffolding (AC: #4, #5)
  - [x] 1.1: Create `packages/bot-engine/package.json` with name `@mascotinhos/bot-engine`
  - [x] 1.2: Create `packages/bot-engine/tsconfig.json` extending `@mascotinhos/config`
  - [x] 1.3: Create `packages/bot-engine/src/index.ts` entry point
  - [x] 1.4: Add `chat`, `@chat-adapter/whatsapp`, `@chat-adapter/state-memory` as dependencies
  - [x] 1.5: Workspace auto-discovered via `packages/*` glob — no manual root edit needed

- [x] Task 2: Initialize Chat SDK bot instance (AC: #1, #2, #3)
  - [x] 2.1: Create `packages/bot-engine/src/bot.ts` — Chat instance with WhatsApp adapter + memory state
  - [x] 2.2: Register minimal `onNewMention` handler with structured logging and PII masking
  - [x] 2.3: Export the `bot` instance from package index

- [x] Task 3: Create webhook API route (AC: #1, #2, #3, #4)
  - [x] 3.1: Create `apps/web/src/app/api/whatsapp/webhook/route.ts`
  - [x] 3.2: Implement GET handler: `return bot.webhooks.whatsapp(request)` (verification handshake)
  - [x] 3.3: Implement POST handler: `return bot.webhooks.whatsapp(request)` (message delivery)
  - [x] 3.4: Add `@mascotinhos/bot-engine: workspace:*` to `apps/web/package.json`

- [x] Task 4: Environment variables (AC: #1, #2)
  - [x] 4.1: Added `WHATSAPP_APP_SECRET: z.string().min(1)` to `server-schema.ts` — required by Chat SDK adapter for HMAC-SHA256 webhook signature verification
  - [x] 4.2: Updated both `payments/src/test-setup.ts` and new `bot-engine/src/test-setup.ts` with `WHATSAPP_APP_SECRET`
  - [x] 4.3: Adapter expects `WHATSAPP_VERIFY_TOKEN` env var but our schema uses `WHATSAPP_WEBHOOK_TOKEN` — passed explicitly via `createWhatsAppAdapter({ verifyToken: env.WHATSAPP_WEBHOOK_TOKEN })`

- [x] Task 5: Write tests (AC: #1-#6)
  - [x] 5.1: Created `packages/bot-engine/src/bot.test.ts` — tests bot instantiation and webhook handler
  - [x] 5.2: Created `packages/bot-engine/bunfig.toml` with `[test] preload = ["./src/test-setup.ts"]`
  - [x] 5.3: Created `packages/bot-engine/src/test-setup.ts` with all 17 env vars (16 from payments + WHATSAPP_APP_SECRET)
  - [x] 5.4: Verified webhook handler is a callable function via bot.webhooks.whatsapp

- [x] Task 6: Verify turbo pipeline (AC: #1)
  - [x] 6.1: `turbo.json` `"^build"` auto-resolves workspace deps — bot-engine included in scope
  - [x] 6.2: `bun run check-types` passes for bot-engine (test files excluded from tsc via tsconfig)
  - [x] 6.3: All 24 tests pass (2 bot-engine + 22 payments, 0 regressions)

## Dev Notes

### Architecture Compliance

**Package location:** `packages/bot-engine/` — this is the AI conversation engine package per the architecture doc. This story creates the package scaffolding and wires the WhatsApp adapter. Future stories (2.2-2.8) will add the state machine, agent, and tools.

**Thin orchestrator pattern:** The webhook route MUST be thin — validate input, delegate to Chat SDK, return 200. Never let exceptions propagate to HTTP response. All business logic lives in `packages/bot-engine`, not in the API route.

**Data access rule:** Only `packages/bot-engine` handles conversation logic. The webhook route in `apps/web` only calls `bot.webhooks.whatsapp(request)`.

### Chat SDK Setup Pattern

```typescript
// packages/bot-engine/src/bot.ts
import { Chat } from "chat";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";

export const bot = new Chat({
  userName: "mascotinhos",
  adapters: {
    whatsapp: createWhatsAppAdapter(),
    // Auto-reads env vars: WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET,
    // WHATSAPP_PHONE_NUMBER_ID. If adapter expects WHATSAPP_VERIFY_TOKEN
    // but our env uses WHATSAPP_WEBHOOK_TOKEN, pass explicitly:
    // whatsapp: createWhatsAppAdapter({ verifyToken: env.WHATSAPP_WEBHOOK_TOKEN }),
  },
});

// Minimal handler — Story 2.3 replaces with AI Agent.
// Verify: if WhatsApp DMs don't trigger onNewMention, use bot.on("message", ...) instead.
// All WhatsApp messages set isMention: true (DM-only platform), so onNewMention should work.
bot.onNewMention(async (thread, message) => {
  const phone = message.user?.id ?? "unknown";
  const masked = `***${phone.slice(-4)}`;
  console.log(JSON.stringify({ level: "info", event: "whatsapp_message_received", sender: masked, service: "bot-engine" }));
  await thread.startTyping();
  await thread.post("Oi! Estamos preparando tudo para voce. Em breve vou te atender!");
});
```

### Webhook Route Pattern

```typescript
// apps/web/src/app/api/whatsapp/webhook/route.ts
import { bot } from "@mascotinhos/bot-engine";

export async function GET(request: Request): Promise<Response> {
  return bot.webhooks.whatsapp(request);
}

export async function POST(request: Request): Promise<Response> {
  return bot.webhooks.whatsapp(request);
}
```

The Chat SDK adapter handles:
- GET: Meta verification handshake (hub.mode/verify_token/challenge)
- POST: HMAC-SHA256 signature verification via `X-Hub-Signature-256` header using `WHATSAPP_APP_SECRET`
- Media attachment downloading via `message.attachments[].fetchData()`
- All WhatsApp messages have `isMention: true` (DM-only platform)

### Environment Variables

**Already in `packages/env/src/server-schema.ts`** (from Story 1.3 — do NOT re-add):
- `WHATSAPP_ACCESS_TOKEN` — Meta Graph API access token
- `WHATSAPP_PHONE_NUMBER_ID` — Phone number ID from Meta dashboard
- `WHATSAPP_WEBHOOK_TOKEN` — Custom token for webhook verification handshake

**May need to add** (only if Chat SDK adapter requires it for HMAC-SHA256 body verification):
```typescript
WHATSAPP_APP_SECRET: z.string().min(1),  // Meta App Secret for X-Hub-Signature-256 verification
```

Check the `@chat-adapter/whatsapp` source or docs to confirm which env var names it reads. If it expects different names than ours, pass them explicitly in `createWhatsAppAdapter()`.

### WhatsApp Constraints (Critical)

- Webhook MUST respond <5 seconds (NFR-01) — Meta retries/fails otherwise
- Max 3 interactive buttons per message
- Button titles: max 20 characters
- Message body: max 1024 characters (auto-chunked at 4096)
- 24-hour customer service window — free-form messages only within window
- 72-hour window from click-to-WhatsApp ads (all messages free)
- Media URLs are temporary — download promptly via `fetchData()`

### Test Preload Strategy (from Story 1.4)

MUST use `bunfig.toml` with `[test] preload` — without it `@mascotinhos/env/server` crashes during tests because env vars aren't loaded. Pattern:

```toml
# packages/bot-engine/bunfig.toml
[test]
preload = ["./src/test-setup.ts"]
```

```typescript
// packages/bot-engine/src/test-setup.ts
// COPY ALL 16 env vars from packages/payments/src/test-setup.ts verbatim.
// That file is the canonical template. Add WHATSAPP_APP_SECRET if added in Task 4.
// The env schema validates ALL vars on import — missing any one crashes tests.
```

### Naming Conventions

- Files: kebab-case (`bot.ts`, `test-setup.ts`)
- Functions: camelCase
- Types: PascalCase
- Package: `@mascotinhos/bot-engine`
- API route: `/api/whatsapp/webhook` (kebab-case path)

### Project Structure After This Story

```
packages/bot-engine/
├── src/
│   ├── index.ts              # Package entry: export { bot } from "./bot"
│   ├── bot.ts                # Chat SDK instance + minimal onNewMention handler
│   ├── bot.test.ts           # Tests for bot instantiation
│   └── test-setup.ts         # Env var mocks (copy from payments/src/test-setup.ts)
├── package.json              # @mascotinhos/bot-engine
├── tsconfig.json
└── bunfig.toml               # [test] preload = ["./src/test-setup.ts"]

apps/web/src/app/api/whatsapp/
└── webhook/
    └── route.ts              # GET + POST → bot.webhooks.whatsapp(request)
```

### Scope Boundaries

**NOT in this story** — do NOT add these dependencies or features:
- `@mascotinhos/db` — no database operations (Story 2.2 adds this)
- `@mascotinhos/storage` — no file operations
- AI Agent / system prompt (Story 2.3)
- Any conversation tools (Stories 2.4-2.8)
- Message template handling (post-MVP)
- The `onNewMention` handler is a PLACEHOLDER — Story 2.3 replaces it with the AI Agent

**Task 3.4 detail:** Add `"@mascotinhos/bot-engine": "workspace:*"` to `apps/web/package.json` dependencies section.

### Previous Story Intelligence (Story 1.4)

Key patterns to follow from the payments package:
- **Package structure**: `package.json` with workspace deps, `tsconfig.json` extending config, `bunfig.toml` for test preload
- **Error handling**: Use `AppError` type with `code`, `retryable`, `orderId`, `cause` fields
- **Structured logging**: `{ level, event, orderId, service, ... }` — never `console.log`
- **PII redaction**: Phone numbers logged as last 4 digits only (`***1234`)
- **Export pattern**: Named exports from `src/index.ts`, not default exports

### Review Findings

- [x] [Review][Patch] Add try/catch error handling in onNewMention handler [bot.ts:28] — applied
- [x] [Review][Patch] Fix PII masking for short/missing userId [bot.ts:30] — applied
- [x] [Review][Patch] Document Chat SDK idempotency handling for AC#6 [bot.ts:27] — applied
- [x] [Review][Defer] In-memory state not suitable for serverless — deferred, MVP design decision (Story 2.2 upgrades)
- [x] [Review][Defer] No 5-second timeout guard on webhook — deferred, Chat SDK returns 200 immediately
- [x] [Review][Defer] HMR double handler registration in dev — deferred, dev-only issue
- [x] [Review][Defer] Module-level Chat construction throws if env missing — deferred, by-design (@t3-oss/env validates at startup)

### References

- [Source: .bmad_output/planning-artifacts/epics.md — Epic 2, Story 2.1]
- [Source: .bmad_output/planning-artifacts/architecture.md — WhatsApp Integration, Webhook Handlers, API Patterns]
- [Source: .bmad_output/planning-artifacts/prd.md — FR-01, NFR-01, NFR-07]
- [Source: .bmad_output/implementation-artifacts/story-1.4.md — Test preload pattern, error handling, package structure]
- [Source: Chat SDK docs — createWhatsAppAdapter, bot.webhooks.whatsapp, onNewMention]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Created `@mascotinhos/bot-engine` package with Chat SDK WhatsApp adapter
- Bot instance uses `createMemoryState()` for MVP (upgradeable to Redis in Story 2.2+)
- Adapter expects `WHATSAPP_VERIFY_TOKEN` but our env uses `WHATSAPP_WEBHOOK_TOKEN` — resolved by passing `verifyToken` explicitly
- Added `WHATSAPP_APP_SECRET` to env schema (required for HMAC-SHA256 webhook signature verification)
- Placeholder `onNewMention` handler logs with PII masking and sends greeting
- Webhook route is thin — delegates entirely to `bot.webhooks.whatsapp(request)`
- All 24 tests pass (2 new + 22 existing, 0 regressions)

### File List

New:
- `mascotinhos/packages/bot-engine/package.json`
- `mascotinhos/packages/bot-engine/tsconfig.json`
- `mascotinhos/packages/bot-engine/bunfig.toml`
- `mascotinhos/packages/bot-engine/src/index.ts`
- `mascotinhos/packages/bot-engine/src/bot.ts`
- `mascotinhos/packages/bot-engine/src/bot.test.ts`
- `mascotinhos/packages/bot-engine/src/test-setup.ts`
- `mascotinhos/apps/web/src/app/api/whatsapp/webhook/route.ts`

Modified:
- `mascotinhos/packages/env/src/server-schema.ts` (added WHATSAPP_APP_SECRET)
- `mascotinhos/packages/payments/src/test-setup.ts` (added WHATSAPP_APP_SECRET)
- `mascotinhos/apps/web/package.json` (added @mascotinhos/bot-engine dep)
- `mascotinhos/bun.lock` (updated lockfile)
