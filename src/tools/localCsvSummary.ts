import { createHash } from "node:crypto";
import { z } from "zod";
import { CsvParser, detectDelimiter } from "../csv.js";
import { closeFile, LocalFileError, openDataFile, readChunks } from "../localfs.js";
import { MASK, maskObject } from "../mask.js";
import { PORTAL_DISCLAIMER } from "../sources/portal.js";
import { fold } from "../text.js";
import { guardedSummary } from "./cityServicesSearch.js";
import { fail, ok, type ToolDef } from "./common.js";

/**
 * Groups with fewer rows than this are folded into `other_count`, and a filter matching fewer rows shows BELOW_MIN.
 * 3 until 0.13.2; raised to 5 by owner decision (2026-11-21). A filter and a group-by in one call are refused since
 * 0.21.3 (docs/adr/0008).
 */
export const MIN_GROUP_COUNT = 5;
/** What a count of rows below MIN_GROUP_COUNT is shown as (matched_rows: 0 included; other_count: 1 to 4). */
export const BELOW_MIN = `<${MIN_GROUP_COUNT}` as const;
export const MAX_DISTINCT = 50_000;
export const MAX_VALUE_CHARS = 120;
/** Bounds of the cache of long values already checked clean (about 10 MB at most). */
const CLEAN_CACHE_MAX = 5_000;
const CLEAN_CACHE_MAX_CHARS = 1_000;
export const MAX_HEADER_CHARS = 60;

/**
 * Column names that may hold personal data. Long words match anywhere in the name with separators removed
 * ("NOME_SOLICITANTE", "nomeMae", "E-mail", "DTNASC"); short ones match only as a whole word, with camelCase split
 * ("RG", "numeroRG", "codCep", "TEL"). Fails closed on look-alikes ("NOMENCLATURA" is refused too).
 * Name-based, so not perfect: a sensitive column with an innocent or run-together name ("CEPRESIDENCIA") is not caught.
 */
const SENSITIVE_WORDS = [
  "nome", "name", "cpf", "cnpj", "email", "telefone", "fone", "celular", "matricula", "endereco", "logradouro",
  "nasc", "servidor", "beneficiario", "paciente", "solicitante", "requerente", "cidadao", "contribuinte", "titular",
  "responsavel", "documento", "identidade", "contato", "whatsapp", "usuario", "morador", "placa", "inscricao",
];
const SENSITIVE_TOKENS = ["rg", "rua", "cep", "mae", "pai", "tel"];

export function isSensitiveColumn(name: string): boolean {
  const split = name
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2") // numeroRG
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2") // CEPResidencia
    .replace(/(\p{L})(\d)/gu, "$1 $2") // RG1
    .replace(/(\d)(\p{L})/gu, "$1 $2");
  const f = fold(split);
  const compact = f.replace(/[^a-z0-9]/g, "");
  if (SENSITIVE_WORDS.some((w) => compact.includes(w))) return true;
  const tokens = f.split(/[^a-z0-9]+/);
  return SENSITIVE_TOKENS.some((t) => tokens.includes(t));
}

const VALUE_PATTERNS = [
  /^[\d\s.,;:/\\()+\-_]+$/, // only digits and punctuation
  /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/, // CPF
  /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/, // CNPJ
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // e-mail
  /\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/, // phone
  /\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/, // date
  /\d{5}-?\d{3}/, // CEP
];

/** A header cell that looks like data (fails closed: the file is then treated as having no header). */
export function looksLikeValue(cell: string): boolean {
  const t = cell.trim();
  if (t === "") return false;
  if (t.length > MAX_HEADER_CHARS) return true;
  return VALUE_PATTERNS.some((re) => re.test(t));
}

export const LOCAL_NOTE =
  "Aggregates of a file the user downloaded by hand into CURITIBAI_DATA_DIR; no network. " +
  "A first line that looks like data (digits, CPF/CNPJ, e-mail, phone, date, CEP, long text) is refused; a first line made only of text cannot be told apart from a header and is returned as column names. Data rows (after the first line) are never returned. " +
  "Values of the grouped column are returned. " +
  `Groups with fewer than ${MIN_GROUP_COUNT} rows are counted in other_count only. ` +
  "A filter and group_by cannot be used in the same call. " +
  "Columns whose names look personal (nome, CPF, e-mail, telefone, endereço, ...) are refused by name, and a grouped " +
  "column is refused when a value it would return looks like contact data (CPF/CNPJ, e-mail or phone shaped, or year " +
  "ranges that look like phone numbers); " +
  "names of people in values are not detected. " +
  "The data keeps its publisher's licence: cite the source of the file. " +
  `For a file from the Portal de Dados Abertos de Curitiba, the portal's rules ask for this notice: ${PORTAL_DISCLAIMER}`;

