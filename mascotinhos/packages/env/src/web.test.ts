import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { clientSchemaSpec } from "./client-schema";

const schema = z.object(clientSchemaSpec);

const validClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://xxx.supabase.co",
  NEXT_PUBLIC_WHATSAPP_NUMBER: "5511999999999",
};

describe("client env schema", () => {
  it("accepts valid client env", () => {
    const result = schema.safeParse(validClientEnv);
    expect(result.success).toBe(true);
  });

  it("rejects missing NEXT_PUBLIC_SUPABASE_URL", () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _, ...env } = validClientEnv;
    const result = schema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("rejects missing NEXT_PUBLIC_WHATSAPP_NUMBER", () => {
    const { NEXT_PUBLIC_WHATSAPP_NUMBER: _, ...env } = validClientEnv;
    const result = schema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it("rejects non-URL NEXT_PUBLIC_SUPABASE_URL", () => {
    const result = schema.safeParse({
      ...validClientEnv,
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-digit NEXT_PUBLIC_WHATSAPP_NUMBER", () => {
    const result = schema.safeParse({
      ...validClientEnv,
      NEXT_PUBLIC_WHATSAPP_NUMBER: "+55 11 999",
    });
    expect(result.success).toBe(false);
  });

  it("accepts digit-only NEXT_PUBLIC_WHATSAPP_NUMBER", () => {
    const result = schema.safeParse({
      ...validClientEnv,
      NEXT_PUBLIC_WHATSAPP_NUMBER: "5511999999999",
    });
    expect(result.success).toBe(true);
  });
});
