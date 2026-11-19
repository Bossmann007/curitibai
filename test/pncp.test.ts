import { describe, expect, it } from "vitest";
import { isAllowedUrl } from "../src/http.js";
import {
  CURITIBA_BODIES,
  maskObject,
  MASK,
  objectReturnable,
  OBJECT_WITHHELD_MODALITIES,
  parseContratacoes,
  PNCP_PAGE_SIZE,
} from "../src/sources/pncp.js";
import { MAX_PNCP_REQUESTS, todayBrasilia } from "../src/tools/procurementSearch.js";
import {
  connectClient,
  errorOf,
  fixture,
  PNCP_FROM,
  PNCP_TO,
  pncpRoutes,
  pncpUrl,
  stubFetch,
  syntheticPncpPage,
  type Route,
} from "./helpers.js";

const JSON_TYPE = "application/json";

interface Item {
  pncp_id: string;
  body_cnpj: string;
  body_name: string;
  modality_code: number | null;
  object: string | null;
  object_withheld: string | null;
  object_truncated: boolean;
  link: string;
}
interface Data {
  items: Item[];
  next_page: number | null;
  next_skip: number;
  partial: boolean;
  discarded: number;
  scanned_pages: { from: number; to: number };
  note: string;
}
const dataOf = (res: object) => (res as { structuredContent: { data: Data } }).structuredContent.data;
const search = async (args: Record<string, unknown> = {}) => {
  const client = await connectClient();
  return client.callTool({ name: "procurement_search", arguments: { from: PNCP_FROM, to: PNCP_TO, ...args } });
};

/** Everything planted in the synthetic fixture that must never reach a tool result. */
const PLANTED = [
  // supplier keys and values (a natural person)
  "niFornecedor",
  "nomeRazaoSocialFornecedor",
  "fornecedor",
  "12345678909",
  "98765432100",
  "FORNECEDORA PESSOA FICTICIA",
  // people named in objects of direct awards
  "FULANO FICTICIO PRIMEIRO",
  "CICLANA FICTICIA SEGUNDA",
  "DOCENTE FICTICIA TERCEIRA",
  "EPSILON FICTICIO",
  // CPF, CNPJ, e-mail and phone inside a competitive object
  "123.456.789-09",
  "12.345.678/0001-95",
  "fulana.ficticia@example.invalid",
  "3333-0000",
  // other free text and fields the output never carries
  "BELTRANO FICTICIO",
  "SICRANO FICTICIO",
  "PLATAFORMA FICTICIA",
  "origem.example.invalid",
  "PROCESSO FICTICIO",
  "informacaoComplementar",
  // records that are not a listed Curitiba body, or are malformed
  "GAMA",
  "DELTA",
  "PROMOTOR TESTE BNC",
  "ZETA",
];

describe("PNCP host allowlist", () => {
  it("allows only https://pncp.gov.br on the default port", () => {
    expect(isAllowedUrl(pncpUrl())).toBe(true);
    for (const u of [
      "http://pncp.gov.br/api/consulta/v1/contratacoes/publicacao",
      "https://pncp.gov.br:8443/api/consulta",
      "https://user:pw@pncp.gov.br/api/consulta",
      "https://treina.pncp.gov.br/api/consulta",
      "https://www.pncp.gov.br/",
      "https://pncp.gov.br.evil.com/",
      "https://gov.br/",
      "https://www.gov.br/pncp/pt-br",
    ]) {
      expect({ u, ok: isAllowedUrl(u) }).toEqual({ u, ok: false });
    }
  });

  it("refuses a PNCP redirect to a host off the allowlist without requesting it", async () => {
    const calls = stubFetch({ [`GET ${pncpUrl()}`]: { status: 302, headers: { location: "http://169.254.169.254/latest/" } } });
    const res = await search();
    expect(errorOf(res)).toEqual({ error: "url_not_allowed" });
    expect(calls.map((c) => c.url)).toEqual([pncpUrl()]);
  });

  it("follows a redirect that stays on pncp.gov.br", async () => {
    const moved = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?moved=1";
    const calls = stubFetch({
      [`GET ${pncpUrl()}`]: { status: 301, headers: { location: moved } },
      [`GET ${moved}`]: { body: fixture("pncp_contratacoes_synthetic.json"), contentType: JSON_TYPE },
    });
    const res = await search();
    expect(dataOf(res).items.length).toBeGreaterThan(0);
    expect(calls.map((c) => c.url)).toEqual([pncpUrl(), moved]);
  });
});

