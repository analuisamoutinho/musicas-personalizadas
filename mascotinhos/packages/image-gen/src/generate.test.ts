import { mock, beforeEach, describe, it, expect } from "bun:test";

// All mock.module() calls MUST come before any imports that transitively import the mocked modules

const mockImagesEdit = mock(() =>
  Promise.resolve({
    data: [{ b64_json: "base64encodedimagedata" }],
    usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
  })
);

mock.module("openai", () => {
  class MockAPIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    default: class MockOpenAI {
      images = { edit: mockImagesEdit };
      static APIError = MockAPIError;
    },
    APIError: MockAPIError,
  };
});

const mockGetSignedUrl = mock((path: string) =>
  Promise.resolve(`https://storage.supabase.co/signed/${path}`)
);

mock.module("@mascotinhos/storage", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

mock.module("@mascotinhos/env/server", () => ({
  env: { OPENAI_API_KEY: "sk-test-key" },
}));

// observeOpenAI is a pass-through in tests — return the client unchanged
mock.module("@langfuse/openai", () => ({
  observeOpenAI: (client: unknown) => client,
}));

// Mock fetch globally (Bun provides it as a global)
const mockFetch = mock(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
  })
);
(global as Record<string, unknown>).fetch = mockFetch;

// Static imports AFTER all mock.module() calls
import { generate } from "./generate";

const TEST_ORDER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_GENERATION_ID = "gen-uuid-1";
const TEST_PHOTOS_URLS = ["references/ord_abc/photo_1.jpg"];

describe("generate", () => {
  beforeEach(() => {
    mockImagesEdit.mockReset();
    mockGetSignedUrl.mockReset();
    mockFetch.mockReset();

    mockGetSignedUrl.mockImplementation((path: string) =>
      Promise.resolve(`https://storage.supabase.co/signed/${path}`)
    );
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      })
    );
    mockImagesEdit.mockImplementation(() =>
      Promise.resolve({
        data: [{ b64_json: "base64encodedimagedata" }],
        usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
      })
    );
  });

  it("returns success with imageBase64 on happy path", async () => {
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "A vibrant mascotinho illustration",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    expect(result.success).toBe(true);
    expect(result.imageBase64).toBe("base64encodedimagedata");
    expect(mockImagesEdit).toHaveBeenCalledTimes(1);
  });

  it("calls OpenAI images.edit with correct model, size, quality, and prompt", async () => {
    await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "enriched prompt text",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    const callArgs = (mockImagesEdit.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(callArgs.model).toBe("gpt-image-2");
    expect(callArgs.size).toBe("1024x1024");
    expect(callArgs.quality).toBe("high");
    // Prompt is prefixed with reference-anchoring language; enriched text appended after.
    expect(callArgs.prompt).toContain("Use the child shown in the reference photo as the subject");
    expect(callArgs.prompt).toContain("Preserve their facial features");
    expect(callArgs.prompt).toContain("enriched prompt text");
  });

  it("fetches signed URL for each photo path", async () => {
    await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: ["references/ord_abc/photo_1.jpg", "references/ord_abc/photo_2.jpg"],
    });
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
    expect(mockGetSignedUrl).toHaveBeenCalledWith("references/ord_abc/photo_1.jpg");
    expect(mockGetSignedUrl).toHaveBeenCalledWith("references/ord_abc/photo_2.jpg");
  });

  it("returns failure when photosUrls is empty", async () => {
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: [],
    });
    expect(result.success).toBe(false);
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it("returns failure when photo fetch fails (non-ok HTTP status)", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 403, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })
    );
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    expect(result.success).toBe(false);
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it("returns failure when getSignedUrl throws", async () => {
    mockGetSignedUrl.mockImplementation(() => Promise.reject(new Error("Storage error")));
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    expect(result.success).toBe(false);
    expect(mockImagesEdit).not.toHaveBeenCalled();
  });

  it("returns failure when OpenAI API throws a non-retryable error (400)", async () => {
    const { default: MockOpenAI } = await import("openai");
    const apiError = new (MockOpenAI as unknown as { APIError: new (msg: string, status: number) => Error & { status: number } }).APIError("Bad request", 400);
    mockImagesEdit.mockImplementation(() => Promise.reject(apiError));
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    expect(result.success).toBe(false);
    expect(mockImagesEdit).toHaveBeenCalledTimes(1); // No retries on 400
  });

  it("retries on 429 rate limit up to 3 times", async () => {
    const { default: MockOpenAI } = await import("openai");
    let callCount = 0;
    mockImagesEdit.mockImplementation(() => {
      callCount++;
      if (callCount <= 3) {
        const rateLimitErr = new (MockOpenAI as unknown as { APIError: new (msg: string, status: number) => Error & { status: number } }).APIError("Rate limit", 429);
        return Promise.reject(rateLimitErr);
      }
      return Promise.resolve({ data: [{ b64_json: "base64afterretry" }] } as never);
    });
    // _testBaseDelayMs: 0 collapses all retry delays to 0ms — no artificial wait in tests
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
      _testBaseDelayMs: 0,
    });
    expect(result.success).toBe(true);
    expect(result.imageBase64).toBe("base64afterretry");
    expect(mockImagesEdit).toHaveBeenCalledTimes(4); // 3 retries + 1 success
  });

  it("returns failure when all 3 retries are exhausted (429 persists)", async () => {
    const { default: MockOpenAI } = await import("openai");
    mockImagesEdit.mockImplementation(() =>
      Promise.reject(
        new (MockOpenAI as unknown as { APIError: new (msg: string, status: number) => Error & { status: number } }).APIError("Rate limit", 429)
      )
    );
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
      _testBaseDelayMs: 0,
    });
    expect(result.success).toBe(false);
    expect(mockImagesEdit).toHaveBeenCalledTimes(4); // 1 initial + 3 retries, all failed
  });

  it("returns failure when OpenAI response has no b64_json", async () => {
    mockImagesEdit.mockImplementation(() =>
      Promise.resolve({ data: [{ url: "https://openai.com/image.png" }] } as never)
    );
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    expect(result.success).toBe(false);
  });

  it("returns imageBase64 WITHOUT data: URI prefix", async () => {
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    expect(result.imageBase64).not.toContain("data:");
    expect(result.imageBase64).not.toContain("base64,");
  });

  it("(issue-149) returns inputTokens, outputTokens, and imageGenerationCostUsd when usage is in response", async () => {
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    expect(result.success).toBe(true);
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    // Cost: (1000 * 5 + 500 * 40) / 1_000_000 = (5000 + 20000) / 1_000_000 = 0.025
    expect(result.imageGenerationCostUsd).toBeCloseTo(0.025, 6);
  });

  it("(issue-149) returns undefined cost fields when usage is absent from response", async () => {
    mockImagesEdit.mockImplementation(() =>
      Promise.resolve({ data: [{ b64_json: "base64encodedimagedata" }] } as never)
    );
    const result = await generate({
      generationId: TEST_GENERATION_ID,
      promptUsed: "prompt",
      orderId: TEST_ORDER_ID,
      photosUrls: TEST_PHOTOS_URLS,
    });
    expect(result.success).toBe(true);
    expect(result.inputTokens).toBeUndefined();
    expect(result.outputTokens).toBeUndefined();
    expect(result.imageGenerationCostUsd).toBeUndefined();
  });
});
