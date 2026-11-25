import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { MASK } from "../src/mask.js";
import { newestUrbsFile, URBS_SOURCE_URL } from "../src/sources/urbs.js";
import { cityPointsSearchOutput, distanceM, FEIRA_NOTE, HEALTH_NOTE, mixedNote, POI_CATEGORIES } from "../src/tools/cityPointsSearch.js";
import { connectClient, errorOf } from "./helpers.js";

// Invented points in the real URBS POI export shape (test/fixtures/urbs_synthetic/pois.json); no real rows.
// 21 rows: 14 in allowlisted categories, 6 in excluded or unknown ones (every name contains "Zzyzx"), 1 invalid.
const FIXTURE = new URL("./fixtures/urbs_synthetic/pois.json", import.meta.url).pathname;
const PUBLIC = 14;
const EXCLUDED = 6;
const CENTRE = { lat: -25.43, lon: -49.27 }; // "Feira Ficticia Alfa"
const CULTURAL_NOTE = mixedNote(["cultural_space"]); // the fixture's only mixed-category row is in cultural_space

let tmp: string;
beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-pois-")));
  mkdirSync(join(tmp, "urbs"));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const fixtureRows = () => JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, string>[];
function useFixture(prefix = "2026_11_20") {
  copyFileSync(FIXTURE, join(tmp, "urbs", `${prefix}_pois.json`));
}
function write(rows: unknown, prefix = "2026_11_20") {
  writeFileSync(join(tmp, "urbs", `${prefix}_pois.json`), JSON.stringify(rows));
}

async function call(args: Record<string, unknown>, dir: string | undefined = tmp) {
  if (dir !== undefined) vi.stubEnv(DATA_DIR_ENV, dir);
  const client = await connectClient();
  return client.callTool({ name: "city_points_search", arguments: args });
}
async function search(args: Record<string, unknown>) {
  const res = await call(args);
  expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
  return cityPointsSearchOutput.parse(res.structuredContent);
}

