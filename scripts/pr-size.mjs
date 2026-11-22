#!/usr/bin/env node
// PR-size guard (CONTRIBUTING.md, "Tamanho do pull request"): fails when a pull request changes more than LIMIT lines
// (added + deleted, against the base) unless its body has a line starting with "Large PR because:" and a reason.
// Usage: scripts/pr-size.mjs <base> [head]   (default head: HEAD); the PR body comes from the PR_BODY variable.
// Exit: 0 within the limit or explained, 1 over the limit with no explanation, 2 git failed.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const LIMIT = 400;
export const EXPLANATION = "Large PR because:";

/** Paths that do not count: tests and fixtures, lockfiles. Renames count only their edited lines (git -M). */
export function isExcluded(path) {
  return path.startsWith("test/") || path === "package-lock.json" || path.endsWith(".lock");
}

/**
 * Parses `git diff --numstat -z -M`: "added\tdeleted\tpath\0", or "added\tdeleted\t\0old\0new\0" for a rename.
 * Binary files ("-\t-") count 0 lines.
 */
export function parseNumstat(text) {
  const parts = text.split("\0");
  const rows = [];
  for (let i = 0; i < parts.length; i++) {
    const m = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(parts[i]);
    if (!m) continue;
    let path = m[3];
    if (path === "") {
      path = parts[i + 2] ?? "";
      i += 2;
    }
    const lines = (m[1] === "-" ? 0 : Number(m[1])) + (m[2] === "-" ? 0 : Number(m[2]));
    rows.push({ path, lines });
  }
  return rows;
}

/** True when a line of the body starts with EXPLANATION followed by some reason. */
export function hasExplanation(body) {
  return (body ?? "").split(/\r?\n/).some((l) => l.startsWith(EXPLANATION) && l.slice(EXPLANATION.length).trim() !== "");
}

/** The verdict for a parsed numstat and a PR body. */
export function checkPrSize(rows, body, limit = LIMIT) {
  const counted = rows.filter((r) => !isExcluded(r.path));
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
  let out;
  try {
    out = execFileSync("git", ["diff", "--numstat", "-z", "-M", base, head], { encoding: "utf8" });
  } catch {
    console.error(`pr-size: FAIL: git diff ${base} ${head} failed`);
    return 2;
  }
  const r = checkPrSize(parseNumstat(out), process.env.PR_BODY);
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

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
