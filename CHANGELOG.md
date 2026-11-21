# Changelog

Newest first. Current behaviour and its sources are described in [docs/sources.md](docs/sources.md).

## 0.12.0

- Added `vaccination_sites_search`: Curitiba's public vaccination sites from the Prefeitura's "Imuniza Já" page
  (`https://imunizaja.curitiba.pr.gov.br/locaisvacinacao/`, about 100 municipal health units): `name`, `address`,
  `regional`, `hours` and `vaccines` as published, `lat`/`lon` from the page's map link (the link is never returned)
  and `distance_m` with `near`. Optional `text` (name, address/neighbourhood or regional), `vaccine` and `near`
  (nearest first; sites without coordinates are left out and counted); `limit` ≤ 50, `offset`. Output
  `{data, source_url, checked_at, attribution, license_note, note}`; `note` says the fields are untrusted third-party
  text, that the page shows no update date (confirm by phone or 156 before going) and that it is not for emergencies.
- The page is read by known element ids only; every text field is cleaned (control and format characters, NFC), masked
  and capped. A unit that does not fit is skipped and counted (`skipped_units`); no unit or more than 5% skipped is
  `source_unavailable`. One GET per call at most, parsed result cached 6 hours, 1 MB cap, 15 s timeout, HTML only,
  429 is `rate_limited`.
- `imunizaja.curitiba.pr.gov.br` added to `ALLOWED_HOSTS` (robots.txt rechecked 2026-11-21: `/locaisvacinacao/` not
  disallowed). `fetchText` gained `sameHostOnly`, which refuses a redirect to any other host; only this tool uses it.
- docs/sources.md: the full `dadosabertos.c3sl.ufpr.br/curitiba/robots.txt` (Request-rate 1/5, Visit-time 0400-0645
  UTC, `Disallow: /`, `Allow: *.html`; root and `/curitibaurbs/` 404), rechecked 2026-11-21, and the sources evaluated
  and rejected on 2026-11-21 (stale UFPR folders, EstaR and air quality, the garbage collection form, datasets with
  personal-data risk).
- README: a "Compared with the Curitiba App" section (App Store listing, version 4.5.2 of 2026-10-06).

## 0.11.0

- Added `bus_stops_near` ("which buses stop near me"): the URBS stops within `radius_m` (default 400, at most 2000) of
  `near` (`{lat, lon}`, required), nearest first, one item per stop number: `stop_number`, `stop_name` (masked as a
  guard), `lat`, `lon`, `distance_m`, shelter `type` and `lines` (`line_code`, `line_name` from the lines file or null,
  `direction` = SENTIDO, each line and direction once). Optional `line_code` keeps only the stops that line serves (an
  unknown code is `invalid_argument`); `limit` ≤ 50 (default 20) and `offset` page over stops, with `total` and
  `next_offset`. Reads the newest `pontosLinha` and `linhas` files in `CURITIBAI_DATA_DIR/urbs/` with the v0.8 readers
  (newest file, 5% rule, `skipped_rows`, masking, CC BY 4.0 note, renamed-field notes) and the distance of
  `city_points_search`; no network call. `checked_at` is the stops file's date; `note` names the lines file when its
  date differs and says the result is not real-time (timetables via `bus_departures` with the `stop_number`).
- About 50 ms per call (median; the first call in a process about 105 ms) on the real 17,496-row 2026-11-20 stops
  file on an Apple M4. `scripts/verify` now times
  the built tool on 17,496 generated rows and fails above 400 ms; the smoke test calls it over stdio.
- The URBS `license_note` names every file a tool read (one for the other bus tools, unchanged).

## 0.10.1

