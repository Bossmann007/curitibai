#!/usr/bin/env node
// Checks that every relative Markdown link in the project docs points to a file that exists and, when it has a
// #fragment, to a heading or an explicit <a id="..."> in that file. External links (http, https, mailto) are not
// checked. Node built-ins only. Exit 0 = every link resolves; exit 1 lists each broken link as file:line.
// Usage: node scripts/check-links.mjs [file.md ...] (default: README.md, CONTRIBUTING.md, SECURITY.md,
// CHANGELOG.md and docs/*.md, from the repository root).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function defaultFiles() {
  const files = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md"].map((f) => join(root, f));
  for (const f of readdirSync(join(root, "docs")).sort()) {
    if (f.endsWith(".md")) files.push(join(root, "docs", f));
  }
  return files.filter((f) => existsSync(f));
}

// Lines outside fenced code blocks, with inline code spans blanked, keeping line numbers.
function proseLines(text) {
  let fence = null;
  return text.split("\n").map((line) => {
    const m = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
      return "";
    }
    if (m) {
      fence = m[1];
      return "";
    }
    return line.replace(/(`+)(?:(?!\1).)+?\1/g, (s) => " ".repeat(s.length));
  });
}

// GitHub's heading id: inline markup removed, lower case, punctuation dropped (letters, digits, "_" and "-" kept,
// accented letters included), each space becomes "-"; a repeated id gets "-1", "-2", ...
function slug(heading) {
  const text = heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*]/g, "")
    .trim()
    .toLowerCase();
  return text.replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, "").replace(/ /g, "-");
}

const anchorCache = new Map();
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const text = readFileSync(file, "utf8");
  const anchors = new Set();
  const seen = new Map();
  let fence = null;
  for (const line of text.split("\n")) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    if (f) {
      fence = f[1];
      continue;
    }
    const h = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      const base = slug(h[1]);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      anchors.add(n === 0 ? base : `${base}-${n}`);
    }
    for (const a of line.matchAll(/<a\s+[^>]*\b(?:id|name)="([^"]+)"/g)) anchors.add(a[1]);
  }
  anchorCache.set(file, anchors);
  return anchors;
}

const files = process.argv.length > 2 ? process.argv.slice(2).map((f) => resolve(f)) : defaultFiles();
const broken = [];
let checked = 0;
for (const file of files) {
  const lines = proseLines(readFileSync(file, "utf8"));
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const target = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, https:, mailto: ...
      checked += 1;
      const hash = target.indexOf("#");
      const pathPart = hash === -1 ? target : target.slice(0, hash);
      const fragment = hash === -1 ? null : decodeURIComponent(target.slice(hash + 1));
      const dest = pathPart === "" ? file : resolve(dirname(file), decodeURIComponent(pathPart));
      const where = `${relative(root, file)}:${i + 1}`;
      if (!existsSync(dest)) {
        broken.push(`${where}: ${target} (no such file)`);
        continue;
      }
      if (fragment === null) continue;
      if (statSync(dest).isDirectory() || !dest.endsWith(".md")) {
        broken.push(`${where}: ${target} (anchor on a file that is not Markdown)`);
        continue;
      }
      if (!anchorsOf(dest).has(fragment)) broken.push(`${where}: ${target} (no such anchor)`);
    }
  });
}

if (broken.length > 0) {
  console.error(`check-links: ${broken.length} broken link(s) of ${checked} relative link(s):`);
  for (const b of broken) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`check-links: OK (${checked} relative links in ${files.length} files)`);
