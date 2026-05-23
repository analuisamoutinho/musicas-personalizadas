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

import { sendPaymentConfirmationMessages } from "./send-payment-confirmation";

describe("sendPaymentConfirmationMessages", () => {
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

  it("AC #1 — happy path with client name: calls fetch 3 times with correct messages", async () => {
    await sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana");

    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Check typing indicator call
    const typingCall = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const typingBody = JSON.parse(typingCall.body as string) as Record<string, unknown>;
    expect(typingBody.type).toBe("action");
    expect((typingBody.action as Record<string, unknown>).type).toBe("typing");

    // Check confirmation message call
    const confirmCall = (mockFetch.mock.calls[1] as [string, RequestInit])[1];
    const confirmBody = JSON.parse(confirmCall.body as string) as Record<string, unknown>;
    expect((confirmBody.text as Record<string, unknown>).body).toContain("Pagamento confirmado");

    // Check follow-up message call
    const followUpCall = (mockFetch.mock.calls[2] as [string, RequestInit])[1];
    const followUpBody = JSON.parse(followUpCall.body as string) as Record<string, unknown>;
    expect((followUpBody.text as Record<string, unknown>).body).toContain("Ana");
  });

  it("AC #2 — null client name: follow-up uses generic form without name", async () => {
    await sendPaymentConfirmationMessages("order-123", "5511999999999", null);

    expect(mockFetch).toHaveBeenCalledTimes(3);

    const followUpCall = (mockFetch.mock.calls[2] as [string, RequestInit])[1];
    const followUpBody = JSON.parse(followUpCall.body as string) as Record<string, unknown>;
    const body = (followUpBody.text as Record<string, unknown>).body as string;
    expect(body).toContain("Estou preparando a arte com carinho");
    expect(body).not.toContain("da Ana");
    expect(body).not.toContain("arte da ");
  });

  it("AC #2 — empty string client name: follow-up uses generic form", async () => {
    await sendPaymentConfirmationMessages("order-123", "5511999999999", "");

    expect(mockFetch).toHaveBeenCalledTimes(3);

    const followUpCall = (mockFetch.mock.calls[2] as [string, RequestInit])[1];
    const followUpBody = JSON.parse(followUpCall.body as string) as Record<string, unknown>;
    const body = (followUpBody.text as Record<string, unknown>).body as string;
    expect(body).toBe(
      "Estou preparando a arte com carinho... Você será avisada assim que ficar pronta! 💕",
    );
  });

  it("AC #3 — API returns non-200: function resolves without throwing", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("error", { status: 500 })),
    );

    // Should not throw
    await expect(
      sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana"),
    ).resolves.toBeUndefined();

    // fetch called at least once (typing + confirmation fails)
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("AC #3 — network error (fetch throws): function resolves without throwing", async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error("network error")));

    await expect(
      sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana"),
    ).resolves.toBeUndefined();
  });

  it("AC #3 — follow-up message failure is caught: function resolves without throwing", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        // typing and confirmation succeed
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
            status: 200,
          }),
        );
      }
      // follow-up fails
      return Promise.resolve(new Response("error", { status: 500 }));
    });

    await expect(
      sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana"),
    ).resolves.toBeUndefined();
  });

  it("Correct recipients: fetch is called with the provided recipient phone", async () => {
    await sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana");

    for (const call of mockFetch.mock.calls as [string, RequestInit][]) {
      const body = JSON.parse(call[1].body as string) as Record<string, unknown>;
      expect(body.to).toBe("5511999999999");
    }
  });

  it("Correct API URL: fetch is called with URL containing phone number ID and /messages", async () => {
    await sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana");

    for (const call of mockFetch.mock.calls as [string, RequestInit][]) {
      const url = call[0];
      expect(url).toContain("123456789/messages");
    }
  });

  it("Name sanitization — newlines in clientName are stripped from follow-up body", async () => {
    await sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana\nMalicious\r\nInjection");

    expect(mockFetch).toHaveBeenCalledTimes(3);

    const followUpCall = (mockFetch.mock.calls[2] as [string, RequestInit])[1];
    const followUpBody = JSON.parse(followUpCall.body as string) as Record<string, unknown>;
    const body = (followUpBody.text as Record<string, unknown>).body as string;
    // Newlines must be replaced — message must not contain \n or \r
    expect(body).not.toContain("\n");
    expect(body).not.toContain("\r");
    // Name should still appear (with newlines replaced by spaces)
    expect(body).toContain("Ana");
  });

  it("Name sanitization — control characters are stripped from clientName", async () => {
    // \x01 (SOH) and \x1F (US) are control chars that must be removed
    await sendPaymentConfirmationMessages("order-123", "5511999999999", "Ana\x01\x1FBob");

    expect(mockFetch).toHaveBeenCalledTimes(3);

    const followUpCall = (mockFetch.mock.calls[2] as [string, RequestInit])[1];
    const followUpBody = JSON.parse(followUpCall.body as string) as Record<string, unknown>;
    const body = (followUpBody.text as Record<string, unknown>).body as string;
    expect(body).not.toContain("\x01");
    expect(body).not.toContain("\x1F");
  });
});
