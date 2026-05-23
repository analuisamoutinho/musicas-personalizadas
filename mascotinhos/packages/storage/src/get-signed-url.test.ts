import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockCreateSignedUrl = mock(() =>
  Promise.resolve({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
);

mock.module('./client', () => ({
  storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
}));

import { getSignedUrl } from './get-signed-url';

describe('getSignedUrl', () => {
  beforeEach(() => {
    mockCreateSignedUrl.mockClear();
  });

  it('routes references/ prefix to references bucket with 3600s expiry', async () => {
    const url = await getSignedUrl('references/order-1/photo.jpg');
    expect(url).toBe('https://example.com/signed');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('order-1/photo.jpg', 3600);
  });

  it('routes generated/ prefix to generated bucket', async () => {
    await getSignedUrl('generated/order-1/1.png');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('order-1/1.png', 3600);
  });

  it('throws on invalid path prefix', async () => {
    await expect(getSignedUrl('public/order-1/photo.jpg')).rejects.toThrow(
      'Invalid storage path prefix',
    );
  });

  it('throws when supabase returns an error', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: new Error('auth failed') } as never);
    await expect(getSignedUrl('references/order-1/photo.jpg')).rejects.toThrow('auth failed');
  });

  it('throws when signedUrl is null', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: { signedUrl: null }, error: null } as never);
    await expect(getSignedUrl('references/order-1/photo.jpg')).rejects.toThrow('No signed URL returned');
  });
});
