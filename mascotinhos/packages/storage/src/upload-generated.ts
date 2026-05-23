import { storage } from './client';
import { sanitizePathSegment } from './validate-access';

export async function uploadGenerated(
  orderId: string,
  attemptNumber: number,
  file: Buffer | Uint8Array,
): Promise<string> {
  const safeOrderId = sanitizePathSegment(orderId, 'orderId');
  const uploadPath = `${safeOrderId}/${attemptNumber}.png`;
  const { data, error } = await storage
    .from('generated')
    .upload(uploadPath, file, { contentType: 'image/png', upsert: false });
  if (error) throw error;
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'photo_upload_scoped',
      orderId,
      bucket: 'generated',
      path: data.path,
      service: 'storage',
    }),
  );
  return `generated/${data.path}`;
}
