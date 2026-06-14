import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { createOrUpdateCustomer, createPixCharge } from "@mascotinhos/payments";

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

    // Create a new client for each web order (email migration pending)
    const client = await prisma.client.create({
      data: {
        whatsappSenderId: `web_${crypto.randomUUID()}`,
        name: nomeCliente,
      },
    });

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

    // Create Asaas customer using email as external reference
    const asaasCustomer = await createOrUpdateCustomer(email, nomeCliente);

    // Create PIX charge
    const pix = await createPixCharge(asaasCustomer.id, order.id, 29.90);

    // Store payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        asaasId: pix.chargeId,
        pixQrCode: pix.pixCopyPaste,
        pixQrImageUrl: `data:image/png;base64,${pix.pixQrCodeBase64}`,
        amount: 29.90,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      pixQrCodeBase64: pix.pixQrCodeBase64,
      pixCopyPaste: pix.pixCopyPaste,
    });
  } catch (err) {
    console.error("[POST /api/pedidos/web]", err);
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
