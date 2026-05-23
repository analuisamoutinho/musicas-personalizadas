import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock @mascotinhos/env/server before all imports (bun:test critical requirement).
const mockEnv = {
  WHATSAPP_PHONE_NUMBER_ID: "test-phone-id-999",
  WHATSAPP_ACCESS_TOKEN: "test-access-token",
};

mock.module("@mascotinhos/env/server", () => ({
  env: mockEnv,
}));

// Static imports AFTER all mock.module() calls
import {
  WHATSAPP_API_VERSION,
  WA_FETCH_TIMEOUT_MS,
  makeAbortSignal,
  buildMessagesUrl,
} from "./whatsapp-client";

describe("WHATSAPP_API_VERSION", () => {
  it("is the expected Graph API version string", () => {
    expect(WHATSAPP_API_VERSION).toBe("v25.0");
  });
});

describe("WA_FETCH_TIMEOUT_MS", () => {
  it("is 10_000 ms (10 seconds)", () => {
    expect(WA_FETCH_TIMEOUT_MS).toBe(10_000);
  });
});

describe("makeAbortSignal", () => {
  it("returns an AbortSignal when AbortSignal.timeout is available", () => {
    const signal = makeAbortSignal();
    // Node 18+ and Bun both support AbortSignal.timeout
    expect(signal).toBeDefined();
    expect(signal instanceof AbortSignal).toBe(true);
  });

  it("returns undefined when AbortSignal.timeout is unavailable", () => {
    const original = (AbortSignal as { timeout?: unknown }).timeout;
    delete (AbortSignal as { timeout?: unknown }).timeout;

    const signal = makeAbortSignal();
    expect(signal).toBeUndefined();

    // Restore
    (AbortSignal as { timeout?: unknown }).timeout = original;
  });

  it("returns a signal that is not yet aborted", () => {
    const signal = makeAbortSignal();
    if (signal) {
      expect(signal.aborted).toBe(false);
    }
  });
});

describe("buildMessagesUrl", () => {
  it("returns the correct WhatsApp Graph API messages URL", () => {
    const url = buildMessagesUrl();
    expect(url).toBe(
      "https://graph.facebook.com/v25.0/test-phone-id-999/messages",
    );
  });

  it("contains the WHATSAPP_API_VERSION constant", () => {
    const url = buildMessagesUrl();
    expect(url).toContain(WHATSAPP_API_VERSION);
  });

  it("contains the WHATSAPP_PHONE_NUMBER_ID from env", () => {
    const url = buildMessagesUrl();
    expect(url).toContain("test-phone-id-999");
  });

  it("ends with /messages", () => {
    const url = buildMessagesUrl();
    expect(url.endsWith("/messages")).toBe(true);
  });

  it("starts with https://graph.facebook.com/", () => {
    const url = buildMessagesUrl();
    expect(url.startsWith("https://graph.facebook.com/")).toBe(true);
  });
});
