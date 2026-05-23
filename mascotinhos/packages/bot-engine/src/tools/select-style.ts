import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { updateOrderState } from "../conversation";

const MAX_STYLE_INPUT_LENGTH = 200;
const MIN_FUZZY_MATCH_LENGTH = 3; // Prevent false positives from very short template names

export const selectStyle = tool({
  description: "Set the style/theme for the mascotinho illustration. Call when client chooses or types a theme.",
  inputSchema: z.object({
    styleInput: z.string().describe("Theme name from quick-reply button or free-text description"),
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ styleInput, orderId }) => {
    // Sanitize and trim input to prevent overly long strings or whitespace mismatches
    const sanitizedInput = styleInput.trim().slice(0, MAX_STYLE_INPUT_LENGTH);

    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "select_style_db_error",
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

    let templates;
    try {
      templates = await prisma.styleTemplate.findMany({
        where: { active: true },
        select: { id: true, name: true, slug: true },
      });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "select_style_templates_error",
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao buscar estilos. Tente novamente." };
    }

    const input = sanitizedInput.toLowerCase();
    const match =
      templates.find((t) => t.slug.toLowerCase() === input) ??
      templates.find((t) => t.name.toLowerCase() === input) ??
      // Guard against false positives: only fuzzy-match if template name is long enough
      // to avoid short names (e.g. "3D") accidentally matching unrelated custom inputs
      templates.find(
        (t) =>
          t.name.toLowerCase().length >= MIN_FUZZY_MATCH_LENGTH &&
          (t.name.toLowerCase().includes(input) ||
            input.includes(t.name.toLowerCase())),
      );

    try {
      if (match) {
        await prisma.$transaction([
          prisma.styleTemplate.update({
            where: { id: match.id },
            data: { popularity: { increment: 1 } },
          }),
          prisma.order.update({
            where: { id: orderId },
            data: { styleTemplateId: match.id, theme: match.name },
          }),
        ]);
      } else {
        await prisma.order.update({
          where: { id: orderId },
          data: { theme: sanitizedInput },
        });
      }
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "select_style_update_error",
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao salvar o tema. Tente novamente." };
    }

    // If still in GREETING (user picked a theme during greeting), advance to COLLECTING_THEME first.
    // selectStyle is called from both GREETING and COLLECTING_THEME states; the existing
    // COLLECTING_THEME → COLLECTING_OUTFIT transition below only matches rows already in
    // COLLECTING_THEME, so orders entering from GREETING would stay stuck without this step.
    if (order.conversationState === "GREETING") {
      try {
        await updateOrderState(orderId, "GREETING", "COLLECTING_THEME");
      } catch (stateErr) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "state_transition_failed",
            orderId,
            from: "GREETING",
            to: "COLLECTING_THEME",
            error: stateErr instanceof Error ? stateErr.message : String(stateErr),
            service: "bot-engine",
          }),
        );
        // Non-fatal: proceed; the next transition will simply match 0 rows
      }
    }

    try {
      await updateOrderState(orderId, "COLLECTING_THEME", "COLLECTING_OUTFIT");
    } catch (stateErr) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "state_transition_failed",
          orderId,
          from: "COLLECTING_THEME",
          to: "COLLECTING_OUTFIT",
          error: stateErr instanceof Error ? stateErr.message : String(stateErr),
          service: "bot-engine",
        }),
      );
      // Non-fatal: theme already saved; state will self-correct on next interaction
    }

    const selectedStyle = match?.name ?? sanitizedInput;
    const isCustom = !match;

    console.log(
      JSON.stringify({
        level: "info",
        event: "style_selected",
        orderId,
        selectedStyle,
        isCustom,
        service: "bot-engine",
      }),
    );

    return {
      success: true,
      selectedStyle,
      isCustom,
      message: isCustom
        ? `Tema personalizado '${selectedStyle}' anotado! 🎨`
        : `Tema ${selectedStyle} escolhido! 🎨✨`,
    };
  },
});
