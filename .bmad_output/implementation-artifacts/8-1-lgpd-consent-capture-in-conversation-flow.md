# Story 8.1: LGPD Consent Capture in Conversation Flow

**Epic:** 8 — LGPD Compliance & Security
**Story ID:** 8.1
**GitHub Issue:** [mgiovani/fotos#76](https://github.com/mgiovani/fotos/issues/76)
**Status:** review
**Created:** 2026-03-30

---

## User Story

As a client sending photos of their child,
I want to be clearly informed about how my child's data will be used and give explicit consent,
So that I know my privacy rights are respected and the service operates legally.

---

## Acceptance Criteria

1. **Given** the conversation reaches the photo collection step
   **When** the client is about to send their first photo (entering COLLECTING_PHOTOS state for the first time)
   **Then** the bot displays the LGPD consent message: "Ao enviar a foto, você consente com o uso para geração da arte conforme nossos Termos de Uso e Política de Privacidade [link]"

2. **Given** the LGPD consent message is displayed
   **When** the client sends their first photo
   **Then** the consent timestamp is recorded in the Client table (`consentTimestamp` field) and `consentVersion` is set to `"1.0"`

3. **Given** a client has already given consent in a previous order (`consentTimestamp` is not null)
   **When** a new order reaches the photo collection step
   **Then** the LGPD consent message is NOT shown again (once-per-client, not once-per-order)

4. **Given** the LGPD consent message has been displayed
   **When** the client sends a photo
   **Then** the photo is accepted and stored normally (consent is implicit by continuing)

5. **Given** the privacy policy link in the consent message
   **When** the client taps it
   **Then** it points to the landing page `/privacy` page (e.g. `https://mascotinhos.vercel.app/privacy`)

6. **Given** the `captureConsent` tool is called
   **When** it updates the Client record
   **Then** it uses `update` with `where: { id: clientId }` and sets both `consentTimestamp: new Date()` and `consentVersion: "1.0"` atomically

---

## Tasks / Subtasks

- [x] Task 1: Create `captureConsent` tool in `packages/bot-engine/src/tools/capture-consent.ts` (AC: 1, 2, 4, 6)
  - [x] Export `captureConsent` using `tool({ description, inputSchema, execute })` pattern from `ai`
  - [x] Input schema: `z.object({ clientId: z.string().describe("Client DB ID"), orderId: z.string().describe("Current order ID") })`
  - [x] In `execute`: call `prisma.client.update({ where: { id: clientId }, data: { consentTimestamp: new Date(), consentVersion: "1.0" } })`
  - [x] Return `{ success: true, consentRecorded: true }` on success
  - [x] Log consent recording: `JSON.stringify({ level: "info", event: "lgpd_consent_captured", clientId, orderId, consentVersion: "1.0", service: "bot-engine" })`
  - [x] Wrap in try/catch; return `{ success: false, message: "Erro ao registrar consentimento" }` on DB error; log at `level: "error"` with event `"lgpd_consent_capture_failed"`

- [x] Task 2: Export `captureConsent` from `packages/bot-engine/src/tools/index.ts` and add to `allTools` (AC: all)
  - [x] Add `import { captureConsent } from "./capture-consent"` to `src/tools/index.ts`
  - [x] Add `captureConsent` to the named exports and to the `allTools` object

- [x] Task 3: Update system prompt to include LGPD consent step in COLLECTING_PHOTOS flow (AC: 1, 3, 5)
  - [x] In `packages/bot-engine/src/prompts/system-prompt.ts`, update `OrderContext` interface to include `hasConsent: boolean`
  - [x] In `buildSystemPrompt`, add `hasConsent` to the "Estado Atual da Conversa" section
  - [x] Update "Instrucoes para o estado COLLECTING_PHOTOS" section to add: if `hasConsent` is false, BEFORE calling `collectPhotos`, first send the LGPD consent message and call `captureConsent` with the clientId and orderId; if `hasConsent` is true, proceed directly to `collectPhotos`
  - [x] The LGPD message text must be: `"Ao enviar a foto, você consente com o uso para geração da arte conforme nossos Termos de Uso e Política de Privacidade: https://mascotinhos.vercel.app/privacy 🔒"`

- [x] Task 4: Pass `hasConsent` in `bot.ts` when calling `processMessage` (AC: 1, 3)
  - [x] In `packages/bot-engine/src/bot.ts`, after loading `order`, check `order.client.consentTimestamp !== null` to derive `hasConsent`
  - [x] Pass `hasConsent` to `processMessage` call inside the `OrderContext` object
  - [x] Confirm `loadActiveOrder` already uses `include: { client: true }` — it does, no change needed there

- [x] Task 5: Update `agent.ts` `OrderContext` interface to include `hasConsent: boolean` (AC: 1, 3)
  - [x] Add `hasConsent: boolean` to the `OrderContext` interface in `packages/bot-engine/src/agent.ts`
  - [x] The `buildSystemPrompt(order)` call already passes the whole `order` object, so it will be forwarded automatically

- [x] Task 6: Write unit tests for `captureConsent` tool (AC: 2, 6)
  - [x] Create `packages/bot-engine/src/tools/capture-consent.test.ts`
  - [x] Test: successfully records consent and returns `{ success: true }` when DB update succeeds
  - [x] Test: returns `{ success: false }` when DB throws an error
  - [x] Use same mock pattern as `collect-photos.test.ts` (`mock.module("@mascotinhos/db", ...)`)

- [x] Task 7: Run full test suite to confirm no regressions (AC: all)
  - [x] `cd mascotinhos && bun run check-types` — 0 new TypeScript errors in new/modified files (pre-existing collect-photos.ts(128) unchanged)
  - [x] `cd mascotinhos && bun test` — 334 pass (+3 new), 29 fail (same baseline), 5 errors (same baseline)

---

## Dev Notes

### File Locations — Critical

```
mascotinhos/
└── packages/
    └── bot-engine/
        └── src/
            ├── agent.ts                        ← MODIFY: add hasConsent to OrderContext interface
            ├── bot.ts                          ← MODIFY: derive hasConsent from client, pass to processMessage
            ├── prompts/
            │   └── system-prompt.ts            ← MODIFY: add hasConsent to OrderContext + LGPD logic in COLLECTING_PHOTOS
            └── tools/
                ├── capture-consent.ts          ← NEW: captureConsent tool
                ├── capture-consent.test.ts     ← NEW: unit tests
                └── index.ts                    ← MODIFY: export + allTools entry
```

### Prisma Schema — Client Model (No Migration Needed)

The `Client` model already has both fields — they were added in Story 1.1:

```prisma
model Client {
  id               String    @id @default(cuid())
  whatsappSenderId String    @unique
  phone            String?   @unique
  name             String?
  consentTimestamp DateTime?   // ← already exists, set to now() when consent captured
  consentVersion   String?     // ← already exists, set to "1.0"
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?
  orders Order[]
}
```

**No Prisma migration needed** — fields already exist in schema.

### Consent Logic — Once Per Client

The key check is `client.consentTimestamp !== null`:
- If `null` → client has never consented → show LGPD message, call `captureConsent`, then accept photo
- If non-null → client already consented (any prior order) → skip message, accept photo directly

This is evaluated at **bot.ts** level (where `order.client` is already loaded via `include: { client: true }`).

### LGPD Consent Message — Exact Text

```
"Ao enviar a foto, você consente com o uso para geração da arte conforme nossos Termos de Uso e Política de Privacidade: https://mascotinhos.vercel.app/privacy 🔒"
```

This text must appear verbatim in the system prompt instructions so the agent sends it correctly.

### captureConsent Tool — Pattern

Follow exact same `tool(...)` pattern from `ai` SDK as other tools:

```typescript
import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";

export const captureConsent = tool({
  description: "Record LGPD consent for a client when they send their first photo. Call once per client before accepting the first photo in COLLECTING_PHOTOS state.",
  inputSchema: z.object({
    clientId: z.string().describe("Client DB ID (from order.client.id)"),
    orderId: z.string().describe("Current order ID for audit log"),
  }),
  execute: async ({ clientId, orderId }) => {
    try {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          consentTimestamp: new Date(),
          consentVersion: "1.0",
        },
      });
      console.log(JSON.stringify({
        level: "info",
        event: "lgpd_consent_captured",
        clientId,
        orderId,
        consentVersion: "1.0",
        service: "bot-engine",
      }));
      return { success: true, consentRecorded: true };
    } catch (err) {
      console.log(JSON.stringify({
        level: "error",
        event: "lgpd_consent_capture_failed",
        clientId,
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }));
      return { success: false, message: "Erro ao registrar consentimento" };
    }
  },
});
```

### System Prompt Update — COLLECTING_PHOTOS Section

The existing section:
```
## Instrucoes para o estado COLLECTING_PHOTOS
Quando o estado for COLLECTING_PHOTOS:
1. Se a mensagem contiver [URLs das fotos: ...], chame IMEDIATAMENTE a ferramenta collectPhotos...
```

Must be updated to add consent gate:
```
## Instrucoes para o estado COLLECTING_PHOTOS
Quando o estado for COLLECTING_PHOTOS:
0. LGPD (apenas se hasConsent = false): Se hasConsent for false, ANTES de aceitar qualquer foto:
   a) Envie a mensagem de consentimento: "Ao enviar a foto, você consente com o uso para geração da arte conforme nossos Termos de Uso e Política de Privacidade: https://mascotinhos.vercel.app/privacy 🔒"
   b) Chame IMEDIATAMENTE captureConsent com clientId = ID do cliente atual e orderId = ID do pedido atual
   c) Após captureConsent retornar, aceite a foto e prossiga normalmente com collectPhotos
   Se hasConsent for true, pule este passo e vá direto para o passo 1.
1. Se a mensagem contiver [URLs das fotos: ...], chame IMEDIATAMENTE a ferramenta collectPhotos...
```

### OrderContext Interface — Both Files

Two files define `OrderContext` independently — both must be updated:
1. `packages/bot-engine/src/agent.ts` — the interface used by `processMessage`
2. `packages/bot-engine/src/prompts/system-prompt.ts` — the interface used by `buildSystemPrompt`

Add `hasConsent: boolean` to both. The `buildSystemPrompt` function already has a dynamic section for conversation context — add `hasConsent` there.

### bot.ts Changes — Minimal

Only one line changes in bot.ts — add `hasConsent` to the `processMessage` call:

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
    preFillText: order.conversationState === "GREETING" ? userText : null,
    hasConsent: order.client.consentTimestamp !== null,  // ← NEW
  },
  contextualMessage,
  history,
);
```

`order.client` is already loaded (loadActiveOrder uses `include: { client: true }`), so no extra DB query needed.

### Test Pattern — capture-consent.test.ts

Follow the identical mock pattern from `collect-photos.test.ts`:

```typescript
import { describe, expect, it, mock, beforeEach } from "bun:test";

