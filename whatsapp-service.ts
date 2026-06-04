// mascotinhos/apps/web/src/lib/whatsapp-service.ts
//
// Wrapper sobre o whatsapp-client do bot-engine para envio de mensagens
// fora do contexto de atendimento (entrega de áudio, PIX, etc.)
//
// Usa a mesma WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID já configurados.

const WA_BASE    = "https://graph.facebook.com/v20.0";
const PHONE_ID   = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const WA_TOKEN   = process.env.WHATSAPP_ACCESS_TOKEN!;

// ─── Enviar mensagem de texto ─────────────────────────────────────────────────

export async function enviarMensagemWhatsApp(params: {
  to:   string;  // número no formato internacional sem + (ex: 5511999999999)
  text: string;
}): Promise<void> {
  const response = await fetch(`${WA_BASE}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to:                params.to,
      type:              "text",
      text:              { body: params.text },
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`WhatsApp mensagem error ${response.status}: ${erro}`);
  }
}

// ─── Enviar áudio via URL ─────────────────────────────────────────────────────
// A Kie.ai retorna URLs públicas de MP3 — enviamos como link de áudio.
// O WhatsApp aceita links públicos de áudio via "audio.link".
// caption não funciona em áudios; enviamos como mensagem separada logo depois.

export async function enviarAudioWhatsApp(params: {
  to:       string;
  audioUrl: string;
  caption?: string;
}): Promise<void> {
  // 1. Enviar o áudio
  const response = await fetch(`${WA_BASE}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to:                params.to,
      type:              "audio",
      audio:             { link: params.audioUrl },
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`WhatsApp áudio error ${response.status}: ${erro}`);
  }

  // 2. Enviar caption como mensagem de texto separada (se fornecida)
  if (params.caption) {
    await new Promise((r) => setTimeout(r, 500)); // pequeno delay
    await enviarMensagemWhatsApp({ to: params.to, text: params.caption });
  }
}

// ─── Enviar documento (arquivo para download) ─────────────────────────────────

export async function enviarDocumentoWhatsApp(params: {
  to:       string;
  fileUrl:  string;
  filename: string;
  caption?: string;
}): Promise<void> {
  const response = await fetch(`${WA_BASE}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to:                params.to,
      type:              "document",
      document: {
        link:     params.fileUrl,
        filename: params.filename,
        caption:  params.caption,
      },
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`WhatsApp documento error ${response.status}: ${erro}`);
  }
}
