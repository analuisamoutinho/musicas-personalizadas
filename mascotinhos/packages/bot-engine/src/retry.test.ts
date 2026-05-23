import { describe, it, expect, mock } from "bun:test";

import { callWithRetry } from "./retry";

describe("callWithRetry", () => {
  it("returns result immediately on first success (no retry needed)", async () => {
    const fn = mock(() => Promise.resolve("success"));

    const result = await callWithRetry(fn, { baseDelayMs: 0 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxRetries times on retryable 500 status, then throws", async () => {
    const error = Object.assign(new Error("Server Error"), { status: 500 });
    const fn = mock(() => Promise.reject(error));

    await expect(callWithRetry(fn, { maxRetries: 3, baseDelayMs: 0 })).rejects.toThrow(
      "Server Error",
    );

    // initial attempt + 3 retries = 4 total calls
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("retries on 429 (rate limit) and eventually throws", async () => {
    const error = Object.assign(new Error("Too Many Requests"), { status: 429 });
    const fn = mock(() => Promise.reject(error));

    await expect(callWithRetry(fn, { maxRetries: 2, baseDelayMs: 0 })).rejects.toThrow(
      "Too Many Requests",
    );

    // initial attempt + 2 retries = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on permanent 400 status — throws immediately", async () => {
    const error = Object.assign(new Error("Bad Request"), { status: 400 });
    const fn = mock(() => Promise.reject(error));

    await expect(callWithRetry(fn, { maxRetries: 3, baseDelayMs: 0 })).rejects.toThrow(
      "Bad Request",
    );

    // Only 1 call — no retries for permanent errors
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on permanent 401 status — throws immediately", async () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    const fn = mock(() => Promise.reject(error));

    await expect(callWithRetry(fn, { maxRetries: 3, baseDelayMs: 0 })).rejects.toThrow(
      "Unauthorized",
    );

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on permanent 403 status — throws immediately", async () => {
    const error = Object.assign(new Error("Forbidden"), { status: 403 });
    const fn = mock(() => Promise.reject(error));

    await expect(callWithRetry(fn, { maxRetries: 3, baseDelayMs: 0 })).rejects.toThrow(
      "Forbidden",
    );

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on unknown error (no status property) — assumes transient", async () => {
    const error = new Error("Network error");
    const fn = mock(() => Promise.reject(error));

    await expect(callWithRetry(fn, { maxRetries: 2, baseDelayMs: 0 })).rejects.toThrow(
      "Network error",
    );

    // initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("succeeds on second attempt after one failure", async () => {
    let callCount = 0;
    const fn = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(Object.assign(new Error("Transient"), { status: 500 }));
      }
      return Promise.resolve("recovered");
    });

    const result = await callWithRetry(fn, { maxRetries: 3, baseDelayMs: 0 });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses default maxRetries=3 when not specified", async () => {
    const error = Object.assign(new Error("Server Error"), { status: 500 });
    const fn = mock(() => Promise.reject(error));

    await expect(callWithRetry(fn, { baseDelayMs: 0 })).rejects.toThrow("Server Error");

    // Default maxRetries=3: initial + 3 retries = 4 calls
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("logs retry attempts as structured JSON warn events", async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    const error = Object.assign(new Error("Server Error"), { status: 500 });
    const fn = mock(() => Promise.reject(error));

    try {
      await callWithRetry(fn, { maxRetries: 2, baseDelayMs: 0, orderId: "test-order", service: "test-svc" });
    } catch {
      // expected
    } finally {
      console.log = originalLog;
    }

    // Should have 2 retry log entries (not counting the final throw)
    const retryLogs = logs
      .map((l) => {
        try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; }
      })
      .filter((l) => l !== null && l.event === "retry_attempt");

    expect(retryLogs.length).toBe(2);
    expect(retryLogs[0]).toMatchObject({
      level: "warn",
      event: "retry_attempt",
      attempt: 1,
      orderId: "test-order",
      service: "test-svc",
    });
    expect(retryLogs[1]).toMatchObject({
      level: "warn",
      event: "retry_attempt",
      attempt: 2,
    });
  });

  it("does not log retry events for permanent errors", async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    const error = Object.assign(new Error("Bad Request"), { status: 400 });
    const fn = mock(() => Promise.reject(error));

    try {
      await callWithRetry(fn, { maxRetries: 3, baseDelayMs: 0 });
    } catch {
      // expected
    } finally {
      console.log = originalLog;
    }

    const retryLogs = logs
      .map((l) => {
        try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; }
      })
      .filter((l) => l !== null && l.event === "retry_attempt");

    expect(retryLogs.length).toBe(0);
  });
});
