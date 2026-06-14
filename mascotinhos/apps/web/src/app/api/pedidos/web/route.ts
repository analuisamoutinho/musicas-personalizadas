import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import prisma from "@mascotinhos/db";
import { createMpPixCharge } from "@/lib/mercadopago";
import { sendOrderConfirmationEmail } from "@/lib/email";

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nomeCliente,
      email,
      nomeHomenageado,
      vinculo,
      historia,
      fraseFinal,
      ritmo,
      voz,
    } = body as {
      nomeCliente: string;
      email: string;
      nomeHomenageado: string;
      vinculo: string;
      historia: string;
      fraseFinal?: string;
      ritmo: string;
      voz: string;
    };

    if (!nomeCliente || !email || !nomeHomenageado || !vinculo || !historia || !ritmo || !voz) {
      return NextResponse.json(
        { erro: "Preencha todos os campos obrigatórios" },
        { status: 400 }
      );
    }

    // Create client record
    const client = await prisma.client.create({
      data: {
        whatsappSenderId: `web_${crypto.randomUUID()}`,
        name: nomeCliente,
      },
    });

    // Create order
    const order = await prisma.order.create({
      data: {
        client: { connect: { id: client.id } },
        productType: "MUSICA_PERSONALIZADA",
        conversationState: "AWAITING_PAYMENT",
        orderStatus: "PENDING",
        musicaNomeHomenageado: nomeHomenageado,
        musicaVinculo: vinculo,
        musicaHistoria: historia,
        musicaRitmo: ritmo,
        musicaVoz: voz,
        musicaFraseFinal: fraseFinal ?? null,
      },
    });

    // Create PIX via Mercado Pago
    const pix = await createMpPixCharge(email, order.id, 29.90);

    // Store payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        asaasId: pix.paymentId, // reusing field for MP payment id
        pixQrCode: pix.pixCopyPaste,
        pixQrImageUrl: `data:image/png;base64,${pix.pixQrCodeBase64}`,
        amount: 29.90,
        status: "PENDING",
      },
    });

    // Store email in Redis for delivery notification (TTL 7 days)
    try {
      const redis = getRedis();
      if (redis) {
        await redis.set(`order_email:${order.id}`, JSON.stringify({ email, nomeCliente, nomeHomenageado }), { ex: 604800 });
      }
    } catch (redisErr) {
      console.error("[redis] failed to store email, continuing:", redisErr);
    }

    // Send confirmation email (non-blocking)
    sendOrderConfirmationEmail({ to: email, nomeCliente, nomeHomenageado, orderId: order.id }).catch(
      (e) => console.error("[email] order confirmation failed", e)
    );

    return NextResponse.json({
      orderId: order.id,
      pixQrCodeBase64: pix.pixQrCodeBase64,
      pixCopyPaste: pix.pixCopyPaste,
    });
  } catch (err) {
    console.error("[POST /api/pedidos/web]", err);
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
