import { TtlCache, type Cached } from "../cache.js";
import { blockHost, fetchText, SourceUnavailableError } from "../http.js";
import { createHostGate, underOwnBudget } from "../hostGate.js";
import { cleanField, MASK } from "../mask.js";
import { fold } from "../text.js";
import { dateInCuritiba } from "./detran.js";

/** IPPUC's GeoCuritiba ArcGIS REST services (anonymous GET; robots.txt 404 when checked on 2026-11-21). */
const SERVICES = "https://geocuritiba.ippuc.org.br/server/rest/services";
export const EQUIPMENT_SERVICE_URL = `${SERVICES}/Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer`;
export const BIKE_SERVICE_URL = `${SERVICES}/GeoCuritiba/CICLOVIA_dashboard/FeatureServer`;
/** SMMA's conservation units (Sistema Municipal de Unidades de Conservação), polygons; read on 2026-11-23. */
export const CONSERVATION_SERVICE_URL = `${SERVICES}/GeoCuritiba/Publico_Sistema_Municipal_de_Unidades_de_Conservacao/FeatureServer`;

/** Credit of the types added in v0.24.0 (sport and leisure by SMELJ, conservation units by SMMA). */
export const SPORT_CONSERVATION_CREDIT = "Fonte: IPPUC/GeoCuritiba (SMELJ / SMMA)";
const CONSERVATION_NOTE =
  "A conservation unit is a protected area, not always open to visits: check with SMMA or the 156 before going. " +
  "The layer publishes no update date (`updated` is null).";

/** One layer is about 250 KB at most when checked (bike structure, 838 segments, simplified geometry). */
export const GEOCURITIBA_MAX_BYTES = 2 * 1024 * 1024;
export const GEOCURITIBA_TIMEOUT_MS = 15_000;
/** dt_atualiz changes a few times a year; 6 hours keeps the load to a few requests a day per layer. */
export const GEOCURITIBA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** The services' maxRecordCount. A layer that reaches it may be cut: fail closed. */
const MAX_RECORDS = 2000;

export const NAME_MAX = 150;
export const ADDRESS_MAX = 200;
export const LINE_MAX = 160;
export const MAX_HOUR_LINES = 30;
export const MAX_PHONES = 8;
export const MAX_EMAILS = 3;

/** Loose bounding box around Curitiba; a coordinate outside it is treated as missing. */
const LAT_RANGE = [-25.7, -25.3] as const;
const LON_RANGE = [-49.45, -49.15] as const;

export type LayerKind = "facility" | "park" | "bike";

export interface FacilityType {
  /** The canonical type name accepted by the tool (folded, Portuguese). */
  id: string;
  /** The layer's name as IPPUC publishes it. */
  label: string;
  /** Other accepted names (folded). */
  aliases: string[];
  kind: LayerKind;
  /** The layer's REST URL (cited in results). */
  layerUrl: string;
  /** The layer also lists private or non-profit venues (commercial cinemas, private theatres); results say so. */
  mixedOwnership?: true;
  /** The result's `source` when set (types added in v0.24.0); otherwise FACILITIES_SOURCE. */
  credit?: string;
  /** A sentence added to the result's note for this type. */
  note?: string;
}

const sport = (id: string, layer: number, label: string, aliases: string[]): FacilityType => ({
  ...equipment(id, layer, label, aliases),
  credit: SPORT_CONSERVATION_CREDIT,
});

const conservation = (id: string, layer: number, label: string, aliases: string[]): FacilityType => ({
  id,
  label,
  aliases,
  kind: "park",
  layerUrl: `${CONSERVATION_SERVICE_URL}/${layer}`,
  credit: SPORT_CONSERVATION_CREDIT,
  note: CONSERVATION_NOTE,
});

const equipment = (id: string, layer: number, label: string, aliases: string[] = [], mixed = false): FacilityType => ({
  id,
  label,
  aliases,
  kind: "facility",
  layerUrl: `${EQUIPMENT_SERVICE_URL}/${layer}`,
  ...(mixed ? { mixedOwnership: true as const } : {}),
});

/**
 * The curated subset of layers (ids read from the services on 2026-11-21; the Cultura layers added in v0.20.0 on
 * 2026-11-23). Every layer had under 300 records then (bike structure 838), far below the 2,000-record limit, so one
 * request reads a whole layer.
 */
