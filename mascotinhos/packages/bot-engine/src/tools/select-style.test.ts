import { describe, expect, it, mock, beforeEach } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
const mockFindUnique = mock(() =>
  Promise.resolve({ id: "order-1", conversationState: "COLLECTING_THEME" }),
);
const mockOrderUpdate = mock(() => Promise.resolve({ id: "order-1" }));
const mockStyleFindMany = mock(() =>
  Promise.resolve([{ id: "st-1", name: "Disney 3D", slug: "disney-3d" }]),
);
const mockStyleUpdate = mock(() => Promise.resolve({ id: "st-1", popularity: 1 }));

// $transaction mock: executes the array of prisma operations by calling each as a function
// or resolves the array items directly (Prisma interactive transactions use a callback; batch
// transactions use an array of promises — here we intercept and execute each op)
const mockTransaction = mock((ops: Array<Promise<unknown>>) => Promise.all(ops));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique, update: mockOrderUpdate },
    styleTemplate: { findMany: mockStyleFindMany, update: mockStyleUpdate },
    $transaction: mockTransaction,
  },
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Static import AFTER all mock.module() calls — follows collect-photos.test.ts pattern exactly
import { selectStyle } from "./select-style";

describe("selectStyle", () => {
  beforeEach(() => {
    mockFindUnique.mockClear();
    mockOrderUpdate.mockClear();
    mockStyleFindMany.mockClear();
    mockStyleUpdate.mockClear();
    mockTransaction.mockClear();
    mockUpdateOrderState.mockClear();

    // Reset defaults
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: "order-1", conversationState: "COLLECTING_THEME" }),
    );
    mockStyleFindMany.mockImplementation(() =>
      Promise.resolve([{ id: "st-1", name: "Disney 3D", slug: "disney-3d" }]),
    );
    mockOrderUpdate.mockImplementation(() => Promise.resolve({ id: "order-1" }));
    mockStyleUpdate.mockImplementation(() =>
      Promise.resolve({ id: "st-1", popularity: 1 }),
    );
    mockTransaction.mockImplementation((ops: Array<Promise<unknown>>) => Promise.all(ops));
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(true));
  });

  const ctx = {
    toolCallId: "test",
    messages: [],
    abortSignal: undefined as unknown as AbortSignal,
  };

  it("happy path — exact name match: matches template, increments popularity via $transaction, updates order, transitions state, returns success", async () => {
    const result = await selectStyle.execute(
      { styleInput: "Disney 3D", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: true, isCustom: false, selectedStyle: "Disney 3D" });
    // Matched path uses $transaction for atomic write
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockStyleUpdate).toHaveBeenCalledWith({
      where: { id: "st-1" },
      data: { popularity: { increment: 1 } },
    });
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { styleTemplateId: "st-1", theme: "Disney 3D" },
    });
    expect(mockUpdateOrderState).toHaveBeenCalledWith(
      "order-1",
      "COLLECTING_THEME",
      "COLLECTING_OUTFIT",
    );
  });

  it("happy path — slug match (case-insensitive): 'disney-3d' matches slug disney-3d", async () => {
    const result = await selectStyle.execute(
      { styleInput: "disney-3d", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: true, isCustom: false, selectedStyle: "Disney 3D" });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockStyleUpdate).toHaveBeenCalledWith({
      where: { id: "st-1" },
      data: { popularity: { increment: 1 } },
    });
  });

  it("happy path — fuzzy match: 'disney' matches template with name 'Disney 3D'", async () => {
    const result = await selectStyle.execute(
      { styleInput: "disney", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: true, isCustom: false, selectedStyle: "Disney 3D" });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockStyleUpdate).toHaveBeenCalled();
  });

  it("input trimming: leading/trailing whitespace does not prevent match", async () => {
    const result = await selectStyle.execute(
      { styleInput: "  Disney 3D  ", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: true, isCustom: false, selectedStyle: "Disney 3D" });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("input sanitization: input exceeding 200 chars is truncated and stored as custom theme", async () => {
    const longInput = "A".repeat(300);
    const result = await selectStyle.execute(
      { styleInput: longInput, orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: true, isCustom: true });
    // custom path uses order.update directly (not $transaction)
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { theme: "A".repeat(200) },
    });
  });

  it("custom theme path: no match found — order.update called with { theme: styleInput }, styleTemplateId NOT updated, isCustom: true", async () => {
    const result = await selectStyle.execute(
      { styleInput: "Tema Especial Personalizado", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({
      success: true,
      isCustom: true,
      selectedStyle: "Tema Especial Personalizado",
    });
    // custom path uses order.update directly (not $transaction)
    expect(mockTransaction).not.toHaveBeenCalled();
    // order.update called with only theme (no styleTemplateId)
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { theme: "Tema Especial Personalizado" },
    });
    // styleTemplate.update NOT called (no popularity increment for custom themes)
    expect(mockStyleUpdate).not.toHaveBeenCalled();
  });

  it("order not found: returns { success: false, message: 'Pedido não encontrado.' }", async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await selectStyle.execute(
      { styleInput: "Disney 3D", orderId: "nonexistent" },
      ctx,
    );

    expect(result).toMatchObject({ success: false, message: "Pedido não encontrado." });
    expect(mockStyleFindMany).not.toHaveBeenCalled();
    expect(mockStyleUpdate).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("DB error on findUnique: returns { success: false } with error message", async () => {
    mockFindUnique.mockImplementation(() => Promise.reject(new Error("DB connection refused")));

    const result = await selectStyle.execute(
      { styleInput: "Disney 3D", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect(mockStyleFindMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("DB error on order/styleTemplate update: returns { success: false } with error message", async () => {
    mockTransaction.mockImplementation(() => Promise.reject(new Error("Transaction failed")));

    const result = await selectStyle.execute(
      { styleInput: "Disney 3D", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    // State transition must NOT be attempted if DB write failed
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  it("state transition failure is non-fatal: updateOrderState throws — tool still returns { success: true }", async () => {
    mockUpdateOrderState.mockImplementation(() =>
      Promise.reject(new Error("Invalid transition")),
    );

    const result = await selectStyle.execute(
      { styleInput: "Disney 3D", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: true });
  });

  it("popularity increment uses { increment: 1 } pattern (not read-then-write)", async () => {
    await selectStyle.execute({ styleInput: "Disney 3D", orderId: "order-1" }, ctx);

    // Verify atomic increment pattern — data must use { increment: 1 }, not a plain number
    expect(mockStyleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ popularity: { increment: 1 } }),
      }),
    );
    // findUnique for styleTemplate must NOT have been called (no read-then-write)
    // Only order.findUnique is called, not styleTemplate.findUnique
    const findUniqueCalls = mockFindUnique.mock.calls;
    expect(findUniqueCalls.every((call) => (call[0] as { where: { id?: string } })?.where?.id === "order-1")).toBe(true);
  });

  it("fuzzy match guard: template name shorter than MIN_FUZZY_MATCH_LENGTH does not match via fuzzy path", async () => {
    // Template with a very short name (2 chars) should NOT trigger fuzzy match for unrelated inputs
    mockStyleFindMany.mockImplementation(() =>
      Promise.resolve([{ id: "st-short", name: "3D", slug: "3d" }]),
    );

    const result = await selectStyle.execute(
      { styleInput: "Tema totalmente diferente", orderId: "order-1" },
      ctx,
    );

    // "3D" is 2 chars (< MIN_FUZZY_MATCH_LENGTH=3), should NOT fuzzy-match
    expect(result).toMatchObject({ success: true, isCustom: true });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
