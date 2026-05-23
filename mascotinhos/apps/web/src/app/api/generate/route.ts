import { type NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { sanitizeIp } from "@/lib/sanitize-ip";
import prisma from "@mascotinhos/db";
import { enrichPrompt, generate, qualityCheck, MAX_QUALITY_RETRIES } from "@mascotinhos/image-gen";
import { uploadGenerated } from "@mascotinhos/storage";
import { env } from "@mascotinhos/env/server";
import { z } from "zod";
import { deliverImageToClient, sendAbandonedNudgeMessage, sendAbandonedClosureMessage, notifyOperator, sendGenerationFailureMessage } from "@mascotinhos/bot-engine";

// NFR-02: generation must complete within 2 minutes; allow up to 300 s for the full pipeline
// (OpenAI GPT Image 1.5 High at 1024×1024 can take 20–60 s, plus retries).
export const maxDuration = 300;

// QStash retries the job up to QSTASH_MAX_DELIVERY_ATTEMPTS times total (including the
// initial attempt). The `attempt` field in the payload starts at 1 and increments on each
// retry. Operator is notified only on the final attempt to avoid alert fatigue.
// Keep this in sync with the QStash queue configuration (default: 3).
const QSTASH_MAX_DELIVERY_ATTEMPTS = 3;

export function GET(): NextResponse {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

const qstashBodySchema = z.object({
  orderId: z.string().cuid(),
  action: z.enum(["generate", "nudge_abandoned", "close_abandoned"]),
  attempt: z.number().int().min(1).optional().default(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Verify QStash signature
  // NOTE: Receiver is constructed per-request intentionally — Bun mock.module() patches
  // apply at function-call time, so module-level instantiation would bypass test mocks.
  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  const signatureHeader = request.headers.get("upstash-signature");
  if (!signatureHeader) {
    const ip = sanitizeIp(request.headers.get("x-forwarded-for"));
    console.log(JSON.stringify({ level: "warn", event: "generate_consumer_missing_signature", ip, service: "web" }));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let isValid = false;
  try {
    isValid = await receiver.verify({ signature: signatureHeader, body });
  } catch {
    isValid = false;
  }

  if (!isValid) {
    const ip = sanitizeIp(request.headers.get("x-forwarded-for"));
    console.log(JSON.stringify({ level: "warn", event: "generate_consumer_invalid_signature", ip, service: "web" }));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate body
  let payload: z.infer<typeof qstashBodySchema>;
  try {
    payload = qstashBodySchema.parse(JSON.parse(body));
  } catch (parseErr) {
    console.log(JSON.stringify({ level: "warn", event: "generate_consumer_invalid_body", error: parseErr instanceof Error ? parseErr.message : String(parseErr), service: "web" }));
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { orderId, action, attempt } = payload;

  // 3. Route by action
  if (action === "generate") {
    return handleGenerate(orderId, attempt);
  } else if (action === "nudge_abandoned" || action === "close_abandoned") {
    return handleAbandonedCart(orderId, action);
  }

  console.log(JSON.stringify({ level: "warn", event: "generate_consumer_unknown_action", orderId, action, service: "web" }));
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function handleAbandonedCart(
  orderId: string,
  action: "nudge_abandoned" | "close_abandoned",
): Promise<NextResponse> {
  // 1. Load order with client join
  let order;
  try {
    order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        conversationState: true,
        orderStatus: true,
        client: { select: { whatsappSenderId: true, name: true } },
      },
    });
  } catch (dbErr) {
    console.log(JSON.stringify({ level: "error", event: "abandoned_cart_db_error", orderId, action, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "web" }));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 }); // QStash retry
  }

  if (!order) {
    console.log(JSON.stringify({ level: "warn", event: "abandoned_cart_order_not_found", orderId, action, service: "web" }));
    return NextResponse.json({ error: "Order not found" }, { status: 404 }); // not retry-eligible
  }

  // 2. Idempotency / skip conditions
  const { conversationState, orderStatus } = order;

  if (action === "nudge_abandoned") {
    // Skip if already nudged, paid, or past pre-payment.
    // Also skip pre-payment states earlier than AWAITING_PAYMENT (COLLECTING_PHOTOS,
    // COLLECTING_THEME, COLLECTING_OUTFIT, CONFIRMING_ORDER) — QStash messages are only
    // published when entering AWAITING_PAYMENT, so these states indicate the order regressed
    // or was never eligible. The updateMany WHERE guard would prevent the DB write anyway,
    // but we must also skip the WhatsApp send to avoid a message with no state transition.
    const skipStates = [
      "COLLECTING_PHOTOS", "COLLECTING_THEME", "COLLECTING_OUTFIT", "CONFIRMING_ORDER",
      "ABANDONED_1H", "ABANDONED_24H", "GENERATING", "DELIVERING",
      "AWAITING_FEEDBACK", "REVISION_1", "REVISION_2", "COMPLETED", "FAILED",
    ];
    if (skipStates.includes(conversationState) || orderStatus === "PAID") {
      console.log(JSON.stringify({ level: "info", event: "abandoned_nudge_skipped", orderId, conversationState, orderStatus, service: "web" }));
      return NextResponse.json({ status: "ok" });
    }
    // No phone — can't send, skip gracefully
    if (!order.client?.whatsappSenderId) {
      return NextResponse.json({ status: "ok" });
    }
    // Transition AWAITING_PAYMENT → ABANDONED_1H using updateMany with WHERE guard (optimistic concurrency).
    // Must be wrapped in try/catch: an unhandled DB throw here would produce a 500 with no
    // structured log and skip QStash-retry-eligible error logging.
    try {
      await prisma.order.updateMany({
        where: { id: orderId, conversationState: "AWAITING_PAYMENT" },
        data: { conversationState: "ABANDONED_1H" },
      });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "abandoned_nudge_state_update_failed", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "web" }));
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 }); // QStash retry
    }
    // Send nudge message (imported from bot-engine) — never throws
    await sendAbandonedNudgeMessage(orderId, order.client.whatsappSenderId, order.client.name);
    console.log(JSON.stringify({ level: "info", event: "abandoned_nudge_sent", orderId, service: "web" }));
    return NextResponse.json({ status: "ok" });
  }

  if (action === "close_abandoned") {
    // Skip if already closed or successfully paid/completed
    const skipStates = ["ABANDONED_24H", "GENERATING", "DELIVERING",
                        "AWAITING_FEEDBACK", "REVISION_1", "REVISION_2", "COMPLETED", "FAILED"];
    if (skipStates.includes(conversationState) || orderStatus === "PAID") {
      console.log(JSON.stringify({ level: "info", event: "abandoned_close_skipped", orderId, conversationState, orderStatus, service: "web" }));
      return NextResponse.json({ status: "ok" });
    }
    // Transition ABANDONED_1H or AWAITING_PAYMENT → ABANDONED_24H.
    // Order is marked ABANDONED_24H regardless of whether we can send the WhatsApp message,
    // so the state write must happen before the phone guard. Wrap in try/catch for structured
    // logging and QStash-retry-eligible error handling.
    try {
      await prisma.order.updateMany({
        where: { id: orderId, conversationState: { in: ["ABANDONED_1H", "AWAITING_PAYMENT"] } },
        data: { conversationState: "ABANDONED_24H" },
      });
    } catch (dbErr) {
      console.log(JSON.stringify({ level: "error", event: "abandoned_close_state_update_failed", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "web" }));
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 }); // QStash retry
    }
    // Still mark as ABANDONED_24H even if we can't send a message
    if (!order.client?.whatsappSenderId) {
      return NextResponse.json({ status: "ok" });
    }
    // Send closure message (imported from bot-engine) — never throws
    await sendAbandonedClosureMessage(orderId, order.client.whatsappSenderId);
    console.log(JSON.stringify({ level: "info", event: "abandoned_close_sent", orderId, service: "web" }));
    return NextResponse.json({ status: "ok" });
  }

  return NextResponse.json({ status: "ok" });
}

