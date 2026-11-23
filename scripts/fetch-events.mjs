#!/usr/bin/env node
// Collector for the events_search and useful_phones tools: reads the public events calendar of the Instituto Municipal
// de Turismo de Curitiba (turismo.curitiba.pr.gov.br) and writes CURITIBAI_DATA_DIR/events/events.json and
// events/status.json, plus its own detail cache (events/details.json) and run lock (events/.lock); then, in the same
// run, reads the site's one "Telefones Úteis" page and writes phones/phones.json and phones/status.json.
// Run by hand (or by a scheduler) inside the window the site's robots.txt asks for; the MCP server never contacts
// this host (it is not in src/config.ts ALLOWED_HOSTS). Node built-ins only. See docs/local-data.md "Events" and docs/sources.md.
//
// Prints only fixed status lines, counts and the exit code: never page text, titles or HTML.
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, isAbsolute, sep } from "node:path";
import { cleanField, EVENT_PLACE_MAX, EVENT_SHORT_MAX, EVENT_TITLE_MAX } from "../src/mask.ts";
import { decodeEntities } from "../src/text.ts";

export const HOST = "turismo.curitiba.pr.gov.br";
/** The only hosts this script contacts (exact match). Separate from the server's ALLOWED_HOSTS on purpose. */
export const ALLOWED_HOSTS = Object.freeze([HOST]);
export const ORIGIN = `https://${HOST}`;
export const USER_AGENT = "curitibai-mcp/0.10 (+https://github.com/Bossmann007/curitibai)";

/** Requests start only between 02:00 and 05:50 UTC (robots.txt Visit-time 0200-0600, with a 10-minute margin). */
export const WINDOW_START_MIN = 2 * 60;
export const WINDOW_END_MIN = 5 * 60 + 50;
/** Whole-run deadline; the window end (05:50 UTC) still stops a run that started late. */
export const DEADLINE_MS = 30 * 60 * 1000;
export const TIMEOUT_MS = 15_000;
/**
 * robots.txt Request-rate 1/5: at least 5 s between the end of one request and the start of the next. A recorded
 * Crawl-delay or Request-rate asking for more raises the gap (politeGapMs).
 */
export const GAP_MS = 5_000;
export const LIST_MAX_BYTES = 512 * 1024;
export const DETAIL_MAX_BYTES = 256 * 1024;
export const ROBOTS_MAX_BYTES = 64 * 1024;
/** The one useful phones page (1 GET per run, after the events pages). */
export const PHONES_PATH = "/conteudo/telefones-uteis/92";
export const PHONES_MAX_BYTES = 256 * 1024;
/** Hard cap on list pages per run (the site showed 5 pages of 10); a pager showing more stops the run. */
export const MAX_LIST_PAGES = 10;
export const TITLE_MAX = EVENT_TITLE_MAX;
export const PLACE_MAX = EVENT_PLACE_MAX;
export const SHORT_MAX = EVENT_SHORT_MAX;
/** A new count outside [MIN_RATIO, MAX_RATIO] times the previous one is treated as a layout change. */
export const MIN_RATIO = 0.3;
export const MAX_RATIO = 3;

/** The day RECORDED_ROBOTS was read from https://turismo.curitiba.pr.gov.br/robots.txt (docs/sources.md). */
export const ROBOTS_RECORDED_ON = "2026-11-21";

/**
 * The whole `User-agent: *` group of the site's robots.txt as read on ROBOTS_RECORDED_ON: one "key: value" per
 * directive, key in lower case, comment removed, in file order. Every run compares the live group with this list as a
 * whole (order ignored, repeats counted): any added, removed or changed directive, Crawl-delay and Allow included,
 * stops the run with robots_changed before any page. To accept a change, edit this list (docs/local-data.md "Events").
 */
