import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@mascotinhos/db";
import { sanitizeIp } from "@/lib/sanitize-ip";
import {
  verifyWebhookSignature,
  type AsaasWebhookPayload,
} from "@mascotinhos/payments";

const asaasWebhookSchema = z.object({
  // Accept any event string — unknown event types are handled gracefully below
  // (returns 200 so Asaas doesn't retry). Zod enum would reject future events with 400.
  event: z.string().min(1),
  payment: z.object({
    id: z.string().min(1),
    externalReference: z.string().optional(),
    status: z.string().min(1),
    value: z.number().optional(),
    netValue: z.number(), // Asaas net after fees — required for unit-economics tracking
  }),
});
import { enqueueGeneration, sendPaymentConfirmationMessages } from "@mascotinhos/bot-engine";

export function GET(): NextResponse {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

// 64 KB — Asaas webhook payloads are tiny; guard against malicious large bodies
const MAX_BODY_BYTES = 65_536;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 0. Body size guard
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "payment_webhook_payload_too_large",
        contentLength,
        service: "web",
      })
    );
    return NextResponse.json({ error: "Payload Too Large" }, { status: 413 });
  }

  // 1. Signature verification
  const token = request.headers.get("asaas-access-token") ?? "";
  if (!token || !verifyWebhookSignature(token)) {
    const ip = sanitizeIp(request.headers.get("x-forwarded-for"));
    console.log(
      JSON.stringify({
        level: "warn",
        event: "payment_webhook_invalid_signature",
        ip,
        service: "web",
      })
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate payload
  let payload: AsaasWebhookPayload;
  try {
    const raw = await request.json();
    const result = asaasWebhookSchema.safeParse(raw);
    if (!result.success) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "payment_webhook_invalid_payload",
          issues: result.error.issues,
          service: "web",
        })
      );
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    payload = result.data as AsaasWebhookPayload;
  } catch {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "payment_webhook_invalid_payload",
        service: "web",
      })
    );
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const asaasId = payload.payment.id;

  // 3. Look up payment record
  let payment: {
    id: string;
    orderId: string;
    asaasId: string;
    status: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED";
    order: {
      id: string;
      client: {
        id: string;
        whatsappSenderId: string;
        name: string | null;
      } | null;
    } | null;
  } | null;
  try {
    payment = await prisma.payment.findFirst({
      where: { asaasId },
      include: { order: { include: { client: true } } },
    });
  } catch (dbErr) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "payment_webhook_db_error",
        asaasId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        service: "web",
      })
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  if (!payment) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "payment_webhook_unknown_charge",
        asaasId,
        service: "web",
      })
    );
    return NextResponse.json({ received: true });
  }

  const { event } = payload;
  const orderId = payment.orderId;

  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    // Idempotency check — skip if payment already reached a terminal confirmed state
    if (payment.status !== "PENDING") {
      console.log(
        JSON.stringify({
          level: "info",
          event: "payment_webhook_idempotent_skip",
          asaasId,
          orderId,
          service: "web",
        })
      );
      return NextResponse.json({ received: true });
    }

    // Atomic update: payment + order
    try {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: "CONFIRMED", confirmedAt: new Date(), netAmount: payload.payment.netValue },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: {
            conversationState: "GENERATING",
            orderStatus: "GENERATING",
          },
        }),
      ]);
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "payment_webhook_db_error",
          asaasId,
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "web",
        })
      );
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "payment_webhook_confirmed",
        asaasId,
        orderId,
        service: "web",
      })
    );

    // Send payment confirmation messages to client via WhatsApp
    const recipientPhone = payment.order?.client?.whatsappSenderId ?? "";
    const clientName = payment.order?.client?.name ?? null;

    if (recipientPhone) {
      // sendPaymentConfirmationMessages is designed never to throw; outer catch is defence-in-depth
      try {
        await sendPaymentConfirmationMessages(orderId, recipientPhone, clientName);
      } catch (waErr) {
        console.log(
          JSON.stringify({
            level: "warn",
            event: "payment_confirmation_wa_outer_catch",
            orderId,
            error: waErr instanceof Error ? waErr.message : String(waErr),
            service: "web",
          })
        );
      }
    } else {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "payment_confirmation_missing_phone",
          orderId,
          service: "web",
        })
      );
    }

    // Enqueue generation (stub — Story 4.1 implements actual QStash publish)
    try {
      if (!enqueueGeneration.execute) {
        console.log(
          JSON.stringify({
            level: "warn",
            event: "payment_webhook_enqueue_not_available",
            orderId,
            service: "web",
          })
        );
      } else {
        const ctx = {
          toolCallId: "payment-webhook",
          messages: [],
          abortSignal: undefined as unknown as AbortSignal,
        };
        await enqueueGeneration.execute({ orderId }, ctx);
      }
    } catch (enqueueErr) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "payment_webhook_enqueue_failed",
          orderId,
          error:
            enqueueErr instanceof Error
              ? enqueueErr.message
              : String(enqueueErr),
          service: "web",
        })
      );
      // Do NOT return 500 here — the payment is confirmed, queue failure must not fail the webhook
    }
  } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED") {
    try {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "payment_webhook_db_error",
          asaasId,
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "web",
        })
      );
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
    console.log(
      JSON.stringify({
        level: "info",
        event: "payment_webhook_failed",
        asaasId,
        orderId,
        webhookEvent: event,
        service: "web",
      })
    );
  } else {
    // Unknown/unhandled Asaas event — log for observability, return 200 so Asaas doesn't retry
    console.log(
      JSON.stringify({
        level: "warn",
        event: "payment_webhook_unhandled_event",
        webhookEvent: event,
        asaasId,
        orderId,
        service: "web",
      })
    );
  }

  return NextResponse.json({ received: true });
}
