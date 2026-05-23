# Story 2.7: Outfit and Extra Requests Collection

Status: done
GitHub Issue: [mgiovani/fotos#51](https://github.com/mgiovani/fotos/issues/51)

## Story

As a client,
I want to describe the outfit my child will wear and any special additions,
So that the mascotinho illustration includes these personalized details.

## Acceptance Criteria

1. **Given** the conversation is in COLLECTING_OUTFIT state
   **When** the client sends text describing the outfit
   **Then** the `collectOutfit` tool stores the description in `Order.outfitDescription`
   **And** the bot asks for any extra requests ("Quer adicionar algo especial? Balao, cachorrinho, brinquedo...")
   **And** the order transitions to an intermediate "waiting for extras" sub-step (handled by the same tool call)

2. **Given** the conversation is in COLLECTING_OUTFIT state
   **When** the client sends a reference image of the outfit
   **Then** the image is uploaded to the `references` bucket (via `@mascotinhos/storage` `uploadReference`) alongside the child's photos
   **And** the storage path is appended as an annotation to `Order.outfitDescription` in the format `[imagem de referencia: <storagePath>]`
   **And** the bot asks for any extra requests

3. **Given** the bot has asked for extra requests
   **When** the client sends extra requests text (e.g. "balão e cachorrinho")
   **Then** `Order.extraRequests` is updated with the text
   **And** the order transitions to CONFIRMING_ORDER

4. **Given** the bot has asked for extra requests
   **When** the client responds "nao", "não", "sem extras", "nada", "nao quero", or similar skip signals
   **Then** `Order.extraRequests` remains null (do NOT store the skip word — leave field untouched)
   **And** the order transitions to CONFIRMING_ORDER

5. **Given** the client wants to skip the outfit description
   **When** the client sends "pular", "sem roupa", "nao sei", "nao importa", or similar skip signals
   **Then** `Order.outfitDescription` remains null
   **And** the bot proceeds to ask for extra requests

6. **Given** `collectOutfit` is called with `orderId` that does not exist
   **Then** the tool returns `{ success: false, message: "Pedido não encontrado." }`

7. **Given** `collectOutfit` executes successfully (outfit saved + extras asked)
   **When** the state transition COLLECTING_OUTFIT → CONFIRMING_ORDER is attempted
   **Then** `updateOrderState(orderId, "COLLECTING_OUTFIT", "CONFIRMING_ORDER")` is called
   **And** it is wrapped in try/catch — non-fatal if it throws or races

8. **Given** a database error occurs during `Order.update` (outfit or extras write)
   **Then** the tool returns `{ success: false, message: "<descriptive error message>" }`
   **And** the state transition is NOT attempted

**FRs covered:** FR-12 (outfit/clothing description collection), FR-13 (extra requests collection)
**Technical notes:** Outfit description and extras are free-text nullable fields. The AI agent parses natural language. Allow the client to skip outfit description (nullable). Reference outfit images follow the same upload path as child photos.

## Tasks / Subtasks

- [x] Task 1: Implement `collectOutfit` tool (AC: #1–#8)
  - [x] 1.1: Replace the stub in `packages/bot-engine/src/tools/collect-outfit.ts` with full implementation
    - **FIRST** check if stub already exists (it may have been created in Story 2.3 scaffolding — see Dev Notes)
    - If stub doesn't exist, create the file
  - [x] 1.2: `inputSchema: z.object({ outfitDescription: z.string().nullable().describe("..."), outfitImageUrl: z.string().nullable().describe("..."), extraRequests: z.string().nullable().describe("..."), orderId: z.string().describe("..."), phase: z.enum(["outfit", "extras"]).describe("...") })` — see Dev Notes for rationale
  - [x] 1.3: `execute`: load order via `prisma.order.findUnique({ where: { id: orderId } })` — if null, return `{ success: false, message: "Pedido não encontrado." }`
  - [x] 1.4: If `phase === "outfit"`:
    - If `outfitDescription` is non-null and non-empty: sanitize (trim + slice to `MAX_OUTFIT_LENGTH`) and `prisma.order.update({ where: { id: orderId }, data: { outfitDescription: sanitized } })`
    - If `outfitImageUrl` is provided: upload via `uploadReference(orderId, filename, buffer, mimeType)` and append storage path to `outfitDescription`
    - Return `{ success: true, phase: "outfit", message: "Anotei a roupa! ... Quer adicionar algo especial?" }`
  - [x] 1.5: If `phase === "extras"`:
    - If `extraRequests` is non-null, non-empty, and NOT a skip signal: sanitize and `prisma.order.update({ where: { id: orderId }, data: { extraRequests: sanitized } })`
    - If skip signal: do NOT update `extraRequests` (leave null)
    - Call `updateOrderState(orderId, "COLLECTING_OUTFIT", "CONFIRMING_ORDER")` — wrap in try/catch; non-fatal
    - Return `{ success: true, phase: "extras", transitioned: true, message: "Perfeito! ..." }`
  - [x] 1.6: Export from `tools/index.ts` and add to `allTools` — **CRITICAL: update the tool count in `tools.test.ts` to 9**
  - [x] 1.7: Structured logging for both phases (see Dev Notes)

- [x] Task 2: Update system prompt for COLLECTING_OUTFIT state (AC: #1–#5, #7)
  - [x] 2.1: Edit `packages/bot-engine/src/prompts/system-prompt.ts`
  - [x] 2.2: Add `COLLECTING_OUTFIT` instruction block AFTER the existing `COLLECTING_THEME` block (COLLECTING_OUTFIT is the next state after COLLECTING_THEME in the flow)
  - [x] 2.3: Two-phase instruction:
    - Phase 1 (outfit): "Quando o estado for COLLECTING_OUTFIT, pergunte sobre a roupa da crianca. Quando o cliente responder (texto ou imagem), chame IMEDIATAMENTE collectOutfit com phase='outfit'"
    - Phase 2 (extras): "Apos retornar phase='outfit', pergunte sobre extras. Quando o cliente responder, chame collectOutfit com phase='extras'"
    - Skip signals: "Se o cliente disser que nao tem roupa especial ou quiser pular, chame collectOutfit com phase='outfit' e outfitDescription=null"

- [x] Task 3: Write tests (AC: #1–#8)
  - [x] 3.1: Create `packages/bot-engine/src/tools/collect-outfit.test.ts`
    - [x] 3.1.1: Mock `@mascotinhos/db` via `mock.module()` BEFORE any imports — follow exact pattern from `select-style.test.ts`
    - [x] 3.1.2: Mock `../conversation` for `updateOrderState` — same pattern
    - [x] 3.1.3: Mock `@mascotinhos/storage` for `uploadReference` — only needed for outfit image path
    - [x] 3.1.4: Static import AFTER all `mock.module()` calls: `import { collectOutfit } from "./collect-outfit"`
    - [x] 3.1.5: Test phase="outfit" with text: updates `outfitDescription`, returns success with phase="outfit"
    - [x] 3.1.6: Test phase="outfit" skip signal: does NOT update `outfitDescription`, returns success
    - [x] 3.1.7: Test phase="extras" with text: updates `extraRequests`, transitions state, returns transitioned=true
    - [x] 3.1.8: Test phase="extras" skip signal ("nao"): does NOT update `extraRequests`, still transitions state
    - [x] 3.1.9: Test order not found: returns `{ success: false, message: "Pedido não encontrado." }`
    - [x] 3.1.10: Test state transition failure is non-fatal: `updateOrderState` throws → tool still returns `{ success: true }`
    - [x] 3.1.11: Test input sanitization: text > `MAX_OUTFIT_LENGTH` chars is truncated
    - [x] 3.1.12: Test DB error handling: DB error returns `{ success: false }` (no crash)
  - [x] 3.2: Update `packages/bot-engine/src/prompts/system-prompt.test.ts`
    - [x] 3.2.1: Add test: when `conversationState === "COLLECTING_OUTFIT"`, the prompt contains "collectOutfit" instruction
  - [x] 3.3: Update `packages/bot-engine/src/tools/tools.test.ts`
    - [x] 3.3.1: Update `toHaveLength(8)` → `toHaveLength(9)` (adds `collectOutfit`)
    - [x] 3.3.2: Add `expect(names).toContain("collectOutfit")` assertion
    - [x] 3.3.3: Update the import line to add `collectOutfit`: `import { allTools, collectPhotos, selectStyle, confirmOrder, generatePayment, enqueueGeneration, deliverImage, handleRevision, getGreetingContext, collectOutfit } from "./index";`

- [x] Task 4: Type-check and test pipeline (AC: #1–#8)
  - [x] 4.1: Run `bun run check-types` from `mascotinhos/` — must pass with 0 new errors (pre-existing @mascotinhos/storage TS2307 in collect-photos.ts and payments package; 0 new errors introduced by this story)
  - [x] 4.2: Run `bun test` from `mascotinhos/packages/bot-engine/` — all new collect-outfit and system-prompt tests pass (80 pass, 0 fail)

## Dev Notes

### CRITICAL: Check for Existing Stub First

Story 2.3 scaffolded stubs for all tools. Check if `packages/bot-engine/src/tools/collect-outfit.ts` already exists:
- If it exists as a stub (execute returns "Not implemented yet — Story 2.7"), **replace content in place**
- If it does NOT exist, create it
- Either way, the export in `tools/index.ts` may already exist — **check before adding**

### Exact File Locations

- **Check/modify**: `packages/bot-engine/src/tools/collect-outfit.ts` (stub → implementation or new file)
- **Modify**: `packages/bot-engine/src/tools/index.ts` (add `collectOutfit` export if not present)
- **Modify**: `packages/bot-engine/src/prompts/system-prompt.ts` (add COLLECTING_OUTFIT block)
- **Create new**: `packages/bot-engine/src/tools/collect-outfit.test.ts`
- **Modify**: `packages/bot-engine/src/prompts/system-prompt.test.ts` (add 1 test)
- **Modify**: `packages/bot-engine/src/tools/tools.test.ts` (update count 8→9, add name assertion)

### AI SDK v6: `inputSchema` NOT `parameters`

```typescript
// CORRECT (AI SDK v6):
export const collectOutfit = tool({
  description: "...",
  inputSchema: z.object({ ... }),
  execute: async (input) => { ... },
});
// WRONG: parameters: z.object({...})  ← DO NOT use
```

### Two-Phase Tool Design

The `collectOutfit` tool handles two distinct sub-steps in COLLECTING_OUTFIT state:
- **Phase "outfit"**: Save outfit text/image, do NOT transition state — return prompt to ask for extras
- **Phase "extras"**: Save extras (or skip), then transition to CONFIRMING_ORDER

The AI agent calls the tool twice (once per phase). The `phase` parameter drives the behavior.

```typescript
const MAX_OUTFIT_LENGTH = 300; // outfit descriptions can be slightly longer than themes

export const collectOutfit = tool({
  description: "Collect outfit description and extra requests for the mascotinho. Called in two phases: 'outfit' to save outfit info, 'extras' to save extras and transition to order confirmation.",
  inputSchema: z.object({
    phase: z.enum(["outfit", "extras"]).describe("'outfit' = save outfit info and ask for extras; 'extras' = save extras and proceed to confirmation"),
    outfitDescription: z.string().nullable().describe("Text description of the outfit, or null to skip"),
    outfitImageUrl: z.string().nullable().describe("WhatsApp CDN URL of outfit reference image, or null if not provided"),
    extraRequests: z.string().nullable().describe("Extra additions the client wants (balloons, toys, pets), or null to skip"),
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ phase, outfitDescription, outfitImageUrl, extraRequests, orderId }) => {
    // ... see full implementation reference below
  },
});
```

### Skip Signal Detection

Use a simple lowercase-trim check for skip signals. Do NOT store skip words in the DB:

```typescript
const OUTFIT_SKIP_SIGNALS = ["pular", "sem roupa", "nao sei", "não sei", "nao importa", "não importa", "qualquer", "nao", "não", "skip"];
const EXTRAS_SKIP_SIGNALS = ["nao", "não", "sem extras", "nada", "nao quero", "não quero", "nao precisa", "não precisa", "skip"];

function isSkipSignal(text: string | null | undefined, signals: string[]): boolean {
  if (!text) return true; // null/empty = skip
  const normalized = text.trim().toLowerCase();
  // Use `startsWith(s + " ")` (not bare `startsWith(s)`) to avoid false positives:
  // e.g. "nao" would incorrectly match "naozinho" without the space guard.
  return signals.some(s => normalized === s || normalized.startsWith(s + " "));
}
```

### Outfit Reference Image Upload Pattern

Follow the EXACT pattern from `collect-photos.ts` (Story 2.5):

```typescript
if (outfitImageUrl) {
  try {
    const response = await fetch(outfitImageUrl, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    });
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      const ext = mimeType.includes("png") ? "png" : "jpg";
      const filename = `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const storagePath = await uploadReference(orderId, filename, buffer, mimeType);
      // Append storage path as annotation to outfitDescription
      const imageNote = `[imagem de referencia: ${storagePath}]`;
      sanitizedOutfit = sanitizedOutfit ? `${sanitizedOutfit} ${imageNote}` : imageNote;
    }
  } catch (imgErr) {
    // Non-fatal: log and continue without image
    console.log(JSON.stringify({ level: "warn", event: "outfit_image_upload_failed", orderId, error: imgErr instanceof Error ? imgErr.message : String(imgErr), service: "bot-engine" }));
  }
}
```

### `updateOrderState` Pattern (Non-Fatal)

```typescript
try {
  await updateOrderState(orderId, "COLLECTING_OUTFIT", "CONFIRMING_ORDER");
} catch (stateErr) {
  console.log(JSON.stringify({
    level: "error",
    event: "state_transition_failed",
    orderId,
    from: "COLLECTING_OUTFIT",
    to: "CONFIRMING_ORDER",
    error: stateErr instanceof Error ? stateErr.message : String(stateErr),
    service: "bot-engine",
  }));
  // Non-fatal: outfit/extras already saved; state will self-correct on next interaction
}
```

### Full `collectOutfit` Implementation Reference

```typescript
import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { uploadReference } from "@mascotinhos/storage";
import { env } from "@mascotinhos/env/server";
import { updateOrderState } from "../conversation";

const MAX_OUTFIT_LENGTH = 300;
const OUTFIT_SKIP_SIGNALS = ["pular", "sem roupa", "nao sei", "não sei", "nao importa", "não importa", "qualquer", "nao", "não", "skip"];
const EXTRAS_SKIP_SIGNALS = ["nao", "não", "sem extras", "nada", "nao quero", "não quero", "nao precisa", "não precisa", "skip"];

function isSkipSignal(text: string | null | undefined, signals: string[]): boolean {
  if (!text) return true;
  const normalized = text.trim().toLowerCase();
  return signals.some(s => normalized === s || normalized.startsWith(s + " "));
}

export const collectOutfit = tool({
  description: "Collect outfit description and extra requests for the mascotinho. Called in two phases: 'outfit' to save outfit info and ask for extras; 'extras' to save extras and proceed to confirmation.",
  inputSchema: z.object({
    phase: z.enum(["outfit", "extras"]).describe("'outfit' = save outfit info and ask for extras; 'extras' = save extras and proceed to order confirmation"),
    outfitDescription: z.string().nullable().describe("Text description of the outfit, or null to skip"),
    outfitImageUrl: z.string().nullable().describe("WhatsApp CDN URL of outfit reference image, or null if not provided"),
    extraRequests: z.string().nullable().describe("Extra additions the client wants (balloons, toys, pets), or null to skip"),
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ phase, outfitDescription, outfitImageUrl, extraRequests, orderId }) => {
    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "collect_outfit_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao buscar pedido. Tente novamente." };
    }

    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    if (phase === "outfit") {
      let sanitizedOutfit: string | null = null;

      if (!isSkipSignal(outfitDescription, OUTFIT_SKIP_SIGNALS)) {
        sanitizedOutfit = outfitDescription!.trim().slice(0, MAX_OUTFIT_LENGTH);
      }

      // Upload outfit reference image if provided (non-fatal on failure)
      if (outfitImageUrl) {
        try {
          const response = await fetch(outfitImageUrl, {
            headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
          });
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
            const ext = mimeType.includes("png") ? "png" : "jpg";
            const filename = `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const storagePath = await uploadReference(orderId, filename, buffer, mimeType);
            const imageNote = `[imagem de referencia: ${storagePath}]`;
            sanitizedOutfit = sanitizedOutfit ? `${sanitizedOutfit} ${imageNote}` : imageNote;
          }
        } catch (imgErr) {
          console.log(JSON.stringify({ level: "warn", event: "outfit_image_upload_failed", orderId, error: imgErr instanceof Error ? imgErr.message : String(imgErr), service: "bot-engine" }));
        }
      }

      if (sanitizedOutfit !== null) {
        try {
          await prisma.order.update({ where: { id: orderId }, data: { outfitDescription: sanitizedOutfit } });
        } catch (dbErr) {
          console.log(JSON.stringify({ level: "error", event: "collect_outfit_update_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
          return { success: false, message: "Erro ao salvar a roupa. Tente novamente." };
        }
      }

      console.log(JSON.stringify({ level: "info", event: "outfit_collected", orderId, hasOutfit: sanitizedOutfit !== null, service: "bot-engine" }));

      return {
        success: true,
        phase: "outfit",
        outfitSaved: sanitizedOutfit !== null,
        message: sanitizedOutfit
          ? `Roupa anotada! Quer adicionar algo especial? 🎈 Ex: balão, cachorrinho, brinquedo favorito... ou diga "não" para pular.`
          : `Sem problema! Quer adicionar algo especial? 🎈 Ex: balão, cachorrinho, brinquedo favorito... ou diga "não" para pular.`,
      };
    }

    // phase === "extras"
    let sanitizedExtras: string | null = null;

    if (!isSkipSignal(extraRequests, EXTRAS_SKIP_SIGNALS)) {
      sanitizedExtras = extraRequests!.trim().slice(0, MAX_OUTFIT_LENGTH);
    }

    if (sanitizedExtras !== null) {
      try {
        await prisma.order.update({ where: { id: orderId }, data: { extraRequests: sanitizedExtras } });
      } catch (dbErr) {
        console.log(JSON.stringify({ level: "error", event: "collect_extras_update_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
        return { success: false, message: "Erro ao salvar os extras. Tente novamente." };
      }
    }

    try {
      await updateOrderState(orderId, "COLLECTING_OUTFIT", "CONFIRMING_ORDER");
    } catch (stateErr) {
      console.log(JSON.stringify({ level: "error", event: "state_transition_failed", orderId, from: "COLLECTING_OUTFIT", to: "CONFIRMING_ORDER", error: stateErr instanceof Error ? stateErr.message : String(stateErr), service: "bot-engine" }));
      // Non-fatal: extras already saved; state will self-correct on next interaction
    }

    console.log(JSON.stringify({ level: "info", event: "extras_collected", orderId, hasExtras: sanitizedExtras !== null, service: "bot-engine" }));

    return {
      success: true,
      phase: "extras",
      extrasSaved: sanitizedExtras !== null,
      transitioned: true,
      message: sanitizedExtras
        ? `Anotei: ${sanitizedExtras}! 🎉 Agora vamos revisar seu pedido...`
        : `Perfeito! Vamos revisar seu pedido! 🎉`,
    };
  },
});
```

### Prisma Schema — Exact Fields (Order model)

```
outfitDescription  String?  // Free-text or image path annotation — nullable, always set via collectOutfit
extraRequests      String?  // Free-text optional extras — nullable, null if skipped
conversationState  ConversationState @default(GREETING)
```

Both fields are nullable. Do NOT store skip signals like "nao" — leave null.

### tools/index.ts — Must Update

Current state (8 tools):
```typescript
import { collectPhotos } from "./collect-photos";
import { selectStyle } from "./select-style";
// ... 6 more

export const allTools = {
  collectPhotos,
  selectStyle,
  confirmOrder,
  // ...
};
```

After this story (9 tools) — add `collectOutfit`:
```typescript
import { collectOutfit } from "./collect-outfit";
// ... export it and add to allTools
```

### tools.test.ts — Must Update Tool Count

**CRITICAL: Update `toHaveLength(8)` → `toHaveLength(9)`** and add the name assertion:
```typescript
expect(Object.keys(allTools)).toHaveLength(9); // was 8
expect(names).toContain("collectOutfit");       // new assertion
```

### State Transition Scope

```
Story 2.6: COLLECTING_THEME → COLLECTING_OUTFIT (via selectStyle)
Story 2.7: COLLECTING_OUTFIT → CONFIRMING_ORDER (via collectOutfit, phase="extras")
Story 2.8: CONFIRMING_ORDER → AWAITING_PAYMENT (via confirmOrder — stub exists)
```

### System Prompt Addition for COLLECTING_OUTFIT

Add this block to `buildSystemPrompt()` AFTER the existing `## Instrucoes para o estado COLLECTING_THEME` block (COLLECTING_OUTFIT follows COLLECTING_THEME in the conversation flow):

```
## Instrucoes para o estado COLLECTING_OUTFIT
Quando o estado for COLLECTING_OUTFIT:
1. FASE ROUPA: Pergunte sobre a roupa da crianca ("Como vai ser a roupinha? Pode descrever ou enviar uma foto! 👗")
   - Quando o cliente responder (texto ou imagem), chame IMEDIATAMENTE collectOutfit com phase='outfit', outfitDescription=descricao ou null se quiser pular, outfitImageUrl=URL da imagem se enviada ou null, orderId=ID do pedido
2. FASE EXTRAS: Apos collectOutfit retornar phase='outfit', pergunte sobre extras conforme a mensagem retornada
   - Quando o cliente responder, chame IMEDIATAMENTE collectOutfit com phase='extras', extraRequests=texto ou null se quiser pular, orderId=ID do pedido
3. Apos collectOutfit retornar phase='extras' com transitioned=true, informe que vamos revisar o pedido
```

### Test Mocking Pattern (Follow select-style.test.ts Exactly)

```typescript
import { describe, expect, it, mock, beforeEach } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
const mockFindUnique = mock(() =>
  Promise.resolve({ id: "order-1", conversationState: "COLLECTING_OUTFIT" }),
);
const mockOrderUpdate = mock(() => Promise.resolve({ id: "order-1" }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique, update: mockOrderUpdate },
  },
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Mock storage only if testing outfit image upload path
const mockUploadReference = mock(async (_orderId: string, filename: string) =>
  `references/order-1/${filename}`,
);
mock.module("@mascotinhos/storage", () => ({
  uploadReference: mockUploadReference,
}));

// Mock env for WHATSAPP_ACCESS_TOKEN (needed for outfit image fetch)
mock.module("@mascotinhos/env/server", () => ({
  env: { WHATSAPP_ACCESS_TOKEN: "test-token" },
}));

// Static import AFTER all mock.module() calls
import { collectOutfit } from "./collect-outfit";

// IMPORTANT: Clear ALL mocks in beforeEach to prevent test bleed
// (including mockUploadReference — it accumulates calls across tests)
describe("collectOutfit", () => {
  beforeEach(() => {
    mockFindUnique.mockClear();
    mockOrderUpdate.mockClear();
    mockUpdateOrderState.mockClear();
    mockUploadReference.mockClear();

    // Reset defaults
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: "order-1", conversationState: "COLLECTING_OUTFIT" }),
    );
    mockOrderUpdate.mockImplementation(() => Promise.resolve({ id: "order-1" }));
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(true));
    mockUploadReference.mockImplementation(async (_orderId: string, filename: string) =>
      `references/order-1/${filename}`,
    );
  });

  // ... tests here
});
```

### Structured Logging Pattern

```typescript
// Outfit collected
console.log(JSON.stringify({ level: "info", event: "outfit_collected", orderId, hasOutfit: true, service: "bot-engine" }));

// Extras collected
console.log(JSON.stringify({ level: "info", event: "extras_collected", orderId, hasExtras: false, service: "bot-engine" }));

// Errors (use level: "error")
console.log(JSON.stringify({ level: "error", event: "collect_outfit_db_error", orderId, error: "...", service: "bot-engine" }));
```

### Key Patterns From Previous Stories (Do NOT Reinvent)

1. **`inputSchema`** not `parameters` — AI SDK v6 (critical — enforced in Story 2.6)
2. **`mock.module()` BEFORE static imports** — bun test mocking requirement
3. **`updateOrderState` non-fatal** — wrap in try/catch; log; continue (same as collectPhotos, selectStyle)
4. **Structured JSON logging** — `JSON.stringify({ level, event, service: "bot-engine", ...})` always
5. **DB error handling** — wrap each DB call in try/catch; return `{ success: false, message }` on failure
6. **Input sanitization** — `.trim().slice(0, MAX_LENGTH)` before storing
7. **`uploadReference` from `@mascotinhos/storage`** — same package used by collectPhotos
8. **`env.WHATSAPP_ACCESS_TOKEN`** via `@mascotinhos/env/server` — never `process.env` directly
9. **`updateOrderState` import** from `../conversation` — already exists and is battle-tested
10. **No `styleTemplateId` null guard needed** — outfit and extras are plain String? fields (no FK)

### GitHub Issue Reference

Story 2.7 GitHub Issue: [mgiovani/fotos#51](https://github.com/mgiovani/fotos/issues/51)

### References

- `.bmad_output/planning-artifacts/epics.md` — Epic 2, Story 2.7 (AC, FRs, technical notes)
- `.bmad_output/planning-artifacts/architecture.md` — Tool Inventory, State Machine, Data Patterns
- `.bmad_output/implementation-artifacts/story-2.6.md` — Previous story learnings, mock pattern, review fixes
- `mascotinhos/packages/bot-engine/src/tools/collect-photos.ts` — Image upload + DB update pattern (exact reference)
- `mascotinhos/packages/bot-engine/src/tools/select-style.ts` — DB error handling + sanitization pattern (exact reference)
- `mascotinhos/packages/bot-engine/src/tools/select-style.test.ts` — Mock setup pattern to follow exactly
- `mascotinhos/packages/bot-engine/src/tools/index.ts` — Add collectOutfit export here
- `mascotinhos/packages/bot-engine/src/tools/tools.test.ts` — Update count 8→9
- `mascotinhos/packages/bot-engine/src/conversation.ts` — `updateOrderState` function
- `mascotinhos/packages/db/prisma/schema/schema.prisma` — Order model (outfitDescription, extraRequests fields)

## Review Findings (2026-03-30)

**Reviewer:** claude-sonnet-4.6 (adversarial + edge case + acceptance audit)

### Applied Patches (HIGH/MEDIUM)

| # | Severity | Finding | Fix Applied |
|---|----------|---------|-------------|
| 1 | HIGH | **SSRF via unvalidated `outfitImageUrl`** — `fetch(outfitImageUrl)` accepted any URL, enabling requests to internal services (AWS metadata, etc.) | Added `WHATSAPP_CDN_PATTERN` allowlist check; non-matching URLs are logged and skipped (non-fatal) |
| 2 | HIGH | **No conversation state guard** — tool could run in wrong state (e.g. COLLECTING_PHOTOS), silently overwriting `outfitDescription` and triggering premature CONFIRMING_ORDER transition | Added `order.conversationState !== "COLLECTING_OUTFIT"` check; returns `{ success: false }` with log |
| 3 | HIGH | **`orderId` not validated before DB query** — raw AI-provided string used in Prisma query without format check | Added `ORDER_ID_PATTERN` UUID regex; rejects non-UUID orderId before any DB call |
| 4 | MEDIUM | **No timeout on image fetch** — stalled WhatsApp CDN response could hang the AI stream indefinitely | Added `AbortSignal.timeout(10_000)` to `fetch()` call |
| 5 | MEDIUM | **No file size guard before buffering** — large image response fully buffered in memory before size check | Added `Content-Length` header pre-check and `buffer.byteLength` double-check against `MAX_IMAGE_BYTES = 10 MB` |
| 6 | MEDIUM | **Combined outfit+image path string unbounded after truncation** — `outfitDescription` truncated to 300 chars but image annotation appended after, exceeding the cap | Combined string capped at `MAX_OUTFIT_LENGTH * 2` (600 chars) after image note append |

### Deferred (not patched)

- **Unicode NFC/NFD normalization for skip signals** — `isSkipSignal` uses `.toLowerCase()` but not `.normalize("NFC")`. Text arriving in NFD form (e.g. from some keyboards) may not match NFC skip signals. Low probability in WhatsApp traffic; deferred to tech debt.
- **No DB-level length constraint on `outfitDescription` / `extraRequests`** — Fields are `String?` with no `@db.VarChar` annotation. Callers bypassing the tool can write unconstrained strings. Deferred to Epic 7 schema hardening.

### Test Coverage Added

- 2 new tests: `invalid orderId (non-UUID): returns { success: false } without calling DB` and `wrong conversationState: returns { success: false } and does not update DB`
- All orderId values in test file updated to valid UUID format (`TEST_ORDER_ID = "11111111-1111-1111-1111-111111111111"`)
- Final test count: 82 pass, 0 fail

### Acceptance Criteria Verification

| AC | Status |
|----|--------|
| AC1 outfit text stored | PASS |
| AC2 image uploaded to references bucket | PASS |
| AC3 extra requests stored + transition | PASS |
| AC4 skip signal — extraRequests stays null | PASS |
| AC5 skip outfit — outfitDescription stays null | PASS |
| AC6 order not found returns { success: false } | PASS |
| AC7 updateOrderState wrapped try/catch non-fatal | PASS |
| AC8 DB error returns { success: false } | PASS |

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Completion Notes List

- Created `collect-outfit.ts` from scratch (no stub existed from Story 2.3) with full two-phase implementation (outfit + extras).
- Two-phase tool design: phase="outfit" saves outfitDescription or skips (null), uploads reference image via `uploadReference`, returns prompt to ask for extras. Phase="extras" saves extraRequests or skips, calls `updateOrderState(COLLECTING_OUTFIT → CONFIRMING_ORDER)` non-fatally.
- Skip signal detection uses normalized lowercase comparison with startsWith guard to avoid false positives (e.g. "nao" won't match "naozinho").
- Reference image upload follows the exact pattern from `collect-photos.ts` — fetch with Authorization header, Buffer.from(arrayBuffer()), mimeType from content-type header, non-fatal on failure.
- All DB calls wrapped in try/catch with structured JSON logging (`{ level, event, orderId, service: "bot-engine" }`).
- `updateOrderState` wrapped in try/catch — non-fatal, logs error and continues.
- `tools/index.ts` updated: added `collectOutfit` import and export, added to `allTools` (now 9 tools).
- `tools.test.ts` updated: count 8→9, added `collectOutfit` name assertion, updated import line.
- `system-prompt.ts` updated: added `## Instrucoes para o estado COLLECTING_OUTFIT` block with three-phase instructions (outfit ask, extras ask, transition confirmation) inserted before the COLLECTING_PHOTOS block (after COLLECTING_THEME, per conversation flow order).
- Pre-existing type errors: `@mascotinhos/storage` TS2307 in `collect-photos.ts` and `payments` package — not introduced by this story; confirmed via git stash check.
- Full test suite: 80 pass, 0 fail (15 new tests in collect-outfit.test.ts, 1 new test in system-prompt.test.ts).

### File List

- `mascotinhos/packages/bot-engine/src/tools/collect-outfit.ts` (created)
- `mascotinhos/packages/bot-engine/src/tools/collect-outfit.test.ts` (created)
- `mascotinhos/packages/bot-engine/src/tools/index.ts` (modified — added collectOutfit)
- `mascotinhos/packages/bot-engine/src/tools/tools.test.ts` (modified — count 8→9, added collectOutfit assertions)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` (modified — added COLLECTING_OUTFIT instruction block)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.test.ts` (modified — added COLLECTING_OUTFIT test)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` (modified — status in-progress → review)

### Change Log

- 2026-03-30: Implemented Story 2.7 — collectOutfit tool (two-phase: outfit + extras), system prompt update for COLLECTING_OUTFIT state, 15 new unit tests + 1 system-prompt test. All ACs #1–#8 satisfied. 80 tests pass, 0 fail.
