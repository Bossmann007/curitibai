import { z } from "zod";
import { distanceMeters, getStops, URBS_LICENSE_NOTE, URBS_STOPS_URL } from "../sources/urbs.js";
import { envelope, failFrom, ok, type ToolDef } from "./common.js";

const MAX_RESULTS = 50;

export const busStopsNearInput = {
  lat: z.number().min(-90).max(90).describe("Latitude in decimal degrees (WGS84)."),
  lon: z.number().min(-180).max(180).describe("Longitude in decimal degrees (WGS84)."),
  radius_m: z.number().int().min(1).max(1000).default(300),
};
export const busStopsNearOutput = envelope(
  z.object({
    total_in_radius: z.number().int(),
    stops: z.array(
      z.object({
        name: z.string(),
        lat: z.number(),
        lon: z.number(),
        distance_m: z.number().int(),
        stop_type: z.string().nullable(),
        lines: z.string().nullable(),
      }),
    ),
  }),
);

export const busStopsNear: ToolDef<typeof busStopsNearInput, typeof busStopsNearOutput> = {
  name: "bus_stops_near",
  title: "Curitiba bus stops near a point",
  description:
    `Bus stops within radius_m (max 1000) of a point, nearest first, at most ${MAX_RESULTS}. The full stop list is downloaded and the distance is computed locally: the coordinates are never sent anywhere, logged or stored.`,
  inputSchema: busStopsNearInput,
  outputSchema: busStopsNearOutput,
  handler: async ({ lat, lon, radius_m }) => {
    try {
      const { value, fetchedAt } = await getStops();
      const inRadius = value
        .map((s) => ({ ...s, distance_m: Math.round(distanceMeters(lat, lon, s.lat, s.lon)) }))
        .filter((s) => s.distance_m <= radius_m)
        .sort((a, b) => a.distance_m - b.distance_m);
      return ok({
        data: {
          total_in_radius: inRadius.length,
          stops: inRadius.slice(0, MAX_RESULTS).map((s) => ({
            name: s.name, lat: s.lat, lon: s.lon, distance_m: s.distance_m, stop_type: s.stop_type, lines: s.lines,
          })),
        },
        source_url: URBS_STOPS_URL,
        fetched_at: fetchedAt,
        license_note: URBS_LICENSE_NOTE,
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
