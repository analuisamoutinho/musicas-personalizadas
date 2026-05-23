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

import { sendGenerationFailureMessage } from "./send-generation-failure-message";

describe("sendGenerationFailureMessage", () => {
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

  it("sends correct failure message body to recipient", async () => {
    await sendGenerationFailureMessage("order-123", "5511999999999");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect((body.text as Record<string, unknown>).body).toBe(
      "Desculpa, tivemos um probleminha técnico. O Giovani vai resolver pessoalmente!",
    );
  });

  it("sends to correct recipientPhone", async () => {
    await sendGenerationFailureMessage("order-456", "5521988887777");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.to).toBe("5521988887777");
    expect(body.type).toBe("text");
    expect(body.messaging_product).toBe("whatsapp");
  });

  it("uses correct WhatsApp API URL with PHONE_NUMBER_ID from env", async () => {
    await sendGenerationFailureMessage("order-123", "5511999999999");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callUrl = (mockFetch.mock.calls[0] as [string, RequestInit])[0];
    expect(callUrl).toContain("123456789");
    expect(callUrl).toContain("graph.facebook.com");
    expect(callUrl).toContain("messages");
  });

  it("never throws when WhatsApp API returns error status", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Bad Request" }), { status: 400 }),
      ),
    );

    // Must not throw
    await expect(
      sendGenerationFailureMessage("order-123", "5511999999999"),
    ).resolves.toBeUndefined();
  });

  it("never throws when fetch rejects (network error)", async () => {
    mockFetch.mockImplementation(() =>
      Promise.reject(new Error("Network failure")),
    );

    // Must not throw
    await expect(
      sendGenerationFailureMessage("order-123", "5511999999999"),
    ).resolves.toBeUndefined();
  });
});
