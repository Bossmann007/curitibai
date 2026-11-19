import { z } from "zod";
import { sharedCache, type Cached } from "../cache.js";
import { fetchText, SourceUnavailableError } from "../http.js";
import { decodeEntities, htmlToText } from "../text.js";

const BASE = "https://www.urbs.curitiba.pr.gov.br/portal";
export const URBS_LINES_URL = `${BASE}/wp-content/urbs_data/urbs_horarios/linhas_ativas.json`;
export const URBS_STOPS_URL = `${BASE}/transporte/rede-integrada-de-transporte/relacao-de-pontos-de-parada/`;
export const URBS_SCHEDULE_PAGE_URL = `${BASE}/horario-de-onibus/`;
export const LINE_CODE_RE = /^[A-Z0-9]{1,5}$/;

export function scheduleUrl(code: string): string {
  if (!LINE_CODE_RE.test(code)) throw new Error("invalid line code");
  return `${BASE}/wp-content/urbs_data/urbs_horarios/linha_${code}_v2.json`;
}

export const URBS_LICENSE_NOTE =
  "Published by URBS (Urbanização de Curitiba S.A.) on its public website. No license or terms of use were found " +
  "for this file (checked 2026-11-19). Unofficial; not affiliated with Prefeitura de Curitiba or URBS. " +
  "Timetables can change: confirm at https://www.urbs.curitiba.pr.gov.br/portal/horario-de-onibus/.";

// ---------- active lines ----------

const RawLine = z.object({
  COD: z.string(),
  NOME: z.string(),
  SOMENTE_CARTAO: z.string().optional(),
  CATEGORIA_SERVICO: z.string().optional(),
  NOME_COR: z.string().optional(),
});

export interface BusLine {
  code: string;
  name: string;
  category: string | null;
  color: string | null;
  card_only: boolean | null;
}

export function parseActiveLines(json: unknown): BusLine[] {
  const parsed = z.array(RawLine).safeParse(json);
  if (!parsed.success) throw new SourceUnavailableError("unexpected lines format");
  return parsed.data.map((l) => ({
    code: l.COD.trim().toUpperCase(),
    name: decodeEntities(l.NOME).trim(),
    category: l.CATEGORIA_SERVICO?.trim() || null,
    color: l.NOME_COR?.trim() || null,
    card_only: l.SOMENTE_CARTAO === "S" ? true : l.SOMENTE_CARTAO === "N" ? false : null,
  }));
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new SourceUnavailableError("invalid JSON");
  }
}

export function getActiveLines(): Promise<Cached<BusLine[]>> {
  return sharedCache.getOrLoad(URBS_LINES_URL, async () => {
    const res = await fetchText(URBS_LINES_URL);
    return parseActiveLines(parseJson(res.body));
  });
}

// ---------- schedule ----------

export const DAY_TYPES = ["weekday", "saturday", "sunday"] as const;
export type DayType = (typeof DAY_TYPES)[number];
const DAY_KEY: Record<DayType, string> = { weekday: "1", saturday: "2", sunday: "3" };

const RawDeparture = z.object({ hora: z.string(), adapt: z.boolean().optional() });
const RawSchedule = z.object({
  status: z.string(),
  data: z.object({
    cod_linha: z.string(),
    nome: z.string(),
    pagamento: z.string().nullish(),
    info_extra: z.string().nullish(),
    simulacoes: z.array(
      z.object({
        validade_inicio: z.string().nullish(),
        validade_fim: z.string().nullish(),
        is_current: z.boolean().nullish(),
        dias: z.record(z.string(), z.record(z.string(), z.array(RawDeparture))),
      }),
    ),
  }),
});
export type RawScheduleJson = z.infer<typeof RawSchedule>;

export interface LineSchedule {
  line_code: string;
  line_name: string;
  payment: string | null;
  notes: string | null;
  day_type: DayType;
  runs_on_day: boolean;
  is_current: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  departures: { stop: string; times: { time: string; wheelchair_lift: boolean | null }[] }[];
}

export function validateScheduleJson(json: unknown): RawScheduleJson {
  const parsed = RawSchedule.safeParse(json);
  if (!parsed.success || parsed.data.status !== "success") throw new SourceUnavailableError("unexpected schedule format");
  return parsed.data;
}

export function parseSchedule(raw: RawScheduleJson, dayType: DayType): LineSchedule {
  const key = DAY_KEY[dayType];
  // Same rule as the URBS widget: first period with this day marked is_current, else the first period with this day.
  const withDay = raw.data.simulacoes.filter((s) => s.dias[key] !== undefined);
  const chosen = withDay.find((s) => s.is_current === true) ?? withDay[0];
  const base = {
    line_code: raw.data.cod_linha.trim().toUpperCase(),
    line_name: decodeEntities(raw.data.nome).trim(),
    payment: raw.data.pagamento ? htmlToText(raw.data.pagamento) : null,
    notes: raw.data.info_extra ? htmlToText(raw.data.info_extra) || null : null,
    day_type: dayType,
  };
  if (!chosen) return { ...base, runs_on_day: false, is_current: null, valid_from: null, valid_to: null, departures: [] };
  const stops = chosen.dias[key] ?? {};
  return {
    ...base,
    runs_on_day: true,
    is_current: chosen.is_current ?? null,
    valid_from: chosen.validade_inicio ?? null,
    valid_to: chosen.validade_fim ?? null,
    departures: Object.entries(stops).map(([stop, times]) => ({
      stop: htmlToText(stop),
      times: times.map((t) => ({ time: t.hora.trim(), wheelchair_lift: t.adapt ?? null })),
    })),
  };
}

export function getScheduleJson(code: string): Promise<Cached<RawScheduleJson>> {
  const url = scheduleUrl(code);
  return sharedCache.getOrLoad(url, async () => validateScheduleJson(parseJson((await fetchText(url)).body)));
}

// ---------- stops ----------

const RawStop = z.object({
  title: z.string(),
  lat: z.number(),
  lng: z.number(),
  tipo: z.string().nullish(),
  linhas: z.string().nullish(),
});

export interface BusStop {
  name: string;
  lat: number;
  lon: number;
  stop_type: string | null;
  lines: string | null;
}

export function parseStopsPage(html: string): BusStop[] {
  const m = /data-pontos="([^"]*)"/.exec(html) ?? /data-pontos='([^']*)'/.exec(html);
  if (!m?.[1]) throw new SourceUnavailableError("stops data not found");
  const parsed = z.array(z.unknown()).safeParse(parseJson(decodeEntities(m[1])));
  if (!parsed.success) throw new SourceUnavailableError("unexpected stops format");
  const stops: BusStop[] = [];
  for (const item of parsed.data) {
    const s = RawStop.safeParse(item);
    if (!s.success || !Number.isFinite(s.data.lat) || !Number.isFinite(s.data.lng)) continue;
    stops.push({
      name: htmlToText(s.data.title),
      lat: s.data.lat,
      lon: s.data.lng,
      stop_type: s.data.tipo ? htmlToText(s.data.tipo) : null,
      lines: s.data.linhas ? htmlToText(s.data.linhas) : null,
    });
  }
  if (stops.length === 0) throw new SourceUnavailableError("no stops parsed");
  return stops;
}

export function getStops(): Promise<Cached<BusStop[]>> {
  return sharedCache.getOrLoad(URBS_STOPS_URL, async () => parseStopsPage((await fetchText(URBS_STOPS_URL)).body));
}

/** Great-circle distance in metres (haversine). Computed locally; coordinates never leave the process. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
