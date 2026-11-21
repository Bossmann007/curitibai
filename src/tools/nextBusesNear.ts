import { z } from "zod";
import { DAY_TYPE_NOTE, DAY_TYPES, URBS_SOURCE_URL, type Linha, type Ponto, type Tabela } from "../sources/urbs.js";
import {
  busEnvelope,
  emptyFieldsNote,
  isFailure,
  lineCodeInput,
  loadUrbsOrFail,
  skippedRowsOutput,
  urbsLicenseNote,
  urbsNote,
  type UrbsSource,
} from "./busCommon.js";
import { TIME } from "./busDepartures.js";
import { lineStops } from "./busLineStops.js";
import { groupStops, NEAR_RADIUS_DEFAULT_M, type Stop } from "./busStopsNear.js";
import { distanceM } from "./cityPointsSearch.js";
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
    .describe("Start of the window, HH:MM on today's date in Curitiba (default: now, America/Sao_Paulo)."),
  day: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/)
    .optional()
    .describe(
      'URBS day code: "1" weekday, "2" Saturday, "3" Sunday or holiday (inferred reading). Default: from today\'s ' +
        "weekday in Curitiba. Holidays are not detected: on one, pass the code URBS announces.",
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

const Window = z.object({ day: z.string(), day_type: z.string().nullable(), from: z.string(), to: z.string() });

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
});

export const nextBusesNearOutput = busEnvelope(
  z.object({
    at: z.string(),
    day: z.string(),
    day_type: z.string().nullable(),
    day_inferred: z.boolean().describe("True when `day` came from today's weekday, not from the input."),
    windows: z.array(Window).describe("The (day code, time range) pairs searched: two when the window passes 24:00."),
    cut_at_midnight: z
      .boolean()
      .describe("True when the window would pass 24:00 but `day` was given, so it stops at 23:59 (see note)."),
    stops_considered: z.number().int().describe("Stops with coordinates within radius_m (of line_code, when given)."),
    stops_with_times: z.number().int().describe("Of those, stops the timetable file lists at all (any day, any time)."),
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
  const segments: Segment[] = [{ day, from: start, to: Math.min(end, DAY_MIN - 1), shift: 0 }];
  // Past 24:00 the times belong to the next calendar day, read under that day's code (never moved between codes, as
  // in bus_departures). With an explicit `day` that code is unknown, so the window stops at 23:59.
  const crosses = end >= DAY_MIN;
  if (crosses && dayInferred) {
    segments.push({ day: dayCodeOf((clock.weekday + 1) % 7), from: 0, to: end - DAY_MIN, shift: DAY_MIN });
  }

  const wanted = args.line_code?.trim().toUpperCase();
  const nearby = new Map<string, { stop: Stop; distance: number }>();
  for (const stop of groupStops(files.stops).values()) {
    if (wanted !== undefined && ![...stop.lines.values()].some((l) => l.cod.toUpperCase() === wanted)) continue;
    const exact = distanceM(args.near, stop);
    if (exact <= args.radius_m) nearby.set(stop.row.NUM, { stop, distance: Math.round(exact) });
  }

  // One pass over the timetable, stop number first: only rows at a nearby stop are looked at further.
  const timed = new Set<string>();
  const hits: { r: Tabela; at: { stop: Stop; distance: number }; m: number }[] = [];
  for (const r of files.times) {
    const hit = nearby.get(r.NUM);
    if (hit === undefined) continue;
    timed.add(r.NUM);
    if (wanted !== undefined && r.COD.toUpperCase() !== wanted) continue;
    const t = minutes(r.HORA);
    for (const s of segments) {
      if (r.DIA === s.day && t >= s.from && t <= s.to) hits.push({ r, at: hit, m: t + s.shift - start });
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
    (s.skipped > 0
      ? ` ${s.skipped} row${s.skipped === 1 ? "" : "s"} of ${s.file} did not match the expected shape and ${s.skipped === 1 ? "was" : "were"} left out.`
      : "");
  const stopNames = emptyFieldsNote(src.stops.emptyFields.filter((f) => f === "NOME"));

  return {
    data: {
      at,
      day,
      day_type: DAY_TYPES[day] ?? null,
      day_inferred: dayInferred,
      windows: segments.map((s) => ({ day: s.day, day_type: DAY_TYPES[s.day] ?? null, from: hhmm(s.from), to: hhmm(s.to) })),
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
          "Sunday 3. Holidays are not detected: on a holiday pass the day code URBS announces (usually 3). "
        : "") +
      `${DAY_TYPE_NOTE} ` +
      "`minutes_from_now` counts from `at` (HH:MM, seconds ignored), not from the moment of the call when `at` is given. " +
      "Times are as published under their row's day code and never moved, as in bus_departures. When the window passes " +
      "24:00, the times from 00:00 on are read under the next calendar day's code, inferred the same way (`windows` " +
      "shows both parts), and counted past midnight; with an explicit `day` the next day's code is unknown, so the " +
      "window stops at 23:59 (`cut_at_midnight`): call again with at 00:00 and that day's code. Whether URBS files a " +
      "late-night trip under the day it starts or the calendar day of the time is not verified. " +
      "URBS publishes times only at some stops of each line (timing points, often terminals and tube stations), so " +
      "`stops_with_times` can be far below `stops_considered` and a stop with no times here may still be served: widen " +
      "radius_m or use bus_stops_near. The timetable has no direction field: `directions` lists every SENTIDO the stops " +
      "file gives for that line at that stop (several at terminals; empty when the stops file does not list the line " +
      "there). The same bus can appear at more than one nearby stop. `stop_name` (masked as a guard), `distance_m` " +
      "(straight line, not walking) and `directions` come from the stops file, `line_name` from the lines file (null " +
      "when the code is not there), `adapt` is ADAPT (accessibility equipment) as published." +
      otherFile(src.stops, "Stops and positions") +
      otherFile(src.lines, "Line names") +
      (stopNames ? ` In ${src.stops.file}: ${stopNames}` : ""),
  };
}

export const nextBusesNear: ToolDef<typeof nextBusesNearInput, typeof nextBusesNearOutput> = {
  name: "next_buses_near",
  title: "Next Curitiba buses near a position (URBS timetable, local files)",
  description:
    "\"Next buses near me\" in one call: published departures in the next window_min minutes (default 60, at most " +
    "180) after `at` (default now in Curitiba) at the URBS stops within radius_m (default 400 m, at most 1000), " +
    "soonest first: time, minutes from now, line code and name, directions, stop, distance and accessibility " +
    "equipment. Day code from today's weekday unless given (holidays not detected). Timetable as published, not " +
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
    if (args.line_code !== undefined && lineStops(stops.rows, args.line_code).length === 0) {
      return fail("invalid_argument", `line_code has no stops in ${stops.file}; find the code with bus_lines_search.`);
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
