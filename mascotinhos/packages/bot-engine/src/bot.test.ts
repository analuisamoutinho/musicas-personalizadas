import { describe, expect, it } from "bun:test";
import { bot, whatsappAdapter } from "./bot";

describe("bot-engine", () => {
  it("exports a Chat instance", () => {
    expect(bot).toBeDefined();
    expect(bot.webhooks).toBeDefined();
  });

  it("has a whatsapp webhook handler", () => {
    expect(bot.webhooks.whatsapp).toBeDefined();
    expect(typeof bot.webhooks.whatsapp).toBe("function");
  });

  // Regression: photos broke for ~5 commits because the Chat SDK debounce queue
  // JSON-serializes messages via Message.toJSON(), which strips Attachment.fetchData
  // (functions aren't serializable). The adapter patch in bot.ts smuggles the
  // mediaId via Attachment.url, which toJSON DOES preserve. If this contract ever
  // changes (in our patch or in chat-sdk's toJSON), this test fails fast.
  it("preserves WhatsApp mediaId across JSON roundtrip via Attachment.url", () => {
    const internal = whatsappAdapter as unknown as {
      buildMediaAttachment: (
        mediaId: string,
        type: string,
        mimeType: string,
      ) => { type: string; url?: string; mimeType?: string };
    };
    const att = internal.buildMediaAttachment("media-abc-123", "image", "image/jpeg");
    expect(att.url).toBe("media-abc-123");
    const roundTripped = JSON.parse(JSON.stringify(att));
    expect(roundTripped.url).toBe("media-abc-123");
    expect(roundTripped.mimeType).toBe("image/jpeg");
  });
});
