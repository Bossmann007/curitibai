import { afterEach, describe, expect, it, vi } from "vitest";
import { pointQueryUrl, roundPoint, THEMATIC_SERVICE_URL, type PointLayer, type PointReads } from "../src/sources/geocuritiba.js";
import { OutOfTimeError } from "../src/hostGate.js";
import { SourceRefusedError, SourceUnavailableError } from "../src/http.js";
import { missingNote, serviceAreasAt, serviceAreasAtPointOutput } from "../src/tools/serviceAreasAtPoint.js";
import { connectClient, errorOf, pointPart, stubFetch, type Route } from "./helpers.js";

// Synthetic answers only (invented names and dates, the real fields and shapes of layers 19 and 5 as read on 2026-11-23).
const JSON_TYPE = "application/json; charset=UTF-8";
const AT = { lat: -25.42961234, lon: -49.27131234 };
const P = roundPoint(AT.lat, AT.lon);
const attrs = (list: Record<string, unknown>[]) => JSON.stringify({ features: list.map((attributes) => ({ attributes })) });
const HEALTH = attrs([{ nome: "US TESTE", distrito: "DISTRITO TESTE", data: "março/2022", fonte: "SMS-PMC", geometriaaproximada: null }]);
const CRAS = attrs([{ nome: "CRAS TESTE", tipo: "CRAS", regional: "REGIONAL TESTE", data: "MAR-2019", fonte: "FAS", geometriaaproximada: 0 }]);
const BAIRRO = attrs([{ nome: "BAIRRO TESTE", nm_regional: "REGIONAL TESTE" }]);
const EMPTY = attrs([]);

type AreaLayer = Extract<PointLayer, "bairro" | "health_area" | "cras_territory">;
type SafetyLayer = Extract<PointLayer, "bairro" | "pm_company" | "civil_district" | "fire_platoon">;
const key = (layer: AreaLayer | SafetyLayer) => `GET ${pointQueryUrl(layer, P)}`;
// Synthetic, with the real fields of layers 27, 25 and 41 as read on 2026-11-24.
const PM = attrs([{ nm_batalhao: "99º Batalhão", sg_batalhao: "99º BPM", nm_companhia: "1ª Companhia", sg_companhia: "1ª CIA", data_atualizacao: "09/2025", fonte: "PMPR TESTE" }]);
const CIVIL = attrs([{ nm_divisao: "Divisão Teste", nm_distrito: "99º Distrito Policial", sg_distrito: "99º DP", fonte: "PCPR TESTE" }]);
const FIRE = attrs([{ batalhao: "Batalhão Teste", companhia: "Companhia Teste", pelotao: "Pelotão Teste", sigla: "9ª Pel. BM", fonte: "CBMPR TESTE" }]);
function safetyRoutes(over: Partial<Record<SafetyLayer, Route>> = {}): Record<string, Route> {
  const base: Record<SafetyLayer, Route> = { bairro: { body: BAIRRO }, pm_company: { body: PM }, civil_district: { body: CIVIL }, fire_platoon: { body: FIRE } };
  const out: Record<string, Route> = {};
  for (const layer of Object.keys(base) as SafetyLayer[]) out[key(layer)] = { contentType: JSON_TYPE, ...base[layer], ...over[layer] };
  return out;
}
function routes(over: Partial<Record<AreaLayer, Route>> = {}): Record<string, Route> {
  const base: Record<AreaLayer, Route> = { bairro: { body: BAIRRO }, health_area: { body: HEALTH }, cras_territory: { body: CRAS } };
  const out: Record<string, Route> = {};
  for (const layer of Object.keys(base) as AreaLayer[]) out[key(layer)] = { contentType: JSON_TYPE, ...base[layer], ...over[layer] };
  return out;
}

afterEach(() => {
  vi.useRealTimers();
});

/** The host gate spaces requests 5 s apart: run the call on fake timers and let them pass. */
async function call(args: Record<string, unknown>) {
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  const client = await connectClient();
  const pending = client.callTool({ name: "place_at_point", arguments: { include: ["service_areas"], ...args } });
  await vi.advanceTimersByTimeAsync(60_000);
  return pending;
}

async function areas(args: Record<string, unknown> = AT) {
  const res = await call(args);
  expect(res.isError).toBeFalsy();
  return pointPart(res.structuredContent, "service_areas");
}

