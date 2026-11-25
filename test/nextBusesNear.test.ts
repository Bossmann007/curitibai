import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { MASK } from "../src/mask.js";
import { nextBusesNearOutput } from "../src/tools/nextBusesNear.js";
import { connectClient, errorOf } from "./helpers.js";

// Invented stops and times written into a temporary CURITIBAI_DATA_DIR/urbs/ at run time, in the real pontosLinha and
// tabelaLinha shapes; the lines file is the shared synthetic fixture (901, X91, 092, 903). No real URBS rows.
const FIXTURES = new URL("./fixtures/urbs_synthetic/", import.meta.url).pathname;
const CENTRE = { lat: -25.5, lon: -49.3 };
const M_PER_DEG_LAT = 111_195;
const north = (m: number) => CENTRE.lat + m / M_PER_DEG_LAT;
const east = (m: number) => CENTRE.lon + m / (M_PER_DEG_LAT * Math.cos((CENTRE.lat * Math.PI) / 180));
const coord = (n: number) => n.toFixed(12).replace(".", ",");

function stop(num: string, cod: string, sentido: string, lat: number, lon: number, extra: Record<string, unknown> = {}) {
  return {
    NOME: `Parada Fictícia ${num}`,
    NUM: num,
    LAT: coord(lat),
    LON: coord(lon),
    SEQ: "1",
    GRUPO: "",
    SENTIDO: sentido,
    TIPO: "Domus",
    ITINERARY_ID: `8${cod}`,
    COD: cod,
    ...extra,
  };
}

const stopRows = () => [
  // 100 m north: 901 in two directions, X91 in one.
  stop("990201", "901", "Terminal Imaginário", north(100), CENTRE.lon),
  stop("990201", "901", "Bairro Inventado", north(100), CENTRE.lon),
  stop("990201", "X91", "Centro Fictício", north(100), CENTRE.lon),
  // 300 m east: a name with an e-mail address, a line missing from the lines file.
  stop("990202", "777", "Vila Inexistente", CENTRE.lat, east(300), { NOME: "Praça Inventada - contato ficticio@example.invalid" }),
  // 200 m south, but the timetable never lists it.
  stop("990204", "092", "Água Imaginária", north(-200), CENTRE.lon),
  // 600 m north: outside the default 400 m.
  stop("990203", "903", "Bairro Inventado", north(600), CENTRE.lon),
  stop("991000", "903", "Bairro Inventado", north(50_000), CENTRE.lon),
];

function time(HORA: string, DIA: string, NUM: string, COD: string, TABELA = "1") {
  return { HORA, PONTO: `PARADA ${NUM}`, DIA, NUM, TABELA, ADAPT: "ELEVADOR", COD };
}

const timeRows = () => [
  time("08:20", "1", "990201", "901", "2"),
  time("08:05", "1", "990202", "777"),
  time("08:05", "1", "990201", "X91"),
  time("08:05", "1", "990201", "901"),
  time("07:59", "1", "990201", "901"), // before 08:00
  time("09:01", "1", "990201", "901"), // after 08:00 + 60
  time("09:00", "1", "990201", "901", "9"), // the window's last minute, inclusive
  time("08:30", "1", "990201", "x91"), // code in lower case
  time("08:10", "2", "990201", "901"), // Saturday
  time("08:40", "2", "990202", "901"), // a stop the stops file does not list for 901
  time("08:45", "2", "990202", "555"), // a line only in the timetable
  time("08:10", "3", "990201", "901"), // Sunday
  time("08:00", "1", "990203", "903"), // outside the radius
  time("23:59", "1", "990201", "901", "3"),
  time("00:00", "1", "990201", "901", "3"),
  time("00:00", "2", "990201", "901", "4"),
  time("00:20", "2", "990201", "901", "4"),
  time("00:00", "3", "990201", "901", "5"),
  time("23:55", "3", "990201", "901", "5"), // after its table's 00:00, so that 00:00 is Sunday's early trip
  // Friday night in table 7: 23:51 at a stop outside the radius, then the wrap past midnight at the nearby stop.
  time("23:51", "1", "990203", "901", "7"),
  time("00:03", "1", "990201", "901", "7"),
  time("00:35", "1", "990201", "901", "7"),
  // Saturday night in table 8: its 00:40 runs early on Sunday.
  time("23:40", "2", "990203", "901", "8"),
  time("00:40", "2", "990201", "901", "8"),
  time("25:00", "1", "990201", "901"), // invalid row: skipped and counted
  ...Array.from({ length: 20 }, (_, i) => time("12:00", "1", "991000", "903", String(i))),
];

