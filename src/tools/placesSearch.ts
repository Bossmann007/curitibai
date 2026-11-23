import { z } from "zod";
import {
  getPlaces,
  OSM_ATTRIBUTION,
  osmLicenseNote,
  OVERPASS_URL,
  PLACE_CATEGORIES,
  PLACE_CATEGORY_NAMES,
  type PlaceCategory,
} from "../sources/osm.js";
import { dateInCuritiba } from "../sources/detran.js";
import { fold } from "../text.js";
import { envelope, failFrom, ok, type ToolDef } from "./common.js";

export const placesSearchInput = {
  category: z
    .enum(PLACE_CATEGORY_NAMES)
    .describe(
      "One fixed category of public place: " +
        PLACE_CATEGORY_NAMES.map((c) => `${c} (OSM ${PLACE_CATEGORIES[c].join("=")})`).join(", ") +
        ". community_centre and townhall include Ruas da Cidadania where OSM tags them so. police and fire_station " +
        "come from a list bundled once from OSM (no network call).",
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
    bundled: z.boolean().describe("True for police and fire_station: a list taken once from OSM, no network call."),
    checked_at: z.string().nullable().describe("Day the bundled list was taken (YYYY-MM-DD); null for live categories."),
    osm_data_as_of: z.string().nullable().describe("Overpass osm3s.timestamp_osm_base: how fresh the OSM copy is."),
    note: z.string(),
  }),
);

const NOTE =
  "OpenStreetMap is community-edited data: places can be missing, misplaced or outdated, and OSM does not reliably " +
  "say whether a school is public or private. Confirm at the source before going. Names and addresses " +
  "pass through a contact-data mask as a guard.";

/** Past this many days since the bundled list's checked_at (Curitiba time) the note says the bundled list may be outdated. */
export const BUNDLED_MAX_AGE_DAYS = 180;

export const EMERGENCY_NOTE =
  "NOT FOR EMERGENCIES: in an emergency call 190 (Polícia Militar) or 193 (Corpo de Bombeiros); do not use this list " +
  "to find help.";

export const POLICE_NOTE =
  "Police is as tagged in OSM; includes Guarda Municipal, identification institutes and some non-police offices.";

/** Note for the bundled police and fire station list: emergency warning first, then (police only) what the category holds, then its age. */
export function bundledNote(now: Date, checkedAt: string, category: PlaceCategory): string {
  const days = Math.floor((Date.parse(`${dateInCuritiba(now)}T00:00:00Z`) - Date.parse(`${checkedAt}T00:00:00Z`)) / 86_400_000);
  const age =
    days > BUNDLED_MAX_AGE_DAYS
      ? `This list was taken from OpenStreetMap on ${checkedAt}, more than ${BUNDLED_MAX_AGE_DAYS} days ago, and may be outdated.`
      : `This list was taken once from OpenStreetMap on ${checkedAt} and is not refreshed; it may be outdated.`;
  return `${EMERGENCY_NOTE} ${category === "police" ? `${POLICE_NOTE} ` : ""}${age} ${NOTE}`;
}

export const placesSearch: ToolDef<typeof placesSearchInput, typeof placesSearchOutput> = {
  name: "places_search",
  title: "Public places in Curitiba (OpenStreetMap)",
  description:
    "Public places in Curitiba from OpenStreetMap (community data, may be outdated) by one category, optionally " +
    "by name: address, position, hours, website. No shops or health units (use health_units_search). Prefer this " +
    "only for police and fire stations, or when the other place tools find nothing. " +
    "NOT FOR EMERGENCIES: call 190 (police) or 193 (fire brigade). Read-only.",
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
          bundled: res.value.bundled,
          checked_at: res.value.checkedAt,
          osm_data_as_of: res.value.osmBase,
          note: res.value.checkedAt !== null ? bundledNote(new Date(), res.value.checkedAt, category) : NOTE,
        },
        source_url: OVERPASS_URL,
        fetched_at: res.fetchedAt,
        license_note: osmLicenseNote(res.value.osmBase, res.fetchedAt, res.value.bundled),
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
