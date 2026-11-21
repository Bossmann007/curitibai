import { z } from "zod";
import { closeFile, FileTooLargeError, listDataSubdir, openDataFile, readAllCapped } from "../localfs.js";
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
/** As linked from the dataset's portal page ("Conteúdo licenciado sob uma Licença Creative Commons", badge by/4.0). */
export const URBS_LICENSE =
  "Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/deed.pt_BR), as linked from the dataset's " +
  "portal page";

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
/** A field a row can do without: missing or null becomes "" instead of rejecting the row. */
const optional = (max: number) => z.string().max(max).nullish().transform((v) => v ?? "");
const code = z.string().trim().min(1).max(10);
const digits = z.string().regex(/^\d{1,10}$/);
/** Comma decimals as published ("-25,412345678901"); an empty value is kept as "no coordinate". */
const coordinate = z.string().regex(/^(-?\d{1,3}([,.]\d{1,20})?)?$/);

// Fields a tool selects or orders by are required; descriptive ones are optional. A row that fails is skipped.
export const LinhaRow = z.object({
  COD: code,
  NOME: text(200),
  SOMENTE_CARTAO: optional(5),
  CATEGORIA_SERVICO: text(100),
  NOME_COR: optional(50),
});
export const PontoRow = z.object({
  NOME: optional(300),
  NUM: digits,
  LAT: coordinate.nullish().transform((v) => v ?? ""),
  LON: coordinate.nullish().transform((v) => v ?? ""),
  SEQ: z.string().regex(/^\d{1,5}$/),
  GRUPO: optional(20),
  SENTIDO: text(200),
  TIPO: optional(100),
  ITINERARY_ID: z.string().trim().min(1).max(20),
  COD: code,
});
export const TabelaRow = z.object({
  HORA: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  PONTO: optional(300),
  DIA: z.string().regex(/^\d{1,2}$/),
  NUM: digits,
  TABELA: optional(20),
  ADAPT: optional(100),
  COD: code,
});

const ROW_SCHEMAS = { linhas: LinhaRow, pontosLinha: PontoRow, tabelaLinha: TabelaRow } as const;
const MAX_ROWS: Record<UrbsKind, number> = { linhas: 100_000, pontosLinha: 1_000_000, tabelaLinha: 2_000_000 };

export type Linha = z.infer<typeof LinhaRow>;
export type Ponto = z.infer<typeof PontoRow>;
export type Tabela = z.infer<typeof TabelaRow>;
type Rows = { linhas: Linha[]; pontosLinha: Ponto[]; tabelaLinha: Tabela[] };

/** A file with more than 1 invalid row in this many (5%) is refused as a whole. */
export const MAX_INVALID_ONE_IN = 20;

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

/** Appended to every rejection of a file: how to use the next newest one instead. */
export function fallbackHint(file: string): string {
  return (
    ` To use an older file instead, delete ${file} or change its name (for example to ${file}.bad) in the ` +
    `${URBS_SUBDIR} folder; the tool then reads the newest remaining dated file.`
  );
}

/**
 * Validates parsed JSON row by row. Rows that do not match are skipped and counted. The whole file is rejected only
 * when it is not a non-empty array within the row cap, or when more than 1 in MAX_INVALID_ONE_IN (5%) of its rows are invalid.
 * Messages name the file and the problem, never the file's text. `adaptMissing` is true for a timetable whose every
 * row has an empty ADAPT: real exports always fill it, so the field is probably missing or renamed.
 */
export function parseUrbs<K extends UrbsKind>(
  kind: K,
  file: string,
  json: unknown,
): { rows: Rows[K]; skipped: number; adaptMissing: boolean } {
  if (!Array.isArray(json) || json.length === 0 || json.length > MAX_ROWS[kind]) {
    const why = !Array.isArray(json) ? "is not a list of rows" : json.length === 0 ? "has no rows" : "has too many rows";
    throw new InvalidUrbsDataError(`${file} does not have the expected ${kind} shape (it ${why}).${fallbackHint(file)}`);
  }
  const schema = ROW_SCHEMAS[kind];
  const rows: unknown[] = [];
  let firstBad = -1;
  let anyAdapt = false;
  for (const [i, raw] of json.entries()) {
    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      rows.push(parsed.data);
      if (!anyAdapt && kind === "tabelaLinha") anyAdapt = (parsed.data as Tabela).ADAPT.trim() !== "";
    } else if (firstBad < 0) firstBad = i;
  }
  const skipped = json.length - rows.length;
  if (skipped * MAX_INVALID_ONE_IN > json.length) {
    throw new InvalidUrbsDataError(
      `${file} does not have the expected ${kind} shape: ${skipped} of ${json.length} rows are invalid ` +
        `(first at row ${firstBad}).${fallbackHint(file)}`,
    );
  }
  return { rows: rows as Rows[K], skipped, adaptMissing: kind === "tabelaLinha" && !anyAdapt };
}

export interface UrbsFile<K extends UrbsKind> {
  rows: Rows[K];
  /** File name as found in the urbs folder. */
  file: string;
  /** The date in the file name (YYYY-MM-DD); `checked_at` and the age warning use it. */
  date: string;
  /** Rows left out because they did not match the expected shape. */
  skipped: number;
  /** Timetable only: every row has an empty ADAPT (see parseUrbs). Always false for the other kinds. */
  adaptMissing: boolean;
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
  } catch (err) {
    if (err instanceof FileTooLargeError) {
      throw new InvalidUrbsDataError(
        `${newest.name} is larger than ${URBS_MAX_BYTES / (1024 * 1024)} MB.${fallbackHint(newest.name)}`,
      );
    }
    throw err;
  } finally {
    closeFile(fd);
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidUrbsDataError(
      `${newest.name} is not valid UTF-8 JSON (decompress the .json.xz file with xz -d).${fallbackHint(newest.name)}`,
    );
  }
  return { ...parseUrbs(kind, newest.name, json), file: newest.name, date: newest.date };
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
