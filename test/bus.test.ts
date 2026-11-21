import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { MASK } from "../src/sources/pncp.js";
import { newestUrbsFile, parseUrbs, URBS_MAX_BYTES, URBS_SOURCE_URL, type UrbsKind } from "../src/sources/urbs.js";
import { busDeparturesOutput } from "../src/tools/busDepartures.js";
import { busLineStopsOutput } from "../src/tools/busLineStops.js";
import { busLinesSearchOutput } from "../src/tools/busLinesSearch.js";
import { connectClient, errorOf } from "./helpers.js";

// Invented lines, stops and times in the real URBS export shape (test/fixtures/urbs_synthetic); no real rows.
// The fixtures have no date in their names so that scripts/check-no-catalog never has to exempt a dated file:
// each test copies them into a temporary CURITIBAI_DATA_DIR/urbs/ under the dated names the tool looks for.
const FIXTURES = new URL("./fixtures/urbs_synthetic/", import.meta.url).pathname;
const KINDS: UrbsKind[] = ["linhas", "pontosLinha", "tabelaLinha"];

let tmp: string;
beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-urbs-")));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

/** CURITIBAI_DATA_DIR/urbs/ with the three fixtures under `prefix` (YYYY_MM_DD). */
function dataDir(prefix = "2026_11_20", kinds: UrbsKind[] = KINDS): string {
  mkdirSync(join(tmp, "urbs"), { recursive: true });
  for (const k of kinds) copyFileSync(join(FIXTURES, `${k}.json`), join(tmp, "urbs", `${prefix}_${k}.json`));
  return tmp;
}

async function call(name: string, args: Record<string, unknown>, dir: string | undefined = tmp) {
  if (dir !== undefined) vi.stubEnv(DATA_DIR_ENV, dir);
  const client = await connectClient();
  return client.callTool({ name, arguments: args });
}

type Data<T extends { parse: (x: unknown) => unknown }> = ReturnType<T["parse"]>;

async function lines(args: Record<string, unknown>) {
  const res = await call("bus_lines_search", args);
  expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
  return busLinesSearchOutput.parse(res.structuredContent) as Data<typeof busLinesSearchOutput>;
}
async function stops(args: Record<string, unknown>) {
  const res = await call("bus_line_stops", args);
  expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
  return busLineStopsOutput.parse(res.structuredContent) as Data<typeof busLineStopsOutput>;
}
async function departures(args: Record<string, unknown>) {
  const res = await call("bus_departures", args);
  expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
  return busDeparturesOutput.parse(res.structuredContent) as Data<typeof busDeparturesOutput>;
}

