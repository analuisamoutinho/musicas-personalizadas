import { ToolLoopAgent, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { buildSystemPrompt } from "./prompts/system-prompt";
import { allTools } from "./tools";
import type { ConversationState } from "./state-machine";

interface OrderContext {
  id: string;
  clientId: string; // DB client ID — needed by captureConsent tool
  conversationState: ConversationState;
  clientName?: string | null;
  theme?: string | null;
  outfitDescription?: string | null;
  extraRequests?: string | null;
  photosCount?: number;
  preFillText?: string | null; // from first message in GREETING state (Meta ad pre-fill)
  hasConsent: boolean; // true if client already gave LGPD consent in a previous order
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

function serializeCause(error: unknown, depth = 0): Record<string, unknown> | string | undefined {
  if (error == null) return undefined;
  if (!(error instanceof Error)) return String(error);
  if (depth > 2) return { message: error.message };
  const out: Record<string, unknown> = { name: error.name, message: error.message };
  if ("code" in error) out.code = (error as { code?: unknown }).code;
  if (error.cause != null) out.cause = serializeCause(error.cause, depth + 1);
  if (error instanceof AggregateError) {
    out.errors = error.errors.slice(0, 3).map((e) => serializeCause(e, depth + 1));
  }
  return out;
}

/**
 * Process a WhatsApp message through the AI agent.
 * Returns the agent's text response to send back to the client.
 *
 * A new ToolLoopAgent is created per call so that experimental_context
 * (which carries the resolved photo URLs for this turn) can be set at
 * construction time — the API does not accept it on agent.generate().
 */
export async function processMessage(
  order: OrderContext,
  userMessage: string,
  history: HistoryMessage[],
  photoData?: Array<{ buffer: Buffer; mimeType: string }>,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(order);

  const agent = new ToolLoopAgent({
    id: "mascotinhos-bot",
    model: openai("gpt-5.4-mini"),
    tools: allTools,
    stopWhen: stepCountIs(5),
    experimental_telemetry: {
      isEnabled: true,
      functionId: "conversation-agent",
      recordInputs: true,
      recordOutputs: true,
    },
    experimental_context: {
      orderId: order.id,
      photoData: photoData ?? [],
    },
  });

  console.log(JSON.stringify({
    level: "info", event: "agent_generate_start",
    orderId: order.id, historyLen: history.length,
    state: order.conversationState, service: "bot-engine",
  }));

  try {
    const result = await agent.generate({
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
    });

    console.log(JSON.stringify({
      level: "info", event: "agent_generate_done",
      orderId: order.id, textLen: result.text?.length ?? 0, service: "bot-engine",
    }));

    return result.text;
  } catch (err) {
    console.log(JSON.stringify({
      level: "error", event: "agent_generate_failed",
      orderId: order.id, error: err instanceof Error ? err.message : String(err),
      cause: err instanceof Error ? serializeCause(err.cause) : undefined,
      service: "bot-engine",
    }));
    throw err;
  }
}
