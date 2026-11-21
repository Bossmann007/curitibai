import { sharedCache, type Cached } from "../cache.js";
import { fetchText, SourceUnavailableError } from "../http.js";
import { MASK, maskObject } from "./pncp.js";

/**
 * Overpass instance run by Private.coffee (formerly overpass.kumi.systems). Its robots.txt is 404 and its terms allow
 * use "in any project". overpass-api.de is not used: its robots.txt disallows /api/. See docs/sources.md.
 */
export const OVERPASS_URL = "https://overpass.private.coffee/api/interpreter";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors, ODbL";
/** The server-side limit written into every query; the client waits a little longer for the answer to arrive. */
export const OVERPASS_QUERY_TIMEOUT_S = 25;
export const OVERPASS_TIMEOUT_MS = 30_000;
/** Not measured: the instance did not answer during the 2026-11-21 check. 3 MB is a guess with room; see docs/sources.md. */
export const OVERPASS_MAX_BYTES = 3 * 1024 * 1024;
/** Stops returned for one route at most (a bound, not measured on real Curitiba routes). */
export const MAX_STOPS = 300;

/**
 * Curitiba's municipal boundary (admin_level 8, IBGE 4106902). Overpass derives an area from it; every query is
 * limited to that area. The area id is printed first, so a missing area fails closed instead of looking like "none".
 */
const CURITIBA_AREA = 'area["boundary"="administrative"]["admin_level"="8"]["IBGE:GEOCODIGO"="4106902"]->.cwb;.cwb out ids;';

/** The fixed category allowlist: public places only. Each maps to one exact OSM tag. */
export const PLACE_CATEGORIES = {
  park: ["leisure", "park"],
  library: ["amenity", "library"],
  school: ["amenity", "school"],
  hospital: ["amenity", "hospital"],
  police: ["amenity", "police"],
  fire_station: ["amenity", "fire_station"],
  community_centre: ["amenity", "community_centre"],
  townhall: ["amenity", "townhall"],
  bus_station: ["amenity", "bus_station"],
  marketplace: ["amenity", "marketplace"],
} as const satisfies Record<string, readonly [string, string]>;
export type PlaceCategory = keyof typeof PLACE_CATEGORIES;
export const PLACE_CATEGORY_NAMES = Object.keys(PLACE_CATEGORIES) as [PlaceCategory, ...PlaceCategory[]];

function header(): string {
  return `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_S}];${CURITIBA_AREA}`;
}

/** Built only from the allowlist; no user text ever enters a query. */
export function placesQuery(category: PlaceCategory): string {
  const [k, v] = PLACE_CATEGORIES[category];
  return `${header()}nwr["${k}"="${v}"](area.cwb);out center;`;
}

export function busRoutesQuery(): string {
  return `${header()}rel["type"="route"]["route"="bus"](area.cwb);out tags;`;
}

/** One route by relation id (an integer, never text), its member nodes and its platform ways (any platform role). */
export function busRouteQuery(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError("bad relation id");
  return `${header()}rel(${id})["type"="route"]["route"="bus"](area.cwb)->.r;.r out body;(node(r.r);way(r.r:"platform");way(r.r:"platform_entry_only");way(r.r:"platform_exit_only"););out center;`;
}

export function osmUrl(type: string, id: number): string {
  return `https://www.openstreetmap.org/${type}/${id}`;
}

export function osmLicenseNote(osmBase: string | null, fetchedAt: string): string {
  return (
    `${OSM_ATTRIBUTION} (${OSM_COPYRIGHT_URL}). Data from OpenStreetMap via the Overpass API (${OVERPASS_URL}), ` +
    `fetched at ${fetchedAt}; OSM data as of ${osmBase ?? "an unknown time (the server did not say)"}. ` +
    "OpenStreetMap is community-edited and may be incomplete or outdated. " +
    "Unofficial; not affiliated with OpenStreetMap, the OSM Foundation, URBS or Prefeitura de Curitiba."
  );
}

interface RawElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
}