describe("city_points_search", () => {
  it("lists the allowlisted categories with counts when called with no filter", async () => {
    useFixture();
    const out = await search({});
    expect(out.data.total).toBe(PUBLIC);
    expect(out.data.skipped_rows).toBe(1);
    const counts = Object.fromEntries((out.data.categories ?? []).map((c) => [c.id, c.count]));
    expect(Object.keys(counts)).toEqual(Object.keys(POI_CATEGORIES));
    expect(counts).toMatchObject({ feira: 2, library: 2, bus_terminal: 2, health_unit: 1, urgent_care: 1, cemetery: 0 });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(PUBLIC);
    expect(out.data.categories?.find((c) => c.id === "bus_terminal")?.source_categories).toEqual([
      { name: "TERMINAL DE TRANSPORTE", count: 1 },
      { name: "TERMINAL DE TRANSPORTE - CARTÃO TRANSPORTE", count: 0 },
      { name: "ESTAÇÃO TUBO - CARTÃO TRANSPORTE", count: 1 },
    ]);
    for (const c of out.data.categories ?? []) {
      expect(c.source_categories.map((x) => x.name), c.id).toEqual(POI_CATEGORIES[c.id]);
      expect(c.source_categories.reduce((n, x) => n + x.count, 0), c.id).toBe(c.count);
    }
    expect(out.checked_at).toBe("2026-11-20");
    expect(out.source_url).toBe(URBS_SOURCE_URL);
    expect(out.license_note).toContain("2026_11_20_pois.json");
    expect(out.license_note).toContain("CC BY 4.0");
    expect(out.license_note).toContain("O Portal de Dados Abertos de Curitiba e o órgão ou entidade de onde foram acessados os dados não garantem sua autenticidade, qualidade, integridade e atualidade após terem sido disponibilizados para uso secundário.");
    expect(out.note).toContain("no network call");
    expect(out.note).toContain(`${EXCLUDED} rows in other categories`);
    expect(out.note).toContain("1 row of the file did not match the expected shape and was left out.");
    expect(out.note).toContain(FEIRA_NOTE);
    expect(out.note).toContain(HEALTH_NOTE);
    expect(out.note).toContain("their URBS names look missing or renamed");
    expect(out.note).toContain("cemetery");
    expect(out.note).not.toMatch(/\bhealth_unit\b/); // has rows, though not under every one of its URBS names
    expect(out.note).toContain(CULTURAL_NOTE); // the first page holds all 14 points, Teatro Inventado included
    expect(out.note).not.toContain("days ago");
  });

  it("never returns a row outside the allowlist, by name, position or listing", async () => {
    useFixture();
    expect((await search({ name: "zzyzx" })).data.total).toBe(0);
    for (const name of ["hotel", "igreja", "banca", "delegacia", "particular", "categoria nova"]) {
      expect((await search({ name })).data.total, name).toBe(0);
    }
    const near = await search({ near: { lat: -25.4303, lon: -49.2703 }, radius_m: 100, limit: 50 });
    expect(near.data.items.length).toBeGreaterThan(0);
    expect(near.data.items.some((p) => p.name.includes("Zzyzx"))).toBe(false);
    const all = await search({ limit: 50 });
    expect(all.data.items).toHaveLength(PUBLIC);
    expect(JSON.stringify(all)).not.toContain("Zzyzx");
    expect(JSON.stringify(all)).not.toContain("HOTEL");
  });

  it("filters by category id and keeps the URBS category as source_category", async () => {
    useFixture();
    const out = await search({ category: "bus_terminal" });
    expect(out.data.items.map((p) => [p.name, p.source_category])).toEqual([
      ["Estação Tubo Exemplo", "ESTAÇÃO TUBO - CARTÃO TRANSPORTE"],
      ["Terminal Imaginário", "TERMINAL DE TRANSPORTE"],
    ]);
    expect(out.data.items[0]).toMatchObject({ category: "bus_terminal", lat: -25.433, lon: -49.273 });
    expect(out.data.categories).toBeUndefined();
    expect(out.data.items[0]).not.toHaveProperty("distance_m");
  });

  it("warns about private or non-profit institutions only when results include the mixed categories", async () => {
    useFixture();
    expect((await search({ category: "cultural_space" })).note).toContain(CULTURAL_NOTE);
    expect((await search({ name: "teatro" })).note).toContain(CULTURAL_NOTE);
    expect((await search({ category: "feira" })).note).not.toContain("Some results are in");
    expect((await search({ category: "special_education" })).note).not.toContain("Some results are in"); // no rows, no results
    const firstOnly = await search({ limit: 1 }); // by name, "Câmbio Verde…" comes first; Teatro Inventado is further on
    expect(firstOnly.data.items[0]?.category).not.toBe("cultural_space");
    expect(firstOnly.note).toContain(CULTURAL_NOTE);
  });

  it("names in the mixed-category note only the mixed categories present among the matches", async () => {
    const row = (POI_NAME: string, POI_CATEGORY_NAME: string) => ({ POI_NAME, POI_CATEGORY_NAME, POI_LAT: "", POI_LON: "", POI_DESC: "" });
    write([...fixtureRows(), row("Escola Profissional Inventada", "EDUC PROFISSIONAL")]);
    expect(CULTURAL_NOTE).toContain("Some results are in cultural_space: this category is open to the public");
    expect(CULTURAL_NOTE).not.toContain("special_education");
    expect((await search({ name: "inventad" })).note).toContain(
      "Some results are in cultural_space, vocational_education: these categories are open to the public",
    );
    expect((await search({ category: "vocational_education" })).note).toContain(mixedNote(["vocational_education"]));
    expect(mixedNote([])).toBe("");
  });

  it("shows a rename of one URBS name of a category only as a 0 in source_categories, without a warning", async () => {
    const rows = fixtureRows().map((r) =>
      r.POI_CATEGORY_NAME === "TERMINAL DE TRANSPORTE" ? { ...r, POI_CATEGORY_NAME: "TERMINAL DE TRANSPORTE RENOMEADO" } : r,
    );
    write(rows);
    const out = await search({});
    const bus = out.data.categories?.find((c) => c.id === "bus_terminal");
    expect(bus?.count).toBe(1);
    expect(bus?.source_categories.find((x) => x.name === "TERMINAL DE TRANSPORTE")?.count).toBe(0);
    expect(out.note).not.toMatch(/\bbus_terminal\b/); // documented gap: only a whole id with no row is warned about
    expect(out.note).toContain(`${EXCLUDED + 1} rows in other categories`);
  });

  it("matches name words with accents and case ignored", async () => {
    useFixture();
    expect((await search({ name: "SAO joao" })).data.items.map((p) => p.name)).toEqual(["Escola Municipal São João Fictícia"]);
    expect((await search({ name: "cambio verde" })).data.items[0]?.category).toBe("cambio_verde");
    expect((await search({ name: "feira", category: "library" })).data.total).toBe(0);
  });

  it("near: only points within the radius, nearest first, with distance_m; no coordinates means no match", async () => {
    useFixture();
    const out = await search({ near: CENTRE, limit: 50 });
    const d = out.data.items.map((p) => p.distance_m ?? -1);
    expect(out.data.items[0]).toMatchObject({ name: "Feira Ficticia Alfa", distance_m: 0 });
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(Math.max(...d)).toBeLessThanOrEqual(1500);
    const names = out.data.items.map((p) => p.name);
    expect(names).toContain("Feira Inventada Beta"); // 0.01° south, about 1,112 m
    expect(names).not.toContain("Farol do Saber Sintético");
    expect(names).not.toContain("Casa da Leitura Sem Coordenada");
    expect(out.data.items.find((p) => p.name === "Feira Inventada Beta")?.distance_m).toBe(1112);
    const tight = await search({ near: CENTRE, radius_m: 500, category: "feira" });
    expect(tight.data.items.map((p) => p.name)).toEqual(["Feira Ficticia Alfa"]);
    expect(Math.round(distanceM(CENTRE, { lat: -25.44, lon: -49.27 }))).toBe(1112);
  });

  it("returns points without coordinates as null when not searching near", async () => {
    useFixture();
    const out = await search({ name: "casa leitura" });
    expect(out.data.items[0]).toMatchObject({ lat: null, lon: null, category: "library" });
  });

  it("passes descriptions and names through the masking guard; other text as published", async () => {
    useFixture();
    const posto = (await search({ category: "transit_card_office" })).data.items[0];
    expect(posto?.desc).toContain(MASK);
    expect(posto?.desc).not.toContain("0000");
    const tubo = (await search({ name: "tubo" })).data.items[0];
    expect(tubo?.desc).toBe("Texto inventado sobre recarga");
    write([...fixtureRows(), { POI_NAME: "Feira Contato 41 99999-8888", POI_CATEGORY_NAME: "ABAST FEIRA", POI_LAT: "", POI_LON: "", POI_DESC: "" }]);
    const masked = await search({ category: "feira", limit: 50 });
    expect(masked.data.items.some((p) => p.name === `Feira Contato ${MASK}`)).toBe(true);
    expect((await search({ name: "99999" })).data.total).toBe(0); // a query cannot probe masked text
    expect((await search({ name: "masked" })).data.total).toBe(0); // nor match the guard's own token
  });

  it("pages with limit and offset in a stable order", async () => {
    useFixture();
    const first = await search({ limit: 5 });
    const second = await search({ limit: 5, offset: 5 });
    expect(first.data.next_offset).toBe(5);
    const all = await search({ limit: 50 });
    expect([...first.data.items, ...second.data.items]).toEqual(all.data.items.slice(0, 10));
    expect(all.data.next_offset).toBeNull();
  });

  it("rejects bad arguments", async () => {
    useFixture();
    expect(errorOf(await call({ radius_m: 500 }))).toMatchObject({ error: "invalid_argument" });
    expect(errorOf(await call({ name: "--" }))).toMatchObject({ error: "invalid_argument" });
    expect((await call({ category: "hotel" })).isError).toBe(true);
    expect((await call({ near: CENTRE, radius_m: 10_001 })).isError).toBe(true);
    expect((await call({ limit: 51 })).isError).toBe(true);
    expect((await call({ near: { lat: 91, lon: 0 } })).isError).toBe(true);
  });

  it("data_not_available without the file; invalid_data over 5% invalid rows, with the fallback", async () => {
    expect(errorOf(await call({}, undefined))).toMatchObject({ error: "data_not_available" });
    const missing = errorOf(await call({})) as { message: string };
    expect(missing).toMatchObject({ error: "data_not_available" });
    expect(missing.message).toContain("YYYY_MM_DD_pois.json.xz");
    write(fixtureRows().map((r) => ({ ...r, POI_LAT: "x" })));
    const bad = errorOf(await call({})) as { error: string; message: string };
    expect(bad.error).toBe("invalid_data");
    expect(bad.message).toContain("To use an older file instead, delete 2026_11_20_pois.json");
  });

  it("says when no row is in any allowlisted category (renamed categories)", async () => {
    write(fixtureRows().map((r) => ({ ...r, POI_CATEGORY_NAME: `NOVA ${r.POI_CATEGORY_NAME}` })));
    const out = await search({});
    expect(out.data.total).toBe(0);
    expect(out.note).toContain("No row of this file is in any category on the list");
  });

  it("warns when the file is more than 30 days old", async () => {
    useFixture("2026_10_21");
    expect((await search({})).note).toContain("dated 2026-10-21, 31 days ago (more than 30)");
  });

  it("finds the newest pois file by name, separately from the bus kinds", () => {
    const names = ["2026_11_19_pois.json", "2026_11_20_pois.json", "2026_11_21_linhas.json", "2026_11_22_POIS.json"];
    expect(newestUrbsFile(names, "pois")).toEqual({ name: "2026_11_20_pois.json", date: "2026-11-20" });
  });
});
