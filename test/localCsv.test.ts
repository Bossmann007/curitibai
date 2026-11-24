import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CsvLimitError, CsvParser, detectDelimiter, MAX_COLUMNS, MAX_FIELD_CHARS } from "../src/csv.js";
import { closeFile, DATA_DIR_ENV, LocalFileError, openDataFile, openVerified, readChunks } from "../src/localfs.js";
import { BELOW_MIN, isSensitiveColumn, localCsvSummaryOutput, looksLikeValue, MAX_VALUE_CHARS, MIN_GROUP_COUNT } from "../src/tools/localCsvSummary.js";
import { connectClient, errorOf } from "./helpers.js";

// Synthetic files only, written to a temporary folder outside the repository.
const HAS_FIFO = process.platform !== "win32";
let root: string;
let dataDir: string;

const HEADER = "PROTOCOLO;ASSUNTO;BAIRRO;LOGRADOURO";
const UTF8_ROWS = [
  "1;Iluminação;Centro;Rua Fictícia A",
  "2;Iluminação;Centro;Rua Fictícia B",
  "3;Iluminação;Batel;Rua Fictícia C",
  '4;"Poda; árvore";Centro;"Rua ""Fictícia"" D"',
  '5;"Poda; árvore";Batel;"Rua\nem duas linhas"',
  "6;Poda; árvore;Centro;extra",
  "7;Iluminação;Batel;Rua Fictícia E",
  "8;Lixo;Centro;Rua Fictícia F",
  "9;\"Poda; árvore\";Centro;Rua Fictícia G",
  "10;Iluminação;Batel;Rua Fictícia H",
  "11;Iluminação;Batel;Rua Fictícia I",
  "12;\"Poda; árvore\";Centro;Rua Fictícia J",
  "13;\"Poda; árvore\";Centro;Rua Fictícia K",
];

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-test-")));
  dataDir = join(root, "data");
  mkdirSync(dataDir);
  mkdirSync(join(dataDir, "sub"));
  writeFileSync(join(dataDir, "156.csv"), `﻿${HEADER}\r\n${UTF8_ROWS.join("\r\n")}\r\n`, "utf8");
  writeFileSync(join(dataDir, "sub", "comma.CSV"), "a,b\n1,x\n2,x\n3,x\n4,y\n5,x\n6,x\n", "utf8");
  // Latin-1 whose first megabyte is plain ASCII: a sniff of the start would call it UTF-8.
  const ascii = `nome;categoria\n${"linha;ascii\n".repeat(100_000)}`;
  writeFileSync(join(dataDir, "latin1.csv"), Buffer.concat([Buffer.from(ascii, "latin1"), Buffer.from("x;Saúde\n".repeat(5), "latin1")]));
  writeFileSync(join(dataDir, "empty.csv"), "");
  // Headerless: the first line is a (synthetic) record with a name, a CPF-shaped number and a street.
  writeFileSync(join(dataDir, "headerless.csv"), "Fulano Ficticio;123.456.789-00;Rua Ficticia 1\nBeltrana Ficticia;987.654.321-01;Rua Ficticia 2\n");
  // A line with far more fields than any header.
  writeFileSync(join(dataDir, "wide.csv"), `a,b\n1,2\n${",".repeat(MAX_COLUMNS * 10)}\n`);
  writeFileSync(join(dataDir, "swap.csv"), "a;b\ninside;1\n");
  // Opening a FIFO for reading would block without O_NONBLOCK. mkfifo does not exist on Windows.
  if (HAS_FIFO) execFileSync("mkfifo", [join(dataDir, "pipe.csv")]);
  // 301 fields on the last line, with no trailing newline (the parser's end() path).
  writeFileSync(join(dataDir, "wide-last.csv"), Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `c${i}`).join(";"));
  // An unterminated quote must not buffer the rest of the file into one field.
  writeFileSync(join(dataDir, "open-quote.csv"), `a;b\n1;"never closed\n${"x;y\n".repeat(MAX_FIELD_CHARS / 4 + 10)}`);
  writeFileSync(join(dataDir, "notes.txt"), "a;b\n1;2\n");
  writeFileSync(join(root, "outside.csv"), "a;b\n1;2\n");
  symlinkSync(join(root, "outside.csv"), join(dataDir, "link-out.csv"));
  symlinkSync(join(dataDir, "156.csv"), join(dataDir, "link-in.csv"));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