Fixes so the first real nightly run of `scripts/fetch-events.mjs` can succeed (reviewer follow-ups from PR #25). The
server and `events_search` are unchanged.

- robots.txt: the whole `User-agent: *` group of `turismo.curitiba.pr.gov.br/robots.txt`, fetched once on 2026-11-21,
  is now recorded in the collector and in docs/sources.md (21 directives; 0.10.0 had a truncated Disallow list, so the
  first run would have stopped with `robots_changed`). Every run compares the whole group, order ignored and repeats
  counted: any added, removed or changed directive, `Allow` and `Crawl-delay` included, is `robots_changed`. A recorded
  `Crawl-delay` or `Request-rate` asking for more than 5 s between requests is honoured.
- robots.txt is decoded as Windows-1252 when no charset is declared: the site sends `text/plain` without a charset and
  with Latin-1 comments, which the strict UTF-8 fallback of 0.10.0 would have rejected (`layout_changed`) before any page.
- The run deadline is 30 minutes (was 10); the 05:50 UTC window end still applies. Detail pages read are kept in
  `events/details.json` with `fetched_at`, rewritten atomically after each page, so a run stopped by the deadline, the
  window or an error keeps its progress and the next run reads only the rest. `events.json` is unchanged (no
  `fetched_at`: the tool's schema is strict); the previous `events.json` is no longer used as the detail cache, so the
  first 0.10.1 run reads every detail page again.
- Details are read again when 7 days old or when the event starts on the list date or in the 3 days after it, never
  twice within 20 hours, at the same one request per 5 s. A successful run prunes the cache to the listed ids.
- Exclusive run lock `events/.lock` (created with `wx`, stale after 1 hour): a second run exits 1 with `code=locked`,
  makes no request and changes no file.
- README: how to update the recorded robots.txt rules, and why a day with no events stops with `layout_changed`
  (kept on purpose: the empty list page has never been seen).

## 0.10.0

- Added `events_search`: events in Curitiba from the public calendar of the Instituto Municipal de Turismo
  (`turismo.curitiba.pr.gov.br/eventos/`), read from `CURITIBAI_DATA_DIR/events/events.json`; no network call. Filters:
  `from`/`to` (default today to 7 days ahead, Curitiba time; events overlapping the range), `text` and `category`
  (accents and case ignored), `limit` ≤ 50 and `offset`. Returns `id`, `title`, `start_date`, `end_date`, `time`,
  `place`, `address`, `category` and `link`, with `checked_at`, `stale` (over 3 days), `attribution` and
  `license_note`; `data_not_available` when the file is missing or over 7 days old, `invalid_data` when it fails
  validation (checked with zod on every call; text fields are sanitized again). The description says every field is
  untrusted third-party text.
- Added `scripts/fetch-events.mjs`, a separate collector (Node built-ins only) that writes that file and
  `events/status.json`. Its own host allowlist (the server's `ALLOWED_HOSTS` is unchanged), requests only 02:00–05:50
  UTC, one per 5 s, 15 s timeout, 10-minute deadline, no redirects, stop without retry on any error status, robots.txt
  checked against the recorded rules on every run, two path patterns, size caps, Curitiba dates, details only for new
  ids, only the listed fields kept (link built from id and slug), Unicode control and format characters stripped, NFC,
  120-character title and place, PII mask. Atomic writes; the old file is kept and the exit code is nonzero
  (`layout_changed` or the stop code) when parsing or validation fails, the run is cut short, or the count is 0 or
  outside 0.3x–3x of the previous one. Prints fixed status lines only. The parser is built from one list and one
  detail page and the recorded robots.txt Disallow list may be incomplete: both need a live check (docs/sources.md).
- The PII mask moved from `src/sources/pncp.ts` to `src/mask.ts` (no imports, so the collector can load it); `pncp.ts`
  re-exports it, and behaviour is unchanged.
- `scripts/check-no-catalog` also fails when git tracks a file in a folder named `events` or an `.html`, `.htm`,
  `.mhtml` or `.har` file outside `test/fixtures/`; `.gitignore` ignores them.
- README: the server still writes no files; only the collector writes, inside `CURITIBAI_DATA_DIR/events/`.

## 0.9.1

- `city_points_search`: with no filter, each entry of `categories` now gives `source_categories` as `{name, count}` per URBS name instead of a list of names (a change of output shape for clients that read the names as strings), so a rename of one URBS name of a category shows as a 0 there. Such a partial rename is still not warned about in `note` (only a whole category id with no row is); README and docs/sources.md now say so (renaming BIB FAROL DO SABER would drop 45 of the 59 libraries in the 2026-11-20 file). The mixed-category line in `note` names only the categories among the matches (`cultural_space`, `special_education`, `vocational_education`).
- Bus tools: the missing-or-renamed field note says the empty or null values "may not come from URBS" (was "do not").
- Node.js: `engines` is now `>=26.13.1`, the version CI tests (`.nvmrc`); it was `>=22.12`, which no job tested. This narrows the stated support in a patch release.
- CI: added `.github/dependabot.yml` (weekly npm and GitHub Actions updates, at most 3 and 2 open PRs). Corrected the workflow and README comments: CI skips `npm audit` because it adds noise to unrelated runs, not for lack of network (0.8.2 said the latter), and a queued run on `main` is replaced by a newer push, so not every push to `main` runs.

## 0.9.0

- Added `city_points_search`: points of interest open to the public in Curitiba from URBS's points-of-interest export (`YYYY_MM_DD_pois.json`), which the user downloads into `CURITIBAI_DATA_DIR/urbs/` like the bus files; no network call. Filters: `category` (23 ids such as `feira`, `cambio_verde`, `library`, `cmei`, `municipal_school`, `bus_terminal`, `health_unit`), words in `name` (accents and case ignored), and `near` `{lat, lon}` with `radius_m` (default 1500, at most 10000), which sorts by distance and returns `distance_m`. `limit` ≤ 50 and `offset`; with no filter it lists the categories with counts. Same envelope, errors, 5% rule, `skipped_rows`, fallback hint and CC BY 4.0 `license_note` as the bus tools; `checked_at` is the file's date.
- Only an allowlist of categories is returned (mapping in docs/sources.md). Private schools and crèches, hotels, churches, supermarkets and markets, shopping centres, private clubs, newsstands, hospitals, laboratories, police and security, urban equipment and any unknown category are dropped when the file is read, before any search or count. `cultural_space`, `special_education` and `vocational_education` are open to the public but not necessarily public: they may include private or non-profit institutions (commercial cinemas, private theatres and museums, private schools), and `note` says so when any match is in one of them. When a whole category id has no row in the file, `note` says its URBS names look missing or renamed. Names and descriptions pass through the existing masking guard. `note` says the file has no days or hours (feiras included) and that the tool is not for emergencies.
- `scripts/check-no-catalog` and `.gitignore` already covered `YYYY_MM_DD_pois.json`; the comments and tests now name it.

## 0.8.2

- Bus tools: when a descriptive field is empty (or whitespace, null or absent) in every valid row of the file, `note` says the field looks missing or renamed and names the result field it feeds (`NOME_COR` → `color`, `SOMENTE_CARTAO` → `card_only`, `NOME` → `name`, `TIPO` → `type`, `GRUPO` → `group`, `PONTO` → `stop_name`, `TABELA` → `table`). The check covers the whole file, not only the rows returned. `ADAPT` keeps its 0.8.0 accessibility note.
- CI: `.github/workflows/verify.yml` runs `scripts/verify` on pull requests and on pushes to `main` (Ubuntu, Node 26.13.1 from the new `.nvmrc`, actions pinned by commit SHA, `contents: read`, no secrets, 10-minute timeout, older runs of the same ref cancelled).
- `scripts/verify`: `CURITIBAI_SKIP_AUDIT=1` skips the separate `npm audit` step (CI sets it, so `npm ci` is the only network use).

## 0.8.1

- `places_search` `police`: the result `note` and the tool description say the category is as tagged in OSM and includes Guarda Municipal, identification institutes and some non-police offices. The bundled list is unchanged.
- Licence: `package.json` `license` is now `(Apache-2.0 AND ODbL-1.0)`; `LICENSE`, the README and the `src/sources/osmBundled.ts` header point to the ODbL 1.0 text (<https://opendatacommons.org/licenses/odbl/1-0/>) for the bundled OSM list.
- Docs: corrected why police and fire stations are bundled, in the code comment and the README: `overpass.private.coffee` allowed that use but was not reachable (0.7.0 said no other free instance allowed it).

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
