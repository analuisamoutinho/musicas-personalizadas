import prisma from "@mascotinhos/db";
import { type ConversationState, isValidTransition } from "./state-machine";

/** Terminal states excluded from active order queries. */
const TERMINAL_STATES: ConversationState[] = ["COMPLETED", "FAILED", "ABANDONED_24H"];

/** Load the most recent active order for a WhatsApp sender. */
export async function loadActiveOrder(whatsappSenderId: string) {
  return prisma.order.findFirst({
    where: {
      client: { whatsappSenderId },
      conversationState: { notIn: TERMINAL_STATES },
    },
    orderBy: { createdAt: "desc" },
    include: { client: true },
  });
}

/** Find existing client or create a new one by WhatsApp sender ID. */
export async function findOrCreateClient(whatsappSenderId: string) {
  return prisma.client.upsert({
    where: { whatsappSenderId },
    create: { whatsappSenderId },
    update: {},
  });
}

/** Create a new order in GREETING state for the given client. */
export async function createOrder(clientId: string) {
  return prisma.order.create({
    data: {
      clientId,
      conversationState: "GREETING",
    },
    include: { client: true },
  });
}

/**
 * Atomically update order state with optimistic concurrency.
 * Returns true if updated, false if race condition (0 rows matched).
 * Validates the transition before hitting the database.
 */
export async function updateOrderState(
  orderId: string,
  fromState: ConversationState,
  toState: ConversationState,
): Promise<boolean> {
  if (!isValidTransition(fromState, toState)) {
    throw new Error(
      `Invalid state transition: ${fromState} -> ${toState} (orderId: ${orderId})`,
    );
  }

  const result = await prisma.order.updateMany({
    where: { id: orderId, conversationState: fromState },
    data: { conversationState: toState },
  });

  if (result.count === 0) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "state_update_race_condition",
        orderId,
        from: fromState,
        to: toState,
        service: "bot-engine",
      }),
    );
  }

  return result.count > 0;
}
