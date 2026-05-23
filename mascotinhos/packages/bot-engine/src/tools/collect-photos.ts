import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { uploadReference } from "@mascotinhos/storage";
import { updateOrderState } from "../conversation";
import { serializeCause } from "../serialize-cause";

/** Minimum file size to consider a photo acceptable quality (~5 KB). */
const MIN_PHOTO_SIZE_BYTES = 5_000;
const MAX_PHOTOS = 3;

export const collectPhotos = tool({
  description:
    "Process the photos the client just sent in this turn. Call when the client sent photos.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ orderId }, { experimental_context }) => {
    const ctx = experimental_context as { photoData?: Array<{ buffer: Buffer; mimeType: string }> } | undefined;
    const photoData = ctx?.photoData ?? [];
    if (!photoData.length) {
      return { success: false, message: "Nenhuma foto recebida nesta mensagem." };
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    const remaining = MAX_PHOTOS - order.photosUrls.length;
    if (remaining <= 0) {
      return {
        success: false,
        message: `Já recebemos o máximo de ${MAX_PHOTOS} fotos para este pedido.`,
      };
    }

    const dataToProcess = photoData.slice(0, remaining);
    const storedPaths: string[] = [];
    const qualityWarnings: string[] = [];

    for (const { buffer, mimeType } of dataToProcess) {
      try {
        if (buffer.byteLength < MIN_PHOTO_SIZE_BYTES) {
          qualityWarnings.push(
            "A foto ficou um pouco pequena — tente enviar com mais resolução",
          );
        }

        const extMap: Record<string, string> = {
          "image/png": "png", "image/webp": "webp",
          "image/heic": "heic", "image/heif": "heif", "image/gif": "gif",
        };
        const ext = extMap[mimeType] ?? "jpg";
        const filename = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        console.log(JSON.stringify({
          level: "info", event: "photo_upload_attempt",
          orderId, mimeType, byteLength: buffer.byteLength, service: "bot-engine",
        }));

        const storagePath = await uploadReference(orderId, filename, buffer, mimeType);
        storedPaths.push(storagePath);
      } catch (err) {
        console.log(
          JSON.stringify({
            level: "error",
            event: "photo_upload_failed",
            orderId,
            mimeType,
            error: err instanceof Error ? err.message : String(err),
            cause: err instanceof Error ? serializeCause(err.cause) : undefined,
            service: "bot-engine",
          }),
        );
        qualityWarnings.push("Erro ao processar uma das fotos");
      }
    }

    if (!storedPaths.length) {
      return {
        success: false,
        message:
          qualityWarnings[0] ??
          "Não foi possível processar as fotos. Pode reenviar?",
      };
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { photosUrls: { push: storedPaths } },
    });

    const totalPhotos = updatedOrder.photosUrls.length;

    if (order.conversationState === "COLLECTING_PHOTOS") {
      // Determine next state based on what's already been collected
      // If theme + outfit are already set, go straight to CONFIRMING_ORDER
      const hasTheme = !!order.theme;
      const hasOutfit = order.outfitDescription !== null;
      const nextState = (hasTheme && hasOutfit) ? "CONFIRMING_ORDER" : "COLLECTING_THEME";

      try {
        await updateOrderState(orderId, "COLLECTING_PHOTOS", nextState);
      } catch (stateErr) {
        console.log(
          JSON.stringify({
            level: "error",
            event: "state_transition_failed",
            orderId,
            from: "COLLECTING_PHOTOS",
            to: nextState,
            error: stateErr instanceof Error ? stateErr.message : String(stateErr),
            service: "bot-engine",
          }),
        );
        // Non-fatal: photos are already stored; state will self-correct on next interaction
      }
    }

    const qualityHint =
      qualityWarnings.length > 0
        ? ` Dica: ${qualityWarnings[0]!.toLowerCase()}.`
        : "";

    return {
      success: true,
      photosStored: storedPaths.length,
      totalPhotos,
      qualityWarnings,
      message: `${storedPaths.length} foto(s) recebida(s) com sucesso. Total: ${totalPhotos}/${MAX_PHOTOS}.${qualityHint}`,
    };
  },
});
