import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CNES_GATE,
  CNES_MIN_INTERVAL_MS,
  CNES_TYPES_URL,
  establishmentsUrl,
  isPublicAdministration,
  parseEstablishments,
} from "../src/sources/cnes.js";
import { MAX_CNES_REQUESTS } from "../src/tools/healthUnitsSearch.js";
import { cnesRoutes, connectClient, errorOf, fixture, stubFetch, syntheticPage, type Route } from "./helpers.js";

const JSON_TYPE = "application/json";

interface Unit {
  cnes_code: string;
  name: string;
  unit_type: string | null;
  unit_type_code: number | null;
  address: string | null;
}
interface Data {
  units: Unit[];
  next_page: number | null;
  next_skip: number;
  discarded: number;
  partial: boolean;
  scanned_pages: { from: number; to: number };
  note: string;
}
const dataOf = (res: object) => (res as { structuredContent: { data: Data } }).structuredContent.data;

describe("CNES public-administration filter (fails closed)", () => {
  it("keeps only natureza jurídica group 1", () => {
    expect(isPublicAdministration("1244")).toBe(true);
    expect(isPublicAdministration("1104 ")).toBe(true);
    for (const c of ["4000", "2135", "2232", "3069", null, undefined, "", "1", "12345", "1abc", 1244]) {
      expect(isPublicAdministration(c)).toBe(false);
    }
  });

  it("drops 4000, 2135, 2232 and null records and keeps 1xxx records", () => {
    const { units, received } = parseEstablishments(JSON.parse(fixture("cnes_estabelecimentos_synthetic.json")));
    expect(received).toBe(7);
    expect(units.map((u) => u.cnes_code)).toEqual(["9900001", "9900002", "9900007"]);
    const text = JSON.stringify(units);
    for (const dropped of ["FULANO", "GAMA", "DELTA", "SEM NATUREZA", "BELTRANA"]) expect(text).not.toContain(dropped);
  });

  it("returns institutional fields only", () => {
    const { units } = parseEstablishments(JSON.parse(fixture("cnes_estabelecimentos_synthetic.json")));
    expect(Object.keys(units[0]!).sort()).toEqual(
      ["address", "cep", "cnes_code", "management_sphere", "name", "neighbourhood", "phone", "unit_type_code"].sort(),
    );
    expect(units[0]).toMatchObject({ address: "RUA FICTICIA UM, 100", cep: "80000001", phone: "41 00000001" });
    expect(units[2]).toMatchObject({ address: "RUA FICTICIA SETE", phone: null, management_sphere: "FEDERAL" });
    const text = JSON.stringify(units);
    for (const f of ["example.invalid", "ORGAO PUBLICO", "00000000000000", "-25"]) expect(text).not.toContain(f);
  });

  it("rejects a response without the estabelecimentos list", () => {
    expect(() => parseEstablishments({ error: "x" })).toThrow();
  });
});