describe("file selection", () => {
  it("takes the newest valid date of the asked kind only", () => {
    const names = [
      "2026_11_19_linhas.json",
      "2026_11_20_linhas.json",
      "2026_02_30_linhas.json", // impossible date: ignored even though it is not the newest
      "2027_01_01_linhas.json.xz", // still compressed
      "2027_01_01_LINHAS.json", // the kind is case-sensitive, as URBS names it
      "2027_01_01_tabelaLinha.json",
      "2027-01-01_linhas.json",
      "x2027_01_01_linhas.json",
    ];
    expect(newestUrbsFile(names, "linhas")).toEqual({ name: "2026_11_20_linhas.json", date: "2026-11-20" });
    expect(newestUrbsFile(names, "pontosLinha")).toBeNull();
    expect(newestUrbsFile(["2026_02_30_linhas.json"], "linhas")).toBeNull();
  });

  it("reads the newest file and reports its date as checked_at", async () => {
    dataDir("2026_11_20");
    mkdirSync(join(tmp, "urbs"), { recursive: true });
    const older = JSON.parse(readFileSync(join(FIXTURES, "linhas.json"), "utf8")) as unknown[];
    writeFileSync(join(tmp, "urbs", "2026_11_01_linhas.json"), JSON.stringify(older.slice(0, 1)));
    const out = await lines({});
    expect(out.checked_at).toBe("2026-11-20");
    expect(out.data.total).toBe(4);
    expect(out.source_url).toBe(URBS_SOURCE_URL);
    expect(out.license_note).toContain("2026_11_20_linhas.json");
    expect(out.license_note).toContain("URBS");
    expect(out.license_note).toContain("Creative Commons licence without naming the variant");
    expect(out.note).toContain("no network call");
    expect(out.note).not.toContain("days ago");
  });

  it("warns when the file is more than 30 days old (Curitiba date), not at 30", async () => {
    dataDir("2026_10_21"); // 31 days before 2026-11-21
    expect((await lines({})).note).toContain("dated 2026-10-21, 31 days ago (more than 30)");
    rmSync(join(tmp, "urbs"), { recursive: true });
    dataDir("2026_10_22");
    expect((await lines({})).note).not.toContain("days ago");
  });

  it.each(["bus_lines_search", "bus_line_stops", "bus_departures"])("%s: data_not_available without the data", async (name) => {
    const args = name === "bus_lines_search" ? {} : { line_code: "901" };
    expect(errorOf(await call(name, args, undefined))).toMatchObject({ error: "data_not_available" });
    expect(errorOf(await call(name, args, tmp))).toMatchObject({ error: "data_not_available" }); // no urbs/ folder
    mkdirSync(join(tmp, "urbs"));
    writeFileSync(join(tmp, "urbs", "2026_11_20_linhas.json.xz"), "\xfd7zXZ"); // only the compressed download
    const err = errorOf(await call(name, args, tmp)) as { error: string; message: string };
    expect(err.error).toBe("data_not_available");
    expect(err.message).toContain("xz -d");
  });

  it("a tool needs only its own file", async () => {
    dataDir("2026_11_20", ["tabelaLinha"]);
    expect((await departures({ line_code: "901" })).data.total).toBeGreaterThan(0);
    expect(errorOf(await call("bus_lines_search", {}))).toMatchObject({ error: "data_not_available" });
  });

  it("file_not_allowed when urbs/ is a symlink to outside the data folder", async () => {
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-urbs-out-")));
    try {
      mkdirSync(join(tmp, "data"));
      copyFileSync(join(FIXTURES, "linhas.json"), join(outside, "2026_11_20_linhas.json"));
      symlinkSync(outside, join(tmp, "data", "urbs"));
      expect(errorOf(await call("bus_lines_search", {}, join(tmp, "data")))).toMatchObject({ error: "file_not_allowed" });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("file_not_allowed when the newest file is a symlink to outside the data folder", async () => {
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-urbs-out-")));
    try {
      mkdirSync(join(tmp, "urbs"));
      copyFileSync(join(FIXTURES, "linhas.json"), join(outside, "x.json"));
      symlinkSync(join(outside, "x.json"), join(tmp, "urbs", "2026_11_20_linhas.json"));
      expect(errorOf(await call("bus_lines_search", {}))).toMatchObject({ error: "file_not_allowed" });
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("invalid_data", () => {
  function write(content: string | Buffer, kind: UrbsKind = "linhas") {
    mkdirSync(join(tmp, "urbs"), { recursive: true });
    writeFileSync(join(tmp, "urbs", `2026_11_20_${kind}.json`), content);
  }
  const message = async () => (errorOf(await call("bus_lines_search", {})) as { error: string; message: string });

  it("not JSON (e.g. an .xz file renamed) names the fix", async () => {
    write(Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00, 0xff]));
    expect(await message()).toEqual({ error: "invalid_data", message: expect.stringContaining("xz -d") });
  });

  it.each([
    ["an object", { COD: "1" }],
    ["a row without NOME", [{ COD: "1", SOMENTE_CARTAO: "S", CATEGORIA_SERVICO: "A", NOME_COR: "B" }]],
    ["a number as COD", [{ COD: 1, NOME: "X", SOMENTE_CARTAO: "S", CATEGORIA_SERVICO: "A", NOME_COR: "B" }]],
  ])("the wrong shape (%s), without echoing the file's text", async (_n, json) => {
    write(JSON.stringify(json));
    const err = await message();
    expect(err.error).toBe("invalid_data");
    expect(err.message).toMatch(/^2026_11_20_linhas\.json does not have the expected linhas shape/);
  });

  it.each([
    ["HORA 24:00", { HORA: "24:00" }],
    ["HORA without a leading zero", { HORA: "7:05" }],
    ["NUM with letters", { NUM: "12a" }],
  ])("timetable rows are checked (%s)", async (_n, patch) => {
    const rows = JSON.parse(readFileSync(join(FIXTURES, "tabelaLinha.json"), "utf8")) as object[];
    write(JSON.stringify([{ ...rows[0], ...patch }]), "tabelaLinha");
    expect(errorOf(await call("bus_departures", { line_code: "901" }))).toMatchObject({ error: "invalid_data" });
  });

  it("refuses coordinates that are not numbers", () => {
    const rows = JSON.parse(readFileSync(join(FIXTURES, "pontosLinha.json"), "utf8")) as object[];
    expect(() => parseUrbs("pontosLinha", "f.json", [{ ...rows[0], LAT: "-25,4x" }])).toThrow(/expected pontosLinha shape/);
  });

  it(`a file over ${URBS_MAX_BYTES / (1024 * 1024)} MB is refused without parsing`, async () => {
    write(Buffer.alloc(URBS_MAX_BYTES + 1, 0x20));
    expect(await message()).toEqual({ error: "invalid_data", message: "The newest linhas file is larger than 20 MB." });
  });
});

describe("bus_lines_search", () => {
  beforeEach(() => {
    dataDir();
  });

  it("lists categories with counts and maps SOMENTE_CARTAO, with no filter", async () => {
    const out = await lines({});
    expect(out.data.categories).toEqual([
      { name: "ALIMENTADOR", count: 2 },
      { name: "CONVENCIONAL", count: 1 },
      { name: "LIGEIRÃO", count: 1 },
    ]);
    const card = Object.fromEntries(out.data.items.map((l) => [l.code, l.card_only]));
    expect(card).toEqual({ "901": true, X91: false, "092": null, "903": true });
    expect(out.data.items.find((l) => l.code === "901")).toEqual({
      code: "901",
      name: "VILA FICTÍCIA / JD. INVENTADO",
      category: "CONVENCIONAL",
      color: "AMARELA",
      card_only: true,
    });
  });

  it("matches words in the name ignoring accents and case, and codes", async () => {
    expect((await lines({ query: "fictici" })).data.items.map((l) => l.code)).toEqual(["X91", "901"]);
    expect((await lines({ query: "FICTICIA" })).data.items.map((l) => l.code)).toEqual(["901"]);
    expect((await lines({ query: "agua imaginaria" })).data.items.map((l) => l.code)).toEqual(["092"]);
    expect((await lines({ query: "x91" })).data.items.map((l) => l.code)).toEqual(["X91"]);
    expect((await lines({ query: "inventado 903" })).data.items.map((l) => l.code)).toEqual(["903"]);
    expect((await lines({ query: "ficticia" })).data.categories).toBeUndefined();
  });

  it("puts an exact code first", async () => {
    // "901" is a code and also a substring of nothing else; "90" matches 901 and 903 by code, ordered by name.
    expect((await lines({ query: "90" })).data.items.map((l) => l.code)).toEqual(["903", "901"]);
    expect((await lines({ query: "903" })).data.items[0]?.code).toBe("903");
  });

  it("filters by category, accents and case ignored; refuses an unknown one with the list", async () => {
    expect((await lines({ category: "ligeirao" })).data.items.map((l) => l.code)).toEqual(["X91"]);
    expect(errorOf(await call("bus_lines_search", { category: "TREM" }))).toEqual({
      error: "invalid_argument",
      message: "category must be one of: ALIMENTADOR; CONVENCIONAL; LIGEIRÃO.",
    });
  });

  it("pages with limit and offset, up to 50", async () => {
    const first = await lines({ limit: 3 });
    expect(first.data).toMatchObject({ total: 4, offset: 0, next_offset: 3 });
    const last = await lines({ limit: 3, offset: 3 });
    expect(last.data).toMatchObject({ total: 4, offset: 3, next_offset: null });
    expect(last.data.items).toHaveLength(1);
    expect((await call("bus_lines_search", { limit: 51 })).isError).toBe(true);
  });

  it("refuses a query with no letter or digit", async () => {
    expect(errorOf(await call("bus_lines_search", { query: "--" }))).toMatchObject({ error: "invalid_argument" });
  });
});

describe("bus_line_stops", () => {
  beforeEach(() => {
    dataDir();
  });

  it("returns each direction's stops in seq order, with decimal coordinates", async () => {
    const out = await stops({ line_code: "901" });
    expect(out.data.line_code).toBe("901");
    expect(out.data.directions).toEqual([
      { direction: "Bairro Inventado", itinerary_id: "7001", stop_count: 2 },
      { direction: "Terminal Imaginário", itinerary_id: "7002", stop_count: 3 },
    ]);
    expect(out.data.items.map((s) => [s.itinerary_id, s.seq, s.stop_number])).toEqual([
      ["7001", 1, "990004"],
      ["7001", 2, "990005"],
      ["7002", 1, "990001"],
      ["7002", 2, "990002"],
      ["7002", 3, "990003"],
    ]);
    expect(out.data.items[2]).toEqual({
      direction: "Terminal Imaginário",
      itinerary_id: "7002",
      seq: 1,
      stop_number: "990001",
      name: "Terminal Imaginário - 901",
      lat: -25.410000000002,
      lon: -49.210000000002,
      type: "Plataforma",
      group: "",
    });
    expect(out.data.items.find((s) => s.stop_number === "990003")).toMatchObject({ lat: null, lon: null });
    expect(out.checked_at).toBe("2026-11-20");
  });

  it("passes stop names through the masking guard", async () => {
    const out = await stops({ line_code: "901", itinerary_id: "7001" });
    const masked = out.data.items.find((s) => s.stop_number === "990004")!;
    expect(masked.name).toContain(MASK);
    expect(masked.name).not.toContain("example.invalid");
    // Fails closed: a street-number range reads as a phone number (seen on 29 real stop names, docs/sources.md).
    expect((await stops({ line_code: "x91" })).data.items.map((s) => s.name)).toEqual([
      "Estação Tubo Fictícia",
      `Rua Imaginária, ${MASK} - Vila Fictícia`,
    ]);
  });

  it("filters one direction and pages", async () => {
    const out = await stops({ line_code: "901", itinerary_id: "7002", limit: 2 });
    expect(out.data).toMatchObject({ total: 3, next_offset: 2 });
    expect(out.data.directions).toHaveLength(2);
    expect(out.data.items.map((s) => s.seq)).toEqual([1, 2]);
  });

  it("refuses an unknown line or direction", async () => {
    expect(errorOf(await call("bus_line_stops", { line_code: "777" }))).toMatchObject({ error: "invalid_argument" });
    expect(errorOf(await call("bus_line_stops", { line_code: "901", itinerary_id: "7101" }))).toMatchObject({
      error: "invalid_argument",
    });
    expect((await call("bus_line_stops", { line_code: "../x" })).isError).toBe(true);
  });
});

describe("bus_departures", () => {
  beforeEach(() => {
    dataDir();
  });

  it("needs a line or a stop, and an ordered window", async () => {
    expect(errorOf(await call("bus_departures", {}))).toMatchObject({ error: "invalid_argument" });
    expect(errorOf(await call("bus_departures", { line_code: "901", from: "08:00", to: "07:00" }))).toMatchObject({
      error: "invalid_argument",
    });
    expect((await call("bus_departures", { line_code: "901", from: "7:00" })).isError).toBe(true);
  });

  it("returns a line's departures by day then time, with the day code, its reading and ADAPT as published", async () => {
    const out = await departures({ line_code: "901", limit: 50 });
    expect(out.data.items.map((d) => `${d.day} ${d.time} ${d.stop_number}`)).toEqual([
      "1 00:00 990001",
      "1 06:40 990001",
      "1 07:10 990001",
      "1 07:20 990004",
      "1 07:40 990001",
      "1 23:59 990001",
      "2 08:00 990001",
      "3 09:00 990001",
      "4 10:00 990001",
    ]);
    const dayTypes = Object.fromEntries(out.data.items.map((d) => [d.day, d.day_type]));
    expect(dayTypes).toEqual({ "1": "weekday", "2": "saturday", "3": "sunday_or_holiday", "4": null });
    expect(out.data.items.map((d) => d.adapt)).toContain("RAMPA ELÉTRICA");
    expect(out.data.items.map((d) => d.adapt)).toContain("RAMPA ELETRICA");
    expect(out.data.items[1]).toEqual({
      time: "06:40",
      day: "1",
      day_type: "weekday",
      line_code: "901",
      stop_number: "990001",
      stop_name: "TERMINAL IMAGINARIO",
      table: "1",
      adapt: "ELEVADOR",
    });
    expect(out.note).toContain("inferred from the data, not stated by URBS");
  });

  it("filters by stop, day and an inclusive time window", async () => {
    const out = await departures({ stop_number: "990001", day: "1", from: "06:40", to: "07:40" });
    expect(out.data.items.map((d) => d.time)).toEqual(["06:40", "07:10", "07:40"]);
    const both = await departures({ line_code: "x91", stop_number: "990006" });
    expect(both.data.items.map((d) => d.time)).toEqual(["07:10", "07:15"]);
    expect((await departures({ line_code: "901", day: "9" })).data.total).toBe(0);
  });

  it("masks phone-shaped text in a stop name", async () => {
    const [d] = (await departures({ stop_number: "990004" })).data.items;
    expect(d?.stop_name).toContain(MASK);
    expect(d?.stop_name).not.toContain("3333");
  });

  it("pages", async () => {
    const out = await departures({ line_code: "901", limit: 4, offset: 4 });
    expect(out.data).toMatchObject({ total: 9, offset: 4, next_offset: 8 });
    expect((await call("bus_departures", { line_code: "901", limit: 51 })).isError).toBe(true);
  });
});
