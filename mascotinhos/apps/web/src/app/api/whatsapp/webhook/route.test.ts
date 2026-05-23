import { createHmac } from "crypto";
import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";

// WHATSAPP_APP_SECRET used throughout this test file
const APP_SECRET = "test-whatsapp-app-secret";

// mock.module() BEFORE imports — Bun requirement
mock.module("@mascotinhos/env/server", () => ({
  env: {
    WHATSAPP_APP_SECRET: APP_SECRET,
    WHATSAPP_WEBHOOK_TOKEN: "test-whatsapp-token",
  },
}));

const mockBotWebhooks = mock(() =>
  Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 }))
);

mock.module("@mascotinhos/bot-engine", () => ({
  bot: {
    webhooks: {
      whatsapp: mockBotWebhooks,
    },
  },
}));

// Static imports AFTER all mock.module() calls
import { GET, POST } from "./route";

/** Build a valid X-Hub-Signature-256 for the given body */
function makeSignature(body: string): string {
  const hash = createHmac("sha256", APP_SECRET).update(body).digest("hex");
  return `sha256=${hash}`;
}

/** Build a POST request for the WhatsApp webhook endpoint */
function makePostRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
}

beforeEach(() => {
  mockBotWebhooks.mockClear();
  mockBotWebhooks.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 }))
  );
});

describe("GET /api/whatsapp/webhook", () => {
  it("delegates to bot.webhooks.whatsapp for Meta hub verification", async () => {
    mockBotWebhooks.mockImplementation(() =>
      Promise.resolve(new Response("challenge_token", { status: 200 }))
    );
    const request = new Request(
      "http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-whatsapp-token&hub.challenge=challenge_token"
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(mockBotWebhooks).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/whatsapp/webhook — signature verification", () => {
  it("AC #4 — missing X-Hub-Signature-256 returns 401", async () => {
    const body = JSON.stringify({ entry: [] });
    const request = makePostRequest(body);
    const response = await POST(request as never);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: "Unauthorized" });
    expect(mockBotWebhooks).not.toHaveBeenCalled();
  });

  it("AC #4 — invalid signature returns 401", async () => {
    const body = JSON.stringify({ entry: [] });
    const request = makePostRequest(body, {
      "x-hub-signature-256": "sha256=invalidsignature",
    });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: "Unauthorized" });
    expect(mockBotWebhooks).not.toHaveBeenCalled();
  });

  it("AC #5 — signature failure logs warning with source IP", async () => {
    const consoleSpy = spyOn(console, "log");
    const body = JSON.stringify({ entry: [] });
    const request = makePostRequest(body, {
      "x-hub-signature-256": "sha256=badsig",
      "x-forwarded-for": "203.0.113.42",
    });
    await POST(request as never);
    const logCalls = consoleSpy.mock.calls.map((args) => {
      try {
        return JSON.parse(args[0] as string);
      } catch {
        return null;
      }
    });
    const warnLog = logCalls.find(
      (l) => l?.event === "whatsapp_webhook_invalid_signature"
    );
    expect(warnLog).toBeTruthy();
    expect(warnLog?.level).toBe("warn");
    expect(warnLog?.ip).toBe("203.0.113.42");
    expect(warnLog?.service).toBe("web");
    consoleSpy.mockRestore();
  });

  it("AC #5 — signature failure logs 'unknown' IP when x-forwarded-for absent", async () => {
    const consoleSpy = spyOn(console, "log");
    const body = JSON.stringify({ entry: [] });
    const request = makePostRequest(body, {
      "x-hub-signature-256": "sha256=badsig",
    });
    await POST(request as never);
    const logCalls = consoleSpy.mock.calls.map((args) => {
      try {
        return JSON.parse(args[0] as string);
      } catch {
        return null;
      }
    });
    const warnLog = logCalls.find(
      (l) => l?.event === "whatsapp_webhook_invalid_signature"
    );
    expect(warnLog?.ip).toBe("unknown");
    consoleSpy.mockRestore();
  });

  it("AC #1 — valid signature delegates to Chat SDK and returns 200", async () => {
    const body = JSON.stringify({ entry: [{ id: "12345" }] });
    const sig = makeSignature(body);
    const request = makePostRequest(body, {
      "x-hub-signature-256": sig,
    });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    expect(mockBotWebhooks).toHaveBeenCalledTimes(1);
  });

  it("AC #1 — valid signature passes reconstructed request body to SDK", async () => {
    const body = JSON.stringify({ entry: [{ id: "msg-1" }] });
    const sig = makeSignature(body);
    const request = makePostRequest(body, {
      "x-hub-signature-256": sig,
    });
    await POST(request as never);
    expect(mockBotWebhooks).toHaveBeenCalledTimes(1);
    const sdkRequest = (mockBotWebhooks.mock.calls[0] as unknown as [Request] | undefined)?.[0];
    const sdkBody = await sdkRequest?.text();
    expect(sdkBody).toBe(body);
  });
});
