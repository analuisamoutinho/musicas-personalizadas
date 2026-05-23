import { createPostgresState } from "@chat-adapter/state-pg";
import { env } from "@mascotinhos/env/server";

// Chat SDK state adapter: distributed locks, dedup, thread subscriptions.
// Uses DIRECT_URL (port 5432) — advisory locks used for distributed locking
// don't work through Supavisor's transaction-mode pooler (port 6543).
// Tables are auto-created on first connect (no migrations needed).
export const stateAdapter = createPostgresState({ url: env.DIRECT_URL ?? env.DATABASE_URL });
