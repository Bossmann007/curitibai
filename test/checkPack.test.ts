import { describe, expect, it } from "vitest";
import { checkPack, MAX_PACKED_BYTES } from "../scripts/check-pack.mjs";

const base = ["package.json", "README.md", "LICENSE", "CHANGELOG.md", "docs/licences.md", "dist/server.js", "dist/tools/busLines.js"];
const pack = (paths: string[], size = 1000) => ({ files: paths.map((path) => ({ path })), size });

describe("scripts/check-pack.mjs", () => {
  it("passes the expected file list", () => {
    expect(checkPack(pack(base))).toEqual([]);
  });

  it.each([
    "data-local/urbs/2026_11_20_linhas.json",
    "test/fixtures/osm_library_recorded.json",
    "dist/fixtures/x.js",
    "dist/server.test.js",
    ".env",
    ".env.production",
    "config.local.json",
    "src/server.ts",
  ])("refuses %s", (bad) => {
    expect(checkPack(pack([...base, bad]))).toEqual([expect.stringContaining(`forbidden path in the package: ${bad}`)]);
  });

  it("refuses a path that is not on the allowlist", () => {
    expect(checkPack(pack([...base, "scripts/verify"]))).toEqual([expect.stringContaining("not on the allowlist")]);
  });

  it("fails when a required file is missing or the package is too big", () => {
    expect(checkPack(pack(base.filter((p) => p !== "docs/licences.md")))).toEqual(["missing from the package: docs/licences.md"]);
    expect(checkPack(pack(base, MAX_PACKED_BYTES + 1))).toEqual([expect.stringContaining("is over")]);
  });
});
