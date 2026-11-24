# SPEC: v0.26.1 release path hardening

Approved: Enzo 2026-11-24 (task brief "curitibai v0.26.1, small hardening of the release path merged in v0.26.0 (PR
#36)": the Security Reviewer's low notes on head ef50166). Scope frozen: `publish.yml` publishes the checked tarball,
release checklist in `docs/development.md`, version 0.26.1. **Nothing is published by this version**: no workflow
run, no GitHub or npm setting changed, no tag pushed.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

The package that reaches npm is byte for byte the one whose sha256 was checked, and the release checklist states the
GitHub settings and the approval rule that the human gate depends on, with its accepted risk.

## Changes

1. **`.github/workflows/publish.yml`**, publish job: the preflight packs once (`npm pack --ignore-scripts`), compares
   the sha256 with the verify job's, keeps the file and passes its name on (`steps.preflight.outputs.tarball`). The
   npm step hashes that file again (steps ran in between) and runs `npm publish "./$TARBALL" --ignore-scripts`; it no
   longer deletes the file and packs the tree again. npm 11.20.0 calls its OIDC exchange for any publish spec,
   directory or tarball (`lib/commands/publish.js`, `await oidc(...)` after `pack`); the runner's npm is checked to be
   11.5.1 or newer, its exact version is not pinned. `test/workflows.test.ts`: one `npm pack` in the publish job, no
   `rm -f "$file"`, the tarball output, two sha256 checks, the second before `npm publish`.
2. **`docs/development.md` "Release"**: environment `release` with "Allow administrators to bypass configured
   protection rules" OFF and "Prevent self-review" OFF (Enzo starts the run and is the only reviewer); the `v*` tag
   ruleset is required; "Approving a run": only on `main` or a `v*` tag Enzo pushed, at the release commit shown on the
   approval screen, and the sha256 proves only that the artifact did not change between the two jobs; accepted risk:
   any token of Enzo's with the `repo` scope can approve through the REST API, so the gate holds only if no agent holds
   one (recommended: a separate reviewer account with a passkey, or fine-grained agent tokens without the deployments
   and environments permissions); `npm logout` right after the first manual publish; not verified whether the MCP
   Registry accepts a GitHub OIDC token whose `sub` is `environment:release`, which the login step shows before
   `npm publish`.
3. **Version** 0.26.1 in `package.json`, `package-lock.json` and `server.json`; CHANGELOG 0.26.1.

## Out of scope

Publishing; running the workflow; changing GitHub or npm settings; tags; pinning the runner's npm version; tool
behaviour.

## Check

- `scripts/verify` exits 0.
- `test/workflows.test.ts` fails on the 0.26.0 `publish.yml` (shown by running it against `git show v0.26.0:...`) and
  passes on this one.
- `publish.yml` parses as YAML; `actionlint` was not run (not installed on the dev machine).
