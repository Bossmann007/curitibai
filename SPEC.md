# SPEC: v0.29.0 bus stops from GeoCuritiba when there is no URBS export

Approved: Enzo 2026-11-24 (task brief "curitibai v0.29.0": "segue com o curitibaai"; vision: everything a Curitiba
citizen needs inside their own AI). **This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

"Which bus stops are near me" works for a citizen who has not downloaded the URBS export, without weakening the
answer for one who has. Implements the proposal in PR #38 (v0.27.0), section "URBS layers on GeoCuritiba".

## Changes

1. **`bus_stops_near` fallback** (`src/tools/busStopsNear.ts`, `src/sources/geocuritiba.ts`). When loading the newest
   `pontosLinha` fails because there is no such file or no `CURITIBAI_DATA_DIR` (`isMissingUrbsFile`), the tool reads
   the GeoCuritiba layer `GeoCuritiba/URBS_Transporte_Publico/MapServer/1` (stops): fixed queries
   (`outFields=num,nome_ponto,tipo`, WGS84, ordered by `objectid`, `resultOffset` in steps of 2,000), at most 5 pages
   (4 needed on 2026-11-24), read one after another through the shared GeoCuritiba host gate (5 s between requests)
   with the call's 20 s start budget (`callStartBy`), each page cached 6 hours by its URL. Fails closed on a short page
   with `exceededTransferLimit`, a fifth page still full, an `error` object, a spatial reference other than 4326, or
   non-JSON; never answers from part of the layer. Records without a positive integer `num`, a name or a position in
   the Curitiba box are skipped and counted; a repeated `num` keeps its first record. The position is filtered in the
   server, never sent. Layer 0 (terminals, `indfiscal`) is never read. `line_code` without the export:
   `data_not_available`, no request.
2. **When the export exists** the answer is unchanged (lines per stop from the export). An invalid or not allowed stops
   file keeps its error; no fallback from it.
3. **Output** (contract change, on purpose): `data.source` = `urbs_export` | `geocuritiba_layer`; `lines` nullable
   (null from the layer). From the layer, `source_url` is the layer URL, `checked_at` the day it was read, and `note`
   says which source answered and that the layer publishes no update date (freshness not provable). `openWorldHint`
   true. Description within the size guard (each ≤ 400 characters, sum ≤ 9,600; now 9,593).
4. **`city_service_guide` hardening**: `cartaFor` passes each match's `official_url` through `allowedUrl` and drops the
   match when it returns null, before status, count and links; matches carry the normalized URL.
5. **Docs and version**: docs/tools.md (bus tools, Curitiba App "Transport information" row), docs/sources.md (robots
   and sample request re-checked 2026-11-24, live counts), docs/local-data.md, docs/privacy.md, README, CHANGELOG
   0.29.0, version 0.29.0 in `package.json`, `package-lock.json` and `server.json`, this SPEC.

## Out of scope

Lines per stop, timetables or itineraries from GeoCuritiba (the layers have no timetable, stop order or direction);
`next_buses_near`, `bus_line_stops` and `bus_departures` (still export only); layer 0 and layer 2; publishing; tags.

## Check

- `test/busStopsNear.test.ts`: without the export, pages read once in order with fixed URLs (no position, only the
  three fields), dedupe, skipped records, masked names, `source`, `lines` null, the no-update-date note, cache reuse;
  `line_code` without the export makes no request; short page cut and too many pages fail closed; a budget-stopped call
  resumes from cached pages; with the export the answer keeps `urbs_export` and lines; an invalid stops file keeps
  `invalid_data`.
- `test/cityServiceGuide.test.ts`: a hand-built catalog with `https://evil.example/phish` and `javascript:alert(1)`
  gives neither URL anywhere in the output (fails without the change).
- `test/contracts.test.ts` snapshot and size guard; `scripts/smoke.mjs` checks `source: "urbs_export"`.
- Live run of the built server with and without the owner's export (docs/sources.md).
- `scripts/verify` exits 0.
