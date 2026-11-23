import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALIQUOTA_MUNICIPIO_URL,
  ALIQUOTA_UF_URL,
  ALIQUOTA_UNIAO_URL,
  CLASS_TRIB_URL,
  DISCLAIMER,
  NBS_URL,
  NCM_URL,
  RECEITA_GATE,
  VERSAO_URL,
} from "../src/sources/receita.js";
import { taxReformCuritibaOutput } from "../src/tools/taxReformCuritiba.js";
import { connectClient, errorOf, fixture, stubFetch, type Route } from "./helpers.js";

const JSON_TYPE = "application/json";
const D = "2026-03-10";
const json = (body: unknown, extra: Partial<Route> = {}): Route => ({ body: JSON.stringify(body), contentType: JSON_TYPE, ...extra });
const file = (name: string): Route => ({ body: fixture(`receita/${name}`), contentType: JSON_TYPE });

function rateRoutes(date = D, over: Record<string, Route> = {}): Record<string, Route> {
  return {
    [`GET ${VERSAO_URL}`]: file("versao.json"),
    [`GET ${ALIQUOTA_UNIAO_URL(date)}`]: json({ aliquotaReferencia: 0.9 }),
    [`GET ${ALIQUOTA_UF_URL(date)}`]: json({ aliquotaReferencia: 0.1 }),
    [`GET ${ALIQUOTA_MUNICIPIO_URL(date)}`]: json({ aliquotaReferencia: 0.0 }),
    ...over,
  };
}

async function call(args: Record<string, unknown> = {}) {
  const client = await connectClient();
  return client.callTool({ name: "tax_reform_curitiba", arguments: args });
}

