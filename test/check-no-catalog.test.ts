import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Runs the real scripts/check-no-catalog (the guard scripts/verify calls) against a throwaway git repo.
const SCRIPT = fileURLToPath(new URL("../scripts/check-no-catalog", import.meta.url));
const VERIFY = fileURLToPath(new URL("../scripts/verify", import.meta.url));
const FIXTURE = "test/fixtures/carta_servicos_synthetic/carta-servicos.json";
const FIXTURE_TEXT = readFileSync(fileURLToPath(new URL(`../${FIXTURE}`, import.meta.url)));

let root: string;
let repo: string;

/** Hermetic git env: no inherited GIT_* (a hook's GIT_DIR would point at the real repo), no system/global config. */
function gitEnv(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const home = join(root, "home");
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CEILING_DIRECTORIES: root,
    HOME: home,
    XDG_CONFIG_HOME: home,
  };
}

const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, env: gitEnv(), encoding: "utf8" });
const guard = (dir = repo) => spawnSync(SCRIPT, [dir], { env: gitEnv(), encoding: "utf8" });

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-guard-")));
  repo = join(root, "repo");
  mkdirSync(join(root, "home"));
  mkdirSync(repo);
  git("init", "-q");
  writeFileSync(join(repo, ".gitignore"), `carta-servicos.json\n!${FIXTURE}\n`);
  writeFileSync(join(repo, "README.md"), "synthetic\n");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function add(path: string, content: string | Buffer = "{}\n", force = false) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content); // synthetic content only
  git("add", ...(force ? ["-f"] : []), "--", path);
}

function expectFail(path: string) {
  const res = guard();
  expect(res.status).toBe(1);
  expect(res.stdout).not.toContain("OK");
  expect(res.stderr).toContain("git tracks a city services catalog file");
  expect(res.stderr).toContain(`  ${path}\n`);
  expect(res.stderr).toContain("git rm --cached");
}

describe("scripts/check-no-catalog", () => {
  it("passes on a clean tree and with only the synthetic fixture tracked", () => {
    add("README.md");
    expect(guard().status).toBe(0);
    add(FIXTURE, FIXTURE_TEXT);
    const res = guard();
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("check-no-catalog: OK");
  });

  it(".gitignore keeps a catalog out of a plain git add, in any folder", () => {
    mkdirSync(join(repo, "data"));
    writeFileSync(join(repo, "data/carta-servicos.json"), "{}\n");
    const res = spawnSync("git", ["add", "--", "data/carta-servicos.json"], { cwd: repo, env: gitEnv(), encoding: "utf8" });
    expect(res.status).not.toBe(0);
    expect(git("ls-files")).not.toContain("carta-servicos.json");
  });

  it.each(["carta-servicos.json", "data/carta-servicos.json", "a b/Carta-Servicos.JSON"])(
    "fails with a clear message when %s is force-added",
    (path) => {
      add(path, "{}\n", true);
      expectFail(path);
    },
  );

  it.each(["a/carta-servicos.json", "sp ace/carta-servicos.json", "new\nline/carta-servicos.json"])(
    "fails for %j (folder boundary; spaces and newlines in tracked names)",
    (path) => {
      add(path, "{}\n", true);
      expectFail(path);
    },
  );

  it.each(["xcarta-servicos.json", "a/xcarta-servicos.json", "carta-servicos.json.txt", "carta-servicos.jsonx"])(
    "passes for %j (only the exact file name counts)",
    (path) => {
      add(path, "{}\n", true);
      const res = guard();
      expect(res.status).toBe(0);
      expect(res.stdout).toContain("check-no-catalog: OK");
    },
  );

  it("exempts only the exact fixture path, not one that ends with it", () => {
    const path = `x/${FIXTURE}`;
    add(path, FIXTURE_TEXT, true);
    expectFail(path);
  });

  it("fails when the file at the fixture path is not the synthetic fixture", () => {
    const items = Array.from({ length: 3000 }, (_, i) => ({
      cat: "Categoria fictícia",
      title: `Serviço fictício ${i}`,
      what: "Texto inventado.",
      url: `https://example.invalid/servicos/${i}`,
      online: null,
    }));
    add(FIXTURE, JSON.stringify({ captured: "2026-01-01", count: items.length, items }));
    expectFail(FIXTURE);
  });

  it("fails when the fixture path is a symlink", () => {
    writeFileSync(join(root, "elsewhere.json"), FIXTURE_TEXT);
    mkdirSync(dirname(join(repo, FIXTURE)), { recursive: true });
    symlinkSync(join(root, "elsewhere.json"), join(repo, FIXTURE));
    git("add", "--", FIXTURE);
    expect(git("ls-files", "-s", FIXTURE)).toMatch(/^120000 /);
    expectFail(FIXTURE);
  });

  it("fails, never OK, outside a git checkout", () => {
    const plain = join(root, "plain");
    mkdirSync(plain);
    const res = guard(plain);
    expect(res.status).not.toBe(0);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("check-no-catalog: FAIL: not a git checkout");
  });

  it("is a step of scripts/verify", () => {
    expect(readFileSync(VERIFY, "utf8")).toMatch(/^scripts\/check-no-catalog$/m);
  });
});
