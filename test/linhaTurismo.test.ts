import { afterEach, describe, expect, it, vi } from "vitest";
import { FACILITY_TYPES, isListRequest, resolveType } from "../src/sources/geocuritiba.js";
import { isTourRequest, TOUR_ALIASES, TOUR_SOURCE_URL, TOUR_STOPS, TOUR_TYPE_ID } from "../src/sources/linhaTurismo.js";
import { fold } from "../src/text.js";
import { cityFacilitiesSearchOutput } from "../src/tools/cityFacilitiesSearch.js";
import { connectClient, errorOf, stubFetch } from "./helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function call(args: Record<string, unknown>) {
  const client = await connectClient();
  return client.callTool({ name: "city_facilities_search", arguments: args });
}

describe("Linha Turismo stops (bundled)", () => {
  it("has the 25 stops of the page, each lookup a type the tool resolves", () => {
    expect(TOUR_STOPS).toHaveLength(25);
    expect(new Set(TOUR_STOPS.map((s) => s.name)).size).toBe(25);
    for (const s of TOUR_STOPS) {
      if (s.lookup !== null) expect(resolveType(s.lookup.type), `${s.name}: ${s.lookup.type}`).not.toBeNull();
    }
    expect(TOUR_STOPS.filter((s) => s.lookup !== null)).toHaveLength(18);
  });

  it("every lookup word is in the record name it was matched to (the tool's name filter would find it)", () => {
    const norm = (x: string) => fold(x).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    for (const s of TOUR_STOPS) {
      if (s.lookup === null) continue;
      const hay = norm(s.lookup.matched);
      for (const w of norm(s.lookup.name).split(" ")) expect(hay.includes(w), `${s.name}: ${w}`).toBe(true);
    }
  });

  it("its names never collide with a GeoCuritiba type, alias or the list words", () => {
    for (const name of [TOUR_TYPE_ID, ...TOUR_ALIASES]) {
      expect(resolveType(name), name).toBeNull();
      expect(isListRequest(name), name).toBe(false);
      expect(isTourRequest(name), name).toBe(true);
    }
    expect(isTourRequest("Pontos Turísticos")).toBe(true);
    expect(isTourRequest("turismo")).toBe(false); // stays the tourist information desks
    expect(FACILITY_TYPES.some((t) => t.id === TOUR_TYPE_ID)).toBe(false);
  });
});

describe("city_facilities_search type \"ponto turistico\"", () => {
  it("lists the stops in page order with no network call, each with its lookup", async () => {
    const calls = stubFetch({});
    const res = await call({ type: "pontos turísticos" });
    expect(res.isError).toBeFalsy();
    const out = cityFacilitiesSearchOutput.parse(res.structuredContent);
    expect(calls).toEqual([]);
    expect(out.data).toMatchObject({ type: "ponto turistico", total: 25, offset: 0, next_offset: 20, skipped_records: 0 });
    expect(out.data.items[0]).toMatchObject({ name: "RUA 24 HORAS", lookup: null, hours: [], phones: [] });
    expect(out.data.items[1]).toMatchObject({ name: "MUSEU FERROVIARIO", lookup: { type: "museu", name: "ferroviario" } });
    expect(out.source_url).toBe(TOUR_SOURCE_URL);
    expect(out.note).toMatch(/no network call was made/);
    expect(out.note).toMatch(/not a full list of the city's attractions/);
  });

  it("filters by name, accents and case ignored", async () => {
    stubFetch({});
    const res = await call({ type: "linha turismo", name: "Ópera" });
    const out = cityFacilitiesSearchOutput.parse(res.structuredContent);
    expect(out.data.total).toBe(1);
    expect(out.data.items[0]).toMatchObject({ name: "OPERA DE ARAME", lookup: { type: "teatro", name: "opera de arame" } });
  });

  it.each([
    ["Mercado Municipal", "MERC.MUNICIPAL/RODOFERROVIARIA"],
    ["Parque São Lourenço", "PQ.SAO LOURENCO (SENT.BARREIRINHA)"],
    ["Unilivre", "UNIV.LIVRE DO MEIO AMBIENTE"],
    ["Bosque João Paulo II", "BOSQUE DO PAPA"],
    ["Pedreiras", "OPERA DE ARAME"],
  ])("finds %s under its abbreviated stop name", async (name, stop) => {
    stubFetch({});
    const out = cityFacilitiesSearchOutput.parse((await call({ type: "ponto turistico", name })).structuredContent);
    expect(out.data.items.map((i) => i.name)).toEqual([stop]);
    expect(JSON.stringify(out)).not.toMatch(/"matched"/);
  });

  it("refuses bairro, near and radius_m, and a name with no letter or digit", async () => {
    stubFetch({});
    for (const extra of [{ bairro: "Centro" }, { near: { lat: -25.43, lon: -49.27 } }, { name: "--" }]) {
      const err = errorOf(await call({ type: "ponto turistico", ...extra })) as { error: string };
      expect(err.error, JSON.stringify(extra)).toBe("invalid_argument");
    }
  });

  it("appears in \"list types\" with the page as its URL", async () => {
    stubFetch({});
    const out = cityFacilitiesSearchOutput.parse((await call({ type: "list types" })).structuredContent);
    expect(out.data.types?.at(-1)).toMatchObject({ type: "ponto turistico", layer_url: TOUR_SOURCE_URL });
    expect(out.data.types).toHaveLength(FACILITY_TYPES.length + 1);
  });
});
