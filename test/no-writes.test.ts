import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { PORTAL_SEARCH_URL } from "../src/sources/portal.js";
import { connectClient, happyRoutes, SAMPLE_CALLS, stubFetch } from "./helpers.js";

const SRC = new URL("../src/", import.meta.url).pathname;
const ROOT = new URL("../", import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

function snapshot(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => !f.startsWith("node_modules") && !f.startsWith(".git") && !f.startsWith("dist"))
    .sort();
}

describe("no tool writes", () => {
  it("source code has no file-write, process-spawn or raw-socket API", () => {
    const forbidden = [
      /\bwriteFile(Sync)?\b/, /\bappendFile(Sync)?\b/, /\bcreateWriteStream\b/, /\bmkdir(Sync)?\b/, /\brm(Sync)?\(/,
      /\bunlink(Sync)?\b/, /\brename(Sync)?\b/, /\bcopyFile(Sync)?\b/, /\bopen(Sync)?\(/, /\btruncate(Sync)?\b/,
      /\bwriteSync\b/, /\bwritev(Sync)?\b/, /\bfsync(Sync)?\b/, /\brmdir(Sync)?\b/, /\bsymlink(Sync)?\b/, /\blink(Sync)?\(/,
      /\bchmod(Sync)?\b/, /\bchown(Sync)?\b/, /\butimes(Sync)?\b/, /\bcp(Sync)?\(/, /\bmkdtemp(Sync)?\b/,
      /\brequire\(/, /\bimport\(/,
      /["']node:fs\/promises["']/, /["'](node:)?child_process["']/, /["'](node:)?(net|dgram|http|https|http2)["']/,
      /\blocalStorage\b/, /\bconsole\.log\b/,
    ];
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const re of forbidden) expect({ file: f, hit: re.test(text) }).toEqual({ file: f, hit: false });
    }
  });

  it("imports node:fs only in the allowed modules, and only read APIs there", () => {
    // Every mention of the fs module (any spelling) must be one of these named imports.
    const allowed: Record<string, string[]> = {
      "localfs.ts": ["createReadStream", "realpathSync", "statSync"],
      "server.ts": ["realpathSync"],
    };
    const anyFs = /["'](node:)?fs(\/[\w]+)?["']/g;
    const namedImport = /^import\s*\{([^}]*)\}\s*from\s*"node:fs";$/gm;
    for (const f of sourceFiles(SRC)) {
      const rel = f.slice(SRC.length);
      const text = readFileSync(f, "utf8");
      const mentions = text.match(anyFs) ?? [];
      const imports = [...text.matchAll(namedImport)];
      const names = imports.flatMap((m) => m[1]!.split(",").map((n) => n.trim()).filter(Boolean));
      if (!(rel in allowed)) {
        expect({ file: rel, fs: mentions }).toEqual({ file: rel, fs: [] });
        continue;
      }
      expect({ file: rel, mentions: mentions.length }).toEqual({ file: rel, mentions: imports.length });
      expect(imports.length).toBe(1);
      for (const n of names) expect({ file: rel, name: n, ok: allowed[rel]!.includes(n) }).toMatchObject({ ok: true });
    }
  });

  it("calling every tool sends only GET requests (plus the portal search form POST) and creates no files", async () => {
    const before = snapshot(ROOT);
    const calls = stubFetch(happyRoutes());
    const client = await connectClient();
    for (const call of SAMPLE_CALLS) {
      const res = await client.callTool(call);
      expect(res.isError).toBeFalsy();
    }
    vi.stubEnv(DATA_DIR_ENV, new URL("./fixtures/csv/", import.meta.url).pathname);
    const local = await client.callTool({ name: "local_csv_summary", arguments: { file: "synthetic_sample.csv", group_by: "ASSUNTO" } });
    expect(local.isError).toBeFalsy();
    for (const c of calls) {
      expect(c.method === "GET" || (c.method === "POST" && c.url === PORTAL_SEARCH_URL)).toBe(true);
    }
    expect(snapshot(ROOT)).toEqual(before);
  });
});
