# SPEC: v0.53.0 Escolas municipais, CMEIs, CMAEEs and contracted CEIs

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Qual o telefone e o horário do CMEI Bracatinga?" with
the CMEI IPPUC lists, its address, hours line and landline as published. Also list the escolas municipais, the CMAEEs
and the contracted CEIs. The tool lists places only: it never promises a vacancy, never says a contracted CEI is
accredited for the Vale-Creche, and never shows a staff or owner name or a personal phone or e-mail.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 80 "Escola Municipal" (188 records),
78 "Centro Municipal de Educação Infantil" (241), 81 "Centro Municipal de Atendimento Educacional Especializado" (13)
and 79 "Centro de Educação Infantil (contratado)" (180). robots.txt 404; the layers' metadata has empty
`copyrightText` and `description`, so no licence found (facts only, IPPUC cited, like the other GeoCuritiba layers).
No new host, no new link. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

What the read showed and how this version handles it:

- CMEIs (237 of 241), CMAEEs (13 of 13) and most CEIs (137 of 180) publish an hours line ("2ª a 6ª feira, das 7h às
  19h"). Escolas almost never do (2 of 188): their `open_periods` (morning, afternoon, evening) is set; the note says
  to call the school for times.
- 131 of 180 CEI records have a "Mantenedora: …" line naming the maintainer; some are sole proprietors, a person's
  full name. For `cei contratado` every line that mentions "mantenedora" is replaced by a visible marker.
- Phones: mobiles next to landlines in all four layers; CEI e-mails include gmail, hotmail and yahoo. The unchanged
  filters (Curitiba landlines only; e-mail at `curitiba.pr.gov.br` or a subdomain) drop them. The kept e-mails are
  unit mailboxes (`cmei…@sme.curitiba.pr.gov.br`, `cei…@educacao.curitiba.pr.gov.br`).
- One CMAEE line is about 530 characters: `wrapLines` for `cmaee`.

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and contact
   filters as the other urban-equipment layers:
   - `escola municipal` (80), alias `escolas municipais`;
   - `cmei` (78), aliases `cmeis`, `centro municipal de educacao infantil`, `creche municipal`;
   - `cmaee` (81), aliases `cmaees`, `centro municipal de atendimento educacional especializado`; `wrapLines`;
   - `cei contratado` (79), aliases `ceis contratados`, `centro de educacao infantil contratado`, `creche contratada`.
   No bare `escola` (state and private schools are not in these layers) or `creche` (it could mean `cmei` or `cei
   contratado`); both stay unresolved (tested).
2. **Maintainer lines**: `cei contratado` sets `hideLine: isMaintainerLine` and `hiddenLineMarker` "[the maintainer
   line is not shown: it can carry a person's name]". `isMaintainerLine` matches `mantenedor`, `mantido/a por`,
   `proprietário/a`, `eireli`, `ltda` (any case) or the word `ME` (plain regexes, linear). In `hourLines` (every type
   with `hideLine`), a hidden line that ends with ":" (a bare label) also hides the next line.
3. **Notes**: one shared note for the three municipal types (the units IPPUC lists, hours as published, see
   `updated`; enrolment and vacancies are not in the layer; escolas rarely publish hours, call the school). The CEI
   note says it is a private or non-profit centre contracted by the Prefeitura as listed by IPPUC, that this does not
   confirm Vale-Creche accreditation, and points to `city_service_guide` (`creche`, `vale_creche`).
4. **Descriptions**: the `type` parameter description names the four types. Tool contract snapshot updated.
5. **Eval**: new q131 "Qual o telefone e o horário do CMEI Bracatinga?" → `city_facilities_search`
   `{type: "cmei", name: "bracatinga"}`, expecting name, address, the hours line, phone and `note`; synthetic fixtures
   `test/fixtures/geocuritiba/{cmei,cei_contratado}_synthetic.json` (invented names, streets, phones and e-mails,
   among them a mobile, a gmail and a maintainer line with an invented person's name).
6. **Docs and version**: README, docs/tools.md, docs/sources.md, docs/roadmap-1.0.md, CHANGELOG 0.53.0, version 0.53.0
   in `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no school row and is unchanged.

## Out of scope

Enrolment, vacancies, the waiting list or which school serves an address; state or private schools; parsing hours into
fields; widening the contact filters; any new host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases resolve to layers 80, 78,
  81 and 79; bare `escola` and `creche` do not resolve; a CEI maintainer line is replaced by the marker and its
  person's name, mobile and gmail are absent from the JSON; the owner in another form (`Mantenedor`, `Mantida por`,
  `Proprietária`, a firm suffix) or on the line after a bare `Mantenedora:` is hidden; the CEI note says it does not confirm Vale-Creche
  accreditation and names `vale_creche`; q131 answered.
- `node scripts/eval-summary.mjs`: `answered 127 / 131`.
- The built parser over the four reads: 0 records skipped, the Bracatinga CMEI with a landline and its hours line.
- `scripts/verify` exits 0 on the PR head; packed size under 252,000 bytes.
