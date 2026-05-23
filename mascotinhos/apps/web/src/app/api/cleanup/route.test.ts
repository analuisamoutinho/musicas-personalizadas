import { mock, beforeEach, describe, it, expect } from "bun:test";

// IMPORTANT: mock.module() BEFORE any module imports
const TEST_ORDER_ID = "clh1234567890abcdefghijk0";
const TEST_ORDER_ID_2 = "clh1234567890abcdefghijk1";

const mockPrismaOrderFindMany = mock(() => Promise.resolve([]));
const mockPrismaOrderUpdateMany = mock(() => Promise.resolve({ count: 0 }));

mock.module("@mascotinhos/db", () => ({
  default: {
    order: {
      findMany: mockPrismaOrderFindMany,
      updateMany: mockPrismaOrderUpdateMany,
    },
  },
}));

const mockDeleteExpiredReferences = mock(() =>
  Promise.resolve({ deletedCount: 0, errorCount: 0, errors: [] }),
);

mock.module("@mascotinhos/storage", () => ({
  deleteExpiredReferences: mockDeleteExpiredReferences,
}));

mock.module("@mascotinhos/env/server", () => ({
  env: { CRON_SECRET: "test-secret" },
}));

import { GET, POST } from "./route";

function makeRequest(method: string, authHeader?: string): Request {
  return new Request("http://localhost/api/cleanup", {
    method,
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cleanup", () => {
  beforeEach(() => {
    mockPrismaOrderFindMany.mockClear();
    mockPrismaOrderUpdateMany.mockClear();
    mockDeleteExpiredReferences.mockClear();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest("GET") as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(mockPrismaOrderFindMany).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const res = await GET(makeRequest("GET", "Bearer wrong-secret") as any);
    expect(res.status).toBe(401);
    expect(mockPrismaOrderFindMany).not.toHaveBeenCalled();
  });

  it("returns ok with zero counts when no expired orders", async () => {
    mockPrismaOrderFindMany.mockResolvedValueOnce([]);

    const res = await GET(makeRequest("GET", "Bearer test-secret") as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", deletedCount: 0, errorCount: 0 });
    expect(mockDeleteExpiredReferences).not.toHaveBeenCalled();
  });

  it("deletes expired orders, nulls photosDeleteAt, and returns counts", async () => {
    mockPrismaOrderFindMany.mockResolvedValueOnce([
      { id: TEST_ORDER_ID },
      { id: TEST_ORDER_ID_2 },
    ] as never);
    mockDeleteExpiredReferences.mockResolvedValueOnce({
      deletedCount: 2,
      errorCount: 0,
      errors: [],
    } as never);

    const res = await GET(makeRequest("GET", "Bearer test-secret") as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", deletedCount: 2, errorCount: 0 });

    expect(mockDeleteExpiredReferences).toHaveBeenCalledWith([
      TEST_ORDER_ID,
      TEST_ORDER_ID_2,
    ]);
    expect(mockPrismaOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [TEST_ORDER_ID, TEST_ORDER_ID_2] } },
      data: { photosDeleteAt: null },
    });
  });

  it("only nulls photosDeleteAt for successful orders when some fail", async () => {
    mockPrismaOrderFindMany.mockResolvedValueOnce([
      { id: TEST_ORDER_ID },
      { id: TEST_ORDER_ID_2 },
    ] as never);
    mockDeleteExpiredReferences.mockResolvedValueOnce({
      deletedCount: 1,
      errorCount: 1,
      errors: [{ orderId: TEST_ORDER_ID_2, message: "storage error" }],
    } as never);

    const res = await GET(makeRequest("GET", "Bearer test-secret") as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", deletedCount: 1, errorCount: 1 });

    // Only successful order gets photosDeleteAt nulled
    expect(mockPrismaOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [TEST_ORDER_ID] } },
      data: { photosDeleteAt: null },
    });
  });
});

describe("POST /api/cleanup", () => {
  beforeEach(() => {
    mockPrismaOrderFindMany.mockClear();
    mockPrismaOrderUpdateMany.mockClear();
    mockDeleteExpiredReferences.mockClear();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(makeRequest("POST") as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const res = await POST(makeRequest("POST", "Bearer bad") as any);
    expect(res.status).toBe(401);
  });

  it("runs cleanup on POST with valid CRON_SECRET", async () => {
    mockPrismaOrderFindMany.mockResolvedValueOnce([]);

    const res = await POST(makeRequest("POST", "Bearer test-secret") as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
