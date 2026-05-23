# Story 4.6: WhatsApp Delivery with Artificial Delay

Status: done
GitHub Issue: [mgiovani/fotos#62](https://github.com/mgiovani/fotos/issues/62)

## Story

As a client who paid for her mascotinho,
I want to receive the illustration via WhatsApp as both a viewable photo and a downloadable document,
So that I can instantly see it and also have the full-resolution version for birthday invitations.

## Acceptance Criteria

**Given** the generated image is uploaded to permanent storage and quality-checked
**When** the `deliverImage` function executes
**Then** the bot sends a warm status message with typing indicators: "Estou finalizando sua arte com carinho..."
**And** after the artificial delay (already handled by QStash 90s delay), the image is sent as a WhatsApp photo (instant viewing)
**And** immediately after, the same image is sent as a WhatsApp document (full-resolution download)
**And** the Order `conversationState` transitions from `GENERATING` → `DELIVERING`, then `DELIVERING` → `AWAITING_FEEDBACK`
**And** the Order `orderStatus` transitions from `GENERATING` → `DELIVERED`
**And** no PDF is generated — only photo + document format

**FRs covered:** FR-24 (artificial delay with typing + warm messages), FR-25 (dual delivery: photo + document, no PDF), FR-27 (auto-retry via QStash retries)

---

## Status Assessment — What Already Exists

**CRITICAL: Before writing any code, understand these pre-existing implementations:**

### Already implemented (DO NOT replace, DO NOT reinvent):

- `packages/bot-engine/src/tools/deliver-image.ts` — stub exists with `inputSchema: { orderId, imageUrl }` (2 fields). Currently returns `{ success: false, message: "Not implemented yet — Story 4.6" }`. **This story expands the schema and implements it** (see Task 1.2).
- `packages/bot-engine/src/tools/index.ts` — already exports `deliverImage`. No changes needed there.
- `packages/bot-engine/src/index.ts` — exports `allTools` and `enqueueGeneration` from tools, but does NOT export `deliverImage` or `deliverImageToClient`. This story adds `export { deliverImageToClient } from "./deliver-image-to-client"` to expose the plain delivery function to `apps/web` without requiring the route to import AI SDK `tool` internals.
- `packages/bot-engine/src/send-payment-confirmation.ts` — **STUDY THIS** as the reference implementation for direct WhatsApp API calls outside the agent context. Uses `fetch` to `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`. Pattern: typing indicator → text message(s). All errors are caught and logged; never throws.
- `packages/bot-engine/src/state-machine.ts` — `ConversationState` enum and `ALLOWED_TRANSITIONS`. Valid transitions:
  - `GENERATING → DELIVERING` (first transition, during delivery setup)
  - `DELIVERING → AWAITING_FEEDBACK` (second transition, after both messages sent)
- `packages/bot-engine/src/conversation.ts` — exports `updateOrderState(orderId, fromState, toState)`. Already does optimistic concurrency via `updateMany` WHERE clause. Validates transition with `isValidTransition`.
- `apps/web/src/app/api/generate/route.ts` — has `// TODO (Story 4.6): invoke deliverImage tool from bot-engine` stub after successful upload. This is the exact replacement point.
- `packages/storage/src/get-signed-url.ts` — `getSignedUrl(path: string): Promise<string>`. Accepts paths starting with `references/` or `generated/`. Returns a signed URL valid for 3600 seconds. The `imageUrl` from Story 4.5 is `"generated/{orderId}/{attemptNumber}.png"` — this is valid input to `getSignedUrl`. **Important deferred concern:** The 1h TTL may expire if QStash retries the delivery job hours later. For MVP, regenerate the signed URL at delivery time (inside `deliverImage`) rather than passing it from the upload step.
- `apps/web/package.json` — already has `@mascotinhos/bot-engine: "workspace:*"` as a dependency. No new dependencies needed in `apps/web`.

### Not yet created (this story creates them):

- `packages/bot-engine/src/deliver-image-to-client.ts` — new plain module with full delivery logic
- Updated `packages/bot-engine/src/tools/deliver-image.ts` — expanded `inputSchema` (adds `recipientPhone`, `clientName`) and delegates `execute` to `deliverImageToClient`
- `export { deliverImageToClient }` added to `packages/bot-engine/src/index.ts`
- Wire-up in `apps/web/src/app/api/generate/route.ts` (replace the `TODO (Story 4.6)` stub)
- Test file: `packages/bot-engine/src/deliver-image-to-client.test.ts`
- Additional tests in `apps/web/src/app/api/generate/route.test.ts`

### Not part of this story (do NOT implement):

- Epic 5 feedback collection — transition to `AWAITING_FEEDBACK` triggers future work but do NOT implement the feedback bot flow here.
- `handleRevision` tool — Story 5.2.
- Story 7.1 operator notifications — already stubbed in route as `// TODO (Story 7.1)`.
- PDF generation — explicitly excluded by AC: "no PDF is generated."

---

## Developer Context

### Critical Architecture Decision: deliverImage is NOT called via the AI agent

`deliverImage` is defined as an AI SDK `tool` but **it is NOT invoked through the agent's `processMessage` flow**. It is called directly from `apps/web/src/app/api/generate/route.ts` (the QStash consumer), not from the WhatsApp webhook handler. The agent runs in `bot.ts` on WhatsApp message events; the image delivery runs in `/api/generate` route on QStash events. These are separate execution contexts.

**Implication:** The route must NOT call `deliverImage.execute()` — that would require importing AI SDK tool internals in `apps/web`. Instead, extract the delivery logic into a plain async function `deliverImageToClient` in `packages/bot-engine/src/deliver-image-to-client.ts`, export it from `packages/bot-engine/src/index.ts`, and have `deliverImage.execute()` delegate to that same function. This keeps the AI tool definition valid while also making the function directly callable from the route.

### WhatsApp API Pattern — Photo and Document Sending

Follow the exact same pattern as `send-payment-confirmation.ts`. All calls use `fetch` to the WhatsApp Cloud API v21.0.

**Typing indicator** (non-fatal if fails):
```typescript
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "action",
  action: { type: "typing", duration: 3000 }
}
```

**Warm status text message** (send before the images):
```typescript
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "text",
  text: { body: "Estou finalizando sua arte com carinho... 🎨✨" }
}
```

**Photo message** (send first — enables inline preview in WhatsApp):
```typescript
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "image",
  image: {
    link: signedUrl,         // must be a publicly accessible URL
    caption: "Seu mascotinho ficou lindo! 💕"
  }
}
```

**Document message** (send second — full-resolution download):
```typescript
{
  messaging_product: "whatsapp",
  to: recipientPhone,
  type: "document",
  document: {
    link: signedUrl,         // same signed URL as photo (or re-fetch if needed)
    filename: "mascotinho.png",
    caption: "Aqui está a versão completa para download! 🌟"
  }
}
```

**Important:** WhatsApp's `image.link` and `document.link` must be publicly accessible URLs, not signed Supabase storage paths directly. Use `getSignedUrl(imageUrl)` from `@mascotinhos/storage` to get the signed URL. The signed URL is valid for 3600 seconds (1 hour).

### Pipeline Position and How deliverImage is Called

```
QStash → POST /api/generate → handleGenerate()
  Step 4: Load order (idempotency check) — done ✓
  Step 5: enrichPrompt()     — done ✓  (Story 4.2)
  Step 6: generate()         — done ✓  (Story 4.3)
  Step 7: qualityCheck()     — done ✓  (Story 4.4)
  Step 8: uploadGenerated()  — done ✓  (Story 4.5)
  Step 9: deliverImage()     ← THIS STORY (Story 4.6)
```

The route must also load the client's `whatsappSenderId` to send the WhatsApp message. **The current `prisma.order.findUnique` in `handleGenerate` only selects `{ id, orderStatus, conversationState, photosUrls }`.** Story 4.6 requires `client.whatsappSenderId` and `client.name`. You must update the `select` to include `client: { select: { whatsappSenderId: true, name: true } }`.

### Exact Route Changes

**Update `prisma.order.findUnique` select** (in `handleGenerate`, Step 4):
```typescript
select: {
  id: true,
  orderStatus: true,
  conversationState: true,
  photosUrls: true,
  client: { select: { whatsappSenderId: true, name: true } },
},
```

**Import** (add to top of `route.ts`):
```typescript
import { deliverImageToClient } from "@mascotinhos/bot-engine";
```
Remove the `// TODO (Story 4.6): invoke deliverImage tool from bot-engine` comment.

**Step 9 implementation** (replace the TODO stub and the stub log after upload success):
```typescript
// 9. DELIVER TO CLIENT VIA WHATSAPP (Story 4.6)
const deliveryResult = await deliverImageToClient({
  orderId,
  imageUrl,
  recipientPhone: order.client.whatsappSenderId,
  clientName: order.client.name,
});

if (!deliveryResult.success) {
  // delivery failed — log and return 500 for QStash retry
  console.log(JSON.stringify({
    level: "error",
    event: "generate_consumer_delivery_failed",
    orderId,
    attempt,
    message: deliveryResult.message,
    service: "web",
  }));
  return NextResponse.json({ error: "Delivery failed" }, { status: 500 });
}

console.log(JSON.stringify({
  level: "info",
  event: "generate_consumer_delivery_success",
  orderId,
  attempt,
  service: "web",
}));

return NextResponse.json({ status: "ok" });
```

Remove the `console.log` for `generate_consumer_pipeline_stub_4_6_onward` — it is replaced by the delivery logic above.

### deliverImage Implementation

Create `packages/bot-engine/src/deliver-image-to-client.ts` (a plain module, not an AI tool) and re-export from `src/tools/deliver-image.ts`:

```typescript
// packages/bot-engine/src/deliver-image-to-client.ts

import { env } from "@mascotinhos/env/server";
import { getSignedUrl } from "@mascotinhos/storage";
import prisma from "@mascotinhos/db";

const WHATSAPP_API_VERSION = "v21.0";
const WA_FETCH_TIMEOUT_MS = 10_000;

export interface DeliverImageParams {
  orderId: string;
  imageUrl: string;           // storage path: "generated/{orderId}/{attempt}.png"
  recipientPhone: string;     // client.whatsappSenderId
  clientName: string | null | undefined;
}

export async function deliverImageToClient(
  params: DeliverImageParams,
): Promise<{ success: boolean; message: string }> {
  const { orderId, imageUrl, recipientPhone } = params;

  // 1. Get signed URL for the image
  let signedUrl: string;
  try {
    signedUrl = await getSignedUrl(imageUrl);
  } catch (err) {
    console.log(JSON.stringify({
      level: "error", event: "deliver_image_signed_url_failed",
      orderId, error: err instanceof Error ? err.message : String(err),
      service: "bot-engine",
    }));
    return { success: false, message: "Failed to generate signed URL for image." };
  }

  const messagesUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
  };

  function makeSignal() {
    if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
      return AbortSignal.timeout(WA_FETCH_TIMEOUT_MS);
    }
    return undefined;
  }

  // 2. Transition state: GENERATING → DELIVERING
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { conversationState: "DELIVERING" },
    });
  } catch (err) {
    console.log(JSON.stringify({
      level: "error", event: "deliver_image_state_transition_failed",
      orderId, from: "GENERATING", to: "DELIVERING",
      error: err instanceof Error ? err.message : String(err),
      service: "bot-engine",
    }));
    return { success: false, message: "Failed to transition order to DELIVERING state." };
  }

  // 3. Typing indicator (non-fatal)
  try {
    await fetch(messagesUrl, {
      method: "POST", headers, signal: makeSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "action",
        action: { type: "typing", duration: 3000 },
      }),
    });
  } catch {
    // non-fatal — continue to warm message
  }

  // 4. Warm status text message
  let warmResponse: Response;
  try {
    warmResponse = await fetch(messagesUrl, {
      method: "POST", headers, signal: makeSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: "Estou finalizando sua arte com carinho... 🎨✨" },
      }),
    });
  } catch (err) {
    console.log(JSON.stringify({
      level: "error", event: "deliver_image_warm_message_failed",
      orderId, error: err instanceof Error ? err.message : String(err), service: "bot-engine",
    }));
    return { success: false, message: "Failed to send warm status message." };
  }
  if (!warmResponse.ok) {
    console.log(JSON.stringify({
      level: "error", event: "deliver_image_warm_message_failed",
      orderId, status: warmResponse.status, service: "bot-engine",
    }));
    return { success: false, message: "Failed to send warm status message." };
  }

  // 5. Photo message (inline preview)
  let photoResponse: Response;
  try {
    photoResponse = await fetch(messagesUrl, {
      method: "POST", headers, signal: makeSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "image",
        image: { link: signedUrl, caption: "Seu mascotinho ficou lindo! 💕" },
      }),
    });
  } catch (err) {
    console.log(JSON.stringify({
      level: "error", event: "deliver_image_photo_failed",
      orderId, error: err instanceof Error ? err.message : String(err), service: "bot-engine",
    }));
    return { success: false, message: "Failed to send image photo." };
  }
  if (!photoResponse.ok) {
    console.log(JSON.stringify({
      level: "error", event: "deliver_image_photo_failed",
      orderId, status: photoResponse.status, service: "bot-engine",
    }));
    return { success: false, message: "Failed to send image photo." };
  }

  // 6. Document message (full-resolution download)
  let docResponse: Response;
  try {
    docResponse = await fetch(messagesUrl, {
      method: "POST", headers, signal: makeSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "document",
        document: {
          link: signedUrl,
          filename: "mascotinho.png",
          caption: "Aqui está a versão completa para download! 🌟",
        },
      }),
    });
  } catch (err) {
    console.log(JSON.stringify({
      level: "error", event: "deliver_image_document_failed",
      orderId, error: err instanceof Error ? err.message : String(err), service: "bot-engine",
    }));
    return { success: false, message: "Failed to send document." };
  }
  if (!docResponse.ok) {
    console.log(JSON.stringify({
      level: "error", event: "deliver_image_document_failed",
      orderId, status: docResponse.status, service: "bot-engine",
    }));
    return { success: false, message: "Failed to send document." };
  }

  // 7. Update Order: orderStatus → DELIVERED, conversationState → AWAITING_FEEDBACK
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: "DELIVERED",
        conversationState: "AWAITING_FEEDBACK",
      },
    });
  } catch (err) {
    // Both messages delivered — log but treat as success for QStash
    console.log(JSON.stringify({
      level: "warn", event: "deliver_image_status_update_failed",
      orderId, error: err instanceof Error ? err.message : String(err),
      service: "bot-engine",
    }));
    // Return success — messages reached the client, DB inconsistency is recoverable
    return { success: true, message: "Delivered but status update failed (manual fix needed)." };
  }

  console.log(JSON.stringify({
    level: "info", event: "deliver_image_success",
    orderId, service: "bot-engine",
  }));

  return { success: true, message: "Image delivered successfully." };
}
```

**Then update `packages/bot-engine/src/tools/deliver-image.ts`:**
```typescript
import { tool } from "ai";
import { z } from "zod";
import { deliverImageToClient } from "../deliver-image-to-client";

export const deliverImage = tool({
  description: "Send the generated mascotinho image to the client via WhatsApp. Called after generation completes.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
    imageUrl: z.string().describe("Storage path of the generated image (e.g. generated/orderId/1.png)"),
    recipientPhone: z.string().describe("Client WhatsApp sender ID"),
    clientName: z.string().nullable().optional().describe("Client name for personalization"),
  }),
  execute: async ({ orderId, imageUrl, recipientPhone, clientName }) =>
    deliverImageToClient({ orderId, imageUrl, recipientPhone, clientName }),
});
```

**Add to `packages/bot-engine/src/index.ts`:**
```typescript
export { deliverImageToClient } from "./deliver-image-to-client";
```

### State Transition Clarification

The route calls `deliverImageToClient` which internally:
1. Sets `conversationState = "DELIVERING"` (via `prisma.order.update`) — uses direct update rather than `updateOrderState`. **Trade-off:** `updateOrderState` uses `updateMany` with an optimistic WHERE clause that guards against concurrent state races; the direct `update` here does not. For MVP this is acceptable because the QStash consumer is the only writer at this pipeline stage, but be aware the optimistic guard is absent. The state-machine allows `GENERATING → DELIVERING`.
2. After both messages succeed: sets `orderStatus = "DELIVERED"` AND `conversationState = "AWAITING_FEEDBACK"` in a **single `prisma.order.update`** call (atomic).

**Why NOT use `updateOrderState`** for the DELIVERING → AWAITING_FEEDBACK transition: `updateOrderState` only updates `conversationState`. Here we need to update BOTH `orderStatus` and `conversationState` atomically. Use `prisma.order.update` directly with both fields.

### Schema Constraints

- `OrderStatus` enum: `PENDING | PAID | GENERATING | DELIVERED | CANCELLED` — use `"DELIVERED"` (not `"DONE"` or `"COMPLETE"`).
- `ConversationState` enum: `AWAITING_FEEDBACK` is a valid enum value in `schema.prisma`.
- Validated transitions from `state-machine.ts`:
  - `GENERATING → DELIVERING` ✓
  - `DELIVERING → AWAITING_FEEDBACK` ✓
- Order does NOT have an `orderStatus` transition for DELIVERING as an intermediate — jump directly from `GENERATING` to `DELIVERED` on success.

### Log Events for This Story

| Event | Level | Context | When |
|---|---|---|---|
| `deliver_image_signed_url_failed` | error | `orderId` | `getSignedUrl()` throws |
| `deliver_image_state_transition_failed` | error | `orderId`, `from`, `to` | DB update to DELIVERING fails |
| `deliver_image_warm_message_failed` | error | `orderId`, `status` or `error` | Warm text message fetch throws or returns non-200 |
| `deliver_image_photo_failed` | error | `orderId`, `status` or `error` | Photo message fetch throws or returns non-200 |
| `deliver_image_document_failed` | error | `orderId`, `status` or `error` | Document message fetch throws or returns non-200 |
| `deliver_image_status_update_failed` | warn | `orderId` | Final DB update fails after messages sent |
| `deliver_image_success` | info | `orderId` | Both messages sent + DB updated |
| `generate_consumer_delivery_failed` | error | `orderId`, `attempt`, `message` | deliverImageToClient returns success=false |
| `generate_consumer_delivery_success` | info | `orderId`, `attempt` | Full pipeline complete |

### Signed URL for WhatsApp Media

WhatsApp Cloud API requires `image.link` and `document.link` to be **publicly accessible** URLs. Supabase Storage signed URLs are publicly accessible as long as they haven't expired. The TTL is 3600 seconds (1 hour) — more than sufficient for immediate delivery. If QStash retries hours later, the signed URL will be regenerated fresh in `deliverImageToClient` because `getSignedUrl(imageUrl)` is called at delivery time (not passed from route). This resolves the deferred concern logged in `deferred-work.md` for Story 4.6.

### Idempotency

If QStash retries the delivery step (e.g., photo sent, document call failed), the client may receive the warm message and photo twice. For MVP, this is acceptable — the idempotency check at Step 4 of `handleGenerate` would only skip if `orderStatus === "DELIVERED"`, but DELIVERED is only set AFTER both messages succeed. So a partial failure mid-delivery causes QStash to retry the full pipeline from the start... but `enrichPrompt` is idempotent (upsert), `generate` is idempotent at the route level (same result), etc. The delivery retry sends duplicate messages — acceptable for MVP.

### Architecture Compliance

- **Package boundary:** `deliverImageToClient` lives in `packages/bot-engine` (not `apps/web`). Only `apps/web` imports from `@mascotinhos/bot-engine`. Never move WhatsApp sending logic into `apps/web` directly.
- **Storage access:** `getSignedUrl` is in `@mascotinhos/storage` — imported from `bot-engine` (which already has `@mascotinhos/storage` as a dependency in `package.json`).
- **DB access:** All Prisma calls via `prisma` from `@mascotinhos/db`. Never construct Supabase URLs manually.
- **Structured logging:** ALL logs MUST include `orderId` and `service: "bot-engine"`. Pattern: `console.log(JSON.stringify({ level, event, orderId, ... }))`.
- **WhatsApp API version:** Always `v21.0` (same as `send-payment-confirmation.ts` and `bot.ts`).
- **Timeout:** Use `AbortSignal.timeout(WA_FETCH_TIMEOUT_MS)` (10s) for all fetch calls, with the same graceful fallback pattern as `send-payment-confirmation.ts`.

### Previous Story Intelligence

From Story 4.5 implementation and review:
- The `imageUrl` returned by `uploadGenerated` is `"generated/{orderId}/{attempt}.png"` — this is the correct input to `getSignedUrl()`.
- The route's `handleGenerate` uses `enrichResult.generationId!` — follow the same non-null assertion style for `order.client.whatsappSenderId`.
- `order.photosUrls` was already in the `select` — adding `client` nested select follows the same pattern used in `conversation.ts` (`loadActiveOrder` uses `include: { client: true }`).
- The `// TODO (Story 4.6)` comment in route.ts is at line ~219 (after upload success log) — replace it plus the stub log below it.
- Test mock pattern: `mock.module()` BEFORE static imports — non-negotiable in Bun.
- `@mascotinhos/bot-engine` is already in `apps/web/package.json` as a dependency — no new dependencies needed.

From Story 4.4 review:
- Deferred: prompt injection via `promptUsed` — not relevant here.
- Pattern: return `{ success: false, message: "..." }` on failures, consistent with other tools.

From `send-payment-confirmation.ts` (reference implementation):
- Name sanitization for PT-BR names containing control characters. Note: the sample `deliverImageToClient` code does not personalize the warm message with `clientName` (the field is accepted but unused for MVP). If you add personalization, apply the same sanitization pattern from `send-payment-confirmation.ts` before embedding the name in a message body.
- Non-fatal typing indicator pattern — wrap in its own try/catch.
- All errors caught at each call site — function never throws.

---

## Tasks / Subtasks

- [x] Task 1: Implement `deliverImageToClient` in bot-engine
  - [x] 1.1: Create `packages/bot-engine/src/deliver-image-to-client.ts` with full delivery logic: get signed URL → state transition to DELIVERING → typing indicator → warm text message → photo message → document message → update to DELIVERED + AWAITING_FEEDBACK.
  - [x] 1.2: Update `packages/bot-engine/src/tools/deliver-image.ts`: expand `inputSchema` to add `recipientPhone` and `clientName` fields (the existing stub only has `orderId` and `imageUrl`); import `deliverImageToClient` from `"../deliver-image-to-client"`; delegate `execute` to `deliverImageToClient`.
  - [x] 1.3: Add `export { deliverImageToClient } from "./deliver-image-to-client"` to `packages/bot-engine/src/index.ts`.

- [x] Task 2: Wire delivery into `apps/web/src/app/api/generate/route.ts`
  - [x] 2.1: Add `import { deliverImageToClient } from "@mascotinhos/bot-engine"` to the top imports.
  - [x] 2.2: Update the `prisma.order.findUnique` select in `handleGenerate` (Step 4) to include `client: { select: { whatsappSenderId: true, name: true } }`.
  - [x] 2.3: Replace the `// TODO (Story 4.6): invoke deliverImage tool from bot-engine` comment and the `generate_consumer_pipeline_stub_4_6_onward` stub log with the Step 9 delivery block that calls `deliverImageToClient(...)` and handles success/failure.

- [x] Task 3: Tests for `deliver-image-to-client.ts`
  - [x] 3.1: Create `packages/bot-engine/src/deliver-image-to-client.test.ts` (co-located with `deliver-image-to-client.ts` in `src/`, NOT in `src/tools/`). Use `mock.module()` before imports. Mock: `@mascotinhos/storage` (getSignedUrl), `@mascotinhos/db` (prisma.order.update), `@mascotinhos/env/server` (env), global `fetch`.
  - [x] 3.2: Test: happy path — all fetches succeed, returns `{ success: true }`, DB update called with `{ orderStatus: "DELIVERED", conversationState: "AWAITING_FEEDBACK" }`.
  - [x] 3.3: Test: `getSignedUrl` throws → returns `{ success: false }`, no fetch calls.
  - [x] 3.4: Test: state transition to DELIVERING DB update fails → returns `{ success: false }`, no fetch calls.
  - [x] 3.5: Test: warm message returns 500 → returns `{ success: false }`. Also test: warm message fetch throws (network error) → returns `{ success: false }`.
  - [x] 3.6: Test: photo message returns 500 → returns `{ success: false }`. Also test: photo fetch throws → returns `{ success: false }`.
  - [x] 3.7: Test: document message returns 500 → returns `{ success: false }`. Also test: document fetch throws → returns `{ success: false }`.
  - [x] 3.8: Test: both messages sent but final DB status update throws → returns `{ success: true, message: "...status update failed..." }` (messages delivered, DB inconsistency treated as soft failure).
  - [x] 3.9: Test: typing indicator fetch throws → non-fatal, warm message still sent → happy path continues.
  - [x] 3.10: Test: correct WhatsApp API URL used (contains `WHATSAPP_PHONE_NUMBER_ID/messages`).
  - [x] 3.11: Test: photo sent before document (call order: warm → photo → document).

- [x] Task 4: Tests in `apps/web/src/app/api/generate/route.test.ts`
  - [x] 4.1: Add `@mascotinhos/bot-engine` mock at the top: `mock.module("@mascotinhos/bot-engine", () => ({ deliverImageToClient: mockDeliverImageToClient }))` where `mockDeliverImageToClient = mock(() => Promise.resolve({ success: true, message: "ok" }))`.
  - [x] 4.2: Update the `@mascotinhos/db` mock to include `client: { whatsappSenderId: "5511999999999", name: "Ana" }` in the default order mock shape returned by `mockPrismaOrderFindUnique`.
  - [x] 4.3: Add test: full pipeline success → `deliverImageToClient` called with correct `{ orderId, imageUrl, recipientPhone, clientName }` args → 200 `{ status: "ok" }`.
  - [x] 4.4: Add test: `deliverImageToClient` returns `{ success: false, message: "..." }` → route returns 500.
  - [x] 4.5: Add test: `deliverImageToClient` not called when upload fails.
  - [x] 4.6: Run `bun test` from `mascotinhos/apps/web` to confirm all existing tests pass (31 tests) plus new ones. Result: 34 pass, 0 fail.

- [x] Task 5: Run tests in bot-engine package
  - [x] 5.1: Run `bun test` from `mascotinhos/packages/bot-engine` to confirm all new tests pass. Result: 143 pass, 0 fail (all 15 test files).

---

## NFR Compliance

- **NFR-06:** Bot response latency <3s for text responses. WhatsApp delivery happens asynchronously via QStash, so this NFR is NOT violated by the delivery time.
- **NFR-02:** Image generation pipeline (excluding artificial delay) completes <2 minutes. This story adds only WhatsApp API calls (~1-3s each), staying well within the 300s `maxDuration`.
- **NFR-26:** Structured JSON logging for all delivery events with `orderId`, `service`.
- **FR-27:** Auto-retry via QStash retries — returning HTTP 500 on failure causes QStash to re-enqueue. This handles delivery retry automatically.

---

## Git Commit Message

When done: `feat(bot-engine): whatsapp delivery with artificial delay (closes #62)`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded cleanly without issues.

### Completion Notes List

- Created `packages/bot-engine/src/deliver-image-to-client.ts`: plain async function `deliverImageToClient` implementing the full WhatsApp delivery pipeline — signed URL generation, state transition GENERATING→DELIVERING, typing indicator (non-fatal), warm text message, photo message, document message, atomic DB update to DELIVERED+AWAITING_FEEDBACK.
- Updated `packages/bot-engine/src/tools/deliver-image.ts`: expanded `inputSchema` with `recipientPhone` and `clientName` fields; `execute` now delegates to `deliverImageToClient`.
- Added `export { deliverImageToClient }` to `packages/bot-engine/src/index.ts` to expose it to `apps/web` without importing AI SDK tool internals.
- Updated `apps/web/src/app/api/generate/route.ts`: added import, expanded `prisma.order.findUnique` select to include `client`, replaced TODO stub (Step 9) with full delivery call + error handling that returns 500 on failure for QStash retry.
- Created `packages/bot-engine/src/deliver-image-to-client.test.ts`: 13 tests covering all failure paths, call ordering, non-fatal typing indicator, correct API URL, and happy path.
- Updated `apps/web/src/app/api/generate/route.test.ts`: added `@mascotinhos/bot-engine` mock, updated order shape with `client`, added 3 new Story 4.6 integration tests.
- Test results: bot-engine 143 pass / 0 fail (15 files); web 34 pass / 0 fail.
- All pre-existing type errors (bun:test declarations, image-gen SDK types) are pre-existing and unrelated to Story 4.6.

### File List

- `mascotinhos/packages/bot-engine/src/deliver-image-to-client.ts` (created)
- `mascotinhos/packages/bot-engine/src/deliver-image-to-client.test.ts` (created)
- `mascotinhos/packages/bot-engine/src/tools/deliver-image.ts` (modified)
- `mascotinhos/packages/bot-engine/src/index.ts` (modified)
- `mascotinhos/apps/web/src/app/api/generate/route.ts` (modified)
- `mascotinhos/apps/web/src/app/api/generate/route.test.ts` (modified)
- `.bmad_output/implementation-artifacts/story-4.6.md` (updated — this file)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` (updated — status: done)

---

## Review Findings

**Reviewer:** claude-sonnet-4-6 | **Date:** 2026-03-30

### F1 — HIGH: DELIVERING state re-entry bug on QStash retry (FIXED)

**File:** `packages/bot-engine/src/deliver-image-to-client.ts`

**Issue:** After a partial delivery failure (e.g. warm message sent, photo failed), the order is left in `DELIVERING` state. On QStash retry, `handleGenerate` idempotency check passes (only skips `DELIVERED`/`CANCELLED`), then `deliverImageToClient` called `prisma.order.update({ data: { conversationState: "DELIVERING" } })` — a bare update with no state guard. The state machine allows `GENERATING → DELIVERING` but not `DELIVERING → DELIVERING`, so Prisma would silently succeed (no check at DB layer), but the semantic intent was wrong. More critically: if `updateOrderState` were used, the WHERE guard would reject it and return `{ success: false }`, causing permanent retry failure.

**Fix:** Replaced `prisma.order.update` with `prisma.order.updateMany` using `conversationState: { in: ["GENERATING", "DELIVERING"] }` as the WHERE clause. A `count === 0` result (concurrent transition to another state) now returns `{ success: false }` with a distinct `reason` log field. A retry finding the order already in `DELIVERING` (count=1) proceeds normally — true idempotency.

### F2 — MEDIUM: `recipientPhone` sent unvalidated to WhatsApp API (FIXED)

**File:** `packages/bot-engine/src/deliver-image-to-client.ts`

**Issue:** No format validation on `recipientPhone` before embedding it in WhatsApp API bodies. A null, empty, or non-numeric value would cause WhatsApp to return a 400 on every request — triggering QStash retries indefinitely until retry budget exhausted. Root cause of bad data not surfaced clearly.

**Fix:** Added early validation at function entry: `recipientPhone` must match `/^\d{7,15}$/` (E.164 digits without '+', 7-15 chars). Returns `{ success: false, message: "Invalid recipientPhone..." }` immediately, before any DB or WhatsApp calls. Log event: `deliver_image_invalid_recipient_phone`.

### F3 — MEDIUM: `order.client` null guard missing in route (FIXED)

**File:** `apps/web/src/app/api/generate/route.ts`

**Issue:** `order.client.whatsappSenderId` accessed without null check. If `client` is null (FK integrity issue — e.g. client row deleted after order created), this throws a runtime `TypeError: Cannot read properties of null`, crashing the route handler and causing QStash to retry forever.

**Fix:** Added explicit guard `if (!order.client?.whatsappSenderId)` returning HTTP 500 with log event `generate_consumer_missing_client_phone` before calling `deliverImageToClient`. QStash will retry (operator can investigate via logs), but the crash is avoided.

### Deferred (not patched — acceptable for MVP)

- **imageUrl path validation:** `imageUrl` passed to `getSignedUrl` without pattern check. Low risk (value comes from `uploadGenerated` return, not user input). Deferred to Epic 7 hardening.
- **Duplicate delivery on retry:** QStash retry after photo-sent/doc-failed sends warm message + photo twice. Noted as MVP-acceptable in story spec. Deferred.
- **No `sanitizeName` on `clientName`:** Story spec notes `clientName` is accepted but unused in warm message for MVP. If personalization is added later, sanitization (per `send-payment-confirmation.ts` pattern) must be applied.

### Test Results After Patches

- `packages/bot-engine` — **19 pass, 0 fail** (6 new tests added)
- `apps/web` — **36 pass, 0 fail** (2 new tests added)
