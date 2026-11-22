import { TtlCache, type Cached } from "../cache.js";
import { fetchText, SourceUnavailableError } from "../http.js";
import { createHostGate } from "../hostGate.js";
import { dateInCuritiba } from "./detran.js";

/**
 * ANA's telemetry web service (ASP.NET, anonymous GET, XML). robots.txt 404 on 2026-11-21 and 2026-11-22. ANA offers
 * plain http in its docs, but https answered with a valid certificate on 2026-11-22 (curl and Node), so https is used.
 */
export const ANA_SERVICE_URL = "https://telemetriaws1.ana.gov.br/ServiceANA.asmx";
const DATA_URL = `${ANA_SERVICE_URL}/DadosHidrometeorologicos`;

/** Two days of 15-minute rows were about 34 KB on 2026-11-22. */
export const ANA_MAX_BYTES = 512 * 1024;
export const ANA_TIMEOUT_MS = 10_000;
/** Readings come every 15 minutes. */
export const ANA_CACHE_TTL_MS = 15 * 60 * 1000;
/** At least this long between two request starts to the ANA host from this process. */
export const ANA_MIN_INTERVAL_MS = 5_000;
/** A request whose turn would come later than this gives up without a request (rate_limited with the wait). */
export const ANA_MAX_QUEUE_WAIT_MS = 10_000;

export interface Station {
  /** ANA station code, 8 digits. */
  code: string;
  name: string;
  /** null for rain gauges (codes 0254xxxx), which have no river. */
  river: string | null;
  municipality: string;
  lat: number;
  lon: number;
}

/**
 * The bundled station list (never downloaded at runtime). Built once on 2026-11-22 from
 * `ServiceANA.asmx/ListaEstacoesTelemetricas?statusEstacoes=&origem=` (4 MB, 5,477 stations): every station with
 * latitude -25.75 to -25.25 and longitude -49.55 to -49.00, as published (name, river, "Municipio-UF" without "-PR",
 * coordinates). All 25 are operated by IAT-PR (Instituto Água e Terra) and marked active; many send nothing on a
 * given day. See docs/sources.md to rebuild it.
 */
export const STATIONS: readonly Station[] = [
  { code: "02549040", name: "CONTENDA", river: null, municipality: "CONTENDA", lat: -25.68, lon: -49.5417 },
  { code: "02549042", name: "QUATRO BARRAS", river: null, municipality: "QUATRO BARRAS", lat: -25.3675, lon: -49.0739 },
  { code: "02549086", name: "CAPTAÇÃO IGUAÇU BR-277", river: null, municipality: "CURITIBA", lat: -25.4828, lon: -49.1897 },
  { code: "02549090", name: "COLOMBO - SE COPEL", river: null, municipality: "COLOMBO", lat: -25.2878, lon: -49.2314 },
  { code: "02549110", name: "BOM JESUS DA ALDEIA", river: null, municipality: "CAMPO LARGO", lat: -25.4422, lon: -49.4731 },
  { code: "02549111", name: "SÃO CRISTOVÃO", river: null, municipality: "PIRAQUARA", lat: -25.4519, lon: -49.0497 },
  { code: "02549114", name: "GRAMMER", river: null, municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.5853, lon: -49.1678 },
  { code: "02549115", name: "CAMPO LARGO DA ROSEIRA", river: null, municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.675, lon: -49.1797 },
  { code: "02549118", name: "AUTÓDROMO - PINHAIS", river: null, municipality: "PINHAIS", lat: -25.4467, lon: -49.1978 },
  { code: "02549119", name: "PINHAIS", river: null, municipality: "PINHAIS", lat: -25.4539, lon: -49.1714 },
  { code: "02549123", name: "CHÁCARA GUAJUBI", river: null, municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.5461, lon: -49.0722 },
  { code: "02549124", name: "PONTE DO UMBARAZINHO", river: null, municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.5994, lon: -49.2617 },
  { code: "02549125", name: "ETE BELÉM - SANEPAR", river: null, municipality: "CURITIBA", lat: -25.5175, lon: -49.2122 },
  { code: "02549127", name: "SANTA QUITÉRIA", river: null, municipality: "CURITIBA", lat: -25.4631, lon: -49.3211 },
  { code: "02549130", name: "MALHADA", river: null, municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.6619, lon: -49.1025 },
  { code: "02549133", name: "CACHOEIRA", river: null, municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.5903, lon: -49.2286 },
  { code: "02549185", name: "PONTE PR-415", river: null, municipality: "PIRAQUARA", lat: -25.4506, lon: -49.1214 },
  { code: "65004995", name: "PONTE PR-415", river: "RIO PIRAQUARA", municipality: "PIRAQUARA", lat: -25.4506, lon: -49.1211 },
  { code: "65006040", name: "EMBRAPA SUDERHSA - TELEMÉTRICA", river: "RIO PALMITAL", municipality: "COLOMBO", lat: -25.3225, lon: -49.1625 },
  { code: "65006090", name: "COMPORTA CANAL ÁGUA LIMPA", river: "RIO IGUAÇU", municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.4857, lon: -49.1813 },
  { code: "65009000", name: "PONTE BR-277", river: "RIO IGUAÇU", municipality: "CURITIBA", lat: -25.4833, lon: -49.1894 },
  { code: "65010000", name: "FAZENDINHA", river: "RIO PEQUENO", municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.5192, lon: -49.1456 },
  { code: "65015400", name: "CACHOEIRA", river: "RIO MIRINGUAVA", municipality: "SÃO JOSÉ DOS PINHAIS", lat: -25.5892, lon: -49.2281 },
  { code: "65019980", name: "ETE - ARAUCÁRIA", river: "RIO IGUAÇU", municipality: "ARAUCÁRIA", lat: -25.6017, lon: -49.3981 },
  { code: "65025000", name: "GUAJUVIRA", river: "RIO IGUAÇU", municipality: "ARAUCÁRIA", lat: -25.6003, lon: -49.5133 },
];

