# Changelog

Newest first. Current behaviour and its sources are described in [docs/sources.md](docs/sources.md).

## 0.8.0

- Added `bus_lines_search`, `bus_line_stops` and `bus_departures`: Curitiba bus lines (search by name or code, accents and case ignored, and category), a line's ordered stops per direction with coordinates, and published departure times by line and/or stop, day code and time window. They read URBS daily exports (`YYYY_MM_DD_linhas.json`, `_pontosLinha.json`, `_tabelaLinha.json`) that the user downloads into `CURITIBAI_DATA_DIR/urbs/`, the newest date of each; no network call. `checked_at` is the file's date; the note warns after 30 days. Results are capped at 50 with paging.
- `bus_departures` returns URBS's DIA code as published plus an inferred `day_type` (1 weekday, 2 Saturday, 3 Sunday or holiday), and says it is inferred.
- Errors as in 0.6: `data_not_available`, `invalid_data` (not UTF-8 JSON, not a non-empty list, more than 5% of the rows invalid, or over 20 MB; the message says how to fall back to the next newest file), `file_not_allowed`, `invalid_argument`. Single invalid rows, including rows missing a field the tool filters or orders by, are skipped and counted in the note and in `data.skipped_rows`. When every timetable row has an empty ADAPT, the note says the accessibility field looks missing or renamed. Stop names pass through the existing masking guard.
- Licence: CC BY 4.0, as linked from the dataset's portal page; `license_note` credits URBS and says what was changed.
- `scripts/check-no-catalog` also fails when git tracks a dated URBS export (`YYYY_MM_DD_*.json` or `.json.xz`); `.gitignore` ignores them.

## 0.7.0

- Added `places_search`: public places in Curitiba from OpenStreetMap by a fixed category allowlist (park, library, school, community centre, town hall, bus station, marketplace), optional name words, `limit` ≤ 20 and `offset`. No shops, offices, doctors, dentists, clinics or hospitals (public health units are in `health_units_search`).
- `places_search` `police` and `fire_station`: served from a list taken once from OSM on 2026-11-21 and bundled (69 police, 10 fire stations; ODbL), with no network call, because the Overpass operator asks that no emergency or safety application depend on it and no other free instance allowed it. Results say "NOT FOR EMERGENCIES" (call 190 or 193) and warn after 180 days.
- New host `ovp.dresel.systems` (Overpass API, South America region; robots.txt 404, free, no API key). `overpass-api.de` is not used because its robots.txt disallows `/api/`; `overpass.private.coffee` was down when checked and NextGIS needs an API key. One POST per call, one request at a time, 30 s timeout, 3 MB cap; after HTTP 429 no request is sent for the Retry-After wait (capped at 1 hour).
- Every OSM result carries "© OpenStreetMap contributors, ODbL" and the OSM data timestamp (`osm3s.timestamp_osm_base`); names and other free text pass through the existing PII masking as a guard, and a `website` the guard would mask is dropped.
- User-Agent is now `curitibai-mcp/0.7` for every host.

## 0.6.0

- Added `city_services_search`: searches the Prefeitura de Curitiba service catalog (Carta de Serviços) by words (accents, case and punctuation ignored), category and online-only, with paging. It reads a local `carta-servicos.json` that the user keeps in `CURITIBAI_DATA_DIR`; the catalog is not shipped or fetched. No network call; the note warns 180 days after the file's capture date.
- New errors `data_not_available` (no data folder or no catalog file) and `invalid_data` (catalog file not UTF-8 JSON, wrong shape, or over 4 MB).
- `city_services_search` never returns links to the obituary system, non-http(s) links or links with credentials; summaries pass through the existing PII masking as a guard.

## 0.5.0

- Added `weather_forecast`: INMET's forecast for Curitiba, up to 5 days, per day and period as published (summary, min/max temperature and humidity, wind, sunrise and sunset).
- Added `weather_alerts`: INMET's active warnings that cover Curitiba (IBGE 4106902), today, upcoming or both, with INMET's text unchanged; says when there is none.
- New host `apiprevmet3.inmet.gov.br` (robots.txt 404); User-Agent `curitibai-mcp/0.5`.
- HTTP: a per-request size cap (1 MB forecast, 6 MB warnings); a body over the cap is `source_unavailable` with a message naming the cap.

## 0.4.4

- Phone masking: "tels", "telef" and "contatos" also count as contact words before a year-pair-shaped phone ("Telef. 2025-2026"); "hotel", "Excel" and "Marcel" stay readable.
- Added this changelog; docs/sources.md now describes only current behaviour.

## 0.4.3

- Phone masking: cel, telefones, whats, zap, fax and ramal also count as contact words, with an optional "." and ":" after the word ("Tel. 2025-2026").
- `detran_pr_info`: when both the year and the 180-day warnings apply, the units note gives one sentence.

## 0.4.2

- Phone masking: a year-pair-shaped phone right after a contact word (tel, fone, telefone, celular, contato, whatsapp) is masked ("tel 2025-2026").
- `detran_pr_info`: the units note warns when the bundled data is more than 180 days old.
- `procurement_search`: the note says when the scan stopped on its 15 s time budget.
- `health_units_search` and `open_datasets_search`: the rate-limit wait message is given in `note` when a later page gets HTTP 429.

## 0.4.1

- Phone masking: a DDD before 8 or 9 glued digits is masked ("41 999998888", "041 33334444"); a leading 0 in the DDD is accepted.
- Phone masking: two year-like groups ("2025 - 2026") with no DDD, "+55" or parentheses before them are kept readable (owner decision).
- `detran_pr_info`: the note now says `past` only means the Anexo I due date has passed, and quotes Portaria 907/2025 Anexo II literally.

## 0.4.0

- Added `detran_pr_info`: bundled 2026 Detran-PR licensing calendar, fee and Curitiba units, each with its source URL and check date.
- `detran_pr_info`: deadlines are marked `past` in Curitiba time and ordered by due date.

## 0.3.0

- Added `procurement_search`: PNCP procurement of Curitiba municipal bodies, with CPF/CNPJ, e-mail and phone masking in the object and no supplier data.
- Object masking hardened: Unicode dashes and invisible characters are normalised, groups may be split by spaces or spaced separators, e-mails may have spaces around "@", and the work is bounded so it stays linear.
- HTTP 429 becomes a `rate_limited` error with the wait time; a PNCP request is retried once after a connection error.
