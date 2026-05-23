import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { uploadReference } from "@mascotinhos/storage";
import { env } from "@mascotinhos/env/server";
import { updateOrderState } from "../conversation";
import { ORDER_ID_PATTERN } from "../order-id";

const MAX_OUTFIT_LENGTH = 300;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const IMAGE_FETCH_TIMEOUT_MS = 10_000; // 10 seconds
const WHATSAPP_CDN_PATTERN = /^https:\/\/([a-z0-9-]+\.)?mmg\.whatsapp\.net\//i;

const OUTFIT_SKIP_SIGNALS = [
  "pular",
  "sem roupa",
  "nao sei",
  "não sei",
  "nao importa",
  "não importa",
  "qualquer",
  "nao",
  "não",
  "skip",
];
const EXTRAS_SKIP_SIGNALS = [
  "nao",
  "não",
  "sem extras",
  "nada",
  "nao quero",
  "não quero",
  "nao precisa",
  "não precisa",
  "skip",
];

function isSkipSignal(text: string | null | undefined, signals: string[]): boolean {
  if (!text) return true;
  const normalized = text.trim().toLowerCase();
  return signals.some((s) => normalized === s || normalized.startsWith(s + " "));
}

export const collectOutfit = tool({
  description:
    "Collect outfit description and extra requests for the mascotinho. Called in two phases: 'outfit' to save outfit info and ask for extras; 'extras' to save extras and proceed to confirmation.",
  inputSchema: z.object({
    phase: z
      .enum(["outfit", "extras"])
      .describe(
        "'outfit' = save outfit info and ask for extras; 'extras' = save extras and proceed to order confirmation",
      ),
    outfitDescription: z
      .string()
      .nullable()
      .describe("Text description of the outfit, or null to skip"),
    outfitImageUrl: z
      .string()
      .nullable()
      .describe("WhatsApp CDN URL of outfit reference image, or null if not provided"),
    extraRequests: z
      .string()
      .nullable()
      .describe("Extra additions the client wants (balloons, toys, pets), or null to skip"),
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ phase, outfitDescription, outfitImageUrl, extraRequests, orderId }) => {
    // Validate orderId format to avoid leaking raw AI output into DB queries
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "collect_outfit_invalid_id",
          orderId: String(orderId).slice(0, 80),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "ID de pedido inválido." };
    }

    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "collect_outfit_db_error",
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao buscar pedido. Tente novamente." };
    }

    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    // Guard: allow COLLECTING_OUTFIT or COLLECTING_THEME (in case prior state transition was non-fatal failure)
    if (order.conversationState !== "COLLECTING_OUTFIT" && order.conversationState !== "COLLECTING_THEME") {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "collect_outfit_wrong_state",
          orderId,
          actualState: order.conversationState,
          service: "bot-engine",
        }),
      );
      return {
        success: false,
        message: `Estado inválido para collectOutfit: ${order.conversationState}. Esperado: COLLECTING_OUTFIT.`,
      };
    }

    // Self-heal: if stuck in COLLECTING_THEME due to failed selectStyle transition, advance now
    if (order.conversationState === "COLLECTING_THEME") {
      try {
        await updateOrderState(orderId, "COLLECTING_THEME", "COLLECTING_OUTFIT");
        console.log(
          JSON.stringify({
            level: "info",
            event: "collect_outfit_self_healed_state",
            orderId,
            from: "COLLECTING_THEME",
            to: "COLLECTING_OUTFIT",
            service: "bot-engine",
          }),
        );
      } catch (healErr) {
        console.log(
          JSON.stringify({
            level: "warn",
            event: "collect_outfit_self_heal_failed",
            orderId,
            error: healErr instanceof Error ? healErr.message : String(healErr),
            service: "bot-engine",
          }),
        );
        // Continue anyway — we'll try the DB operations regardless
      }
    }

    if (phase === "outfit") {
      let sanitizedOutfit: string | null = null;

      if (!isSkipSignal(outfitDescription, OUTFIT_SKIP_SIGNALS)) {
        sanitizedOutfit = outfitDescription!.trim().slice(0, MAX_OUTFIT_LENGTH);
      }

      // Upload outfit reference image if provided (non-fatal on failure)
      if (outfitImageUrl) {
        // SSRF guard: only allow WhatsApp CDN URLs
        if (!WHATSAPP_CDN_PATTERN.test(outfitImageUrl)) {
          console.log(
            JSON.stringify({
              level: "warn",
              event: "outfit_image_ssrf_blocked",
              orderId,
              url: outfitImageUrl.slice(0, 100),
              service: "bot-engine",
            }),
          );
        } else {
          try {
            const response = await fetch(outfitImageUrl, {
              headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
              signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
            });
            if (response.ok) {
              // Size guard: reject before buffering to avoid OOM
              const contentLength = Number(response.headers.get("content-length") ?? 0);
              if (contentLength > MAX_IMAGE_BYTES) {
                console.log(
                  JSON.stringify({
                    level: "warn",
                    event: "outfit_image_too_large",
                    orderId,
                    contentLength,
                    service: "bot-engine",
                  }),
                );
              } else {
                const buffer = Buffer.from(await response.arrayBuffer());
                // Double-check actual size in case content-length was absent/wrong
                if (buffer.byteLength <= MAX_IMAGE_BYTES) {
                  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
                  const ext = mimeType.includes("png") ? "png" : "jpg";
                  const filename = `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                  const storagePath = await uploadReference(orderId, filename, buffer, mimeType);
                  const imageNote = `[imagem de referência: ${storagePath}]`;
                  const combined = sanitizedOutfit ? `${sanitizedOutfit} ${imageNote}` : imageNote;
                  // Cap combined string to avoid unbounded DB write
                  sanitizedOutfit = combined.slice(0, MAX_OUTFIT_LENGTH * 2);
                }
              }
            }
          } catch (imgErr) {
            console.log(
              JSON.stringify({
                level: "warn",
                event: "outfit_image_upload_failed",
                orderId,
                error: imgErr instanceof Error ? imgErr.message : String(imgErr),
                service: "bot-engine",
              }),
            );
          }
        }
      }

      if (sanitizedOutfit !== null) {
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { outfitDescription: sanitizedOutfit },
          });
        } catch (dbErr) {
          console.log(
            JSON.stringify({
              level: "error",
              event: "collect_outfit_update_error",
              orderId,
              error: dbErr instanceof Error ? dbErr.message : String(dbErr),
              service: "bot-engine",
            }),
          );
          return { success: false, message: "Erro ao salvar a roupa. Tente novamente." };
        }
      }

      console.log(
        JSON.stringify({
          level: "info",
          event: "outfit_collected",
          orderId,
          hasOutfit: sanitizedOutfit !== null,
          service: "bot-engine",
        }),
      );

      return {
        success: true,
        phase: "outfit",
        outfitSaved: sanitizedOutfit !== null,
        message: sanitizedOutfit
          ? `Roupa anotada! Quer adicionar algo especial? 🎈 Ex: balão, cachorrinho, brinquedo favorito... ou diga "não" para pular.`
          : `Sem problema! Quer adicionar algo especial? 🎈 Ex: balão, cachorrinho, brinquedo favorito... ou diga "não" para pular.`,
      };
    }

    // phase === "extras"
    let sanitizedExtras: string | null = null;

    if (!isSkipSignal(extraRequests, EXTRAS_SKIP_SIGNALS)) {
      sanitizedExtras = extraRequests!.trim().slice(0, MAX_OUTFIT_LENGTH);
    }

    if (sanitizedExtras !== null) {
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: { extraRequests: sanitizedExtras },
        });
      } catch (dbErr) {
        console.log(
          JSON.stringify({
            level: "error",
            event: "collect_extras_update_error",
            orderId,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            service: "bot-engine",
          }),
        );
        return { success: false, message: "Erro ao salvar os extras. Tente novamente." };
      }
    }

    // Determine next state: if photos already collected, go to CONFIRMING_ORDER; otherwise COLLECTING_PHOTOS
    const freshOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { photosUrls: true } });
    const hasPhotos = (freshOrder?.photosUrls?.length ?? 0) > 0;
    const nextState = hasPhotos ? "CONFIRMING_ORDER" : "COLLECTING_PHOTOS";

    try {
      await updateOrderState(orderId, "COLLECTING_OUTFIT", nextState);
    } catch (stateErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "state_transition_failed",
          orderId,
          from: "COLLECTING_OUTFIT",
          to: nextState,
          error: stateErr instanceof Error ? stateErr.message : String(stateErr),
          service: "bot-engine",
        }),
      );
      // Non-fatal: extras already saved; state will self-correct on next interaction
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "extras_collected",
        orderId,
        hasExtras: sanitizedExtras !== null,
        service: "bot-engine",
      }),
    );

    const acknowledgement = sanitizedExtras
      ? `Anotei: ${sanitizedExtras}! 🎉`
      : `Sem extras, beleza! 🙌`;

    const nextStepPrompt =
      nextState === "CONFIRMING_ORDER"
        ? `Agora vamos revisar seu pedido!`
        : `Agora me manda uma foto bem nítida do rostinho da criança? 📸`;

    return {
      success: true,
      phase: "extras",
      extrasSaved: sanitizedExtras !== null,
      transitioned: true,
      message: `${acknowledgement} ${nextStepPrompt}`,
    };
  },
});
