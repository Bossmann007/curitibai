# SPEC: v0.21.1 fixes from the general review ("Agora" block)

Approved: Enzo 2026-11-23 (task brief "curitibai v0.21.1 — correções do bloco "Agora" da revisão geral"). Scope
frozen: small changes, no new dependency, no tool renamed, no input schema changed.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` (the v0.18.0 to v0.21.0 sections are at tag v0.21.0) and the
ADRs in `docs/adr/`.

## Goal

Close the review's "Agora" findings: the two workflows that push to the `data` branch cannot lose a push to each
other, the version is written in one place and releases are checked, the shared cache is bounded, a small filter
result in `local_csv_summary` no longer gives an exact count, and this SPEC is back to one version.

## Changes

1. **`data` branch writers** ([ADR 0007](docs/adr/0007-data-branch-writers.md)).
   `.github/workflows/collect.yml` and `.github/workflows/receita-version.yml` use the same concurrency group,
   `data-branch`, `cancel-in-progress: false`. `scripts/publish-data.sh` redoes a rejected push once, as
   `scripts/publish-receita-version.sh` does: fetch the new tip, reset to it, copy the four files again from the
   collector's folder, commit, push; a second rejection exits 1. Never a force-push. Known consequence: GitHub keeps at
   most one pending run per group, so a queued run can be replaced by a newer one of the other workflow.
2. **Version in one place.** `src/server.ts` reads `version` from `package.json` (`../package.json` from both `src/`
   and `dist/`); version 0.21.1. `test/tools.test.ts` asserts the server reports the `package.json` version and that
   `src/server.ts` has no version literal; `scripts/smoke.mjs` asserts the same on the built server.
3. **Release check** (`scripts/check-release.mjs`, a step of `scripts/verify`, no network):
   - fails when `package.json`'s version is not the newest released heading (`## X.Y.Z`) of `CHANGELOG.md`;
   - in a clone that has `v*` tags: fails when the release before it has no tag, and, on the local branch `main`, when
     the current version has no tag;
   - in a clone with no `v*` tags it skips the tag rules and says so.
   Why not the literal "fail on `main` without the tag" in CI: `verify.yml` checks out two commits and no tags, and on
   a push to `main` the tag can only be made after the merge commit exists, so that run would always be red; versions
   0.3.0 to 0.11.0 were never tagged, so only the release before the current one is checked. The tag rules therefore
   run on a local clone; a forgotten tag fails `scripts/verify` on `main` right after the merge, and on any branch at
   the next release at the latest.
4. **Shared cache bound.** `src/cache.ts` `sharedCache` (portal, OpenStreetMap and CNES answers) keeps at most 500
   entries (`SHARED_CACHE_MAX_ENTRIES`; the oldest stored is dropped first, as `TtlCache` already does for the
   Receita caches). `test/cache.test.ts` fills it with 501 keys through `sharedCache` itself and sees the first reload.
5. **`local_csv_summary` small filters.** With a filter that matches fewer than `MIN_GROUP_COUNT` (5) rows, 0
   included, `filter.matched_rows`, `group_by.other_count` and `group_by.distinct_values` are the string `"<5"`
   (`BELOW_MIN`) instead of a number: with no group listed, `other_count` equals the matched rows and
   `distinct_values` bounds them, so masking only `matched_rows` would still leak the count. Output schema: those
   three fields become `number | "<5"` (input schema and tool name unchanged). `row_count` (the whole file) is not a
   filter result and stays a number. Tests in `test/localCsv.test.ts`.
6. **This SPEC** now holds v0.21.1 only. Decisions whose reason was written only in the old sections became ADRs:
   [0005](docs/adr/0005-extend-a-tool-before-adding-one.md) (a `type`/`topic` value before a new tool, v0.20.0 and
   v0.21.0), [0006](docs/adr/0006-spec-holds-the-current-version.md) (this rule and the release check),
   [0007](docs/adr/0007-data-branch-writers.md) (item 1); ADR 0002 gains the v0.19.4 owner decision "uma recusa do site
   encerra a coleta da noite". The other owner decisions of v0.18.1 to v0.21.0 were already in `docs/sources.md`
   (PNCP search, 35-minute timeout via ADR 0002, Cultura e-mails and `mixedOwnership`, simulated Receita dates) or
   `docs/tools.md` (partial answers). References to old SPEC line numbers in ADRs 0001 and 0002 and in
   `docs/sources.md` now point to `git show v0.21.0:SPEC.md`.
7. **`docs/development.md`:** a corrupt `receita/version.json` on `data` keeps the monthly check red
   (`previous_unreadable`) until fixed or deleted by hand.

Also: CHANGELOG 0.21.1 (the "Unreleased" monthly Receita check ships in it; the `docs/sources.md` heading and its links
say "since 0.21.1").

## Out of scope

- Creating the `v0.21.1` tag (the owner tags `main` after the merge).
- Fetching tags in CI (`verify.yml` stays at two commits, no tags).
- Tagging the untagged old versions 0.3.0 to 0.11.0.
- Any other finding of the general review; any change to tool names, input schemas, sources or dependencies.

## Check

- `scripts/verify` exits 0 (new: release step; `test/cache.test.ts`, `test/checkRelease.test.ts`, the
  `local_csv_summary` `"<5"` test, the server-version test, the shared concurrency group in `test/workflows.test.ts`;
  smoke compares the built server's version with `package.json`).
- `scripts/publish-data.sh` against a local bare repository (git `insteadOf`), with a stub collector that writes
  `events/status.json` and pushes another commit to `data` after the script fetched it: the first push is rejected,
  the retry pushes on the new tip, the other commit stays, exit 0.
- `node scripts/check-release.mjs` on this branch: OK with the note that `v0.21.1` is not tagged yet.
- The GitHub `verify` check is green on the PR.