beforeEach(() => {
  vi.stubEnv(DATA_DIR_ENV, dataDir);
});

async function call(args: Record<string, unknown>) {
  const client = await connectClient();
  return client.callTool({ name: "local_csv_summary", arguments: args });
}

describe("csv parser", () => {
  it("handles quotes, escaped quotes, quoted newlines and CRLF across chunk boundaries", () => {
    const text = 'a;b\r\n"x;1";"say ""hi"""\r\n"multi\r\nline";z\r\n\r\nlast;row';
    for (const size of [1, 2, 3, 7, text.length]) {
      const out: string[][] = [];
      const p = new CsvParser(";", (r) => out.push(r));
      for (let i = 0; i < text.length; i += size) p.push(text.slice(i, i + size));
      p.end();
      expect(out).toEqual([["a", "b"], ["x;1", 'say "hi"'], ["multi\r\nline", "z"], ["last", "row"]]);
    }
  });

  it("stops a field that outgrows the cap", () => {
    const p = new CsvParser(";", () => undefined, 10);
    expect(() => p.push('a;"0123456789ABC')).toThrow(CsvLimitError);
    const q = new CsvParser(";", () => undefined, 10);
    expect(() => q.push("a;0123456789ABC")).toThrow(CsvLimitError);
  });

  it("stops a record as soon as it has too many fields", () => {
    const records: string[][] = [];
    const p = new CsvParser(",", (r) => records.push(r), 100, 5);
    expect(() => p.push(`a,b\n${",".repeat(1000)}`)).toThrow(CsvLimitError);
    expect(records).toEqual([["a", "b"]]);
  });

  it("detects the delimiter from the header", () => {
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter('"a;x",b,c')).toBe(",");
    expect(detectDelimiter("a")).toBe(",");
  });
});

describe("header and column guards", () => {
  it("treats data-looking cells as values", () => {
    for (const v of ["123.456.789-00", "12.345.678/0001-90", "a@b.com", "(41) 3333-4444", "41 999998888", "18/11/2026",
      "2026-11-18", "80000-000", "12345", "x".repeat(61)]) {
      expect({ v, value: looksLikeValue(v) }).toEqual({ v, value: true });
    }
    for (const h of ["PROTOCOLO", "ASSUNTO", "Data de abertura", "BAIRRO_ID", "categoria", ""]) {
      expect({ h, value: looksLikeValue(h) }).toEqual({ h, value: false });
    }
  });

  it("flags personal-looking column names (name-based)", () => {
    for (const c of ["nome", "NOME_SOLICITANTE", "nomeMae", "Name", "cpf", "CNPJ", "RG", "E-mail", "email", "Telefone",
      "fone", "Celular", "Matrícula", "Endereço", "logradouro", "Rua", "CEP", "Data de Nascimento", "servidor",
      "Beneficiário", "paciente", "MÃE", "pai", "numeroRG", "codCep", "ruaResidencia", "DTNASC", "DATA_NASC", "TEL",
      "telResidencial", "CEPResidencia", "RGTitular", "TELResidencial", "RG1", "CEP2", "tel2", "NumRG2",
      "SOLICITANTE", "Requerente", "cidadão", "CONTRIBUINTE", "titular", "Responsável", "NUM_DOCUMENTO", "identidade",
      "contato", "WhatsApp", "usuário", "MORADOR", "placa_veiculo", "Inscrição Municipal"]) {
      expect({ c, sensitive: isSensitiveColumn(c) }).toEqual({ c, sensitive: true });
    }
    for (const c of ["ASSUNTO", "BAIRRO", "PROTOCOLO", "categoria", "Regional", "Programa", "ORGAO", "DESCRICAO"]) {
      expect({ c, sensitive: isSensitiveColumn(c) }).toEqual({ c, sensitive: false });
    }
  });
});

