import { z } from "zod";
import { parseCoordinate, URBS_SOURCE_URL, type Ponto } from "../sources/urbs.js";
import { busEnvelope, isFailure, lineCodeInput, loadUrbsOrFail, page, urbsLicenseNote, urbsNote, type UrbsSource } from "./busCommon.js";
import { guardedSummary } from "./cityServicesSearch.js";
import { fail, ok, type ToolDef } from "./common.js";

export const busLineStopsInput = {
  line_code: lineCodeInput,
  itinerary_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{1,20}$/)
    .optional()
    .describe("Only this direction (an itinerary_id from `directions`)."),
  limit: z.number().int().min(1).max(50).default(50),
  offset: z.number().int().min(0).max(1_000_000).default(0).describe("Stops to skip, for paging."),
};

const Stop = z.object({
  direction: z.string(),
  itinerary_id: z.string(),
  seq: z.number().int(),
  stop_number: z.string(),
  name: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  type: z.string(),
  group: z.string(),
});

export const busLineStopsOutput = busEnvelope(
  z.object({
    line_code: z.string(),
    directions: z.array(z.object({ direction: z.string(), itinerary_id: z.string(), stop_count: z.number().int() })),
    total: z.number().int(),
    offset: z.number().int(),
    next_offset: z.number().int().nullable(),
    items: z.array(Stop),
  }),
);

export interface BusLineStopsArgs {
  line_code: string;
  itinerary_id?: string | undefined;
  limit: number;
  offset: number;
}

const byNumber = (a: string, b: string) => Number(a) - Number(b) || a.localeCompare(b);

/** The line's itineraries (direction + id), ordered by direction name then id. */
function directions(rows: readonly Ponto[]) {
  const map = new Map<string, { direction: string; itinerary_id: string; stop_count: number }>();
  for (const r of rows) {
    const d = map.get(r.ITINERARY_ID) ?? { direction: r.SENTIDO, itinerary_id: r.ITINERARY_ID, stop_count: 0 };
    d.stop_count += 1;
    map.set(r.ITINERARY_ID, d);
  }
  return [...map.values()].sort(
    (a, b) => a.direction.localeCompare(b.direction, "pt-BR") || byNumber(a.itinerary_id, b.itinerary_id),
  );
}

/** Rows of one line (code compared case-insensitively). */
export function lineStops(rows: readonly Ponto[], lineCode: string): Ponto[] {
  const wanted = lineCode.trim().toUpperCase();
  return rows.filter((r) => r.COD.toUpperCase() === wanted);
}

export function busLineStopsResult(line: readonly Ponto[], src: UrbsSource, args: BusLineStopsArgs, now: Date) {
  const dirs = directions(line);
  const order = new Map(dirs.map((d, i) => [d.itinerary_id, i]));
  const selected = line
    .filter((r) => args.itinerary_id === undefined || r.ITINERARY_ID === args.itinerary_id)
    .sort((a, b) => order.get(a.ITINERARY_ID)! - order.get(b.ITINERARY_ID)! || Number(a.SEQ) - Number(b.SEQ));
  const p = page(selected, args.offset, args.limit);
  return {
    data: {
      line_code: line[0]?.COD ?? args.line_code.toUpperCase(),
      directions: dirs,
      ...p,
      items: p.items.map((r) => ({
        direction: r.SENTIDO,
        itinerary_id: r.ITINERARY_ID,
        seq: Number(r.SEQ),
        stop_number: r.NUM,
        name: guardedSummary(r.NOME),
        lat: parseCoordinate(r.LAT, 90),
        lon: parseCoordinate(r.LON, 180),
        type: r.TIPO,
        group: r.GRUPO,
      })),
    },
    source_url: URBS_SOURCE_URL,
    checked_at: src.date,
    license_note: urbsLicenseNote(src.file),
    note:
      urbsNote(src, now) +
      " Stops are in itinerary order (`seq`) for each direction; `type` is the stop's shelter type and `group` is " +
      "URBS's GRUPO field, both as published (empty when URBS leaves them empty).",
  };
}

export const busLineStops: ToolDef<typeof busLineStopsInput, typeof busLineStopsOutput> = {
  name: "bus_line_stops",
  title: "Stops of a Curitiba bus line (URBS, local file)",
  description:
    "The stops of one Curitiba bus line (URBS) in order, for each direction: stop number, name, latitude/longitude " +
    "and shelter type. Get the line code from bus_lines_search. Reads the newest YYYY_MM_DD_pontosLinha.json the " +
    "user downloaded into CURITIBAI_DATA_DIR/urbs/; no network call. Read-only.",
  inputSchema: busLineStopsInput,
  outputSchema: busLineStopsOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    const loaded = await loadUrbsOrFail("pontosLinha");
    if (isFailure(loaded)) return loaded;
    const line = lineStops(loaded.rows, args.line_code);
    if (line.length === 0) {
      return fail("invalid_argument", `line_code has no stops in ${loaded.file}; find the code with bus_lines_search.`);
    }
    if (args.itinerary_id !== undefined && !line.some((r) => r.ITINERARY_ID === args.itinerary_id)) {
      return fail("invalid_argument", "itinerary_id is not one of this line's directions; call without it to list them.");
    }
    return ok(busLineStopsResult(line, loaded, args, new Date()));
  },
};
