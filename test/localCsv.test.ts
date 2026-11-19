import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CsvLimitError, CsvParser, detectDelimiter, MAX_COLUMNS, MAX_FIELD_CHARS } from "../src/csv.js";
import { closeFile, DATA_DIR_ENV, LocalFileError, openDataFile, openVerified, readChunks } from "../src/localfs.js";
import { isSensitiveColumn, localCsvSummaryOutput, looksLikeValue } from "../src/tools/localCsvSummary.js";
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
];

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-test-")));
  dataDir = join(root, "data");
  mkdirSync(dataDir);
  mkdirSync(join(dataDir, "sub"));
  writeFileSync(join(dataDir, "156.csv"), `﻿${HEADER}\r\n${UTF8_ROWS.join("\r\n")}\r\n`, "utf8");
  writeFileSync(join(dataDir, "sub", "comma.CSV"), "a,b\n1,x\n2,x\n3,x\n4,y\n", "utf8");
  // Latin-1 whose first megabyte is plain ASCII: a sniff of the start would call it UTF-8.
  const ascii = `nome;categoria\n${"linha;ascii\n".repeat(100_000)}`;
  writeFileSync(join(dataDir, "latin1.csv"), Buffer.concat([Buffer.from(ascii, "latin1"), Buffer.from("x;Saúde\nx;Saúde\nx;Saúde\n", "latin1")]));
  writeFileSync(join(dataDir, "empty.csv"), "");
  // Headerless: the first line is a (synthetic) record with a name, a CPF-shaped number and a street.
  writeFileSync(join(dataDir, "headerless.csv"), "Fulano Ficticio;123.456.789-09;Rua Ficticia 1\nBeltrana Ficticia;987.654.321-00;Rua Ficticia 2\n");
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
    for (const v of ["123.456.789-09", "12.345.678/0001-90", "a@b.com", "(41) 3333-4444", "41 999998888", "18/11/2026",
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
      row_count: 9,
      malformed_rows: 1,
      filter: null,
    });
    expect(parsed.data.group_by).toEqual({
      column: "ASSUNTO",
      distinct_values: 3,
      distinct_capped: false,
      top: [
        { value: "Iluminação", count: 4 },
        { value: "Poda; árvore", count: 3 },
      ],
      other_count: 1, // "Lixo" has 1 row: below the minimum group size
    });
    const text = JSON.stringify(res);
    for (const leak of ["Rua Fictícia", "duas linhas", '"Fictícia"']) expect(text).not.toContain(leak);
  });

  it("filters by column = value (accents and case ignored)", async () => {
    const res = await call({ file: "156.csv", group_by: "BAIRRO", filter_column: "Assunto", filter_value: "iluminacao" });
    const data = localCsvSummaryOutput.parse(res.structuredContent).data;
    expect(data.filter).toEqual({ column: "Assunto", value: "iluminacao", matched_rows: 4 });
    expect(data.group_by?.top).toEqual([]);
    expect(data.group_by?.other_count).toBe(4); // Centro 2, Batel 2: both below 3
  });

  it("cannot rebuild a row by filtering on a unique column", async () => {
    const res = await call({ file: "156.csv", group_by: "BAIRRO", filter_column: "PROTOCOLO", filter_value: "1" });
    const data = localCsvSummaryOutput.parse(res.structuredContent).data;
    expect(data.group_by).toMatchObject({ top: [], other_count: 1 });
    expect(JSON.stringify(res)).not.toContain("Centro");
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
    expect(data).toMatchObject({ delimiter: ",", row_count: 4, group_by: { top: [{ value: "x", count: 3 }], other_count: 1 } });
  });

  it("falls back to Latin-1 when invalid UTF-8 appears late in the file", async () => {
    const res = await call({ file: "latin1.csv", group_by: "categoria" });
    const data = localCsvSummaryOutput.parse(res.structuredContent).data;
    expect(data.encoding).toBe("latin1");
    expect(data.row_count).toBe(100_003);
    expect(data.group_by?.top).toEqual([
      { value: "ascii", count: 100_000 },
      { value: "Saúde", count: 3 },
    ]);
  });

  it("allows a symlink that stays inside the folder", async () => {
    const res = await call({ file: "link-in.csv" });
    expect(localCsvSummaryOutput.parse(res.structuredContent).data.row_count).toBe(9);
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
    ["missing.csv", "file_not_found"],
    ["empty.csv", "invalid_csv"],
    ["open-quote.csv", "invalid_csv"],
  ])("rejects %s with %s", async (file, code) => {
    const res = await call({ file });
    expect(errorOf(res)).toEqual({ error: code });
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
