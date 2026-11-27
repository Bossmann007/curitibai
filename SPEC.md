# SPEC: v0.67.0 Neighbourhood culture and reading

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Tem Casa da Leitura perto do Bairro Alto?" with the
Casas da Leitura IPPUC lists, and add the other small culture layers of the same group (auditoriums, circus, chess
club, Bondinho da Leitura).

## Source (read 2026-11-27 UTC)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 61 "Casa da Leitura" (17 records), 60
"Bondinho da Leitura" (1), 52 "Auditório" (26), 57 "Circo" (2), 58 "Clube de Xadrez" (1). robots.txt 404 (2026-11-27
00:24:30 UTC, User-Agent `curitibai-mcp/0.67`); `description` and `copyrightText` empty, so no licence found (facts
only, IPPUC cited). No new host, no new link. Details: [docs/sources.md](docs/sources.md).

What the read showed and how this version handles it:

- `observacao` carries hours in most records (the queue item said there were none): shown as published. The lines
  name only the writers and artists the venues are named after. `clube de xadrez` uses the offices' person-line
  filter (review); `auditorio` does not, since it would hide the real "Atendimento Secretaria:" hours of two records.
- Layer 52 lists private (`Particular`), state and federal auditoriums next to the city's: `mixedOwnership`, as
  museu and teatro.
- One layer 52 record and the layer 58 record publish a city e-mail shaped like a person's name. The new type option
  `noEmails` returns no e-mail for `auditorio` and `clube de xadrez`; their notes say so and to call.
- The Casa da Leitura nearest to Bairro Alto is about 3.7 km away, beyond the 3 km `near` limit: the honest answer
  within 3 km is "none". The note points at `farol do saber` and `biblioteca`, and the eval expects `not_found`.

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`): `casa da leitura` (61; aliases include `casa de
   leitura`, `casas da leitura`), `bondinho da leitura` (60), `auditorio` (52, `mixedOwnership`, `noEmails`), `circo`
   (57), `clube de xadrez` (58, `noEmails`, person-line filter; alias `xadrez`), each with a short note. `type` description lists them
   (contract snapshot updated).
2. **Option** `noEmails` on `FacilityType`: `emails` is always `[]` for that type, and the general note no longer
   says city e-mails are kept.
2b. **Shared e-mail filter** (review of #82): `institutionalEmails` also drops a city address whose local part is two
   or more alphabetic words of 2+ letters joined by `.` or `_` (a person's shape), unless the first word is a unit
   prefix (`cras`, `visa`, `ccz`, `us`, `cmei`, …). It applies to every type.
3. **Eval**: q139 → `city_facilities_search` `{type: "casa da leitura", near: Bairro Alto, radius_m: 3000}`, expect
   `not_found`; synthetic fixture with every record over 3 km from that point.
4. **Docs and version**: docs/tools.md, docs/sources.md (robots recheck, layer paragraph with the hand requests),
   README row, docs/roadmap-1.0.md, CHANGELOG 0.67.0, version 0.67.0 in `package.json`, `package-lock.json`,
   `server.json`.

## Out of scope

Raising the `near` limit, a "nearest even if far" mode, programme or event listings, any new host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the five types resolve to their
  layers; `auditorio` says mixed ownership and returns no e-mail; q139 not_found.
- `node scripts/eval-summary.mjs`: `answered 135 / 139`.
- `scripts/verify` exits 0 on the PR head; packed size under the `MAX_PACKED_BYTES` limit.
