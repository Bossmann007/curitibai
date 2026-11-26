# SPEC: v0.50.0 Where to get an RG (Instituto de Identificação)

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo.
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Onde eu faço a carteira de identidade no Tatuquara e
precisa agendar?" with the Instituto de Identificação do Paraná's service post in that bairro, its address, days and
hours and its appointment line, all as published. The tool lists places; it does not book. Appointments are booked
through the Paraná state Instituto de Identificação's channels, named without a link (state host, not on the link
allowlist). The tool never says that no appointment is needed.

## Source (read 2026-11-25)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layer 168 "Instituto de Identificação do
Paraná" (12 records: the institute's head office in Centro, "Atendimento administrativo", the Central post, nine posts
in Ruas da Cidadania and one in a shopping centre). The layer has **no separate appointment field**: the line
"Necessário agendamento prévio para atendimento." is in `observacao` (11 of 12 records; not the head office), so it
comes back in `hours`. Three posts (Tatuquara, CIC, Cajuru) publish "2ª e 6ª feira", kept as written. A post's name
is its Rua da Cidadania, not always its bairro (Pinheirinho is in Capão Raso, Bairro Novo in Sítio Cercado, Boa Vista
in Bacacheri). robots.txt 404, layer metadata with empty `copyrightText` and `description`, so no licence found (facts
only, IPPUC cited, like the other GeoCuritiba layers). No new host. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

## Changes

1. **Type** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers: `instituto de identificacao` (168, label "Instituto de
   Identificação do Paraná"), aliases `instituto de identificacao do parana`, `rg`, `carteira de identidade`,
   `posto de identificacao`, `postos de identificacao`. No bare `identidade`, `documento` or `cin` alias (checked:
   none of these aliases is used by another type).
2. **Notes**. Lead: "Appointments are booked through the Paraná state Instituto de Identificação's channels (not
   linked by this tool); this tool lists places, it does not book." Type note: the posts of the Instituto de
   Identificação do Paraná in Curitiba as listed by IPPUC; days, hours and the appointment line are in `hours` as
   published (see `updated`); a record with no appointment line does not mean no appointment is needed, and the head
   office's hours are administrative, so being listed does not mean a place issues the card; some posts publish "2ª
   e 6ª feira", kept as written, so call before going; posts are named after their Rua da Cidadania, which is not
   always the bairro: filter by `bairro` or `near`.
3. **Privacy filters unchanged**: the layer's `ii.pr.gov.br` e-mails are dropped by the `curitiba.pr.gov.br`-only
   allowlist, so `emails` is empty; docs say so. Phones are Curitiba landlines and are kept.
4. **Descriptions**: the `type` parameter description names `"instituto de identificacao"` (or `"rg"`). Tool
   descriptions unchanged. Tool contract snapshot updated.
5. **Eval**: new q128 "Onde eu faço a carteira de identidade no Tatuquara e precisa agendar?" →
   `city_facilities_search` `{type: "rg", bairro: "tatuquara"}`, expecting the post's name, address, the days line
   (`hours.1`), the appointment line (`hours.2`), phone and `note`; synthetic fixture
   `test/fixtures/geocuritiba/instituto_de_identificacao_synthetic.json`.
6. **Docs and version**: README, docs/tools.md (row, which-tool row), docs/sources.md (layer 168, the robots.txt
   recheck, every hand request, the dropped e-mails), docs/roadmap-1.0.md, CHANGELOG 0.50.0, version 0.50.0 in
   `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no row for identity documents and is
   unchanged.

## Out of scope

Booking, or linking the state's booking page or any state host; widening the e-mail or phone filters; parsing hours
or the appointment line into fields; the Detran or other documents; any new host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases resolve to layer 168,
  bare `identidade`, `documento`, `cin` not types, hours and the appointment line as published ("2ª e 6ª feira"
  kept), `emails` empty for an `@ii.pr.gov.br` record, the head office with no appointment line returned as
  published, the lead note first and the no-appointment-line sentence in the note, the note carries no link, q128
  answered.
- `node scripts/eval-summary.mjs`: `answered 124 / 128`.
- `scripts/verify` exits 0 on the PR head.
