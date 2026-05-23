/**
 * Generic retry utility with exponential backoff.
 *
 * Architecture ref: Error Handling Pattern — "try 3x with exponential backoff, then notify operator"
 * NFR-26 (structured logging), NFR-27 (error tracking with context).
 *
 * This is a generic version of the OpenAI-specific callWithRetry in packages/image-gen/src/generate.ts.
 * Do NOT modify generate.ts — that file's internal helper remains as-is.
 */

/** HTTP status codes that indicate a permanent (non-retryable) error. */
const PERMANENT_STATUS_CODES = new Set([400, 401, 403]);

/** HTTP status codes that indicate a transient (retryable) error. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export type RetryOptions = {
  /**
   * Maximum number of retry attempts after the initial call.
   * Total calls = maxRetries + 1 (initial attempt).
   * Default: 3
   */
  maxRetries?: number;
  /**
   * Base delay in milliseconds for exponential backoff.
   * Delay for attempt n = baseDelayMs * 2^(n-1). e.g., 1s, 2s, 4s.
   * Pass 0 in tests to skip real delays.
   * Default: 1000
   */
  baseDelayMs?: number;
  /** Order ID for structured logging context. */
  orderId?: string;
  /** Service name for structured logging context. */
  service?: string;
};

/**
 * Call `fn` with up to `maxRetries` retry attempts on transient failures.
 *
 * Retry classification:
 * - Permanent (400, 401, 403): throw immediately, no retries
 * - Retryable (429, 500-504): retry with exponential backoff
 * - Unknown status / no status: retry (fail-safe: assume transient)
 *
 * Logs each retry attempt as a structured JSON warn event.
 *
 * @throws The last error encountered after all retries are exhausted,
 *         or immediately for permanent errors.
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, orderId, service } = opts;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Extract HTTP status if available (works with fetch errors, OpenAI errors, etc.)
      const status = (err as { status?: number })?.status;

      // Permanent errors — throw immediately, no retries
      if (status !== undefined && PERMANENT_STATUS_CODES.has(status)) {
        throw err;
      }

      // Exhausted all retries — throw the last error
      if (attempt > maxRetries) {
        throw err;
      }

      // Transient error — retry with exponential backoff
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      // `willRetry` reflects the actual code path: permanent errors are already thrown
      // above, so reaching here always means we ARE retrying. Log the status bucket so
      // operators can distinguish known-retryable (429/5xx), unknown (no status), and
      // unexpected (e.g. 404) — all three are retried, which is the safe default.
      console.log(
        JSON.stringify({
          level: "warn",
          event: "retry_attempt",
          attempt,
          maxRetries,
          delayMs,
          orderId,
          service,
          errorStatus: status,
          statusBucket: status === undefined
            ? "unknown"
            : RETRYABLE_STATUS_CODES.has(status)
              ? "retryable"
              : "unexpected_retried",
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Unreachable: the loop always either returns or throws before reaching here.
  throw new Error("Unreachable: callWithRetry loop exited unexpectedly");
}
