// mascotinhos/apps/web/src/app/api/webhooks/mercadopago/route.ts
//
// Recebe notificações do Mercado Pago sobre status de pagamento.
// Quando aprovado: marca pedido como pago e envia áudio final via WhatsApp.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { verificarPagamento } from "@/lib/mercadopago-service";
import { enviarAudioWhatsApp, enviarMensagemWhatsApp } from "@/lib/whatsapp-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // MP envia action + data.id para pagamentos
    const { action, data } = body as {
      action: string;
      data?: { id?: string };
    };

    // Só processa eventos de pagamento
    if (action !== "payment.updated" && action !== "payment.created") {
      return NextResponse.json({ recebido: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ recebido: true });
    }

    // Verificar status real na API do MP (não confiar só no webhook)
    const status = await verificarPagamento(paymentId);

    if (status !== "approved") {
      return NextResponse.json({ recebido: true });
    }

    // Buscar pedido pelo paymentId (salvo no campo asaasId)
    const pagamento = await prisma.payment.findUnique({
      where: { asaasId: String(paymentId) },
      include: {
        order: {
          include: { client: true },
        },
      },
    });

    if (!pagamento) {
      console.warn(`[mp-webhook] Pagamento ${paymentId} não encontrado no banco`);
      return NextResponse.json({ recebido: true });
    }

    const pedido  = pagamento.order;
    const telefone = pedido.client.whatsappSenderId;

    // Evitar processar pagamento já aprovado (idempotência)
    if (pagamento.status === "CONFIRMED") {
      return NextResponse.json({ recebido: true });
    }

    // 1. Atualizar status do pagamento e do pedido
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: pagamento.id },
        data:  { status: "CONFIRMED", confirmedAt: new Date() },
      }),
      prisma.order.update({
        where: { id: pedido.id },
        data:  {
          orderStatus:       "PAID",
          conversationState: "COMPLETED",
        },
      }),
    ]);

    // 2. Enviar áudio final via WhatsApp
    // O áudio final é o mesmo preview (não tem watermark no Kie.ai)
    const audioFinalUrl = pedido.musicaAudioFinalUrl || pedido.musicaAudioPreviewUrl;

    if (!audioFinalUrl) {
      console.error(`[mp-webhook] Sem audioUrl para pedido ${pedido.id}`);
      await enviarMensagemWhatsApp({
        to:   telefone,
        text: "Pagamento confirmado! ✅ Seu arquivo chegará em instantes. 🎶",
      });
      return NextResponse.json({ recebido: true });
    }

    await enviarAudioWhatsApp({
      to:       telefone,
      audioUrl: audioFinalUrl,
      caption:  "Aqui está sua música completa 🎶 Espero que essa surpresa emocione muito vocês. ❤️",
    });

    console.log(JSON.stringify({
      level: "info",
      event: "pagamento_confirmado_e_entregue",
      orderId: pedido.id,
      paymentId,
    }));

    return NextResponse.json({ recebido: true });
  } catch (err) {
    console.error("[mp-webhook]", err);
    // SEMPRE retornar 200 — MP reenvia em 4xx/5xx
    return NextResponse.json({ recebido: true });
  }
}
