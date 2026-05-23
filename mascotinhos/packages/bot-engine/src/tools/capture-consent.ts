import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";

/** Single source of truth for the LGPD consent policy version stored in the DB. */
const CONSENT_VERSION = "1.0";

/**
 * Circuit breaker: track consecutive captureConsent failures per order.
 * After MAX_CONSENT_FAILURES, skip consent and proceed (escalate gracefully).
 * In-memory — resets on process restart, which is acceptable since the failure
 * loop happens within a single session.
 */
const MAX_CONSENT_FAILURES = 2;
const consentFailureCounts = new Map<string, number>();

/** Reset failure count for an order (call after success or order completion). */
export function resetConsentFailures(orderId: string): void {
  consentFailureCounts.delete(orderId);
}

export const captureConsent = tool({
  description:
    "Record LGPD consent for a client when they send their first photo. Call once per client before accepting the first photo in COLLECTING_PHOTOS state. Only call when hasConsent is false. Uses the clientId from the order context. If this returns success: false, do NOT proceed with collectPhotos — inform the client of a temporary error and ask them to try again. If this returns circuitBreakerTripped: true, consent capture is being skipped due to repeated failures — proceed with collectPhotos anyway and the operator will be notified.",
  inputSchema: z.object({
    clientId: z.string().describe("Client DB ID — use the clientId value from the order context"),
    orderId: z.string().describe("Current order ID for audit log"),
  }),
  execute: async ({ clientId, orderId }) => {
    // Circuit breaker: after MAX_CONSENT_FAILURES, skip consent to unblock the customer
    const failures = consentFailureCounts.get(orderId) ?? 0;
    if (failures >= MAX_CONSENT_FAILURES) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "lgpd_consent_circuit_breaker_tripped",
          clientId,
          orderId,
          failures,
          service: "bot-engine",
        }),
      );
      // Allow the flow to continue — operator should capture consent manually later
      return {
        success: true,
        consentRecorded: false,
        circuitBreakerTripped: true,
        message: "Consentimento será registrado posteriormente. Prossiga com o atendimento.",
      };
    }

    try {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          consentTimestamp: new Date(),
          consentVersion: CONSENT_VERSION,
        },
      });

      // Success — reset failure counter
      consentFailureCounts.delete(orderId);

      console.log(
        JSON.stringify({
          level: "info",
          event: "lgpd_consent_captured",
          clientId,
          orderId,
          consentVersion: CONSENT_VERSION,
          service: "bot-engine",
        }),
      );

      return { success: true, consentRecorded: true };
    } catch (err) {
      // Increment failure counter
      consentFailureCounts.set(orderId, failures + 1);

      console.log(
        JSON.stringify({
          level: "error",
          event: "lgpd_consent_capture_failed",
          clientId,
          orderId,
          failureCount: failures + 1,
          maxFailures: MAX_CONSENT_FAILURES,
          error: err instanceof Error ? err.message : String(err),
          service: "bot-engine",
        }),
      );

      return {
        success: false,
        failureCount: failures + 1,
        maxFailures: MAX_CONSENT_FAILURES,
        message: failures + 1 >= MAX_CONSENT_FAILURES
          ? "Erro persistente ao registrar consentimento. Na próxima tentativa, o sistema vai prosseguir automaticamente."
          : "Erro ao registrar consentimento. Peça ao cliente para enviar a foto novamente.",
      };
    }
  },
});
