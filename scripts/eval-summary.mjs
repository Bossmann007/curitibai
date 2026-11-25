#!/usr/bin/env node
// One-line summary of the citizen eval (test/eval/citizen-questions.json, run by vitest in scripts/verify): questions a
// tool answers out of the total, and the gaps (tool null) by label. Reads only that file; counted, never a failure.
import { readFileSync } from "node:fs";

const bank = JSON.parse(readFileSync(new URL("../test/eval/citizen-questions.json", import.meta.url), "utf8"));
const answered = bank.filter((q) => q.tool !== null).length;
const gaps = {};
for (const q of bank) {
  if (q.tool !== null) continue;
  if (typeof q.gap !== "string") {
    console.error(`eval-summary: ${q.id} has tool null and no gap label`);
    process.exit(1);
  }
  gaps[q.gap] = (gaps[q.gap] ?? 0) + 1;
}
const list = Object.entries(gaps)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([label, n]) => `${label} ${n}`)
  .join(", ");
console.log(`citizen eval: answered ${answered} / ${bank.length}; gaps ${bank.length - answered}: ${list}`);
