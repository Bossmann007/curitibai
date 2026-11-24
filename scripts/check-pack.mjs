#!/usr/bin/env node
// Package check: what `npm publish` would upload. Runs `npm pack --dry-run --json` (no tarball written, no network) and
// fails unless every path is on the allowlist below, none is a forbidden kind (local data, tests, fixtures, .env*,
// *.local) and the packed size is under MAX_PACKED_BYTES. Run it after `npm run build`: dist/ is gitignored.
// Exit 0 = fine, 1 = a rule failed (each one printed), 2 = npm pack failed.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Packed (gzip) size ceiling. 0.26.0 packs to about 179 KB; a jump past this means something unplanned got in. */
export const MAX_PACKED_BYTES = 250_000;

/** The only paths the tarball may hold (package.json `files`, plus what npm always adds). */
const ALLOWED = [
  /^package\.json$/,
  /^README\.md$/,
  /^LICENSE$/,
  /^CHANGELOG\.md$/,
  /^docs\/licences\.md$/, // the data licences, including the ODbL notice for dist/sources/osmBundled.js
  /^dist\/[A-Za-z0-9_/.-]+\.js$/,
];

/** Never in the tarball, even if a future allowlist change would let it in. */
const FORBIDDEN = [
  /(^|\/)data-local(\/|$)/,
  /(^|\/)(test|tests|fixtures|__tests__)(\/|$)/,
  /\.test\.[cm]?[jt]s$/,
  /(^|\/)\.env/,
  /\.local(\.|$)/,
  /(^|\/)src\//,
];

/**
 * @param {{ files: { path: string }[], size: number }} pack  one entry of `npm pack --dry-run --json`
 * @returns {string[]} errors, empty when fine
 */
export function checkPack({ files, size }) {
  const errors = [];
  for (const { path } of files) {
    if (FORBIDDEN.some((re) => re.test(path))) errors.push(`forbidden path in the package: ${path}`);
    else if (!ALLOWED.some((re) => re.test(path))) errors.push(`path not on the allowlist (scripts/check-pack.mjs): ${path}`);
  }
  for (const must of ["package.json", "README.md", "LICENSE", "dist/server.js", "docs/licences.md"]) {
    if (!files.some((f) => f.path === must)) errors.push(`missing from the package: ${must}`);
  }
  if (!(size <= MAX_PACKED_BYTES)) errors.push(`packed size ${size} bytes is over ${MAX_PACKED_BYTES}`);
  return errors;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  let pack;
  try {
    // --ignore-scripts: no prepack/prepare hook may change the tree while we look at it.
    const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" });
    pack = JSON.parse(out)[0];
  } catch (err) {
    console.error(`check-pack: npm pack --dry-run failed: ${err.message}`);
    process.exit(2);
  }
  for (const f of pack.files) console.log(`  ${String(f.size).padStart(8)}  ${f.path}`);
  console.log(`check-pack: ${pack.filename}, ${pack.files.length} files, packed ${pack.size} bytes, unpacked ${pack.unpackedSize} bytes (ceiling ${MAX_PACKED_BYTES} packed)`);
  const errors = checkPack(pack);
  for (const e of errors) console.error(`check-pack: ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log("check-pack: OK");
}
