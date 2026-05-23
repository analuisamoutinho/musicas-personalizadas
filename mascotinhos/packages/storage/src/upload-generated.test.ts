import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';

const mockUpload = mock(() =>
  Promise.resolve({ data: { path: 'order-1/1.png' }, error: null }),
);
const mockFrom = mock(() => ({ upload: mockUpload }));

mock.module('./client', () => ({
  storage: { from: mockFrom },
}));

import { uploadGenerated } from './upload-generated';

describe('uploadGenerated', () => {
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
    mockUpload.mockClear();
    mockFrom.mockClear();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('uploads to correct within-bucket path and returns prefixed storage path', async () => {
    const path = await uploadGenerated('order-1', 1, Buffer.from('data'));
    expect(path).toBe('generated/order-1/1.png');
    expect(mockFrom).toHaveBeenCalledWith('generated');
    expect(mockUpload).toHaveBeenCalledWith(
      'order-1/1.png',
      expect.any(Buffer),
      { contentType: 'image/png', upsert: false },
    );
  });

  it('uses attemptNumber in path', async () => {
    mockUpload.mockResolvedValueOnce({ data: { path: 'order-2/3.png' }, error: null });
    const path = await uploadGenerated('order-2', 3, Buffer.from(''));
    expect(path).toBe('generated/order-2/3.png');
    const [calledPath] = mockUpload.mock.calls[0] as unknown as [string, ...unknown[]];
    expect(calledPath).toBe('order-2/3.png');
  });

  it('throws when supabase returns an error', async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: new Error('upload failed') } as never);
    await expect(uploadGenerated('order-1', 1, Buffer.from(''))).rejects.toThrow('upload failed');
  });

  it('emits photo_upload_scoped audit log on success', async () => {
    await uploadGenerated('order-1', 1, Buffer.from('data'));
    const logCall = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('photo_upload_scoped'),
    );
    expect(logCall).toBeDefined();
    const parsed = JSON.parse(logCall![0] as string);
    expect(parsed.orderId).toBe('order-1');
    expect(parsed.bucket).toBe('generated');
    expect(parsed.event).toBe('photo_upload_scoped');
    expect(parsed.service).toBe('storage');
  });

  it('does not emit audit log when upload fails', async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: new Error('upload failed') } as never);
    await expect(uploadGenerated('order-1', 1, Buffer.from(''))).rejects.toThrow('upload failed');
    const logCall = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('photo_upload_scoped'),
    );
    expect(logCall).toBeUndefined();
  });

  it('throws for orderId containing path traversal sequence', async () => {
    await expect(
      uploadGenerated('../admin', 1, Buffer.from('data')),
    ).rejects.toThrow('Invalid orderId');
  });

  it('throws for orderId containing a forward slash', async () => {
    await expect(
      uploadGenerated('order-1/../../etc', 1, Buffer.from('data')),
    ).rejects.toThrow('Invalid orderId');
  });

  it('throws for empty orderId', async () => {
    await expect(
      uploadGenerated('', 1, Buffer.from('data')),
    ).rejects.toThrow('Invalid orderId');
  });
});