describe("health_units_search", () => {
  it("an unknown unit_type still carries the emergency line", async () => {
    stubFetch(cnesRoutes());
    const client = await connectClient();
    const data = dataOf(await client.callTool({ name: "health_units_search", arguments: { unit_type: "tipo inexistente zz" } }));
    expect(data.units).toEqual([]);
    expect(data.note).toMatch(/^No CNES unit type matches unit_type\./);
    expect(data.note).toContain("NOT FOR EMERGENCIES: in an emergency call 192 (SAMU) or 193 (Corpo de Bombeiros).");
  });

  it("returns public units with type labels and requests active Curitiba units", async () => {
    const calls = stubFetch(cnesRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: {} });
    const data = dataOf(res);
    expect(data.units.map((u) => u.name)).toEqual(["UMS FICTICIA ALFA", "CAPS FICTÍCIO BETA", "UPA FICTICIA EPSILON"]);
    expect(data.units[0]?.unit_type).toBe("UNIDADE BASICA FICTICIA");
    expect(data).toMatchObject({ next_page: null, partial: false, discarded: 4, scanned_pages: { from: 1, to: 1 } });
    expect(data.note).toMatch(/Private clinics, consultórios and non-profit hospitals/);
    expect(data.note).toContain("NOT FOR EMERGENCIES: in an emergency call 192 (SAMU) or 193 (Corpo de Bombeiros).");
    const url = new URL(calls.find((c) => c.url !== CNES_TYPES_URL)!.url);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      codigo_municipio: "410690",
      status: "1",
      limit: "20",
      offset: "0",
    });
  });

  it("filters by name ignoring accents and case", async () => {
    stubFetch(cnesRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { name: "caps ficticio" } });
    expect(dataOf(res).units.map((u) => u.cnes_code)).toEqual(["9900002"]);
  });

  it("sends a single matching unit type to the API", async () => {
    const calls = stubFetch({
      ...cnesRoutes(),
      [`GET ${establishmentsUrl(1, 70)}`]: {
        body: JSON.stringify({ estabelecimentos: JSON.parse(syntheticPage("CAPS", 1, 3, 70)).estabelecimentos }),
        contentType: JSON_TYPE,
      },
    });
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { unit_type: "psicossocial" } });
    expect(dataOf(res).units).toHaveLength(3);
    expect(calls.map((c) => c.url)).toContain(establishmentsUrl(1, 70));
  });

  it("filters several matching unit types client-side", async () => {
    stubFetch(cnesRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { unit_type: "pronto atendimento" } });
    expect(dataOf(res).units.map((u) => u.cnes_code)).toEqual(["9900007"]);
  });

  it("returns nothing (and requests no units) for an unknown unit type", async () => {
    const calls = stubFetch(cnesRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { unit_type: "nao existe" } });
    expect(dataOf(res)).toMatchObject({ units: [], next_page: null });
    expect(calls.map((c) => c.url)).toEqual([CNES_TYPES_URL]);
  });

  it(`caps the scan at ${MAX_CNES_REQUESTS} upstream pages and says partial`, async () => {
    const routes: Record<string, Route> = { ...cnesRoutes() };
    for (let p = 1; p <= MAX_CNES_REQUESTS + 5; p++) {
      routes[`GET ${establishmentsUrl(p, null)}`] = { body: syntheticPage("UMS", p * 100), contentType: JSON_TYPE };
    }
    const calls = stubFetch(routes);
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { name: "nao bate" } });
    const data = dataOf(res);
    expect(data).toMatchObject({
      units: [],
      partial: true,
      next_page: MAX_CNES_REQUESTS + 1,
      scanned_pages: { from: 1, to: MAX_CNES_REQUESTS },
    });
    expect(data.note).toMatch(new RegExp(`^Stopped after ${MAX_CNES_REQUESTS} upstream page\\(s\\); continue with next_page\\.`));
    expect(calls.filter((c) => c.url !== CNES_TYPES_URL)).toHaveLength(MAX_CNES_REQUESTS);
  });

  it("keeps scanning past page 5 on the first call when the only match is on page 6", async () => {
    const routes: Record<string, Route> = { ...cnesRoutes() };
    for (let p = 1; p <= 7; p++) {
      const prefix = p === 6 ? "UMS CAJURU" : "UMS OUTRA";
      routes[`GET ${establishmentsUrl(p, null)}`] = { body: syntheticPage(prefix, p * 100, p === 7 ? 3 : 20), contentType: JSON_TYPE };
    }
    stubFetch(routes);
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { name: "cajuru", limit: 3 } });
    const data = dataOf(res);
    expect(data.units.map((u) => u.name)).toEqual(["UMS CAJURU 600", "UMS CAJURU 601", "UMS CAJURU 602"]);
    expect(data).toMatchObject({ partial: false, next_page: 6, next_skip: 3, scanned_pages: { from: 1, to: 6 } });
  });

  it("stops asking for pages once the 20 s time budget is spent and says so", async () => {
    const real = Date.now;
    let t = 1_000_000;
    globalThis.Date.now = () => t;
    const types = fixture("cnes_tipounidades_synthetic.json");
    let pages = 0;
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url === CNES_TYPES_URL) return new Response(types, { status: 200, headers: { "content-type": JSON_TYPE } });
      pages++;
      t += 7_000; // three 7 s pages pass the 20 s budget
      return new Response(syntheticPage("UMS", pages * 100), { status: 200, headers: { "content-type": JSON_TYPE } });
    }) as typeof fetch;
    try {
      const client = await connectClient();
      const data = dataOf(await client.callTool({ name: "health_units_search", arguments: { name: "nao bate" } }));
      expect(pages).toBe(3);
      expect(data).toMatchObject({ units: [], partial: true, next_page: 4, scanned_pages: { from: 1, to: 3 } });
      expect(data.note).toMatch(/^Stopped after 3 upstream page\(s\) \(the 20 s time budget was reached\); continue with next_page\./);
    } finally {
      globalThis.Date.now = real;
    }
  });

  it.each([3, 7, 20])("following next_page/next_skip with limit %i visits every unit exactly once", async (limit) => {
    const routes: Record<string, Route> = { ...cnesRoutes() };
    for (let p = 1; p <= 3; p++) {
      routes[`GET ${establishmentsUrl(p, null)}`] = { body: syntheticPage("UMS", p * 100), contentType: JSON_TYPE };
    }
    routes[`GET ${establishmentsUrl(4, null)}`] = { body: syntheticPage("UMS", 400, 7), contentType: JSON_TYPE };
    stubFetch(routes);
    const client = await connectClient();
    const seen: string[] = [];
    let args: Record<string, unknown> = { limit, page: 1, skip: 0 };
    for (let guard = 0; guard < 100; guard++) {
      const data = dataOf(await client.callTool({ name: "health_units_search", arguments: args }));
      seen.push(...data.units.map((u) => u.cnes_code));
      if (data.next_page === null) break;
      args = { limit, page: data.next_page, skip: data.next_skip };
    }
    expect(seen).toHaveLength(67);
    expect(new Set(seen).size).toBe(67);
  });

  it("resumes inside a page with next_skip", async () => {
    stubFetch({ ...cnesRoutes(), [`GET ${establishmentsUrl(1, null)}`]: { body: syntheticPage("UMS", 1), contentType: JSON_TYPE } });
    const client = await connectClient();
    const first = dataOf(await client.callTool({ name: "health_units_search", arguments: { limit: 5 } }));
    expect(first).toMatchObject({ next_page: 1, next_skip: 5, partial: false, discarded: 0 });
    const second = dataOf(await client.callTool({ name: "health_units_search", arguments: { limit: 5, skip: 5 } }));
    expect(second.discarded).toBe(0);
    expect(second.units.map((u) => u.name)).toEqual(["UMS 6", "UMS 7", "UMS 8", "UMS 9", "UMS 10"]);
  });

  it("does not count a resumed page's discards twice", async () => {
    const page = JSON.parse(syntheticPage("UMS", 1)) as { estabelecimentos: Record<string, unknown>[] };
    for (const r of page.estabelecimentos.slice(15)) r.descricao_natureza_juridica_estabelecimento = "4000";
    stubFetch({
      ...cnesRoutes(),
      [`GET ${establishmentsUrl(1, null)}`]: { body: JSON.stringify(page), contentType: JSON_TYPE },
      [`GET ${establishmentsUrl(2, null)}`]: { body: '{"estabelecimentos":[]}', contentType: JSON_TYPE },
    });
    const client = await connectClient();
    const first = dataOf(await client.callTool({ name: "health_units_search", arguments: { limit: 10 } }));
    expect(first).toMatchObject({ next_page: 1, next_skip: 10, discarded: 5 });
    const second = dataOf(await client.callTool({ name: "health_units_search", arguments: { limit: 10, skip: 10 } }));
    expect(second).toMatchObject({ next_page: null, discarded: 0 });
    expect(second.units).toHaveLength(5);
  });

  it("moves to the next page when the limit is filled exactly at a page end", async () => {
    stubFetch({ ...cnesRoutes(), [`GET ${establishmentsUrl(2, null)}`]: { body: syntheticPage("UMS", 1), contentType: JSON_TYPE } });
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { limit: 20, page: 2 } });
    expect(dataOf(res)).toMatchObject({ next_page: 3, next_skip: 0, scanned_pages: { from: 2, to: 2 } });
  });

  it("keeps what it has (partial) when a later page fails", async () => {
    stubFetch({
      ...cnesRoutes(),
      [`GET ${establishmentsUrl(1, null)}`]: { body: syntheticPage("UMS", 1), contentType: JSON_TYPE },
      [`GET ${establishmentsUrl(2, null)}`]: { status: 503 },
    });
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { name: "UMS 2" } });
    const data = dataOf(res);
    expect(data.units.length).toBeGreaterThan(0);
    expect(data).toMatchObject({ partial: true, next_page: 2 });
  });

  it("a final refusal (403) on a later page returns the partial with next_page null and does not ask again", async () => {
    const calls = stubFetch({
      ...cnesRoutes(),
      [`GET ${establishmentsUrl(1, null)}`]: { body: syntheticPage("UMS", 1), contentType: JSON_TYPE },
      [`GET ${establishmentsUrl(2, null)}`]: { status: 403, body: "Forbidden" },
    });
    const client = await connectClient();
    const data = dataOf(await client.callTool({ name: "health_units_search", arguments: { name: "UMS 2" } }));
    expect(data).toMatchObject({ partial: true, next_page: null, next_skip: 0 });
    expect(data.note).toMatch(/^The source refused page 2 \(HTTP 403\); it is not asked again\./);
    expect(data.note).not.toContain("continue with next_page");
    expect(calls.filter((c) => c.url !== CNES_TYPES_URL)).toHaveLength(2);
  });

  it("says how long to wait when a later page is refused with HTTP 429", async () => {
    stubFetch({
      ...cnesRoutes(),
      [`GET ${establishmentsUrl(1, null)}`]: { body: syntheticPage("UMS", 1), contentType: JSON_TYPE },
      [`GET ${establishmentsUrl(2, null)}`]: { status: 429, headers: { "retry-after": "60" } },
    });
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { name: "UMS 2" } });
    const data = dataOf(res);
    expect(data).toMatchObject({ partial: true, next_page: 2 });
    expect(data.note).toMatch(
      /^The source is limiting requests; wait 60 s before trying again\. Stopped after 1 upstream page\(s\); continue with next_page\./,
    );
  });

  it("is source_unavailable when the API answers with something else", async () => {
    for (const route of [{ status: 500 }, { body: "<html>down</html>" }, { body: '{"x":1}', contentType: JSON_TYPE }]) {
      stubFetch({ ...cnesRoutes(), [`GET ${establishmentsUrl(1, null)}`]: route });
      const client = await connectClient();
      const res = await client.callTool({ name: "health_units_search", arguments: {} });
      expect(errorOf(res)).toEqual({ error: "source_unavailable" });
    }
  });
});