export const localCsvSummaryInput = {
  file: z.string().min(1).max(255).describe("CSV file name (or relative path) inside the folder set by CURITIBAI_DATA_DIR."),
  group_by: z.string().min(1).max(120).optional().describe("Column to count rows by (exact name; accents and case ignored). Not with filter_column."),
  top: z.number().int().min(1).max(50).default(10).describe("How many of the largest groups to return."),
  filter_column: z.string().min(1).max(120).optional().describe("Count only rows where this column equals filter_value. Not with group_by."),
  filter_value: z.string().max(200).optional(),
};

const cut = (s: string) => (s.length > MAX_VALUE_CHARS ? `${s.slice(0, MAX_VALUE_CHARS)}…` : s);

export const localCsvSummaryOutput = z.object({
  data: z.object({
    file: z.string(),
    encoding: z.enum(["utf-8", "latin1"]),
    delimiter: z.enum([";", ","]),
    columns: z.array(z.string()),
    row_count: z.number().int(),
    malformed_rows: z.number().int(),
    // matched_rows is BELOW_MIN when the filter matches fewer than MIN_GROUP_COUNT rows (0 included); other_count of 1 to
    // 4 is BELOW_MIN, for consistency only (row_count - malformed_rows - sum(top) gives it back; docs/adr/0008).
    filter: z.object({ column: z.string(), value: z.string(), matched_rows: z.union([z.number().int(), z.literal(BELOW_MIN)]) }).nullable(),
    group_by: z
      .object({
        column: z.string(),
        distinct_values: z.number().int(),
        distinct_capped: z.boolean(),
        top: z.array(z.object({ value: z.string(), count: z.number().int() })),
        other_count: z.union([z.number().int(), z.literal(BELOW_MIN)]),
      })
      .nullable(),
  }),
  source: z.literal("local_file"),
  read_at: z.string().datetime(),
  note: z.string(),
});

class CsvError extends Error {
  constructor(readonly code: "column_not_found" | "column_not_allowed" | "no_header_detected" | "invalid_csv") {
    super(code);
  }
}

function findColumn(header: string[], wanted: string): number {
  const exact = header.indexOf(wanted);
  if (exact >= 0) return exact;
  const w = fold(wanted.trim());
  const hits = header.flatMap((h, i) => (fold(h.trim()) === w ? [i] : []));
  if (hits.length !== 1) throw new CsvError("column_not_found");
  return hits[0]!;
}

interface Scan {
  columns: string[];
  rows: number;
  malformed: number;
  matched: number;
  groups: Map<string, number>;
  /** Grouped (cut) values for which some whole value, longer than MAX_VALUE_CHARS, looked like contact data. */
  contactKeys: Set<string>;
  capped: boolean;
  delimiter: ";" | ",";
  groupColumn: string;
}

class NotUtf8 extends Error {}

