# SPEC: v0.86.0 Person-name filter, eighth pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the 0.84.0 Change Reviewer's Lows and the Security Reviewer's
R1-R3, in the work-type person-name filter of `city_facilities_search` (`src/sources/nameFilter.ts`). No new citizen
question; the eval count is unchanged.

## Source

None new. One read of the 12 person-hiding layers on `geocuritiba.ippuc.org.br` (already contacted) by a one-off
script, to replay the filter on the real records; the reads were deleted. Tests use synthetic lines.

## Changes

1. **Leak** (`SENHA_REST`): after "agendamento com senha numerada" or "… senha de atendimento", the rest of the line
   must be made only of rest and hours steps (numbers, punctuation, channel, unit and hours words, connectors, line
   breaks; at most 100 steps). "senha numerada, Fulana", ". Fulana", "(Fulana)" and "3350-0000 Fulana" are hidden;
   "senha numerada, das 8h às 17h" stays.
2. **Over-hiding**: the whole-field check (lines joined with spaces) takes any word after these words, and
   `readsNextLine` (was `isGuardedContact`) makes hourLines' split check read the line after a line ending in them,
   even when it starts with a number. A schedule line after "Agendamento com senha numerada" stays; a name line is
   hidden. The nameFilter.ts comment "as on 0.83.0" is replaced.
3. **DAY_DETAIL**: "corrido" alone is dropped ("corridos" stays); "agendamento com um dia corrido" is hidden.
4. **CHANGELOG**: says "com uma hora" / "com um dia" alone are hidden since 0.84.0.
5. **Tests** (`test/cityFacilities.test.ts`, v0.86.0 block): each hidden and kept case, every line the 0.82.0 and
   0.84.0 tests list as legitimate, the 0.84.0 known-limit test flipped, and timing of "senha numerada, " repeated
   and 50 KB / 400 KB lines.
6. **Docs and version**: docs/sources.md, docs/tools.md, docs/roadmap-1.0.md, CHANGELOG 0.86.0, version 0.86.0 in
   `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Any new source, host, link or question. Reading names after other appointment details ("com um dia de antecedência
Fulana" still passes, as before). Changing how the whole-field check joins lines.

## Check

- `npx vitest run test/cityFacilities.test.ts -t v0.86.0`: the new behaviour tests fail on 0.85.0 and pass on 0.86.0.
- Replay of the real records: hidden-line markers and `hours` identical between 0.85.0 and 0.86.0.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
