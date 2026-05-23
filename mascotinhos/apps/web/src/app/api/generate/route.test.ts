import { mock, beforeEach, describe, it, expect } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
// Use cuid-format order ID (matching Order.id cuid() schema) — NOT UUID format.
// Task 3.5 fix: qstashBodySchema now validates z.string().cuid(), so UUID-format IDs are rejected.
const TEST_ORDER_ID = "clh1234567890abcdefghijk0";

const mockReceiverVerify = mock(() => Promise.resolve(true));

mock.module("@upstash/qstash", () => ({
  Receiver: class {
    verify = mockReceiverVerify;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaOrderFindUnique = mock((): any => Promise.resolve(null));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaOrderUpdate = mock((): any => Promise.resolve({}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaOrderUpdateMany = mock((): any => Promise.resolve({ count: 1 }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaGenerationFindUnique = mock((): any => Promise.resolve(null));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaGenerationUpdate = mock((): any => Promise.resolve({}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaGenerationUpsert = mock((): any => Promise.resolve({}));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockPrismaOrderFindUnique, update: mockPrismaOrderUpdate, updateMany: mockPrismaOrderUpdateMany },
    generation: { findUnique: mockPrismaGenerationFindUnique, update: mockPrismaGenerationUpdate, upsert: mockPrismaGenerationUpsert },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEnrichPrompt = mock((): any =>
  Promise.resolve({ success: true, generationId: "gen-uuid-1", promptUsed: "enriched prompt", message: "ok" })
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGenerate = mock((): any =>
  Promise.resolve({ success: true, imageBase64: "base64data", message: "ok" })
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockQualityCheck = mock((): any =>
  Promise.resolve({ success: true, score: 0.85, reasoning: "Good likeness", passed: true, message: "Quality check passed." })
);
mock.module("@mascotinhos/image-gen", () => ({
  enrichPrompt: mockEnrichPrompt,
  generate: mockGenerate,
  qualityCheck: mockQualityCheck,
  MAX_QUALITY_RETRIES: 2,
}));

const mockUploadGenerated = mock(() => Promise.resolve("generated/test-order-id/1.png"));

mock.module("@mascotinhos/storage", () => ({
  uploadGenerated: mockUploadGenerated,
}));

mock.module("@mascotinhos/env/server", () => ({
  env: new Proxy(
    {
      QSTASH_CURRENT_SIGNING_KEY: "sig_current",
      QSTASH_NEXT_SIGNING_KEY: "sig_next",
    },
    {
      get(target, prop) {
        return target[prop as keyof typeof target];
      },
    },
  ),
}));

// Story 4.6: mock deliverImageToClient from @mascotinhos/bot-engine
const mockDeliverImageToClient = mock(() =>
  Promise.resolve({ success: true, message: "ok" })
);

// Story 5.4: mock abandoned cart message senders
const mockSendAbandonedNudgeMessage = mock(() => Promise.resolve());
const mockSendAbandonedClosureMessage = mock(() => Promise.resolve());

// Story 7.1: mock notifyOperator
const mockNotifyOperator = mock(() => Promise.resolve());

// Story 7.2: mock sendGenerationFailureMessage
const mockSendGenerationFailureMessage = mock(() => Promise.resolve());

mock.module("@mascotinhos/bot-engine", () => ({
  deliverImageToClient: mockDeliverImageToClient,
  sendAbandonedNudgeMessage: mockSendAbandonedNudgeMessage,
  sendAbandonedClosureMessage: mockSendAbandonedClosureMessage,
  notifyOperator: mockNotifyOperator,
  sendGenerationFailureMessage: mockSendGenerationFailureMessage,
}));

// Static imports AFTER all mock.module() calls
import { GET, POST } from "./route";

function makeRequest(body: object, signature = "valid-sig"): Request {
  return new Request("https://example.com/api/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "upstash-signature": signature,
    },
    body: JSON.stringify(body),
  });
}

function makeGeneratingOrder() {
  return {
    id: TEST_ORDER_ID,
    orderStatus: "GENERATING",
    conversationState: "GENERATING",
    photosUrls: ["references/ord/photo.jpg"],
    client: { whatsappSenderId: "5511999999999", name: "Ana" },
  };
}

describe("GET /api/generate", () => {
  it("returns 405 Method Not Allowed", async () => {
    const response = GET();
    expect(response.status).toBe(405);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Method Not Allowed" });
  });
});

describe("POST /api/generate", () => {
  beforeEach(() => {
    mockReceiverVerify.mockClear();
    mockPrismaOrderFindUnique.mockClear();
    mockPrismaOrderUpdate.mockClear();
    mockPrismaOrderUpdateMany.mockClear();
    mockPrismaGenerationFindUnique.mockClear();
    mockPrismaGenerationUpdate.mockClear();
    mockPrismaGenerationUpsert.mockClear();
    mockEnrichPrompt.mockClear();
    mockGenerate.mockClear();
    mockQualityCheck.mockClear();
    mockUploadGenerated.mockClear();
    mockDeliverImageToClient.mockClear();
    mockSendAbandonedNudgeMessage.mockClear();
    mockSendAbandonedClosureMessage.mockClear();
    mockNotifyOperator.mockClear();
    mockSendGenerationFailureMessage.mockClear();
    mockPrismaGenerationUpsert.mockImplementation(() => Promise.resolve({}));
    mockPrismaOrderUpdateMany.mockImplementation(() => Promise.resolve({ count: 1 }));
    mockReceiverVerify.mockImplementation(() => Promise.resolve(true));
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.resolve(makeGeneratingOrder()));
    mockPrismaOrderUpdate.mockImplementation(() => Promise.resolve({}));
    mockPrismaGenerationFindUnique.mockImplementation(() => Promise.resolve(null));
    mockPrismaGenerationUpdate.mockImplementation(() => Promise.resolve({}));
    mockEnrichPrompt.mockImplementation(() =>
      Promise.resolve({ success: true, generationId: "gen-uuid-1", promptUsed: "enriched prompt", message: "ok" })
    );
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: true, imageBase64: "base64data", message: "ok" })
    );
    mockQualityCheck.mockImplementation(() =>
      Promise.resolve({ success: true, score: 0.85, reasoning: "Good likeness", passed: true, message: "Quality check passed." })
    );
    mockUploadGenerated.mockImplementation(() => Promise.resolve("generated/test-order-id/1.png"));
    mockDeliverImageToClient.mockImplementation(() =>
      Promise.resolve({ success: true, message: "ok" })
    );
  });

  it("valid signature + generate action + GENERATING order → 200 { status: 'ok' }", async () => {
    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
  });

  it("invalid signature → 401 Unauthorized", async () => {
    mockReceiverVerify.mockImplementation(() => Promise.resolve(false));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 }, "invalid-sig");
    const response = await POST(req as any);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Unauthorized" });
  });

  it("signature verification throws → 401 Unauthorized", async () => {
    mockReceiverVerify.mockImplementation(() => Promise.reject(new Error("signature error")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Unauthorized" });
  });

  it("invalid body (missing orderId) → 400 Invalid payload", async () => {
    const req = makeRequest({ action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Invalid payload" });
  });

  it("action: nudge_abandoned with AWAITING_PAYMENT order → calls sendAbandonedNudgeMessage and returns 200", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "AWAITING_PAYMENT",
        orderStatus: "PENDING",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "nudge_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockSendAbandonedNudgeMessage).toHaveBeenCalledTimes(1);
    expect(mockSendAbandonedNudgeMessage).toHaveBeenCalledWith(
      TEST_ORDER_ID,
      "5511999999999",
      "Ana",
    );
  });

  it("order orderStatus DELIVERED → 200 idempotent skip, no further processing", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, orderStatus: "DELIVERED", conversationState: "GENERATING" }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
  });

  it("order orderStatus CANCELLED → 200 idempotent skip", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({ id: TEST_ORDER_ID, orderStatus: "CANCELLED", conversationState: "GENERATING" }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
  });

  // Story 7.2 review patch: idempotency guard must cover conversationState=FAILED to prevent
  // double notifications when QStash retries after markOrderFailed set state but DB orderStatus
  // update was incomplete (e.g. DB flap where conversationState committed but orderStatus did not).
  it("order conversationState FAILED (any orderStatus) → 200 idempotent skip, no markOrderFailed", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        orderStatus: "GENERATING", // orderStatus NOT yet CANCELLED — simulates partial DB commit
        conversationState: "FAILED",
        photosUrls: ["references/ord/photo.jpg"],
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    // Must not call markOrderFailed side-effects
    expect(mockPrismaOrderUpdate).not.toHaveBeenCalled();
    expect(mockNotifyOperator).not.toHaveBeenCalled();
    expect(mockSendGenerationFailureMessage).not.toHaveBeenCalled();
  });

  it("order not found → 404", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.resolve(null));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Order not found" });
  });

  it("DB throws on findUnique → 500 (triggers QStash retry)", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.reject(new Error("DB connection refused")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Internal Server Error" });
  });

  it("enrichPrompt returns success → 200 { status: 'ok' }", async () => {
    mockEnrichPrompt.mockImplementation(() =>
      Promise.resolve({ success: true, generationId: "gen-uuid-1", promptUsed: "enriched prompt", message: "ok" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockEnrichPrompt).toHaveBeenCalledTimes(1);
  });

  it("enrichPrompt returns failure → 500 (triggers QStash retry)", async () => {
    mockEnrichPrompt.mockImplementation(() =>
      Promise.resolve({ success: false, message: "Erro ao enriquecer prompt de geração." })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Prompt enrichment failed" });
  });

  it("enrichPrompt throws unexpectedly → 500 (triggers QStash retry)", async () => {
    mockEnrichPrompt.mockImplementation(() => Promise.reject(new Error("Unexpected crash")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Prompt enrichment failed" });
  });

  it("attempt=2 fetches revisionFeedback from previous generation and passes to enrichPrompt", async () => {
    mockPrismaGenerationFindUnique.mockImplementation(() =>
      Promise.resolve({ revisionFeedback: "Make the cape blue" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 2 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    expect(mockPrismaGenerationFindUnique).toHaveBeenCalledTimes(1);
    expect(mockEnrichPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNumber: 2, revisionFeedback: "Make the cape blue" })
    );
  });

  it("attempt=2 with revisionFeedback DB failure still calls enrichPrompt with null feedback", async () => {
    mockPrismaGenerationFindUnique.mockImplementation(() => Promise.reject(new Error("DB timeout")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 2 });
    const response = await POST(req as any);

    // Non-fatal: should still succeed
    expect(response.status).toBe(200);
    expect(mockEnrichPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNumber: 2, revisionFeedback: null })
    );
  });

  // Story 4.3: generate() integration
  it("generate returns success → 200 { status: 'ok' }", async () => {
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: true, imageBase64: "base64data", message: "ok" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-uuid-1",
        promptUsed: "enriched prompt",
        orderId: TEST_ORDER_ID,
        photosUrls: ["references/ord/photo.jpg"],
      })
    );
  });

  it("generate returns { success: false } → 500 (QStash retry)", async () => {
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: false, message: "Erro ao gerar imagem." })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Image generation failed" });
  });

  it("generate throws unexpectedly → 500 (QStash retry)", async () => {
    mockGenerate.mockImplementation(() => Promise.reject(new Error("Unexpected crash in generate")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Image generation failed" });
  });

  // Story 4.4: qualityCheck() integration
  it("qualityCheck called with correct args after generate succeeds", async () => {
    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    expect(mockQualityCheck).toHaveBeenCalledTimes(1);
    expect(mockQualityCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-uuid-1",
        imageBase64: "base64data",
        photosUrls: ["references/ord/photo.jpg"],
        promptUsed: "enriched prompt",
        orderId: TEST_ORDER_ID,
      })
    );
  });

  it("qualityCheck passes → 200 { status: 'ok' }", async () => {
    mockQualityCheck.mockImplementation(() =>
      Promise.resolve({ success: true, score: 0.9, reasoning: "Great match", passed: true, message: "Quality check passed." })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
  });

  it("qualityCheck fails (below threshold) + attempt <= MAX_QUALITY_RETRIES → 500 (triggers QStash retry)", async () => {
    mockQualityCheck.mockImplementation(() =>
      Promise.resolve({ success: true, score: 0.4, reasoning: "Poor likeness", passed: false, message: "Quality check failed" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Quality check failed — retrying" });
  });

  it("qualityCheck fails (below threshold) + attempt > MAX_QUALITY_RETRIES → 200 (proceed anyway, deliver best available)", async () => {
    mockQualityCheck.mockImplementation(() =>
      Promise.resolve({ success: true, score: 0.4, reasoning: "Poor likeness", passed: false, message: "Quality check failed" })
    );

    // attempt=3 > MAX_QUALITY_RETRIES(2) → should proceed
    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 3 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
  });

  it("qualityCheck fails open (AI unavailable) → 200 (continue pipeline)", async () => {
    mockQualityCheck.mockImplementation(() =>
      Promise.resolve({ success: false, passed: true, message: "Quality check unavailable — failing open" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
  });

  it("qualityCheck is not called when generate fails", async () => {
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: false, message: "Erro ao gerar imagem." })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    await POST(req as any);

    expect(mockQualityCheck).not.toHaveBeenCalled();
  });

  // Story 4.5: uploadGenerated() integration
  it("uploadGenerated called with correct args after quality check passes", async () => {
    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockUploadGenerated).toHaveBeenCalledTimes(1);
    expect(mockUploadGenerated).toHaveBeenCalledWith(
      TEST_ORDER_ID,
      1,
      expect.any(Buffer),
    );
  });

  it("uploadGenerated success → Generation.imageUrl updated in DB", async () => {
    mockUploadGenerated.mockImplementation(() => Promise.resolve("generated/test-order-id/1.png"));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    expect(mockPrismaGenerationUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaGenerationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "gen-uuid-1" },
        data: { imageUrl: "generated/test-order-id/1.png" },
      })
    );
  });

  it("uploadGenerated fails once → retries → succeeds on 2nd attempt → 200", async () => {
    let callCount = 0;
    mockUploadGenerated.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("Transient network error"));
      return Promise.resolve("generated/test-order-id/1.png");
    });

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockUploadGenerated).toHaveBeenCalledTimes(2);
  });

  it("uploadGenerated fails all retries → 500 and order marked FAILED/CANCELLED via markOrderFailed", async () => {
    mockUploadGenerated.mockImplementation(() => Promise.reject(new Error("Supabase upload error")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Storage upload failed after retries" });
    // Story 7.2: markOrderFailed sets both conversationState=FAILED and orderStatus=CANCELLED
    expect(mockPrismaOrderUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_ORDER_ID },
        data: { conversationState: "FAILED", orderStatus: "CANCELLED" },
      })
    );
    // Generation upsert stores error code
    expect(mockPrismaGenerationUpsert).toHaveBeenCalledTimes(1);
    expect(mockPrismaGenerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { revisionFeedback: "UPLOAD_FAILED" },
      })
    );
    // Operator notified
    expect(mockNotifyOperator).toHaveBeenCalledTimes(1);
    expect(mockNotifyOperator).toHaveBeenCalledWith(TEST_ORDER_ID, "ERROR", "Generation failed after all retries");
    // Client messaged
    expect(mockSendGenerationFailureMessage).toHaveBeenCalledTimes(1);
    expect(mockSendGenerationFailureMessage).toHaveBeenCalledWith(TEST_ORDER_ID, "5511999999999");
  });

  it("uploadGenerated not called when quality check triggers retry (attempt <= MAX_QUALITY_RETRIES)", async () => {
    mockQualityCheck.mockImplementation(() =>
      Promise.resolve({ success: true, score: 0.4, reasoning: "Poor likeness", passed: false, message: "Quality check failed" })
    );

    // attempt=1 <= MAX_QUALITY_RETRIES(2) → should return 500 for retry, NOT call upload
    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    expect(mockUploadGenerated).not.toHaveBeenCalled();
  });

  // Story 4.5 review patches
  it("upload succeeds but Generation DB update fails → 500 and markOrderFailed called (upload not retried)", async () => {
    // uploadGenerated succeeds on first call
    mockUploadGenerated.mockImplementation(() => Promise.resolve("generated/test-order-id/1.png"));
    // DB update for imageUrl throws
    mockPrismaGenerationUpdate.mockImplementation(() => Promise.reject(new Error("DB connection lost")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Storage upload failed after retries" });
    // uploadGenerated must only be called once — DB failure must NOT re-trigger the upload
    expect(mockUploadGenerated).toHaveBeenCalledTimes(1);
    // Story 7.2: markOrderFailed sets conversationState=FAILED + orderStatus=CANCELLED
    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_ORDER_ID },
        data: { conversationState: "FAILED", orderStatus: "CANCELLED" },
      })
    );
  });

  it("generate returns success=true with missing imageBase64 → 500 without calling upload", async () => {
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: true, imageBase64: undefined, message: "ok" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    expect(mockUploadGenerated).not.toHaveBeenCalled();
  });

  // Story 7.2 AC-7: missing imageBase64 on final attempt must also trigger markOrderFailed
  it("generate success=true with missing imageBase64 on attempt=3 → 500 + markOrderFailed called with GENERATION_FAILED", async () => {
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: true, imageBase64: undefined, message: "ok" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 3 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Image generation returned no data" });
    expect(mockUploadGenerated).not.toHaveBeenCalled();
    // AC-7: markOrderFailed must fire on final attempt
    expect(mockPrismaOrderUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_ORDER_ID },
        data: { conversationState: "FAILED", orderStatus: "CANCELLED" },
      })
    );
    expect(mockPrismaGenerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { revisionFeedback: "GENERATION_FAILED" },
      })
    );
    expect(mockNotifyOperator).toHaveBeenCalledWith(TEST_ORDER_ID, "ERROR", "Generation failed after all retries");
    expect(mockSendGenerationFailureMessage).toHaveBeenCalledWith(TEST_ORDER_ID, "5511999999999");
  });

  // Story 4.6: deliverImageToClient integration
  it("full pipeline success → deliverImageToClient called with correct args → 200 { status: 'ok' }", async () => {
    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockDeliverImageToClient).toHaveBeenCalledTimes(1);
    expect(mockDeliverImageToClient).toHaveBeenCalledWith({
      orderId: TEST_ORDER_ID,
      imageUrl: "generated/test-order-id/1.png",
      recipientPhone: "5511999999999",
      clientName: "Ana",
    });
  });

  it("deliverImageToClient returns { success: false } → route returns 500", async () => {
    mockDeliverImageToClient.mockImplementation(() =>
      Promise.resolve({ success: false, message: "Failed to send image photo." })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Delivery failed" });
  });

  it("deliverImageToClient not called when upload fails", async () => {
    mockUploadGenerated.mockImplementation(() => Promise.reject(new Error("Supabase upload error")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    expect(mockDeliverImageToClient).not.toHaveBeenCalled();
  });

  // Review patch F2: null client guard
  it("order.client.whatsappSenderId is null → 500 without calling deliverImageToClient", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        orderStatus: "GENERATING",
        conversationState: "GENERATING",
        photosUrls: ["references/ord/photo.jpg"],
        client: { whatsappSenderId: null, name: "Ana" },
      })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain("client phone");
    expect(mockDeliverImageToClient).not.toHaveBeenCalled();
  });

  it("order.client is null → 500 without calling deliverImageToClient", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        orderStatus: "GENERATING",
        conversationState: "GENERATING",
        photosUrls: ["references/ord/photo.jpg"],
        client: null,
      })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain("client phone");
    expect(mockDeliverImageToClient).not.toHaveBeenCalled();
  });

  // Story 5.4: abandoned cart handler tests
  it("nudge_abandoned with ABANDONED_1H order → skipped (idempotent), sendAbandonedNudgeMessage NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "ABANDONED_1H",
        orderStatus: "PENDING",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "nudge_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockSendAbandonedNudgeMessage).not.toHaveBeenCalled();
  });

  it("nudge_abandoned with orderStatus PAID → skipped, sendAbandonedNudgeMessage NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "AWAITING_PAYMENT",
        orderStatus: "PAID",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "nudge_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    expect(mockSendAbandonedNudgeMessage).not.toHaveBeenCalled();
  });

  it("close_abandoned with ABANDONED_1H order → calls sendAbandonedClosureMessage and returns 200", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "ABANDONED_1H",
        orderStatus: "PENDING",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "close_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockSendAbandonedClosureMessage).toHaveBeenCalledTimes(1);
    expect(mockSendAbandonedClosureMessage).toHaveBeenCalledWith(
      TEST_ORDER_ID,
      "5511999999999",
    );
  });

  it("close_abandoned with orderStatus PAID → skipped, sendAbandonedClosureMessage NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "ABANDONED_1H",
        orderStatus: "PAID",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "close_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    expect(mockSendAbandonedClosureMessage).not.toHaveBeenCalled();
  });

  it("close_abandoned with ABANDONED_24H order → skipped (idempotent), sendAbandonedClosureMessage NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "ABANDONED_24H",
        orderStatus: "PENDING",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "close_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    expect(mockSendAbandonedClosureMessage).not.toHaveBeenCalled();
  });

  it("nudge_abandoned DB error → 500 (triggers QStash retry)", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.reject(new Error("DB connection refused")),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "nudge_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Internal Server Error" });
    expect(mockSendAbandonedNudgeMessage).not.toHaveBeenCalled();
  });

  it("close_abandoned order not found → 404", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.resolve(null));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "close_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Order not found" });
    expect(mockSendAbandonedClosureMessage).not.toHaveBeenCalled();
  });

  it("nudge_abandoned with no client phone → skipped gracefully, returns 200", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "AWAITING_PAYMENT",
        orderStatus: "PENDING",
        client: { whatsappSenderId: null, name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "nudge_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    expect(mockSendAbandonedNudgeMessage).not.toHaveBeenCalled();
  });

  // Review patches: pre-payment state skip + DB error on updateMany

  it("nudge_abandoned with COLLECTING_PHOTOS order → skipped (pre-payment regression), sendAbandonedNudgeMessage NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "COLLECTING_PHOTOS",
        orderStatus: "PENDING",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "nudge_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(mockSendAbandonedNudgeMessage).not.toHaveBeenCalled();
  });

  it("nudge_abandoned updateMany DB error → 500 (triggers QStash retry), sendAbandonedNudgeMessage NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "AWAITING_PAYMENT",
        orderStatus: "PENDING",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );
    mockPrismaOrderUpdateMany.mockImplementation(() => Promise.reject(new Error("DB deadlock")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "nudge_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Internal Server Error" });
    expect(mockSendAbandonedNudgeMessage).not.toHaveBeenCalled();
  });

  it("close_abandoned updateMany DB error → 500 (triggers QStash retry), sendAbandonedClosureMessage NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        conversationState: "ABANDONED_1H",
        orderStatus: "PENDING",
        client: { whatsappSenderId: "5511999999999", name: "Ana" },
      }),
    );
    mockPrismaOrderUpdateMany.mockImplementation(() => Promise.reject(new Error("DB deadlock")));

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "close_abandoned" });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({ error: "Internal Server Error" });
    expect(mockSendAbandonedClosureMessage).not.toHaveBeenCalled();
  });

  // Story 7.2: markOrderFailed — final attempt detection
  it("generate failure on attempt=1 (< QSTASH_MAX=3) → 500 for QStash retry, markOrderFailed NOT called", async () => {
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: false, message: "OpenAI error" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    expect(mockPrismaOrderUpdate).not.toHaveBeenCalled();
    expect(mockPrismaGenerationUpsert).not.toHaveBeenCalled();
    expect(mockNotifyOperator).not.toHaveBeenCalled();
    expect(mockSendGenerationFailureMessage).not.toHaveBeenCalled();
  });

  it("generate failure on attempt=3 (>= QSTASH_MAX=3) → 500 + markOrderFailed called with GENERATION_FAILED", async () => {
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: false, message: "OpenAI error" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 3 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    expect(mockPrismaOrderUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_ORDER_ID },
        data: { conversationState: "FAILED", orderStatus: "CANCELLED" },
      })
    );
    expect(mockPrismaGenerationUpsert).toHaveBeenCalledTimes(1);
    expect(mockPrismaGenerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { revisionFeedback: "GENERATION_FAILED" },
      })
    );
    expect(mockNotifyOperator).toHaveBeenCalledWith(TEST_ORDER_ID, "ERROR", "Generation failed after all retries");
    expect(mockSendGenerationFailureMessage).toHaveBeenCalledWith(TEST_ORDER_ID, "5511999999999");
  });

  it("enrich failure on attempt=3 → 500 + markOrderFailed called with ENRICH_FAILED", async () => {
    mockEnrichPrompt.mockImplementation(() =>
      Promise.resolve({ success: false, message: "Enrichment failed" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 3 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { conversationState: "FAILED", orderStatus: "CANCELLED" },
      })
    );
    expect(mockPrismaGenerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { revisionFeedback: "ENRICH_FAILED" },
      })
    );
    expect(mockNotifyOperator).toHaveBeenCalledTimes(1);
    expect(mockSendGenerationFailureMessage).toHaveBeenCalledTimes(1);
  });

  it("delivery failure on attempt=3 → 500 + markOrderFailed called with DELIVERY_FAILED", async () => {
    mockDeliverImageToClient.mockImplementation(() =>
      Promise.resolve({ success: false, message: "WhatsApp send failed" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 3 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { conversationState: "FAILED", orderStatus: "CANCELLED" },
      })
    );
    expect(mockPrismaGenerationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { revisionFeedback: "DELIVERY_FAILED" },
      })
    );
    expect(mockNotifyOperator).toHaveBeenCalledWith(TEST_ORDER_ID, "ERROR", "Generation failed after all retries");
    expect(mockSendGenerationFailureMessage).toHaveBeenCalledWith(TEST_ORDER_ID, "5511999999999");
  });

  it("delivery failure on attempt=1 → 500 for QStash retry, markOrderFailed NOT called", async () => {
    mockDeliverImageToClient.mockImplementation(() =>
      Promise.resolve({ success: false, message: "WhatsApp send failed" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 1 });
    const response = await POST(req as any);

    expect(response.status).toBe(500);
    expect(mockPrismaOrderUpdate).not.toHaveBeenCalled();
    expect(mockNotifyOperator).not.toHaveBeenCalled();
    expect(mockSendGenerationFailureMessage).not.toHaveBeenCalled();
  });

  it("markOrderFailed: no client phone → notifyOperator called but sendGenerationFailureMessage NOT called", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        orderStatus: "GENERATING",
        conversationState: "GENERATING",
        photosUrls: ["references/ord/photo.jpg"],
        client: { whatsappSenderId: null, name: "Ana" },
      })
    );
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: false, message: "OpenAI error" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 3 });
    await POST(req as any);

    expect(mockNotifyOperator).toHaveBeenCalledTimes(1);
    expect(mockSendGenerationFailureMessage).not.toHaveBeenCalled();
  });

  it("markOrderFailed: DB update throws → still calls notifyOperator and sendGenerationFailureMessage", async () => {
    mockPrismaOrderUpdate.mockImplementation(() => Promise.reject(new Error("DB down")));
    mockGenerate.mockImplementation(() =>
      Promise.resolve({ success: false, message: "OpenAI error" })
    );

    const req = makeRequest({ orderId: TEST_ORDER_ID, action: "generate", attempt: 3 });
    const response = await POST(req as any);

    // Route still returns 500 (for the gen failure)
    expect(response.status).toBe(500);
    // Despite DB failure, operator is still notified
    expect(mockNotifyOperator).toHaveBeenCalledTimes(1);
    expect(mockSendGenerationFailureMessage).toHaveBeenCalledTimes(1);
  });
});
