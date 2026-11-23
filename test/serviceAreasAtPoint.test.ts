import { afterEach, describe, expect, it, vi } from "vitest";
import { pointQueryUrl, roundPoint, THEMATIC_SERVICE_URL, type PointLayer } from "../src/sources/geocuritiba.js";
import { serviceAreasAtPointOutput } from "../src/tools/serviceAreasAtPoint.js";
import { connectClient, errorOf, stubFetch, type Route } from "./helpers.js";

// Synthetic answers only (invented names and dates, the real fields and shapes of layers 19 and 5 as read on 2026-11-23).
const JSON_TYPE = "application/json; charset=UTF-8";
const AT = { lat: -25.42961234, lon: -49.27131234 };
const P = roundPoint(AT.lat, AT.lon);
const attrs = (list: Record<string, unknown>[]) => JSON.stringify({ features: list.map((attributes) => ({ attributes })) });
const HEALTH = attrs([{ nome: "US TESTE", distrito: "DISTRITO TESTE", data: "março/2022", fonte: "SMS-PMC", geometriaaproximada: null }]);
const CRAS = attrs([{ nome: "CRAS TESTE", tipo: "CRAS", regional: "REGIONAL TESTE", data: "MAR-2019", fonte: "FAS", geometriaaproximada: 0 }]);
const EMPTY = attrs([]);

type AreaLayer = Extract<PointLayer, "health_area" | "cras_territory">;
const key = (layer: AreaLayer) => `GET ${pointQueryUrl(layer, P)}`;
function routes(over: Partial<Record<AreaLayer, Route>> = {}): Record<string, Route> {
  const base: Record<AreaLayer, Route> = { health_area: { body: HEALTH }, cras_territory: { body: CRAS } };
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
  const pending = client.callTool({ name: "service_areas_at_point", arguments: args });
  await vi.advanceTimersByTimeAsync(60_000);
  return pending;
}

async function areas(args: Record<string, unknown> = AT) {
  const res = await call(args);
  expect(res.isError).toBeFalsy();
  return serviceAreasAtPointOutput.parse(res.structuredContent);
}

describe("service_areas_at_point query URLs", () => {
  it("uses the GeoCuritiba/ folder of the thematic service (the root-level name answers 499)", () => {
    expect(THEMATIC_SERVICE_URL).toBe(
      "https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer",
    );
  });

  it("is a fixed point query on layers 19 and 5 with the rounded point only", () => {
    const layers: [AreaLayer, number, string][] = [
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
    const out = serviceAreasAtPointOutput.parse(res.structuredContent);
    expect(out.data).toEqual({
      lat: -25.4296,
      lon: -49.2713,
      health_units: [{ name: "US TESTE", district: "DISTRITO TESTE", reference_date: "março/2022", source_agency: "SMS-PMC", approximate: null }],
      cras: [{ name: "CRAS TESTE", type: "CRAS", regional: "REGIONAL TESTE", reference_date: "MAR-2019", source_agency: "FAS", approximate: false }],
      partial: false,
    });
    expect(out.source).toBe("Fonte: IPPUC/GeoCuritiba (SMS e FAS)");
    expect(out.source_url).toBe(THEMATIC_SERVICE_URL);
    expect(out.note).toMatch(/may have changed/);
    expect(calls.map((c) => c.url)).toEqual([key("health_area"), key("cras_territory")].map((k) => k.slice(4)));
    // The full-precision position appears nowhere: not in a URL, not in the answer.
    expect(JSON.stringify(res) + JSON.stringify(calls)).not.toMatch(/4296123|2713123/);
  });

  it("a point with no area in either layer is an answer with empty lists and a note", async () => {
    stubFetch(routes({ health_area: { body: EMPTY }, cras_territory: { body: EMPTY } }));
    const out = await areas();
    expect(out.data).toMatchObject({ health_units: [], cras: [], partial: false });
    expect(out.note).toMatch(/No health unit area found here \(outside Curitiba or not covered by the layer\)/);
    expect(out.note).toMatch(/No CRAS territory found here/);
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
    expect((await areas()).data.health_units.map((h) => h.approximate)).toEqual([true, false, null]);
  });

  it("a point on a boundary lists the areas distinct, sorted by name, at most 3, and says so", async () => {
    const u = (nome: string) => ({ nome, distrito: "D", data: "março/2022", fonte: "SMS-PMC" });
    stubFetch(routes({ health_area: { body: attrs([u("US ZETA"), u("US ALFA"), u("US ZETA"), u("US BETA"), u("US GAMA")]) } }));
    const out = await areas();
    expect(out.data.health_units.map((h) => h.name)).toEqual(["US ALFA", "US BETA", "US GAMA"]);
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
    expect(out.data.cras.map((c) => c.name)).toEqual(["CRAS TESTE"]);
    expect(out.note).not.toMatch(/boundary/);
  });

  it("text fields are cleaned and masked like the other GeoCuritiba fields", async () => {
    stubFetch(routes({ health_area: { body: attrs([{ nome: "US‮ 33334444" }]) } }));
    expect((await areas()).data.health_units[0]?.name).toBe("US [masked]");
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

  it("a 499 in an HTTP 200 body blocks the host: place_at_point is not asked either", async () => {
    const calls = stubFetch(routes({ health_area: { body: '{"error":{"code":499,"message":"Token Required"}}' } }));
    expect(errorOf(await call(AT))).toMatchObject({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    const client = await connectClient();
    expect(errorOf(await client.callTool({ name: "place_at_point", arguments: AT }))).toMatchObject({ error: "source_unavailable" });
    expect(calls).toHaveLength(1);
  });

  it.each<[string, Route]>([
    ["HTTP 500", { status: 500 }],
    ["HTTP 503", { status: 503 }],
    ["an ArcGIS error 400 with HTTP 200", { body: '{"error":{"code":400}}' }],
  ])("a CRAS layer failing with %s after the health layer was read is partial", async (_, r) => {
    stubFetch(routes({ cras_territory: r }));
    const out = await areas();
    expect(out.data).toMatchObject({ cras: [], partial: true });
    expect(out.data.health_units).toHaveLength(1);
    expect(out.note).toMatch(/Partial: the CRAS layer could not be read now/);
  });

  it("a refusal on the CRAS layer is partial and says the host is not asked for 10 minutes", async () => {
    stubFetch(routes({ cras_territory: { body: '{"error":{"code":499,"message":"Token Required"}}' } }));
    const out = await areas();
    expect(out.data).toMatchObject({ cras: [], partial: true });
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
});
