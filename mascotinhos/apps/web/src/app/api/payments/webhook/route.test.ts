import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";

// Set env vars before all imports
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["SUPABASE_URL"] = "http://localhost:54321";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key";
process.env["OPENAI_API_KEY"] = "sk-test-key-for-unit-tests";
process.env["ASAAS_API_KEY"] = "test-asaas-key";
process.env["ASAAS_WEBHOOK_SECRET"] = "test-asaas-secret";
process.env["WHATSAPP_WEBHOOK_TOKEN"] = "test-whatsapp-token";
process.env["WHATSAPP_APP_SECRET"] = "test-whatsapp-app-secret";
process.env["WHATSAPP_PHONE_NUMBER_ID"] = "123456789";
process.env["WHATSAPP_ACCESS_TOKEN"] = "test-whatsapp-access";
process.env["QSTASH_TOKEN"] = "test-qstash-token";
process.env["QSTASH_CURRENT_SIGNING_KEY"] = "sig_test_current";
process.env["QSTASH_NEXT_SIGNING_KEY"] = "sig_test_next";
process.env["VERCEL_URL"] = "https://test.vercel.app";
process.env["OPERATOR_WHATSAPP_NUMBER"] = "5511999999999";
process.env["UPSTASH_REDIS_REST_URL"] = "https://test.upstash.io";
process.env["UPSTASH_REDIS_REST_TOKEN"] = "test-upstash-token";
process.env["CRON_SECRET"] = "test-cron-secret";
// NODE_ENV is read-only in TypeScript types but settable at runtime
(process.env as Record<string, string>)["NODE_ENV"] = "test";

const TEST_ASAAS_ID = "pay_aaa111bbb222";
const TEST_ORDER_ID = "22222222-2222-2222-2222-222222222222";

const mockPaymentFindFirst = mock(() =>
  Promise.resolve({
    id: "payment-db-id",
    orderId: TEST_ORDER_ID,
    asaasId: TEST_ASAAS_ID,
    status: "PENDING",
    order: {
      id: TEST_ORDER_ID,
      client: {
        id: "client-db-id",
        whatsappSenderId: "5511888888888",
        name: "Ana",
      },
    },
  })
);
const mockPaymentUpdate = mock(() => Promise.resolve({ id: "payment-db-id" }));
const mockOrderUpdate = mock(() => Promise.resolve({ id: TEST_ORDER_ID }));
const mockTransaction = mock(() => Promise.resolve([{}, {}]));

mock.module("@mascotinhos/db", () => ({
  default: {
    payment: { findFirst: mockPaymentFindFirst, update: mockPaymentUpdate },
    order: { update: mockOrderUpdate },
    $transaction: mockTransaction,
  },
}));

const mockVerifyWebhookSignature = mock(() => true);
mock.module("@mascotinhos/payments", () => ({
  verifyWebhookSignature: mockVerifyWebhookSignature,
}));

const mockEnqueueExecute = mock(() =>
  Promise.resolve({ success: false, message: "Not implemented" })
);
const mockSendPaymentConfirmationMessages = mock(() => Promise.resolve());
mock.module("@mascotinhos/bot-engine", () => ({
  enqueueGeneration: { execute: mockEnqueueExecute },
  sendPaymentConfirmationMessages: mockSendPaymentConfirmationMessages,
}));

// Static imports AFTER all mock.module() calls
import { POST, GET } from "./route";

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request("http://localhost/api/payments/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "asaas-access-token": "test-asaas-secret",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const confirmedPayload = {
  event: "PAYMENT_CONFIRMED",
  payment: {
    id: TEST_ASAAS_ID,
    externalReference: TEST_ORDER_ID,
    status: "CONFIRMED",
    value: 29.9,
    netValue: 28.55,
  },
};

