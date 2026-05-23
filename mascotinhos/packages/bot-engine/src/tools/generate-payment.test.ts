import { describe, expect, it, mock, beforeEach } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
// Use a CUID v1 shaped ID — Prisma uses @default(cuid()), not UUID.
const TEST_ORDER_ID = "ctest00000000000000000002";

// Story 5.4: mock QStashClient for abandoned cart scheduling
const mockQStashPublishJSON = mock(() => Promise.resolve({ messageId: "msg_test" }));
mock.module("@upstash/qstash", () => ({
  Client: class {
    publishJSON = mockQStashPublishJSON;
  },
}));

const mockFindUnique = mock(() => Promise.resolve(makeDefaultOrder()));
const mockFindFirst = mock(() => Promise.resolve(null));
const mockPaymentCreate = mock(() => Promise.resolve({ id: "pay-1" }));
const mockPaymentUpdate = mock(() => Promise.resolve({ id: "pay-1" }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique },
    payment: { findFirst: mockFindFirst, create: mockPaymentCreate, update: mockPaymentUpdate },
  },
}));

const mockCreateOrUpdateCustomer = mock(() => Promise.resolve({ id: "cus_123" }));
const mockCreatePixCharge = mock(() =>
  Promise.resolve({
    chargeId: "pay_abc",
    pixQrCodeBase64: "base64image==",
    pixCopyPaste: "emv_code",
  }),
);
const mockBuildSplitConfig = mock(() => [{ walletId: "wallet_123", percentualValue: 10 }]);
const mockFetchPixQrCode = mock(() =>
  Promise.resolve({
    chargeId: "pay_existing",
    pixQrCodeBase64: "base64image==",
    pixCopyPaste: "emv_code",
  }),
);

mock.module("@mascotinhos/payments", () => ({
  createOrUpdateCustomer: mockCreateOrUpdateCustomer,
  createPixCharge: mockCreatePixCharge,
  buildSplitConfig: mockBuildSplitConfig,
  fetchPixQrCode: mockFetchPixQrCode,
}));

// Mock env — use a mutable object so individual tests can override ASAAS_SPLIT_WALLET_ID
const mockEnv: Record<string, string | undefined> = {
  ASAAS_SPLIT_WALLET_ID: undefined,
  QSTASH_TOKEN: "test-qstash-token",
  VERCEL_URL: "example.vercel.app",
};
mock.module("@mascotinhos/env/server", () => ({
  env: new Proxy(mockEnv, {
    get(target, prop) {
      return target[prop as string];
    },
  }),
}));

// Mock sendPixMessages and resendPixFromPath — prevents real storage/WA calls in tests
const mockSendPixMessages = mock(() =>
  Promise.resolve({ imageSent: true, storagePath: `generated/pix-qr/${TEST_ORDER_ID}.png` }),
);
const mockResendPixFromPath = mock(() => Promise.resolve(undefined));