describe("tax_reform_curitiba rates", () => {
  it("returns the three reference rates for Curitiba/PR, the Receita versions and the disclaimer", async () => {
    const calls = stubFetch(rateRoutes());
    const res = await call({ date: D });
    expect(res.isError).toBeFalsy();
    const out = taxReformCuritibaOutput.parse(res.structuredContent);
    expect(out.data).toMatchObject({
      topic: "rates",
      city: "Curitiba",
      ibge_code: "4106902",
      uf: "PR",
      date: D,
      rates: { cbs_pct: 0.9, ibs_uf_pct: 0.1, ibs_municipal_pct: 0 },
      receita_version: { app_version: "9.9.9-ficticio", db_version: "V9999", db_date: "2030-01-02", db_description: "Base ficticia de teste" },
      disclaimer: "API piloto da Receita Federal; não é orientação fiscal; confirme com o contador",
      simulated: false,
    });
    expect(out.note).not.toMatch(/simulados/);
    expect(calls.map((c) => c.url)).toEqual([VERSAO_URL, ALIQUOTA_UNIAO_URL(D), ALIQUOTA_UF_URL(D), ALIQUOTA_MUNICIPIO_URL(D)]);
    expect(ALIQUOTA_UF_URL(D)).toContain("codigoUf=41&");
    expect(ALIQUOTA_MUNICIPIO_URL(D)).toContain("codigoMunicipio=4106902&");
    expect(out.license_note).toMatch(/MIT/);
    expect(out.license_note).toMatch(/no terms of use/i);
  });

  it("defaults the date to today in America/Sao_Paulo", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 02:00 UTC on 6 May is still 5 May in Curitiba.
    vi.setSystemTime(new Date("2026-05-06T02:00:00Z"));
    try {
      stubFetch(rateRoutes("2026-05-05"));
      const out = taxReformCuritibaOutput.parse((await call()).structuredContent);
      expect(out.data.date).toBe("2026-05-05");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a rate the base does not have (HTTP 404) is null with a note, and the host is not blocked", async () => {
    const notFound: Route = { status: 404, body: '{"title":"Alíquota não encontrada"}', contentType: "application/problem+json" };
    const calls = stubFetch(rateRoutes(D, { [`GET ${ALIQUOTA_MUNICIPIO_URL(D)}`]: notFound }));
    const out = taxReformCuritibaOutput.parse((await call({ date: D })).structuredContent);
    expect(out.data.rates).toEqual({ cbs_pct: 0.9, ibs_uf_pct: 0.1, ibs_municipal_pct: null });
    expect(out.note).toMatch(/no reference rate/i);
    // A missing rate is not cached: the next call asks for it again (the found ones come from the cache).
    await call({ date: D });
    expect(calls.map((c) => c.url)).toEqual([VERSAO_URL, ALIQUOTA_UNIAO_URL(D), ALIQUOTA_UF_URL(D), ALIQUOTA_MUNICIPIO_URL(D), ALIQUOTA_MUNICIPIO_URL(D)]);
    // The 404 is not remembered as a host failure: another date is asked at once.
    const more = stubFetch(rateRoutes("2026-03-11"));
    expect((await call({ date: "2026-03-11" })).isError).toBeFalsy();
    expect(more).toHaveLength(3);
  });

  it.each<[string, Route]>([
    ["HTTP 5xx", { status: 503, body: "down" }],
    ["host down", { error: true }],
    ["not JSON", { body: "<html>maintenance</html>", contentType: "text/html" }],
    ["missing aliquotaReferencia", json({ aliquotaPropria: 1 })],
    ["empty body", json({})],
  ])("fails closed with no partial rates on %s", async (_name, route) => {
    stubFetch(rateRoutes(D, { [`GET ${ALIQUOTA_UF_URL(D)}`]: route }));
    expect(errorOf(await call({ date: D }))).toEqual({ error: "source_unavailable", message: `${DISCLAIMER}.` });
  });

  it("fails closed when versao has no versaoApp", async () => {
    stubFetch(rateRoutes(D, { [`GET ${VERSAO_URL}`]: json({ versaoDb: "V1" }) }));
    expect(errorOf(await call({ date: D }))).toMatchObject({ error: "source_unavailable" });
  });

  it("a 2027 date returns the values with simulated: true and the note (year rule, no header)", async () => {
    const d = "2027-06-01";
    stubFetch(rateRoutes(d));
    const out = taxReformCuritibaOutput.parse((await call({ date: d })).structuredContent);
    expect(out.data.simulated).toBe(true);
    expect(out.data.rates).toEqual({ cbs_pct: 0.9, ibs_uf_pct: 0.1, ibs_municipal_pct: 0 });
    expect(out.note).toContain("valores simulados pela Receita Federal; não são alíquotas definitivas");
  });

  it("a rate answer marked by the Receita (x-warning-dados-simulados) is simulated even in 2026", async () => {
    const marked = json({ aliquotaReferencia: 0.9 }, { headers: { "x-warning-dados-simulados": "1" } });
    stubFetch(rateRoutes(D, { [`GET ${ALIQUOTA_UNIAO_URL(D)}`]: marked }));
    const out = taxReformCuritibaOutput.parse((await call({ date: D })).structuredContent);
    expect(out.data.simulated).toBe(true);
    expect(out.note).toContain("valores simulados pela Receita Federal; não são alíquotas definitivas");
  });

  it("the default date (today) still works after 2027-01-01, as simulated", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-02T12:00:00Z"));
    try {
      stubFetch(rateRoutes("2027-01-02"));
      const out = taxReformCuritibaOutput.parse((await call()).structuredContent);
      expect(out.data.date).toBe("2027-01-02");
      expect(out.data.simulated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a lookup for a 2027 date is simulated too; a 2026 lookup is not", async () => {
    stubFetch({
      [`GET ${VERSAO_URL}`]: file("versao.json"),
      [`GET ${NBS_URL("2027-02-01")}`]: file("nbs_lista.json"),
      [`GET ${NBS_URL(D)}`]: file("nbs_lista.json"),
    });
    const later = taxReformCuritibaOutput.parse((await call({ topic: "nbs", query: "ficticio", date: "2027-02-01" })).structuredContent);
    expect(later.data.simulated).toBe(true);
    expect(later.note).toContain("valores simulados pela Receita Federal");
    const now = taxReformCuritibaOutput.parse((await call({ topic: "nbs", query: "ficticio", date: D })).structuredContent);
    expect(now.data.simulated).toBe(false);
  });

  it("a list answer marked by the Receita is simulated even in 2026", async () => {
    stubFetch({
      [`GET ${VERSAO_URL}`]: file("versao.json"),
      [`GET ${CLASS_TRIB_URL(D)}`]: { ...file("class_trib.json"), headers: { "x-warning-dados-simulados": "1" } },
    });
    const out = taxReformCuritibaOutput.parse((await call({ topic: "class_trib", query: "saude", date: D })).structuredContent);
    expect(out.data.simulated).toBe(true);
    expect(out.note).toContain("valores simulados pela Receita Federal");
  });

  it("names every request of a rates answer in license_note", async () => {
    stubFetch(rateRoutes());
    const out = taxReformCuritibaOutput.parse((await call({ date: D })).structuredContent);
    for (const u of [VERSAO_URL, ALIQUOTA_UNIAO_URL(D), ALIQUOTA_UF_URL(D), ALIQUOTA_MUNICIPIO_URL(D)]) expect(out.license_note).toContain(u);
  });

  it("an HTML page on any route is a host failure: not asked again for 60 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const calls = stubFetch({
        [`GET ${VERSAO_URL}`]: file("versao.json"),
        [`GET ${NCM_URL(D)}`]: { body: "<html>manutencao</html>", contentType: "text/html" },
        ...rateRoutes(),
      });
      expect(errorOf(await call({ topic: "ncm", query: "12", date: D }))).toMatchObject({ error: "source_unavailable" });
      const n = calls.length;
      expect(errorOf(await call({ date: D }))).toMatchObject({ error: "source_unavailable" });
      expect(calls).toHaveLength(n);
      vi.advanceTimersByTime(60_000);
      expect((await call({ date: D })).isError).toBeFalsy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("caches the answer: a second call makes no request", async () => {
    const calls = stubFetch(rateRoutes());
    await call({ date: D });
    await call({ date: D });
    expect(calls).toHaveLength(4);
  });
});

