import { describe, expect, it } from "bun:test";
import { ConversationState, ALLOWED_TRANSITIONS, isValidTransition } from "./state-machine";

describe("ConversationState", () => {
  it("has exactly 15 states", () => {
    expect(Object.keys(ConversationState)).toHaveLength(15);
  });

  it("includes all expected states", () => {
    const expected = [
      "GREETING", "COLLECTING_PHOTOS", "COLLECTING_THEME", "COLLECTING_OUTFIT",
      "CONFIRMING_ORDER", "AWAITING_PAYMENT", "ABANDONED_1H", "ABANDONED_24H",
      "GENERATING", "DELIVERING", "AWAITING_FEEDBACK", "REVISION_1", "REVISION_2",
      "COMPLETED", "FAILED",
    ];
    for (const state of expected) {
      expect(ConversationState).toHaveProperty(state);
    }
  });
});

describe("ALLOWED_TRANSITIONS", () => {
  it("defines transitions for all states", () => {
    for (const state of Object.values(ConversationState)) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(state);
    }
  });

  it("has terminal states with no transitions", () => {
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.FAILED).toEqual([]);
  });

  it("allows ABANDONED_24H to restart via GREETING (re-engagement)", () => {
    expect(ALLOWED_TRANSITIONS.ABANDONED_24H).toContain("GREETING");
  });

  it("allows GREETING to COLLECTING_PHOTOS and COLLECTING_THEME", () => {
    expect(ALLOWED_TRANSITIONS.GREETING).toContain("COLLECTING_PHOTOS");
    expect(ALLOWED_TRANSITIONS.GREETING).toContain("COLLECTING_THEME");
  });

  it("allows CONFIRMING_ORDER to go back to collection states", () => {
    expect(ALLOWED_TRANSITIONS.CONFIRMING_ORDER).toContain("COLLECTING_PHOTOS");
    expect(ALLOWED_TRANSITIONS.CONFIRMING_ORDER).toContain("COLLECTING_THEME");
    expect(ALLOWED_TRANSITIONS.CONFIRMING_ORDER).toContain("COLLECTING_OUTFIT");
    expect(ALLOWED_TRANSITIONS.CONFIRMING_ORDER).toContain("AWAITING_PAYMENT");
  });

  it("allows AWAITING_FEEDBACK to REVISION_1, REVISION_2, and COMPLETED (no direct GENERATING)", () => {
    expect(ALLOWED_TRANSITIONS.AWAITING_FEEDBACK).toContain("REVISION_1");
    expect(ALLOWED_TRANSITIONS.AWAITING_FEEDBACK).toContain("REVISION_2");
    expect(ALLOWED_TRANSITIONS.AWAITING_FEEDBACK).toContain("COMPLETED");
    // AWAITING_FEEDBACK must NOT transition directly to GENERATING — revisions must pass
    // through REVISION_1 or REVISION_2 first so the state machine enforces the 2-revision cap.
    expect(ALLOWED_TRANSITIONS.AWAITING_FEEDBACK).not.toContain("GENERATING");
  });
});

describe("isValidTransition", () => {
  it("allows valid transitions", () => {
    expect(isValidTransition("GREETING", "COLLECTING_PHOTOS")).toBe(true);
    expect(isValidTransition("COLLECTING_PHOTOS", "COLLECTING_THEME")).toBe(true);
    expect(isValidTransition("GENERATING", "DELIVERING")).toBe(true);
    expect(isValidTransition("REVISION_1", "GENERATING")).toBe(true);
    expect(isValidTransition("REVISION_2", "GENERATING")).toBe(true);
    expect(isValidTransition("AWAITING_FEEDBACK", "REVISION_1")).toBe(true);
    expect(isValidTransition("AWAITING_FEEDBACK", "REVISION_2")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(isValidTransition("COMPLETED", "GREETING")).toBe(false);
    expect(isValidTransition("GREETING", "COMPLETED")).toBe(false);
    expect(isValidTransition("FAILED", "GENERATING")).toBe(false);
    expect(isValidTransition("COLLECTING_PHOTOS", "AWAITING_PAYMENT")).toBe(false);
    // AWAITING_FEEDBACK must not bypass REVISION_N states to reach GENERATING directly
    expect(isValidTransition("AWAITING_FEEDBACK", "GENERATING")).toBe(false);
  });

  it("rejects transitions from terminal states", () => {
    expect(isValidTransition("COMPLETED", "GREETING")).toBe(false);
    expect(isValidTransition("FAILED", "GREETING")).toBe(false);
    expect(isValidTransition("ABANDONED_24H", "GREETING")).toBe(true);
  });
});
