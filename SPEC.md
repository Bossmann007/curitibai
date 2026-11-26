# SPEC: v0.52.0 Social assistance beyond the CRAS

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Onde fica o CREAS que atende a CIC?" with the CREAS
IPPUC lists, its address, hours and phone as published. Also list the Centros POP, the Central de Encaminhamento
Social, the centres for older people, the women's reference centres and the Centro de Referência Afro. The tool lists
places only: it never promises service, eligibility or free care, never says which CREAS serves an address (the layer
does not publish it) and never lists shelters or transit houses.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 38 "Centro de Referência Especializado
de Assistência Social" (10 records), 40 "Centro POP" (3), 39 "Central de Encaminhamento Social" (1), 36 "Centro de
Atividades para Idosos" (5), 108 "Centro de Referência de Atendimento à Mulher" (2) and 109 "Centro de Referência Afro"
(1). robots.txt 404; the layers' metadata has empty `copyrightText` and `description`, so no licence found (facts
only, IPPUC cited, like the other GeoCuritiba layers). No new host for the server. The 180 and 190 numbers: the
Ministério das Mulheres' "Ligue 180" page on `www.gov.br`, read by hand once (robots.txt allows the path); the server
never contacts it. Details: [docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

What the read showed and how this version handles it:

- The CREAS are named after a regional ("CIC") and no field or line says which bairros each serves. The eval question
  uses `name: "cic"`; the note says coverage is not in the layer and to ask the CRAS or the 156.
- One Centro POP record's `observacao` names a transit house and its street address. Shelters and transit houses
  (layers 45, 46 and 164) are sensitive: they are never types, and in the six new types a line that mentions one is
  replaced by a visible marker.
- Every CREAS and two Centros POP publish mobiles; one CREAS e-mail is at a misspelt domain. The unchanged filters
  (e-mail `curitiba.pr.gov.br` only, Curitiba landlines only) drop them; two Centros POP come back with no phone.
- Both women's centres had `divulgar_endereco` "Sim" when read; the type still fails closed for any other value.

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers, built by a `social()` helper:
   - `creas` (38), aliases `centro de referencia especializado de assistencia social`, `centros de referencia
     especializados de assistencia social`;
   - `centro pop` (40), aliases `centros pop`, `centro de referencia especializado para populacao em situacao de rua`;
   - `central de encaminhamento social` (39), aliases `central de encaminhamento social 24 horas`, `centrais de
     encaminhamento social`;
   - `centro de atividades para idosos` (36), aliases `centros de atividades para idosos`, `espaco conviver`, `espacos
     conviver`;
   - `centro de referencia da mulher` (108), aliases `centros de referencia da mulher`, `centro de referencia de
     atendimento a mulher`, `centros de referencia de atendimento a mulher`, `casa da mulher brasileira`;
   - `centro de referencia afro` (109), alias `centros de referencia afro`.
   No `abrigo`, `casa de passagem` or `acolhimento` name. None of the new names is used by another type.
2. **Shelter lines and records**: the six types and the existing `cras` set `hideLine: isShelterLine` and the new
   optional `hiddenLineMarker` (`HIDDEN_SHELTER_LINE`, "[a line that may point at a shelter, transit house or
   confidential unit is not shown; ask the 156]"). `isShelterLine` folds the text, turns runs of spaces and hyphens into
   one space and tests `casas? de passagem|abrigo|albergue|pernoite|sigilos|casas? lar|casas? de acolhi|unidades? de
   acolhimento|acolhimento institucional`, a plain alternation of literals, linear. `hourLines` takes the marker as a
   parameter (default `HIDDEN_NAME_LINE`, so the registry type is unchanged), tests the whole cleaned line as well as
   the 160-character cut (a word past the cut still hides it) and merges consecutive markers. A record of these types
   whose `nome_completo`, `nome`, `nome_rua` or `compl_end` matches is left out and counted in `skipped_records` (its
   output description says so; snapshot updated).
3. **Private address** (new optional `privateAddress`, set only on `centro de referencia da mulher`): when
   `divulgar_endereco` is not exactly "Sim", the record returns its name, institutional phones, `updated` and one
   `hours` line `PRIVATE_ADDRESS_LINE` ("[the address of this place is not published: call its phone if one is shown,
   or the 180 or the 156]"); address, position, `bairro`, `regional`, e-mails and periods are null or empty, so
   `bairro` and `near` never match it. Other types keep the older rule (address and position hidden only).
4. **Notes**: CREAS (named after a regional; coverage not in the layer, ask the CRAS or the 156; `bairro` is where a
   unit is), Centro POP (requests through the 156; a mobile-only unit has no phone here), Central
   (contact through the 156), centres for older people (named Espaço ConViver; who can join not in the layer), women's
   centres (the private-address rule above; who is assisted not in this tool) and Afro centre; the CREAS, Centro POP,
   Central and women's notes say shelters and transit houses are not listed. The women's type leads with
   `WOMEN_EMERGENCY_NOTE`: "Emergency: call 190 (Polícia Militar). Central de Atendimento à Mulher: 180 (24 hours,
   free call), both as published by the Ministério das Mulheres. This tool lists places, it does not dispatch help."
   No note promises service, eligibility or free care.
5. **Descriptions**: the `type` parameter description names `cras` and the six types. Tool descriptions unchanged.
   Tool contract snapshot updated.
6. **Eval**: new q130 "Onde fica o CREAS que atende a CIC?" → `city_facilities_search` `{type: "creas", name: "cic"}`,
   expecting name, address, the hours line, phone and `note`; synthetic fixtures
   `test/fixtures/geocuritiba/{creas,centro_pop,centro_de_referencia_da_mulher}_synthetic.json` (invented names,
   streets, phones and e-mails, among them mobiles, a misspelt domain, shelter lines with invented addresses, and
   women's records with `divulgar_endereco` "Sim", "Não", null and "sim").
7. **Docs and version**: README, docs/tools.md (input row, output note, which-tool row), docs/sources.md (the six layers,
   the robots.txt recheck, every hand request, the `www.gov.br` row), docs/roadmap-1.0.md, CHANGELOG 0.52.0, version
   0.52.0 in `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no row for these services
   and is unchanged.

## Out of scope

Which CREAS or CRAS serves an address (a later `place_at_point` item if a layer publishes it); shelters, transit
houses and any other sensitive layer; booking, eligibility or benefits; widening the e-mail or phone filters; linking
any site; any new server host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases resolve to layers 38, 40,
  39, 36, 108 and 109; no type points at `.../MapServer/45`, `/46` or `/164` and no shelter name resolves;
  `isShelterLine` matches the shelter words in any case, accent or hyphenation, keeps "acolhimento" alone and is fast
  on a long line; a shelter word past the 160-character cut still hides the line; a CREAS record whose address names a
  shelter is skipped and counted; `cras` has the same line check; the CREAS CIC answer has the mobile and the misspelt e-mail dropped and a note that claims no coverage; shelter
  lines in a CREAS and a Centro POP replaced by one marker; a mobile-only Centro POP with no phone; a women's centre
  with "Não", null or "sim" returns only name, phones and the marker line (no fixture street, bairro, regional,
  coordinates or e-mail in the JSON) and never matches `bairro` or `near`, while the "Sim" record is shown in full; the
  women's note leads with 190 and 180 and other types carry no such note; q130 answered.
- `node scripts/eval-summary.mjs`: `answered 126 / 130`.
- `scripts/verify` exits 0 on the PR head.
