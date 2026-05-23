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
 * Send payment confirmation messages to client via WhatsApp Cloud API.
 * Called from payment webhook handler after payment is confirmed.
 * Never throws — all errors are caught and logged.
 */
export async function sendPaymentConfirmationMessages(
  orderId: string,
  recipientPhone: string, // client.whatsappSenderId
  clientName: string | null | undefined,
): Promise<void> {
  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    };

    const messagesUrl = buildMessagesUrl();

    // Step 1: Send typing indicator (non-fatal if it fails)
    try {
      await fetch(messagesUrl, {
        method: "POST",
        headers,
        signal: makeAbortSignal(),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "action",
          action: { type: "typing", duration: 1500 },
        }),
      });
    } catch {
      // Typing indicator failure is non-fatal — proceed to message send
    }

    // Step 2: Send confirmation message
    const confirmResponse = await fetch(messagesUrl, {
      method: "POST",
      headers,
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: "Pagamento confirmado! Vou começar a preparar sua arte agora 🎨" },
      }),
    });

    if (!confirmResponse.ok) {
      throw new Error(`WhatsApp API error: ${confirmResponse.status}`);
    }

    // Step 3: Send warm follow-up
    // Sanitize name: strip newlines/control chars to prevent message splitting
    const rawName = clientName?.trim() || null;
    const name = rawName ? sanitizeName(rawName) : null;
    const followUpBody = name
      ? `Estou preparando a arte da ${name} com carinho... Você será avisada assim que ficar pronta! 💕`
      : "Estou preparando a arte com carinho... Você será avisada assim que ficar pronta! 💕";

    const followUpResponse = await fetch(messagesUrl, {
      method: "POST",
      headers,
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: followUpBody },
      }),
    });

    if (!followUpResponse.ok) {
      throw new Error(`WhatsApp follow-up API error: ${followUpResponse.status}`);
    }
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "payment_confirmation_whatsapp_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    // Do NOT rethrow — caller must still return { received: true } HTTP 200
  }
}
