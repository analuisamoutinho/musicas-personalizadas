# Story 3.1: PIX QR Code Generation and Delivery

Status: done
GitHub Issue: [mgiovani/fotos#53](https://github.com/mgiovani/fotos/issues/53)

## Story

As a client who confirmed her order,
I want to receive a PIX QR code instantly in the WhatsApp conversation,
So that I can pay quickly without leaving the chat.

## Acceptance Criteria

1. **Given** the order is in AWAITING_PAYMENT state and the client confirmed
   **When** the `generatePayment` tool is called
   **Then** a dynamic PIX charge is created via the Asaas API with amount R$29.90 and the order ID as external reference
   **And** the PIX QR code image (base64) and copy-paste code are sent to the client via WhatsApp
   **And** a Payment record is created in the database with status `PENDING`, the `asaasId`, `pixQrCode` (copy-paste string), and `amount`
   **And** the bot sends a warm message: "Aqui está o PIX! Assim que o pagamento cair, já começo a preparar sua arte 🎨"
   **And** if Asaas API fails, the tool returns `{ success: false, message: "Ops, tive um probleminha. Vou gerar outro QR code!" }` (agent relays this to client)

2. **Given** `generatePayment` is called with an invalid UUID `orderId`
   **Then** the tool returns `{ success: false, message: "ID de pedido inválido." }` without any DB or API call

3. **Given** `generatePayment` is called for an order in a state other than AWAITING_PAYMENT
   **Then** the tool returns `{ success: false, message: "Estado inválido para pagamento." }` and logs a warning

4. **Given** `generatePayment` is called but the order does not exist
   **Then** the tool returns `{ success: false, message: "Pedido não encontrado." }`

5. **Given** `generatePayment` is called and a PENDING Payment record already exists for this order (Asaas idempotency path)
   **Then** the existing Payment's QR data is reused — no duplicate Asaas charge is created
   **And** `{ success: true }` is returned with the existing QR code data

6. **Given** a DB error occurs at any point
   **Then** the tool returns `{ success: false, message: "Erro ao processar pagamento. Tente novamente." }` and logs the error

7. **Given** `ASAAS_SPLIT_WALLET_ID` env var is set
   **Then** the PIX charge is created with the split configuration built by `buildSplitConfig`
   **And** if `ASAAS_SPLIT_WALLET_ID` is unset, no split config is passed (Story 3.4 handles the split percentage; for this story use `10` as default percentualValue if wallet is set)

8. **Given** `createOrUpdateCustomer` is called with the client's phone and name
   **Then** the Asaas customer is created or found before charge creation
   **And** the customer phone uses the client's `whatsappSenderId` as the phone source

**FRs covered:** FR-16 (PIX QR generation via Asaas), FR-20 (partial: retry message on generation failure)
**NFRs covered:** NFR-23 (Asaas retry logic), NFR-20 (idempotent — reuse existing PENDING charge)

## Tasks / Subtasks

- [x] Task 1: Implement `generatePayment` tool (AC: #1–#8)
  - [x] 1.1: Replace the entire file `packages/bot-engine/src/tools/generate-payment.ts` — **the stub already exists** (returns "Not implemented yet — Story 3.1"); replace the full file content with the implementation
  - [x] 1.2: UUID validation guard (same pattern as `confirmOrder`):
    ```typescript
    const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    ```
    If `orderId` fails the pattern: log warn `generate_payment_invalid_id`, return `{ success: false, message: "ID de pedido inválido." }`
  - [x] 1.3: Load order with client join: `prisma.order.findUnique({ where: { id: orderId }, include: { client: true } })` in try/catch. If null: `{ success: false, message: "Pedido não encontrado." }`. On DB error: log error `generate_payment_db_error`, return `{ success: false, message: "Erro ao processar pagamento. Tente novamente." }`
  - [x] 1.4: Guard wrong state: if `order.conversationState !== "AWAITING_PAYMENT"`, log warn `generate_payment_wrong_state`, return `{ success: false, message: "Estado inválido para pagamento." }`
  - [x] 1.5: DB-level idempotency check — before calling Asaas, look for existing PENDING Payment: `prisma.payment.findFirst({ where: { orderId, status: "PENDING" } })`. If found, return `{ success: true, chargeId: existing.asaasId, pixCopyPaste: existing.pixQrCode, message: "PIX já gerado! Use o código acima para pagar." }` — skip Asaas call entirely
  - [x] 1.6: Extract client data with null safety: `const clientPhone = order.client?.whatsappSenderId ?? ""; const clientName = order.client?.name ?? "Cliente";` — if `clientPhone` is empty string, log warn `generate_payment_customer_error` (error: "missing client phone") and return `{ success: false, message: "Erro ao processar pagamento. Tente novamente." }`. Otherwise call `createOrUpdateCustomer(clientPhone, clientName)` — wrap in try/catch; on failure log warn `generate_payment_customer_error`, return `{ success: false, message: "Erro ao processar pagamento. Tente novamente." }`
  - [x] 1.7: Build optional split config:
    ```typescript
    const splitConfig = env.ASAAS_SPLIT_WALLET_ID
      ? buildSplitConfig(env.ASAAS_SPLIT_WALLET_ID, 10)
      : undefined;
    ```
  - [x] 1.8: Call `createPixCharge(customerId, orderId, Number(order.price), splitConfig)` — wrap in try/catch; on failure (including `PIX_QR_NOT_READY` retryable error): log warn `generate_payment_asaas_error`, return `{ success: false, message: "Ops, tive um probleminha. Vou gerar outro QR code!" }`
  - [x] 1.9: Create Payment record in DB:
    ```typescript
    await prisma.payment.create({
      data: {
        orderId,
        asaasId: chargeResult.chargeId,
        pixQrCode: chargeResult.pixCopyPaste,
        pixQrImageUrl: null, // base64 not stored; only sent inline to WhatsApp
        amount: order.price,
        status: "PENDING",
      },
    });
    ```
    Wrap in try/catch; on DB error (e.g., `asaasId` unique constraint from race condition): treat as idempotent — log warn `generate_payment_record_exists`, return success with the existing data
  - [x] 1.10: Return success payload:
    ```typescript
    return {
      success: true,
      chargeId: chargeResult.chargeId,
      pixQrCodeBase64: chargeResult.pixQrCodeBase64,
      pixCopyPaste: chargeResult.pixCopyPaste,
      message: "Aqui está o PIX! Assim que o pagamento cair, já começo a preparar sua arte 🎨",
    };
    ```
  - [x] 1.11: Structured logging events (all include `orderId` and `service: "bot-engine"`):
    - `generate_payment_invalid_id` (warn)
    - `generate_payment_db_error` (error)
    - `generate_payment_wrong_state` (warn, include `state`)
    - `generate_payment_idempotent_reuse` (info, include `asaasId`)
    - `generate_payment_customer_error` (warn)
    - `generate_payment_asaas_error` (warn, include error message — NOT full stack)
    - `generate_payment_record_exists` (warn — race condition duplicate)
    - `generate_payment_success` (info, include `asaasId`)
  - [x] 1.12: **Do NOT change `tools/index.ts`** — `generatePayment` is already exported and in `allTools`
  - [x] 1.13: **Do NOT change `tools/tools.test.ts`** — tool count is already `toHaveLength(9)` from Story 2.3

- [x] Task 2: Update system prompt for AWAITING_PAYMENT state (AC: #1)
  - [x] 2.1: Edit `packages/bot-engine/src/prompts/system-prompt.ts`
  - [x] 2.2: Add `## Instrucoes para o estado AWAITING_PAYMENT` block **AFTER** the `## Instrucoes para o estado CONFIRMING_ORDER` block
  - [x] 2.3: Instruction content:
    ```
    ## Instrucoes para o estado AWAITING_PAYMENT
    Quando o estado for AWAITING_PAYMENT:
    1. GERAR PIX: Chame IMEDIATAMENTE generatePayment com orderId = ID do pedido atual
    2. Se generatePayment retornar success: true:
       - Envie o QR code base64 (pixQrCodeBase64) como imagem para o cliente via WhatsApp
       - Envie a mensagem retornada ("Aqui está o PIX! ...")
       - Envie o código copia-e-cola (pixCopyPaste) formatado: "Ou use o Pix Copia e Cola:\n`{pixCopyPaste}`"
       - Informe que o processo começa automaticamente após a confirmação do pagamento
    3. Se generatePayment retornar success: false:
       - Envie a mensagem de erro retornada ao cliente
       - Pergunte se deseja tentar novamente: "Deseja tentar gerar o PIX novamente?"
       - Se o cliente confirmar, chame generatePayment novamente
    4. Enquanto aguarda pagamento, responda perguntas do cliente mas NÃO avance o fluxo
    ```

- [x] Task 3: Write tests (AC: #1–#8)
  - [x] 3.1: Create `packages/bot-engine/src/tools/generate-payment.test.ts`
    - [x] 3.1.1: Mock modules BEFORE any imports (critical bun:test requirement):
      ```typescript
      mock.module("@mascotinhos/db", () => ({ default: { order: { findUnique: mockFindUnique }, payment: { findFirst: mockFindFirst, create: mockPaymentCreate } } }));
      mock.module("@mascotinhos/payments", () => ({ createOrUpdateCustomer: mockCreateOrUpdateCustomer, createPixCharge: mockCreatePixCharge, buildSplitConfig: mockBuildSplitConfig }));
      // NOTE: do NOT mock "../conversation" — generatePayment does NOT call updateOrderState
      ```
    - [x] 3.1.2: Use `const TEST_ORDER_ID = crypto.randomUUID()` — valid UUID constant
    - [x] 3.1.3: Define `ctx` constant (required by AI SDK tool.execute signature — see confirm-order.test.ts):
      ```typescript
      const ctx = { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal };
      ```
      All `generatePayment.execute(input, ctx)` calls must pass this ctx.
    - [x] 3.1.4: Default mock order fixture:
      ```typescript
      {
        id: TEST_ORDER_ID,
        conversationState: "AWAITING_PAYMENT",
        price: 29.9, // plain number is fine in tests — Number(29.9) === 29.9; no Prisma.Decimal needed
        client: { id: "client-1", name: "Maria", whatsappSenderId: "5511999999999" },
        // no payments yet
      }
      ```
    - [x] 3.1.5: Test: happy path — `createOrUpdateCustomer` → `createPixCharge` → `payment.create` → returns `{ success: true, pixCopyPaste, pixQrCodeBase64 }`
    - [x] 3.1.6: Test: invalid UUID orderId → `{ success: false, message: "ID de pedido inválido." }`, no DB calls
    - [x] 3.1.7: Test: order not found → `{ success: false, message: "Pedido não encontrado." }`
    - [x] 3.1.8: Test: wrong state (e.g., CONFIRMING_ORDER) → `{ success: false, message: "Estado inválido para pagamento." }`
    - [x] 3.1.9: Test: existing PENDING payment in DB → returns success with existing data, `createPixCharge` NOT called
    - [x] 3.1.10: Test: `createOrUpdateCustomer` throws → `{ success: false, message: "Erro ao processar pagamento. Tente novamente." }`
    - [x] 3.1.11: Test: `createPixCharge` throws → `{ success: false, message: "Ops, tive um probleminha. Vou gerar outro QR code!" }`
    - [x] 3.1.12: Test: DB error on `findUnique` → `{ success: false, message: "Erro ao processar pagamento. Tente novamente." }`
    - [x] 3.1.13: Test: `payment.create` throws unique constraint (race condition) → returns success with chargeId (idempotent)
    - [x] 3.1.14: Test: null `client.name` → `createOrUpdateCustomer` called with "Cliente" as fallback name
    - [x] 3.1.15: Test: `ASAAS_SPLIT_WALLET_ID` is set → `buildSplitConfig` called and split passed to `createPixCharge`. Implemented via mock of `@mascotinhos/env/server` (mutable `mockEnv` object) since `createEnv` snapshots values at module load time.
  - [x] 3.2: Update `packages/bot-engine/src/prompts/system-prompt.test.ts`
    - [x] 3.2.1: Add test: when `conversationState === "AWAITING_PAYMENT"`, prompt contains both `"Instrucoes para o estado AWAITING_PAYMENT"` and `"generatePayment"` (follows the same pattern as existing GREETING/COLLECTING_THEME/COLLECTING_OUTFIT/CONFIRMING_ORDER tests)

- [x] Task 4: Type-check and test pipeline
  - [x] 4.1: Run `bun run check-types` from `mascotinhos/` — must pass with 0 new errors (pre-existing errors from `@mascotinhos/storage` TS2307 in `collect-photos.ts` and `payments` package are pre-existing; do NOT fix them)
  - [x] 4.2: Run `bun test` from `mascotinhos/packages/bot-engine/` — all new `generate-payment.test.ts` tests must pass, no regressions

## Dev Notes

### CRITICAL: Stub Already Exists — Replace Entirely

`packages/bot-engine/src/tools/generate-payment.ts` already exists as a minimal stub:
```typescript
import { tool } from "ai";
import { z } from "zod";

export const generatePayment = tool({
  description: "Generate a PIX QR code for the order payment. Call after order is confirmed.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async () => ({ success: false, message: "Not implemented yet — Story 3.1" }),
});
```
**Replace the entire file content** — description, inputSchema, and execute all change.

### CRITICAL: tools/index.ts — Do NOT Change

`generatePayment` is already imported and exported in `tools/index.ts` and present in `allTools`. Do NOT touch this file.

### CRITICAL: tools/tools.test.ts — Do NOT Change

Tool count is `toHaveLength(9)`. `generatePayment` is already counted. Do NOT modify.

### AI SDK v6: `inputSchema` NOT `parameters`

Architecture doc shows `parameters` in tool examples — **that's outdated**. The codebase uses `inputSchema` exclusively (confirmed in every story since 2.3). Use `inputSchema`.

### @mascotinhos/payments Package — Already Fully Implemented

The payments package (Story 1.4) has all needed exports:
- `createOrUpdateCustomer(phone, name)` → `{ id: string }` — finds or creates Asaas customer
- `createPixCharge(customerId, orderId, amount, splitConfig?)` → `PixChargeResult` — idempotent at Asaas level (checks existing PENDING charges by `externalReference`)
- `buildSplitConfig(walletId, percentualValue)` → `AsaasSplit[]`
- `verifyWebhookSignature(token)` — used in Story 3.2

Import from `@mascotinhos/payments`:
```typescript
import { createOrUpdateCustomer, createPixCharge, buildSplitConfig } from "@mascotinhos/payments";
import type { PixChargeResult } from "@mascotinhos/payments";
```

### Dual Idempotency Layers (IMPORTANT)

There are TWO idempotency guards — both are needed:

**Layer 1 — DB check (app-level, before any Asaas call):**
```typescript
const existingPayment = await prisma.payment.findFirst({ where: { orderId, status: "PENDING" } });
if (existingPayment) {
  // Return early — no Asaas call
  return { success: true, chargeId: existingPayment.asaasId, pixCopyPaste: existingPayment.pixQrCode, message: "PIX já gerado! Use o código acima para pagar." };
}
```

**Layer 2 — Asaas-level (inside `createPixCharge`):**
`createPixCharge` already queries `GET /payments?externalReference=orderId&status=PENDING` before POST. This catches the case where the DB record doesn't exist yet but an Asaas charge was already created (e.g., DB write failed mid-flow). This is transparent — the `@mascotinhos/payments` package handles it.

**Layer 3 — DB write race condition:**
After `createPixCharge` succeeds, `payment.create` might throw a unique constraint error on `asaasId` if two concurrent webhook events both got past the Layer 1 check before either wrote. Treat this as success — the charge exists.

### Payment Record Fields

From Prisma schema:
```typescript
model Payment {
  asaasId       String        @unique  // chargeResult.chargeId
  pixQrCode     String?               // chargeResult.pixCopyPaste (copy-paste EMV string)
  pixQrImageUrl String?               // null — base64 NOT stored (only sent inline to WhatsApp)
  amount        Decimal               // order.price (cast: Number(order.price))
  status        PaymentStatus @default(PENDING)
}
```

**Do NOT store `pixQrCodeBase64` in DB.** Base64 QR images are large (~50KB). Store only `pixCopyPaste` in `pixQrCode` field. Send the base64 inline to WhatsApp client via the tool return value.

### `order.price` is Prisma `Decimal` — Cast Before Passing to Asaas

`order.price` is a `Prisma.Decimal` object, NOT a JavaScript number. The `createPixCharge` function expects `amount: number`. Cast it:
```typescript
const amount = Number(order.price); // e.g., 29.9
```
Also cast when creating the Payment record: `amount: order.price` (Prisma accepts Decimal directly here — no cast needed for the DB write).

### `order.client` Null Safety

`include: { client: true }` makes Prisma's TypeScript types say client is always present, but runtime can return `client: null` for orphaned records. Use optional chaining:
```typescript
const clientPhone = order.client?.whatsappSenderId ?? "";
const clientName = order.client?.name ?? "Cliente";
```
If `clientPhone` is empty, return `{ success: false, message: "Erro ao processar pagamento. Tente novamente." }` (can't create Asaas customer without phone).

### Exact File Locations

- **Replace**: `packages/bot-engine/src/tools/generate-payment.ts` (stub → full implementation)
- **Create**: `packages/bot-engine/src/tools/generate-payment.test.ts`
- **Modify**: `packages/bot-engine/src/prompts/system-prompt.ts` (add AWAITING_PAYMENT block after CONFIRMING_ORDER block)
- **Modify**: `packages/bot-engine/src/prompts/system-prompt.test.ts` (add 1 test)
- **Do NOT touch**: `packages/bot-engine/src/tools/index.ts`
- **Do NOT touch**: `packages/bot-engine/src/tools/tools.test.ts`

### Full `generatePayment` Implementation Reference

```typescript
import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { createOrUpdateCustomer, createPixCharge, buildSplitConfig } from "@mascotinhos/payments";
import { env } from "@mascotinhos/env/server";

const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const generatePayment = tool({
  description: "Generate a PIX QR code and create a payment record for the confirmed order. Call when conversationState is AWAITING_PAYMENT.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ orderId }) => {
    // UUID validation
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(JSON.stringify({ level: "warn", event: "generate_payment_invalid_id", orderId, service: "bot-engine" }));
      return { success: false, message: "ID de pedido inválido." };
    }

    // Load order
    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId }, include: { client: true } });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "generate_payment_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao processar pagamento. Tente novamente." };
    }

    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    // Guard wrong state
    if (order.conversationState !== "AWAITING_PAYMENT") {
      console.log(JSON.stringify({ level: "warn", event: "generate_payment_wrong_state", orderId, state: order.conversationState, service: "bot-engine" }));
      return { success: false, message: "Estado inválido para pagamento." };
    }

    // Layer 1 idempotency: check for existing PENDING payment in DB
    try {
      const existingPayment = await prisma.payment.findFirst({ where: { orderId, status: "PENDING" } });
      if (existingPayment) {
        console.log(JSON.stringify({ level: "info", event: "generate_payment_idempotent_reuse", orderId, asaasId: existingPayment.asaasId, service: "bot-engine" }));
        return { success: true, chargeId: existingPayment.asaasId, pixCopyPaste: existingPayment.pixQrCode, message: "PIX já gerado! Use o código acima para pagar." };
      }
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "generate_payment_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao processar pagamento. Tente novamente." };
    }

    // Client data
    const clientPhone = order.client?.whatsappSenderId ?? "";
    const clientName = order.client?.name ?? "Cliente";
    if (!clientPhone) {
      console.log(JSON.stringify({ level: "error", event: "generate_payment_customer_error", orderId, error: "missing client phone", service: "bot-engine" }));
      return { success: false, message: "Erro ao processar pagamento. Tente novamente." };
    }

    // Create/find Asaas customer
    let customerId: string;
    try {
      const customer = await createOrUpdateCustomer(clientPhone, clientName);
      customerId = customer.id;
    } catch (err) {
      console.log(JSON.stringify({ level: "warn", event: "generate_payment_customer_error", orderId, error: err instanceof Error ? err.message : String(err), service: "bot-engine" }));
      return { success: false, message: "Erro ao processar pagamento. Tente novamente." };
    }

    // Build split config if wallet ID is configured
    const splitConfig = env.ASAAS_SPLIT_WALLET_ID
      ? buildSplitConfig(env.ASAAS_SPLIT_WALLET_ID, 10)
      : undefined;

    // Create PIX charge (Layer 2 idempotency inside createPixCharge)
    const amount = Number(order.price);
    let chargeResult;
    try {
      chargeResult = await createPixCharge(customerId, orderId, amount, splitConfig);
    } catch (err) {
      console.log(JSON.stringify({ level: "warn", event: "generate_payment_asaas_error", orderId, error: err instanceof Error ? err.message : String(err), service: "bot-engine" }));
      return { success: false, message: "Ops, tive um probleminha. Vou gerar outro QR code!" };
    }

    // Persist Payment record
    try {
      await prisma.payment.create({
        data: {
          orderId,
          asaasId: chargeResult.chargeId,
          pixQrCode: chargeResult.pixCopyPaste,
          pixQrImageUrl: null,
          amount: order.price,
          status: "PENDING",
        },
      });
    } catch (dbErr) {
      // Unique constraint on asaasId = race condition — charge exists, treat as success
      console.log(JSON.stringify({ level: "warn", event: "generate_payment_record_exists", orderId, asaasId: chargeResult.chargeId, service: "bot-engine" }));
    }

    console.log(JSON.stringify({ level: "info", event: "generate_payment_success", orderId, asaasId: chargeResult.chargeId, service: "bot-engine" }));

    return {
      success: true,
      chargeId: chargeResult.chargeId,
      pixQrCodeBase64: chargeResult.pixQrCodeBase64,
      pixCopyPaste: chargeResult.pixCopyPaste,
      message: "Aqui está o PIX! Assim que o pagamento cair, já começo a preparar sua arte 🎨",
    };
  },
});
```

### Mock Pattern for Tests (Follow confirm-order.test.ts)

```typescript
import { describe, expect, it, mock, beforeEach } from "bun:test";

const TEST_ORDER_ID = crypto.randomUUID();

// IMPORTANT: mock.module() BEFORE any module imports
const mockFindUnique = mock(() => Promise.resolve(makeDefaultOrder()));
const mockFindFirst = mock(() => Promise.resolve(null));
const mockPaymentCreate = mock(() => Promise.resolve({ id: "pay-1" }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique },
    payment: { findFirst: mockFindFirst, create: mockPaymentCreate },
  },
}));

const mockCreateOrUpdateCustomer = mock(() => Promise.resolve({ id: "cus_123" }));
const mockCreatePixCharge = mock(() => Promise.resolve({
  chargeId: "pay_abc",
  pixQrCodeBase64: "base64image==",
  pixCopyPaste: "00020126330014br.gov.bcb.pix...",
}));
const mockBuildSplitConfig = mock(() => [{ walletId: "wallet_123", percentualValue: 10 }]);

mock.module("@mascotinhos/payments", () => ({
  createOrUpdateCustomer: mockCreateOrUpdateCustomer,
  createPixCharge: mockCreatePixCharge,
  buildSplitConfig: mockBuildSplitConfig,
}));

// NOTE: do NOT mock "../conversation" — generatePayment does NOT call updateOrderState.
// The order stays in AWAITING_PAYMENT until the payment webhook (Story 3.2) transitions it.

// Static import AFTER all mock.module() calls
import { generatePayment } from "./generate-payment";

// ctx object required by AI SDK tool.execute signature
const ctx = {
  toolCallId: "test",
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
};

function makeDefaultOrder() {
  return {
    id: TEST_ORDER_ID,
    conversationState: "AWAITING_PAYMENT",
    price: 29.9, // plain number fine in tests — Number(29.9) === 29.9
    client: { id: "client-1", name: "Maria", whatsappSenderId: "5511999999999" },
  };
}

describe("generatePayment", () => {
  beforeEach(() => {
    mockFindUnique.mockClear();
    mockFindFirst.mockClear();
    mockPaymentCreate.mockClear();
    mockCreateOrUpdateCustomer.mockClear();
    mockCreatePixCharge.mockClear();
    mockBuildSplitConfig.mockClear();
    mockFindUnique.mockImplementation(() => Promise.resolve(makeDefaultOrder()));
    mockFindFirst.mockImplementation(() => Promise.resolve(null));
    mockPaymentCreate.mockImplementation(() => Promise.resolve({ id: "pay-1" }));
    mockCreateOrUpdateCustomer.mockImplementation(() => Promise.resolve({ id: "cus_123" }));
    mockCreatePixCharge.mockImplementation(() => Promise.resolve({ chargeId: "pay_abc", pixQrCodeBase64: "base64image==", pixCopyPaste: "emv_code" }));
  });
  // Use ctx in every execute call: generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx)
  // ... tests
});
```

### test-setup.ts — Already Correct

`packages/bot-engine/src/test-setup.ts` already sets `ASAAS_API_KEY`, `ASAAS_WEBHOOK_SECRET`, and all required env vars. No changes needed.

**IMPORTANT:** `ASAAS_SPLIT_WALLET_ID` is intentionally NOT set in `test-setup.ts` (it is optional per `server-schema.ts`). This means by default `env.ASAAS_SPLIT_WALLET_ID` is `undefined` in tests, so `buildSplitConfig` will NOT be called in most tests — correct behavior. For test 3.1.14 (wallet ID set path), set it in the test itself:
```typescript
process.env['ASAAS_SPLIT_WALLET_ID'] = 'wallet_test_123';
// ... run test
delete process.env['ASAAS_SPLIT_WALLET_ID'];
```

### Note on `Decimal` in Tests

`order.price` is `Prisma.Decimal` at runtime but in tests you can use a plain number or a mock Decimal-like object. `Number(order.price)` works on both a real Decimal and a JS number. For the mock fixture, `price: 29.9` (plain number) is fine in tests since `Number(29.9) === 29.9`.

### State Transition Map (Full Context)

```
Story 2.8: CONFIRMING_ORDER → AWAITING_PAYMENT (via confirmOrder, confirmed=true)
Story 3.1: AWAITING_PAYMENT — generatePayment tool runs, Payment record created (state stays AWAITING_PAYMENT until webhook)
Story 3.2: AWAITING_PAYMENT → GENERATING (via payment webhook when confirmed)
Story 3.3: GENERATING — bot sends confirmation message
Story 3.4: PIX split config in payment creation
Epic 4:   GENERATING → DELIVERING → AWAITING_FEEDBACK (via async pipeline)
```

`generatePayment` does NOT transition the `conversationState`. The order stays in `AWAITING_PAYMENT` until Story 3.2's webhook handler transitions it to `GENERATING`.

### Key Patterns From Previous Stories (Mandatory)

1. **`inputSchema`** not `parameters` — AI SDK v6 (enforced throughout codebase)
2. **`mock.module()` BEFORE static imports** — bun test critical requirement
3. **UUID validation with regex** before any DB call — security pattern from Story 2.7
4. **Wrong state guard** — log + return error (no silent failures)
5. **Structured JSON logging** — `JSON.stringify({ level, event, service: "bot-engine", ...})` always
6. **DB error handling** — every Prisma call wrapped in try/catch
7. **No `process.env` directly** — use `@mascotinhos/env/server`
8. **`include: { client: true }`** — needed for phone/name lookup
9. **`order.client?.name ?? "fallback"`** — null safety (see Story 2.8 MEDIUM-3 fix)
10. **Do NOT store large base64 blobs in DB** — only store the EMV copy-paste string

### GitHub Issue Reference

Story 3.1 GitHub Issue: [mgiovani/fotos#53](https://github.com/mgiovani/fotos/issues/53)

### References

- `.bmad_output/planning-artifacts/epics.md` — Epic 3, Story 3.1 (AC, FRs, technical notes)
- `.bmad_output/planning-artifacts/architecture.md` — Tool Inventory, Error Handling Pattern, Naming Conventions
- `.bmad_output/implementation-artifacts/story-2.8.md` — Previous story (patterns, MEDIUM-3 null client fix, test count)
- `mascotinhos/packages/bot-engine/src/tools/generate-payment.ts` — Stub to replace
- `mascotinhos/packages/bot-engine/src/tools/confirm-order.ts` — Implementation reference (UUID guard, state guard, DB error handling patterns)
- `mascotinhos/packages/bot-engine/src/tools/confirm-order.test.ts` — Mock pattern to follow exactly
- `mascotinhos/packages/payments/src/create-pix.ts` — `createPixCharge` and `getPaymentStatus`
- `mascotinhos/packages/payments/src/customer.ts` — `createOrUpdateCustomer`
- `mascotinhos/packages/payments/src/split.ts` — `buildSplitConfig`
- `mascotinhos/packages/payments/src/index.ts` — All exports from payments package
- `mascotinhos/packages/bot-engine/src/tools/index.ts` — DO NOT MODIFY
- `mascotinhos/packages/bot-engine/src/tools/tools.test.ts` — DO NOT MODIFY
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` — Add AWAITING_PAYMENT block
- `mascotinhos/packages/db/prisma/schema/schema.prisma` — Payment model fields

## File List

- `mascotinhos/packages/bot-engine/src/tools/generate-payment.ts` — **replaced** (stub → full implementation)
- `mascotinhos/packages/bot-engine/src/tools/generate-payment.test.ts` — **created** (11 tests)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.ts` — **modified** (added AWAITING_PAYMENT state instructions block)
- `mascotinhos/packages/bot-engine/src/prompts/system-prompt.test.ts` — **modified** (added 1 AWAITING_PAYMENT test)
- `mascotinhos/packages/bot-engine/package.json` — **modified** (added `@mascotinhos/payments` workspace dependency)
- `.bmad_output/implementation-artifacts/sprint-status.yaml` — **modified** (story status: ready-for-dev → review)

## Dev Agent Record

### Implementation Plan

1. Replaced `generate-payment.ts` stub with full implementation following the spec exactly:
   - UUID validation regex guard before any DB call
   - `prisma.order.findUnique` with `include: { client: true }` in try/catch
   - Wrong state guard for non-AWAITING_PAYMENT orders
   - Layer 1 idempotency: `prisma.payment.findFirst` for existing PENDING payment
   - Null-safe client phone/name extraction with empty-phone guard
   - `createOrUpdateCustomer` call in try/catch
   - Optional split config via `env.ASAAS_SPLIT_WALLET_ID` + `buildSplitConfig`
   - `createPixCharge` call in try/catch
   - `prisma.payment.create` with race-condition-tolerant error handling
   - Full success payload with `pixQrCodeBase64`, `pixCopyPaste`, `chargeId`, `message`
   - All 8 structured logging events

2. Added `@mascotinhos/payments` to `bot-engine/package.json` dependencies (it was missing — the stub didn't import it).

3. Added AWAITING_PAYMENT instructions block to `system-prompt.ts` after the CONFIRMING_ORDER block.

4. Created `generate-payment.test.ts` with 11 tests covering all ACs. Key decision: mocked `@mascotinhos/env/server` with a mutable Proxy object (`mockEnv`) because `createEnv` from `@t3-oss/env-core` snapshots `process.env` at module load time — setting `process.env` at test runtime does not affect the already-created `env` object.

5. Added 1 test to `system-prompt.test.ts` for AWAITING_PAYMENT state.

### Completion Notes

- All 4 tasks completed; all 108 bot-engine tests pass (11 new + 97 pre-existing), 0 regressions
- Type-check: `bot-engine` package has 0 new errors; only pre-existing `collect-photos.ts` TS2532 and `payments`/`storage` TS2307 bun:test errors remain
- `tools/index.ts` and `tools/tools.test.ts` were not touched as instructed
- The `@mascotinhos/payments` workspace dependency was missing from `bot-engine/package.json` and was added as part of this story

## Review Findings (30 Mar 2026)

Adversarial + edge-case + acceptance audit. All HIGH/MEDIUM findings patched inline. 110/110 tests pass.

### Finding 1 — HIGH: Blind catch on `payment.create` swallows all DB errors
**File:** `generate-payment.ts` (original catch at payment.create)
**Issue:** Any DB error (connection refused, schema mismatch) logged at `warn` as `generate_payment_record_exists` and returned success — Asaas charged but no Payment record persisted.
**Fix applied:** Inspect error message for "Unique constraint" to distinguish race-condition duplicate from genuine persist failures. Non-unique errors now log at `error` level with event `generate_payment_db_persist_error`.

### Finding 2 — HIGH: Idempotency check only covered PENDING status
**File:** `generate-payment.ts` (idempotency query)
**Issue:** `payment.findFirst({ where: { orderId, status: "PENDING" } })` missed CONFIRMED/RECEIVED charges. A re-triggered bot call after payment confirmation would create a duplicate Asaas charge.
**Fix applied:** Query extended to `status: { in: ["PENDING", "CONFIRMED", "RECEIVED"] }`.

### Finding 3 — MEDIUM: `pixQrCodeBase64` not persisted — idempotency retry sends text-only
**File:** `generate-payment.ts` (payment.create data)
**Issue:** `pixQrImageUrl: null` hardcoded. On WhatsApp delivery failure + retry, the idempotency path could not return the base64 QR image.
**Fix applied:** `pixQrImageUrl: chargeResult.pixQrCodeBase64` now stored; idempotency return includes `pixQrCodeBase64: existingPayment.pixQrImageUrl ?? undefined`.

### Finding 4 — MEDIUM: No test for fully null `client` relation (orphaned order)
**File:** `generate-payment.test.ts`
**Issue:** Tests covered null `client.name` but not `client: null` itself. The guard path was exercised only indirectly.
**Fix applied:** Added test 3.1.16 — null client → `{ success: false, message: "Erro ao processar pagamento. Tente novamente." }`, `createPixCharge` not called.

### Finding 5 — MEDIUM: CONFIRMED payment not covered by idempotency test
**File:** `generate-payment.test.ts`
**Issue:** Test 3.1.9 only covered `status: "PENDING"` case; CONFIRMED/RECEIVED were untested after Finding 2 fix.
**Fix applied:** Added test 3.1.17 — CONFIRMED existing payment returns idempotent success, `createPixCharge` not called.

### Deferred (not patched — see deferred-work.md)
- Split percentage hardcoded as `10` with no env-var or config backing (MEDIUM)
- `orderId` passed directly to log (LOW — UUID regex prevents injection; sanitization deferred)

## Change Log

- 2026-03-30: Implemented Story 3.1 — PIX QR code generation and delivery. Replaced `generate-payment.ts` stub with full implementation (dual idempotency, split config, structured logging). Added AWAITING_PAYMENT block to system prompt. Created 11 unit tests. Added `@mascotinhos/payments` dependency to `bot-engine`.
- 2026-03-30: Code review patches applied — extended idempotency to CONFIRMED/RECEIVED statuses, fixed blind catch on payment.create, persisted pixQrCodeBase64, added 2 new tests (3.1.16, 3.1.17). Total: 13 tests, 110 suite-wide.
