import { mock, beforeEach, describe, it, expect } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
// Use a CUID v1 shaped ID — Prisma uses @default(cuid()), not UUID.
const TEST_ORDER_ID = "ctest00000000000000000001";

const mockPublishJSON = mock(() => Promise.resolve({ messageId: "msg_test_123" }));
const mockPrismaOrderFindUnique = mock(() => Promise.resolve(null));

mock.module("@upstash/qstash", () => ({
  Client: class {
    publishJSON = mockPublishJSON;
  },
}));

mock.module("@mascotinhos/db", () => ({
  default: { order: { findUnique: mockPrismaOrderFindUnique } },
}));

const mockEnv: Record<string, string | undefined> = {
  QSTASH_TOKEN: "test_token",
  VERCEL_URL: "test.vercel.app", // hostname-only, matching real Vercel VERCEL_URL format (no https://)
};

mock.module("@mascotinhos/env/server", () => ({
  env: new Proxy(mockEnv, {
    get(target, prop) {
      return target[prop as string];
    },
  }),
}));

// Static imports AFTER all mock.module() calls
import { enqueueGeneration } from "./enqueue-generation";

// ctx object required by AI SDK tool.execute signature
const ctx = {
  toolCallId: "test",
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
};

function makeGeneratingOrder() {
  return {
    id: TEST_ORDER_ID,
    orderStatus: "GENERATING",
  };
}

describe("enqueueGeneration", () => {
  beforeEach(() => {
    mockPublishJSON.mockClear();
    mockPrismaOrderFindUnique.mockClear();
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.resolve(makeGeneratingOrder()));
    mockEnv.QSTASH_TOKEN = "test_token";
    mockEnv.VERCEL_URL = "test.vercel.app";
  });

  it("happy path: valid orderId + GENERATING order → publishJSON called with correct args → returns { success: true }", async () => {
    const result = await enqueueGeneration.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true });
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);
    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://test.vercel.app/api/generate",
      body: { orderId: TEST_ORDER_ID, action: "generate", attempt: 1 },
      delay: 90,
      retries: 3,
    });
  });

  it("targetUrl uses hostname-only VERCEL_URL with https:// prepended", async () => {
    await enqueueGeneration.execute({ orderId: TEST_ORDER_ID }, ctx);

    const callArg = mockPublishJSON.mock.calls[0][0] as { url: string };
    expect(callArg.url).toBe("https://test.vercel.app/api/generate");
  });

  it("invalid order ID (not a CUID) → returns { success: false }, publishJSON NOT called", async () => {
    const result = await enqueueGeneration.execute({ orderId: "not-a-uuid" }, ctx);

    expect(result).toMatchObject({ success: false });
    expect(mockPublishJSON).not.toHaveBeenCalled();
    expect(mockPrismaOrderFindUnique).not.toHaveBeenCalled();
  });

  it("order not found (DB returns null) → returns { success: false }, publishJSON NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await enqueueGeneration.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false, message: "Pedido não encontrado." });
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("order already DELIVERED → idempotent skip, returns { success: true }, publishJSON NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, orderStatus: "DELIVERED" }),
    );

    const result = await enqueueGeneration.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true });
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("order already CANCELLED → idempotent skip, returns { success: true }, publishJSON NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, orderStatus: "CANCELLED" }),
    );

    const result = await enqueueGeneration.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: true });
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("DB throws → returns { success: false }, publishJSON NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.reject(new Error("DB connection refused")));

    const result = await enqueueGeneration.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false });
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("QStash publishJSON throws → returns { success: false }", async () => {
    mockPublishJSON.mockImplementation(() => Promise.reject(new Error("QStash API error")));

    const result = await enqueueGeneration.execute({ orderId: TEST_ORDER_ID }, ctx);

    expect(result).toMatchObject({ success: false });
  });
});
