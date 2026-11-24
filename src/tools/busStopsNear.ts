import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { dateInCuritiba } from "../sources/detran.js";
import { getUrbsStops, URBS_STOPS_LAYER_URL, type UrbsStopsLayer } from "../sources/geocuritiba.js";
import { remoteDataEnabled, REMOTE_DATA_ENV } from "../sources/publishedData.js";
import { loadUrbs, parseCoordinate, URBS_SOURCE_URL, type Linha, type Ponto, type UrbsFile } from "../sources/urbs.js";
import {
  busEnvelope,
  isFailure,
  isMissingUrbsFile,
  lineCodeInput,
  loadUrbsOrFail,
  NOT_AVAILABLE,
  page,
  pagingInput,
  skippedNote,
  skippedRowsOutput,
  urbsFailure,
  urbsLicenseNote,
  urbsNote,
  type UrbsSource,
} from "./busCommon.js";
import { lineStops } from "./busLineStops.js";
import { distanceM } from "./cityPointsSearch.js";
import { guardedSummary } from "./cityServicesSearch.js";
import { FACILITIES_LICENSE_NOTE } from "./cityFacilitiesSearch.js";
import { callStartBy, fail, failFrom, ok, type ErrorCode, type ToolDef } from "./common.js";

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
  lines: z
    .array(StopLine)
    .nullable()
    .describe("Lines and directions serving the stop; null when `source` is geocuritiba_layer (it has no lines per stop)."),
});

