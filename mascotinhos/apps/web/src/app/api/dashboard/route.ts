// mascotinhos/apps/web/src/app/api/dashboard/route.ts
//
// GET /api/dashboard?periodo=7d|30d|mes
//
// Retorna métricas agregadas por dia.
// - previas, vendas, faturado, alteracoes → calculados do banco (Prisma)
// - investido, leads → vêm da tabela MetricaDiaria (preenchida manualmente ou via Meta Ads API)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";

const PRECO_UNITARIO = 19.90; // R$ por música — ajuste conforme seu preço

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get("periodo") ?? "7d";

  const agora = new Date();
  let dataInicio: Date;

  if (periodo === "mes") {
    dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  } else {
    const dias = periodo === "30d" ? 30 : 7;
    dataInicio = new Date(agora);
    dataInicio.setDate(agora.getDate() - dias);
  }

  // 1. Busca métricas manuais (investido, leads) do período
  const metricasManuais = await prisma.metricaDiaria.findMany({
    where: { data: { gte: dataInicio } },
    orderBy: { data: "asc" },
  });

  // 2. Busca pedidos do período e agrega por dia
  const pedidos = await prisma.pedido.findMany({
    where: { criadoEm: { gte: dataInicio } },
    select: {
      criadoEm: true,
      status: true,
      revisoesSolicitadas: true,
    },
  });

  // 3. Monta mapa por data
  const mapaMetricas = new Map<string, {
    previas: number; vendas: number; faturado: number; alteracoes: number;
  }>();

  for (const pedido of pedidos) {
    const chave = pedido.criadoEm.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const atual = mapaMetricas.get(chave) ?? { previas: 0, vendas: 0, faturado: 0, alteracoes: 0 };

    const statusOrdenados = [
      "BRIEFING_RECEBIDO", "LETRA_GERADA", "AGUARDANDO_AUDIO",
      "PREVIEW_ENVIADO", "AGUARDANDO_PAGAMENTO", "PAGO", "ENTREGUE",
    ];
    const idx = statusOrdenados.indexOf(pedido.status);

    if (idx >= 3) atual.previas++;             // PREVIEW_ENVIADO em diante
    if (idx >= 5) {                            // PAGO em diante
      atual.vendas++;
      atual.faturado += PRECO_UNITARIO;
    }
    atual.alteracoes += pedido.revisoesSolicitadas ?? 0;

    mapaMetricas.set(chave, atual);
  }

  // 4. Combina com métricas manuais
  const resultado = metricasManuais.map((m) => {
    const chave = m.data.toISOString().slice(0, 10);
    const operacional = mapaMetricas.get(chave) ?? { previas: 0, vendas: 0, faturado: 0, alteracoes: 0 };

    return {
      data: m.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      dia: m.diaSemana ?? undefined,
      investido: m.investido,
      leads: m.leads,
      previas: operacional.previas,
      vendas: operacional.vendas,
      faturado: operacional.faturado,
      alteracoes: operacional.alteracoes,
    };
  });

  return NextResponse.json(resultado);
}
