import { describe, expect, it } from "vitest";
import {
  busRouteQuery,
  busRoutesQuery,
  MAX_STOPS,
  orderedStops,
  OSM_ATTRIBUTION,
  OVERPASS_MAX_BYTES,
  OVERPASS_URL,
  parseOverpass,
  PLACE_CATEGORY_NAMES,
  placesQuery,
} from "../src/sources/osm.js";
import { USER_AGENT } from "../src/config.js";
import { busLinesOutput } from "../src/tools/busLines.js";
import { placesSearchOutput } from "../src/tools/placesSearch.js";
import { connectClient, errorOf, fixture, osmRoutes, stubFetch, type Route } from "./helpers.js";

const JSON_TYPE = "application/json";

function overpass(byData: Record<string, Route>): Record<string, Route> {
  return { [`POST ${OVERPASS_URL}`]: { byData } };
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const client = await connectClient();
  return client.callTool({ name, arguments: args });
}

const ROUTE_ID = 9100000001;

describe("Overpass queries", () => {
  it("are built from the allowlist only, limited to Curitiba's area, with a server timeout", () => {
    for (const c of PLACE_CATEGORY_NAMES) {
      const q = placesQuery(c);
      expect(q).toMatch(/^\[out:json\]\[timeout:25\];area\["boundary"="administrative"\]\["admin_level"="8"\]\["IBGE:GEOCODIGO"="4106902"\]->\.cwb;\.cwb out ids;/);
      expect(q).toMatch(/\(area\.cwb\);out center;$/);
    }
    expect(busRoutesQuery()).toContain('rel["type"="route"]["route"="bus"](area.cwb);out tags;');
    expect(busRouteQuery(42)).toContain('rel(42)["type"="route"]["route"="bus"](area.cwb)->.r;');
    expect(busRouteQuery(42)).toContain('way(r.r:"platform_entry_only");way(r.r:"platform_exit_only")');
    expect(() => busRouteQuery(1.5)).toThrow();
    expect(() => busRouteQuery(0)).toThrow();
  });

  it("parseOverpass fails closed on a remark (cut result) or an unknown shape", () => {
    expect(() => parseOverpass({ elements: [], remark: "runtime error: Query timed out" })).toThrow(/source_unavailable/);
    expect(() => parseOverpass({ foo: 1 })).toThrow(/source_unavailable/);
    expect(() => parseOverpass({ elements: [{ type: "changeset", id: 1 }] })).toThrow(/source_unavailable/);
    expect(parseOverpass({ elements: [] })).toEqual({ osmBase: null, areaFound: false, elements: [] });
    expect(parseOverpass({ elements: [{ type: "area", id: 3600000001 }] }).areaFound).toBe(true);
  });
});

