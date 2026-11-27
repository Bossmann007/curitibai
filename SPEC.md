# SPEC: v0.73.0 Service areas helper and PGV text codes

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), two lows from earlier reviews: (1) the v0.66.0 review, in
`serviceAreasAt` each group builds the whole `data` object by hand with a null for every other group's list; (2) the
v0.71.0 review, a PGV micro-bairro published as text keeps a trailing ".0" that the numeric form does not have.
Refactor with no behaviour change apart from that ".0".

## Source

No new source and no request: no host contacted. No new host, no new link.

## Changes

1. **Helper** (`src/tools/serviceAreasAtPoint.ts`): `areasData(p, areas, inside, lists, partial)` spreads `NO_LISTS`
   (every list null, in the schema's order) and then the group's own lists, so the keys of `data` keep their order.
   The four groups (care, safety, registry, civic) call it; `mergeAreas` in `placeAtPoint.ts` is unchanged.
2. **PGV text code** (`src/tools/placeAtPoint.ts`, `codeText`): text of digits followed by exactly ".0" drops the
   ".0" ("12.0" is "12", " 13.0 " is "13"); "99.1", "99.10" and "12.0a" are untouched. Numbers as in 0.71.0.
3. **Tests**: every group answers every list key in the schema's order, with only its own lists as arrays
   (`test/serviceAreasAtPoint.test.ts`); the ".0" cases and that "12.0" and 12 are one row
   (`test/placeAtPoint.test.ts`); the existing "99.0" and "28.0" expectations become "99" and "28".
4. **Docs and version**: docs/tools.md (the PGV parenthetical), docs/roadmap-1.0.md, CHANGELOG 0.73.0, version 0.73.0
   in `package.json`, `package-lock.json`, `server.json`. Tool contract snapshot unchanged (no description changes);
   docs/sources.md unchanged.

## Out of scope

Folding the repeated bairro fallback or the `source`/`checked_at` envelope of the groups; the `microbairro`
description's published example "27.0" (a description change would change the contract snapshot); any new question,
source, host or link.

## Check

- Before and after the helper: the answers of the four groups (inside, outside Curitiba, a later layer failing) dumped
  as JSON with their `data` keys, byte-identical.
- `npx vitest run test/serviceAreasAtPoint.test.ts test/placeAtPoint.test.ts`: new tests pass.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
