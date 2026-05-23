import { env } from "@mascotinhos/env/server";
import { makeAbortSignal, buildMessagesUrl } from "./whatsapp-client";

/**
 * Send a graceful failure message to a client whose image generation failed permanently.
 * Informs them that the operator will personally follow up.
 * Never throws — all errors are caught and logged.
 */
export async function sendGenerationFailureMessage(
  orderId: string,
  recipientPhone: string,
): Promise<void> {
  try {
    const messagesUrl = buildMessagesUrl();
    const messageBody =
      "Desculpa, tivemos um probleminha técnico. O Giovani vai resolver pessoalmente!";

    // Sanitize caller-supplied strings to prevent log injection.
    // Strip control characters (newlines/carriage-returns that could split a log line)
    // and pipe characters (consistent with notify-operator.ts sanitization pattern).
    const safePhone = recipientPhone.replace(/[|\r\n]/g, "").trim();
    const safeOrderId = orderId.replace(/[|\r\n]/g, "_").trim();

    const response = await fetch(messagesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: safePhone,
        type: "text",
        text: { body: messageBody },
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "generation_failure_message_sent",
        orderId: safeOrderId,
        service: "bot-engine",
      }),
    );
  } catch (err) {
    const safeOrderIdForLog = orderId.replace(/[|\r\n]/g, "_").trim();
    console.log(
      JSON.stringify({
        level: "warn",
        event: "generation_failure_message_failed",
        orderId: safeOrderIdForLog,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    // Never rethrow — client notification failure must not mask the original error
  }
}
