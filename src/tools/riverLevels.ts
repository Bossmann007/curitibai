import { z } from "zod";
import { ANA_SERVICE_URL, curitibaIso, getStationData, STATIONS, type Station, type StationData } from "../sources/ana.js";
import { fold } from "../text.js";
import { distanceM } from "./cityPointsSearch.js";
import { fail, failFrom, ok, type ToolDef } from "./common.js";

export const RIVER_SOURCE = "ANA (Agência Nacional de Águas e Saneamento Básico) telemetry; stations operated by IAT-PR";
export const RIVER_LICENSE_NOTE = "No licence found; facts only; ANA cited.";
export const EMERGENCY_NOTE = "Not for emergencies: Defesa Civil 199.";
/** At most this many stations are read per call (uncached: requests at 0, 5 and 10 s; see docs/sources.md). */
export const MAX_STATIONS_PER_CALL = 3;
/** A latest reading older than this is flagged `stale`. */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
/** Default `near`: Praça Tiradentes, Curitiba centre. */
export const CURITIBA_CENTRE = { lat: -25.4284, lon: -49.2733 } as const;

export const riverLevelsInput = {
  station: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .optional()
    .describe(
      "A station code (e.g. \"65010000\", leading zeros optional) or text matched against the station name, river and " +
        "municipality, accents and case ignored (e.g. \"iguacu\", \"fazendinha\", \"araucaria\").",
    ),
  near: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .optional()
    .describe("Order stations by distance from this position (decimal degrees). Default: Curitiba centre."),
};

const Item = z.object({
  code: z.string(),
  name: z.string(),
  river: z.string().nullable().describe("null for rain gauges."),
  municipality: z.string(),
  lat: z.number(),
  lon: z.number(),
  distance_km: z.number().describe("Straight-line distance from `near` (or Curitiba centre), in km."),
  status: z.enum(["ok", "no_recent_data"]).describe("no_recent_data: the station sent nothing since yesterday 00:00 (Curitiba time); values are null."),
  reading_time: z.string().nullable().describe("Time of the latest reading, Curitiba time (ISO 8601, -03:00)."),
  stale: z.boolean().nullable().describe("true when the latest reading is older than 2 hours; null without a reading."),
  level_cm: z.number().nullable().describe("River level (Nivel) of the latest reading, in cm."),
  flow_m3s: z.number().nullable().describe("Flow (Vazao) of the latest reading, in m³/s."),
  rain_mm: z.number().nullable().describe("Rain (Chuva) of the latest reading (one 15-minute interval), in mm."),
  rain_1h_mm: z.number().nullable().describe("Sum of the rain values in the hour ending at the latest reading; null when none. A lower bound when readings are missing."),
  rain_24h_mm: z.number().nullable().describe("Sum of the rain values in the 24 hours ending at the latest reading; null when none or when that window starts before yesterday 00:00. A lower bound when readings are missing."),
  checked_at: z.string().datetime().describe("When this server read the station (cached up to 15 minutes)."),
});

export const riverLevelsOutput = z.object({
  data: z.object({
    total_matches: z.number().int(),
    more_matches: z.array(z.object({ code: z.string(), name: z.string() })).describe("Matching stations not read in this call (at most 3 per call)."),
    stations: z.array(Item),
  }),
  source: z.string(),
  source_url: z.string().url(),
  checked_at: z.string().datetime().describe("The oldest read time among the returned stations."),
  license_note: z.string(),
  note: z.string(),
});

type Output = z.infer<typeof riverLevelsOutput>;
type Near = { lat: number; lon: number };

