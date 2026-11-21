import { z } from "zod";
import { getBusRoute, getBusRoutes, OSM_ATTRIBUTION, osmLicenseNote, OVERPASS_URL } from "../sources/osm.js";
import { fold } from "../text.js";
import { envelope, fail, failFrom, ok, type ToolDef } from "./common.js";

export const busLinesInput = {
  route_id: z
    .number()
    .int()
    .min(1)
    .max(2 ** 40)
    .optional()
    .describe("OSM relation id of one route (osm_id from a list call): returns that route with its ordered stops. Use alone."),
  ref: z.string().trim().min(1).max(20).optional().describe("Line number/code, exact (case ignored), e.g. \"022\"."),
  name: z.string().trim().min(2).max(100).optional().describe("Words that must all appear in the route name."),
  limit: z.number().int().min(1).max(20).default(10),
  offset: z.number().int().min(0).max(10_000).default(0),
};

const routeSchema = z.object({
  osm_id: z.number().int(),
  ref: z.string().nullable(),
  name: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  operator: z.string().nullable(),
  network: z.string().nullable(),
  osm_url: z.string().url(),
});

const stopSchema = z.object({
  seq: z.number().int(),
  name: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  osm_type: z.enum(["node", "way"]),
  osm_id: z.number().int(),
});

export const busLinesOutput = envelope(
  z.object({
    total: z.number().int().describe("Routes matching the filters (list mode), or 0/1 for route_id."),
    next_offset: z.number().int().nullable(),
    routes: z.array(routeSchema).describe("List mode: matching routes, one per direction as mapped in OSM."),
    route: routeSchema
      .extend({ stops: z.array(stopSchema), stops_truncated: z.boolean() })
      .nullable()
      .describe("route_id mode: the route with its stops in order; null when no such bus route is in Curitiba."),
    attribution: z.literal(OSM_ATTRIBUTION),
    osm_data_as_of: z.string().nullable().describe("Overpass osm3s.timestamp_osm_base: how fresh the OSM copy is."),
    note: z.string(),
  }),
);

const NOTE =
  "No timetables or real-time data: OpenStreetMap has none. These are OSM bus route relations, community-mapped and " +
  "possibly outdated or incomplete; for official lines, times and fares check URBS. A line usually has one route per " +
  "direction.";
const STOPS_NOTE =
  " Stops are the route's stop and platform members in OSM order; a stop position and its platform with the same " +
  "name are merged; platforms mapped as areas only appear when the relation lists them.";

function natural(a: string | null, b: string | null): number {
  return (a ?? "￿").localeCompare(b ?? "￿", "pt-BR", { numeric: true });
}

export const busLines: ToolDef<typeof busLinesInput, typeof busLinesOutput> = {
  name: "bus_lines",
  title: "Curitiba bus lines and stops (OpenStreetMap)",
  description:
    "Bus route relations mapped in OpenStreetMap for Curitiba: ref, name, from/to, operator and network, filtered by " +
    "ref or name; with route_id, one route's stops in order with coordinates. NO timetables. OSM is community data " +
    "and may be outdated. © OpenStreetMap contributors, ODbL. Read-only.",
  inputSchema: busLinesInput,
  outputSchema: busLinesOutput,
  handler: async ({ route_id, ref, name, limit, offset }) => {
    try {
      if (route_id !== undefined) {
        if (ref !== undefined || name !== undefined || limit !== 10 || offset !== 0) {
          return fail("invalid_argument", "route_id cannot be combined with ref, name, limit or offset.");
        }
        const res = await getBusRoute(route_id);
        const route = res.value.route;
        return ok({
          data: {
            total: route ? 1 : 0,
            next_offset: null,
            routes: [],
            route,
            attribution: OSM_ATTRIBUTION,
            osm_data_as_of: res.value.osmBase,
            note: (route ? NOTE + STOPS_NOTE : `No OSM bus route with id ${route_id} in Curitiba. ${NOTE}`),
          },
          source_url: OVERPASS_URL,
          fetched_at: res.fetchedAt,
          license_note: osmLicenseNote(res.value.osmBase, res.fetchedAt),
        });
      }
      const res = await getBusRoutes();
      const wantRef = ref ? fold(ref) : null;
      const words = name ? fold(name).split(/\s+/).filter(Boolean) : [];
      const matches = res.value.routes
        .filter((r) => wantRef === null || (r.ref !== null && fold(r.ref) === wantRef))
        .filter((r) => words.length === 0 || (r.name !== null && words.every((w) => fold(r.name!).includes(w))))
        .sort((a, b) => natural(a.ref, b.ref) || natural(a.name, b.name) || a.osm_id - b.osm_id);
      return ok({
        data: {
          total: matches.length,
          next_offset: offset + limit < matches.length ? offset + limit : null,
          routes: matches.slice(offset, offset + limit),
          route: null,
          attribution: OSM_ATTRIBUTION,
          osm_data_as_of: res.value.osmBase,
          note: NOTE,
        },
        source_url: OVERPASS_URL,
        fetched_at: res.fetchedAt,
        license_note: osmLicenseNote(res.value.osmBase, res.fetchedAt),
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
