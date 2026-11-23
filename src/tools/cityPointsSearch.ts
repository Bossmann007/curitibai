import { z } from "zod";
import { dateInCuritiba } from "../sources/detran.js";
import {
  parseCoordinate,
  URBS_LICENSE,
  URBS_MAX_AGE_DAYS,
  URBS_MIRROR_URL,
  URBS_SOURCE_URL,
  URBS_SUBDIR,
  type Poi,
} from "../sources/urbs.js";
import { MASK, OBJECT_MAX_CHARS } from "../sources/pncp.js";
import { PORTAL_DISCLAIMER } from "../sources/portal.js";
import { fold } from "../text.js";
import { busEnvelope, isFailure, loadUrbsOrFail, page, pagingInput, skippedRowsOutput } from "./busCommon.js";
import { guardedSummary, queryWords } from "./cityServicesSearch.js";
import { fail, ok, type ToolDef } from "./common.js";

/**
 * The only POI categories this tool returns: friendly id -> URBS category names as published in the 2026-11-20 export
 * (docs/sources.md). Rows in any other category (private schools and crèches, hotels, churches, shops, private clubs,
 * newsstands, hospitals, laboratories, police and security, urban equipment, and any category not listed here) are
 * dropped when the file is read, before any search or count, because they name private businesses or people.
 */
export const POI_CATEGORIES = {
  feira: ["ABAST FEIRA"],
  cambio_verde: ["ABAST CAMBIO VERDE"],
  restaurante_popular: ["ABAST RESTAURANTE POP"],
  regional_office: ["ADM REGIONAL"],
  rua_da_cidadania: ["ADM RUA DA CIDADANIA", "RUA DA CIDADANIA - CARTÃO TRANSPORTE"],
  city_office: ["ADM UNID PREFEITURA"],
  library: ["BIB CASA DA LEITURA", "BIB FAROL DO SABER"],
  cemetery: ["CEMITERIO"],
  cmei: ["EDUC CMEI"],
  cmae: ["EDUC CMAE"],
  municipal_school: ["EDUC ESCOLA MUNICIPAL"],
  state_school: ["EDUC ESCOLA ESTADUAL"],
  special_education: ["EDUC ESPECIAL"],
  adult_education: ["EDUC JOVENS E ADULTOS"],
  vocational_education: ["EDUC PROFISSIONAL"],
  cultural_space: ["ESPACO CULTURAL"],
  bus_terminal: ["TERMINAL DE TRANSPORTE", "TERMINAL DE TRANSPORTE - CARTÃO TRANSPORTE", "ESTAÇÃO TUBO - CARTÃO TRANSPORTE"],
  transit_card_office: ["POSTOS DE ATENDIMENTO URBS - CARTÃO TRANSPORTE"],
  health_unit: ["Unidade Saude Basica", "Unidade Saude Familia"],
  urgent_care: ["Unidade Saude 24H", "Unidade Saude CMUM"],
  specialized_health_unit: ["Unidade Saude Especializada", "Unidade Saude Complexa"],
  caps: ["SAUDE CAPS"],
  health_district: ["SAUDE DIST SANITARIO"],
} as const satisfies Record<string, readonly string[]>;

export type PoiCategoryId = keyof typeof POI_CATEGORIES;
const CATEGORY_IDS = Object.keys(POI_CATEGORIES) as [PoiCategoryId, ...PoiCategoryId[]];

/** Folded, whitespace-collapsed source name -> id; nothing else is ever matched. */
const normCategory = (s: string) => fold(s).replace(/\s+/g, " ").trim();
const ID_BY_SOURCE = new Map<string, PoiCategoryId>(
  CATEGORY_IDS.flatMap((id) => POI_CATEGORIES[id].map((src) => [normCategory(src), id] as const)),
);

export const RADIUS_DEFAULT_M = 1500;
export const RADIUS_MAX_M = 10_000;

export const cityPointsSearchInput = {
  category: z.enum(CATEGORY_IDS).optional().describe("One category id; call with no arguments to list them with counts."),
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Words to find in the name; accents, case and punctuation are ignored, every word must match."),
  near: z
    .object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
    .optional()
    .describe("Only points within radius_m of this position, nearest first, with distance_m."),
  radius_m: z
    .number()
    .int()
    .min(1)
    .max(RADIUS_MAX_M)
    .optional()
    .describe(`Search radius in metres around near (default ${RADIUS_DEFAULT_M}, at most ${RADIUS_MAX_M}).`),
  ...pagingInput,
};

const Point = z.object({
  name: z.string(),
  category: z.enum(CATEGORY_IDS),
  source_category: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  desc: z.string(),
  distance_m: z.number().int().optional(),
});