let tmp: string;
beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-next-")));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T12:00:00Z")); // Friday 09:00 in Curitiba
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function dataDir({ times = "2026_11_20" as string | null, stops = "2026_11_20", lines = "2026_11_20", blank = false } = {}) {
  mkdirSync(join(tmp, "urbs"), { recursive: true });
  // blank: NOME and ADAPT empty in every row, as if URBS had renamed them.
  const t = blank ? timeRows().map((r) => ({ ...r, ADAPT: "" })) : timeRows();
  const p = blank ? stopRows().map((r) => ({ ...r, NOME: "" })) : stopRows();
  if (times !== null) writeFileSync(join(tmp, "urbs", `${times}_tabelaLinha.json`), JSON.stringify(t));
  writeFileSync(join(tmp, "urbs", `${stops}_pontosLinha.json`), JSON.stringify(p));
  copyFileSync(join(FIXTURES, "linhas.json"), join(tmp, "urbs", `${lines}_linhas.json`));
}

async function call(args: Record<string, unknown>) {
  vi.stubEnv(DATA_DIR_ENV, tmp);
  const client = await connectClient();
  return client.callTool({ name: "next_buses_near", arguments: args });
}

async function next(args: Record<string, unknown>) {
  const res = await call({ near: CENTRE, ...args });
  expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
  return nextBusesNearOutput.parse(res.structuredContent);
}

const brief = (items: { time: string; day: string; minutes_from_now: number; line_code: string; stop_number: string }[]) =>
  items.map((d) => `${d.day} ${d.time} +${d.minutes_from_now} ${d.line_code}@${d.stop_number}`);

