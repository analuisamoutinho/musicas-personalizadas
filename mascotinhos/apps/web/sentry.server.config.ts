import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  sendDefaultPii: true,
  // VERCEL_ENV is "production" | "preview" | "development" and correctly
  // distinguishes Preview deployments from Production. NODE_ENV is always
  // "production" for any Vercel build, so it cannot be used alone.
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
