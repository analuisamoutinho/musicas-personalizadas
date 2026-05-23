import { NextResponse } from "next/server";

export const maxDuration = 15;

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "NOT_SET";
  const masked = dbUrl.replace(/:([^@]+)@/, ":***@");

  try {
    // Dynamic import to avoid module-level env validation
    const { default: prisma } = await import("@mascotinhos/db");

    const start = Date.now();
    const rawResult = await Promise.race([
      prisma.$queryRaw`SELECT 1 as ok`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT_5s")), 5000)),
    ]);
    const rawElapsed = Date.now() - start;

    // Test the actual query that hangs
    const start2 = Date.now();
    const orderResult = await Promise.race([
      prisma.order.findFirst({
        where: {
          conversationState: { notIn: ["COMPLETED", "FAILED", "ABANDONED_24H"] },
        },
        orderBy: { createdAt: "desc" },
        include: { client: true },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ORDER_QUERY_TIMEOUT_5s")), 5000)),
    ]);
    const orderElapsed = Date.now() - start2;

    return NextResponse.json({
      status: "ok",
      rawQuery: { elapsed: `${rawElapsed}ms`, result: rawResult },
      orderQuery: { elapsed: `${orderElapsed}ms`, found: !!orderResult },
      url: masked,
    });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      db: "failed",
      url: masked,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