export const FACILITY_TYPES: readonly FacilityType[] = [
  equipment("feira", 8, "Feira", ["feiras", "feira livre", "feiras livres"]),
  equipment("feira turistica", 163, "Feira Turística", ["feiras turisticas", "feira de artesanato"]),
  equipment("rua da cidadania", 14, "Rua da Cidadania", ["ruas da cidadania"]),
  equipment("ecoponto", 116, "Ecoponto", ["ecopontos"]),
  equipment("ecocidadao", 117, "Ecocidadão", ["ecocidadaos", "parque ecocidadao"]),
  equipment("cambio verde", 5, "Câmbio Verde"),
  equipment("armazem da familia", 3, "Armazém da Família"),
  equipment("sacolao da familia", 4, "Sacolão da Família", ["sacolao"]),
  equipment("mercado municipal", 2, "Mercado Municipal", ["mercado"]),
  equipment("restaurante popular", 6, "Restaurante Popular", ["restaurantes populares"]),
  equipment("banheiro publico", 28, "Sanitário Público", ["banheiros publicos", "sanitario publico", "sanitarios publicos", "banheiro"]),
  equipment("biblioteca", 64, "Biblioteca Geral", ["bibliotecas", "biblioteca geral"]),
  equipment("farol do saber", 63, "Farol do Saber", ["farois do saber"]),
  equipment("museu", 54, "Museu", ["museus"], true),
  equipment("teatro", 55, "Teatro", ["teatros"], true),
  // Cultura group, added in v0.20.0 (ids and counts read on 2026-11-23; at most 24 records each).
  equipment("centro cultural", 50, "Centro Cultural", ["centros culturais"], true),
  equipment("espaco expositivo", 51, "Espaço Expositivo de Artes", [
    "espacos expositivos", "espaco expositivo de artes", "espaco expositivo de arte", "espacos expositivos de artes",
  ], true),
  equipment("memorial", 53, "Memorial", ["memoriais"]),
  equipment("cinema", 56, "Cinema", ["cinemas"], true),
  equipment("espetaculos ao ar livre", 59, "Espaço para Espetáculos ao Ar Livre", [
    "espetaculo ao ar livre", "espaco para espetaculos ao ar livre", "espacos para espetaculos ao ar livre",
    "espaco para espetaculo ao ar livre",
  ], true),
  equipment("gibiteca", 62, "Gibiteca", ["gibitecas"]),
  equipment("academia ao ar livre", 91, "Academia ao Ar Livre", ["academias ao ar livre", "academia"]),
  equipment("clube da gente", 85, "Clube da Gente"),
  equipment("centro de esporte e lazer", 86, "Centro de Esporte e Lazer"),
  equipment("pista de skate", 92, "Pista de Skate", ["skate", "pistas de skate"]),
  // Esporte e Lazer group (83), added in v0.24.0 (ids and counts read on 2026-11-23; at most 10 records each). The
  // SMELJ service holds the same records in one layer but without divulgar_endereco, so these layers are read instead.
  sport("nucleo regional do esporte", 84, "Núcleo Regional do Esporte, Lazer e Juventude", [
    "nucleos regionais do esporte", "nucleo regional do esporte lazer e juventude", "nucleos regionais do esporte lazer e juventude",
  ]),
  sport("centro de atividade fisica", 87, "Centro de Atividade Física", ["centros de atividade fisica"]),
  sport("centro da juventude", 88, "Centro da Juventude", ["centros da juventude"]),
  sport("centro de iniciacao ao esporte", 89, "Centro de Iniciação ao Esporte", ["centros de iniciacao ao esporte"]),
  sport("centro de referencia em esporte", 90, "Centro de Referência em Esporte e Atividade Física", [
    "centro de referencia em esporte e atividade fisica", "centros de referencia em esporte",
  ]),
  sport("pista de bmx", 93, "Pista de Ciclismo BMX", ["bmx", "pista de ciclismo bmx", "pistas de bmx"]),
  sport("centro de lutas", 94, "Centro de Lutas", ["centros de lutas"]),
  sport("pista de patinacao", 165, "Pista de Patinação", ["patinacao", "pistas de patinacao"]),
  sport("velodromo", 166, "Velódromo", ["velodromos"]),
  equipment("cemiterio", 114, "Cemitério Municipal", ["cemiterios", "cemiterio municipal"]),
  equipment("cras", 34, "Centro de Referência de Assistência Social", ["centro de referencia de assistencia social"]),
  equipment("conselho tutelar", 68, "Conselho Tutelar", ["conselhos tutelares"]),
  equipment("posto urbs", 156, "Posto de Atendimento URBS", ["posto de atendimento urbs", "urbs"]),
  equipment("informacoes turisticas", 162, "Posto de Informações Turísticas", ["posto de informacoes turisticas", "turismo"]),
  {
    id: "parque",
    label: "Parques e Bosques",
    aliases: ["parques", "bosque", "bosques", "parques e bosques"],
    kind: "park",
    layerUrl: `${BIKE_SERVICE_URL}/1`,
  },
  // Conservation units added in v0.24.0. Layers 2, 3, 4 and 8 are already in "parque"; 7 (RPPNM, private land, often
  // named after people) is left out as personal data; 10 and 11 (APA, ARIE) lack the bairro and kind fields.
  conservation("estacao ecologica", 1, "Estação Ecológica", ["estacoes ecologicas"]),
  conservation("bosque de conservacao", 5, "Bosque de Conservação da Biodiversidade Urbana", [
    "bcbu", "bosques de conservacao", "bosque de conservacao da biodiversidade urbana",
  ]),
  conservation("refugio da vida silvestre", 6, "Refúgio da Vida Silvestre", ["refugio", "refugios da vida silvestre"]),
  {
    id: "ciclovia",
    label: "Estrutura Cicloviária",
    aliases: ["ciclovias", "ciclofaixa", "ciclofaixas", "estrutura cicloviaria"],
    kind: "bike",
    layerUrl: `${BIKE_SERVICE_URL}/0`,
  },
];

