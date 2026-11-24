# 0009. `census_at_point`: a floor of 20 occupied households per figure

Status: Proposed (v0.27.0 brief, 2026-11-24: "aggregate numbers for the sector/neighbourhood of a point only; check
that no field can identify a household"); the floor value is an open owner question in the v0.27.0 PR.

## Context

IPPUC's GeoCuritiba republishes the IBGE 2022 census by sector (BaseTematica layers 43 to 45; 3,190 sectors in
Curitiba). Read on 2026-11-24, the sectors are public aggregates, but some are tiny:

- 21 sectors have fewer than 5 occupied private households (`v0007`); there IBGE publishes no income (`renda_media`
  null). One has `v0007 = 1` and `v0005` (mean residents per household) `= 8.0`: one household's size.
- Income is published from 6 households up (for example 6 households and R$ 3,460).
- 29 sectors have fewer than 20 occupied households, 70 fewer than 50.

A sector of a few households lets a reader who knows the street guess one family's size or income.

## Decision

- Sector figures (residents, households, density, income) are returned only when the sector has at least 20 occupied
  private households (`MIN_HOUSEHOLDS` in `src/tools/censusAtPoint.ts`); below it the answer says
  `sector_withheld: true` and gives none of them.
- Neighbourhood totals (sums of residents, households and area, from one `outStatistics` query) follow the same
  floor. No neighbourhood income: a mean of the sectors' means is not the neighbourhood's mean.
- `v0005`, `v0006` (share of imputed households) and the favela or community name (`nm_fcu`) are never asked for.
- The neighbourhood name in the totals query comes from the sector answer and must be one of the 75 IBGE names
  bundled in `CENSUS_BAIRROS`; any other name sends nothing.

Where it is written: `src/tools/censusAtPoint.ts`, `src/sources/geocuritiba.ts` (`POINT_LAYERS.census_sector`,
`CENSUS_BAIRROS`, `censusBairroUrl`), `test/censusAtPoint.test.ts`, `docs/tools.md`, CHANGELOG 0.27.0.

## Consequences

- 29 sectors (0.9 %) answer without sector figures; the neighbourhood totals still come.
- **Not a protection**, kept and documented: the neighbourhood totals minus the figures of its other sectors give a
  withheld sector's residents and households. Those counts are published by IBGE; the income and household size,
  which the floor is for, cannot be derived that way.
- 20 is a judgement, between ADR 0008's floor of 5 rows and IBGE's own suppression below 5 households; the owner can
  change it in one constant.
