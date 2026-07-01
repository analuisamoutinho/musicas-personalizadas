import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import prisma from "@mascotinhos/db";
import { sendMusicReadyEmail } from "@/lib/email";
import { enviarAudioWhatsApp } from "@/lib/whatsapp-service";

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}

export async function POST(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ erro: "orderId ausente" }, { status: 400 });
    }

    const body = await req.json();

    const sunoData = body?.data?.response?.sunoData?.[0]
      ?? body?.response?.sunoData?.[0]
      ?? body?.sunoData?.[0];

    if (!sunoData?.audioUrl) {
      console.error("[kie-webhook] audioUrl ausente:", JSON.stringify(body));
      return NextResponse.json({ erro: "audioUrl ausente no payload" }, { status: 400 });
    }

    const audioUrl: string = sunoData.audioUrl;

    // Save audio URL and mark order as delivered
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        musicaAudioFinalUrl: audioUrl,
        musicaAudioPreviewUrl: audioUrl,
        conversationState: "DELIVERING",
        orderStatus: "DELIVERED",
      },
      include: { client: true },
    });

    // Send email notification if we have the client's email
    try {
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get<string>(`order_email:${orderId}`);
        if (cached) {
          const { email, nomeCliente, nomeHomenageado } = JSON.parse(typeof cached === "string" ? cached : JSON.stringify(cached));
          sendMusicReadyEmail({
            to: email,
            nomeCliente,
            nomeHomenageado,
            orderId,
            musicaTitulo: order.musicaTitulo,
            audioUrl,
          }).catch((e) => console.error("[email] music ready failed", e));
        }
      }
    } catch (redisErr) {
      console.error("[redis] failed to read email, continuing:", redisErr);
    }

    // Deliver audio via WhatsApp
    const telefone = order.client?.whatsappSenderId;
    if (telefone) {
      enviarAudioWhatsApp({
        to: telefone,
        audioUrl,
        caption: "Sua música ficou pronta! 🎶 Espero que essa surpresa emocione muito vocês. ❤️",
      }).catch((err) => {
        console.error("[kie-webhook] falha ao enviar áudio no WhatsApp:", err);
      });
    }

    console.log(JSON.stringify({ level: "info", event: "kie_audio_entregue", orderId, audioUrl }));

    return NextResponse.json({ sucesso: true });
  } catch (err) {
    console.error("[kie-webhook]", err);
    return NextResponse.json({ erro: String(err) }, { status: 200 });
  }
}