export const RECORDED_ROBOTS = Object.freeze([
  "request-rate: 1/5",
  "visit-time: 0200-0600",
  "disallow: /App_Browsers",
  "disallow: /App_Themes",
  "disallow: /bin",
  "disallow: /Cache",
  "disallow: /Imagem",
  "disallow: /Include",
  "disallow: *.mdb",
  "disallow: *.pdf",
  "disallow: *.dll",
  "disallow: *.log",
  "disallow: *.asp",
  "disallow: *.config",
  "disallow: *.jpg",
  "disallow: *.gif",
  "disallow: *.ascx",
  "allow: *.aspx",
  "allow: *.html",
  "allow: *.htm",
  "disallow: /es/contenido/*/categoria/*/conteudos/*",
]);

/**
 * Text that marks an empty list page, which would allow a count of 0. No empty page has been seen, so it is null and a
 * day with no events stops with layout_changed (docs/local-data.md "Events" explains it).
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

/**
 * Groups of `User-agent` lines with every directive that follows them, as `[key, value]` (key in lower case, value
 * trimmed, comments removed; unknown keys and empty values kept). Lines without a colon are ignored.
 */
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  // A UTF-8 byte order mark, decoded as UTF-8 or as Windows-1252, would hide the first User-agent line.
  for (const rawLine of text.replace(/^(?:\uFEFF|\u00EF\u00BB\u00BF)/, "").split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
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
    if (current !== null) current.rules.push([key, value]);
  }
  return groups;
}

/** The group that applies to this script: one naming curitibai-mcp, else `*`; rules of repeated groups are merged. */
export function robotsGroupFor(groups) {
  const pick = (pred) => {
    const hits = groups.filter((g) => g.agents.some(pred));
    if (hits.length === 0) return null;
    const rules = hits.flatMap((g) => g.rules);
    const values = (key) => rules.filter(([k, v]) => k === key && v !== "").map(([, v]) => v);
    return {
      lines: rules.map(([k, v]) => `${k}: ${v}`),
      allow: values("allow"),
      disallow: values("disallow"),
      specific: pred !== isStar,
    };
  };
  const isStar = (a) => a === "*";
  return pick((a) => a === "curitibai-mcp" || a.startsWith("curitibai-mcp/")) ?? pick(isStar);
}

