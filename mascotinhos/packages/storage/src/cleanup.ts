import { storage } from './client';

export async function deleteReferences(orderId: string): Promise<void> {
  const { data: files, error: listError } = await storage
    .from('references')
    .list(orderId, { limit: 1000 });

  if (listError) throw listError;
  if (!files || files.length === 0) return;

  const paths = files.map((f) => `${orderId}/${f.name}`);
  const { error: deleteError } = await storage.from('references').remove(paths);
  if (deleteError) throw deleteError;
}

export type DeleteExpiredResult = {
  deletedCount: number;
  errorCount: number;
  errors: Array<{ orderId: string; message: string }>;
};

// Process orders in parallel chunks to stay within Supabase Storage rate limits
// while avoiding the O(n) serial latency of the original loop.
const CHUNK_SIZE = 10;

export async function deleteExpiredReferences(
  expiredOrderIds: string[],
): Promise<DeleteExpiredResult> {
  const errors: Array<{ orderId: string; message: string }> = [];
  let deletedCount = 0;

  for (let i = 0; i < expiredOrderIds.length; i += CHUNK_SIZE) {
    const chunk = expiredOrderIds.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(chunk.map((id) => deleteReferences(id)));

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j]!;
      const orderId = chunk[j]!;
      if (result.status === 'fulfilled') {
        deletedCount++;
      } else {
        errors.push({
          orderId,
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  const errorCount = errors.length;
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'expired_references_deleted',
      deletedCount,
      errorCount,
      service: 'storage',
    }),
  );

  return { deletedCount, errorCount, errors };
}
