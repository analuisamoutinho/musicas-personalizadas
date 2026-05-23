import { createHmac, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { sanitizeIp } from "@/lib/sanitize-ip";

export const maxDuration = 60;

// Lazy imports to avoid module-level initialization crashes on Vercel
const getBot = async () => (await import("@mascotinhos/bot-engine")).bot;
const getEnv = async () => (await import("@mascotinhos/env/server")).env;

// Chat SDK handles GET (Meta verification handshake) and POST (message delivery).
// Signature verification (HMAC-SHA256 via X-Hub-Signature-256) is also performed by Chat SDK,
// but we add an explicit pre-check to log failures with source IP before delegating.

// 256 KB — WhatsApp webhook payloads contain message events; guard against large bodies
const MAX_BODY_BYTES = 262_144;

export async function GET(request: Request): Promise<Response> {
  try {
    const bot = await getBot();
    return await bot.webhooks.whatsapp(request);
  } catch (err) {
    const errorDetail = err instanceof Error ? err.message : JSON.stringify(err);
    console.error(JSON.stringify({ level: "error", event: "whatsapp_webhook_get_error", error: errorDetail }));
    return new Response(JSON.stringify({ error: errorDetail }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

/**
 * Verify X-Hub-Signature-256 header using HMAC-SHA256 with WHATSAPP_APP_SECRET.
 */
async function verifyWhatsAppSignature(body: string, signature: string): Promise<boolean> {
  try {
    const env = await getEnv();
    const expectedHex = createHmac("sha256", env.WHATSAPP_APP_SECRET).update(body).digest("hex");
    const expectedSignature = `sha256=${expectedHex}`;
    const expectedBuf = Buffer.from(expectedSignature);
    const incomingBuf = Buffer.from(signature.trim());
    if (incomingBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(incomingBuf, expectedBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload Too Large" }, { status: 413 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload Too Large" }, { status: 413 });
  }

  const signature = request.headers.get("x-hub-signature-256") ?? "";
  if (!signature || !(await verifyWhatsAppSignature(body, signature))) {
    const ip = sanitizeIp(request.headers.get("x-forwarded-for"));
    console.log(
      JSON.stringify({
        level: "warn",
        event: "whatsapp_webhook_invalid_signature",
        ip,
        service: "web",
      }),
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sdkRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });

  const bot = await getBot();

  // Pass waitUntil to the SDK — it calls it internally when the debounce fires,
  // keeping this function instance alive for debounce (3 s) + handler execution.
  // Without this, bot.webhooks.whatsapp() returns a 200 immediately, waitUntil
  // gets a settled promise, and Vercel freezes the function before the debounce
  // setTimeout fires — so onNewMention never runs.
  return bot.webhooks.whatsapp(sdkRequest, { waitUntil });
}
