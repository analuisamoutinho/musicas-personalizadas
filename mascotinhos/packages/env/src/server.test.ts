import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { serverSchemaSpec } from "./server-schema";

const schema = z.object(serverSchemaSpec);

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
  SUPABASE_URL: "https://xxx.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  GOOGLE_GENERATIVE_AI_API_KEY: "test-gemini-key", // optional
  OPENAI_API_KEY: "sk-test-key-123",
  ASAAS_API_KEY: "test-key",
  ASAAS_WEBHOOK_SECRET: "test-secret",
  WHATSAPP_WEBHOOK_TOKEN: "test-token",
  WHATSAPP_APP_SECRET: "test-app-secret",
  WHATSAPP_PHONE_NUMBER_ID: "123456789",
  WHATSAPP_ACCESS_TOKEN: "test-token",
  QSTASH_TOKEN: "test-token",
  QSTASH_CURRENT_SIGNING_KEY: "sig_test",
  QSTASH_NEXT_SIGNING_KEY: "sig_test",
  VERCEL_URL: "https://app.vercel.app",
  OPERATOR_WHATSAPP_NUMBER: "5511999999999",
  UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-redis-token",
  CRON_SECRET: "test-cron-secret",
  NODE_ENV: "test" as const,
};

describe("server env schema", () => {
  it("accepts valid env with all required fields", () => {
    const result = schema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("defaults NODE_ENV to development when omitted", () => {
    const { NODE_ENV: _, ...envWithoutNodeEnv } = validEnv;
    const result = schema.safeParse(envWithoutNodeEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL: _, ...env } = validEnv;
    const result = schema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("allows optional DIRECT_URL to be omitted", () => {
    const { DIRECT_URL: _, ...env } = validEnv;
    const result = schema.safeParse(env);
    expect(result.success).toBe(true);
  });

  it("rejects non-URL DATABASE_URL", () => {
    const result = schema.safeParse({ ...validEnv, DATABASE_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects OPENAI_API_KEY without sk- prefix", () => {
    const result = schema.safeParse({ ...validEnv, OPENAI_API_KEY: "bad-key" });
    expect(result.success).toBe(false);
  });

  it("accepts OPENAI_API_KEY with sk- prefix", () => {
    const result = schema.safeParse({
      ...validEnv,
      OPENAI_API_KEY: "sk-proj-abc123",
    });
    expect(result.success).toBe(true);
  });

  it("allows optional ASAAS_SPLIT_WALLET_ID to be omitted", () => {
    const result = schema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ASAAS_SPLIT_WALLET_ID).toBeUndefined();
    }
  });

  it("accepts ASAAS_SPLIT_WALLET_ID when provided", () => {
    const result = schema.safeParse({
      ...validEnv,
      ASAAS_SPLIT_WALLET_ID: "wallet123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ASAAS_SPLIT_WALLET_ID).toBe("wallet123");
    }
  });

  it("rejects non-digit OPERATOR_WHATSAPP_NUMBER", () => {
    const result = schema.safeParse({
      ...validEnv,
      OPERATOR_WHATSAPP_NUMBER: "+55-11-999",
    });
    expect(result.success).toBe(false);
  });

  it("accepts digit-only OPERATOR_WHATSAPP_NUMBER", () => {
    const result = schema.safeParse({
      ...validEnv,
      OPERATOR_WHATSAPP_NUMBER: "5511999999999",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing ASAAS_API_KEY", () => {
    const { ASAAS_API_KEY: _, ...env } = validEnv;
    const result = schema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("rejects missing WHATSAPP_WEBHOOK_TOKEN", () => {
    const { WHATSAPP_WEBHOOK_TOKEN: _, ...env } = validEnv;
    const result = schema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("rejects missing QSTASH_TOKEN", () => {
    const { QSTASH_TOKEN: _, ...env } = validEnv;
    const result = schema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("rejects missing VERCEL_URL", () => {
    const { VERCEL_URL: _, ...env } = validEnv;
    const result = schema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("rejects invalid NODE_ENV value", () => {
    const result = schema.safeParse({ ...validEnv, NODE_ENV: "staging" });
    expect(result.success).toBe(false);
  });
});
