# SPEC: v0.48.0 Guarda Municipal modules and regional núcleos

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo.
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Tem módulo da Guarda Municipal no Parque Tanguá?" with
the module's address, hours as published, 24-hour flag and phone, and give the Guarda Municipal's regional núcleos
with the bairros each covers, as published. The tool lists places; it does not dispatch help. Every answer for these
types starts with the emergency numbers: 153 (Guarda Municipal) or 190 (Polícia Militar).

## Source (read 2026-11-25)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 139 "Módulo da Guarda Municipal" (40
records, most "Emergência, ligue 153." and "Diariamente, 24 horas"; "Módulo da Guarda Municipal Parque Tanguá" in
Taboão among them) and 138 "Núcleo Regional da Guarda Municipal" (10 records, each named "Núcleo Regional da Defesa
Social …", operational hours daily 24 hours, administrative hours Monday to Friday, "Emergência, ligue 153." and the
bairros it covers). robots.txt 404, layer metadata with empty `copyrightText` and `description`, so no licence found
(facts only, IPPUC cited, like the other GeoCuritiba layers). 153 is in the layer text; 153 (Guarda Municipal) and
190 (Polícia Militar) are both in the "Emergências" section of the Instituto Municipal de Turismo's "Telefones Úteis"
page as read on 2026-11-22 for `useful_phones` (no new read). No new host. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers:
   - `modulo da guarda` (139), aliases `modulos da guarda`, `modulo da guarda municipal`, `modulos da guarda
     municipal`;
   - `nucleo da guarda` (138), aliases `nucleos da guarda`, `nucleo da guarda municipal`, `nucleos da guarda
     municipal`, `nucleo regional da guarda municipal`, `nucleos regionais da guarda municipal`, `nucleo regional da
     defesa social`, `nucleos regionais da defesa social`.
   No bare `guarda`, `guarda municipal` (module or núcleo), `seguranca`, `policia`, `modulo` or `nucleo` alias.
2. **Notes**. Both types lead with "Emergency: call 153 (Guarda Municipal) or 190 (Polícia Militar). This tool lists
   places, it does not dispatch help." Modules: hours as published (see `updated`), `open_periods.all_day` is the
   layer's 24-hour flag and `hours` the detail; a place with no module in this list may still be patrolled, so no
   result is not a statement about the Guarda's presence; the regional núcleos are type `nucleo da guarda`. Núcleos:
   named "Núcleo Regional da Defesa Social" in the layer; hours (operational and administrative) and the bairros each
   covers are in `hours` as published; modules are type `modulo da guarda`. No counts (they go stale).
3. **Descriptions**: the `type` description names the two types; within 400 characters. Tool contract snapshot
   updated.
4. **Eval**: q126 "Tem módulo da Guarda Municipal no Parque Tanguá?" → `city_facilities_search` `{type: "modulo da
   guarda", name: "tangua"}`, synthetic fixture `test/fixtures/geocuritiba/modulo_da_guarda_synthetic.json` (plus
   `nucleo_da_guarda_synthetic.json` for the unit tests).
5. **Docs and version**: README, docs/tools.md (row, which-tool row), docs/sources.md (layers 139 and 138, the
   robots.txt recheck, every hand request), docs/roadmap-1.0.md, CHANGELOG 0.48.0, version 0.48.0 in `package.json`,
   `package-lock.json`, `server.json`. The Curitiba App table has no row for these places and is unchanged.

## Out of scope

Which núcleo covers an address (beyond the bairros listed in `hours`); calling or alerting the Guarda; other police
layers (delegacias, PF, PRF: the next version); parsing hours into days or times; any new host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases, bare `guarda`, `guarda
  municipal`, `seguranca`, `policia`, `modulo`, `nucleo` not types, "Emergência, ligue 153." kept in `hours`, phone
  "153" kept, the 153/190 lead sentence first in the note, q126 answered.
- `node scripts/eval-summary.mjs`: `answered 122 / 126`.
- `scripts/verify` exits 0 on the PR head.
