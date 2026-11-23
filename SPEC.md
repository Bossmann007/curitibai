# SPEC: v0.21.3 `local_csv_summary` refuses a filter with `group_by`

Approved: Enzo 2026-11-23 (task brief "curitibai v0.21.3 — local_csv_summary: fechar o ataque por diferença",
decision "endurecer"). Scope frozen: small PR, no new dependency, no tool renamed.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Close the difference attack on `local_csv_summary` found in the v0.21.2 review: with a filter and `group_by` in one
call, filtered and unfiltered counts could be subtracted to give a group of 1 to 4 rows.

## Changes

1. **Refuse the combination.** `filter_column`/`filter_value` with `group_by` returns the new error
   `filter_with_group_by_not_allowed` (added to `ErrorResult`), before the file is opened. A half-given filter is
   still `invalid_csv`, checked first.
2. **Outputs left.** Filter alone: `filter.matched_rows` (`"<5"` below 5, 0 included); `group_by` is null; a filter
   that leaves 1 to 4 rows out is still refused. `group_by` alone: groups of 5 or more listed; `other_count` of 1 to 4
   is `"<5"` (0 stays 0), documented as not a protection (`row_count - malformed_rows - sum(top)` gives it back);
   `distinct_values` is always a number (schema narrowed from number or `"<5"`).
3. **Docs.** ADR 0008 (the floor of 5 from 2026-11-21 and this decision, with what is not protected),
   `docs/tools.md`, `docs/local-data.md` (example call and rules), tool description and `LOCAL_NOTE`, CHANGELOG
   0.21.3 marked "Breaking (input)" and "Breaking (output)".

## Out of scope

- The two-filter derivation (two allowed filters on the same column subtracted from `row_count`): known limit, ADR 0008.
- Creating the `v0.21.3` tag (the owner tags `main` after the merge).

## Check

- `scripts/verify` exits 0. New or changed tests in `test/localCsv.test.ts`: the refused combination (before reading,
  before the column-name check), filter alone, `group_by` alone, and a sweep of every filter and `group_by` on a file
  with groups of 1 to 6 rows where no `matched_rows`, `top[].count` or `other_count` is 1 to 4.
