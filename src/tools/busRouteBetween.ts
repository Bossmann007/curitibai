import { z } from "zod";
import { URBS_SOURCE_URL, type Linha, type Ponto } from "../sources/urbs.js";
import {
  busEnvelope,
  isFailure,
  loadUrbsOrFail,
  page,
  pagingInput,
  skippedNote,
  skippedRowsOutput,
  urbsLicenseNote,
  urbsNote,
  type UrbsSource,
} from "./busCommon.js";
import { groupStops, type Stop } from "./busStopsNear.js";
import { distanceM } from "./cityPointsSearch.js";
import { guardedSummary } from "./cityServicesSearch.js";
import { ok, type ToolDef } from "./common.js";

export const ROUTE_RADIUS_DEFAULT_M = 500;
export const ROUTE_RADIUS_MAX_M = 1000;
/** At most this many `other_lines`; the note says when more were left out. */
export const OTHER_LINES_MAX = 50;
const byCode = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

const point = (what: string) =>
  z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).describe(`${what}, in decimal degrees.`);

export const busRouteBetweenInput = {
  from: point("Where the trip starts"),
  to: point("Where the trip ends"),
  radius_m: z
    .number()
    .int()
    .min(1)
    .max(ROUTE_RADIUS_MAX_M)
    .default(ROUTE_RADIUS_DEFAULT_M)
    .describe(
      `Walking radius around each end, in metres, straight line (default ${ROUTE_RADIUS_DEFAULT_M}, at most ${ROUTE_RADIUS_MAX_M}).`,
    ),
  ...pagingInput,
};

const RouteStop = z.object({ stop_number: z.string(), stop_name: z.string(), distance_m: z.number().int() });

const Route = z.object({
  line_code: z.string(),
  line_name: z.string().nullable(),
  direction: z.string().describe("SENTIDO of the itinerary, as published."),
  itinerary_id: z.string(),
  board: RouteStop.describe("Stop near `from`; distance_m from `from`, straight line."),
  alight: RouteStop.describe("Stop near `to`, after `board` in the itinerary (SEQ); distance_m from `to`, straight line."),
  walk_m: z.number().int().describe("board.distance_m + alight.distance_m."),
});

export const busRouteBetweenOutput = busEnvelope(
  z.object({
    radius_m: z.number().int(),
    origin_stops: z.number().int().describe("Stops with coordinates within radius_m of `from` (any line)."),
    destination_stops: z.number().int().describe("Stops with coordinates within radius_m of `to` (any line)."),
    total: z.number().int(),
    offset: z.number().int(),
    next_offset: z.number().int().nullable(),
    skipped_rows: skippedRowsOutput,
    items: z.array(Route),
    other_lines: z
      .array(z.object({ line_code: z.string(), line_name: z.string().nullable() }))
      .describe(
        `Lines with an itinerary that has stops near both ends, but none that passes \`from\` before \`to\` (at most ${OTHER_LINES_MAX}; see note).`,
      ),
  }),
);

export interface BusRouteBetweenArgs {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  radius_m: number;
  limit: number;
  offset: number;
}

interface Near {
  stop: Stop;
  distance: number;
}

/** Stops within `radiusM` of `p` (compared before rounding), by stop number, with the distance rounded to the metre. */
function within(stops: Map<string, Stop>, p: { lat: number; lon: number }, radiusM: number): Map<string, Near> {
  const out = new Map<string, Near>();
  for (const [num, stop] of stops) {
    const exact = distanceM(p, stop);
    if (exact <= radiusM) out.set(num, { stop, distance: Math.round(exact) });
  }
  return out;
}

interface Leg {
  cod: string;
  itinerary: string;
  sentido: string;
  board: Near;
  alight: Near;
  walk: number;
  /** Alighting SEQ minus boarding SEQ: the shorter ride wins a tie on walking. */
  gap: number;
}

const better = (a: Leg, b: Leg) => a.walk - b.walk || a.gap - b.gap || byCode(a.itinerary, b.itinerary);

