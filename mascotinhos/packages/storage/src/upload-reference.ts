import { storage } from './client';
import { sanitizePathSegment } from './validate-access';

export async function uploadReference(
  orderId: string,
  filename: string,
  file: Buffer | Uint8Array,
  mimeType: string,
): Promise<string> {
  const safeOrderId = sanitizePathSegment(orderId, 'orderId');
  const safeFilename = sanitizePathSegment(filename, 'filename');
  const uploadPath = `${safeOrderId}/${safeFilename}`;
  const { data, error } = await storage
    .from('references')
    .upload(uploadPath, file, { contentType: mimeType, upsert: false });
  if (error) throw error;
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'photo_upload_scoped',
      orderId,
      bucket: 'references',
      path: data.path,
      service: 'storage',
    }),
  );
  return `references/${data.path}`;
}
