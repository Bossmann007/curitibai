import { sharedCache, type Cached } from "../cache.js";
import { fetchText, RateLimitedError, SourceUnavailableError } from "../http.js";
import { MASK, maskObject } from "./pncp.js";

/**
 * Overpass instance run by dresel.systems, South America region (holds Brazil). Its robots.txt is 404; free, no API key,
 * 4 parallel queries per IP, asks for an identifying User-Agent. overpass-api.de is not used: its robots.txt disallows
 * /api/. overpass.private.coffee did not answer on 2026-11-21. See docs/sources.md.
 */
export const OVERPASS_URL = "https://ovp.dresel.systems/api-sa/interpreter";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors, ODbL";
/** The server-side limit written into every query; the client waits a little longer for the answer to arrive. */
export const OVERPASS_QUERY_TIMEOUT_S = 25;
export const OVERPASS_TIMEOUT_MS = 30_000;
/** The largest category (park) was 450 KB on 2026-11-21; 3 MB leaves room to grow. */
export const OVERPASS_MAX_BYTES = 3 * 1024 * 1024;

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

export function osmUrl(type: string, id: number): string {
  return `https://www.openstreetmap.org/${type}/${id}`;
}

export function osmLicenseNote(osmBase: string | null, fetchedAt: string): string {
  return (
    `${OSM_ATTRIBUTION} (${OSM_COPYRIGHT_URL}). Data from OpenStreetMap via the Overpass API (${OVERPASS_URL}), ` +
    `fetched at ${fetchedAt}; OSM data as of ${osmBase ?? "an unknown time (the server did not say)"}. ` +
    "OpenStreetMap is community-edited and may be incomplete or outdated. " +
    "Unofficial; not affiliated with OpenStreetMap, the OSM Foundation or Prefeitura de Curitiba."
  );
}

interface RawElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
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
    elements.push(out);
  }
  return { osmBase: base, areaFound, elements };
}

/** A call that waited this long for its turn gives up without a request, so it ends well inside a 60 s client timeout. */
export const OVERPASS_MAX_QUEUE_WAIT_MS = 20_000;
/** Pause after an HTTP 429 without Retry-After. */
const DEFAULT_COOLDOWN_S = 60;

let queue: Promise<unknown> = Promise.resolve();
/** Until this time (ms) no request is sent: calls answer rate_limited at once. Set by an HTTP 429. */
let cooldownUntil = 0;

/**
 * Never more than one Overpass request in flight from this server process (the instance allows 4 parallel per IP).
 * After a 429 every queued call answers rate_limited without a request until the wait is over.
 */
export function oneAtATime<T>(task: () => Promise<T>, now: () => number = Date.now): Promise<T> {
  const queuedAt = now();
  const guarded = async (): Promise<T> => {
    const t = now();
    if (t < cooldownUntil) throw new RateLimitedError(Math.ceil((cooldownUntil - t) / 1000));
    if (t - queuedAt > OVERPASS_MAX_QUEUE_WAIT_MS) throw new SourceUnavailableError("waited too long for the Overpass queue");
    try {
      return await task();
    } catch (err) {
      if (err instanceof RateLimitedError) cooldownUntil = now() + (err.retryAfterS ?? DEFAULT_COOLDOWN_S) * 1000;
      throw err;
    }
  };
  const run = queue.then(guarded, guarded);
  queue = run.catch(() => undefined);
  return run;
}

/** Tests only: forget a 429 pause. */
export function resetOverpassCooldown(): void {
  cooldownUntil = 0;
}

/**
 * One POST per call. Only the mapped result is cached (in memory), keyed by the query.
 * No Curitiba area in the answer means the instance could not resolve it: source_unavailable, never "nothing found".
 */
function cachedQuery<T>(query: string, map: (r: OverpassResult) => T): Promise<Cached<T>> {
  return sharedCache.getOrLoad(`POST ${OVERPASS_URL} data=${query}`, async () => {
    const res = await oneAtATime(() =>
      fetchText(OVERPASS_URL, { method: "POST", form: { data: query }, timeoutMs: OVERPASS_TIMEOUT_MS, maxBytes: OVERPASS_MAX_BYTES }),
    );
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
    website: safeWebsite(t.website) ?? safeWebsite(t["contact:website"]),
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
