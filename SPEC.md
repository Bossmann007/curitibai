# SPEC: v0.84.0 Person-name filter, seventh pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the Security Reviewer's R1-R3 on v0.82.0, in the work-type
person-name filter of `city_facilities_search` (`src/sources/nameFilter.ts`). No new citizen question; the eval count
is unchanged.

## Source

None new. No request is made; synthetic lines only.

## Changes

1. **R1** (`APPOINTMENT_DETAIL`): after "agendamento com", um/uma before dia(s) or hora(s) is a detail only when
   `DAY_DETAIL` follows (útil/úteis, corridos, antes, "de antecedência/prazo"), the same list dia(s) already used, now
   one constant. "com Uma Dias", "com Uma Dias Silva", "com Uma Dias de Souza" and "com Um Hora" are hidden.
2. **R2**: senha is also a detail before "de atendimento" and "numerada".
3. **R3**: no behaviour change. "30 dias" and "1 dia" alone after a guarded phrase stay hidden; "10 horas" reads as
   hours there (as "24 horas" since 0.82.0). Stated as a known limit in a code comment and CHANGELOG, and tested.
4. **Tests** (`test/cityFacilities.test.ts`, v0.84.0 block): each hidden and kept case, every line the 0.82.0 review
   lists as legitimate, the known limits, and a timing test of the new alternatives repeated.
5. **Docs and version**: docs/sources.md, docs/tools.md, docs/roadmap-1.0.md, CHANGELOG 0.84.0, version 0.84.0 in
   `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Any new source, host, link or question. Reading more than the words right after senha. Changing how a number before
"horas" reads after a guarded phrase.

## Check

- `npx vitest run test/cityFacilities.test.ts`: the v0.84.0 hide and keep tests fail on 0.83.0 and pass on 0.84.0.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
