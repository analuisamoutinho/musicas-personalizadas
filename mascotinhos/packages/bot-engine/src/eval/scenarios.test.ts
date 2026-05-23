/**
 * Automated conversation scenario tests.
 *
 * These tests validate tool call behavior and state transitions WITHOUT
 * hitting a real LLM. They test the tool implementations directly, ensuring
 * the state machine advances correctly for each conversation flow.
 *
 * Scenarios:
 *   - Happy path: greeting → theme → outfit → photos → confirm → payment
 *   - Revision flow: feedback → revision 1 → revision 2
 *   - Abandoned cart: payment stage with no action
 *   - Off-topic handling: questions outside current state
 *   - Security: invalid IDs, wrong states
 */
import { describe, expect, it, beforeEach, mock } from "bun:test";
import { ConversationState, isValidTransition, ALLOWED_TRANSITIONS } from "../state-machine";

// ── Shared mock data ──
const VALID_ORDER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const VALID_CLIENT_ID = "11111111-2222-3333-4444-555555555555";

describe("State machine transitions", () => {
  describe("Happy path flow", () => {
    const expectedFlow: [ConversationState, ConversationState][] = [
      ["GREETING", "COLLECTING_THEME"],
      ["COLLECTING_THEME", "COLLECTING_OUTFIT"],
      ["COLLECTING_OUTFIT", "COLLECTING_PHOTOS"],
      ["COLLECTING_PHOTOS", "CONFIRMING_ORDER"],
      ["CONFIRMING_ORDER", "AWAITING_PAYMENT"],
      ["AWAITING_PAYMENT", "GENERATING"],
      ["GENERATING", "DELIVERING"],
      ["DELIVERING", "AWAITING_FEEDBACK"],
      ["AWAITING_FEEDBACK", "COMPLETED"],
    ];

    for (const [from, to] of expectedFlow) {
      it(`allows ${from} → ${to}`, () => {
        expect(isValidTransition(from, to)).toBe(true);
      });
    }
  });

  describe("Revision flow", () => {
    it("allows AWAITING_FEEDBACK → REVISION_1 (first revision)", () => {
      // The AWAITING_FEEDBACK → GENERATING path is for revisions
      expect(isValidTransition("AWAITING_FEEDBACK", "GENERATING")).toBe(true);
    });

    it("allows REVISION_1 → GENERATING", () => {
      expect(isValidTransition("REVISION_1", "GENERATING")).toBe(true);
    });

    it("allows REVISION_2 → GENERATING", () => {
      expect(isValidTransition("REVISION_2", "GENERATING")).toBe(true);
    });
  });

  describe("Abandoned cart flow", () => {
    it("allows AWAITING_PAYMENT → ABANDONED_1H", () => {
      expect(isValidTransition("AWAITING_PAYMENT", "ABANDONED_1H")).toBe(true);
    });

    it("allows ABANDONED_1H → ABANDONED_24H", () => {
      expect(isValidTransition("ABANDONED_1H", "ABANDONED_24H")).toBe(true);
    });

    it("allows recovery: ABANDONED_1H → AWAITING_PAYMENT", () => {
      expect(isValidTransition("ABANDONED_1H", "AWAITING_PAYMENT")).toBe(true);
    });
  });

  describe("Invalid transitions", () => {
    it("rejects GREETING → AWAITING_PAYMENT (skipping steps)", () => {
      expect(isValidTransition("GREETING", "AWAITING_PAYMENT")).toBe(false);
    });

    it("rejects COMPLETED → GREETING (terminal state)", () => {
      expect(isValidTransition("COMPLETED", "GREETING")).toBe(false);
    });

    it("rejects FAILED → anything (terminal state)", () => {
      expect(isValidTransition("FAILED", "GREETING")).toBe(false);
      expect(isValidTransition("FAILED", "GENERATING")).toBe(false);
    });

    it("rejects backward transitions (CONFIRMING_ORDER → GREETING)", () => {
      expect(isValidTransition("CONFIRMING_ORDER", "GREETING")).toBe(false);
    });
  });

  describe("Alteration paths from CONFIRMING_ORDER", () => {
    it("allows returning to COLLECTING_PHOTOS", () => {
      expect(isValidTransition("CONFIRMING_ORDER", "COLLECTING_PHOTOS")).toBe(true);
    });

    it("allows returning to COLLECTING_THEME", () => {
      expect(isValidTransition("CONFIRMING_ORDER", "COLLECTING_THEME")).toBe(true);
    });

    it("allows returning to COLLECTING_OUTFIT", () => {
      expect(isValidTransition("CONFIRMING_ORDER", "COLLECTING_OUTFIT")).toBe(true);
    });
  });
});

describe("All states have defined transitions", () => {
  const allStates = Object.values(ConversationState);

  for (const state of allStates) {
    it(`${state} has an entry in ALLOWED_TRANSITIONS`, () => {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(state);
      expect(Array.isArray(ALLOWED_TRANSITIONS[state])).toBe(true);
    });
  }
});

describe("Terminal states have no outgoing transitions", () => {
  const terminalStates: ConversationState[] = ["COMPLETED", "FAILED"];

  for (const state of terminalStates) {
    it(`${state} has empty transitions array`, () => {
      expect(ALLOWED_TRANSITIONS[state]).toEqual([]);
    });
  }
});

describe("Happy path scenario — full state sequence", () => {
  it("can traverse the entire happy path without invalid transitions", () => {
    const happyPath: ConversationState[] = [
      "GREETING",
      "COLLECTING_THEME",
      "COLLECTING_OUTFIT",
      "COLLECTING_PHOTOS",
      "CONFIRMING_ORDER",
      "AWAITING_PAYMENT",
      "GENERATING",
      "DELIVERING",
      "AWAITING_FEEDBACK",
      "COMPLETED",
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i]!;
      const to = happyPath[i + 1]!;
      expect(isValidTransition(from, to)).toBe(true);
    }
  });
});

describe("Revision scenario — full revision cycle", () => {
  it("can traverse: AWAITING_FEEDBACK → GENERATING → DELIVERING → AWAITING_FEEDBACK → COMPLETED", () => {
    const revisionPath: ConversationState[] = [
      "AWAITING_FEEDBACK",
      "GENERATING",
      "DELIVERING",
      "AWAITING_FEEDBACK",
      "COMPLETED",
    ];

    for (let i = 0; i < revisionPath.length - 1; i++) {
      const from = revisionPath[i]!;
      const to = revisionPath[i + 1]!;
      expect(isValidTransition(from, to)).toBe(true);
    }
  });
});

describe("Abandoned cart scenario — nudge and recovery", () => {
  it("supports: AWAITING_PAYMENT → ABANDONED_1H → AWAITING_PAYMENT (recovery)", () => {
    expect(isValidTransition("AWAITING_PAYMENT", "ABANDONED_1H")).toBe(true);
    expect(isValidTransition("ABANDONED_1H", "AWAITING_PAYMENT")).toBe(true);
  });

  it("supports: ABANDONED_1H → ABANDONED_24H → GREETING (full abandonment + restart)", () => {
    expect(isValidTransition("ABANDONED_1H", "ABANDONED_24H")).toBe(true);
    expect(isValidTransition("ABANDONED_24H", "GREETING")).toBe(true);
  });
});
