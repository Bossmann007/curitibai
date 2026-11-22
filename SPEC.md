# SPEC: v0.15.0 `city_facilities_search` (GeoCuritiba / IPPUC)

Approved: Enzo 2026-11-21 (OpenBot card "v0.15 do CuritibAI: equipamentos da cidade (GeoCuritiba)"; "pode aprovar").
Scope frozen.

## Goal

A read-only tool that answers "where is the nearest feira / Rua da Cidadania / ecoponto / library / outdoor gym /
public toilet / park / bike lane, and when is it open" from IPPUC's GeoCuritiba map services.

## Source

- Urban equipment: `https://geocuritiba.ippuc.org.br/server/rest/services/Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer`
  (169 layers, Query, max 2,000 records per query; fields include `func_manha`/`func_tarde`/`func_noite`,
  `observacao`, `telefone`, `email`, `dt_atualiz`, `fonte`).
- Parks and bike lanes: `https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/CICLOVIA_dashboard/FeatureServer`
  (layer 0 bike structure, layer 1 parks and woods).
- robots.txt of the host: 404 (no rules). No licence published: record "no licence found", facts only, cite IPPUC.

## Design

- Tool `city_facilities_search`: `type` (alias map over a curated subset of layer names in Portuguese, plus
  "list types"), optional `bairro`, optional `near` `{lat, lon}` with `radius_m` ≤ 3000, `limit` ≤ 50 (and `offset`).
- Returns name, address, bairro, days/hours as published (`observacao` lines and `func_*` periods), institutional
  phone/e-mail only, `dt_atualiz`, source "IPPUC / GeoCuritiba" with the layer URL, license_note "No licence found;
  facts only; IPPUC cited."
- Host added to `ALLOWED_HOSTS`; `src/http.ts` reused (final refusal, 10-minute per-host block, https only, size cap).
  Cache 6 h per layer query. One upstream request per call (none when cached), never more than 2.
- Rate and failures (review of d688df8): requests to the host are serialized with at least 5 s between them (any
  layer); a call whose turn is more than 10 s away gets `rate_limited` with the wait, without a request. After a
  failure, no request for 60 s, or a 429's `Retry-After` when longer, capped at 1 hour; the same error is returned.
  An ArcGIS `error` with code 401/403/498/499 sent with HTTP 200 is a final refusal (`blockHost` from `src/http.ts`,
  10-minute host block).
- Implementation choice: each layer is read whole with one fixed URL (`where=1=1`, fixed `outFields`, `outSR=4326`)
  and filtered in the server, so user input never reaches the upstream URL or the cache key. All curated layers
  had under 2,000 records on 2026-11-21 (largest 838).
- Privacy: every free-text field goes through the existing mask (`cleanField`, per line), after masking 8 to 11
  digits with no separator (the shared mask needs a separator below 10 digits). The contact fields
  themselves are not masked but filtered by an allowlist, since masking would hide every institutional contact:
  Curitiba landlines and three-digit service numbers are kept, mobiles and anything not understood are dropped;
  only `curitiba.pr.gov.br` e-mail addresses are kept. Fields not listed above are never requested.
  `divulgar_endereco` other than "Sim" drops the address and the position.
- Coordinates in WGS84 (`outSR=4326`); an answer in any other spatial reference fails closed.

## Files

- `src/sources/geocuritiba.ts` (types, URLs, parser, contact filters, cache), `src/tools/cityFacilitiesSearch.ts`,
  `src/tools/index.ts`, `src/config.ts` (host), `src/server.ts` and `package*.json` (0.15.0).
- `test/cityFacilities.test.ts`, `test/fixtures/geocuritiba/*`, `test/setup.ts`, `test/tools.test.ts`,
  `scripts/smoke.mjs`, `scripts/verify` (step label).
- README, docs/sources.md, CHANGELOG 0.15.0.

## Out of scope

Rivers and rain (ANA), fuel prices (ANP), air quality, roadworks, accidents.

## Check

`scripts/verify` exits 0: typecheck, lint, tests (parser on fixtures, alias→layer mapping, bairro filter, distance
filter, refusal handling, mask and contact filters, limits), build, smoke (lists the tool and calls "list types").
