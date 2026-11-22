import { TtlCache, type Cached } from "../cache.js";
import { fetchText, RateLimitedError, SourceUnavailableError } from "../http.js";
import { cleanField, EVENT_PLACE_MAX, EVENT_TITLE_MAX } from "../mask.js";
import { decodeEntities } from "../text.js";

/** Centro Cultural Teatro Guaíra (Governo do Paraná). robots.txt allows the calendar and event pages (2026-11-22). */
export const GUAIRA_ORIGIN = "https://www.teatroguaira.pr.gov.br";
export const CALENDAR_PATH = "/calendario-eventos";
export const CALENDAR_URL = `${GUAIRA_ORIGIN}${CALENDAR_PATH}`;
export const ROBOTS_URL = `${GUAIRA_ORIGIN}/robots.txt`;
export const EVENT_PATH_PREFIX = "/Evento";

/** Listing pages read per load at most (3 pages held all 32 cards on 2026-11-22). */
export const MAX_LIST_PAGES = 3;
/** Uncached event pages read per call at most. */
export const MAX_DETAILS_PER_CALL = 2;
export const LISTING_CACHE_TTL_MS = 60 * 60 * 1000;
export const ROBOTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const DETAILS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** A listing page was about 72 KB and an event page about 65 KB when checked. */
export const GUAIRA_MAX_BYTES = 1024 * 1024;
export const ROBOTS_MAX_BYTES = 512 * 1024;
export const GUAIRA_TIMEOUT_MS = 15_000;
const CITY_MAX = 60;
const AGENT_TOKEN = "curitibai-mcp";

/** The fixed URL of listing page `n` (0-based); nothing from the user's input is ever added. */
export function listingPageUrl(n: number): string {
  return n === 0 ? CALENDAR_URL : `${CALENDAR_URL}?page=${n}`;
}

/** The listing or an event page no longer has the expected shape: nothing is returned (fail closed). */
export class LayoutChangedError extends Error {
  constructor(readonly detail: string) {
    super(`layout_changed: ${detail}`);
    this.name = "LayoutChangedError";
  }
}

/** robots.txt now disallows the calendar path for this server. */
export class RobotsDisallowedError extends Error {
  constructor(readonly path: string) {
    super("robots.txt disallows the path");
    this.name = "RobotsDisallowedError";
  }
}

// ---------------------------------------------------------------- robots.txt

export interface RobotsRule {
  allow: boolean;
  pattern: string;
}

/**
 * The rules that apply to this server: the groups naming `curitibai-mcp` when there are any, else the `*` groups
 * (RFC 9309 group selection). An empty list allows everything.
 */
export function parseRobots(body: string): RobotsRule[] {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of body.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const at = line.indexOf(":");
    if (at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === "user-agent") {
      if (!lastWasAgent || current === null) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current === null || (key !== "allow" && key !== "disallow")) continue;
    if (value === "") continue; // "Disallow:" with no path allows everything
    current.rules.push({ allow: key === "allow", pattern: value });
  }
  const mine = groups.filter((g) => g.agents.includes(AGENT_TOKEN));
  const chosen = mine.length > 0 ? mine : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

function ruleMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${re}${anchored ? "$" : ""}`).test(path);
}

/** Longest matching pattern wins; on a tie Allow wins; no match allows (RFC 9309 2.2.2). */
export function isPathAllowed(rules: readonly RobotsRule[], path: string): boolean {
  let best: RobotsRule | null = null;
  for (const r of rules) {
    if (!ruleMatches(r.pattern, path)) continue;
    if (best === null || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return best === null || best.allow;
}

// ---------------------------------------------------------------- listing parser

export interface ListingRow {
  title: string;
  /** YYYY-MM-DDTHH:MM, Curitiba local time. */
  start: string;
  end: string;
  city: string;
  state: string;
  link: string;
}

export interface ListingPage {
  rows: ListingRow[];
  hasNext: boolean;
}

const SLUG_PATH = /^\/Evento\/[A-Za-z0-9-]{1,200}$/;
const TITLE_LINK = /<h3><a href="([^"]*)"[^>]*>([^<]*)<\/a><\/h3>/g;
const DATE_TIME = String.raw`(\d{2})\/(\d{2})\/(\d{4}) - (\d{2}):(\d{2})`;
const START = new RegExp(String.raw`<strong>Início:\s*<\/strong>\s*${DATE_TIME}\s*<\/p>`, "g");
const END = new RegExp(String.raw`<strong>Término:\s*<\/strong>\s*${DATE_TIME}\s*<\/p>`, "g");
const LOCAL = /<strong>Local:<\/strong>([^<]*)<\/p>/g;
const CITY_STATE = /^(\p{L}[\p{L} .'-]{0,58}?)\s*-\s*([A-Z]{2})$/u;

function one(re: RegExp, s: string, what: string): RegExpExecArray {
  const all = [...s.matchAll(re)];
  if (all.length !== 1) throw new LayoutChangedError(`${what}: ${all.length} matches in a card`);
  return all[0] as RegExpExecArray;
}

function dateTime(m: RegExpExecArray): string {
  const [, dd, mm, yyyy, hh, mi] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  const real = d.getUTCFullYear() === Number(yyyy) && d.getUTCMonth() === Number(mm) - 1 && d.getUTCDate() === Number(dd);
  if (!real || Number(hh) > 23 || Number(mi) > 59) throw new LayoutChangedError("not a real date");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function card(html: string): ListingRow {
  const t = one(TITLE_LINK, html, "title link");
  const href = t[1] as string;
  if (!SLUG_PATH.test(href)) throw new LayoutChangedError("event link");
  // Every event link of the card (title and "Saiba mais") points to the same page.
  for (const m of html.matchAll(/href="(\/Evento\/[^"]*)"/g)) if (m[1] !== href) throw new LayoutChangedError("two event links in a card");
  const start = dateTime(one(START, html, "Início"));
  const end = dateTime(one(END, html, "Término"));
  if (end < start) throw new LayoutChangedError("end before start");
  const place = decodeEntities(one(LOCAL, html, "Local")[1] as string).replace(/\s+/g, " ").trim();
  const cs = CITY_STATE.exec(place);
  if (cs === null) throw new LayoutChangedError("city");
  const title = cleanField(decodeEntities(t[2] as string), EVENT_TITLE_MAX);
  if (title === "") throw new LayoutChangedError("empty title");
  return { title, start, end, city: cleanField(cs[1] as string, CITY_MAX), state: cs[2] as string, link: `${GUAIRA_ORIGIN}${href}` };
}

/**
 * Reads one listing page (0-based `n`). Fails closed (LayoutChangedError) unless there is exactly one view block, at
 * least one card, every card has exactly one title link, start, end and city in the expected formats, and the
 * "Carregar mais" link, when present, points to page n + 1 of the calendar.
 */
export function parseListingPage(html: string, n: number): ListingPage {
  const blocks = html.split('<div class="view-content">');
  if (blocks.length !== 2) throw new LayoutChangedError("view block");
  // The card list ends at its first </ul> (cards hold no list): markup after it never reaches the last card.
  const listEnd = (blocks[1] as string).indexOf("</ul>");
  if (listEnd < 0) throw new LayoutChangedError("card list");
  const cards = (blocks[1] as string).slice(0, listEnd).split('<li class="card').slice(1);
  if (cards.length === 0) throw new LayoutChangedError("no cards");
  const rows = cards.map(card);
  const next = [...html.matchAll(/<a\b[^>]*\brel="next"[^>]*>/g)];
  if (next.length > 1) throw new LayoutChangedError("pager");
  if (next.length === 1) {
    const href = /\bhref="([^"]*)"/.exec(next[0]![0])?.[1];
    if (href === undefined) throw new LayoutChangedError("pager");
    const u = new URL(decodeEntities(href), CALENDAR_URL);
    if (u.origin !== GUAIRA_ORIGIN || u.pathname !== CALENDAR_PATH || u.searchParams.get("page") !== String(n + 1)) {
      throw new LayoutChangedError("pager");
    }
  }
  return { rows, hasNext: next.length === 1 };
}

// ---------------------------------------------------------------- event page parser

export type DetailsStatus = "read" | "not_read" | "not_recognised" | "unavailable";

export interface EventDetails {
  status: DetailsStatus;
  venue: string | null;
  age_rating: string | null;
  price: string | null;
}

export const NO_DETAILS = (status: DetailsStatus): EventDetails => ({ status, venue: null, age_rating: null, price: null });

const BODY_FIELD = "field--name-field-texto";
const VENUE = /<strong>Local:\s*<\/strong>\s*([^<]{1,200})</g;
const AGE = /<strong>Classificação etária:\s*<\/strong>\s*([^<]{1,80})</g;
const TICKETS = /<strong>Ingressos:\s*<\/strong>\s*([^<]{1,300})/g;
const AMOUNT = String.raw`R\$\s?\d{1,5}(?:\.\d{3})*(?:,\d{2})?(?:\s*\([\p{L} -]{1,30}\))?`;
/** After a value only the end of the text, or the end of a sentence (". " and more), may follow; else null. */
const VALUE_END = String.raw`(?=\.?$|\.\s)`;
const PRICE_RUN = new RegExp(String.raw`^${AMOUNT}(?:\s*\|\s*${AMOUNT}){0,5}${VALUE_END}`, "u");
const FREE = new RegExp(String.raw`^(gratuito|entrada gratuita|entrada franca)${VALUE_END}`, "iu");
const AGE_VALUE = new RegExp(String.raw`^(livre|\d{1,2}\s*anos)${VALUE_END}`, "iu");

function single(re: RegExp, s: string): string | null {
  const all = [...s.matchAll(re)];
  return all.length === 1 ? decodeEntities(all[0]![1] as string).replace(/\s+/g, " ").trim() : null;
}

/**
 * Reads venue, age rating and price from an event page's body field, strictly: anything not in the expected shape is
 * null, never guessed. A page without exactly one body field is `not_recognised`. Nothing else (cast, directors,
 * programme, contacts) is read.
 */
export function parseEventPage(html: string): EventDetails {
  const parts = html.split(BODY_FIELD);
  if (parts.length !== 2) return NO_DETAILS("not_recognised");
  const rest = parts[1] as string;
  const close = rest.indexOf("</div>");
  if (close < 0) return NO_DETAILS("not_recognised");
  const body = rest.slice(0, close);
  const venueRaw = single(VENUE, body);
  const venue = venueRaw === null ? null : cleanField(venueRaw, EVENT_PLACE_MAX) || null;
  const ageRaw = single(AGE, body);
  const age = ageRaw === null ? null : AGE_VALUE.exec(ageRaw)?.[1] ?? null;
  const ticketsRaw = single(TICKETS, body);
  const price = ticketsRaw === null ? null : (PRICE_RUN.exec(ticketsRaw)?.[0] ?? FREE.exec(ticketsRaw)?.[1] ?? null);
  return {
    status: "read",
    venue,
    age_rating: age === null ? null : /^livre$/i.test(age) ? "Livre" : age.replace(/\s+/g, " "),
    price: price === null ? null : cleanField(price, 120),
  };
}

// ---------------------------------------------------------------- request gate

/** At least this long between two request starts to the host from this process. */
export const GUAIRA_MIN_INTERVAL_MS = 5_000;
/** A request whose turn would come later than this is not made (rate_limited with the wait). */
export const GUAIRA_MAX_QUEUE_WAIT_MS = 10_000;
/** After a failure no request to the host for 60 s, or a 429's Retry-After when longer, at most 1 hour. */
const FAILURE_WAIT_S = 60;
const MAX_FAILURE_WAIT_S = 3600;

let nextAllowedAt = 0;
let retryAt = 0;
let lastError: unknown = null;

// `() => Date.now()` (not Date.now itself) so a faked clock in tests reaches the caches.
const listingCache = new TtlCache(LISTING_CACHE_TTL_MS, () => Date.now());
const robotsCache = new TtlCache(ROBOTS_CACHE_TTL_MS, () => Date.now());
const detailsCache = new Map<string, { value: EventDetails; expiresAt: number }>();

/** Tests only. */
export function clearGuairaState(): void {
  listingCache.clear();
  robotsCache.clear();
  detailsCache.clear();
  nextAllowedAt = 0;
  retryAt = 0;
  lastError = null;
}

function rememberedFailure(now: number): unknown {
  if (now >= retryAt) return null;
  return lastError instanceof RateLimitedError ? new RateLimitedError(Math.ceil((retryAt - now) / 1000)) : lastError;
}

/**
 * Runs one request to the host (same pattern as GeoCuritiba's gate): refused at once while a failure is remembered;
 * otherwise waits for its 5-second slot (or gives up with rate_limited when that slot is more than 10 s away); any
 * failure, a layout change included, is then remembered for at least 60 s (a 429's Retry-After when longer, at most
 * 1 hour). Never retried.
 */
async function gated<T>(task: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const failed = rememberedFailure(now);
  if (failed !== null) throw failed;
  const start = Math.max(now, nextAllowedAt);
  if (start - now > GUAIRA_MAX_QUEUE_WAIT_MS) throw new RateLimitedError(Math.ceil((start - now) / 1000));
  nextAllowedAt = start + GUAIRA_MIN_INTERVAL_MS;
  if (start > now) await new Promise((resolve) => setTimeout(resolve, start - now));
  const failedMeanwhile = rememberedFailure(Date.now());
  if (failedMeanwhile !== null) throw failedMeanwhile;
  try {
    return await task();
  } catch (err) {
    const asked = err instanceof RateLimitedError ? (err.retryAfterS ?? 0) : 0;
    const wait = Math.min(Math.max(FAILURE_WAIT_S, asked), MAX_FAILURE_WAIT_S);
    retryAt = Date.now() + wait * 1000;
    lastError = err instanceof RateLimitedError ? new RateLimitedError(wait) : err;
    throw lastError;
  }
}

async function getHtml(url: string, pathPrefix: string): Promise<string> {
  const res = await fetchText(url, {
    timeoutMs: GUAIRA_TIMEOUT_MS,
    maxBytes: GUAIRA_MAX_BYTES,
    sameHostOnly: true,
    redirectPathPrefix: pathPrefix,
  });
  if (!/^text\/html\b/i.test(res.contentType.trim())) throw new SourceUnavailableError("not HTML");
  return res.body;
}

/**
 * The robots.txt rules for this server, read through the gate and cached 24 h. A 404 or 410 means no rules; any
 * other failure (other 4xx included, which RFC 9309 would read as "allow"), or an answer that is not text/plain,
 * fails closed: stricter than the RFC on purpose.
 */
function getRobotsRules(): Promise<Cached<RobotsRule[]>> {
  return robotsCache.getOrLoad("robots", () =>
    gated(async () => {
      try {
        const res = await fetchText(ROBOTS_URL, { timeoutMs: GUAIRA_TIMEOUT_MS, maxBytes: ROBOTS_MAX_BYTES, sameHostOnly: true });
        if (!/^text\/plain\b/i.test(res.contentType.trim())) throw new SourceUnavailableError("robots.txt not text/plain");
        return parseRobots(res.body);
      } catch (err) {
        if (err instanceof SourceUnavailableError && (err.reason === "HTTP 404" || err.reason === "HTTP 410")) return [];
        throw err;
      }
    }),
  );
}

/** Throws RobotsDisallowedError when robots.txt disallows `pathAndQuery` for this server. */
async function assertAllowed(pathAndQuery: string): Promise<void> {
  const rules = (await getRobotsRules()).value;
  if (!isPathAllowed(rules, pathAndQuery)) throw new RobotsDisallowedError(pathAndQuery);
}

export interface Listing {
  rows: ListingRow[];
  /** The last page read still had a "Carregar mais" link: later events were not read. */
  truncated: boolean;
}

/**
 * The whole calendar: listing pages 0, 1, 2 (fixed URLs) until one has no "Carregar mais" link, each checked against
 * robots.txt and read through the gate; cached 1 hour as one entry. Any failure fails the whole load (nothing
 * partial is cached). Rows are de-duplicated by link.
 */
export function getListing(): Promise<Cached<Listing>> {
  return listingCache.getOrLoad("listing", async () => {
    const rows: ListingRow[] = [];
    const seen = new Set<string>();
    for (let n = 0; n < MAX_LIST_PAGES; n++) {
      const url = listingPageUrl(n);
      const u = new URL(url);
      await assertAllowed(`${u.pathname}${u.search}`);
      const pageRes = await gated(async () => parseListingPage(await getHtml(url, CALENDAR_PATH), n));
      for (const r of pageRes.rows) {
        if (seen.has(r.link)) continue;
        seen.add(r.link);
        rows.push(r);
      }
      if (!pageRes.hasNext) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  });
}

/** Cached details for an event link, or null when not cached (or expired). Never makes a request. */
export function cachedDetails(link: string): EventDetails | null {
  const hit = detailsCache.get(link);
  if (hit === undefined) return null;
  if (hit.expiresAt > Date.now()) return hit.value;
  detailsCache.delete(link);
  return null;
}

/**
 * Reads up to `max` uncached event pages for `links` (in order) through the gate and caches each 6 hours (a 404 or
 * 410 page as `unavailable`, without a host failure). Stops at the first request that fails (that link is
 * `unavailable`) or cannot be made (no slot, a failure remembered, robots.txt: it stays `not_read`); the rest stay
 * `not_read`. Never throws.
 */
export async function readDetails(links: readonly string[], max: number = MAX_DETAILS_PER_CALL): Promise<{ details: Map<string, EventDetails>; stopped: "robots" | "failed" | "busy" | null }> {
  const details = new Map<string, EventDetails>();
  let fetched = 0;
  let stopped: "robots" | "failed" | "busy" | null = null;
  for (const link of links) {
    const hit = cachedDetails(link);
    if (hit !== null) {
      details.set(link, hit);
      continue;
    }
    if (stopped !== null || fetched >= max) continue;
    fetched++;
    try {
      await assertAllowed(new URL(link).pathname);
    } catch (err) {
      // robots.txt could not be read (no slot, a failure remembered): no event page was asked for.
      stopped = err instanceof RobotsDisallowedError ? "robots" : "busy";
      continue;
    }
    let asked = false;
    try {
      const value = await gated(async () => {
        asked = true;
        try {
          return parseEventPage(await getHtml(link, EVENT_PATH_PREFIX));
        } catch (err) {
          // A removed event (404/410) is a fact about that page, not a host failure: cached, not remembered.
          if (err instanceof SourceUnavailableError && (err.reason === "HTTP 404" || err.reason === "HTTP 410")) return NO_DETAILS("unavailable");
          throw err;
        }
      });
      detailsCache.set(link, { value, expiresAt: Date.now() + DETAILS_CACHE_TTL_MS });
      details.set(link, value);
    } catch {
      // Refused by the gate before a request (no slot, a failure remembered): this page stays not_read.
      if (asked) details.set(link, NO_DETAILS("unavailable"));
      stopped = asked ? "failed" : "busy";
    }
  }
  return { details, stopped };
}
