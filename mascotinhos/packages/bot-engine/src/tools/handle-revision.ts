import { tool } from "ai";
import { z } from "zod";
import { Client as QStashClient } from "@upstash/qstash";
import prisma from "@mascotinhos/db";
import { env } from "@mascotinhos/env/server";
import { updateOrderState } from "../conversation";
import { ORDER_ID_PATTERN } from "../order-id";
const GENERATION_DELAY_SECONDS = 90;
const QSTASH_RETRIES = 3;
/** FR-30: maximum number of client-requested revisions per order. */
const MAX_REVISIONS = 2;

export const handleRevision = tool({
  description:
    "Process a revision request from the client after image delivery. Re-enriches prompt with feedback.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
    feedback: z
      .string()
      .min(1, "Feedback must not be empty")
      .describe("Client's revision feedback in natural language — must contain actual revision details"),
  }),
  execute: async ({ orderId, feedback }) => {
    // 1. UUID guard
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "handle_revision_invalid_id",
          orderId: orderId.slice(0, 40),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "ID de pedido inválido." };
    }

    // 2. Guard empty feedback and truncate to prevent log injection / prompt injection
    if (!feedback.trim()) {
      return { success: false, message: "Feedback de revisão não pode ser vazio." };
    }
    const safeFeedback = feedback.slice(0, 500);

    // 3. Load order
    let order;
    try {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, conversationState: true },
      });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "handle_revision_db_error",
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

    // 4. Wrong-state guard — only AWAITING_FEEDBACK is a valid entry point for revisions.
    //    REVISION_1 / REVISION_2 are transient intermediate states set by this handler
    //    and should never be the state when a new revision message arrives.
    if (order.conversationState !== "AWAITING_FEEDBACK") {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "handle_revision_wrong_state",
          orderId,
          state: order.conversationState,
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Pedido não está aguardando feedback." };
    }

    // 5. Query the highest generation attempt to determine which revision this is.
    //    Generation.attemptNumber is unique per (orderId, attemptNumber) — see schema @@unique.
    let maxAttemptNumber = 0;
    try {
      const latestGen = await prisma.generation.findFirst({
        where: { orderId },
        orderBy: { attemptNumber: "desc" },
        select: { attemptNumber: true },
      });
      maxAttemptNumber = latestGen?.attemptNumber ?? 0;
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "handle_revision_gen_query_error",
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao buscar pedido. Tente novamente." };
    }

    // 6. Enforce 2-revision cap (FR-30) at the state-machine level.
    //    attemptNumber 1 = initial generation, 2 = revision 1, 3 = revision 2 (max).
    //    maxAttemptNumber >= 3 means both allowed revisions have already been generated.
    if (maxAttemptNumber >= MAX_REVISIONS + 1) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "handle_revision_cap_exceeded",
          orderId,
          maxAttemptNumber,
          service: "bot-engine",
        }),
      );
      return {
        success: false,
        message:
          "Você já utilizou todas as revisões disponíveis (máximo 2). O pedido será finalizado com a última versão gerada.",
      };
    }

    // 7. Determine intermediate revision state and next attempt number.
    //    maxAttemptNumber = 1 (or 0): first revision  → REVISION_1, nextAttempt = 2
    //    maxAttemptNumber = 2:         second revision → REVISION_2, nextAttempt = 3
    const revisionState = maxAttemptNumber <= 1 ? ("REVISION_1" as const) : ("REVISION_2" as const);
    const nextAttempt = maxAttemptNumber <= 1 ? 2 : 3;

    // 8. Store revisionFeedback on the previous Generation record so the /api/generate
    //    route can read it via: findUnique({ orderId, attemptNumber: attempt - 1 })
    try {
      await prisma.generation.updateMany({
        where: { orderId, attemptNumber: nextAttempt - 1 },
        data: { revisionFeedback: safeFeedback },
      });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "handle_revision_feedback_store_failed",
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "bot-engine",
        }),
      );
      // Non-fatal: the generation pipeline will proceed with revisionFeedback=null
    }

    // 9. Transition AWAITING_FEEDBACK → REVISION_N.
    //    This atomically claims the revision slot, preventing concurrent double-revision via
    //    optimistic concurrency (updateMany WHERE conversationState = AWAITING_FEEDBACK).
    let transitioned: boolean;
    try {
      transitioned = await updateOrderState(orderId, "AWAITING_FEEDBACK", revisionState);
    } catch (transitionErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "handle_revision_transition_error",
          orderId,
          from: "AWAITING_FEEDBACK",
          to: revisionState,
          error: transitionErr instanceof Error ? transitionErr.message : String(transitionErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao iniciar revisão. Tente novamente." };
    }
    if (!transitioned) {
      return {
        success: false,
        message: "Erro de concorrência ao iniciar revisão. Tente novamente.",
      };
    }

    // 10. Transition REVISION_N → GENERATING to begin the new generation pass.
    try {
      transitioned = await updateOrderState(orderId, revisionState, "GENERATING");
    } catch (transitionErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "handle_revision_transition_error",
          orderId,
          from: revisionState,
          to: "GENERATING",
          error: transitionErr instanceof Error ? transitionErr.message : String(transitionErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao iniciar revisão. Tente novamente." };
    }
    if (!transitioned) {
      return {
        success: false,
        message: "Erro de concorrência ao iniciar revisão. Tente novamente.",
      };
    }

    // 11. Enqueue new generation via QStash.
    // NOTE: QStashClient constructed per-call — Bun mock.module() patches apply at function-call time
    const qstash = new QStashClient({ token: env.QSTASH_TOKEN });
    const targetUrl = `https://${env.VERCEL_URL}/api/generate`;

    try {
      await qstash.publishJSON({
        url: targetUrl,
        body: { orderId, action: "generate", attempt: nextAttempt },
        delay: GENERATION_DELAY_SECONDS,
        retries: QSTASH_RETRIES,
      });
    } catch (qErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "handle_revision_qstash_error",
          orderId,
          error: qErr instanceof Error ? qErr.message : String(qErr),
          service: "bot-engine",
        }),
      );
      // State already transitioned to GENERATING. Log but return failure — operator can re-trigger if needed.
      return { success: false, message: "Erro ao enfileirar revisão. Tente novamente." };
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "revision_enqueued",
        orderId,
        nextAttempt,
        revisionState,
        service: "bot-engine",
      }),
    );
    return {
      success: true,
      message: "Sua revisão está sendo processada! Já já você receberá a nova versão ✨",
    };
  },
});
