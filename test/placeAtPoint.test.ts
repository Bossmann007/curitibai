import { afterEach, describe, expect, it, vi } from "vitest";
import { CADASTRAL_SERVICE_URL, pointQueryUrl, roundPoint, type PointLayer } from "../src/sources/geocuritiba.js";
import { connectClient, errorOf, pointPart, stubFetch, type Route } from "./helpers.js";

// Synthetic answers only (invented names and zones, the real fields and shapes of the layers as read on 2026-11-23).
const JSON_TYPE = "application/json; charset=UTF-8";
const AT = { lat: -25.42961234, lon: -49.27131234 };
const P = roundPoint(AT.lat, AT.lon);
const attrs = (list: Record<string, unknown>[]) => JSON.stringify({ features: list.map((attributes) => ({ attributes })) });
const BAIRRO = attrs([{ nome: "BAIRRO TESTE", nm_regional: "REGIONAL TESTE" }]);
const ZONE_41 = attrs([{ sg_zona: "ZT-1", nm_zona: "ZONA TESTE 1", legislacao: "LEI TESTE / 2019 - DECRETO TESTE / 2026", data_versao: "2020-08" }]);
const ZONE_36 = attrs([{ sg_zona: "ZT-2", nm_zona: "ZONA TESTE 2", legislacao: "LEI TESTE / 2019", data_versao: "2020-08" }]);
const EMPTY = attrs([]);
// Two streets: one about 11 m east of the point, one about 55 m north.
const STREETS = JSON.stringify({
  spatialReference: { wkid: 4326, latestWkid: 4326 },
  features: [
    { attributes: { gtm_nm_logradouro: "RUA LONGE" }, geometry: { paths: [[[P.lon - 0.001, P.lat + 0.0005], [P.lon + 0.001, P.lat + 0.0005]]] } },
    { attributes: { gtm_nm_logradouro: "RUA PERTO" }, geometry: { paths: [[[P.lon + 0.0001, P.lat - 0.001], [P.lon + 0.0001, P.lat + 0.001]]] } },
  ],
});

type PlaceLayer = Extract<PointLayer, "bairro" | "zoning_decree" | "zoning_law" | "street">;
const key = (layer: PlaceLayer) => `GET ${pointQueryUrl(layer, P)}`;
function routes(over: Partial<Record<PlaceLayer, Route>> = {}): Record<string, Route> {
  const base: Record<PlaceLayer, Route> = {
    bairro: { body: BAIRRO },
    zoning_decree: { body: ZONE_41 },
    zoning_law: { body: ZONE_36 },
    street: { body: STREETS },
  };
  const out: Record<string, Route> = {};
  for (const layer of Object.keys(base) as PlaceLayer[]) out[key(layer)] = { contentType: JSON_TYPE, ...base[layer], ...over[layer] };
  return out;
}

afterEach(() => {
  vi.useRealTimers();
});

/** The host gate spaces requests 5 s apart: run the call on fake timers and let them pass. */
async function call(args: Record<string, unknown>) {
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  const client = await connectClient();
  const pending = client.callTool({ name: "place_at_point", arguments: { include: ["place"], ...args } });
  await vi.advanceTimersByTimeAsync(60_000);
  return pending;
}

async function place(args: Record<string, unknown> = AT) {
  const res = await call(args);
  expect(res.isError).toBeFalsy();
  return pointPart(res.structuredContent, "place");
}

describe("place_at_point query URLs", () => {
  it("uses the GeoCuritiba/ folder of the cadastral service (the root-level name answers 499)", () => {
    expect(CADASTRAL_SERVICE_URL).toBe(
      "https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_GeoCuritiba_MapaCadastral/MapServer",
    );
  });

  it("is a fixed point query per layer with the rounded point only", () => {
    const layers: [PlaceLayer, number][] = [["bairro", 2], ["zoning_decree", 41], ["zoning_law", 36], ["street", 12]];
    for (const [layer, id] of layers) {
      const u = new URL(pointQueryUrl(layer, P));
      expect(u.pathname).toBe(`/server/rest/services/GeoCuritiba/Publico_GeoCuritiba_MapaCadastral/MapServer/${id}/query`);
      expect(Object.fromEntries(u.searchParams)).toMatchObject({
        geometry: "-49.2713,-25.4296",
        geometryType: "esriGeometryPoint",
        inSR: "4326",
        spatialRel: "esriSpatialRelIntersects",
        f: "json",
      });
      expect(u.searchParams.has("where")).toBe(false);
    }
    expect(new URL(pointQueryUrl("zoning_decree", P)).searchParams.get("outFields")).toBe("sg_zona,nm_zona,legislacao,data_versao");
    expect(Object.fromEntries(new URL(pointQueryUrl("street", P)).searchParams)).toMatchObject({
      outFields: "gtm_nm_logradouro",
      distance: "100",
      units: "esriSRUnit_Meter",
      returnGeometry: "true",
      outSR: "4326",
    });
    expect(new URL(pointQueryUrl("bairro", P)).searchParams.get("returnGeometry")).toBe("false");
  });

  it("rounds to 4 decimals", () => {
    expect(roundPoint(-25.42961234, -49.27138766)).toEqual({ lat: -25.4296, lon: -49.2714 });
  });
});

