#!/usr/bin/env node
// Collector for the events_search tool: reads the public events calendar of the Instituto Municipal de Turismo de
// Curitiba (turismo.curitiba.pr.gov.br) and writes CURITIBAI_DATA_DIR/events/events.json and events/status.json.
// Run by hand (or by a scheduler) inside the window the site's robots.txt asks for; the MCP server never contacts
// this host (it is not in src/config.ts ALLOWED_HOSTS). Node built-ins only. See README "Events" and docs/sources.md.
//
// Prints only fixed status lines, counts and the exit code: never page text, titles or HTML.
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { join, relative, isAbsolute, sep } from "node:path";
import { cleanField, EVENT_PLACE_MAX, EVENT_SHORT_MAX, EVENT_TITLE_MAX } from "../src/mask.ts";
import { decodeEntities } from "../src/text.ts";

export const HOST = "turismo.curitiba.pr.gov.br";
/** The only hosts this script contacts (exact match). Separate from the server's ALLOWED_HOSTS on purpose. */
export const ALLOWED_HOSTS = Object.freeze([HOST]);
export const ORIGIN = `https://${HOST}`;
export const USER_AGENT = "curitibai-mcp/0.10";

/** Requests start only between 02:00 and 05:50 UTC (robots.txt Visit-time 0200-0600, with a 10-minute margin). */
export const WINDOW_START_MIN = 2 * 60;
export const WINDOW_END_MIN = 5 * 60 + 50;
export const DEADLINE_MS = 10 * 60 * 1000;
export const TIMEOUT_MS = 15_000;
/** robots.txt Request-rate 1/5: at least 5 s between the end of one request and the start of the next. */
export const GAP_MS = 5_000;
export const LIST_MAX_BYTES = 512 * 1024;
export const DETAIL_MAX_BYTES = 256 * 1024;
export const ROBOTS_MAX_BYTES = 64 * 1024;
/** Hard cap on list pages per run (the site showed 5 pages of 10); a pager showing more stops the run. */
export const MAX_LIST_PAGES = 10;
export const TITLE_MAX = EVENT_TITLE_MAX;
export const PLACE_MAX = EVENT_PLACE_MAX;
export const SHORT_MAX = EVENT_SHORT_MAX;
/** A new count outside [MIN_RATIO, MAX_RATIO] times the previous one is treated as a layout change. */
export const MIN_RATIO = 0.3;
export const MAX_RATIO = 3;

/**
 * robots.txt rules for `User-agent: *` as recorded on 2026-11-21 (docs/sources.md). The run stops before any page
 * request when the live file differs in Disallow, Visit-time or Request-rate. NEEDS A LIVE CHECK: the Disallow list
 * was handed over truncated ("/bin, /Imagem, *.pdf, *.asp..."), so the first real run may stop with robots_changed
 * until the full list is recorded here.
 */
export const RECORDED_ROBOTS = Object.freeze({
  disallow: Object.freeze(["/bin", "/Imagem", "*.pdf", "*.asp"]),
  visitTime: "0200-0600",
  requestRate: "1/5",
});

/**
 * Text that marks an empty list page, which would allow a count of 0. NEEDS A LIVE CHECK: no empty page has been seen,
 * so it is null and a count of 0 always stops with layout_changed.
 */
export const NO_EVENTS_MARKER = null;

const LIST_PATH = /^\/eventos\/\d{2}-\d{2}-\d{4}\/\d+$/;
const DETAIL_PATH = /^\/evento\/[a-z0-9-]+\/\d+$/;
const SLUG = /^[a-z0-9-]{1,200}$/;
const ID = /^[1-9]\d{0,8}$/;