describe("procurement_search privacy", () => {
  it("never returns the supplier, CPF/CNPJ of a person, or other planted personal data", async () => {
    stubFetch(pncpRoutes());
    const res = await search();
    expect(res.isError).toBeFalsy();
    const text = JSON.stringify(res); // the whole tool result: text content and structuredContent
    for (const p of PLANTED) expect({ planted: p, leaked: text.includes(p) }).toEqual({ planted: p, leaked: false });
    for (const it of dataOf(res).items) {
      expect(Object.keys(it).sort()).toEqual(
        [
          "body_cnpj",
          "body_name",
          "estimated_value",
          "link",
          "modality",
          "modality_code",
          "object",
          "object_truncated",
          "object_withheld",
          "pncp_id",
          "proposals_close_at",
          "proposals_open_at",
          "published_at",
          "status",
          "status_code",
        ].sort(),
      );
      expect(CURITIBA_BODIES.has(it.body_cnpj)).toBe(true);
    }
  });

  it("withholds the object of inexigibilidade, dispensa and unknown modalities but keeps the rest", async () => {
    stubFetch(pncpRoutes());
    const items = dataOf(await search()).items;
    const byCode = (c: number) => items.find((i) => i.modality_code === c)!;
    for (const code of [9, 8, 99]) {
      expect(byCode(code)).toMatchObject({ object: null, object_withheld: "may_name_a_person" });
    }
    expect(byCode(9)).toMatchObject({
      body_name: "FUNDACAO DE ACAO SOCIAL FAS",
      link: "https://pncp.gov.br/app/editais/76568930000108/2026/2",
      status: "Divulgada no PNCP",
      published_at: "2026-11-03T08:00:00",
    });
  });

  it("masks CPF/CNPJ-shaped numbers, e-mail and phone in a competitive object", async () => {
    stubFetch(pncpRoutes());
    const items = dataOf(await search()).items;
    const pregao = items.find((i) => i.modality_code === 6)!;
    expect(pregao.object_withheld).toBeNull();
    expect(pregao.object).toBe(
      `Aquisição de medicamentos ficticios. Contato: ${MASK}, ${MASK}; CPF do responsável ${MASK}; CNPJ ${MASK}.`,
    );
  });

  it("caps a long competitive object at 300 characters", async () => {
    stubFetch(pncpRoutes());
    const conc = dataOf(await search()).items.find((i) => i.modality_code === 4)!;
    expect(conc.object_truncated).toBe(true);
    expect(conc.object!.length).toBeLessThanOrEqual(301);
    expect(conc.object!.endsWith("…")).toBe(true);
  });

  it("returns only listed Curitiba bodies and counts malformed ones as discarded", async () => {
    stubFetch(pncpRoutes());
    const data = dataOf(await search());
    expect(data.items.map((i) => i.pncp_id)).toEqual([
      "76417005000186-1-000001/2026",
      "76568930000108-1-000002/2026",
      "76417005001743-1-000003/2026",
      "77636520000110-1-000006/2026",
      "75123125000108-1-000007/2026",
    ]);
    expect(data).toMatchObject({ discarded: 1, partial: false, next_page: null });
  });

  it("a query never matches a withheld object", async () => {
    stubFetch(pncpRoutes());
    expect(dataOf(await search({ query: "fulano ficticio" })).items).toEqual([]);
    expect(dataOf(await search({ query: "servidores" })).items).toEqual([]);
    expect(dataOf(await search({ query: "medicamentos" })).items.map((i) => i.modality_code)).toEqual([6]);
    expect(dataOf(await search({ query: "acao social" })).items.map((i) => i.modality_code)).toEqual([9]);
  });
});