const mockClientUpdate = mock(() => Promise.resolve({ id: "client-1", consentTimestamp: new Date(), consentVersion: "1.0" }));
mock.module("@mascotinhos/db", () => ({
  default: {
    client: { update: mockClientUpdate },
  },
}));

import { captureConsent } from "./capture-consent";

describe("captureConsent", () => {
  // ...
});
```

Note: bun:test mocks must be called BEFORE the import. This is the established pattern in the codebase.

### Testing Baseline

From Story 7.4 learnings:
- Pre-existing test failures: 331 pass, 29 fail, 5 errors
- Pre-existing TypeScript errors in payments/storage packages are acceptable
- Always run `check-types` from `mascotinhos/` root
- `bun:test` type import errors are pre-existing — do not count as regressions

### Architecture Compliance

- Tool location: `packages/bot-engine/src/tools/` (all tools live here per architecture)
- Tool export: must be added to `allTools` in `index.ts` (agent uses `allTools` object)
- Logging: structured JSON `console.log(JSON.stringify({...}))` pattern — never bare strings
- No new Prisma migrations — `consentTimestamp` and `consentVersion` already exist in schema
- No new packages/dependencies — uses existing `ai`, `zod`, `@mascotinhos/db`
- PII in logs: `clientId` is a cuid (non-PII), never log phone/name/whatsappSenderId

### Previous Story Learnings

From Story 7.4:
- Test baseline: 331 pass, 29 fail, 5 errors — do NOT break more
- Run `bun run check-types` from `mascotinhos/` root (not from packages)

From Story 7.1 (error handling pattern):
- All console logging uses `JSON.stringify({ level, event, ...context, service })` pattern
- Service name for bot-engine tools: `"bot-engine"`

From Story 2.5 (collect-photos):
- The `collect-photos.test.ts` mock pattern is the correct one for tool tests
- bun mocks must be declared before the import statement

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `tools.test.ts` asserted `allTools` had length 10 — updated to 11 to include `captureConsent`. This was the only regression introduced and was immediately fixed.
- `capture-consent.test.ts` fails in isolation (without preload) — same behaviour as all other bot-engine tool tests. The `bunfig.toml` preload (`src/test-setup.ts`) only fires when bun discovers tests from the package root. Not a regression.

### Completion Notes List

- Created `packages/bot-engine/src/tools/capture-consent.ts`: new `captureConsent` tool using AI SDK `tool()` pattern. Calls `prisma.client.update` to set `consentTimestamp: new Date()` and `consentVersion: "1.0"`. Structured JSON logging for both success (`lgpd_consent_captured`) and error (`lgpd_consent_capture_failed`) events. Returns `{ success: true, consentRecorded: true }` or `{ success: false, message: "..." }`.
- Updated `packages/bot-engine/src/tools/index.ts`: added `captureConsent` import, named export, and entry in `allTools` object (now 11 tools).
- Updated `packages/bot-engine/src/prompts/system-prompt.ts`: added `hasConsent: boolean` to `OrderContext` interface; added `hasConsent` line to "Estado Atual da Conversa" dynamic section; updated "Instrucoes para o estado COLLECTING_PHOTOS" with LGPD consent gate (step 0) — sends exact consent message and calls `captureConsent` only when `hasConsent` is false.
- Updated `packages/bot-engine/src/agent.ts`: added `hasConsent: boolean` to `OrderContext` interface.
- Updated `packages/bot-engine/src/bot.ts`: passes `hasConsent: order.client.consentTimestamp !== null` in `processMessage` call — zero extra DB queries (client already loaded via `include: { client: true }`).
- Created `packages/bot-engine/src/tools/capture-consent.test.ts`: 3 tests — records consent successfully, handles DB errors gracefully, verifies `consentVersion: "1.0"`. All 3 pass.
- Updated `packages/bot-engine/src/tools/tools.test.ts`: updated tool count assertion from 10 to 11, added `captureConsent` to `names.toContain` check.
- Final test counts: 334 pass (+3), 29 fail (baseline unchanged), 5 errors (baseline unchanged).
- No Prisma migration needed — `consentTimestamp` and `consentVersion` fields already exist in `Client` model (added in Story 1.1).

### File List

- `mascotinhos/packages/bot-engine/src/tools/capture-consent.ts` (new)
- `mascotinhos/packages/bot-engine/src/tools/capture-consent.test.ts` (new)
- `mascotinhos/packages/bot-engine/src/tools/index.ts` (modified — added captureConsent export + allTools entry)
- `mascotinhos/packages/bot-engine/src/tools/tools.test.ts` (modified — updated tool count 10→11, added captureConsent assertion)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` (modified — added hasConsent to OrderContext + LGPD consent gate in COLLECTING_PHOTOS)
- `mascotinhos/packages/bot-engine/src/agent.ts` (modified — added hasConsent to OrderContext interface)
- `mascotinhos/packages/bot-engine/src/bot.ts` (modified — passes hasConsent to processMessage)
- `.bmad_output/implementation-artifacts/8-1-lgpd-consent-capture-in-conversation-flow.md` (this file)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` (modified — story status)

### Change Log

- 2026-03-30: Implemented Story 8.1 — created `captureConsent` tool that records LGPD consent (`consentTimestamp`, `consentVersion: "1.0"`) on the Client model; wired into `allTools`; updated system prompt to gate COLLECTING_PHOTOS with consent message + `captureConsent` call when `hasConsent` is false; updated `OrderContext` in agent.ts and system-prompt.ts to include `hasConsent`; bot.ts derives `hasConsent` from `order.client.consentTimestamp !== null` (no extra DB query). All 6 ACs satisfied. 3 new unit tests added. 334 pass, no new regressions.