export const busStopsNearOutput = busEnvelope(
  z.object({
    source: z
      .enum(["urbs_export", "geocuritiba_layer"])
      .describe("urbs_export: the user's local URBS files; geocuritiba_layer: IPPUC's GeoCuritiba stop layer, used when no local stops file exists."),
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
      source: "urbs_export" as const,
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
      " Source: the local URBS export. This is not real-time: it lists the stops in the published itineraries; for times, call bus_departures " +
      "with the stop_number. `distance_m` is the straight-line distance, not the walking distance. One item per " +
      "stop number: its name, position and type come from its first row in the file with coordinates, and `lines` " +
      "lists each line and direction (SENTIDO) whose itinerary includes it. `line_name` is null when the line code " +
      `is not in the lines file. Stops with no coordinates are never returned.${linesDate}` +
      skippedNote(linesSrc.skipped, linesSrc.file),
  };
}

/** Stops whose position is within `radiusM` of `near`, with the distance rounded to the metre (compared before rounding). */
export function layerStopsWithin(layer: UrbsStopsLayer, near: { lat: number; lon: number }, radiusM: number) {
  const matches: { stop: UrbsStopsLayer["stops"][number]; distance: number }[] = [];
  for (const stop of layer.stops) {
    const exact = distanceM(near, stop);
    if (exact <= radiusM) matches.push({ stop, distance: Math.round(exact) });
  }
  return matches;
}

export const LAYER_NOTE =
  "Source: IPPUC's GeoCuritiba layer URBS_Transporte_Publico (Parada de Ônibus), read because no local URBS stops " +
  "file was found (if you downloaded the export, check that CURITIBAI_DATA_DIR is set and the files are decompressed " +
  "with `xz -d` in its urbs folder). The layer publishes no update date, so its freshness cannot be proved: stops may " +
  "have moved or closed. It has no lines per stop, so `lines` is null; lines and times (bus_departures) need the URBS " +
  "export (docs/local-data.md). Your position is never sent: the whole layer is read and filtered here.";

/** Said with a failed layer read: the local export works without the network. */
const LAYER_FAILED_HINT = `Without the network, this tool works from the URBS export. ${NOT_AVAILABLE("pontosLinha")}`;

export function busStopsNearLayerResult(layer: UrbsStopsLayer, args: BusStopsNearArgs) {
  const matches = layerStopsWithin(layer, args.near, args.radius_m);
  matches.sort((a, b) => a.distance - b.distance || Number(a.stop.num) - Number(b.stop.num));
  const p = page(matches, args.offset, args.limit);
  const left =
    layer.skipped + layer.duplicates === 0
      ? ""
      : ` ${layer.skipped} record(s) without a stop number, name or position in Curitiba were left out; ` +
        `${layer.duplicates} repeated stop number(s) kept their first record.`;
  return {
    data: {
      source: "geocuritiba_layer" as const,
      ...p,
      skipped_rows: layer.skipped,
      items: p.items.map(({ stop, distance }) => ({
        stop_number: stop.num,
        stop_name: guardedSummary(stop.name),
        lat: stop.lat,
        lon: stop.lon,
        distance_m: distance,
        type: stop.type,
        lines: null,
      })),
    },
    source_url: URBS_STOPS_LAYER_URL,
    checked_at: dateInCuritiba(new Date(layer.fetchedAt)),
    license_note: `Fonte: IPPUC/GeoCuritiba (URBS). ${FACILITIES_LICENSE_NOTE}`,
    note:
      `${LAYER_NOTE} Read as ${layer.pages} page(s), ${layer.stops.length} stops, cached 6 hours; \`checked_at\` is ` +
      `the day the layer was read (${layer.fetchedAt}), not a publication date. ` +
      "Not real-time; `distance_m` is the straight-line distance, not the walking distance. Confirm with URBS " +
      `before relying on it.${left}`,
  };
}

/** The error code and message of a `fail()` result; null when its text is not that JSON (the result is then kept as is). */
export function failurePayload(failed: CallToolResult): { error: ErrorCode; message?: string } | null {
  const first = failed.content[0];
  if (first?.type !== "text") return null;
  try {
    const v: unknown = JSON.parse(first.text);
    if (typeof v !== "object" || v === null || typeof (v as { error?: unknown }).error !== "string") return null;
    const { error, message } = v as { error: ErrorCode; message?: unknown };
    return typeof message === "string" ? { error, message } : { error };
  } catch {
    return null;
  }
}

/** Without a local stops file: the GeoCuritiba layer (no line filter: it has no lines per stop). */
async function fromLayer(args: BusStopsNearArgs) {
  if (!remoteDataEnabled()) {
    return fail(
      "data_not_available",
      `${REMOTE_DATA_ENV} is 0 or off, so this tool stays local: the GeoCuritiba stop layer is not read. ` +
        NOT_AVAILABLE("pontosLinha"),
    );
  }
  if (args.line_code !== undefined) {
    return fail(
      "data_not_available",
      `line_code needs the lines of each stop, which only the URBS export has. ${NOT_AVAILABLE("pontosLinha")}`,
    );
  }
  try {
    return ok(busStopsNearLayerResult((await getUrbsStops(callStartBy())).value, args));
  } catch (err) {
    const failed = failFrom(err);
    const payload = failurePayload(failed);
    return payload === null ? failed : fail(payload.error, [payload.message, LAYER_FAILED_HINT].filter(Boolean).join(" "));
  }
}

export const busStopsNear: ToolDef<typeof busStopsNearInput, typeof busStopsNearOutput> = {
  name: "bus_stops_near",
  title: "Curitiba bus stops near a position (URBS export or GeoCuritiba)",
  description:
    "Bus stops near a position in Curitiba (URBS): those within radius_m (default 400 m, at most 2000), nearest " +
    "first. With the URBS files in CURITIBAI_DATA_DIR/urbs/: the lines and directions serving each, and line_code. " +
    "Without them: stops only, from IPPUC's GeoCuritiba layer (no update date). Not real-time; for times call " +
    "bus_departures with the stop_number. Read-only.",
  inputSchema: busStopsNearInput,
  outputSchema: busStopsNearOutput,
  annotations: { openWorldHint: true },
  handler: async (args) => {
    let stops: UrbsFile<"pontosLinha">;
    try {
      stops = await loadUrbs("pontosLinha");
    } catch (err) {
      return isMissingUrbsFile(err) ? fromLayer(args) : urbsFailure("pontosLinha", err);
    }
    const lines = await loadUrbsOrFail("linhas");
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
