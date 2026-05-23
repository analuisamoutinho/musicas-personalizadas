export function serializeCause(error: unknown, depth = 0): Record<string, unknown> | string | undefined {
  if (error == null) return undefined;
  if (!(error instanceof Error)) return String(error);
  if (depth > 2) return { message: error.message };
  const out: Record<string, unknown> = { name: error.name, message: error.message };
  if ("code" in error) out.code = (error as { code?: unknown }).code;
  if (error.cause != null) out.cause = serializeCause(error.cause, depth + 1);
  if (error instanceof AggregateError) {
    out.errors = error.errors.slice(0, 3).map((e) => serializeCause(e, depth + 1));
  }
  return out;
}
