import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { buildEvents, eventsSearchOutput, eventsSearchResult, EVENTS_ATTRIBUTION, EVENTS_LICENSE_NOTE } from "../src/tools/eventsSearch.js";
import { connectClient, errorOf } from "./helpers.js";

// Invented events only.
const LINK = (slug: string, id: number) => `https://turismo.curitiba.pr.gov.br/evento/${slug}/${id}`;
const ev = (id: number, start: string, end: string, extra: Partial<Record<string, string>> = {}) => ({
  id,
  title: `Evento Sintético ${id}`,
  start_date: start,
  end_date: end,
  time: "20h.",
  place: "Teatro Imaginário",
  address: "Rua Inventada, 1, Centro",
  category: "Lazer",
  link: LINK(`evento-sintetico-${id}`, id),
  ...extra,
});

const NOW = new Date("2026-11-21T15:00:00Z"); // 12:00 in Curitiba
const fileWith = (events: object[], checked_at = "2026-11-21T05:10:00.000Z") => ({
  format: 1,
  source: "https://turismo.curitiba.pr.gov.br/eventos/",
  checked_at,
  list_date: "2026-11-21",
  count: events.length,
  events,
});

const EVENTS = [
  ev(1, "2026-11-10", "2026-11-30"), // ongoing
  ev(2, "2026-11-21", "2026-11-21", { title: "Feira de Natal Fictícia", category: "Natal" }),
  ev(3, "2026-11-28", "2026-11-28", { place: "Parque Exemplo", category: "Técnico Científico" }),
  ev(4, "2026-11-29", "2026-11-29"), // after the default range (21..28)
  ev(5, "2026-11-01", "2026-11-20"), // already over
];

const args = (a: object = {}) => ({ limit: 20, offset: 0, ...a });
function result(file: object, a: object = {}, now = NOW) {
  const out = eventsSearchResult(buildEvents(file), args(a), now);
  if ("error" in out) throw new Error(out.error);
  return out.result;
}