describe("tax_reform_curitiba lookups", () => {
  it("nbs: text matches every word ignoring accents and case; sorted by code; bad items skipped", async () => {
    const calls = stubFetch({ [`GET ${VERSAO_URL}`]: file("versao.json"), [`GET ${NBS_URL(D)}`]: file("nbs_lista.json") });
    const out = taxReformCuritibaOutput.parse((await call({ topic: "nbs", query: "SERVIÇO ficticio", date: D })).structuredContent);
    expect(out.data.items?.map((i) => i.code)).toEqual(["199990100", "199990200", "299990100"]);
    expect(out.data.total).toBe(3);
    expect(out.data.skipped).toBe(1);
    expect(out.data.disclaimer).toBe(DISCLAIMER);
    // The user's text never reaches the host.
    expect(calls.map((c) => c.url)).toEqual([VERSAO_URL, NBS_URL(D)]);
    expect(calls.every((c) => !/ficticio/i.test(c.url))).toBe(true);
  });

  it("nbs: a code with dots is a prefix match; limit caps the items, total counts all", async () => {
    stubFetch({ [`GET ${VERSAO_URL}`]: file("versao.json"), [`GET ${NBS_URL(D)}`]: file("nbs_lista.json") });
    const out = taxReformCuritibaOutput.parse((await call({ topic: "nbs", query: "1.9999", limit: 1, date: D })).structuredContent);
    expect(out.data.items?.map((i) => i.code)).toEqual(["199990100"]);
    expect(out.data.total).toBe(2);
  });

  it("ncm: code lookup, and the note says text search is weak", async () => {
    stubFetch({ [`GET ${VERSAO_URL}`]: file("versao.json"), [`GET ${NCM_URL(D)}`]: file("ncm_vigentes.json") });
    const out = taxReformCuritibaOutput.parse((await call({ topic: "ncm", query: "9988.77", date: D })).structuredContent);
    expect(out.data.items?.map((i) => [i.code, i.description])).toEqual([
      ["99887711", "Produto ficticio de cafe torrado"],
      ["99887766", "-- Outros"],
    ]);
    expect(out.note).toMatch(/Outros/);
  });

  it("class_trib: returns the reduction percentages next to the code, nothing multiplied", async () => {
    stubFetch({ [`GET ${VERSAO_URL}`]: file("versao.json"), [`GET ${CLASS_TRIB_URL(D)}`]: file("class_trib.json") });
    const out = taxReformCuritibaOutput.parse((await call({ topic: "class_trib", query: "saude", date: D })).structuredContent);
    expect(out.data.items).toEqual([
      {
        code: "900002",
        description: "Servico ficticio de saude com reducao",
        rate_type: "Uniforme setorial",
        treatment: "Reducao ficticia de 60%",
        nomenclature: "NBS",
        reduction_cbs_pct: 60,
        reduction_ibs_uf_pct: 60,
        reduction_ibs_municipal_pct: 60,
      },
    ]);
    expect(out.data.rates).toBeNull();
  });

  it("keeps at most 3 lists in the cache: the oldest is asked again", async () => {
    const dates = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"];
    const routes: Record<string, Route> = { [`GET ${VERSAO_URL}`]: file("versao.json") };
    for (const d of dates) routes[`GET ${NBS_URL(d)}`] = file("nbs_lista.json");
    const calls = stubFetch(routes);
    for (const d of [...dates, dates[3]!, dates[0]!]) await call({ topic: "nbs", query: "ficticio", date: d });
    expect(calls.filter((c) => c.url === NBS_URL(dates[0]!))).toHaveLength(2);
    expect(calls.filter((c) => c.url === NBS_URL(dates[3]!))).toHaveLength(1);
  });

  it("an empty list is total 0 with a note, not an error", async () => {
    stubFetch({ [`GET ${VERSAO_URL}`]: file("versao.json"), [`GET ${NBS_URL(D)}`]: json([]) });
    const out = taxReformCuritibaOutput.parse((await call({ topic: "nbs", query: "qualquer", date: D })).structuredContent);
    expect(out.data.total).toBe(0);
    expect(out.data.items).toEqual([]);
    expect(out.note).toMatch(/empty/i);
  });

  it.each<[string, Route]>([
    ["not an array", json({ codigo: "1" })],
    ["no readable item", json([{ codigo: 1 }, { descricao: "x" }])],
    ["HTTP 500", { status: 500 }],
  ])("fails closed when the list is %s", async (_name, route) => {
    stubFetch({ [`GET ${VERSAO_URL}`]: file("versao.json"), [`GET ${NBS_URL(D)}`]: route });
    expect(errorOf(await call({ topic: "nbs", query: "abc", date: D }))).toMatchObject({ error: "source_unavailable" });
  });
});

