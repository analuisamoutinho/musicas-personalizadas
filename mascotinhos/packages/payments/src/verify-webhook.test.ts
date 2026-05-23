import { describe, it, expect } from 'bun:test';
import { verifyWebhookSignature } from './verify-webhook';

// ASAAS_WEBHOOK_SECRET is set to 'test-asaas-secret' in test-setup.ts

describe('verifyWebhookSignature', () => {
  it('returns true when token matches ASAAS_WEBHOOK_SECRET', () => {
    expect(verifyWebhookSignature('test-asaas-secret')).toBe(true);
  });

  it('returns false when token does not match', () => {
    expect(verifyWebhookSignature('wrong-secret')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(verifyWebhookSignature('')).toBe(false);
  });

  it('returns false when lengths differ (prevents timing attack bypass)', () => {
    expect(verifyWebhookSignature('test-asaas-secret-extra')).toBe(false);
    expect(verifyWebhookSignature('short')).toBe(false);
  });
});
