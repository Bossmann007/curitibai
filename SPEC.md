# SPEC: v0.64.0 Work: SINE, Agência do Trabalhador, Liceu de Ofícios, INSS

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Onde tem SINE perto do Pinheirinho?" with the
municipal SINE units IPPUC lists, their address, hours and public contacts as published. Also list the Paraná state
Agência do Trabalhador in Curitiba, the Liceus de Ofícios (the city's free course centres) and the INSS agencies
(Agência da Previdência Social). Places and public contacts only: never a staff member's name or e-mail.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` (urban-equipment) layers 150 "Unidade de
Atendimento SINE" (12 records), 151 "Agência do Trabalhador" (1), 149 "Liceu de Ofícios" (16) and 152 "Agência da
Previdência Social" (4). robots.txt 404 (2026-11-26 23:30:06 UTC, User-Agent `curitibai-mcp/0.64`); the layers'
metadata has empty `copyrightText` and `description`, so no licence found (facts only, IPPUC cited, like the other
GeoCuritiba layers). No new host, no new link. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

What the read showed and how this version handles it:

- **SINE (150)**: ten units in the Ruas da Cidadania, named after the Rua da Cidadania, not the bairro (SINE
  Pinheirinho is in bairro Capão Raso), so the question is answered with `name`, not `bairro`. One record is the SINE
  Móvel, address not published (`divulgar_endereco` "Não": no address, no position), which the layer says moves to a
  different point each day; one is "Economia Popular Solidária", listed in this layer without "SINE" in its name. Every
  unit says no appointment is needed.
- **Agência do Trabalhador (151)**: one record, the Paraná state agency in the Centro, with a landline. Its e-mail is
  not on a city domain and names a person: the e-mail filter drops it, as for every type. The state's own page on
  `www.parana.pr.gov.br` is not fetched or linked (robots `Disallow: /` for GPTBot).
- **Liceu de Ofícios (149)**: 16 centres with hours. One line (Liceu de Ofícios Criativos) is about 330 characters:
  the type wraps long lines at commas (`wrapLines`), so nothing is cut. Its phone is a "WhatsApp (41) …" landline,
  kept since v0.60. The layer also lists the Liceu das Artes (Memorial Paranista).
- **INSS (152)**: four federal agencies with hours; the phone is the 135 service number (kept) and there is no
  e-mail. Benefits and appointments are not in the layer: the note names Meu INSS and the 135 as text, no URL.
- `site` is never read (it points at `www.curitiba.pr.gov.br`, which the server never contacts, and at state and
  federal pages). No person's name in the hours lines of the 33 records; the office person filter is applied anyway.

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same fields, host gate, cache and e-mail allowlist as
   the other urban-equipment layers, each with the office person filter (`HIDE_PERSON`):
   - `sine` (150), aliases `sine municipal`, `sine curitiba`, `unidade do sine`, `unidades do sine`, `unidade de
     atendimento sine`, `unidades de atendimento sine`, `agencia do sine`.
   - `agencia do trabalhador` (151), aliases `agencias do trabalhador`, `agencia do trabalhador de curitiba`.
   - `liceu de oficios` (149), aliases `liceu`, `liceus`, `liceus de oficios`, `liceu de oficio`; `wrapLines`.
   - `inss` (152), aliases `agencia do inss`, `agencias do inss`, `agencia da previdencia social`, `agencias da
     previdencia social`, `previdencia social`.
2. **Notes**: SINE (named after the Rua da Cidadania, search by `name`; when read, no address for the SINE Móvel; Economia
   Popular Solidária is in the layer; vacancies and anyone's registration are not in this tool; the state agency is
   `agencia do trabalhador`); Agência do Trabalhador (state agency; its e-mail is not shown; vacancies are not in this
   tool; the city units are `sine`); Liceu (free courses; enrolment and course lists are not in this tool); INSS
   (lead note: a federal service whose benefits and appointments go through Meu INSS or the 135, not linked; the tool
   lists places and does not book).
3. **Eval**: new q136 → `city_facilities_search` `{type: "sine", name: "pinheirinho"}`, synthetic fixture
   `test/fixtures/geocuritiba/sine_synthetic.json` (bairro unlike the name). Tool contract snapshot updated (`type`
   description).
4. **Docs and version**: docs/tools.md, docs/sources.md, README row, docs/roadmap-1.0.md, CHANGELOG 0.64.0, version
   0.64.0 in `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no row for this and is
   unchanged.

## Out of scope

Job vacancies, course enrolment, INSS benefits or appointments, the `site` field and any page it points at, the
state Agência do Trabalhador page, any new host.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the four types resolve with their
  aliases to layers 150, 151, 149 and 152; the synthetic SINE Pinheirinho comes back by `name` with address, hours,
  landline and city e-mail; a "Responsável:" line is hidden; the SINE Móvel has no address or position; the
  Agência's non-city e-mail is dropped; INSS keeps 135; a Liceu line over 160 characters is wrapped, not cut; q136
  answered.
- `node scripts/eval-summary.mjs`: `answered 132 / 136`.
- `scripts/verify` exits 0 on the PR head; packed size under 252,000 bytes.
