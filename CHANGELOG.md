# Changelog

Newest first. Current behaviour and its sources are described in [docs/sources.md](docs/sources.md).

## 0.7.0

- Added `places_search`: public places in Curitiba from OpenStreetMap by a fixed category allowlist (park, library, school, hospital, police, fire station, community centre, town hall, bus station, marketplace), optional name words, `limit` ≤ 20 and `offset`. No shops, offices, doctors, dentists or clinics.
- Added `bus_lines`: OpenStreetMap bus route relations in Curitiba (ref, name, from/to, operator, network) with ref/name filters; with `route_id`, one route's stops in order with coordinates. No timetables.
- New host `ovp.dresel.systems` (Overpass API, South America region; robots.txt 404, free, no API key). `overpass-api.de` is not used because its robots.txt disallows `/api/`; `overpass.private.coffee` was down when checked and NextGIS needs an API key. One POST per call, one request at a time, 30 s timeout, 3 MB cap.
- Every OSM result carries "© OpenStreetMap contributors, ODbL" and the OSM data timestamp (`osm3s.timestamp_osm_base`); names and other free text pass through the existing PII masking as a guard.
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
