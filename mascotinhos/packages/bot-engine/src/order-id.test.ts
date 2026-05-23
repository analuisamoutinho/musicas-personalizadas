import { describe, it, expect } from "bun:test";
import { ORDER_ID_PATTERN } from "./order-id";

describe("ORDER_ID_PATTERN", () => {
  // Valid CUID v1 examples (start with 'c', 24 lowercase alphanumeric chars follow)
  it("matches a valid CUID v1", () => {
    expect(ORDER_ID_PATTERN.test("clh7x3kjx0000mcv7qxf9y3al")).toBe(true);
  });

  it("matches a CUID v1 with all zeros after 'c'", () => {
    expect(ORDER_ID_PATTERN.test("c000000000000000000000000")).toBe(true);
  });

  it("matches CUID-shaped test fixture strings", () => {
    expect(ORDER_ID_PATTERN.test("ctest00000000000000000001")).toBe(true);
    expect(ORDER_ID_PATTERN.test("ctest00000000000000000002")).toBe(true);
    expect(ORDER_ID_PATTERN.test("ctest00000000000000000003")).toBe(true);
    expect(ORDER_ID_PATTERN.test("ctest00000000000000000004")).toBe(true);
  });

  // Invalid: UUID format (old incorrect pattern)
  it("rejects a UUID (old pattern — was never valid for CUID IDs)", () => {
    expect(ORDER_ID_PATTERN.test("22222222-2222-2222-2222-222222222222")).toBe(false);
    expect(ORDER_ID_PATTERN.test("33333333-3333-3333-3333-333333333333")).toBe(false);
    expect(ORDER_ID_PATTERN.test("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(ORDER_ID_PATTERN.test("")).toBe(false);
  });

  it("rejects a string that does not start with 'c'", () => {
    expect(ORDER_ID_PATTERN.test("alh7x3kjx0000mcv7qxf9y3al")).toBe(false);
    expect(ORDER_ID_PATTERN.test("1lh7x3kjx0000mcv7qxf9y3al")).toBe(false);
  });

  it("rejects a CUID that is too short (< 25 chars)", () => {
    // 24 chars total: 'c' + 23 chars
    expect(ORDER_ID_PATTERN.test("clh7x3kjx0000mcv7qxf9y3")).toBe(false);
  });

  it("rejects a CUID that is too long (> 25 chars)", () => {
    // 26 chars total
    expect(ORDER_ID_PATTERN.test("clh7x3kjx0000mcv7qxf9y3alx")).toBe(false);
  });

  it("rejects strings with uppercase letters", () => {
    expect(ORDER_ID_PATTERN.test("CLH7X3KJX0000MCV7QXF9Y3AL")).toBe(false);
  });

  it("rejects strings with special characters", () => {
    expect(ORDER_ID_PATTERN.test("c!h7x3kjx0000mcv7qxf9y3al")).toBe(false);
    expect(ORDER_ID_PATTERN.test("not-a-uuid")).toBe(false);
  });

  it("rejects arbitrary invalid strings", () => {
    expect(ORDER_ID_PATTERN.test("not-a-uuid")).toBe(false);
    expect(ORDER_ID_PATTERN.test("invalid")).toBe(false);
    expect(ORDER_ID_PATTERN.test("12345")).toBe(false);
  });
});
