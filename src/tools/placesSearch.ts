import { z } from "zod";
import {
  getPlaces,
  OSM_ATTRIBUTION,
  osmLicenseNote,
  OVERPASS_URL,
  PLACE_CATEGORIES,
  PLACE_CATEGORY_NAMES,
} from "../sources/osm.js";
import { fold } from "../text.js";
import { envelope, failFrom, ok, type ToolDef } from "./common.js";

export const placesSearchInput = {
  category: z
    .enum(PLACE_CATEGORY_NAMES)
    .describe(
      "One fixed category of public place: " +
        PLACE_CATEGORY_NAMES.map((c) => `${c} (OSM ${PLACE_CATEGORIES[c].join("=")})`).join(", ") +
        ". community_centre and townhall include Ruas da Cidadania where OSM tags them so.",
    ),
  name: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .describe("Words that must all appear in the place name (accents and case ignored)."),
  limit: z.number().int().min(1).max(20).default(10),
  offset: z.number().int().min(0).max(10_000).default(0),
};

const placeSchema = z.object({
  osm_type: z.enum(["node", "way", "relation"]),
  osm_id: z.number().int(),
  name: z.string().nullable(),
  category: z.enum(PLACE_CATEGORY_NAMES),
  address: z
    .object({
      street: z.string().nullable(),
      housenumber: z.string().nullable(),
      suburb: z.string().nullable(),
      postcode: z.string().nullable(),
      city: z.string().nullable(),
    })
    .describe("OSM addr:* tags as tagged; null when not tagged."),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  opening_hours: z.string().nullable().describe("OSM opening_hours as tagged (OSM syntax), or null."),
  website: z.string().nullable().describe("Only an http(s) link without credentials, else null."),
  osm_url: z.string().url(),
});

export const placesSearchOutput = envelope(
  z.object({
    category: z.enum(PLACE_CATEGORY_NAMES),
    total: z.number().int(),
    next_offset: z.number().int().nullable(),
    places: z.array(placeSchema),
    attribution: z.literal(OSM_ATTRIBUTION),
    osm_data_as_of: z.string().nullable().describe("Overpass osm3s.timestamp_osm_base: how fresh the OSM copy is."),
    note: z.string(),
  }),
);

const NOTE =
  "OpenStreetMap is community-edited data: places can be missing, misplaced or outdated, and OSM does not reliably " +
  "say whether a school is public or private. Confirm at the source before going. Names and addresses " +
  "pass through a contact-data mask as a guard.";

export const placesSearch: ToolDef<typeof placesSearchInput, typeof placesSearchOutput> = {
  name: "places_search",
  title: "Public places in Curitiba (OpenStreetMap)",
  description:
    "Public places in Curitiba from OpenStreetMap, by one fixed category (park, library, school, " +
    "community centre, town hall, bus station, marketplace), optionally filtered by words in the name. " +
    "Returns name, address as tagged, coordinates, opening hours, website and the OSM link. No shops, offices, " +
    "doctors, hospitals or emergency services (use health_units_search for public health units). Community data, may be outdated. © OpenStreetMap contributors, ODbL. Read-only.",
  inputSchema: placesSearchInput,
  outputSchema: placesSearchOutput,
  handler: async ({ category, name, limit, offset }) => {
    try {
      const res = await getPlaces(category);
      const words = name ? fold(name).split(/\s+/).filter(Boolean) : [];
      const matches = res.value.places
        .filter((p) => words.length === 0 || (p.name !== null && words.every((w) => fold(p.name!).includes(w))))
        .sort((a, b) => (a.name ?? "￿").localeCompare(b.name ?? "￿", "pt-BR") || a.osm_id - b.osm_id);
      const page = matches.slice(offset, offset + limit);
      const next = offset + limit < matches.length ? offset + limit : null;
      return ok({
        data: {
          category,
          total: matches.length,
          next_offset: next,
          places: page,
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
