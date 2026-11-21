import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAllowedUrl } from "../src/http.js";
import { SOURCE_REFUSED_MESSAGE } from "../src/tools/common.js";
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
  "12345678900",
  "98765432101",
  "FORNECEDORA PESSOA FICTICIA",
  // people named in objects of direct awards
  "FULANO FICTICIO PRIMEIRO",
  "CICLANA FICTICIA SEGUNDA",
  "DOCENTE FICTICIA TERCEIRA",
  "EPSILON FICTICIO",
  // CPF, CNPJ, e-mail and phone inside a competitive object
  "123.456.789-00",
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

/** True when an 11-digit string passes the CPF check-digit rule (computed here, independent of src/). */
function validCpf(digits: string): boolean {
  const d = [...digits].map(Number);
  const check = (n: number) => ((d.slice(0, n).reduce((t, x, i) => t + x * (n + 1 - i), 0) * 10) % 11) % 10;
  return check(9) === d[9] && check(10) === d[10];
}

/** Every file under test/ (sources and fixtures), as [path relative to the repo, text]. */
function testFiles(dir = "test"): [string, string][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e): [string, string][] => {
    const p = `${dir}/${e.name}`;
    return e.isDirectory() ? testFiles(p) : [[p, readFileSync(p, "utf8")]];
  });
}

/**
 * The one valid-check-digit CPF allowed in the tests: the textbook example 123.456.789-09, only in the files that
 * deliberately check that a valid-looking CPF is masked (PNCP objects, event fields). Everywhere else, and in every
 * fixture, CPF-shaped values must have an invalid check digit, so no real person's number can be planted.
 */
const ALLOWED_VALID_CPF = "12345678909";
const MASKING_TESTS = new Set(["test/pncp.test.ts", "test/fetchEvents.test.ts"]);

