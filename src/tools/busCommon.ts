import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { LocalFileError } from "../localfs.js";
import { dateInCuritiba } from "../sources/detran.js";
import {
  InvalidUrbsDataError,
  loadUrbs,
  URBS_LICENSE,
  URBS_MAX_AGE_DAYS,
  URBS_MIRROR_URL,
  URBS_SOURCE_URL,
  URBS_SUBDIR,
  UrbsFileMissingError,
  type DescriptiveField,
  type UrbsFile,
  type UrbsKind,
} from "../sources/urbs.js";
import { fail } from "./common.js";

/** Shared by the three bus tools and city_points_search: `{data, source_url, checked_at, license_note, note}`. */
export function busEnvelope<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    source_url: z.string().url(),
    checked_at: z.string().date(),
    license_note: z.string(),
    note: z.string(),
  });
}

export const pagingInput = {
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(1_000_000).default(0).describe("Results to skip, for paging."),
};

export const lineCodeInput = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{1,10}$/, "letters and digits only")
  .describe('URBS line code as in bus_lines_search ("203", "X02"); case ignored.');

/** One page of `rows`, with `total`, `offset` and `next_offset` (null on the last page). */
export function page<T>(rows: readonly T[], offset: number, limit: number) {
  const items = rows.slice(offset, offset + limit);
  const end = offset + items.length;
  return { total: rows.length, offset, next_offset: end < rows.length ? end : null, items };
}

export function urbsLicenseNote(file: string): string {
  return (
    "Source: URBS — Urbanização de Curitiba S.A., dataset \"Transporte Coletivo de Curitiba\" on the Portal de Dados " +
    `Abertos de Curitiba (${URBS_SOURCE_URL}), daily export ${file}, downloaded by the user from the portal's mirror ` +
    `(${URBS_MIRROR_URL}). ${URBS_LICENSE}. Values are ` +
    "returned as published, except that coordinates are converted to decimal numbers and e-mail-, phone- and " +
    "CPF/CNPJ-shaped text in a stop name would be replaced by [masked]. Unofficial; not affiliated with URBS or the " +
    "Prefeitura de Curitiba."
  );
}

/** Where a tool's rows came from: the file, its date, how many invalid rows were skipped, and which fields look absent. */
export type UrbsSource = Pick<UrbsFile<UrbsKind>, "file" | "date" | "skipped" | "emptyFields">;

/** `skipped_rows` in each bus tool's data: rows of the file left out because they did not match the expected shape. */
export const skippedRowsOutput = z
  .number()
  .int()
  .min(0)
  .describe("Rows of the file left out because they did not match the expected shape (also stated in `note`).");

export const ADAPT_MISSING_NOTE =
  "Every row of this file has an empty ADAPT (accessibility) field, which real URBS exports always fill: the field " +
  "looks missing or renamed in this file, so an empty `adapt` does not mean the bus has no accessibility equipment.";

/** The result field each descriptive URBS field is returned as. */
const OUTPUT_FIELD: Record<DescriptiveField, string> = {
  NOME_COR: "color",
  SOMENTE_CARTAO: "card_only",
  NOME: "name",
  TIPO: "type",
  GRUPO: "group",
  PONTO: "stop_name",
  TABELA: "table",
  ADAPT: "adapt",
};

const andList = (items: readonly string[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * For descriptive fields (other than ADAPT, which has ADAPT_MISSING_NOTE) that are empty in every row of the file: the
 * field looks missing or renamed, so the values it feeds (empty, or null for `card_only`) do not come from URBS. "" when none.
 */
export function emptyFieldsNote(fields: readonly DescriptiveField[]): string {
  const others = fields.filter((f) => f !== "ADAPT");
  if (others.length === 0) return "";
  const one = others.length === 1;
  return (
    `Every valid row of this file has ${one ? "an empty" : "empty"} ` +
    `${andList(others.map((f) => `${f} (\`${OUTPUT_FIELD[f]}\`)`))} field${one ? "" : "s"}, which ` +
    `real URBS exports fill in at least some rows: ${one ? "the field looks" : "these fields look"} missing or renamed ` +
    `in this file, so ${one ? "its" : "their"} empty or null values in the results do not come from URBS.`
  );
}

/**
 * Base note, plus the count of skipped rows when there are any, plus ADAPT_MISSING_NOTE and emptyFieldsNote when they
 * apply, plus an age warning once more than URBS_MAX_AGE_DAYS have passed since the file's date.
 */
export function urbsNote({ file, date, skipped, emptyFields }: UrbsSource, now: Date): string {
  const missing = emptyFieldsNote(emptyFields);
  const days = (Date.parse(`${dateInCuritiba(now)}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
  const stale =
    days > URBS_MAX_AGE_DAYS
      ? ` The file is dated ${date}, ${days} days ago (more than ${URBS_MAX_AGE_DAYS}); lines and timetables may have changed. Download a newer export.`
      : "";
  return (
    `Read from the local file ${URBS_SUBDIR}/${file} in CURITIBAI_DATA_DIR (the newest of its kind there); this tool ` +
    "makes no network call. Each bus tool reads the newest file of its own kind, so their dates can differ: compare " +
    "`checked_at`. Published timetables, not real-time positions. Confirm with URBS before relying on it." +
    (skipped > 0
      ? ` ${skipped} row${skipped === 1 ? "" : "s"} of the file did not match the expected shape and ${skipped === 1 ? "was" : "were"} left out.`
      : "") +
    (emptyFields.includes("ADAPT") ? ` ${ADAPT_MISSING_NOTE}` : "") +
    (missing ? ` ${missing}` : "") +
    stale
  );
}

const NOT_AVAILABLE = (kind: UrbsKind) =>
  `URBS data is not shipped with this server. Download the daily file YYYY_MM_DD_${kind}.json.xz from ` +
  `${URBS_MIRROR_URL}, decompress it with \`xz -d\`, and put it in the folder "${URBS_SUBDIR}" inside ` +
  "CURITIBAI_DATA_DIR (see the README).";

/** Loads the newest file of `kind`, or the error result to return (v0.6 codes). */
export async function loadUrbsOrFail<K extends UrbsKind>(kind: K): Promise<UrbsFile<K> | CallToolResult> {
  try {
    return await loadUrbs(kind);
  } catch (err) {
    if (err instanceof LocalFileError) {
      return err.code === "file_not_allowed" ? fail("file_not_allowed") : fail("data_not_available", NOT_AVAILABLE(kind));
    }
    if (err instanceof UrbsFileMissingError) return fail("data_not_available", NOT_AVAILABLE(kind));
    if (err instanceof InvalidUrbsDataError) return fail("invalid_data", err.message);
    return fail(
      "invalid_data",
      `The newest ${kind} file could not be read. To use an older file instead, delete it or change its name (for ` +
        `example add .bad) in the ${URBS_SUBDIR} folder.`,
    );
  }
}

export function isFailure(x: object): x is CallToolResult {
  return "isError" in x;
}
