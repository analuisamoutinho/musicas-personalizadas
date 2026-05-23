import { createEnv } from "@t3-oss/env-nextjs";
import { clientSchemaSpec } from "./client-schema";

export { clientSchemaSpec } from "./client-schema";

export const env = createEnv({
  client: clientSchemaSpec,
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
  },
  emptyStringAsUndefined: true,
});
