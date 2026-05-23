import { storage } from './client';

export async function getSignedUrl(path: string): Promise<string> {
  let bucket: string;
  let pathWithinBucket: string;

  if (path.startsWith('references/')) {
    bucket = 'references';
    pathWithinBucket = path.slice('references/'.length);
  } else if (path.startsWith('generated/')) {
    bucket = 'generated';
    pathWithinBucket = path.slice('generated/'.length);
  } else {
    throw new Error(`Invalid storage path prefix: "${path}". Must start with "references/" or "generated/".`);
  }

  const { data, error } = await storage
    .from(bucket)
    .createSignedUrl(pathWithinBucket, 3600);

  if (error ?? !data?.signedUrl) throw error ?? new Error('No signed URL returned');
  return data.signedUrl;
}
