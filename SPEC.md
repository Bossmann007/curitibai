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

1. **L1, unit words**: `gente`, `regional`, `coordenacao` and `rh` count as unit words (`GUARDED_UNIT`) only when
   the rest of the line holds nothing but numbers, "[masked]", punctuation, channel and unit words, "empresa",
   "site/portal/aplicativo" and connectors. So "Dúvidas? Fale com a gente pelo 156", "Telefone da Regional: …",
   "E-mail da coordenação" and "Tratar com o RH da empresa" are shown, while "Falar com o RH Fulano", "Tratar com o RH
   da Fulana", "Telefone da Regional: 3350-0000 - Fulana" and "Telefone da Regional (Fulana)" stay hidden, as in
   0.79.0. The brief said to add the four words to `UNIT_WORD`; plainly added, they let a name after them through, so
   they are guarded instead. "Telefone da coordenação: 3350-0000" stays hidden (`isPersonInChargeLine`, the
   "coordenação:" label), and so does "E-mail da coordenadora".
2. **L1, service phrase**: `SERVICE_ITEM` reads "emissão de" before "carteira de trabalho".
3. **L2, appointment**: `APPOINTMENT_NAMED` ("agendamento", optionally "prévio" and ",", "(", ":" or "-", then "com"
   and a word that is not a unit or channel word or an appointment detail: um/uma, no/pelo, até, mínimo,
   antecedência, hora, horário, documentos, comprovante, carteira, CPF, RG, senha) is checked on the whole line, like
   `NAMED_CHANNEL`: "Atendimento: agendamento com Fulana", "presencial com agendamento com Fulana", "mediante
   agendamento prévio com a Fulana", "Contato: 3350-0000 - agendamento com Fulana" and a line "Agendamento com Fulana"
   are hidden; "agendamento com antecedência", "com no mínimo 48h" and "agendamento com a equipe" are shown.
   `HOURS_BODY` is unchanged. Known limits: "agendamento pela Fulana", "agendamento com uma Fulana", "presencial com
   Fulana" and a name later in an hours line without "agendamento com" still pass.
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
