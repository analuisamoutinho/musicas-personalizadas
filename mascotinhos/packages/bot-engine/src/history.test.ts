import { describe, expect, it, beforeEach } from "bun:test";
import { Redis } from "@upstash/redis";
import { getHistory, appendMessage, clearHistory, _overrideRedisForTesting } from "./history";

// In-memory store simulating Redis lists
const mockStore = new Map<string, unknown[]>();

// Inject a fake Redis client so tests never make real HTTP calls
_overrideRedisForTesting({
  lrange: (k: string, _start: number, _end: number) =>
    Promise.resolve(mockStore.get(k) ?? []),
  rpush: (k: string, value: unknown) => {
    const list = mockStore.get(k) ?? [];
    list.push(value);
    mockStore.set(k, list);
    return Promise.resolve(list.length);
  },
  ltrim: (k: string, start: number, _end: number) => {
    // start is negative (e.g. -40) — keep last abs(start) items
    const list = mockStore.get(k) ?? [];
    mockStore.set(k, list.slice(start));
    return Promise.resolve("OK");
  },
  expire: (_k: string, _ttl: number) => Promise.resolve(1),
  del: (k: string) => {
    mockStore.delete(k);
    return Promise.resolve(1);
  },
  pipeline: () => {
    type Cmd = () => Promise<unknown>;
    const commands: Cmd[] = [];
    const p = {
      rpush: (k: string, value: unknown) => {
        commands.push(() => {
          const list = mockStore.get(k) ?? [];
          list.push(value);
          mockStore.set(k, list);
          return Promise.resolve(list.length);
        });
        return p;
      },
      ltrim: (k: string, start: number, _end: number) => {
        commands.push(() => {
          const list = mockStore.get(k) ?? [];
          mockStore.set(k, list.slice(start));
          return Promise.resolve("OK");
        });
        return p;
      },
      expire: (_k: string, _ttl: number) => {
        commands.push(() => Promise.resolve(1));
        return p;
      },
      exec: async () => {
        const results: unknown[] = [];
        for (const cmd of commands) {
          results.push(await cmd());
        }
        return results;
      },
    };
    return p;
  },
} as unknown as Redis);

describe("conversation history", () => {
  const orderId = "test-order-1";

  beforeEach(async () => {
    mockStore.clear();
    await clearHistory(orderId);
  });

  it("returns empty array for new order", async () => {
    expect(await getHistory("nonexistent")).toEqual([]);
  });

  it("appends and retrieves messages", async () => {
    await appendMessage(orderId, "user", "Oi!");
    await appendMessage(orderId, "assistant", "Ola! Como posso ajudar?");

    const history = await getHistory(orderId);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: "user", content: "Oi!" });
    expect(history[1]).toEqual({ role: "assistant", content: "Ola! Como posso ajudar?" });
  });

  it("clears history for an order", async () => {
    await appendMessage(orderId, "user", "Test");
    expect(await getHistory(orderId)).toHaveLength(1);

    await clearHistory(orderId);
    expect(await getHistory(orderId)).toEqual([]);
  });

  it("maintains separate histories per order", async () => {
    await appendMessage("order-a", "user", "Message A");
    await appendMessage("order-b", "user", "Message B");

    expect(await getHistory("order-a")).toHaveLength(1);
    expect(await getHistory("order-b")).toHaveLength(1);
    expect((await getHistory("order-a"))[0]!.content).toBe("Message A");
    expect((await getHistory("order-b"))[0]!.content).toBe("Message B");
  });

  it("trims history to MAX_HISTORY (40) messages", async () => {
    for (let i = 0; i < 45; i++) {
      await appendMessage(orderId, "user", `Message ${i}`);
    }
    const history = await getHistory(orderId);
    expect(history).toHaveLength(40);
    expect(history[0]!.content).toBe("Message 5"); // first 5 were trimmed
    expect(history[39]!.content).toBe("Message 44");
  });
});
