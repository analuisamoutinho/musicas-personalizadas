import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { updateOrderState } from "../conversation";
import { ORDER_ID_PATTERN } from "../order-id";

export const confirmOrder = tool({
  description:
    "Present order summary and process client confirmation. Call when in CONFIRMING_ORDER state to show summary (confirmed=false, alterRequest=null), when client confirms (confirmed=true), or when client wants to alter (confirmed=false, alterRequest='...').",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
    confirmed: z
      .boolean()
      .describe("True if client confirmed the order, false if showing summary or client wants to alter"),
    alterRequest: z
      .string()
      .nullable()
      .optional()
      .describe(
        "What the client wants to change, only set when confirmed=false and client explicitly requested an alteration",
      ),
  }),
  execute: async ({ orderId, confirmed, alterRequest }) => {
    // CUID validation — reject non-CUID orderId before any DB call
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(
        JSON.stringify({ level: "warn", event: "confirm_order_invalid_id", orderId: String(orderId).slice(0, 80), service: "bot-engine" }),
      );
      return { success: false, message: "ID de pedido inválido." };
    }

    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId }, include: { client: true } });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "confirm_order_db_error",
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

    // Guard wrong conversation state
    if (order.conversationState !== "CONFIRMING_ORDER") {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "confirm_order_wrong_state",
          orderId,
          state: order.conversationState,
          service: "bot-engine",
        }),
      );

      const recoveryHint =
        order.conversationState === "COLLECTING_PHOTOS"
          ? "Pedido ainda em coleta de fotos. Peça uma foto nítida do rostinho da criança antes de confirmar."
          : order.conversationState === "COLLECTING_OUTFIT"
            ? "Pedido ainda em coleta de roupa/extras. Continue com collectOutfit."
            : order.conversationState === "COLLECTING_THEME"
              ? "Pedido ainda em coleta de tema. Use selectStyle."
              : `Estado atual é ${order.conversationState}; confirmOrder só pode ser chamado em CONFIRMING_ORDER.`;

      return { success: false, message: recoveryHint };
    }

    // Client wants to alter something
    if (!confirmed && alterRequest) {
      // Truncate alterRequest before logging to prevent log injection / log flooding
      const safeAlterRequest = alterRequest.slice(0, 300);
      console.log(
        JSON.stringify({ level: "info", event: "order_alter_requested", orderId, alterRequest: safeAlterRequest, service: "bot-engine" }),
      );
      return {
        success: true,
        confirmed: false,
        alterRequest: safeAlterRequest,
        message: "Claro! O que você gostaria de alterar? ✏️ Me diga o que mudar e eu corrijo agora!",
      };
    }

    // Initial summary presentation (confirmed=false, alterRequest null/undefined)
    if (!confirmed) {
      const clientName = order.client?.name ?? "não informado";
      const theme = order.theme ?? "não selecionado";
      const outfit = order.outfitDescription ?? "sem roupa especial";
      const extras = order.extraRequests ?? "sem extras";
      const photoCount = order.photosUrls.length;

      const summary = [
        `Resumo do seu pedido:`,
        ``,
        `Cliente: ${clientName}`,
        `Tema: ${theme}`,
        `Roupa do mascotinho: ${outfit}`,
        `Extras: ${extras}`,
        `Fotos: ${photoCount} foto(s) recebida(s)`,
        `Valor: R$29,90`,
        ``,
        `Está tudo certinho? Me diz "Confirmar" para seguir ou "Quero alterar" para mudar algo!`,
      ].join("\n");

      console.log(
        JSON.stringify({
          level: "info",
          event: "order_summary_presented",
          orderId,
          photoCount,
          service: "bot-engine",
        }),
      );

      return {
        success: true,
        confirmed: false,
        summary,
        message: summary,
      };
    }

    // confirmed === true: transition to AWAITING_PAYMENT
    let transitioned: boolean;
    try {
      transitioned = await updateOrderState(orderId, "CONFIRMING_ORDER", "AWAITING_PAYMENT");
    } catch (stateErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "confirm_order_state_transition_error",
          orderId,
          from: "CONFIRMING_ORDER",
          to: "AWAITING_PAYMENT",
          error: stateErr instanceof Error ? stateErr.message : String(stateErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao confirmar pedido. Tente novamente." };
    }

    // updateOrderState returns false when 0 rows matched (race condition / already transitioned)
    if (!transitioned) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "confirm_order_already_transitioned",
          orderId,
          from: "CONFIRMING_ORDER",
          to: "AWAITING_PAYMENT",
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Pedido já foi confirmado ou estado mudou. Verifique o status do pedido." };
    }

    console.log(JSON.stringify({ level: "info", event: "order_confirmed", orderId, service: "bot-engine" }));

    return {
      success: true,
      confirmed: true,
      message: "Pedido confirmado! 🎉 Agora vou gerar o seu PIX para pagamento...",
    };
  },
});
