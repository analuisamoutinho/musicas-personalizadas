import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockList = mock(() =>
  Promise.resolve({
    data: [{ name: 'photo.jpg' }, { name: 'photo2.jpg' }],
    error: null,
  }),
);
const mockRemove = mock(() => Promise.resolve({ error: null }));
const mockFrom = mock(() => ({ list: mockList, remove: mockRemove }));

mock.module('./client', () => ({
  storage: { from: mockFrom },
}));

import { deleteReferences, deleteExpiredReferences } from './cleanup';

describe('deleteReferences', () => {
  beforeEach(() => {
    mockList.mockClear();
    mockRemove.mockClear();
    mockFrom.mockClear();
  });

  it('lists files under orderId in references bucket and removes them with full paths', async () => {
    await deleteReferences('order-1');
    expect(mockFrom).toHaveBeenCalledWith('references');
    expect(mockList).toHaveBeenCalledWith('order-1', { limit: 1000 });
    expect(mockRemove).toHaveBeenCalledWith(['order-1/photo.jpg', 'order-1/photo2.jpg']);
  });

  it('returns early (idempotent) when file list is empty', async () => {
    mockList.mockResolvedValueOnce({ data: [], error: null });
    await deleteReferences('order-1');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('returns early when data is null', async () => {
    mockList.mockResolvedValueOnce({ data: null, error: null } as never);
    await deleteReferences('order-1');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('throws when list returns an error', async () => {
    mockList.mockResolvedValueOnce({ data: null, error: new Error('list failed') } as never);
    await expect(deleteReferences('order-1')).rejects.toThrow('list failed');
  });

  it('throws when remove returns an error', async () => {
    mockRemove.mockResolvedValueOnce({ error: new Error('delete failed') } as never);
    await expect(deleteReferences('order-1')).rejects.toThrow('delete failed');
  });
});

describe('deleteExpiredReferences', () => {
  beforeEach(() => {
    mockList.mockClear();
    mockRemove.mockClear();
    mockFrom.mockClear();
  });

  it('returns zero counts for empty input', async () => {
    const result = await deleteExpiredReferences([]);
    expect(result.deletedCount).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(result.errors).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deletes photos for multiple orders and returns correct counts', async () => {
    const result = await deleteExpiredReferences(['order-1', 'order-2']);
    expect(result.deletedCount).toBe(2);
    expect(result.errorCount).toBe(0);
    expect(result.errors).toEqual([]);
    // deleteReferences called once per order: 2 orders × (list + remove) = 4 calls
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });

  it('continues processing remaining orders when one fails (error isolation)', async () => {
    // First order: list fails; second order: succeeds
    mockList
      .mockResolvedValueOnce({ data: null, error: new Error('list failed') } as never)
      .mockResolvedValueOnce({ data: [{ name: 'photo.jpg' }], error: null } as never);

    const result = await deleteExpiredReferences(['order-fail', 'order-ok']);
    expect(result.deletedCount).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    const firstError = result.errors[0];
    expect(firstError?.orderId).toBe('order-fail');
    expect(firstError?.message).toBe('list failed');
  });

  it('processes all orders across multiple chunks (>10 orders)', async () => {
    // 12 orders — spans 2 chunks (10 + 2)
    const orderIds = Array.from({ length: 12 }, (_, i) => `order-${i}`);
    const result = await deleteExpiredReferences(orderIds);
    expect(result.deletedCount).toBe(12);
    expect(result.errorCount).toBe(0);
    expect(result.errors).toEqual([]);
    // 12 orders × (list + remove) = 24 storage calls
    expect(mockFrom).toHaveBeenCalledTimes(24);
  });

  it('errors in one chunk do not prevent subsequent chunks from running', async () => {
    // 11 orders: order-0 fails (chunk 1), order-10 succeeds (chunk 2)
    // Failure is injected as the very first mockList call; all others succeed.
    mockList.mockResolvedValueOnce({ data: null, error: new Error('chunk1 fail') } as never);

    const orderIds = Array.from({ length: 11 }, (_, i) => `order-${i}`);
    const result = await deleteExpiredReferences(orderIds);

    // 10 succeeded, 1 failed
    expect(result.deletedCount).toBe(10);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0]?.orderId).toBe('order-0');
    expect(result.errors[0]?.message).toBe('chunk1 fail');
    // All 11 orders were attempted: 10 × (list + remove) + 1 × list-only = 21 calls
    expect(mockFrom).toHaveBeenCalledTimes(21);
  });
});
