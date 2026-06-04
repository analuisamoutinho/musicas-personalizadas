/**
 * Promptfoo custom provider for the Músicas Personalizadas bot agent.
 *
 * Builds the system prompt dynamically from test case vars (order context)
 * and delegates the actual LLM call to the OpenAI SDK (same model used in
 * production: gpt-5.4-mini).
 *
 * Environment variables are set before imports to satisfy @mascotinhos/env
 * validation (no real DB/API calls are made — only the system prompt builder
 * is imported).
 *
 * See: https://www.promptfoo.dev/docs/providers/custom-api/
 */

// Satisfy env validation before any module import
process.env["DATABASE_URL"] ??= "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] ??= "postgresql://test:test@localhost:5432/test";
process.env["SUPABASE_URL"] ??= "http://localhost:54321";
process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "test-service-role-key";
process.env["OPENAI_API_KEY"] ??= "sk-test-key";
process.env["ASAAS_API_KEY"] ??= "test-asaas-key";
process.env["ASAAS_WEBHOOK_SECRET"] ??= "test-asaas-secret";
process.env["WHATSAPP_WEBHOOK_TOKEN"] ??= "test-whatsapp-token";
process.env["WHATSAPP_APP_SECRET"] ??= "test-whatsapp-app-secret";
process.env["WHATSAPP_PHONE_NUMBER_ID"] ??= "123456789";
process.env["WHATSAPP_ACCESS_TOKEN"] ??= "test-whatsapp-access";
process.env["QSTASH_TOKEN"] ??= "test-qstash-token";
process.env["QSTASH_CURRENT_SIGNING_KEY"] ??= "sig_test_current";
process.env["QSTASH_NEXT_SIGNING_KEY"] ??= "sig_test_next";
process.env["VERCEL_URL"] ??= "https://test.vercel.app";
process.env["OPERATOR_WHATSAPP_NUMBER"] ??= "5511999999999";
process.env["UPSTASH_REDIS_REST_URL"] ??= "https://test.upstash.io";
process.env["UPSTASH_REDIS_REST_TOKEN"] ??= "test-redis-token";
process.env["CRON_SECRET"] ??= "test-cron-secret";
process.env["NODE_ENV"] ??= "test";

import { buildEvalPrompt } from "./provider";
import OpenAI from "openai";

const MODEL = process.env["EVAL_MODEL"] ?? "gpt-4.1-mini";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI();
  }
  return client;
}

module.exports = {
  id: () => `musicas-personalizadas-bot (${MODEL})`,

  async callApi(
    _prompt: string,
    context: { vars: Record<string, unknown> },
  ): Promise<{ output: string; tokenUsage?: { total: number } }> {
    const { systemPrompt, userMessage, history } = buildEvalPrompt(
      context.vars,
    );

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map(
        (m) =>
          ({
            role: m.role,
            content: m.content,
          }) as OpenAI.Chat.Completions.ChatCompletionMessageParam,
      ),
      { role: "user", content: userMessage },
    ];

    const completion = await getClient().chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 500,
    });

    const output = completion.choices[0]?.message?.content ?? "";
    const totalTokens = completion.usage?.total_tokens ?? 0;

    return { output, tokenUsage: { total: totalTokens } };
  },
};
