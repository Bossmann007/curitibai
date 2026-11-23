import { afterEach, beforeEach, vi } from "vitest";
import { sharedCache } from "../src/cache.js";
import { resetHostRefusals } from "../src/http.js";
import { clearAnaCache } from "../src/sources/ana.js";
import { CNES_GATE, resetCnesGate } from "../src/sources/cnes.js";
import { PNCP_GATE, resetPncpGate } from "../src/sources/pncp.js";
import { clearGeoCuritibaCache } from "../src/sources/geocuritiba.js";
import { clearGuairaState } from "../src/sources/guaira.js";
import { clearVaccinationCache } from "../src/sources/imunizaja.js";
import { clearPublishedState } from "../src/sources/publishedData.js";
import { resetOverpassCooldown } from "../src/sources/osm.js";
import { clearReceitaState, RECEITA_GATE } from "../src/sources/receita.js";

// No test may reach the network: any fetch that a test did not stub fails loudly.
// CNES and PNCP gates: no spacing by default (multi-page tests would wait in real time); the spacing tests set it.
beforeEach(() => {
  resetCnesGate();
  resetPncpGate();
  CNES_GATE.minIntervalMs = 0;
  PNCP_GATE.minIntervalMs = 0;
  clearReceitaState();
  RECEITA_GATE.minIntervalMs = 0;
  sharedCache.clear();
  resetOverpassCooldown();
  clearVaccinationCache();
  clearGeoCuritibaCache();
  clearAnaCache();
  clearGuairaState();
  clearPublishedState();
  resetHostRefusals();
  vi.stubGlobal("fetch", vi.fn(async (input: unknown) => {
    throw new Error(`unexpected network call in test: ${String(input)}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