describe("object gate (unit)", () => {
  it("gates exactly 8, 9, 14 and unknown codes", () => {
    expect([...OBJECT_WITHHELD_MODALITIES].sort((a, b) => a - b)).toEqual([8, 9, 14]);
    for (const c of [8, 9, 14, 0, 21, 99, null]) expect(objectReturnable(c)).toBe(false);
    for (const c of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20]) expect(objectReturnable(c)).toBe(true);
  });

  /**
   * Mutation check: parse the fixture with the gate removed (every modality returnable) and prove the privacy
   * assertion above would then fail, so the test really depends on the gate.
   */
  it("removing the modality gate leaks the planted names (the privacy test depends on it)", () => {
    const page = parseContratacoes(fixture("pncp_contratacoes_synthetic.json"));
    const raw = JSON.parse(fixture("pncp_contratacoes_synthetic.json")) as { data: { sequencialCompra: number; objetoCompra: string }[] };
    const ungated = page.items.map((it) => {
      const rec = raw.data.find((r) => it.link.endsWith(`/${r.sequencialCompra}`))!;
      return { ...it, object: maskObject(rec.objetoCompra).text };
    });
    const text = JSON.stringify(ungated);
    expect(PLANTED.some((p) => text.includes(p))).toBe(true);
    expect(JSON.stringify(page.items).includes("FULANO FICTICIO PRIMEIRO")).toBe(false);
  });

  it("drops a listed body's record with a malformed control number", () => {
    const raw = JSON.parse(fixture("pncp_contratacoes_synthetic.json")) as { data: Record<string, unknown>[] };
    raw.data[0]!.numeroControlePNCP = "FULANO FICTICIO 123.456.789-09";
    const page = parseContratacoes(JSON.stringify(raw));
    expect(page.items.map((i) => i.pncp_id)).not.toContain("FULANO FICTICIO 123.456.789-09");
    expect(page.discarded).toBe(2);
  });

  it.each([
    ["CPF 123.456.789-09", `CPF ${MASK}`],
    ["CPF 12345678909", `CPF ${MASK}`],
    ["CNPJ 12.345.678/0001-95", `CNPJ ${MASK}`],
    ["fone 41 99999-0000", `fone ${MASK}`],
    ["fone (41)3333-0000", `fone ${MASK}`],
    ["fone +55 41 3333 0000", `fone ${MASK}`],
    ["fone 4133330000", `fone ${MASK}`],
    ["mail a.b@c.gov.br ok", `mail ${MASK} ok`],
    ["Pregão 116/2026, R$ 1.234.567,89, Lei 14.133", "Pregão 116/2026, R$ 1.234.567,89, Lei 14.133"],
    ["  espaços   colapsados  ", "espaços colapsados"],
  ])("maskObject(%j)", (input, expected) => {
    expect(maskObject(input)).toEqual({ text: expected, truncated: false });
  });
});

