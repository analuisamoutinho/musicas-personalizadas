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
      model: openai("gpt-5.4-mini"),
      system: ENRICHMENT_SYSTEM_PROMPT,
      prompt: buildEnrichmentUserPrompt({
        promptTemplate,
        styleTemplateName,
        clientDetails,
      }),
      maxOutputTokens: 500,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "enrich-prompt",
        recordInputs: true,
        recordOutputs: true,
        metadata: {
          orderId,
          attemptNumber,
          service: "image-gen",
        },
      },
    });
    enrichedPrompt = result.text.trim();
    if (!enrichedPrompt) {
      throw new Error("GPT returned an empty prompt");
    }
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

Merge the base template with the client details into a single, detailed image generation prompt. Be specific about visual elements, style, colors, and character details.

The downstream image model (gpt-image-2 via images.edit) receives the parent's photo of THEIR child as the input image — not as inspiration but as the subject to transform. Your prompt MUST anchor the character to that reference: open with language like "Transform the child shown in the reference photo into a [style] mascot illustration..." and explicitly tell the model to preserve the child's facial features, skin tone, hair color/style, and any distinctive characteristics so the result is recognizably the same kid in costume.

Output ONLY the final prompt text, no explanation.`;
}

const ENRICHMENT_SYSTEM_PROMPT = `You are an expert at writing image generation prompts for children's mascot illustrations.
Your task: merge a style template with client-specific details into a single optimized prompt for gpt-image-2 (images.edit endpoint).

CRITICAL — REFERENCE PHOTO HANDLING
The image model receives the parent's photo of their actual child as the input image. The generated mascot must look like THIS specific child, in costume — not a generic Brazilian child stand-in. Every prompt you write MUST:
- Open by referencing the child in the input image as the subject (e.g. "Transform the child in the reference photo into a Disney-style astronaut mascot...").
- Explicitly preserve facial features, skin tone, hair color, hair style, eye color, and any distinctive characteristics from the reference photo.
- Frame styling/outfit/scene as additions to the existing child, not as a description of an invented character.
- Avoid generic descriptors that override the reference ("Brazilian child", "cute boy", "little girl with blonde hair") — those make the model hallucinate a different face.

Other rules:
- Output ONLY the final prompt text. No preamble, no explanation.
- Keep the style template's artistic direction intact.
- Incorporate all client details (outfit, extras, revision feedback) naturally.
- If revision feedback is provided, prioritize it and explicitly adjust the original prompt.
- Be concrete and specific about everything except the child's appearance — those details come from the reference.
- Target 150–300 words.
- Write in English (image model prompt language).`;
