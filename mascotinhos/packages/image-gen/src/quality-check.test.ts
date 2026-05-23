import { mock, beforeEach, describe, it, expect } from "bun:test";

// ALL mock.module() calls MUST precede static imports — bun:test mock ordering requirement

const mockGenerateText = mock(() =>
  Promise.resolve({ text: '{"score": 0.85, "reasoning": "Good likeness and style adherence."}' })
);

mock.module("ai", () => ({
  generateText: mockGenerateText,
}));

mock.module("@ai-sdk/openai", () => ({
  openai: (model: string) => ({ model }),
}));

const mockGetSignedUrl = mock((path: string) =>
  Promise.resolve(`https://storage.example.com/signed/${path}`)
);

mock.module("@mascotinhos/storage", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

mock.module("@mascotinhos/env/server", () => ({
  env: { OPENAI_API_KEY: "sk-test-key" },
}));

const mockGenerationUpdate = mock(() => Promise.resolve({}));

mock.module("@mascotinhos/db", () => ({
  default: {
    generation: {
      update: mockGenerationUpdate,
    },
  },
}));

// Static imports AFTER all mock.module() calls
import { qualityCheck, QUALITY_SCORE_THRESHOLD, MAX_QUALITY_RETRIES } from "./quality-check";

const TEST_ORDER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_GENERATION_ID = "gen-uuid-quality-1";
const TEST_PHOTOS_URLS = ["references/ord_abc/photo_1.jpg"];
const TEST_IMAGE_BASE64 = "base64encodedimagedata";
const TEST_PROMPT = "A vibrant mascotinho illustration in cartoon style";

describe("qualityCheck", () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
    mockGetSignedUrl.mockReset();
    mockGenerationUpdate.mockReset();

    mockGetSignedUrl.mockImplementation((path: string) =>
      Promise.resolve(`https://storage.example.com/signed/${path}`)
    );
    mockGenerationUpdate.mockImplementation(() => Promise.resolve({}));
    mockGenerateText.mockImplementation(() =>
      Promise.resolve({ text: '{"score": 0.85, "reasoning": "Good likeness and style adherence."}' })
    );
  });

  describe("happy path — score above threshold", () => {
    it("returns success=true, passed=true when score >= threshold", async () => {
      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(0.85);
      expect(result.reasoning).toBe("Good likeness and style adherence.");
    });

    it("calls getSignedUrl for each photo path", async () => {
      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: ["references/ord_abc/photo_1.jpg", "references/ord_abc/photo_2.jpg"],
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
      expect(mockGetSignedUrl).toHaveBeenCalledWith("references/ord_abc/photo_1.jpg");
      expect(mockGetSignedUrl).toHaveBeenCalledWith("references/ord_abc/photo_2.jpg");
    });

    it("calls generateText with gpt-5.4-mini model", async () => {
      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      const callArgs = (mockGenerateText.mock.calls[0] as unknown as [Record<string, unknown>])[0];
      expect((callArgs.model as { model: string }).model).toBe("gpt-5.4-mini");
      expect(callArgs.maxOutputTokens).toBe(200);
    });

    it("passes generated image as data URI in messages content", async () => {
      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      const callArgs = (mockGenerateText.mock.calls[0] as unknown as [{
        messages: Array<{ role: string; content: Array<{ type: string; image?: string | URL }> }>;
      }])[0];
      const content = callArgs.messages[0]!.content;
      const imageContent = content.find((c) => c.type === "image" && typeof c.image === "string")!;
      expect(imageContent).toBeDefined();
      expect(imageContent.image).toBe(`data:image/png;base64,${TEST_IMAGE_BASE64}`);
    });

    it("updates Generation.qualityScore in DB", async () => {
      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(mockGenerationUpdate).toHaveBeenCalledTimes(1);
      expect(mockGenerationUpdate).toHaveBeenCalledWith({
        where: { id: TEST_GENERATION_ID },
        data: { qualityScore: 0.85 },
      });
    });
  });

  describe("below threshold — score < threshold", () => {
    it("returns success=true, passed=false when score < QUALITY_SCORE_THRESHOLD", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({ text: '{"score": 0.55, "reasoning": "Poor likeness, style not matched."}' })
      );

      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0.55);
    });

    it("returns passed=true at exactly the threshold boundary (0.7)", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({ text: '{"score": 0.7, "reasoning": "Borderline pass."}' })
      );

      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(0.7);
    });
  });

  describe("AI API error — fail open", () => {
    it("returns success=false, passed=true when generateText throws", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.reject(new Error("OpenAI API unreachable"))
      );

      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.passed).toBe(true);
      expect(result.score).toBeUndefined();
      expect(result.message).toContain("failing open");
    });

    it("does not update DB when AI call fails", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.reject(new Error("Timeout"))
      );

      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(mockGenerationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("JSON parse error — fail open", () => {
    it("returns success=false, passed=true when AI returns non-JSON text", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({ text: "I cannot evaluate this image." })
      );

      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.passed).toBe(true);
      expect(result.score).toBeUndefined();
      expect(result.message).toContain("failing open");
    });

    it("returns success=false, passed=true when AI returns JSON with invalid score (out of range)", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({ text: '{"score": 1.5, "reasoning": "invalid score"}' })
      );

      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.passed).toBe(true);
    });

    it("does not update DB when JSON parse fails", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({ text: "not valid json at all" })
      );

      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(mockGenerationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("DB update error — non-fatal", () => {
    it("still returns the quality result with score even when DB update fails", async () => {
      mockGenerationUpdate.mockImplementation(() =>
        Promise.reject(new Error("DB connection error"))
      );

      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      // DB error is non-fatal — function still returns result with score
      expect(result.success).toBe(true);
      expect(result.score).toBe(0.85);
      expect(result.passed).toBe(true);
    });
  });

  describe("empty photosUrls", () => {
    it("works when no reference photos provided (only generated image)", async () => {
      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: [],
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      // getSignedUrl should NOT be called for empty photosUrls
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.passed).toBe(true);
    });

    it("passes only the generated image in content when photosUrls is empty", async () => {
      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: [],
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      const callArgs = (mockGenerateText.mock.calls[0] as unknown as [{
        messages: Array<{ role: string; content: Array<{ type: string }> }>;
      }])[0];
      const content = callArgs.messages[0]!.content;
      // Only text + 1 generated image — no reference photo image parts
      const imageParts = content.filter((c) => c.type === "image");
      expect(imageParts).toHaveLength(1);
    });
  });

  describe("invalid photosUrls paths — fail open (path traversal guard)", () => {
    it("returns success=false, passed=true when a path does not start with 'references/'", async () => {
      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: ["../sensitive/data.jpg"],
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.passed).toBe(true);
      expect(result.message).toContain("failing open");
    });

    it("does not call getSignedUrl when an invalid path is detected", async () => {
      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: ["generated/output.png"],
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it("proceeds normally when all paths are valid references/ paths", async () => {
      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: ["references/ord_abc/photo_1.jpg"],
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(true);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe("empty imageBase64 — fail open", () => {
    it("returns success=false, passed=true when imageBase64 is empty string", async () => {
      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: "",
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.passed).toBe(true);
      expect(result.message).toContain("failing open");
    });

    it("does not call generateText when imageBase64 is empty", async () => {
      await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: "",
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(mockGenerateText).not.toHaveBeenCalled();
    });
  });

  describe("AI returns JSON without reasoning field — coerced to string", () => {
    it("returns success=true with empty reasoning string when AI omits reasoning field", async () => {
      mockGenerateText.mockImplementation(() =>
        Promise.resolve({ text: '{"score": 0.85}' })
      );

      const result = await qualityCheck({
        generationId: TEST_GENERATION_ID,
        imageBase64: TEST_IMAGE_BASE64,
        photosUrls: TEST_PHOTOS_URLS,
        promptUsed: TEST_PROMPT,
        orderId: TEST_ORDER_ID,
      });

      expect(result.success).toBe(true);
      expect(result.score).toBe(0.85);
      expect(result.passed).toBe(true);
      expect(typeof result.reasoning).toBe("string");
    });
  });

  describe("constants", () => {
    it("exports QUALITY_SCORE_THRESHOLD as 0.7", () => {
      expect(QUALITY_SCORE_THRESHOLD).toBe(0.7);
    });

    it("exports MAX_QUALITY_RETRIES as 2", () => {
      expect(MAX_QUALITY_RETRIES).toBe(2);
    });
  });
});