/**
 * Per line (code compared case-insensitively), the boarding and alighting pair with the least walking among the
 * itineraries that reach a stop near `to` after a stop near `from` (same ITINERARY_ID, boarding SEQ strictly lower,
 * never the same stop number); and the lines that have stops near both ends but no such itinerary.
 */
export function directLegs(rows: readonly Ponto[], origin: Map<string, Near>, dest: Map<string, Near>) {
  const byItinerary = new Map<string, Ponto[]>();
  for (const r of rows) {
    if (!origin.has(r.NUM) && !dest.has(r.NUM)) continue;
    const key = `${r.COD.toUpperCase()}\u0000${r.ITINERARY_ID}`;
    const list = byItinerary.get(key);
    if (list === undefined) byItinerary.set(key, [r]);
    else list.push(r);
  }
  const best = new Map<string, Leg>();
  const both = new Map<string, string>(); // upper-cased code -> first spelling, for lines with different stops near the two ends
  for (const list of byItinerary.values()) {
    list.sort((a, b) => Number(a.SEQ) - Number(b.SEQ));
    // The two nearest boarding stops seen so far, with different stop numbers (one may be the alighting stop itself);
    // on a tie, or the same stop passed again, the later one (higher SEQ), so the ride is the shortest.
    let b1: { near: Near; seq: number } | null = null;
    let b2: { near: Near; seq: number } | null = null;
    const atOrigin = new Set<string>();
    const atDest = new Set<string>();
    for (const r of list) {
      const seq = Number(r.SEQ);
      const d = dest.get(r.NUM);
      if (d !== undefined) {
        atDest.add(r.NUM);
        const b = b1 !== null && b1.near.stop.row.NUM !== r.NUM ? b1 : b2;
        if (b !== null && b.seq < seq) {
          const cod = r.COD.toUpperCase();
          const leg: Leg = {
            cod: r.COD,
            itinerary: r.ITINERARY_ID,
            sentido: r.SENTIDO,
            board: b.near,
            alight: d,
            walk: b.near.distance + d.distance,
            gap: seq - b.seq,
          };
          const old = best.get(cod);
          if (old === undefined || better(leg, old) < 0) best.set(cod, leg);
        }
      }
      const o = origin.get(r.NUM);
      if (o !== undefined) {
        atOrigin.add(r.NUM);
        const cand = { near: o, seq };
        if (b1 === null || o.distance <= b1.near.distance) {
          if (b1 !== null && b1.near.stop.row.NUM !== r.NUM) b2 = b1;
          b1 = cand;
        } else if (b1.near.stop.row.NUM !== r.NUM && (b2 === null || o.distance <= b2.near.distance)) {
          b2 = cand;
        }
      }
    }
    // Near both ends: a stop near `to` that is not the only stop near `from` (one shared stop is just a walk).
    if ([...atDest].some((d) => [...atOrigin].some((o) => o !== d))) {
      const r = list[0]!;
      if (!both.has(r.COD.toUpperCase())) both.set(r.COD.toUpperCase(), r.COD);
    }
  }
  const legs = [...best.values()].sort((a, b) => a.walk - b.walk || byCode(a.cod, b.cod));
  const others = [...both].filter(([up]) => !best.has(up)).map(([, cod]) => cod).sort(byCode);
  return { legs, others };
}

