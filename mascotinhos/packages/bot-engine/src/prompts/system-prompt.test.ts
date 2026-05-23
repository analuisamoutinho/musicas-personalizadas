import { describe, expect, it } from "bun:test";
import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  const baseOrder = {
    id: "order-1",
    clientId: "client-1",
    conversationState: "GREETING" as const,
    clientName: null,
    theme: null,
    outfitDescription: null,
    extraRequests: null,
    photosCount: 0,
    hasConsent: false,
  };

  it("contains PT-BR personality markers", () => {
    const prompt = buildSystemPrompt(baseOrder);
    // Case-insensitive check for "Português brasileiro"
    expect(prompt.toLowerCase()).toContain("português brasileiro");
    expect(prompt).toContain("emoji");
  });

  it("includes the price R$29,90", () => {
    const prompt = buildSystemPrompt(baseOrder);
    expect(prompt).toContain("R$29,90");
  });

  it("includes current conversation state", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, conversationState: "COLLECTING_PHOTOS" });
    expect(prompt).toContain("COLLECTING_PHOTOS");
  });

  it("includes client name when available", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, clientName: "Ana" });
    expect(prompt).toContain("Ana");
  });

  it("includes out-of-scope handling instructions", () => {
    const prompt = buildSystemPrompt(baseOrder);
    expect(prompt).toContain("fora do fluxo");
    expect(prompt).toContain("retorne");
  });

  it("instructs not to reveal AI identity", () => {
    const prompt = buildSystemPrompt(baseOrder);
    expect(prompt).toContain("Nunca revele ser IA");
  });

  it("contains getGreetingContext instruction when conversationState is GREETING", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, conversationState: "GREETING" });
    expect(prompt).toContain("getGreetingContext");
  });

  it("surfaces preFillText in prompt when set", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, preFillText: "Disney 3D mascotinho" });
    expect(prompt).toContain("Disney 3D mascotinho");
  });

  it("does not include preFillText section when preFillText is null", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, preFillText: null });
    expect(prompt).not.toContain("Mensagem inicial do cliente:");
  });

  it("contains GREETING state specific instructions", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, conversationState: "GREETING" });
    expect(prompt).toContain("### GREETING");
    expect(prompt).toContain("getGreetingContext");
    expect(prompt).toContain("preFillText");
    expect(prompt).toContain("mascotinhos.vercel.app");
  });

  it("does not contain unreplaced template literal {socialProofCount} in system prompt", () => {
    const prompt = buildSystemPrompt(baseOrder);
    expect(prompt).not.toContain("{socialProofCount}");
  });

  it("contains selectStyle instruction when conversationState is COLLECTING_THEME", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, conversationState: "COLLECTING_THEME" });
    expect(prompt).toContain("selectStyle");
    expect(prompt).toContain("### COLLECTING_THEME");
  });

  it("contains collectOutfit instruction when conversationState is COLLECTING_OUTFIT", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, conversationState: "COLLECTING_OUTFIT" });
    expect(prompt).toContain("collectOutfit");
    expect(prompt).toContain("### COLLECTING_OUTFIT");
  });

  it("contains confirmOrder instruction when conversationState is CONFIRMING_ORDER", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, conversationState: "CONFIRMING_ORDER" });
    expect(prompt).toContain("confirmOrder");
    expect(prompt).toContain("### CONFIRMING_ORDER");
  });

  it("contains generatePayment instruction when conversationState is AWAITING_PAYMENT", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, conversationState: "AWAITING_PAYMENT" });
    expect(prompt).toContain("### AWAITING_PAYMENT");
    expect(prompt).toContain("generatePayment");
  });

  it("AWAITING_FEEDBACK block contains handleApproval instruction", () => {
    const prompt = buildSystemPrompt({ ...baseOrder, conversationState: "AWAITING_FEEDBACK" });
    expect(prompt).toContain("### AWAITING_FEEDBACK");
    expect(prompt).toContain("handleApproval");
  });

  it("contains WhatsApp formatting rules", () => {
    const prompt = buildSystemPrompt(baseOrder);
    expect(prompt).toContain("FORMATAÇÃO");
    expect(prompt).toContain("NUNCA use **");
    expect(prompt).toContain("WhatsApp");
  });

  it("contains anti-duplication rules", () => {
    const prompt = buildSystemPrompt(baseOrder);
    expect(prompt).toContain("UMA ÚNICA mensagem");
    expect(prompt).toContain("duplicaria");
  });

  it("instructs to ask about mascotinho outfit, not everyday clothing", () => {
    const prompt = buildSystemPrompt(baseOrder);
    expect(prompt).toContain("MASCOTINHO");
    expect(prompt).toContain("NÃO a roupa da criança");
  });

  it("instructs to use UUID from context for tool calls", () => {
    const prompt = buildSystemPrompt(baseOrder);
    expect(prompt).toContain("UUID");
    expect(prompt).toContain("Nunca invente IDs");
  });
});