/** Brasília time has had no daylight saving since 2019: `DataHora` is always UTC-3. */
const OFFSET_MS = 3 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const dmy = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;

/** Yesterday and today as Curitiba dates (YYYY-MM-DD), and the start of yesterday in ms. */
export function requestPeriod(now: number): { from: string; to: string; fromMs: number } {
  const from = dateInCuritiba(new Date(now - DAY_MS));
  return { from, to: dateInCuritiba(new Date(now)), fromMs: Date.parse(`${from}T00:00:00-03:00`) };
}

/** The one URL read for a station: its bundled code, yesterday to today (Curitiba dates). No user input. */
export function stationDataUrl(code: string, now: number): string {
  const { from, to } = requestPeriod(now);
  const p = new URLSearchParams({ codEstacao: code, dataInicio: dmy(from), dataFim: dmy(to) });
  return `${DATA_URL}?${p.toString()}`;
}

/** `DataHora` ("2026-11-22 02:00:00 ", Brasília time) as ms, or null when not exactly that shape or not a real date. */
export function parseDataHora(raw: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const utc = Date.UTC(y, mo - 1, d, h, mi, s);
  const back = new Date(utc);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return null;
  return utc + OFFSET_MS;
}

/** A ms time as Curitiba local ISO time with its offset ("2026-11-22T02:00:00-03:00"). */
export function curitibaIso(ms: number): string {
  return `${new Date(ms - OFFSET_MS).toISOString().slice(0, 19)}-03:00`;
}

export interface Reading {
  at: number;
  flow_m3s: number | null;
  level_cm: number | null;
  rain_mm: number | null;
}

export interface StationData {
  code: string;
  /** null when the station sent nothing in the period (`no_recent_data`). */
  latest: Reading | null;
  /** Sum of the rain values of the readings in the hour / 24 h ending at the latest reading; see `rainSum`. */
  rain_1h_mm: number | null;
  rain_24h_mm: number | null;
}

/** A real row is about 250 characters; the cap also bounds the regex below. */
const MAX_ROW_CHARS = 2000;
const SIMPLE_ELEMENTS = /^(?:\s*<([A-Za-z]\w*)(?:\s*\/>|>[^<]*<\/\1>))*\s*$/;
const NUMBER = /^[-+]?\d{1,9}(?:\.\d{1,9})?$/;
const NO_DATA = /^Sem dados para esta estação \(Código: (\d{1,10})\) no período solicitado!$/;

function fail(reason: string): never {
  throw new SourceUnavailableError(reason);
}

/** The text of a simple element: null when empty (`<Vazao />`), undefined when absent; fails on nested markup. */
function element(block: string, name: string): string | null | undefined {
  const m = new RegExp(`<${name}(?:\\s*/>|>([^<]*)</${name}>)`).exec(block);
  if (!m) return undefined;
  const text = (m[1] ?? "").trim();
  return text === "" ? null : text;
}

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (!NUMBER.test(v)) fail("number");
  return Number(v);
}

/**
 * Sum of the rain values of the readings with time in (end - span, end]. Null when no reading in the window has a rain
 * value, or when the window starts before the requested period (the rows before it were not asked for). Missing
 * readings are not filled in: the sum is a lower bound when there are gaps.
 */
function rainSum(readings: Reading[], end: number, span: number, fromMs: number): number | null {
  if (end - span < fromMs) return null;
  let sum = 0;
  let seen = false;
  for (const r of readings) {
    if (r.at > end - span && r.at <= end && r.rain_mm !== null) {
      sum += r.rain_mm;
      seen = true;
    }
  }
  return seen ? Math.round(sum * 100) / 100 : null;
}

/** Rows more than this far after the read time are ignored (a station clock running ahead). */
const FUTURE_TOLERANCE_MS = 15 * 60 * 1000;

/**
 * Reads one `DadosHidrometeorologicos` answer. Fails closed (source_unavailable) on anything that is not the expected
 * document: no XML declaration, a DOCTYPE or ENTITY, CDATA, a root other than `DataTable xmlns="http://MRCS/"`, an
 * `Error` other than the exact "no data" text for this code, a row for another station, an unparsable date or number,
 * a malformed row, or neither rows nor an `ErrorTable`. The "no data" answer gives `latest: null`. The latest reading is
 * the newest row (by time, not row order) with at least one value; rows with no value, or dated more than 15 minutes
 * after `nowMs`, are not used.
 */
