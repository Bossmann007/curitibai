import { describe, expect, it, vi } from "vitest";
import {
  oneAtATime,
  OVERPASS_MAX_QUEUE_WAIT_MS,
  resetOverpassCooldown,
  OSM_ATTRIBUTION,
  OVERPASS_MAX_BYTES,
  OVERPASS_URL,
  parseOverpass,
  PLACE_CATEGORY_NAMES,
  placesQuery,
} from "../src/sources/osm.js";
import { USER_AGENT } from "../src/config.js";
import { placesSearchOutput } from "../src/tools/placesSearch.js";
import { connectClient, errorOf, fixture, stubFetch, type Route } from "./helpers.js";

const JSON_TYPE = "application/json";

function overpass(byData: Record<string, Route>): Record<string, Route> {
  return { [`POST ${OVERPASS_URL}`]: { byData } };
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const client = await connectClient();
  return client.callTool({ name, arguments: args });
}

describe("Overpass queries", () => {
  it("are built from the allowlist only, limited to Curitiba's area, with a server timeout", () => {
    for (const c of PLACE_CATEGORY_NAMES) {
      const q = placesQuery(c);
      expect(q).toMatch(/^\[out:json\]\[timeout:25\];area\["boundary"="administrative"\]\["admin_level"="8"\]\["IBGE:GEOCODIGO"="4106902"\]->\.cwb;\.cwb out ids;/);
      expect(q).toMatch(/\(area\.cwb\);out center;$/);
    }
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
    expect(byId[9000000002]!.website).toBe("https://outra.exemplo.org/"); // javascript: website dropped, contact:website used
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
    resetOverpassCooldown();
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

// Trimmed real responses from ovp.dresel.systems/api-sa, recorded 2026-11-21 (OSM data as of 2026-11-19T21:22:20Z).
// OpenStreetMap data, © OpenStreetMap contributors, ODbL.
describe("recorded Overpass responses (real OSM data)", () => {
  const OSM_BASE = "2026-11-19T21:22:20Z";

  it("places_search library: Curitiba area found, every element returned, nodes keep coordinates", async () => {
    stubFetch(overpass({ [placesQuery("library")]: { body: fixture("osm_library_recorded.json"), contentType: JSON_TYPE } }));
    const out = placesSearchOutput.parse((await call("places_search", { category: "library", limit: 20 })).structuredContent);
    expect(out.data.total).toBe(56);
    expect(out.data.osm_data_as_of).toBe(OSM_BASE);
    expect(out.data.places.every((p) => p.lat !== null && p.lon !== null)).toBe(true);
    expect(out.data.places.every((p) => p.name === null || !p.name.includes("[masked]"))).toBe(true);
    const one = placesSearchOutput.parse((await call("places_search", { category: "library", name: "hideo handa" })).structuredContent);
    expect(one.data.places.map((p) => [p.osm_type, p.osm_id, p.name])).toEqual([["node", 2591039475, "Biblioteca Hideo Handa"]]);
    expect(one.data.places[0]!.lat).toBeCloseTo(-25.446, 3);
  });

});

describe("Overpass politeness", () => {
  it("parallel calls for different categories never overlap their requests", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const body = fixture("osm_edges_synthetic.json");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 20));
        inFlight--;
        return new Response(body, { status: 200, headers: { "content-type": JSON_TYPE } });
      }),
    );
    const client = await connectClient();
    const results = await Promise.all(
      (["library", "park", "school", "police", "hospital"] as const).map((category) =>
        client.callTool({ name: "places_search", arguments: { category } }),
      ),
    );
    expect(results.every((r) => !r.isError)).toBe(true);
    expect(maxInFlight).toBe(1);
  });
});

describe("Overpass queue", () => {
  it("after a 429, later calls answer rate_limited without a request until the wait is over", async () => {
    const calls = stubFetch(overpass({ [placesQuery("park")]: { status: 429, headers: { "retry-after": "30" } } }));
    expect(errorOf(await call("places_search", { category: "park" }))).toMatchObject({ error: "rate_limited" });
    expect(errorOf(await call("places_search", { category: "library" }))).toMatchObject({ error: "rate_limited" });
    expect(calls).toHaveLength(1);
  });

  it("keeps going after a failed request", async () => {
    stubFetch(
      overpass({
        [placesQuery("park")]: { status: 504 },
        [placesQuery("library")]: { body: fixture("osm_edges_synthetic.json"), contentType: JSON_TYPE },
      }),
    );
    const client = await connectClient();
    const [a, b] = await Promise.all([
      client.callTool({ name: "places_search", arguments: { category: "park" } }),
      client.callTool({ name: "places_search", arguments: { category: "library" } }),
    ]);
    expect(errorOf(a)).toEqual({ error: "source_unavailable" });
    expect(b.isError).toBeFalsy();
  });

  it("a call that waited too long for its turn gives up without running", async () => {
    let t = 0;
    const now = () => t;
    let ran = false;
    const slow = oneAtATime(async () => {
      t += OVERPASS_MAX_QUEUE_WAIT_MS + 1; // the first request takes longer than the wait cap
      return 1;
    }, now);
    const late = oneAtATime(async () => {
      ran = true;
      return 2;
    }, now);
    await expect(slow).resolves.toBe(1);
    await expect(late).rejects.toThrow(/source_unavailable/);
    expect(ran).toBe(false);
  });
});
