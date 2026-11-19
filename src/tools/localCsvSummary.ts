import { z } from "zod";
import { CsvParser, detectDelimiter } from "../csv.js";
import { LocalFileError, readChunks, resolveDataFile } from "../localfs.js";
import { fold } from "../text.js";
import { fail, ok, type ToolDef } from "./common.js";

/** Groups with fewer rows than this are folded into `other_count`, so a filter plus a group-by cannot rebuild a row. */
export const MIN_GROUP_COUNT = 3;
export const MAX_DISTINCT = 50_000;
export const MAX_VALUE_CHARS = 120;
export const MAX_COLUMNS = 300;

export const LOCAL_NOTE =
  "Aggregates of a file the user downloaded by hand into CURITIBAI_DATA_DIR; no network, no rows returned. " +
  `Groups with fewer than ${MIN_GROUP_COUNT} rows are counted in other_count only. ` +
  "The data keeps its publisher's licence: cite the source of the file.";

export const localCsvSummaryInput = {
  file: z.string().min(1).max(255).describe("CSV file name (or relative path) inside the folder set by CURITIBAI_DATA_DIR."),
  group_by: z.string().min(1).max(120).optional().describe("Column to count rows by (exact name; accents and case ignored)."),
  top: z.number().int().min(1).max(50).default(10).describe("How many of the largest groups to return."),
  filter_column: z.string().min(1).max(120).optional().describe("Count only rows where this column equals filter_value."),
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
    filter: z.object({ column: z.string(), value: z.string(), matched_rows: z.number().int() }).nullable(),
    group_by: z
      .object({
        column: z.string(),
        distinct_values: z.number().int(),
        distinct_capped: z.boolean(),
        top: z.array(z.object({ value: z.string(), count: z.number().int() })),
        other_count: z.number().int(),
      })
      .nullable(),
  }),
  source: z.literal("local_file"),
  read_at: z.string().datetime(),
  note: z.string(),
});

class CsvError extends Error {
  constructor(readonly code: "column_not_found" | "invalid_csv") {
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
  capped: boolean;
  delimiter: ";" | ",";
  groupColumn: string;
}

class NotUtf8 extends Error {}

async function scan(
  path: string,
  encoding: "utf-8" | "latin1",
  groupBy: string | undefined,
  filter: { column: string; value: string } | undefined,
): Promise<Scan> {
  const decoder = new TextDecoder(encoding === "utf-8" ? "utf-8" : "latin1", { fatal: encoding === "utf-8" });
  const groups = new Map<string, number>();
  const s: Scan = { columns: [], rows: 0, malformed: 0, matched: 0, groups, capped: false, delimiter: ",", groupColumn: "" };
  let header: string[] | null = null;
  let gi = -1;
  let fi = -1;
  const fv = filter ? fold(filter.value.trim()) : "";
  let parser: CsvParser | null = null;
  let head = "";

  const onRecord = (rec: string[]) => {
    if (header === null) {
      header = rec.map((h, i) => (i === 0 ? h.replace(/^﻿/, "") : h));
      if (header.length > MAX_COLUMNS) throw new CsvError("invalid_csv");
      s.columns = header.map(cut);
      if (groupBy !== undefined) {
        gi = findColumn(header, groupBy);
        s.groupColumn = s.columns[gi]!;
      }
      if (filter) fi = findColumn(header, filter.column);
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
    const v = cut(rec[gi]!.trim()) || "(empty)";
    const n = groups.get(v);
    if (n !== undefined) groups.set(v, n + 1);
    else if (groups.size < MAX_DISTINCT) groups.set(v, 1);
    else s.capped = true;
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
    for await (const chunk of readChunks(path)) feed(decoder.decode(chunk, { stream: true }));
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

export const localCsvSummary: ToolDef<typeof localCsvSummaryInput, typeof localCsvSummaryOutput> = {
  name: "local_csv_summary",
  title: "Summarise a CSV downloaded by hand",
  description:
    "Count rows of a CSV file the user downloaded by hand into the folder set by CURITIBAI_DATA_DIR (for example the " +
    "156 file from the Portal de Dados Abertos de Curitiba). Returns column names, row count and the top groups of one " +
    "column, optionally filtered by column = value. Never returns rows. No network; reads only. Detects ; or , and " +
    "UTF-8 or Latin-1.",
  inputSchema: localCsvSummaryInput,
  outputSchema: localCsvSummaryOutput,
  annotations: { openWorldHint: false },
  handler: async ({ file, group_by, top, filter_column, filter_value }) => {
    if ((filter_column === undefined) !== (filter_value === undefined)) {
      return fail("invalid_csv", "filter_column and filter_value go together");
    }
    const filter = filter_column !== undefined ? { column: filter_column, value: filter_value ?? "" } : undefined;
    try {
      const target = resolveDataFile(file);
      let encoding: "utf-8" | "latin1" = "utf-8";
      let s: Scan;
      try {
        s = await scan(target.path, "utf-8", group_by, filter);
      } catch (err) {
        if (!(err instanceof NotUtf8)) throw err;
        encoding = "latin1"; // restart: the bytes are not valid UTF-8
        s = await scan(target.path, "latin1", group_by, filter);
      }
      let groupOut = null;
      if (group_by !== undefined) {
        const sorted = [...s.groups].filter(([, n]) => n >= MIN_GROUP_COUNT).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
        const shown = sorted.slice(0, top).map(([value, count]) => ({ value, count }));
        const shownTotal = shown.reduce((t, g) => t + g.count, 0);
        groupOut = {
          column: s.groupColumn,
          distinct_values: s.groups.size,
          distinct_capped: s.capped,
          top: shown,
          other_count: s.matched - shownTotal,
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
          filter: filter ? { column: cut(filter.column), value: cut(filter.value), matched_rows: s.matched } : null,
          group_by: groupOut,
        },
        source: "local_file" as const,
        read_at: new Date().toISOString(),
        note: LOCAL_NOTE,
      });
    } catch (err) {
      if (err instanceof LocalFileError) return fail(err.code);
      if (err instanceof CsvError) return fail(err.code);
      return fail("invalid_csv");
    }
  },
};
