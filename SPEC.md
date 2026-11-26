# SPEC: v0.58.0 Rodoferroviária and administrações regionais

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Qual o endereço e o horário da Rodoferroviária de
Curitiba?" with the Terminal Rodoviário IPPUC lists, its address, hours and landlines as published. Also list the
Terminal Ferroviário (the rail side of the same complex) and the ten Administrações Regionais. The tool lists places
only: it never gives a bus or train departure time, a platform, a fare or a ticket.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` (urban-equipment) layers 159 "Terminal
Rodoviário" (1 record), 160 "Terminal Ferroviário" (1) and 15 "Administração Regional" (10). robots.txt 404
(19:43:20 UTC); the layers' metadata has empty `copyrightText` and `description`, so no licence found (facts only,
IPPUC cited, like the other GeoCuritiba layers). No new host. No new link: the `rodoviaria` note reuses the URBS home
page link that the bus tools already return. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

What the read showed and how this version handles it:

- Hours are published for all 12 records (the queue's "hours may not be published" did not happen). The Rodoviária
  publishes administrative hours (daily 6h to 24h) and operational hours (daily 0h to 24h): the terminal's hours, not
  departures. The note says so.
- The Ferroviária's hours are split into "alta temporada" and "baixa temporada" with no dates, and its e-mail is at
  `serraverdeexpress.com.br`, a private train operator's domain (dropped by the unchanged e-mail filter). The note says
  the layer does not say which season applies and that train times and tickets are not in this tool.
- Each Administração Regional lists general and protocolo hours, a "-Telefone: …" protocolo line (masked by the
  unchanged free-text phone mask; in at least one live record that number is not in `telefone`, so the note says
  it may not be in `phones`) and a "Bairros de
  abrangência" line; two of those lines are over 160 characters: `wrapLines`.
- No person's name, mobile or personal e-mail in the 12 records.

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers:
   - `rodoviaria` (159), aliases `rodoferroviaria`, `rodoviaria de curitiba`, `rodoferroviaria de curitiba`,
     `terminal rodoviario`, `terminal rodoviario de curitiba`;
   - `ferroviaria` (160), aliases `terminal ferroviario`, `terminal ferroviario de curitiba`, `estacao ferroviaria`;
   - `administracao regional` (15), aliases `administracoes regionais`, `administracao regional de curitiba`,
     `sede da regional`. No bare `regional`, `terminal` (already the urban bus terminals) or `trem`.
2. **Notes**: `rodoviaria`: the hours are the terminal's, as published, not departures; intercity and interstate
   departures, platforms and fares are not in this tool (ask the bus company or the terminal, or see
   https://www.urbs.curitiba.pr.gov.br/); the rail side is type `ferroviaria`; city buses to it: `bus_route_between`.
   `ferroviaria`: hours as published by season, the layer does not say which season applies, its e-mail is
   the train operator's and not shown, no train times or tickets. `administracao regional`: one per regional, hours
   and the bairros each serves as published, `bairro` filters by where the office is, a phone inside `hours` is masked
   and may not be in `phones` (call the office or the 156), for a point's regional `place_at_point`.
3. **Eval**: new q133 "Qual o endereço e o horário da Rodoferroviária de Curitiba?" → `city_facilities_search`
   `{type: "rodoferroviaria"}`, synthetic fixture `test/fixtures/geocuritiba/rodoviaria_synthetic.json`. Tool
   contract snapshot updated (the `type` description).
4. **Docs and version**: docs/tools.md (reference row and "Which place tool"), docs/sources.md, README row,
   docs/roadmap-1.0.md, CHANGELOG 0.58.0, version 0.58.0 in `package.json`, `package-lock.json`, `server.json`. The
   Curitiba App table has no row for these and is unchanged.

## Out of scope

Bus or train departure times, platforms, fares or tickets (never fetched; no realtime ever); which regional covers an
address beyond what `place_at_point` already says; unmasking phones in `hours`; any new host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the three types resolve with their
  aliases to layers 159, 160 and 15; the synthetic records come back with address, hours and landlines, the operator's
  e-mail dropped and a long bairro line split; the notes say no departures; q133 answered.
- `node scripts/eval-summary.mjs`: `answered 129 / 133`.
- `scripts/verify` exits 0 on the PR head; packed size under 252,000 bytes.
