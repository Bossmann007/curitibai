import { TtlCache, type Cached } from "../cache.js";
import { fetchText, SourceUnavailableError } from "../http.js";
import { cleanField } from "../mask.js";
import { decodeEntities } from "../text.js";

/** The Prefeitura's "Imuniza Já" list of vaccination sites. The only URL this source requests. */
export const VACCINATION_URL = "https://imunizaja.curitiba.pr.gov.br/locaisvacinacao/";
/** The page was about 300 KB when checked (2026-11-21). */
export const VACCINATION_MAX_BYTES = 1024 * 1024;
export const VACCINATION_TIMEOUT_MS = 15_000;
/** The page shows no update date; 6 hours keeps the load on the city's site to a few requests a day. */
export const VACCINATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** More than this share of units that do not fit the known structure means the page changed: fail closed. */
export const MAX_SKIPPED_SHARE = 0.05;
/** A sanity bound: 101 units when checked. */
const MAX_UNITS = 1000;

export const NAME_MAX = 120;
export const ADDRESS_MAX = 160;
export const REGIONAL_MAX = 60;
export const LINE_MAX = 100;
const MAX_HOUR_LINES = 10;
const MAX_VACCINE_LINES = 30;

/** Loose bounding box around Curitiba; a coordinate outside it is treated as missing. */
const LAT_RANGE = [-25.7, -25.3] as const;
const LON_RANGE = [-49.45, -49.15] as const;

export interface VaccinationSite {
  name: string;
  address: string | null;
  regional: string;
  hours: string[];
  vaccines: string[];
  lat: number | null;
  lon: number | null;
}

export interface VaccinationPage {
  sites: VaccinationSite[];
  /** Units on the page that did not fit the known structure and were left out. */
  skipped: number;
}

const ID = "ContentPlaceHolder1_rptRegionais_";
const REGIONAL = new RegExp(`<span id="${ID}lblRegional_(\\d{1,3})">([^<]{0,300})</span>`, "g");
const NAME = new RegExp(`<span id="${ID}rptUnidades_(\\d{1,3})_lblUnidadeNome_(\\d{1,4})">([^<]{0,500})</span>`, "g");
const ADDRESS = new RegExp(`<span id="${ID}rptUnidades_(\\d{1,3})_lblUnidadeEndereco_(\\d{1,4})">([^<]{0,500})</span>`, "g");
/**
 * One schedule block: the rich-text `lblEstrategia_K` span, closed right before its sibling `lblHorario_K` span. The
 * inner part is bounded, so a missing sibling cannot make the match run across the page.
 */
const SCHEDULE = new RegExp(
  `<span id="${ID}rptUnidades_(\\d{1,3})_rptHorarios_(\\d{1,4})_lblEstrategia_(\\d{1,2})">([\\s\\S]{0,4000}?)</span>\\s*` +
    `<span id="${ID}rptUnidades_\\1_rptHorarios_\\2_lblHorario_\\3">([^<]{0,500})</span>`,
  "g",
);
const MAP_LINK = new RegExp(`<a href="([^"<>]{0,300})" id="${ID}rptUnidades_(\\d{1,3})_lblVerNoMapa_(\\d{1,4})"`, "g");
/** The only map link shape read, and only for its two numbers; the link itself is never returned. */
const COORDS = /^https:\/\/maps\.google\.com\/\?q=(-?\d{1,3}\.\d{1,12}),(-?\d{1,3}\.\d{1,12})$/;
/** Tokens allowed inside a schedule block; anything else left over means the block is not understood. */
const SPAN = /<span style='font-weight:(normal|bold)'>([^<]{0,300})<\/span>/g;
const BR = /<br\s*\/?>/i;

