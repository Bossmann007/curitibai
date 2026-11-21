import { z } from "zod";
import { DAY_TYPE_NOTE, DAY_TYPES, URBS_SOURCE_URL, type Tabela } from "../sources/urbs.js";
import { BUS_CONFIRM_NOTE, busEnvelope, isFailure, lineCodeInput, loadUrbsOrFail, page, pagingInput, urbsLicenseNote, skippedRowsOutput, urbsNote, type UrbsSource } from "./busCommon.js";
import { guardedSummary } from "./cityServicesSearch.js";
import { fail, ok, type ToolDef } from "./common.js";

export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes after midnight before which a row can be the previous evening's service (04:00). */
export const NIGHT_END_MIN = 4 * 60;
/** A drop in a table's times is a wrap past midnight only when the time before it is at or after this (20:00). */
export const NIGHT_START_MIN = 20 * 60;

/**
 * The rows that run after midnight but belong to the evening before: URBS files a late-night trip under the day its
 * service starts, at the end of that day's table. A row before 04:00 is one when, in the file's order, its table
 * (same COD, DIA and TABELA, any stop) has already wrapped past midnight: a time at or after 20:00 followed by one
 * before 04:00. Any other drop (12:00 then 03:00) is not a wrap. Rows at or after 04:00 are never marked, even after
 * a wrap. Pass the whole file, in file order, before any filter: the row that proves the wrap may be at another stop.
 */
export function afterMidnightRows(rows: readonly Tabela[]): Set<Tabela> {
  const last = new Map<string, number>();
  const wrapped = new Set<string>();
  const out = new Set<Tabela>();
  for (const r of rows) {
    const key = `${r.COD}\u0000${r.DIA}\u0000${r.TABELA}`;
    const t = Number(r.HORA.slice(0, 2)) * 60 + Number(r.HORA.slice(3, 5));
    const prev = last.get(key);
    if (prev !== undefined && prev >= NIGHT_START_MIN && t < NIGHT_END_MIN) wrapped.add(key);
    if (t < NIGHT_END_MIN && wrapped.has(key)) out.add(r);
    last.set(key, t);
  }
  return out;
}

/** How times after midnight are filed (checked on the 2026-11-20 file) and how this server reads them. */
export const MIDNIGHT_NOTE =
  "Times are as published: HH:MM from 00:00 to 23:59, each under its row's DIA code, never moved. URBS files a " +
  "late-night trip under the day its service starts, at the end of that day's table: in the 2026-11-20 file 677 " +
  "tables (same line, DIA and TABELA, in file order) run from 23:xx on to 00:xx. A wrap is a time at or after 20:00 " +
  "followed by one before 04:00 in the same table. A row before 04:00 that comes after such a wrap in its table, at " +
  "any stop, has `after_midnight` true: it runs after midnight, on the calendar day after " +
  "a day of its code (a 00:03 under 1 on a Friday runs early on Saturday). Other rows before 04:00 have " +
  "`after_midnight` false and are read as early trips of their own code's day; the file does not say so, so that " +
  "reading is not verified.";

export const busDeparturesInput = {
  line_code: lineCodeInput.optional(),
  stop_number: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/)
    .optional()
    .describe("URBS stop number (`stop_number` from bus_line_stops). Give it, line_code, or both."),
  day: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/)
    .optional()
    .describe('URBS day code: "1" weekday, "2" Saturday, "3" Sunday or holiday (this reading is inferred, see note).'),
  from: z.string().regex(TIME).optional().describe("Earliest time, HH:MM (inclusive)."),
  to: z.string().regex(TIME).optional().describe("Latest time, HH:MM (inclusive)."),
  ...pagingInput,
};

const Departure = z.object({
  time: z.string(),
  day: z.string(),
  day_type: z.string().nullable(),
  line_code: z.string(),
  stop_number: z.string(),
  stop_name: z.string(),
  table: z.string(),
  adapt: z.string(),
  after_midnight: z
    .boolean()
    .describe("True when the row continues the previous evening's service of its day code past midnight (see note)."),
});

