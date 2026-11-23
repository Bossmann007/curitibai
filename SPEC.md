# SPEC: v0.24.0 sport, leisure and conservation units in `city_facilities_search`

Approved: Enzo 2026-11-23 (roadmap "esporte, lazer e unidades de conservação", task brief "curitibai v0.24.0 — esporte,
lazer e unidades de conservação"; the brief prefers new `type` values over a new tool and delegates the layer choice,
made below after reading the layers). Scope frozen: new types in `city_facilities_search`, `inside_curitiba` in
`service_areas_at_point`, no new tool, no new host, no new dependency, no tool renamed, no existing type changed.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Find Curitiba's public sport and leisure units (SMELJ) and conservation units (SMMA) with `city_facilities_search`,
read live from IPPUC's GeoCuritiba, and close the Low finding of the v0.23.0 review: `service_areas_at_point` says
whether the point is inside Curitiba as a boolean, like `place_at_point`.

## Source (checked live on 2026-11-23, at most one request every 5 s)

Same host (`geocuritiba.ippuc.org.br`), no licence published: live queries only, nothing copied to the `data` branch.

**Sport and leisure.** The brief names `GeoCuritiba/Publico_GeoCuritiba_Equipamentos_Urbanos_SMELJ/MapServer`: one
point layer (0, "Esporte e Lazer e Juventude", 372 records, `dt_atualiz` 2022-12-07 to 2026-09-09, all
`conveniado` "Não", phones mostly "156", e-mails all at curitiba.pr.gov.br). It has **no `divulgar_endereco`** field,
the publisher's flag that decides whether an address may be shown. The same records, by `tipo_equi`, are published
as separate layers of the service the tool already reads (`Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer`, group
83 "Esporte e Lazer"), with that flag ("Sim" on every record). Counts match one to one:

| Layer | Name | Records | `dt_atualiz` range |
|---|---|---|---|
| 84 | Núcleo Regional do Esporte, Lazer e Juventude | 10 | 2025-10-13 to 2025-11-18 |
| 87 | Centro de Atividade Física | 2 | 2024-01-04 |
| 88 | Centro da Juventude | 2 | 2025-11-05 |
| 89 | Centro de Iniciação ao Esporte | 2 | 2024-01-04 to 2024-02-05 |
| 90 | Centro de Referência em Esporte e Atividade Física | 2 | 2024-02-09 to 2024-07-10 |
| 93 | Pista de Ciclismo BMX | 1 | 2024-01-04 |
| 94 | Centro de Lutas | 1 | 2025-11-05 |
| 165 | Pista de Patinação | 1 | 2024-01-04 |
| 166 | Velódromo | 1 | 2025-05-20 |

Already types since v0.19.0: 85 Clube da Gente, 86 Centro de Esporte e Lazer, 91 Academia ao Ar Livre, 92 Pista de
Skate (SMELJ layer 0 has 5, 25, 284 and 36 of them). The reference date is per record (`dt_atualiz`, returned as
`updated`), as for every equipment layer. Text read: names, addresses, hours ("Atendimento: 2ª a 6ª feira ..."),
activities, institutional phones and e-mails; no person's contact was seen.

**Conservation units.** `GeoCuritiba/Publico_Sistema_Municipal_de_Unidades_de_Conservacao/FeatureServer` (Lei
Municipal 15.744/2020 and 15.977/2022 in its description), polygon layers 1 to 8, 10 and 11, `maxRecordCount` 2000,
`returnCentroid` works with `outSR=4326`. The layers carry `ctba_bairro`, `ctba_regional`,
`ctba_tipounidprotinteg_smuc` and `areaoficial` with the same coded domains as the `parque` layer (CICLOVIA_dashboard
1). **No reference date is published**: no update field, `editingInfo` is null. `updated` is null and the note says so.

| Layer | Name | Records | Decision |
|---|---|---|---|
| 1 | Estação Ecológica | 2 | new type |
| 2 | Parque Natural Municipal | 32 | already in `parque` |
| 3 | Parque Linear | 1 | already in `parque` |
| 4 | Bosque Municipal | 18 | already in `parque` |
| 5 | Bosque de Conservação da Biodiversidade Urbana | 8 | new type |
| 6 | Refúgio da Vida Silvestre | 1 | new type |
| 7 | Reserva Particular do Patrimônio Natural Municipal | 67 | **left out: personal data** |
| 8 | Específicas (Jardim Botânico, Zoológico) | 2 | already in `parque` |
| 10 | Área de Proteção Ambiental | 2 | left out |
| 11 | Área de Relevante Interesse Ecológico | 1 | left out |

