# SPEC: v0.22.0 `place_at_point`: neighbourhood, regional and zoning of a point

Approved: Enzo 2026-11-23 (roadmap "onde fica", task brief "curitibai v0.22.0 — onde fica: bairro, regional e
zoneamento de um ponto"). Scope frozen: one new tool, no new host, no new dependency, no tool renamed.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Answer "where is this point?" for a position in Curitiba: the neighbourhood (bairro), the regional, the zoning (code,
name, law or decree, version date) and the nearest street, read live from IPPUC's GeoCuritiba cadastral map service.

## Source (checked live on 2026-11-23)

Service `https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_GeoCuritiba_MapaCadastral/MapServer`
(the same host and path prefix as `city_facilities_search`; the root-level name `Publico_GeoCuritiba_MapaCadastral`
answers error 499 "Token Required", and 499 blocks the host, so the URL is pinned in a test). No licence published:
live queries only, nothing copied to the `data` branch, credit "Fonte: IPPUC/GeoCuritiba".

| Layer | Name | Used for | Fields read |
|---|---|---|---|
| 2 | Bairro | bairro and regional | `nome`, `nm_regional` |
| 41 | Áreas - Zoneamento (group "Áreas para Empreendimentos em Parceria com a COHAB-CT (Dec. 297 / 2026)") | zoning, first | `sg_zona`, `nm_zona`, `legislacao`, `data_versao` |
| 36 | Zoneamento Lei 15.511/2019 | zoning, when 41 has nothing at the point | same |
| 12 | Logradouro (polyline) | nearest street within 100 m | `gtm_nm_logradouro` |

Deviations from the brief, from what the service showed:

- **Layer 3 (Regional) is not queried.** Layer 2 carries `nm_regional` for each bairro (e.g. "REGIONAL MATRIZ"), and
  layer 3's `sigla` was null at all three test points; skipping it saves one request (the host gate allows one per 5 s).
- **Layer 41 covers about 61% of the city** (266 of 435 km²; 143 polygons against 223 in layer 36). It was empty at 3
  of 9 sample points where layer 36 gave ZS-2, ZI and UC; where both answered, the zone was the same and 41's
  `legislacao` adds "DECRETO Nª 297 / 2026". So 41 is asked first and 36 only when 41 has no polygon at the point.
- Layer 25 (Zoneamento group) answers error 400 to a point query and is not used.

## Changes

1. **Tool `place_at_point`** (`src/tools/placeAtPoint.ts`), input `{lat, lon}` (decimal degrees).
   - A point outside the box already used for GeoCuritiba coordinates (latitude -25.7 to -25.3, longitude -49.45 to
     -49.15) is `invalid_argument` with no request. A point inside the box but with no bairro polygon (a neighbouring
     city) is a normal answer: `inside_curitiba: false`, everything null, no further request.
   - The point is rounded to 4 decimals (about 11 m) before anything else: the rounded value is the only one sent,
     cached and returned.
   - Requests, in order, through the existing GeoCuritiba host gate (5 s apart) with the call budget (`callStartBy`):
     bairro (layer 2), zoning (41, then 36 if empty), street (12). Each is a fixed point query: `geometry=<lon>,<lat>`,
     `geometryType=esriGeometryPoint`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, fixed `outFields`,
     `returnGeometry=false`; the street query adds `distance=100&units=esriSRUnit_Meter`, `returnGeometry=true`,
     `outSR=4326`, `geometryPrecision=6`. Nothing else from the user enters a URL.
   - Output `data`: `lat`, `lon` (rounded), `inside_curitiba`, `bairro`, `regional`, `zoning` (list of
     `{code, name, law, version, layer}`, distinct, at most 5: a point on a boundary can touch two zones),
     `nearest_street` (`{name, distance_m}` or null), `partial`, `boundary` (more than one bairro at the point: the first
     by name is returned). Plus `source` "Fonte: IPPUC/GeoCuritiba", `source_url` (the service, never a query URL),
     `checked_at`, `license_note`, `note`.
   - Errors: the bairro layer failing is `source_unavailable` (or `rate_limited`) as in `city_facilities_search`. A
     failure of the zoning or street layer after the bairro was read keeps what was read: that part null,
     `partial: true`, and `note` names it. A missing field is null; a feature with none of the fields is skipped.
2. **Source module** (`src/sources/geocuritiba.ts`): the service URL, the point query URL builder, a point-query
   parser with the same fail-closed rules as `parseLayer` (error object in an HTTP 200 body, 401/403/498/499 block the
   host, `exceededTransferLimit`, no `features` array, 2,000 records or more; WGS84 checked only when geometry is
   asked), and a cache for point answers: 6 hours, at most 500 entries, key `GET <url>` with the rounded point.
3. **Privacy.** First GeoCuritiba call that sends a position: docs/privacy.md, README privacy notice, the tool
   description and the `TtlCache` comment say that only the rounded point (4 decimals) is sent and cached, nothing is
   logged, and the position is never written anywhere.
4. **Docs and release.** docs/tools.md, docs/sources.md, README (24 tools), CHANGELOG 0.22.0 (also fixes the 0.21.3
   wording "so no count in an answer is 1 to 4" to "no group or filter count is 1 to 4"), version 0.22.0 in
   `package.json` and `package-lock.json`, tool count in `scripts/verify`, `scripts/smoke.mjs` and `test/tools.test.ts`.

## Out of scope

- Address search (text to point), lots and building lines, zoning parameters (heights, coefficients), other layers.
- Copying any GeoCuritiba layer to the repository or the `data` branch.
- Creating the `v0.22.0` tag (the owner tags `main` after the merge).

## Check

- `scripts/verify` exits 0. New `test/placeAtPoint.test.ts`, synthetic fixtures only, written before the code: point
  outside the box (no request), point with no bairro (one request), empty zoning in 41 then 36, missing fields, a
  feature with no fields, error 400 in an HTTP 200 body, HTTP 500, 499 blocking the host, a zoning or street failure
  giving `partial`, the nearest street by distance, the rounded point in the URL and the cache key (a second call
  within 11 m makes no request), and no full-precision coordinate in any output or URL.
- Live check once before the PR (not part of verify): the Centro point returns CENTRO, REGIONAL MATRIZ, ZH-1 and a
  street.
