# SPEC: v0.82.0 Person-name filter, sixth pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), three follow-ups on the work-type person-name filter
(`src/sources/nameFilter.ts`): (1) the v0.80 Security R3 forms of "agendamento com" + a name-like word; (2) v0.81
Security R1, a short number before "Dias"/"Hora" read as hours after a guarded phrase; (3) v0.81 Security R2, "util"
alone read as hours. No new citizen question; the eval count is unchanged.

## Source

None new. No request was made: the tests use synthetic lines.

## Cause

Checked on main (b7dc102) before the change: the five R3 forms ("agendamento com Dias", "com Uma Costa", "com hora
Fulana", "com dias Fulana", "com senha Fulana") are already hidden. What still passes is the word after them:
`APPOINTMENT_DETAIL` let um/uma, dia(s), hora and senha count as details before any digit or any of
`d[aeo]s?|n[ao]|pel[ao]`, so "agendamento com Dias de Souza", "com Hora pelo 156", "com Uma 3350-0000" and "com Dias
marcados" were shown. In `HOURS_STEP`, `(?<=\d\s?)(?:dias?|horas?)` read "156 Dias", "8 Dias" and "156 Hora" as hours,
and `util|uteis` alone read "Util" and "Úteis" as hours, so these showed on the line after a guarded phrase.

## Changes

1. **`APPOINTMENT_DETAIL`**: each name-like word has its own details. um/uma: semana, dia, hora, minuto, mês. dia(s):
   útil/úteis, corridos, antes, "de antecedência/prazo". hora: marcada/agendada. senha: retirada, prévia, or "na/pela"
   and recepção, portaria, unidade, site, internet, telefone, aplicativo, app, 156. A number no longer counts.
2. **`HOURS_STEP`**: "dia(s) útil/úteis" is one step and bare "útil/úteis" is gone; "dia(s)" after a number only before
   "de"; "hora(s)" only after a one- or two-digit number. The alternatives are disjoint (one word, one path).
3. **Tests** (`test/cityFacilities.test.ts`, a v0.82.0 block): hidden and kept forms for the four work types, the
   two- and three-line forms after a guarded phrase, and timing cases for every new alternative.
4. **Docs and version**: docs/sources.md (a v0.82.0 paragraph), docs/tools.md (the `city_facilities_search` row),
   docs/roadmap-1.0.md, CHANGELOG 0.82.0, version 0.82.0 in `package.json`, `package-lock.json`, `server.json`.

Known limits: "8 Hora" (one or two digits) still reads as hours after a guarded phrase; "2 dias" alone there is
hidden, on the safe side; only the second word after um/uma, dia(s), hora and senha is read.

## Out of scope

"agendamento pela …"; names later in an hours line; the 0.81.0 three-line limit ("Telefone da Regional:" /
"3350-0000" / "- Fulana"); any new question, source, host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts`: the v0.82.0 block fails on 0.81.0 (12 of 13) and passes on 0.82.0;
  every earlier block still passes.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
