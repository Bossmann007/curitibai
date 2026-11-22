import { afterEach, beforeEach, vi } from "vitest";
import { sharedCache } from "../src/cache.js";
import { resetHostRefusals } from "../src/http.js";
import { clearGeoCuritibaCache } from "../src/sources/geocuritiba.js";
import { clearGuairaState } from "../src/sources/guaira.js";
import { clearVaccinationCache } from "../src/sources/imunizaja.js";
import { resetOverpassCooldown } from "../src/sources/osm.js";

// No test may reach the network: any fetch that a test did not stub fails loudly.
beforeEach(() => {
  sharedCache.clear();
  resetOverpassCooldown();
  clearVaccinationCache();
  clearGeoCuritibaCache();
  clearGuairaState();
  resetHostRefusals();
  vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
    throw new Error(`unexpected network call in test: ${String(input)}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
