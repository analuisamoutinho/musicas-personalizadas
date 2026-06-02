// mascotinhos/apps/web/src/app/api/pedidos/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { gerarMusica, type BriefingMusica } from "@/lib/gerar-letra";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      telefone,
      nomeHomenageado,
      vinculo,       // ← novo
      historia,
      ritmo,
      voz,
      fraseFinal,
    } = body as {
      telefone: string;
      nomeHomenageado: string;
      vinculo: string;
      historia: string;
      ritmo: BriefingMusica["ritmo"];
      voz: BriefingMusica["voz"];
      fraseFinal?: string;
    };

    if (!telefone || !nomeHomenageado || !historia || !voz) {
      return NextResponse.json(
        { erro: "Campos obrigatórios: telefone, nomeHomenageado, historia, voz" },
        { status: 400 },
      );
    }

    const pedido = await prisma.order.create({
      data: {
        // campos do Mascotinhos
        client: { connect: { whatsappSenderId: telefone } },
        productType: "MUSICA_PERSONALIZADA",
        conversationState: "MUSICA_CONFIRMING_ORDER",
        // briefing
        musicaNomeHomenageado: nomeHomenageado,
        musicaVinculo: vinculo || "",
        musicaHistoria: historia,
        musicaRitmo: ritmo ?? "SERTANEJO_UNIVERSITARIO",
        musicaVoz: voz,
        musicaFraseFinal: fraseFinal,
      },
    });

    // Gera os 3 blocos em background
    gerarMusicaEmBackground(pedido.id, {
      nomeHomenageado,
      vinculo: vinculo || "pessoa especial",
      historia,
      ritmo: ritmo ?? "SERTANEJO_UNIVERSITARIO",
      voz,
      fraseFinal,
    });

    return NextResponse.json({ sucesso: true, pedidoId: pedido.id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/pedidos]", err);
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}

async function gerarMusicaEmBackground(orderId: string, briefing: BriefingMusica) {
  try {
    const resultado = await gerarMusica(briefing);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        musicaTitulo:          resultado.titulo,
        musicaEstiloDetalhado: resultado.estiloDetalhado,
        musicaLetra:           resultado.letra,
        musicaPromptSuno:      resultado.promptSuno,
        musicaLetraGeradaEm:   new Date(),
      },
    });

    console.log(JSON.stringify({
      level: "info",
      event: "musica_gerada",
      orderId,
      titulo: resultado.titulo,
      promptSunoChars: resultado.promptSuno.length,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      event: "musica_geracao_falhou",
      orderId,
      erro: String(err),
    }));
  }
}

export async function GET() {
  try {
    const pedidos = await prisma.order.findMany({
      where: { productType: "MUSICA_PERSONALIZADA" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        client: { select: { whatsappSenderId: true } },
        musicaNomeHomenageado: true,
        musicaRitmo: true,
        musicaVoz: true,
        musicaTitulo: true,
        musicaLetraGeradaEm: true,
        musicaAudioPreviewUrl: true,
        conversationState: true,
        orderStatus: true,
        revisoesSolicitadas: true,
      },
    });

    return NextResponse.json(pedidos);
  } catch (err) {
    console.error("[GET /api/pedidos]", err);
    return NextResponse.json({ erro: "Erro interno" }, { status: 500 });
  }
}