export class StopError extends Error {
  /** @param {string} code @param {number} [httpStatus] */
  constructor(code, httpStatus) {
    super(code);
    this.name = "StopError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ---------- time ----------

/** True when `now` is inside 02:00–05:50 UTC. */
export function inWindow(now) {
  const m = now.getUTCHours() * 60 + now.getUTCMinutes();
  return m >= WINDOW_START_MIN && m < WINDOW_END_MIN;
}

/** Curitiba's calendar date (America/Sao_Paulo) as YYYY-MM-DD. */
export function curitibaDate(now) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** /eventos/DD-MM-AAAA/N for a YYYY-MM-DD date. */
export function listPath(isoDate, page) {
  const [y, m, d] = isoDate.split("-");
  return `/eventos/${d}-${m}-${y}/${page}`;
}

// ---------- robots.txt ----------

/** Groups of `User-agent` lines with their rules. Comments and unknown lines are ignored. */
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!lastWasAgent || current === null) {
        current = { agents: [], allow: [], disallow: [], visitTime: [], requestRate: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current === null) continue;
    if (key === "allow" && value !== "") current.allow.push(value);
    else if (key === "disallow" && value !== "") current.disallow.push(value);
    else if (key === "visit-time") current.visitTime.push(value);
    else if (key === "request-rate") current.requestRate.push(value);
  }
  return groups;
}

/** The group that applies to this script: one naming curitibai-mcp, else `*`; rules of repeated groups are merged. */
export function robotsGroupFor(groups) {
  const pick = (pred) => {
    const hits = groups.filter((g) => g.agents.some(pred));
    if (hits.length === 0) return null;
    return {
      allow: hits.flatMap((g) => g.allow),
      disallow: hits.flatMap((g) => g.disallow),
      visitTime: hits.flatMap((g) => g.visitTime),
      requestRate: hits.flatMap((g) => g.requestRate),
      specific: pred !== isStar,
    };
  };
  const isStar = (a) => a === "*";
  return pick((a) => a === "curitibai-mcp" || a.startsWith("curitibai-mcp/")) ?? pick(isStar);
}

const sameSet = (a, b) => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/** True when the applicable group has exactly the recorded Disallow, Visit-time and Request-rate. */
export function robotsMatchesRecorded(group, recorded = RECORDED_ROBOTS) {
  if (group === null || group.specific) return false;
  return (
    sameSet(group.disallow, recorded.disallow) &&
    group.visitTime.length === 1 &&
    group.visitTime[0] === recorded.visitTime &&
    group.requestRate.length === 1 &&
    group.requestRate[0] === recorded.requestRate
  );
}

/**
 * True when a robots pattern matches `path`: matched from the start of the path, `*` is any run of characters and a
 * final `$` anchors the end. A pattern that does not start with "/" is matched the same way, so `*.asp` matches any
 * path containing ".asp" and `bin` matches nothing that starts with "/".
 */
