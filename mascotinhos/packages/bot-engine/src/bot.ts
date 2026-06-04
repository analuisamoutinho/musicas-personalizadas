import { Chat, Card, CardText, Actions, Button, type Thread, type Attachment } from "chat";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";
import * as Sentry from "@sentry/node";
import { env } from "@mascotinhos/env/server";
import { stateAdapter } from "./state";
import { loadActiveOrder, findOrCreateClient, createOrder } from "./conversation";
import { processMessage } from "./agent";
import { getHistory, appendMessage } from "./history";
import { serializeCause } from "./serialize-cause";

export { serializeCause };

/**
 * Chat SDK bot instance with WhatsApp adapter.
 *
 * The adapter auto-reads WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET,
 * and WHATSAPP_PHONE_NUMBER_ID from process.env. We pass verifyToken
 * explicitly because our env schema uses WHATSAPP_WEBHOOK_TOKEN (not
 * WHATSAPP_VERIFY_TOKEN which the adapter expects by default).
 *
 * State uses in-memory adapter for MVP. Story 2.2 may upgrade to Redis.
 */
export const whatsappAdapter = createWhatsAppAdapter({
  verifyToken: env.WHATSAPP_WEBHOOK_TOKEN,
});

// Smuggle the WhatsApp mediaId through Attachment.url so it survives the Chat SDK
// debounce queue. The SDK's Message.toJSON() drops `fetchData` (functions aren't
// JSON-serializable) but preserves `url`; without smuggling, every photo on a
// debounced thread fails with TypeError because att.fetchData is undefined post-dequeue.
type BuildMediaAttachmentFn = (
  mediaId: string,
  type: string,
  mimeType: string,
  name?: string,
) => Attachment;
const adapterInternal = whatsappAdapter as unknown as { buildMediaAttachment: BuildMediaAttachmentFn };
const buildMediaAttachmentOriginal: BuildMediaAttachmentFn =
  adapterInternal.buildMediaAttachment.bind(whatsappAdapter);
adapterInternal.buildMediaAttachment = (mediaId, type, mimeType, name) => ({
  ...buildMediaAttachmentOriginal(mediaId, type, mimeType, name),
  url: mediaId,
});

export const bot = new Chat({
  userName: "musicaspersonalizadas",
  state: stateAdapter,
  adapters: { whatsapp: whatsappAdapter },
  concurrency: {
    strategy: "debounce",
    debounceMs: 3000,
    maxQueueSize: 10,
  },
});

