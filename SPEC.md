# SPEC: v0.35.0 coverage scoreboard and the 1.0 gate

Approved: Enzo 2026-11-24 (task brief "curitibai v0.35.0", with his addition of the same day on usefulness and
Curitiba scope). **This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

The owner's 1.0 rule ("better than the Curitiba App, with every Prefeitura service and more", useful to the citizen,
about Curitiba) becomes a gate a script counts, so each later version can show how far 1.0 is. Two lows from the v0.34
review are fixed.

## Changes

1. **Scoreboard, dev only** (`scripts/coverage-report.mjs`, not in the package): reads (a) the Curitiba App table in
   `docs/tools.md` (rows by status; an unknown status exits 2) and (b) the user's local `carta-servicos.json` when it
   exists (`--carta`, else `CURITIBAI_DATA_DIR`). Each Carta service is data (narrow title rules, none when the title
   asks the citizen to act), guide (`city_service_guide`'s own Carta queries, kept equal by a test) or none. Prints
   counts and % per category, the 30 uncovered services with the highest usefulness score (3 everyday need, 2 other,
   1 business-only or internal) and a JSON summary with aggregates only.
2. **Gate** (`docs/roadmap-1.0.md`, permanent): every Curitiba App row covered (data, or guide + official link where a
   login is needed; partial is not covered), every Carta service reachable (data or guide), the extras kept,
   uncovered work ordered by usefulness, Curitiba scope only; the scoreboard command; no catalog content.
3. **`city_calendar`** (`src/tools/cityCalendar.ts`): the school note says the quality evaluation Saturday counts as a
   school day, inferred from the printed counts; `unit` or `date` with topic `holidays` or `iptu` returns
   `invalid_argument` instead of being ignored. No schema or description change (contract snapshot unchanged).
   `src/cache.ts` reads `Date.now()` at each call, so a test's fixed clock applies (a `bus_stops_near` test read the
   real date after midnight in Curitiba).
4. **Docs and version**: docs/tools.md (`city_calendar` row, link to the gate), README, CHANGELOG 0.35.0, version
   0.35.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

New tools or guides to close the gate; committing any catalog content or a real catalog's numbers; a CI step that
fails on the gate (an open gate is not an error).

## Check

- `test/coverageReport.test.ts` (synthetic items only): guide terms equal `GUIDES[id].carta`; data, guide and none
  classes, action words never data; usefulness score; table parsing against a sample and the real `docs/tools.md`;
  unknown status fails; no title in the JSON summary; CLI with and without a copy, exit 2 on a bad catalog.
- `test/cityCalendar.test.ts`: holidays and iptu with `unit` or `date` are `invalid_argument`; the school note.
- `scripts/check-no-catalog` passes; `scripts/verify` exits 0 on the PR head.
