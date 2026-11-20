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
const guard = (dir = repo, opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) =>
  spawnSync(SCRIPT, [dir], { cwd: opts.cwd, env: { ...gitEnv(), ...opts.env }, encoding: "utf8" });

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

  it("fails when the fixture has the right content but mode 100755", () => {
    add(FIXTURE, FIXTURE_TEXT);
    git("update-index", "--chmod=+x", "--", FIXTURE);
    expect(git("ls-files", "-s", FIXTURE)).toMatch(/^100755 /);
    expectFail(FIXTURE);
  });

  it("fails when the fixture is modified in the work tree only", () => {
    add(FIXTURE, FIXTURE_TEXT);
    writeFileSync(join(repo, FIXTURE), "{}\n"); // staged copy stays the pinned fixture
    const res = guard();
    expect(res.status).toBe(1);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("fixture modified in the work tree");
    expect(res.stderr).not.toContain("git tracks a city services catalog file");
  });

  it("passes when the tracked fixture is missing from the work tree", () => {
    add(FIXTURE, FIXTURE_TEXT);
    rmSync(join(repo, FIXTURE));
    const res = guard();
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("check-no-catalog: OK");
  });

  it("fails when the work-tree fixture path is a directory", () => {
    mkdirSync(join(repo, FIXTURE), { recursive: true });
    const res = guard();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("fixture modified in the work tree");
  });

  it("fails when the work-tree fixture path is a broken symlink", () => {
    add(FIXTURE, FIXTURE_TEXT);
    rmSync(join(repo, FIXTURE));
    symlinkSync(join(root, "missing.json"), join(repo, FIXTURE)); // not staged: the index still holds the fixture
    const res = guard();
    expect(res.status).toBe(1);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("fixture modified in the work tree");
    expect(res.stderr).not.toContain("git tracks a city services catalog file");
  });

  it("passes when the argument is a symlink to the top of the checkout", () => {
    const link = join(root, "link-to-repo");
    symlinkSync(repo, link);
    const res = guard(link);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("check-no-catalog: OK");
  });

  it("fails with exit 2 when the argument is a symlink to a folder below the top", () => {
    mkdirSync(join(repo, "sub"));
    const link = join(root, "link-to-sub");
    symlinkSync(join(repo, "sub"), link);
    const res = guard(link);
    expect(res.status).toBe(2);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("check-no-catalog: FAIL: not the top of a git checkout");
  });

  it("fails with exit 2 when it cannot create a temp file", () => {
    const res = guard(repo, { env: { TMPDIR: join(root, "missing-tmp") } });
    expect(res.status).toBe(2);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("check-no-catalog: FAIL: cannot create a temp file");
  });

  it("checks the given relative folder, not a same-named one under CDPATH", () => {
    add("carta-servicos.json", "{}\n", true);
    const decoy = join(root, "decoy", "repo"); // a clean checkout the guard would pass
    mkdirSync(decoy, { recursive: true });
    execFileSync("git", ["init", "-q"], { cwd: decoy, env: gitEnv() });
    const res = guard("repo", { cwd: root, env: { CDPATH: join(root, "decoy") } });
    expect(res.status).toBe(1);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("  carta-servicos.json\n");
  });

  it("treats a relative folder named like an option as a folder", () => {
    repo = join(root, "-P"); // `cd -P` without `--` would go to $HOME instead
    mkdirSync(repo);
    git("init", "-q");
    add("carta-servicos.json", "{}\n", true);
    const res = guard("-P", { cwd: root });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("  carta-servicos.json\n");
  });

  it("fails, never OK, outside a git checkout", () => {
    const plain = join(root, "plain");
    mkdirSync(plain);
    const res = guard(plain);
    expect(res.status).toBe(2);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("check-no-catalog: FAIL: not a git checkout");
  });

  it("fails with exit 2 in a folder below the top of a checkout", () => {
    add("carta-servicos.json", "{}\n", true);
    mkdirSync(join(repo, "sub"));
    const res = guard(join(repo, "sub"));
    expect(res.status).toBe(2);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("check-no-catalog: FAIL: not the top of a git checkout");
  });

  it("fails with exit 2 when the argument is not a directory", () => {
    const res = guard(join(repo, "README.md"));
    expect(res.status).toBe(2);
    expect(res.stdout).not.toContain("OK");
    expect(res.stderr).toContain("check-no-catalog: FAIL: not a directory");
  });

  it("is a step of scripts/verify", () => {
    expect(readFileSync(VERIFY, "utf8")).toMatch(/^scripts\/check-no-catalog$/m);
  });
});
