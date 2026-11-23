import { describe, expect, it } from "vitest";
import { SHARED_CACHE_MAX_ENTRIES, sharedCache } from "../src/cache.js";

describe("sharedCache", () => {
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
