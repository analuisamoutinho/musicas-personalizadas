// mascotinhos/apps/web/src/app/api/webhooks/mercadopago/route.ts
//
// Recebe notificações do Mercado Pago sobre status de pagamento.
// Quando aprovado: marca pedido como pago e envia áudio final via WhatsApp.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { verificarPagamento } from "@/lib/mercadopago-service";
import { enviarMensagemWhatsApp } from "@/lib/whatsapp-service";
import { iniciarGeracaoKie, type KieGeracaoInput } from "@/lib/kie-service";

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
          orderStatus:       "GENERATING",
          conversationState: "GENERATING",
        },
      }),
    ]);

    // 2. Avisar cliente que o pagamento foi recebido e a música está sendo gerada
    await enviarMensagemWhatsApp({
      to:   telefone,
      text: "Pagamento confirmado! ✅ Sua música está sendo gerada agora. Em alguns minutos você recebe aqui mesmo. 🎶",
    });

    // 3. Disparar geração de áudio no Kie.ai
    const { musicaTitulo, musicaLetra, musicaEstiloDetalhado, musicaVoz } = pedido;

    if (musicaTitulo && musicaLetra && musicaEstiloDetalhado && musicaVoz) {
      const kieInput: KieGeracaoInput = {
        titulo: musicaTitulo,
        letra: musicaLetra,
        estiloDetalhado: musicaEstiloDetalhado,
        voz: musicaVoz as KieGeracaoInput["voz"],
        orderId: pedido.id,
      };
      iniciarGeracaoKie(kieInput).then((taskId) => {
        console.log(JSON.stringify({ level: "info", event: "kie_generation_started", orderId: pedido.id, taskId }));
      }).catch((err) => {
        console.log(JSON.stringify({ level: "warn", event: "kie_generation_failed", orderId: pedido.id, error: String(err) }));
      });
    } else {
      console.log(JSON.stringify({ level: "warn", event: "kie_lyrics_not_ready", orderId: pedido.id }));
    }

    console.log(JSON.stringify({
      level: "info",
      event: "pagamento_confirmado_geracao_iniciada",
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
