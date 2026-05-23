import { env } from "@mascotinhos/env/server";
import { makeAbortSignal, buildMessagesUrl } from "./whatsapp-client";

/**
 * Strip newlines and control characters from a user-supplied name so it cannot
 * split the WhatsApp message body into unexpected segments.
 */
function sanitizeName(raw: string): string {
  // Replace any run of whitespace-only chars (including \n, \r, \t) with a single space
  return raw.replace(/[\r\n\t\x00-\x1F\x7F]/g, " ").trim();
}

/**
 * Send nudge WhatsApp message to a client who went silent after entering the payment flow.
 * Fires at 1.5 hours (5400s) after entering AWAITING_PAYMENT state via QStash.
 * Never throws — all errors are caught and logged.
 */
export async function sendAbandonedNudgeMessage(
  orderId: string,
  recipientPhone: string,
  clientName: string | null | undefined,
): Promise<void> {
  try {
    const messagesUrl = buildMessagesUrl();

    const rawName = clientName?.trim() || null;
    const name = rawName ? sanitizeName(rawName) : null;
    const messageBody = name
      ? `Oi ${name}! Vi que você começou a criar o mascotinho. Posso te ajudar com algo?`
      : "Oi! Vi que você começou a criar o mascotinho. Posso te ajudar com algo?";

    const response = await fetch(messagesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: messageBody },
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "abandoned_nudge_whatsapp_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    // Do NOT rethrow — caller must still return HTTP 200 to QStash
  }
}

/**
 * Send closure WhatsApp message to a client who did not pay within 24 hours.
 * Fires at 24 hours (86400s) after entering AWAITING_PAYMENT state via QStash.
 * Never throws — all errors are caught and logged.
 */
export async function sendAbandonedClosureMessage(
  orderId: string,
  recipientPhone: string,
): Promise<void> {
  try {
    const messagesUrl = buildMessagesUrl();

    const response = await fetch(messagesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: "Tudo bem! Se mudar de ideia, estou aqui. Só me chamar!" },
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "abandoned_closure_whatsapp_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    // Do NOT rethrow — caller must still return HTTP 200 to QStash
  }
}
