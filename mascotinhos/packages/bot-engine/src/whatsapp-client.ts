import { env } from "@mascotinhos/env/server";

/** WhatsApp Cloud API version used for direct Graph API calls. */
export const WHATSAPP_API_VERSION = "v25.0";

/** Default fetch timeout for WhatsApp API calls in milliseconds. */
export const WA_FETCH_TIMEOUT_MS = 10_000;

/**
 * Create an AbortSignal that times out after WA_FETCH_TIMEOUT_MS milliseconds.
 * Falls back gracefully if AbortSignal.timeout is unavailable (older runtimes).
 */
export function makeAbortSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(WA_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

/**
 * Build the WhatsApp Cloud API messages endpoint URL.
 *
 * Reads env at call time (not at module evaluation) so that Bun test mocks on
 * `@mascotinhos/env/server` apply correctly — the same pattern used in
 * deliver-image-to-client.ts, send-abandoned-cart-messages.ts, and notify-operator.ts.
 */
export function buildMessagesUrl(): string {
  return `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}
