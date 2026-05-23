import { describe, expect, it, mock, beforeEach } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
// Use a CUID v1 shaped ID — Prisma uses @default(cuid()), not UUID.
const TEST_ORDER_ID = "ctest00000000000000000005";

const mockFindUnique = mock(() =>
  Promise.resolve({
    id: TEST_ORDER_ID,
    conversationState: "CONFIRMING_ORDER",
    photosUrls: ["path/photo1.jpg", "path/photo2.jpg"],
    theme: "Disney 3D",
    outfitDescription: "vestido azul",
    extraRequests: "balão amarelo",
    client: { id: "client-1", name: "Maria" },
  }),
);

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique },
  },
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Static import AFTER all mock.module() calls
import { confirmOrder } from "./confirm-order";

const ctx = {
  toolCallId: "test",
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
};

describe("confirmOrder", () => {
  beforeEach(() => {
    mockFindUnique.mockClear();
    mockUpdateOrderState.mockClear();

    // Reset defaults
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "CONFIRMING_ORDER",
        photosUrls: ["path/photo1.jpg", "path/photo2.jpg"],
        theme: "Disney 3D",
        outfitDescription: "vestido azul",
        extraRequests: "balão amarelo",
        client: { id: "client-1", name: "Maria" },
      }),
    );
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(true));
  });

  // Task 3.1.5: confirmed=false, alterRequest=null → returns summary with all order fields, no state transition
  it("confirmed=false, alterRequest=null: returns formatted summary with all order fields, no state transition", async () => {
    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false, alterRequest: null },
      ctx,
    );

    expect(result).toMatchObject({ success: true, confirmed: false });
    expect((result as { message: string }).message).toContain("Resumo do seu pedido");
    expect((result as { message: string }).message).toContain("Maria");
    expect((result as { message: string }).message).toContain("Disney 3D");
    expect((result as { message: string }).message).toContain("vestido azul");
    expect((result as { message: string }).message).toContain("balão amarelo");
    expect((result as { message: string }).message).toContain("2 foto(s)");
    expect((result as { message: string }).message).toContain("R$29,90");
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Task 3.1.6: confirmed=true → calls updateOrderState(CONFIRMING_ORDER → AWAITING_PAYMENT), returns confirmed: true
  it("confirmed=true: calls updateOrderState(CONFIRMING_ORDER → AWAITING_PAYMENT) and returns confirmed: true", async () => {
    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: true },
      ctx,
    );

    expect(result).toMatchObject({ success: true, confirmed: true });
    expect((result as { message: string }).message).toContain("Pedido confirmado!");
    expect(mockUpdateOrderState).toHaveBeenCalledWith(TEST_ORDER_ID, "CONFIRMING_ORDER", "AWAITING_PAYMENT");
  });

  // Task 3.1.7: confirmed=false, alterRequest="quero mudar o tema" → returns { confirmed: false, alterRequest }, no state transition
  it("confirmed=false, alterRequest set: returns alter response without state transition", async () => {
    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false, alterRequest: "quero mudar o tema" },
      ctx,
    );

    expect(result).toMatchObject({ success: true, confirmed: false, alterRequest: "quero mudar o tema" });
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Task 3.1.8: order not found → { success: false, message: "Pedido não encontrado." }
  it("order not found: returns { success: false, message: 'Pedido não encontrado.' }", async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false },
      ctx,
    );

    expect(result).toMatchObject({ success: false, message: "Pedido não encontrado." });
  });

  // Task 3.1.9: invalid order ID (not a CUID) → { success: false, message: "ID de pedido inválido." }, DB NOT called
  it("invalid order ID (not a CUID): returns { success: false, message: 'ID de pedido inválido.' } without calling DB", async () => {
    const result = await confirmOrder.execute(
      { orderId: "not-a-uuid", confirmed: false },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("ID de pedido inválido");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // Task 3.1.10: wrong state (e.g. COLLECTING_THEME) → { success: false } with actionable recovery hint, no transition
  it("wrong conversationState: returns { success: false } with state-specific recovery hint, no transition", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "COLLECTING_THEME",
        photosUrls: [],
        theme: null,
        outfitDescription: null,
        extraRequests: null,
        client: { id: "client-1", name: "Maria" },
      }),
    );

    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("selectStyle");
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Task 3.1.11: updateOrderState throws → { success: false, message: "Erro ao confirmar pedido. Tente novamente." }
  it("updateOrderState throws: returns { success: false, message: 'Erro ao confirmar pedido. Tente novamente.' }", async () => {
    mockUpdateOrderState.mockImplementation(() => Promise.reject(new Error("transition failed")));

    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: true },
      ctx,
    );

    expect(result).toMatchObject({ success: false, message: "Erro ao confirmar pedido. Tente novamente." });
  });

  // Task 3.1.12: DB error on findUnique → { success: false, message: "Erro ao buscar pedido. Tente novamente." }
  it("DB error on findUnique: returns { success: false, message: 'Erro ao buscar pedido. Tente novamente.' }", async () => {
    mockFindUnique.mockImplementation(() => Promise.reject(new Error("DB connection refused")));

    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false },
      ctx,
    );

    expect(result).toMatchObject({ success: false, message: "Erro ao buscar pedido. Tente novamente." });
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Task 3.1.13: summary includes client name when client.name is set
  it("summary includes client name when client.name is set", async () => {
    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false, alterRequest: null },
      ctx,
    );

    expect((result as { message: string }).message).toContain("Maria");
    expect((result as { message: string }).message).not.toContain("não informado");
  });

  // Task 3.1.14: summary shows "não informado" when client.name is null
  it("summary shows 'não informado' when client.name is null", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "CONFIRMING_ORDER",
        photosUrls: ["photo1.jpg"],
        theme: "Anime",
        outfitDescription: null,
        extraRequests: null,
        client: { id: "client-2", name: null },
      }),
    );

    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false, alterRequest: null },
      ctx,
    );

    expect((result as { message: string }).message).toContain("não informado");
  });

  // Review patch: race condition — updateOrderState returns false (0 rows) → { success: false }
  it("updateOrderState returns false (race condition): returns { success: false } without claiming order is confirmed", async () => {
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(false));

    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: true },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("já foi confirmado");
  });

  // Review patch: alterRequest longer than 300 chars is truncated before returning/logging
  it("alterRequest > 300 chars is truncated to 300 chars in the returned alterRequest", async () => {
    const longRequest = "a".repeat(500);

    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false, alterRequest: longRequest },
      ctx,
    );

    expect(result).toMatchObject({ success: true, confirmed: false });
    const returned = (result as { alterRequest: string }).alterRequest;
    expect(returned.length).toBe(300);
  });

  // Review patch: orphan client (client relation null) → summary uses "não informado" fallback
  it("null client relation: summary shows 'não informado' without throwing", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "CONFIRMING_ORDER",
        photosUrls: ["photo1.jpg"],
        theme: "Anime",
        outfitDescription: null,
        extraRequests: null,
        client: null,
      }),
    );

    const result = await confirmOrder.execute(
      { orderId: TEST_ORDER_ID, confirmed: false, alterRequest: null },
      ctx,
    );

    expect((result as { message: string }).message).toContain("não informado");
  });
});
