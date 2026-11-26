# SPEC: v0.59.0 COHAB agencies

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Onde fica a agência da COHAB no Tatuquara e que horas
abre?" with the COHAB-CT agency IPPUC lists, its address, hours and contacts as published. The tool lists places only:
it never books, and nothing from the COHAB applicant queue (a personal dataset) is read.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` (urban-equipment) layer 29 "Agência de
Atendimento da COHAB" (9 records). robots.txt 404 (19:59:13 UTC); the layer's metadata has empty `copyrightText` and
`description`, so no licence found (facts only, IPPUC cited, like the other GeoCuritiba layers). No new host, no new
link. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

What the read showed and how this version handles it:

- One agency in each of nine Ruas da Cidadania; hours "2ª a 6ª feira, das 8h às 17h" (four with a 12h–13h break).
- Every record has the same `telefone`, a landline and a toll-free 0800 number, which the phone filter dropped. A
  toll-free number is never a person's own, so `institutionalPhones` now keeps it ("0800 XXX XXXX") for every type;
  mobiles and other area codes are still dropped. Every record has the same e-mail: the note says these are central
  contacts.
- Every `observacao` ends with a line saying in-person service is booked through the Agenda Online ("Saiba Mais", a
  link in `site`, which is never read). The note says this tool does not book and points to `city_service_guide`
  `agenda_online`.
- Three agencies are named after a Rua da Cidadania in another bairro (Pinheirinho is in Capão Raso): the note says to
  search by `name`.
- No person's name, mobile or personal e-mail in the 9 records, nor in layer 15 (re-read for the item below).

## Changes

1. **Type** `cohab` (29) in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), aliases `cohab ct`, `cohab curitiba`,
   `agencia da cohab`, `agencias da cohab`, `agencia de atendimento da cohab`, `agencias de atendimento da cohab`;
   same query, fields, host gate, cache and e-mail allowlist as the other urban-equipment layers.
2. **Note** for `cohab`: central contacts; booking through the Agenda Online, not in this tool; housing applications,
   the applicant queue and anyone's registration not in this tool; search by `name`.
3. **0800 numbers** kept in `phones` (all types); the output `phones` description and the general note say so.
4. **Person lines** (v0.58 review): `administracao regional` and `cohab` pass the `cei contratado` maintainer filter
   (`isMaintainerLine`, the same function, so a bare label with the name on the next line is hidden too) with the
   marker "[a line naming who is in charge is not shown: it can carry a person's name]". The filter's words gain
   `administrador`, and a bare label may end in "(a)" ("Diretor(a):").
5. **Eval**: new q134 → `city_facilities_search` `{type: "cohab", name: "tatuquara"}`, synthetic fixture
   `test/fixtures/geocuritiba/cohab_synthetic.json`. Tool contract snapshot updated (`type` and `phones`
   descriptions).
6. **Docs and version**: docs/tools.md, docs/sources.md, README row, docs/roadmap-1.0.md, CHANGELOG 0.59.0, version
   0.59.0 in `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no row for this and is
   unchanged.

## Out of scope

Booking, housing applications, the applicant queue (`PretendentesCohab`, avoided), any COHAB or Agenda Online link,
the `site` field, any new host.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: `cohab` resolves with its aliases to
  layer 29; the synthetic Tatuquara agency comes back with address, hours, the landline and the 0800; a "Responsável:"
  line is hidden; regional-office person lines are hidden and the bairros line stays whole; near-miss 0800 shapes are
  dropped; q134 answered.
- `node scripts/eval-summary.mjs`: `answered 130 / 134`.
- `scripts/verify` exits 0 on the PR head; packed size under 252,000 bytes.
