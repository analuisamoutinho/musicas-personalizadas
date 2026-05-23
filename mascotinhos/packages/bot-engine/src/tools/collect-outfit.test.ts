import { describe, expect, it, mock, beforeEach } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
// Use a CUID v1 shaped ID — Prisma uses @default(cuid()), not UUID.
const TEST_ORDER_ID = "ctest00000000000000000006";
const UNKNOWN_ORDER_ID = "ctest00000000000000000009";

const mockFindUnique = mock(() =>
  Promise.resolve({ id: TEST_ORDER_ID, conversationState: "COLLECTING_OUTFIT", photosUrls: [] }),
);
const mockOrderUpdate = mock(() => Promise.resolve({ id: TEST_ORDER_ID }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique, update: mockOrderUpdate },
  },
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Mock storage for outfit image upload path
const mockUploadReference = mock(async (_orderId: string, filename: string) =>
  `references/${TEST_ORDER_ID}/${filename}`,
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

const ctx = {
  toolCallId: "test",
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
};

describe("collectOutfit", () => {
  beforeEach(() => {
    mockFindUnique.mockClear();
    mockOrderUpdate.mockClear();
    mockUpdateOrderState.mockClear();
    mockUploadReference.mockClear();

    // Reset defaults
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, conversationState: "COLLECTING_OUTFIT", photosUrls: [] }),
    );
    mockOrderUpdate.mockImplementation(() => Promise.resolve({ id: TEST_ORDER_ID }));
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(true));
    mockUploadReference.mockImplementation(async (_orderId: string, filename: string) =>
      `references/${TEST_ORDER_ID}/${filename}`,
    );
  });

  // Task 3.1.5: phase="outfit" with text
  it("phase=outfit with text: updates outfitDescription, returns success with phase=outfit", async () => {
    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: "Vestido azul com lacinhos",
        outfitImageUrl: null,
        extraRequests: null,
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, phase: "outfit", outfitSaved: true });
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: TEST_ORDER_ID },
      data: { outfitDescription: "Vestido azul com lacinhos" },
    });
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Task 3.1.6: phase="outfit" skip signal
  it("phase=outfit skip signal: does NOT update outfitDescription, returns success", async () => {
    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: "pular",
        outfitImageUrl: null,
        extraRequests: null,
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, phase: "outfit", outfitSaved: false });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Task 3.1.6: phase="outfit" with null outfitDescription (skip)
  it("phase=outfit with null outfitDescription: does NOT update DB, returns success", async () => {
    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: null,
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, phase: "outfit", outfitSaved: false });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  // Task 3.1.7: phase="extras" with text
  it("phase=extras with text: updates extraRequests, transitions state, returns transitioned=true", async () => {
    const result = await collectOutfit.execute(
      {
        phase: "extras",
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: "balão e cachorrinho",
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, phase: "extras", transitioned: true, extrasSaved: true });
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: TEST_ORDER_ID },
      data: { extraRequests: "balão e cachorrinho" },
    });
    expect(mockUpdateOrderState).toHaveBeenCalledWith(
      TEST_ORDER_ID,
      "COLLECTING_OUTFIT",
      "COLLECTING_PHOTOS",
    );
  });

  // Task 3.1.8: phase="extras" skip signal ("nao")
  it("phase=extras skip signal 'nao': does NOT update extraRequests, still transitions state", async () => {
    const result = await collectOutfit.execute(
      {
        phase: "extras",
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: "nao",
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, phase: "extras", transitioned: true, extrasSaved: false });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockUpdateOrderState).toHaveBeenCalledWith(
      TEST_ORDER_ID,
      "COLLECTING_OUTFIT",
      "COLLECTING_PHOTOS",
    );
  });

  // Task 3.1.8: phase="extras" with "não quero"
  it("phase=extras 'não quero': does NOT update extraRequests, still transitions", async () => {
    const result = await collectOutfit.execute(
      {
        phase: "extras",
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: "não quero",
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, extrasSaved: false });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockUpdateOrderState).toHaveBeenCalledTimes(1);
  });

  // Task 3.1.9: order not found
  it("order not found: returns { success: false, message: 'Pedido não encontrado.' }", async () => {
    mockFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: "roupa azul",
        outfitImageUrl: null,
        extraRequests: null,
        orderId: UNKNOWN_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: false, message: "Pedido não encontrado." });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  // Task 3.1.10: state transition failure is non-fatal
  it("state transition failure is non-fatal: updateOrderState throws — tool still returns { success: true }", async () => {
    mockUpdateOrderState.mockImplementation(() =>
      Promise.reject(new Error("Invalid transition")),
    );

    const result = await collectOutfit.execute(
      {
        phase: "extras",
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: "balão",
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, phase: "extras", transitioned: true });
  });

  // Task 3.1.11: input sanitization — text > MAX_OUTFIT_LENGTH is truncated
  it("input sanitization: outfit text > MAX_OUTFIT_LENGTH chars is truncated to 300", async () => {
    const longText = "A".repeat(400);

    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: longText,
        outfitImageUrl: null,
        extraRequests: null,
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, outfitSaved: true });
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: TEST_ORDER_ID },
      data: { outfitDescription: "A".repeat(300) },
    });
  });

  // Task 3.1.11: extras sanitization
  it("input sanitization: extras text > MAX_OUTFIT_LENGTH chars is truncated to 300", async () => {
    const longText = "B".repeat(400);

    const result = await collectOutfit.execute(
      {
        phase: "extras",
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: longText,
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, extrasSaved: true });
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: TEST_ORDER_ID },
      data: { extraRequests: "B".repeat(300) },
    });
  });

  // Task 3.1.12: DB error handling on findUnique
  it("DB error on findUnique: returns { success: false } (no crash)", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.reject(new Error("DB connection refused")),
    );

    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: "roupa azul",
        outfitImageUrl: null,
        extraRequests: null,
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  // Task 3.1.12: DB error on update
  it("DB error on outfit update: returns { success: false } (no crash)", async () => {
    mockOrderUpdate.mockImplementation(() =>
      Promise.reject(new Error("Update failed")),
    );

    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: "vestido rosa",
        outfitImageUrl: null,
        extraRequests: null,
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Task 3.1.12: DB error on extras update
  it("DB error on extras update: returns { success: false } (no crash)", async () => {
    mockOrderUpdate.mockImplementation(() =>
      Promise.reject(new Error("Update failed")),
    );

    const result = await collectOutfit.execute(
      {
        phase: "extras",
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: "balão vermelho",
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Additional: isSkipSignal tests for various OUTFIT_SKIP_SIGNALS
  it("outfit skip signals: 'sem roupa', 'não sei', 'não importa' all skip", async () => {
    for (const signal of ["sem roupa", "não sei", "não importa"]) {
      mockOrderUpdate.mockClear();
      const result = await collectOutfit.execute(
        {
          phase: "outfit",
          outfitDescription: signal,
          outfitImageUrl: null,
          extraRequests: null,
          orderId: TEST_ORDER_ID,
        },
        ctx,
      );
      expect(result).toMatchObject({ success: true, outfitSaved: false });
      expect(mockOrderUpdate).not.toHaveBeenCalled();
    }
  });

  // Additional: extras skip signals
  it("extras skip signals: 'sem extras', 'nada', 'não precisa' all skip", async () => {
    for (const signal of ["sem extras", "nada", "não precisa"]) {
      mockOrderUpdate.mockClear();
      mockUpdateOrderState.mockClear();
      const result = await collectOutfit.execute(
        {
          phase: "extras",
          outfitDescription: null,
          outfitImageUrl: null,
          extraRequests: signal,
          orderId: TEST_ORDER_ID,
        },
        ctx,
      );
      expect(result).toMatchObject({ success: true, extrasSaved: false });
      expect(mockOrderUpdate).not.toHaveBeenCalled();
      expect(mockUpdateOrderState).toHaveBeenCalledTimes(1);
    }
  });

  // Security: invalid orderId format is rejected early (no DB call)
  it("invalid order ID (not a CUID): returns { success: false } without calling DB", async () => {
    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: "vestido azul",
        outfitImageUrl: null,
        extraRequests: null,
        orderId: "not-a-uuid",
      },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  // Security: wrong conversationState is rejected
  it("wrong conversationState: returns { success: false } and does not update DB", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, conversationState: "COLLECTING_PHOTOS" }),
    );

    const result = await collectOutfit.execute(
      {
        phase: "outfit",
        outfitDescription: "vestido azul",
        outfitImageUrl: null,
        extraRequests: null,
        orderId: TEST_ORDER_ID,
      },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
  });

  // Regression: confirm_order_wrong_state loop — message must ask for photo, not review
  it("phase=extras → COLLECTING_PHOTOS: message asks for a photo, not 'revisar' (regression: confirm_order_wrong_state loop)", async () => {
    // Default mock returns photosUrls: [] → nextState=COLLECTING_PHOTOS
    const result = await collectOutfit.execute(
      {
        phase: "extras",
        orderId: TEST_ORDER_ID,
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: "sem extras",
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, transitioned: true });
    expect(result.message).toMatch(/foto/i);
    expect(result.message).not.toMatch(/revisar|resumo|confirma/i);
  });

  // Regression: when photos already uploaded, message should mention reviewing the order
  it("phase=extras → CONFIRMING_ORDER (photos uploaded): message asks to review order", async () => {
    mockFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "COLLECTING_OUTFIT",
        photosUrls: ["https://mmg.whatsapp.net/photo1.jpg"],
      }),
    );

    const result = await collectOutfit.execute(
      {
        phase: "extras",
        orderId: TEST_ORDER_ID,
        outfitDescription: null,
        outfitImageUrl: null,
        extraRequests: "sem extras",
      },
      ctx,
    );

    expect(result).toMatchObject({ success: true, transitioned: true });
    expect(result.message).toMatch(/revisar|pedido/i);
    expect(result.message).not.toMatch(/foto/i);
  });
});