describe("eventsSearchResult", () => {
  it("defaults to today..today+7 in Curitiba, overlapping events, earliest first", () => {
    const r = result(fileWith(EVENTS));
    expect(r.data).toMatchObject({ from: "2026-11-21", to: "2026-11-28", total: 3, next_offset: null });
    expect(r.data.items.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(r).toMatchObject({
      source_url: "https://turismo.curitiba.pr.gov.br/eventos/",
      checked_at: "2026-11-21T05:10:00.000Z",
      stale: false,
      attribution: EVENTS_ATTRIBUTION,
      license_note: EVENTS_LICENSE_NOTE,
    });
    expect(r.attribution).toBe("Instituto Municipal de Turismo de Curitiba (not affiliated)");
    expect(r.license_note).toBe("the site publishes no licence; facts and links only");
    expect(r.note).toMatch(/untrusted third-party text/);
    expect(() => eventsSearchOutput.parse(r)).not.toThrow();
  });

  it("uses Curitiba's date for the default range (01:00Z is still the day before)", () => {
    const r = result(fileWith(EVENTS), {}, new Date("2026-11-22T01:00:00Z"));
    expect(r.data.from).toBe("2026-11-21");
  });

  it("filters by text (accents and case ignored) and category, and pages", () => {
    expect(result(fileWith(EVENTS), { text: "feira NATAL ficticia" }).data.items.map((e) => e.id)).toEqual([2]);
    expect(result(fileWith(EVENTS), { text: "parque" }).data.items.map((e) => e.id)).toEqual([3]);
    expect(result(fileWith(EVENTS), { category: "tecnico cientifico" }).data.items.map((e) => e.id)).toEqual([3]);
    expect(result(fileWith(EVENTS), { from: "2026-11-01", to: "2026-12-31" }).data.total).toBe(5);
    const p = result(fileWith(EVENTS), { from: "2026-11-01", to: "2026-12-31", limit: 2, offset: 2 }).data;
    expect([p.items.map((e) => e.id), p.next_offset]).toEqual([[2, 3], 4]);
  });

  it("marks the file stale after 3 days and refuses it after 7", () => {
    expect(result(fileWith(EVENTS, "2026-11-18T14:00:00.000Z")).stale).toBe(true);
    expect(result(fileWith(EVENTS, "2026-11-18T16:00:00.000Z")).stale).toBe(false);
    const old = eventsSearchResult(buildEvents(fileWith(EVENTS, "2026-11-14T14:00:00.000Z")), args(), NOW);
    expect(old).toMatchObject({ error: "data_not_available" });
    const future = eventsSearchResult(buildEvents(fileWith(EVENTS, "2026-11-23T00:00:00.000Z")), args(), NOW);
    expect(future).toMatchObject({ error: "invalid_data" });
  });

  it("rejects an inverted or too long date range", () => {
    expect(eventsSearchResult(buildEvents(fileWith(EVENTS)), args({ from: "2026-11-22", to: "2026-11-21" }), NOW)).toMatchObject({ error: "invalid_date_range" });
    expect(eventsSearchResult(buildEvents(fileWith(EVENTS)), args({ from: "2026-01-01", to: "2027-06-01" }), NOW)).toMatchObject({ error: "invalid_date_range" });
  });

  it("sanitizes the text fields again on read", () => {
    const dirty = ev(9, "2026-11-21", "2026-11-21", {
      title: `Show\u202E X\u{E0041}\u0000 maria@example.com ${"z".repeat(300)}`,
      place: "Casa (41) 3333-4444",
      address: "Rua\u200B 1",
    });
    const [item] = result(fileWith([dirty])).data.items;
    expect(item!.title.startsWith("Show X [masked] z")).toBe(true);
    expect([...item!.title]).toHaveLength(120);
    expect(item!.place).toBe("Casa [masked]");
    expect(item!.address).toBe("Rua 1");
  });
});

describe("buildEvents validation", () => {
  const bad: [string, object][] = [
    ["wrong format", { ...fileWith(EVENTS), format: 2 }],
    ["count mismatch", { ...fileWith(EVENTS), count: 9 }],
    ["link to another host", fileWith([ev(1, "2026-11-21", "2026-11-21", { link: "https://evil.example/evento/a/1" })])],
    ["link id differs from id", fileWith([ev(1, "2026-11-21", "2026-11-21", { link: LINK("a", 2) })])],
    ["http link", fileWith([ev(1, "2026-11-21", "2026-11-21", { link: "http://turismo.curitiba.pr.gov.br/evento/a/1" })])],
    ["bad date", fileWith([ev(1, "2026-02-30", "2026-03-01")])],
    ["end before start", fileWith([ev(1, "2026-11-22", "2026-11-21")])],
    ["extra field", fileWith([{ ...ev(1, "2026-11-21", "2026-11-21"), description: "x" }])],
    ["empty title", fileWith([ev(1, "2026-11-21", "2026-11-21", { title: "" })])],
    ["bad checked_at", fileWith(EVENTS, "yesterday")],
  ];
  it.each(bad)("rejects a file with %s", (_, file) => {
    expect(() => buildEvents(file)).toThrow(/expected shape/);
  });
});

describe("events_search tool", () => {
  let dir: string;
  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-events-tool-")));
    vi.stubEnv(DATA_DIR_ENV, dir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (text: string) => {
    mkdirSync(join(dir, "events"), { recursive: true });
    writeFileSync(join(dir, "events", "events.json"), text);
  };

  it("returns events from the local file, valid against the output schema, with no network call", async () => {
    write(JSON.stringify(fileWith([ev(1, "2026-11-01", "2027-12-31")], new Date().toISOString())));
    const client = await connectClient();
    const res = await client.callTool({ name: "events_search", arguments: {} });
    expect(res.isError).toBeFalsy();
    const parsed = eventsSearchOutput.parse(res.structuredContent);
    expect(parsed.data.items.map((e) => e.id)).toEqual([1]);
  });

  it("data_not_available when the file is missing or older than 7 days", async () => {
    const client = await connectClient();
    expect(errorOf(await client.callTool({ name: "events_search", arguments: {} }))).toMatchObject({ error: "data_not_available" });
    write(JSON.stringify(fileWith([ev(1, "2026-11-01", "2027-12-31")], "2020-01-01T00:00:00.000Z")));
    expect(errorOf(await client.callTool({ name: "events_search", arguments: {} }))).toMatchObject({ error: "data_not_available" });
  });

  it("invalid_data for a malformed or invalid file", async () => {
    const client = await connectClient();
    write("{not json");
    expect(errorOf(await client.callTool({ name: "events_search", arguments: {} }))).toMatchObject({ error: "invalid_data" });
    write(JSON.stringify({ ...fileWith([]), count: 1 }));
    expect(errorOf(await client.callTool({ name: "events_search", arguments: {} }))).toMatchObject({ error: "invalid_data" });
  });

  it("caps limit at 50", async () => {
    write(JSON.stringify(fileWith([], new Date().toISOString())));
    const client = await connectClient();
    const res = await client.callTool({ name: "events_search", arguments: { limit: 51 } });
    expect(res.isError).toBe(true);
  });
});
