import { mock, beforeEach, describe, it, expect } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports

const mockGetSignedUrl = mock(() => Promise.resolve("https://signed.url/mascotinho.png"));

mock.module("@mascotinhos/storage", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

const mockPrismaOrderUpdate = mock(() => Promise.resolve({}));
// updateMany returns { count: N }; default to count=1 (order found in expected state)
const mockPrismaOrderUpdateMany = mock(() => Promise.resolve({ count: 1 }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: { update: mockPrismaOrderUpdate, updateMany: mockPrismaOrderUpdateMany },
  },
}));

mock.module("@mascotinhos/env/server", () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: "12345678901",
    WHATSAPP_ACCESS_TOKEN: "test-access-token",
  },
}));

// Track fetch calls in order
const fetchCalls: { url: string; body: unknown }[] = [];

global.fetch = mock((_url: string, options?: RequestInit) => {
  fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
  return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
}) as unknown as typeof fetch;

// Static imports AFTER all mock.module() calls
import { deliverImageToClient } from "./deliver-image-to-client";

const DEFAULT_PARAMS = {
  orderId: "order-uuid-123",
  imageUrl: "generated/order-uuid-123/1.png",
  recipientPhone: "5511999999999",
  clientName: "Ana",
};

describe("deliverImageToClient", () => {
  beforeEach(() => {
    mockGetSignedUrl.mockClear();
    mockPrismaOrderUpdate.mockClear();
    mockPrismaOrderUpdateMany.mockClear();
    (global.fetch as ReturnType<typeof mock>).mockClear();
    fetchCalls.length = 0;

    mockGetSignedUrl.mockImplementation(() => Promise.resolve("https://signed.url/mascotinho.png"));
    mockPrismaOrderUpdate.mockImplementation(() => Promise.resolve({}));
    mockPrismaOrderUpdateMany.mockImplementation(() => Promise.resolve({ count: 1 }));
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });
  });

  // Task 3.2: happy path
  it("happy path — all fetches succeed, returns { success: true }, DB update called with DELIVERED + AWAITING_FEEDBACK", async () => {
    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(true);

    // Final DB update must include both fields atomically
    expect(mockPrismaOrderUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: DEFAULT_PARAMS.orderId },
        data: { orderStatus: "DELIVERED", conversationState: "AWAITING_FEEDBACK" },
      }),
    );
  });

  // Task 3.3: getSignedUrl throws
  it("getSignedUrl throws → returns { success: false }, no fetch calls", async () => {
    mockGetSignedUrl.mockImplementation(() => Promise.reject(new Error("Storage error")));

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("signed URL");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Task 3.4: state transition to DELIVERING DB updateMany fails
  it("state transition to DELIVERING: updateMany throws → returns { success: false }, no fetch calls", async () => {
    mockPrismaOrderUpdateMany.mockImplementationOnce(() => Promise.reject(new Error("DB timeout")));

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("DELIVERING");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("state transition to DELIVERING: updateMany returns count=0 (concurrent transition) → returns { success: false }, no fetch calls", async () => {
    mockPrismaOrderUpdateMany.mockImplementationOnce(() => Promise.resolve({ count: 0 }));

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("DELIVERING");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("state transition to DELIVERING: order already in DELIVERING (retry) → updateMany count=1 → proceeds normally", async () => {
    // Simulates a QStash retry where order was left in DELIVERING from prior partial failure.
    // updateMany with OR guard matches DELIVERING state and returns count=1.
    mockPrismaOrderUpdateMany.mockImplementationOnce(() => Promise.resolve({ count: 1 }));

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
  });

  // Task 3.5: warm message returns 500
  it("warm message returns 500 → returns { success: false }", async () => {
    let fetchCount = 0;
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      fetchCount++;
      // 1st call = typing indicator (non-fatal), 2nd call = warm message → 500
      if (fetchCount === 2) {
        return Promise.resolve(new Response(JSON.stringify({ error: "Server Error" }), { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("warm status message");
  });

  it("warm message fetch throws (network error) → returns { success: false }", async () => {
    let fetchCount = 0;
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      fetchCount++;
      // 1st call = typing indicator (non-fatal), 2nd call = warm message → throws
      if (fetchCount === 2) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("warm status message");
  });

  // Task 3.6: photo message returns 500
  it("photo message returns 500 → returns { success: false }", async () => {
    let fetchCount = 0;
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      fetchCount++;
      // 1=typing, 2=warm, 3=photo → 500
      if (fetchCount === 3) {
        return Promise.resolve(new Response(JSON.stringify({ error: "Server Error" }), { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("image photo");
  });

  it("photo fetch throws → returns { success: false }", async () => {
    let fetchCount = 0;
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      fetchCount++;
      if (fetchCount === 3) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("image photo");
  });

  // Task 3.7: document message returns 500
  it("document message returns 500 → returns { success: false }", async () => {
    let fetchCount = 0;
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      fetchCount++;
      // 1=typing, 2=warm, 3=photo, 4=document → 500
      if (fetchCount === 4) {
        return Promise.resolve(new Response(JSON.stringify({ error: "Server Error" }), { status: 500 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("document");
  });

  it("document fetch throws → returns { success: false }", async () => {
    let fetchCount = 0;
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      fetchCount++;
      if (fetchCount === 4) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(false);
    expect(result.message).toContain("document");
  });

  // Task 3.8: both messages sent but final DB status update throws
  it("both messages sent but final DB status update throws → returns { success: true } (soft failure)", async () => {
    // updateMany (GENERATING→DELIVERING) succeeds (count=1); update (DELIVERED+AWAITING_FEEDBACK) throws
    mockPrismaOrderUpdateMany.mockImplementationOnce(() => Promise.resolve({ count: 1 }));
    mockPrismaOrderUpdate.mockImplementationOnce(() => Promise.reject(new Error("DB connection lost")));

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    expect(result.success).toBe(true);
    expect(result.message).toContain("status update failed");
  });

  // Task 3.9: typing indicator throws — non-fatal, warm message still sent
  it("typing indicator fetch throws → non-fatal, warm message still sent, happy path continues", async () => {
    let fetchCount = 0;
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      fetchCount++;
      if (fetchCount === 1) {
        // typing indicator throws
        return Promise.reject(new Error("Typing indicator network error"));
      }
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });

    const result = await deliverImageToClient(DEFAULT_PARAMS);

    // Should still succeed — typing indicator failure is non-fatal
    expect(result.success).toBe(true);
    // warm, photo, document calls should still happen (fetchCount = 4: 1 typing + 3 messages)
    expect(fetchCount).toBe(4);
  });

  // Task 3.10: correct WhatsApp API URL used
  it("correct WhatsApp API URL used (contains WHATSAPP_PHONE_NUMBER_ID/messages)", async () => {
    await deliverImageToClient(DEFAULT_PARAMS);

    const expectedUrl = "https://graph.facebook.com/v25.0/12345678901/messages";
    expect(fetchCalls.length).toBeGreaterThan(0);
    for (const call of fetchCalls) {
      expect(call.url).toBe(expectedUrl);
    }
  });

  // Task 3.11: photo sent before document (call order: typing → warm → photo → document)
  it("messages sent in correct order: typing → warm → photo → document", async () => {
    await deliverImageToClient(DEFAULT_PARAMS);

    // Should have 4 fetch calls: typing, warm, photo, document
    expect(fetchCalls.length).toBe(4);
    expect(fetchCalls[0]?.body?.type).toBe("action"); // typing indicator
    expect(fetchCalls[1]?.body?.type).toBe("text");   // warm message
    expect(fetchCalls[2]?.body?.type).toBe("image");  // photo
    expect(fetchCalls[3]?.body?.type).toBe("document"); // document
  });

  // Review patch F2: recipientPhone validation
  it("empty recipientPhone → returns { success: false } immediately, no fetch or DB calls", async () => {
    const result = await deliverImageToClient({ ...DEFAULT_PARAMS, recipientPhone: "" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid recipientPhone");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockPrismaOrderUpdateMany).not.toHaveBeenCalled();
  });

  it("non-numeric recipientPhone → returns { success: false } immediately", async () => {
    const result = await deliverImageToClient({ ...DEFAULT_PARAMS, recipientPhone: "not-a-phone" });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid recipientPhone");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("valid 7-digit recipientPhone → passes validation and proceeds", async () => {
    const result = await deliverImageToClient({ ...DEFAULT_PARAMS, recipientPhone: "5511999" });

    expect(result.success).toBe(true);
  });

  // Review patch F1: idempotent DELIVERING re-entry confirmed via updateMany args
  it("updateMany uses OR guard on GENERATING|DELIVERING states", async () => {
    await deliverImageToClient(DEFAULT_PARAMS);

    expect(mockPrismaOrderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: DEFAULT_PARAMS.orderId,
          conversationState: { in: ["GENERATING", "DELIVERING"] },
        }),
        data: { conversationState: "DELIVERING" },
      }),
    );
  });
});
