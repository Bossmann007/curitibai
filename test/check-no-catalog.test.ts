import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Runs the real scripts/check-no-catalog (the guard scripts/verify calls) against a throwaway git repo.
const SCRIPT = new URL("../scripts/check-no-catalog", import.meta.url).pathname;
const FIXTURE = "test/fixtures/carta_servicos_synthetic/carta-servicos.json";

let repo: string;
beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-guard-")));
  execFileSync("git", ["init", "-q"], { cwd: repo });
  writeFileSync(join(repo, ".gitignore"), `carta-servicos.json\n!${FIXTURE}\n`);
  writeFileSync(join(repo, "README.md"), "synthetic\n");
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

function add(path: string, force = false) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), "{}\n"); // synthetic content only
  execFileSync("git", ["add", ...(force ? ["-f"] : []), "--", path], { cwd: repo });
}

const guard = () => spawnSync(SCRIPT, [repo], { encoding: "utf8" });

describe("scripts/check-no-catalog", () => {
  it("passes on a clean tree and with only the synthetic fixture tracked", () => {
    add("README.md");
    expect(guard().status).toBe(0);
    add(FIXTURE);
    const res = guard();
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("check-no-catalog: OK");
  });

  it(".gitignore keeps a catalog out of a plain git add, in any folder", () => {
    mkdirSync(join(repo, "data"));
    writeFileSync(join(repo, "data/carta-servicos.json"), "{}\n");
    const res = spawnSync("git", ["add", "--", "data/carta-servicos.json"], { cwd: repo, encoding: "utf8" });
    expect(res.status).not.toBe(0);
    expect(execFileSync("git", ["ls-files"], { cwd: repo, encoding: "utf8" })).not.toContain("carta-servicos.json");
  });

  it.each(["carta-servicos.json", "data/carta-servicos.json", "a b/Carta-Servicos.JSON"])(
    "fails with a clear message when %s is force-added",
    (path) => {
      add(path, true);
      const res = guard();
      expect(res.status).toBe(1);
      expect(res.stderr).toContain("git tracks a city services catalog file");
      expect(res.stderr).toContain(`  ${path}\n`);
      expect(res.stderr).toContain("git rm --cached");
    },
  );
});