/**
 * Mark an order as permanently failed (terminal state).
 * Sets conversationState=FAILED + orderStatus=CANCELLED, upserts Generation error record,
 * notifies operator, and sends graceful client message.
 * Never throws — all steps are best-effort.
 *
 * NOTE: OrderStatus has no FAILED value (schema: PENDING|PAID|GENERATING|DELIVERED|CANCELLED).
 * Use orderStatus=CANCELLED + conversationState=FAILED to represent terminal generation failure.
 */
async function markOrderFailed(
  orderId: string,
  attempt: number,
  errorCode: string,
  promptUsed: string | null,
  clientPhone: string | null,
): Promise<void> {
  console.log(
    JSON.stringify({
      level: "error",
      event: "generation_failed_permanently",
      orderId,
      attempt,
      errorCode,
      service: "web",
    }),
  );

  // Step 1: Update Order to terminal failure state
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { conversationState: "FAILED", orderStatus: "CANCELLED" },
    });
  } catch (dbErr) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "mark_order_failed_order_update_failed",
        orderId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        service: "web",
      }),
    );
  }

  // Step 2: Upsert Generation record with error context in revisionFeedback field
  // (no dedicated errorCode column exists — revisionFeedback is re-purposed for failure context)
  try {
    await prisma.generation.upsert({
      where: { orderId_attemptNumber: { orderId, attemptNumber: attempt } },
      update: { revisionFeedback: errorCode },
      create: {
        orderId,
        attemptNumber: attempt,
        promptUsed: promptUsed ?? "unknown",
        revisionFeedback: errorCode,
      },
    });
  } catch (dbErr) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "mark_order_failed_generation_upsert_failed",
        orderId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        service: "web",
      }),
    );
  }

  // Step 3: Notify operator (never throws)
  await notifyOperator(orderId, "ERROR", "Generation failed after all retries");

  // Step 4: Send graceful message to client (never throws)
  if (clientPhone) {
    await sendGenerationFailureMessage(orderId, clientPhone);
  }
}