const key = (s: string) => fold(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Bundled stations matching `station` (code, or text in name, river or municipality), nearest to `near` first. */
export function matchStations(station: string | undefined, near: Near): { s: Station; km: number }[] {
  let found: readonly Station[] = STATIONS;
  if (station !== undefined) {
    if (/^\d{1,8}$/.test(station)) {
      const code = station.padStart(8, "0");
      found = STATIONS.filter((s) => s.code === code);
    } else {
      const want = key(station);
      found = want === "" ? [] : STATIONS.filter((s) => [s.name, s.river ?? "", s.municipality].some((f) => key(f).includes(want)));
    }
  }
  return found
    .map((s) => ({ s, km: Math.round(distanceM(near, s) / 100) / 10 }))
    .sort((a, b) => a.km - b.km || a.s.code.localeCompare(b.s.code));
}

export function stationItem(s: Station, km: number, d: { value: StationData; fetchedAt: string }, now: number): z.infer<typeof Item> {
  const r = d.value.latest;
  return {
    code: s.code,
    name: s.name,
    river: s.river,
    municipality: s.municipality,
    lat: s.lat,
    lon: s.lon,
    distance_km: km,
    status: r === null ? "no_recent_data" : "ok",
    reading_time: r === null ? null : curitibaIso(r.at),
    // Computed at answer time, never cached: a cached reading becomes stale while it sits in the cache.
    stale: r === null ? null : now - r.at > STALE_AFTER_MS,
    level_cm: r?.level_cm ?? null,
    flow_m3s: r?.flow_m3s ?? null,
    rain_mm: r?.rain_mm ?? null,
    rain_1h_mm: d.value.rain_1h_mm,
    rain_24h_mm: d.value.rain_24h_mm,
    checked_at: d.fetchedAt,
  };
}

const NOTE =
  "Readings are automatic and unvalidated (ANA telemetry, IAT-PR stations); a station can be down or report wrong values. " +
  "Many stations send nothing on a given day (status no_recent_data).";

export const riverLevels: ToolDef<typeof riverLevelsInput, typeof riverLevelsOutput> = {
  name: "river_levels",
  title: "River levels and rain around Curitiba (ANA telemetry)",
  description:
    "Latest river level (cm), flow (m³/s) and rain (mm; last reading, last 1 h and 24 h) at ANA telemetry stations " +
    "operated by IAT-PR around Curitiba (25 bundled stations; not affiliated). Filter by `station` (code or name, river, " +
    "municipality text); stations come nearest to `near` (default Curitiba centre) first. At most 3 stations read per " +
    "call, each cached 15 minutes; your position and text are never sent. `stale` marks readings older than 2 h; " +
    "stations without readings are listed as no_recent_data. Not for emergencies: Defesa Civil 199. Read-only.",
  inputSchema: riverLevelsInput,
  outputSchema: riverLevelsOutput,
  handler: async (args) => {
    const near = args.near ?? CURITIBA_CENTRE;
    const matches = matchStations(args.station, near);
    if (matches.length === 0) {
      return fail("invalid_argument", "No bundled station matches `station`; try a river (\"iguacu\") or a municipality, or omit it.");
    }
    const picked = matches.slice(0, MAX_STATIONS_PER_CALL);
    try {
      // One station after the other: the host gate spaces the requests 5 s apart. Any failure fails the call, so a
      // station that was not read is never shown as no_recent_data.
      const read: { s: Station; km: number; d: { value: StationData; fetchedAt: string } }[] = [];
      for (const m of picked) read.push({ ...m, d: await getStationData(m.s) });
      const now = Date.now();
      const more = matches.slice(MAX_STATIONS_PER_CALL).map((m) => ({ code: m.s.code, name: m.s.name }));
      const out: Output = {
        data: {
          total_matches: matches.length,
          more_matches: more,
          stations: read.map((x) => stationItem(x.s, x.km, x.d, now)),
        },
        source: RIVER_SOURCE,
        source_url: ANA_SERVICE_URL,
        checked_at: read.map((x) => x.d.fetchedAt).sort()[0]!,
        license_note: RIVER_LICENSE_NOTE,
        note: [
          EMERGENCY_NOTE,
          NOTE,
          more.length > 0 ? `${more.length} more matching station(s) not read (at most ${MAX_STATIONS_PER_CALL} per call); ask by code.` : "",
        ].filter(Boolean).join(" "),
      };
      return ok(out);
    } catch (err) {
      return failFrom(err);
    }
  },
};
