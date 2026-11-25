import { mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { MASK } from "../src/mask.js";
import {
  buildCatalog,
  CATALOG_FILE,
  CATALOG_MAX_BYTES,
  CITY_SERVICES_MAX_AGE_DAYS,
  cityServicesSearchOutput,
  cityServicesSearchResult,
  cityServicesStaleNote,
  safeOnlineUrl,
} from "../src/tools/cityServicesSearch.js";
import { connectClient, errorOf, stubFetch } from "./helpers.js";

// Invented services in the real file shape; no real catalog text.
const FIXTURE_DIR = new URL("./fixtures/carta_servicos_synthetic/", import.meta.url).pathname;
const RAW = JSON.parse(readFileSync(join(FIXTURE_DIR, CATALOG_FILE), "utf8")) as {
  captured: string;
  count: number;
  items: { cat: string; title: string; what: string; url: string; online: string | null }[];
};
const CATALOG = buildCatalog(RAW);
const NOW = new Date("2026-11-20T12:00:00Z");
type Args = Parameters<typeof cityServicesSearchResult>[1];
const search = (args: Partial<Args>) => cityServicesSearchResult(CATALOG, { limit: 10, offset: 0, ...args }, NOW);
const byId = (id: number) => CATALOG.services.find((s) => s.id === id)!;

let tmp: string;
beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-carta-")));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

async function call(args: Record<string, unknown>, dir: string = FIXTURE_DIR) {
  vi.stubEnv(DATA_DIR_ENV, dir);
  const client = await connectClient();
  return client.callTool({ name: "city_services_search", arguments: args });
}

describe("catalog file", () => {
  it("builds ids from the official URL, categories with counts, and the capture date", () => {
    expect(CATALOG.services.map((s) => s.id)).toEqual([9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008]);
    expect(CATALOG.categories).toEqual([
      { name: "Imóvel e Construção", count: 3 },
      { name: "Saúde", count: 3 },
      { name: "Serviços Funerários", count: 2 },
    ]);
    expect(CATALOG.checkedAt).toBe("2026-11-19");
    expect(CATALOG.capturedText).toBe("2026-11-19/20");
  });

  it.each([
    ["not an object", 42],
    ["missing items", { captured: "2026-11-19", count: 0 }],
    ["count mismatch", { ...RAW, count: RAW.count + 1 }],
    ["no date in captured", { ...RAW, captured: "last week" }],
    ["impossible date", { ...RAW, captured: "2026-13-45" }],
    ["rolled-over date", { ...RAW, captured: "2026-02-30" }],
    ["official URL on another host", { ...RAW, items: [{ ...RAW.items[0]!, url: "https://example.com/x/1" }], count: 1 }],
    ["blank title", { ...RAW, items: [{ ...RAW.items[0]!, title: "  " }], count: 1 }],
    ["online not a string", { ...RAW, items: [{ ...RAW.items[0]!, online: 5 }], count: 1 }],
    ["duplicate id", { ...RAW, items: [RAW.items[0]!, { ...RAW.items[0]!, title: "Outro" }], count: 2 }],
  ])("refuses %s", (_name, json) => {
    expect(() => buildCatalog(json)).toThrow();
  });
});

describe("privacy guards", () => {
  it("drops obituary-system links (http, https, any case) and keeps the entry and official_url", () => {
    for (const id of [9006, 9007]) {
      expect(byId(id).online_url).toBeNull();
      expect(byId(id).official_url).toMatch(new RegExp(`/${id}$`));
    }
    for (const s of CATALOG.services) expect((s.online_url ?? "").toLowerCase()).not.toContain("obituarios.");
  });

  it("drops non-http(s) and credential-bearing links", () => {
    expect(byId(9005).online_url).toBeNull(); // javascript:
    expect(byId(9003).online_url).toBeNull(); // user:password@
    expect(byId(9004).online_url).toBe("http://exemplo-sintetico.curitiba.pr.gov.br/segunda-via");
    expect(safeOnlineUrl("http://obituarios.curitiba.pr.gov.br./x")).toBeNull();
    expect(safeOnlineUrl("https://www.obituarios.curitiba.pr.gov.br/")).toBeNull();
    expect(safeOnlineUrl("https://user@exemplo.invalid/")).toBeNull();
    expect(safeOnlineUrl("not a url")).toBeNull();
    expect(safeOnlineUrl(null)).toBeNull();
  });

  it("masks an e-mail in a summary and cannot be searched by the masked text", () => {
    expect(byId(9003).summary).toContain(MASK);
    expect(byId(9003).summary).not.toContain("teste.sintetico");
    expect(search({ query: "sintetico@exemplo" }).data.total).toBe(0);
  });

  it("returns every other summary exactly as in the file (dashes and spacing kept)", () => {
    for (const x of RAW.items) {
      const id = Number(x.url.split("/").pop());
      if (id !== 9003) expect(byId(id).summary).toBe(x.what);
    }
    expect(byId(9004).summary).toContain("– com travessão");
  });
});

describe("search", () => {
  it("with no filter returns all services and the categories", () => {
    const r = search({});
    expect(r.data.total).toBe(8);
    expect(r.data.categories).toHaveLength(3);
    expect(r.checked_at).toBe("2026-11-19");
    expect(r.license_note).toContain("Prefeitura Municipal de Curitiba — Carta de Serviços");
    expect(r.license_note).toContain("2026-11-19/20");
    expect(r.license_note).not.toContain("synthetic"); // free text of `captured` is never echoed
    expect(() => cityServicesSearchOutput.parse(r)).not.toThrow();
  });

  it("ignores accents and case: 'ficticia' and 'VACINACAO' match 'fictícia' and 'Vacinação'", () => {
    expect(search({ query: "ficticia" }).data.items.map((i) => i.id)).toEqual([9005, 9002, 9001]);
    expect(search({ query: "VACINACAO" }).data.items.map((i) => i.id)).toEqual([9001]);
    expect(search({ query: "vacinação" }).data.total).toBe(1);
  });

  it("splits on punctuation, requires every word and puts title matches first", () => {
    expect(search({ query: "segunda-via" }).data.items.map((i) => i.id)).toEqual([9004, 9007]);
    expect(search({ query: "segunda via documento" }).data.items.map((i) => i.id)).toEqual([9004, 9007]);
    // Neither title has every word: plain title order.
    expect(search({ query: "segunda via inventado" }).data.items.map((i) => i.id)).toEqual([9007, 9004]);
  });

  it("does not search the site's 'O que é?' label", () => {
    expect(search({ query: "que" }).data.total).toBe(0);
  });

  it("finds a service with an empty summary by title", () => {
    expect(byId(9005).summary).toBe("");
    expect(search({ query: "alvara" }).data.items.map((i) => i.id)).toEqual([9005]);
  });

  it("returns an empty result for a word that is not in the catalog", () => {
    expect(search({ query: "xyzzyplugh" }).data).toMatchObject({ total: 0, items: [], next_offset: null });
  });

  it("filters by category and online_only, without the categories list", () => {
    const cat = search({ category: "Saúde" });
    expect(cat.data.items.map((i) => i.id).sort()).toEqual([9001, 9002, 9003]);
    expect(cat.data.categories).toBeUndefined();
    const online = search({ online_only: true });
    expect(online.data.items.map((i) => i.id).sort()).toEqual([9001, 9004, 9008]);
  });

  it("pages with offset and next_offset without repeats; past the end is empty", () => {
    const seen: number[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const r = search({ limit: 3, offset });
      expect(() => cityServicesSearchOutput.parse(r)).not.toThrow();
      seen.push(...r.data.items.map((i) => i.id));
      offset = r.data.next_offset;
    }
    expect(seen.sort()).toEqual(CATALOG.services.map((s) => s.id));
    expect(search({ offset: 100 }).data).toMatchObject({ total: 8, items: [], next_offset: null });
  });

  it("warns after 180 days from the file's capture date, in Curitiba time", () => {
    const day = (n: number) => new Date(Date.parse("2026-11-19T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
    expect(cityServicesStaleNote(day(CITY_SERVICES_MAX_AGE_DAYS), "2026-11-19")).toBe("");
    expect(cityServicesStaleNote(day(CITY_SERVICES_MAX_AGE_DAYS + 1), "2026-11-19")).toContain("181 days ago");
    const at = (iso: string) => cityServicesSearchResult(CATALOG, { limit: 1, offset: 0 }, new Date(iso)).note;
    expect(at(`${day(CITY_SERVICES_MAX_AGE_DAYS + 1)}T02:59:00Z`)).not.toContain("days ago");
    expect(at(`${day(CITY_SERVICES_MAX_AGE_DAYS + 1)}T03:00:00Z`)).toContain("181 days ago");
  });
});

describe("city_services_search over MCP", () => {
  it("reads the file from CURITIBAI_DATA_DIR with no network call", async () => {
    const calls = stubFetch({});
    const res = await call({ query: "ficticia", limit: 1 });
    expect(res.isError).toBeFalsy();
    const parsed = cityServicesSearchOutput.parse(res.structuredContent);
    expect(parsed.data).toMatchObject({ total: 3, next_offset: 1 });
    expect(calls).toHaveLength(0);
  });

  it("data_not_available when CURITIBAI_DATA_DIR is not set or the file is missing", async () => {
    expect(errorOf(await call({}, ""))).toMatchObject({ error: "data_not_available" });
    expect(errorOf(await call({}, join(tmp, "nope")))).toMatchObject({ error: "data_not_available" });
    expect(errorOf(await call({}, tmp))).toMatchObject({ error: "data_not_available" });
  });

  it("invalid_data when the file is not JSON, not UTF-8, has the wrong shape or is too large", async () => {
    const file = join(tmp, CATALOG_FILE);
    writeFileSync(file, "{not json");
    expect(errorOf(await call({}, tmp))).toMatchObject({ error: "invalid_data" });
    writeFileSync(file, JSON.stringify({ ...RAW, count: 99 }));
    expect(errorOf(await call({}, tmp))).toMatchObject({ error: "invalid_data" });
    writeFileSync(file, Buffer.from([0xff, 0xfe, 0x7b, 0x7d]));
    expect(errorOf(await call({}, tmp))).toMatchObject({ error: "invalid_data" });
    writeFileSync(file, " ".repeat(CATALOG_MAX_BYTES + 1));
    expect(errorOf(await call({}, tmp))).toMatchObject({ error: "invalid_data" });
  });

  it("accepts a catalog of exactly 4 MiB and rejects 4 MiB + 1 byte", async () => {
    expect(CATALOG_MAX_BYTES).toBe(4194304);
    const json = JSON.stringify(RAW);
    const file = join(tmp, CATALOG_FILE);
    const padded = (size: number) => json + " ".repeat(size - Buffer.byteLength(json));
    writeFileSync(file, padded(4194304));
    const atLimit = await call({}, tmp);
    expect(errorOf(atLimit)).toBeUndefined();
    expect(atLimit.isError).toBeFalsy();
    writeFileSync(file, padded(4194304 + 1));
    expect(errorOf(await call({}, tmp))).toMatchObject({
      error: "invalid_data",
      message: "carta-servicos.json is larger than 4 MB.",
    });
  });

  it("file_not_allowed when the file is a symlink to outside the folder", async () => {
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-out-")));
    try {
      writeFileSync(join(outside, CATALOG_FILE), JSON.stringify(RAW));
      symlinkSync(join(outside, CATALOG_FILE), join(tmp, CATALOG_FILE));
      expect(errorOf(await call({}, tmp))).toMatchObject({ error: "file_not_allowed" });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("a bad category is invalid_argument listing the file's categories, without echoing the input", async () => {
    const err = errorOf(await call({ category: "Saude<script>" })) as { error: string; message: string };
    expect(err.error).toBe("invalid_argument");
    for (const c of CATALOG.categories) expect(err.message).toContain(c.name);
    expect(err.message).not.toContain("<script>");
  });

  it("a query with no letter or digit is invalid_argument", async () => {
    expect(errorOf(await call({ query: "-- ??" }))).toMatchObject({ error: "invalid_argument" });
  });

  it.each([{ limit: 0 }, { limit: 21 }, { offset: -1 }, { offset: 10_001 }, { query: "a" }, { query: "x".repeat(101) }])(
    "rejects out-of-range input %o",
    async (args) => {
      const res = await call(args);
      expect(res.isError).toBe(true);
      expect(res.structuredContent).toBeUndefined();
    },
  );
});
