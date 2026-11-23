# SPEC: v0.21.2 lows from the #26 review and credit to the Instituto Municipal de Turismo

Approved: Enzo 2026-11-23 (task brief "curitibai v0.21.2 — Lows da revisão do #26 + crédito do Turismo"). Scope
frozen: small PR, no new dependency, no tool renamed, no tool schema changed.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` (v0.21.1 is at tag v0.21.1) and the ADRs in `docs/adr/`.

## Goal

Close the low findings of the #26 review and credit the Instituto Municipal de Turismo in the files published on the
`data` branch.

## Changes

1. **Day-2 retry of the Receita check.** `.github/workflows/receita-version.yml` gets a second cron, `23 9 2 * *`,
   for a day-1 run dropped while queued in the shared `data-branch` group. The check is idempotent: with nothing
   changed since day 1 it makes no commit and opens no issue. `test/workflows.test.ts` lists both entries.
2. **`local_csv_summary` small counts with a filter.**
   - `group_by.other_count` of 1 to 4 is `"<5"` (`BELOW_MIN`); 0 stays 0; without a filter it stays a number.
   - A filter that matches 5 or more rows but leaves 1 to 4 rows out is refused (`column_not_allowed`, existing
     code): `row_count - matched_rows` would give their exact count (and the unfiltered minus filtered groups their
     values), and `"<5"` on `matched_rows` would be false. A filter that matches every row is answered.
   - Known limit, kept because the output schema is frozen: `matched_rows` and `top[].count` stay numbers, so when
     every group of 5 or more is listed, `matched_rows - sum(top)` gives the masked `other_count` back. A test shows
     it. Two allowed filters on the same column can also be subtracted from `row_count` (one query is checked at a
     time). Closing these needs a schema or behaviour decision (next phase). Malformed rows never match, so they
     are not counted as left out.
3. **`scripts/check-release.mjs` outside a clone.** No `.git` at the repository root (tarball or zip) or no `git`
   installed: prints "not a git clone (no .git, or git not installed): tag checks skipped", still checks the version
   against the CHANGELOG, exits 0 when it matches. Other git failures in a clone still exit 2. Test runs the script
   from a copy in the system temp folder.
4. **Docs.** CHANGELOG 0.21.1 gains the line "Breaking (output): `matched_rows`/`distinct_values`/`other_count` can be
   `"<5"`"; CHANGELOG 0.21.2 lists this PR. CONTRIBUTING: after merging a version, tag the merge commit `vX.Y.Z` and
   push it before `scripts/verify` on `main` passes in a clone with tags (ADR 0006).
5. **Turismo credit.** `scripts/fetch-events.mjs` writes `"credit": "Fonte: Instituto Municipal de Turismo de
   Curitiba"` at the top of `events/events.json` and `phones/phones.json`, next to `source` (the page the facts were
   read from); events keep their own `link`. Per file, not per row: rows are checked for exact keys by installed
   servers and by the collector. Facts only, as before. `docs/sources.md` records the owner's premise (Lei 9.610/98
   art. 8º, V and VI; no terms found; the Instituto not contacted by the owner's decision).

## Out of scope

- Creating the `v0.21.2` tag (the owner tags `main` after the merge).
- Pushing to the `data` branch by hand: the credit arrives with the next successful nightly collection.
- Closing the `matched_rows - sum(top)` and two-filter derivations, and masking an unfiltered `other_count`
  (pre-existing; needs a schema or behaviour decision).
- Any change to tool names, tool schemas, sources or dependencies.

## Check

- `scripts/verify` exits 0 (new tests: `test/localCsv.test.ts` other_count and complement cases,
  `test/checkRelease.test.ts` CLI outside a clone, `test/fetchEvents.test.ts` credit in both files,
  `test/publishedData.test.ts` files with and without the credit, `test/workflows.test.ts` both crons).
- `node scripts/check-release.mjs` on this branch: OK with the note that `v0.21.2` is not tagged yet.
- The GitHub `verify` check is green on the PR.
