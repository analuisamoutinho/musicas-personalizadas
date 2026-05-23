import { mock, beforeEach, describe, it, expect } from "bun:test";

// All mock.module() calls MUST come before any imports that transitively import the mocked modules

const mockGenerateText = mock(() =>
  Promise.resolve({ text: "A vibrant Disney 3D style mascotinho illustration of a cheerful child wearing a colorful superhero outfit with a red cape and yellow boots. Background: sunny playground with confetti. Style: soft volumetric lighting, high detail, joyful expression." })
);

mock.module("ai", () => ({
  generateText: mockGenerateText,
}));

mock.module("@ai-sdk/openai", () => ({
  openai: (model: string) => ({ model }), // return a mock model object
}));

const mockPrismaOrderFindUnique = mock(() =>
  Promise.resolve({
    id: "order-uuid",
    theme: "Disney 3D",
    outfitDescription: "superhero with red cape",
    extraRequests: "yellow boots",
    styleTemplate: {
      name: "Disney 3D",
      promptTemplate: "Create a Disney 3D mascotinho illustration of a child character. {{details}}",
    },
  })
);

const mockPrismaGenerationUpsert = mock(() =>
  Promise.resolve({ id: "gen-uuid-1" })
);

// NOTE: enrichPrompt does NOT call generation.findFirst — only route.ts does.
// generation.findFirst is excluded from this package-level mock to avoid false coupling.
mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockPrismaOrderFindUnique },
    generation: {
      upsert: mockPrismaGenerationUpsert,
    },
  },
}));

// Static imports AFTER all mock.module() calls
import { enrichPrompt } from "./enrich-prompt";

const TEST_ORDER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("enrichPrompt", () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockPrismaOrderFindUnique.mockReset();
    mockPrismaGenerationUpsert.mockReset();
    // Note: no mockPrismaGenerationFindFirst to reset — enrichPrompt does not call findFirst.
    mockGenerateText.mockImplementation(() =>
      Promise.resolve({ text: "Enriched prompt text for Disney 3D mascotinho illustration." })
    );
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        theme: "Disney 3D",
        outfitDescription: "superhero costume",
        extraRequests: "yellow boots",
        styleTemplate: {
          name: "Disney 3D",
          promptTemplate: "Create a Disney 3D mascotinho illustration.",
        },
      })
    );
    mockPrismaGenerationUpsert.mockImplementation(() =>
      Promise.resolve({ id: "gen-uuid-1" })
    );
  });

  it("returns success with generationId and promptUsed on happy path", async () => {
    const result = await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    expect(result.success).toBe(true);
    expect(result.generationId).toBe("gen-uuid-1");
    expect(result.promptUsed).toBeTruthy();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockPrismaGenerationUpsert).toHaveBeenCalledTimes(1);
  });

  it("calls generateText with system prompt and user prompt containing template + client details", async () => {
    await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    const callArgs = (mockGenerateText.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(typeof callArgs.system).toBe("string");
    expect((callArgs.system as string).length).toBeGreaterThan(0);
    expect(typeof callArgs.prompt).toBe("string");
    expect((callArgs.prompt as string)).toContain("Disney 3D");
  });

  it("incorporates revisionFeedback into prompt when provided", async () => {
    await enrichPrompt({
      orderId: TEST_ORDER_ID,
      attemptNumber: 2,
      revisionFeedback: "Make the cape blue instead of red",
    });
    const callArgs = (mockGenerateText.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect((callArgs.prompt as string)).toContain("Make the cape blue instead of red");
  });

  it("uses default prompt template when order has no styleTemplate", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() =>
      Promise.resolve({
        id: TEST_ORDER_ID,
        theme: "Custom Theme",
        outfitDescription: null,
        extraRequests: null,
        styleTemplate: null,
      } as never)
    );
    const result = await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    expect(result.success).toBe(true);
    const callArgs = (mockGenerateText.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect((callArgs.prompt as string)).toContain("Custom Theme");
  });

  it("returns failure when order is not found", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.resolve(null as never));
    const result = await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    expect(result.success).toBe(false);
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockPrismaGenerationUpsert).not.toHaveBeenCalled();
  });

  it("returns failure when DB throws on order load", async () => {
    mockPrismaOrderFindUnique.mockImplementation(() => Promise.reject(new Error("DB connection failed")));
    const result = await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Erro");
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("returns failure when GPT-5-mini call fails", async () => {
    mockGenerateText.mockImplementation(() => Promise.reject(new Error("OpenAI rate limit")));
    const result = await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Erro");
    expect(mockPrismaGenerationUpsert).not.toHaveBeenCalled();
  });

  it("returns failure when generation upsert fails", async () => {
    mockPrismaGenerationUpsert.mockImplementation(() => Promise.reject(new Error("Unique constraint failed")));
    const result = await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    expect(result.success).toBe(false);
  });

  it("upserts Generation with correct orderId_attemptNumber compound key", async () => {
    await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 3 });
    const upsertCall = (mockPrismaGenerationUpsert.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(upsertCall.where).toEqual({
      orderId_attemptNumber: { orderId: TEST_ORDER_ID, attemptNumber: 3 },
    });
    const createData = (upsertCall.create as Record<string, unknown>);
    expect(createData.orderId).toBe(TEST_ORDER_ID);
    expect(createData.attemptNumber).toBe(3);
    expect(typeof createData.promptUsed).toBe("string");
  });

  it("stores revisionFeedback in Generation upsert create block when provided", async () => {
    const feedback = "Make the hat green instead of red";
    await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 2, revisionFeedback: feedback });
    const upsertCall = (mockPrismaGenerationUpsert.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    const createData = upsertCall.create as Record<string, unknown>;
    expect(createData.revisionFeedback).toBe(feedback);
  });

  it("stores null revisionFeedback in Generation upsert create block when not provided", async () => {
    await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    const upsertCall = (mockPrismaGenerationUpsert.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    const createData = upsertCall.create as Record<string, unknown>;
    expect(createData.revisionFeedback).toBeNull();
  });

  it("returns failure when GPT returns an empty string", async () => {
    mockGenerateText.mockImplementation(() => Promise.resolve({ text: "   " }));
    const result = await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Erro");
    expect(mockPrismaGenerationUpsert).not.toHaveBeenCalled();
  });

  it("passes maxOutputTokens: 500 to generateText", async () => {
    await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
    const callArgs = (mockGenerateText.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(callArgs.maxOutputTokens).toBe(500);
  });
});
