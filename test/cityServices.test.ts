import { describe, expect, it } from "vitest";
import { CATEGORIES, ROWS } from "../src/sources/cityServicesData.js";
import { MASK } from "../src/sources/pncp.js";
import {
  CITY_SERVICES_CHECKED_AT,
  CITY_SERVICES_MAX_AGE_DAYS,
  cityServicesSearchOutput,
  cityServicesSearchResult,
  cityServicesStaleNote,
  guardedSummary,
  OBITUARY_HOST,
  safeOnlineUrl,
  SERVICES,
} from "../src/tools/cityServicesSearch.js";
import { connectClient, errorOf, stubFetch } from "./helpers.js";

const NOW = new Date("2026-11-20T12:00:00Z");
type Result = ReturnType<typeof cityServicesSearchResult>;
const search = (args: Partial<Parameters<typeof cityServicesSearchResult>[0]>): Result =>
  cityServicesSearchResult({ limit: 10, offset: 0, ...args }, NOW);

describe("bundled Carta de Serviços snapshot", () => {
  it("has 756 services in 18 categories, unique ids and official URLs on servicos.curitiba.pr.gov.br", () => {
    expect(ROWS).toHaveLength(756);
    expect(CATEGORIES).toHaveLength(18);
    for (const [, , , url] of ROWS) expect(url).toMatch(/^https:\/\/servicos\.curitiba\.pr\.gov\.br\/[a-z0-9-]+\/\d+$/);
    expect(new Set(SERVICES.map((s) => s.id)).size).toBe(756);
    for (const [cat] of ROWS) expect(CATEGORIES[cat]).toBeDefined();
  });

  it("the PII guard changes only two teasers, both public institutional text (pinned)", () => {
    const changed = ROWS.flatMap(([, , what, url]) => (guardedSummary(what) === what ? [] : [Number(url.split("/").pop())]));
    // 285: the ISS office's institutional e-mail; 2518: a tourism social-media handle read as an e-mail.
    expect(changed).toEqual([285, 2518]);
    for (const id of changed) expect(SERVICES.find((s) => s.id === id)!.summary).toContain(MASK);
  });

  it("every other summary is the teaser exactly as published (no dash or whitespace rewrite)", () => {
    const byId = new Map(ROWS.map((r) => [Number(r[3].split("/").pop()), r[2]]));
    const same = SERVICES.filter((s) => s.summary === byId.get(s.id));
    expect(same).toHaveLength(754);
    expect(SERVICES.find((s) => s.id === 56)!.summary).toContain("Juventude –...");
  });
});

describe("obituary links", () => {
  it("never returns a link to the obituary system, keeping the catalog entry", () => {
    for (const id of [537, 1517]) {
      const s = SERVICES.find((x) => x.id === id)!;
      expect(s.online_url).toBeNull();
      expect(s.official_url).toMatch(new RegExp(`/${id}$`));
    }
    const all = search({ limit: 20, offset: 0, category: "Serviços Funerários" });
    expect(all.data.items.map((i) => i.id)).toEqual(expect.arrayContaining([537, 1517]));
    for (const s of SERVICES) expect(s.online_url ?? "").not.toContain(OBITUARY_HOST);
  });

  it("matches the host by parsed URL, any scheme or case", () => {
    expect(safeOnlineUrl("http://obituarios.curitiba.pr.gov.br/publico/x.aspx")).toBeNull();
    expect(safeOnlineUrl("https://OBITUARIOS.curitiba.pr.gov.br/")).toBeNull();
    expect(safeOnlineUrl("not a url")).toBeNull();
    expect(safeOnlineUrl("https://www.curitiba.pr.gov.br/x")).toBe("https://www.curitiba.pr.gov.br/x");
    expect(safeOnlineUrl(null)).toBeNull();
  });
});

