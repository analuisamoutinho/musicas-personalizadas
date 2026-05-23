// IMPORTANT: mock.module() MUST be called BEFORE the module under test is imported (bun:test requirement)
import { mock, describe, expect, it, beforeEach } from "bun:test";

const mockFindMany = mock(() => Promise.resolve([]));

mock.module("@mascotinhos/db", () => ({
  default: {
    styleTemplate: { findMany: mockFindMany },
  },
}));

// Dynamic import AFTER mock setup
const { getGreetingContext } = await import("./get-greeting-context");

describe("getGreetingContext tool", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it("returns success: true and empty portfolioImages on happy path", async () => {
    const mockStyles = [
      { id: "1", name: "Disney 3D", slug: "disney-3d" },
      { id: "2", name: "Anime", slug: "anime" },
      { id: "3", name: "Aquarela", slug: "aquarela" },
    ];
    mockFindMany.mockImplementation(() => Promise.resolve(mockStyles));

    const result = await getGreetingContext.execute(
      { orderId: "order-test-1" },
      { toolCallId: "call-1", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    expect(result.topStyles).toEqual(mockStyles);
    expect(result.portfolioImages).toHaveLength(0);
  });

  it("returns success: true and topStyles: [] when no active style templates exist (no crash)", async () => {
    mockFindMany.mockImplementation(() => Promise.resolve([]));

    const result = await getGreetingContext.execute(
      { orderId: "order-test-empty" },
      { toolCallId: "call-2", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    expect(result.topStyles).toEqual([]);
    expect(result.portfolioImages).toHaveLength(0);
  });

  it("calls prisma.styleTemplate.findMany with correct query params", async () => {
    mockFindMany.mockImplementation(() => Promise.resolve([]));

    await getGreetingContext.execute(
      { orderId: "order-test-query" },
      { toolCallId: "call-3", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { popularity: "desc" },
      take: 3,
      select: { id: true, name: true, slug: true },
    });
  });

  it("returns empty portfolio images array (no fake URLs)", async () => {
    mockFindMany.mockImplementation(() => Promise.resolve([]));

    const result = await getGreetingContext.execute(
      { orderId: "order-test-images" },
      { toolCallId: "call-4", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.portfolioImages).toEqual([]);
  });

  it("returns success: true with topStyles: [] when DB throws (graceful degradation, AC#6)", async () => {
    mockFindMany.mockImplementation(() => Promise.reject(new Error("DB connection refused")));

    const result = await getGreetingContext.execute(
      { orderId: "order-test-db-error" },
      { toolCallId: "call-5", messages: [], abortSignal: undefined as unknown as AbortSignal },
    );

    expect(result.success).toBe(true);
    expect(result.topStyles).toEqual([]);
    expect(result.portfolioImages).toHaveLength(0);
  });
});
