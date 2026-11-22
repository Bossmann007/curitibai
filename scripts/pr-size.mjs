#!/usr/bin/env node
// PR-size guard (CONTRIBUTING.md, "Tamanho do pull request"): fails when a pull request changes more than LIMIT lines
// (added + deleted, against the base) unless its body has a line starting with "Large PR because:" and a reason.
// Usage: scripts/pr-size.mjs <base> [head]   (default head: HEAD); the PR body comes from the PR_BODY variable.
// Exit: 0 within the limit or explained, 1 over the limit with no explanation, 2 git failed.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const LIMIT = 400;
export const EXPLANATION = "Large PR because:";

/** Paths that do not count: tests and fixtures, lockfiles (any folder). */
export function isExcluded(path) {
  return path.startsWith("test/") || path === "package-lock.json" || path.endsWith("/package-lock.json") || path.endsWith(".lock");
}

/**
 * Parses `git diff --numstat -z -M`: "added\tdeleted\tpath\0", or "added\tdeleted\t\0old\0new\0" for a rename
 * (`from` is the old path). Binary files ("-\t-") count 0 lines.
 */
export function parseNumstat(text) {
  const parts = text.split("\0");
  const rows = [];
  for (let i = 0; i < parts.length; i++) {
    const m = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(parts[i]);
    if (!m) continue;
    const lines = (m[1] === "-" ? 0 : Number(m[1])) + (m[2] === "-" ? 0 : Number(m[2]));
    if (m[3] === "") {
      rows.push({ path: parts[i + 2] ?? "", lines, from: parts[i + 1] ?? "" });
      i += 2;
    } else {
      rows.push({ path: m[3], lines });
    }
  }
  return rows;
}

/**
 * True when a visible line of the body starts with EXPLANATION followed by some reason. HTML comments and fenced code
 * blocks are skipped: GitHub does not show them as text (a template placeholder must not pass).
 */
export function hasExplanation(body) {
  let fenced = false;
  for (const l of (body ?? "").replace(/<!--[\s\S]*?(-->|$)/g, "").split(/\r?\n/)) {
    if (/^ {0,3}(```|~~~)/.test(l)) fenced = !fenced;
    else if (!fenced && l.startsWith(EXPLANATION) && l.slice(EXPLANATION.length).trim() !== "") return true;
  }
  return false;
}

/**
 * Lines a row counts: 0 when excluded; a rename counts only its edited lines (git -M), except a file moved out of an
 * excluded path (for example from test/ to src/), which counts in full.
 */
function countedLines(row, fullLines) {
  if (isExcluded(row.path)) return 0;
  if (row.from !== undefined && isExcluded(row.from)) return fullLines(row.path);
  return row.lines;
}

/**
 * The verdict for a parsed numstat and a PR body. `fullLines(path)` gives the line count of a file at head, for a file
 * moved out of an excluded path.
 */
export function checkPrSize(rows, body, limit = LIMIT, fullLines = () => 0) {
  const counted = rows.filter((r) => !isExcluded(r.path)).map((r) => ({ path: r.path, lines: countedLines(r, fullLines) }));
  const total = counted.reduce((sum, r) => sum + r.lines, 0);
  const explained = hasExplanation(body);
  return { total, counted, ok: total <= limit || explained, explained };
}

function main(argv) {
  const [base, head = "HEAD"] = argv;
  if (!base) {
    console.error("usage: scripts/pr-size.mjs <base> [head]");
    return 2;
  }
  // A revision starting with "-" would be read by git as an option.
  if ([base, head].some((rev) => rev.startsWith("-"))) {
    console.error(`pr-size: FAIL: a revision must not start with "-": ${base} ${head}`);
    return 2;
  }
  let out;
  try {
    out = execFileSync("git", ["diff", "--numstat", "-z", "-M", base, head], { encoding: "utf8" });
  } catch {
    console.error(`pr-size: FAIL: git diff ${base} ${head} failed`);
    return 2;
  }
  const fullLines = (path) => {
    const text = execFileSync("git", ["show", `${head}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  };
  let r;
  try {
    r = checkPrSize(parseNumstat(out), process.env.PR_BODY, LIMIT, fullLines);
  } catch {
    console.error(`pr-size: FAIL: git show of a moved file at ${head} failed`);
    return 2;
  }
  for (const row of r.counted) console.log(`${String(row.lines).padStart(6)}  ${row.path}`);
  console.log(`pr-size: ${r.total} changed lines counted (limit ${LIMIT}; test/ and lockfiles not counted)`);
  if (r.total <= LIMIT) return 0;
  if (r.explained) {
    console.log(`pr-size: OK, over the limit and explained by a "${EXPLANATION}" line in the PR body`);
    return 0;
  }
  console.error(`pr-size: FAIL: over ${LIMIT} lines. Split the PR, or add a line starting with "${EXPLANATION}" and the reason to the PR body.`);
  return 1;
}

// Run as a script (also through a symlink), not when the tests import it.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
