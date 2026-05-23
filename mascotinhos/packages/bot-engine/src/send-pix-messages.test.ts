import { mock, beforeEach, describe, it, expect } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports

const mockUploadPixQr = mock(() => Promise.resolve("generated/pix-qr/order-uuid-1.png"));
const mockGetSignedUrl = mock(() => Promise.resolve("https://signed.url/qr.png"));

mock.module("@mascotinhos/storage", () => ({
  uploadPixQr: mockUploadPixQr,
  getSignedUrl: mockGetSignedUrl,
}));

mock.module("@mascotinhos/env/server", () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: "12345678901",
    WHATSAPP_ACCESS_TOKEN: "test-access-token",
  },
}));

const fetchCalls: { url: string; body: Record<string, unknown> }[] = [];

global.fetch = mock((_url: string, options?: RequestInit) => {
  fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
  return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
}) as unknown as typeof fetch;

// Static imports AFTER all mock.module() calls
import { sendPixMessages } from "./send-pix-messages";

const ORDER_ID = "order-uuid-1";
const PHONE = "5511999999999";
const BASE64_QR = "base64qrcode==";
const EMV_CODE = "00020101021226580014BR.GOV.BCB.PIX";
const PHONE_ID = "12345678901";
const MESSAGES_URL = `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`;

