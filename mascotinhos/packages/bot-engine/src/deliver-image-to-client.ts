import { env } from "@mascotinhos/env/server";
import { getSignedUrl } from "@mascotinhos/storage";
import prisma from "@mascotinhos/db";
import { makeAbortSignal, buildMessagesUrl } from "./whatsapp-client";

export interface DeliverImageParams {
  orderId: string;
  imageUrl: string; // storage path: "generated/{orderId}/{attempt}.png"
  recipientPhone: string; // client.whatsappSenderId
  clientName: string | null | undefined;
}

/**
 * Deliver the generated mascotinho image to the client via WhatsApp.
 * Sends: typing indicator → warm text message → photo → document.
 * Manages order state transitions: GENERATING → DELIVERING → AWAITING_FEEDBACK.
 * Returns { success: false } on any fatal failure to trigger QStash retry.
 */
export async function deliverImageToClient(
  params: DeliverImageParams,
): Promise<{ success: boolean; message: string }> {
  const { orderId, imageUrl, recipientPhone } = params;

  // 0. Validate recipientPhone — must be a non-empty numeric-only string (WhatsApp sender IDs
  //    are E.164-style digits without the leading '+', e.g. "5511999999999").
  //    Reject early to avoid a WhatsApp 400 that would still consume the retry budget.
  if (!recipientPhone || !/^\d{7,15}$/.test(recipientPhone.trim())) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_invalid_recipient_phone",
        orderId,
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Invalid recipientPhone: must be 7-15 digit E.164 number." };
  }

  // 1. Get signed URL for the image
  let signedUrl: string;
  try {
    signedUrl = await getSignedUrl(imageUrl);
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_signed_url_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Failed to generate signed URL for image." };
  }

  const messagesUrl = buildMessagesUrl();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
  };

  // 2. Transition state: GENERATING → DELIVERING (idempotent on retry)
  // Use updateMany with an OR guard so that a QStash retry that finds the order
  // already in DELIVERING (from a previous partial attempt) still succeeds rather
  // than violating the state-machine constraint.  count===0 means neither state
  // was present — a concurrent transition happened and we must abort.
  try {
    const { count } = await prisma.order.updateMany({
      where: {
        id: orderId,
        conversationState: { in: ["GENERATING", "DELIVERING"] },
      },
      data: { conversationState: "DELIVERING" },
    });
    if (count === 0) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "deliver_image_state_transition_failed",
          orderId,
          from: "GENERATING|DELIVERING",
          to: "DELIVERING",
          reason: "order not in expected state (concurrent transition?)",
          service: "bot-engine",
        }),
      );
      return { success: false, message: "Failed to transition order to DELIVERING state." };
    }
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_state_transition_failed",
        orderId,
        from: "GENERATING|DELIVERING",
        to: "DELIVERING",
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Failed to transition order to DELIVERING state." };
  }

  // 3. Typing indicator (non-fatal)
  try {
    await fetch(messagesUrl, {
      method: "POST",
      headers,
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "action",
        action: { type: "typing", duration: 3000 },
      }),
    });
  } catch {
    // non-fatal — continue to warm message
  }

  // 4. Warm status text message
  let warmResponse: Response;
  try {
    warmResponse = await fetch(messagesUrl, {
      method: "POST",
      headers,
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: "Estou finalizando sua arte com carinho... 🎨✨" },
      }),
    });
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_warm_message_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Failed to send warm status message." };
  }
  if (!warmResponse.ok) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_warm_message_failed",
        orderId,
        status: warmResponse.status,
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Failed to send warm status message." };
  }

  // 5. Photo message (inline preview)
  let photoResponse: Response;
  try {
    photoResponse = await fetch(messagesUrl, {
      method: "POST",
      headers,
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "image",
        image: { link: signedUrl, caption: "Seu mascotinho ficou lindo! 💕" },
      }),
    });
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_photo_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Failed to send image photo." };
  }
  if (!photoResponse.ok) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_photo_failed",
        orderId,
        status: photoResponse.status,
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Failed to send image photo." };
  }

  // 6. Document message (full-resolution download)
  let docResponse: Response;
  try {
    docResponse = await fetch(messagesUrl, {
      method: "POST",
      headers,
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "document",
        document: {
          link: signedUrl,
          filename: "mascotinho.png",
          caption: "Aqui está a versão completa para download! 🌟",
        },
      }),
    });
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_document_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Failed to send document." };
  }
  if (!docResponse.ok) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "deliver_image_document_failed",
        orderId,
        status: docResponse.status,
        service: "bot-engine",
      }),
    );
    return { success: false, message: "Failed to send document." };
  }

  // 7. Update Order: orderStatus → DELIVERED, conversationState → AWAITING_FEEDBACK (atomic)
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: "DELIVERED",
        conversationState: "AWAITING_FEEDBACK",
      },
    });
  } catch (err) {
    // Both messages delivered — log but treat as success for QStash
    console.log(
      JSON.stringify({
        level: "warn",
        event: "deliver_image_status_update_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }),
    );
    // Return success — messages reached the client, DB inconsistency is recoverable
    return { success: true, message: "Delivered but status update failed (manual fix needed)." };
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "deliver_image_success",
      orderId,
      service: "bot-engine",
    }),
  );

  return { success: true, message: "Image delivered successfully." };
}
