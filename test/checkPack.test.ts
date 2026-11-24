import { describe, expect, it } from "vitest";
import { checkPack, MAX_PACKED_BYTES, scanSecrets } from "../scripts/check-pack.mjs";

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

  it("refuses a dist/ file that no src/ module builds", () => {
    const built = ["dist/server.js", "dist/tools/busLines.js"];
    expect(checkPack(pack(base), built)).toEqual([]);
    expect(checkPack(pack([...base, "dist/tools/oldName.js"]), built)).toEqual([expect.stringContaining("no src/ module")]);
  });

  it("fails when a required file is missing or the package is too big", () => {
    expect(checkPack(pack(base.filter((p) => p !== "docs/licences.md")))).toEqual(["missing from the package: docs/licences.md"]);
    expect(checkPack(pack(base, MAX_PACKED_BYTES + 1))).toEqual([expect.stringContaining("is over")]);
  });

  // Planted values are built at run time so no secret-shaped literal sits in the repository.
  const x = (n: number) => "a1B2".repeat(n);
  it.each([
    ["private key", `-----BEGIN RSA ${"PRIVATE"} KEY-----`],
    ["GitHub token", `const t = "gh${"p"}_${x(9)}";`],
    ["npm token", `npm${"_"}${x(9)}`],
    ["AWS access key", `AKI${"A"}ABCDEFGHIJKLMNOP`],
    ["URL with credentials", `fetch("https://user:${"p4ss"}word@example.com/x")`],
    [".env-style secret", `NPM_TOKEN=${x(4)}`],
    ["JWT", `eyJ${x(4)}.eyJ${x(4)}.${x(4)}`],
  ])("finds a %s and does not print it", (label, line) => {
    const errors = scanSecrets("dist/x.js", `ok\n${line}\n`);
    expect(errors).toEqual([`possible ${label} in dist/x.js:2`]);
  });

  it("passes ordinary code, regex sources and env names without values", () => {
    const code = [
      'const re = /gh[pousr]_[A-Za-z0-9]{36}/;',
      'process.env.CURITIBAI_DATA_DIR ?? "";',
      'const API_KEY = process.env.API_KEY;',
      'const url = "https://dadosabertos.curitiba.pr.gov.br/";',
    ].join("\n");
    expect(scanSecrets("dist/x.js", code)).toEqual([]);
  });
});
