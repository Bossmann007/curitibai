// Timing guard for next_buses_near (v0.13 budget: a call under about 150 ms median on the real-size exports, 17,496
// stop rows and 71,085 departures). Generates that many invented rows (and 400 invented lines) in a temporary
// CURITIBAI_DATA_DIR (no real URBS rows), then times the built tool's handler, the three file reads and validation
// included. `at` and `day` are fixed so the result never depends on the clock. Fails above LIMIT_MS, a wide margin
// over the budget so a slower CI runner does not fail it; the measured median is printed for comparison.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STOP_ROWS = 17_496;
const TIME_ROWS = 71_085;
const TIMED_STOPS = 737; // stop numbers with times in the real file
const RUNS = 15;
const LIMIT_MS = 600;

const dir = mkdtempSync(join(tmpdir(), "curitibai-perf-"));
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
mkdirSync(join(dir, "urbs"));
const coord = (n) => n.toFixed(12).replace(".", ",");
const stops = Array.from({ length: STOP_ROWS }, (_, i) => {
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
const pad = (n) => String(n).padStart(2, "0");
const times = Array.from({ length: TIME_ROWS }, (_, i) => {
  const num = 100_000 + (i % TIMED_STOPS) * 9; // every 9th stop number has times
  const m = (i * 37) % 1440;
  return {
    HORA: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
    PONTO: `PARADA FICTÍCIA ${num}`,
    DIA: String(1 + (i % 3)),
    NUM: String(num),
    TABELA: String(1 + (i % 40)),
    ADAPT: "ELEVADOR",
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
writeFileSync(join(dir, "urbs", "2026_11_20_tabelaLinha.json"), JSON.stringify(times));
writeFileSync(join(dir, "urbs", "2026_11_20_linhas.json"), JSON.stringify(lines));
process.env.CURITIBAI_DATA_DIR = dir;

const { nextBusesNear } = await import("../dist/tools/nextBusesNear.js");
const args = { near: { lat: -25.45, lon: -49.25 }, radius_m: 1000, at: "08:00", day: "1", window_min: 180, limit: 50 };
const timesMs = [];
let total = 0;
for (let i = 0; i < RUNS; i++) {
  const start = performance.now();
  const res = await nextBusesNear.handler(args);
  timesMs.push(performance.now() - start);
  if (res.isError) {
    console.error(`perf: next_buses_near failed: ${res.content?.[0]?.text}`);
    process.exit(1);
  }
  total = res.structuredContent.data.total;
}
timesMs.sort((a, b) => a - b);
const median = timesMs[Math.floor(RUNS / 2)];
if (total === 0) {
  console.error("perf: next_buses_near found no departures in the generated data");
  process.exit(1);
}
if (median > LIMIT_MS) {
  console.error(`perf: next_buses_near median ${median.toFixed(1)} ms over ${LIMIT_MS} ms`);
  process.exit(1);
}
console.log(
  `perf: next_buses_near median ${median.toFixed(1)} ms, max ${timesMs[RUNS - 1].toFixed(1)} ms over ${RUNS} runs ` +
    `(${STOP_ROWS} stop rows, ${TIME_ROWS} departures, ${total} in the window; limit ${LIMIT_MS} ms)`,
);
