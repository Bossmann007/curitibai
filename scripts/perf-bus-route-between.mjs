// Timing guard for bus_route_between (v0.41 budget: a call under about 100 ms median on the 17,496-row stops export).
// Generates 17,496 invented stop rows and 400 invented lines in a temporary CURITIBAI_DATA_DIR (no real URBS rows),
// as perf-bus-stops-near.mjs does, then times the built tool's handler, both file reads and validation included, at
// the largest radius. Fails above LIMIT_MS, a wide margin over the budget so a slower CI runner does not fail it, or
// when the generated data gives no direct line; the measured median is printed for comparison.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROWS = 17_496;
const RUNS = 15;
const LIMIT_MS = 400;

const dir = mkdtempSync(join(tmpdir(), "curitibai-perf-"));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
mkdirSync(join(dir, "urbs"));
const coord = (n) => n.toFixed(12).replace(".", ",");
const stops = Array.from({ length: ROWS }, (_, i) => {
  const num = 100_000 + (i % 7_250); // about 7,250 stops served by several lines, as in the real export
  return {
    NOME: `Parada Fictícia ${num}`,
    NUM: String(num),
    LAT: coord(-25.55 + ((num * 7919) % 2000) / 10_000),
    LON: coord(-49.35 + ((num * 104_729) % 2000) / 10_000),
    SEQ: String(i % 90),
    GRUPO: "",
    SENTIDO: `Sentido Fictício ${i % 3}`,
    TIPO: "Domus",
    ITINERARY_ID: String(5000 + (i % 800)),
    COD: String(i % 400).padStart(3, "0"),
  };
});
const lines = Array.from({ length: 400 }, (_, i) => ({
  COD: String(i).padStart(3, "0"),
  NOME: `LINHA FICTÍCIA ${i}`,
  SOMENTE_CARTAO: "N",
  CATEGORIA_SERVICO: "CONVENCIONAL",
  NOME_COR: "AMARELA",
}));
writeFileSync(join(dir, "urbs", "2026_11_20_pontosLinha.json"), JSON.stringify(stops));
writeFileSync(join(dir, "urbs", "2026_11_20_linhas.json"), JSON.stringify(lines));
process.env.CURITIBAI_DATA_DIR = dir;

const { busRouteBetween } = await import("../dist/tools/busRouteBetween.js");
// From the first stop of itinerary 5000 (row 0, SEQ 0) to its stop at row 800 (SEQ 80), so at least one line matches;
// the stops are placed pseudo-randomly, so most other lines near either end do not reach the other.
const at = (row) => ({ lat: Number(stops[row].LAT.replace(",", ".")), lon: Number(stops[row].LON.replace(",", ".")) });
const args = { from: at(0), to: at(800), radius_m: 1000, limit: 50, offset: 0 };
const times = [];
let total = 0;
for (let i = 0; i < RUNS; i++) {
  const start = performance.now();
  const res = await busRouteBetween.handler(args);
  times.push(performance.now() - start);
  if (res.isError) {
    console.error(`perf: bus_route_between failed: ${res.content?.[0]?.text}`);
    process.exit(1);
  }
  total = res.structuredContent.data.total;
}
times.sort((a, b) => a - b);
const median = times[Math.floor(RUNS / 2)];
if (total === 0) {
  console.error("perf: bus_route_between found no direct line in the generated data");
  process.exit(1);
}
if (median > LIMIT_MS) {
  console.error(`perf: bus_route_between median ${median.toFixed(1)} ms over ${LIMIT_MS} ms (${ROWS} rows)`);
  process.exit(1);
}
console.log(`perf: bus_route_between median ${median.toFixed(1)} ms, max ${times[RUNS - 1].toFixed(1)} ms over ${RUNS} runs (${ROWS} rows, ${total} direct lines within 1 km of both ends; limit ${LIMIT_MS} ms)`);
