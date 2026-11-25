# SPEC: v0.49.0 Police stations with hours

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo.
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Qual o endereço e o horário da delegacia do
Tatuquara?" with the delegacia's address, hours as published and phone, and give the Polícia Federal, Polícia
Rodoviária Federal and Polícia Científica offices the same way. The tool lists places; it does not file police
reports. Every answer for these types starts with the emergency numbers: 190 (Polícia Militar), 197 (Polícia Civil)
or 191 (Polícia Rodoviária Federal). `places_search` (OpenStreetMap) stays; the two descriptions point to each other.

## Source (read 2026-11-25)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 143 "Polícia Civil" (49 records:
the 13 district delegacias, "Delegacia do 13º Distrito Policial da Capital" in Tatuquara with "2ª a 6ª feira, das
8h30 às 18h" among them, specialised delegacias, and divisions and support units), 146 "Polícia Federal" (1), 147
"Polícia Rodoviária Federal" (1) and 145 "Polícia Científica" (3). robots.txt 404, layer metadata with empty
`copyrightText` and `description`, so no licence found (facts only, IPPUC cited, like the other GeoCuritiba layers).
190, 197 and 191 are all in the "Emergências" section of the Instituto Municipal de Turismo's "Telefones Úteis" page
as read on 2026-11-22 for `useful_phones` (no new read). No new host. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers:
   - `delegacia` (143, label "Polícia Civil"), aliases `delegacias`, `delegacia de policia`, `delegacias de policia`,
     `delegacia da policia civil`, `delegacias da policia civil`, `policia civil`, `distrito policial`, `distritos
     policiais`;
   - `policia federal` (146), alias `superintendencia da policia federal`;
   - `policia rodoviaria federal` (147), aliases `prf`, `superintendencia da policia rodoviaria federal`;
   - `policia cientifica` (145), aliases `policia cientifica do parana`, `unidade de execucao tecnico cientifica`,
     `unidades de execucao tecnico cientifica`.
   No bare `policia`, `pf`, `dp` or `iml` alias.
2. **Notes**. All four lead with "Emergency: call 190 (Polícia Militar), 197 (Polícia Civil) or 191 (Polícia
   Rodoviária Federal). This tool lists places, it does not file police reports." `delegacia`: layer 143 lists every
   Polícia Civil unit, not only delegacias; being listed does not mean a unit takes reports from the public, so call
   before going; hours as published (see `updated`); `all_day` is the layer's flag and `hours` the detail, and they do
   not always agree; online reports: the Polícia Civil do Paraná's Delegacia Eletrônica, named without a link (no
   Polícia Civil host is on the link allowlist); Polícia Militar units are not in the list (`places_search`). The
   other three: hours as published, call before going (PRF: on a federal highway call 191; Polícia Científica: being
   listed does not mean desk service). No counts (they go stale).
3. **Privacy filters unchanged** (owner decision): the layers' `pc.pr.gov.br`, `pf.gov.br` and `prf.gov.br` e-mails
   are dropped by the `curitiba.pr.gov.br`-only allowlist, so `emails` is empty; docs say so.
4. **Descriptions**: `city_facilities_search` names delegacias; its `type` description names the four types and
   points to `places_search` for fire stations and Polícia Militar units; `places_search` says to prefer it only for
   fire stations or when other place tools find nothing, and points to `city_facilities_search` for delegacias with
   hours. Every tool description stays at most 400 characters (`test/contracts.test.ts`). Tool contract snapshot
   updated.
5. **Eval**: q127 "Qual o endereço e o horário da delegacia do Tatuquara?" → `city_facilities_search` `{type:
   "delegacia", bairro: "tatuquara"}` (the record's name has no "Tatuquara"; its `bairro` does), synthetic fixture
   `test/fixtures/geocuritiba/delegacia_synthetic.json` (plus `policia_federal_synthetic.json`,
   `policia_rodoviaria_federal_synthetic.json` and `policia_cientifica_synthetic.json` for the unit tests). q035
   ("Onde ficam as delegacias de polícia em Curitiba?") moves from `places_search` `police` to `city_facilities_search`
   `{type: "delegacia"}`, the route the new descriptions give; three questions stay on `places_search`.
6. **Docs and version**: README, docs/tools.md (row, which-tool rows, the `places_search` note), docs/sources.md
   (layers 143, 146, 147 and 145, the robots.txt recheck, every hand request, the dropped e-mails), docs/roadmap-1.0.md,
   CHANGELOG 0.49.0, version 0.49.0 in `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has
   no row for these places and is unchanged.

## Out of scope

Filing a report or linking the Delegacia Eletrônica; widening the e-mail or phone filters; Polícia Militar units
(not in these layers); which delegacia covers an address (`place_at_point` `areas: "safety"` gives the Polícia Civil
district); parsing hours into days or times; any new host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases, bare `policia`, `pf`,
  `dp`, `iml`, `policia militar`, `delegacia eletronica` not types, hours as published, `emails` empty for an
  `@pc.pr.gov.br` record, the 24-hour flag kept when it disagrees with `hours`, the 190/197/191 lead sentence first in
  the note, q127 answered.
- `node scripts/eval-summary.mjs`: `answered 123 / 127`.
- `scripts/verify` exits 0 on the PR head.
