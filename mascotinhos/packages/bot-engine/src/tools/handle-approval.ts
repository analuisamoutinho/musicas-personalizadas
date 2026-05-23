import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { updateOrderState } from "../conversation";
import { ORDER_ID_PATTERN } from "../order-id";

export const handleApproval = tool({
  description:
    "Mark the order as completed when the client approves the mascotinho. Call when client expresses satisfaction in AWAITING_FEEDBACK state.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ orderId }) => {
    // 1. UUID guard
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "handle_approval_invalid_id",
          // Truncate to 40 chars to prevent log injection via attacker-controlled input
          orderId: orderId.slice(0, 40),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "ID de pedido inválido." };
    }

    // 2. Load order
    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId } });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "handle_approval_db_error",
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

    // 3. Wrong-state guard
    if (order.conversationState !== "AWAITING_FEEDBACK") {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "handle_approval_wrong_state",
          orderId,
          state: order.conversationState,
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Pedido não está aguardando feedback." };
    }

    // 4. Update conversationState: AWAITING_FEEDBACK → COMPLETED
    let updated: boolean;
    try {
      updated = await updateOrderState(orderId, "AWAITING_FEEDBACK", "COMPLETED");
    } catch (transitionErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "handle_approval_transition_error",
          orderId,
          error: transitionErr instanceof Error ? transitionErr.message : String(transitionErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao atualizar estado do pedido. Tente novamente." };
    }
    if (!updated) {
      return { success: false, message: "Erro de concorrência. Tente novamente." };
    }

    // 5. Update orderStatus to DELIVERED (terminal delivered status — OrderStatus enum has no COMPLETED value)
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: { orderStatus: "DELIVERED" },
      });
    } catch (err) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "handle_approval_status_update_failed",
          orderId,
          error: err instanceof Error ? err.message : String(err),
          service: "bot-engine",
        }),
      );
      // conversationState already updated; log but return success to avoid duplicate processing
    }

    console.log(JSON.stringify({ level: "info", event: "order_completed", orderId, service: "bot-engine" }));
    return { success: true, message: "Pedido concluído com sucesso!" };
  },
});