describe("sendPixMessages", () => {
  beforeEach(() => {
    mockUploadPixQr.mockClear();
    mockGetSignedUrl.mockClear();
    (global.fetch as ReturnType<typeof mock>).mockClear();
    fetchCalls.length = 0;

    mockUploadPixQr.mockImplementation(() => Promise.resolve("generated/pix-qr/order-uuid-1.png"));
    mockGetSignedUrl.mockImplementation(() => Promise.resolve("https://signed.url/qr.png"));
    (global.fetch as ReturnType<typeof mock>).mockImplementation((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200 }));
    });
  });

  // 1. Happy path
  it("happy path: uploads, gets signed URL, sends image then EMV alone", async () => {
    const result = await sendPixMessages(ORDER_ID, PHONE, BASE64_QR, EMV_CODE);

    expect(result).toMatchObject({ imageSent: true, storagePath: "generated/pix-qr/order-uuid-1.png" });
    expect(mockUploadPixQr).toHaveBeenCalledWith(ORDER_ID, expect.any(Buffer));
    expect(mockGetSignedUrl).toHaveBeenCalledWith("generated/pix-qr/order-uuid-1.png");
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0].body.type).toBe("image");
    expect((fetchCalls[0].body.image as { link: string }).link).toBe("https://signed.url/qr.png");
    expect(fetchCalls[1].body.type).toBe("text");
    expect((fetchCalls[1].body.text as { body: string }).body).toBe(EMV_CODE);
  });

  // 2. Storage upload throws
  it("storage upload throws: image skipped, fallback prose + EMV sent as two text messages", async () => {
    mockUploadPixQr.mockImplementation(() => Promise.reject(new Error("upload failed")));

    const result = await sendPixMessages(ORDER_ID, PHONE, BASE64_QR, EMV_CODE);

    expect(result).toMatchObject({ imageSent: false, storagePath: null });
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0].body.type).toBe("text");
    expect((fetchCalls[0].body.text as { body: string }).body).toContain("Não consegui anexar");
    expect(fetchCalls[1].body.type).toBe("text");
    expect((fetchCalls[1].body.text as { body: string }).body).toBe(EMV_CODE);
  });

  // 3. getSignedUrl throws (upload succeeded)
  it("getSignedUrl throws: storagePath still returned for caching, fallback prose + EMV sent", async () => {
    mockGetSignedUrl.mockImplementation(() => Promise.reject(new Error("signed URL failed")));

    const result = await sendPixMessages(ORDER_ID, PHONE, BASE64_QR, EMV_CODE);

    // storagePath cached even though URL fetch failed — caller can persist it
    expect(result.storagePath).toBe("generated/pix-qr/order-uuid-1.png");
    expect(result.imageSent).toBe(false);
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0].body.type).toBe("text");
    expect((fetchCalls[0].body.text as { body: string }).body).toContain("Não consegui anexar");
    expect(fetchCalls[1].body.type).toBe("text");
    expect((fetchCalls[1].body.text as { body: string }).body).toBe(EMV_CODE);
  });

  // 4. Image POST returns 500
  it("image POST returns 500: logs pix_qr_image_send_failed, falls through to fallback prose + EMV", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    (global.fetch as ReturnType<typeof mock>).mockImplementationOnce((_url: string, options?: RequestInit) => {
      fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
      return Promise.resolve(new Response("Internal Server Error", { status: 500 }));
    });

    try {
      const result = await sendPixMessages(ORDER_ID, PHONE, BASE64_QR, EMV_CODE);

      expect(result.imageSent).toBe(false);
      // image attempt (500) + fallback prose (200) + EMV (200)
      expect(fetchCalls).toHaveLength(3);

      const parsed = logs.map(l => JSON.parse(l) as Record<string, unknown>);
      const failLog = parsed.find(l => l.event === "pix_qr_image_send_failed");
      expect(failLog).toBeDefined();
      expect(failLog!.status).toBe(500);
      expect(typeof failLog!.body).toBe("string");
    } finally {
      console.log = origLog;
    }
  });

  // 5. Image POST throws (network error)
  it("image POST throws: logs pix_qr_image_send_failed with error field (not status)", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    (global.fetch as ReturnType<typeof mock>).mockImplementationOnce(() =>
      Promise.reject(new Error("network timeout")),
    );

    try {
      const result = await sendPixMessages(ORDER_ID, PHONE, BASE64_QR, EMV_CODE);

      expect(result.imageSent).toBe(false);

      const parsed = logs.map(l => JSON.parse(l) as Record<string, unknown>);
      const failLog = parsed.find(l => l.event === "pix_qr_image_send_failed");
      expect(failLog).toBeDefined();
      expect(typeof failLog!.error).toBe("string");
      expect(failLog!.status).toBeUndefined();
    } finally {
      console.log = origLog;
    }
  });

  // 6. EMV POST returns non-OK
  it("EMV POST returns non-OK: logs pix_copycode_send_failed, function still returns successfully", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    // First fetch (image) succeeds; second fetch (EMV text) returns 429
    (global.fetch as ReturnType<typeof mock>)
      .mockImplementationOnce((_url: string, options?: RequestInit) => {
        fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
        return Promise.resolve(new Response(JSON.stringify({ messages: [{ id: "wamid" }] }), { status: 200 }));
      })
      .mockImplementationOnce((_url: string, options?: RequestInit) => {
        fetchCalls.push({ url: _url, body: options?.body ? JSON.parse(options.body as string) : null });
        return Promise.resolve(new Response("Rate limited", { status: 429 }));
      });

    try {
      const result = await sendPixMessages(ORDER_ID, PHONE, BASE64_QR, EMV_CODE);

      expect(result).toMatchObject({ imageSent: true, storagePath: "generated/pix-qr/order-uuid-1.png" });

      const parsed = logs.map(l => JSON.parse(l) as Record<string, unknown>);
      const failLog = parsed.find(l => l.event === "pix_copycode_send_failed");
      expect(failLog).toBeDefined();
      expect(failLog!.status).toBe(429);
      expect(typeof failLog!.body).toBe("string");
    } finally {
      console.log = origLog;
    }
  });

  // 7. WhatsApp URL — confirms Media API upload path is gone
  it("all fetches hit /messages URL, no /media endpoint", async () => {
    await sendPixMessages(ORDER_ID, PHONE, BASE64_QR, EMV_CODE);

    for (const call of fetchCalls) {
      expect(call.url).toBe(MESSAGES_URL);
      expect(call.url).not.toContain("/media");
    }
  });

  // 8. No prose prefix on happy path — regression guard against original "Ou copie o código PIX:" UX bug
  it("happy path: EMV text body is exactly pixCopyPaste with no surrounding prose", async () => {
    await sendPixMessages(ORDER_ID, PHONE, BASE64_QR, EMV_CODE);

    const textFetches = fetchCalls.filter(c => c.body.type === "text");
    expect(textFetches).toHaveLength(1);
    expect((textFetches[0].body.text as { body: string }).body).toBe(EMV_CODE);
  });
});