describe("service_areas_at_point query URLs", () => {
  it("uses the GeoCuritiba/ folder of the thematic service (the root-level name answers 499)", () => {
    expect(THEMATIC_SERVICE_URL).toBe(
      "https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer",
    );
  });

  it("is a fixed point query on layers 19 and 5 with the rounded point only", () => {
    const layers: [Exclude<AreaLayer, "bairro">, number, string][] = [
      ["health_area", 19, "nome,distrito,data,fonte,geometriaaproximada"],
      ["cras_territory", 5, "nome,tipo,regional,data,fonte,geometriaaproximada"],
    ];
    for (const [layer, id, fields] of layers) {
      const u = new URL(pointQueryUrl(layer, P));
      expect(u.pathname).toBe(`/server/rest/services/GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer/${id}/query`);
      expect(Object.fromEntries(u.searchParams)).toEqual({
        geometry: "-49.2713,-25.4296",
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        outFields: fields,
        returnGeometry: "false",
        f: "json",
      });
    }
  });
});

describe("service_areas_at_point answers", () => {
  it("returns the health unit and CRAS areas with their reference dates and the rounded point only", async () => {
    const calls = stubFetch(routes());
    const res = await call(AT);
    const out = pointPart(res.structuredContent, "service_areas");
    expect(out.data).toEqual({
      lat: -25.4296,
      lon: -49.2713,
      areas: "care",
      inside_curitiba: true,
      health_units: [{ name: "US TESTE", district: "DISTRITO TESTE", reference_date: "março/2022", source_agency: "SMS-PMC", approximate: null }],
      cras: [{ name: "CRAS TESTE", type: "CRAS", regional: "REGIONAL TESTE", reference_date: "MAR-2019", source_agency: "FAS", approximate: false }],
      police_military: null,
      police_civil: null,
      fire: null,
      property_registry: null,
      civil_registry: null,
      electoral_zones: null,
      partial: false,
    });
    expect(out.source).toBe("Fonte: IPPUC/GeoCuritiba (SMS e FAS)");
    expect(out.source_url).toBe(THEMATIC_SERVICE_URL);
    expect(out.note).toMatch(/may have changed/);
    expect(calls.map((c) => c.url)).toEqual([key("health_area"), key("cras_territory")].map((k) => k.slice(4)));
    // The full-precision position appears nowhere: not in a URL, not in the answer.
    expect(JSON.stringify(res) + JSON.stringify(calls)).not.toMatch(/4296123|2713123/);
  });

  it("a point with no area in either layer is an answer with empty lists and a note; the bairro layer says it is inside", async () => {
    const calls = stubFetch(routes({ health_area: { body: EMPTY }, cras_territory: { body: EMPTY } }));
    const out = await areas();
    expect(out.data).toMatchObject({ inside_curitiba: true, health_units: [], cras: [], partial: false });
    expect(calls.map((c) => c.url)).toEqual([key("health_area"), key("bairro"), key("cras_territory")].map((k) => k.slice(4)));
    expect(out.note).toMatch(/No health unit area found here \(not covered by the layer\)/);
    expect(out.note).toMatch(/No CRAS territory found here/);
  });

  it("a point in no health area and no Curitiba neighbourhood is inside_curitiba false; the CRAS layer is not asked", async () => {
    const calls = stubFetch(routes({ health_area: { body: EMPTY }, bairro: { body: EMPTY } }));
    const out = await areas();
    expect(out.data).toMatchObject({ inside_curitiba: false, health_units: [], cras: null, partial: false });
    expect(out.note).toMatch(/no Curitiba neighbourhood .*contains this point/);
    expect(out.note).not.toMatch(/No health unit area found/);
    expect(calls.map((c) => c.url)).toEqual([key("health_area"), key("bairro")].map((k) => k.slice(4)));
  });

  it("a health area means inside: the bairro layer is not asked, so a gap in it hides nothing", async () => {
    const calls = stubFetch(routes({ bairro: { body: EMPTY } }));
    const out = await areas();
    expect(out.data).toMatchObject({ inside_curitiba: true, partial: false });
    expect(out.data.health_units).toHaveLength(1);
    expect(calls.map((c) => c.url)).not.toContain(key("bairro").slice(4));
  });

  it("one empty layer keeps the other", async () => {
    stubFetch(routes({ cras_territory: { body: EMPTY } }));
    const out = await areas();
    expect(out.data.health_units).toHaveLength(1);
    expect(out.data.cras).toEqual([]);
    expect(out.note).not.toMatch(/No health unit area/);
  });

  it("missing fields are null; a feature with none of the fields is skipped", async () => {
    stubFetch(routes({
      health_area: { body: attrs([{ nome: "US TESTE" }, { other: "x" }, { geometriaaproximada: 1 }]) },
      cras_territory: { body: attrs([{ regional: "R" }]) },
    }));
    const out = await areas();
    expect(out.data.health_units).toEqual([{ name: "US TESTE", district: null, reference_date: null, source_agency: null, approximate: null }]);
    expect(out.data.cras).toEqual([{ name: null, type: null, regional: "R", reference_date: null, source_agency: null, approximate: null }]);
  });

  it("geometriaaproximada: 1 is true, 0 false, anything else null", async () => {
    stubFetch(routes({
      health_area: { body: attrs([{ nome: "A", geometriaaproximada: 1 }, { nome: "B", geometriaaproximada: 0 }, { nome: "C", geometriaaproximada: "1" }]) },
    }));
    expect((await areas()).data.health_units!.map((h) => h.approximate)).toEqual([true, false, null]);
  });

  it("a point on a boundary lists the areas distinct, sorted by name, at most 3, and says so", async () => {
    const u = (nome: string) => ({ nome, distrito: "D", data: "março/2022", fonte: "SMS-PMC" });
    stubFetch(routes({ health_area: { body: attrs([u("US ZETA"), u("US ALFA"), u("US ZETA"), u("US BETA"), u("US GAMA")]) } }));
    const out = await areas();
    expect(out.data.health_units!.map((h) => h.name)).toEqual(["US ALFA", "US BETA", "US GAMA"]);
    expect(out.note).toMatch(/boundary/);
  });

  it("two rows with the same name are one area (the first kept), not a boundary", async () => {
    stubFetch(routes({
      health_area: { body: attrs([{ nome: "US TESTE", fonte: "SMS-PMC", data: "março/2022" }, { nome: "US TESTE", fonte: null, data: "junho/2019" }]) },
    }));
    const out = await areas();
    expect(out.data.health_units).toEqual([{ name: "US TESTE", district: null, reference_date: "março/2022", source_agency: "SMS-PMC", approximate: null }]);
    expect(out.note).not.toMatch(/boundary/);
  });

  it("a nameless row next to a named one is dropped and makes no boundary", async () => {
    stubFetch(routes({ cras_territory: { body: attrs([{ regional: "R" }, { nome: "CRAS TESTE", regional: "R" }]) } }));
    const out = await areas();
    expect(out.data.cras!.map((c) => c.name)).toEqual(["CRAS TESTE"]);
    expect(out.note).not.toMatch(/boundary/);
  });

  it("text fields are cleaned and masked like the other GeoCuritiba fields", async () => {
    stubFetch(routes({ health_area: { body: attrs([{ nome: "US‮ 33334444" }]) } }));
    expect((await areas()).data.health_units![0]?.name).toBe("US [masked]");
  });
});