/** True when the applicable group is the `*` group and has exactly the recorded directives (order ignored). */
export function robotsMatchesRecorded(group, recorded = RECORDED_ROBOTS) {
  if (group === null || group.specific) return false;
  const a = [...group.lines].sort();
  const b = [...recorded].sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Milliseconds to wait between requests: GAP_MS, or more when the group's Crawl-delay (seconds) or Request-rate
 * (`n/s`, optional unit s, m or h) asks for a longer gap. Values in another format are ignored here (the group already
 * matched the recorded one).
 */
export function politeGapMs(group) {
  let gap = GAP_MS;
  for (const line of group.lines) {
    const delay = /^crawl-delay: (\d{1,5}(?:\.\d{1,3})?)$/.exec(line);
    if (delay) gap = Math.max(gap, Math.ceil(Number(delay[1]) * 1000));
    const rate = /^request-rate: (\d{1,5})\/(\d{1,5})([smh]?)$/.exec(line);
    if (rate && Number(rate[1]) > 0) {
      const unit = { "": 1, s: 1, m: 60, h: 3600 }[rate[3]];
      gap = Math.max(gap, Math.ceil(((Number(rate[2]) * unit) / Number(rate[1])) * 1000));
    }
  }
  return gap;
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
 * deadline, waits GAP_MS (or the larger robots delay) after the previous request, sends only GET with this script's User-Agent, follows no
 * redirect, and stops (no retry) on any non-200 status.
 */
export function createClient({ fetch, now, sleep, startedAt }) {
  let lastEnd = null;
  let robots = null;
  let gapMs = GAP_MS;
  let requests = 0;
  const check = () => {
    const t = now();
    if (t.getTime() - startedAt.getTime() >= DEADLINE_MS) throw new StopError("deadline");
    if (!inWindow(t)) throw new StopError("window_closed");
  };
  async function get(path, maxBytes, fallbackCharset = null) {
    if (path !== "/robots.txt" && path !== PHONES_PATH && !LIST_PATH.test(path) && !DETAIL_PATH.test(path)) {
      throw new StopError("path_not_allowed");
    }
    if (path !== "/robots.txt" && (robots === null || !robotsAllows(robots, path))) throw new StopError("robots_disallowed");
    const url = new URL(path, ORIGIN);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.includes(url.hostname) || url.pathname !== path) {
      throw new StopError("path_not_allowed");
    }
    check();
    if (lastEnd !== null) {
      const wait = lastEnd + gapMs - now().getTime();
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
      gapMs = politeGapMs(group);
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
  return dataSubdir(env, "events");
}

/** CURITIBAI_DATA_DIR/<name> ("events" or "phones"), created when missing; it must resolve inside the data folder. */
export function dataSubdir(env, name) {
  if (name !== "events" && name !== "phones") throw new StopError("write_failed");
  const raw = env.CURITIBAI_DATA_DIR;
  if (raw === undefined || raw.trim() === "") throw new StopError("data_dir_not_set");
  let base;
  try {
    base = realpathSync(raw);
    if (!lstatSync(base).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new StopError("data_dir_not_set");
  }
  const dir = join(base, name);
  try {
    mkdirSync(dir, { recursive: true });
    const real = realpathSync(dir);
    const rel = relative(base, real);
    if (rel !== name || isAbsolute(rel) || rel.startsWith(`..${sep}`)) throw new Error("outside");
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

/** The previous events.json, or null when missing or not in the expected shape (then no ratio check). */
export function readPrevious(dir) {
  try {
    const json = JSON.parse(readFileSync(join(dir, "events.json"), "utf8"));
    if (json?.format !== 1 || !Array.isArray(json.events) || !json.events.every(validEvent)) return null;
    return json;
  } catch {
    return null;
  }
}

/**
 * A run outside the window exits 0 (not a failed run) when both steps last succeeded less than this before it started,
 * so a schedule entry that GitHub starts late does not look like a broken collection.
 */
export const RECENT_SUCCESS_MS = 24 * 60 * 60 * 1000;

/**
 * When the whole collection last succeeded: the older of the `success` times in events/status.json and
 * phones/status.json. Null when either is missing, unreadable, or later than `now` (fail closed).
 */
export function lastCollection(env, now) {
  let times;
  try {
    times = [eventsDir(env), dataSubdir(env, "phones")].map((dir) => Date.parse(readStatus(dir) ?? ""));
  } catch {
    return null;
  }
  if (!times.every((t) => Number.isFinite(t) && t <= now.getTime())) return null;
  return new Date(Math.min(...times));
}

function readStatus(dir) {
  try {
    const s = JSON.parse(readFileSync(join(dir, "status.json"), "utf8"));
    return typeof s?.success === "string" ? s.success : null;
  } catch {
    return null;
  }
}

// ---------- detail cache ----------

/** Detail records read so far, with when each was read: kept across runs, so a run cut short keeps its progress. */
export const CACHE_FILE = "details.json";
export const CACHE_MAX_BYTES = 4 * 1024 * 1024;
/** A cached detail older than this is read again. */
export const REFRESH_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A cached detail of an event starting today or in the next REFRESH_SOON_DAYS days is read again... */
export const REFRESH_SOON_DAYS = 3;
/** ...unless it was read less than this ago, so a second run on the same night does not read it twice. */
export const REFRESH_MIN_AGE_MS = 20 * 60 * 60 * 1000;

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * The detail cache as a Map from id to `{fetched_at, event}`. Missing, too large, not a regular file, or not in the
 * expected shape: an empty cache (every detail is read again). Invalid entries are dropped one by one.
 */
export function readCache(dir) {
  const cache = new Map();
  try {
    const path = join(dir, CACHE_FILE);
    const st = lstatSync(path);
    if (!st.isFile() || st.size > CACHE_MAX_BYTES) return cache;
    const json = JSON.parse(readFileSync(path, "utf8"));
    if (json?.format !== 1 || !Array.isArray(json.details)) return cache;
    for (const d of json.details) {
      if (typeof d?.fetched_at !== "string" || !ISO_INSTANT.test(d.fetched_at) || !Number.isFinite(Date.parse(d.fetched_at))) continue;
      if (!validEvent(d.event)) continue;
      cache.set(d.event.id, { fetched_at: d.fetched_at, event: d.event });
    }
  } catch {
    // no cache
  }
  return cache;
}

/** Writes the cache atomically; a failure stops the run with write_failed. */
export function writeCache(dir, cache) {
  const details = [...cache.values()].sort((a, b) => a.event.id - b.event.id);
  try {
    writeAtomic(dir, CACHE_FILE, `${JSON.stringify({ format: 1, details })}\n`);
  } catch {
    throw new StopError("write_failed");
  }
}

/** YYYY-MM-DD plus `days` calendar days. */
function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * True when the detail page of `item` must be read: no cached record for its id (or one with another link), or a
 * record read REFRESH_AGE_MS ago or more, or an event starting from `today` to `today` + REFRESH_SOON_DAYS; but never a
 * record read less than REFRESH_MIN_AGE_MS ago.
 */
export function needsDetail(entry, item, today, nowMs) {
  if (entry === undefined || entry.event.link !== eventLink(item.slug, item.id)) return true;
  const age = nowMs - Date.parse(entry.fetched_at);
  if (!(age >= 0)) return true; // read "in the future": the clock changed, read it again
  if (age < REFRESH_MIN_AGE_MS) return false;
  if (age >= REFRESH_AGE_MS) return true;
  return entry.event.start_date >= today && entry.event.start_date <= addDays(today, REFRESH_SOON_DAYS);
}

// ---------- useful phones page (known structure only) ----------

export const PHONES_SOURCE = `${ORIGIN}${PHONES_PATH}`;
/** Fewer entries than this is a layout change (the 2026-11-22 page had 70). */
export const PHONES_MIN = 20;
export const PHONES_MAX = 500;
export const PHONE_NAME_MAX = 120;
export const PHONE_SECTION_MAX = 60;

/**
 * One published number: (DDD) 8 or 9 digits, 0800 with 6 or 7 digits (space or hyphen), a bare 8 or 9 digit local
 * number, or a 3-digit public service number starting with 1 (190, 193, 156...).
 */
const PHONE_TOKEN =
  /\(\d{2}\) ?\d{4,5}-\d{4}(?!\d)|(?<!\d)0800[- ]?\d{6,7}(?!\d)|(?<![\d(])\d{4,5}-\d{4}(?!\d)|(?<![\p{L}\d(-])1\d{2}(?![\p{L}\d)º-])/gu;
/** A 9-digit mobile number (personal phones are mobiles in Brazil): the entry is dropped, never published. */
const MOBILE = /(?:^|\) ?|\s)9\d{4}-\d{4}$/;
const VALID_NUMBER = /^(?:\(\d{2}\) ?\d{4}-\d{4}|0800[- ]?\d{6,7}|\d{4}-\d{4}|1\d{2})$/;
/** The only tags allowed inside the content block; any other one is a layout change. */
const BLOCK_TAG = /<\/?(?:strong|em|br|p|div|address)(?:\s[^<>]*)?\/?>/gi;

/** The inner HTML of the one `<div class="listaEdital">` (matched divs counted), or layout_changed. */
function phonesBlock(html) {
  const open = '<div class="listaEdital">';
  if (html.split(open).length !== 2) throw new StopError("layout_changed");
  if (!/<h2>\s*Telefones Úteis<\/h2>/.test(html)) throw new StopError("layout_changed");
  const start = html.indexOf(open) + open.length;
  const tags = /<div\b[^>]*>|<\/div>/gi;
  tags.lastIndex = start;
  let depth = 1;
  for (let m = tags.exec(html); m !== null; m = tags.exec(html)) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  throw new StopError("layout_changed");
}

/** Text lines of the block: block tags become line breaks, inline tags vanish, entities decoded, spaces collapsed. */
function blockLines(block) {
  const rest = block.replace(/<!--[\s\S]*?-->/g, "").replace(BLOCK_TAG, "");
  if (/[<>]/.test(rest.replace(/&[a-z]+;|&#\d+;/gi, ""))) throw new StopError("layout_changed"); // an unknown tag
  const text = block
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>|<\/?(?:p|div|address)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeHtml(text)
    .split(/\r\n|\r|\n/)
    .map((l) => l.replace(/[\s\u00a0]+/g, " ").trim())
    .filter((l) => l !== "");
}

const trimLabel = (s) => s.replace(/^[\s\-–]+/, "").replace(/[\s:\-–/]+$/, "");

/**
 * The page reduced to `{entries, dropped}`: each entry is `{section, name, numbers}` (organ or service name, the
 * section heading it is under, and the numbers as published). Notes, addresses and everything else are not kept.
 * Lines: a heading (no "-", ends with ":", no digits) opens a section; "- Name: numbers" is an entry; "- Name:" with no
 * number is a parent for the indented lines that follow; "- Name" with no number continues on the next line; an
 * indented "Name: numbers" is a child of the last parent or entry. Any line that fits none of these, a number in a
 * format not listed above, a name holding digits like a number, or an entry before the first heading stops with
 * layout_changed. Entries whose cleaned name holds masked data, or with a mobile number, are dropped and counted.
 */
export function parsePhonesPage(html) {
  const lines = blockLines(phonesBlock(html));
  const entries = [];
  let dropped = 0;
  let section = null;
  let parent = null; // "- Name:" with no number
  let lastTop = null; // last "- Name: numbers"
  let pending = null; // "- Name" continued on the next line
  for (const line of lines) {
    const tokens = [...line.matchAll(PHONE_TOKEN)];
    const dash = /^-/.test(line);
    if (tokens.length === 0) {
      // A number in an unknown format: 3+ digits in a heading or "-" line, 7+ digits in a note or address line.
      if ((dash || line.endsWith(":")) && /\d{3}/.test(line)) throw new StopError("layout_changed");
      if ((line.match(/\d/g) ?? []).length >= 7) throw new StopError("layout_changed");
      if (pending !== null) throw new StopError("layout_changed");
      if (dash && line.endsWith(":")) {
        parent = trimLabel(line);
        lastTop = null;
      } else if (dash) {
        pending = trimLabel(line);
      } else if (line.endsWith(":") && !/\d/.test(line)) {
        section = trimLabel(line);
        parent = null;
        lastTop = null;
      } // else: an address or a note, not kept
      continue;
    }
    if (section === null || section === "") throw new StopError("layout_changed");
    const first = tokens[0].index;
    const tail = line.slice(first).replace(PHONE_TOKEN, "");
    if (/\d/.test(tail)) throw new StopError("layout_changed"); // a number the pattern did not read
    let name = trimLabel(line.slice(0, first));
    if (/\d{3}/.test(name)) throw new StopError("layout_changed");
    if (pending !== null) {
      name = trimLabel(`${pending} ${name}`);
      pending = null;
      lastTop = name;
    } else if (dash) {
      parent = null;
      lastTop = name;
    } else {
      const head = parent ?? lastTop;
      if (head === null) throw new StopError("layout_changed");
      name = `${head} – ${name}`;
    }
    if (name === "" || name.endsWith("– ")) throw new StopError("layout_changed");
    const numbers = tokens.map((t) => t[0]);
    const cleanName = cleanField(name, PHONE_NAME_MAX);
    if (numbers.some((n) => MOBILE.test(n)) || cleanName.includes("[masked]")) {
      dropped += 1;
      continue;
    }
    entries.push({ section: cleanField(section, PHONE_SECTION_MAX), name: cleanName, numbers });
  }
  if (pending !== null) throw new StopError("layout_changed");
  if (entries.length < PHONES_MIN || entries.length > PHONES_MAX) throw new StopError("layout_changed");
  if (!entries.every(validPhoneEntry)) throw new StopError("layout_changed");
  return { entries, dropped };
}

/** True for an entry with exactly the kept fields: section, name and 1–10 numbers in the known formats. */
export function validPhoneEntry(e) {
  if (typeof e !== "object" || e === null || Array.isArray(e)) return false;
  if (Object.keys(e).sort().join() !== "name,numbers,section") return false;
  return (
    typeof e.section === "string" &&
    e.section !== "" &&
    [...e.section].length <= PHONE_SECTION_MAX &&
    typeof e.name === "string" &&
    e.name !== "" &&
    [...e.name].length <= PHONE_NAME_MAX &&
    Array.isArray(e.numbers) &&
    e.numbers.length >= 1 &&
    e.numbers.length <= 10 &&
    e.numbers.every((n) => typeof n === "string" && VALID_NUMBER.test(n))
  );
}

/** The previous phones.json, or null when missing or not in the expected shape. */
export function readPreviousPhones(dir) {
  try {
    const json = JSON.parse(readFileSync(join(dir, "phones.json"), "utf8"));
    if (json?.format !== 1 || !Array.isArray(json.entries) || !json.entries.every(validPhoneEntry)) return null;
    return json;
  } catch {
    return null;
  }
}

/**
 * The phones step: one GET of PHONES_PATH with the run's client (same window, deadline, robots rules, gap and
 * User-Agent), then phones/phones.json only when the page parsed and the count is within 0.3x–3x of the previous copy;
 * phones/status.json always tried. `skipCode` (the events step ended with a code other than ok or layout_changed)
 * makes no request.
 */
export async function runPhones({ client, now, env, attempt, skipCode }) {
  const out = { code: "ok", httpStatus: undefined, entries: 0, dropped: 0 };
  let dir;
  try {
    dir = dataSubdir(env, "phones");
  } catch (err) {
    out.code = err instanceof StopError ? err.code : "internal_error";
    return out;
  }
  try {
    if (skipCode !== null) throw new StopError(skipCode);
    const parsed = parsePhonesPage(await client.get(PHONES_PATH, PHONES_MAX_BYTES));
    const prevCount = readPreviousPhones(dir)?.entries.length ?? 0;
    if (prevCount > 0) {
      const ratio = parsed.entries.length / prevCount;
      if (ratio < MIN_RATIO || ratio > MAX_RATIO) throw new StopError("layout_changed");
    }
    const doc = {
      format: 1,
      source: PHONES_SOURCE,
      checked_at: now().toISOString(),
      count: parsed.entries.length,
      dropped: parsed.dropped,
      entries: parsed.entries,
    };
    try {
      writeAtomic(dir, "phones.json", `${JSON.stringify(doc, null, 1)}\n`);
    } catch {
      throw new StopError("write_failed");
    }
    out.entries = parsed.entries.length;
    out.dropped = parsed.dropped;
  } catch (err) {
    out.code = err instanceof StopError ? err.code : "internal_error";
    out.httpStatus = err instanceof StopError ? err.httpStatus : undefined;
  }
  // Stopped by the window: status.json is left as it was, as for events.
  if (out.code === "window_closed") return out;
  const status = {
    attempt,
    success: out.code === "ok" ? now().toISOString() : readStatus(dir),
    code: out.code,
    ...(out.httpStatus === undefined ? {} : { http_status: out.httpStatus }),
  };
  try {
    writeAtomic(dir, "status.json", `${JSON.stringify(status)}\n`);
  } catch {
    // best effort, as for events
  }
  return out;
}

// ---------- lock ----------

export const LOCK_FILE = ".lock";
/** A lock older than this is left by a run that died, and is removed. */
export const LOCK_STALE_MS = 60 * 60 * 1000;

/**
 * Takes the run lock: DIR/.lock created exclusively (flag wx, never through an existing file or link). An existing lock
 * stops the run with `locked`, unless it is stale: its `started` time (else, when the file is unreadable, its mtime) is
 * LOCK_STALE_MS or more before `now`. A stale lock is moved aside and removed only if it is still the one judged stale,
 * then the create is tried once more (only one of two racing runs can create it). Returns a release function that
 * removes the lock only while it still holds this run's content.
 */
export function acquireLock(dir, now) {
  const path = join(dir, LOCK_FILE);
  const body = `${JSON.stringify({ started: now.toISOString(), pid: process.pid, token: Math.random().toString(36).slice(2, 12) })}\n`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(path, body, { encoding: "utf8", mode: 0o644, flag: "wx" });
      return () => {
        try {
          if (lstatSync(path).isFile() && readFileSync(path, "utf8") === body) unlinkSync(path);
        } catch {
          // already gone
        }
      };
    } catch (err) {
      if (err?.code !== "EEXIST") throw new StopError("write_failed");
    }
    let st;
    let seen = null;
    let started = NaN;
    try {
      st = lstatSync(path);
      if (st.isFile()) {
        seen = readFileSync(path, "utf8");
        try {
          started = Date.parse(JSON.parse(seen).started);
        } catch {
          // unreadable: use the mtime below
        }
      }
      if (!Number.isFinite(started)) started = st.mtimeMs;
    } catch {
      continue; // removed meanwhile: try again
    }
    // Fresh, or dated in the future (another clock, or this one set back): fail closed.
    if (now.getTime() - started < LOCK_STALE_MS) break;
    // Stale: move it aside (one atomic step), then check that what moved is the lock judged stale. If another run
    // replaced it meanwhile, put that run's lock back and stop.
    const aside = join(dir, `${LOCK_FILE}.stale-${process.pid}-${Math.random().toString(36).slice(2, 10)}`);
    try {
      renameSync(path, aside);
    } catch {
      continue; // removed meanwhile: try again
    }
    let same = false;
    try {
      const moved = lstatSync(aside);
      same = moved.mtimeMs === st.mtimeMs && (moved.isFile() ? readFileSync(aside, "utf8") === seen : seen === null);
    } catch {
      // unreadable: treat as not the same
    }
    if (!same) {
      try {
        renameSync(aside, path);
      } catch {
        // nothing more to do
      }
      break;
    }
    try {
      unlinkSync(aside);
    } catch {
      // removed meanwhile
    }
  }
  throw new StopError("locked");
}

// ---------- run ----------

/**
 * One collector run. Returns `{code, exit, counts}`. Takes the lock first (a locked run makes no request and writes
 * nothing). Each detail read is added to the detail cache at once; events.json is written only when the whole run
 * succeeded and the result passed validation; status.json is always tried. Then the phones step (runPhones) runs with
 * the same client, only when the events step ended ok or with layout_changed (any other code: no request, the phones
 * status gets that code); it never changes events files or the events code. Exit 0 only when both steps are ok. Network, clock, sleep and the recorded robots rules are injectable
 * for tests.
 */
export async function run({ fetch, now, sleep, env, log, recordedRobots = RECORDED_ROBOTS }) {
  const startedAt = now();
  const counts = { pages: 0, listed: 0, fetched: 0, cached: 0, events: 0 };
  let dir = null;
  let release = null;
  let code = "ok";
  let httpStatus;
  let client = null;
  let robotsAccepted = false;
  let collected = null;
  try {
    dir = eventsDir(env);
    release = acquireLock(dir, startedAt);
    collected = lastCollection(env, startedAt);
    // CURITIBAI_COLLECT_ONCE_A_DAY=1 (set by scripts/publish-data.sh for the several nightly schedule entries): both
    // steps already succeeded on this UTC date, so the later entries make no request and write nothing.
    const today = startedAt.toISOString().slice(0, 10);
    if (env.CURITIBAI_COLLECT_ONCE_A_DAY === "1" && collected?.toISOString().slice(0, 10) === today) {
      throw new StopError("already_collected");
    }
    if (!inWindow(startedAt)) throw new StopError("window_closed");
    client = createClient({ fetch, now, sleep, startedAt });

    // The site serves robots.txt as text/plain with no charset and Latin-1 comments: Windows-1252 decodes any byte.
    const robots = robotsGroupFor(parseRobots(await client.get("/robots.txt", ROBOTS_MAX_BYTES, "windows-1252")));
    if (!robotsMatchesRecorded(robots, recordedRobots)) throw new StopError("robots_changed");
    client.setRobots(robots);
    robotsAccepted = true;

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

    const cache = readCache(dir);
    const events = [];
    for (const item of listed.values()) {
      const entry = cache.get(item.id);
      if (!needsDetail(entry, item, date, now().getTime())) {
        events.push(entry.event);
        counts.cached += 1;
        continue;
      }
      const html = await client.get(`/evento/${item.slug}/${item.id}`, DETAIL_MAX_BYTES);
      const event = parseDetailPage(html, item);
      if (!validEvent(event)) throw new StopError("layout_changed");
      cache.set(item.id, { fetched_at: now().toISOString(), event });
      writeCache(dir, cache); // a run stopped later (deadline, window, error) keeps this detail
      events.push(event);
      counts.fetched += 1;
    }

    if (events.length === 0 && !noEvents) throw new StopError("layout_changed");
    const previous = readPrevious(dir);
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
    // Only ids still listed stay in the cache once a run succeeds.
    for (const id of [...cache.keys()]) if (!listed.has(id)) cache.delete(id);
    writeCache(dir, cache);
    try {
      writeAtomic(dir, "events.json", `${JSON.stringify(doc, null, 1)}\n`);
    } catch {
      throw new StopError("write_failed");
    }
  } catch (err) {
    code = err instanceof StopError ? err.code : "internal_error";
    httpStatus = err instanceof StopError ? err.httpStatus : undefined;
  }
  // A locked run leaves status.json to the run holding the lock. A skipped run and a run stopped by the window write
  // neither status file, so a late schedule entry never replaces the record of a successful collection.
  const quiet = code === "locked" || code === "already_collected" || code === "window_closed";
  if (dir !== null && !quiet) {
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
  let phones = { code, httpStatus, entries: 0, dropped: 0 };
  if (dir !== null && !quiet) {
    // The phones page is asked for only after an ok or layout_changed events result: after any refusal, error status,
    // redirect, timeout, network error, window or deadline stop, the host is not asked again in this run.
    const phonesMayRequest = robotsAccepted && (code === "ok" || code === "layout_changed");
    phones = await runPhones({ client, now, env, attempt: startedAt.toISOString(), skipCode: phonesMayRequest ? null : code });
  }
  release?.();
  // Stopped by the window with nothing else wrong: exit 0 only while both steps succeeded in the last 24 h, so a missed
  // night still shows as a failed run.
  const settled = (c) => c === "ok" || c === "window_closed";
  const recent = collected !== null && startedAt.getTime() - collected.getTime() < RECENT_SUCCESS_MS;
  const exit =
    code === "data_dir_not_set"
      ? 2
      : code === "already_collected" || (code === "ok" && phones.code === "ok") || (settled(code) && settled(phones.code) && recent)
        ? 0
        : 1;
  log(`fetch-events: code=${code}${httpStatus === undefined ? "" : ` http_status=${httpStatus}`}`);
  log(
    `fetch-events: pages=${counts.pages} listed=${counts.listed} details_fetched=${counts.fetched} ` +
      `details_cached=${counts.cached} events=${counts.events}`,
  );
  log(
    `fetch-events: phones_code=${phones.code}${phones.httpStatus === undefined ? "" : ` phones_http_status=${phones.httpStatus}`} ` +
      `phones=${phones.entries} phones_dropped=${phones.dropped}`,
  );
  log(`fetch-events: exit=${exit}`);
  return { code, exit, counts, phones: { code: phones.code, entries: phones.entries, dropped: phones.dropped } };
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
