import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { MASK } from "../src/sources/pncp.js";
import { newestUrbsFile, parseUrbs, URBS_MAX_BYTES, URBS_SOURCE_URL, type UrbsKind } from "../src/sources/urbs.js";
import { ADAPT_MISSING_NOTE, emptyFieldsNote } from "../src/tools/busCommon.js";
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
    expect(out.license_note).toContain(
      "Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/deed.pt_BR), as linked from the dataset's portal page",
    );
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

const fixtureRows = (kind: UrbsKind) => JSON.parse(readFileSync(join(FIXTURES, `${kind}.json`), "utf8")) as Record<string, unknown>[];
/** The fixture plus `n` valid rows of another line ("PAD", or P0, P1... in linhas), so a few bad rows stay under 5%. */
const padded = (kind: UrbsKind, n = 40) => {
  const rows = fixtureRows(kind);
  return [...rows, ...Array.from({ length: n }, (_, i) => ({ ...rows[0], COD: kind === "linhas" ? `P${i}` : "PAD" }))];
};
const FALLBACK = "To use an older file instead, delete 2026_11_20_linhas.json or change its name (for example to 2026_11_20_linhas.json.bad)";

describe("invalid_data", () => {
  function write(content: string | Buffer, kind: UrbsKind = "linhas", prefix = "2026_11_20") {
    mkdirSync(join(tmp, "urbs"), { recursive: true });
    writeFileSync(join(tmp, "urbs", `${prefix}_${kind}.json`), content);
  }
  const message = async () => (errorOf(await call("bus_lines_search", {})) as { error: string; message: string });

  it("not JSON (e.g. an .xz file renamed) names the fix and the fallback", async () => {
    write(Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00, 0xff]));
    const err = await message();
    expect(err.error).toBe("invalid_data");
    expect(err.message).toContain("xz -d");
    expect(err.message).toContain(FALLBACK);
  });

  it.each([
    ["an object", { COD: "1" }, " (it is not a list of rows)"],
    ["an empty list", [], " (it has no rows)"],
    ["only rows without NOME", [{ COD: "1", SOMENTE_CARTAO: "S", CATEGORIA_SERVICO: "A", NOME_COR: "B" }], ": 1 of 1 rows are invalid (first at row 0)"],
    ["only a number as COD", [{ COD: 1, NOME: "X" }], ": 1 of 1 rows are invalid (first at row 0)"],
  ])("the wrong shape (%s), with the fallback and without echoing the file's text", async (_n, json, why) => {
    write(JSON.stringify(json));
    const err = await message();
    expect(err.error).toBe("invalid_data");
    expect(err.message).toBe(
      `2026_11_20_linhas.json does not have the expected linhas shape${why}. ${FALLBACK} in the urbs folder; ` +
        "the tool then reads the newest remaining dated file.",
    );
  });

  it("rejects a file when more than 5% of its rows are invalid, not at exactly 5%", async () => {
    const [good] = fixtureRows("linhas");
    const bad = { ...good, COD: "TOO-LONG-CODE" };
    const goods = (n: number) => Array.from({ length: n }, (_, i) => ({ ...good, COD: `G${i}` }));
    write(JSON.stringify([...goods(18), bad])); // 1 of 19: over 5%
    const err = await message();
    expect(err.error).toBe("invalid_data");
    expect(err.message).toContain("1 of 19 rows are invalid (first at row 18)");
    expect(err.message).toContain(FALLBACK);
    write(JSON.stringify([...goods(38), bad, bad])); // 2 of 40: exactly 5%, kept
    let out = await lines({});
    expect(out.data.total).toBe(38);
    expect(out.data.skipped_rows).toBe(2);
    write(JSON.stringify([...goods(19), bad])); // 1 of 20: exactly 5%, kept
    out = await lines({});
    expect(out.data.total).toBe(19);
    expect(out.data.skipped_rows).toBe(1);
    expect(out.note).toContain("1 row of the file did not match the expected shape and was left out.");
  });

  it("after removing the newest bad file, the next newest is read", async () => {
    write("not json");
    write(readFileSync(join(FIXTURES, "linhas.json")), "linhas", "2026_11_19");
    expect((await message()).error).toBe("invalid_data");
    rmSync(join(tmp, "urbs", "2026_11_20_linhas.json"));
    expect((await lines({})).checked_at).toBe("2026-11-19");
  });

  it.each([
    ["HORA 24:10", { HORA: "24:10" }],
    ["HORA without a leading zero", { HORA: "7:05" }],
    ["NUM with letters", { NUM: "12A" }],
    ["a long COD", { COD: "X".repeat(11) }],
    ["a missing DIA", { DIA: undefined }],
  ])("skips a bad timetable row (%s) and counts it in the note", async (_n, patch) => {
    const rows = padded("tabelaLinha");
    write(JSON.stringify([...rows, { ...rows[0], HORA: "12:34", ...patch }]), "tabelaLinha");
    const out = await departures({ line_code: "901", limit: 50 });
    expect(out.data.total).toBe(9); // the fixture's own departures of line 901
    expect(out.data.skipped_rows).toBe(1);
    expect(out.data.items.map((d) => d.time)).not.toContain("12:34");
    expect(out.note).toContain("1 row of the file did not match the expected shape and was left out.");
  });

  it("skips a stop row with a long name or a bad coordinate", async () => {
    const rows = padded("pontosLinha");
    write(JSON.stringify([...rows, { ...rows[0], NOME: "N".repeat(301) }, { ...rows[1], SEQ: "9", LAT: "-25,4x" }]), "pontosLinha");
    const out = await stops({ line_code: "901" });
    expect(out.data.total).toBe(5);
    expect(out.data.skipped_rows).toBe(2);
    expect(out.note).toContain("2 rows of the file did not match the expected shape and were left out.");
  });

  it("keeps a row that lacks only a descriptive field (GRUPO, TIPO, ADAPT, null NOME_COR)", async () => {
    const without = (r: Record<string, unknown>, key: string) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== key));
    const stopsRows = fixtureRows("pontosLinha").map((r, i) => (i === 0 ? { ...without(r, "GRUPO"), TIPO: null } : without(r, "GRUPO")));
    write(JSON.stringify(stopsRows), "pontosLinha");
    const out = await stops({ line_code: "901", limit: 50 });
    expect(out.data.total).toBe(5);
    expect(out.data.items.every((s) => s.group === "")).toBe(true);
    expect(out.note).not.toContain("left out");
    expect(out.data.skipped_rows).toBe(0);
    write(JSON.stringify(fixtureRows("linhas").map((r) => ({ ...r, NOME_COR: null }))));
    const lineOut = await lines({ query: "901" });
    expect(lineOut.data.items[0]).toMatchObject({ code: "901", color: "" });
    expect(lineOut.data.skipped_rows).toBe(0);
    expect(lineOut.note).not.toContain("left out");
    expect(lineOut.note).not.toContain(ADAPT_MISSING_NOTE);
    const tabela = fixtureRows("tabelaLinha");
    write(JSON.stringify(tabela.map((r, i) => (i === 0 ? r : without(r, "ADAPT")))), "tabelaLinha");
    const some = await departures({ line_code: "901", limit: 50 });
    expect(some.data.items.some((d) => d.adapt === "")).toBe(true);
    expect(some.note).not.toContain("accessibility) field");
  });

  it("says the accessibility field looks missing or renamed when every timetable row has an empty ADAPT", async () => {
    write(JSON.stringify(fixtureRows("tabelaLinha").map((r, i) => ({ ...r, ADAPT: i % 2 ? "" : null }))), "tabelaLinha");
    const out = await departures({ line_code: "901" });
    expect(out.data.items[0]?.adapt).toBe("");
    expect(out.note).toContain(ADAPT_MISSING_NOTE);
    expect(out.note).toContain("looks missing or renamed");
    expect(parseUrbs("tabelaLinha", "f.json", fixtureRows("tabelaLinha")).emptyFields).toEqual([]);
    expect(parseUrbs("linhas", "f.json", fixtureRows("linhas")).emptyFields).toEqual([]);
  });

  it("says a descriptive field looks missing or renamed when it is empty, null or absent in every valid row", async () => {
    const without = (r: Record<string, unknown>, key: string) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== key));
    // NOME_COR: "", null or whitespace; SOMENTE_CARTAO: absent (as if renamed). One invalid row (no NOME) has both filled.
    const linhas = padded("linhas").map((r, i) => ({ ...without(r, "SOMENTE_CARTAO"), NOME_COR: [" ", "", null][i % 3] }));
    const invalid = { COD: "BAD", SOMENTE_CARTAO: "S", CATEGORIA_SERVICO: "A", NOME_COR: "Azul" };
    write(JSON.stringify([...linhas, invalid]));
    const out = await lines({ query: "901" });
    expect(out.data.skipped_rows).toBe(1);
    expect(out.data.items[0]).toMatchObject({ code: "901", color: expect.stringMatching(/^\s*$/), card_only: null });
    const note = emptyFieldsNote(["NOME_COR", "SOMENTE_CARTAO"]);
    expect(note).toBe(
      "Every valid row of this file has empty NOME_COR (`color`) and SOMENTE_CARTAO (`card_only`) fields, which real URBS " +
        "exports fill in at least some rows: these fields look missing or renamed in this file, so their empty or null " +
        "values in the results may not come from URBS.",
    );
    expect(out.note).toContain(note);
    expect(out.note).not.toContain(ADAPT_MISSING_NOTE);

    // One filled row anywhere in the file is enough: no note for that field.
    write(JSON.stringify(fixtureRows("linhas").map((r, i) => (i === 3 ? r : { ...r, NOME_COR: "" }))));
    expect((await lines({ query: "901" })).note).not.toContain("looks missing or renamed");

    // The check covers the whole file, not only the line asked for: GRUPO is filled on another line only.
    const stopsRows = fixtureRows("pontosLinha");
    const otherLine = stopsRows.map((r) => ({ ...r, COD: "999", GRUPO: "G1" }));
    write(JSON.stringify([...stopsRows.map((r) => ({ ...r, GRUPO: "" })), ...otherLine]), "pontosLinha");
    expect((await stops({ line_code: "901" })).note).not.toContain("missing or renamed");
    write(JSON.stringify(stopsRows.map((r) => ({ ...without(r, "GRUPO"), TIPO: null }))), "pontosLinha");
    const stopsOut = await stops({ line_code: "901" });
    expect(stopsOut.note).toContain(emptyFieldsNote(["TIPO", "GRUPO"]));
    expect(stopsOut.note).toContain("TIPO (`type`) and GRUPO (`group`) fields");

    // A timetable with both TABELA and ADAPT empty: the ADAPT note plus the generic one for TABELA alone.
    write(JSON.stringify(fixtureRows("tabelaLinha").map((r) => ({ ...r, TABELA: "", ADAPT: "" }))), "tabelaLinha");
    const dep = await departures({ line_code: "901" });
    expect(dep.note).toContain(ADAPT_MISSING_NOTE);
    expect(dep.note).toContain(
      "Every valid row of this file has an empty TABELA (`table`) field, which real URBS exports fill in at least some rows: " +
        "the field looks missing or renamed in this file, so its empty or null values in the results may not come from URBS.",
    );
    expect(emptyFieldsNote(["ADAPT"])).toBe("");
    expect(emptyFieldsNote([])).toBe("");
  });

  it("skips rows without a field a tool filters or orders by (CATEGORIA_SERVICO, SENTIDO)", () => {
    const lines = padded("linhas");
    const noCategory = Object.fromEntries(Object.entries(lines[0]!).filter(([k]) => k !== "CATEGORIA_SERVICO"));
    expect(parseUrbs("linhas", "f.json", [...lines, noCategory]).skipped).toBe(1);
    const stops = padded("pontosLinha");
    expect(parseUrbs("pontosLinha", "f.json", [...stops, { ...stops[0], SENTIDO: null }]).skipped).toBe(1);
  });

  it("parseUrbs reports the skipped count", () => {
    const rows = padded("pontosLinha");
    expect(parseUrbs("pontosLinha", "f.json", [...rows, { ...rows[0], LAT: "-25,4x" }]).skipped).toBe(1);
    expect(() => parseUrbs("pontosLinha", "f.json", [{ ...rows[0], LAT: "-25,4x" }])).toThrow(/1 of 1 rows are invalid/);
  });

  it(`a file over ${URBS_MAX_BYTES / (1024 * 1024)} MB is refused without parsing, with the fallback`, async () => {
    write(Buffer.alloc(URBS_MAX_BYTES + 1, 0x20));
    const err = await message();
    expect(err.error).toBe("invalid_data");
    expect(err.message).toMatch(/^2026_11_20_linhas\.json is larger than 20 MB\. /);
    expect(err.message).toContain(FALLBACK);
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
      after_midnight: false,
    });
    expect(out.note).toContain("inferred from the data, not stated by URBS");
    expect(out.note).toContain("under the day its service starts");
    expect(out.note).not.toContain("Whether URBS files");
    expect(out.data.items.map((d) => d.after_midnight)).toEqual([true, false, false, false, false, false, false, false, false]);
  });

  it("marks after_midnight from the whole file's order, before the stop filter", async () => {
    // Table 5 under code 2 wraps from 23:50 at one stop to 00:10 at another; table 6 has no wrap.
    const row = (HORA: string, NUM: string, TABELA: string) => ({ HORA, PONTO: "PARADA FICTICIA", DIA: "2", NUM, TABELA, ADAPT: "ELEVADOR", COD: "901" });
    writeFileSync(
      join(tmp, "urbs", "2026_11_20_tabelaLinha.json"),
      JSON.stringify([row("23:50", "990004", "5"), row("00:30", "990001", "6"), row("00:10", "990001", "5"), row("05:00", "990001", "6")]),
    );
    const out = await departures({ stop_number: "990001", day: "2" });
    expect(out.data.items.map((d) => `${d.time} ${d.table} ${d.after_midnight}`)).toEqual([
      "00:10 5 true",
      "00:30 6 false",
      "05:00 6 false",
    ]);
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
    expect(d?.stop_name).not.toContain("0000-0000");
  });

  it("pages", async () => {
    const out = await departures({ line_code: "901", limit: 4, offset: 4 });
    expect(out.data).toMatchObject({ total: 9, offset: 4, next_offset: 8 });
    expect((await call("bus_departures", { line_code: "901", limit: 51 })).isError).toBe(true);
  });
});
