import { afterEach, describe, expect, it, vi } from "vitest";
import { CENSUS_BAIRROS, censusBairroUrl, pointQueryUrl, roundPoint } from "../src/sources/geocuritiba.js";
import { censusAtPointOutput } from "../src/tools/censusAtPoint.js";
import { connectClient, errorOf, stubFetch, type Route } from "./helpers.js";

// Synthetic answers with the real fields of BaseTematica layer 43 as read on 2026-11-24 (values invented).
const JSON_TYPE = "application/json; charset=UTF-8";
const AT = { lat: -25.42841234, lon: -49.27331234 };
const P = roundPoint(AT.lat, AT.lon);
const attrs = (list: Record<string, unknown>[]) => JSON.stringify({ features: list.map((attributes) => ({ attributes })) });
const sector = (over: Record<string, unknown> = {}) =>
  attrs([{ cd_setor: "410690205010084", nm_bairro: "São Francisco", v0001: 231, v0007: 129, area_km2: 0.19, dens_pop_km2: 1229.99, renda_media: 4583.33, ...over }]);
const TOTALS = attrs([{ persons: 5008, households: 2395, area_km2: 1.3055, sectors: 12 }]);
const SECTOR_KEY = `GET ${pointQueryUrl("census_sector", P)}`;
const BAIRRO_KEY = `GET ${censusBairroUrl("São Francisco", 20)}`;

function routes(s: Route = {}, b: Route = {}): Record<string, Route> {
  return {
    [SECTOR_KEY]: { contentType: JSON_TYPE, body: sector(), ...s },
    [BAIRRO_KEY]: { contentType: JSON_TYPE, body: TOTALS, ...b },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

async function call(args: Record<string, unknown>) {
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  const client = await connectClient();
  const pending = client.callTool({ name: "census_at_point", arguments: args });
  await vi.advanceTimersByTimeAsync(60_000);
  return pending;
}

async function census(args: Record<string, unknown> = AT) {
  const res = await call(args);
  expect(res.isError).toBeFalsy();
  return censusAtPointOutput.parse(res.structuredContent);
}

describe("census_at_point query URLs", () => {
  it("asks layer 43 for the sector at the rounded point, never v0005, v0006 or the community name", () => {
    const u = new URL(pointQueryUrl("census_sector", P));
    expect(u.pathname).toBe("/server/rest/services/GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer/43/query");
    expect(u.searchParams.get("geometry")).toBe("-49.2733,-25.4284");
    expect(u.searchParams.get("outFields")).toBe("cd_setor,nm_bairro,v0001,v0007,area_km2,dens_pop_km2,renda_media");
    expect(u.toString()).not.toMatch(/v0005|v0006|fcu/);
  });

  it("asks the neighbourhood totals only for one of the 75 IBGE names, over its sectors at the floor", () => {
    expect(CENSUS_BAIRROS).toHaveLength(75);
    const u = new URL(censusBairroUrl("São Francisco", 20)!);
    // Withheld sectors are left out of the sums, so they cannot be subtracted back.
    expect(u.searchParams.get("where")).toBe("nm_bairro='São Francisco' AND v0007 >= 20");
    expect(JSON.parse(u.searchParams.get("outStatistics")!).map((s: { onStatisticField: string }) => s.onStatisticField)).toEqual([
      "v0001", "v0007", "area_km2", "objectid",
    ]);
    expect(censusBairroUrl("Centro' OR 1=1 --", 20)).toBeNull();
    expect(censusBairroUrl("Butiatuvinha", 20)).toBeNull();
    expect(censusBairroUrl("Botiatuvinha", 20)).not.toBeNull();
  });
});

describe("census_at_point answers", () => {
  it("returns the sector and the neighbourhood totals in 2 requests, with the rounded point only", async () => {
    const calls = stubFetch(routes());
    const res = await call(AT);
    const out = censusAtPointOutput.parse(res.structuredContent);
    expect(out.data).toEqual({
      lat: -25.4284,
      lon: -49.2733,
      census_year: 2022,
      inside_curitiba: true,
      sector: { code: "410690205010084", persons: 231, households: 129, density_per_km2: 1230, mean_income_brl: 4583.33 },
      sector_withheld: false,
      neighbourhood: { name: "São Francisco", sectors: 12, persons: 5008, households: 2395, area_km2: 1.31, density_per_km2: 3836.1 },
      partial: false,
    });
    expect(out.source).toBe("Fonte: IBGE, Censo Demográfico 2022, via IPPUC/GeoCuritiba");
    expect(out.note).toMatch(/household heads with income/);
    expect(calls.map((c) => `GET ${c.url}`)).toEqual([SECTOR_KEY, BAIRRO_KEY]);
    expect(JSON.stringify(res) + JSON.stringify(calls)).not.toMatch(/4284123|2733123/);
  });

  it("withholds a sector of 19 households and gives one of 20", async () => {
    stubFetch(routes({ body: sector({ v0007: 19 }) }));
    const low = await census();
    expect(low.data).toMatchObject({ sector: null, sector_withheld: true });
    expect(low.data.neighbourhood?.persons).toBe(5008);
    expect(low.note).toMatch(/fewer than 20 occupied private households: its figures are withheld/);
    expect(JSON.stringify(low)).not.toMatch(/4583/);
  });

  it("gives a sector of exactly 20 households", async () => {
    stubFetch(routes({ body: sector({ v0007: 20 }) }));
    expect((await census()).data).toMatchObject({ sector_withheld: false, sector: { households: 20 } });
  });

  it("withholds neighbourhood totals under 20 households", async () => {
    stubFetch(routes({}, { body: attrs([{ persons: 30, households: 12, area_km2: 0.5, sectors: 1 }]) }));
    expect((await census()).data.neighbourhood).toBeNull();
  });

  it("a sector code in another format still means inside Curitiba (code null), and income 0 is not published", async () => {
    stubFetch(routes({ body: sector({ cd_setor: "410690205010084P", renda_media: 0 }) }));
    const out = await census();
    expect(out.data).toMatchObject({ inside_curitiba: true, sector: { code: null, mean_income_brl: null, persons: 231 } });
    expect(out.note).not.toMatch(/boundary/);
  });

  it("never sends a neighbourhood name it does not know", async () => {
    const calls = stubFetch(routes({ body: sector({ nm_bairro: "Bairro Inventado" }) }));
    const out = await census();
    expect(out.data.neighbourhood).toBeNull();
    expect(out.note).toMatch(/not one this server knows/);
    expect(calls).toHaveLength(1);
  });

  it("no sector at the point: inside_curitiba false and nothing else asked", async () => {
    const calls = stubFetch(routes({ body: attrs([]) }));
    expect((await census()).data).toMatchObject({ inside_curitiba: false, sector: null, sector_withheld: false, neighbourhood: null });
    expect(calls).toHaveLength(1);
  });

  it("a failing totals request is partial, never a failed call; a failing sector request fails the call", async () => {
    stubFetch(routes({}, { status: 500 }));
    const out = await census();
    expect(out.data).toMatchObject({ partial: true, neighbourhood: null });
    expect(out.data.sector).not.toBeNull();
  });

  it("a failing sector layer is source_unavailable; a point outside the box is refused without a request", async () => {
    stubFetch(routes({ status: 500 }));
    expect(errorOf(await call(AT))).toMatchObject({ error: "source_unavailable" });
    const calls = stubFetch({});
    expect(errorOf(await call({ lat: -23.5, lon: -46.6 }))).toMatchObject({ error: "invalid_argument" });
    expect(calls).toHaveLength(0);
  });
});