describe("next_buses_near", () => {
  it("lists the departures in the window at nearby stops, soonest first, nearer stop first on a tie", async () => {
    dataDir();
    const out = await next({ at: "08:00", day: "1" });
    expect(brief(out.data.items)).toEqual([
      "1 08:05 +5 901@990201",
      "1 08:05 +5 X91@990201",
      "1 08:05 +5 777@990202",
      "1 08:20 +20 901@990201",
      "1 08:30 +30 x91@990201",
      "1 09:00 +60 901@990201",
    ]);
    expect(out.data.items[0]).toEqual({
      time: "08:05",
      day: "1",
      minutes_from_now: 5,
      line_code: "901",
      line_name: "VILA FICTÍCIA / JD. INVENTADO",
      directions: ["Bairro Inventado", "Terminal Imaginário"],
      stop_number: "990201",
      stop_name: "Parada Fictícia 990201",
      distance_m: 100,
      adapt: "ELEVADOR",
      after_midnight: false,
    });
    expect(out.data).toMatchObject({
      at: "08:00",
      day: "1",
      day_type: "weekday",
      day_inferred: false,
      windows: [{ day: "1", day_type: "weekday", from: "08:00", to: "09:00", after_midnight: false }],
      cut_at_midnight: false,
      stops_considered: 3,
      stops_with_times: 2,
      total: 6,
      skipped_rows: 1,
    });
    expect(out.checked_at).toBe("2026-11-20");
    expect(out.note).toContain("not real-time");
    expect(out.note).toContain("Confirm on the official channel before you go: https://www.urbs.curitiba.pr.gov.br/ (URBS) or the 156.");
    expect(out.note).not.toContain("was inferred from today's weekday");
    expect(out.note).toContain("Holidays are not detected");
    expect(out.note).toContain("1 row of the file did not match");
    expect(out.license_note).toContain("2026_11_20_tabelaLinha.json, 2026_11_20_pontosLinha.json and 2026_11_20_linhas.json");
    expect(out.license_note).toContain("CC BY 4.0");
  });

  it("masks the stop name; a line missing from the lines file has line_name null; directions from the stops file", async () => {
    dataDir();
    const items = (await next({ at: "08:00", day: "1" })).data.items;
    const far = items.find((d) => d.stop_number === "990202");
    expect(far).toMatchObject({ line_name: null, directions: ["Vila Inexistente"], distance_m: 300 });
    expect(far?.stop_name).toBe(`Praça Inventada - contato ${MASK}`);
    expect(items.find((d) => d.line_code === "X91")?.directions).toEqual(["Centro Fictício"]);
  });

  it("defaults: now in Curitiba and the day code of today's weekday, said to be inferred, holidays not detected", async () => {
    dataDir();
    const out = await next({ window_min: 180 }); // Friday 09:00 (12:00 UTC)
    expect(out.data).toMatchObject({ at: "09:00", day: "1", day_inferred: true, windows: [{ from: "09:00", to: "12:00" }] });
    expect(brief(out.data.items)).toEqual(["1 09:00 +0 901@990201", "1 09:01 +1 901@990201"]);
    expect(out.note).toContain("was inferred from today's weekday in Curitiba");
    expect(out.note).toContain("Holidays are not detected");
    vi.setSystemTime(new Date("2026-11-22T11:00:00Z")); // Sunday 08:00
    expect(brief((await next({ window_min: 15 })).data.items)).toEqual(["3 08:10 +10 901@990201"]);
  });

  it("past 24:00 reads the same service day's after-midnight trips and the next day's early ones (Friday into Saturday)", async () => {
    dataDir();
    vi.setSystemTime(new Date("2026-11-21T02:30:00Z")); // Saturday in UTC, Friday 23:30 in Curitiba
    const out = await next({});
    expect(out.data).toMatchObject({ at: "23:30", day: "1", day_inferred: true });
    expect(out.data.windows).toEqual([
      { day: "1", day_type: "weekday", from: "23:30", to: "23:59", after_midnight: false },
      { day: "1", day_type: "weekday", from: "00:00", to: "00:30", after_midnight: true },
      { day: "2", day_type: "saturday", from: "00:00", to: "00:30", after_midnight: false },
    ]);
    expect(out.data.cut_at_midnight).toBe(false);
    // 00:00 and 00:03 under code 1 follow 23:xx in their tables (the 23:51 at a stop outside the radius): Friday night.
    // 00:00 and 00:20 under code 2 open a table with no wrap: Saturday's early trips. 00:40 under 2 is Saturday night.
    expect(brief(out.data.items)).toEqual([
      "1 23:59 +29 901@990201",
      "1 00:00 +30 901@990201",
      "2 00:00 +30 901@990201",
      "1 00:03 +33 901@990201",
      "2 00:20 +50 901@990201",
    ]);
    expect(out.data.items.map((d) => d.after_midnight)).toEqual([false, true, false, true, false]);
    expect(out.note).toContain("under the day its service starts");
  });

  it("at 00:30 on Saturday reads Friday night's after-midnight trips, not Saturday night's", async () => {
    dataDir();
    vi.setSystemTime(new Date("2026-11-21T03:30:00Z")); // Saturday 00:30 in Curitiba
    const out = await next({});
    expect(out.data).toMatchObject({ at: "00:30", day: "2", day_inferred: true, cut_at_midnight: false });
    expect(out.data.windows).toEqual([
      { day: "1", day_type: "weekday", from: "00:30", to: "01:30", after_midnight: true },
      { day: "2", day_type: "saturday", from: "00:30", to: "01:30", after_midnight: false },
    ]);
    expect(brief(out.data.items)).toEqual(["1 00:35 +5 901@990201"]);
  });

  it("a table with no wrap keeps its 00:xx rows as that day's early trips (Sunday 00:00)", async () => {
    dataDir();
    vi.setSystemTime(new Date("2026-11-22T03:00:00Z")); // Sunday 00:00 in Curitiba
    const out = await next({});
    expect(out.data.windows.map((w) => `${w.day} ${w.from}-${w.to} ${w.after_midnight}`)).toEqual([
      "2 00:00-01:00 true",
      "3 00:00-01:00 false",
    ]);
    // Sunday's 00:00 (table 5, no wrap) and Saturday night's 00:40; not Saturday's own early 00:00 and 00:20.
    expect(brief(out.data.items)).toEqual(["3 00:00 +0 901@990201", "2 00:40 +40 901@990201"]);
    expect(out.data.items.map((d) => d.after_midnight)).toEqual([false, true]);
  });

  it("Sunday night into Monday: a window ending at 24:00 reads 00:00, and weekday night trips are not Monday's", async () => {
    dataDir();
    vi.setSystemTime(new Date("2026-11-23T02:50:00Z")); // Sunday 23:50
    const out = await next({ window_min: 10 });
    expect(out.data.windows.map((w) => `${w.day} ${w.from}-${w.to} ${w.after_midnight}`)).toEqual([
      "3 23:50-23:59 false",
      "3 00:00-00:00 true",
      "1 00:00-00:00 false",
    ]);
    expect(brief(out.data.items)).toEqual(["3 23:55 +5 901@990201"]);
  });

  it("an explicit day is the service day: its after-midnight trips are read, the next day's early trips are not", async () => {
    dataDir();
    const out = await next({ at: "23:30", day: "1" });
    expect(out.data).toMatchObject({
      cut_at_midnight: true,
      windows: [
        { day: "1", from: "23:30", to: "23:59", after_midnight: false },
        { day: "1", from: "00:00", to: "00:30", after_midnight: true },
      ],
    });
    expect(brief(out.data.items)).toEqual(["1 23:59 +29 901@990201", "1 00:00 +30 901@990201", "1 00:03 +33 901@990201"]);
    expect(out.note).toContain("`day` was given, so it is read as the service day");
    expect(out.note).not.toContain("call again with at 00:00");
    // Before 04:00 an explicit day reads both kinds of its rows, each labelled.
    const early = await next({ at: "00:30", day: "1" });
    expect(early.data.windows.map((w) => `${w.day} ${w.from}-${w.to} ${w.after_midnight}`)).toEqual([
      "1 00:30-01:30 true",
      "1 00:30-01:30 false",
    ]);
    expect(brief(early.data.items)).toEqual(["1 00:35 +5 901@990201"]);
  });

  it("line_code keeps one line (case ignored); an unknown code is invalid_argument", async () => {
    dataDir();
    const out = await next({ at: "08:00", day: "1", line_code: "x91" });
    expect(brief(out.data.items)).toEqual(["1 08:05 +5 X91@990201", "1 08:30 +30 x91@990201"]);
    expect(out.data).toMatchObject({ stops_considered: 3, stops_with_times: 1 });
    const unknown = errorOf(await call({ near: CENTRE, line_code: "404" })) as { error: string; message: string };
    expect(unknown).toMatchObject({ error: "invalid_argument" });
    expect(unknown.message).toContain("bus_lines_search");
  });

  it("line_code keeps a departure at a stop the stops file does not list for that line, with no directions", async () => {
    dataDir();
    const all = await next({ at: "08:00", day: "2" });
    const one = await next({ at: "08:00", day: "2", line_code: "901" });
    expect(brief(one.data.items)).toEqual(["2 08:10 +10 901@990201", "2 08:40 +40 901@990202"]);
    expect(brief(all.data.items)).toEqual([...brief(one.data.items), "2 08:45 +45 555@990202"]);
    expect(brief((await next({ at: "08:00", day: "2", line_code: "555" })).data.items)).toEqual(["2 08:45 +45 555@990202"]);
    expect(one.data.items[1]?.directions).toEqual([]);
    expect(one.data).toMatchObject({ stops_considered: 3, stops_with_times: 2 });
  });

  it("radius_m and limit; no stop nearby is an empty result, not an error", async () => {
    dataDir();
    const wide = await next({ at: "08:00", day: "1", radius_m: 1000, limit: 2 });
    expect(brief(wide.data.items)).toEqual(["1 08:00 +0 903@990203", "1 08:05 +5 901@990201"]);
    expect(wide.data.total).toBe(7);
    const none = await next({ at: "08:00", day: "1", radius_m: 50 });
    expect(none.data).toMatchObject({ stops_considered: 0, stops_with_times: 0, total: 0, items: [] });
  });

  it("names the stops and lines files in the note when their dates differ", async () => {
    dataDir({ stops: "2026_11_19", lines: "2026_11_18" });
    const out = await next({ at: "08:00", day: "1" });
    expect(out.checked_at).toBe("2026-11-20");
    expect(out.note).toContain("2026_11_19_pontosLinha.json (dated 2026-11-19)");
    expect(out.note).toContain("2026_11_18_linhas.json (dated 2026-11-18)");
  });

  it("says when NOME or ADAPT look missing or renamed (every row empty)", async () => {
    dataDir({ blank: true });
    const out = await next({ at: "08:00", day: "1" });
    expect(out.data.items[0]).toMatchObject({ stop_name: "", adapt: "" });
    expect(out.note).toContain("Every valid row of 2026_11_20_pontosLinha.json has an empty NOME field");
    expect(out.note).toContain("an empty `stop_name` may not come from URBS");
    expect(out.note).toContain("an empty `adapt` does not mean the bus has no accessibility equipment");
  });

  it("validates its input", async () => {
    dataDir();
    expect((await call({})).isError).toBe(true);
    expect((await call({ near: CENTRE, radius_m: 1001 })).isError).toBe(true);
    expect((await call({ near: CENTRE, window_min: 181 })).isError).toBe(true);
    expect((await call({ near: CENTRE, window_min: 0 })).isError).toBe(true);
    expect((await call({ near: CENTRE, at: "24:00" })).isError).toBe(true);
    expect((await call({ near: CENTRE, at: "8:00" })).isError).toBe(true);
    expect((await call({ near: CENTRE, day: "x" })).isError).toBe(true);
    expect((await call({ near: CENTRE, limit: 51 })).isError).toBe(true);
    expect((await next({ radius_m: 1000, window_min: 180, limit: 50 })).data.windows).toHaveLength(1);
  });

  it("data_not_available without the timetable file", async () => {
    dataDir({ times: null });
    const missing = errorOf(await call({ near: CENTRE })) as { error: string; message: string };
    expect(missing).toMatchObject({ error: "data_not_available" });
    expect(missing.message).toContain("tabelaLinha");
  });
});
