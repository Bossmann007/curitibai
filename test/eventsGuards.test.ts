import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALLOWED_HOSTS as SERVER_HOSTS } from "../src/config.js";
import { ALLOWED_HOSTS, HOST } from "../scripts/fetch-events.mjs";

const SRC = new URL("../src/", import.meta.url).pathname;
const SCRIPT = readFileSync(new URL("../scripts/fetch-events.mjs", import.meta.url), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("events collector boundaries", () => {
  it("the server never contacts the events host: it is not in src/config.ts ALLOWED_HOSTS", () => {
    expect(ALLOWED_HOSTS).toEqual(["turismo.curitiba.pr.gov.br"]);
    expect(SERVER_HOSTS as readonly string[]).not.toContain(HOST);
  });

  it("src/ does not import scripts/", () => {
    for (const f of sourceFiles(SRC)) {
      const text = readFileSync(f, "utf8");
      expect({ file: f, hit: /from\s+["'][^"']*scripts\//.test(text) || /import\(\s*["'][^"']*scripts\//.test(text) }).toMatchObject({ hit: false });
    }
  });

  it("the collector imports only node:fs, node:path and the two import-free src modules", () => {
    const imports = [...SCRIPT.matchAll(/^import\s[^;]*?from\s+"([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["../src/mask.ts", "../src/text.ts", "node:fs", "node:path"]);
    for (const mod of ["mask.ts", "text.ts"]) {
      expect(readFileSync(join(SRC, mod), "utf8")).not.toMatch(/^\s*import\s/m);
    }
    expect(SCRIPT).not.toMatch(/\brequire\(|\bimport\(/);
  });

  it("the collector spawns no process and opens no socket", () => {
    expect(SCRIPT).not.toMatch(/child_process|\bspawn(Sync)?\(|\bexecFile(Sync)?\(|\bexecSync\(|(?<!\.)\bexec\(|\bfork\(|process\.binding|\bdlopen\b/);
    expect(SCRIPT).not.toMatch(/["'](node:)?(net|dgram|http|https|http2|tls|worker_threads|cluster)["']/);
  });

  it("the collector writes only through writeAtomic, mkdir of the events or phones folder and its lock file", () => {
    const fsImport = /^import \{([^}]*)\} from "node:fs";$/m.exec(SCRIPT);
    expect(fsImport?.[1]!.split(",").map((s) => s.trim()).sort()).toEqual([
      "lstatSync",
      "mkdirSync",
      "readFileSync",
      "realpathSync",
      "renameSync",
      "unlinkSync",
      "writeFileSync",
    ]);
    const count = (re: RegExp) => (SCRIPT.match(re) ?? []).length;
    // writeAtomic's temp file and the lock, both created exclusively (wx: never through an existing file or link).
    expect(count(/\bwriteFileSync\(/g)).toBe(2);
    expect(count(/\bwriteFileSync\([^)]*flag: "wx" \}\)/g)).toBe(2);
    expect(count(/\bmkdirSync\(/g)).toBe(1);
    // Besides writeAtomic's rename, rename and unlink touch only the lock: inside acquireLock, on `path`
    // (join(dir, LOCK_FILE)) or `aside` (a stale lock moved next to it).
    const lockFn = SCRIPT.slice(SCRIPT.indexOf("export function acquireLock("), SCRIPT.indexOf("// ---------- run ----------"));
    expect(lockFn).toContain("const path = join(dir, LOCK_FILE);");
    expect(lockFn).toContain("const aside = join(dir, `${LOCK_FILE}.stale-");
    expect(count(/\brenameSync\(/g)).toBe(3);
    expect(lockFn.match(/\brenameSync\([^)]*\)/g)).toEqual(["renameSync(path, aside)", "renameSync(aside, path)"]);
    expect(count(/\bunlinkSync\(/g)).toBe(2);
    expect(lockFn.match(/\bunlinkSync\([^)]*\)/g)).toEqual(["unlinkSync(path)", "unlinkSync(aside)"]);
    expect(SCRIPT).toContain('if (name !== "events" && name !== "phones") throw new StopError("write_failed");');
    expect(SCRIPT).toContain("const dir = join(base, name);");
    expect(SCRIPT).toMatch(/writeAtomic\(dir, "phones\.json",/);
    expect(SCRIPT).toMatch(/writeAtomic\(dir, "events\.json",/);
    expect(SCRIPT).toMatch(/writeAtomic\(dir, "status\.json",/);
    expect(SCRIPT).toMatch(/writeAtomic\(dir, CACHE_FILE,/);
    expect(count(/\bwriteAtomic\(/g)).toBe(6); // the definition, three events calls and two phones calls
    expect(SCRIPT).not.toMatch(/\b(appendFile|createWriteStream|unlink\(|rmSync|rm\(|copyFile|symlink|chmod|truncate|openSync)\b/);
  });

  it("the collector prints only through the log function", () => {
    expect(SCRIPT).not.toMatch(/console\.(log|error|warn|info|debug)/);
    expect(SCRIPT.match(/process\.stdout\.write/g)).toHaveLength(1);
    expect(SCRIPT).not.toMatch(/process\.stderr/);
  });
});
