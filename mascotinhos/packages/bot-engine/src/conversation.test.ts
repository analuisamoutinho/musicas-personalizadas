import { describe, expect, it, mock, beforeEach } from "bun:test";

// Mock Prisma BEFORE importing the module under test
const mockFindFirst = mock(() => Promise.resolve(null));
const mockCreate = mock(() =>
  Promise.resolve({
    id: "order-1",
    clientId: "client-1",
    conversationState: "GREETING",
    client: { id: "client-1", whatsappSenderId: "5511999999999" },
  }),
);
const mockUpdateMany = mock(() => Promise.resolve({ count: 1 }));
const mockUpsert = mock(() =>
  Promise.resolve({ id: "client-1", whatsappSenderId: "5511999999999" }),
);

mock.module("@mascotinhos/db", () => ({
  default: {
    order: {
      findFirst: mockFindFirst,
      create: mockCreate,
      updateMany: mockUpdateMany,
    },
    client: { upsert: mockUpsert },
  },
}));

const { loadActiveOrder, findOrCreateClient, createOrder, updateOrderState } =
  await import("./conversation");

describe("loadActiveOrder", () => {
  beforeEach(() => {
    mockFindFirst.mockClear();
  });

  it("returns null when no active order exists", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const result = await loadActiveOrder("5511999999999");
    expect(result).toBeNull();
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  it("queries with terminal states excluded", async () => {
    await loadActiveOrder("5511999999999");
    const call = mockFindFirst.mock.calls[0]![0] as Record<string, unknown>;
    const where = call.where as Record<string, unknown>;
    const stateFilter = where.conversationState as Record<string, string[]>;
    expect(stateFilter.notIn).toContain("COMPLETED");
    expect(stateFilter.notIn).toContain("FAILED");
    expect(stateFilter.notIn).toContain("ABANDONED_24H");
    // ABANDONED_1H is NOT excluded — it's a resumable state
    expect(stateFilter.notIn).not.toContain("ABANDONED_1H");
  });

  it("returns active order when one exists", async () => {
    const activeOrder = {
      id: "order-2",
      conversationState: "COLLECTING_PHOTOS",
      client: { id: "client-1", whatsappSenderId: "5511999999999" },
    };
    mockFindFirst.mockResolvedValueOnce(activeOrder);
    const result = await loadActiveOrder("5511999999999");
    expect(result).toEqual(activeOrder);
  });
});

describe("findOrCreateClient", () => {
  beforeEach(() => {
    mockUpsert.mockClear();
  });

  it("upserts client by whatsappSenderId", async () => {
    const result = await findOrCreateClient("5511999999999");
    expect(result.id).toBe("client-1");
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.where).toEqual({ whatsappSenderId: "5511999999999" });
    expect(call.create).toEqual({ whatsappSenderId: "5511999999999" });
    expect(call.update).toEqual({});
  });
});

describe("createOrder", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it("creates order in GREETING state", async () => {
    const result = await createOrder("client-1");
    expect(result.conversationState).toBe("GREETING");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    const data = call.data as Record<string, unknown>;
    expect(data.clientId).toBe("client-1");
    expect(data.conversationState).toBe("GREETING");
  });
});

describe("updateOrderState", () => {
  beforeEach(() => {
    mockUpdateMany.mockClear();
  });

  it("returns true on successful update", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    const result = await updateOrderState("order-1", "GREETING", "COLLECTING_PHOTOS");
    expect(result).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("returns false on race condition (0 rows updated)", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 0 });
    const result = await updateOrderState("order-1", "GREETING", "COLLECTING_PHOTOS");
    expect(result).toBe(false);
  });

  it("throws on invalid transition without hitting DB", async () => {
    expect(() => updateOrderState("order-1", "COMPLETED", "GREETING")).toThrow(
      "Invalid state transition: COMPLETED -> GREETING",
    );
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("uses optimistic concurrency with fromState in WHERE", async () => {
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    await updateOrderState("order-1", "GREETING", "COLLECTING_PHOTOS");
    const call = mockUpdateMany.mock.calls[0]![0] as Record<string, unknown>;
    const where = call.where as Record<string, unknown>;
    expect(where.id).toBe("order-1");
    expect(where.conversationState).toBe("GREETING");
  });
});