describe("place_at_point answers", () => {
  it("returns bairro, regional, zoning from layer 41 and the nearest street, with the rounded point only", async () => {
    const calls = stubFetch(routes());
    const res = await call(AT);
    const out = pointPart(res.structuredContent, "place");
    expect(out.data).toEqual({
      lat: -25.4296,
      lon: -49.2713,
      inside_curitiba: true,
      bairro: "BAIRRO TESTE",
      regional: "REGIONAL TESTE",
      boundary: false,
      zoning: [{ code: "ZT-1", name: "ZONA TESTE 1", law: "LEI TESTE / 2019 - DECRETO TESTE / 2026", version: "2020-08", layer: 41 }],
      nearest_street: { name: "RUA PERTO", distance_m: 10 },
      partial: false,
    });
    expect(out.source).toBe("Fonte: IPPUC/GeoCuritiba");
    expect(out.source_url).toBe(CADASTRAL_SERVICE_URL);
    expect(calls.map((c) => c.url)).toEqual([key("bairro"), key("zoning_decree"), key("street")].map((k) => k.slice(4)));
    // The full-precision position appears nowhere: not in a URL, not in the answer.
    const text = JSON.stringify(res) + JSON.stringify(calls);
    expect(text).not.toMatch(/4296123|2713123/);
  });

  it("asks layer 36 when layer 41 has no polygon at the point", async () => {
    const calls = stubFetch(routes({ zoning_decree: { body: EMPTY } }));
    const out = await place();
    expect(out.data.zoning).toEqual([{ code: "ZT-2", name: "ZONA TESTE 2", law: "LEI TESTE / 2019", version: "2020-08", layer: 36 }]);
    expect(calls).toHaveLength(4);
  });

  it("a point with no bairro (a neighbouring city) is an answer with nulls and makes one request", async () => {
    const calls = stubFetch(routes({ bairro: { body: EMPTY } }));
    const out = await place();
    expect(out.data).toMatchObject({ inside_curitiba: false, bairro: null, regional: null, zoning: null, nearest_street: null, partial: false });
    expect(calls).toHaveLength(1);
  });

  it("missing fields are null; a feature with none of the fields is skipped", async () => {
    stubFetch(routes({
      bairro: { body: attrs([{ nome: "BAIRRO TESTE" }]) },
      zoning_decree: { body: attrs([{ sg_zona: "ZT-1" }, { other: "x" }]) },
      street: { body: JSON.stringify({ spatialReference: { wkid: 4326 }, features: [{ attributes: {}, geometry: { paths: [[[P.lon, P.lat]]] } }] }) },
    }));
    const out = await place();
    expect(out.data.regional).toBeNull();
    expect(out.data.zoning).toEqual([{ code: "ZT-1", name: null, law: null, version: null, layer: 41 }]);
    expect(out.data.nearest_street).toBeNull();
  });

  it("no street within 100 m is null, not an error", async () => {
    stubFetch(routes({ street: { body: JSON.stringify({ spatialReference: { wkid: 4326 }, features: [] }) } }));
    expect((await place()).data.nearest_street).toBeNull();
  });

  it("a point on a boundary returns the first bairro by name and says so; zones are distinct", async () => {
    stubFetch(routes({
      bairro: { body: attrs([{ nome: "ZETA", nm_regional: "R1" }, { nome: "ALFA", nm_regional: "R2" }]) },
      zoning_decree: { body: attrs([{ sg_zona: "ZT-1" }, { sg_zona: "ZT-1" }, { sg_zona: "ZT-3" }]) },
    }));
    const out = await place();
    expect(out.data).toMatchObject({ bairro: "ALFA", regional: "R2", boundary: true });
    expect(out.data.zoning!.map((z) => z.code)).toEqual(["ZT-1", "ZT-3"]);
    expect(out.note).toMatch(/boundary/);
  });

  it("a row with only a regional does not hide a named bairro or make a boundary", async () => {
    stubFetch(routes({ bairro: { body: attrs([{ nm_regional: "REGIONAL X" }, { nome: "BAIRRO TESTE", nm_regional: "REGIONAL TESTE" }]) } }));
    expect((await place()).data).toMatchObject({ bairro: "BAIRRO TESTE", regional: "REGIONAL TESTE", boundary: false });
  });

  it("keeps a street whose line runs past the Curitiba box; drops only invalid vertices", async () => {
    stubFetch(routes({
      street: {
        body: JSON.stringify({
          spatialReference: { wkid: 4326 },
          features: [{ attributes: { gtm_nm_logradouro: "RUA DA DIVISA" }, geometry: { paths: [[[P.lon + 0.0001, P.lat], [P.lon + 0.5, P.lat], ["x", 1], [999, 0]]] } }],
        }),
      },
    }));
    expect((await place()).data.nearest_street).toEqual({ name: "RUA DA DIVISA", distance_m: 10 });
  });

  it("text fields are cleaned and masked like the other GeoCuritiba fields", async () => {
    stubFetch(routes({ bairro: { body: attrs([{ nome: "BAIRRO‮ 33334444", nm_regional: "R" }]) } }));
    expect((await place()).data.bairro).toBe("BAIRRO [masked]");
  });
});

