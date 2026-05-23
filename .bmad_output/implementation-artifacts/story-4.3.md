# Story 4.3: GPT Image 1.5 Generation with Base64 Input

Status: done
GitHub Issue: [mgiovani/fotos#59](https://github.com/mgiovani/fotos/issues/59)

## Story

As the system,
I want to call GPT Image 1.5 with the reference photos and enriched prompt,
So that a high-quality 1024x1024 mascotinho illustration is generated that captures the child's likeness.

## Acceptance Criteria

**Given** an enriched prompt and base64-encoded reference photos are ready
**When** `generate()` is called in `packages/image-gen` with `{ generationId, promptUsed, orderId, photosUrls }`
**Then** it calls the OpenAI GPT Image 1.5 API (`images.edit`) with model `gpt-image-1`, size `1024x1024`, `response_format: "b64_json"`, the enriched prompt, and the primary reference photo as `image` input
**And** the generated image is returned as raw base64 (no `data:` URI prefix)
**And** API rate limits are handled with exponential backoff (3 retries)
**And** transient errors (500, 429) trigger retries; permanent errors (400) fail immediately
**And** the generation completes within 2 minutes end-to-end (excluding artificial delay)
**And** all API calls include orderId in logging context

**FRs covered:** FR-22 (GPT Image 1.5 High 1024x1024 with base64 input)

---

## Status Assessment — What Already Exists

**CRITICAL: Before writing any code, understand these pre-existing stubs and integrations:**

### Already implemented (DO NOT replace, DO NOT reinvent):

- `packages/image-gen/` — workspace package already created in Story 4.2. Directory, `package.json`, `tsconfig.json` are complete.
- `packages/image-gen/src/index.ts` — currently only exports `enrichPrompt`. **This story adds `generate` to the exports.**
- `packages/image-gen/src/enrich-prompt.ts` — fully implemented. Do NOT modify.
- `packages/image-gen/src/enrich-prompt.test.ts` — fully implemented. Do NOT modify.
- `packages/image-gen/src/test-setup.ts` — env var preload for unit tests. Do NOT modify; all env vars including `OPENAI_API_KEY` are already set there.
- `packages/image-gen/package.json` — already has `@ai-sdk/openai`, `ai`, `@mascotinhos/db`, `@mascotinhos/env`, `zod` as dependencies. **This story adds `@mascotinhos/storage: "workspace:*"` to the dependencies.**
- `apps/web/src/app/api/generate/route.ts` — fully implemented through Story 4.2. Contains the stub comment block `// TODO (Story 4.3): import { generate } from "@mascotinhos/image-gen";` marking exactly where to wire in the new call. **This story replaces that stub.**
- `packages/bot-engine/package.json` — already has `@ai-sdk/openai` and `ai`. Same version constraints apply — do NOT add to root catalog again.
- `packages/env/src/server-schema.ts` — `OPENAI_API_KEY: z.string().startsWith("sk-")` already validated. Do NOT add it again.
- `@mascotinhos/storage` — `getSignedUrl(path: string): Promise<string>` already exported. Path must start with `"references/"` or `"generated/"`. Signs URL valid for 3600 seconds. This is how reference photos are fetched for base64 encoding.
- `@mascotinhos/db` — Prisma client already set up. `Generation` model has `imageUrl String?` (set by Story 4.5, not this story). `Order` model has `photosUrls String[]` — array of Supabase Storage paths (e.g., `references/{orderId}/{filename}`) set during photo collection.

### Not yet created (this story creates them):

- `packages/image-gen/src/generate.ts` — core image generation function.
- `packages/image-gen/src/generate.test.ts` — unit tests.
- Wire `generate()` call into `apps/web/src/app/api/generate/route.ts` (replace the TODO stub).
- Export `generate` from `packages/image-gen/src/index.ts`.
- Add `@mascotinhos/storage` as a dependency in `packages/image-gen/package.json`.

### Not part of this story (stub out or leave for later):

- `packages/image-gen/src/quality-check.ts` — Story 4.4 creates this.
- `Generation.imageUrl` — set by Story 4.5 (upload to permanent storage). `generate()` returns raw image data; it does NOT update the DB.
- `Generation.qualityScore` — set by Story 4.4.
- Order status update to `DELIVERED` — Story 4.6.
- WhatsApp delivery — Story 4.6.

---

## Developer Context

### How the Image Generation Pipeline Fits Together

The `/api/generate` consumer (`route.ts`) orchestrates the full pipeline:

```
QStash → POST /api/generate → handleGenerate()
  Step 4: Load order (idempotency check) — already done
  Step 5: enrichPrompt() — Story 4.2 ✓ DONE
  Step 6: generate()     — Story 4.3 ← THIS STORY
  Step 7: qualityCheck() — Story 4.4 (stub left in route)
  Step 8: uploadGenerated() — Story 4.5 (stub left in route)
  Step 9: deliverImage tool — Story 4.6 (stub left in route)
```

After this story, the route MUST:
1. Call `generate()` with `{ generationId, promptUsed, orderId, photosUrls }`.
2. On failure → return HTTP 500 (triggers QStash auto-retry).
3. On success → leave TODO stubs for 4.4–4.6 in place (log and return 200 for now).

### Reference Photo Loading Pattern

`Order.photosUrls` holds Supabase Storage paths (NOT direct download URLs). Example values:
```
["references/ord_abc123/photo_1.jpg", "references/ord_abc123/photo_2.jpg"]
```

To base64-encode them for the OpenAI API:
1. Call `getSignedUrl(path)` from `@mascotinhos/storage` → returns a time-limited HTTPS URL.
2. `fetch()` the signed URL.
3. Convert the response buffer to base64.

Maximum 3 photos (enforced at collection time). The first photo is the primary reference; additional photos are supplementary angles.

### OpenAI Image Generation API

The correct API call pattern using the **direct OpenAI SDK** (not AI SDK — AI SDK v6 does not expose GPT Image 1.5's `input` parameter for base64 image input at this time):

```typescript
import OpenAI from "openai";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const response = await client.images.generate({
  model: "gpt-image-1",
  prompt: enrichedPrompt,
  quality: "high",
  size: "1024x1024",
  // Reference photos are passed as additional context via the edit endpoint
  // or via input_image — see generate.ts implementation notes below
});
```

**CRITICAL — Correct API endpoint for reference photo input:**
GPT Image 1.5 with base64 input photos uses the **edit** endpoint (`images.edit`), NOT `images.generate`. The `images.edit` endpoint accepts:
- `image`: The reference photo as a `File` or `Blob` (primary reference).
- `prompt`: The enriched text prompt.
- `model`: `"gpt-image-1"`.
- `quality`: `"high"`.
- `size`: `"1024x1024"`.

If multiple reference photos are provided, only the first photo is passed as the primary `image` parameter. Additional photos should be incorporated into the prompt text as descriptions (the API supports only one `image` input per call).

**Response format:** `response.data[0]` has either `b64_json` (base64 string) or `url` (temporary CDN URL, valid ~1 hour). Request `response_format: "b64_json"` to get base64 directly (avoids a second HTTP fetch).

**Environment variable:** `env.OPENAI_API_KEY` is validated at startup in `packages/env`. Import via `import { env } from "@mascotinhos/env/server"`. Do NOT use `process.env.OPENAI_API_KEY` directly.

**Note on `openai` npm package version:** Check `packages/image-gen/package.json` — if `openai` is not already listed, add `"openai": "^4.0.0"` to the dependencies. The `@ai-sdk/openai` package is NOT a substitute for the direct `openai` SDK here.

### Retry Pattern for OpenAI Rate Limits

Architecture requires 3 retries with exponential backoff (NFR-17, NFR-24). Implement inline:

```typescript
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

async function callWithRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelayMs = 1000 }: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof OpenAI.APIError ? err.status : undefined;
      const isRetryable = status !== undefined && RETRYABLE_STATUS_CODES.has(status);
      const isPermanent = status === 400 || status === 401 || status === 403;

      if (isPermanent || attempt > maxRetries) throw err;
      if (!isRetryable) throw err; // Unknown errors are not retried

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Unreachable");
}
```

### Logging Pattern (from architecture)

All logs use structured JSON via `console.log(JSON.stringify(...))`. Every log entry MUST include `orderId`:

```typescript
console.log(JSON.stringify({
  level: "info" | "warn" | "error",
  event: "image_gen_*",
  orderId,
  generationId,
  service: "image-gen",
}));
```

Log events for this story:
- `image_gen_photos_load_start` — info, before fetching signed URLs
- `image_gen_photos_load_success` — info, after base64 encoding completes, include `photoCount`
- `image_gen_api_call_start` — info, before OpenAI call
- `image_gen_api_call_success` — info, after successful response
- `image_gen_api_retry` — warn, on retry attempt, include `retryAttempt`, `statusCode`
- `image_gen_api_error` — error, on final failure
- `image_gen_photos_load_error` — error, if photo fetch/base64 fails

### Return Value Contract

`generate()` returns a `GenerateResult`:

```typescript
export interface GenerateInput {
  generationId: string;
  promptUsed: string;
  orderId: string;
  photosUrls: string[]; // Supabase Storage paths, e.g. ["references/..."]
  /** Override retry base delay in ms — for unit tests only. Default: 1000ms. */
  _testBaseDelayMs?: number;
}

export interface GenerateResult {
  success: boolean;
  imageBase64?: string; // base64-encoded PNG/JPEG, WITHOUT the data: URI prefix
  message: string;
}
```

The `imageBase64` field is consumed by Story 4.4 (quality check) and Story 4.5 (storage upload). Stories 4.4 and 4.5 expect raw base64 without the `data:image/png;base64,` prefix.

### Route.ts Integration (Replacing the TODO stub)

In `apps/web/src/app/api/generate/route.ts`, replace:
```typescript
// TODO (Story 4.3): import { generate } from "@mascotinhos/image-gen";
//   const genResult = await generate({ generationId: enrichResult.generationId!, promptUsed: enrichResult.promptUsed!, orderId });
```

With a real call that:
1. Loads `order.photosUrls` from the DB (add to the existing `prisma.order.findUnique` select in `handleGenerate`, or do a separate load — prefer adding `photosUrls` to the existing select to avoid an extra DB round-trip).
2. Calls `generate({ generationId, promptUsed, orderId, photosUrls })`.
3. Returns HTTP 500 on failure (triggers QStash retry).
4. Continues to the next TODO stubs (4.4–4.6) on success.

**The existing order `findUnique` select in `handleGenerate` only fetches `id`, `orderStatus`, `conversationState`.** This story must extend that select to also include `photosUrls`.

### Error Handling

Follow the architecture's `AppError` pattern for the route:
- `generate()` itself returns `{ success: false, message }` on all errors (never throws to caller).
- Route checks `genResult.success` — if false, logs error and returns HTTP 500.
- Permanent failures (400 from OpenAI, e.g. content policy rejection) should also return 500 from the route — QStash will exhaust retries and trigger the dead-letter callback (Story 7.2 handles that case; for now the route just returns 500 consistently).

### NFR Compliance

- **NFR-02:** Generation must complete within 2 minutes. OpenAI GPT Image 1.5 High at 1024x1024 typically takes 20–60 seconds. No artificial timeout needed; Vercel function timeout (set to 300s via `export const maxDuration = 300;` in route.ts — check if already set in Story 4.1) handles the upper bound.
- **NFR-17:** Rate limit handling — exponential backoff as described above.
- **NFR-24:** OpenAI transient errors — same retry logic handles 500/503 from OpenAI.

---

## Tasks / Subtasks

- [x] Task 1: Add `openai` and `@mascotinhos/storage` to `packages/image-gen/package.json`
  - [x] 1.1: Open `mascotinhos/packages/image-gen/package.json` and add to `dependencies`:
    ```json
    "@mascotinhos/storage": "workspace:*",
    "openai": "^4.0.0"
    ```
    Check if `openai` is already in the workspace catalog (root `package.json`). If so, reference the catalog version. If not, add the direct version constraint.
  - [x] 1.2: Run `bun install` from `mascotinhos/` to link the new dependency.

- [x] Task 2: Implement `packages/image-gen/src/generate.ts`
  - [x] 2.1: Create `mascotinhos/packages/image-gen/src/generate.ts`:

    ```typescript
    import OpenAI from "openai";
    import { getSignedUrl } from "@mascotinhos/storage";
    import { env } from "@mascotinhos/env/server";

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

      // 1. Load reference photos as base64
      if (photosUrls.length === 0) {
        console.log(JSON.stringify({
          level: "error",
          event: "image_gen_no_photos",
          orderId,
          generationId,
          service: "image-gen",
        }));
        return { success: false, message: "Nenhuma foto de referência encontrada." };
      }

      let photoBuffers: Buffer[];
      try {
        console.log(JSON.stringify({
          level: "info",
          event: "image_gen_photos_load_start",
          orderId,
          generationId,
          photoCount: photosUrls.length,
          service: "image-gen",
        }));

        photoBuffers = await Promise.all(
          photosUrls.map(async (path) => {
            const signedUrl = await getSignedUrl(path);
            const response = await fetch(signedUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch photo: HTTP ${response.status} for path ${path}`);
            }
            return Buffer.from(await response.arrayBuffer());
          })
        );

        console.log(JSON.stringify({
          level: "info",
          event: "image_gen_photos_load_success",
          orderId,
          generationId,
          photoCount: photoBuffers.length,
          service: "image-gen",
        }));
      } catch (fetchErr) {
        console.log(JSON.stringify({
          level: "error",
          event: "image_gen_photos_load_error",
          orderId,
          generationId,
          error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          service: "image-gen",
        }));
        return { success: false, message: "Erro ao carregar fotos de referência." };
      }

      // 2. Call OpenAI images.edit (supports reference photo input)
      // Primary photo = first element; additional photos described in prompt via enrichPrompt context
      const primaryPhotoBuffer = photoBuffers[0];
      const primaryPhotoFile = new File([primaryPhotoBuffer], "reference.jpg", { type: "image/jpeg" });

      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

      let imageBase64: string;
      try {
        console.log(JSON.stringify({
          level: "info",
          event: "image_gen_api_call_start",
          orderId,
          generationId,
          service: "image-gen",
        }));

        const response = await callWithRetry(
          () => client.images.edit({
            model: "gpt-image-1",
            image: primaryPhotoFile,
            prompt: promptUsed,
            size: "1024x1024",
            // response_format: "b64_json" ensures b64_json field in response.data[0].
            // gpt-image-1 via images.edit always returns b64_json by default, but
            // specifying it explicitly guards against future SDK behavior changes.
            // Note: if TypeScript types for images.edit reject response_format, remove it —
            // gpt-image-1 does not support URL response format and defaults to b64_json.
          }),
          { orderId, generationId, baseDelayMs: _testBaseDelayMs }
        );

        const b64 = response.data[0]?.b64_json;
        if (!b64) {
          throw new Error("OpenAI response missing b64_json field");
        }
        imageBase64 = b64;

        console.log(JSON.stringify({
          level: "info",
          event: "image_gen_api_call_success",
          orderId,
          generationId,
          service: "image-gen",
        }));
      } catch (apiErr) {
        console.log(JSON.stringify({
          level: "error",
          event: "image_gen_api_error",
          orderId,
          generationId,
          error: apiErr instanceof Error ? apiErr.message : String(apiErr),
          service: "image-gen",
        }));
        return { success: false, message: "Erro ao gerar imagem." };
      }

      return {
        success: true,
        imageBase64,
        message: "Imagem gerada com sucesso.",
      };
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    async function callWithRetry<T>(
      fn: () => Promise<T>,
      { orderId, generationId, maxRetries = 3, baseDelayMs }: {
        orderId: string;
        generationId: string;
        maxRetries?: number;
        baseDelayMs?: number;
      }
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
          console.log(JSON.stringify({
            level: "warn",
            event: "image_gen_api_retry",
            orderId,
            generationId,
            retryAttempt: attempt,
            statusCode: status,
            delayMs,
            service: "image-gen",
          }));
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      throw new Error("Unreachable");
    }
    ```

  - [x] 2.2: **`quality` parameter note** — The `images.edit` endpoint does not support the `quality` parameter (it is only available on `images.generate` for `gpt-image-1`). Do NOT include `quality` in the `images.edit` call — the TypeScript types will reject it. The architecture requires "High" quality, but since reference photo input requires `images.edit`, quality is implicitly set by the model's default. This is the correct approach per FR-22.

  - [x] 2.3: **`response_format` note** — `gpt-image-1` via `images.edit` always returns `b64_json` by default (it does not support URL format). The `response.data[0].b64_json` access is safe. If the TypeScript types for `images.edit` do not expose `response_format`, simply omit it — the b64_json field will still be populated.

  - [x] 2.4: **`File` global availability** — In the Bun runtime, `File` and `fetch` are available as globals. In Node.js you'd need polyfills. Since this project uses Bun, no import needed.

- [x] Task 3: Export `generate` from `packages/image-gen/src/index.ts`
  - [x] 3.1: Edit `mascotinhos/packages/image-gen/src/index.ts`:
    ```typescript
    export { enrichPrompt } from "./enrich-prompt";
    export { generate } from "./generate";
    export type { GenerateInput, GenerateResult } from "./generate";
    ```

- [x] Task 4: Wire `generate()` into `/api/generate` route
  - [x] 4.1: In `mascotinhos/apps/web/src/app/api/generate/route.ts`:

    **Extend the existing `prisma.order.findUnique` select in `handleGenerate`** to include `photosUrls`:
    ```typescript
    // Change this existing select (line ~81):
    select: { id: true, orderStatus: true, conversationState: true },
    // To:
    select: { id: true, orderStatus: true, conversationState: true, photosUrls: true },
    ```

  - [x] 4.2: Add `generate` import at the top of `route.ts`:
    ```typescript
    import { enrichPrompt, generate } from "@mascotinhos/image-gen";
    ```
    Replace the existing `import { enrichPrompt } from "@mascotinhos/image-gen"` line.

  - [x] 4.3: In `handleGenerate`, replace the TODO stub block:
    ```typescript
    // TODO (Story 4.3): import { generate } from "@mascotinhos/image-gen";
    //   const genResult = await generate({ generationId: enrichResult.generationId!, promptUsed: enrichResult.promptUsed!, orderId });
    ```

    With:
    ```typescript
    // 6. IMAGE GENERATION (Story 4.3)
    let genResult: Awaited<ReturnType<typeof generate>>;
    try {
      genResult = await generate({
        generationId: enrichResult.generationId!,
        promptUsed: enrichResult.promptUsed!,
        orderId,
        photosUrls: order.photosUrls,
      });
    } catch (genErr) {
      console.log(JSON.stringify({ level: "error", event: "generate_consumer_gen_threw", orderId, attempt, error: genErr instanceof Error ? genErr.message : String(genErr), service: "web" }));
      return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
    }
    if (!genResult.success) {
      console.log(JSON.stringify({ level: "error", event: "generate_consumer_gen_failed", orderId, attempt, message: genResult.message, service: "web" }));
      return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
    }
    console.log(JSON.stringify({ level: "info", event: "generate_consumer_gen_success", orderId, attempt, generationId: enrichResult.generationId, service: "web" }));
    ```

  - [x] 4.4: Keep the remaining TODO stubs (4.4–4.6) in place after the new code:
    ```typescript
    // TODO (Story 4.4): import { qualityCheck } from "@mascotinhos/image-gen";
    // TODO (Story 4.5): import { uploadGenerated } from "@mascotinhos/storage";
    // TODO (Story 4.6): invoke deliverImage tool from bot-engine

    console.log(JSON.stringify({ level: "info", event: "generate_consumer_pipeline_stub_4_4_onward", orderId, attempt, generationId: enrichResult.generationId, service: "web" }));
    return NextResponse.json({ status: "ok" });
    ```

- [x] Task 5: Unit tests for `generate.ts`
  - [x] 5.1: Create `mascotinhos/packages/image-gen/src/generate.test.ts`.

    **Follow the exact bun:test `mock.module()` ordering pattern** — all `mock.module()` calls MUST precede static imports (same pattern as `enrich-prompt.test.ts`).

    ```typescript
    import { mock, beforeEach, describe, it, expect } from "bun:test";

    // All mock.module() calls MUST come before any imports that transitively import the mocked modules

    const mockImagesEdit = mock(() =>
      Promise.resolve({ data: [{ b64_json: "base64encodedimagedata" }] })
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
          Promise.resolve({ data: [{ b64_json: "base64encodedimagedata" }] })
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

      it("calls OpenAI images.edit with correct model, size, and prompt", async () => {
        await generate({
          generationId: TEST_GENERATION_ID,
          promptUsed: "enriched prompt text",
          orderId: TEST_ORDER_ID,
          photosUrls: TEST_PHOTOS_URLS,
        });
        const callArgs = mockImagesEdit.mock.calls[0][0] as Record<string, unknown>;
        expect(callArgs.model).toBe("gpt-image-1");
        expect(callArgs.size).toBe("1024x1024");
        expect(callArgs.prompt).toBe("enriched prompt text");
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
        // Use the MockAPIError exported from the mock.module("openai") factory above
        // so that `err instanceof OpenAI.APIError` evaluates correctly in callWithRetry.
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
        // Use the MockAPIError so instanceof check in callWithRetry works correctly
        const { default: MockOpenAI } = await import("openai");
        let callCount = 0;
        mockImagesEdit.mockImplementation(() => {
          callCount++;
          if (callCount <= 3) {
            const rateLimitErr = new (MockOpenAI as unknown as { APIError: new (msg: string, status: number) => Error & { status: number } }).APIError("Rate limit", 429);
            return Promise.reject(rateLimitErr);
          }
          return Promise.resolve({ data: [{ b64_json: "base64afterretry" }] });
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
          Promise.reject(new (MockOpenAI as unknown as { APIError: new (msg: string, status: number) => Error & { status: number } }).APIError("Rate limit", 429))
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
          Promise.resolve({ data: [{ url: "https://openai.com/image.png" }] })
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
    });
    ```

    **Note on retry test:** The `callWithRetry` helper uses `setTimeout` for delays. The `_testBaseDelayMs` field on `GenerateInput` collapses all delays to 0ms in unit tests, avoiding real waits. Always pass `_testBaseDelayMs: 0` in tests that trigger retries.

  - [x] 5.2: Add a test to `apps/web/src/app/api/generate/route.test.ts` for the Story 4.3 integration:
    - POST with valid QStash sig + GENERATING order + enrichPrompt returning success + generate returning success → 200 `{ status: "ok" }`
    - POST with valid QStash sig + GENERATING order + enrichPrompt returning success + generate returning `{ success: false }` → 500 (QStash retry)

    **Mock `@mascotinhos/image-gen`** in the route test:
    ```typescript
    const mockGenerate = mock(() =>
      Promise.resolve({ success: true, imageBase64: "base64data", message: "ok" })
    );
    mock.module("@mascotinhos/image-gen", () => ({
      enrichPrompt: mockEnrichPrompt,
      generate: mockGenerate,
    }));
    ```

    **Also update the order mock** in route test to include `photosUrls: ["references/ord/photo.jpg"]` in the `prisma.order.findUnique` mock result.

---

## Dev Notes Section

### Actual Implementation Notes

- Added `@mascotinhos/storage` and `openai ^4.0.0` to `packages/image-gen/package.json` — `openai` was not in the workspace catalog so a direct version constraint was used.
- `generate.ts` uses `images.edit` (not `images.generate`) per spec — this is required for base64 photo input with `gpt-image-1`. The `quality` parameter was intentionally omitted since `images.edit` does not support it.
- `response_format` was omitted from the `images.edit` call — `gpt-image-1` always returns `b64_json` by default and the TypeScript types do not expose `response_format` for `images.edit`.
- `Buffer` to `File` conversion required slicing to a plain `ArrayBuffer` to satisfy TypeScript strict types (`Buffer.buffer` is `ArrayBufferLike` which includes `SharedArrayBuffer`).
- `_testBaseDelayMs: 0` on `GenerateInput` is used in retry tests to collapse delays to 0ms — no real waits in tests.
- Pre-existing type errors in `enrich-prompt.ts` (`maxTokens`) and all test files (`bun:test` declarations) were present before this story and are not introduced here.

### Files Created/Modified

- `mascotinhos/packages/image-gen/package.json` — added `@mascotinhos/storage: workspace:*` and `openai: ^4.0.0` to dependencies
- `mascotinhos/packages/image-gen/src/generate.ts` — new file: core image generation function
- `mascotinhos/packages/image-gen/src/generate.test.ts` — new file: 11 unit tests
- `mascotinhos/packages/image-gen/src/index.ts` — added `generate` and type exports
- `mascotinhos/apps/web/src/app/api/generate/route.ts` — wired `generate()` call, added `photosUrls` to select, replaced TODO stub
- `mascotinhos/apps/web/src/app/api/generate/route.test.ts` — added `mockGenerate`, updated `makeGeneratingOrder` with `photosUrls`, added 2 new Story 4.3 integration tests
- `mascotinhos/bun.lock` — updated by `bun install`

### Testing Approach

- All `mock.module()` calls precede static imports (same ordering pattern as `enrich-prompt.test.ts`).
- `global.fetch` is patched directly before the static import — works correctly with Bun's module system.
- The `MockAPIError` class is defined inside `mock.module("openai")` factory so `err instanceof OpenAI.APIError` evaluates correctly in `callWithRetry`.
- Tests that trigger retries pass `_testBaseDelayMs: 0` to avoid real `setTimeout` waits.

### Review Findings — 2026-03-30

**Reviewer:** adversarial + edge-case + acceptance audit (automated)
**Verdict:** APPROVED WITH PATCHES APPLIED

#### HIGH — Fixed

**[H1] `quality: "high"` missing from `images.edit` call**
- AC explicitly requires `quality: "high"` (FR-22). The call omitted it, meaning the API defaults to standard quality.
- **Fix:** Added `quality: "high"` to the `client.images.edit({...})` call in `generate.ts`.
- Test updated: assertion added for `callArgs.quality === "high"` in `generate.test.ts`.

**[H2] `maxDuration` not exported from `/api/generate/route.ts`**
- NFR-02 requires the pipeline to complete within 2 minutes. Without `maxDuration = 300`, Vercel defaults to 10s for hobby plans, immediately killing in-flight OpenAI calls (typically 20–60s).
- **Fix:** Added `export const maxDuration = 300;` at the top of `route.ts` with an explanatory comment.

#### MEDIUM — Fixed

**[M1] `generate()` throws branch in route.ts had no test coverage**
- The `catch (genErr)` block in `handleGenerate` returned HTTP 500 but was never exercised by any test. Any unexpected throw (SDK crash, network failure below the retry loop) would silently suppress the error path in CI.
- **Fix:** Added test `"generate throws unexpectedly → 500 (QStash retry)"` to `route.test.ts`.

**[M2] `OpenAI` client instantiated on every `generate()` call**
- A new `OpenAI({apiKey})` instance was created per invocation, wasting HTTP connection setup and deferring invalid-key detection to first call.
- **Fix:** Replaced with a lazy module-level singleton `getClient()`. Exposed `_resetClientForTests()` for test isolation.

#### MEDIUM — Deferred

**[D1] No path-prefix validation on `photosUrls` entries** — see deferred-work.md
**[D2] `Buffer.slice()` deprecation in future Node.js versions** — current usage already uses the correct `buffer.slice()` via ArrayBuffer; low risk but worth noting for Node.js 22+ migration.
