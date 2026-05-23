import { env } from "@mascotinhos/env/server";
import { makeAbortSignal, buildMessagesUrl } from "./whatsapp-client";

/**
 * Redact a phone number for PII-safe logging.
 * Only the last 4 digits are preserved: e.g. "5511999998888" → "***8888"
 * NFR-12: PII redaction in logs.
 */
export function redactPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `***${phone.slice(-4)}`;
}

/**
 * Send a critical failure notification to the operator via WhatsApp.
 *
 * Message format: [MASCOTINHOS] {severity}: {message} | Order: {orderId}
 *
 * Uses the Graph API directly (same as send-abandoned-cart-messages.ts), NOT the
 * Chat SDK bot instance — the bot is for client conversations, not operator alerts.
 *
 * NEVER THROWS — all errors are caught and logged internally so that a
 * notification failure never masks the original error that triggered it.
 *
 * Architecture ref: "Operator Notifications" section — format and channel defined there.
 */
export async function notifyOperator(
  orderId: string,
  severity: "ERROR" | "WARN",
  message: string,
): Promise<void> {
  try {
    const messagesUrl = buildMessagesUrl();
    // Sanitize caller-supplied strings to prevent log injection and WhatsApp message
    // field spoofing. Strip pipe characters (our field delimiter) and control chars
    // (newlines/carriage-returns that could split a single log line into two events).
    const safeMessage = message.replace(/[|\r\n]/g, " ").trim();
    const safeOrderId = orderId.replace(/[|\r\n]/g, "_").trim();
    const body = `[MASCOTINHOS] ${severity}: ${safeMessage} | Order: ${safeOrderId}`;

    const response = await fetch(messagesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: env.OPERATOR_WHATSAPP_NUMBER,
        type: "text",
        text: { body },
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "operator_notified",
        orderId,
        severity,
        service: "bot-engine",
      }),
    );
  } catch (err) {
    // Use safeOrderId if available; otherwise sanitize again inline.
    const safeOrderIdForLog = orderId.replace(/[|\r\n]/g, "_").trim();
    console.log(
      JSON.stringify({
        level: "warn",
        event: "operator_notify_failed",
        orderId: safeOrderIdForLog,
        severity,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    // Never rethrow — operator notification failure must not mask the original error
  }
}
