import { describe, expect, it, mock, beforeEach } from "bun:test";

// --- Mock @mascotinhos/storage ---
const mockUploadReference = mock(async (_orderId: string, filename: string) =>
  `references/order-1/${filename}`,
);
mock.module("@mascotinhos/storage", () => ({
  uploadReference: mockUploadReference,
}));

// --- Mock @mascotinhos/db ---
const mockFindUnique = mock(() =>
  Promise.resolve({
    id: "order-1",
    photosUrls: [],
    conversationState: "COLLECTING_PHOTOS",
    theme: null,
    outfitDescription: null,
  }),
);
const mockUpdate = mock((_args: unknown) =>
  Promise.resolve({ id: "order-1", photosUrls: ["references/order-1/photo.jpg"] }),
);
mock.module("@mascotinhos/db", () => ({
  default: {
    order: { findUnique: mockFindUnique, update: mockUpdate },
  },
}));

// --- Mock ../conversation (updateOrderState) ---
const mockUpdateOrderState = mock(() => Promise.resolve(true));
mock.module("../conversation", () => ({
  updateOrderState: mockUpdateOrderState,
}));

import { collectPhotos } from "./collect-photos";

function makeCtx(photoData: Array<{ buffer: Buffer; mimeType: string }>) {
  return {
    toolCallId: "test",
    messages: [],
    abortSignal: new AbortController().signal,
    experimental_context: { photoData },
  };
}

describe("collectPhotos", () => {
  beforeEach(() => {
    mockUploadReference.mockClear();
    mockFindUnique.mockClear();
    mockUpdate.mockClear();
    mockUpdateOrderState.mockClear();
  });

  it("returns failure for empty photoData", async () => {
    const result = await collectPhotos.execute({ orderId: "order-1" }, makeCtx([]));
    expect(result).toMatchObject({ success: false });
    expect(mockUploadReference).not.toHaveBeenCalled();
  });

  it("uploads photo, updates DB, and transitions state to COLLECTING_THEME", async () => {
    const buffer = Buffer.alloc(10_000);
    const result = await collectPhotos.execute(
      { orderId: "order-1" },
      makeCtx([{ buffer, mimeType: "image/jpeg" }]),
    );

    expect(result).toMatchObject({ success: true, photosStored: 1 });
    expect(mockUploadReference).toHaveBeenCalledWith(
      "order-1",
      expect.stringMatching(/^photo-\d+-[a-z0-9]+\.jpg$/),
      buffer,
      "image/jpeg",
    );
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdateOrderState).toHaveBeenCalledWith(
      "order-1",
      "COLLECTING_PHOTOS",
      "COLLECTING_THEME",
    );
  });

  it("transitions to CONFIRMING_ORDER when theme and outfit already set", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "order-1",
      photosUrls: [],
      conversationState: "COLLECTING_PHOTOS",
      theme: "Disney",
      outfitDescription: "Vestido azul",
    });
    const result = await collectPhotos.execute(
      { orderId: "order-1" },
      makeCtx([{ buffer: Buffer.alloc(10_000), mimeType: "image/jpeg" }]),
    );

    expect(result).toMatchObject({ success: true });
    expect(mockUpdateOrderState).toHaveBeenCalledWith(
      "order-1",
      "COLLECTING_PHOTOS",
      "CONFIRMING_ORDER",
    );
  });

  it("returns failure when order is already at MAX_PHOTOS (3)", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "order-1",
      photosUrls: ["p1", "p2", "p3"],
      conversationState: "COLLECTING_PHOTOS",
      theme: null,
      outfitDescription: null,
    });

    const result = await collectPhotos.execute(
      { orderId: "order-1" },
      makeCtx([{ buffer: Buffer.alloc(10_000), mimeType: "image/jpeg" }]),
    );

    expect(result).toMatchObject({ success: false });
    expect(mockUploadReference).not.toHaveBeenCalled();
  });

  it("caps at MAX_PHOTOS when two buffers arrive but only one slot remains", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "order-1",
      photosUrls: ["p1", "p2"],
      conversationState: "COLLECTING_PHOTOS",
      theme: null,
      outfitDescription: null,
    });
    mockUpdate.mockResolvedValueOnce({
      id: "order-1",
      photosUrls: ["p1", "p2", "p3"],
    });

    const result = await collectPhotos.execute(
      { orderId: "order-1" },
      makeCtx([
        { buffer: Buffer.alloc(10_000), mimeType: "image/jpeg" },
        { buffer: Buffer.alloc(10_000), mimeType: "image/jpeg" },
      ]),
    );

    expect(result).toMatchObject({ success: true, photosStored: 1 });
    expect(mockUploadReference).toHaveBeenCalledTimes(1);
  });

  it("includes quality warning for small photo but still succeeds", async () => {
    const result = await collectPhotos.execute(
      { orderId: "order-1" },
      makeCtx([{ buffer: Buffer.alloc(1_000), mimeType: "image/jpeg" }]),
    );

    expect(result).toMatchObject({ success: true, photosStored: 1 });
    expect((result as { qualityWarnings: string[] }).qualityWarnings).toHaveLength(1);
  });

  it("returns failure when upload rejects for all photos", async () => {
    mockUploadReference.mockRejectedValueOnce(new Error("Storage unavailable"));

    const result = await collectPhotos.execute(
      { orderId: "order-1" },
      makeCtx([{ buffer: Buffer.alloc(10_000), mimeType: "image/jpeg" }]),
    );

    expect(result).toMatchObject({ success: false });
  });

  it("uses .png extension for image/png mimeType", async () => {
    const result = await collectPhotos.execute(
      { orderId: "order-1" },
      makeCtx([{ buffer: Buffer.alloc(10_000), mimeType: "image/png" }]),
    );

    expect(result).toMatchObject({ success: true });
    expect(mockUploadReference).toHaveBeenCalledWith(
      "order-1",
      expect.stringMatching(/\.png$/),
      expect.any(Buffer),
      "image/png",
    );
  });
});
