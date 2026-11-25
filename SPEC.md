# SPEC: v0.47.0 Health surveillance, zoonoses and the municipal veterinary hospital

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo.
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Onde fica o Hospital Veterinário Municipal e como
funciona?" with what IPPUC publishes, and give the addresses and hours of the Vigilância Sanitária offices and the
zoonoses centre. The veterinary hospital's layer has its address only, so the answer says where it is and, plainly,
that how it works, who it serves and what it costs are not published: ask the 156. No free care is promised.

## Source (read 2026-11-25)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 167 "Vigilância Sanitária" (10
records, one per regional, Monday to Friday 8h to 18h, landlines, `visa.*@sms.curitiba.pr.gov.br`), 136 "Centro de
Controle de Zoonoses e Vetores" (1 record: daily hours, "Nos finais de semana e feriados o atendimento é em regime de
plantão.") and 112 "Hospital Veterinário Municipal" (1 record: address only; phone, e-mail and `observacao` null, all
period flags "Não", `dt_atualiz` 2024-12-18). robots.txt 404, layer metadata with empty `copyrightText` and
`description`, so no licence found (facts only, IPPUC cited, like the other GeoCuritiba layers). No other source was
read: the Prefeitura's pages are on hosts this project never contacts. No new host. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers:
   - `vigilancia sanitaria` (167), aliases `vigilancias sanitarias`, `vigilancia sanitaria municipal`;
   - `zoonoses` (136), aliases `centro de controle de zoonoses`, `centro de controle de zoonoses e vetores`,
     `controle de zoonoses`, `centro de zoonoses`, `centros de zoonoses`, `zoonose`, `centro de zoonose`, `ccz`;
   - `hospital veterinario` (112), aliases `hospital veterinario municipal`, `hospitais veterinarios`.
   No bare `vigilancia`, `veterinario`, `animal` or `pet` alias.
2. **Notes**, only what the layers publish, and nothing that goes stale if a record changes (no office count, no
   restated hours). `vigilancia sanitaria`: the SMS offices, hours as published (see `updated`); call the office or
   the 156 before going. `zoonoses`: hours as published; call or the 156; the veterinary hospital is type `hospital
   veterinario`. `hospital veterinario`: when read on 2026-11-25 the layer published the address only (no hours,
   phone, services or who it serves); empty `hours` or `phones` and all-false `open_periods` mean not published, not
   closed; the tool cannot say who the hospital serves or what it costs: ask the 156; the zoonoses centre is type
   `zoonoses`.
3. **Descriptions**: the `type` description names the three types. Tool contract snapshot updated.
4. **Eval**: q125 "Onde fica o Hospital Veterinário Municipal e como funciona?" → `city_facilities_search` `{type:
   "hospital veterinario"}`, synthetic fixture `test/fixtures/geocuritiba/hospital_veterinario_synthetic.json` (plus
   `vigilancia_sanitaria_synthetic.json` and `zoonoses_synthetic.json` for the unit tests). It checks the name,
   address, `updated` and the note; "como funciona" is answered only as "not published, ask the 156".
5. **Docs and version**: README, docs/tools.md (row, which-tool row), docs/sources.md (layers 167, 136, 112, the
   robots.txt recheck, every hand request), docs/roadmap-1.0.md, CHANGELOG 0.47.0, version 0.47.0 in `package.json`,
   `package-lock.json`, `server.json`. The Curitiba App table has no row for these services and is unchanged.

## Out of scope

How the veterinary hospital works, who it serves or what it costs (not published in the layer; no other source
read); what Vigilância Sanitária or the zoonoses centre does; reporting a complaint or an animal (156); any new host
or link; parsing hours into days or times.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases, bare `vigilancia`,
  `veterinario`, `animal`, `pet` and `hospital` not types, hours as published, the veterinary hospital's empty
  fields and its note (no free-care promise), q125 answered.
- `node scripts/eval-summary.mjs`: `answered 121 / 125`.
- `scripts/verify` exits 0 on the PR head.
