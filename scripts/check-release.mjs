#!/usr/bin/env node
// Release check (SPEC.md "Release check"): the version is written once, in package.json, and each release gets a tag.
//   1. package.json's version is the newest released heading of CHANGELOG.md ("## X.Y.Z - date").
//   2. When this clone has tags: the release before it has its tag vX.Y.Z (a forgotten tag shows up on the next
//      release at the latest), and on the local branch `main` the current version has its tag too.
// A clone with no v* tags (CI checks out 2 commits and no tags) skips 2 and says so. No network.
// Exit 0 = fine or skipped, 1 = a rule failed (each one printed), 2 = git failed.
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Released versions in CHANGELOG order (newest first), from headings "## X.Y.Z" (an "## Unreleased" is skipped). */
export function releasedVersions(changelog) {
  return [...changelog.matchAll(/^## (\d+\.\d+\.\d+)(?=\s|$)/gm)].map((m) => m[1]);
}

/**
 * @param {{ version: string, changelog: string, tags: string[], branch: string }} input
 * @returns {{ errors: string[], notes: string[] }}
 */
export function checkRelease({ version, changelog, tags, branch }) {
  const errors = [];
  const notes = [];
  const [newest, previous] = releasedVersions(changelog);
  if (newest !== version) {
    errors.push(`package.json is ${version} but the newest CHANGELOG.md release is ${newest ?? "(none)"}: add "## ${version} - <date>" or fix the version`);
  }
  const vtags = new Set(tags.filter((t) => /^v\d+\.\d+\.\d+$/.test(t)));
  if (vtags.size === 0) {
    notes.push("no v* tags in this clone: tag checks skipped");
    return { errors, notes };
  }
  if (previous !== undefined && !vtags.has(`v${previous}`)) {
    errors.push(`release ${previous} has no tag v${previous}: git fetch --tags, or tag its merge commit on main and push the tag`);
  }
  if (branch === "main" && !vtags.has(`v${version}`)) {
    errors.push(`main is at ${version} with no tag v${version}: git tag v${version} && git push origin v${version}`);
  } else if (!vtags.has(`v${version}`)) {
    notes.push(`v${version} not tagged yet (branch ${branch || "(detached)"}): tag it on main after the merge`);
  }
  return { errors, notes };
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch (err) {
    console.error(`check-release: git ${args.join(" ")} failed: ${err.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const tags = git(["tag", "--list", "v*"], root).split("\n").filter(Boolean);
  const branch = git(["branch", "--show-current"], root);
  const { errors, notes } = checkRelease({ version, changelog, tags, branch });
  for (const n of notes) console.log(`check-release: ${n}`);
  for (const e of errors) console.error(`check-release: ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log(`check-release: OK (${version})`);
}
