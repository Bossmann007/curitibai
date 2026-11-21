import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FileTooLargeError, LocalFileError } from "../localfs.js";
import { dateInCuritiba } from "../sources/detran.js";
import {
  InvalidUrbsDataError,
  loadUrbs,
  URBS_MAX_AGE_DAYS,
  URBS_MAX_BYTES,
  URBS_MIRROR_URL,
  URBS_SOURCE_URL,
  URBS_SUBDIR,
  UrbsFileMissingError,
  type UrbsFile,
  type UrbsKind,
} from "../sources/urbs.js";
import { fail } from "./common.js";

/** Shared by the three bus tools: `{data, source_url, checked_at, license_note, note}`. */
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
    `(${URBS_MIRROR_URL}). The portal footer states a Creative Commons licence without naming the variant. Values are ` +
    "returned as published, except that coordinates are converted to decimal numbers and e-mail-, phone- and " +
    "CPF/CNPJ-shaped text in a stop name would be replaced by [masked]. Unofficial; not affiliated with URBS or the " +
    "Prefeitura de Curitiba."
  );
}

/** Base note plus an age warning once more than URBS_MAX_AGE_DAYS have passed since the file's date. */
export function urbsNote(file: string, date: string, now: Date): string {
  const days = (Date.parse(`${dateInCuritiba(now)}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
  const stale =
    days > URBS_MAX_AGE_DAYS
      ? ` The file is dated ${date}, ${days} days ago (more than ${URBS_MAX_AGE_DAYS}); lines and timetables may have changed. Download a newer export.`
      : "";
  return (
    `Read from the local file ${URBS_SUBDIR}/${file} in CURITIBAI_DATA_DIR (the newest of its kind there); this tool ` +
    "makes no network call. Each bus tool reads the newest file of its own kind, so their dates can differ: compare " +
    "`checked_at`. Published timetables, not real-time positions. Confirm with URBS before relying on it." +
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
    if (err instanceof FileTooLargeError) {
      return fail("invalid_data", `The newest ${kind} file is larger than ${URBS_MAX_BYTES / (1024 * 1024)} MB.`);
    }
    if (err instanceof InvalidUrbsDataError) return fail("invalid_data", err.message);
    return fail("invalid_data", `The newest ${kind} file could not be read.`);
  }
}

export function isFailure(x: object): x is CallToolResult {
  return "isError" in x;
}
