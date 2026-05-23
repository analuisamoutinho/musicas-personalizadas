import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getSignedUrl } from "@mascotinhos/storage";
import prisma from "@mascotinhos/db";

export const QUALITY_SCORE_THRESHOLD = 0.7;
export const MAX_QUALITY_RETRIES = 2;

export interface QualityCheckInput {
  generationId: string;
  imageBase64: string; // Raw base64, no data: prefix — from generate()
  photosUrls: string[]; // Supabase Storage paths
  promptUsed: string;
  orderId: string;
}

export interface QualityCheckResult {
  success: boolean;
  score?: number; // 0.0–1.0, stored in Generation record
  reasoning?: string; // Brief AI explanation — logged, not sent to client
  passed: boolean; // score >= QUALITY_SCORE_THRESHOLD
  message: string;
}

const QUALITY_EVAL_PROMPT_TEMPLATE = (promptUsed: string) => `You are a quality evaluator for AI-generated children's mascot illustrations.
Evaluate the generated image against the reference photo(s) and the generation prompt.

Generation prompt: "${promptUsed}"

Score the image from 0.0 to 1.0 based on:
- Likeness to reference photo(s): face features, skin tone, hair
- Style and theme adherence
- Inclusion of described outfit/accessories/extras

Respond ONLY with valid JSON: {"score": <float 0.0-1.0>, "reasoning": "<1-2 sentences>"}
No other text.`;

/**
 * Evaluates generated image quality using GPT-4o-mini vision.
 *
 * Steps:
 * 1. Fetch signed URLs for reference photos
 * 2. Call GPT-4o-mini with generated image + reference photos
 * 3. Parse JSON response for score and reasoning
 * 4. Update Generation.qualityScore in DB (non-fatal if fails)
 * 5. Return result with passed flag based on QUALITY_SCORE_THRESHOLD
 *
 * Fails open: if AI check fails, returns { success: false, passed: true }
 * so the pipeline continues without blocking delivery.
 */
export async function qualityCheck(input: QualityCheckInput): Promise<QualityCheckResult> {
  const { generationId, imageBase64, photosUrls, promptUsed, orderId } = input;

  console.log(
    JSON.stringify({
      level: "info",
      event: "quality_check_start",
      orderId,
      generationId,
      service: "image-gen",
    }),
  );

  // 1. Fetch signed URLs for reference photos
  // Validate paths before calling storage to prevent path traversal / opaque errors
  const VALID_PHOTO_PATH = /^references\//;
  const invalidPath = photosUrls.find((p) => !VALID_PHOTO_PATH.test(p));
  if (invalidPath !== undefined) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "quality_check_api_error",
        orderId,
        generationId,
        error: `Invalid photosUrls path rejected: "${invalidPath}"`,
        service: "image-gen",
      }),
    );
    return {
      success: false,
      passed: true,
      message: "Quality check unavailable — failing open",
    };
  }

  let signedPhotoUrls: string[] = [];
  if (photosUrls.length > 0) {
    try {
      signedPhotoUrls = await Promise.all(photosUrls.map((path) => getSignedUrl(path)));
    } catch (storageErr) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "quality_check_api_error",
          orderId,
          generationId,
          error: storageErr instanceof Error ? storageErr.message : String(storageErr),
          service: "image-gen",
        }),
      );
      return {
        success: false,
        passed: true,
        message: "Quality check unavailable — failing open",
      };
    }
  }

  // 2. Call GPT-4o-mini with vision (generated image + reference photos)
  if (!imageBase64) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "quality_check_api_error",
        orderId,
        generationId,
        error: "imageBase64 is empty — cannot perform quality check",
        service: "image-gen",
      }),
    );
    return {
      success: false,
      passed: true,
      message: "Quality check unavailable — failing open",
    };
  }

  let responseText: string;
  try {
    const result = await generateText({
      model: openai("gpt-5.4-mini"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: QUALITY_EVAL_PROMPT_TEMPLATE(promptUsed),
            },
            {
              type: "image",
              image: `data:image/png;base64,${imageBase64}`, // generated image
            },
            // Reference photos (0-3):
            ...signedPhotoUrls.map((url) => ({ type: "image" as const, image: new URL(url) })),
          ],
        },
      ],
      maxOutputTokens: 200, // Score + brief reasoning only — keep it cheap and fast
      abortSignal: AbortSignal.timeout(15_000), // NFR-02: max 15 seconds
      experimental_telemetry: {
        isEnabled: true,
        functionId: "quality-check",
        recordInputs: true,
        recordOutputs: true,
        metadata: {
          orderId,
          generationId,
          service: "image-gen",
        },
      },
    });
    responseText = result.text;
  } catch (aiErr) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "quality_check_api_error",
        orderId,
        generationId,
        error: aiErr instanceof Error ? aiErr.message : String(aiErr),
        service: "image-gen",
      }),
    );
    return {
      success: false,
      passed: true,
      message: "Quality check unavailable — failing open",
    };
  }

  // 3. Parse JSON response
  let score: number;
  let reasoning: string;
  try {
    const parsed = JSON.parse(responseText) as { score: unknown; reasoning: unknown };
    score = parsed.score as number;
    // Coerce reasoning to string — AI may omit or return non-string value
    reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : String(parsed.reasoning ?? "");
    if (typeof score !== "number" || score < 0 || score > 1) {
      throw new Error(`Invalid score value: ${score}`);
    }
  } catch {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "quality_check_parse_error",
        orderId,
        generationId,
        rawResponse: responseText.slice(0, 200),
        service: "image-gen",
      }),
    );
    return {
      success: false,
      passed: true,
      message: "Quality check unavailable — failing open",
    };
  }

  // 4. Update Generation.qualityScore in DB (non-fatal)
  try {
    await prisma.generation.update({
      where: { id: generationId },
      data: { qualityScore: score },
    });
  } catch (dbErr) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "quality_check_db_update_error",
        orderId,
        generationId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        service: "image-gen",
      }),
    );
    // Non-fatal — continue and return result with score
  }

  const passed = score >= QUALITY_SCORE_THRESHOLD;
  const qualityScorePercent = Math.round(score * 100);

  if (!passed) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "quality_check_below_threshold",
        orderId,
        generationId,
        score,
        qualityScorePercent,
        threshold: QUALITY_SCORE_THRESHOLD,
        reasoning,
        service: "image-gen",
      }),
    );
  } else {
    console.log(
      JSON.stringify({
        level: "info",
        event: "quality_check_success",
        orderId,
        generationId,
        score,
        qualityScorePercent,
        passed,
        reasoning,
        service: "image-gen",
      }),
    );
  }

  return {
    success: true,
    score,
    reasoning,
    passed,
    message: passed
      ? "Quality check passed."
      : `Quality check failed — score ${qualityScorePercent}% below threshold ${Math.round(QUALITY_SCORE_THRESHOLD * 100)}%.`,
  };
}
