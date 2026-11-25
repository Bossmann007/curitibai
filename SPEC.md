# SPEC: v0.40.0 Cultural spaces, attractions and useful phones

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.40.0, phase B of docs/roadmap-1.0.md"). **This change publishes
nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): turn the Curitiba App rows "Cultural spaces and attractions" and
"Useful phones" from partial to covered where an honest source allows, reusing existing tools and sources first.

## What was missing (v0.39.1)

- **Cultural spaces and attractions:** `city_facilities_search` had IPPUC's Cultura layers with hours as published,
  but no list of tourist attractions (GeoCuritiba has no such layer; `informacoes turisticas` is only the three
  desks). Eval gaps q108 (pontos turísticos) and q109 (Ópera de Arame visiting hours).
- **Useful phones:** `useful_phones` has the Instituto Municipal de Turismo's 60 entries, with no Ouvidoria; the
  app's own list was never compared. Eval gap q110 (Ouvidoria Geral do Município).

## Prior art and sources checked (2026-11-25)

- GeoCuritiba Equipamentos Urbanos (169 layers): Cultura group already used; Turismo group has only the desks and
  craft fairs. Administration layers 12, 13, 16, 22: no Controladoria or Ouvidoria record.
- URBS points export (`city_points_search`): no tourism category (hotels are excluded as private).
- Linha Turismo site (robots.txt 404): `/atracoes-turisticas` lists nothing; `/onde-embarcar` lists 25 stops.
- Instituto Municipal de Turismo pages (inside Visit-time): prose, no Ópera de Arame hours.
- Central 156 site (robots.txt allows `/`): 156 and (41) 3074-6456, requests, information, denúncias, elogios; no
  Ouvidoria-Geral phone. `www.curitiba.pr.gov.br`: 403 to non-browser clients (CGM and "fale aqui" pages unread).

## Changes

1. **`ponto turistico`** in `city_facilities_search`: the 25 Linha Turismo stops bundled in
   `src/sources/linhaTurismo.ts` (`TOUR_STOPS`, page order), each with `lookup` (`{type, name}` of the GeoCuritiba
   record that gives address, hours and phone; null for 7 streets, squares and neighbourhoods). No network call;
   `name` filter only; listed in `list types`. New optional output field `lookup`.
2. **Eval:** q108 → `ponto turistico`; q109 → `teatro` + `name: "opera de arame"`, expecting `open_periods` and
   `phones` (no source publishes its hours). New fixture `teatro.json` (the real Ópera de Arame record, one invented theatre). `cultural_spaces` leaves `APP_GAPS`.
3. **Useful phones stays partial**, with the reason in docs/tools.md; q110 and q072 unchanged.
4. **Docs and version:** docs/tools.md, docs/sources.md, docs/roadmap-1.0.md, README, CHANGELOG 0.40.0, version
   0.40.0 in `package.json`, `package-lock.json`, `server.json`, tool contract snapshot.

## Out of scope

Any request from the server to `linhaturismo.curitiba.pr.gov.br`; a collector for it; the Linha Turismo fare and
timetable; an Ouvidoria phone without a readable official source; the turismo robots.txt redirect seen on 2026-11-25
(collector unchanged).

## Check

- `npx vitest run test/linhaTurismo.test.ts test/cityFacilities.test.ts test/contracts.test.ts test/eval`.
- `node scripts/eval-summary.mjs`: `answered 112 / 119`; `node scripts/coverage-report.mjs --tools docs/tools.md`:
  15 of 18 Curitiba App rows covered (7 data, 8 guide).
- `scripts/verify` exits 0 on the PR head.
