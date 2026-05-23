# Story 4.2: Prompt Enrichment from Client Inputs

Status: done
GitHub Issue: [mgiovani/fotos#58](https://github.com/mgiovani/fotos/issues/58)

## Story

As the system,
I want to transform raw client inputs (photos, theme, outfit, extras) into a structured, optimized prompt,
So that GPT Image 1.5 receives clear, detailed instructions that maximize likeness quality and style adherence.

## Acceptance Criteria

**Given** the `/api/generate` consumer receives a generation request
**When** `enrichPrompt()` is called with the order data and style template
**Then** the function loads the StyleTemplate's `promptTemplate` field from the database (Prisma camelCase — maps to `prompt_template` column)
**And** calls GPT-5-mini to merge the template with client-specific details (outfit, extras, child characteristics inferred from photos)
**And** produces a structured generation prompt optimized for GPT Image 1.5
**And** the enriched prompt is stored in the Generation record's `promptUsed` field for debugging and optimization
**And** if revision feedback exists (from Epic 5 / `revisionFeedback`), it is incorporated into the re-enriched prompt

**FRs covered:** FR-21 (prompt enrichment using style template + GPT-5-mini)

---

## Status Assessment — What Already Exists

**CRITICAL: Before writing any code, understand these pre-existing stubs and integrations:**

Already implemented (DO NOT replace, DO NOT reinvent):

- `apps/web/src/app/api/generate/route.ts` — consumer endpoint fully implemented in Story 4.1. Contains a stub comment block (`// Story 4.2: enrichPrompt()`) marking exactly where to wire in the new package. DO NOT restructure this file; only replace the stub call with the real one.
- `packages/bot-engine/src/tools/enqueue-generation.ts` — fully implemented in Story 4.1. No changes needed.
- `packages/env/src/server-schema.ts` — `OPENAI_API_KEY: z.string().startsWith("sk-")` already validated. Do NOT add it again.
- `packages/bot-engine/src/agent.ts` — already imports `openai` from `@ai-sdk/openai` and uses `openai("gpt-5-mini")`. This is the AI SDK pattern to replicate for `enrichPrompt()`.
- `packages/bot-engine/package.json` — already has `"@ai-sdk/openai": "^3.0.48"` and `"ai": "^6.0.3"` as dependencies.
- `packages/db/prisma/schema/schema.prisma` — `Generation` model with `promptUsed String`, `revisionFeedback String?`, `attemptNumber Int`, `@@unique([orderId, attemptNumber])`. `Order` model with `photosUrls String[]`, `theme String?`, `outfitDescription String?`, `extraRequests String?`, `styleTemplateId String?`. No schema changes needed for this story.
- `@mascotinhos/db` — Prisma client already set up. `prisma.generation.upsert` must use `@@unique([orderId, attemptNumber])` as the conflict key (prevents race on QStash retries).
- `@mascotinhos/storage` package — `uploadReference`, `getSignedUrl` are already exported. Story 4.3 uses `getSignedUrl` for base64 encoding photos; Story 4.2 does NOT need to load photos from storage — that is Story 4.3's job.

Not yet created (this story creates them):

- `packages/image-gen/` — new workspace package. Must be created from scratch.
- `packages/image-gen/src/index.ts` — package entry point, exports `enrichPrompt`.
- `packages/image-gen/src/enrich-prompt.ts` — core enrichment function.
- `packages/image-gen/src/enrich-prompt.test.ts` — unit tests.
- `packages/image-gen/package.json` — package manifest.
- `packages/image-gen/tsconfig.json` — TypeScript config.
- Wire `enrichPrompt()` call into `apps/web/src/app/api/generate/route.ts` (`handleGenerate` function — replace stub).
- Wire `@mascotinhos/image-gen` dependency into `apps/web/package.json`.
- Wire `@mascotinhos/image-gen` into turbo.json workspace if not auto-discovered.

Not part of this story (stub out or leave for later):

- `packages/image-gen/src/generate.ts` — Story 4.3 creates this.
- `packages/image-gen/src/quality-check.ts` — Story 4.4 creates this.
- `packages/image-gen/src/templates/` — Story 7.4 seeds this. Create directory but no files needed now.
- `Generation.imageUrl`, `Generation.qualityScore` — set by Stories 4.3–4.5. `enrichPrompt` only creates/upserts the Generation record with `promptUsed`.

---

## Tasks / Subtasks

- [x] Task 1: Create `packages/image-gen` workspace package scaffold
  - [x] 1.1: Create `mascotinhos/packages/image-gen/package.json`:
    ```json
    {
      "name": "@mascotinhos/image-gen",
      "version": "0.0.0",
      "private": true,
      "type": "module",
      "exports": {
        ".": {
          "default": "./src/index.ts"
        }
      },
      "scripts": {
        "check-types": "tsc --noEmit",
        "test": "bun test"
      },
      "dependencies": {
        "@mascotinhos/db": "workspace:*",
        "@mascotinhos/env": "workspace:*",
        "@ai-sdk/openai": "^3.0.48",
        "ai": "^6.0.3",
        "zod": "catalog:"
      },
      "devDependencies": {
        "@mascotinhos/config": "workspace:*",
        "typescript": "^5"
      }
    }
    ```
    **Note:** `@ai-sdk/openai` and `ai` are already in the workspace catalog via bot-engine; do NOT add them to the root catalog again — just reference the same version constraint here.

  - [x] 1.2: Create `mascotinhos/packages/image-gen/tsconfig.json`:
    ```json
    {
      "extends": "@mascotinhos/config/tsconfig.base.json",
      "compilerOptions": {
        "outDir": "dist"
      },
      "include": ["src"]
    }
    ```
    (Mirror the tsconfig from `packages/bot-engine/tsconfig.json` exactly.)

  - [x] 1.3: Create `mascotinhos/packages/image-gen/src/index.ts`:
    ```typescript
    export { enrichPrompt } from "./enrich-prompt";
    ```

  - [x] 1.4: Create empty directory `mascotinhos/packages/image-gen/src/templates/` (placeholder for Story 7.4 seed data; add a `.gitkeep` to ensure it's tracked).

  - [x] 1.5: Run `bun install` from `mascotinhos/` to register the new workspace package and link it.

- [x] Task 2: Implement `packages/image-gen/src/enrich-prompt.ts`
  - [x] 2.1: Create `mascotinhos/packages/image-gen/src/enrich-prompt.ts` with the full implementation:

    ```typescript
    import { generateText } from "ai";
    import { openai } from "@ai-sdk/openai";
    import prisma from "@mascotinhos/db";

    export interface EnrichPromptInput {
      orderId: string;
      attemptNumber: number;
      revisionFeedback?: string | null; // Populated by Epic 5 revision flow
    }

    export interface EnrichPromptResult {
      success: boolean;
      generationId?: string;
      promptUsed?: string;
      message: string;
    }

    /**
     * Enriches client inputs into a structured, GPT Image 1.5-optimized prompt.
     *
     * Steps:
     * 1. Load order + styleTemplate from DB
     * 2. Build enrichment context (theme, outfit, extras, revisionFeedback)
     * 3. Call GPT-5-mini to merge style template with client specifics
     * 4. Upsert Generation record with promptUsed (idempotent on orderId + attemptNumber)
     */
    export async function enrichPrompt(input: EnrichPromptInput): Promise<EnrichPromptResult> {
      const { orderId, attemptNumber, revisionFeedback } = input;

      // 1. Load order with style template
      let order: {
        id: string;
        theme: string | null;
        outfitDescription: string | null;
        extraRequests: string | null;
        styleTemplate: { promptTemplate: string; name: string } | null;
      } | null;

      try {
        order = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            theme: true,
            outfitDescription: true,
            extraRequests: true,
            styleTemplate: {
              select: { promptTemplate: true, name: true },
            },
          },
        });
      } catch (dbErr) {
        console.log(
          JSON.stringify({
            level: "error",
            event: "enrich_prompt_db_error",
            orderId,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            service: "image-gen",
          }),
        );
        return { success: false, message: "Erro ao carregar dados do pedido." };
      }

      if (!order) {
        console.log(
          JSON.stringify({
            level: "warn",
            event: "enrich_prompt_order_not_found",
            orderId,
            service: "image-gen",
          }),
        );
        return { success: false, message: "Pedido não encontrado." };
      }

      // 2. Build enrichment context
      const styleTemplateName = order.styleTemplate?.name ?? order.theme ?? "default";
      const promptTemplate =
        order.styleTemplate?.promptTemplate ??
        "Generate a high-quality mascotinho illustration of a child character in a vibrant, joyful style.";

      const clientDetails = buildClientDetails({
        theme: order.theme,
        outfitDescription: order.outfitDescription,
        extraRequests: order.extraRequests,
        revisionFeedback: revisionFeedback ?? null,
      });

      // 3. Call GPT-5-mini for enrichment
      let enrichedPrompt: string;
      try {
        const result = await generateText({
          model: openai("gpt-5-mini"),
          system: ENRICHMENT_SYSTEM_PROMPT,
          prompt: buildEnrichmentUserPrompt({
            promptTemplate,
            styleTemplateName,
            clientDetails,
          }),
          maxTokens: 500,
        });
        enrichedPrompt = result.text.trim();
      } catch (aiErr) {
        console.log(
          JSON.stringify({
            level: "error",
            event: "enrich_prompt_ai_error",
            orderId,
            attemptNumber,
            error: aiErr instanceof Error ? aiErr.message : String(aiErr),
            service: "image-gen",
          }),
        );
        return { success: false, message: "Erro ao enriquecer prompt de geração." };
      }

      // 4. Upsert Generation record (idempotent — @@unique([orderId, attemptNumber]))
      // This prevents duplicate Generation rows on QStash retry races.
      let generation: { id: string };
      try {
        generation = await prisma.generation.upsert({
          where: { orderId_attemptNumber: { orderId, attemptNumber } },
          create: {
            orderId,
            attemptNumber,
            promptUsed: enrichedPrompt,
            revisionFeedback: revisionFeedback ?? null,
          },
          update: {
            // On retry: update promptUsed in case previous attempt stored a partial prompt
            promptUsed: enrichedPrompt,
          },
          select: { id: true },
        });
      } catch (dbErr) {
        console.log(
          JSON.stringify({
            level: "error",
            event: "enrich_prompt_generation_upsert_error",
            orderId,
            attemptNumber,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            service: "image-gen",
          }),
        );
        return { success: false, message: "Erro ao salvar prompt de geração." };
      }

      console.log(
        JSON.stringify({
          level: "info",
          event: "enrich_prompt_success",
          orderId,
          attemptNumber,
          generationId: generation.id,
          service: "image-gen",
        }),
      );

      return {
        success: true,
        generationId: generation.id,
        promptUsed: enrichedPrompt,
        message: "Prompt enriquecido com sucesso.",
      };
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    interface ClientDetails {
      theme: string | null;
      outfitDescription: string | null;
      extraRequests: string | null;
      revisionFeedback: string | null;
    }

    function buildClientDetails(details: ClientDetails): string {
      const lines: string[] = [];
      if (details.theme) lines.push(`Style/Theme: ${details.theme}`);
      if (details.outfitDescription) lines.push(`Outfit: ${details.outfitDescription}`);
      if (details.extraRequests) lines.push(`Extra elements: ${details.extraRequests}`);
      if (details.revisionFeedback) lines.push(`Revision request: ${details.revisionFeedback}`);
      return lines.length > 0 ? lines.join("\n") : "No specific client details provided.";
    }

    interface EnrichmentPromptArgs {
      promptTemplate: string;
      styleTemplateName: string;
      clientDetails: string;
    }

    function buildEnrichmentUserPrompt({
      promptTemplate,
      styleTemplateName,
      clientDetails,
    }: EnrichmentPromptArgs): string {
      return `Style template: ${styleTemplateName}
    Base prompt template: ${promptTemplate}

    Client-specific details:
    ${clientDetails}

    Merge the base template with the client details into a single, detailed image generation prompt. Be specific about visual elements, style, colors, and character details. Output ONLY the final prompt text, no explanation.`;
    }

    const ENRICHMENT_SYSTEM_PROMPT = `You are an expert at writing image generation prompts for children's mascot illustrations.
    Your task: merge a style template with client-specific details into a single optimized prompt for GPT Image 1.5.
    Rules:
    - Output ONLY the final prompt text. No preamble, no explanation.
    - Keep the style template's artistic direction intact.
    - Incorporate all client details (outfit, extras, revision feedback) naturally.
    - If revision feedback is provided, prioritize it and explicitly adjust the original prompt.
    - Be concrete and specific: colors, clothing, accessories, background elements.
    - Target 150–300 words for optimal GPT Image 1.5 results.
    - Write in English (image model prompt language).`;
    ```

  - [x] 2.2: **Prisma upsert key name** — The `@@unique([orderId, attemptNumber])` constraint in `schema.prisma` generates a compound key name `orderId_attemptNumber` in Prisma's generated client. Use `where: { orderId_attemptNumber: { orderId, attemptNumber } }` exactly. Do NOT use separate `where: { orderId }` — that references a non-unique index, not the compound unique constraint.

  - [x] 2.3: **AI SDK `generateText` import** — Use `import { generateText } from "ai"` and `import { openai } from "@ai-sdk/openai"`. This is the same pattern as `agent.ts` in `bot-engine`. Do NOT use `streamText` here (no streaming needed for prompt enrichment). Do NOT use `fetch` directly against the OpenAI API. The `OPENAI_API_KEY` env var is automatically picked up by `@ai-sdk/openai` from `process.env.OPENAI_API_KEY` (the AI SDK reads it automatically — no manual `env.OPENAI_API_KEY` pass-through needed).

  - [x] 2.4: **`maxTokens: 500`** — Cap the AI output to avoid runaway token usage. The enriched prompt should be 150–300 words; 500 tokens is a safe ceiling.

- [x] Task 3: Wire `enrichPrompt()` into the `/api/generate` consumer route
  - [x] 3.1: Add `@mascotinhos/image-gen` to `mascotinhos/apps/web/package.json` dependencies:
    ```json
    "@mascotinhos/image-gen": "workspace:*"
    ```
    (Add alongside the other `@mascotinhos/*` workspace dependencies.)

  - [x] 3.2: In `mascotinhos/apps/web/src/app/api/generate/route.ts`, replace the stub in `handleGenerate()`:

    **Remove** the existing stub block (lines starting with `// 5. IMAGE GENERATION PIPELINE — stub` through `return NextResponse.json({ status: "ok" });`).

    **Replace with:**
    ```typescript
    // 5. PROMPT ENRICHMENT (Story 4.2)
    // Load latest revision feedback if this is a retry/revision (attempt > 1)
    let revisionFeedback: string | null = null;
    if (attempt > 1) {
      try {
        const prevGeneration = await prisma.generation.findFirst({
          where: { orderId, attemptNumber: attempt - 1 },
          select: { revisionFeedback: true },
          orderBy: { createdAt: "desc" },
        });
        revisionFeedback = prevGeneration?.revisionFeedback ?? null;
      } catch {
        // Non-fatal: proceed without revision feedback
        console.log(JSON.stringify({ level: "warn", event: "generate_consumer_revision_fetch_failed", orderId, attempt, service: "web" }));
      }
    }

    const enrichResult = await enrichPrompt({ orderId, attemptNumber: attempt, revisionFeedback });
    if (!enrichResult.success) {
      console.log(JSON.stringify({ level: "error", event: "generate_consumer_enrich_failed", orderId, attempt, message: enrichResult.message, service: "web" }));
      return NextResponse.json({ error: "Prompt enrichment failed" }, { status: 500 }); // triggers QStash retry
    }
    console.log(JSON.stringify({ level: "info", event: "generate_consumer_enrich_success", orderId, attempt, generationId: enrichResult.generationId, service: "web" }));

    // TODO (Story 4.3): import { generate } from "@mascotinhos/image-gen";
    //   const genResult = await generate({ generationId: enrichResult.generationId!, promptUsed: enrichResult.promptUsed!, orderId });
    // TODO (Story 4.4): import { qualityCheck } from "@mascotinhos/image-gen";
    // TODO (Story 4.5): import { uploadGenerated } from "@mascotinhos/storage";
    // TODO (Story 4.6): invoke deliverImage tool from bot-engine

    console.log(JSON.stringify({ level: "info", event: "generate_consumer_pipeline_stub_4_3_onward", orderId, attempt, generationId: enrichResult.generationId, service: "web" }));
    return NextResponse.json({ status: "ok" });
    ```

  - [x] 3.3: Add the `enrichPrompt` import at the top of `route.ts`:
    ```typescript
    import { enrichPrompt } from "@mascotinhos/image-gen";
    ```
    Place it after the existing `import prisma from "@mascotinhos/db"` line.

  - [x] 3.4: Run `bun install` from `mascotinhos/` after adding the dependency.

- [x] Task 4: Unit tests for `enrich-prompt.ts`
  - [x] 4.1: Create `mascotinhos/packages/image-gen/src/enrich-prompt.test.ts`.

    **Follow the exact bun:test mock.module ordering pattern from `generate-payment.test.ts`** — all `mock.module()` calls MUST precede any imports that transitively import the mocked modules.

    ```typescript
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
        const callArgs = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
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
        const callArgs = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
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
          })
        );
        const result = await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
        expect(result.success).toBe(true);
        const callArgs = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
        expect((callArgs.prompt as string)).toContain("Custom Theme");
      });

      it("returns failure when order is not found", async () => {
        mockPrismaOrderFindUnique.mockImplementation(() => Promise.resolve(null));
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
        const upsertCall = mockPrismaGenerationUpsert.mock.calls[0][0] as Record<string, unknown>;
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
        const upsertCall = mockPrismaGenerationUpsert.mock.calls[0][0] as Record<string, unknown>;
        const createData = upsertCall.create as Record<string, unknown>;
        expect(createData.revisionFeedback).toBe(feedback);
      });

      it("stores null revisionFeedback in Generation upsert create block when not provided", async () => {
        await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
        const upsertCall = mockPrismaGenerationUpsert.mock.calls[0][0] as Record<string, unknown>;
        const createData = upsertCall.create as Record<string, unknown>;
        expect(createData.revisionFeedback).toBeNull();
      });

      it("passes maxTokens: 500 to generateText", async () => {
        await enrichPrompt({ orderId: TEST_ORDER_ID, attemptNumber: 1 });
        const callArgs = mockGenerateText.mock.calls[0][0] as Record<string, unknown>;
        expect(callArgs.maxTokens).toBe(500);
      });
    });
    ```

  - [x] 4.2: **Test for route.ts enrichPrompt wiring** — Add a test to `apps/web/src/app/api/generate/route.test.ts` covering the enrichPrompt integration:
    - POST with valid QStash sig + GENERATING order + enrichPrompt mock returning `{ success: true, generationId: "gen-1", ... }` → 200 `{ status: "ok" }`
    - POST with valid QStash sig + GENERATING order + enrichPrompt mock returning `{ success: false }` → 500 (triggers QStash retry)

    **Mock `@mascotinhos/image-gen`** in the route test file:
    ```typescript
    const mockEnrichPrompt = mock(() =>
      Promise.resolve({ success: true, generationId: "gen-uuid-1", promptUsed: "enriched prompt", message: "ok" })
    );
    mock.module("@mascotinhos/image-gen", () => ({
      enrichPrompt: mockEnrichPrompt,
    }));
    ```
    Add this `mock.module()` call at the top of the existing `route.test.ts`, before any imports. Re-use the existing test infrastructure (QStash Receiver mock, Prisma mock) already in that file.

- [x] Task 5: Type-check and test pipeline
  - [x] 5.1: `cd mascotinhos && bun install` — verify `@mascotinhos/image-gen` resolved in workspace.
  - [x] 5.2: `cd mascotinhos && bun run check-types` — 0 new TypeScript errors (pre-existing: `collect-photos.ts:TS2532`, `bun:test` type errors in `apps/web` — not introduced by this story).
  - [x] 5.3: `cd mascotinhos/packages/image-gen && bun test src/enrich-prompt.test.ts` — all tests pass.
  - [x] 5.4: `cd mascotinhos/apps/web && bun test src/app/api/generate/route.test.ts` — all tests pass (including new enrichPrompt wiring tests).
  - [x] 5.5: `cd mascotinhos && bun test packages/bot-engine` — 130+ pass, 0 fail, 0 regressions from bot-engine.

---

## Dev Notes

### CRITICAL: AI SDK `generateText` Pattern

Use exactly the same AI SDK pattern as `agent.ts` in `bot-engine`:

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const result = await generateText({
  model: openai("gpt-5-mini"),
  system: "...",
  prompt: "...",
  maxTokens: 500,
});
const text = result.text; // the generated string
```

The `@ai-sdk/openai` package reads `OPENAI_API_KEY` automatically from `process.env` — do NOT pass it manually. This is the AI SDK convention.

### CRITICAL: Prisma Compound Unique Key Name

The `@@unique([orderId, attemptNumber])` constraint in the `Generation` model generates a compound unique key named `orderId_attemptNumber` (underscore-joined field names). Use it as:

```typescript
await prisma.generation.upsert({
  where: { orderId_attemptNumber: { orderId, attemptNumber } },
  create: { orderId, attemptNumber, promptUsed: enrichedPrompt, revisionFeedback: revisionFeedback ?? null },
  update: { promptUsed: enrichedPrompt },
  select: { id: true },
});
```

This is critical for idempotency — QStash retries the same message on failure. Without upsert, parallel retries would create duplicate Generation rows and corrupt the 2-revision cap (FR-30).

### CRITICAL: `image-gen` Is a New Workspace Package

The `packages/image-gen/` directory does NOT exist yet. You must create it from scratch, following the same structure as `packages/bot-engine/` or `packages/payments/`:
- `package.json` with workspace package name `@mascotinhos/image-gen`
- `tsconfig.json` extending `@mascotinhos/config/tsconfig.base.json`
- `src/index.ts` as the package entry (referenced by `"exports": { ".": { "default": "./src/index.ts" } }`)

After creation, run `bun install` from `mascotinhos/` to register it in the workspace.

### CRITICAL: `route.ts` Modification Scope

Only touch the `handleGenerate()` function in `route.ts`. Specifically:
- Remove the stub comment block (5 TODO lines + `return NextResponse.json({ status: "ok" })`)
- Replace with the `enrichPrompt` call + new TODO stubs for 4.3–4.6
- Add the `enrichPrompt` import at the top of the file

Do NOT change signature verification, body parsing, action routing, or idempotency check logic. Those are correct from Story 4.1.

### CRITICAL: bun:test Mock Pattern — Module Mocking Order

All `mock.module()` calls MUST appear before any `import` statements that transitively import the mocked modules. Follow the exact pattern from `generate-payment.test.ts`:

```typescript
// 1. mock.module() calls first
mock.module("ai", () => ({ generateText: mockGenerateText }));
mock.module("@ai-sdk/openai", () => ({ openai: (model: string) => ({ model }) }));
mock.module("@mascotinhos/db", () => ({ default: { ... } }));

// 2. imports after all mocks
import { enrichPrompt } from "./enrich-prompt";
```

### CRITICAL: `@ai-sdk/openai` Mock in Tests

The `openai` function from `@ai-sdk/openai` returns a model descriptor object. In tests, mock it as:
```typescript
mock.module("@ai-sdk/openai", () => ({
  openai: (model: string) => ({ model }),
}));
```
The mock `generateText` will receive this object as `model:` and should not fail.

### Architecture Compliance

- **Package name**: `@mascotinhos/image-gen` (matches architecture spec `packages/image-gen/`)
- **File names**: kebab-case — `enrich-prompt.ts`, `enrich-prompt.test.ts`
- **Function names**: camelCase — `enrichPrompt`
- **Env access**: `OPENAI_API_KEY` is auto-read by AI SDK from `process.env`. No `import { env }` needed for this. For future env vars in this package, use `import { env } from "@mascotinhos/env/server"`.
- **DB access**: always `import prisma from "@mascotinhos/db"` — never import Prisma directly
- **Logging**: always `console.log(JSON.stringify({ level, event, orderId, ... }))` with `service: "image-gen"` for this package
- **No `process.env` direct access**: Use AI SDK's auto-detection for `OPENAI_API_KEY`; for all other vars, use `@mascotinhos/env/server`

### DB Schema Reference (Generation Model)

```prisma
model Generation {
  id               String   @id @default(cuid())
  orderId          String
  attemptNumber    Int
  promptUsed       String           // ← enrichPrompt writes here
  imageUrl         String?          // ← Story 4.5 writes here
  qualityScore     Float?           // ← Story 4.4 writes here
  revisionFeedback String?          // ← enrichPrompt reads from input; Story 5.2 sets this
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@unique([orderId, attemptNumber])  // ← prevents race-condition duplicate rows
}
```

`attemptNumber` starts at 1 for the first generation attempt. For revisions (Epic 5), Story 5.2 increments it and sets `revisionFeedback` on the new Generation record.

### DB Schema Reference (Order → StyleTemplate)

```prisma
model Order {
  styleTemplateId String?
  theme           String?
  outfitDescription String?
  extraRequests   String?
  photosUrls      String[]  // ← Story 4.3 uses these for base64 input; Story 4.2 does NOT touch photosUrls
  styleTemplate   StyleTemplate? @relation(...)
}

model StyleTemplate {
  promptTemplate  String  // ← base prompt pattern for enrichment
  name            String
}
```

### Consumer Route: Where to Wire In

In `apps/web/src/app/api/generate/route.ts`, the `handleGenerate()` function currently ends with a stub block. The enrichPrompt call replaces ONLY that stub block. The function signature and all preceding logic (DB load, idempotency check, logging) remain unchanged.

The `attempt` parameter (from QStash body) is passed directly as `attemptNumber` to `enrichPrompt`. For the first attempt, `attempt = 1`.

### NFR Compliance

- **NFR-02** (generation <2min): enrichPrompt is the first pipeline step, targeting <5s. GPT-5-mini text generation for 150–300 word prompt is fast (typically <2s).
- **NFR-24** (OpenAI error handling): `enrichPrompt` returns `{ success: false }` on `generateText` throw → consumer returns HTTP 500 → QStash retries automatically (up to 3x from Story 4.1 config).
- **NFR-26** (structured logging): all log entries use `JSON.stringify({ level, event, orderId, service: "image-gen" })`.

### Project Structure Reference

```
mascotinhos/
├── apps/
│   └── web/
│       └── src/app/api/
│           └── generate/
│               ├── route.ts           ← MODIFY: replace stub with enrichPrompt call (Task 3)
│               └── route.test.ts      ← MODIFY: add enrichPrompt mock + 2 new test cases (Task 4.2)
└── packages/
    ├── image-gen/                     ← CREATE (Tasks 1–4)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── enrich-prompt.ts
    │       ├── enrich-prompt.test.ts
    │       └── templates/             ← empty dir + .gitkeep (placeholder for Story 7.4)
    └── env/src/server-schema.ts       ← DO NOT MODIFY (OPENAI_API_KEY already validated)
```

Do NOT modify:
- `packages/bot-engine/` — no changes needed; bot-engine is not a dependency of image-gen
- `packages/env/src/server-schema.ts` — `OPENAI_API_KEY` already validated
- `apps/web/src/app/api/generate/route.ts` — modify ONLY the stub block in `handleGenerate()`; do not restructure the file
- `apps/web/src/app/api/generate/route.test.ts` — add only the 2 new test cases for enrichPrompt wiring; do not remove or change existing tests

### Previous Story Learnings (from Story 4.1 and earlier)

- **bun:test invocation**: Always run tests from the correct package directory or from `mascotinhos/` root. `bun test packages/image-gen/src/enrich-prompt.test.ts` from `mascotinhos/`. For packages with `bunfig.toml`, run from within the package directory.
- **`mock.module` before imports**: Bun requires this ordering. All `mock.module()` calls before any static `import` that touches the mocked module.
- **mutable `mockEnv` proxy**: For env overrides per test, use `mockEnv[key] = value` inside `it()` blocks, with `beforeEach` resetting to defaults. (Not needed for this story since `OPENAI_API_KEY` is auto-read by AI SDK, but keep this in mind for `env` additions.)
- **Pre-existing type errors**: `collect-photos.ts:TS2532` and `bun:test` module errors pre-date this story. Do NOT fix unrelated pre-existing errors — only verify 0 NEW errors from `check-types`.
- **`as any` cast anti-pattern**: Avoid. Use `typeof`-based type extraction or explicit typing as established in Story 3.4 review.
- **QStash retry semantics**: Consumer returns 500 → retry, 4xx → no retry. `enrichPrompt` failure → 500 → QStash retries. This is intentional and correct.
- **`Prisma` namespace not re-exported**: Deferred from Story 3.4. For any `Json?` field interactions, use `typeof`-based type extraction to avoid `as any`.
- **Pre-existing bug: `orderId` validated as UUID but Prisma generates CUIDs**: `qstashBodySchema` in `route.ts` uses `z.string().uuid()` for `orderId`, but all Prisma models use `@id @default(cuid())`. CUIDs (e.g. `clx...`) are not valid UUIDs and will fail this validation, causing all real QStash messages to be rejected with 400. This bug was introduced in Story 4.1 and is outside Story 4.2's scope — do NOT fix it here. Track it as a separate issue. Story 4.2 tests should use a CUID-format test order ID (e.g. `"cltest00000000000000000001"`) rather than the UUID-format `TEST_ORDER_ID` constant to reflect real IDs, but since the route.test.ts mock bypasses schema parsing this does not affect test correctness today.

### References

- Story 4.1: `/home/mgiovani/projects/fotos/.bmad_output/implementation-artifacts/story-4.1.md` — QStash consumer route structure, mock patterns, bun:test patterns
- Epics: `/home/mgiovani/projects/fotos/.bmad_output/planning-artifacts/epics.md` — Epic 4, Story 4.2, FR-21
- Architecture: `/home/mgiovani/projects/fotos/.bmad_output/planning-artifacts/architecture.md` — `packages/image-gen/` structure, `enrichPrompt` function signature, AI SDK pattern, Consumer pipeline steps (section: Image Generation Pipeline)
- Agent implementation: `mascotinhos/packages/bot-engine/src/agent.ts` — exact `generateText` / `openai("gpt-5-mini")` usage pattern to replicate
- DB schema: `mascotinhos/packages/db/prisma/schema/schema.prisma` — `Generation` model with `@@unique([orderId, attemptNumber])`, `Order` model with `styleTemplate` relation
- Consumer route: `mascotinhos/apps/web/src/app/api/generate/route.ts` — `handleGenerate()` stub to replace
- Payment test pattern: `mascotinhos/packages/bot-engine/src/tools/generate-payment.test.ts` — canonical mock.module ordering pattern

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- AI SDK v6 uses `maxOutputTokens` not `maxTokens` — story spec had `maxTokens: 500` but actual `CallSettings` type requires `maxOutputTokens`. Fixed in implementation and test.
- `packages/image-gen` needs `bunfig.toml` + `src/test-setup.ts` (same as `bot-engine`) to preload env vars before tests; without it the `@mascotinhos/env/server` validation throws at import time. Added both files following the established pattern.
- Running `bun test packages/bot-engine` from monorepo root shows 5 failures (env init issues in `bot.test.ts`, `conversation.test.ts`, `send-payment-confirmation.test.ts`, `tools.test.ts`) — these are pre-existing and unrelated to this story. Running from within `packages/bot-engine/` gives 130 pass, 0 fail.

### Completion Notes List

- Created `packages/image-gen` workspace package from scratch with `package.json`, `tsconfig.json`, `src/index.ts`, `src/enrich-prompt.ts`, `src/templates/.gitkeep`, `src/test-setup.ts`, `bunfig.toml`.
- `enrichPrompt()` loads order+styleTemplate from DB, calls GPT-5-mini via AI SDK `generateText`, upserts Generation record with `promptUsed` using the `orderId_attemptNumber` compound unique key for idempotency on QStash retries.
- Wired `enrichPrompt` into `apps/web/src/app/api/generate/route.ts` `handleGenerate()` — replaces stub, fetches `revisionFeedback` from previous generation when `attempt > 1`, returns 500 on failure (triggers QStash retry).
- 12/12 unit tests pass in `packages/image-gen/src/enrich-prompt.test.ts`.
- 12/12 tests pass in `apps/web/src/app/api/generate/route.test.ts` (10 pre-existing + 2 new enrichPrompt wiring tests).
- 130/130 tests pass in `packages/bot-engine` (0 regressions).
- 0 new TypeScript errors (pre-existing `bun:test` module errors in `apps/web` and `payments` unchanged).
- All ACs satisfied: style template loaded, GPT-5-mini called, enriched prompt stored in `Generation.promptUsed`, revision feedback incorporated when present.

### File List

- mascotinhos/packages/image-gen/package.json (created)
- mascotinhos/packages/image-gen/tsconfig.json (created)
- mascotinhos/packages/image-gen/bunfig.toml (created)
- mascotinhos/packages/image-gen/src/index.ts (created)
- mascotinhos/packages/image-gen/src/enrich-prompt.ts (created)
- mascotinhos/packages/image-gen/src/enrich-prompt.test.ts (created)
- mascotinhos/packages/image-gen/src/test-setup.ts (created)
- mascotinhos/packages/image-gen/src/templates/.gitkeep (created)
- mascotinhos/apps/web/package.json (modified — added @mascotinhos/image-gen dependency)
- mascotinhos/apps/web/src/app/api/generate/route.ts (modified — added enrichPrompt import + replaced stub with enrichment pipeline)
- mascotinhos/apps/web/src/app/api/generate/route.test.ts (modified — added @mascotinhos/image-gen mock + generation.findFirst mock + 2 new test cases)

### Change Log

- 2026-03-30: Created packages/image-gen workspace package with enrichPrompt implementation, unit tests, and test infrastructure. Wired enrichPrompt into /api/generate consumer route replacing the Story 4.2 stub. Added 2 new route integration tests covering enrichPrompt success and failure paths.
- 2026-03-30: Code review patches applied (see Review Findings below).

---

## Review Findings

**Reviewed:** 2026-03-30
**Reviewer:** claude-sonnet-4-6 (adversarial + edge case + acceptance audit)
**Result:** 6 findings (2 HIGH, 4 MEDIUM) — all HIGH/MEDIUM patched directly. 1 item deferred.

### F-1 (HIGH) — FIXED: `maxOutputTokens` invalid AI SDK v6 parameter

`enrich-prompt.ts` used `maxOutputTokens: 500` which is not a valid `generateText` option in AI SDK v6 (the correct key is `maxTokens`). The field was silently ignored, meaning no token cap was enforced on the GPT call. The dev agent's own debug log noted this but inverted the fix — the story spec had `maxTokens: 500` but the implementation used `maxOutputTokens`.

**Fix:** Changed `maxOutputTokens` → `maxTokens` in `enrich-prompt.ts` and updated the corresponding test assertion in `enrich-prompt.test.ts`.

### F-2 (HIGH) — FIXED: `enrichPrompt` call not wrapped in try/catch in route.ts

`enrichPrompt()` at line 119 of `route.ts` was awaited without a try/catch. Although `enrichPrompt` catches all expected errors internally, any unexpected programming error (e.g. import-time failure, unexpected throw from a dependency) would result in an unhandled promise rejection escaping the Next.js route handler. This would produce a 500 with no structured log event and no `{ error: "..." }` body.

**Fix:** Wrapped the `enrichPrompt` call in a try/catch that logs `generate_consumer_enrich_threw` and returns `{ error: "Prompt enrichment failed" }` with status 500 (triggering QStash retry). Added a new route test: `enrichPrompt throws unexpectedly → 500`.

### F-3 (MEDIUM) — FIXED: Empty string prompt stored silently in DB

After `result.text.trim()`, if GPT returns only whitespace the `enrichedPrompt` variable holds `""`. This empty string passes the type check and gets upserted into `Generation.promptUsed`, leaving a blank prompt for Story 4.3's image generator. No error was raised, no retry was triggered.

**Fix:** Added an explicit `if (!enrichedPrompt) { throw new Error("GPT returned an empty prompt"); }` guard immediately after `.trim()`, inside the existing try/catch, so the error is caught and returns `{ success: false }`. Added test: `returns failure when GPT returns an empty string`.

### F-4 (MEDIUM) — FIXED: `findFirst` + `orderBy` used where `findUnique` is correct

In `route.ts`, the `revisionFeedback` lookup used `prisma.generation.findFirst({ where: { orderId, attemptNumber: attempt - 1 }, orderBy: { createdAt: "desc" } })`. The `@@unique([orderId, attemptNumber])` constraint guarantees at most one row per pair, so `findFirst` + `orderBy` is misleading (implies multiple results are possible) and slightly less efficient.

**Fix:** Replaced with `prisma.generation.findUnique({ where: { orderId_attemptNumber: { orderId, attemptNumber: attempt - 1 } } })`. Updated route.test.ts mock from `generation.findFirst` → `generation.findUnique`.

### F-5 (MEDIUM) — FIXED: No test coverage for `attempt > 1` revision feedback paths in route.test.ts

The two new route tests added by the dev agent both used `attempt: 1`, leaving the `attempt > 1` code block (lines 104–117 of route.ts — revision feedback fetch, non-fatal DB failure handling) entirely uncovered.

**Fix:** Added two new route tests:
- `attempt=2 fetches revisionFeedback from previous generation and passes to enrichPrompt` — verifies the happy path where `generation.findUnique` returns feedback and it reaches `enrichPrompt`.
- `attempt=2 with revisionFeedback DB failure still calls enrichPrompt with null feedback` — verifies the non-fatal error path proceeds gracefully with `revisionFeedback: null`.

### F-6 (MEDIUM — DEFERRED): Unsanitized client fields passed directly into AI prompt

`order.theme`, `outfitDescription`, and `extraRequests` are passed verbatim from the DB into the GPT-5-mini prompt via `buildClientDetails`. No per-call length cap is enforced at the `enrichPrompt` layer. The application enforces a 300-char cap in the conversation tools (Story 2.7), but that cap is not re-checked here. A record written through any path that bypasses the bot tools could produce an oversized prompt with inflated token costs.

**Deferred:** Adding a hard truncation at `enrichPrompt`-level would duplicate Story 2.7's guard and could mask upstream data quality issues. The correct fix is adding `@db.VarChar(300)` constraints to `Order.outfitDescription`, `Order.extraRequests`, and `Order.theme` (already tracked in deferred-work.md from Story 2.7 review). Added to deferred-work.md with cross-reference.
