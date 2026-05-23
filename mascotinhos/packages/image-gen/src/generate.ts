import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { getSignedUrl } from "@mascotinhos/storage";
import { env } from "@mascotinhos/env/server";
import { computeImageCostUsd } from "./pricing";

// Module-level singleton — avoids re-reading env on every call and reuses HTTP keep-alive connections.
// Lazily initialized so test mocks for @mascotinhos/env/server apply before the first call.
let _client: OpenAI | undefined;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

/** Reset the cached client — for tests that need to swap the API key mock. */
export function _resetClientForTests(): void {
  _client = undefined;
}

export interface GenerateInput {
  generationId: string;
  promptUsed: string;
  orderId: string;
  photosUrls: string[]; // Supabase Storage paths (e.g. "references/ord_abc/photo.jpg")
  /** Override retry base delay in ms — for unit tests only. Default: 1000ms. */
  _testBaseDelayMs?: number;
}

export interface GenerateResult {
  success: boolean;
  imageBase64?: string; // Raw base64 WITHOUT data: URI prefix — consumed by stories 4.4 & 4.5
  message: string;
  inputTokens?: number;
  outputTokens?: number;
  imageGenerationCostUsd?: number;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Generates a mascotinho image via OpenAI GPT Image 1.5 (gpt-image-1).
 *
 * Steps:
 * 1. Load reference photos from Supabase Storage via signed URLs → base64 encode
 * 2. Call OpenAI images.edit with primary reference photo + enriched prompt
 * 3. Extract base64 image from response
 * 4. Return raw base64 (no imageUrl DB update — that's Story 4.5)
 */
export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const { generationId, promptUsed, orderId, photosUrls, _testBaseDelayMs } = input;

  // 1. Validate photos list
  if (photosUrls.length === 0) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "image_gen_no_photos",
        orderId,
        generationId,
        service: "image-gen",
      }),
    );
    return { success: false, message: "Nenhuma foto de referência encontrada." };
  }

  // 2. Load reference photos as base64
  let photoBuffers: Buffer[];
  try {
    console.log(
      JSON.stringify({
        level: "info",
        event: "image_gen_photos_load_start",
        orderId,
        generationId,
        photoCount: photosUrls.length,
        service: "image-gen",
      }),
    );

    photoBuffers = await Promise.all(
      photosUrls.map(async (path) => {
        const signedUrl = await getSignedUrl(path);
        const response = await fetch(signedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch photo: HTTP ${response.status} for path ${path}`);
        }
        return Buffer.from(await response.arrayBuffer());
      }),
    );

    console.log(
      JSON.stringify({
        level: "info",
        event: "image_gen_photos_load_success",
        orderId,
        generationId,
        photoCount: photoBuffers.length,
        service: "image-gen",
      }),
    );
  } catch (fetchErr) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "image_gen_photos_load_error",
        orderId,
        generationId,
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        service: "image-gen",
      }),
    );
    return { success: false, message: "Erro ao carregar fotos de referência." };
  }

  // 3. Call OpenAI images.edit (supports reference photo input)
  // Primary photo = first element; additional photos described in prompt via enrichPrompt context
  // photosUrls.length > 0 was already validated above, so photoBuffers[0] is always defined.
  // Slice the Buffer to a plain ArrayBuffer for File constructor compatibility.
  const primaryPhotoBuffer = photoBuffers[0] as Buffer;
  const primaryArrayBuffer = primaryPhotoBuffer.buffer.slice(
    primaryPhotoBuffer.byteOffset,
    primaryPhotoBuffer.byteOffset + primaryPhotoBuffer.byteLength,
  ) as ArrayBuffer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryPhotoFile = new File([primaryArrayBuffer], "reference.jpg", { type: "image/jpeg" }) as any;

  const client = observeOpenAI(getClient(), {
    generationName: "image-generation",
    generationMetadata: { orderId, generationId, service: "image-gen" },
  });

  let imageBase64: string;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let imageGenerationCostUsd: number | undefined;
  try {
    console.log(
      JSON.stringify({
        level: "info",
        event: "image_gen_api_call_start",
        orderId,
        generationId,
        service: "image-gen",
      }),
    );

    // Safety net: prepend explicit reference-anchoring language so the model treats the
    // input photo as the subject (the child to transform), not as loose inspiration.
    // Without this, gpt-image-2 readily invents a different face when the prompt
    // describes a generic character.
    const anchoredPrompt = `Use the child shown in the reference photo as the subject of this illustration. Preserve their facial features, skin tone, hair color and style, eye color, and any distinctive characteristics — the result must be recognizably the same child, just stylized in costume per the description below.\n\n${promptUsed}`;

    const response = await callWithRetry(
      () =>
        client.images.edit({
          model: "gpt-image-2",
          image: primaryPhotoFile,
          prompt: anchoredPrompt,
          quality: "high",
          size: "1024x1024",
          // gpt-image-2 via images.edit always returns b64_json — URL format is not supported.
          // response_format is omitted as the TypeScript types may not expose it for images.edit,
          // and the b64_json field is always populated for gpt-image-2.
        }),
      { orderId, generationId, baseDelayMs: _testBaseDelayMs },
    );

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI response missing b64_json field");
    }
    imageBase64 = b64;

    // gpt-image-1 returns token usage for cost tracking.
    // SDK typing for usage varies by version — access via unknown cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = (response as unknown as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    if (usage?.input_tokens !== undefined && usage?.output_tokens !== undefined) {
      inputTokens = usage.input_tokens;
      outputTokens = usage.output_tokens;
      imageGenerationCostUsd = computeImageCostUsd(inputTokens, outputTokens);
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "image_gen_api_call_success",
        orderId,
        generationId,
        inputTokens,
        outputTokens,
        imageGenerationCostUsd,
        service: "image-gen",
      }),
    );
  } catch (apiErr) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "image_gen_api_error",
        orderId,
        generationId,
        error: apiErr instanceof Error ? apiErr.message : String(apiErr),
        service: "image-gen",
      }),
    );
    return { success: false, message: "Erro ao gerar imagem." };
  }

  return {
    success: true,
    imageBase64,
    message: "Imagem gerada com sucesso.",
    inputTokens,
    outputTokens,
    imageGenerationCostUsd,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function callWithRetry<T>(
  fn: () => Promise<T>,
  {
    orderId,
    generationId,
    maxRetries = 3,
    baseDelayMs,
  }: {
    orderId: string;
    generationId: string;
    maxRetries?: number;
    baseDelayMs?: number;
  },
): Promise<T> {
  const effectiveDelay = baseDelayMs ?? 1000;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof OpenAI.APIError ? err.status : undefined;
      const isPermanent = status === 400 || status === 401 || status === 403;
      const isRetryable = status !== undefined && RETRYABLE_STATUS_CODES.has(status);

      if (isPermanent) throw err; // Content policy, bad request — no retries
      if (!isRetryable || attempt > maxRetries) throw err;

      const delayMs = effectiveDelay * Math.pow(2, attempt - 1); // 1s, 2s, 4s (or 0 in tests)
      console.log(
        JSON.stringify({
          level: "warn",
          event: "image_gen_api_retry",
          orderId,
          generationId,
          retryAttempt: attempt,
          statusCode: status,
          delayMs,
          service: "image-gen",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Unreachable");
}
