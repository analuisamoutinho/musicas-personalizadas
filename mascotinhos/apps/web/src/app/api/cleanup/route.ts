import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@mascotinhos/db";
import { deleteExpiredReferences } from "@mascotinhos/storage";
import { env } from "@mascotinhos/env/server";

// Allow up to 60s — cleanup may process many orders with Supabase Storage calls
export const maxDuration = 60;

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const expected = `Bearer ${env.CRON_SECRET}`;
  // Use timing-safe comparison to prevent timing-based secret enumeration
  try {
    const a = Buffer.from(auth);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function runCleanup(): Promise<NextResponse> {
  try {
    const expiredOrders = await prisma.order.findMany({
      where: {
        photosDeleteAt: {
          lt: new Date(),
          not: null,
        },
      },
      select: { id: true },
    });

    if (expiredOrders.length === 0) {
      console.log(
        JSON.stringify({
          level: "info",
          event: "cleanup_no_expired_orders",
          service: "web",
        }),
      );
      return NextResponse.json({ status: "ok", deletedCount: 0, errorCount: 0 });
    }

    const orderIds = expiredOrders.map((o) => o.id);
    const result = await deleteExpiredReferences(orderIds);

    // Null out photosDeleteAt only for successfully processed orders (idempotency)
    const failedIds = new Set(result.errors.map((e) => e.orderId));
    const successfulIds = orderIds.filter((id) => !failedIds.has(id));

    if (successfulIds.length > 0) {
      try {
        await prisma.order.updateMany({
          where: { id: { in: successfulIds } },
          data: { photosDeleteAt: null },
        });
      } catch (dbErr) {
        // Storage deletion already succeeded — log the DB failure so the next
        // cron run can retry (idempotent: re-deleting an empty folder is safe).
        console.log(
          JSON.stringify({
            level: "error",
            event: "cleanup_null_photos_delete_at_failed",
            successfulIds,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            service: "web",
          }),
        );
      }
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "cleanup_completed",
        deletedCount: result.deletedCount,
        errorCount: result.errorCount,
        service: "web",
      }),
    );

    return NextResponse.json({
      status: "ok",
      deletedCount: result.deletedCount,
      errorCount: result.errorCount,
    });
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "cleanup_fatal_error",
        error: err instanceof Error ? err.message : String(err),
        service: "web",
      }),
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// Vercel Cron triggers via GET
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyAuth(request)) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "cleanup_unauthorized",
        service: "web",
      }),
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCleanup();
}

// Also support POST for manual/testing invocations
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyAuth(request)) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "cleanup_unauthorized",
        service: "web",
      }),
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCleanup();
}
