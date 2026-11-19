import { afterEach, beforeEach, vi } from "vitest";
import { sharedCache } from "../src/cache.js";

// No test may reach the network: any fetch that a test did not stub fails loudly.
beforeEach(() => {
  sharedCache.clear();
  vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
    throw new Error(`unexpected network call in test: ${String(input)}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});
