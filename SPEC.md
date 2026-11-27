# SPEC: v0.71.0 PGV codes as number or text

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), a follow-up of the 0.65.0 review: answer "Qual a microrregião
do IPTU na Rua XV de Novembro, 1000?" with `place_at_point` `place.pgv` even if the PGV layer publishes its
micro-bairro or micro-region code with the other JSON type. Today a numeric `cd_microbairro` or a text
`cd_microrregiao` becomes null.

## Source

No new source. The GeoCuritiba PGV layer 0, already recorded in [docs/sources.md](docs/sources.md). No host contacted
for this change: the layer's field types were not re-read, so nothing here says what the layer publishes today.

## Changes

1. **PGV codes** (`src/tools/placeAtPoint.ts`, `microRegionsOf`): `cd_microbairro` as a finite number is turned into
   text (`String`, so 27.0, which JSON carries as 27, becomes "27"; the ".0" is not invented), then cleaned as before.
   `cd_microrregiao` as text counts only when it is 1 to 6 digits after trimming (so a blank never becomes the code 0);
   a number counts when it is an integer, as before. The brief named `clean()` in `src/sources/geocuritiba.ts`; that
   helper is shared by about 15 facility fields, so the change stays in the two PGV fields.
2. **Tests** (`test/placeAtPoint.test.ts`): number and text for both codes, a blank, spaces and "2.5" as null.
3. **Eval**: q143 → `place_at_point` at a point on Rua XV de Novembro (about number 1000, -25.4293, -49.2652;
   approximate, the tool takes a point, not an address). The synthetic world answers that point with
   `cd_microbairro: 99` and `cd_microrregiao: "1"`; q143 fails without change 1.
4. **Docs and version**: docs/tools.md, docs/sources.md, docs/roadmap-1.0.md, CHANGELOG 0.71.0, version 0.71.0 in
   `package.json`, `package-lock.json`, `server.json`. Tool contract snapshot unchanged (no description changes).

## Out of scope

Changing the shared `clean()`, re-reading the layer, geocoding an address, any new field, host or link.

## Check

- `npx vitest run test/placeAtPoint.test.ts test/eval`: the new test passes; q143 answers, and fails on the 0.70.0 code.
- `node scripts/eval-summary.mjs`: answered count from the run.
- `scripts/verify` exits 0 on the PR head; packed size under the `MAX_PACKED_BYTES` limit.