export const cityPointsSearchOutput = busEnvelope(
  z.object({
    total: z.number().int(),
    offset: z.number().int(),
    next_offset: z.number().int().nullable(),
    skipped_rows: skippedRowsOutput,
    items: z.array(Point),
    categories: z
      .array(
        z.object({
          id: z.enum(CATEGORY_IDS),
          source_categories: z.array(z.object({ name: z.string(), count: z.number().int() })),
          count: z.number().int(),
        }),
      )
      .optional(),
  }),
);

export interface CityPoint {
  /** Position among the file's valid rows (file order), to keep paging stable between points with the same sort key. */
  index: number;
  name: string;
  category: PoiCategoryId;
  source_category: string;
  lat: number | null;
  lon: number | null;
  desc: string;
  /** The guarded name folded for `name` search, without the guard's own "[masked]" and "…" tokens. */
  search: string;
}

/**
 * The rows that may be returned: allowlisted categories only, name and desc through the masking guard, coordinates
 * as numbers. Everything else is dropped here, so no later filter or count can reach it.
 */
export function publicPoints(rows: readonly Poi[]): { points: CityPoint[]; excluded: number } {
  const points: CityPoint[] = [];
  for (const [index, r] of rows.entries()) {
    const category = ID_BY_SOURCE.get(normCategory(r.POI_CATEGORY_NAME));
    if (category === undefined) continue;
    const lat = parseCoordinate(r.POI_LAT, 90);
    const lon = parseCoordinate(r.POI_LON, 180);
    const hasPosition = lat !== null && lon !== null;
    const name = guardedSummary(r.POI_NAME);
    points.push({
      index,
      name,
      category,
      source_category: r.POI_CATEGORY_NAME,
      lat: hasPosition ? lat : null,
      lon: hasPosition ? lon : null,
      desc: r.POI_DESC === "" ? "" : guardedSummary(r.POI_DESC),
      search: fold(name.split(MASK).join(" ").replace(/…$/, "")),
    });
  }
  return { points, excluded: rows.length - points.length };
}

/** Great-circle distance in metres (haversine, mean Earth radius). */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface CityPointsSearchArgs {
  category?: PoiCategoryId | undefined;
  name?: string | undefined;
  near?: { lat: number; lon: number } | undefined;
  radius_m?: number | undefined;
  limit: number;
  offset: number;
}

export interface PoiSource {
  file: string;
  date: string;
  skipped: number;
  excluded: number;
}

export const FEIRA_NOTE =
  "This file gives no days or hours for feiras (or any other point); check the Prefeitura before going.";
/** Allowlisted ids that are open to the public but not necessarily publicly run. */
export const MIXED_CATEGORIES: readonly PoiCategoryId[] = ["cultural_space", "special_education", "vocational_education"];
const MIXED_DETAIL =
  "open to the public but may include private or non-profit institutions (commercial cinemas, private theatres and " +
  "museums, private schools)";
/** The note for the mixed categories present among the matches (in MIXED_CATEGORIES order); "" when none. */
export function mixedNote(present: readonly PoiCategoryId[]): string {
  const ids = MIXED_CATEGORIES.filter((id) => present.includes(id));
  if (ids.length === 0) return "";
  const one = ids.length === 1;
  return `Some results are in ${ids.join(", ")}: ${one ? "this category is" : "these categories are"} ${MIXED_DETAIL}.`;
}
export const HEALTH_NOTE = "NOT FOR EMERGENCIES: in an emergency call 192 (SAMU) or 193 (Corpo de Bombeiros).";

function poiLicenseNote(file: string): string {
  return (
    "Source: URBS — Urbanização de Curitiba S.A., points-of-interest export of the dataset \"Transporte Coletivo de " +
    `Curitiba\" on the Portal de Dados Abertos de Curitiba (${URBS_SOURCE_URL}), daily export ${file}, downloaded by ` +
    `the user from the portal's mirror (${URBS_MIRROR_URL}). ${URBS_LICENSE}. Only an allowlist of categories is ` +
    "returned; values are returned as published, except that coordinates are converted to decimal numbers, " +
    "categories get a short id, e-mail-, phone- and CPF/CNPJ-shaped text in a name or description would be " +
    `replaced by [masked], and such a field over ${OBJECT_MAX_CHARS} characters would be cut with "…". ` +
    `${PORTAL_DISCLAIMER} Unofficial; not affiliated with URBS or the Prefeitura de Curitiba.`
  );
}