describe("city_services_search", () => {
  it("with no arguments lists the 18 categories with counts summing to 756", () => {
    const r = search({});
    expect(r.data.total).toBe(756);
    expect(r.data.items).toHaveLength(10);
    expect(r.data.next_offset).toBe(10);
    expect(r.data.categories).toHaveLength(18);
    expect(r.data.categories!.reduce((n, c) => n + c.count, 0)).toBe(756);
    expect(() => cityServicesSearchOutput.parse(r)).not.toThrow();
  });

  it("filters do not return the categories list", () => {
    expect(search({ query: "iptu" }).data.categories).toBeUndefined();
    expect(search({ online_only: false }).data.categories).toBeUndefined();
  });

  it("ignores accents and case: 'saude' finds 'Saúde'", () => {
    const r = search({ query: "SAUDE", limit: 20 });
    expect(r.data.total).toBeGreaterThan(0);
    expect(r.data.items.some((i) => i.title.includes("Saúde"))).toBe(true);
    expect(search({ query: "saúde" }).data.total).toBe(r.data.total);
  });

  it("requires every word and puts title matches first", () => {
    const r = search({ query: "segunda via", limit: 20 });
    expect(r.data.total).toBeGreaterThan(0);
    const t = r.data.items[0]!.title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    expect(t).toContain("segunda");
    expect(t).toContain("via");
  });

  it("returns an empty result for a word that is not in the catalog", () => {
    const r = search({ query: "xyzzyplugh" });
    expect(r.data).toMatchObject({ total: 0, items: [], next_offset: null });
  });

  it("filters by category and online_only", () => {
    const cat = search({ category: "Cohab", limit: 20 });
    expect(cat.data.total).toBe(36);
    expect(cat.data.items.every((i) => i.category === "Cohab")).toBe(true);
    const online = search({ online_only: true, limit: 20, offset: 0 });
    expect(online.data.total).toBe(SERVICES.filter((s) => s.online_url !== null).length);
    expect(online.data.items.every((i) => i.online_url !== null)).toBe(true);
  });

  it("pages with offset without repeats, and an offset past the end is empty", () => {
    const seen = new Set<number>();
    for (let offset = 0; offset < 756; offset += 20) {
      const r = search({ limit: 20, offset });
      for (const i of r.data.items) seen.add(i.id);
    }
    expect(seen.size).toBe(756);
    const last = search({ limit: 20, offset: 740 });
    expect(last.data.items).toHaveLength(16);
    expect(last.data.next_offset).toBeNull();
    expect(search({ offset: 9999 }).data).toMatchObject({ total: 756, items: [], next_offset: null });
  });

  it("warns after 180 days in Curitiba time, not before", () => {
    const day = (n: number) => new Date(Date.parse(`${CITY_SERVICES_CHECKED_AT}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    expect(cityServicesStaleNote(day(CITY_SERVICES_MAX_AGE_DAYS))).toBe("");
    expect(cityServicesStaleNote(day(CITY_SERVICES_MAX_AGE_DAYS + 1))).toContain("181 days ago");
    // 03:00 UTC on day 181 is still day 180 in Curitiba (UTC-3).
    const edge = new Date(`${day(CITY_SERVICES_MAX_AGE_DAYS + 1)}T02:59:00Z`);
    expect(cityServicesSearchResult({ limit: 1, offset: 0 }, edge).note).not.toContain("days ago");
    expect(cityServicesSearchResult({ limit: 1, offset: 0 }, new Date(`${day(CITY_SERVICES_MAX_AGE_DAYS + 1)}T03:00:00Z`)).note).toContain("181 days ago");
  });

  it("over MCP: valid result with attribution, no network call", async () => {
    const calls = stubFetch({});
    const client = await connectClient();
    const res = await client.callTool({ name: "city_services_search", arguments: { query: "saude", limit: 3 } });
    expect(res.isError).toBeFalsy();
    const parsed = cityServicesSearchOutput.parse(res.structuredContent);
    expect(parsed.data.items).toHaveLength(3);
    expect(parsed.license_note).toContain("Prefeitura Municipal de Curitiba — Carta de Serviços");
    expect(parsed.license_note).toContain("2026-11-19/20");
    expect(parsed.checked_at).toBe("2026-11-19");
    expect(calls).toHaveLength(0);
  });

  it("over MCP: a bad category is invalid_argument listing the 18 names, without echoing the input", async () => {
    const client = await connectClient();
    const res = await client.callTool({ name: "city_services_search", arguments: { category: "Saude<script>" } });
    const err = errorOf(res) as { error: string; message: string };
    expect(err.error).toBe("invalid_argument");
    for (const c of CATEGORIES) expect(err.message).toContain(c);
    expect(err.message).not.toContain("<script>");
  });

  it.each([
    { limit: 0 },
    { limit: 21 },
    { offset: -1 },
    { offset: 10_001 },
    { query: "a" },
    { query: "x".repeat(101) },
  ])("over MCP: rejects out-of-range input %o", async (args) => {
    const client = await connectClient();
    const res = await client.callTool({ name: "city_services_search", arguments: args });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
  });
});
