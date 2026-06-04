/**
 * Custom Promptfoo provider that wraps the Músicas Personalizadas bot agent.
 *
 * Promptfoo calls `callApi()` for each test case. We build the system prompt
 * from the scenario's order context, call the real AI agent (via processMessage),
 * and return the agent's text response for assertion.
 *
 * Tool calls are mocked to avoid hitting real databases / payment APIs.
 * The AI model call is real — this tests prompt quality, not tool logic.
 */
import { buildSystemPrompt } from "../prompts/system-prompt";
import type { ConversationState } from "../state-machine";

/** Order context passed via promptfoo vars. */
export interface EvalOrderContext {
  id: string;
  clientId: string;
  conversationState: ConversationState;
  clientName?: string | null;
  theme?: string | null;
  outfitDescription?: string | null;
  extraRequests?: string | null;
  photosCount?: number;
  preFillText?: string | null;
  hasConsent: boolean;
}

/** Minimal history entry. */
interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Build the prompt that promptfoo sends to the provider.
 * Promptfoo passes `vars` from each test case — we use them to build context.
 */
export function buildEvalPrompt(vars: Record<string, unknown>): {
  systemPrompt: string;
  userMessage: string;
  history: HistoryMessage[];
} {
  const order: EvalOrderContext = {
    id: (vars.orderId as string) ?? "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    clientId: (vars.clientId as string) ?? "11111111-2222-3333-4444-555555555555",
    conversationState: (vars.state as ConversationState) ?? "GREETING",
    clientName: (vars.clientName as string) ?? null,
    theme: (vars.theme as string) ?? null,
    outfitDescription: (vars.outfitDescription as string) ?? null,
    extraRequests: (vars.extraRequests as string) ?? null,
    photosCount: (vars.photosCount as number) ?? 0,
    preFillText: (vars.preFillText as string) ?? null,
    hasConsent: (vars.hasConsent as boolean) ?? false,
  };

  const systemPrompt = buildSystemPrompt(order);
  const userMessage = (vars.userMessage as string) ?? "";
  const history = (vars.history as HistoryMessage[]) ?? [];

  return { systemPrompt, userMessage, history };
}