async function handleGenerate(orderId: string, attempt: number): Promise<NextResponse> {
  // 4. Load order — idempotency check
  let order;
  try {
    order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderStatus: true,
        conversationState: true,
        photosUrls: true,
        client: { select: { whatsappSenderId: true, name: true } },
      },
    });
  } catch (dbErr) {
    console.log(JSON.stringify({ level: "error", event: "generate_consumer_db_error", orderId, error: dbErr instanceof Error ? dbErr.message : String(dbErr), service: "web" }));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 }); // triggers QStash retry
  }

  if (!order) {
    console.log(JSON.stringify({ level: "warn", event: "generate_consumer_order_not_found", orderId, service: "web" }));
    return NextResponse.json({ error: "Order not found" }, { status: 404 }); // 404 = not retry-eligible
  }

  // Skip if order already delivered, completed, or permanently failed (idempotency).
  // conversationState=FAILED check guards against double-notification when the DB
  // orderStatus update succeeded but QStash still retries (e.g. race between DB commit
  // and QStash ack). Without this guard, markOrderFailed would fire again on each retry
  // after a partial DB failure, sending duplicate operator alerts and client messages.
  if (
    order.orderStatus === "DELIVERED" ||
    order.orderStatus === "CANCELLED" ||
    order.conversationState === "FAILED"
  ) {
    console.log(JSON.stringify({ level: "info", event: "generate_consumer_idempotent_skip", orderId, orderStatus: order.orderStatus, conversationState: order.conversationState, service: "web" }));
    return NextResponse.json({ status: "ok" });
  }

  console.log(JSON.stringify({ level: "info", event: "generate_consumer_processing", orderId, attempt, service: "web" }));

  // 5. PROMPT ENRICHMENT (Story 4.2)
  // Load latest revision feedback if this is a retry/revision (attempt > 1)
  let revisionFeedback: string | null = null;
  if (attempt > 1) {
    try {
      const prevGeneration = await prisma.generation.findUnique({
        where: { orderId_attemptNumber: { orderId, attemptNumber: attempt - 1 } },
        select: { revisionFeedback: true },
      });
      revisionFeedback = prevGeneration?.revisionFeedback ?? null;
    } catch {
      // Non-fatal: proceed without revision feedback
      console.log(JSON.stringify({ level: "warn", event: "generate_consumer_revision_fetch_failed", orderId, attempt, service: "web" }));
    }
  }

  let enrichResult: Awaited<ReturnType<typeof enrichPrompt>>;
  try {
    enrichResult = await enrichPrompt({ orderId, attemptNumber: attempt, revisionFeedback });
  } catch (enrichErr) {
    console.log(JSON.stringify({ level: "error", event: "generate_consumer_enrich_threw", orderId, attempt, error: enrichErr instanceof Error ? enrichErr.message : String(enrichErr), service: "web" }));
    if (attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS) {
      await markOrderFailed(orderId, attempt, "ENRICH_FAILED", null, order.client?.whatsappSenderId ?? null);
    }
    return NextResponse.json({ error: "Prompt enrichment failed" }, { status: 500 }); // triggers QStash retry
  }
  if (!enrichResult.success) {
    console.log(JSON.stringify({ level: "error", event: "generate_consumer_enrich_failed", orderId, attempt, message: enrichResult.message, service: "web" }));
    if (attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS) {
      await markOrderFailed(orderId, attempt, "ENRICH_FAILED", null, order.client?.whatsappSenderId ?? null);
    }
    return NextResponse.json({ error: "Prompt enrichment failed" }, { status: 500 }); // triggers QStash retry
  }
  console.log(JSON.stringify({ level: "info", event: "generate_consumer_enrich_success", orderId, attempt, generationId: enrichResult.generationId, service: "web" }));

  // 6. IMAGE GENERATION (Story 4.3)
  let genResult: Awaited<ReturnType<typeof generate>>;
  try {
    genResult = await generate({
      generationId: enrichResult.generationId!,
      promptUsed: enrichResult.promptUsed!,
      orderId,
      photosUrls: order.photosUrls,
    });
  } catch (genErr) {
    console.log(JSON.stringify({ level: "error", event: "generate_consumer_gen_threw", orderId, attempt, error: genErr instanceof Error ? genErr.message : String(genErr), service: "web" }));
    if (attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS) {
      await markOrderFailed(orderId, attempt, "GENERATION_FAILED", enrichResult.promptUsed ?? null, order.client?.whatsappSenderId ?? null);
    }
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
  if (!genResult.success) {
    console.log(JSON.stringify({ level: "error", event: "generate_consumer_gen_failed", orderId, attempt, message: genResult.message, service: "web" }));
    if (attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS) {
      await markOrderFailed(orderId, attempt, "GENERATION_FAILED", enrichResult.promptUsed ?? null, order.client?.whatsappSenderId ?? null);
    }
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
  console.log(JSON.stringify({ level: "info", event: "generate_consumer_gen_success", orderId, attempt, generationId: enrichResult.generationId, service: "web" }));

  // Persist AI cost data immediately — separate from imageUrl update so cost is recorded
  // even if the subsequent upload fails (the OpenAI charge is already incurred).
  if (genResult.inputTokens !== undefined) {
    try {
      await prisma.generation.update({
        where: { id: enrichResult.generationId! },
        data: {
          inputTokens: genResult.inputTokens,
          outputTokens: genResult.outputTokens ?? 0,
          imageGenerationCostUsd: genResult.imageGenerationCostUsd,
        },
      });
    } catch (costErr) {
      // Non-fatal — cost logging must not block the delivery pipeline
      console.log(JSON.stringify({ level: "warn", event: "generate_consumer_cost_update_failed", orderId, generationId: enrichResult.generationId, error: costErr instanceof Error ? costErr.message : String(costErr), service: "web" }));
    }
  }

  // 7. QUALITY CHECK (Story 4.4)
  const qualityResult = await qualityCheck({
    generationId: enrichResult.generationId!,
    imageBase64: genResult.imageBase64!,
    photosUrls: order.photosUrls,
    promptUsed: enrichResult.promptUsed!,
    orderId,
  });
  // qualityCheck fails open — success: false means unavailable, not a hard failure
  if (qualityResult.success && !qualityResult.passed && attempt <= MAX_QUALITY_RETRIES) {
    console.log(JSON.stringify({
      level: "warn",
      event: "generate_consumer_quality_retry",
      orderId,
      attempt,
      score: qualityResult.score,
      service: "web",
    }));
    return NextResponse.json({ error: "Quality check failed — retrying" }, { status: 500 });
  }
  console.log(JSON.stringify({
    level: "info",
    event: "generate_consumer_quality_ok",
    orderId,
    attempt,
    score: qualityResult.score,
    passed: qualityResult.passed,
    service: "web",
  }));

  // 8. UPLOAD TO PERMANENT STORAGE (Story 4.5)
  // Guard: imageBase64 must be present — success=true with a missing payload would produce a 0-byte upload.
  if (!genResult.imageBase64) {
    console.log(JSON.stringify({ level: "error", event: "generate_consumer_missing_image_base64", orderId, attempt, generationId: enrichResult.generationId, service: "web" }));
    if (attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS) {
      await markOrderFailed(orderId, attempt, "GENERATION_FAILED", enrichResult.promptUsed ?? null, order.client?.whatsappSenderId ?? null);
    }
    return NextResponse.json({ error: "Image generation returned no data" }, { status: 500 });
  }
  const imageBuffer = Buffer.from(genResult.imageBase64, "base64");
  let imageUrl: string;
  try {
    imageUrl = await uploadGeneratedWithRetry(imageBuffer, orderId, attempt, enrichResult.generationId!);
  } catch (uploadErr) {
    // Upload failed after all internal retries — always a terminal failure regardless of QStash attempt number.
    console.log(JSON.stringify({
      level: "error",
      event: "generate_consumer_upload_failed",
      orderId,
      attempt,
      generationId: enrichResult.generationId,
      error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
      service: "web",
    }));
    await markOrderFailed(orderId, attempt, "UPLOAD_FAILED", enrichResult.promptUsed ?? null, order.client?.whatsappSenderId ?? null);
    return NextResponse.json({ error: "Storage upload failed after retries" }, { status: 500 });
  }
  console.log(JSON.stringify({
    level: "info",
    event: "generate_consumer_upload_success",
    orderId,
    attempt,
    generationId: enrichResult.generationId,
    // imageUrl intentionally omitted — it is a signed/permanent storage URL that
    // acts as an access credential; logging it would expose the asset to anyone
    // with log access (NFR-12: PII/credential redaction in logs).
    service: "web",
  }));

  // 9. DELIVER TO CLIENT VIA WHATSAPP (Story 4.6)
  // Guard: order.client must be present (FK integrity). A missing client would
  // cause a runtime TypeError crash. Treat as a non-retryable data error (404-family
  // semantics) by returning 500 with a distinct event so the operator can investigate
  // without burning all QStash retry attempts.
  if (!order.client?.whatsappSenderId) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "generate_consumer_missing_client_phone",
        orderId,
        attempt,
        service: "web",
      }),
    );
    return NextResponse.json({ error: "Order has no client phone — cannot deliver" }, { status: 500 });
  }

  const deliveryResult = await deliverImageToClient({
    orderId,
    imageUrl,
    recipientPhone: order.client.whatsappSenderId,
    clientName: order.client.name,
  });

  if (!deliveryResult.success) {
    // delivery failed — log and return 500 for QStash retry
    console.log(
      JSON.stringify({
        level: "error",
        event: "generate_consumer_delivery_failed",
        orderId,
        attempt,
        message: deliveryResult.message,
        service: "web",
      }),
    );
    // On final attempt: mark order failed (notifies operator + sends client message).
    // On earlier attempts: return 500 for QStash retry without marking as failed.
    if (attempt >= QSTASH_MAX_DELIVERY_ATTEMPTS) {
      await markOrderFailed(orderId, attempt, "DELIVERY_FAILED", enrichResult.promptUsed ?? null, order.client?.whatsappSenderId ?? null);
    }
    return NextResponse.json({ error: "Delivery failed" }, { status: 500 });
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "generate_consumer_delivery_success",
      orderId,
      attempt,
      service: "web",
    }),
  );

  // LGPD: schedule reference photo deletion 30 days from now (best-effort, non-fatal).
  // Use updateMany (not update) so that if photosDeleteAt is already set on a QStash retry,
  // the WHERE guard simply matches 0 rows and returns { count: 0 } without throwing P2025.
  // This prevents spurious set_photos_delete_at_failed warn logs on every retry after the
  // first successful delivery attempt has already set the deletion date.
  try {
    await prisma.order.updateMany({
      where: { id: orderId, photosDeleteAt: null },
      data: { photosDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "set_photos_delete_at_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "web",
      }),
    );
  }

  return NextResponse.json({ status: "ok" });
}