/** Words that ask for the list of types instead of a search. */
export const LIST_WORDS = ["list", "list types", "lista", "listar", "tipos", "listar tipos"];

const norm = (s: string) => fold(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The type for a name or alias (accents, case and punctuation ignored), or null. */
export function resolveType(input: string): FacilityType | null {
  const key = norm(input);
  return FACILITY_TYPES.find((t) => t.id === key || t.aliases.includes(key)) ?? null;
}

export function isListRequest(input: string): boolean {
  return LIST_WORDS.includes(norm(input));
}

/** Fields read from the urban-equipment layers; every other field (indfiscal, dep_admin, site...) is never asked for. */
const EQUIPMENT_FIELDS = [
  "objectid", "nome", "nome_completo", "nome_rua", "num_pred", "compl_end", "divulgar_endereco", "bairro", "regional",
  "func_manha", "func_tarde", "func_noite", "func_24hr", "telefone", "email", "dt_atualiz", "observacao",
].join(",");
const PARK_FIELDS = "objectid,nome,ctba_bairro,ctba_regional,ctba_tipounidprotinteg_smuc,areaoficial";
const BIKE_FIELDS = "objectid,nome,ctba_tipo_ciclovia,ctba_localizacao,ctba_bairro,ctba_regional,lenght_km,operacional";

/**
 * The one fixed URL read for a type: the whole layer (where 1=1), fixed fields, WGS84 (outSR=4326). Nothing from the
 * user's input (neighbourhood, coordinates) is ever sent: filtering happens in this server. (place_at_point's point
 * queries, below, send a point rounded to 4 decimals.)
 */
export function layerQueryUrl(t: FacilityType): string {
  const p = new URLSearchParams({ where: "1=1" });
  if (t.kind === "facility") {
    p.set("outFields", EQUIPMENT_FIELDS);
    p.set("returnGeometry", "true");
  } else if (t.kind === "park") {
    p.set("outFields", PARK_FIELDS);
    p.set("returnGeometry", "false");
    p.set("returnCentroid", "true");
  } else {
    p.set("outFields", BIKE_FIELDS);
    p.set("returnGeometry", "true");
    p.set("maxAllowableOffset", "0.00005");
    p.set("geometryPrecision", "5");
  }
  p.set("outSR", "4326");
  p.set("f", "json");
  return `${t.layerUrl}/query?${p.toString()}`;
}

/** Coded values of the bike and park layers' domains, as published on 2026-11-21 (codes are not contiguous). */
const BAIRROS: Record<number, string> = {
  1: "Centro", 2: "São Francisco", 3: "Centro Cívico", 4: "Alto da Glória", 5: "Alto da Rua XV", 6: "Cristo Rei",
  7: "Jardim Botânico", 8: "Rebouças", 9: "Água Verde", 10: "Batel", 11: "Bigorrilho", 12: "Mercês", 13: "Bom Retiro",
  14: "Ahú", 15: "Juvevê", 16: "Cabral", 17: "Hugo Lange", 18: "Jardim Social", 19: "Tarumã", 20: "Capão da Imbuia",
  21: "Cajuru", 22: "Jardim das Américas", 23: "Guabirotuba", 24: "Prado Velho", 25: "Parolin", 26: "Guaíra",
  27: "Portão", 28: "Vila Izabel", 29: "Seminário", 30: "Campina do Siqueira", 31: "Vista Alegre", 32: "Pilarzinho",
  33: "São Lourenço", 34: "Boa Vista", 35: "Bacacheri", 36: "Bairro Alto", 37: "Uberaba", 38: "Hauer", 39: "Fanny",
  40: "Lindóia", 41: "Novo Mundo", 42: "Fazendinha", 43: "Santa Quitéria", 44: "Campo Comprido", 45: "Mossunguê",
  46: "Santo Inácio", 47: "Cascatinha", 48: "São João", 49: "Taboão", 50: "Abranches", 51: "Cachoeira",
  52: "Barreirinha", 53: "Santa Cândida", 54: "Tingui", 55: "Atuba", 56: "Boqueirão", 57: "Xaxim", 58: "Capão Raso",
  59: "Orleans", 60: "São Braz", 61: "Butiatuvinha", 62: "Lamenha Pequena", 63: "Santa Felicidade",
  64: "Alto Boqueirão", 65: "Sítio Cercado", 66: "Pinheirinho", 67: "São Miguel", 68: "Augusta", 69: "Riviera",
  70: "Caximba", 71: "Campo de Santana", 72: "Ganchinho", 73: "Umbará", 74: "Tatuquara",
  75: "Cidade Industrial de Curitiba",
};
const REGIONAIS: Record<number, string> = {
  1: "Matriz", 2: "Boqueirão", 3: "Cajuru", 4: "Boa Vista", 5: "Santa Felicidade", 7: "Portão", 8: "Pinheirinho",
  10: "Bairro Novo", 11: "CIC", 12: "Tatuquara",
};
const BIKE_KINDS: Record<number, string> = {
  0: "Descaracterizada", 1: "Ciclovia", 2: "Ciclofaixa", 3: "Ciclofaixa (Via Calma)", 4: "Ciclofaixa Sobre a Calçada",
  5: "Passeio Compartilhado", 6: "Ciclorrota",
};
const PARK_KINDS: Record<number, string> = {
  1: "Estação Ecológica", 2: "Parque Natural Municipal", 3: "Reserva Biológica", 4: "Parque Linear",
  5: "Área Verde de Lazer", 6: "Bosque Municipal", 7: "Bosque de Conservação da Biodiversidade Urbana",
  8: "Refúgio da Vida Silvestre", 9: "Reserva Particular do Patrimônio Natural Municipal", 10: "Específicas",
};

export interface OpenPeriods {
  morning: boolean | null;
  afternoon: boolean | null;
  night: boolean | null;
  all_day: boolean | null;
}

export interface Facility {
  name: string;
  /** Park or bike-lane kind from the layer's domain; null for urban equipment. */
  kind: string | null;
  address: string | null;
  bairro: string | null;
  regional: string | null;
  /** `observacao` as published, one entry per line (days and hours, notes). */
  hours: string[];
  open_periods: OpenPeriods | null;
  phones: string[];
  emails: string[];
  /** dt_atualiz as YYYY-MM-DD (Curitiba time). */
  updated: string | null;
  length_km: number | null;
  area: string | null;
  /** A point, a park's centroid, or null. */
  lat: number | null;
  lon: number | null;
  /** Bike segments only: the simplified line, [lon, lat] pairs; used for distance, never returned. */
  paths: [number, number][][] | null;
}

export interface FacilityLayer {
  facilities: Facility[];
  /** Records left out: no name, or (bike) not operational. */
  skipped: number;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
/**
 * 8 to 11 digits with no separator ("Tel 33334444", "41999998888"): a phone the shared mask misses below 10 digits.
 * Format characters are removed first so an invisible character cannot split a run; coordinates are numeric fields
 * and never pass here.
 */
const GLUED_DIGITS = /(?<!\d)\d{8,11}(?!\d)/g;
/** cleanField (control and format characters, NFC, PII mask, cap) after masking glued digit runs. */
export function cleanText(raw: string, max: number): string {
  return cleanField(raw.replace(/\p{Cf}/gu, "").replace(GLUED_DIGITS, MASK), max);
}
const clean = (v: unknown, max: number): string | null => {
  const s = str(v);
  if (s === null) return null;
  const t = cleanText(s, max);
  return t === "" ? null : t;
};
const code = (v: unknown, map: Record<number, string>): string | null => (typeof v === "number" ? (map[v] ?? null) : null);
const yesNo = (v: unknown): boolean | null => (v === "Sim" ? true : v === "Não" ? false : null);

function inside(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ok = lat >= LAT_RANGE[0] && lat <= LAT_RANGE[1] && lon >= LON_RANGE[0] && lon <= LON_RANGE[1];
  return ok ? { lat, lon } : null;
}

/**
 * Institutional phone numbers only, formatted "(41) XXXX-XXXX", plus three-digit public service numbers ("156").
 * A Curitiba landline (DDD 41 or none, 8 digits starting 2–5) is kept; a mobile, a toll-free or another DDD, and any
 * part not understood, is dropped: a mobile in this field can be a person's own number.
 */
export function institutionalPhones(raw: unknown): string[] {
  const s = str(raw);
  if (s === null) return [];
  const out: string[] = [];
  for (const part of s.split(/\s*[/;,]\s*|\s+ou\s+|\s+e\s+/i)) {
    const p = part.trim();
    if (/^1\d{2}$/.test(p)) {
      out.push(p);
      continue;
    }
    if (!/^(?:\(41\)\s?)?\d{4}[-\s]?\d{4}$/.test(p)) continue;
    const d = p.replace(/\D/g, "").replace(/^41(?=\d{8}$)/, "");
    if (/^[2-5]\d{7}$/.test(d)) out.push(`(41) ${d.slice(0, 4)}-${d.slice(4)}`);
  }
  return [...new Set(out)].slice(0, MAX_PHONES);
}

const CITY_EMAIL = /^[a-z0-9][a-z0-9._-]{0,63}@(?:[a-z0-9-]{1,63}\.){0,3}curitiba\.pr\.gov\.br$/;

/**
 * Institutional e-mails only: an address at curitiba.pr.gov.br or one of its subdomains. Any other domain (webmail,
 * universities, private companies, other governments, typos such as "gpv.br") is dropped: it can be a person's own.
 */
export function institutionalEmails(raw: unknown): string[] {
  const s = str(raw);
  if (s === null) return [];
  const out = s
    .toLowerCase()
    .split(/[\s;,/]+/)
    .filter((e) => CITY_EMAIL.test(e));
  return [...new Set(out)].slice(0, MAX_EMAILS);
}

/** `observacao` split into lines, each cleaned and masked (phones and e-mails inside it become "[masked]"). */
function hourLines(raw: unknown): string[] {
  const s = str(raw);
  if (s === null) return [];
  const lines: string[] = [];
  for (const line of s.split(/\r\n|\r|\n/)) {
    const t = cleanText(line, LINE_MAX);
    if (t !== "") lines.push(t);
  }
  return lines.slice(0, MAX_HOUR_LINES);
}

function updated(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? dateInCuritiba(new Date(v)) : null;
}

function equipmentRecord(a: Record<string, unknown>, g: Record<string, unknown> | null): Facility | null {
  const name = clean(a.nome_completo, NAME_MAX) ?? clean(a.nome, NAME_MAX);
  if (name === null) return null;
  // The publisher marks whether the address may be shown; anything but "Sim" hides the address and the position.
  const show = a.divulgar_endereco === "Sim";
  const street = [str(a.nome_rua)?.trim(), str(a.num_pred)?.trim()].filter(Boolean).join(", ");
  const compl = str(a.compl_end)?.trim();
  const at = show && g ? inside(g.y, g.x) : null;
  const periods: OpenPeriods = {
    morning: yesNo(a.func_manha),
    afternoon: yesNo(a.func_tarde),
    night: yesNo(a.func_noite),
    all_day: yesNo(a.func_24hr),
  };
  return {
    name,
    kind: null,
    address: show ? clean(compl ? `${street} - ${compl}` : street, ADDRESS_MAX) : null,
    bairro: clean(a.bairro, 60),
    regional: clean(a.regional, 60),
    hours: hourLines(a.observacao),
    open_periods: Object.values(periods).every((v) => v === null) ? null : periods,
    phones: institutionalPhones(a.telefone),
    emails: institutionalEmails(a.email),
    updated: updated(a.dt_atualiz),
    length_km: null,
    area: null,
    lat: at?.lat ?? null,
    lon: at?.lon ?? null,
    paths: null,
  };
}

function parkRecord(a: Record<string, unknown>, centroid: Record<string, unknown> | null): Facility | null {
  const name = clean(a.nome, NAME_MAX);
  if (name === null) return null;
  const at = centroid ? inside(centroid.y, centroid.x) : null;
  return {
    name,
    kind: code(a.ctba_tipounidprotinteg_smuc, PARK_KINDS),
    address: null,
    bairro: code(a.ctba_bairro, BAIRROS),
    regional: code(a.ctba_regional, REGIONAIS),
    hours: [],
    open_periods: null,
    phones: [],
    emails: [],
    updated: null,
    length_km: null,
    area: clean(a.areaoficial, 40),
    lat: at?.lat ?? null,
    lon: at?.lon ?? null,
    paths: null,
  };
}

function bikePaths(g: Record<string, unknown> | null): [number, number][][] | null {
  if (!g || !Array.isArray(g.paths)) return null;
  const paths: [number, number][][] = [];
  for (const path of g.paths as unknown[]) {
    if (!Array.isArray(path)) return null;
    const pts: [number, number][] = [];
    for (const p of path as unknown[]) {
      if (!Array.isArray(p)) return null;
      const at = inside(p[1], p[0]);
      if (at === null) return null;
      pts.push([at.lon, at.lat]);
    }
    if (pts.length > 0) paths.push(pts);
  }
  return paths.length > 0 ? paths : null;
}

function bikeRecord(a: Record<string, unknown>, g: Record<string, unknown> | null): Facility | null {
  if (a.operacional !== 1) return null;
  const kind = code(a.ctba_tipo_ciclovia, BIKE_KINDS);
  const where = clean(a.ctba_localizacao, ADDRESS_MAX);
  const name = clean(a.nome, NAME_MAX) ?? where ?? kind;
  if (name === null) return null;
  const paths = bikePaths(g);
  const first = paths?.[0]?.[0];
  const km = a.lenght_km;
  return {
    name,
    kind,
    address: where,
    bairro: code(a.ctba_bairro, BAIRROS),
    regional: code(a.ctba_regional, REGIONAIS),
    hours: [],
    open_periods: null,
    phones: [],
    emails: [],
    updated: null,
    length_km: typeof km === "number" && Number.isFinite(km) && km >= 0 ? Math.round(km * 1000) / 1000 : null,
    area: null,
    lat: first ? first[1] : null,
    lon: first ? first[0] : null,
    paths,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads one ArcGIS query answer (f=json). Fails closed (source_unavailable) on anything that is not a complete WGS84
 * feature set: an `error` object (ArcGIS sends errors with HTTP 200), `exceededTransferLimit`, a spatial reference
 * other than 4326, no `features` array, or 2,000 records or more. An `error` with code 401, 403, 498 or 499 is a final
 * refusal: the host is blocked for 10 minutes (blockHost). Records without a name are skipped and counted.
 */
export function parseLayer(t: FacilityType, body: string, url: string = t.layerUrl): FacilityLayer {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new SourceUnavailableError("invalid JSON");
  }
  if (!isObject(json)) throw new SourceUnavailableError("query error");
  if ("error" in json) {
    // ArcGIS sends auth errors with HTTP 200: 401/403, 498 (invalid token), 499 (token required) are a final refusal.
    const code = isObject(json.error) ? json.error.code : undefined;
    if (code === 401 || code === 403 || code === 498 || code === 499) blockHost(url, code);
    throw new SourceUnavailableError("query error");
  }
  if (json.exceededTransferLimit === true) throw new SourceUnavailableError("layer cut by the record limit");
  const sr = json.spatialReference;
  if (!isObject(sr) || (sr.wkid !== 4326 && sr.latestWkid !== 4326)) throw new SourceUnavailableError("not WGS84");
  if (!Array.isArray(json.features) || json.features.length >= MAX_RECORDS) throw new SourceUnavailableError("no features");
  const facilities: Facility[] = [];
  let skipped = 0;
  for (const f of json.features as unknown[]) {
    const a = isObject(f) && isObject(f.attributes) ? f.attributes : null;
    const geo = isObject(f) && isObject(f.geometry) ? f.geometry : null;
    const centroid = isObject(f) && isObject(f.centroid) ? f.centroid : null;
    const rec =
      a === null ? null : t.kind === "facility" ? equipmentRecord(a, geo) : t.kind === "park" ? parkRecord(a, centroid) : bikeRecord(a, geo);
    if (rec === null) skipped++;
    else facilities.push(rec);
  }
  return { facilities, skipped };
}

const cache = new TtlCache(GEOCURITIBA_CACHE_TTL_MS);
/** Point answers: keys are `GET <url>` with the rounded point; at most 500 kept (user positions are unbounded). */
const pointCache = new TtlCache(GEOCURITIBA_CACHE_TTL_MS, Date.now, 500);

/** At least this long between two requests to the GeoCuritiba host from this process (any layer). */
export const GEOCURITIBA_MIN_INTERVAL_MS = 5_000;
/** A call whose turn would come later than this gives up without a request (rate_limited with the wait). */
export const GEOCURITIBA_MAX_QUEUE_WAIT_MS = 10_000;

/** 5 s between requests, failures remembered 60 s to 1 hour (see createHostGate). */
const gate = createHostGate({ minIntervalMs: GEOCURITIBA_MIN_INTERVAL_MS, maxQueueWaitMs: GEOCURITIBA_MAX_QUEUE_WAIT_MS });

/** Tests only. */
export function clearGeoCuritibaCache(): void {
  cache.clear();
  pointCache.clear();
  gate.reset();
}

/**
 * One GET of the type's fixed layer URL per cache period (6 hours), through the gate (5 s between requests to the host,
 * failures remembered); same host and path only on redirects. A cached layer makes no request and never waits.
 */
export function getFacilityLayer(t: FacilityType): Promise<Cached<FacilityLayer>> {
  const url = layerQueryUrl(t);
  return cache.getOrLoad(`GET ${url}`, () => gate.run(async () => {
    const res = await fetchText(url, {
      timeoutMs: GEOCURITIBA_TIMEOUT_MS,
      maxBytes: GEOCURITIBA_MAX_BYTES,
      sameHostOnly: true,
      redirectPathPrefix: "/server/rest/services",
    });
    if (!/json/i.test(res.contentType)) throw new SourceUnavailableError("not JSON");
    return parseLayer(t, res.body, url);
  }));
}

// ---- Point queries: place_at_point (v0.22.0), service_areas_at_point (v0.23.0) ----

/** IPPUC's cadastral map service (the GeoCuritiba/ folder: the root-level name answers 499 "Token Required"). */
export const CADASTRAL_SERVICE_URL = `${SERVICES}/GeoCuritiba/Publico_GeoCuritiba_MapaCadastral/MapServer`;
/** Streets are looked for within this distance of the point. */
export const STREET_RADIUS_M = 100;

/** IPPUC's thematic map service (health unit areas, CRAS territories), the GeoCuritiba/ folder: the root-level name answers 499. */
export const THEMATIC_SERVICE_URL = `${SERVICES}/GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer`;

export type PointLayer = "bairro" | "zoning_decree" | "zoning_law" | "street" | "health_area" | "cras_territory";

const ZONING_FIELDS = "sg_zona,nm_zona,legislacao,data_versao";
/** Service, layer id and fixed fields, read from the services on 2026-11-23 (see docs/sources.md). */
export const POINT_LAYERS: Record<PointLayer, { service: string; id: number; fields: string }> = {
  bairro: { service: CADASTRAL_SERVICE_URL, id: 2, fields: "nome,nm_regional" },
  zoning_decree: { service: CADASTRAL_SERVICE_URL, id: 41, fields: ZONING_FIELDS },
  zoning_law: { service: CADASTRAL_SERVICE_URL, id: 36, fields: ZONING_FIELDS },
  street: { service: CADASTRAL_SERVICE_URL, id: 12, fields: "gtm_nm_logradouro" },
  health_area: { service: THEMATIC_SERVICE_URL, id: 19, fields: "nome,distrito,data,fonte,geometriaaproximada" },
  cras_territory: { service: THEMATIC_SERVICE_URL, id: 5, fields: "nome,tipo,regional,data,fonte,geometriaaproximada" },
};

export interface Point {
  lat: number;
  lon: number;
}

/** True inside the loose box used for every GeoCuritiba coordinate (LAT_RANGE, LON_RANGE). */
export function inCuritibaBox(lat: number, lon: number): boolean {
  return inside(lat, lon) !== null;
}

/** 4 decimals (about 11 m): the only precision sent to the source, cached or returned. */
export function roundPoint(lat: number, lon: number): Point {
  const r = (v: number) => Math.round(v * 1e4) / 1e4;
  return { lat: r(lat), lon: r(lon) };
}

/**
 * The fixed point query of one layer: the rounded point is the only user input in the URL. The street layer also asks
 * for the lines within STREET_RADIUS_M in WGS84, so the nearest one is measured in this server.
 */
export function pointQueryUrl(layer: PointLayer, p: Point): string {
  const l = POINT_LAYERS[layer];
  const q = new URLSearchParams({
    geometry: `${p.lon},${p.lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: l.fields,
  });
  if (layer === "street") {
    q.set("distance", String(STREET_RADIUS_M));
    q.set("units", "esriSRUnit_Meter");
    q.set("returnGeometry", "true");
    q.set("outSR", "4326");
    q.set("geometryPrecision", "6");
  } else {
    q.set("returnGeometry", "false");
  }
  q.set("f", "json");
  return `${l.service}/${l.id}/query?${q.toString()}`;
}

export interface PointFeature {
  attributes: Record<string, unknown>;
  /** Street layer only: the line as [lon, lat] pairs inside the Curitiba box; null when absent or not understood. */
  paths: [number, number][][] | null;
}

/**
 * Reads a point query answer with parseLayer's fail-closed rules: an `error` object (ArcGIS sends errors with HTTP 200;
 * 401/403/498/499 block the host), `exceededTransferLimit`, no `features` array, or 2,000 records or more. A spatial
 * reference other than 4326 fails only when geometry was asked (answers without geometry carry none).
 */
export function parsePointQuery(body: string, url: string, withGeometry: boolean): PointFeature[] {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new SourceUnavailableError("invalid JSON");
  }
  if (!isObject(json)) throw new SourceUnavailableError("query error");
  if ("error" in json) {
    const code = isObject(json.error) ? json.error.code : undefined;
    if (code === 401 || code === 403 || code === 498 || code === 499) blockHost(url, code);
    throw new SourceUnavailableError("query error");
  }
  if (json.exceededTransferLimit === true) throw new SourceUnavailableError("answer cut by the record limit");
  if (withGeometry) {
    const sr = json.spatialReference;
    if (!isObject(sr) || (sr.wkid !== 4326 && sr.latestWkid !== 4326)) throw new SourceUnavailableError("not WGS84");
  }
  if (!Array.isArray(json.features) || json.features.length >= MAX_RECORDS) throw new SourceUnavailableError("no features");
  const out: PointFeature[] = [];
  for (const f of json.features as unknown[]) {
    if (!isObject(f) || !isObject(f.attributes)) continue;
    out.push({ attributes: f.attributes, paths: withGeometry ? streetPaths(isObject(f.geometry) ? f.geometry : null) : null });
  }
  return out;
}

/**
 * A street line as [lon, lat] pairs. Unlike bikePaths, a vertex outside the Curitiba box is kept (a road near the
 * point can run past the box); only a vertex that is not a valid WGS84 pair is dropped. Null when nothing is left.
 */
function streetPaths(g: Record<string, unknown> | null): [number, number][][] | null {
  if (!g || !Array.isArray(g.paths)) return null;
  const valid = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;
  const paths: [number, number][][] = [];
  for (const path of g.paths as unknown[]) {
    if (!Array.isArray(path)) continue;
    const pts: [number, number][] = [];
    for (const p of path as unknown[]) {
      if (Array.isArray(p) && valid(p[0], 180) && valid(p[1], 90)) pts.push([p[0], p[1]]);
    }
    if (pts.length > 0) paths.push(pts);
  }
  return paths.length > 0 ? paths : null;
}

/** cleanText for a point-layer field; null when absent or empty. */
export function cleanPointField(v: unknown, max: number): string | null {
  return clean(v, max);
}

/**
 * One point query through the same host gate as the layers (5 s between requests, failures remembered), cached 6 hours
 * by its URL. `startBy`: no request starts after it (OutOfTimeError).
 */
export function getPointLayer(layer: PointLayer, p: Point, startBy?: number): Promise<Cached<PointFeature[]>> {
  const url = pointQueryUrl(layer, p);
  return underOwnBudget(startBy, () => pointCache.getOrLoad(`GET ${url}`, () => gate.run(async () => {
    const res = await fetchText(url, {
      timeoutMs: GEOCURITIBA_TIMEOUT_MS,
      maxBytes: GEOCURITIBA_MAX_BYTES,
      sameHostOnly: true,
      redirectPathPrefix: "/server/rest/services",
    });
    if (!/json/i.test(res.contentType)) throw new SourceUnavailableError("not JSON");
    return parsePointQuery(res.body, url, layer === "street");
  }, startBy === undefined ? {} : { startBy })));
}
