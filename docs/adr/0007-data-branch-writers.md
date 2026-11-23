# 0007. Two writers of the `data` branch: one concurrency group, one retry, never forced

Status: Accepted (v0.21.1 brief, owner approval 2026-11-23)

## Context

Two scheduled workflows push to the orphan `data` branch: `collect.yml` (nightly events and phones,
[0002](0002-nightly-collection-to-data-branch.md)) and `receita-version.yml` (monthly `receita/version.json`, since
v0.21.1). Their files never overlap, but a push made while the other workflow moved the branch is rejected as not a
fast-forward. Before v0.21.1 they used different concurrency groups, and only the Receita script retried.

## Decision

- Both workflows use the concurrency group `data-branch` with `cancel-in-progress: false`, so they never run at the
  same time.
- Both publish scripts (`scripts/publish-data.sh`, `scripts/publish-receita-version.sh`) redo a rejected push once:
  fetch the new tip, reset to it, copy their own files again, commit, push. A second rejection fails the run (exit 1).
- No force-push, ever; each script adds only its own files.

Where it is written: `.github/workflows/collect.yml`, `.github/workflows/receita-version.yml`, both publish scripts,
`test/workflows.test.ts`, `SPEC.md` (v0.21.1).

## Consequences

- GitHub keeps at most one pending run per concurrency group: a run queued behind a running one is replaced by a newer
  one. A late nightly entry could replace a queued monthly check (or the other way round); the next schedule entry or
  a manual run covers it.
- The retry covers manual runs and any overlap left; with the shared group it should rarely run.
