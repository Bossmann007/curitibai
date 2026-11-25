# SPEC: v0.44.0 Health units with hours

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.44.0, municipal health units (Unidades de Saúde) with opening
hours and phone, `city_facilities_search` type `unidade de saude`"). **This change publishes nothing**: no workflow
run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "A unidade de saúde do Caximba abre no sábado?" with
the unit's hours and phone as the Prefeitura publishes them, never as a promise. `health_units_search` (CNES) has no
hours, so it stays as it is and the two descriptions point to each other.

## Source (read 2026-11-25)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer/134` "Unidade de Saúde" (109 records, hours in
`observacao`, all Monday to Friday; `dt_atualiz` 2025 or 2026). robots.txt 404, no licence found (facts only, IPPUC
cited, like the other GeoCuritiba layers). No new host. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

## Changes

1. **Type** `unidade de saude` in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), layer 134, aliases `unidades de
   saude`, `ubs`, `unidade basica`, `unidade basica de saude`, `unidades basicas de saude`, `posto de saude`,
   `postos de saude` (not the bare `saude` or `posto`), and a type `note`: hours as published by the SMS, a day not
   listed is not a promise either way, check before going (unit's phone or the 156), emergencies 192 or a UPA. Same
   query, fields, host gate, cache and phone and e-mail allowlist as the other urban-equipment layers.
2. **Descriptions**: `city_facilities_search` names health units (tool) and `unidade de saude`, `ubs`, `posto de
   saude` (`type`); `health_units_search` says it has no hours and names `city_facilities_search` `unidade de saude`.
   Both within 400 characters. Tool contract snapshot updated.
3. **Eval**: q122 "A unidade de saúde do Caximba abre no sábado?" → `city_facilities_search` `{type: "unidade de
   saude", name: "caximba"}`, with the synthetic fixture `test/fixtures/geocuritiba/unidade_de_saude_synthetic.json`.
4. **Docs and version**: README, docs/tools.md (the row, the which-tool rows, the Health information App row),
   docs/sources.md (layer 134 and the robots.txt recheck), docs/roadmap-1.0.md, CHANGELOG 0.44.0, version 0.44.0 in
   `package.json`, `package-lock.json`, `server.json`.

## Out of scope

UPAs, hospitals, CAPS and other health layers; parsing hours into days or times; any new host; any change to
`health_units_search` beyond its description.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases, no bare `saude` or
  `posto`, hours returned as published with the note, a mobile dropped, q122 answered.
- `node scripts/eval-summary.mjs`: `answered 118 / 122`.
- `scripts/verify` exits 0 on the PR head.