export function parseStationData(code: string, body: string, fromMs: number, nowMs: number): StationData {
  const xml = body.replace(/^﻿/, "").trim();
  if (!/^<\?xml version="1\.0" encoding="utf-8"\?>/i.test(xml)) fail("not XML");
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(xml)) fail("DTD or CDATA");
  if (!/^<\?xml[^>]*\?>\s*<DataTable xmlns="http:\/\/MRCS\/">/.test(xml) || !xml.endsWith("</DataTable>")) fail("unexpected root");
  const errors = [...xml.matchAll(/<ErrorTable\b[^>]*>([\s\S]*?)<\/ErrorTable>/g)];
  const rowOpen = xml.match(/<DadosHidrometereologicos\b/g)?.length ?? 0;
  const rows = [...xml.matchAll(/<DadosHidrometereologicos\b[^>]*>([\s\S]*?)<\/DadosHidrometereologicos>/g)];
  if (rows.length !== rowOpen) fail("malformed row");
  if (errors.length > 0 || /<ErrorTable\b/.test(xml)) {
    if (errors.length !== 1 || rows.length > 0) fail("unexpected error table");
    const m = NO_DATA.exec(element(errors[0]![1]!, "Error") ?? "");
    if (!m || m[1] !== code) fail("source error");
    return { code, latest: null, rain_1h_mm: null, rain_24h_mm: null };
  }
  if (rows.length === 0) fail("no rows");
  const readings: Reading[] = rows.map(([, inner]) => {
    // A row holds only simple elements (text or empty), nothing nested.
    if (inner!.length > MAX_ROW_CHARS || !SIMPLE_ELEMENTS.test(inner!)) fail("malformed row");
    if (element(inner!, "CodEstacao") !== code) fail("row for another station");
    const at = parseDataHora(element(inner!, "DataHora") ?? "");
    if (at === null) fail("date");
    return { at, flow_m3s: num(element(inner!, "Vazao")), level_cm: num(element(inner!, "Nivel")), rain_mm: num(element(inner!, "Chuva")) };
  });
  const usable = readings.filter(
    (r) => r.at <= nowMs + FUTURE_TOLERANCE_MS && (r.level_cm !== null || r.flow_m3s !== null || r.rain_mm !== null),
  );
  if (usable.length === 0) return { code, latest: null, rain_1h_mm: null, rain_24h_mm: null };
  // Row order is not trusted: the latest reading is the one with the latest time.
  const latest = usable.reduce((a, b) => (b.at > a.at ? b : a));
  return {
    code,
    latest,
    rain_1h_mm: rainSum(usable, latest.at, HOUR_MS, fromMs),
    rain_24h_mm: rainSum(usable, latest.at, DAY_MS, fromMs),
  };
}

// `() => Date.now()` (not `Date.now` bound at load) so the cache follows the clock tests set.
const cache = new TtlCache(ANA_CACHE_TTL_MS, () => Date.now());
const gate = createHostGate({ minIntervalMs: ANA_MIN_INTERVAL_MS, maxQueueWaitMs: ANA_MAX_QUEUE_WAIT_MS });

/** Tests only. */
export function clearAnaCache(): void {
  cache.clear();
  gate.reset();
}

/** The station's own answer could not be read (not XML, malformed, an unknown error text): the host itself answered. */
export class StationDataError extends SourceUnavailableError {
  constructor(readonly cause: SourceUnavailableError) {
    super(cause.reason);
    this.name = "StationDataError";
  }
}

/**
 * One GET per station per 15 minutes, through the host gate (5 s between request starts, a turn more than 10 s away
 * is rate_limited, failures remembered 60 s to 1 hour, 401/403/CAPTCHA blocks the host 10 minutes in fetchText).
 * Only the transfer runs in the gate: an answer that cannot be read is a StationDataError for that station, not a
 * host failure (it is not cached and does not stop requests for other stations).
 * Keyed by station code (the URL's dates change at midnight). A cached station makes no request and never waits.
 */
export function getStationData(station: Station): Promise<Cached<StationData>> {
  return cache.getOrLoad(`ana:${station.code}`, async () => {
    const now = Date.now();
    const res = await gate.run(() =>
      fetchText(stationDataUrl(station.code, now), {
        timeoutMs: ANA_TIMEOUT_MS,
        maxBytes: ANA_MAX_BYTES,
        sameHostOnly: true,
        redirectPathPrefix: "/ServiceANA.asmx",
      }),
    );
    try {
      if (!/^(?:text|application)\/xml\b/i.test(res.contentType.trim())) fail("not XML");
      return parseStationData(station.code, res.body, requestPeriod(now).fromMs, Date.now());
    } catch (err) {
      throw err instanceof SourceUnavailableError ? new StationDataError(err) : err;
    }
  });
}
