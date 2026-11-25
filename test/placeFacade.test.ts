import { afterEach, describe, expect, it, vi } from "vitest";
import { censusBairroUrl, pointQueryUrl, roundPoint, type Point, type PointLayer } from "../src/sources/geocuritiba.js";
import { placeAtPointOutput } from "../src/tools/placeAtPoint.js";
import { connectClient, errorOf, stubFetch, type Route } from "./helpers.js";

// place_at_point as one facade (v0.32.0): place, service areas and census under one host gate and one call budget.
// Synthetic answers only, with the real fields of each layer.
const JSON_TYPE = "application/json; charset=UTF-8";
const AT = { lat: -25.42961234, lon: -49.27131234 };
const P = roundPoint(AT.lat, AT.lon);
const OTHER = roundPoint(-25.45, -49.25);
const attrs = (list: Record<string, unknown>[]) => JSON.stringify({ features: list.map((attributes) => ({ attributes })) });
const EMPTY = attrs([]);
const STREETS = JSON.stringify({
  spatialReference: { wkid: 4326 },
  features: [{ attributes: { gtm_nm_logradouro: "RUA TESTE" }, geometry: { paths: [[[P.lon + 0.0001, P.lat - 0.001], [P.lon + 0.0001, P.lat + 0.001]]] } }],
});
const BODIES: Record<PointLayer, string> = {
  bairro: attrs([{ nome: "BAIRRO TESTE", nm_regional: "REGIONAL TESTE" }]),
  zoning_decree: attrs([{ sg_zona: "ZT-1", nm_zona: "ZONA TESTE 1", legislacao: "DECRETO TESTE", data_versao: "2020-08" }]),
  zoning_law: EMPTY,
  street: STREETS,
  health_area: attrs([{ nome: "US TESTE", distrito: "DISTRITO TESTE", data: "março/2022", fonte: "SMS-PMC", geometriaaproximada: 0 }]),
  cras_territory: attrs([{ nome: "CRAS TESTE", tipo: "CRAS", regional: "REGIONAL TESTE", data: "MAR-2019", fonte: "FAS", geometriaaproximada: 0 }]),
  pm_company: attrs([{ nm_batalhao: "99º Batalhão", sg_batalhao: "99º BPM", nm_companhia: "1ª Companhia", sg_companhia: "1ª CIA", data_atualizacao: "09/2025", fonte: "PMPR TESTE" }]),
  civil_district: attrs([{ nm_divisao: "Divisão Teste", nm_distrito: "99º Distrito Policial", sg_distrito: "99º DP", fonte: "PCPR TESTE" }]),
  fire_platoon: attrs([{ batalhao: "Batalhão Teste", companhia: "Companhia Teste", pelotao: "Pelotão Teste", sigla: "9ª Pel. BM", fonte: "CBMPR TESTE" }]),
  census_sector: attrs([{ cd_setor: "410690205010084", nm_bairro: "São Francisco", v0001: 231, v0007: 129, area_km2: 0.19, dens_pop_km2: 1229.99, renda_media: 4583.33 }]),
};
const TOTALS_KEY = `GET ${censusBairroUrl("São Francisco", 20)}`;
const TOTALS = attrs([{ persons: 5008, households: 2395, area_km2: 1.3055, sectors: 12 }]);
const key = (layer: PointLayer, p: Point = P) => `GET ${pointQueryUrl(layer, p)}`;

function routes(over: Partial<Record<PointLayer, string>> = {}, p: Point = P): Record<string, Route> {
  const out: Record<string, Route> = { [TOTALS_KEY]: { contentType: JSON_TYPE, body: TOTALS } };
  for (const layer of Object.keys(BODIES) as PointLayer[]) out[key(layer, p)] = { contentType: JSON_TYPE, body: over[layer] ?? BODIES[layer] };
  return out;
}

afterEach(() => {
  vi.useRealTimers();
});

/** Several calls started at once, on fake timers (the host gate spaces requests 5 s apart). */
async function callAll(...argsList: Record<string, unknown>[]) {
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  const client = await connectClient();
  const pending = argsList.map((args) => client.callTool({ name: "place_at_point", arguments: args }));
  await vi.advanceTimersByTimeAsync(120_000);
  return Promise.all(pending);
}

async function facade(args: Record<string, unknown>) {
  const [res] = await callAll(args);
  expect(res!.isError).toBeFalsy();
  return placeAtPointOutput.parse(res!.structuredContent);
}

const answered = (out: ReturnType<typeof placeAtPointOutput.parse>) =>
  (["place", "service_areas", "census"] as const).filter((part) => out.data[part] !== null);