describe("tax_reform_curitiba nfse", () => {
  it("returns the fixed NFS-e note with no request", async () => {
    const calls = stubFetch({});
    const out = taxReformCuritibaOutput.parse((await call({ topic: "nfse" })).structuredContent);
    expect(calls).toHaveLength(0);
    expect(out.data.disclaimer).toBe(DISCLAIMER);
    expect(out.checked_at).toBe("2026-11-23T00:00:00-03:00");
    const n = out.data.nfse!;
    expect(n.checked).toBe("conferido em 2026-11-23");
    expect(n.text).toMatch(/Emissor Nacional/);
    expect(n.schedule.map((s) => s.from)).toEqual(["2025-10-01", "2025-11-01", "2026-01-01"]);
    expect(n.legal_basis).toEqual(["Decreto 1960/2025", "Portaria 33/2025"]);
    expect(n.public_lookup).toBe("https://www.nfse.gov.br/consultapublica");
    expect(out.source_url).toBe("https://lp.curitiba.pr.gov.br/notanacional");
  });
});

describe("tax_reform_curitiba arguments", () => {
  it.each<[string, Record<string, unknown>]>([
    ["a date before 2026", { date: "2025-12-31" }],
    ["a date after 2099 (typo guard)", { date: "3026-01-01" }],
    ["a date that does not exist", { date: "2026-02-30" }],
    ["a query with rates", { query: "abc" }],
    ["a lookup with no query", { topic: "ncm" }],
    ["a code query made only of separators", { topic: "ncm", query: "--" }],
  ])("refuses %s with invalid_argument and no request", async (_name, args) => {
    const calls = stubFetch({});
    const err = errorOf(await call(args)) as { error: string; message: string };
    expect(err.error).toBe("invalid_argument");
    expect(err.message.endsWith(`${DISCLAIMER}.`)).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("requests to the Receita host", () => {
  afterEach(() => {
    vi.useRealTimers();
    RECEITA_GATE.minIntervalMs = 0;
  });

  it("a cold rates call still fits behind a lookup that took the two slots before it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    RECEITA_GATE.minIntervalMs = 5_000;
    stubFetch({ ...rateRoutes(), [`GET ${NBS_URL(D)}`]: file("nbs_lista.json") });
    const lookup = call({ topic: "nbs", query: "ficticio", date: D });
    await vi.advanceTimersByTimeAsync(1);
    // The lookup took versao (cached for the rates call) and the list: the rates need 3 slots after those.
    const rates = call({ date: D });
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await lookup).isError).toBeFalsy();
    expect((await rates).isError).toBeFalsy();
  });

  it("keeps at least 5 s between requests; a cold rates call fits in the queue limit", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    RECEITA_GATE.minIntervalMs = 5_000;
    const calls = stubFetch(rateRoutes());
    const pending = call({ date: D });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15_001);
    const res = await pending;
    expect(res.isError).toBeFalsy();
    expect(calls).toHaveLength(4);
  });
});