mock.module("../send-pix-messages", () => ({
  sendPixMessages: mockSendPixMessages,
  resendPixFromPath: mockResendPixFromPath,
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
    mockPaymentUpdate.mockClear();
    mockCreateOrUpdateCustomer.mockClear();
    mockCreatePixCharge.mockClear();
    mockBuildSplitConfig.mockClear();
    mockQStashPublishJSON.mockClear();
    mockFetchPixQrCode.mockClear();
    mockSendPixMessages.mockClear();
    mockResendPixFromPath.mockClear();

    mockQStashPublishJSON.mockImplementation(() => Promise.resolve({ messageId: "msg_test" }));
    mockFindUnique.mockImplementation(() => Promise.resolve(makeDefaultOrder()));
    mockFindFirst.mockImplementation(() => Promise.resolve(null));
    mockPaymentCreate.mockImplementation(() => Promise.resolve({ id: "pay-1" }));
    mockPaymentUpdate.mockImplementation(() => Promise.resolve({ id: "pay-1" }));
    mockCreateOrUpdateCustomer.mockImplementation(() => Promise.resolve({ id: "cus_123" }));
    mockCreatePixCharge.mockImplementation(() =>
      Promise.resolve({ chargeId: "pay_abc", pixQrCodeBase64: "base64image==", pixCopyPaste: "emv_code" }),
    );
    mockBuildSplitConfig.mockImplementation(() => [{ walletId: "wallet_123", percentualValue: 10 }]);
    mockFetchPixQrCode.mockImplementation(() =>
      Promise.resolve({ chargeId: "pay_existing", pixQrCodeBase64: "base64image==", pixCopyPaste: "emv_code" }),
    );
    mockSendPixMessages.mockImplementation(() =>
      Promise.resolve({ imageSent: true, storagePath: `generated/pix-qr/${TEST_ORDER_ID}.png` }),
    );
    mockResendPixFromPath.mockImplementation(() => Promise.resolve(undefined));
    mockEnv.ASAAS_SPLIT_WALLET_ID = undefined;
  });

  // 3.1.5: happy path
  it("happy path: createOrUpdateCustomer → createPixCharge → payment.create → returns success", async () => {
    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true, chargeId: "pay_abc" });
    expect((result as { message: string }).message).toContain("PIX enviado");
    expect(mockCreateOrUpdateCustomer).toHaveBeenCalledWith("5511999999999", "Maria");
    expect(mockCreatePixCharge).toHaveBeenCalledWith("cus_123", TEST_ORDER_ID, 29.9, undefined);
    expect(mockPaymentCreate).toHaveBeenCalledTimes(1);
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          splitConfig: null,
        }),
      }),
    );
    // pixQrImageUrl must NOT be written on new payment rows
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ pixQrImageUrl: expect.anything() }),
      }),
    );
  });

  // 3.1.6: invalid UUID
  it("invalid UUID orderId: returns { success: false, message: 'ID de pedido inválido.' } without DB calls", async () => {
    const result = await generatePayment.execute({ orderId: "not-a-uuid" }, ctx);

    expect(result).toMatchObject({ success: false, message: "ID de pedido inválido." });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
  });

  // 3.1.7: order not found
  it("order not found: returns { success: false, message: 'Pedido não encontrado.' }", async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Pedido não encontrado." });
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
  });

  // 3.1.8: wrong state
  it("wrong state (CONFIRMING_ORDER): returns { success: false, message: 'Estado inválido para pagamento.' }", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ ...makeDefaultOrder(), conversationState: "CONFIRMING_ORDER" }),
    );

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Estado inválido para pagamento." });
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
  });

  // 3.1.9: existing PENDING payment (idempotency) — with pixQrStoragePath
  it("existing PENDING payment with pixQrStoragePath: calls resendPixFromPath, returns success", async () => {
    mockFindFirst.mockImplementation(() =>
      Promise.resolve({
        id: "existing-pay",
        asaasId: "pay_existing",
        pixQrCode: "existing_emv_code",
        pixQrStoragePath: "generated/pix-qr/existing-order.png",
        status: "PENDING",
      }),
    );

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true, chargeId: "pay_existing" });
    expect((result as { message: string }).message).toContain("PIX reenviado");
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
    expect(mockCreateOrUpdateCustomer).not.toHaveBeenCalled();
    expect(mockResendPixFromPath).toHaveBeenCalledWith(
      TEST_ORDER_ID,
      "5511999999999",
      "generated/pix-qr/existing-order.png",
      "existing_emv_code",
    );
    expect(mockFetchPixQrCode).not.toHaveBeenCalled();
  });

  // 3.1.10: createOrUpdateCustomer throws
  it("createOrUpdateCustomer throws: returns { success: false, message: 'Erro ao processar pagamento. Tente novamente.' }", async () => {
    mockCreateOrUpdateCustomer.mockImplementation(() => Promise.reject(new Error("customer API failed")));

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Erro ao processar pagamento. Tente novamente." });
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
  });

  // 3.1.11: createPixCharge throws
  it("createPixCharge throws: returns { success: false, message: 'Ops, tive um probleminha. Vou gerar outro QR code!' }", async () => {
    mockCreatePixCharge.mockImplementation(() => Promise.reject(new Error("PIX_QR_NOT_READY")));

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({
      success: false,
      message: "Ops, tive um probleminha. Vou gerar outro QR code!",
    });
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  // 3.1.12: DB error on findUnique
  it("DB error on findUnique: returns { success: false, message: 'Erro ao processar pagamento. Tente novamente.' }", async () => {
    mockFindUnique.mockImplementation(() => Promise.reject(new Error("DB connection refused")));

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Erro ao processar pagamento. Tente novamente." });
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
  });

  // 3.1.13: payment.create throws unique constraint (race condition) → treated as success
  it("payment.create throws unique constraint (race condition): returns success with chargeId", async () => {
    mockPaymentCreate.mockImplementation(() => Promise.reject(new Error("Unique constraint failed on asaasId")));

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true, chargeId: "pay_abc" });
    expect((result as { message: string }).message).toContain("PIX enviado");
  });

  // 3.1.14: null client.name → createOrUpdateCustomer called with "Cliente" as fallback
  it("null client.name: createOrUpdateCustomer called with 'Cliente' as fallback name", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        ...makeDefaultOrder(),
        client: { id: "client-1", name: null, whatsappSenderId: "5511999999999" },
      }),
    );

    await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(mockCreateOrUpdateCustomer).toHaveBeenCalledWith("5511999999999", "Cliente");
  });

  // 3.1.15: ASAAS_SPLIT_WALLET_ID set → buildSplitConfig called and split passed to createPixCharge
  it("ASAAS_SPLIT_WALLET_ID set: buildSplitConfig called and split config passed to createPixCharge", async () => {
    mockEnv.ASAAS_SPLIT_WALLET_ID = "wallet_test_123";

    await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(mockBuildSplitConfig).toHaveBeenCalledWith("wallet_test_123", 10);
    expect(mockCreatePixCharge).toHaveBeenCalledWith(
      "cus_123",
      TEST_ORDER_ID,
      29.9,
      [{ walletId: "wallet_123", percentualValue: 10 }],
    );
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          splitConfig: [{ walletId: "wallet_123", percentualValue: 10 }],
        }),
      }),
    );
  });

  // 3.3: persists null splitConfig when ASAAS_SPLIT_WALLET_ID is not configured
  it("persists null splitConfig when ASAAS_SPLIT_WALLET_ID is not configured", async () => {
    mockEnv.ASAAS_SPLIT_WALLET_ID = undefined;
    await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          splitConfig: null,
        }),
      }),
    );
  });

  // 3.4.1: payment.create throws a non-unique DB error → still returns success (Asaas charge exists; audit record lost — known trade-off)
  it("payment.create throws non-unique DB error: returns success (charge exists in Asaas, audit record lost)", async () => {
    mockPaymentCreate.mockImplementation(() => Promise.reject(new Error("Connection refused")));

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    // Charge was created in Asaas; we still return success so the user gets their QR code.
    // The absence of a Payment record (including splitConfig audit) is the accepted trade-off.
    expect(result).toMatchObject({ success: true, chargeId: "pay_abc" });
    expect((result as { message: string }).message).toContain("PIX enviado");
  });

  // Story 5.4: QStash abandoned cart scheduling
  it("5.4: happy path publishes nudge_abandoned and close_abandoned to QStash after success", async () => {
    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true });
    expect(mockQStashPublishJSON).toHaveBeenCalledTimes(2);
    expect(mockQStashPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.vercel.app/api/generate",
        body: { orderId: TEST_ORDER_ID, action: "nudge_abandoned" },
        delay: 5400,
        retries: 3,
      }),
    );
    expect(mockQStashPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.vercel.app/api/generate",
        body: { orderId: TEST_ORDER_ID, action: "close_abandoned" },
        delay: 86400,
        retries: 3,
      }),
    );
  });

  it("5.4: QStash failure does NOT affect the tool's return value — still returns success", async () => {
    mockQStashPublishJSON.mockImplementation(() => Promise.reject(new Error("QStash unavailable")));

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true, chargeId: "pay_abc" });
  });

  it("5.4: QStash is NOT called when payment creation fails", async () => {
    mockCreatePixCharge.mockImplementation(() => Promise.reject(new Error("PIX_QR_NOT_READY")));

    await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(mockQStashPublishJSON).not.toHaveBeenCalled();
  });

  it("5.4: QStash is NOT called for idempotent reuse (existing payment)", async () => {
    mockFindFirst.mockImplementation(() =>
      Promise.resolve({
        id: "existing-pay",
        asaasId: "pay_existing",
        pixQrCode: "existing_emv_code",
        pixQrStoragePath: "generated/pix-qr/existing-order.png",
        status: "PENDING",
      }),
    );

    await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(mockQStashPublishJSON).not.toHaveBeenCalled();
  });

  // 3.1.16: null client relation (orphaned order) → returns { success: false, message: 'Erro ao processar pagamento. Tente novamente.' }
  it("null client relation: returns { success: false, message: 'Erro ao processar pagamento. Tente novamente.' }", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ ...makeDefaultOrder(), client: null }),
    );

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Erro ao processar pagamento. Tente novamente." });
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
  });

  // 3.1.17: existing CONFIRMED payment (already paid) — fast path via pixQrStoragePath
  it("existing CONFIRMED payment with pixQrStoragePath: calls resendPixFromPath, returns idempotent success", async () => {
    mockFindFirst.mockImplementation(() =>
      Promise.resolve({
        id: "existing-pay",
        asaasId: "pay_confirmed",
        pixQrCode: "confirmed_emv_code",
        pixQrStoragePath: "generated/pix-qr/confirmed-order.png",
        status: "CONFIRMED",
      }),
    );

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true, chargeId: "pay_confirmed" });
    expect((result as { message: string }).message).toContain("PIX reenviado");
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
    expect(mockResendPixFromPath).toHaveBeenCalledWith(
      TEST_ORDER_ID,
      "5511999999999",
      "generated/pix-qr/confirmed-order.png",
      "confirmed_emv_code",
    );
  });

  // New: new-charge path persists pixQrStoragePath via payment.update
  it("new-charge path: persists pixQrStoragePath returned by sendPixMessages", async () => {
    mockSendPixMessages.mockImplementation(() =>
      Promise.resolve({ imageSent: true, storagePath: "generated/pix-qr/test-order.png" }),
    );

    await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(mockPaymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pixQrStoragePath: "generated/pix-qr/test-order.png" }),
      }),
    );
  });

  // New: new-charge path with null storagePath does NOT call payment.update
  it("new-charge path: skips payment.update when sendPixMessages returns storagePath: null", async () => {
    mockSendPixMessages.mockImplementation(() =>
      Promise.resolve({ imageSent: false, storagePath: null }),
    );

    await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(mockPaymentUpdate).not.toHaveBeenCalled();
  });

  // New: reuse path with pixQrStoragePath set — fast path
  it("reuse with pixQrStoragePath set: calls resendPixFromPath, does NOT call fetchPixQrCode or sendPixMessages", async () => {
    mockFindFirst.mockImplementation(() =>
      Promise.resolve({
        id: "existing-pay",
        asaasId: "pay_existing",
        pixQrCode: "existing_emv_code",
        pixQrStoragePath: "generated/pix-qr/existing-order.png",
        status: "PENDING",
      }),
    );

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true, chargeId: "pay_existing" });
    expect(mockResendPixFromPath).toHaveBeenCalledWith(
      TEST_ORDER_ID,
      "5511999999999",
      "generated/pix-qr/existing-order.png",
      "existing_emv_code",
    );
    expect(mockFetchPixQrCode).not.toHaveBeenCalled();
    expect(mockSendPixMessages).not.toHaveBeenCalled();
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
  });

  // New: reuse path legacy fallback (pixQrStoragePath null)
  it("reuse legacy fallback: calls fetchPixQrCode, then sendPixMessages, then persists pixQrStoragePath", async () => {
    mockFindFirst.mockImplementation(() =>
      Promise.resolve({
        id: "existing-pay",
        asaasId: "pay_existing",
        pixQrCode: "existing_emv_code",
        pixQrStoragePath: null,
        status: "PENDING",
      }),
    );
    mockFetchPixQrCode.mockImplementation(() =>
      Promise.resolve({ chargeId: "pay_existing", pixQrCodeBase64: "fresh_base64", pixCopyPaste: "fresh_emv" }),
    );
    mockSendPixMessages.mockImplementation(() =>
      Promise.resolve({ imageSent: true, storagePath: "generated/pix-qr/legacy-order.png" }),
    );

    const result = await generatePayment.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true, chargeId: "pay_existing" });
    expect(mockFetchPixQrCode).toHaveBeenCalledWith("pay_existing");
    expect(mockSendPixMessages).toHaveBeenCalledWith(TEST_ORDER_ID, "5511999999999", "fresh_base64", "fresh_emv");
    expect(mockPaymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pixQrStoragePath: "generated/pix-qr/legacy-order.png" }),
      }),
    );
    expect(mockResendPixFromPath).not.toHaveBeenCalled();
    expect(mockCreatePixCharge).not.toHaveBeenCalled();
  });
});