function poiNote(src: PoiSource, empty: readonly PoiCategoryId[], mixed: string, now: Date): string {
  const days = (Date.parse(`${dateInCuritiba(now)}T00:00:00Z`) - Date.parse(`${src.date}T00:00:00Z`)) / 86_400_000;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    `Read from the local file ${URBS_SUBDIR}/${src.file} in CURITIBAI_DATA_DIR (the newest of its kind there); this ` +
    "tool makes no network call. Only an allowlist of categories is searched; " +
    `${plural(src.excluded, "row", "rows")} in other categories (private businesses, people's names, police and ` +
    "security, and any category not on the list, including a renamed one) are never returned. " +
    FEIRA_NOTE +
    ` ${HEALTH_NOTE}` +
    (src.skipped > 0
      ? ` ${plural(src.skipped, "row", "rows")} of the file did not match the expected shape and ${src.skipped === 1 ? "was" : "were"} left out.`
      : "") +
    (mixed === "" ? "" : ` ${mixed}`) +
    (empty.length === CATEGORY_IDS.length
      ? " No row of this file is in any category on the list: the URBS category names look missing or renamed in this file."
      : empty.length > 0
        ? ` No row of this file is in the ${empty.length === 1 ? "category" : "categories"} ${empty.join(", ")}: ` +
          `${empty.length === 1 ? "its" : "their"} URBS names look missing or renamed in this file (call with no arguments to see \`source_categories\`).`
        : "") +
    (days > URBS_MAX_AGE_DAYS
      ? ` The file is dated ${src.date}, ${days} days ago (more than ${URBS_MAX_AGE_DAYS}); points may have changed. Download a newer export.`
      : "")
  );
}

export function cityPointsSearchResult(points: readonly CityPoint[], src: PoiSource, args: CityPointsSearchArgs, now: Date) {
  const words = args.name === undefined ? [] : queryWords(args.name);
  const radius = args.radius_m ?? RADIUS_DEFAULT_M;
  const near = args.near;
  const matches: (CityPoint & { distance_m?: number })[] = [];
  for (const p of points) {
    if (args.category !== undefined && p.category !== args.category) continue;
    if (!words.every((w) => p.search.includes(w))) continue;
    if (near === undefined) {
      matches.push(p);
      continue;
    }
    if (p.lat === null || p.lon === null) continue;
    const d = distanceM(near, { lat: p.lat, lon: p.lon });
    if (d <= radius) matches.push({ ...p, distance_m: Math.round(d) });
  }
  const byName = (a: CityPoint, b: CityPoint) =>
    a.name.localeCompare(b.name, "pt-BR") || a.category.localeCompare(b.category) || a.index - b.index;
  matches.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0) || byName(a, b));
  const p = page(matches, args.offset, args.limit);
  // Per URBS name (as matched: accents, case and spaces ignored), so one renamed name of an id shows as a 0.
  const tally = new Map<string, number>();
  for (const x of points) {
    const key = normCategory(x.source_category);
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  const counts = CATEGORY_IDS.map((id) => {
    const sources = POI_CATEGORIES[id].map((name) => ({ name, count: tally.get(normCategory(name)) ?? 0 }));
    return { id, source_categories: sources, count: sources.reduce((n, c) => n + c.count, 0) };
  });
  const noFilter = args.category === undefined && args.name === undefined && near === undefined;
  return {
    data: {
      ...p,
      skipped_rows: src.skipped,
      items: p.items.map((x) => ({
        name: x.name,
        category: x.category,
        source_category: x.source_category,
        lat: x.lat,
        lon: x.lon,
        desc: x.desc,
        ...(x.distance_m === undefined ? {} : { distance_m: x.distance_m }),
      })),
      ...(noFilter ? { categories: counts } : {}),
    },
    source_url: URBS_SOURCE_URL,
    checked_at: src.date,
    license_note: poiLicenseNote(src.file),
    note: poiNote(
      src,
      counts.filter((c) => c.count === 0).map((c) => c.id),
      mixedNote(matches.map((x) => x.category)),
      now,
    ),
  };
}

export const cityPointsSearch: ToolDef<typeof cityPointsSearchInput, typeof cityPointsSearchOutput> = {
  name: "city_points_search",
  title: "Curitiba points of interest open to the public (URBS, local file)",
  description:
    "Find public points in Curitiba in the URBS points-of-interest file the user put in " +
    "CURITIBAI_DATA_DIR/urbs/ (no network): CMEIs, schools, terminals, regional offices and more; " +
    "no hours. Filter by category, name or position; no arguments lists the categories. Prefer this for " +
    "CMEIs, schools, terminals and regional offices, or all city points near a position. Not for emergencies.",
  inputSchema: cityPointsSearchInput,
  outputSchema: cityPointsSearchOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    if (args.name !== undefined && queryWords(args.name).length === 0) {
      return fail("invalid_argument", "name must contain at least one letter or digit.");
    }
    if (args.radius_m !== undefined && args.near === undefined) {
      return fail("invalid_argument", "radius_m needs near ({lat, lon}).");
    }
    const loaded = await loadUrbsOrFail("pois");
    if (isFailure(loaded)) return loaded;
    const { points, excluded } = publicPoints(loaded.rows);
    const src = { file: loaded.file, date: loaded.date, skipped: loaded.skipped, excluded };
    return ok(cityPointsSearchResult(points, src, args, new Date()));
  },
};
