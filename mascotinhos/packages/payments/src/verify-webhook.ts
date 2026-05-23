import { timingSafeEqual } from 'crypto';
import { env } from '@mascotinhos/env/server';

export function verifyWebhookSignature(token: string): boolean {
  try {
    const a = Buffer.from(token.trim());
    const b = Buffer.from(env.ASAAS_WEBHOOK_SECRET.trim());
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
