import { mock, beforeEach, describe, it, expect } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
// Use a CUID v1 shaped ID — Prisma uses @default(cuid()), not UUID.
const TEST_ORDER_ID = "ctest00000000000000000003";

const mockPublishJSON = mock(() => Promise.resolve({ messageId: "msg_revision_test" }));
const mockPrismaOrderFindUnique = mock(() => Promise.resolve(null));
const mockPrismaGenerationUpdateMany = mock(() => Promise.resolve({ count: 1 }));
const mockPrismaGenerationFindFirst = mock(() => Promise.resolve({ attemptNumber: 1 }));

mock.module("@upstash/qstash", () => ({
  Client: class {
    publishJSON = mockPublishJSON;
  },
}));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockPrismaOrderFindUnique },
    generation: {
      updateMany: mockPrismaGenerationUpdateMany,
      findFirst: mockPrismaGenerationFindFirst,
    },
  },
}));

const mockEnv: Record<string, string | undefined> = {
  QSTASH_TOKEN: "test_token",
  VERCEL_URL: "test.vercel.app",
};

mock.module("@mascotinhos/env/server", () => ({
  env: new Proxy(mockEnv, {
    get(target, prop) {
      return target[prop as string];
    },
  }),
}));

const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

// Static imports AFTER all mock.module() calls
import { handleRevision } from "./handle-revision";

// ctx object required by AI SDK tool.execute signature
const ctx = {
  toolCallId: "test",
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
};

/** Returns a default AWAITING_FEEDBACK order (the only valid entry state for revisions). */
function makeAwaitingFeedbackOrder() {
  return { id: TEST_ORDER_ID, conversationState: "AWAITING_FEEDBACK" };
}

