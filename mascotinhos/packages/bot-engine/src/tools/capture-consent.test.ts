import { describe, expect, it, mock, beforeEach } from "bun:test";

// --- Mock @mascotinhos/env/server (must be before any import that pulls in env) ---
mock.module("@mascotinhos/env/server", () => ({
  env: {},
}));

// --- Mock @mascotinhos/db ---
const mockClientUpdate = mock(() =>
  Promise.resolve({
    id: "client-1",
    consentTimestamp: new Date("2026-03-30T00:00:00.000Z"),
    consentVersion: "1.0",
  }),
);
mock.module("@mascotinhos/db", () => ({
  default: {
    client: { update: mockClientUpdate },
  },
}));

import { captureConsent, resetConsentFailures } from "./capture-consent";

describe("captureConsent", () => {
  beforeEach(() => {
    mockClientUpdate.mockClear();
    // Reset circuit breaker state between tests
    resetConsentFailures("order-1");
    resetConsentFailures("order-2");
    resetConsentFailures("order-circuit");
  });

  const ctx = {
    toolCallId: "test",
    messages: [],
    abortSignal: undefined as unknown as AbortSignal,
  };

  it("records consent and returns success when DB update succeeds", async () => {
    const result = await captureConsent.execute(
      { clientId: "client-1", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: true, consentRecorded: true });
    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: {
        consentTimestamp: expect.any(Date),
        consentVersion: "1.0",
      },
    });
  });

  it("returns failure without throwing when DB update throws", async () => {
    mockClientUpdate.mockRejectedValueOnce(new Error("DB connection failed"));

    const result = await captureConsent.execute(
      { clientId: "client-1", orderId: "order-1" },
      ctx,
    );

    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain("consentimento");
  });

  it("sets consentVersion to 1.0", async () => {
    await captureConsent.execute(
      { clientId: "client-2", orderId: "order-2" },
      ctx,
    );

    expect(mockClientUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consentVersion: "1.0" }),
      }),
    );
  });

  it("trips circuit breaker after 2 consecutive failures", async () => {
    // Fail twice
    mockClientUpdate.mockRejectedValueOnce(new Error("DB fail 1"));
    const fail1 = await captureConsent.execute(
      { clientId: "client-1", orderId: "order-circuit" },
      ctx,
    );
    expect(fail1).toMatchObject({ success: false, failureCount: 1 });

    mockClientUpdate.mockRejectedValueOnce(new Error("DB fail 2"));
    const fail2 = await captureConsent.execute(
      { clientId: "client-1", orderId: "order-circuit" },
      ctx,
    );
    expect(fail2).toMatchObject({ success: false, failureCount: 2 });

    // Third call should trip the circuit breaker — no DB call
    mockClientUpdate.mockClear();
    const tripped = await captureConsent.execute(
      { clientId: "client-1", orderId: "order-circuit" },
      ctx,
    );
    expect(tripped).toMatchObject({
      success: true,
      consentRecorded: false,
      circuitBreakerTripped: true,
    });
    // DB should NOT have been called
    expect(mockClientUpdate).toHaveBeenCalledTimes(0);
  });

  it("resets failure count after successful consent", async () => {
    // Fail once
    mockClientUpdate.mockRejectedValueOnce(new Error("DB fail"));
    await captureConsent.execute(
      { clientId: "client-1", orderId: "order-1" },
      ctx,
    );

    // Succeed — should reset counter
    mockClientUpdate.mockResolvedValueOnce({
      id: "client-1",
      consentTimestamp: new Date(),
      consentVersion: "1.0",
    });
    const result = await captureConsent.execute(
      { clientId: "client-1", orderId: "order-1" },
      ctx,
    );
    expect(result).toMatchObject({ success: true, consentRecorded: true });

    // Fail once more — should be count 1, not 2
    mockClientUpdate.mockRejectedValueOnce(new Error("DB fail again"));
    const fail = await captureConsent.execute(
      { clientId: "client-1", orderId: "order-1" },
      ctx,
    );
    expect(fail).toMatchObject({ success: false, failureCount: 1 });
  });
});
