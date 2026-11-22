import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = new URL("../.github/workflows/", import.meta.url);
const workflows = readdirSync(DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ name: f, text: readFileSync(new URL(f, DIR), "utf8") }));
const collect = readFileSync(new URL("collect.yml", DIR), "utf8");
const publish = readFileSync(new URL("../scripts/publish-data.sh", import.meta.url), "utf8");
/** Lines without their trailing comment. */
const code = (text: string) => text.split("\n").map((l) => l.replace(/\s#.*$/, ""));

describe("GitHub Actions workflows", () => {
  it("found the workflows", () => {
    expect(workflows.map((w) => w.name).sort()).toEqual(["collect.yml", "verify.yml"]);
  });

  it("use only the standard ubuntu-latest runner (free for public repositories), never a larger one", () => {
    for (const w of workflows) {
      const runsOn = code(w.text).filter((l) => /^\s*runs-on\s*:/.test(l));
      expect(runsOn.length, w.name).toBeGreaterThan(0);
      for (const l of runsOn) expect(l.trim(), w.name).toBe("runs-on: ubuntu-latest");
    }
  });

  it("pin every action by full commit SHA", () => {
    for (const w of workflows) {
      for (const l of code(w.text).filter((x) => /^\s*-?\s*uses\s*:/.test(x))) {
        expect(l.trim(), w.name).toMatch(/^-?\s*uses:\s*[\w.-]+\/[\w.\/-]+@[0-9a-f]{40}$/);
      }
    }
  });

  it("collect: nightly inside the robots Visit-time plus manual runs, 35 min (above the collector's 30-minute deadline), no overlap, write only on the job", () => {
    const lines = code(collect).map((l) => l.trimEnd());
    expect(lines).toContain('    - cron: "37 2 * * *"');
    expect(lines).toContain("  workflow_dispatch:");
    expect(collect).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(collect).toMatch(/^ {4}permissions:\n {6}contents: write\n/m);
    expect(lines.filter((l) => l.includes("contents: write"))).toHaveLength(1);
    expect(lines).toContain("    timeout-minutes: 35");
    expect(collect).toMatch(/^concurrency:\n {2}group: collect\n {2}cancel-in-progress: false\n/m);
    expect(collect).toContain("if: github.repository == 'Bossmann007/curitibai' && github.ref == 'refs/heads/main'");
    expect(collect).toContain("persist-credentials: false");
    expect(lines.join("\n")).not.toMatch(/npm (ci|install)/);
  });

  it("verify: the PR-size step runs only on pull_request, re-runs on body edits and gets the body from the environment", () => {
    const verify = readFileSync(new URL("verify.yml", DIR), "utf8");
    expect(verify).toContain("types: [opened, synchronize, reopened, edited]");
    expect(verify).toContain("fetch-depth: 2");
    expect(verify).toMatch(/- if: \$\{\{ !cancelled\(\) && github\.event_name == 'pull_request' \}\}\n {8}run: scripts\/pr-size\.mjs HEAD\^1 HEAD\n {8}env:\n {10}PR_BODY: \$\{\{ github\.event\.pull_request\.body \}\}\n/);
    expect(code(verify).filter((l) => l.includes("pull_request.body"))).toEqual(["          PR_BODY: ${{ github.event.pull_request.body }}"]);
  });

  it("publish-data.sh: pushes only the four public files to the data branch, never main, never forced", () => {
    expect(publish).toContain("BRANCH=data");
    expect(publish).toContain("FILES=(events/events.json events/status.json phones/phones.json phones/status.json)");
    expect(publish).toContain('push -q origin "HEAD:refs/heads/$BRANCH"');
    const pushes = code(publish).filter((l) => /\bpush\b/.test(l) && !/^\s*#/.test(l));
    expect(pushes).toEqual(['  pubgit push -q origin "HEAD:refs/heads/$BRANCH"']);
    expect(publish).not.toMatch(/--force|\+HEAD|refs\/heads\/main|add -A|add \./);
    expect(publish).toContain("env -u GH_TOKEN CURITIBAI_DATA_DIR=");
  });
});
