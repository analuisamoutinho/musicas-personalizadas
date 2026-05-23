import { z } from "zod";

export const clientSchemaSpec = {
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d+$/),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),
};
