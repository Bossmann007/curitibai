import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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

  it("calling every tool sends only GET requests (plus the portal search form POST) and creates no files", async () => {
    const before = snapshot(ROOT);
    const calls = stubFetch(happyRoutes());
    const client = await connectClient();
    for (const call of SAMPLE_CALLS) {
      const res = await client.callTool(call);
      expect(res.isError).toBeFalsy();
    }
    for (const c of calls) {
      expect(c.method === "GET" || (c.method === "POST" && c.url === PORTAL_SEARCH_URL)).toBe(true);
    }
    expect(snapshot(ROOT)).toEqual(before);
  });
});
