// mascotinhos/apps/web/src/app/api/webhooks/kie/route.ts
//
// Recebe callback da Kie.ai quando o áudio termina de ser gerado.
// Kie chama POST nessa URL com os dados do taskId e audioUrl.
// Em seguida: salva no banco, gera PIX, envia preview + PIX via WhatsApp.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { gerarPix } from "@/lib/mercadopago-service";
import { enviarMensagemWhatsApp, enviarAudioWhatsApp } from "@/lib/whatsapp-service";

export async function POST(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ erro: "orderId ausente" }, { status: 400 });
    }

    const body = await req.json();

    // Kie.ai envia o taskId e os dados do áudio no callback
    const sunoData = body?.data?.response?.sunoData?.[0]
      ?? body?.response?.sunoData?.[0]
      ?? body?.sunoData?.[0];

    if (!sunoData?.audioUrl) {
      console.error("[kie-webhook] audioUrl ausente:", JSON.stringify(body));
      return NextResponse.json({ erro: "audioUrl ausente no payload" }, { status: 400 });
    }

    const audioUrl: string = sunoData.audioUrl;

    // 1. Salvar URL do preview no banco
    const pedido = await prisma.order.update({
      where: { id: orderId },
      data: {
        musicaAudioPreviewUrl: audioUrl,
        conversationState:     "MUSICA_AWAITING_PREVIEW_APPROVAL",
      },
      include: { client: true },
    });

    const telefone = pedido.client.whatsappSenderId;

    // 2. Gerar PIX via Mercado Pago
    const pix = await gerarPix({
      orderId,
      nomeCliente:    pedido.musicaNomeHomenageado ?? "Cliente",
      telefoneCliente: telefone,
    });

    // Salvar paymentId no banco
    await prisma.payment.create({
      data: {
        orderId,
        asaasId:  pix.paymentId,   // reutilizando campo asaasId para o MP paymentId
        amount:   19.90,
        status:   "PENDING",
        pixQrCode: pix.qrCode,
      },
    });

    // 3. Enviar áudio como prévia via WhatsApp
    await enviarAudioWhatsApp({
      to:       telefone,
      audioUrl: audioUrl,
      caption:  "Aqui está sua prévia 🎶 Escuta com atenção!",
    });

    // 4. Enviar mensagem com o PIX
    await enviarMensagemWhatsApp({
      to:   telefone,
      text: `Gostou? 😊\nPara receber o arquivo completo, faça o Pix de *R$19,90*:\n\n${pix.qrCode}`,
    });

    console.log(JSON.stringify({
      level: "info",
      event: "kie_audio_entregue",
      orderId,
      audioUrl,
    }));

    return NextResponse.json({ sucesso: true });
  } catch (err) {
    console.error("[kie-webhook]", err);
    // Retornar 200 mesmo em erro para Kie não reenviar infinitamente
    return NextResponse.json({ erro: String(err) }, { status: 200 });
  }
}
