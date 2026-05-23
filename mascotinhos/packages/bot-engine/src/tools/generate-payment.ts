import { tool } from "ai";
import { z } from "zod";
import { Client as QStashClient } from "@upstash/qstash";
import prisma from "@mascotinhos/db";
import { createOrUpdateCustomer, createPixCharge, buildSplitConfig, fetchPixQrCode } from "@mascotinhos/payments";
import { env } from "@mascotinhos/env/server";
import { ORDER_ID_PATTERN } from "../order-id";
import { sendPixMessages, resendPixFromPath } from "../send-pix-messages";

export const generatePayment = tool({
  description:
    "Generate a PIX QR code and create a payment record for the confirmed order. Call when conversationState is AWAITING_PAYMENT.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
  }),
  execute: async ({ orderId }) => {
    // UUID validation
    if (!ORDER_ID_PATTERN.test(orderId)) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "generate_payment_invalid_id",
          orderId,
          service: "bot-engine",
        }),
      );
      return { success: false, message: "ID de pedido inválido." };
    }

    // Load order with client join
    let order;
    try {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true },
      });
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "generate_payment_db_error",
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao processar pagamento. Tente novamente." };
    }

    if (!order) {
      return { success: false, message: "Pedido não encontrado." };
    }

    // Guard wrong state
    if (order.conversationState !== "AWAITING_PAYMENT") {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "generate_payment_wrong_state",
          orderId,
          state: order.conversationState,
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Estado inválido para pagamento." };
    }

    // Layer 1 idempotency: check for existing PENDING or already-paid charge in DB
    try {
      const existingPayment = await prisma.payment.findFirst({
        where: { orderId, status: { in: ["PENDING", "CONFIRMED"] } },
      });
      if (existingPayment) {
        console.log(
          JSON.stringify({
            level: "info",
            event: "generate_payment_idempotent_reuse",
            orderId,
            asaasId: existingPayment.asaasId,
            status: existingPayment.status,
            service: "bot-engine",
          }),
        );
        // Re-send QR code + copia e cola (client may have lost the previous message)
        const phone = order.client?.whatsappSenderId ?? "";
        let resendOk = false;
        if (phone) {
          if (existingPayment.pixQrStoragePath && existingPayment.pixQrCode) {
            // Fast path: use cached storage path — no upload, no Asaas call.
            // resendPixFromPath wraps its WhatsApp calls in internal try/catch, so it doesn't throw.
            await resendPixFromPath(orderId, phone, existingPayment.pixQrStoragePath, existingPayment.pixQrCode);
            resendOk = true;
          } else if (existingPayment.asaasId && existingPayment.pixQrCode) {
            // Legacy fallback: re-fetch fresh QR from Asaas, upload, cache path
            console.log(
              JSON.stringify({
                level: "info",
                event: "generate_payment_legacy_pix_refetch",
                orderId,
                asaasId: existingPayment.asaasId,
                service: "bot-engine",
              }),
            );
            try {
              const qrResult = await fetchPixQrCode(existingPayment.asaasId);
              const pixResult = await sendPixMessages(orderId, phone, qrResult.pixQrCodeBase64, qrResult.pixCopyPaste);
              if (pixResult.storagePath) {
                await prisma.payment.update({
                  where: { id: existingPayment.id },
                  data: { pixQrStoragePath: pixResult.storagePath },
                }).catch(() => {});
              }
              resendOk = true;
            } catch (err) {
              console.log(
                JSON.stringify({
                  level: "warn",
                  event: "generate_payment_legacy_pix_refetch_failed",
                  orderId,
                  error: err instanceof Error ? err.message : String(err),
                  service: "bot-engine",
                }),
              );
            }
          }
        }
        return resendOk
          ? {
              success: true,
              chargeId: existingPayment.asaasId,
              message: "PIX reenviado! QR code e código copia-e-cola já foram enviados ao cliente.",
            }
          : {
              success: false,
              message: "Não consegui reenviar o PIX agora. Tente de novo em alguns segundos.",
            };
      }
    } catch (dbErr) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "generate_payment_db_error",
          orderId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao processar pagamento. Tente novamente." };
    }

    // Client data with null safety
    const clientPhone = order.client?.whatsappSenderId ?? "";
    const clientName = order.client?.name ?? "Cliente";

    if (!clientPhone) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "generate_payment_customer_error",
          orderId,
          error: "missing client phone",
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao processar pagamento. Tente novamente." };
    }

    // Create/find Asaas customer
    let customerId: string;
    try {
      const customer = await createOrUpdateCustomer(clientPhone, clientName);
      customerId = customer.id;
    } catch (err) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "generate_payment_customer_error",
          orderId,
          error: err instanceof Error ? err.message : String(err),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Erro ao processar pagamento. Tente novamente." };
    }

    // Build optional split config
    const splitConfig = env.ASAAS_SPLIT_WALLET_ID
      ? buildSplitConfig(env.ASAAS_SPLIT_WALLET_ID, 10)
      : undefined;

    // Create PIX charge (Layer 2 idempotency inside createPixCharge)
    const amount = Number(order.price);
    let chargeResult;
    try {
      chargeResult = await createPixCharge(customerId, orderId, amount, splitConfig);
    } catch (err) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "generate_payment_asaas_error",
          orderId,
          error: err instanceof Error ? err.message : String(err),
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Ops, tive um probleminha. Vou gerar outro QR code!" };
    }

    // Persist Payment record (pixQrImageUrl no longer written — pixQrStoragePath added after upload)
    try {
      await prisma.payment.create({
        data: {
          orderId,
          asaasId: chargeResult.chargeId,
          pixQrCode: chargeResult.pixCopyPaste,
          amount: order.price,
          status: "PENDING",
          // Cast: AsaasSplit[] is a JSON-serializable array; Prisma Json? expects InputJsonValue | NullableJsonNull.
          // Prisma namespace not re-exported via @mascotinhos/db, so we use typeof-based extraction to stay type-safe
          // without a runtime import that would trigger env validation in tests.
          splitConfig: (splitConfig ?? null) as Parameters<typeof prisma.payment.create>[0]["data"]["splitConfig"],
        },
      });
    } catch (dbErr) {
      const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      const isUniqueConstraint =
        errMsg.includes("Unique constraint") || errMsg.includes("unique constraint");
      // Unique constraint on asaasId = race condition — charge already recorded, treat as success
      // Any other DB error: charge was created in Asaas but not recorded — log at error level
      console.log(
        JSON.stringify({
          level: isUniqueConstraint ? "warn" : "error",
          event: isUniqueConstraint ? "generate_payment_record_exists" : "generate_payment_db_persist_error",
          orderId,
          asaasId: chargeResult.chargeId,
          error: errMsg,
          service: "bot-engine",
        }),
      );
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "generate_payment_success",
        orderId,
        asaasId: chargeResult.chargeId,
        service: "bot-engine",
      }),
    );

    // Send QR code image + copia e cola directly via WhatsApp API (non-fatal)
    try {
      const pixResult = await sendPixMessages(orderId, clientPhone, chargeResult.pixQrCodeBase64, chargeResult.pixCopyPaste);
      if (pixResult.storagePath) {
        await prisma.payment.update({
          where: { asaasId: chargeResult.chargeId },
          data: { pixQrStoragePath: pixResult.storagePath },
        }).catch(() => {}); // non-fatal: next reuse will re-derive via deterministic path
      }
    } catch (err) {
      console.log(JSON.stringify({
        level: "warn",
        event: "generate_payment_pix_send_failed",
        orderId,
        asaasId: chargeResult.chargeId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }));
    }

    // Publish abandoned cart recovery messages (non-fatal if QStash fails)
    try {
      // NOTE: QStashClient constructed per-call — Bun mock.module() patches apply at
      // function-call time, so module-level instantiation would bypass test mocks.
      const qstash = new QStashClient({ token: env.QSTASH_TOKEN });
      const targetUrl = `https://${env.VERCEL_URL}/api/generate`;
      // retries: 3 matches the generate job pattern (enqueue-generation.ts) and ensures
      // transient delivery failures are retried. Idempotency guards in handleAbandonedCart
      // prevent duplicate WhatsApp sends on retry.
      await qstash.publishJSON({ url: targetUrl, body: { orderId, action: "nudge_abandoned" }, delay: 5400, retries: 3 });
      await qstash.publishJSON({ url: targetUrl, body: { orderId, action: "close_abandoned" }, delay: 86400, retries: 3 });
      console.log(JSON.stringify({ level: "info", event: "generate_payment_abandoned_cart_scheduled", orderId, service: "bot-engine" }));
    } catch (qErr) {
      // Non-fatal: QStash publishing failure should not prevent payment QR from being returned
      console.log(JSON.stringify({ level: "warn", event: "generate_payment_abandoned_cart_schedule_failed", orderId, error: qErr instanceof Error ? qErr.message : String(qErr), service: "bot-engine" }));
    }

    return {
      success: true,
      chargeId: chargeResult.chargeId,
      message: "PIX enviado! QR code e código copia-e-cola já foram enviados ao cliente. Aguardando pagamento.",
    };
  },
});
