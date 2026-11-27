# SPEC: v0.81.0 Person-name filter, fifth pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the lows of the v0.80.0 review on the `city_facilities_search`
person-name filter. L2 (a real leak, older than 0.80): "Mantida\npela Fulana de Tal" in a contracted CEI shows the
name. L1: "Falar com o RH\nFulano de Tal" shows the name. No new citizen question; the eval count is unchanged.

## Source

None new. The 12 GeoCuritiba layers whose type hides person lines were read once (one GET each, the server's own
query and User-Agent) to count hidden lines before and after; the tests use synthetic lines.

## Cause

The brief named the literal spaces in the multi-word patterns. Every line is split on line breaks and cleaned
(whitespace runs become one space) before a pattern runs, so a space in a pattern never meets a line break there. The
only reader of two lines at once is the whole-field check in `hourLines` (lines joined with spaces), and it is skipped
once any line of the record is hidden. So "Mantida\npela Fulana de Tal" alone was hidden, and after another hidden
line ("Responsável: Fulana.") the name showed. The brief's "cmei" is read as `cei contratado`: the `cmei` type has no
line filter, and only `cei contratado` reads maintainer lines.

## Changes

1. **L2, `hourLines` (`src/sources/geocuritiba.ts`)**: for a type with `nameLines` (not the garden allowlist, not
   the shelter types), each line is also tested joined with the line before it by a line break, in the whole-field
   mode (`prev` null); when that pair hides and the line before does not hide alone, the line is hidden. The line
   before stays as it was.
2. **L2, patterns (`src/sources/nameFilter.ts`)**: the multi-word hide patterns use `\s+` where they had a space
   (`MAINTAINER`, `PERSON_IN_CHARGE`, `WORK_PERSON`, `GARDEN_PERSON`), so the joined pair matches. The keep-side
   patterns (service values, hours, garden kinds) are unchanged.
3. **L1, `isWorkPersonLine`**: when `prev` ends in a contact phrase whose guarded word ends the line
   (`GUARDED_END`), the line is hidden unless it has a digit, "[masked]" or ':', reads as a service value
   (`isServiceValue`) or starts with a unit, channel or connector word (`NOT_A_NAME_START`). Known limit: after
   "Fale com a gente pelo 156" a name alone on the next line still passes.
4. **Tests** (`test/cityFacilities.test.ts`, a v0.81.0 block): the split keyword after a hidden line, per type that
   uses each pattern; L1 hidden and kept lines for the four work types; the pair check does not drag a line after
   one that hides alone; the real service lines of 0.76/0.80 stay; 50 KB of short lines in under 2 s. The v0.80.0
   split-name case now keeps the hours line (updated on purpose).
5. **Docs and version**: docs/sources.md (a v0.81.0 paragraph), docs/tools.md (the `city_facilities_search` row),
   docs/roadmap-1.0.md, CHANGELOG 0.81.0, version 0.81.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

A filter for `cmei`; the shelter types' split phrases; "agendamento pela …"; names later in an hours line; any new
question, source, host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts`: the v0.81.0 block fails on 0.80.0 and passes on 0.81.0; every
  earlier block still passes.
- Replay of the 12 re-read layers: 131 hidden-line markers before and after, every record's `hours` identical.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