describe("place_at_point include", () => {
  it.each<[string[], string[], PointLayer[]]>([
    [["place"], ["place"], ["bairro", "zoning_decree", "street"]],
    [["service_areas"], ["service_areas"], ["health_area", "cras_territory"]],
    [["census"], ["census"], ["census_sector"]],
    [["place", "service_areas"], ["place", "service_areas"], ["bairro", "health_area", "zoning_decree", "cras_territory"]],
    [["census", "place"], ["place", "census"], ["bairro", "census_sector", "zoning_decree"]],
    [["service_areas", "census", "service_areas"], ["service_areas", "census"], ["health_area", "census_sector", "cras_territory"]],
  ])("include %j answers %j and asks only their layers, first layer of each part first", async (include, parts, layers) => {
    const calls = stubFetch(routes());
    const out = await facade({ ...AT, include });
    expect(answered(out)).toEqual(parts);
    expect(out.data.point).toEqual({ lat: -25.4296, lon: -49.2713 });
    const asked = calls.map((c) => `GET ${c.url}`).filter((u) => u !== TOTALS_KEY);
    expect(asked.slice(0, layers.length)).toEqual(layers.map((l) => key(l)));
    expect(out.notes[0]).toMatch(/untrusted third-party text/);
    expect(out.license_note).toMatch(/IPPUC/);
  });

  it("a whole call within the budget (warm cache for the first two parts) has every part and partial false", async () => {
    stubFetch(routes());
    await facade({ ...AT, include: ["place", "service_areas"] });
    const out = await facade(AT);
    expect(answered(out)).toEqual(["place", "service_areas", "census"]);
    expect(out.data.partial).toBe(false);
    expect(out.data.census).toMatchObject({ sector: { households: 129 }, neighbourhood: { persons: 5008 }, source: expect.stringMatching(/IBGE/) });
    expect(out.data.service_areas).toMatchObject({ areas: "care", health_units: [{ name: "US TESTE" }], cras: [{ name: "CRAS TESTE" }] });
    expect(out.data.place).toMatchObject({ bairro: "BAIRRO TESTE", nearest_street: { name: "RUA TESTE" }, source: "Fonte: IPPUC/GeoCuritiba" });
  });

  it("areas all gives both groups with both credits and both caveats", async () => {
    stubFetch(routes());
    const out = await facade({ ...AT, include: ["service_areas"], areas: "all" });
    expect(out.data.service_areas).toMatchObject({
      areas: "all",
      health_units: [{ name: "US TESTE" }],
      cras: [{ name: "CRAS TESTE" }],
      police_military: [{ company: "1ª Companhia" }],
      police_civil: [{ district: "99º Distrito Policial" }],
      fire: [{ platoon: "Pelotão Teste" }],
      partial: false,
      source: "Fonte: IPPUC/GeoCuritiba (SMS e FAS); Fonte: IPPUC/GeoCuritiba (PMPR, PCPR e CBMPR)",
    });
    expect(out.notes.join(" ")).toMatch(/Not for emergencies: call 190/);
    expect(out.notes.join(" ")).toMatch(/reference_date/);
  });

  it("areas all with the safety group failing: care lists as read, safety lists null (not read), partial", async () => {
    stubFetch({ ...routes(), [key("pm_company")]: { status: 500 } });
    const out = await facade({ ...AT, include: ["service_areas"], areas: "all" });
    // The failure is remembered by the host gate, so the CRAS layer after it is not read either: null, not empty.
    expect(out.data.service_areas).toMatchObject({
      areas: "all", health_units: [{ name: "US TESTE" }], cras: null, police_military: null, police_civil: null, fire: null, partial: true,
    });
    expect(out.data.partial).toBe(true);
    expect(out.notes.join(" ")).toMatch(/the service areas \(safety\) part was not read/);
  });

  it("areas all with the care group failing: care lists null (not read), safety lists as read, partial", async () => {
    stubFetch(routes());
    await facade({ ...AT, include: ["service_areas"], areas: "safety" });
    stubFetch({ ...routes(), [key("health_area")]: { status: 500 } });
    const out = await facade({ ...AT, include: ["service_areas"], areas: "all" });
    expect(out.data.service_areas).toMatchObject({
      areas: "all", health_units: null, cras: null, police_military: [{ company: "1ª Companhia" }], police_civil: [{ district: "99º Distrito Policial" }], fire: [{ platoon: "Pelotão Teste" }], partial: true,
    });
    expect(out.notes.join(" ")).toMatch(/the service areas \(care\) part was not read/);
  });

  it("areas all with both groups failing is an error, as before", async () => {
    stubFetch({ ...routes(), [key("health_area")]: { status: 500 } });
    expect(errorOf((await callAll({ ...AT, include: ["service_areas"], areas: "all" }))[0]!)).toMatchObject({ error: "source_unavailable" });
  });

  it.each([[{ include: [] }], [{ include: ["voters"] }], [{ areas: "everything" }]])("refuses %j", async (over) => {
    const calls = stubFetch({});
    expect((await callAll({ ...AT, ...over }))[0]!.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("place_at_point call budget", () => {
  it("a cold call reads the first layer of every part; the budget cuts later layers, never a guess", async () => {
    const calls = stubFetch(routes());
    const out = await facade(AT);
    expect(calls.map((c) => `GET ${c.url}`)).toEqual([
      key("bairro"), key("health_area"), key("census_sector"), key("zoning_decree"), key("cras_territory"),
    ]);
    expect(answered(out)).toEqual(["place", "service_areas", "census"]);
    expect(out.data.partial).toBe(true);
    expect(out.data.place).toMatchObject({ zoning: [{ code: "ZT-1" }], nearest_street: null, partial: true });
    expect(out.data.census).toMatchObject({ sector: { households: 129 }, neighbourhood: null, partial: true });
    expect(out.notes.join(" ")).toMatch(/street layer could not be read now. It was not asked: the call's time budget ran out/);
    expect(out.notes.join(" ")).not.toMatch(/host was busy or failing/);
  });

  it("a part whose first request is past the budget is null, partial, with a note", async () => {
    stubFetch({ ...routes(), ...routes({}, OTHER) });
    // The first call takes the gate's first slots; the second call's census would start after its budget.
    const [, second] = await callAll(AT, { lat: OTHER.lat, lon: OTHER.lon });
    const out = placeAtPointOutput.parse(second!.structuredContent);
    expect(out.data.census).toBeNull();
    expect(out.data.partial).toBe(true);
    expect(out.notes).toContain("Partial: the census part was not read. It was not asked: the call's time budget ran out (requests to the host are 5 s apart); call again, the layers already read are cached.");
  });
});

describe("place_at_point outside Curitiba and privacy", () => {
  it("a point in the box but in no Curitiba layer answers inside_curitiba false in every part, one request each", async () => {
    const calls = stubFetch(routes({ bairro: EMPTY, health_area: EMPTY, census_sector: EMPTY }));
    const out = await facade(AT);
    expect(out.data.place).toMatchObject({ inside_curitiba: false, bairro: null, zoning: null });
    expect(out.data.service_areas).toMatchObject({ inside_curitiba: false, health_units: [], cras: null });
    expect(out.data.census).toMatchObject({ inside_curitiba: false, sector: null });
    expect(out.data.partial).toBe(false);
    expect(calls.map((c) => `GET ${c.url}`)).toEqual([key("bairro"), key("health_area"), key("census_sector")]);
  });

  it("outside Curitiba with areas all, every list not asked is null and the first layer of each group is empty", async () => {
    stubFetch(routes({ bairro: EMPTY, health_area: EMPTY, pm_company: EMPTY }));
    const out = await facade({ ...AT, include: ["service_areas"], areas: "all" });
    expect(out.data.service_areas).toMatchObject({
      areas: "all", inside_curitiba: false, health_units: [], cras: null, police_military: [], police_civil: null, fire: null, partial: false,
    });
    expect(out.data.partial).toBe(false);
  });

  it("a point outside the box is refused without a request", async () => {
    const calls = stubFetch({});
    expect(errorOf((await callAll({ lat: -23.5, lon: -46.6 }))[0]!)).toMatchObject({ error: "invalid_argument" });
    expect(calls).toHaveLength(0);
  });

  it.each([19, 0])("a sector of %i households stays withheld through the facade: no figure of it anywhere", async (households) => {
    stubFetch(routes({ census_sector: attrs([{ cd_setor: "410690205010084", nm_bairro: "São Francisco", v0001: 37, v0007: households, area_km2: 0.02, dens_pop_km2: 1850.5, renda_media: 9876.54 }]) }));
    const out = await facade({ ...AT, include: ["census"] });
    expect(out.data.census).toMatchObject({ sector: null, sector_withheld: true, neighbourhood: { persons: 5008 } });
    expect(JSON.stringify(out)).not.toMatch(/9876|1850|410690205010084/);
    expect(out.notes.join(" ")).toMatch(/fewer than 20 occupied private households: its figures are withheld/);
  });

  it("every part failing is an error, not an empty answer", async () => {
    const failing: Record<string, Route> = {};
    for (const [k, r] of Object.entries(routes())) failing[k] = { ...r, status: 500 };
    stubFetch(failing);
    expect(errorOf((await callAll(AT))[0]!)).toMatchObject({ error: "source_unavailable" });
  });
});