describe("health_units_search host gate (CNES)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("spaces a no-match scan 400 ms apart, one request per page", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    CNES_GATE.minIntervalMs = CNES_MIN_INTERVAL_MS;
    const routes: Record<string, Route> = { ...cnesRoutes() };
    for (let p = 1; p <= 4; p++) {
      routes[`GET ${establishmentsUrl(p, null)}`] = { body: syntheticPage("UMS", p * 100, p === 4 ? 3 : 20), contentType: JSON_TYPE };
    }
    const calls = stubFetch(routes);
    const starts: number[] = [];
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      starts.push(Date.now());
      return inner(input, init);
    }) as typeof fetch;
    const t0 = Date.now();
    const client = await connectClient();
    const pending = client.callTool({ name: "health_units_search", arguments: { name: "nao bate" } });
    await vi.advanceTimersByTimeAsync(5 * CNES_MIN_INTERVAL_MS);
    expect(dataOf(await pending)).toMatchObject({ units: [], partial: false, scanned_pages: { from: 1, to: 4 } });
    expect(calls).toHaveLength(5); // unit types + 4 pages
    expect(starts.map((t) => t - t0)).toEqual([0, 400, 800, 1200, 1600]);
  });

  it("is rate_limited, not source_unavailable, when the gate's first page turn comes after the 20 s budget", async () => {
    const real = Date.now;
    let t = 1_000_000;
    globalThis.Date.now = () => t;
    const types = fixture("cnes_tipounidades_synthetic.json");
    let pages = 0;
    globalThis.fetch = (async (input: string | URL) => {
      if (String(input) !== CNES_TYPES_URL) pages++;
      t += 21_000; // the unit-type load takes 21 s
      return new Response(types, { status: 200, headers: { "content-type": JSON_TYPE } });
    }) as typeof fetch;
    try {
      const client = await connectClient();
      const res = await client.callTool({ name: "health_units_search", arguments: { name: "cajuru" } });
      expect(errorOf(res)).toEqual({ error: "rate_limited", message: "The source is limiting requests; wait about 1 minute before trying again." });
      expect(pages).toBe(0);
    } finally {
      globalThis.Date.now = real;
    }
  });

  it("remembers a 429: a second call inside the wait makes no request", async () => {
    const routes: Record<string, Route> = { ...cnesRoutes() };
    routes[`GET ${establishmentsUrl(1, null)}`] = { body: syntheticPage("UMS", 100), contentType: JSON_TYPE };
    routes[`GET ${establishmentsUrl(2, null)}`] = { status: 429, headers: { "retry-after": "120" } };
    const calls = stubFetch(routes);
    const client = await connectClient();
    const first = dataOf(await client.callTool({ name: "health_units_search", arguments: { name: "nao bate" } }));
    expect(first).toMatchObject({ partial: true, next_page: 2 });
    expect(calls).toHaveLength(3);
    const second = await client.callTool({ name: "health_units_search", arguments: { name: "nao bate", page: 2 } });
    expect(errorOf(second)).toMatchObject({ error: "rate_limited" });
    expect(calls).toHaveLength(3);
  });
});
