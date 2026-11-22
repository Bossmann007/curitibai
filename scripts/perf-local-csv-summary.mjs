// Timing guard for local_csv_summary's contact-data check on long values (v0.13.3 review: a column of long text).
// Writes an invented CSV of 2,000 distinct 8,000-character values, each repeated 3 times (6,000 rows), in a temporary
// CURITIBAI_DATA_DIR, then times the built tool's handler grouping by that column. Every distinct value is masked once
// (values over 1,000 characters are cached by SHA-256, so the repeats are not masked again). Budget 2 s per call: fails
// over LIMIT_MS; the median is printed for comparison.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DISTINCT = 2_000;
const VALUE_CHARS = 8_000;
const REPEATS = 3;
const RUNS = 5;
const LIMIT_MS = 2_000;

const dir = mkdtempSync(join(tmpdir(), "curitibai-perf-csv-"));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
const words = ["parque", "rua", "praça", "linha", "feira", "museu", "teatro", "bosque", "jardim", "centro"];
const value = (i) => {
  let s = `registro ${String(i).padStart(4, "0")} `;
  for (let k = 0; s.length < VALUE_CHARS; k++) s += `${words[(i * 7 + k) % words.length]} `;
  return s.slice(0, VALUE_CHARS);
};
const rows = ["id;descricao"];
for (let r = 0; r < REPEATS; r++) for (let i = 0; i < DISTINCT; i++) rows.push(`${r * DISTINCT + i};${value(i)}`);
writeFileSync(join(dir, "long.csv"), `${rows.join("\n")}\n`);
process.env.CURITIBAI_DATA_DIR = dir;

const { localCsvSummary } = await import("../dist/tools/localCsvSummary.js");
const args = { file: "long.csv", group_by: "descricao", top: 5 };
const times = [];
let res;
for (let i = 0; i < RUNS; i++) {
  const start = performance.now();
  res = await localCsvSummary.handler(args);
  times.push(performance.now() - start);
}
if (res.isError) {
  console.error(`perf: local_csv_summary failed: ${res.content?.[0]?.text}`);
  process.exit(1);
}
if (res.structuredContent.data.row_count !== DISTINCT * REPEATS) {
  console.error(`perf: local_csv_summary counted ${res.structuredContent.data.row_count} rows, expected ${DISTINCT * REPEATS}`);
  process.exit(1);
}
times.sort((a, b) => a - b);
const median = times[Math.floor(RUNS / 2)];
if (median > LIMIT_MS) {
  console.error(`perf: local_csv_summary median ${median.toFixed(1)} ms over ${LIMIT_MS} ms (${DISTINCT} distinct ${VALUE_CHARS}-character values)`);
  process.exit(1);
}
console.log(
  `perf: local_csv_summary median ${median.toFixed(1)} ms, max ${times[RUNS - 1].toFixed(1)} ms over ${RUNS} runs ` +
    `(${DISTINCT} distinct ${VALUE_CHARS}-character values x ${REPEATS}; limit ${LIMIT_MS} ms)`,
);