describe("procurement_search paging", () => {
  it("requests Curitiba by IBGE code with the given dates and modality", async () => {
    const calls = stubFetch({ [`GET ${pncpUrl(1, 4)}`]: { body: syntheticPncpPage(1, 2, 0, 3), contentType: JSON_TYPE } });
    await search({ modality: 4 });
    expect(Object.fromEntries(new URL(calls[0]!.url).searchParams)).toEqual({
      dataInicial: "20261101",
      dataFinal: "20261118",
      codigoModalidadeContratacao: "4",
      codigoMunicipioIbge: "4106902",
      pagina: "1",
      tamanhoPagina: String(PNCP_PAGE_SIZE),
    });
  });

  it("defaults to modality 6 and the last 30 days", async () => {
    const calls = stubFetch({});
    const client = await connectClient();
    await client.callTool({ name: "procurement_search", arguments: {} });
    const params = new URL(calls[0]!.url).searchParams;
    const to = todayBrasilia();
    expect(params.get("dataFinal")).toBe(to.replaceAll("-", ""));
    expect((Date.parse(to) - Date.parse(params.get("dataInicial")!.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"))) / 86_400_000).toBe(30);
    expect(params.get("codigoModalidadeContratacao")).toBe("6");
  });

  it("treats HTTP 204 (no results) as an empty list, not an error", async () => {
    stubFetch({ [`GET ${pncpUrl()}`]: { status: 204, body: "" } });
    const res = await search();
    expect(res.isError).toBeFalsy();
    expect(dataOf(res)).toMatchObject({ items: [], next_page: null, partial: false, scanned_pages: { from: 1, to: 1 } });
  });

  it(`caps the scan at ${MAX_PNCP_REQUESTS} upstream pages and says partial`, async () => {
    const routes: Record<string, Route> = {};
    for (let p = 1; p <= 5; p++) routes[`GET ${pncpUrl(p)}`] = { body: syntheticPncpPage(p * 100, 1, 5 - p), contentType: JSON_TYPE };
    const calls = stubFetch(routes);
    const data = dataOf(await search({ limit: 20 }));
    expect(data).toMatchObject({ partial: true, next_page: 3, scanned_pages: { from: 1, to: 2 } });
    expect(data.items).toHaveLength(2);
    expect(data.note).toMatch(/Stopped after 2 upstream page/);
    expect(calls).toHaveLength(MAX_PNCP_REQUESTS);
  });

  it("a later page failing returns what was found as partial", async () => {
    stubFetch({ [`GET ${pncpUrl(1)}`]: { body: syntheticPncpPage(1, 3, 4), contentType: JSON_TYPE }, [`GET ${pncpUrl(2)}`]: { error: true } });
    const data = dataOf(await search({ limit: 20 }));
    expect(data).toMatchObject({ partial: true, next_page: 2 });
    expect(data.items).toHaveLength(3);
  });

  it.each([3, 7, 20])("following next_page/next_skip with limit %i visits every item exactly once", async (limit) => {
    const routes: Record<string, Route> = {};
    routes[`GET ${pncpUrl(1)}`] = { body: syntheticPncpPage(100, 12, 3), contentType: JSON_TYPE };
    routes[`GET ${pncpUrl(2)}`] = { body: syntheticPncpPage(200, 0, 2), contentType: JSON_TYPE };
    routes[`GET ${pncpUrl(3)}`] = { body: syntheticPncpPage(300, 25, 1), contentType: JSON_TYPE };
    routes[`GET ${pncpUrl(4)}`] = { body: syntheticPncpPage(400, 4, 0, 0), contentType: JSON_TYPE };
    stubFetch(routes);
    const client = await connectClient();
    const seen: string[] = [];
    let args: Record<string, unknown> = { from: PNCP_FROM, to: PNCP_TO, limit, page: 1, skip: 0 };
    for (let guard = 0; guard < 100; guard++) {
      const data = dataOf(await client.callTool({ name: "procurement_search", arguments: args }));
      seen.push(...data.items.map((i) => i.pncp_id));
      if (data.next_page === null) break;
      args = { ...args, page: data.next_page, skip: data.next_skip };
    }
    expect(seen).toHaveLength(41);
    expect(new Set(seen).size).toBe(41);
  });

  it("source down -> {error: source_unavailable}", async () => {
    for (const route of [{ error: true }, { status: 500 }, { body: "<html>manutenção</html>" }, { body: '{"x":1}' }] as Route[]) {
      stubFetch({ [`GET ${pncpUrl()}`]: route });
      const res = await search();
      expect(res.structuredContent).toBeUndefined();
      expect(errorOf(res)).toEqual({ error: "source_unavailable" });
    }
  });

  it("an over-long date range is refused before any request", async () => {
    const calls = stubFetch({});
    const res = await search({ from: "2025-01-01", to: "2026-11-18" });
    expect(errorOf(res)).toMatchObject({ error: "invalid_date_range" });
    expect(calls).toHaveLength(0);
  });
});
