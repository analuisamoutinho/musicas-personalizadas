import { tool } from "ai";
import { z } from "zod";
import prisma from "@mascotinhos/db";

/**
 * Fetch greeting context: top 3 style templates by popularity and portfolio image URLs.
 * Call once at the start of GREETING state.
 *
 * State transition note: this tool only reads data — it does NOT call updateOrderState().
 * Transitions GREETING → COLLECTING_PHOTOS or COLLECTING_THEME are triggered by
 * collectPhotos tool (Story 2.5) or selectStyle tool (Story 2.6).
 */
export const getGreetingContext = tool({
  description:
    "Fetch greeting context: top 3 style templates by popularity and portfolio image URLs. Call once at the start of GREETING state.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID (for logging)"),
  }),
  execute: async (input) => {
    console.log(
      JSON.stringify({
        level: "info",
        event: "get_greeting_context_called",
        orderId: input.orderId,
        service: "bot-engine",
      }),
    );

    // Uses @@index([active, popularity]) defined on StyleTemplate model (NFR-06 compliance)
    let topStyles: { id: string; name: string; slug: string }[] = [];
    try {
      topStyles = await prisma.styleTemplate.findMany({
        where: { active: true },
        orderBy: { popularity: "desc" },
        take: 3,
        select: { id: true, name: true, slug: true },
      });
    } catch (dbError) {
      console.log(
        JSON.stringify({
          level: "error",
          event: "get_greeting_context_db_error",
          orderId: input.orderId,
          service: "bot-engine",
          error: dbError instanceof Error ? dbError.message : String(dbError),
        }),
      );
      // Graceful degradation: return empty topStyles so agent uses generic fallback (AC#6)
    }

    return {
      success: true,
      topStyles,
      // Portfolio images removed — no real URLs available yet (Epic 6 / Story 6.2)
      // The system prompt instructs the agent NOT to send image links
      portfolioImages: [] as string[],
    };
  },
});