// Shared handler for both text messages (onNewMention) and button clicks (onAction).
// Interactive button replies arrive via processAction, not processMessage, so they
// need an explicit onAction handler — otherwise the SDK drops them silently.
async function handleBotMessage(
  thread: Thread<unknown, unknown>,
  senderId: string,
  userText: string,
  rawAttachments: Attachment[] = [],
): Promise<void> {
  try {
    if (!senderId) {
      console.log(
        JSON.stringify({ level: "warn", event: "empty_sender_id", service: "bot-engine" }),
      );
      return;
    }
    const masked = senderId.length >= 4 ? `***${senderId.slice(-4)}` : "***redacted";

    // Load or create conversation state
    console.log(JSON.stringify({ level: "info", event: "loading_order", sender: masked, service: "bot-engine" }));
    let order;
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT_10s")), 10000));
      order = await Promise.race([loadActiveOrder(senderId), timeoutPromise]) as Awaited<ReturnType<typeof loadActiveOrder>>;
      console.log(JSON.stringify({ level: "info", event: "order_loaded_result", found: !!order, sender: masked, service: "bot-engine" }));
    } catch (dbErr) {
      Sentry.captureException(dbErr, { tags: { service: "bot-engine", event: "db_load_order_failed" } });
      console.error(JSON.stringify({ level: "error", event: "db_load_order_failed", sender: masked, error: dbErr instanceof Error ? dbErr.message : String(dbErr), cause: dbErr instanceof Error ? serializeCause(dbErr.cause) : undefined, service: "bot-engine" }));
      await thread.post("Ops, estou com um probleminha técnico. Tenta de novo em alguns segundos? 🙏");
      return;
    }

    if (!order) {
      let client;
      try {
        client = await findOrCreateClient(senderId);
      } catch (dbErr) {
        Sentry.captureException(dbErr, { tags: { service: "bot-engine", event: "db_create_client_failed" } });
        console.error(JSON.stringify({ level: "error", event: "db_create_client_failed", sender: masked, error: dbErr instanceof Error ? dbErr.message : String(dbErr), cause: dbErr instanceof Error ? serializeCause(dbErr.cause) : undefined, service: "bot-engine" }));
        await thread.post("Ops, estou com um probleminha técnico. Tenta de novo em alguns segundos? 🙏");
        return;
      }
      order = await createOrder(client.id);
      console.log(
        JSON.stringify({
          level: "info",
          event: "new_order_created",
          orderId: order.id,
          conversationState: order.conversationState,
          sender: masked,
          service: "bot-engine",
        }),
      );
    } else {
      console.log(
        JSON.stringify({
          level: "info",
          event: "order_loaded",
          orderId: order.id,
          conversationState: order.conversationState,
          sender: masked,
          service: "bot-engine",
        }),
      );
    }

    // Re-download WhatsApp media via the adapter using the mediaId we smuggled
    // through Attachment.url at construction time. We can't rely on att.fetchData
    // here: the Chat SDK debounce queue serializes messages via JSON.stringify,
    // which drops the closure (see whatsappAdapter patch above).
    let photoContext = "";
    let photoData: Array<{ buffer: Buffer; mimeType: string }> = [];
    if (rawAttachments.length > 0) {
      const results = await Promise.allSettled(
        rawAttachments.map(async (att) => {
          const mediaId = att.url;
          if (!mediaId) {
            throw new Error("attachment_missing_media_id");
          }
          return {
            buffer: await whatsappAdapter.downloadMedia(mediaId),
            mimeType: att.mimeType ?? "image/jpeg",
          };
        }),
      );
      photoData = results
        .filter((r): r is PromiseFulfilledResult<{ buffer: Buffer; mimeType: string }> => r.status === "fulfilled")
        .map((r) => r.value);
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      if (rejected.length > 0) {
        console.log(
          JSON.stringify({
            level: "error",
            event: "media_fetch_partial_failure",
            orderId: order.id,
            service: "bot-engine",
            failedCount: rejected.length,
            totalCount: rawAttachments.length,
            reasons: rejected.map((r) => ({
              message: r.reason instanceof Error ? r.reason.message : String(r.reason),
              cause: r.reason instanceof Error ? serializeCause(r.reason.cause) : undefined,
            })),
          }),
        );
      }

      if (photoData.length > 0) {
        photoContext = `\n[Fotos recebidas: ${photoData.length} foto(s)]`;
      }
    }

    const contextualMessage = userText + photoContext;

    // Skip if there's nothing actionable (no text, no photos)
    if (!contextualMessage.trim()) {
      await thread.post("Pode me enviar uma mensagem de texto? 😊");
      return;
    }

    // Append user message BEFORE agent call (ensures history is complete for retries)
    console.log(JSON.stringify({ level: "info", event: "history_append_user_start", orderId: order.id, service: "bot-engine" }));
    await appendMessage(order.id, "user", contextualMessage);
    console.log(JSON.stringify({ level: "info", event: "history_append_user_ok", orderId: order.id, service: "bot-engine" }));

    // Load conversation history and process through AI agent
    console.log(JSON.stringify({ level: "info", event: "history_load_start", orderId: order.id, service: "bot-engine" }));
    const history = await getHistory(order.id);
    console.log(JSON.stringify({ level: "info", event: "history_load_ok", orderId: order.id, historyLen: history.length, service: "bot-engine" }));

    await thread.startTyping();

    const response = await processMessage(
      {
        id: order.id,
        clientId: order.client.id,
        conversationState: order.conversationState,
        clientName: order.client.name,
        theme: order.theme,
        outfitDescription: order.outfitDescription,
        extraRequests: order.extraRequests,
        photosCount: order.photosUrls?.length ?? 0,
        // Pass pre-fill text only for GREETING to avoid bleeding into later states
        preFillText: order.conversationState === "GREETING" ? userText : null,
        // LGPD: true if client already gave consent in any prior order
        hasConsent: order.client.consentTimestamp !== null,
      },
      contextualMessage,
      history,
      photoData,
    );

    // Guard against empty agent response
    const finalResponse = response?.trim()
      || "Desculpe, algo deu errado. Pode repetir? 🙏";

    console.log(JSON.stringify({ level: "info", event: "history_append_assistant_start", orderId: order.id, service: "bot-engine" }));
    await appendMessage(order.id, "assistant", finalResponse);
    console.log(JSON.stringify({ level: "info", event: "history_append_assistant_ok", orderId: order.id, service: "bot-engine" }));
    console.log(JSON.stringify({ level: "info", event: "wa_send_text_start", orderId: order.id, service: "bot-engine" }));
    await thread.post(finalResponse);
    console.log(JSON.stringify({ level: "info", event: "wa_send_text_ok", orderId: order.id, service: "bot-engine" }));

    // Reload order state after agent processing to capture any state transitions the agent made.
    // This prevents sending stale-state buttons (e.g. theme buttons after selectStyle already
    // advanced the state to COLLECTING_OUTFIT, or feedback buttons after handleApproval ran).
    const postProcessOrder = await loadActiveOrder(senderId);

    // Send style quick-reply buttons only when the order is STILL in GREETING after agent processing.
    // WhatsApp adapter converts Card with <=3 buttons into native reply buttons.
    // Button titles max 20 chars. Options: Disney, Herói, Outro.
    if (postProcessOrder?.conversationState === "GREETING") {
      try {
        await thread.post(
          Card({
            children: [
              CardText("Escolha o tema do mascotinho:"),
              Actions([
                Button({ id: "style_disney", label: "Disney" }),
                Button({ id: "style_heroi", label: "Herói" }),
                Button({ id: "style_outro", label: "Outro" }),
              ]),
            ],
          }),
        );
      } catch (buttonError) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "greeting_buttons_failed",
            service: "bot-engine",
            error: buttonError instanceof Error ? buttonError.message : String(buttonError),
          }),
        );
        // Non-fatal: main greeting was already sent; buttons are a UX enhancement only
      }
    }

    // Send feedback reply buttons only when the order is STILL in AWAITING_FEEDBACK after processing.
    if (postProcessOrder?.conversationState === "AWAITING_FEEDBACK") {
      try {
        await thread.post(
          Card({
            children: [
              CardText("Como ficou seu mascotinho?"),
              Actions([
                Button({ id: "feedback_approved", label: "Amei!" }),
                Button({ id: "feedback_revise", label: "Quero ajustar" }),
              ]),
            ],
          }),
        );
      } catch (buttonError) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "feedback_buttons_failed",
            service: "bot-engine",
            error: buttonError instanceof Error ? buttonError.message : String(buttonError),
          }),
        );
      }
    }
  } catch (error) {
    Sentry.captureException(error, { tags: { service: "bot-engine", event: "whatsapp_handler_failed" } });
    console.error(
      JSON.stringify({
        level: "error",
        event: "whatsapp_handler_failed",
        service: "bot-engine",
        error: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? serializeCause(error.cause) : undefined,
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined,
      }),
    );
  }
}

// Text messages (and images) — Chat SDK fires this for normal WhatsApp DMs.
bot.onNewMention(async (thread, message) => {
  const imageAttachments = message.attachments.filter((a) => a.type === "image");
  console.log(JSON.stringify({ level: "info", event: "handler_entered", hasText: !!message.text, imageCount: imageAttachments.length, authorId: message.author?.userId?.slice(-4) ?? "none", service: "bot-engine" }));
  await handleBotMessage(
    thread,
    message.author.userId ?? "",
    message.text ?? "",
    imageAttachments,
  );
});

// Interactive button/list replies — WhatsApp sends these as type:"interactive" which the
// adapter routes to processAction instead of processMessage, so onNewMention never fires.
// We treat the selected button label as the user's text input.
bot.onAction(async (event) => {
  const thread = event.thread;
  if (!thread) return;
  console.log(JSON.stringify({ level: "info", event: "action_handler_entered", actionId: event.actionId, value: event.value, authorId: event.user.userId?.slice(-4) ?? "none", service: "bot-engine" }));
  await handleBotMessage(thread, event.user.userId ?? "", event.value ?? "");
});
