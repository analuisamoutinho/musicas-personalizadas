import { tool } from "ai";
import { z } from "zod";
import { deliverImageToClient } from "../deliver-image-to-client";

export const deliverImage = tool({
  description:
    "Send the generated mascotinho image to the client via WhatsApp. Called after generation completes.",
  inputSchema: z.object({
    orderId: z.string().describe("Current order ID"),
    imageUrl: z
      .string()
      .describe("Storage path of the generated image (e.g. generated/orderId/1.png)"),
    recipientPhone: z.string().describe("Client WhatsApp sender ID"),
    clientName: z
      .string()
      .nullable()
      .optional()
      .describe("Client name for personalization"),
  }),
  execute: async ({ orderId, imageUrl, recipientPhone, clientName }) =>
    deliverImageToClient({ orderId, imageUrl, recipientPhone, clientName }),
});
