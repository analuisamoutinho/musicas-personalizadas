import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock @mascotinhos/env/server before all imports (bun:test critical requirement)
mock.module("@mascotinhos/env/server", () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: "123456789",
    WHATSAPP_ACCESS_TOKEN: "test-whatsapp-access",
  },
}));

const mockFetch = mock(() =>
  Promise.resolve(
    new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
      status: 200,
    }),
  ),
);
global.fetch = mockFetch as unknown as typeof fetch;

import { sendAbandonedNudgeMessage, sendAbandonedClosureMessage } from "./send-abandoned-cart-messages";

describe("sendAbandonedNudgeMessage", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
          status: 200,
        }),
      ),
    );
  });

  it("sends nudge message with client name interpolated", async () => {
    await sendAbandonedNudgeMessage("order-123", "5511999999999", "Ana");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect((body.text as Record<string, unknown>).body).toBe(
      "Oi Ana! Vi que você começou a criar o mascotinho. Posso te ajudar com algo?",
    );
    expect(body.to).toBe("5511999999999");
    expect(body.type).toBe("text");
    expect(body.messaging_product).toBe("whatsapp");
  });

  it("sends nudge message without name when clientName is null", async () => {
    await sendAbandonedNudgeMessage("order-123", "5511999999999", null);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect((body.text as Record<string, unknown>).body).toBe(
      "Oi! Vi que você começou a criar o mascotinho. Posso te ajudar com algo?",
    );
  });

  it("sends nudge message without name when clientName is empty string", async () => {
    await sendAbandonedNudgeMessage("order-123", "5511999999999", "");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect((body.text as Record<string, unknown>).body).toBe(
      "Oi! Vi que você começou a criar o mascotinho. Posso te ajudar com algo?",
    );
  });

  it("sends nudge message without name when clientName is undefined", async () => {
    await sendAbandonedNudgeMessage("order-123", "5511999999999", undefined);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect((body.text as Record<string, unknown>).body).toContain("Oi!");
    expect((body.text as Record<string, unknown>).body).not.toContain("Oi undefined");
  });

  it("calls correct WhatsApp API URL including phone number ID", async () => {
    await sendAbandonedNudgeMessage("order-123", "5511999999999", "Ana");

    const url = (mockFetch.mock.calls[0] as [string, RequestInit])[0];
    expect(url).toContain("123456789/messages");
    expect(url).toContain("graph.facebook.com");
  });

  it("WhatsApp API error (non-200) is swallowed — function resolves without throwing", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 })),
    );

    await expect(
      sendAbandonedNudgeMessage("order-123", "5511999999999", "Ana"),
    ).resolves.toBeUndefined();
  });

  it("fetch throws network error — function resolves without throwing", async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error("network error")));

    await expect(
      sendAbandonedNudgeMessage("order-123", "5511999999999", "Ana"),
    ).resolves.toBeUndefined();
  });

  it("name sanitization — newlines in clientName are stripped", async () => {
    await sendAbandonedNudgeMessage("order-123", "5511999999999", "Ana\nMalicious\r\nInjection");

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    const text = (body.text as Record<string, unknown>).body as string;
    expect(text).not.toContain("\n");
    expect(text).not.toContain("\r");
    expect(text).toContain("Ana");
  });

  it("name sanitization — control characters are stripped", async () => {
    await sendAbandonedNudgeMessage("order-123", "5511999999999", "Ana\x01\x1FBob");

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    const text = (body.text as Record<string, unknown>).body as string;
    expect(text).not.toContain("\x01");
    expect(text).not.toContain("\x1F");
  });
});

describe("sendAbandonedClosureMessage", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
          status: 200,
        }),
      ),
    );
  });

  it("sends closure message with exact text", async () => {
    await sendAbandonedClosureMessage("order-123", "5511999999999");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect((body.text as Record<string, unknown>).body).toBe(
      "Tudo bem! Se mudar de ideia, estou aqui. Só me chamar!",
    );
    expect(body.to).toBe("5511999999999");
    expect(body.type).toBe("text");
    expect(body.messaging_product).toBe("whatsapp");
  });

  it("calls correct WhatsApp API URL including phone number ID", async () => {
    await sendAbandonedClosureMessage("order-123", "5511999999999");

    const url = (mockFetch.mock.calls[0] as [string, RequestInit])[0];
    expect(url).toContain("123456789/messages");
    expect(url).toContain("graph.facebook.com");
  });

  it("WhatsApp API error (non-200) is swallowed — function resolves without throwing", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 })),
    );

    await expect(
      sendAbandonedClosureMessage("order-123", "5511999999999"),
    ).resolves.toBeUndefined();
  });

  it("fetch throws network error — function resolves without throwing", async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error("network error")));

    await expect(
      sendAbandonedClosureMessage("order-123", "5511999999999"),
    ).resolves.toBeUndefined();
  });
});
