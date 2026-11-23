import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkRelease, releasedVersions } from "../scripts/check-release.mjs";

const CL = "# Changelog\n\n## Unreleased\n\n- x\n\n## 0.21.1 - 2026-11-23\n\n- y\n\n## 0.21.0 - 2026-11-23\n\n- z\n";
const tags = ["v0.20.0", "v0.21.0"];

describe("scripts/check-release.mjs", () => {
  it("reads released versions newest first, skipping Unreleased", () => {
    expect(releasedVersions(CL)).toEqual(["0.21.1", "0.21.0"]);
    expect(releasedVersions("## 0.22.0-rc.1 - 2026-12-01\n\n## 0.21.1 - 2026-11-23\n")).toEqual(["0.21.1"]);
  });

  it("fails when package.json is not the newest CHANGELOG release", () => {
    const r = checkRelease({ version: "0.21.2", changelog: CL, tags, branch: "fix" });
    expect(r.errors).toEqual([expect.stringContaining("package.json is 0.21.2 but the newest CHANGELOG.md release is 0.21.1")]);
  });

  it("on a branch: the previous release needs its tag, the current one not yet", () => {
    expect(checkRelease({ version: "0.21.1", changelog: CL, tags, branch: "fix" })).toEqual({
      errors: [],
      notes: ["v0.21.1 not tagged yet (branch fix): tag it on main after the merge"],
    });
    const r = checkRelease({ version: "0.21.1", changelog: CL, tags: ["v0.20.0"], branch: "fix" });
    expect(r.errors).toEqual([expect.stringContaining("release 0.21.0 has no tag v0.21.0")]);
  });

  it("on main: the current release needs its tag", () => {
    const r = checkRelease({ version: "0.21.1", changelog: CL, tags, branch: "main" });
    expect(r.errors).toEqual(["main is at 0.21.1 with no tag v0.21.1: git tag v0.21.1 && git push origin v0.21.1"]);
    expect(checkRelease({ version: "0.21.1", changelog: CL, tags: [...tags, "v0.21.1"], branch: "main" }).errors).toEqual([]);
  });

  it("a clone with no v* tags (CI) skips the tag checks but still checks the version", () => {
    expect(checkRelease({ version: "0.21.1", changelog: CL, tags: [], branch: "" })).toEqual({
      errors: [],
      notes: ["no v* tags in this clone: tag checks skipped"],
    });
    expect(checkRelease({ version: "0.9.0", changelog: CL, tags: [], branch: "" }).errors).toHaveLength(1);
  });

  it("outside a git clone (tarball or zip) the CLI skips the tag checks, still checks the version and exits 0", () => {
    // Outside this repository, so no parent .git can be found.
    const dir = mkdtempSync(join(tmpdir(), "curitibai-release-"));
    try {
      mkdirSync(join(dir, "scripts"));
      copyFileSync(new URL("../scripts/check-release.mjs", import.meta.url), join(dir, "scripts", "check-release.mjs"));
      writeFileSync(join(dir, "CHANGELOG.md"), CL);
      writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.21.1" }));
      const out = execFileSync(process.execPath, [join(dir, "scripts", "check-release.mjs")], { encoding: "utf8" });
      expect(out).toContain("check-release: not a git clone (no .git, or git not installed): tag checks skipped");
      expect(out).toContain("check-release: OK (0.21.1)");
      writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.9.0" }));
      expect(() => execFileSync(process.execPath, [join(dir, "scripts", "check-release.mjs")], { stdio: "pipe" })).toThrow(
        expect.objectContaining({ status: 1 }),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
