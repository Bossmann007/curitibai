import { z } from "zod";
import { closeFile, listDataSubdir, openDataFile, readAllCapped } from "../localfs.js";
import { datasetUrl } from "./portal.js";

// URBS daily exports (lines, stops, timetables) that the user downloads by hand into CURITIBAI_DATA_DIR/urbs/.
// This server never fetches them: their mirror (dadosabertos.c3sl.ufpr.br) is treated as disallowed (docs/sources.md).

export const URBS_SUBDIR = "urbs";
/** The largest real file (tabelaLinha, 2026-11-20) is about 8.6 MB; anything over this is refused rather than parsed. */
export const URBS_MAX_BYTES = 20 * 1024 * 1024;
/** Past this many days since the file's date (Curitiba time) the note says the timetable may be outdated. */
export const URBS_MAX_AGE_DAYS = 30;
/** Portal page of the dataset "Transporte Coletivo de Curitiba" (publisher URBS). */
export const URBS_DATASET_ID = "ca40f13b-ef61-472b-810f-dd705f85fd2e";
export const URBS_SOURCE_URL = datasetUrl(URBS_DATASET_ID);
export const URBS_MIRROR_URL = "https://dadosabertos.c3sl.ufpr.br/curitibaurbs/";

export type UrbsKind = "linhas" | "pontosLinha" | "tabelaLinha";

const FILE_NAME = /^(\d{4})_(\d{2})_(\d{2})_(linhas|pontosLinha|tabelaLinha)\.json$/;

/** The newest `YYYY_MM_DD_<kind>.json` among `names` (impossible dates such as 2026_02_30 are ignored), or null. */
export function newestUrbsFile(names: readonly string[], kind: UrbsKind): { name: string; date: string } | null {
  let best: { name: string; date: string } | null = null;
  for (const name of names) {
    const m = FILE_NAME.exec(name);
    if (!m || m[4] !== kind) continue;
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    const t = Date.parse(`${date}T00:00:00Z`);
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== date) continue;
    if (best === null || date > best.date) best = { name, date };
  }
  return best;
}

const text = (max: number) => z.string().max(max);
const code = z.string().trim().min(1).max(10);
const digits = z.string().regex(/^\d{1,10}$/);
/** Comma decimals as published ("-25,412345678901"); an empty value is kept as "no coordinate". */
const coordinate = z.string().regex(/^(-?\d{1,3}([,.]\d{1,20})?)?$/);

export const LinhaRow = z.object({
  COD: code,
  NOME: text(200),
  SOMENTE_CARTAO: text(5),
  CATEGORIA_SERVICO: text(100),
  NOME_COR: text(50),
});
export const PontoRow = z.object({
  NOME: text(300),
  NUM: digits,
  LAT: coordinate,
  LON: coordinate,
  SEQ: z.string().regex(/^\d{1,5}$/),
  GRUPO: text(20),
  SENTIDO: text(200),
  TIPO: text(100),
  ITINERARY_ID: text(20),
  COD: code,
});
export const TabelaRow = z.object({
  HORA: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  PONTO: text(300),
  DIA: z.string().regex(/^\d{1,2}$/),
  NUM: digits,
  TABELA: text(20),
  ADAPT: text(100),
  COD: code,
});

const SCHEMAS = {
  linhas: z.array(LinhaRow).max(100_000),
  pontosLinha: z.array(PontoRow).max(1_000_000),
  tabelaLinha: z.array(TabelaRow).max(2_000_000),
} as const;

export type Linha = z.infer<typeof LinhaRow>;
export type Ponto = z.infer<typeof PontoRow>;
export type Tabela = z.infer<typeof TabelaRow>;
type Rows = { linhas: Linha[]; pontosLinha: Ponto[]; tabelaLinha: Tabela[] };

export class InvalidUrbsDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUrbsDataError";
  }
}

/** Thrown when CURITIBAI_DATA_DIR/urbs/ has no file of the kind asked for. */
export class UrbsFileMissingError extends Error {
  constructor(readonly kind: UrbsKind) {
    super(`no ${kind} file`);
    this.name = "UrbsFileMissingError";
  }
}

/** Validates parsed JSON against the kind's shape. Messages name the file and the problem, never the file's text. */
export function parseUrbs<K extends UrbsKind>(kind: K, file: string, json: unknown): Rows[K] {
  const parsed = SCHEMAS[kind].safeParse(json);
  if (!parsed.success) {
    const where = parsed.error.issues[0]?.path.join(".") || "(root)";
    throw new InvalidUrbsDataError(`${file} does not have the expected ${kind} shape (first problem at ${where}).`);
  }
  return parsed.data as Rows[K];
}

export interface UrbsFile<K extends UrbsKind> {
  rows: Rows[K];
  /** File name as found in the urbs folder. */
  file: string;
  /** The date in the file name (YYYY-MM-DD); `checked_at` and the age warning use it. */
  date: string;
}

/**
 * Reads and validates the newest `YYYY_MM_DD_<kind>.json` in $CURITIBAI_DATA_DIR/urbs/ on every call (the user may
 * replace it at any time), through src/localfs.ts with a URBS_MAX_BYTES cap.
 */
export async function loadUrbs<K extends UrbsKind>(kind: K): Promise<UrbsFile<K>> {
  const newest = newestUrbsFile(listDataSubdir(URBS_SUBDIR), kind);
  if (newest === null) throw new UrbsFileMissingError(kind);
  const { fd } = openDataFile(`${URBS_SUBDIR}/${newest.name}`, ".json");
  let bytes: Buffer;
  try {
    bytes = await readAllCapped(fd, URBS_MAX_BYTES);
  } finally {
    closeFile(fd);
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidUrbsDataError(`${newest.name} is not valid UTF-8 JSON (decompress the .json.xz file with xz -d).`);
  }
  return { rows: parseUrbs(kind, newest.name, json), file: newest.name, date: newest.date };
}

/** "-25,412345678901" -> -25.412345678901; empty or out of range -> null. */
export function parseCoordinate(raw: string, limit: number): number | null {
  if (raw === "") return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/**
 * Meaning of the timetable's DIA codes. Not stated in the files or found in URBS documentation: inferred from the
 * 2026-11-20 export (see docs/sources.md), so it is returned next to the code, never instead of it.
 */
export const DAY_TYPES: Record<string, string> = {
  "1": "weekday",
  "2": "saturday",
  "3": "sunday_or_holiday",
};

export const DAY_TYPE_NOTE =
  "`day` is URBS's DIA code as published. `day_type` is this server's reading of it (1 weekday, 2 Saturday, " +
  "3 Sunday or holiday), inferred from the data, not stated by URBS; null for any other code. On holidays URBS " +
  "announces which timetable applies.";
