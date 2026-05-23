import { env } from "@mascotinhos/env/server";
import { uploadPixQr, getSignedUrl } from "@mascotinhos/storage";
import { makeAbortSignal, buildMessagesUrl } from "./whatsapp-client";

export async function sendPixMessages(
  orderId: string,
  recipientPhone: string,
  pixQrCodeBase64: string,
  pixCopyPaste: string,
): Promise<{ imageSent: boolean; storagePath: string | null }> {
  let storagePath: string | null = null;
  let signedUrl: string | null = null;

  // Upload QR code PNG to storage (5 s cap — guards against hung Supabase connection)
  try {
    const uploadPromise = uploadPixQr(orderId, Buffer.from(pixQrCodeBase64, "base64"));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("upload timeout")), 5000)
    );
    storagePath = await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    console.log(JSON.stringify({
      level: "warn",
      event: "pix_qr_storage_failed",
      orderId,
      error: err instanceof Error ? err.message : String(err),
      service: "bot-engine",
    }));
  }

  // Get signed URL (only if upload succeeded; storagePath kept for caching even if URL fails)
  if (storagePath !== null) {
    try {
      signedUrl = await getSignedUrl(storagePath);
    } catch (err) {
      console.log(JSON.stringify({
        level: "warn",
        event: "pix_qr_storage_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }));
    }
  }

  const imageSent = await sendPixViaWhatsApp(orderId, recipientPhone, signedUrl, pixCopyPaste);
  return { imageSent, storagePath };
}

export async function resendPixFromPath(
  orderId: string,
  recipientPhone: string,
  storagePath: string,
  pixCopyPaste: string,
): Promise<void> {
  let signedUrl: string | null = null;
  try {
    signedUrl = await getSignedUrl(storagePath);
  } catch (err) {
    console.log(JSON.stringify({
      level: "warn",
      event: "pix_qr_storage_failed",
      orderId,
      error: err instanceof Error ? err.message : String(err),
      service: "bot-engine",
    }));
  }
  await sendPixViaWhatsApp(orderId, recipientPhone, signedUrl, pixCopyPaste);
}

async function sendPixViaWhatsApp(
  orderId: string,
  recipientPhone: string,
  signedUrl: string | null,
  pixCopyPaste: string,
): Promise<boolean> {
  const jsonHeaders = {
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
  const messagesUrl = buildMessagesUrl();
  let imageSent = false;

  // Send QR code image via proven `image.link` pattern (Supabase signed URL)
  if (signedUrl) {
    try {
      const imgResponse = await fetch(messagesUrl, {
        method: "POST",
        headers: jsonHeaders,
        signal: makeAbortSignal(),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "image",
          image: {
            link: signedUrl,
            caption: "QR Code PIX — escaneie no app do seu banco ou copie o código abaixo 📱",
          },
        }),
      });
      if (imgResponse.ok) {
        imageSent = true;
      } else {
        const body = (await imgResponse.text()).slice(0, 300);
        console.log(JSON.stringify({
          level: "warn",
          event: "pix_qr_image_send_failed",
          orderId,
          status: imgResponse.status,
          body,
          service: "bot-engine",
        }));
      }
    } catch (err) {
      console.log(JSON.stringify({
        level: "warn",
        event: "pix_qr_image_send_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }));
    }
  }

  // If image delivery failed, send a prose fallback first so client isn't confused
  if (!imageSent) {
    try {
      const fallbackResponse = await fetch(messagesUrl, {
        method: "POST",
        headers: jsonHeaders,
        signal: makeAbortSignal(),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "text",
          text: { body: "Não consegui anexar o QR Code, mas você pode copiar o código PIX abaixo:" },
        }),
      });
      if (!fallbackResponse.ok) {
        const body = (await fallbackResponse.text()).slice(0, 300);
        console.log(JSON.stringify({
          level: "warn",
          event: "pix_copycode_send_failed",
          orderId,
          status: fallbackResponse.status,
          body,
          service: "bot-engine",
        }));
      }
    } catch (err) {
      console.log(JSON.stringify({
        level: "warn",
        event: "pix_copycode_send_failed",
        orderId,
        error: err instanceof Error ? err.message : String(err),
        service: "bot-engine",
      }));
    }
  }

  // Always send EMV alone — clean long-press copy in WhatsApp
  try {
    const textResponse = await fetch(messagesUrl, {
      method: "POST",
      headers: jsonHeaders,
      signal: makeAbortSignal(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: pixCopyPaste },
      }),
    });
    if (!textResponse.ok) {
      const body = (await textResponse.text()).slice(0, 300);
      console.log(JSON.stringify({
        level: "warn",
        event: "pix_copycode_send_failed",
        orderId,
        status: textResponse.status,
        body,
        service: "bot-engine",
      }));
    }
  } catch (err) {
    console.log(JSON.stringify({
      level: "warn",
      event: "pix_copycode_send_failed",
      orderId,
      error: err instanceof Error ? err.message : String(err),
      service: "bot-engine",
    }));
  }

  return imageSent;
}
