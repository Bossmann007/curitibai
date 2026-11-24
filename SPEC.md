# SPEC: v0.27.0 GeoCuritiba pack (voting places, police and fire areas, census, terminals) and dated city notes

Approved: Enzo 2026-11-24 (task brief "curitibai v0.27.0": "segue com o curitibaai"; vision: everything a Curitiba
citizen needs inside their own AI). Source survey: Research Desk, 2026-11-24; every source re-checked on 2026-11-24
(21:00–21:30 UTC) before coding, see `docs/sources.md`. **This change publishes nothing**: no workflow run, no tag.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

More of what a citizen asks, answered from the GeoCuritiba host the server already reads (same host gate, cache,
parser and fail-closed rules), plus two dated notes that need no request.

## Changes

1. **`city_facilities_search`** ([ADR 0005](docs/adr/0005-extend-a-tool-before-adding-one.md): same host, parser and
   envelope):
   - type `local de votacao` (BaseTematica layer 12, 422 places, TRE-PR list of 31/08/2026): name, address, bairro,
     regional, `sections` (número de seções) and `electoral_zone`. Fixed `outFields` without `num_eleitores` (never
     asked for, tested); the note says the list cannot tell a voter their own place (título / TRE-PR). `updated` is
     `data_alteracao` (DD/MM/YYYY) as YYYY-MM-DD.
   - types `terminal` (Equipamentos layer 157, 22 terminals) and `terminal metropolitano` (layer 158, 1), the same
     equipment fields and guards as the other types; up to 80 lines of `observacao` (the integrated lines; Pinheirinho
     has 65).
   - any type: when `observacao` has more lines than the cap, the last line says how many were not shown (was a silent
     cut at 30).
   - new optional input `name`: every word must appear in the name, accents and case ignored; filtered in the server,
     never sent.
2. **`service_areas_at_point`**: new input `areas`, `care` (default; health unit and CRAS, unchanged) or `safety`:
   Polícia Militar company area (layer 27: battalion and company), Polícia Civil district (layer 25) and Corpo de
   Bombeiros platoon area (layer 41: platoon, company, battalion). `safety` asks layer 27 first; when it has nothing,
   the bairro layer decides `inside_curitiba` (layer 21, statewide battalions, is not used). A failure of layer 25 or
   41 is `partial`, never a failed call. The output gains `areas`, `police_military`, `police_civil` and `fire` (empty
   when not asked).
3. **`census_at_point`** (new tool: the answer shape and the privacy floor differ, ADR 0005): the IBGE 2022 census
   sector containing the point (BaseTematica layer 43) with persons, occupied private households, density per km² and
   mean monthly income of the household heads with income, and the neighbourhood totals (persons, households, area,
   density) from one `outStatistics` query. Floor ([ADR 0009](docs/adr/0009-census-household-floor.md)): sector
   figures only when the sector has at least 20 occupied private households (29 of 3,190 sectors have fewer); the
   neighbourhood totals sum only the sectors at the floor (`AND v0007 >= 20`), so a withheld sector cannot be
   subtracted back; `v0005`, `v0006` and the favela/community name are never asked for. The
   neighbourhood name sent in the `where` comes from the sector answer and must be one of the 75 IBGE names bundled in
   the code. No neighbourhood income (a mean of sector means is not the neighbourhood mean).
4. **`city_calendar`** (new tool, no network, data bundled like `detran_pr_info`): `topic` `holidays` (Decreto
   2.385/2025: holidays, optional days and recess of the municipal administration in 2026; schools follow their own
   calendar, art. 3) or `iptu` (IPTU 2026 general rule: 10% off in cash by 20 March, up to 10 instalments March to
   December on day 20, DAM via bank, PIX or automatic debit; Legisweb mirrors of Prefeitura releases, marked as
   secondary source). After 2026-12-31 (Curitiba time) the answer says `expired: true`.
5. **URBS on GeoCuritiba**: only the terminals (item 1). Stops and lines stay on the user's URBS files: GeoCuritiba has
   no timetable, no stop order per line and no update date. The PR body proposes how `bus_stops_near` could use it.
6. **`docs/development.md`** "Approving a run", First release step 6: if the hashes differ, do not run the registry
   step; `npm deprecate curitibai-mcp@0.26.1`, investigate the laptop, publish the next version through the workflow.
   `test/workflows.test.ts` pins the first release to 0.26.1 (not the `package.json` version).
7. **Docs and version**: `docs/tools.md` (reference rows, which place tool, Curitiba App rows), `docs/sources.md`,
   README tool list, CHANGELOG 0.27.0, version 0.27.0 in `package.json`, `package-lock.json` and `server.json`; 25 →
   27 tools; descriptions stay within 400 characters each and 9,600 in sum.

## Out of scope

Live URBS stops or lines in the bus tools (v0.28 candidate); OpenCEP, IBGE SIDRA, Guia de Serviços do Paraná (not
in the brief); voter data of any kind; publishing; tags.

## Check

- `scripts/verify` exits 0 (in a clone where tag `v0.26.1` exists; until the owner tags it, `check-release` reports
  the missing previous tag, as ADR 0006 intends).
- Tests: voting URL has no `num_eleitores`; voting record parsing; terminal 65-line `observacao` returned whole;
  cut marker at the cap; `name` filter; every alias reachable; `safety` layers, order, `partial` and why a layer is
  missing; census floor at 19/20 households, totals `where` with the floor, neighbourhood name not in the list is
  never sent, a sector code in another format is still inside Curitiba, income 0 is null; `city_calendar` before and after 2026-12-31.
- Contract snapshot updated on purpose; tools/list sizes printed by `test/contracts.test.ts`.
