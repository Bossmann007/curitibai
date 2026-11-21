import { z } from "zod";
import { parseCoordinate, URBS_SOURCE_URL, type Linha, type Ponto } from "../sources/urbs.js";
import {
  busEnvelope,
  isFailure,
  lineCodeInput,
  loadUrbsOrFail,
  page,
  pagingInput,
  skippedNote,
  skippedRowsOutput,
  urbsLicenseNote,
  urbsNote,
  type UrbsSource,
} from "./busCommon.js";
import { lineStops } from "./busLineStops.js";
import { distanceM } from "./cityPointsSearch.js";
import { guardedSummary } from "./cityServicesSearch.js";
import { fail, ok, type ToolDef } from "./common.js";

export const NEAR_RADIUS_DEFAULT_M = 400;
export const NEAR_RADIUS_MAX_M = 2000;

export const busStopsNearInput = {
  near: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .describe("The position to search around, in decimal degrees."),
  radius_m: z
    .number()
    .int()
    .min(1)
    .max(NEAR_RADIUS_MAX_M)
    .default(NEAR_RADIUS_DEFAULT_M)
    .describe(`Search radius in metres (default ${NEAR_RADIUS_DEFAULT_M}, at most ${NEAR_RADIUS_MAX_M}).`),
  line_code: lineCodeInput.optional().describe("Only stops this line serves (code as in bus_lines_search; case ignored)."),
  ...pagingInput,
};

const StopLine = z.object({ line_code: z.string(), line_name: z.string().nullable(), direction: z.string() });

const NearStop = z.object({
  stop_number: z.string(),
  stop_name: z.string(),
  lat: z.number(),
  lon: z.number(),
  distance_m: z.number().int(),
  type: z.string(),
  lines: z.array(StopLine),
});

export const busStopsNearOutput = busEnvelope(
  z.object({
    total: z.number().int(),
    offset: z.number().int(),
    next_offset: z.number().int().nullable(),
    skipped_rows: skippedRowsOutput,
    items: z.array(NearStop),
  }),
);

export interface BusStopsNearArgs {
  near: { lat: number; lon: number };
  radius_m: number;
  line_code?: string | undefined;
  limit: number;
  offset: number;
}

export interface Stop {
  /** The stop's first row (file order) with both coordinates: name, position and type come from it. */
  row: Ponto;
  lat: number;
  lon: number;
  /** Upper-cased COD + SENTIDO -> the pair, once per pair (codes compared case-insensitively, as everywhere). */
  lines: Map<string, { cod: string; sentido: string }>;
}

/** Rows grouped by stop NUM. Stops without coordinates in any row are left out (they cannot be placed). */
function groupStops(rows: readonly Ponto[]): Map<string, Stop> {
  const stops = new Map<string, Stop>();
  const pending = new Map<string, Map<string, { cod: string; sentido: string }>>(); // lines seen before a coordinate
  for (const r of rows) {
    let stop = stops.get(r.NUM);
    let lines = stop?.lines ?? pending.get(r.NUM);
    if (lines === undefined) {
      lines = new Map();
      pending.set(r.NUM, lines);
    }
    const key = `${r.COD.toUpperCase()}\u0000${r.SENTIDO}`;
    if (!lines.has(key)) lines.set(key, { cod: r.COD, sentido: r.SENTIDO }); // the first spelling of the code wins
    if (stop === undefined) {
      const lat = parseCoordinate(r.LAT, 90);
      const lon = parseCoordinate(r.LON, 180);
      if (lat !== null && lon !== null) {
        stop = { row: r, lat, lon, lines };
        stops.set(r.NUM, stop);
        pending.delete(r.NUM);
      }
    }
  }
  return stops;
}

/**
 * Stops with coordinates within `radiusM` of `near` (compared before rounding), with their distance rounded to the
 * metre, in file order; only those `lineCode` serves (case ignored) when given.
 */
