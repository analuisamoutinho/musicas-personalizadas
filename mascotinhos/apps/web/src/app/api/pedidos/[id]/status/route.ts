import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      orderStatus: true,
      musicaTitulo: true,
      musicaAudioPreviewUrl: true,
      musicaAudioFinalUrl: true,
      payments: {
        select: { status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) {
    return NextResponse.json({ erro: "Pedido não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    orderStatus: order.orderStatus,
    paymentStatus: order.payments[0]?.status ?? "PENDING",
    musicaTitulo: order.musicaTitulo,
    musicaAudioPreviewUrl: order.musicaAudioPreviewUrl,
    musicaAudioFinalUrl: order.musicaAudioFinalUrl,
  });
}
