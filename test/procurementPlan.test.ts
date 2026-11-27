import { describe, expect, it } from "vitest";
import { pcaCategoriesUrl, pcaUnitsUrl } from "../src/sources/pncp.js";
import { todayBrasilia } from "../src/tools/procurementSearch.js";
import { connectClient, errorOf, fixture, stubFetch, type Route } from "./helpers.js";

const JSON_TYPE = "application/json";
const CITY = "76417005000186";
const FAS = "76568930000108";

interface Unit {
  unit: string;
  item_count: number;
  total_value: number;
  published_at: string;
  updated_at: string;
}
interface Data {
  mode: string;
  year: number;
  body_cnpj: string;
  body_name: string | null;
  plan_found: boolean;
  item_count: number;
  total_value: number;
  published_at: string | null;
  updated_at: string | null;
  categories: { category: string; item_count: number; total_value: number }[];
  units: Unit[];
  units_total: number;
  discarded: number;
  note: string;
}
const dataOf = (res: object) => (res as { structuredContent: { data: Data } }).structuredContent.data;
const plan = async (args: Record<string, unknown> = {}) => {
  const client = await connectClient();
  return client.callTool({ name: "procurement_search", arguments: { mode: "plan", year: 2027, ...args } });
};

function planRoutes(cnpj = CITY, year = 2027): Record<string, Route> {
  return {
    [`GET ${pcaUnitsUrl(cnpj, year)}`]: { body: fixture("pncp_pca_units_synthetic.json"), contentType: JSON_TYPE },
    [`GET ${pcaCategoriesUrl(cnpj, year)}`]: { body: fixture("pncp_pca_categories_synthetic.json"), contentType: JSON_TYPE },
  };
}
const noPlan = (status: number): Route => ({ status, body: '{"status":"404","message":"x"}', contentType: JSON_TYPE });

