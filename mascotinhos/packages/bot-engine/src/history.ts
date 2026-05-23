import { Redis } from "@upstash/redis";

/** Conversation message stored in history. */
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/** Max messages to keep per order (rolling window). */
const MAX_HISTORY = 40;
/** 7-day TTL — orders older than this are unlikely to resume. */
const TTL_SECONDS = 7 * 24 * 60 * 60;

// Lazy singleton — deferred until first use.
let _redis: Redis | undefined;

/** Override the Redis client (for testing only). */
export function _overrideRedisForTesting(r: Redis): void {
  _redis = r;
}

function getRedis(): Redis {
  return (_redis ??= new Redis({
    url: (process.env.UPSTASH_REDIS_REST_URL ?? "").trim(),
    token: (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim(),
  }));
}

function key(orderId: string): string {
  return `history:${orderId}`;
}

/** Get conversation history for an order. */
export async function getHistory(orderId: string): Promise<HistoryMessage[]> {
  return (await getRedis().lrange<HistoryMessage>(key(orderId), 0, -1)) ?? [];
}

/** Append a message to conversation history. Trims to rolling window with 7-day TTL. */
export async function appendMessage(
  orderId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const k = key(orderId);
  const pipeline = getRedis().pipeline();
  pipeline.rpush(k, { role, content });
  pipeline.ltrim(k, -MAX_HISTORY, -1);
  pipeline.expire(k, TTL_SECONDS);
  await pipeline.exec();
}

/** Clear history for an order (called when order completes or fails). */
export async function clearHistory(orderId: string): Promise<void> {
  await getRedis().del(key(orderId));
}