describe("place_at_point input", () => {
  it.each([
    [{ lat: -23.55, lon: -46.63 }],
    [{ lat: -25.71, lon: -49.27 }],
    [{ lat: -25.43, lon: -49.46 }],
    [{ lat: -25.43, lon: -49.14 }],
  ])("refuses a point outside Curitiba's box %j without a request", async (args) => {
    const calls = stubFetch({});
    expect(errorOf(await call(args))).toEqual({ error: "invalid_argument", message: expect.stringMatching(/outside Curitiba/) });
    expect(calls).toHaveLength(0);
  });

  it("checks the rounded point: what is checked is what is sent", async () => {
    const calls = stubFetch({});
    expect(errorOf(await call({ lat: -25.29994, lon: -49.27 }))).toMatchObject({ error: "invalid_argument" });
    expect(calls).toHaveLength(0);
    stubFetch(Object.fromEntries([[`GET ${pointQueryUrl("bairro", { lat: -25.3, lon: -49.27 })}`, { body: EMPTY, contentType: JSON_TYPE }]]));
    expect((await place({ lat: -25.29996, lon: -49.27 })).data).toMatchObject({ lat: -25.3, inside_curitiba: false });
  });

  it.each([[{ lat: -25.43 }], [{ lat: "x", lon: -49.27 }], [{ lat: 91, lon: -49.27 }]])("rejects %j", async (args) => {
    stubFetch({});
    expect((await call(args)).isError).toBe(true);
  });
});

describe("place_at_point errors", () => {
  it.each<[string, Route, unknown]>([
    ["an ArcGIS error 400 with HTTP 200", { body: '{"error":{"code":400,"message":"Invalid or missing input parameters."}}' }, { error: "source_unavailable" }],
    ["HTTP 500", { status: 500 }, { error: "source_unavailable" }],
    ["HTTP 503", { status: 503 }, { error: "source_unavailable" }],
    ["an HTML body", { contentType: "text/html", body: "<html></html>" }, { error: "source_unavailable" }],
    ["no features array", { body: "{}" }, { error: "source_unavailable" }],
    ["a cut answer", { body: '{"features":[],"exceededTransferLimit":true}' }, { error: "source_unavailable" }],
    ["HTTP 403", { status: 403 }, { error: "source_unavailable", message: expect.stringMatching(/refused/) }],
  ])("the bairro layer failing with %s is an error, never data", async (_, r, expected) => {
    stubFetch(routes({ bairro: r }));
    expect(errorOf(await call(AT))).toEqual(expected);
  });

  it("a 499 in an HTTP 200 body blocks the host: city_facilities_search is not asked either", async () => {
    const calls = stubFetch(routes({ bairro: { body: '{"error":{"code":499,"message":"Token Required"}}' } }));
    expect(errorOf(await call(AT))).toMatchObject({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    const client = await connectClient();
    expect(errorOf(await client.callTool({ name: "city_facilities_search", arguments: { type: "feira" } }))).toMatchObject({ error: "source_unavailable" });
    expect(calls).toHaveLength(1);
  });

  it("a zoning failure after the bairro was read is partial; the street is not asked while the failure is remembered", async () => {
    const calls = stubFetch(routes({ zoning_decree: { status: 500 } }));
    const out = await place();
    expect(out.data).toMatchObject({ bairro: "BAIRRO TESTE", zoning: null, nearest_street: null, partial: true });
    expect(out.note).toMatch(/zoning/);
    expect(calls).toHaveLength(2);
  });

  it("a refusal on a later layer is partial and says the host is not asked for 10 minutes", async () => {
    stubFetch(routes({ street: { body: '{"error":{"code":499,"message":"Token Required"}}' } }));
    const out = await place();
    expect(out.data).toMatchObject({ bairro: "BAIRRO TESTE", nearest_street: null, partial: true });
    expect(out.note).toMatch(/refused this server; it is not asked again for 10 minutes/);
    expect(out.note).not.toMatch(/try again in a minute/);
  });

  it("a street layer error 400 is partial with the rest kept", async () => {
    stubFetch(routes({ street: { body: '{"error":{"code":400}}' } }));
    const out = await place();
    expect(out.data).toMatchObject({ bairro: "BAIRRO TESTE", nearest_street: null, partial: true });
    expect(out.data.zoning).toHaveLength(1);
    expect(out.note).toMatch(/street/);
  });

  it("a street answer that is not WGS84 is partial", async () => {
    stubFetch(routes({ street: { body: JSON.stringify({ spatialReference: { wkid: 31982 }, features: [] }) } }));
    expect((await place()).data).toMatchObject({ nearest_street: null, partial: true });
  });
});

describe("place_at_point cache", () => {
  it("a second call within the same rounded point makes no request (key is the rounded URL)", async () => {
    const calls = stubFetch(routes());
    await place(AT);
    await place({ lat: AT.lat + 0.00001, lon: AT.lon - 0.00001 });
    expect(calls).toHaveLength(3);
  });
});
