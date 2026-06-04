// mascotinhos/apps/web/src/app/api/pedidos/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { gerarLetra } from "@/lib/gerar-letra";
import type { BriefingMusica } from "@/lib/gerar-letra";

type Params = { params: { id: string } };

// GET /api/pedidos/:id — retorna pedido completo com a letra
export async function GET(_req: NextRequest, { params }: Params) {
  const pedido = await prisma.pedido.findUnique({ where: { id: params.id } });

  if (!pedido) {
    return NextResponse.json({ erro: "Pedido não encontrado" }, { status: 404 });
  }

  return NextResponse.json(pedido);
}

// PATCH /api/pedidos/:id — atualiza campos do pedido (status, audioUrl, etc.)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();

    const pedido = await prisma.pedido.update({
      where: { id: params.id },
      data: body,
    });

    return NextResponse.json(pedido);
  } catch (err) {
    console.error("[PATCH /api/pedidos/:id]", err);
    return NextResponse.json({ erro: "Erro ao atualizar pedido" }, { status: 500 });
  }
}

// POST /api/pedidos/:id/retentar-letra — regenera a letra se geração falhou
export async function POST(req: NextRequest, { params }: Params) {
  const url = new URL(req.url);
  if (!url.pathname.endsWith("/retentar-letra")) {
    return NextResponse.json({ erro: "Rota inválida" }, { status: 404 });
  }

  const pedido = await prisma.pedido.findUnique({ where: { id: params.id } });
  if (!pedido) {
    return NextResponse.json({ erro: "Pedido não encontrado" }, { status: 404 });
  }

  const briefing: BriefingMusica = {
    nomeHomenageado: pedido.nomeHomenageado,
    historia: pedido.historia,
    ritmo: pedido.ritmo as BriefingMusica["ritmo"],
    voz: pedido.voz as BriefingMusica["voz"],
    fraseFinal: pedido.fraseFinal ?? undefined,
  };

  try {
    const letra = await gerarLetra(briefing);

    const atualizado = await prisma.pedido.update({
      where: { id: params.id },
      data: {
        letra,
        letraGeradaEm: new Date(),
        status: "LETRA_GERADA",
      },
    });

    return NextResponse.json(atualizado);
  } catch (err) {
    console.error("[retentar-letra]", err);
    return NextResponse.json({ erro: "Falha ao gerar letra" }, { status: 500 });
  }
}
