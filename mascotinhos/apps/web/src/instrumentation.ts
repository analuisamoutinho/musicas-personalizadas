import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Langfuse OTEL tracing — traces all AI SDK calls with cost/tokens/latency.
    // Only initializes when credentials are configured.
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      const { LangfuseSpanProcessor } = await import("@langfuse/otel");
      const { NodeTracerProvider } = await import("@opentelemetry/sdk-trace-node");

      const langfuseSpanProcessor = new LangfuseSpanProcessor({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASE_URL,
      });

      const tracerProvider = new NodeTracerProvider({
        spanProcessors: [langfuseSpanProcessor],
      });

      tracerProvider.register();
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