- `parque` (53 records: kinds 2:32, 6:18, 10:2, 4:1) holds exactly layers 2, 4, 8 and 3; repeating them as types
  would return the same places twice.
- **RPPNM (7) is left out.** 65 of 67 are private property (`administracao` 6 "Privada"), many are named after people
  (owners or relatives), and `ctba_localizacao` is the street address of the private lot. Name plus position of a
  private lot is personal data; the brief says to leave such a layer out.
- **APA (10) and ARIE (11) are left out.** They lack `ctba_bairro`, `ctba_regional` and the kind field (asking for
  them is error 400), and an APA covers thousands of hectares: its centroid gives a meaningless `near` distance.

## Changes

1. **Sport types** (`src/sources/geocuritiba.ts`), plain `equipment(...)` entries on the existing service, same fields,
   same address flag, same contact allowlist (Curitiba landlines and 3-digit service numbers; curitiba.pr.gov.br
   e-mails; anything else dropped): `nucleo regional do esporte` (84), `centro de atividade fisica` (87),
   `centro da juventude` (88), `centro de iniciacao ao esporte` (89), `centro de referencia em esporte` (90),
   `pista de bmx` (93), `centro de lutas` (94), `pista de patinacao` (165), `velodromo` (166), with plural and long-name
   aliases. Credit "Fonte: IPPUC/GeoCuritiba (SMELJ / SMMA)".
2. **Conservation types**, `kind: "park"` on the conservation FeatureServer (same fields, parser and centroid as
   `parque`): `estacao ecologica` (1), `bosque de conservacao` (5, alias `bcbu`), `refugio da vida silvestre` (6).
   Same credit. Note: a conservation unit is a protected area, not always open to visits; no update date is published.
3. **Per-type credit and note.** `FacilityType` gets optional `credit` and `note`; `source` is `credit` when set, else
   the current "IPPUC / GeoCuritiba" (existing types unchanged). Types and aliases stay unique (tested).
4. **`service_areas_at_point.inside_curitiba`** (boolean). The health area (19) is asked first, as before: a health
   unit area at the point means inside (the areas are Curitiba's own units). Only when it has none is the bairro
   layer asked (cadastral layer 2, the same point query and cache as `place_at_point`): inside when it names a
   neighbourhood or regional, as `place_at_point` decides. Outside, the CRAS layer is not asked. Cost: 2 requests in
   the common case, as in v0.23.0 (a first draft asked the bairro layer first, always 3 requests: the review found
   two concurrent cold calls then pushed the CRAS slot past the 20 s budget, and a gap in the bairro layer would hide
   a health area); 3 when no health area contains the point. The health or bairro layer failing is the call's error;
   a CRAS failure stays `partial`. `source` and `source_url` stay the thematic service; the outside note names the
   cadastral map.
5. **Docs and release.** docs/tools.md, docs/sources.md (layers, decisions above), README if it lists types,
   CHANGELOG 0.24.0, version 0.24.0 in `package.json` and `package-lock.json`.

## Out of scope

- Moving the four existing sport types to the SMELJ service, the SMELJ layer itself, an umbrella "esporte" type,
  RPPNM, APA and ARIE, the units' creation year or legal act (`anocriacao`, `atolegal`), copying any layer, creating
  the `v0.24.0` tag.

## Check

- `scripts/verify` exits 0. Tests first, synthetic fixtures only (invented names, real field shapes):
  - every new type resolves from its name and aliases to its pinned layer URL; ids and aliases stay unique;
  - a sport layer: address and position shown with `divulgar_endereco` "Sim", hidden otherwise; a mobile and a
    malformed e-mail (`@.curitiba.pr.gov.br`) dropped; `updated` from `dt_atualiz`; the SMELJ / SMMA credit;
  - a conservation layer: centroid, coded bairro and kind, `updated` null, the credit and the conservation note;
    existing types keep "IPPUC / GeoCuritiba";
  - `service_areas_at_point`: health then CRAS when a health area exists (bairro never asked); no health area: bairro
    decides, false with no CRAS request, true then CRAS; bairro failure is an error; a 499 on either layer blocks the
    host; the bairro answer cached by `place_at_point` makes no new request.
- Live check once before the PR (not part of verify): `velodromo` returns one record; `estacao ecologica` two;
  `service_areas_at_point` at Centro returns `inside_curitiba` true.
