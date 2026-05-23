/**
 * Conversation state enum — mirrors Prisma schema ConversationState exactly.
 * Defined locally to avoid import path issues with Prisma generated client.
 */
export const ConversationState = {
  GREETING: "GREETING",
  COLLECTING_PHOTOS: "COLLECTING_PHOTOS",
  COLLECTING_THEME: "COLLECTING_THEME",
  COLLECTING_OUTFIT: "COLLECTING_OUTFIT",
  CONFIRMING_ORDER: "CONFIRMING_ORDER",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  ABANDONED_1H: "ABANDONED_1H",
  ABANDONED_24H: "ABANDONED_24H",
  GENERATING: "GENERATING",
  DELIVERING: "DELIVERING",
  AWAITING_FEEDBACK: "AWAITING_FEEDBACK",
  REVISION_1: "REVISION_1",
  REVISION_2: "REVISION_2",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ConversationState = (typeof ConversationState)[keyof typeof ConversationState];

/** Valid state transitions for the conversation flow. */
export const ALLOWED_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  GREETING: ["COLLECTING_THEME", "COLLECTING_PHOTOS"],
  COLLECTING_PHOTOS: ["COLLECTING_THEME", "CONFIRMING_ORDER"],
  COLLECTING_THEME: ["COLLECTING_OUTFIT"],
  COLLECTING_OUTFIT: ["COLLECTING_PHOTOS", "CONFIRMING_ORDER"],
  CONFIRMING_ORDER: ["AWAITING_PAYMENT", "COLLECTING_PHOTOS", "COLLECTING_THEME", "COLLECTING_OUTFIT"],
  AWAITING_PAYMENT: ["GENERATING", "ABANDONED_1H"],
  ABANDONED_1H: ["AWAITING_PAYMENT", "ABANDONED_24H"],
  ABANDONED_24H: ["GREETING"],
  GENERATING: ["DELIVERING", "FAILED"],
  DELIVERING: ["AWAITING_FEEDBACK"],
  AWAITING_FEEDBACK: ["REVISION_1", "REVISION_2", "COMPLETED"],
  REVISION_1: ["GENERATING"],
  REVISION_2: ["GENERATING"],
  COMPLETED: [],
  FAILED: [],
};

/** Check if a state transition is allowed. */
export function isValidTransition(from: ConversationState, to: ConversationState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
