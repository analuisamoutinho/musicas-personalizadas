import { describe, expect, it } from "bun:test";
import { allTools, collectPhotos, selectStyle, confirmOrder, generatePayment, enqueueGeneration, deliverImage, handleRevision, handleApproval, getGreetingContext, collectOutfit, captureConsent } from "./index";

describe("tool stubs", () => {
  it("exports all 11 tools", () => {
    expect(Object.keys(allTools)).toHaveLength(11);
  });

  it("has correct tool names", () => {
    const names = Object.keys(allTools);
    expect(names).toContain("collectPhotos");
    expect(names).toContain("selectStyle");
    expect(names).toContain("confirmOrder");
    expect(names).toContain("generatePayment");
    expect(names).toContain("enqueueGeneration");
    expect(names).toContain("deliverImage");
    expect(names).toContain("handleRevision");
    expect(names).toContain("handleApproval");
    expect(names).toContain("getGreetingContext");
    expect(names).toContain("collectOutfit");
    expect(names).toContain("captureConsent");
  });

  it("each tool has execute function", () => {
    for (const [name, t] of Object.entries(allTools)) {
      expect(t).toBeDefined();
      expect(t.execute).toBeDefined();
      expect(typeof t.execute).toBe("function");
    }
  });

  it("collectPhotos returns failure for empty photoUrls", async () => {
    const result = await collectPhotos.execute({ photoUrls: [], orderId: "test" }, { toolCallId: "test", messages: [], abortSignal: undefined as unknown as AbortSignal });
    expect(result).toMatchObject({ success: false });
  });
});