function plain(s: string): string {
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

function coords(href: string): { lat: number; lon: number } | null {
  const m = COORDS.exec(decodeEntities(href));
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  const inside = lat >= LAT_RANGE[0] && lat <= LAT_RANGE[1] && lon >= LON_RANGE[0] && lon <= LON_RANGE[1];
  return inside ? { lat, lon } : null;
}

/**
 * Hours lines (all spans normal weight) and vaccine lines (all bold), as published, from one schedule block.
 * Null when the block holds anything else (other tags, text outside the spans, a line mixing both weights).
 */
function schedule(inner: string): { hours: string[]; vaccines: string[] } | null {
  const body = inner.trim().replace(/^<b>/i, "").replace(/<\/b>$/i, "");
  const hours: string[] = [];
  const vaccines: string[] = [];
  for (const line of body.split(BR)) {
    if (line.trim() === "") continue;
    const weights = new Set<string>();
    const text = line.replace(SPAN, (_, weight: string, t: string) => {
      weights.add(weight);
      return t;
    });
    if (weights.size !== 1 || line.replace(SPAN, "").trim() !== "") return null;
    const value = plain(text);
    if (value === "") continue;
    (weights.has("bold") ? vaccines : hours).push(value);
  }
  return { hours, vaccines };
}

/**
 * Reads the page by its known ASP.NET ids only (never the whole page text): regional headers, unit name, address,
 * schedule blocks and the map link (coordinates only). Every text field goes through cleanField (control and format
 * characters, NFC, PII masking, length cap). A unit missing a name, regional or hours, or with a schedule block that
 * does not fit, is skipped and counted. No unit at all, or more than 5% skipped, is a format change: source_unavailable.
 */
export function parseVaccinationPage(html: string): VaccinationPage {
  const regionals = new Map<string, string>();
  for (const m of html.matchAll(REGIONAL)) {
    regionals.set(m[1]!, cleanField(plain(m[2]!).replace(/^Regional\s+/i, ""), REGIONAL_MAX));
  }
  const addresses = new Map<string, string>();
  for (const m of html.matchAll(ADDRESS)) addresses.set(`${m[1]}_${m[2]}`, m[3]!);
  const maps = new Map<string, string>();
  for (const m of html.matchAll(MAP_LINK)) maps.set(`${m[2]}_${m[3]}`, m[1]!);
  const blocks = new Map<string, { inner: string; extra: string }[]>();
  for (const m of html.matchAll(SCHEDULE)) {
    const key = `${m[1]}_${m[2]}`;
    const list = blocks.get(key) ?? [];
    list.push({ inner: m[4]!, extra: m[5]! });
    blocks.set(key, list);
  }

  const sites: VaccinationSite[] = [];
  let units = 0;
  let skipped = 0;
  for (const m of html.matchAll(NAME)) {
    units++;
    if (units > MAX_UNITS) throw new SourceUnavailableError("too many vaccination units");
    const key = `${m[1]}_${m[2]}`;
    const name = cleanField(plain(m[3]!), NAME_MAX);
    const regional = regionals.get(m[1]!);
    const hours: string[] = [];
    const vaccines: string[] = [];
    let understood = true;
    for (const b of blocks.get(key) ?? []) {
      const s = schedule(b.inner);
      if (s === null) {
        understood = false;
        break;
      }
      hours.push(...s.hours);
      vaccines.push(...s.vaccines);
      const extra = plain(b.extra);
      if (extra !== "") hours.push(extra);
    }
    if (!understood || name === "" || !regional || hours.length === 0) {
      skipped++;
      continue;
    }
    const rawAddress = addresses.get(key);
    const address = rawAddress === undefined ? "" : cleanField(plain(rawAddress), ADDRESS_MAX);
    const href = maps.get(key);
    const at = href === undefined ? null : coords(href);
    sites.push({
      name,
      address: address === "" ? null : address,
      regional,
      hours: hours.slice(0, MAX_HOUR_LINES).map((h) => cleanField(h, LINE_MAX)),
      vaccines: vaccines.slice(0, MAX_VACCINE_LINES).map((v) => cleanField(v, LINE_MAX)),
      lat: at?.lat ?? null,
      lon: at?.lon ?? null,
    });
  }
  if (units === 0) throw new SourceUnavailableError("no vaccination units found");
  if (skipped / units > MAX_SKIPPED_SHARE) throw new SourceUnavailableError("vaccination page format changed");
  return { sites, skipped };
}

const cache = new TtlCache(VACCINATION_CACHE_TTL_MS);

/** Tests only. */
export function clearVaccinationCache(): void {
  cache.clear();
}

/** One GET of the page per cache period; same host only on redirects. Only the parsed result is cached (in memory). */
export function getVaccinationSites(): Promise<Cached<VaccinationPage>> {
  return cache.getOrLoad(`GET ${VACCINATION_URL}`, async () => {
    const res = await fetchText(VACCINATION_URL, {
      timeoutMs: VACCINATION_TIMEOUT_MS,
      maxBytes: VACCINATION_MAX_BYTES,
      sameHostOnly: true,
    });
    if (!/^text\/html\b/i.test(res.contentType.trim())) throw new SourceUnavailableError("not an HTML page");
    return parseVaccinationPage(res.body);
  });
}
