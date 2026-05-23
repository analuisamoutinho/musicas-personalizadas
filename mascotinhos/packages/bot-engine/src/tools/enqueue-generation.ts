import { tool } from "ai";
import { z } from "zod";
import { Client as QStashClient } from "@upstash/qstash";
import prisma from "@mascotinhos/db";
import { env } from "@mascotinhos/env/server";
import { ORDER_ID_PATTERN } from "../order-id";
const GENERATION_DELAY_SECONDS = 90;
const QSTASH_RETRIES = 3;

export const enqueueGeneration = tool({
  description: "Queue the mascotinho image generation job. Called after payment is confirmed.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ orderId }) => {
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(JSON.stringify({ level: "warn", event: "enqueue_generation_invalid_id", orderId, service: "bot-engine" }));
      return { success: false, message: "ID de pedido inválido." };
    }

    // Verify order exists and is in GENERATING state
    let order;
    try {
      order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderStatus: true } });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "enqueue_generation_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao enfileirar geração." };
    }

    if (!order) {
      console.log(JSON.stringify({ level: "warn", event: "enqueue_generation_order_not_found", orderId, service: "bot-engine" }));
      return { success: false, message: "Pedido não encontrado." };
    }

    // Idempotency guard — skip if already past GENERATING
    if (order.orderStatus === "DELIVERED" || order.orderStatus === "CANCELLED") {
      console.log(JSON.stringify({ level: "info", event: "enqueue_generation_idempotent_skip", orderId, orderStatus: order.orderStatus, service: "bot-engine" }));
      return { success: true, message: "Geração já processada." };
    }

    // NOTE: QStashClient constructed per-call — Bun mock.module() patches apply at
    // function-call time, so module-level instantiation would bypass test mocks.
    const qstash = new QStashClient({ token: env.QSTASH_TOKEN });
    // VERCEL_URL is hostname-only (e.g. "your-project.vercel.app") — must prepend https://
    const targetUrl = `https://${env.VERCEL_URL}/api/generate`;

    try {
      await qstash.publishJSON({
        url: targetUrl,
        body: { orderId, action: "generate", attempt: 1 },
        delay: GENERATION_DELAY_SECONDS,
        retries: QSTASH_RETRIES,
      });
    } catch (qErr) {
      console.log(JSON.stringify({ level: "error", event: "enqueue_generation_qstash_error", orderId, error: qErr instanceof Error ? qErr.message : String(qErr), service: "bot-engine" }));
      return { success: false, message: "Erro ao enfileirar geração. Tente novamente." };
    }

    console.log(JSON.stringify({ level: "info", event: "enqueue_generation_published", orderId, delay: GENERATION_DELAY_SECONDS, retries: QSTASH_RETRIES, service: "bot-engine" }));
    return { success: true, message: "Geração enfileirada com sucesso." };
  },
});
