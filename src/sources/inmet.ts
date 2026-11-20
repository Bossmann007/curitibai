import { sharedCache, type Cached } from "../cache.js";
import { fetchText, SourceUnavailableError } from "../http.js";

export const INMET_BASE = "https://apiprevmet3.inmet.gov.br";
/** Curitiba's 7-digit IBGE code, as INMET uses it in forecast URLs and in each warning's `geocodes`. */
export const CURITIBA_GEOCODE = "4106902";
export const FORECAST_URL = `${INMET_BASE}/previsao/${CURITIBA_GEOCODE}`;
export const ALERTS_URL = `${INMET_BASE}/avisos/ativos`;
/** Both answered in 2–4 s when checked; the default 10 s leaves too little room for the 750 KB warnings body. */
export const INMET_TIMEOUT_MS = 15_000;
/** The forecast was 268 KB when checked (mostly base64 icons). */
export const FORECAST_MAX_BYTES = 1024 * 1024;
/**
 * The warnings list was 754 KB for 10 nationwide warnings when checked, the largest 157 KB (polygons, municipality
 * lists, icons). 6 MB leaves room for about 40 warnings that size, a busy day, before `source_unavailable`.
 */
export const ALERTS_MAX_BYTES = 6 * 1024 * 1024;

export function inmetLicenseNote(sourceUrl: string, fetchedAt: string): string {
  return (
    `Source: Instituto Nacional de Meteorologia (INMET), ${sourceUrl}, fetched at ${fetchedAt}. ` +
    "Values are passed on unchanged; only selected fields are returned. No terms of use for this API were found; " +
    "gov.br pages are published under CC BY-ND 3.0, so the data is treated under that notice (attribution, no " +
    "derivatives). Unofficial; not affiliated with INMET or Prefeitura de Curitiba."
  );
}

/** Returns the value as served when it is a string with visible text; otherwise null. Never trims or rewrites. */
function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** A number, or a plain decimal string ("28", "-1.5", "12,5") read as that number; anything else is null. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // At most 2 decimals, so "1,234" (a thousands separator?) is null rather than 1.234.
  if (typeof v !== "string" || !/^-?\d{1,3}([.,]\d{1,2})?$/.test(v.trim())) return null;
  return Number(v.trim().replace(",", "."));
}

export type PeriodName = "morning" | "afternoon" | "night" | "whole_day";

