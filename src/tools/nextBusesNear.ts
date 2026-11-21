import { z } from "zod";
import { DAY_TYPE_NOTE, DAY_TYPES, URBS_SOURCE_URL, type Linha, type Ponto, type Tabela } from "../sources/urbs.js";
import {
  busEnvelope,
  isFailure,
  lineCodeInput,
  loadUrbsOrFail,
  skippedNote,
  skippedRowsOutput,
  urbsLicenseNote,
  urbsNote,
  type UrbsSource,
} from "./busCommon.js";
import { afterMidnightRows, NIGHT_END_MIN, TIME } from "./busDepartures.js";
import { NEAR_RADIUS_DEFAULT_M, stopsWithin, type Stop } from "./busStopsNear.js";
import { guardedSummary } from "./cityServicesSearch.js";
import { fail, ok, type ToolDef } from "./common.js";

export const NEXT_RADIUS_MAX_M = 1000;
export const WINDOW_DEFAULT_MIN = 60;
export const WINDOW_MAX_MIN = 180;
const DAY_MIN = 24 * 60;

export const nextBusesNearInput = {
  near: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .describe("The position to search around, in decimal degrees."),
  radius_m: z
    .number()
    .int()
    .min(1)
    .max(NEXT_RADIUS_MAX_M)
    .default(NEAR_RADIUS_DEFAULT_M)
    .describe(`Search radius in metres (default ${NEAR_RADIUS_DEFAULT_M}, at most ${NEXT_RADIUS_MAX_M}).`),
  at: z
    .string()
    .regex(TIME)
    .optional()
    .describe(
      "Start of the window, HH:MM (default: now in Curitiba, America/Sao_Paulo). Before 04:00 with `day` inferred, " +
        "the previous evening's after-midnight trips are read too.",
    ),
  day: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/)
    .optional()
    .describe(
      'URBS day code: "1" weekday, "2" Saturday, "3" Sunday or holiday (inferred reading). Default: from today\'s ' +
        "weekday in Curitiba. Holidays are not detected: on one, pass the code URBS announces. When given, it is read " +
        "as the service day: its own after-midnight trips are included, the next day's early trips are not.",
    ),
  window_min: z
    .number()
    .int()
    .min(1)
    .max(WINDOW_MAX_MIN)
    .default(WINDOW_DEFAULT_MIN)
    .describe(`Minutes after \`at\` to look ahead (default ${WINDOW_DEFAULT_MIN}, at most ${WINDOW_MAX_MIN}).`),
  line_code: lineCodeInput.optional().describe("Only this line (code as in bus_lines_search; case ignored)."),
  limit: z.number().int().min(1).max(50).default(20),
};

const Window = z.object({
  day: z.string(),
  day_type: z.string().nullable(),
  from: z.string(),
  to: z.string(),
  after_midnight: z
    .boolean()
    .describe("True: this part reads only the rows that continue that code's evening past midnight; false: only the others."),
});

const NextDeparture = z.object({
  time: z.string(),
  day: z.string(),
  minutes_from_now: z.number().int(),
  line_code: z.string(),
  line_name: z.string().nullable(),
  directions: z.array(z.string()),
  stop_number: z.string(),
  stop_name: z.string(),
  distance_m: z.number().int(),
  adapt: z.string(),
  after_midnight: z
    .boolean()
    .describe("True when the trip continues the previous evening's service of its day code past midnight (see note)."),
});

export const nextBusesNearOutput = busEnvelope(
  z.object({
    at: z.string(),
    day: z.string(),
    day_type: z.string().nullable(),
    day_inferred: z.boolean().describe("True when `day` came from today's weekday, not from the input."),
    windows: z
      .array(Window)
      .describe("The (day code, time range, after-midnight rows or not) parts searched: several around midnight."),
    cut_at_midnight: z
      .boolean()
      .describe(
        "True when the window passes 24:00 but `day` was given: that day's after-midnight trips are read, the next " +
          "calendar day's early-morning trips are not (see note).",
      ),
    stops_considered: z.number().int().describe("Stops with coordinates within radius_m (any line)."),
    stops_with_times: z
      .number()
      .int()
      .describe("Of those, stops the timetable lists at any day and time (for line_code, when given)."),
    total: z.number().int().describe("Departures in the windows, before `limit`."),
    skipped_rows: skippedRowsOutput,
    items: z.array(NextDeparture),
  }),
);

export interface NextBusesNearArgs {
  near: { lat: number; lon: number };
  radius_m: number;
  at?: string | undefined;
  day?: string | undefined;
  window_min: number;
  line_code?: string | undefined;
  limit: number;
}

/** Day code for a weekday (0 Sunday … 6 Saturday), as this server reads the DIA codes (inferred, see DAY_TYPE_NOTE). */
const dayCodeOf = (weekday: number) => (weekday === 0 ? "3" : weekday === 6 ? "2" : "1");

const CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday (0 Sunday … 6 Saturday) and HH:MM of `now` in Curitiba. */
export function clockInCuritiba(now: Date): { weekday: number; time: string } {
  const parts = Object.fromEntries(CLOCK.formatToParts(now).map((p) => [p.type, p.value]));
  return { weekday: WEEKDAYS.indexOf(parts.weekday ?? ""), time: `${parts.hour}:${parts.minute}` };
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

interface Segment {
  day: string;
  from: number;
  to: number;
  /** Added to a time's minutes to count from `at`: 0 today, 1440 after midnight. */
  shift: number;
  /** Reads only the rows that continue their code's evening past midnight (afterMidnightRows), or only the others. */
  night: boolean;
}

export function nextBusesNearResult(
  files: { stops: readonly Ponto[]; times: readonly Tabela[]; lines: readonly Linha[] },
  src: { stops: UrbsSource; times: UrbsSource; lines: UrbsSource },
  args: NextBusesNearArgs,
  now: Date,
) {
  const clock = clockInCuritiba(now);
  const at = args.at ?? clock.time;
  const dayInferred = args.day === undefined;
  const day = args.day ?? dayCodeOf(clock.weekday);
  const start = minutes(at);
  const end = start + args.window_min;
  // URBS files a late-night trip under the day its service starts (afterMidnightRows). Up to 24:00 the window reads
  // `day`; past it, `day`'s after-midnight rows and, when `day` was inferred, the next day's other rows. Before 04:00
  // with `day` inferred, the previous day's after-midnight rows come first. An explicit `day` is the service day.
  const crosses = end >= DAY_MIN;
  const segments: Segment[] = [];
  if (start < NIGHT_END_MIN) {
    const night = dayInferred ? dayCodeOf((clock.weekday + 6) % 7) : day;
    segments.push({ day: night, from: start, to: end, shift: 0, night: true }, { day, from: start, to: end, shift: 0, night: false });
  } else {
    segments.push({ day, from: start, to: Math.min(end, DAY_MIN - 1), shift: 0, night: false });
    if (crosses) {
      segments.push({ day, from: 0, to: end - DAY_MIN, shift: DAY_MIN, night: true });
      if (dayInferred) {
        segments.push({ day: dayCodeOf((clock.weekday + 1) % 7), from: 0, to: end - DAY_MIN, shift: DAY_MIN, night: false });
      }
    }
  }

  const wanted = args.line_code?.trim().toUpperCase();
  // Every stop in the radius, whatever line_code: the timetable can list a line at a stop the stops file does not.
  const nearby = new Map(stopsWithin(files.stops, args.near, args.radius_m).map((m) => [m.stop.row.NUM, m]));

  // One pass over the timetable, stop number first: only rows at a nearby stop are looked at further.
  const night = afterMidnightRows(files.times);
  const timed = new Set<string>();
  const hits: { r: Tabela; at: { stop: Stop; distance: number }; m: number }[] = [];
  for (const r of files.times) {
    const hit = nearby.get(r.NUM);
    if (hit === undefined) continue;
    if (wanted !== undefined && r.COD.toUpperCase() !== wanted) continue;
    timed.add(r.NUM);
    const t = minutes(r.HORA);
    const isNight = night.has(r);
    for (const s of segments) {
      if (r.DIA === s.day && s.night === isNight && t >= s.from && t <= s.to) {
        hits.push({ r, at: hit, m: t + s.shift - start });
      }
    }
  }
  hits.sort(
    (a, b) =>
      a.m - b.m ||
      a.at.distance - b.at.distance ||
      a.r.COD.localeCompare(b.r.COD) ||
      Number(a.r.NUM) - Number(b.r.NUM) ||
      a.r.TABELA.localeCompare(b.r.TABELA),
  );

  const names = new Map(files.lines.map((l) => [l.COD.toUpperCase(), l.NOME]));
  const directions = (stop: Stop, cod: string) =>
    [...new Set([...stop.lines.values()].filter((l) => l.cod.toUpperCase() === cod).map((l) => l.sentido))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  const otherFile = (s: UrbsSource, what: string) =>
    (s.date === src.times.date ? "" : ` ${what} come from ${s.file} (dated ${s.date}), a different date from the timetable: compare before relying on them.`) +
    skippedNote(s.skipped, s.file);
  const stopNames = src.stops.emptyFields.includes("NOME")
    ? ` Every valid row of ${src.stops.file} has an empty NOME field, which real URBS exports fill: the field looks ` +
      "missing or renamed in this file, so an empty `stop_name` may not come from URBS."
    : "";

  return {
    data: {
      at,
      day,
      day_type: DAY_TYPES[day] ?? null,
      day_inferred: dayInferred,
      windows: segments.map((s) => ({
        day: s.day,
        day_type: DAY_TYPES[s.day] ?? null,
        from: hhmm(s.from),
        to: hhmm(s.to),
        after_midnight: s.night,
      })),
      cut_at_midnight: crosses && !dayInferred,
      stops_considered: nearby.size,
      stops_with_times: timed.size,
      total: hits.length,
      skipped_rows: src.times.skipped,
      items: hits.slice(0, args.limit).map(({ r, at: { stop, distance }, m }) => ({
        time: r.HORA,
        day: r.DIA,
        minutes_from_now: m,
        line_code: r.COD,
        line_name: names.get(r.COD.toUpperCase()) ?? null,
        directions: directions(stop, r.COD.toUpperCase()),
        stop_number: r.NUM,
        stop_name: guardedSummary(stop.row.NOME),
        distance_m: distance,
        adapt: r.ADAPT,
        after_midnight: night.has(r),
      })),
    },
    source_url: URBS_SOURCE_URL,
    checked_at: src.times.date,
    license_note: urbsLicenseNote(src.times.file, src.stops.file, src.lines.file),
    note:
      `${urbsNote({ ...src.times, emptyFields: src.times.emptyFields.filter((f) => f === "ADAPT") }, now)} ` +
      "Timetable as published, not real-time: a bus can be early, late or not run. " +
      (dayInferred
        ? "`day` was inferred from today's weekday in Curitiba (America/Sao_Paulo): Monday to Friday 1, Saturday 2, " +
          "Sunday 3. "
        : "") +
      "Holidays are not detected: on a holiday pass the day code URBS announces (usually 3). " +
      `${DAY_TYPE_NOTE} ` +
      "`minutes_from_now` counts from `at` (HH:MM, seconds ignored), not from the moment of the call when `at` is given. " +
      "Times are as published under their row's day code and never moved, as in bus_departures. URBS files a " +
      "late-night trip under the day its service starts, at the end of that day's table: a row before 04:00 that comes " +
      "after its table (same line, code and TABELA) has run from 23:xx on to 00:xx is `after_midnight` (checked on the " +
      "2026-11-20 file; other rows before 04:00 are read as early trips of their own code's day, not verified). So a " +
      "window past 24:00 reads that day's after-midnight trips and the next calendar day's early trips, and a window " +
      "starting before 04:00 reads the previous day's after-midnight trips and today's early ones (`windows` lists " +
      "each part). " +
      (dayInferred
        ? ""
        : "`day` was given, so it is read as the service day: its after-midnight trips are included and, when the " +
          "window passes 24:00, the next calendar day's early trips are not (`cut_at_midnight`); before 04:00 both its " +
          "after-midnight and its early rows are read, each labelled by `after_midnight`. ") +
      "URBS publishes times only at some stops of each line (timing points, often terminals and tube stations), so " +
      "`stops_with_times` can be far below `stops_considered` and a stop with no times here may still be served: widen " +
      "radius_m or use bus_stops_near. The timetable has no direction field: `directions` lists every SENTIDO the stops " +
      "file gives for that line at that stop (several at terminals; empty when the stops file does not list the line " +
      "there). The same bus can appear at more than one nearby stop. `stop_name` (masked as a guard), `distance_m` " +
      "(straight line, not walking) and `directions` come from the stops file, `line_name` from the lines file (null " +
      "when the code is not there), `adapt` is ADAPT (accessibility equipment) as published." +
      otherFile(src.stops, "Stops and positions") +
      otherFile(src.lines, "Line names") +
      stopNames,
  };
}

export const nextBusesNear: ToolDef<typeof nextBusesNearInput, typeof nextBusesNearOutput> = {
  name: "next_buses_near",
  title: "Next Curitiba buses near a position (URBS timetable, local files)",
  description:
    "\"Next buses near me\" in one call: published departures in the next window_min minutes (default 60, at most " +
    "180) after `at` (default now in Curitiba) at the URBS stops within radius_m (default 400 m, at most 1000), " +
    "soonest first: time, minutes from now, line code and name, directions, stop, distance and accessibility " +
    "equipment. `directions` is a list: the timetable has no direction field, so it gives every SENTIDO the stops " +
    "file lists for that line at that stop (most timetable stops are served in both directions). Day code from today's weekday unless given (holidays not detected). Timetable as published, not " +
    "real-time. Reads the newest YYYY_MM_DD_tabelaLinha.json, pontosLinha.json and linhas.json the user downloaded " +
    "into CURITIBAI_DATA_DIR/urbs/; no network call. Read-only.",
  inputSchema: nextBusesNearInput,
  outputSchema: nextBusesNearOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    const [times, stops, lines] = await Promise.all([
      loadUrbsOrFail("tabelaLinha"),
      loadUrbsOrFail("pontosLinha"),
      loadUrbsOrFail("linhas"),
    ]);
    if (isFailure(times)) return times;
    if (isFailure(stops)) return stops;
    if (isFailure(lines)) return lines;
    const wanted = args.line_code?.trim().toUpperCase();
    const has = (r: { COD: string }) => r.COD.toUpperCase() === wanted;
    if (wanted !== undefined && !stops.rows.some(has) && !times.rows.some(has)) {
      return fail(
        "invalid_argument",
        `line_code is in neither ${stops.file} nor ${times.file}; find the code with bus_lines_search.`,
      );
    }
    return ok(
      nextBusesNearResult(
        { stops: stops.rows, times: times.rows, lines: lines.rows },
        { stops, times, lines },
        args,
        new Date(),
      ),
    );
  },
};
