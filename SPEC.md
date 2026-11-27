# SPEC: v0.80.0 Person-name filter, fourth pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the lows of the v0.76.0 review on the `city_facilities_search`
person-name filter of the work types (`src/sources/nameFilter.ts`). L1: service lines the v0.76.0 pass hid by mistake
are shown again. L2: "Atendimento: agendamento com Fulana", which passed as hours, is hidden. No new citizen question;
the eval count is unchanged.

## Source

None new. No request is made and the GeoCuritiba layers are not re-read; the change is tested on synthetic lines.

## Changes (`src/sources/nameFilter.ts`)

1. **L1, unit words**: `gente`, `regional`, `coordenacao` and `rh` count as unit words (`GUARDED_UNIT`), but only
   before the end, ":", ".", ";", "?", "!" or a connector (pelo, por, via, no, em, da/de/do, e, ou, para), so
   "Dúvidas? Fale com a gente pelo 156", "Telefone da Regional: …", "E-mail da coordenação" and "Tratar com o RH da
   empresa" are shown while "Falar com o RH Fulano" and "Telefone da coordenação, Fulana" stay hidden, as in 0.79.0.
   "coordenadora" is not "coordenacao": "E-mail da coordenadora" stays hidden, and so does "Coordenação: Fulana" (the
   in-charge rule).
2. **L1, service phrase**: `SERVICE_ITEM` reads "emissão de" before "carteira de trabalho".
3. **L2, appointment**: `APPOINTMENT_NAMED` ("agendamento", an optional ",", "com", then a word that is not a unit
   or channel word or an appointment detail: antecedência, hora marcada, documentos, CPF, RG, senha), checked anywhere
   in an attendance value and in the rest of a "Contato" line, makes the value a name: "agendamento com Fulana",
   "presencial com agendamento com Fulana", "agendamento, com Fulana" and "Contato: 3350-0000 - agendamento com
   Fulana" are hidden; "agendamento com antecedência" and "agendamento com a equipe" are shown. `HOURS_BODY` is
   unchanged. Known limits: "agendamento pela Fulana", "presencial com Fulana" and a name later in an hours line
   without "agendamento com" still pass.
4. **Tests** (`test/cityFacilities.test.ts`, a v0.80.0 block): the five L1 lines are shown for the four work types;
   a name next to the new words is hidden; the L2 forms are hidden on the same line and after a bare label;
   appointments with a unit, a channel, a number or an appointment detail are shown; the new rule runs on 50 KB worst
   shapes in under 1 s.
5. **Docs and version**: docs/sources.md (a v0.80.0 paragraph), docs/tools.md (the `city_facilities_search` row),
   docs/roadmap-1.0.md, CHANGELOG 0.80.0, version 0.80.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

The office types' narrower filter, the garden allowlist, "agendamento pela …", names later in an hours line, any new
question, source, host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts`: the v0.80.0 block fails on 0.79.0 (L1 shown lines and L2 hidden lines)
  and passes on 0.80.0; every earlier block still passes.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