export interface ForecastPeriod {
  period: PeriodName;
  summary: string | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  humidity_min_pct: number | null;
  humidity_max_pct: number | null;
  wind_direction: string | null;
  wind_intensity: string | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface ForecastDay {
  date: string;
  weekday: string | null;
  periods: ForecastPeriod[];
}

const PERIOD_KEYS: [string, PeriodName][] = [
  ["manha", "morning"],
  ["tarde", "afternoon"],
  ["noite", "night"],
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function period(name: PeriodName, r: Record<string, unknown>): ForecastPeriod {
  return {
    period: name,
    summary: text(r.resumo),
    temp_min_c: num(r.temp_min),
    temp_max_c: num(r.temp_max),
    humidity_min_pct: num(r.umidade_min),
    humidity_max_pct: num(r.umidade_max),
    wind_direction: text(r.dir_vento),
    wind_intensity: text(r.int_vento),
    sunrise: text(r.nascer),
    sunset: text(r.ocaso),
  };
}

/**
 * `{"4106902": {"dd/mm/yyyy": day}}`. A day is either `{manha, tarde, noite}` (the first days) or one whole-day object
 * (later days). Only the periods present are returned; a whole-day entry is never split into periods.
 * Any other shape is a format change: source_unavailable, never a guess.
 */
export function parseForecast(json: unknown): ForecastDay[] {
  const city = isObject(json) ? json[CURITIBA_GEOCODE] : undefined;
  if (!isObject(city)) throw new SourceUnavailableError("unexpected INMET forecast");
  const days: ForecastDay[] = [];
  for (const [key, value] of Object.entries(city)) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(key);
    const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : "";
    // A real calendar date only: 31/02 does not survive the round trip.
    const t = m === null ? NaN : Date.parse(`${iso}T00:00:00Z`);
    const real = !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso;
    if (!real || !isObject(value)) throw new SourceUnavailableError("unexpected INMET forecast day");
    const parts = PERIOD_KEYS.filter(([k]) => isObject(value[k]));
    let periods: ForecastPeriod[];
    let first: Record<string, unknown>;
    if (parts.length > 0) {
      periods = parts.map(([k, name]) => period(name, value[k] as Record<string, unknown>));
      first = value[parts[0]![0]] as Record<string, unknown>;
    } else if ("resumo" in value || "temp_max" in value || "temp_min" in value) {
      periods = [period("whole_day", value)];
      first = value;
    } else {
      throw new SourceUnavailableError("unexpected INMET forecast day");
    }
    days.push({ date: iso, weekday: text(first.dia_semana), periods });
  }
  if (days.length === 0) throw new SourceUnavailableError("empty INMET forecast");
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

export type AlertBucket = "today" | "upcoming";

export interface WeatherAlert {
  id: number | null;
  /** INMET's lists this warning is in; a warning can be in both. */
  listed_in: AlertBucket[];
  description: string | null;
  severity: string | null;
  start: string | null;
  end: string | null;
  risks: string[] | null;
  instructions: string[] | null;
}

/** A list of strings as served (a lone string becomes a one-item list); non-string items are skipped. */
function textList(v: unknown): string[] | null {
  if (typeof v === "string") return v.trim() === "" ? null : [v];
  if (!Array.isArray(v)) return null;
  return v.filter((s): s is string => typeof s === "string" && s.trim() !== "");
}

/** Exact match of one comma-separated code (or array element); never a substring, so 41069020 is not Curitiba. */
function listsCuritiba(geocodes: unknown): boolean {
  const parts = typeof geocodes === "string" ? [geocodes] : Array.isArray(geocodes) ? geocodes : null;
  if (parts === null) throw new SourceUnavailableError("INMET warning without geocodes");
  const codes = parts
    .flatMap((p) => {
      if (typeof p !== "number" && typeof p !== "string") throw new SourceUnavailableError("unreadable INMET geocode");
      return String(p).split(",");
    })
    .map((c) => c.trim())
    .filter((c) => c !== "");
  // An empty area cannot be told apart from Curitiba's: fail closed instead of answering "no warning".
  if (codes.length === 0) throw new SourceUnavailableError("INMET warning with empty geocodes");
  return codes.includes(CURITIBA_GEOCODE);
}

/**
 * `{hoje: [...], futuro: [...]}`, kept to Curitiba's warnings and to text fields: polygons, area lists and icons are
 * dropped here. A warning in both lists with the same id and the same returned fields is returned once, with both lists
 * in `listed_in`, in INMET's order (today's list first). Copies that differ in any field are all returned as served.
 */
export function parseAlerts(json: unknown): WeatherAlert[] {
  if (!isObject(json)) throw new SourceUnavailableError("unexpected INMET warnings");
  const byKey = new Map<string, WeatherAlert>();
  for (const [list, bucket] of [[json.hoje, "today"], [json.futuro, "upcoming"]] as const) {
    if (!Array.isArray(list)) throw new SourceUnavailableError("unexpected INMET warnings list");
    for (const item of list) {
      // A warning we cannot read could be Curitiba's: fail closed instead of answering "no warning".
      if (!isObject(item)) throw new SourceUnavailableError("unexpected INMET warning");
      if (!listsCuritiba(item.geocodes)) continue;
      const fields = {
        description: text(item.descricao),
        severity: text(item.severidade),
        start: text(item.inicio),
        end: text(item.fim),
        risks: textList(item.riscos),
        instructions: textList(item.instrucoes),
      };
      const id = typeof item.id === "number" && Number.isInteger(item.id) ? item.id : null;
      const key = JSON.stringify([id, fields]);
      const seen = byKey.get(key);
      if (seen) {
        if (!seen.listed_in.includes(bucket)) seen.listed_in.push(bucket);
        continue;
      }
      byKey.set(key, { id, listed_in: [bucket], ...fields });
    }
  }
  return [...byKey.values()];
}

async function getJson(url: string, maxBytes: number): Promise<unknown> {
  const res = await fetchText(url, { timeoutMs: INMET_TIMEOUT_MS, maxBytes });
  try {
    return JSON.parse(res.body) as unknown;
  } catch {
    throw new SourceUnavailableError("INMET response is not JSON");
  }
}

/** Only the parsed, filtered result is cached (in memory), never the raw body. */
export function getForecast(): Promise<Cached<ForecastDay[]>> {
  return sharedCache.getOrLoad(`GET ${FORECAST_URL}`, async () => parseForecast(await getJson(FORECAST_URL, FORECAST_MAX_BYTES)));
}

export function getCuritibaAlerts(): Promise<Cached<WeatherAlert[]>> {
  return sharedCache.getOrLoad(`GET ${ALERTS_URL}`, async () => parseAlerts(await getJson(ALERTS_URL, ALERTS_MAX_BYTES)));
}
