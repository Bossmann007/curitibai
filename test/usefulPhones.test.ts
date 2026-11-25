import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePhonesPage } from "../scripts/fetch-events.mjs";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { REMOTE_DATA_ENV } from "../src/sources/publishedData.js";
import { buildPhones, PHONES_SOURCE_URL, usefulPhonesOutput, usefulPhonesResult } from "../src/tools/usefulPhones.js";
import { connectClient, errorOf, fixture } from "./helpers.js";

// The collector's own output for the fixture trimmed from the real page, so the tool reads what the collector writes.
const ENTRIES = parsePhonesPage(fixture("useful_phones/telefones_uteis_trimmed.html")).entries;
const fileWith = (entries: object[] = ENTRIES, extra: object = {}) => ({
  format: 1,
  source: PHONES_SOURCE_URL,
  checked_at: "2026-11-22T02:11:30.000Z",
  count: entries.length,
  dropped: 0,
  entries,
  ...extra,
});
const NOW = new Date("2026-11-22T12:00:00Z");
const result = (query?: string, limit = 20) => usefulPhonesResult(buildPhones(fileWith()), { query, limit }, NOW);

describe("usefulPhonesResult", () => {
  it("filters by every word, accent- and case-insensitive, in page order", () => {
    expect(result("defesa civil").data.items).toEqual([{ name: "Defesa Civil", section: "Emergências", numbers: ["199"] }]);
    expect(result("POLICIA federal").data.items.map((e) => e.name)).toEqual([
      "Polícia Federal",
      "Polícia Federal - imigração/passaporte",
      "Polícia Rodoviária Federal",
      "Polícia Rodoviária Federal - Delegacia Polícia Rodoviária Federal",
    ]);
    expect(result("emergencias samu").data.items.map((e) => e.numbers)).toEqual([["192"]]);
    expect(result("guarda municipal").data.items[0]!.numbers).toEqual(["153"]);
  });

  it("finds by number, with or without its punctuation", () => {
    expect(result("3350-6456").data.items.map((e) => e.name)).toEqual(["Disque Turismo Municipal"]);
    expect(result("33506456").data.items.map((e) => e.name)).toEqual(["Disque Turismo Municipal"]);
  });

  it("returns everything without a query, capped by limit with the total", () => {
    const r = result(undefined, 50);
    expect(r.data.total).toBe(60);
    expect(r.data.items).toHaveLength(50);
    expect(result(undefined, 5).data.items.map((e) => e.name)[0]).toBe("SIATE(ambulância/bombeiros)");
    expect(result("palavra inexistente").data).toEqual({ total: 0, skipped_rows: 0, items: [] });
  });

  it("has no Ouvidoria entry: never labels another line as the Ouvidoria (city_service_guide ouvidoria since 0.43.0)", () => {
    expect(result("ouvidoria").data).toEqual({ total: 0, skipped_rows: 0, items: [] });
  });

  it("returns source URL, fetched_at, checked_at, stale and attribution, valid against the output schema", () => {
    const r = usefulPhonesOutput.parse(result("samu"));
    expect(r).toMatchObject({
      source_url: PHONES_SOURCE_URL,
      fetched_at: "2026-11-22T02:11:30.000Z",
      checked_at: "2026-11-22T02:11:30.000Z",
      stale: false,
    });
    expect(r.note).toMatch(/^Read from the local file phones\/phones\.json/);
  });

  it("marks the file stale after 3 days (still answered: phones change rarely)", () => {
    const later = new Date("2026-11-25T03:00:00Z");
    const r = usefulPhonesResult(buildPhones(fileWith()), { query: "samu", limit: 20 }, later);
    expect(r.stale).toBe(true);
    expect(r.data.items).toHaveLength(1);
    expect(r.note).toMatch(/more than 3 days old \(stale: true\)\.$/);
  });

  it("refuses a file with another shape, an unknown number format or another source", () => {
    expect(() => buildPhones(fileWith(ENTRIES, { count: 1 }))).toThrow(/expected shape/);
    expect(() => buildPhones(fileWith([{ section: "S", name: "N", numbers: ["(41) 99999-8888"] }]))).toThrow(/expected shape/);
    expect(() => buildPhones(fileWith([{ section: "S", name: "N", numbers: ["153"], extra: "x" }]))).toThrow(/expected shape/);
    expect(() => buildPhones(fileWith(ENTRIES, { source: "https://evil.example/" }))).toThrow(/expected shape/);
  });

  it("drops and counts a row whose name or section is empty after cleaning", () => {
    const rows = [
      { section: "S", name: "\u200b\u202e", numbers: ["153"] }, // only format characters: "" after cleanField
      { section: "\u0007", name: "Guarda", numbers: ["153"] }, // a control character only: "" after cleanField
      { section: "S", name: "Defesa Civil", numbers: ["199"] },
    ];
    const data = buildPhones(fileWith(rows));
    expect(data.entries).toEqual([{ name: "Defesa Civil", section: "S", numbers: ["199"] }]);
    expect(data.skipped).toBe(2);
    const r = usefulPhonesResult(data, { limit: 20 });
    expect(r.data).toMatchObject({ total: 1, skipped_rows: 2 });
    expect(r.note).toMatch(/2 entries .*skipped/);
    expect(usefulPhonesResult(buildPhones(fileWith()), { limit: 1 }).data.skipped_rows).toBe(0);
  });

  it("cleans names again: a hand-edited name holding an e-mail is masked", () => {
    const data = buildPhones(fileWith([{ section: "S", name: "Contato fulano@exemplo.com", numbers: ["153"] }]));
    expect(data.entries[0]!.name).toBe("Contato [masked]");
  });
});

describe("useful_phones tool", () => {
  let dir: string;
  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-phones-tool-")));
    vi.stubEnv(DATA_DIR_ENV, dir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (text: string) => {
    mkdirSync(join(dir, "phones"), { recursive: true });
    writeFileSync(join(dir, "phones", "phones.json"), text);
  };
  const call = async (args: Record<string, unknown>) => (await connectClient()).callTool({ name: "useful_phones", arguments: args });

  it("reads the local file with no network call", async () => {
    write(JSON.stringify(fileWith()));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await call({ query: "samu" });
    expect(res.isError).toBeFalsy();
    expect(usefulPhonesOutput.parse(res.structuredContent).data.items[0]!.numbers).toEqual(["192"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("data_not_available with how to run the collector when the copy is missing (remote reading off)", async () => {
    vi.stubEnv(REMOTE_DATA_ENV, "0");
    const err = errorOf(await call({}));
    expect(err).toMatchObject({ error: "data_not_available" });
    expect(JSON.stringify(err)).toMatch(/scripts\/fetch-events\.mjs/);
  });

  it("invalid_data for a malformed file", async () => {
    write("{not json");
    expect(errorOf(await call({}))).toMatchObject({ error: "invalid_data" });
  });

  it("checks the limits: query 2–100 characters with a letter or digit, limit 1–50", async () => {
    write(JSON.stringify(fileWith()));
    for (const args of [{ query: "a" }, { query: "x".repeat(101) }, { limit: 51 }, { limit: 0 }]) {
      expect((await call(args)).isError).toBe(true);
    }
    expect(errorOf(await call({ query: "--" }))).toMatchObject({ error: "invalid_argument" });
    expect((await call({ query: "x".repeat(100), limit: 50 })).isError).toBeFalsy();
  });
});
