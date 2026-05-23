/**
 * Extract and sanitize the source IP from the x-forwarded-for header.
 * Takes only the first (leftmost) address and strips non-printable/control characters
 * to prevent log injection.
 */
export function sanitizeIp(raw: string | null): string {
  if (!raw) return "unknown";
  const first = raw.split(",")[0]?.trim() ?? "unknown";
  return first.replace(/[^\x20-\x7E]/g, "").slice(0, 45) || "unknown";
}