describe("local file descriptor checks", () => {
  it("keeps reading the checked file after it is swapped for a symlink to outside", async () => {
    const { fd } = openDataFile("swap.csv");
    try {
      unlinkSync(join(dataDir, "swap.csv"));
      symlinkSync(join(root, "outside.csv"), join(dataDir, "swap.csv"));
      let text = "";
      for await (const chunk of readChunks(fd)) text += chunk.toString("utf8");
      expect(text).toBe("a;b\ninside;1\n");
    } finally {
      closeFile(fd);
    }
    expect(errorOf(await call({ file: "swap.csv" }))).toEqual({ error: "file_not_allowed" });
  });

  it("refuses to open a path that is now a symlink, even one that was checked as a real file", () => {
    expect(() => openVerified(join(dataDir, "link-in.csv"), dataDir)).toThrow(LocalFileError);
    expect(() => openVerified(join(dataDir, "link-out.csv"), dataDir)).toThrow(LocalFileError);
    closeFile(openVerified(join(dataDir, "156.csv"), dataDir));
  });
});

describe("local_csv_summary", () => {
  it("returns columns, row count and top groups, never rows", async () => {
    const res = await call({ file: "156.csv", group_by: "assunto" });
    expect(res.isError).toBeFalsy();
    const parsed = localCsvSummaryOutput.parse(res.structuredContent);
    expect(parsed.data).toMatchObject({
      file: "156.csv",
      encoding: "utf-8",
      delimiter: ";",
      columns: ["PROTOCOLO", "ASSUNTO", "BAIRRO", "LOGRADOURO"],
      row_count: 13,
      malformed_rows: 1,
      filter: null,
    });
    expect(parsed.data.group_by).toEqual({
      column: "ASSUNTO",
      distinct_values: 3,
      distinct_capped: false,
      top: [
        { value: "Iluminação", count: 6 },
        { value: "Poda; árvore", count: 5 },
      ],
      other_count: "<5", // "Lixo" has 1 row: below the minimum group size
    });
    expect(parsed.note).toContain("O Portal de Dados Abertos de Curitiba e o órgão ou entidade de onde foram acessados os dados não garantem sua autenticidade, qualidade, integridade e atualidade após terem sido disponibilizados para uso secundário.");
    const text = JSON.stringify(res);
    for (const leak of ["Rua Fictícia", "duas linhas", '"Fictícia"']) expect(text).not.toContain(leak);
  });

  it("filters by column = value (accents and case ignored), with no group_by", async () => {
    const res = await call({ file: "156.csv", filter_column: "Assunto", filter_value: "iluminacao" });
    const data = localCsvSummaryOutput.parse(res.structuredContent).data;
    expect(data.filter).toEqual({ column: "Assunto", value: "iluminacao", matched_rows: 6 });
    expect(data.group_by).toBeNull();
  });

  it("refuses a filter and group_by in the same call, before reading the file", async () => {
    const message = "use group_by or filter_column/filter_value, not both: subtracting the counts of two such calls could give a group of fewer than 5 rows";
    for (const args of [
      { file: "156.csv", group_by: "BAIRRO", filter_column: "Assunto", filter_value: "iluminacao" },
      { file: "156.csv", group_by: "BAIRRO", filter_column: "PROTOCOLO", filter_value: "1" },
      { file: "missing.csv", group_by: "BAIRRO", filter_column: "Assunto", filter_value: "x" }, // not read
      { file: "156.csv", group_by: "nome", filter_column: "CPF", filter_value: "x" }, // checked before the column names
    ]) {
      const res = await call(args);
      expect(errorOf(res)).toEqual({ error: "filter_with_group_by_not_allowed", message });
      expect(res.structuredContent).toBeUndefined();
    }
    // A half-given filter is still reported as such.
    expect(errorOf(await call({ file: "156.csv", group_by: "BAIRRO", filter_column: "Assunto" }))).toMatchObject({ error: "invalid_csv" });
  });

  it("returns only groups of at least 5 rows (a group of 4 goes to other_count, shown as \"<5\")", async () => {
    expect(MIN_GROUP_COUNT).toBe(5);
    writeFileSync(join(dataDir, "four.csv"), `tipo\n${"A\n".repeat(5)}${"B\n".repeat(4)}`);
    const data = localCsvSummaryOutput.parse((await call({ file: "four.csv", group_by: "tipo" })).structuredContent).data;
    expect(data.group_by).toMatchObject({ top: [{ value: "A", count: 5 }], other_count: "<5" });
    // Not a protection (docs/adr/0008): the file's totals minus the listed groups give the rest back.
    expect(data.row_count - data.malformed_rows - 5).toBe(4);
    writeFileSync(join(dataDir, "rest.csv"), `tipo\n${"A\n".repeat(5)}${"B\n".repeat(4)}${"C\n".repeat(4)}`);
    const rest = localCsvSummaryOutput.parse((await call({ file: "rest.csv", group_by: "tipo" })).structuredContent).data;
    expect(rest.group_by).toMatchObject({ distinct_values: 3, top: [{ value: "A", count: 5 }], other_count: 8 });
    writeFileSync(join(dataDir, "no-rest.csv"), `tipo\n${"A\n".repeat(5)}`);
    const none = localCsvSummaryOutput.parse((await call({ file: "no-rest.csv", group_by: "tipo" })).structuredContent).data;
    expect(none.group_by?.other_count).toBe(0);
  });

  it("refuses a column whose returned values look like personal data (the contact-data guard would change them)", async () => {
    writeFileSync(join(dataDir, "contact-values.csv"), `ref;tipo\n${"(41) 3333-4444;A\n".repeat(5)}${"x@ficticio.example;A\n".repeat(5)}`);
    const res = await call({ file: "contact-values.csv", group_by: "ref" });
    expect(errorOf(res)).toEqual({
      error: "column_not_allowed",
      message: "values of this column look like personal contact data (CPF/CNPJ, e-mail or phone, or year ranges that look like phone numbers)",
    });
    const text = JSON.stringify(res);
    for (const leak of ["3333", "ficticio"]) expect(text).not.toContain(leak);
    const ok = localCsvSummaryOutput.parse((await call({ file: "contact-values.csv", group_by: "tipo" })).structuredContent).data;
    expect(ok.group_by?.top).toEqual([{ value: "A", count: 10 }]);
  });

  it("checks the whole value for contact data before cutting it at MAX_VALUE_CHARS (a phone or e-mail split by the cut)", async () => {
    // The cut falls inside the phone ("(41) 3333-" | "4444") and inside the e-mail (before ".example"): the cut
    // values alone do not look like contact data, so only a check on the whole value refuses the column.
    const pad = (n: number) => "Reclamacao ficticia ".repeat(10).slice(0, n);
    const phone = `${pad(MAX_VALUE_CHARS - 10)}(41) 3333-4444`;
    const email = `${pad(MAX_VALUE_CHARS - 12)}x@ficticio.example`;
    expect(phone.slice(0, MAX_VALUE_CHARS).endsWith("(41) 3333-")).toBe(true);
    expect(email.slice(0, MAX_VALUE_CHARS).endsWith("x@ficticio.e")).toBe(true);
    for (const [name, value, leak] of [["cut-phone.csv", phone, "3333"], ["cut-email.csv", email, "ficticio.e"]] as const) {
      writeFileSync(join(dataDir, name), `ref;tipo\n${`${value};A\n`.repeat(MIN_GROUP_COUNT)}`);
      const res = await call({ file: name, group_by: "ref" });
      expect(errorOf(res)).toEqual({
        error: "column_not_allowed",
        message: "values of this column look like personal contact data (CPF/CNPJ, e-mail or phone, or year ranges that look like phone numbers)",
      });
      expect(JSON.stringify(res)).not.toContain(leak);
    }
    // A long value with no contact data is still cut and returned (the check does not refuse long text as such).
    writeFileSync(join(dataDir, "cut-plain.csv"), `ref;tipo\n${`${pad(200)};A\n`.repeat(MIN_GROUP_COUNT)}`);
    const ok = localCsvSummaryOutput.parse((await call({ file: "cut-plain.csv", group_by: "ref" })).structuredContent).data;
    expect(ok.group_by?.top).toEqual([{ value: `${pad(200).slice(0, MAX_VALUE_CHARS)}…`, count: MIN_GROUP_COUNT }]);
  });

  it("caches long clean values by hash, so a different long value with the same start is still checked", async () => {
    // Both over the 1,000-character key limit, with the same first 120 characters; the phone starts just after the cut.
    const start = "Reclamacao ficticia ".repeat(10).slice(0, MAX_VALUE_CHARS);
    const tail = " texto ficticio".repeat(100);
    const clean = `${start} sem contato${tail}`;
    const contact = `${start} (41) 3333-4444${tail}`;
    expect(clean.length).toBeGreaterThan(1000);
    expect(clean.slice(0, MAX_VALUE_CHARS)).toBe(contact.slice(0, MAX_VALUE_CHARS)); // same group key
    writeFileSync(join(dataDir, "long-repeat.csv"), `ref;tipo\n${`${clean};A\n`.repeat(MIN_GROUP_COUNT * 2)}${contact};A\n`);
    const res = await call({ file: "long-repeat.csv", group_by: "ref" });
    expect(errorOf(res)).toMatchObject({ error: "column_not_allowed" });
    expect(JSON.stringify(res)).not.toContain("3333");
    writeFileSync(join(dataDir, "long-clean.csv"), `ref;tipo\n${`${clean};A\n`.repeat(MIN_GROUP_COUNT * 2)}`);
    const ok = localCsvSummaryOutput.parse((await call({ file: "long-clean.csv", group_by: "ref" })).structuredContent).data;
    expect(ok.group_by?.top).toEqual([{ value: `${clean.slice(0, MAX_VALUE_CHARS)}…`, count: MIN_GROUP_COUNT * 2 }]);
  });

  it("cannot rebuild a row by filtering on a unique column", async () => {
    const res = await call({ file: "156.csv", filter_column: "PROTOCOLO", filter_value: "1" });
    const data = localCsvSummaryOutput.parse(res.structuredContent).data;
    expect(data.filter).toEqual({ column: "PROTOCOLO", value: "1", matched_rows: "<5" });
    expect(data.group_by).toBeNull();
    expect(JSON.stringify(res)).not.toContain("Centro");
  });

  it("a filter matching fewer than 5 rows (0 included) shows \"<5\", not the count; 5 or more shows the number", async () => {
    expect(BELOW_MIN).toBe("<5");
    writeFileSync(join(dataDir, "few.csv"), `tipo;bairro\n${"A;X\n".repeat(4)}${"B;Y\n".repeat(5)}${"C;Z\n".repeat(5)}`);
    const run = async (value: string) =>
      localCsvSummaryOutput.parse((await call({ file: "few.csv", filter_column: "tipo", filter_value: value })).structuredContent).data;
    for (const value of ["A", "Z"]) {
      const data = await run(value);
      expect(data.filter).toEqual({ column: "tipo", value, matched_rows: "<5" });
      expect(data.group_by).toBeNull();
      expect(data.row_count).toBe(14); // the whole file's count is not a filter result
    }
    expect((await run("B")).filter?.matched_rows).toBe(5);
  });

  it("no answer gives a filter or group count of 1 to 4 (sweep of every filter and every group_by)", async () => {
    // Groups of 1 to 6 rows in each column, so every small size is present.
    const rows: string[] = [];
    for (let n = 1; n <= 6; n++) for (let i = 0; i < n; i++) rows.push(`T${n};B${(n + i) % 4};C${n % 2}`);
    writeFileSync(join(dataDir, "sweep.csv"), `tipo;bairro;cor\n${rows.join("\n")}\n`);
    const columns = ["tipo", "bairro", "cor"];
    const values = ["T1", "T2", "T3", "T4", "T5", "T6", "B0", "B1", "B2", "B3", "C0", "C1", "none"];
    const counts: unknown[] = [];
    for (const top of [1, 50]) {
      for (const group_by of columns) {
        const res = await call({ file: "sweep.csv", group_by, top });
        const g = localCsvSummaryOutput.parse(res.structuredContent).data.group_by!;
        counts.push(g.other_count, ...g.top.map((t) => t.count));
      }
    }
    let filterAnswers = 0;
    for (const filter_column of columns) {
      for (const filter_value of values) {
        const res = await call({ file: "sweep.csv", filter_column, filter_value });
        if (res.isError) {
          expect(errorOf(res)).toMatchObject({ error: "column_not_allowed" }); // leaves 1 to 4 rows out
          continue;
        }
        filterAnswers++;
        counts.push(localCsvSummaryOutput.parse(res.structuredContent).data.filter!.matched_rows);
      }
      for (const group_by of columns) {
        expect(errorOf(await call({ file: "sweep.csv", group_by, filter_column, filter_value: "T1" }))).toMatchObject({
          error: "filter_with_group_by_not_allowed",
        });
      }
    }
    expect(filterAnswers).toBeGreaterThan(20);
    expect(counts.length).toBeGreaterThan(30);
    expect(counts.filter((c) => typeof c === "number" && c >= 1 && c < MIN_GROUP_COUNT)).toEqual([]);
    expect(counts).toContain(BELOW_MIN);
    // About 60 calls, each reading the file: 5 s on a busy CI runner once (v0.29), so this test gets its own budget.
  }, 20_000);

  it("refuses a filter that leaves 1 to 4 rows out (row_count - matched_rows would give their count)", async () => {
    writeFileSync(join(dataDir, "complement.csv"), `tipo;bairro\n${"A;X\n".repeat(3)}${"B;X\n".repeat(7)}`);
    const res = await call({ file: "complement.csv", filter_column: "tipo", filter_value: "B" });
    expect(errorOf(res)).toMatchObject({ error: "column_not_allowed" });
    expect(JSON.stringify(res)).not.toMatch(/\b(3|7|10)\b/);
    // The minority value itself is already masked, and a filter that matches every row leaves nothing out.
    const minority = localCsvSummaryOutput.parse((await call({ file: "complement.csv", filter_column: "tipo", filter_value: "A" })).structuredContent).data;
    expect(minority.filter?.matched_rows).toBe("<5");
    const all = localCsvSummaryOutput.parse((await call({ file: "complement.csv", filter_column: "bairro", filter_value: "X" })).structuredContent).data;
    expect(all.filter?.matched_rows).toBe(10);
    // Malformed rows never match: they neither hide a small rest nor make a filter on every valid row refused.
    const bad = "x;y;z\n".repeat(5);
    writeFileSync(join(dataDir, "complement-bad.csv"), `tipo;bairro\n${"A;X\n".repeat(3)}${"B;X\n".repeat(7)}${bad}`);
    expect(errorOf(await call({ file: "complement-bad.csv", filter_column: "tipo", filter_value: "B" }))).toMatchObject({ error: "column_not_allowed" });
    writeFileSync(join(dataDir, "all-bad.csv"), `tipo;bairro\n${"B;X\n".repeat(7)}${bad}`);
    const allBad = localCsvSummaryOutput.parse((await call({ file: "all-bad.csv", filter_column: "tipo", filter_value: "B" })).structuredContent).data;
    expect(allBad).toMatchObject({ row_count: 12, malformed_rows: 5, filter: { matched_rows: 7 } });
  });

  it("returns a text-only first line as column names (documented limit: it cannot be told from a header)", async () => {
    writeFileSync(join(dataDir, "text-first.csv"), "JOAO INVENTADO DA SILVA;CURITIBA\nMARIA INVENTADA;CURITIBA\n");
    const data = localCsvSummaryOutput.parse((await call({ file: "text-first.csv" })).structuredContent).data;
    expect(data.columns).toEqual(["JOAO INVENTADO DA SILVA", "CURITIBA"]);
    expect(data.row_count).toBe(1); // the second line is a data row: counted, never returned
    expect(JSON.stringify(data)).not.toContain("MARIA");
  });

  it("refuses a file whose first line looks like data, without returning it", async () => {
    const res = await call({ file: "headerless.csv" });
    expect(errorOf(res)).toEqual({ error: "no_header_detected" });
    expect(res.structuredContent).toBeUndefined();
    const text = JSON.stringify(res);
    for (const leak of ["Fulano", "123.456", "Rua Ficticia"]) expect(text).not.toContain(leak);
  });

  it.each(["LOGRADOURO", "nome", "Nome do solicitante", "CPF", "e-mail", "Telefone", "Endereço", "data_nascimento", "Mãe",
    "SOLICITANTE", "Responsável", "placa"])(
    "refuses to group or filter by %s",
    async (column) => {
      expect(errorOf(await call({ file: "156.csv", group_by: column }))).toEqual({ error: "column_not_allowed" });
      expect(errorOf(await call({ file: "156.csv", filter_column: column, filter_value: "x" }))).toEqual({
        error: "column_not_allowed",
      });
    },
  );

  it("fails early on a line with too many fields", async () => {
    expect(errorOf(await call({ file: "wide.csv" }))).toEqual({ error: "invalid_csv" });
    expect(errorOf(await call({ file: "wide-last.csv" }))).toEqual({ error: "invalid_csv" });
  });

  it.skipIf(!HAS_FIFO)("refuses a named pipe instead of blocking on it", async () => {
    expect(errorOf(await call({ file: "pipe.csv" }))).toEqual({ error: "file_not_allowed" });
  });

  it("reads comma files in subfolders and limits top", async () => {
    const res = await call({ file: "sub/comma.CSV", group_by: "b", top: 1 });
    const data = localCsvSummaryOutput.parse(res.structuredContent).data;
    expect(data).toMatchObject({ delimiter: ",", row_count: 6, group_by: { top: [{ value: "x", count: 5 }], other_count: "<5" } });
  });

  it("falls back to Latin-1 when invalid UTF-8 appears late in the file", async () => {
    const res = await call({ file: "latin1.csv", group_by: "categoria" });
    const data = localCsvSummaryOutput.parse(res.structuredContent).data;
    expect(data.encoding).toBe("latin1");
    expect(data.row_count).toBe(100_005);
    expect(data.group_by?.top).toEqual([
      { value: "ascii", count: 100_000 },
      { value: "Saúde", count: 5 },
    ]);
  });

  it("allows a symlink that stays inside the folder", async () => {
    const res = await call({ file: "link-in.csv" });
    expect(localCsvSummaryOutput.parse(res.structuredContent).data.row_count).toBe(13);
  });

  it.each([
    ["../outside.csv", "file_not_allowed"],
    ["../does-not-exist.csv", "file_not_allowed"],
    ["../../../nowhere/x.csv", "file_not_allowed"],
    ["/nonexistent-dir/x.csv", "file_not_allowed"],
    ["link-out.csv", "file_not_allowed"],
    ["notes.txt", "file_not_allowed"],
    ["sub", "file_not_allowed"],
    [".", "file_not_allowed"],
    ["/etc/passwd", "file_not_allowed"],
    ["empty.csv", "invalid_csv"],
    ["open-quote.csv", "invalid_csv"],
  ])("rejects %s with %s", async (file, code) => {
    const res = await call({ file });
    expect(errorOf(res)).toEqual({ error: code });
  });

  it("says where to put the file when it is not found", async () => {
    expect(errorOf(await call({ file: "missing.csv" }))).toEqual({
      error: "file_not_found",
      message: expect.stringMatching(/CURITIBAI_DATA_DIR.*docs\/local-data\.md/),
    });
  });

  it("rejects an absolute path to a CSV outside the folder", async () => {
    const res = await call({ file: join(root, "outside.csv") });
    expect(errorOf(res)).toEqual({ error: "file_not_allowed" });
  });

  it("returns a clear error when the env var is unset or not a folder", async () => {
    vi.stubEnv(DATA_DIR_ENV, "");
    expect(errorOf(await call({ file: "156.csv" }))).toEqual({ error: "data_dir_not_set" });
    vi.stubEnv(DATA_DIR_ENV, join(root, "nope"));
    expect(errorOf(await call({ file: "156.csv" }))).toEqual({ error: "data_dir_not_set" });
  });

  it("reports an unknown column and a half-given filter", async () => {
    expect(errorOf(await call({ file: "156.csv", group_by: "nope" }))).toEqual({ error: "column_not_found" });
    expect(errorOf(await call({ file: "156.csv", filter_column: "BAIRRO" }))).toMatchObject({ error: "invalid_csv" });
  });

  it("makes no network call", async () => {
    const fetchSpy = globalThis.fetch as unknown as { mock: { calls: unknown[] } };
    await call({ file: "156.csv", group_by: "BAIRRO" });
    expect(fetchSpy.mock.calls).toHaveLength(0);
  });
});
