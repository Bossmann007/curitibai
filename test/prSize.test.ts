import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkPrSize, hasExplanation, isExcluded, parseNumstat } from "../scripts/pr-size.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/pr-size.mjs", import.meta.url));
const rows = (n: number) => [{ path: "src/a.ts", lines: n }];

describe("scripts/pr-size.mjs", () => {
  it("parses plain, binary and renamed rows from git diff --numstat -z -M", () => {
    const text = "3\t1\tsrc/a.ts\0-\t-\tdocs/logo.png\0" + "2\t0\t\0docs/old.md\0docs/adr/new.md\0" + "0\t0\t\0README.md\0docs/readme.md\0";
    expect(parseNumstat(text)).toEqual([
      { path: "src/a.ts", lines: 4 },
      { path: "docs/logo.png", lines: 0 },
      { path: "docs/adr/new.md", lines: 2 },
      { path: "docs/readme.md", lines: 0 },
    ]);
  });

  it("excludes only test/ (fixtures included) and lockfiles", () => {
    expect(isExcluded("test/fixtures/x.json")).toBe(true);
    expect(isExcluded("test/prSize.test.ts")).toBe(true);
    expect(isExcluded("package-lock.json")).toBe(true);
    expect(isExcluded("sub/yarn.lock")).toBe(true);
    expect(isExcluded("src/test/x.ts")).toBe(false);
    expect(isExcluded("docs/adr/0001.md")).toBe(false);
    expect(isExcluded("package.json")).toBe(false);
  });

  it("passes at 400 counted lines and fails at 401 without an explanation", () => {
    expect(checkPrSize(rows(400), "").ok).toBe(true);
    expect(checkPrSize(rows(401), "").ok).toBe(false);
    expect(checkPrSize([...rows(400), { path: "test/fixtures/big.json", lines: 5000 }], "").total).toBe(400);
  });

  it("accepts an explanation line with a reason, CRLF bodies included", () => {
    expect(checkPrSize(rows(900), "Summary\r\nLarge PR because: generated fixtures\r\n").ok).toBe(true);
    expect(hasExplanation("Large PR because:   ")).toBe(false);
    expect(hasExplanation(" Large PR because: indented")).toBe(false);
    expect(hasExplanation("Why? Large PR because: mid-line")).toBe(false);
    expect(hasExplanation(undefined)).toBe(false);
  });

  it("CLI: counts a real git diff and reads the body from PR_BODY", () => {
    const repo = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-prsize-")));
    try {
      const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_"))), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
      const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { cwd: repo, env });
      git("init", "-q");
      writeFileSync(join(repo, "a.txt"), "x\n");
      git("add", "a.txt");
      git("commit", "-qm", "base");
      writeFileSync(join(repo, "a.txt"), "y\n".repeat(401));
      git("commit", "-qam", "big");
      const run = (body: string) => spawnSync(process.execPath, [SCRIPT, "HEAD~1"], { cwd: repo, env: { ...env, PR_BODY: body }, encoding: "utf8" });
      const fail = run("");
      expect(fail.status).toBe(1);
      expect(fail.stdout).toContain("402 changed lines counted");
      expect(fail.stderr).toContain("Large PR because:");
      expect(run("Large PR because: test").status).toBe(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