describe("handleRevision", () => {
  beforeEach(() => {
    mockPublishJSON.mockClear();
    mockPrismaOrderFindUnique.mockClear();
    mockPrismaGenerationUpdateMany.mockClear();
    mockPrismaGenerationFindFirst.mockClear();
    mockUpdateOrderState.mockClear();
    // Default: order in AWAITING_FEEDBACK, first generation done (attemptNumber=1)
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve(makeAwaitingFeedbackOrder()),
    );
    mockPrismaGenerationFindFirst.mockImplementation(() =>
      Promise.resolve({ attemptNumber: 1 }),
    );
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(true));
    mockPrismaGenerationUpdateMany.mockImplementation(() => Promise.resolve({ count: 1 }));
    mockPublishJSON.mockImplementation(() => Promise.resolve({ messageId: "msg_revision_test" }));
    mockEnv.QSTASH_TOKEN = "test_token";
    mockEnv.VERCEL_URL = "test.vercel.app";
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("invalid UUID orderId → { success: false }, no DB calls", async () => {
    const result = await handleRevision.execute(
      { orderId: "not-a-uuid", feedback: "make eyes darker" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect(mockPrismaOrderFindUnique).not.toHaveBeenCalled();
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("empty feedback string → { success: false, message: 'Feedback de revisão não pode ser vazio.' }, no DB calls", async () => {
    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "   " },
      ctx,
    );

    expect(result).toMatchObject({
      success: false,
      message: "Feedback de revisão não pode ser vazio.",
    });
    expect(mockPrismaOrderFindUnique).not.toHaveBeenCalled();
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  // ── Order lookup ──────────────────────────────────────────────────────────

  it("order not found → { success: false, message: 'Pedido não encontrado.' }", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.resolve(null));

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "make eyes darker" },
      ctx,
    );

    expect(result).toMatchObject({ success: false, message: "Pedido não encontrado." });
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("DB findUnique throws → { success: false, message: 'Erro ao buscar pedido...' }", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.reject(new Error("DB connection refused")),
    );

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("buscar pedido");
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  // ── State guard ───────────────────────────────────────────────────────────

  it("wrong state (COMPLETED) → { success: false, message containing 'aguardando feedback' }", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, conversationState: "COMPLETED" }),
    );

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "make eyes darker" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("aguardando feedback");
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("wrong state (GENERATING) → { success: false } — revision not allowed mid-generation", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, conversationState: "GENERATING" }),
    );

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "change the background" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  // ── Revision cap enforcement (FR-30) ──────────────────────────────────────

  it("revision cap exceeded (maxAttemptNumber=3) → { success: false } with cap message, no transition", async () => {
    // 3 attempts already done = both revisions used up
    mockPrismaGenerationFindFirst.mockImplementation(() =>
      Promise.resolve({ attemptNumber: 3 }),
    );

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "mais uma vez" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("revisões disponíveis");
    expect(mockUpdateOrderState).not.toHaveBeenCalled();
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("generation.findFirst throws → { success: false, message: 'Erro ao buscar pedido...' }", async () => {
    mockPrismaGenerationFindFirst.mockImplementation(() =>
      Promise.reject(new Error("DB timeout on generation query")),
    );

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("buscar pedido");
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  // ── First revision happy path (AWAITING_FEEDBACK, attemptNumber=1) ────────

  it("first revision: two-step transition AWAITING_FEEDBACK→REVISION_1→GENERATING, publishJSON attempt=2", async () => {
    // Default: attemptNumber=1 (first generation done)
    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: true });
    // Two calls: claim slot, then start generation
    expect(mockUpdateOrderState).toHaveBeenCalledTimes(2);
    expect(mockUpdateOrderState).toHaveBeenNthCalledWith(
      1,
      TEST_ORDER_ID,
      "AWAITING_FEEDBACK",
      "REVISION_1",
    );
    expect(mockUpdateOrderState).toHaveBeenNthCalledWith(
      2,
      TEST_ORDER_ID,
      "REVISION_1",
      "GENERATING",
    );
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);
    expect(mockPublishJSON).toHaveBeenCalledWith({
      url: "https://test.vercel.app/api/generate",
      body: { orderId: TEST_ORDER_ID, action: "generate", attempt: 2 },
      delay: 90,
      retries: 3,
    });
  });

  it("first revision: targetUrl uses hostname-only VERCEL_URL with https:// prepended", async () => {
    await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    const callArg = mockPublishJSON.mock.calls[0][0] as { url: string };
    expect(callArg.url).toBe("https://test.vercel.app/api/generate");
  });

  it("first revision: updateMany stores feedback on attemptNumber=1 (nextAttempt-1)", async () => {
    await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(mockPrismaGenerationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: TEST_ORDER_ID, attemptNumber: 1 },
      }),
    );
  });

  // ── Second revision happy path (AWAITING_FEEDBACK, attemptNumber=2) ───────

  it("second revision: two-step transition AWAITING_FEEDBACK→REVISION_2→GENERATING, publishJSON attempt=3", async () => {
    // Second generation done (first revision already processed)
    mockPrismaGenerationFindFirst.mockImplementation(() =>
      Promise.resolve({ attemptNumber: 2 }),
    );

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "adiciona um balao" },
      ctx,
    );

    expect(result).toMatchObject({ success: true });
    expect(mockUpdateOrderState).toHaveBeenCalledTimes(2);
    expect(mockUpdateOrderState).toHaveBeenNthCalledWith(
      1,
      TEST_ORDER_ID,
      "AWAITING_FEEDBACK",
      "REVISION_2",
    );
    expect(mockUpdateOrderState).toHaveBeenNthCalledWith(
      2,
      TEST_ORDER_ID,
      "REVISION_2",
      "GENERATING",
    );
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { orderId: TEST_ORDER_ID, action: "generate", attempt: 3 },
      }),
    );
  });

  it("second revision: updateMany stores feedback on attemptNumber=2 (nextAttempt-1)", async () => {
    mockPrismaGenerationFindFirst.mockImplementation(() =>
      Promise.resolve({ attemptNumber: 2 }),
    );

    await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "adiciona um balao" },
      ctx,
    );

    expect(mockPrismaGenerationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: TEST_ORDER_ID, attemptNumber: 2 },
      }),
    );
  });

  // ── Concurrency / error paths ─────────────────────────────────────────────

  it("first transition returns false (race condition) → { success: false, message: 'Erro de concorrência...' }, no QStash", async () => {
    mockUpdateOrderState.mockImplementation(() => Promise.resolve(false));

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("concorrência");
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("second transition returns false (race condition) → { success: false, message: 'Erro de concorrência...' }, no QStash", async () => {
    let callCount = 0;
    mockUpdateOrderState.mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? true : false); // first succeeds, second fails
    });

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("concorrência");
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("first transition throws → { success: false, message: 'Erro ao iniciar revisão...' }, no QStash", async () => {
    mockUpdateOrderState.mockImplementation(() =>
      Promise.reject(new Error("DB connection refused")),
    );

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("iniciar revisão");
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("second transition throws → { success: false, message: 'Erro ao iniciar revisão...' }, no QStash", async () => {
    let callCount = 0;
    mockUpdateOrderState.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(true);
      return Promise.reject(new Error("DB connection refused on second transition"));
    });

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("iniciar revisão");
    expect(mockPublishJSON).not.toHaveBeenCalled();
  });

  it("QStash publishJSON throws → { success: false, message: 'Erro ao enfileirar revisão...' }", async () => {
    mockPublishJSON.mockImplementation(() => Promise.reject(new Error("QStash API error")));

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("enfileirar revisão");
  });

  it("generation.updateMany throws → non-fatal: both transitions and QStash still called, returns { success: true }", async () => {
    mockPrismaGenerationUpdateMany.mockImplementation(() =>
      Promise.reject(new Error("DB error on generation update")),
    );

    const result = await handleRevision.execute(
      { orderId: TEST_ORDER_ID, feedback: "olhos mais escuros" },
      ctx,
    );

    expect(result).toMatchObject({ success: true });
    expect(mockUpdateOrderState).toHaveBeenCalledTimes(2);
    expect(mockPublishJSON).toHaveBeenCalledTimes(1);
  });
});
