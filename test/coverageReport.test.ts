import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appReport,
  cartaItems,
  cartaReport,
  classifyService,
  GUIDE_NOT_FOR,
  GUIDE_TERMS,
  main,
  parseAppTable,
  summary,
  usefulness,
} from "../scripts/coverage-report.mjs";
import { GUIDES } from "../src/tools/cityServiceGuide.js";

// Synthetic catalog items (invented titles, not real catalog text).
const ITEMS = [
  { cat: "Saúde", title: "Vacinação sintética contra gripe" },
  { cat: "Saúde", title: "Matrícula sintética em unidade de saúde" },
  { cat: "Saúde", title: "Agendamento sintético de consulta" },
  { cat: "Tributos", title: "IPTU sintético – segunda via" },
  { cat: "Tributos", title: "Certidão sintética de débitos" },
  { cat: "Educação", title: "Inscrição sintética em escola" },
  { cat: "Lazer", title: "Feiras sintéticas de bairro" },
  { cat: "Empresas", title: "Credenciamento sintético de coleta" },
];

const TABLE = `# Tools

## Compared with the Curitiba App

| Curitiba App feature | CuritibAI | Why |
|---|---|---|
| AI assistant ([launch](https://example.invalid/a)) | partial | x |
| Transport ([t, 2026](https://example.invalid/t)) | ✓ | x |
| School calendar | ✓ (municipal network) | x |
| 156 (requests; [i](https://example.invalid/i)) | guide + official link, citizen acts | x |
| EstaR (parking) * | — | x |
| — | extra (not named in the listing) | x |

## Deferred
`;