describe("CPF-shaped values in tests and fixtures", () => {
  it("rule check: 123.456.789-09 is a valid CPF, 123.456.789-00 is not", () => {
    expect(validCpf("12345678909")).toBe(true);
    expect(validCpf("12345678900")).toBe(false);
  });

  it("the PNCP fixture still plants CPF-shaped values (so the scan below checks something)", () => {
    const text = fixture("pncp_contratacoes_synthetic.json");
    expect([...text.matchAll(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g)].length).toBeGreaterThanOrEqual(3);
  });

  it("have an invalid check digit, except 123.456.789-09 in the masking tests", () => {
    const found: string[] = [];
    for (const [path, text] of testFiles()) {
      for (const m of text.matchAll(/(?<!\d)(\d{3})[. ]?(\d{3})[. ]?(\d{3})[- ]?(\d{2})(?!\d)/g)) {
        const digits = m.slice(1).join("");
        if (/^(\d)\1{10}$/.test(digits) || !validCpf(digits)) continue; // repeated digits are invalid CPFs by rule
        if (digits === ALLOWED_VALID_CPF && MASKING_TESTS.has(path)) continue;
        found.push(`${path}: ${m[0]}`);
      }
    }
    expect(found).toEqual([]);
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
  it("gates exactly 8, 9, 12, 14 and unknown codes", () => {
    expect([...OBJECT_WITHHELD_MODALITIES].sort((a, b) => a - b)).toEqual([8, 9, 12, 14]);
    for (const c of [8, 9, 12, 14, 0, 21, 99, null]) expect(objectReturnable(c)).toBe(false);
    for (const c of [1, 2, 3, 4, 5, 6, 7, 10, 11, 13, 15, 16, 17, 18, 19, 20]) expect(objectReturnable(c)).toBe(true);
  });

  it("withholds the object of a credenciamento (modality 12), which can name an accredited person", () => {
    const raw = JSON.parse(syntheticPncpPage(1, 1, 0, 0)) as { data: Record<string, unknown>[] };
    raw.data[0]!.modalidadeId = 12;
    raw.data[0]!.objetoCompra = "Credenciamento de FULANA FICTICIA CREDENCIADA para consultas";
    const item = parseContratacoes(JSON.stringify(raw)).items[0]!;
    expect(item).toMatchObject({ modality_code: 12, modality: "Credenciamento", object: null, object_withheld: "may_name_a_person" });
    expect(JSON.stringify(item)).not.toContain("FULANA");
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

  it("stays fast on a 100k-character object (bounded e-mail parts and raw cap)", () => {
    const inputs = [
      "a".repeat(100_000),
      "a.".repeat(50_000),
      `${"a".repeat(99_990)}@`,
      "1.".repeat(50_000),
      `1${"_".repeat(100_000)}x`,
      `1${" _".repeat(50_000)}x`,
      `${"a@b.".repeat(25_000)}`,
      "41 ".repeat(34_000),
      "1 ".repeat(50_000),
      "041 99999888 ".repeat(8_000),
      "2025 2026 ".repeat(10_000),
      "Tel.: 2025-2026 ".repeat(8_000),
      "tel. ".repeat(25_000),
      "Telef. 2025-2026 ".repeat(8_000),
      "contatos ".repeat(12_000),
    ];
    for (const s of inputs) {
      const t0 = performance.now();
      const out = maskObject(s);
      expect(performance.now() - t0).toBeLessThan(1000); // linear: a few ms; the quadratic regex took seconds
      expect(out.truncated).toBe(true);
    }
  });

  it("never shows an identifier split by the raw cut", () => {
    for (const id of ["123.456.789-09", "123 456 789 09", "maria @ exemplo.com", "fulana.ficticia@example.invalid", "41 999998888", "+55 41 33334444"]) {
      for (let inside = 1; inside < id.length; inside++) {
        // collapsed text: prefix + " " + id, with the 2,000-character cut landing `inside` characters into the id
        // long e-mails shrink to [masked], so the masked text is short and the cut region would be visible
        const unit = `${"a".repeat(60)}@${"d".repeat(34)}.com `; // 100 characters, masked whole
        const len = 2000 - inside - 1;
        const prefix = unit.repeat(Math.floor(len / 100)) + "b".repeat(len % 100);
        const out = maskObject(`${prefix} ${id}`);
        expect({ id, inside, leak: /\d{3}|maria|fulana/.test(out.text) }).toEqual({ id, inside, leak: false });
      }
    }
  });

  it("whitespace padding does not count against the raw cap", () => {
    expect(maskObject(`${" ".repeat(5000)}objeto real`)).toEqual({ text: "objeto real", truncated: false });
  });

  it("never cuts a mask token or a surrogate pair when truncating", () => {
    const masked = maskObject(`${"a".repeat(295)} 123.456.789-09 fim`);
    expect(masked.truncated).toBe(true);
    expect(masked.text).toBe(`${"a".repeat(295)}…`);
    const emoji = maskObject(`${"b".repeat(299)}😀😀`);
    expect(emoji.text).toBe(`${"b".repeat(299)}😀…`);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(emoji.text)).toBe(false); // no lone high surrogate
  });

  it.each([
    ["control number of another CNPJ", { numeroControlePNCP: "11111111000191-1-000001/2026" }],
    ["year 0", { anoCompra: 0 }],
    ["year 123456789", { anoCompra: 123456789 }],
  ])("drops a listed body's record with %s", (_label, patch) => {
    const raw = JSON.parse(fixture("pncp_contratacoes_synthetic.json")) as { data: Record<string, unknown>[] };
    Object.assign(raw.data[0]!, patch);
    const page = parseContratacoes(JSON.stringify(raw));
    expect(page.items.some((i) => i.link.includes("/76417005000186/"))).toBe(false);
    expect(page.discarded).toBe(2);
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
    ["contato (41) 999998888", `contato ${MASK}`],
    ["contato (41)33330000.", `contato ${MASK}.`],
    ["CPF 123 456 789 09", `CPF ${MASK}`],
    ["CPF 123.456.789\u201309", `CPF ${MASK}`],
    ["CPF 123.456.789\u201109", `CPF ${MASK}`],
    ["CPF 123.456.789\u221209", `CPF ${MASK}`],
    ["CPF 123. 456. 789-09", `CPF ${MASK}`],
    ["CPF 123.456.789 - 09", `CPF ${MASK}`],
    ["CPF 123 456 789 - 09", `CPF ${MASK}`],
    ["CPF 123.4\u200B56.789-09", `CPF ${MASK}`],
    ["CPF 123.456\u2060.789\uFEFF-09", `CPF ${MASK}`],
    ["CPF 123_456_789_09", `CPF ${MASK}`],
    ["CNPJ 12.345.678/0001\u201395", `CNPJ ${MASK}`],
    ["fone 41 - 3333 - 4444", `fone ${MASK}`],
    ["mail maria @ exemplo.com fim", `mail ${MASK} fim`],
    ["exercício 2025/2026", "exercício 2025/2026"],
    ["CPF 123.456.789\u00AD09", `CPF ${MASK}`],
    ["CPF 123.456.789\uFF0D09", `CPF ${MASK}`],
    ["CPF 123.456.789\uFE6309", `CPF ${MASK}`],
    ["CPF 123.456\u2062.789\u2063-09", `CPF ${MASK}`],
    ["CPF 123__456__789__09", `CPF ${MASK}`],
    ["CPF 123 _ 456 _ 789 _ 09", `CPF ${MASK}`],
    ["CPF 123 . 456 . 789 - 09", `CPF ${MASK}`],
    ["valor unitário @ 10.50 reais", "valor unitário @ 10.50 reais"],
    ["contato maria@exemplo.com2", `contato ${MASK}2`],
    ["contato maria@exemplo.com_2", `contato ${MASK}_2`],
    ["conforme item [A] e [B", "conforme item [A] e [B"],
    ["CNPJ 12 345 678 0001 95", `CNPJ ${MASK}`],
    ["Pregão 116/2026, R$ 1.234.567,89, Lei 14.133", "Pregão 116/2026, R$ 1.234.567,89, Lei 14.133"],
    ["  espaços   colapsados  ", "espaços colapsados"],
    ["tel 41 999998888", `tel ${MASK}`],
    ["tel +55 41 999998888", `tel ${MASK}`],
    ["+55 41 999998888", MASK],
    ["tel 55 41 999998888 fim", `tel ${MASK} fim`],
    ["tel 41 33334444", `tel ${MASK}`],
    ["tel 041 33334444.", `tel ${MASK}.`],
    ["tel 041 999998888, ramal 2", `tel ${MASK}, ramal 2`],
    ["vigência 2025 - 2026", `vigência ${MASK}`],
    ["vigência 2026\u20132027", `vigência ${MASK}`],
    ["ano 2025 2026", `ano ${MASK}`],
    ["exercícios 1999-2000 e 2025.2026", `exercícios ${MASK} e ${MASK}`],
    ["exercício 2025/2026", "exercício 2025/2026"],
    ["fone 2025-3333", `fone ${MASK}`],
    ["fone 3333 2026", `fone ${MASK}`],
    ["fone 41 2025-2026", `fone ${MASK}`],
    ["fone (41) 2025-2026", `fone ${MASK}`],
    ["fone 041 2025-2026", `fone ${MASK}`],
    ["fone (041) 2025-2026", `fone ${MASK}`],
    ["fone +55 041 2025-2026", `fone ${MASK}`],
    ["fone (041)3333-4444", `fone ${MASK}`],
    ["nº 123 12345678", "nº 123 12345678"],
    ["fone +55 2025 2026", `fone ${MASK}`],
    ["datas 2025 2026 3333", `datas ${MASK} 3333`],
    ["tel 41 - 33334444", `tel ${MASK}`],
    ["lote 12 1234567 itens", "lote 12 1234567 itens"],
    ["item 3 12345678", "item 3 12345678"],
    ["Lei 8666 de 1993, item 12345678", "Lei 8666 de 1993, item 12345678"],
    ["tel 2025 - 2026", `tel ${MASK}`],
    ["Fone: 2025-2026", `Fone: ${MASK}`],
    ["TELEFONE 2025.2026", `TELEFONE ${MASK}`],
    ["celular:2025 2026", `celular:${MASK}`],
    ["contato 2025-2026", `contato ${MASK}`],
    ["WhatsApp : 2025-2026", `WhatsApp : ${MASK}`],
    ["contrato 2025 - 2026", `contrato ${MASK}`],
    ["hotel 2025 - 2026", `hotel ${MASK}`],
    ["Pimentel 2025-2026", `Pimentel ${MASK}`],
    ["telefones 2025-2026", `telefones ${MASK}`],
    ["Tel. 2025-2026", `Tel. ${MASK}`],
    ["Cel: 2025-2026", `Cel: ${MASK}`],
    ["Fax 2025-2026", `Fax ${MASK}`],
    ["ramal 2025-2026", `ramal ${MASK}`],
    ["Tel.: 2025-2026", `Tel.: ${MASK}`],
    ["whats 2025 2026", `whats ${MASK}`],
    ["ZAP 2025-2026", `ZAP ${MASK}`],
    ["hotel 2025-2026", `hotel ${MASK}`],
    ["exercício 2025 - 2026", `exercício ${MASK}`],
    ["parcel 2025-2026", `parcel ${MASK}`],
    ["telas 2025-2026", `telas ${MASK}`],
    ["Telef. 2025-2026", `Telef. ${MASK}`],
    ["tels 2025-2026", `tels ${MASK}`],
    ["contatos 2025-2026", `contatos ${MASK}`],
    ["Excel 2025-2026", `Excel ${MASK}`],
    ["Marcel 2025-2026", `Marcel ${MASK}`],
    ["hotels 2025-2026", `hotels ${MASK}`],
    ["telefonia 2025-2026", `telefonia ${MASK}`],
    ["vigência 2025 - 2026, tel 3333-4444", `vigência ${MASK}, tel ${MASK}`],
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

  it("retries once after a connection reset", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input: string | URL) => {
      urls.push(String(input));
      if (urls.length === 1) throw new TypeError("fetch failed");
      return new Response(fixture("pncp_contratacoes_synthetic.json"), { status: 200 });
    }) as typeof fetch;
    const res = await search();
    expect(res.isError).toBeFalsy();
    expect(urls).toEqual([pncpUrl(), pncpUrl()]);
  });

  it("does not retry after a timeout", async () => {
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as typeof fetch;
    const res = await search();
    expect(errorOf(res)).toEqual({ error: "source_unavailable" });
    expect(n).toBe(1);
  });

  it("HTTP 429 without a short Retry-After is rate_limited, with no retry", async () => {
    const cases: [Record<string, string>, string][] = [
      [{}, "about 1 minute"],
      [{ "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" }, "about 1 minute"],
      [{ "retry-after": "30" }, "30 s"],
      [{ "retry-after": "3600" }, "about 60 minutes"],
      [{ "retry-after": "999999" }, "at least 1 hour"],
    ];
    for (const [headers, wait] of cases) {
      const calls = stubFetch({ [`GET ${pncpUrl()}`]: { status: 429, headers } });
      const res = await search();
      expect(errorOf(res)).toEqual({
        error: "rate_limited",
        message: `The source is limiting requests; wait ${wait} before trying again.`,
      });
      expect(calls).toHaveLength(1);
    }
  });

  it("HTTP 429 with Retry-After of at most 5 s is retried once", async () => {
    let n = 0;
    globalThis.fetch = (async () =>
      n++ === 0
        ? new Response("", { status: 429, headers: { "retry-after": "0" } })
        : new Response(fixture("pncp_contratacoes_synthetic.json"), { status: 200 })) as typeof fetch;
    const res = await search();
    expect(res.isError).toBeFalsy();
    expect(n).toBe(2);
  });

  it("HTTP 429 with a CAPTCHA page is not retried, even with a short Retry-After", async () => {
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      return new Response("<html><script src=\"https://hcaptcha.com/1/api.js\"></script></html>", {
        status: 429,
        headers: { "retry-after": "0", "content-type": "text/html" },
      });
    }) as typeof fetch;
    const res = await search();
    expect(res.isError).toBe(true);
    expect(errorOf(res)).toEqual({ error: "source_unavailable", message: SOURCE_REFUSED_MESSAGE });
    expect(n).toBe(1);
  });

  it("a final refusal (403) on a later page returns the partial with next_page null and does not ask again", async () => {
    const calls = stubFetch({
      [`GET ${pncpUrl(1)}`]: { body: syntheticPncpPage(1, 3, 4), contentType: JSON_TYPE },
      [`GET ${pncpUrl(2)}`]: { status: 403, body: "Forbidden" },
    });
    const data = dataOf(await search({ limit: 20 }));
    expect(data).toMatchObject({ partial: true, next_page: null, next_skip: 0 });
    expect(data.items).toHaveLength(3);
    expect(data.note).toMatch(/^The source refused page 2 \(HTTP 403\); it is not asked again\./);
    expect(data.note).not.toContain("continue with next_page");
    expect(calls).toHaveLength(2);
  });

  it("a 429 on a later page keeps what was found as partial", async () => {
    stubFetch({
      [`GET ${pncpUrl(1)}`]: { body: syntheticPncpPage(1, 3, 4), contentType: JSON_TYPE },
      [`GET ${pncpUrl(2)}`]: { status: 429, headers: { "retry-after": "60" } },
    });
    const data = dataOf(await search({ limit: 20 }));
    expect(data).toMatchObject({ partial: true, next_page: 2 });
    expect(data.note).toMatch(/^The source is limiting requests; wait 60 s before trying again\./);
  });

  it("says the time budget was reached when a 429 retry wait made the first page slow", async () => {
    const real = Date.now;
    let t = 1_000_000;
    let n = 0;
    globalThis.Date.now = () => t;
    globalThis.fetch = (async () => {
      if (n++ === 0) {
        t += 16_000; // the 429 and its retry wait take 16 s
        return new Response("", { status: 429, headers: { "retry-after": "0" } });
      }
      return new Response(syntheticPncpPage(1, 1, 3), { status: 200 });
    }) as typeof fetch;
    try {
      const data = dataOf(await search({ limit: 20 }));
      expect(n).toBe(2);
      expect(data).toMatchObject({ partial: true, next_page: 2, scanned_pages: { from: 1, to: 1 } });
      expect(data.note).toMatch(/^Stopped after 1 upstream page\(s\) \(the 15 s time budget was reached\); continue with next_page\./);
    } finally {
      globalThis.Date.now = real;
    }
  });

  it("does not blame the time budget when the page cap stopped the scan", async () => {
    const real = Date.now;
    let t = 1_000_000;
    globalThis.Date.now = () => t;
    globalThis.fetch = (async (input: string | URL) => {
      t += 10_000; // two normal 10 s pages: over the budget, but the cap is the reason
      const page = Number(new URL(String(input)).searchParams.get("pagina"));
      return new Response(syntheticPncpPage(page * 10, 1, 3), { status: 200 });
    }) as typeof fetch;
    try {
      const data = dataOf(await search({ limit: 20 }));
      expect(data).toMatchObject({ partial: true, next_page: 3, scanned_pages: { from: 1, to: 2 } });
      expect(data.note).toMatch(/^Stopped after 2 upstream page\(s\); continue with next_page\./);
    } finally {
      globalThis.Date.now = real;
    }
  });

  it("skips the second page when the first was slow", async () => {
    const real = Date.now;
    let t = 1_000_000;
    globalThis.Date.now = () => t;
    globalThis.fetch = (async () => {
      t += 16_000; // the first page takes 16 s
      return new Response(syntheticPncpPage(1, 1, 3), { status: 200 });
    }) as typeof fetch;
    try {
      const data = dataOf(await search({ limit: 20 }));
      expect(data).toMatchObject({ partial: true, next_page: 2, scanned_pages: { from: 1, to: 1 } });
    } finally {
      globalThis.Date.now = real;
    }
  });

  it("does not count a resumed page's discards twice", async () => {
    const page = JSON.parse(syntheticPncpPage(1, 14, 0)) as { data: Record<string, unknown>[] };
    for (const r of page.data.slice(12, 14)) r.anoCompra = null; // 2 malformed records of a listed body
    stubFetch({ [`GET ${pncpUrl()}`]: { body: JSON.stringify(page), contentType: JSON_TYPE } });
    const first = dataOf(await search({ limit: 5 }));
    expect(first).toMatchObject({ next_page: 1, next_skip: 5, discarded: 2 });
    const second = dataOf(await search({ limit: 5, skip: 5 }));
    expect(second).toMatchObject({ next_page: 1, next_skip: 10, discarded: 0 });
    const third = dataOf(await search({ limit: 5, skip: 10 }));
    expect(third).toMatchObject({ next_page: null, discarded: 0 });
    expect(third.items).toHaveLength(2);
  });

  it("collapses repeated spaces in the query", async () => {
    stubFetch(pncpRoutes());
    expect(dataOf(await search({ query: "medicamentos   ficticios" })).items.map((i) => i.modality_code)).toEqual([6]);
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
