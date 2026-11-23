# 0006. `SPEC.md` describes the current version only; releases are checked

Status: Accepted (v0.21.1 brief, owner approval 2026-11-23)

## Context

By v0.21.0 `SPEC.md` had grown to 310 lines: the v0.18.0 design plus one section per release up to v0.21.0. The same
history is in `CHANGELOG.md` and in git, so the SPEC no longer said what the current version is meant to do, and owner
decisions recorded only there were hard to find. The version was also written twice (`package.json` and
`src/server.ts`), and nothing checked that each release got its tag.

## Decision

- `SPEC.md` holds only the version being built: goal, changes, out of scope, check and the `Approved:` line. At each
  version it is rewritten; the old text stays in git (`git show v<version>:SPEC.md`).
- What changed per version goes in `CHANGELOG.md`; a decision that must outlive its version goes in an ADR here.
- The version is written once, in `package.json`; the server reads it at start.
- `scripts/check-release.mjs` (run by `scripts/verify`) fails when `package.json` is not the newest CHANGELOG release,
  and, in a clone with tags, when the previous release has no `v` tag or `main` is at an untagged version.

Where it is written: `SPEC.md` (v0.21.1), `scripts/check-release.mjs`, CHANGELOG 0.21.1.

## Consequences

- Reading why an older version did something means `git show v<version>:SPEC.md` or the ADRs.
- CI checks out two commits and no tags, so there only the version rule runs; the tag rules run on a local clone.
  Right after a merge, a local `scripts/verify` on `main` fails until `v<version>` is tagged and pushed.