describe("coverage-report", () => {
  it("guide terms equal city_service_guide's Carta queries, for every guide", () => {
    expect(GUIDE_TERMS).toEqual(Object.fromEntries(Object.entries(GUIDES).map(([id, g]) => [id, g.carta])));
    const notFor = Object.fromEntries(Object.entries(GUIDES).flatMap(([id, g]) => ("notFor" in g ? [[id, g.notFor]] : [])));
    expect(GUIDE_NOT_FOR).toEqual(notFor);
    expect(classifyService("Recurso de multa sintética do EstaR - estacionamento regulamentado").via).not.toBe("city_service_guide estar");
  });

  it("classifies by whole title words: data, guide, none; an action word is never data", () => {
    expect(classifyService("Vacinação sintética contra gripe")).toEqual({ coverage: "data", via: "vaccination_sites_search" });
    expect(classifyService("Feiras sintéticas de bairro").coverage).toBe("data");
    expect(classifyService("IPTU sintético – segunda via")).toEqual({ coverage: "guide", via: "city_service_guide iptu" });
    expect(classifyService("Agendamento sintético de consulta").via).toBe("city_service_guide agenda_online");
    // Contains "unidade de saúde" but asks the citizen to enrol: not answered by a read-only tool.
    expect(classifyService("Matrícula sintética em unidade de saúde").coverage).toBe("none");
    expect(classifyService("Inscrição sintética em escola").coverage).toBe("none");
    // Whole words only: "parques" does not match inside another word, "iptus" is not "iptu".
    expect(classifyService("Parqueamento sintético").coverage).toBe("none");
    expect(classifyService("Iptus sintéticos").coverage).toBe("none");
  });

  it("usefulness: everyday need 3, other 2, business or internal 1 (business wins)", () => {
    expect(usefulness({ cat: "Saúde", title: "Serviço sintético" })).toBe(3);
    expect(usefulness({ cat: "Outros", title: "Coleta sintética de lixo" })).toBe(3);
    expect(usefulness({ cat: "Outros", title: "Serviço sintético" })).toBe(2);
    expect(usefulness({ cat: "Saúde", title: "Alvará sintético para empresas" })).toBe(1);
  });

  it("parses the comparison table: link notes dropped, statuses classed, partial not covered", () => {
    const rows = parseAppTable(TABLE);
    expect(rows).toEqual([
      { feature: "AI assistant", status: "partial" },
      { feature: "Transport", status: "data" },
      { feature: "School calendar", status: "data" },
      { feature: "156", status: "guide" },
      { feature: "EstaR (parking)", status: "none" },
      { feature: "extra", status: "extra" },
    ]);
    expect(appReport(rows)).toMatchObject({ rows: 5, data: 2, guide: 1, partial: 1, none: 1, extra: 1, covered: 3, covered_pct: 60 });
  });

  it("an unknown status cell fails instead of being counted", () => {
    expect(() => parseAppTable(TABLE.replace("| — |", "| maybe |"))).toThrow(/unknown status "maybe" in row "EstaR \(parking\)"/);
    expect(() => parseAppTable("# no section")).toThrow(/no "## Compared with the Curitiba App" section/);
  });

  it("reads the real docs/tools.md table with no unknown status", () => {
    const rows = parseAppTable(readFileSync(join(import.meta.dirname, "..", "docs", "tools.md"), "utf8"));
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.some((r) => r.status === "extra")).toBe(true);
  });

  it("counts per category and overall; uncovered titles never reach the JSON summary", () => {
    const carta = cartaReport(cartaItems({ items: ITEMS }));
    expect(carta).toMatchObject({ total: 8, data: 2, guide: 2, none: 4, reachable_pct: 50 });
    expect(carta.categories.map((c) => [c.category, c.total, c.data, c.guide, c.none])).toEqual([
      ["Educação", 1, 0, 0, 1],
      ["Empresas", 1, 0, 0, 1],
      ["Saúde", 3, 1, 1, 1],
      ["Tributos", 2, 0, 1, 1],
      ["Lazer", 1, 1, 0, 0],
    ]);
    // Ranked by usefulness, not by category size: the business-only service comes last.
    expect(carta.uncovered.map((u) => [u.usefulness, u.title])).toEqual([
      [3, "Inscrição sintética em escola"],
      [3, "Matrícula sintética em unidade de saúde"],
      [3, "Certidão sintética de débitos"],
      [1, "Credenciamento sintético de coleta"],
    ]);
    expect(carta.uncovered_by_usefulness).toEqual({ everyday: 3, other: 0, business_or_internal: 1 });
    const sum = summary(appReport(parseAppTable(TABLE)), carta);
    expect(sum.carta && "uncovered" in sum.carta).toBe(false);
    const json = JSON.stringify(sum);
    for (const { title } of ITEMS) expect(json).not.toContain(title);
  });

  it("rejects a catalog without items of string cat and title", () => {
    expect(() => cartaItems({ items: [{ cat: 1, title: "x" }] })).toThrow(/string "cat" and "title"/);
    expect(() => cartaItems([])).toThrow(/no "items"/);
  });

  it("CLI: part (a) only without a copy; both parts with one; exit 2 on a bad catalog", () => {
    const dir = mkdtempSync(join(tmpdir(), "coverage-report-"));
    try {
      const tools = join(dir, "tools.md");
      writeFileSync(tools, TABLE);
      const run = (argv: string[], env: Record<string, string> = {}) => {
        const lines: string[] = [];
        const errors: string[] = [];
        return { code: main(argv, env, (l) => lines.push(l), (l) => errors.push(l)), text: lines.join("\n"), error: errors.join("\n") };
      };
      const absent = run(["--tools", tools], { CURITIBAI_DATA_DIR: dir });
      expect(absent.code).toBe(0);
      expect(absent.text).toMatch(/no carta-servicos.json in CURITIBAI_DATA_DIR; part \(b\) skipped/);
      // A --carta path that does not exist is a mistake, not a skipped part.
      const typo = run(["--tools", tools, "--carta", join(dir, "missing.json")]);
      expect([typo.code, typo.error]).toEqual([2, "coverage-report: FAIL: cannot read the catalog (ENOENT)"]);
      expect(absent.text).toMatch(/"carta": null/);

      writeFileSync(join(dir, "carta-servicos.json"), JSON.stringify({ items: ITEMS }));
      const both = run(["--tools", tools], { CURITIBAI_DATA_DIR: dir });
      expect(both.code).toBe(0);
      expect(both.text).toMatch(/8 services, reachable 50%/);
      expect(both.text).toMatch(/ {2}3 \[Educação\] Inscrição sintética em escola/);

      writeFileSync(join(dir, "bad.json"), "{");
      expect(run(["--tools", tools, "--carta", join(dir, "bad.json")]).code).toBe(2);
      expect(run(["--bogus", "x"]).code).toBe(2);
      expect(run(["--carta", "--tools", tools]).code).toBe(2);
      expect(run(["--tools", dir]).error).toBe("coverage-report: FAIL: cannot read the tools table (EISDIR)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
