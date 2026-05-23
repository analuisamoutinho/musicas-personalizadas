import { storage } from './client';
import { sanitizePathSegment } from './validate-access';

/**
 * Upload a PIX QR PNG to a deterministic path under the `generated` bucket.
 * upsert:true so concurrent re-sends overwrite cleanly with identical content.
 * Returns the path compatible with getSignedUrl() (prefixed `generated/`).
 */
export async function uploadPixQr(orderId: string, file: Buffer | Uint8Array): Promise<string> {
  const safeOrderId = sanitizePathSegment(orderId, 'orderId');
  const uploadPath = `pix-qr/${safeOrderId}.png`;
  const { data, error } = await storage
    .from('generated')
    .upload(uploadPath, file, { contentType: 'image/png', upsert: true });
  if (error) throw error;
  return `generated/${data.path}`;
}
