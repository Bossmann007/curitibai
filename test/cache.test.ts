import { describe, expect, it, vi } from "vitest";
import { SHARED_CACHE_MAX_ENTRIES, sharedCache, TtlCache } from "../src/cache.js";
import { CACHE_TTL_MS } from "../src/config.js";

describe("sharedCache", () => {
  it("reads the clock at each call, so a test clock expires its entries (since 0.38.1)", async () => {
    vi.useFakeTimers();
    try {
      let loads = 0;
      const load = async () => ++loads;
      await sharedCache.getOrLoad("clock-test", load);
      vi.advanceTimersByTime(CACHE_TTL_MS + 1);
      await sharedCache.getOrLoad("clock-test", load);
      expect(loads).toBe(2);
    } finally {
      vi.useRealTimers();
      sharedCache.clear();
    }
  });

  it("keeps at most 500 entries and drops the oldest stored first", async () => {
    expect(SHARED_CACHE_MAX_ENTRIES).toBe(500);
    const loads: string[] = [];
    const get = (key: string) =>
      sharedCache.getOrLoad(key, async () => {
        loads.push(key);
        return key;
      });
    for (let i = 0; i <= 500; i++) await get(`k${i}`); // 501 keys
    expect(loads).toHaveLength(501);
    await get("k1"); // still cached
    expect(loads).toHaveLength(501);
    await get("k0"); // evicted by the 501st key, so it loads again
    expect(loads).toHaveLength(502);
    expect(loads.at(-1)).toBe("k0");
  });
});

describe("TtlCache", () => {
  /** A cache on a clock the test moves (ms), with a load that counts its calls. */
  function setup(ttlMs: number, maxEntries?: number) {
    const clock = { now: 0 };
    const cache = new TtlCache(ttlMs, () => clock.now, maxEntries);
    const load = vi.fn(async (key: string) => `${key}@${clock.now}`);
    const get = (key: string) => cache.getOrLoad(key, () => load(key));
    return { clock, cache, load, get };
  }

  it("shares one load among concurrent calls for the same key", async () => {
    const { cache } = setup(1000);
    let release!: (v: string) => void;
    const load = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    const calls = [cache.getOrLoad("k", load), cache.getOrLoad("k", load), cache.getOrLoad("k", load)];
    release("v");
    const results = await Promise.all(calls);
    expect(load).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.value)).toEqual(["v", "v", "v"]);
    expect(new Set(results.map((r) => r.fetchedAt)).size).toBe(1);
  });

  it("does not store a failed load: every waiting call gets the error and the next call loads again", async () => {
    const { cache } = setup(1000);
    const err = new Error("boom");
    let reject!: (e: unknown) => void;
    const failing = vi.fn(() => new Promise<string>((_, r) => (reject = r)));
    const calls = [cache.getOrLoad("k", failing), cache.getOrLoad("k", failing)];
    reject(err);
    for (const c of calls) await expect(c).rejects.toBe(err);
    expect(failing).toHaveBeenCalledTimes(1);
    const ok = vi.fn(async () => "v");
    expect((await cache.getOrLoad("k", ok)).value).toBe("v");
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("serves an entry until its TTL and loads again exactly at expiry", async () => {
    const { clock, load, get } = setup(1000);
    expect(await get("k")).toEqual({ value: "k@0", fetchedAt: new Date(0).toISOString() });
    clock.now = 999;
    expect((await get("k")).value).toBe("k@0");
    clock.now = 1000;
    expect(await get("k")).toEqual({ value: "k@1000", fetchedAt: new Date(1000).toISOString() });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("with maxEntries drops the oldest stored entry first; an expired entry reloaded is stored as the newest", async () => {
    const { clock, load, get } = setup(1000, 2);
    await get("a"); // expires at 1000
    clock.now = 500;
    await get("b"); // expires at 1500
    clock.now = 1000;
    await get("a"); // expired, reloaded: now the newest stored
    await get("c"); // over 2: b, the oldest stored, is dropped
    load.mockClear();
    await get("a");
    await get("c");
    expect(load).not.toHaveBeenCalled();
    await get("b");
    expect(load).toHaveBeenCalledWith("b");
  });
});