describe("procurement_search mode plan", () => {
  it("returns the body's plan: totals, categories and the units with the largest totals, in two requests", async () => {
    const calls = stubFetch(planRoutes());
    const res = await plan();
    const data = dataOf(res);
    expect(calls.map((c) => c.url)).toEqual([pcaUnitsUrl(CITY, 2027), pcaCategoriesUrl(CITY, 2027)]);
    expect(data.mode).toBe("plan");
    expect(data.plan_found).toBe(true);
    expect(data.body_cnpj).toBe(CITY);
    expect(data.body_name).toBe("MUNICIPIO DE CURITIBA");
    expect(data.item_count).toBe(85);
    expect(data.total_value).toBe(9_200_000);
    expect(data.published_at).toBe("2026-06-26T11:15:52");
    expect(data.updated_at).toBe("2026-08-31T14:34:43");
    expect(data.categories.map((c) => [c.category, c.item_count, c.total_value])).toEqual([
      ["Serviço", 30, 6_000_000],
      ["Material", 50, 2_000_000],
      ["Obra", 5, 1_200_000],
    ]);
    expect(data.units.map((u) => u.total_value)).toEqual([5_000_000, 3_000_000, 1_000_000, 200_000]);
    expect(data.units[0]!.unit).toBe("SMS - SECRETARIA FICTICIA DA SAUDE");
    expect(data.units_total).toBe(4);
    expect(data.discarded).toBe(3);
    expect(data.note).toMatch(/this body only/i);
    expect(data.note).toMatch(/3 malformed or foreign row\(s\) were left out/);
    expect((res as unknown as { structuredContent: { source_url: string } }).structuredContent.source_url).toBe(pcaUnitsUrl(CITY, 2027));
  });

  it("masks e-mails and phones in unit names and never returns rows of another body or year", async () => {
    stubFetch(planRoutes());
    const text = JSON.stringify((await plan()) as object);
    for (const planted of ["fulana.ficticia@example.invalid", "3333-0000", "OUTRO ORGAO", "OUTRO ANO", "SEM VALOR", "_synthetic"]) {
      expect(text).not.toContain(planted);
    }
    expect(text).toContain("DEPARTAMENTO FICTICIO contato [masked]");
  });

  it("returns at most limit units, keeping units_total and the full totals", async () => {
    stubFetch(planRoutes());
    const data = dataOf(await plan({ limit: 2 }));
    expect(data.units).toHaveLength(2);
    expect(data.units_total).toBe(4);
    expect(data.total_value).toBe(9_200_000);
  });

  it.each([404, 422])("answers plan_found false on HTTP %i, in one request, and the host is still asked on the next call", async (status) => {
    const calls = stubFetch({ ...planRoutes(), [`GET ${pcaUnitsUrl(FAS, 2027)}`]: noPlan(status) });
    const data = dataOf(await plan({ body_cnpj: FAS }));
    expect(calls).toHaveLength(1);
    expect(data.plan_found).toBe(false);
    expect(data.units).toEqual([]);
    expect(data.categories).toEqual([]);
    expect(data.total_value).toBe(0);
    expect(data.note).toMatch(new RegExp(`HTTP ${status}`));
    // A "no plan" answer is not a host failure: the gate does not hold the next request back.
    expect(dataOf(await plan()).plan_found).toBe(true);
  });

  it("reads an empty list as no plan, without asking for the categories", async () => {
    const calls = stubFetch({ [`GET ${pcaUnitsUrl(FAS, 2027)}`]: { body: "[]", contentType: JSON_TYPE } });
    const data = dataOf(await plan({ body_cnpj: FAS }));
    expect(calls).toHaveLength(1);
    expect(data.plan_found).toBe(false);
    expect(data.note).toMatch(/no units for this body and year/);
  });

  it("reads an empty HTTP 204 as no plan", async () => {
    stubFetch({ [`GET ${pcaUnitsUrl(FAS, 2027)}`]: { status: 204 } });
    const data = dataOf(await plan({ body_cnpj: FAS }));
    expect(data.plan_found).toBe(false);
    expect(data.note).toMatch(/HTTP 204/);
  });

  it("keeps the unit totals when the category request fails, and says why categories is empty", async () => {
    stubFetch({ ...planRoutes(), [`GET ${pcaCategoriesUrl(CITY, 2027)}`]: { status: 500, body: "x" } });
    const data = dataOf(await plan());
    expect(data.plan_found).toBe(true);
    expect(data.total_value).toBe(9_200_000);
    expect(data.categories).toEqual([]);
    expect(data.note).toMatch(/category totals could not be read \(HTTP 500\)/);
  });

  it("says so when no category row passes the format check", async () => {
    const renamed = JSON.stringify([{ categoriaItemId: 1, nomeCategoria: "Material", quantidadeItens: 1, valorTotal: 1 }]);
    stubFetch({ ...planRoutes(), [`GET ${pcaCategoriesUrl(CITY, 2027)}`]: { body: renamed, contentType: JSON_TYPE } });
    const data = dataOf(await plan());
    expect(data.categories).toEqual([]);
    expect(data.note).toMatch(/No category row passed the format check/);
  });

  it("refuses a body that is not a listed Curitiba municipal body, without a request", async () => {
    const calls = stubFetch({});
    const err = errorOf(await plan({ body_cnpj: "00394460005887" })) as { error: string; message: string };
    expect(err.error).toBe("invalid_argument");
    expect(calls).toHaveLength(0);
  });

  it("refuses a year after next year, without a request", async () => {
    const calls = stubFetch({});
    const next = Number(todayBrasilia().slice(0, 4)) + 1;
    expect((errorOf(await plan({ year: next + 1 })) as { error: string }).error).toBe("invalid_argument");
    expect(calls).toHaveLength(0);
  });

  it("defaults to next year (Brasília) and the Município de Curitiba", async () => {
    const next = Number(todayBrasilia().slice(0, 4)) + 1;
    stubFetch(planRoutes(CITY, next));
    const client = await connectClient();
    const data = dataOf(await client.callTool({ name: "procurement_search", arguments: { mode: "plan" } }));
    expect(data.year).toBe(next);
    expect(data.body_cnpj).toBe(CITY);
  });

  it.each([
    [{ query: "merenda" }, "query"],
    [{ from: "2026-01-01" }, "from"],
    [{ modality: 8 }, "modality"],
    [{ page: 2 }, "page"],
  ])("refuses search-only arguments in mode plan: %j", async (args, name) => {
    const calls = stubFetch({});
    const err = errorOf(await plan(args)) as { error: string; message: string };
    expect(err.error).toBe("invalid_argument");
    expect(err.message).toContain(name);
    expect(calls).toHaveLength(0);
  });

  it("refuses year and body_cnpj outside mode plan", async () => {
    const calls = stubFetch({});
    const client = await connectClient();
    for (const args of [{ year: 2027 }, { body_cnpj: CITY }]) {
      const err = errorOf(await client.callTool({ name: "procurement_search", arguments: args })) as { error: string };
      expect(err.error).toBe("invalid_argument");
    }
    expect(calls).toHaveLength(0);
  });

  it("fails as source_unavailable when every returned unit row is malformed (a renamed field is not 'no plan')", async () => {
    const rows = (JSON.parse(fixture("pncp_pca_units_synthetic.json")) as Record<string, unknown>[]).map((r) => ({ ...r, valorTotal: undefined }));
    stubFetch({ ...planRoutes(), [`GET ${pcaUnitsUrl(CITY, 2027)}`]: { body: JSON.stringify(rows), contentType: JSON_TYPE } });
    expect((errorOf(await plan()) as { error: string }).error).toBe("source_unavailable");
  });

  it("fails as source_unavailable when the units answer is not a list", async () => {
    stubFetch({ ...planRoutes(), [`GET ${pcaUnitsUrl(CITY, 2027)}`]: { body: '{"data":[]}', contentType: JSON_TYPE } });
    expect((errorOf(await plan()) as { error: string }).error).toBe("source_unavailable");
  });
});
