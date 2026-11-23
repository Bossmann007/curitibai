import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NIGHTLY_RUN_UTC } from "../src/sources/publishedData.js";

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
    expect(workflows.map((w) => w.name).sort()).toEqual(["collect.yml", "receita-version.yml", "verify.yml"]);
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
    const crons = lines.filter((l) => /^\s*- cron:/.test(l));
    expect(crons).toEqual([
      '    - cron: "37 2 * * *"',
      '    - cron: "17 3 * * *"',
      '    - cron: "59 3 * * *"',
      '    - cron: "37 4 * * *"',
      '    - cron: "13 5 * * *"',
    ]);
    const starts = crons.map((l) => {
      const [mm, hh] = l.split('"')[1]!.split(" ").map(Number);
      return hh! * 60 + mm!;
    });
    for (const [i, t] of starts.entries()) {
      expect(t % 2, "odd minute").toBe(1);
      expect(t).toBeGreaterThanOrEqual(2 * 60); // robots Visit-time starts 02:00 UTC
      expect(t + 30).toBeLessThanOrEqual(5 * 60 + 50); // start plus the 30-minute deadline ends inside the collector's window
      if (i > 0) expect(t - starts[i - 1]!, "gap above the 35-minute job timeout").toBeGreaterThan(35);
    }
    // The tools' "scheduled around 02:37 UTC" and the docs come from the same constant: the first entry.
    const [hh, mm] = NIGHTLY_RUN_UTC.split(":").map(Number);
    expect(crons[0]).toBe(`    - cron: "${mm} ${hh} * * *"`);
    expect(readFileSync(new URL("../docs/local-data.md", import.meta.url), "utf8")).toContain(`at ${NIGHTLY_RUN_UTC} UTC`);
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
    expect(verify).toContain("if: github.event.action != 'edited' || github.event.pull_request.state == 'open'");
    expect(verify).toMatch(/- if: \$\{\{ !cancelled\(\) && steps\.checkout\.outcome == 'success' && github\.event_name == 'pull_request' \}\}\n {8}run: scripts\/pr-size\.mjs HEAD\^1 HEAD\n {8}env:\n {10}PR_BODY: \$\{\{ github\.event\.pull_request\.body \}\}\n/);
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
    // Later schedule entries skip once today's collection succeeded.
    expect(code(publish).filter((l) => l.includes("CURITIBAI_COLLECT_ONCE_A_DAY=1 node scripts/fetch-events.mjs"))).toHaveLength(1);
  });

  it("receita-version: monthly plus manual runs, short timeout, write permissions on the job only, no npm install", () => {
    const wf = readFileSync(new URL("receita-version.yml", DIR), "utf8");
    const lines = code(wf).map((l) => l.trimEnd());
    expect(lines.filter((l) => /^\s*- cron:/.test(l))).toEqual(['    - cron: "23 9 1 * *"']);
    expect(lines).toContain("  workflow_dispatch:");
    expect(wf).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(wf).toMatch(/^ {4}permissions:\n {6}contents: write\n {6}issues: write\n/m);
    expect(lines.filter((l) => /: write$/.test(l))).toHaveLength(2);
    expect(lines).toContain("    timeout-minutes: 5");
    expect(wf).toMatch(/^concurrency:\n {2}group: receita-version\n {2}cancel-in-progress: false\n/m);
    expect(wf).toContain("if: github.repository == 'Bossmann007/curitibai' && github.ref == 'refs/heads/main'");
    expect(wf).toContain("persist-credentials: false");
    expect(lines.join("\n")).not.toMatch(/npm (ci|install)/);
    expect(lines).toContain("      - run: scripts/publish-receita-version.sh");
  });

  it("publish-receita-version.sh: pushes only receita/version.json to the data branch, never main, never forced", () => {
    const sh = readFileSync(new URL("../scripts/publish-receita-version.sh", import.meta.url), "utf8");
    expect(sh).toContain("BRANCH=data");
    expect(sh).toContain("FILE=receita/version.json");
    const pushes = code(sh).filter((l) => /\bpubgit push\b/.test(l) && !/^\s*#/.test(l));
    expect(pushes).toEqual(['  if pubgit push -q origin "HEAD:refs/heads/$BRANCH"; then']);
    expect(code(sh).filter((l) => !/^\s*#/.test(l)).join("\n")).not.toMatch(/--force|\+HEAD|refs\/heads\/main|add -A|add \.|events\/|phones\//);
    expect(code(sh).filter((l) => /git -C "\$pub" add /.test(l))).toEqual(['    git -C "$pub" add -- "$FILE"']);
  });
});
