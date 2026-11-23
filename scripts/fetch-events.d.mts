// Types for scripts/fetch-events.mjs, so the tests can import it (the script itself is plain JavaScript).

export interface RobotsGroup {
  lines: string[];
  allow: string[];
  disallow: string[];
  specific: boolean;
}
export interface EventRecord {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  time: string;
  place: string;
  address: string;
  category: string;
  link: string;
}
export interface RunDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  env: Record<string, string | undefined>;
  log: (line: string) => void;
  recordedRobots?: readonly string[];
}
export interface CacheEntry {
  fetched_at: string;
  event: EventRecord;
}
export interface PhoneEntry {
  section: string;
  name: string;
  numbers: string[];
}
export interface RunResult {
  code: string;
  exit: number;
  counts: { pages: number; listed: number; fetched: number; cached: number; events: number };
  phones: { code: string; entries: number; dropped: number };
}

export const HOST: string;
export const ALLOWED_HOSTS: readonly string[];
export const ORIGIN: string;
export const USER_AGENT: string;
export const WINDOW_START_MIN: number;
export const WINDOW_END_MIN: number;
export const DEADLINE_MS: number;
export const TIMEOUT_MS: number;
export const GAP_MS: number;
export const LIST_MAX_BYTES: number;
export const DETAIL_MAX_BYTES: number;
export const ROBOTS_MAX_BYTES: number;
export const PHONES_PATH: string;
export const PHONES_MAX_BYTES: number;
export const PHONES_SOURCE: string;
export const PHONES_MIN: number;
export const PHONES_MAX: number;
export const PHONE_NAME_MAX: number;
export const PHONE_SECTION_MAX: number;
export const MAX_LIST_PAGES: number;
export const TITLE_MAX: number;
export const PLACE_MAX: number;
export const SHORT_MAX: number;
export const MIN_RATIO: number;
export const MAX_RATIO: number;
export const ROBOTS_RECORDED_ON: string;
export const RECORDED_ROBOTS: readonly string[];
export const CACHE_FILE: string;
export const CACHE_MAX_BYTES: number;
export const REFRESH_AGE_MS: number;
export const REFRESH_SOON_DAYS: number;
export const REFRESH_MIN_AGE_MS: number;
export const LOCK_FILE: string;
export const LOCK_STALE_MS: number;
export const NO_EVENTS_MARKER: string | null;

export class StopError extends Error {
  constructor(code: string, httpStatus?: number);
  code: string;
  httpStatus: number | undefined;
}

export function inWindow(now: Date): boolean;
export function curitibaDate(now: Date): string;
export function listPath(isoDate: string, page: number): string;
export function parseRobots(text: string): { agents: string[]; rules: [string, string][] }[];
export function robotsGroupFor(groups: ReturnType<typeof parseRobots>): RobotsGroup | null;
export function robotsMatchesRecorded(group: RobotsGroup | null, recorded?: readonly string[]): boolean;
export function politeGapMs(group: Pick<RobotsGroup, "lines">): number;
export function robotsPatternMatches(pattern: string, path: string): boolean;
export function robotsAllows(group: Pick<RobotsGroup, "allow" | "disallow">, path: string): boolean;
export function declaredCharset(contentType: string | null, bytes: Uint8Array): string | null;
export function decodeBody(contentType: string | null, bytes: Uint8Array, fallback?: string | null): string;
export function parseListPage(html: string, isoDate: string): { items: { id: number; slug: string }[]; maxPage: number; noEvents: boolean };
export function parseDates(text: string): string[];
export function eventLink(slug: string, id: number): string;
export function parseDetailPage(html: string, item: { id: number; slug: string }): EventRecord;
export function validEvent(e: unknown): boolean;
export function eventsDir(env: Record<string, string | undefined>): string;
export function dataSubdir(env: Record<string, string | undefined>, name: "events" | "phones"): string;
export function parsePhonesPage(html: string): { entries: PhoneEntry[]; dropped: number };
export function validPhoneEntry(e: unknown): boolean;
export function readPreviousPhones(dir: string): { format: 1; entries: PhoneEntry[] } | null;
export function writeAtomic(dir: string, name: string, text: string): void;
export function readPrevious(dir: string): { format: 1; events: EventRecord[] } | null;
export function readCache(dir: string): Map<number, CacheEntry>;
export function writeCache(dir: string, cache: Map<number, CacheEntry>): void;
export function needsDetail(entry: CacheEntry | undefined, item: { id: number; slug: string }, today: string, nowMs: number): boolean;
export function acquireLock(dir: string, now: Date): () => void;
export function run(deps: RunDeps): Promise<RunResult>;
export const RECENT_SUCCESS_MS: number;
export function lastCollection(env: Record<string, string | undefined>, now: Date): Date | null;
export function decodeHtml(s: string): string;