export function robotsPatternMatches(pattern, path) {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${re}${anchored ? "$" : ""}`, "s").test(path);
}

/** RFC 9309: the longest matching pattern wins; on a tie Allow wins; no match means allowed. */
export function robotsAllows(group, path) {
  let best = { len: -1, allow: true };
  for (const [list, allow] of [
    [group.allow, true],
    [group.disallow, false],
  ]) {
    for (const p of list) {
      if (!robotsPatternMatches(p, path)) continue;
      if (p.length > best.len || (p.length === best.len && allow)) best = { len: p.length, allow };
    }
  }
  return best.allow;
}

// ---------- HTTP ----------

const KNOWN_CHARSETS = new Map([
  ["utf-8", "utf-8"],
  ["utf8", "utf-8"],
  ["iso-8859-1", "windows-1252"],
  ["latin1", "windows-1252"],
  ["windows-1252", "windows-1252"],
]);

/** Charset from the Content-Type header, else from a <meta> in the first 2 KB; null when none is declared. */
export function declaredCharset(contentType, bytes) {
  const fromHeader = /charset\s*=\s*"?([\w-]+)/i.exec(contentType ?? "");
  if (fromHeader) return fromHeader[1].toLowerCase();
  const head = Buffer.from(bytes.subarray(0, 2048)).toString("latin1");
  const fromMeta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head);
  return fromMeta ? fromMeta[1].toLowerCase() : null;
}

/** Decodes with the declared charset; an unknown or missing charset, or invalid UTF-8, is a layout change. */
export function decodeBody(contentType, bytes, fallback = null) {
  const label = KNOWN_CHARSETS.get(declaredCharset(contentType, bytes) ?? fallback ?? "");
  if (label === undefined) throw new StopError("layout_changed");
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    throw new StopError("layout_changed");
  }
}

/** Reads the body, stopping as soon as it passes `maxBytes`. */
async function readCapped(res, maxBytes) {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new StopError("too_large");
  if (res.body === null) return new Uint8Array(0);
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new StopError("too_large");
    }
    parts.push(value);
  }
  return Buffer.concat(parts, total);
}

/**
 * One polite client: every request checks the path allowlist, robots rules (once loaded), the window and the
 * deadline, waits GAP_MS after the previous request, sends only GET with this script's User-Agent, follows no
 * redirect, and stops (no retry) on any non-200 status.
 */
export function createClient({ fetch, now, sleep, startedAt }) {
  let lastEnd = null;
  let robots = null;
  let requests = 0;
  const check = () => {
    const t = now();
    if (t.getTime() - startedAt.getTime() >= DEADLINE_MS) throw new StopError("deadline");
    if (!inWindow(t)) throw new StopError("window_closed");
  };
  async function get(path, maxBytes, fallbackCharset = null) {
    if (path !== "/robots.txt" && !LIST_PATH.test(path) && !DETAIL_PATH.test(path)) throw new StopError("path_not_allowed");
    if (path !== "/robots.txt" && (robots === null || !robotsAllows(robots, path))) throw new StopError("robots_disallowed");
    const url = new URL(path, ORIGIN);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.includes(url.hostname) || url.pathname !== path) {
      throw new StopError("path_not_allowed");
    }
    check();
    if (lastEnd !== null) {
      const wait = lastEnd + GAP_MS - now().getTime();
      if (wait > 0) await sleep(wait);
      check(); // the window or the deadline may have passed while waiting
    }
    const remaining = DEADLINE_MS - (now().getTime() - startedAt.getTime());
    requests += 1;
    let res;
    try {
      res = await fetch(url.href, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(Math.max(1, Math.min(TIMEOUT_MS, remaining))),
      });
    } catch (err) {
      lastEnd = now().getTime();
      throw new StopError(err?.name === "TimeoutError" || err?.name === "AbortError" ? "timeout" : "network");
    }
    try {
      if (res.status >= 300 && res.status < 400) throw new StopError("redirect", res.status);
      if (res.status !== 200) throw new StopError("http_error", res.status);
      const bytes = await readCapped(res, maxBytes);
      return decodeBody(res.headers.get("content-type"), bytes, fallbackCharset);
    } catch (err) {
      if (err instanceof StopError) throw err;
      throw new StopError(err?.name === "TimeoutError" || err?.name === "AbortError" ? "timeout" : "network");
    } finally {
      lastEnd = now().getTime();
    }
  }
  return {
    get,
    setRobots(group) {
      robots = group;
    },
    get requests() {
      return requests;
    },
  };
}

// ---------- parsing (known structure only) ----------

const ITEM = /<div class="itemEventoConteudo">([\s\S]*?)<\/div>/g;
const ITEM_LINK =
  /<h4>\s*<a id="cphMasterPortal_rptEventos_hlkEvento_\d+" href="\/evento\/([a-z0-9-]{1,200})\/([1-9]\d{0,8})">[^<]*<\/a>\s*<\/h4>/;
const PAGER = /<ul id="cphMasterPortal_ucPaginador_ulsPaginacao"[^>]*>([\s\S]*?)<\/ul>/;

/**
 * One list page: the `{id, slug}` of each event block and the highest page number in the pager (capped). The page must
 * be the list for `isoDate` (its date filter shows that date), and every event block must have the known link shape.
 */
export function parseListPage(html, isoDate) {
  const [y, m, d] = isoDate.split("-");
  const filter = `id="cphMasterPortal_txtFiltroDataInicio"`;
  if (html.split(filter).length !== 2) throw new StopError("layout_changed");
  if (!new RegExp(`value="${d}-${m}-${y}"[^>]*${filter}|${filter}[^>]*value="${d}-${m}-${y}"`).test(html)) {
    throw new StopError("layout_changed");
  }
  const items = [];
  for (const block of html.matchAll(ITEM)) {
    const link = ITEM_LINK.exec(block[1]);
    if (link === null || !SLUG.test(link[1]) || !ID.test(link[2])) throw new StopError("layout_changed");
    items.push({ id: Number(link[2]), slug: link[1] });
  }
  if (html.split('class="itemEventoConteudo"').length - 1 !== items.length) throw new StopError("layout_changed");
  let maxPage = 1;
  const pager = PAGER.exec(html);
  if (pager !== null) {
    for (const n of pager[1].matchAll(/>(\d{1,3})<\/a>/g)) maxPage = Math.max(maxPage, Number(n[1]));
  }
  const noEvents = NO_EVENTS_MARKER !== null && html.includes(NO_EVENTS_MARKER);
  // More pages than the cap would mean a partial file with code ok: stop instead.
  if (maxPage > MAX_LIST_PAGES) throw new StopError("layout_changed");
  return { items, maxPage, noEvents };
}

/** Inner text of the one span with this id; null when absent; layout_changed when repeated or holding markup. */
function spanText(html, id, required) {
  const marker = `<span id="cphMasterPortal_${id}"`;
  const count = html.split(marker).length - 1;
  if (count === 0 && !required) return null;
  if (count !== 1) throw new StopError("layout_changed");
  const m = new RegExp(`${marker}[^>]*>([^<]*)</span>`).exec(html);
  if (m === null) throw new StopError("layout_changed");
  return decodeHtml(m[1]);
}

/** HTML 4 Latin-1 entity names, in code point order from U+00A0 (the site writes accents as named entities). */
const LATIN1_NAMES =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro " +
  "para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil " +
  "Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave " +
  "Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml " +
  "igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute " +
  "thorn yuml";
const NAMED = new Map([
  ...LATIN1_NAMES.split(" ").map((name, i) => [name, String.fromCodePoint(0xa0 + i)]),
  ["ndash", "\u2013"], ["mdash", "\u2014"], ["lsquo", "\u2018"], ["rsquo", "\u2019"], ["ldquo", "\u201c"],
  ["rdquo", "\u201d"], ["bull", "\u2022"], ["hellip", "\u2026"], ["euro", "\u20ac"],
]);

/** Entities decoded: the named ones above (case-sensitive, as in HTML), then numeric and basic ones (src/text.ts). */
export function decodeHtml(s) {
  return decodeEntities(s.replace(/&([A-Za-z][A-Za-z0-9]{1,7});/g, (m, name) => NAMED.get(name) ?? m));
}

const DATE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;

/** Every valid DD/MM/YYYY date in the text as YYYY-MM-DD (calendar-checked, years 2000–2100). */
export function parseDates(text) {
  const out = [];
  for (const [, d, m, y] of text.matchAll(DATE)) {
    const t = Date.UTC(Number(y), Number(m) - 1, Number(d));
    const iso = `${y}-${m}-${d}`;
    if (Number(y) >= 2000 && Number(y) <= 2100 && new Date(t).toISOString().slice(0, 10) === iso) out.push(iso);
  }
  return out.sort();
}

/** The event link, built from the validated slug and id (never copied from the page). */
export function eventLink(slug, id) {
  if (!SLUG.test(slug) || !ID.test(String(id))) throw new StopError("layout_changed");
  return `${ORIGIN}/evento/${slug}/${id}`;
}

/**
 * One detail page, reduced to the kept fields. Reads only the known spans (title, category, dates, time, place);
 * the description, ticket, rating, site link, images and everything else on the page are never read.
 */
export function parseDetailPage(html, { id, slug }) {
  const title = cleanField(spanText(html, "lblTitulo", true), TITLE_MAX);
  const category = cleanField(spanText(html, "lblCategoriaEvento", true), SHORT_MAX);
  const dates = parseDates(spanText(html, "lblDatas", true));
  const time = cleanField(spanText(html, "lblHorario", true), SHORT_MAX);
  const local = spanText(html, "lblLocal", false) ?? "";
  if (title === "" || category === "" || dates.length === 0) throw new StopError("layout_changed");
  const cut = local.indexOf(" | ");
  const place = cleanField(cut < 0 ? local : local.slice(0, cut), PLACE_MAX);
  const address = cleanField(cut < 0 ? "" : local.slice(cut + 3), PLACE_MAX);
  return {
    id,
    title,
    start_date: dates[0],
    end_date: dates[dates.length - 1],
    time,
    place,
    address,
    category,
    link: eventLink(slug, id),
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEYS = ["id", "title", "start_date", "end_date", "time", "place", "address", "category", "link"];

/** True for an event record with exactly the kept fields in the expected formats (used for the cache and the output). */
export function validEvent(e) {
  if (typeof e !== "object" || e === null || Array.isArray(e)) return false;
  if (Object.keys(e).sort().join() !== [...KEYS].sort().join()) return false;
  const strings = ["title", "time", "place", "address", "category"].every((k) => typeof e[k] === "string");
  const link = /^https:\/\/turismo\.curitiba\.pr\.gov\.br\/evento\/[a-z0-9-]{1,200}\/([1-9]\d{0,8})$/.exec(e.link);
  return (
    Number.isSafeInteger(e.id) &&
    e.id > 0 &&
    strings &&
    e.title !== "" &&
    [...e.title].length <= TITLE_MAX &&
    [...e.place].length <= PLACE_MAX &&
    [...e.address].length <= PLACE_MAX &&
    ISO_DATE.test(e.start_date) &&
    ISO_DATE.test(e.end_date) &&
    e.start_date <= e.end_date &&
    link !== null &&
    Number(link[1]) === e.id
  );
}

// ---------- files ----------

/** CURITIBAI_DATA_DIR/events, created when missing; it must resolve inside the data folder. */
export function eventsDir(env) {
  const raw = env.CURITIBAI_DATA_DIR;
  if (raw === undefined || raw.trim() === "") throw new StopError("data_dir_not_set");
  let base;
  try {
    base = realpathSync(raw);
    if (!lstatSync(base).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new StopError("data_dir_not_set");
  }
  const dir = join(base, "events");
  try {
    mkdirSync(dir, { recursive: true });
    const real = realpathSync(dir);
    const rel = relative(base, real);
    if (rel !== "events" || isAbsolute(rel) || rel.startsWith(`..${sep}`)) throw new Error("outside");
    return real;
  } catch {
    throw new StopError("write_failed");
  }
}

/**
 * Writes `name` in `dir` atomically: a new temp file in the same folder (exclusive create, so an existing file or
 * symbolic link there is never followed or overwritten), then rename over the old file (which replaces a link itself,
 * not its target).
 */
export function writeAtomic(dir, name, text) {
  const tmp = join(dir, `.${name}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
  writeFileSync(tmp, text, { encoding: "utf8", mode: 0o644, flag: "wx" });
  renameSync(tmp, join(dir, name));
}

