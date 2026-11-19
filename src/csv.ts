/**
 * Thrown when a field outgrows its cap (e.g. an unterminated quote would swallow the rest of the file) or a record has
 * too many fields (a wide or malformed line), so memory stays bounded.
 */
export class CsvLimitError extends Error {
  constructor(what: "field" | "columns") {
    super(`csv ${what} limit exceeded`);
    this.name = "CsvLimitError";
  }
}

export const MAX_FIELD_CHARS = 1 << 20;
export const MAX_COLUMNS = 300;

/** Streaming CSV record parser (RFC 4180 quoting: `"` quotes, `""` escapes, quoted newlines). State survives chunks. */
export class CsvParser {
  private field = "";
  private record: string[] = [];
  private inQuotes = false;
  private quoteSeen = false; // just closed a quote inside a quoted field
  private pendingCr = false;
  private touched = false; // the current record has any content

  constructor(
    private readonly delimiter: string,
    private readonly onRecord: (fields: string[]) => void,
    private readonly maxField: number = MAX_FIELD_CHARS,
    private readonly maxColumns: number = MAX_COLUMNS,
  ) {}

  push(text: string): void {
    const d = this.delimiter;
    let field = this.field;
    for (let i = 0; i < text.length; i++) {
      const c = text[i]!;
      if (this.pendingCr) {
        this.pendingCr = false;
        if (c === "\n") continue;
      }
      if (this.inQuotes) {
        if (this.quoteSeen) {
          this.quoteSeen = false;
          if (c === '"') {
            field += '"';
            if (field.length > this.maxField) throw new CsvLimitError("field");
            continue;
          }
          this.inQuotes = false; // the quote closed the field; fall through to normal handling
        } else if (c === '"') {
          this.quoteSeen = true;
          continue;
        } else {
          field += c;
          if (field.length > this.maxField) throw new CsvLimitError("field");
          continue;
        }
      }
      if (c === '"' && field === "") {
        this.inQuotes = true;
        this.touched = true;
      } else if (c === d) {
        this.record.push(field);
        if (this.record.length > this.maxColumns) throw new CsvLimitError("columns");
        field = "";
        this.touched = true;
      } else if (c === "\n" || c === "\r") {
        if (c === "\r") this.pendingCr = true;
        this.record.push(field);
        if (this.record.length > this.maxColumns) throw new CsvLimitError("columns");
        field = "";
        this.emit();
      } else {
        field += c;
        this.touched = true;
        if (field.length > this.maxField) throw new CsvLimitError("field");
      }
    }
    this.field = field;
  }

  end(): void {
    if (this.inQuotes && this.quoteSeen) this.inQuotes = false;
    if (this.touched || this.field !== "") {
      this.record.push(this.field);
      if (this.record.length > this.maxColumns) throw new CsvLimitError("columns");
      this.field = "";
      this.emit();
    }
  }

  private emit(): void {
    const rec = this.record;
    this.record = [];
    const blank = !this.touched && rec.length === 1 && rec[0] === "";
    this.touched = false;
    if (!blank) this.onRecord(rec);
  }
}

/** `;` or `,`, whichever appears more often outside quotes in the first line (`,` on a tie). */
export function detectDelimiter(firstLine: string): ";" | "," {
  let semi = 0;
  let comma = 0;
  let q = false;
  for (const c of firstLine) {
    if (c === '"') q = !q;
    else if (!q && c === ";") semi++;
    else if (!q && c === ",") comma++;
  }
  return semi > comma ? ";" : ",";
}