export function busRouteBetweenResult(
  rows: readonly Ponto[],
  linhas: readonly Linha[],
  src: UrbsSource,
  linesSrc: UrbsSource,
  args: BusRouteBetweenArgs,
  now: Date,
) {
  const names = new Map(linhas.map((l) => [l.COD.toUpperCase(), l.NOME]));
  const name = (cod: string) => names.get(cod.toUpperCase()) ?? null;
  const stops = groupStops(rows);
  const origin = within(stops, args.from, args.radius_m);
  const dest = within(stops, args.to, args.radius_m);
  const { legs, others } = directLegs(rows, origin, dest);
  const p = page(legs, args.offset, args.limit);
  const routeStop = (n: Near) => ({
    stop_number: n.stop.row.NUM,
    stop_name: guardedSummary(n.stop.row.NOME),
    distance_m: n.distance,
  });
  const linesDate =
    linesSrc.date === src.date
      ? ""
      : ` Line names come from ${linesSrc.file} (dated ${linesSrc.date}), a different date from the stops file: compare before relying on them.`;
  const empty =
    legs.length === 0
      ? ` No direct line was found (${origin.size} stop(s) near \`from\`, ${dest.size} near \`to\`). ` +
        (args.radius_m < ROUTE_RADIUS_MAX_M ? `Try a larger radius_m (at most ${ROUTE_RADIUS_MAX_M}), or two` : "Try two") +
        " buses through an integration terminal: transfers and terminals are not modelled here " +
        "(city_facilities_search with type terminal lists the terminals and their integrated lines)."
      : "";
  // The points are close enough for the two areas to overlap: walking may beat every bus listed.
  const apart = Math.round(distanceM(args.from, args.to));
  const close =
    apart <= 2 * args.radius_m
      ? ` \`from\` and \`to\` are ${apart} m apart in a straight line: walking there may be shorter than any bus listed.`
      : "";
  const cut =
    others.length > OTHER_LINES_MAX ? ` \`other_lines\` shows the first ${OTHER_LINES_MAX} of ${others.length} by code.` : "";
  return {
    data: {
      radius_m: args.radius_m,
      origin_stops: origin.size,
      destination_stops: dest.size,
      ...p,
      skipped_rows: src.skipped,
      items: p.items.map((l) => ({
        line_code: l.cod,
        line_name: name(l.cod),
        direction: l.sentido,
        itinerary_id: l.itinerary,
        board: routeStop(l.board),
        alight: routeStop(l.alight),
        walk_m: l.walk,
      })),
      other_lines: others.slice(0, OTHER_LINES_MAX).map((cod) => ({ line_code: cod, line_name: name(cod) })),
    },
    source_url: URBS_SOURCE_URL,
    checked_at: src.date,
    license_note: urbsLicenseNote(src.file, linesSrc.file),
    note:
      urbsNote(src, now) +
      " Direct lines only: one bus, no transfers; integration terminals are not modelled. This is not real-time: " +
      "it reads the published itineraries; for times call bus_departures with the board stop_number, or " +
      "next_buses_near at `from`. A line is listed when one of its itineraries (same ITINERARY_ID) passes a stop " +
      "within radius_m of `from` before a stop within radius_m of `to`, by the stop order SEQ; per line, the pair " +
      "with the least walking (`walk_m`). `distance_m` and `walk_m` are straight-line distances, not walking routes. " +
      "`other_lines` have an itinerary with stops near both ends, but none in that order (for example a loop line " +
      "that would pass its end point first): check them with bus_line_stops. A line whose two directions use " +
      "different streets, one near each end, is in neither list. Your positions are not sent, stored or returned." +
      empty +
      close +
      cut +
      linesDate +
      skippedNote(linesSrc.skipped, linesSrc.file),
  };
}

export const busRouteBetween: ToolDef<typeof busRouteBetweenInput, typeof busRouteBetweenOutput> = {
  name: "bus_route_between",
  title: "Direct Curitiba bus lines between two positions (URBS export, local files)",
  description:
    "\"Which bus goes from A to B\": URBS lines whose itinerary passes a stop within radius_m (default 500 m) of " +
    "`from` and later one near `to`, least walking first, with the boarding and alighting stops. Direct lines only " +
    "(no transfers), not real-time, straight-line distances. Needs the URBS files the user downloaded into " +
    "CURITIBAI_DATA_DIR/urbs/; no network call. Read-only.",
  inputSchema: busRouteBetweenInput,
  outputSchema: busRouteBetweenOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    const stops = await loadUrbsOrFail("pontosLinha");
    if (isFailure(stops)) return stops;
    const lines = await loadUrbsOrFail("linhas");
    if (isFailure(lines)) return lines;
    // Only NOME (stop_name) is returned from the descriptive stop fields.
    const src = { ...stops, emptyFields: stops.emptyFields.filter((f) => f === "NOME") };
    return ok(busRouteBetweenResult(stops.rows, lines.rows, src, lines, args, new Date()));
  },
};
