import { describe, it, expect } from 'bun:test';
import { validateOrderPhotoAccess, sanitizePathSegment } from './validate-access';

describe('validateOrderPhotoAccess', () => {
  it('passes for valid references path with correct orderId', () => {
    expect(() =>
      validateOrderPhotoAccess('references/order-1/photo.jpg', 'order-1'),
    ).not.toThrow();
  });

  it('passes for valid generated path with correct orderId', () => {
    expect(() =>
      validateOrderPhotoAccess('generated/order-1/1.png', 'order-1'),
    ).not.toThrow();
  });

  it('throws for references path belonging to different orderId', () => {
    expect(() =>
      validateOrderPhotoAccess('references/order-2/photo.jpg', 'order-1'),
    ).toThrow('Access violation');
  });

  it('throws for generated path belonging to different orderId', () => {
    expect(() =>
      validateOrderPhotoAccess('generated/order-2/1.png', 'order-1'),
    ).toThrow('Access violation');
  });

  it('throws for path with no orderId prefix', () => {
    expect(() =>
      validateOrderPhotoAccess('photo.jpg', 'order-1'),
    ).toThrow('Access violation');
  });

  it('throws for empty path', () => {
    expect(() =>
      validateOrderPhotoAccess('', 'order-1'),
    ).toThrow('Access violation');
  });

  it('throws with descriptive message including path and orderId', () => {
    expect(() =>
      validateOrderPhotoAccess('references/other-order/photo.jpg', 'order-1'),
    ).toThrow(`Access violation: path "references/other-order/photo.jpg" does not belong to order "order-1"`);
  });

  it('throws for empty orderId — prevents trivial prefix bypass', () => {
    expect(() =>
      validateOrderPhotoAccess('references//photo.jpg', ''),
    ).toThrow('Access violation: orderId must be a non-empty string');
  });

  it('throws for blank orderId (whitespace only)', () => {
    expect(() =>
      validateOrderPhotoAccess('references/   /photo.jpg', '   '),
    ).toThrow('Access violation: orderId must be a non-empty string');
  });
});

describe('sanitizePathSegment', () => {
  it('returns the segment unchanged when valid', () => {
    expect(sanitizePathSegment('order-abc-123', 'orderId')).toBe('order-abc-123');
  });

  it('throws for empty segment', () => {
    expect(() => sanitizePathSegment('', 'orderId')).toThrow('Invalid orderId: must be a non-empty string');
  });

  it('throws for blank segment (whitespace only)', () => {
    expect(() => sanitizePathSegment('   ', 'filename')).toThrow('Invalid filename: must be a non-empty string');
  });

  it('throws for segment containing path traversal (..)', () => {
    expect(() => sanitizePathSegment('../admin', 'orderId')).toThrow("Invalid orderId");
  });

  it('throws for segment containing a forward slash', () => {
    expect(() => sanitizePathSegment('order-1/../../etc', 'orderId')).toThrow("Invalid orderId");
  });

  it('throws for segment containing a null byte', () => {
    expect(() => sanitizePathSegment('order-1\0malicious', 'orderId')).toThrow("Invalid orderId");
  });

  it('throws for filename with traversal sequence', () => {
    expect(() => sanitizePathSegment('../other-order/photo.jpg', 'filename')).toThrow("Invalid filename");
  });
});
