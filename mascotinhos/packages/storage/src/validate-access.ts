/**
 * Validates that a storage path belongs to the specified order.
 * Throws if:
 *  - orderId is empty/blank (would allow trivial prefix bypass)
 *  - path does not start with the expected orderId-scoped prefix
 * Used as a programmatic guard against cross-order photo access.
 */
export function validateOrderPhotoAccess(path: string, orderId: string): void {
  if (!orderId || !orderId.trim()) {
    throw new Error(
      `Access violation: orderId must be a non-empty string`,
    );
  }
  const referencesPrefix = `references/${orderId}/`;
  const generatedPrefix = `generated/${orderId}/`;
  if (!path.startsWith(referencesPrefix) && !path.startsWith(generatedPrefix)) {
    throw new Error(
      `Access violation: path "${path}" does not belong to order "${orderId}"`,
    );
  }
}

/**
 * Sanitizes a storage path segment (orderId or filename) to prevent path traversal.
 * Strips leading slashes, dots-only segments, and traversal sequences.
 * Throws if the segment is empty after sanitization.
 */
export function sanitizePathSegment(segment: string, label: string): string {
  if (!segment || !segment.trim()) {
    throw new Error(`Invalid ${label}: must be a non-empty string`);
  }
  // Reject segments containing path traversal sequences
  if (segment.includes('..') || segment.includes('/') || segment.includes('\0')) {
    throw new Error(
      `Invalid ${label}: "${segment}" contains illegal path characters`,
    );
  }
  return segment;
}
