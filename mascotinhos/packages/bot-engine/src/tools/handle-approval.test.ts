import { describe, expect, it, mock, beforeEach } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
// Use a CUID v1 shaped ID — Prisma uses @default(cuid()), not UUID.
const TEST_ORDER_ID = "ctest00000000000000000004";

const mockFindUnique = mock(() =>
  Promise.resolve({
    id: TEST_ORDER_ID,
    conversationState: "AWAITING_FEEDBACK",
    orderStatus: "PAID",
  }),
);

const mockUpdate = mock(() => Promise.resolve({ id: TEST_ORDER_ID, orderStatus: "DELIVERED" }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Static import AFTER all mock.module() calls
import { handleApproval } from "./handle-approval";

const ctx = {
  toolCallId: "test",
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
};

describe("handleApproval", () => {
  beforeEach(() => {
    mockFindUnique.mockClear();
    mockUpdate.mockClear();
    mockUpdateOrderState.mockClear();

    // Reset defaults
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "AWAITING_FEEDBACK",
        orderStatus: "PAID",
      }),
    );
    mockUpdate.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, orderStatus: "DELIVERED" }),
    );
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(true));
  });

  // Unit test: invalid order ID (not a CUID) returns { success: false }
  it("invalid order ID (not a CUID): returns { success: false, message: 'ID de pedido inválido.' } without calling DB", async () => {
    const result = await handleApproval.execute({ orderId: "not-a-uuid" }, ctx);

    expect(result).toMatchObject({ success: false, message: "ID de pedido inválido." });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Unit test: order not found returns { success: false }
  it("order not found: returns { success: false, message: 'Pedido não encontrado.' }", async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await handleApproval.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Pedido não encontrado." });
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Unit test: wrong state (not AWAITING_FEEDBACK) returns { success: false }
  it("wrong conversationState: returns { success: false, message: 'Pedido não está aguardando feedback.' }", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "COMPLETED",
        orderStatus: "DELIVERED",
      }),
    );

    const result = await handleApproval.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Pedido não está aguardando feedback." });
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Unit test: success path — updateOrderState called with correct args, orderStatus updated to DELIVERED, returns { success: true }
  it("success path: calls updateOrderState(AWAITING_FEEDBACK → COMPLETED), updates orderStatus to DELIVERED, returns { success: true }", async () => {
    const result = await handleApproval.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true, message: "Pedido concluído com sucesso!" });
    expect(mockUpdateOrderState).toHaveBeenCalledWith(TEST_ORDER_ID, "AWAITING_FEEDBACK", "COMPLETED");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: TEST_ORDER_ID },
      data: { orderStatus: "DELIVERED" },
    });
  });

  // Unit test: race condition (updateOrderState returns false) returns { success: false }
  it("race condition — updateOrderState returns false: returns { success: false, message: 'Erro de concorrência. Tente novamente.' }", async () => {
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(false));

    const result = await handleApproval.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Erro de concorrência. Tente novamente." });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // Unit test: DB error on findUnique returns { success: false }
  it("DB error on findUnique: returns { success: false, message: 'Erro ao buscar pedido. Tente novamente.' }", async () => {
    mockFindUnique.mockImplementation(() => Promise.reject(new Error("DB connection refused")));

    const result = await handleApproval.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Erro ao buscar pedido. Tente novamente." });
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Unit test: updateOrderState throws (e.g. DB error during updateMany) — returns { success: false }
  it("updateOrderState throws: returns { success: false, message: 'Erro ao atualizar estado do pedido. Tente novamente.' }", async () => {
    mockUpdateOrderState.mockImplementation(() => Promise.reject(new Error("updateMany DB timeout")));

    const result = await handleApproval.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({
      success: false,
      message: "Erro ao atualizar estado do pedido. Tente novamente.",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // Unit test: orderStatus update failure is non-fatal — still returns { success: true }
  it("orderStatus update failure is non-fatal: returns { success: true } when prisma.order.update throws", async () => {
    mockUpdate.mockImplementation(() => Promise.reject(new Error("update failed")));

    const result = await handleApproval.execute({ orderId: TEST_ORDER_ID }, ctx);

    // conversationState was already updated; we don't propagate the error
    expect(result).toMatchObject({ success: true, message: "Pedido concluído com sucesso!" });
    expect(mockUpdateOrderState).toHaveBeenCalledWith(TEST_ORDER_ID, "AWAITING_FEEDBACK", "COMPLETED");
  });
});
