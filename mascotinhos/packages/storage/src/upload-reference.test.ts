import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';

const mockUpload = mock(() =>
  Promise.resolve({ data: { path: 'order-1/photo.jpg' }, error: null }),
);
const mockFrom = mock(() => ({ upload: mockUpload }));

mock.module('./client', () => ({
  storage: { from: mockFrom },
}));

import { uploadReference } from './upload-reference';

describe('uploadReference', () => {
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
    const path = await uploadReference('order-1', 'photo.jpg', Buffer.from('data'), 'image/jpeg');
    expect(path).toBe('references/order-1/photo.jpg');
    expect(mockFrom).toHaveBeenCalledWith('references');
    expect(mockUpload).toHaveBeenCalledWith(
      'order-1/photo.jpg',
      expect.any(Buffer),
      { contentType: 'image/jpeg', upsert: false },
    );
  });

  it('does not pass metadata field', async () => {
    await uploadReference('order-1', 'photo.jpg', Buffer.from('data'), 'image/jpeg');
    const [, , options] = mockUpload.mock.calls[0] as unknown as [string, Buffer, Record<string, unknown>];
    expect(options).not.toHaveProperty('metadata');
  });

  it('uses upsert: false', async () => {
    await uploadReference('order-1', 'photo.jpg', Buffer.from('data'), 'image/jpeg');
    const [, , options] = mockUpload.mock.calls[0] as unknown as [string, Buffer, Record<string, unknown>];
    expect(options['upsert']).toBe(false);
  });

  it('throws when supabase returns an error', async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: new Error('upload failed') } as never);
    await expect(uploadReference('order-1', 'photo.jpg', Buffer.from(''), 'image/jpeg')).rejects.toThrow('upload failed');
  });

  it('emits photo_upload_scoped audit log on success', async () => {
    await uploadReference('order-1', 'photo.jpg', Buffer.from('data'), 'image/jpeg');
    const logCall = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('photo_upload_scoped'),
    );
    expect(logCall).toBeDefined();
    const parsed = JSON.parse(logCall![0] as string);
    expect(parsed.orderId).toBe('order-1');
    expect(parsed.bucket).toBe('references');
    expect(parsed.event).toBe('photo_upload_scoped');
    expect(parsed.service).toBe('storage');
  });

  it('does not emit audit log when upload fails', async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: new Error('upload failed') } as never);
    await expect(uploadReference('order-1', 'photo.jpg', Buffer.from(''), 'image/jpeg')).rejects.toThrow('upload failed');
    const logCall = consoleSpy.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('photo_upload_scoped'),
    );
    expect(logCall).toBeUndefined();
  });

  it('throws for orderId containing path traversal sequence', async () => {
    await expect(
      uploadReference('../admin', 'photo.jpg', Buffer.from('data'), 'image/jpeg'),
    ).rejects.toThrow('Invalid orderId');
  });

  it('throws for filename containing path traversal sequence', async () => {
    await expect(
      uploadReference('order-1', '../other-order/photo.jpg', Buffer.from('data'), 'image/jpeg'),
    ).rejects.toThrow('Invalid filename');
  });

  it('throws for empty orderId', async () => {
    await expect(
      uploadReference('', 'photo.jpg', Buffer.from('data'), 'image/jpeg'),
    ).rejects.toThrow('Invalid orderId');
  });

  it('throws for filename with forward slash', async () => {
    await expect(
      uploadReference('order-1', 'sub/dir/photo.jpg', Buffer.from('data'), 'image/jpeg'),
    ).rejects.toThrow('Invalid filename');
  });
});
