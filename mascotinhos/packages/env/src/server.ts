// Load .env file in non-Vercel environments. Using a static side-effect import
// (synchronous) instead of a dynamic await import, which avoids making this an
// async module. Async modules cause Temporal Dead Zone errors in Bun's test runner
// because test code may run before the top-level await completes.
// On Vercel, env vars are already injected — dotenv.config() is a no-op there.
import "dotenv/config";

import { createEnv } from "@t3-oss/env-core";
import { serverSchemaSpec } from "./server-schema";

export { serverSchemaSpec } from "./server-schema";

export const env = createEnv({
  server: serverSchemaSpec,
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: process.env.NEXT_PHASE === "phase-production-build",
  onValidationError: (error: unknown) => {
    const err = error as { issues?: Array<{ path: string[]; message: string }> };
    console.error(JSON.stringify({
      level: "error",
      event: "env_validation_failed",
      errors: err.issues?.map((i) => ({ path: i.path, message: i.message })) ?? String(error),
      vercel: !!process.env.VERCEL,
    }));
    throw error;
  },
});