export function stopsWithin(
  rows: readonly Ponto[],
  near: { lat: number; lon: number },
  radiusM: number,
  lineCode?: string,
): { stop: Stop; distance: number }[] {
  const wanted = lineCode?.trim().toUpperCase();
  const matches: { stop: Stop; distance: number }[] = [];
  for (const stop of groupStops(rows).values()) {
    if (wanted !== undefined && ![...stop.lines.values()].some((l) => l.cod.toUpperCase() === wanted)) continue;
    const exact = distanceM(near, stop);
    if (exact <= radiusM) matches.push({ stop, distance: Math.round(exact) });
  }
  return matches;
}

export function busStopsNearResult(
  rows: readonly Ponto[],
  linhas: readonly Linha[],
  src: UrbsSource,
  linesSrc: UrbsSource,
  args: BusStopsNearArgs,
  now: Date,
) {
  const names = new Map(linhas.map((l) => [l.COD.toUpperCase(), l.NOME]));
  const matches = stopsWithin(rows, args.near, args.radius_m, args.line_code);
  const byNumber = (a: string, b: string) => Number(a) - Number(b) || a.localeCompare(b);
  matches.sort((a, b) => a.distance - b.distance || byNumber(a.stop.row.NUM, b.stop.row.NUM));
  const p = page(matches, args.offset, args.limit);
  const linesDate =
    linesSrc.date === src.date
      ? ""
      : ` Line names come from ${linesSrc.file} (dated ${linesSrc.date}), a different date from the stops file: compare before relying on them.`;
  return {
    data: {
      ...p,
      skipped_rows: src.skipped,
      items: p.items.map(({ stop, distance }) => ({
        stop_number: stop.row.NUM,
        stop_name: guardedSummary(stop.row.NOME),
        lat: stop.lat,
        lon: stop.lon,
        distance_m: distance,
        type: stop.row.TIPO,
        lines: [...stop.lines.values()]
          .sort((a, b) => a.cod.localeCompare(b.cod) || a.sentido.localeCompare(b.sentido, "pt-BR"))
          .map((l) => ({ line_code: l.cod, line_name: names.get(l.cod.toUpperCase()) ?? null, direction: l.sentido })),
      })),
    },
    source_url: URBS_SOURCE_URL,
    checked_at: src.date,
    license_note: urbsLicenseNote(src.file, linesSrc.file),
    note:
      urbsNote(src, now) +
      " This is not real-time: it lists the stops in the published itineraries; for times, call bus_departures " +
      "with the stop_number. `distance_m` is the straight-line distance, not the walking distance. One item per " +
      "stop number: its name, position and type come from its first row in the file with coordinates, and `lines` " +
      "lists each line and direction (SENTIDO) whose itinerary includes it. `line_name` is null when the line code " +
      `is not in the lines file. Stops with no coordinates are never returned.${linesDate}` +
      skippedNote(linesSrc.skipped, linesSrc.file),
  };
}

export const busStopsNear: ToolDef<typeof busStopsNearInput, typeof busStopsNearOutput> = {
  name: "bus_stops_near",
  title: "Curitiba bus stops near a position (URBS, local files)",
  description:
    "Which buses stop near a position in Curitiba (URBS): the stops within radius_m (default 400 m, at most 2000), " +
    "nearest first, each once with its stop number, name, position, distance, shelter type and the lines and " +
    "directions that serve it. Optionally only the stops of one line. Not real-time; for times call bus_departures " +
    "with the stop_number. Reads the newest YYYY_MM_DD_pontosLinha.json and YYYY_MM_DD_linhas.json the user " +
    "downloaded into CURITIBAI_DATA_DIR/urbs/; no network call. Read-only.",
  inputSchema: busStopsNearInput,
  outputSchema: busStopsNearOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    const [stops, lines] = await Promise.all([loadUrbsOrFail("pontosLinha"), loadUrbsOrFail("linhas")]);
    if (isFailure(stops)) return stops;
    if (isFailure(lines)) return lines;
    if (args.line_code !== undefined) {
      if (lineStops(stops.rows, args.line_code).length === 0) {
        return fail("invalid_argument", `line_code has no stops in ${stops.file}; find the code with bus_lines_search.`);
      }
    }
    // GRUPO is not returned here, so its absence says nothing about this result.
    const src = { ...stops, emptyFields: stops.emptyFields.filter((f) => f !== "GRUPO") };
    return ok(busStopsNearResult(stops.rows, lines.rows, src, lines, args, new Date()));
  },
};