/** The previous events.json, or null when missing or not in the expected shape (then no cache and no ratio check). */
export function readPrevious(dir) {
  try {
    const json = JSON.parse(readFileSync(join(dir, "events.json"), "utf8"));
    if (json?.format !== 1 || !Array.isArray(json.events) || !json.events.every(validEvent)) return null;
    return json;
  } catch {
    return null;
  }
}

function readStatus(dir) {
  try {
    const s = JSON.parse(readFileSync(join(dir, "status.json"), "utf8"));
    return typeof s?.success === "string" ? s.success : null;
  } catch {
    return null;
  }
}

// ---------- run ----------

/**
 * One collector run. Returns `{code, exit, counts}`; writes events.json only when the whole run succeeded and the
 * result passed validation, and always tries to write status.json. Network, clock and sleep are injectable for tests.
 */
export async function run({ fetch, now, sleep, env, log }) {
  const startedAt = now();
  const counts = { pages: 0, listed: 0, fetched: 0, cached: 0, events: 0 };
  let dir = null;
  let code = "ok";
  let httpStatus;
  try {
    dir = eventsDir(env);
    if (!inWindow(startedAt)) throw new StopError("window_closed");
    const client = createClient({ fetch, now, sleep, startedAt });

    const robots = robotsGroupFor(parseRobots(await client.get("/robots.txt", ROBOTS_MAX_BYTES, "utf-8")));
    if (!robotsMatchesRecorded(robots)) throw new StopError("robots_changed");
    client.setRobots(robots);

    const date = curitibaDate(startedAt);
    const listed = new Map();
    let maxPage = 1;
    let noEvents = false;
    for (let page = 1; page <= maxPage; page++) {
      const parsed = parseListPage(await client.get(listPath(date, page), LIST_MAX_BYTES), date);
      counts.pages += 1;
      if (page === 1) {
        maxPage = parsed.maxPage;
        noEvents = parsed.noEvents;
      }
      for (const item of parsed.items) if (!listed.has(item.id)) listed.set(item.id, item);
    }
    counts.listed = listed.size;

    const previous = readPrevious(dir);
    const cache = new Map((previous?.events ?? []).map((e) => [e.id, e]));
    const events = [];
    for (const item of listed.values()) {
      const old = cache.get(item.id);
      if (old !== undefined && old.link === eventLink(item.slug, item.id)) {
        events.push(old);
        counts.cached += 1;
        continue;
      }
      const html = await client.get(`/evento/${item.slug}/${item.id}`, DETAIL_MAX_BYTES);
      events.push(parseDetailPage(html, item));
      counts.fetched += 1;
    }

    if (!events.every(validEvent)) throw new StopError("layout_changed");
    if (events.length === 0 && !noEvents) throw new StopError("layout_changed");
    const prevCount = previous?.events.length ?? 0;
    if (prevCount > 0 && events.length > 0) {
      const ratio = events.length / prevCount;
      if (ratio < MIN_RATIO || ratio > MAX_RATIO) throw new StopError("layout_changed");
    }
    events.sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : a.id - b.id));
    counts.events = events.length;
    const doc = {
      format: 1,
      source: `${ORIGIN}/eventos/`,
      checked_at: now().toISOString(),
      list_date: date,
      count: events.length,
      events,
    };
    try {
      writeAtomic(dir, "events.json", `${JSON.stringify(doc, null, 1)}\n`);
    } catch {
      throw new StopError("write_failed");
    }
  } catch (err) {
    code = err instanceof StopError ? err.code : "internal_error";
    httpStatus = err instanceof StopError ? err.httpStatus : undefined;
  }
  const exit = code === "ok" ? 0 : code === "data_dir_not_set" ? 2 : 1;
  if (dir !== null) {
    const status = {
      attempt: startedAt.toISOString(),
      success: code === "ok" ? now().toISOString() : readStatus(dir),
      code,
      ...(httpStatus === undefined ? {} : { http_status: httpStatus }),
    };
    try {
      writeAtomic(dir, "status.json", `${JSON.stringify(status)}\n`);
    } catch {
      // status is best effort; the exit code still reports the run
    }
  }
  log(`fetch-events: code=${code}${httpStatus === undefined ? "" : ` http_status=${httpStatus}`}`);
  log(
    `fetch-events: pages=${counts.pages} listed=${counts.listed} details_fetched=${counts.fetched} ` +
      `details_cached=${counts.cached} events=${counts.events}`,
  );
  log(`fetch-events: exit=${exit}`);
  return { code, exit, counts };
}

if (import.meta.main) {
  const result = await run({
    fetch: globalThis.fetch,
    now: () => new Date(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    env: process.env,
    log: (line) => process.stdout.write(`${line}\n`),
  });
  process.exitCode = result.exit;
}