beforeEach(() => {
  mockPaymentFindFirst.mockClear();
  mockPaymentUpdate.mockClear();
  mockOrderUpdate.mockClear();
  mockTransaction.mockClear();
  mockVerifyWebhookSignature.mockClear();
  mockEnqueueExecute.mockClear();
  mockSendPaymentConfirmationMessages.mockClear();

  mockVerifyWebhookSignature.mockImplementation(() => true);
  mockPaymentFindFirst.mockImplementation(() =>
    Promise.resolve({
      id: "payment-db-id",
      orderId: TEST_ORDER_ID,
      asaasId: TEST_ASAAS_ID,
      status: "PENDING",
      order: {
        id: TEST_ORDER_ID,
        client: {
          id: "client-db-id",
          whatsappSenderId: "5511888888888",
          name: "Ana",
        },
      },
    })
  );
  mockTransaction.mockImplementation(() => Promise.resolve([{}, {}]));
  mockEnqueueExecute.mockImplementation(() =>
    Promise.resolve({ success: false, message: "Not implemented" })
  );
  mockSendPaymentConfirmationMessages.mockImplementation(() => Promise.resolve());
});

describe("GET /api/payments/webhook", () => {
  it("AC #7 — returns 405 Method Not Allowed", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    const body = await response.json();
    expect(body).toEqual({ error: "Method Not Allowed" });
  });
});