describe("places_search", () => {
  const routes = () => overpass({ [placesQuery("library")]: { body: fixture("osm_edges_synthetic.json"), contentType: JSON_TYPE } });

  it("sends one POST with the polite User-Agent and returns attribution and freshness", async () => {
    const calls = stubFetch(routes());
    const res = await call("places_search", { category: "library" });
    expect(res.isError).toBeFalsy();
    const out = placesSearchOutput.parse(res.structuredContent);
    expect(calls).toEqual([{ url: OVERPASS_URL, method: "POST", data: placesQuery("library") }]);
    expect(USER_AGENT).toBe("curitibai-mcp/0.7");
    expect(out.data.attribution).toBe(OSM_ATTRIBUTION);
    expect(out.data.osm_data_as_of).toBe("2030-01-01T00:00:00Z");
    expect(out.license_note).toContain("© OpenStreetMap contributors, ODbL");
    expect(out.license_note).toContain("OSM data as of 2030-01-01T00:00:00Z");
    expect(out.license_note).toContain(`fetched at ${out.fetched_at}`);
    expect(out.source_url).toBe(OVERPASS_URL);
  });

  it("keeps only the category asked for, masks contact data, drops unsafe websites and untagged fields", async () => {
    stubFetch(routes());
    const out = placesSearchOutput.parse((await call("places_search", { category: "library" })).structuredContent);
    expect(out.data.total).toBe(3); // the bookshop is dropped
    const byId = Object.fromEntries(out.data.places.map((p) => [p.osm_id, p]));
    const n = byId[9000000001]!;
    expect(n.name).toBe("Biblioteca Ficticia Contato [masked]");
    expect(n.website).toBeNull(); // credentials in the URL
    expect(n.address).toEqual({ street: "Rua Ficticia", housenumber: "100", suburb: "Bairro Ficticio", postcode: "80000-000", city: "Curitiba" });
    expect(n.opening_hours).toBe("Mo-Fr 0800-1800"); // structured: never through the phone mask
    expect(n.osm_url).toBe("https://www.openstreetmap.org/node/9000000001");
    expect(byId[9000000002]!.website).toBeNull(); // javascript:
    expect(byId[9000000002]!.lat).toBe(-25.41); // way center
    expect(byId[9000000003]!.website).toBe("http://biblioteca.exemplo.org/horario"); // contact:website
    expect(byId[9000000003]!.name).toBeNull();
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/fulano|99999|usuario|senha|Operador|Livraria/);
  });

  it("filters by name words (accents and case ignored) and pages with offset", async () => {
    stubFetch(routes());
    const out = placesSearchOutput.parse((await call("places_search", { category: "library", name: "publica FICTICIA" })).structuredContent);
    expect(out.data.places.map((p) => p.osm_id)).toEqual([9000000002]);
    const page = placesSearchOutput.parse((await call("places_search", { category: "library", limit: 1, offset: 1 })).structuredContent);
    expect(page.data.total).toBe(3);
    expect(page.data.places).toHaveLength(1);
    expect(page.data.next_offset).toBe(2);
  });

  it("a name the mask hid cannot be found by searching for it", async () => {
    stubFetch(routes());
    const out = placesSearchOutput.parse((await call("places_search", { category: "library", name: "fulano" })).structuredContent);
    expect(out.data.total).toBe(0);
  });

  it.each([
    { category: "shop" },
    { category: "doctors" },
    { category: "clinic" },
    { category: "dentist" },
    { category: "library", limit: 21 },
    { category: "library", name: "x" },
    { category: "library", offset: -1 },
    {},
  ])("rejects %j without a request", async (args) => {
    const calls = stubFetch({});
    const res = await call("places_search", args);
    expect(res.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("HTTP 429 is rate_limited; a 504, a remark or a body over the cap is source_unavailable", async () => {
    const q = placesQuery("park");
    stubFetch(overpass({ [q]: { status: 429, headers: { "retry-after": "30" } } }));
    expect(errorOf(await call("places_search", { category: "park" }))).toEqual({
      error: "rate_limited",
      message: "The source is limiting requests; wait 30 s before trying again.",
    });
    stubFetch(overpass({ [q]: { status: 504 } }));
    expect(errorOf(await call("places_search", { category: "park" }))).toEqual({ error: "source_unavailable" });
    stubFetch(overpass({ [q]: { body: JSON.stringify({ elements: [], remark: "runtime error" }), contentType: JSON_TYPE } }));
    expect(errorOf(await call("places_search", { category: "park" }))).toEqual({ error: "source_unavailable" });
    // No Curitiba area in the answer: the instance could not resolve it, which is not "no parks".
    stubFetch(overpass({ [q]: { body: JSON.stringify({ osm3s: {}, elements: [] }), contentType: JSON_TYPE } }));
    expect(errorOf(await call("places_search", { category: "park" }))).toEqual({ error: "source_unavailable" });
    stubFetch(overpass({ [q]: { body: "x", headers: { "content-length": String(OVERPASS_MAX_BYTES + 1) } } }));
    expect(errorOf(await call("places_search", { category: "park" }))).toMatchObject({ error: "source_unavailable", message: /3 MB cap/ });
  });
});

describe("bus_lines", () => {
  it("route_id: stops in member order, stop/platform pairs merged, PTv1 stops kept, phones masked", async () => {
    const calls = stubFetch(overpass({ [busRouteQuery(ROUTE_ID)]: { body: fixture("osm_route_synthetic.json"), contentType: JSON_TYPE } }));
    const res = await call("bus_lines", { route_id: ROUTE_ID });
    expect(res.isError).toBeFalsy();
    const out = busLinesOutput.parse(res.structuredContent);
    expect(calls).toHaveLength(1);
    const r = out.data.route!;
    expect(r).toMatchObject({ ref: "999", from: "Terminal A", to: "Terminal B", operator: "Operadora Ficticia", network: "Rede Ficticia" });
    expect(r.stops.map((s) => [s.seq, s.name, s.osm_type, s.osm_id])).toEqual([
      [1, "Terminal A", "node", 9100000011],
      [2, "Estação Tubo Ficticia", "way", 9100000021],
      [3, "Ponto Ficticio 1", "node", 9100000013],
      [4, null, "node", 9100000014],
      [5, "Ponto [masked]", "node", 9100000015],
      [6, "Terminal B", "node", 9100000016],
    ]);
    expect(r.stops[1]).toMatchObject({ lat: -25.405, lon: -49.205 });
    expect(r.stops_truncated).toBe(false);
    expect(out.data.note).toMatch(/No timetables/);
    expect(out.data.note).toMatch(/outdated/);
    expect(out.data.attribution).toBe(OSM_ATTRIBUTION);
  });

  it("route_id not found in Curitiba: route null, says so", async () => {
    const empty = JSON.stringify({ osm3s: { timestamp_osm_base: "2030-01-01T00:00:00Z" }, elements: [{ type: "area", id: 3600000001 }] });
    stubFetch(overpass({ [busRouteQuery(123)]: { body: empty, contentType: JSON_TYPE } }));
    const out = busLinesOutput.parse((await call("bus_lines", { route_id: 123 })).structuredContent);
    expect(out.data.route).toBeNull();
    expect(out.data.total).toBe(0);
    expect(out.data.note).toMatch(/No OSM bus route with id 123 in Curitiba/);
  });

  it("route_id combined with a filter is invalid_argument, without a request", async () => {
    const calls = stubFetch({});
    expect(errorOf(await call("bus_lines", { route_id: ROUTE_ID, ref: "022" }))).toEqual({
      error: "invalid_argument",
      message: "route_id cannot be combined with ref, name, limit or offset.",
    });
    expect(calls).toHaveLength(0);
  });

  it("list mode filters by ref (exact) and name words, sorted by ref", async () => {
    stubFetch(osmRoutes());
    const out = busLinesOutput.parse((await call("bus_lines", { ref: "999" })).structuredContent);
    expect(out.data.routes.map((r) => r.osm_id)).toEqual([ROUTE_ID]);
    expect(out.data.route).toBeNull();
    expect(busLinesOutput.parse((await call("bus_lines", { ref: "99" })).structuredContent).data.total).toBe(0);
    expect(busLinesOutput.parse((await call("bus_lines", { name: "terminal b" })).structuredContent).data.total).toBe(1);
  });

  it("stops_truncated only when stops were actually left out", () => {
    const mk = (n: number) => {
      const nodes = Array.from({ length: n }, (_, i) => ({ type: "node" as const, id: i + 1, lat: 0, lon: 0, tags: { name: `S${i}` } }));
      const rel = { type: "relation" as const, id: 1, tags: {}, members: nodes.map((x) => ({ type: "node", ref: x.id, role: "stop" })) };
      return orderedStops(rel, nodes);
    };
    expect(mk(MAX_STOPS)).toMatchObject({ truncated: false });
    expect(mk(MAX_STOPS).stops).toHaveLength(MAX_STOPS);
    expect(mk(MAX_STOPS + 1)).toMatchObject({ truncated: true });
  });

  it.each([{ route_id: 0 }, { route_id: 1.5 }, { name: "x" }, { limit: 0 }, { ref: "" }])("rejects %j without a request", async (args) => {
    const calls = stubFetch({});
    expect((await call("bus_lines", args)).isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
