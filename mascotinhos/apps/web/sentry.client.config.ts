import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  // NEXT_PUBLIC_VERCEL_ENV is "production" | "preview" | "development".
  // Vercel auto-injects it as a system env var (client-accessible).
  // NODE_ENV is always "production" for any Vercel build — it cannot
  // distinguish Preview from Production on its own.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
});