async function scan(
  fd: number,
  encoding: "utf-8" | "latin1",
  groupBy: string | undefined,
  filter: { column: string; value: string } | undefined,
): Promise<Scan> {
  const decoder = new TextDecoder(encoding === "utf-8" ? "utf-8" : "latin1", { fatal: encoding === "utf-8" });
  const groups = new Map<string, number>();
  /**
   * Whole values over MAX_VALUE_CHARS already checked and clean, so a repeated value is checked once (bounded). A value
   * over CLEAN_CACHE_MAX_CHARS is kept as its SHA-256, so long repeated values are not masked again either.
   */
  const cleanLong = new Set<string>();
  const cacheKey = (full: string) =>
    full.length <= CLEAN_CACHE_MAX_CHARS ? full : `sha256:${createHash("sha256").update(full).digest("hex")}`;
  const s: Scan = { columns: [], rows: 0, malformed: 0, matched: 0, groups, contactKeys: new Set(), capped: false, delimiter: ",", groupColumn: "" };
  let header: string[] | null = null;
  let gi = -1;
  let fi = -1;
  const fv = filter ? fold(filter.value.trim()) : "";
  let parser: CsvParser | null = null;
  let head = "";

  const onRecord = (rec: string[]) => {
    if (header === null) {
      header = rec.map((h, i) => (i === 0 ? h.replace(/^\uFEFF/, "") : h));
      if (header.some(looksLikeValue)) throw new CsvError("no_header_detected");
      s.columns = header.map(cut);
      if (groupBy !== undefined) {
        gi = findColumn(header, groupBy);
        if (isSensitiveColumn(header[gi]!)) throw new CsvError("column_not_allowed");
        s.groupColumn = s.columns[gi]!;
      }
      if (filter) {
        fi = findColumn(header, filter.column);
        if (isSensitiveColumn(header[fi]!)) throw new CsvError("column_not_allowed");
      }
      return;
    }
    s.rows++;
    if (rec.length !== header.length) {
      s.malformed++;
      return;
    }
    if (filter && fold(rec[fi]!.trim()) !== fv) return;
    s.matched++;
    if (gi < 0) return;
    const full = rec[gi]!.trim();
    const v = cut(full) || "(empty)";
    const n = groups.get(v);
    if (n !== undefined) groups.set(v, n + 1);
    else if (groups.size < MAX_DISTINCT) groups.set(v, 1);
    else {
      s.capped = true;
      return;
    }
    // The contact-data check runs on the whole value, before the cut: a phone or e-mail split by the cut would
    // otherwise pass and be returned in part. Shorter values are their own group key and are checked at the end.
    if (full.length <= MAX_VALUE_CHARS || s.contactKeys.has(v)) return;
    const key = cacheKey(full);
    if (cleanLong.has(key)) return;
    if (maskObject(full).text.includes(MASK)) s.contactKeys.add(v);
    else if (cleanLong.size < CLEAN_CACHE_MAX) cleanLong.add(key);
  };

  const feed = (text: string) => {
    if (parser) return parser.push(text);
    head += text;
    const nl = head.search(/[\r\n]/);
    if (nl < 0 && head.length < 1 << 20) return;
    s.delimiter = detectDelimiter(nl < 0 ? head : head.slice(0, nl));
    parser = new CsvParser(s.delimiter, onRecord);
    parser.push(head);
    head = "";
  };

  try {
    for await (const chunk of readChunks(fd)) feed(decoder.decode(chunk, { stream: true }));
    feed(decoder.decode());
  } catch (err) {
    if (err instanceof TypeError && encoding === "utf-8") throw new NotUtf8();
    throw err;
  }
  if (!parser && head !== "") {
    s.delimiter = detectDelimiter(head.split(/[\r\n]/)[0] ?? "");
    parser = new CsvParser(s.delimiter, onRecord);
    parser.push(head);
  }
  if (!parser) throw new CsvError("invalid_csv");
  (parser as CsvParser).end();
  if (header === null) throw new CsvError("invalid_csv");
  return s;
}

const FILE_NOT_FOUND =
  "No file with that name in CURITIBAI_DATA_DIR. Save the CSV you downloaded into that folder and pass its name; " +
  "see docs/local-data.md.";