export interface OverpassResult {
  osmBase: string | null;
  /** Whether Curitiba's area came back (the `.cwb out ids;` line). */
  areaFound: boolean;
  elements: RawElement[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Overpass JSON: `{osm3s: {timestamp_osm_base}, elements: [...], remark?}`. A `remark` means the server stopped
 * early (timeout, out of memory) and the list may be cut: that is source_unavailable, never a short answer.
 */
export function parseOverpass(json: unknown): OverpassResult {
  if (!isObject(json) || !Array.isArray(json.elements)) throw new SourceUnavailableError("unexpected Overpass response");
  if (typeof json.remark === "string" && json.remark.trim() !== "") throw new SourceUnavailableError("Overpass remark");
  const osm3s = isObject(json.osm3s) ? json.osm3s : {};
  const base = typeof osm3s.timestamp_osm_base === "string" && osm3s.timestamp_osm_base !== "" ? osm3s.timestamp_osm_base : null;
  const elements: RawElement[] = [];
  let areaFound = false;
  for (const e of json.elements) {
    if (isObject(e) && e.type === "area" && Number.isSafeInteger(e.id)) {
      areaFound = true;
      continue;
    }
    if (!isObject(e) || (e.type !== "node" && e.type !== "way" && e.type !== "relation") || !Number.isSafeInteger(e.id)) {
      throw new SourceUnavailableError("unexpected Overpass element");
    }
    const tags: Record<string, string> = {};
    if (isObject(e.tags)) for (const [k, v] of Object.entries(e.tags)) if (typeof v === "string") tags[k] = v;
    const out: RawElement = { type: e.type, id: e.id as number, tags };
    if (finite(e.lat) && finite(e.lon)) {
      out.lat = e.lat;
      out.lon = e.lon;
    }
    if (isObject(e.center) && finite(e.center.lat) && finite(e.center.lon)) out.center = { lat: e.center.lat, lon: e.center.lon };
    if (Array.isArray(e.members)) {
      out.members = e.members.flatMap((m) =>
        isObject(m) && typeof m.type === "string" && Number.isSafeInteger(m.ref)
          ? [{ type: m.type, ref: m.ref as number, role: typeof m.role === "string" ? m.role : "" }]
          : [],
      );
    }
    elements.push(out);
  }
  return { osmBase: base, areaFound, elements };
}

/**
 * One POST per call (Private.coffee asks for POST). Only the mapped result is cached (in memory), keyed by the query.
 * No Curitiba area in the answer means the instance could not resolve it: source_unavailable, never "nothing found".
 */
function cachedQuery<T>(query: string, map: (r: OverpassResult) => T): Promise<Cached<T>> {
  return sharedCache.getOrLoad(`POST ${OVERPASS_URL} data=${query}`, async () => {
    const res = await fetchText(OVERPASS_URL, {
      method: "POST",
      form: { data: query },
      timeoutMs: OVERPASS_TIMEOUT_MS,
      maxBytes: OVERPASS_MAX_BYTES,
    });
    let json: unknown;
    try {
      json = JSON.parse(res.body);
    } catch {
      throw new SourceUnavailableError("Overpass response is not JSON");
    }
    const parsed = parseOverpass(json);
    if (!parsed.areaFound) throw new SourceUnavailableError("Curitiba area not found on the Overpass instance");
    return map(parsed);
  });
}

/** Free text as tagged, unless the PII guard finds something to mask; only then the masked text. Empty is null. */
export function guarded(v: string | undefined): string | null {
  if (v === undefined || v.trim() === "") return null;
  const m = maskObject(v);
  return m.text.includes(MASK) || m.truncated ? m.text : v;
}

/** Structured values (opening hours, house number, postcode) as tagged; the phone mask would eat "0800-1700". */
function plain(v: string | undefined): string | null {
  return v === undefined || v.trim() === "" ? null : v;
}

/** http(s) only, no username or password; anything else is dropped. */
export function safeWebsite(v: string | undefined): string | null {
  if (v === undefined) return null;
  try {
    const u = new URL(v.trim());
    return (u.protocol === "https:" || u.protocol === "http:") && u.username === "" && u.password === "" ? u.href : null;
  } catch {
    return null;
  }
}

function coords(e: RawElement): { lat: number; lon: number } | null {
  if (e.lat !== undefined && e.lon !== undefined) return { lat: e.lat, lon: e.lon };
  return e.center ?? null;
}

export interface Place {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  name: string | null;
  category: PlaceCategory;
  address: {
    street: string | null;
    housenumber: string | null;
    suburb: string | null;
    postcode: string | null;
    city: string | null;
  };
  lat: number | null;
  lon: number | null;
  opening_hours: string | null;
  website: string | null;
  osm_url: string;
}

export function toPlace(e: RawElement, category: PlaceCategory): Place {
  const t = e.tags;
  const c = coords(e);
  return {
    osm_type: e.type,
    osm_id: e.id,
    name: guarded(t.name),
    category,
    address: {
      street: guarded(t["addr:street"]),
      housenumber: plain(t["addr:housenumber"]),
      suburb: guarded(t["addr:suburb"]),
      postcode: plain(t["addr:postcode"]),
      city: guarded(t["addr:city"]),
    },
    lat: c?.lat ?? null,
    lon: c?.lon ?? null,
    opening_hours: plain(t.opening_hours),
    website: safeWebsite(t.website ?? t["contact:website"]),
    osm_url: osmUrl(e.type, e.id),
  };
}

export function getPlaces(category: PlaceCategory): Promise<Cached<{ osmBase: string | null; places: Place[] }>> {
  const [k, v] = PLACE_CATEGORIES[category];
  return cachedQuery(placesQuery(category), (r) => ({
    osmBase: r.osmBase,
    // Keep only what the query asked for, in case the server returns anything else.
    places: r.elements.filter((e) => e.tags[k] === v).map((e) => toPlace(e, category)),
  }));
}

export interface BusRoute {
  osm_id: number;
  ref: string | null;
  name: string | null;
  from: string | null;
  to: string | null;
  operator: string | null;
  network: string | null;
  osm_url: string;
}

function isBusRoute(e: RawElement): boolean {
  return e.type === "relation" && e.tags.type === "route" && e.tags.route === "bus";
}

export function toBusRoute(e: RawElement): BusRoute {
  const t = e.tags;
  return {
    osm_id: e.id,
    ref: guarded(t.ref),
    name: guarded(t.name),
    from: guarded(t.from),
    to: guarded(t.to),
    operator: guarded(t.operator),
    network: guarded(t.network),
    osm_url: osmUrl("relation", e.id),
  };
}

export function getBusRoutes(): Promise<Cached<{ osmBase: string | null; routes: BusRoute[] }>> {
  return cachedQuery(busRoutesQuery(), (r) => ({ osmBase: r.osmBase, routes: r.elements.filter(isBusRoute).map(toBusRoute) }));
}

export interface BusStop {
  seq: number;
  name: string | null;
  lat: number | null;
  lon: number | null;
  osm_type: "node" | "way";
  osm_id: number;
}

const STOP_ROLE = /^(stop|platform)(_entry_only|_exit_only)?$/;

function looksLikeStop(e: RawElement): boolean {
  const t = e.tags;
  return t.highway === "bus_stop" || t.public_transport === "platform" || t.public_transport === "stop_position";
}

/**
 * The route's stops in member order: members whose role is stop/platform (PTv2), or untagged-role nodes that are
 * bus stops (older PTv1 routes). A stop position and its platform usually come as a pair with the same name; a
 * member with the same name as the one just kept is merged into it.
 */
export function orderedStops(route: RawElement, elements: RawElement[]): { stops: BusStop[]; truncated: boolean } {
  const byKey = new Map(elements.filter((e) => e.type !== "relation").map((e) => [`${e.type}/${e.id}`, e]));
  const stops: BusStop[] = [];
  let lastName: string | null = null;
  let truncated = false;
  for (const m of route.members ?? []) {
    if (m.type !== "node" && m.type !== "way") continue;
    const e = byKey.get(`${m.type}/${m.ref}`);
    if (!e) continue;
    if (!STOP_ROLE.test(m.role) && !(m.type === "node" && looksLikeStop(e))) continue;
    const name = guarded(e.tags.name);
    if (name !== null && name === lastName) continue;
    if (stops.length >= MAX_STOPS) {
      truncated = true;
      break;
    }
    lastName = name;
    const c = coords(e);
    stops.push({ seq: stops.length + 1, name, lat: c?.lat ?? null, lon: c?.lon ?? null, osm_type: m.type, osm_id: m.ref });
  }
  return { stops, truncated };
}

export function getBusRoute(
  id: number,
): Promise<Cached<{ osmBase: string | null; route: (BusRoute & { stops: BusStop[]; stops_truncated: boolean }) | null }>> {
  return cachedQuery(busRouteQuery(id), (r) => {
    const rel = r.elements.find((e) => isBusRoute(e) && e.id === id);
    if (!rel) return { osmBase: r.osmBase, route: null };
    const { stops, truncated } = orderedStops(rel, r.elements);
    return { osmBase: r.osmBase, route: { ...toBusRoute(rel), stops, stops_truncated: truncated } };
  });
}
