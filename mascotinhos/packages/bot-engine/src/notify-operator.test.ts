import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock @mascotinhos/env/server before all imports (bun:test critical requirement).
// This must come before the import of notify-operator so the mock applies at load time.
// The test-setup.ts preload sets process.env values, but mock.module overrides the module export
// so the notify-operator module uses the mocked env object, not the real validated env.
mock.module("@mascotinhos/env/server", () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: "phone-id-123",
    WHATSAPP_ACCESS_TOKEN: "test-access-token",
    OPERATOR_WHATSAPP_NUMBER: "5511987654321",
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

import { notifyOperator, redactPhone } from "./notify-operator";

describe("notifyOperator", () => {
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

  it("sends message with correct format [MASCOTINHOS] ERROR: ... | Order: ...", async () => {
    await notifyOperator("order-abc-123", "ERROR", "Upload failed after retries");

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect((body.text as Record<string, unknown>).body).toBe(
      "[MASCOTINHOS] ERROR: Upload failed after retries | Order: order-abc-123",
    );
  });

  it("sends message with WARN severity correctly formatted", async () => {
    await notifyOperator("order-abc-456", "WARN", "Payment webhook failed");

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect((body.text as Record<string, unknown>).body).toBe(
      "[MASCOTINHOS] WARN: Payment webhook failed | Order: order-abc-456",
    );
  });

  it("sends to OPERATOR_WHATSAPP_NUMBER from env", async () => {
    await notifyOperator("order-abc-123", "ERROR", "Test message");

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.to).toBe("5511987654321");
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.type).toBe("text");
  });

  it("calls correct WhatsApp API URL including phone number ID", async () => {
    await notifyOperator("order-abc-123", "ERROR", "Test message");

    const url = (mockFetch.mock.calls[0] as [string, RequestInit])[0];
    expect(url).toContain("phone-id-123/messages");
    expect(url).toContain("graph.facebook.com");
  });

  it("includes Authorization header with access token", async () => {
    await notifyOperator("order-abc-123", "ERROR", "Test message");

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const headers = call.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-access-token");
  });

  it("never throws when WhatsApp API returns non-200 status", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 })),
    );

    await expect(
      notifyOperator("order-abc-123", "ERROR", "Test message"),
    ).resolves.toBeUndefined();
  });

  it("never throws when fetch rejects with a network error", async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error("network error")));

    await expect(
      notifyOperator("order-abc-123", "ERROR", "Test message"),
    ).resolves.toBeUndefined();
  });

  it("never throws when fetch rejects with non-Error object", async () => {
    mockFetch.mockImplementation(() => Promise.reject("string error"));

    await expect(
      notifyOperator("order-abc-123", "ERROR", "Test message"),
    ).resolves.toBeUndefined();
  });

  it("sanitizes pipe characters in message to prevent log-field spoofing", async () => {
    await notifyOperator("order-abc-123", "ERROR", "Bad input | Order: injected-fake");

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    const msgBody = (body.text as Record<string, unknown>).body as string;
    // The injected '|' should be replaced with a space, not treated as a delimiter
    expect(msgBody).toBe(
      "[MASCOTINHOS] ERROR: Bad input   Order: injected-fake | Order: order-abc-123",
    );
    expect(msgBody).not.toContain("| Order: injected-fake |");
  });

  it("sanitizes newlines in message to prevent log-line splitting", async () => {
    await notifyOperator("order-abc-123", "ERROR", "line1\nline2\r\nline3");

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    const msgBody = (body.text as Record<string, unknown>).body as string;
    expect(msgBody).not.toMatch(/\n|\r/);
    expect(msgBody).toContain("line1 line2  line3");
  });

  it("sanitizes pipe characters in orderId to prevent log-field spoofing", async () => {
    await notifyOperator("fake|Order:injected", "ERROR", "Test message");

    const call = (mockFetch.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    const msgBody = (body.text as Record<string, unknown>).body as string;
    // The '|' in orderId must be sanitized
    expect(msgBody).not.toContain("fake|Order:injected");
    expect(msgBody).toContain("fake_Order:injected");
  });
});

describe("redactPhone", () => {
  it("redacts all but last 4 digits for a full Brazilian number", () => {
    expect(redactPhone("5511999998888")).toBe("***8888");
  });

  it("redacts all but last 4 digits for a shorter number", () => {
    expect(redactPhone("11999998888")).toBe("***8888");
  });

  it("returns **** for phone with exactly 4 characters", () => {
    expect(redactPhone("1234")).toBe("****");
  });

  it("returns **** for phone with fewer than 4 characters", () => {
    expect(redactPhone("123")).toBe("****");
  });

  it("returns **** for empty string", () => {
    expect(redactPhone("")).toBe("****");
  });

  it("works with a typical Brazilian number with country code", () => {
    expect(redactPhone("5511987654321")).toBe("***4321");
  });
});