export const localCsvSummary: ToolDef<typeof localCsvSummaryInput, typeof localCsvSummaryOutput> = {
  name: "local_csv_summary",
  title: "Summarise a CSV downloaded by hand",
  description:
    "Count rows of a CSV the user put in CURITIBAI_DATA_DIR (e.g. the 156 file): column names, row count, " +
    "and either the top groups of one column or the rows where a column equals a value. Data rows are never " +
    "returned; personal-looking columns (nome, CPF...) are refused by column name only, so other columns may hold " +
    "personal data; counts under 5 show as \"<5\". Needs a header row. No network. Read-only.",
  inputSchema: localCsvSummaryInput,
  outputSchema: localCsvSummaryOutput,
  annotations: { openWorldHint: false },
  handler: async ({ file, group_by, top, filter_column, filter_value }) => {
    if ((filter_column === undefined) !== (filter_value === undefined)) {
      return fail("invalid_csv", "filter_column and filter_value go together");
    }
    const filter = filter_column !== undefined ? { column: filter_column, value: filter_value ?? "" } : undefined;
    // A filter and a group-by in one call are refused (docs/adr/0008): filtered and unfiltered groups, or the groups
    // of two filters, could be subtracted to give a group of 1 to 4 rows inside the filter.
    if (filter && group_by !== undefined) {
      return fail(
        "filter_with_group_by_not_allowed",
        `use group_by or filter_column/filter_value, not both: subtracting the counts of two such calls could give a group of fewer than ${MIN_GROUP_COUNT} rows`,
      );
    }
    // Refuse before reading anything; the resolved header name is checked again during the scan.
    if ((group_by !== undefined && isSensitiveColumn(group_by)) || (filter && isSensitiveColumn(filter.column))) {
      return fail("column_not_allowed");
    }
    try {
      const target = openDataFile(file);
      let encoding: "utf-8" | "latin1" = "utf-8";
      let s: Scan;
      try {
        try {
          s = await scan(target.fd, "utf-8", group_by, filter);
        } catch (err) {
          if (!(err instanceof NotUtf8)) throw err;
          encoding = "latin1"; // restart on the same descriptor: the bytes are not valid UTF-8
          s = await scan(target.fd, "latin1", group_by, filter);
        }
      } finally {
        closeFile(target.fd); // never throws, so the scan's own error code is kept
      }
      // A filter that matched fewer than MIN_GROUP_COUNT rows: matched_rows is BELOW_MIN, so the answer never tells 1
      // row from 4 (or from 0).
      const few = filter !== undefined && s.matched < MIN_GROUP_COUNT;
      // A filter that leaves 1 to 4 well-formed rows out: row_count - malformed_rows - matched_rows would give their
      // exact count, which "<5" cannot hide because matched_rows is then large. Refused. Malformed rows never match,
      // so they are not "left out". One query only: two allowed filters on the same column can still be subtracted
      // (known limit, docs/adr/0008).
      const left = s.rows - s.malformed - s.matched;
      if (filter !== undefined && !few && left > 0 && left < MIN_GROUP_COUNT) {
        return fail(
          "column_not_allowed",
          `this filter leaves fewer than ${MIN_GROUP_COUNT} rows out, so the counts would single them out; filter on another value or column`,
        );
      }
      let groupOut = null;
      if (group_by !== undefined) {
        const sorted = [...s.groups].filter(([, n]) => n >= MIN_GROUP_COUNT).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
        // Values that could be returned and that the contact-data guard would change (CPF/CNPJ-, e-mail- or
        // phone-shaped text): the column is refused whole, whatever `top` is. It detects contact data, not names.
        if (sorted.some(([value]) => s.contactKeys.has(value) || guardedSummary(value) !== value)) {
          return fail(
            "column_not_allowed",
            "values of this column look like personal contact data (CPF/CNPJ, e-mail or phone, or year ranges that look like phone numbers)",
          );
        }
        const shown = sorted.slice(0, top).map(([value, count]) => ({ value, count }));
        const rest = s.matched - shown.reduce((t, g) => t + g.count, 0);
        groupOut = {
          column: s.groupColumn,
          distinct_values: s.groups.size,
          distinct_capped: s.capped,
          top: shown,
          // A rest of 1 to 4 rows is BELOW_MIN (0 stays 0). Not a protection: row_count - malformed_rows - sum(top)
          // gives it back (docs/adr/0008); it only keeps group counts (top, other_count) at 0 or 5 and over.
          other_count: rest > 0 && rest < MIN_GROUP_COUNT ? BELOW_MIN : rest,
        };
      }
      return ok({
        data: {
          file: target.relative,
          encoding,
          delimiter: s.delimiter,
          columns: s.columns,
          row_count: s.rows,
          malformed_rows: s.malformed,
          filter: filter ? { column: cut(filter.column), value: cut(filter.value), matched_rows: few ? BELOW_MIN : s.matched } : null,
          group_by: groupOut,
        },
        source: "local_file" as const,
        read_at: new Date().toISOString(),
        note: LOCAL_NOTE,
      });
    } catch (err) {
      if (err instanceof LocalFileError) return fail(err.code, err.code === "file_not_found" ? FILE_NOT_FOUND : undefined);
      if (err instanceof CsvError) return fail(err.code);
      return fail("invalid_csv");
    }
  },
};
