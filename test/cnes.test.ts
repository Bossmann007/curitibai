import { describe, expect, it } from "vitest";
import { CNES_TYPES_URL, establishmentsUrl, isPublicAdministration, parseEstablishments } from "../src/sources/cnes.js";
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
  it("returns public units with type labels and requests active Curitiba units", async () => {
    const calls = stubFetch(cnesRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: {} });
    const data = dataOf(res);
    expect(data.units.map((u) => u.name)).toEqual(["UMS FICTICIA ALFA", "CAPS FICTÍCIO BETA", "UPA FICTICIA EPSILON"]);
    expect(data.units[0]?.unit_type).toBe("UNIDADE BASICA FICTICIA");
    expect(data).toMatchObject({ next_page: null, partial: false, scanned_pages: { from: 1, to: 1 } });
    expect(data.note).toMatch(/Private clinics, consultórios and non-profit hospitals/);
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
    for (let p = 1; p <= 10; p++) {
      routes[`GET ${establishmentsUrl(p, null)}`] = { body: syntheticPage("UMS", p * 100), contentType: JSON_TYPE };
    }
    const calls = stubFetch(routes);
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { name: "nao bate" } });
    const data = dataOf(res);
    expect(data).toMatchObject({ units: [], partial: true, next_page: 6, scanned_pages: { from: 1, to: 5 } });
    expect(calls.filter((c) => c.url !== CNES_TYPES_URL)).toHaveLength(MAX_CNES_REQUESTS);
  });

  it("restarts next_page on a page that had more matches than fit", async () => {
    stubFetch({ ...cnesRoutes(), [`GET ${establishmentsUrl(1, null)}`]: { body: syntheticPage("UMS", 1), contentType: JSON_TYPE } });
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { limit: 5 } });
    const data = dataOf(res);
    expect(data.units).toHaveLength(5);
    expect(data).toMatchObject({ next_page: 1, partial: false });
    expect(data.note).toMatch(/de-duplicate by cnes_code/);
  });

  it("moves to the next page when the limit is filled exactly at a page end", async () => {
    stubFetch({ ...cnesRoutes(), [`GET ${establishmentsUrl(2, null)}`]: { body: syntheticPage("UMS", 1), contentType: JSON_TYPE } });
    const client = await connectClient();
    const res = await client.callTool({ name: "health_units_search", arguments: { limit: 20, page: 2 } });
    expect(dataOf(res)).toMatchObject({ next_page: 3, scanned_pages: { from: 2, to: 2 } });
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

  it("is source_unavailable when the API answers with something else", async () => {
    for (const route of [{ status: 500 }, { body: "<html>down</html>" }, { body: '{"x":1}', contentType: JSON_TYPE }]) {
      stubFetch({ ...cnesRoutes(), [`GET ${establishmentsUrl(1, null)}`]: route });
      const client = await connectClient();
      const res = await client.callTool({ name: "health_units_search", arguments: {} });
      expect(errorOf(res)).toEqual({ error: "source_unavailable" });
    }
  });
});
