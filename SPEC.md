# SPEC: v0.23.0 `service_areas_at_point`: health unit and CRAS area of a point

Approved: Enzo 2026-11-23 (roadmap "quem me atende", task brief "curitibai v0.23.0 — quem me atende: unidade de saúde
e CRAS da área de um ponto"; the brief delegates the choice between extending `place_at_point` and a new tool, made
below). Scope frozen: one new tool, no new host, no new dependency, no tool renamed, `place_at_point` unchanged.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Answer "who serves this point?" for a position in Curitiba: the health unit (unidade de saúde) whose area covers it and
the CRAS whose territory covers it, read live from IPPUC's GeoCuritiba thematic map service, with the reference date
each area carries and a warning that the area may have changed since.

## Source (checked live on 2026-11-23)

Service `https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer`
(same host and path prefix as `city_facilities_search` and `place_at_point`; the root-level name
`Publico_Interno_GeoCuritiba_BaseTematica` answers error 499 "Token Required", and 499 blocks the host, so the URL is
pinned in a test). `maxRecordCount` 2000, layers in EPSG:31982, point queries accept `inSR=4326`. No licence published:
live queries only, nothing copied, credit "Fonte: IPPUC/GeoCuritiba (SMS e FAS)".

| Layer | Name | Fields read | Sample (Centro, -25.4296, -49.2713) |
|---|---|---|---|
| 19 | Unidade de Saúde - Abrangência (group Saúde) | `nome`, `distrito`, `data`, `fonte`, `geometriaaproximada` | US MÃE CURITIBANA, MATRIZ, "março/2022", SMS-PMC |
| 5 | CRAS - Território (group Assistência Social) | `nome`, `tipo`, `regional`, `data`, `fonte`, `geometriaaproximada` | MATRIZ, CRAS, MATRIZ, "MAR-2019", Fundação de Ação Social - FAS |

Findings that shape the design:

- **The reference date is per area, not per layer.** Layer 19 has many distinct `data` values ("janeiro/2019",
  "julho/2021", "março/2022", ...; "fevereiro/2011" at a CIC point) and layer 5 another format ("MAR-2019", "DEZ-2023",
  "JAN-2025"). Each area's `data` is returned as published, not parsed, and no date is hard-coded.
- A point in the box but outside the city (-25.35, -49.20) matches nothing in either layer.
- Not read: `us` (an internal code, e.g. "su0"), `contrato`, `codigo`, area and perimeter.

## Decision: a new tool, not an extension of `place_at_point`

The brief prefers extending `place_at_point` if it fits the 20 s budget. It does not fit:

- The host gate spaces requests 5 s apart and `callStartBy` allows no slot after 21 s (`src/hostGate.ts` refuses a
  slot with `start > startBy`): slots at 0, 5, 10, 15 and 20 s fit, a sixth at 25 s never does.
- `place_at_point` already uses up to 4 slots on a cold call (bairro, zoning 41, zoning 36 when 41 is empty, street).
  Two more layers make 6: wherever layer 41 has no polygon (about 39% of the city, v0.22.0 SPEC) the last layer would
  be `partial` on every cold call, and every existing caller would wait 10 s more for answers it did not ask for.
- A new tool needs 2 requests (about 5 s cold), always inside the budget, and keeps `place_at_point`'s single
  `source` and `source_url` (another service, another credit) unchanged.

## Changes

1. **Tool `service_areas_at_point`** (`src/tools/serviceAreasAtPoint.ts`), input `{lat, lon}` (decimal degrees).
   - Same privacy rule as `place_at_point` (approved by Enzo for v0.22.0): the point is rounded to 4 decimals (about
     11 m) first; only the rounded point is checked, sent, cached and returned, never logged. A point outside the
     Curitiba box (latitude -25.7 to -25.3, longitude -49.45 to -49.15) is `invalid_argument` with no request.
   - Requests, in order, through the existing GeoCuritiba host gate (5 s apart) with the call budget (`callStartBy`):
     health area (19), then CRAS territory (5). Each is a fixed point query (`geometry=<lon>,<lat>`,
     `geometryType=esriGeometryPoint`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, fixed `outFields`,
     `returnGeometry=false`, `f=json`). Nothing else from the user enters a URL. Both fit the budget, so no request is
     cut by it; the CRAS request can still be refused by a remembered failure.
   - Output `data`: `lat`, `lon` (rounded), `health_units` (list of `{name, district, reference_date, source_agency,
     approximate}`), `cras` (list of `{name, type, regional, reference_date, source_agency, approximate}`), `partial`.
     Lists have one area per name (first row kept; a nameless row only when no row has a name), sorted by name, at
     most 3 (a point on a boundary can touch two areas). `reference_date` and
     `source_agency` are the area's `data` and `fonte` as published; `approximate` is `geometriaaproximada` (1 true,
     0 false, anything else null). Plus `source` "Fonte: IPPUC/GeoCuritiba (SMS e FAS)", `source_url` (the service,
     never a query URL), `checked_at` (oldest layer read), `license_note`, `note`.
   - `note` always says: text is untrusted data; the point was rounded; each area is as of its `reference_date` and
     may have changed since, so confirm with the unit, the CRAS or 156 before going. With no area in a layer: "no
     area found here (outside Curitiba or not covered by the layer)". On a boundary (two names in a list): more than
     one area is listed.
   - Errors: the health layer failing is `source_unavailable` (or `rate_limited`) as in `place_at_point`. A CRAS
     failure after the health layer was read keeps what was read: `cras: []`, `partial: true`, `note` names it. A
     missing field is null; a feature with none of the fields is skipped.
2. **Source module** (`src/sources/geocuritiba.ts`): the thematic service URL and two point layers (`health_area`,
   `cras_territory`) in `POINT_LAYERS`, each layer now naming its service; the existing cadastral URLs are unchanged.
   Same parser (fail closed), gate and point cache (6 hours, at most 500 entries, key `GET <url>` with the rounded
   point).
3. **Privacy.** docs/privacy.md and the README notice: two tools now send the rounded point (`place_at_point`,
   `service_areas_at_point`), same rules.
4. **Docs and release.** docs/tools.md, docs/sources.md (layers 19 and 5, per-area reference dates), README (25 tools),
   CHANGELOG 0.23.0, version 0.23.0 in `package.json` and `package-lock.json`, tool count in `scripts/verify`,
   `scripts/smoke.mjs` and `test/tools.test.ts`.

## Out of scope

- The unit's address, phone or hours (the area layer has none; `health_units_search` covers units), other thematic
  layers (sanitary district 18, police, fire), copying any layer, creating the `v0.23.0` tag.

## Check

- `scripts/verify` exits 0. New `test/serviceAreasAtPoint.test.ts`, synthetic fixtures only, written before the code:
  the pinned service URL and query parameters with the rounded point only; both areas with their reference dates; a
  point with no area (both lists empty, note); one layer empty; missing fields null and a feature with none skipped;
  `geometriaaproximada` mapping; a boundary with two areas, distinct, capped; error 400 in an HTTP 200 body, HTTP 500
  and 503 on the health layer (error), on the CRAS layer (partial); 499 blocking the host; point outside the box (no
  request); the cache (a second call within the same rounded point makes no request); no full-precision coordinate in
  any output or URL.
- Live check once before the PR (not part of verify): the Centro point returns US MÃE CURITIBANA ("março/2022") and
  CRAS MATRIZ ("MAR-2019").