/**
 * Retry uploadGenerated up to MAX_UPLOAD_RETRIES times, then throw on final failure.
 * The DB update (Generation.imageUrl) is performed AFTER a successful upload and is
 * NOT retried alongside the upload — a DB failure here throws immediately so the
 * caller can mark the order CANCELLED without re-uploading an already-stored file.
 */
async function uploadGeneratedWithRetry(
  imageBuffer: Buffer,
  orderId: string,
  attempt: number,
  generationId: string,
): Promise<string> {
  const MAX_UPLOAD_RETRIES = 2;
  let lastErr: unknown;
  let uploadedUrl: string | undefined;

  // Retry loop covers only the storage upload, not the DB write.
  for (let i = 0; i <= MAX_UPLOAD_RETRIES; i++) {
    try {
      uploadedUrl = await uploadGenerated(orderId, attempt, imageBuffer);
      break; // upload succeeded — exit retry loop
    } catch (err) {
      lastErr = err;
      if (i < MAX_UPLOAD_RETRIES) {
        console.log(JSON.stringify({
          level: "warn",
          event: "generate_consumer_upload_retry",
          orderId,
          attempt,
          generationId,
          retryAttempt: i + 1,
          error: err instanceof Error ? err.message : String(err),
          service: "web",
        }));
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  if (!uploadedUrl) {
    throw lastErr;
  }

  // DB update is separate from upload retries. If this throws, the caller marks the
  // order CANCELLED (upload succeeded but the record is inconsistent — acceptable as
  // a terminal failure; operator can reconcile via storage path convention).
  await prisma.generation.update({
    where: { id: generationId },
    data: { imageUrl: uploadedUrl },
  });

  return uploadedUrl;
}