export const busDeparturesOutput = busEnvelope(
  z.object({
    total: z.number().int(),
    offset: z.number().int(),
    next_offset: z.number().int().nullable(),
    skipped_rows: skippedRowsOutput,
    items: z.array(Departure),
  }),
);

export interface BusDeparturesArgs {
  line_code?: string | undefined;
  stop_number?: string | undefined;
  day?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit: number;
  offset: number;
}

export function busDeparturesResult(rows: readonly Tabela[], src: UrbsSource, args: BusDeparturesArgs, now: Date) {
  const night = afterMidnightRows(rows);
  const line = args.line_code?.trim().toUpperCase();
  const matches = rows.filter(
    (r) =>
      (line === undefined || r.COD.toUpperCase() === line) &&
      (args.stop_number === undefined || r.NUM === args.stop_number) &&
      (args.day === undefined || r.DIA === args.day) &&
      (args.from === undefined || r.HORA >= args.from) &&
      (args.to === undefined || r.HORA <= args.to),
  );
  // Day, time, line, stop, table: a stable order for paging. "HH:MM" strings sort as times.
  matches.sort(
    (a, b) =>
      Number(a.DIA) - Number(b.DIA) ||
      a.HORA.localeCompare(b.HORA) ||
      a.COD.localeCompare(b.COD) ||
      Number(a.NUM) - Number(b.NUM) ||
      a.TABELA.localeCompare(b.TABELA),
  );
  const p = page(matches, args.offset, args.limit);
  return {
    data: {
      ...p,
      skipped_rows: src.skipped,
      items: p.items.map((r) => ({
        time: r.HORA,
        day: r.DIA,
        day_type: DAY_TYPES[r.DIA] ?? null,
        line_code: r.COD,
        stop_number: r.NUM,
        stop_name: guardedSummary(r.PONTO),
        table: r.TABELA,
        adapt: r.ADAPT,
        after_midnight: night.has(r),
      })),
    },
    source_url: URBS_SOURCE_URL,
    checked_at: src.date,
    license_note: urbsLicenseNote(src.file),
    note:
      `${urbsNote(src, now)} ${DAY_TYPE_NOTE} ${MIDNIGHT_NOTE} \`from\`/\`to\` compare HH:MM and never wrap past midnight. Times exist only for the stops URBS lists in the ` +
      "timetable (not every stop of a line). `table` is URBS's TABELA (the vehicle schedule) and `adapt` its ADAPT field " +
      `(the accessibility equipment), both as published. ${BUS_CONFIRM_NOTE}`,
  };
}

export const busDepartures: ToolDef<typeof busDeparturesInput, typeof busDeparturesOutput> = {
  name: "bus_departures",
  title: "Curitiba bus timetables (URBS, local file)",
  description:
    "Published departure times of Curitiba buses (URBS) by line code and/or stop number, optionally for one day type " +
    "and a time window: time, day code, stop, schedule table and accessibility equipment. Not real-time. Reads the " +
    "newest YYYY_MM_DD_tabelaLinha.json the user downloaded into CURITIBAI_DATA_DIR/urbs/; no network call. Read-only.",
  inputSchema: busDeparturesInput,
  outputSchema: busDeparturesOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    if (args.line_code === undefined && args.stop_number === undefined) {
      return fail("invalid_argument", "Give line_code, stop_number or both.");
    }
    if (args.from !== undefined && args.to !== undefined && args.from > args.to) {
      return fail("invalid_argument", "from must not be later than to (a window past midnight needs two calls).");
    }
    const loaded = await loadUrbsOrFail("tabelaLinha");
    if (isFailure(loaded)) return loaded;
    return ok(busDeparturesResult(loaded.rows, loaded, args, new Date()));
  },
};