describe("POST /api/payments/webhook", () => {
  it("AC #1 — missing token returns 401", async () => {
    const request = makeRequest(confirmedPayload, {
      "asaas-access-token": "",
    });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("AC #1 — invalid token returns 401", async () => {
    mockVerifyWebhookSignature.mockReturnValue(false);
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("AC #5 — invalid signature logs warning with source IP", async () => {
    const consoleSpy = spyOn(console, "log");
    mockVerifyWebhookSignature.mockReturnValue(false);
    const request = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": "wrong-token",
        "x-forwarded-for": "198.51.100.10",
      },
      body: JSON.stringify(confirmedPayload),
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
      (l) => l?.event === "payment_webhook_invalid_signature"
    );
    expect(warnLog).toBeTruthy();
    expect(warnLog?.level).toBe("warn");
    expect(warnLog?.ip).toBe("198.51.100.10");
    expect(warnLog?.service).toBe("web");
    consoleSpy.mockRestore();
  });

  it("AC #2 — happy path PAYMENT_CONFIRMED", async () => {
    // Track call order: confirmation must precede enqueue
    const callOrder: string[] = [];
    mockSendPaymentConfirmationMessages.mockImplementation(() => {
      callOrder.push("sendConfirmation");
      return Promise.resolve();
    });
    mockEnqueueExecute.mockImplementation(() => {
      callOrder.push("enqueue");
      return Promise.resolve({ success: false, message: "Not implemented" });
    });

    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockSendPaymentConfirmationMessages).toHaveBeenCalledTimes(1);
    expect(mockEnqueueExecute).toHaveBeenCalledTimes(1);
    // Ordering: confirmation message MUST be sent before generation is enqueued
    expect(callOrder).toEqual(["sendConfirmation", "enqueue"]);
  });

  it("AC #2 — happy path PAYMENT_RECEIVED", async () => {
    const payload = { ...confirmedPayload, event: "PAYMENT_RECEIVED" };
    const request = makeRequest(payload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockSendPaymentConfirmationMessages).toHaveBeenCalledTimes(1);
    expect(mockEnqueueExecute).toHaveBeenCalledTimes(1);
  });

  it("AC #2 — idempotent skip when payment already CONFIRMED", async () => {
    mockPaymentFindFirst.mockImplementation(() =>
      Promise.resolve({
        id: "payment-db-id",
        orderId: TEST_ORDER_ID,
        asaasId: TEST_ASAAS_ID,
        status: "CONFIRMED",
        order: {
          id: TEST_ORDER_ID,
          client: { id: "client-db-id", whatsappSenderId: "5511888888888", name: "Ana" },
        },
      })
    );
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockSendPaymentConfirmationMessages).not.toHaveBeenCalled();
  });

  it("AC #2 — idempotent skip when payment already REFUNDED (any non-PENDING status)", async () => {
    // Idempotency guard is `payment.status !== "PENDING"` — covers CONFIRMED, FAILED, REFUNDED.
    // "RECEIVED" is NOT a valid PaymentStatus enum value in the schema (enum: PENDING|CONFIRMED|FAILED|REFUNDED).
    mockPaymentFindFirst.mockImplementation(() =>
      Promise.resolve({
        id: "payment-db-id",
        orderId: TEST_ORDER_ID,
        asaasId: TEST_ASAAS_ID,
        status: "REFUNDED" as "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED",
        order: {
          id: TEST_ORDER_ID,
          client: { id: "client-db-id", whatsappSenderId: "5511888888888", name: "Ana" },
        },
      })
    );
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockSendPaymentConfirmationMessages).not.toHaveBeenCalled();
  });

  it("AC #3 — enqueue failure is graceful (does not return 500)", async () => {
    mockEnqueueExecute.mockRejectedValue(new Error("queue error"));
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
  });

  it("AC #4 — PAYMENT_OVERDUE updates payment to FAILED, does not update order", async () => {
    const payload = {
      event: "PAYMENT_OVERDUE",
      payment: {
        id: TEST_ASAAS_ID,
        externalReference: TEST_ORDER_ID,
        status: "OVERDUE",
        value: 29.9,
        netValue: 28.55,
      },
    };
    const request = makeRequest(payload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockPaymentUpdate).toHaveBeenCalledWith({
      where: { id: "payment-db-id" },
      data: { status: "FAILED" },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("AC #4 — PAYMENT_DELETED updates payment to FAILED, does not update order", async () => {
    const payload = {
      event: "PAYMENT_DELETED",
      payment: {
        id: TEST_ASAAS_ID,
        externalReference: TEST_ORDER_ID,
        status: "DELETED",
        value: 29.9,
        netValue: 28.55,
      },
    };
    const request = makeRequest(payload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockPaymentUpdate).toHaveBeenCalledWith({
      where: { id: "payment-db-id" },
      data: { status: "FAILED" },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("AC #5 — unknown asaasId returns 200 with no DB writes", async () => {
    mockPaymentFindFirst.mockImplementation(() => Promise.resolve(null as never));
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockPaymentUpdate).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("AC #6 — DB error on transaction returns 500", async () => {
    mockTransaction.mockRejectedValue(new Error("db error"));
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });

  it("AC #6 — DB error on findFirst returns 500", async () => {
    mockPaymentFindFirst.mockRejectedValue(new Error("db error"));
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });

  it("Malformed JSON returns 400", async () => {
    const request = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": "test-asaas-secret",
      },
      body: "{ invalid json {{",
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: "Invalid payload" });
  });

  it("Oversized body returns 413", async () => {
    const request = new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": "test-asaas-secret",
        "content-length": String(65_537),
      },
      body: JSON.stringify(confirmedPayload),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body).toEqual({ error: "Payload Too Large" });
  });

  it("Unknown event type returns 200 with no DB writes", async () => {
    const payload = {
      event: "PAYMENT_REFUNDED",
      payment: {
        id: TEST_ASAAS_ID,
        externalReference: TEST_ORDER_ID,
        status: "REFUNDED",
        value: 29.9,
        netValue: 28.55,
      },
    };
    const request = makeRequest(payload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockPaymentUpdate).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("AC #3 (story 3.3) — sendPaymentConfirmationMessages throws internally: webhook still returns 200", async () => {
    mockSendPaymentConfirmationMessages.mockRejectedValue(new Error("wa error"));
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
  });

  it("AC #4 (story 3.3) — missing client phone: logs warn and still returns 200", async () => {
    mockPaymentFindFirst.mockImplementation(() =>
      Promise.resolve({
        id: "payment-db-id",
        orderId: TEST_ORDER_ID,
        asaasId: TEST_ASAAS_ID,
        status: "PENDING",
        order: {
          id: TEST_ORDER_ID,
          client: null,
        },
      } as never)
    );
    const request = makeRequest(confirmedPayload);
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true });
    expect(mockSendPaymentConfirmationMessages).not.toHaveBeenCalled();
  });

  it("AC (issue-149) — PAYMENT_CONFIRMED persists netAmount from payload.payment.netValue", async () => {
    const request = makeRequest(confirmedPayload);
    await POST(request as never);
    // prisma.payment.update(...) is called before $transaction receives the result array —
    // so mockPaymentUpdate captures the args directly.
    const paymentUpdateArgs = (mockPaymentUpdate.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0];
    expect(paymentUpdateArgs.data.netAmount).toBe(28.55);
  });

  it("AC (issue-149) — missing netValue in payload returns 400", async () => {
    const payloadWithoutNetValue = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: TEST_ASAAS_ID,
        externalReference: TEST_ORDER_ID,
        status: "CONFIRMED",
        value: 29.9,
        // netValue intentionally omitted
      },
    };
    const request = makeRequest(payloadWithoutNetValue);
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });
});
