import { z } from "zod";
import { DAY_TYPE_NOTE, DAY_TYPES, URBS_SOURCE_URL, type Tabela } from "../sources/urbs.js";
import { busEnvelope, isFailure, lineCodeInput, loadUrbsOrFail, page, pagingInput, urbsLicenseNote, urbsNote } from "./busCommon.js";
import { guardedSummary } from "./cityServicesSearch.js";
import { fail, ok, type ToolDef } from "./common.js";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

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
});

export const busDeparturesOutput = busEnvelope(
  z.object({
    total: z.number().int(),
    offset: z.number().int(),
    next_offset: z.number().int().nullable(),
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

export function busDeparturesResult(rows: readonly Tabela[], file: string, date: string, args: BusDeparturesArgs, now: Date) {
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
      items: p.items.map((r) => ({
        time: r.HORA,
        day: r.DIA,
        day_type: DAY_TYPES[r.DIA] ?? null,
        line_code: r.COD,
        stop_number: r.NUM,
        stop_name: guardedSummary(r.PONTO),
        table: r.TABELA,
        adapt: r.ADAPT,
      })),
    },
    source_url: URBS_SOURCE_URL,
    checked_at: date,
    license_note: urbsLicenseNote(file),
    note:
      `${urbsNote(file, date, now)} ${DAY_TYPE_NOTE} Times are as published, only for the stops URBS lists ` +
      "in the timetable (not every stop of a line). `table` is URBS's TABELA (the vehicle schedule) and `adapt` its ADAPT field " +
      "(the accessibility equipment), both as published.",
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
    return ok(busDeparturesResult(loaded.rows, loaded.file, loaded.date, args, new Date()));
  },
};