describe("service_areas_at_point areas: safety (v0.27.0)", () => {
  it("asks fixed point queries on layers 27, 25 and 41 with the rounded point only", () => {
    const layers: [Exclude<SafetyLayer, "bairro">, number, string][] = [
      ["pm_company", 27, "nm_batalhao,sg_batalhao,nm_companhia,sg_companhia,data_atualizacao,fonte"],
      ["civil_district", 25, "nm_divisao,nm_distrito,sg_distrito,fonte"],
      ["fire_platoon", 41, "batalhao,companhia,pelotao,sigla,fonte"],
    ];
    for (const [layer, id, fields] of layers) {
      const u = new URL(pointQueryUrl(layer, P));
      expect(u.pathname.endsWith(`/Publico_Interno_GeoCuritiba_BaseTematica/MapServer/${id}/query`)).toBe(true);
      expect(u.searchParams.get("geometry")).toBe("-49.2713,-25.4296");
      expect(u.searchParams.get("outFields")).toBe(fields);
    }
  });

  it("returns the police and fire areas in 3 requests (PM, civil, fire), no health or CRAS request", async () => {
    const calls = stubFetch(safetyRoutes());
    const res = await call({ ...AT, areas: "safety" });
    const out = pointPart(res.structuredContent, "service_areas");
    expect(out.data).toEqual({
      lat: -25.4296,
      lon: -49.2713,
      areas: "safety",
      inside_curitiba: true,
      health_units: null,
      cras: null,
      police_military: [{ battalion: "99º Batalhão", battalion_code: "99º BPM", company: "1ª Companhia", company_code: "1ª CIA", reference_date: "09/2025", source_agency: "PMPR TESTE" }],
      police_civil: [{ district: "99º Distrito Policial", district_code: "99º DP", division: "Divisão Teste", source_agency: "PCPR TESTE" }],
      fire: [{ platoon: "Pelotão Teste", platoon_code: "9ª Pel. BM", company: "Companhia Teste", battalion: "Batalhão Teste", source_agency: "CBMPR TESTE" }],
      property_registry: null,
      civil_registry: null,
      electoral_zones: null,
      partial: false,
    });
    expect(out.source).toBe("Fonte: IPPUC/GeoCuritiba (PMPR, PCPR e CBMPR)");
    expect(out.note).toMatch(/Not for emergencies: call 190 \(police\) or 193 \(fire\)/);
    expect(calls.map((c) => c.url)).toEqual([key("pm_company"), key("civil_district"), key("fire_platoon")].map((k) => k.slice(4)));
    expect(JSON.stringify(res) + JSON.stringify(calls)).not.toMatch(/4296123|2713123/);
  });

  it("no PM area: the bairro layer decides; outside Curitiba nothing else is asked", async () => {
    const calls = stubFetch(safetyRoutes({ pm_company: { body: EMPTY }, bairro: { body: EMPTY } }));
    const out = await areas({ ...AT, areas: "safety" });
    expect(out.data).toMatchObject({ inside_curitiba: false, police_military: [], police_civil: null, fire: null, partial: false });
    expect(calls.map((c) => c.url)).toEqual([key("pm_company"), key("bairro")].map((k) => k.slice(4)));
  });

  it("a refusal on the Polícia Civil layer is partial (the fire layer is then not asked), never a failed call", async () => {
    const calls = stubFetch(safetyRoutes({ civil_district: { body: '{"error":{"code":403}}' } }));
    const out = await areas({ ...AT, areas: "safety" });
    expect(out.data).toMatchObject({ partial: true, police_civil: null, fire: null });
    expect(out.data.police_military).toHaveLength(1);
    expect(out.note).toMatch(/Partial: the Polícia Civil and fire layer could not be read now\. The source refused this server/);
    expect(calls.map((c) => c.url)).not.toContain(key("fire_platoon").slice(4));
  });

  it("a failing fire layer alone is partial and keeps the other areas", async () => {
    stubFetch(safetyRoutes({ fire_platoon: { status: 500 } }));
    const out = await areas({ ...AT, areas: "safety" });
    expect(out.data).toMatchObject({ partial: true, fire: null });
    expect(out.data.police_civil).toHaveLength(1);
    expect(out.note).toMatch(/Partial: the fire layer could not be read now\. The host was busy or failing/);
  });

  it("a failing PM layer is source_unavailable", async () => {
    stubFetch(safetyRoutes({ pm_company: { status: 500 } }));
    expect(errorOf(await call({ ...AT, areas: "safety" }))).toMatchObject({ error: "source_unavailable" });
  });

  it("names why a later layer is missing: a refusal first, then the time budget, else a busy host", () => {
    expect(missingNote([new OutOfTimeError(0)])).toMatch(/not asked: the call's time budget ran out/);
    expect(missingNote([new OutOfTimeError(0), new SourceUnavailableError("x")])).toMatch(/busy or failing/);
    expect(missingNote([new OutOfTimeError(0), new SourceRefusedError(403)])).toMatch(/refused this server/);
  });

  it("an unknown areas value is refused", async () => {
    expect((await call({ ...AT, areas: "police" })).isError).toBe(true);
  });
});

// Synthetic, with the real fields of layers 15 and 16 as read on 2026-11-26 (invented values).
type RegistryLayer = Extract<PointLayer, "bairro" | "property_registry" | "civil_registry">;
const rkey = (layer: RegistryLayer) => `GET ${pointQueryUrl(layer, P)}`;
const LEGAL = "Leis Estaduais 1111/1960, 2222/1961, 3333/1962, 4444/1963, 5555/1964 e Acordo 66666/2000, texto longo de teste";
const PROPERTY = attrs([{ circunscricao: "9ª CIRCUNSCRIÇÃO", fonte: "Tribunal Teste, 1900" }]);
const CIVIL_REG = attrs([{ servicos: "9º SERVIÇO DE REGISTRO CIVIL", fonte: LEGAL }]);
function registryRoutes(over: Partial<Record<RegistryLayer, Route>> = {}): Record<string, Route> {
  const base: Record<RegistryLayer, Route> = { bairro: { body: BAIRRO }, property_registry: { body: PROPERTY }, civil_registry: { body: CIVIL_REG } };
  const out: Record<string, Route> = {};
  for (const layer of Object.keys(base) as RegistryLayer[]) out[rkey(layer)] = { contentType: JSON_TYPE, ...base[layer], ...over[layer] };
  return out;
}

describe("place_at_point service_areas, areas: registry (v0.57.0)", () => {
  it("asks layers 15 and 16 for the shown fields only: never created_user, last_edited_user or nome", () => {
    const layers: [Exclude<RegistryLayer, "bairro">, number, string][] = [
      ["property_registry", 15, "circunscricao,fonte"],
      ["civil_registry", 16, "servicos,fonte"],
    ];
    for (const [layer, id, fields] of layers) {
      const u = new URL(pointQueryUrl(layer, P));
      expect(u.pathname.endsWith(`/Publico_Interno_GeoCuritiba_BaseTematica/MapServer/${id}/query`)).toBe(true);
      expect(u.searchParams.get("geometry")).toBe("-49.2713,-25.4296");
      expect(u.searchParams.get("outFields")).toBe(fields);
      expect(u.toString()).not.toMatch(/created_user|last_edited_user|nome/);
    }
  });

  it("returns the circunscrição imobiliária and the registro civil serviço with their legal basis in 2 requests", async () => {
    const calls = stubFetch(registryRoutes());
    const res = await call({ ...AT, areas: "registry" });
    const out = pointPart(res.structuredContent, "service_areas");
    expect(out.data).toEqual({
      lat: -25.4296,
      lon: -49.2713,
      areas: "registry",
      inside_curitiba: true,
      health_units: null,
      cras: null,
      police_military: null,
      police_civil: null,
      fire: null,
      property_registry: [{ circumscription: "9ª CIRCUNSCRIÇÃO", legal_basis: "Tribunal Teste, 1900" }],
      civil_registry: [{ service: "9º SERVIÇO DE REGISTRO CIVIL", legal_basis: LEGAL }],
      electoral_zones: null,
      partial: false,
    });
    expect(out.note).toMatch(/does not replace a certidão/);
    expect(out.note).toMatch(/cartorio de registro civil/);
    expect(calls.map((c) => c.url)).toEqual([rkey("property_registry"), rkey("civil_registry")].map((k) => k.slice(4)));
  });

  it("no property area: the bairro layer decides; outside Curitiba the civil layer is not asked", async () => {
    const calls = stubFetch(registryRoutes({ property_registry: { body: EMPTY }, bairro: { body: EMPTY } }));
    const out = await areas({ ...AT, areas: "registry" });
    expect(out.data).toMatchObject({ inside_curitiba: false, property_registry: [], civil_registry: null, partial: false });
    expect(calls.map((c) => c.url)).toEqual([rkey("property_registry"), rkey("bairro")].map((k) => k.slice(4)));
  });

  it("a failing civil layer is partial and keeps the property area", async () => {
    stubFetch(registryRoutes({ civil_registry: { status: 500 } }));
    const out = await areas({ ...AT, areas: "registry" });
    expect(out.data).toMatchObject({ partial: true, civil_registry: null, property_registry: [{ circumscription: "9ª CIRCUNSCRIÇÃO" }] });
    expect(out.note).toMatch(/Partial: the registro civil layer could not be read now/);
  });

  it("two nameless property rows are not called a boundary", async () => {
    const nameless = attrs([{ circunscricao: null, fonte: "Fonte A" }, { circunscricao: null, fonte: "Fonte B" }]);
    stubFetch(registryRoutes({ property_registry: { body: nameless } }));
    expect((await areas({ ...AT, areas: "registry" })).note).not.toMatch(/boundary/);
  });

  it("two named property rows are a boundary", async () => {
    const named = attrs([{ circunscricao: "8ª CIRCUNSCRIÇÃO", fonte: "X" }, { circunscricao: "9ª CIRCUNSCRIÇÃO", fonte: "X" }]);
    stubFetch(registryRoutes({ property_registry: { body: named } }));
    expect((await areas({ ...AT, areas: "registry" })).note).toMatch(/on a boundary/);
  });

  it("a failing property layer is source_unavailable", async () => {
    stubFetch(registryRoutes({ property_registry: { status: 500 } }));
    expect(errorOf(await call({ ...AT, areas: "registry" }))).toMatchObject({ error: "source_unavailable" });
  });

  it("care and safety lists are null for registry, and registry lists null for care", async () => {
    stubFetch(routes());
    const out = await areas();
    expect(out.data).toMatchObject({ property_registry: null, civil_registry: null });
  });
});

describe("service_areas_at_point input", () => {
  it.each([[{ lat: -23.55, lon: -46.63 }], [{ lat: -25.71, lon: -49.27 }], [{ lat: -25.43, lon: -49.14 }]])(
    "refuses a point outside Curitiba's box %j without a request",
    async (args) => {
      const calls = stubFetch({});
      expect(errorOf(await call(args))).toEqual({ error: "invalid_argument", message: expect.stringMatching(/outside Curitiba/) });
      expect(calls).toHaveLength(0);
    },
  );

  it.each([[{ lat: -25.43 }], [{ lat: "x", lon: -49.27 }], [{ lat: 91, lon: -49.27 }]])("rejects %j", async (args) => {
    stubFetch({});
    expect((await call(args)).isError).toBe(true);
  });
});

describe("service_areas_at_point errors", () => {
  it.each<[string, Route, unknown]>([
    ["an ArcGIS error 400 with HTTP 200", { body: '{"error":{"code":400,"message":"Invalid or missing input parameters."}}' }, { error: "source_unavailable" }],
    ["HTTP 500", { status: 500 }, { error: "source_unavailable" }],
    ["HTTP 503", { status: 503 }, { error: "source_unavailable" }],
    ["an HTML body", { contentType: "text/html", body: "<html></html>" }, { error: "source_unavailable" }],
    ["no features array", { body: "{}" }, { error: "source_unavailable" }],
    ["a cut answer", { body: '{"features":[],"exceededTransferLimit":true}' }, { error: "source_unavailable" }],
  ])("the health layer failing with %s is an error, never data", async (_, r, expected) => {
    const calls = stubFetch(routes({ health_area: r }));
    expect(errorOf(await call(AT))).toEqual(expected);
    expect(calls).toHaveLength(1);
  });

  it.each<[string, Route]>([
    ["HTTP 500", { status: 500 }],
    ["an ArcGIS error 400 with HTTP 200", { body: '{"error":{"code":400}}' }],
  ])("the bairro layer failing with %s (no health area) is an error and the CRAS layer is not asked", async (_, r) => {
    const calls = stubFetch(routes({ health_area: { body: EMPTY }, bairro: r }));
    expect(errorOf(await call(AT))).toEqual({ error: "source_unavailable" });
    expect(calls).toHaveLength(2);
  });

  it.each<[string, Partial<Record<AreaLayer, Route>>, number]>([
    ["health", { health_area: { body: '{"error":{"code":499,"message":"Token Required"}}' } }, 1],
    ["bairro", { health_area: { body: EMPTY }, bairro: { body: '{"error":{"code":499,"message":"Token Required"}}' } }, 2],
  ])("a 499 in an HTTP 200 body on the %s layer blocks the host: place_at_point is not asked either", async (_, over, n) => {
    const calls = stubFetch(routes(over));
    expect(errorOf(await call(AT))).toMatchObject({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    expect(errorOf(await call({ ...AT, include: ["place"] }))).toMatchObject({ error: "source_unavailable" });
    expect(calls).toHaveLength(n);
  });

  it.each<[string, Route]>([
    ["HTTP 500", { status: 500 }],
    ["HTTP 503", { status: 503 }],
    ["an ArcGIS error 400 with HTTP 200", { body: '{"error":{"code":400}}' }],
  ])("a CRAS layer failing with %s after the health layer was read is partial", async (_, r) => {
    stubFetch(routes({ cras_territory: r }));
    const out = await areas();
    expect(out.data).toMatchObject({ cras: null, partial: true });
    expect(out.data.health_units).toHaveLength(1);
    expect(out.note).toMatch(/Partial: the CRAS layer could not be read now/);
  });

  it("a refusal on the CRAS layer is partial and says the host is not asked for 10 minutes", async () => {
    stubFetch(routes({ cras_territory: { body: '{"error":{"code":499,"message":"Token Required"}}' } }));
    const out = await areas();
    expect(out.data).toMatchObject({ cras: null, partial: true });
    expect(out.note).toMatch(/refused this server; it is not asked again for 10 minutes/);
  });
});

describe("service_areas_at_point cache", () => {
  it("a second call within the same rounded point makes no request (key is the rounded URL)", async () => {
    const calls = stubFetch(routes());
    await areas(AT);
    await areas({ lat: AT.lat + 0.00001, lon: AT.lon - 0.00001 });
    expect(calls).toHaveLength(2);
  });

  it("shares the bairro answer with place_at_point: the same point asks the bairro layer once", async () => {
    const placeOnly = (layer: PointLayer, body: string): Record<string, Route> => ({
      [`GET ${pointQueryUrl(layer, P)}`]: { body, contentType: JSON_TYPE },
    });
    const calls = stubFetch({
      ...routes({ health_area: { body: EMPTY } }),
      ...placeOnly("zoning_decree", EMPTY),
      ...placeOnly("zoning_law", EMPTY),
      ...placeOnly("street", JSON.stringify({ spatialReference: { wkid: 4326 }, features: [] })),
      ...placeOnly("pgv", EMPTY),
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    const client = await connectClient();
    const place = client.callTool({ name: "place_at_point", arguments: { ...AT, include: ["place"] } });
    await vi.advanceTimersByTimeAsync(60_000);
    await place;
    const pending = client.callTool({ name: "place_at_point", arguments: { ...AT, include: ["service_areas"] } });
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await pending).isError).toBeFalsy();
    expect(calls.filter((c) => c.url === key("bairro").slice(4))).toHaveLength(1);
  });
});

// Synthetic, with the real fields of layer 13 as read on 2026-11-27 UTC (invented values; counts arrive as doubles).
type CivicLayer = Extract<PointLayer, "bairro" | "electoral_zone">;
const ckey = (layer: CivicLayer) => `GET ${pointQueryUrl(layer, P)}`;
const ZONE = attrs([{ zona_eleitoral: "999ª", num_locais: 45.0, num_secoes: 415.0, data_alteracao: "31/08/2099" }]);
function civicRoutes(over: Partial<Record<CivicLayer, Route>> = {}): Record<string, Route> {
  const base: Record<CivicLayer, Route> = { bairro: { body: BAIRRO }, electoral_zone: { body: ZONE } };
  const out: Record<string, Route> = {};
  for (const layer of Object.keys(base) as CivicLayer[]) out[ckey(layer)] = { contentType: JSON_TYPE, ...base[layer], ...over[layer] };
  return out;
}

describe("place_at_point service_areas, areas: civic (v0.66.0)", () => {
  it("asks layer 13 for four fields only: never num_eleitores", () => {
    const u = new URL(pointQueryUrl("electoral_zone", P));
    expect(u.pathname.endsWith("/Publico_Interno_GeoCuritiba_BaseTematica/MapServer/13/query")).toBe(true);
    expect(u.searchParams.get("geometry")).toBe("-49.2713,-25.4296");
    expect(u.searchParams.get("outFields")).toBe("zona_eleitoral,num_locais,num_secoes,data_alteracao");
    expect(u.toString()).not.toMatch(/eleitores|where=/);
  });

  it("returns the electoral zone with its counts in 1 request", async () => {
    const calls = stubFetch(civicRoutes());
    const res = await call({ ...AT, areas: "civic" });
    const out = pointPart(res.structuredContent, "service_areas");
    expect(out.data).toEqual({
      lat: -25.4296,
      lon: -49.2713,
      areas: "civic",
      inside_curitiba: true,
      health_units: null,
      cras: null,
      police_military: null,
      police_civil: null,
      fire: null,
      property_registry: null,
      civil_registry: null,
      electoral_zones: [{ zone: "999ª", polling_places: 45, sections: 415, reference_date: "31/08/2099" }],
      partial: false,
    });
    expect(out.source).toBe("Fonte: IPPUC/GeoCuritiba (TRE-PR)");
    expect(out.note).toMatch(/not necessarily the zone where a person votes/);
    expect(out.note).toMatch(/local de votacao/);
    expect(calls.map((c) => c.url)).toEqual([ckey("electoral_zone").slice(4)]);
    expect(JSON.stringify(res) + JSON.stringify(calls)).not.toMatch(/4296123|2713123/);
  });

  it("a count that is not a non-negative whole number is null; a long zone label is kept whole", async () => {
    const odd = attrs([{ zona_eleitoral: "999ª ZONA ELEITORAL", num_locais: 4.5, num_secoes: -1, data_alteracao: null }]);
    stubFetch(civicRoutes({ electoral_zone: { body: odd } }));
    const out = await areas({ ...AT, areas: "civic" });
    expect(out.data.electoral_zones).toEqual([{ zone: "999ª ZONA ELEITORAL", polling_places: null, sections: null, reference_date: null }]);
  });

  it("no zone: the bairro layer decides; outside Curitiba the zone list is empty and not partial", async () => {
    const calls = stubFetch(civicRoutes({ electoral_zone: { body: EMPTY }, bairro: { body: EMPTY } }));
    const out = await areas({ ...AT, areas: "civic" });
    expect(out.data).toMatchObject({ inside_curitiba: false, electoral_zones: [], partial: false });
    expect(out.note).toMatch(/neighbouring city/);
    expect(calls.map((c) => c.url)).toEqual([ckey("electoral_zone"), ckey("bairro")].map((k) => k.slice(4)));
  });

  it("no zone inside Curitiba says the layer does not cover the point", async () => {
    stubFetch(civicRoutes({ electoral_zone: { body: EMPTY } }));
    const out = await areas({ ...AT, areas: "civic" });
    expect(out.data).toMatchObject({ inside_curitiba: true, electoral_zones: [] });
    expect(out.note).toMatch(/No electoral zone found here/);
  });

  it("two named zones are a boundary", async () => {
    const two = attrs([{ zona_eleitoral: "998ª", num_locais: 1, num_secoes: 2, data_alteracao: "x" }, { zona_eleitoral: "999ª", num_locais: 1, num_secoes: 2, data_alteracao: "x" }]);
    stubFetch(civicRoutes({ electoral_zone: { body: two } }));
    const out = await areas({ ...AT, areas: "civic" });
    expect(out.data.electoral_zones).toHaveLength(2);
    expect(out.note).toMatch(/on a boundary/);
  });

  it("a failing zone layer is source_unavailable", async () => {
    stubFetch(civicRoutes({ electoral_zone: { status: 500 } }));
    expect(errorOf(await call({ ...AT, areas: "civic" }))).toMatchObject({ error: "source_unavailable" });
  });
});

describe("service areas data shape (0.73.0)", () => {
  it("every group answers every list, in the schema's key order; lists of other groups are null", async () => {
    const reads: PointReads = {
      layer: async (layer) => ({ value: layer === "bairro" ? [{ attributes: { nome: "BAIRRO TESTE" }, paths: null }] : [], fetchedAt: "2026-01-01T00:00:00.000Z" }),
      censusBairro: () => null,
    };
    const own = { care: ["health_units", "cras"], safety: ["police_military", "police_civil", "fire"], registry: ["property_registry", "civil_registry"], civic: ["electoral_zones"] };
    for (const g of ["care", "safety", "registry", "civic"] as const) {
      const { data } = await serviceAreasAt({ lat: P.lat, lon: P.lon }, reads, g);
      expect(Object.keys(data)).toEqual(Object.keys(serviceAreasAtPointOutput.shape.data.shape));
      const lists = Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k]) => k);
      expect(lists).toEqual(own[g]);
    }
  });
});
