# Changelog

Newest first. Current behaviour and its sources are described in [docs/sources.md](docs/sources.md).

## 0.18.2 - 2026-11-22

The two Low findings left by the v0.18.1 review. No new tool, no new host.

- `river_levels`: when the host gate refuses a station in the middle of a call (`rate_limited`), the stations already
  read in that call, or found in the cache, are returned with `partial: true` and a note naming the wait (refused
  stations first in `more_matches`), as for the time budget. `rate_limited` is returned only when no station is
  available. Before, the call returned `rate_limited` and dropped what it had read (with 3 concurrent calls one got
  nothing; with 8, six did). Tests with fake timers for 3 and 8 concurrent calls and for a cached station.
- `guaira_events`: the listing (title, dates, city, link) is the complete answer and event-page details (venue, age
  rating, price) an optional enrichment. `partial: true` now means only that listing pages are missing (`truncated`),
  so a cold call is no longer always partial. Items whose event page was not read yet (time budget, the 2-page cap
  per call, a refusal) are counted in the new `details_pending` field, with a note to call again for venue and
  price. The 5 s gate, the caches and the 20 s budget are unchanged.

## 0.18.1 - 2026-11-22

Robustness fixes for the open Low findings of the last code reviews. No new tool, no new host.

- `river_levels`: an HTTP 200 answer that is not ANA's XML document (a non-XML content type, invalid or truncated
  XML, an HTML maintenance, WAF or CAPTCHA page) is now a host failure inside the host gate: the call fails with
  `source_unavailable` and the host is not asked again for 60 s (before, the station was shown `unavailable` and
  every call asked again). A page with CAPTCHA or challenge markers blocks the host for 10 minutes, as the other
  sources do. A station whose XML content cannot be read stays `unavailable` for that station only and is not asked
  again for 60 s; other stations are still read.
- `guaira_events`: the event-page details cache is capped at 500 entries; expired entries are swept and the oldest
  evicted on insert (it was an unbounded map).
- `useful_phones`: the nightly workflow now also publishes `phones/status.json` (`scripts/publish-data.sh`), and
  `useful_phones` reads it from the same copy as the phones (a local file never makes a request; a third fixed URL
  on `raw.githubusercontent.com` otherwise). When the last phones run failed, the note names its `code` (and HTTP
  status), unless that attempt is older than the numbers. The status file has a strict schema; a missing or invalid
  one adds nothing and never fails the answer. Its failures are remembered for that file only (3 s timeout), except
  a 429 or a final refusal, which stay host failures so a Retry-After is kept.
- `river_levels` and `guaira_events`: per-call time budget of 20 s (plus 1 s of slack, because slots are planned from
  the call's first request, which starts a few ms after the call). No request starts after it; what is ready is
  returned with a new output field `partial: true` and a note (`river_levels`: stations not read come first in
  `more_matches`; `guaira_events`: event pages stay `details: "not_read"`). A request already started is never cut,
  and the Guaíra listing load is never cut, so the bound is 21 s plus one request's timeout (10 s ANA, 15 s Guaíra).
  A call that joins another call's in-flight load (an ANA station, the Guaíra robots.txt) which ran out of that
  call's budget asks again under its own.
  A cold `guaira_events` call now takes about 20 s and reads one event page instead of two (about 25 s before).
- Docs: README, docs/sources.md, SECURITY.md, SPEC.md (v0.18.1 changes).

## 0.18.0 - 2026-11-22

Events and useful phones update themselves (owner request, 2026-11-22: "era pra ele pegar automático"; only if free).
New host for the server: `raw.githubusercontent.com` (two fixed files of this repository's `data` branch; robots.txt
404, checked 2026-11-22).

- New workflow `.github/workflows/collect.yml`: every night at 02:37 UTC (inside the Turismo site's robots.txt
  `Visit-time`) and on `workflow_dispatch`, on `ubuntu-latest` only (standard runner, free in public repositories),
  35-minute timeout (above the collector's 30-minute deadline), never two runs at once, `contents: write` for this job only, actions pinned by commit SHA, only
  on `Bossmann007/curitibai` `main`. It runs `scripts/publish-data.sh`: the previous files from the `data` branch go
  into a temporary `CURITIBAI_DATA_DIR`, `scripts/fetch-events.mjs` runs once unchanged (same robots.txt, window
  and 5 s rules, no retry), and only `events/events.json`, `events/status.json` and `phones/phones.json` are
  committed to the orphan branch `data` (never `main`, no force push); the commit is skipped when none changed (rare:
  `status.json` records every attempt). A failed run keeps the
  previous files, changes only `events/status.json` and ends red. The first run after merge creates the branch.
- `events_search` and `useful_phones`: the local file in `CURITIBAI_DATA_DIR` first (as before, errors included);
  else the published copy over HTTPS (fixed URLs, cached 1 hour, 2 MB / 512 KB caps, same strict schemas, fail
  closed, host gate with 60 s failure memory; HTTP 404 before the first run is `data_not_available`).
  `CURITIBAI_REMOTE_DATA=0` (or `off`) turns remote reading off. New errors for these tools: `source_unavailable`
  and `rate_limited` (published copy unreadable). `openWorldHint` is now true for both.
- `useful_phones` output gains `checked_at` (same value as `fetched_at`, kept) and `stale` (true after 3 days), and
  refuses a `checked_at` in the future (`invalid_data`), as `events_search` does. Both
  tools' notes say which copy answered; a stale published copy adds that the nightly collection may have stopped.
- Docs: README (how updating works, the public `data` branch holds facts and links only, GitHub's 60-day rule for
  scheduled workflows and how to re-enable, delayed or dropped runs, the opt-out, ten hosts), docs/sources.md,
  SECURITY.md, SPEC.md for this release. Tests: remote read path, local-first precedence, schema fail-closed, cache,
  stale, opt-out, and a check that workflows use only `ubuntu-latest` and SHA-pinned actions; the smoke test runs with
  `CURITIBAI_REMOTE_DATA=0` and also calls `useful_phones` and `events_search`.

## 0.17.0 - 2026-11-22

New tool `guaira_events`: the live public calendar of the Centro Cultural Teatro Guaíra (new host
`www.teatroguaira.pr.gov.br`; robots.txt `User-agent: *` allows `/calendario-eventos` and `/Evento/`, no crawl delay,
checked 2026-11-22; no licence found, facts and links only, Teatro Guaíra / Governo do Paraná cited, owner approval
2026-11-22).

- Input: optional `from`/`to` (default today to 30 days ahead, Curitiba time; at most 366 days), optional `text`
  (words in the title), optional `city` (default `Curitiba`, so the Cascavel tour dates are left out; `all` keeps
  every city), `limit` ≤ 50 and `offset`. Events overlapping the range, earliest first.
- Returns `title`, `start`, `end` (Curitiba local time, as listed), `city`, `state`, `link` (event page), and
  `venue`, `age_rating`, `price` read strictly from event pages (null when not read or not in a known shape; a known
  prefix followed by other text is null, never a part), with
  `details` saying which; `other_city_rows` and `truncated`. The listing's `Local` is the city, not the venue, so the
  venue needs the event page: at most 2 new event pages per call, items of the returned page only, cached 6 hours.
  Cast, directors and programme are never read.
- Requests: robots.txt first (cached 24 h; the tool stops if the calendar becomes disallowed, and reads no event page
  if `/Evento/` does), then up to 3 listing pages at fixed URLs, the whole listing cached 1 hour. At most one
  request per 5 s to the host (a request that would wait over 10 s is not made), no request for 60 s after a failure
  (a 429's Retry-After when longer, at most 1 hour), a 10-minute host block on 401/403 or a CAPTCHA (also a 200 challenge page that does not parse); never retried. A
  removed event page (404/410) is `unavailable` for that event only, without a host failure.
  A cold call makes up to 6 requests and can take about 25 s.
- Uses the shared host gate `src/hostGate.ts` from 0.16.0, which gains an optional `refusalWaitMs` (a final
  refusal remembered for the 10-minute host block; only this host sets it) and `failing()`. A 200 answer that is not
  a page of the site (a WAF or CAPTCHA page) fails inside `gate.run`, so the 60 s failure memory applies.
- New error code `layout_changed`: the listing's HTML no longer has the expected cards, dates, city or pager; nothing
  is returned.
- Docs: README (tool tables, 22 tools, hosts, licences, fixtures), docs/sources.md (robots.txt group, fields, limits,
  requests made), SPEC.md for this release (records why venue comes from event pages).

## 0.16.1 - 2026-11-22

`river_levels` is honest about data quality (owner request, 2026-11-22). No new request, no new host.

- Each station has `quality` (`ok`, `suspect`, `unknown`) and `quality_reasons`, computed only from the readings of
  the 24 h ending at the latest one that were already read. Checks: `out_of_range` (negative level, flow or rain, or
  rain over 150 mm in one reading), `level_spike` (a level jump over 100 cm in 15 minutes that comes back within an
  hour), `level_jump_unconfirmed` (that jump in the last hour, not back yet), `level_stuck` (level identical for 6 h or more
  while 10 mm or more of rain fell). `unknown` without readings or with under 8 readings (`too_few_readings`). Raw
  values are never hidden or changed; `stale` stays a separate flag.
- When a station is suspect, the note names it and says to treat its values with caution. The general note now says
  the readings are unchecked telemetry, that `quality` cannot prove a value is right, and that official flood alerts
  come from Defesa Civil and INMET (`weather_alerts`).
- Docs: a "`river_levels` data quality" section in the README, the same in short in docs/sources.md, SPEC.md
  addendum.

## 0.16.0 - 2026-11-22

New tool `river_levels` over ANA's public telemetry web service (new host `telemetriaws1.ana.gov.br`, robots.txt 404
on 2026-11-22; no licence found, facts only, ANA cited; owner approval 2026-11-22).

- Optional `station` (code, or text in the station name, river or municipality) and `near` (default Curitiba
  centre). Returns up to 3 of the 25 bundled IAT-PR stations around Curitiba, nearest first: code, name, river,
  municipality, position, latest reading time (Curitiba time), level (cm), flow (m³/s), rain of the latest reading and
  the sums over the last 1 h and 24 h, `stale` when the reading is older than 2 h, and `no_recent_data` for stations
  that sent nothing or `unavailable` when a station's answer cannot be read (never invented values). Without
  `station`, river stations come before rain gauges. Note: "Not for emergencies: Defesa Civil 199."
- The station list is bundled (built once on 2026-11-22 from `ListaEstacoesTelemetricas`), never downloaded at
  runtime. Only bundled codes and dates reach ANA.
- https is used: ANA documents plain http, but https answered with a valid certificate on 2026-11-22.
- Network: at least 5 s between request starts to the host, 15-minute cache per station, failures remembered 60 s to
  1 hour, 10-minute host block on 401/403/CAPTCHA, at most 3 stations per call. The GeoCuritiba gate moved to
  `src/hostGate.ts` and is shared (no behaviour change). The XML parser fails closed on anything unexpected (that
  station is `unavailable`; a transfer or host failure fails the call).
- Docs: README (21 tools, ten network tools, eight hosts), docs/sources.md (host, robots, licence, fields, limits,
  how the station list was built), SPEC.md for this release.

## 0.15.0 - 2026-11-22

New tool `city_facilities_search` over IPPUC's GeoCuritiba map services (new host `geocuritiba.ippuc.org.br`,
robots.txt 404 on 2026-11-21; no licence found, facts only, IPPUC cited).

- `type`: a curated subset of 26 layers named in Portuguese (feira, rua da cidadania, ecoponto, ecocidadão, câmbio
  verde, biblioteca, farol do saber, academia ao ar livre, banheiro público, cemitério, CRAS, parque, ciclovia and
  more), accents and case ignored, with aliases; `list types` returns them with no network call. Optional `bairro`,
  `near` with `radius_m` (at most 3,000 m), `limit` ≤ 50 and `offset`.
- Returns name, address, neighbourhood, regional, days and hours as published (`observacao`, one line each) and the
  `func_manha`/`func_tarde`/`func_noite`/`func_24hr` periods, institutional phones and e-mails only, `updated`
  (`dt_atualiz`), WGS84 position and distance; source "IPPUC / GeoCuritiba" with the layer URL.
- One fixed request per layer (whole layer, fixed fields, `outSR=4326`), cached 6 hours; the user's position and
  neighbourhood are never sent. Fails closed on an ArcGIS error with HTTP 200, a cut layer or another spatial
  reference. Reuses `src/http.ts` (allowlist, https only, refusal block, size cap).
- Rate and failures: at most one request per 5 s to the host per server process, across layers (a call whose turn
  is more than 10 s away gets `rate_limited` with the wait, without a request); after a failure no request for 60 s,
  or a 429's `Retry-After` when longer, at most 1 hour. An ArcGIS `error` with code 401, 403, 498 or 499 sent with
  HTTP 200 is a final refusal: the host is blocked for 10 minutes like an HTTP 403 (`blockHost`, now exported from
  `src/http.ts`).
- Privacy: text fields go through `cleanField` line by line, after masking 8 to 11 glued digits ("Tel 33334444"); phones keep Curitiba landlines and service numbers only
  (mobiles dropped), e-mails keep `curitiba.pr.gov.br` addresses only (webmail, universities, companies and other
  domains dropped); a record whose address is marked not to be shown loses its address and position.
- Docs: README (tool tables, Curitiba App comparison, privacy, limits, licences), docs/sources.md (robots result,
  fields, layer ids and counts, contact survey), SPEC.md for this release.

## 0.14.0 - 2026-11-22

New tool `useful_phones`: useful public phone numbers in Curitiba (emergencies such as SAMU, Defesa Civil and Guarda
Municipal, city services, transport, radio taxis) from the Instituto Municipal de Turismo's "Telefones Úteis" page. No
new host: the page is on `turismo.curitiba.pr.gov.br`, already read by the events collector.

- `scripts/fetch-events.mjs` reads `/conteudo/telefones-uteis/92` once per run, after the events pages, with the same
  client (window, robots.txt check, 5 s gap, deadline, User-Agent), and writes `phones/phones.json` and
  `phones/status.json` in `CURITIBAI_DATA_DIR`. It keeps only section, name and numbers as published; an unknown
  layout writes `layout_changed` and keeps the previous copy. The phones step runs only after an ok or
  `layout_changed` events result; after any other stop (an error status such as 403, 429 or 5xx, a redirect, a
  timeout, a network error, the window or the deadline) it makes no request and its status gets the same code. It
  never changes the events files; the exit code is 0 only when both steps are ok,
  and the run prints one more fixed line (`fetch-events: phones_code=... phones=N phones_dropped=N`).
- `useful_phones` (optional `query` of 2–100 characters, `limit` up to 50) reads only that local file, no network
  call; words match name, section or number, accents and case ignored. A missing file returns `data_not_available`
  with how to run the collector.
- The page read on 2026-11-22 gives 60 entries, all public bodies or companies; no personal data was found. Entries
  with a mobile number or contact-shaped text in the name are dropped and counted.
- `scripts/check-no-catalog` and `.gitignore` also block a `phones/` folder (the collector's output).

v0.13.3 review follow-ups:

- `local_csv_summary`: long values already checked clean are cached by SHA-256 when over 1,000 characters, so a
  repeated long value is not masked again. New timing guard in `scripts/verify`
  (`scripts/perf-local-csv-summary.mjs`): 2,000 distinct 8,000-character values, budget 2 s per call (measured
  median about 0.46 s with the cache, 0.73 s without, on the development Mac). README: a contact value found after the
  120-character cut also makes the column refused; the check reads the first 300 characters of a long value.
- `.github/dependabot.yml` ignores TypeScript major updates (typescript-eslint does not accept TypeScript 7 yet).
- CHANGELOG: release dates on the headings from 0.12.0 on (dates of the merge commits); the 0.13.3 sentence about
  `maskObject` now describes its real order. The URBS counts of 2026-11-20 say they were measured by hand on the
  owner's local file.

## 0.13.3 - 2026-11-21

Privacy and robustness follow-ups. No new tool, source or host.

- `local_csv_summary`: the contact-data check (CPF/CNPJ, e-mail, phone) on grouped values now runs on the whole
  value before it is cut at 120 characters. Before, a value was cut first, so a phone or e-mail split by the cut
  ("... (41) 3333-" | "4444") passed the check and its first part could be returned. A test pins a phone and an
  e-mail that straddle the cut. `maskObject` itself works in this order: it cuts the raw
  text at 2,000 characters, masks that part, then, when it cut, drops the last 400 masked characters so an
  identifier split by the 2,000 cut is never shown in part; the result is then capped at 300 characters (see
  `src/mask.ts`). `cleanField` and `guardedSummary` mask before they cut, and the header cut refuses headers over 60
  characters first.
- Final refusals (HTTP 401, 403, a CAPTCHA 429) now return `source_unavailable` with the message "the source refused
  this server; it is not asked again for 10 minutes (per host)". Other source failures are unchanged.
- `bus_departures` and `next_buses_near`: a drop in a table's times counts as the wrap past midnight only when the
  time before it is 20:00 or later and the time after it is before 04:00; any other drop no longer marks later rows
  `after_midnight`. On the 2026-11-20 file all 677 drops are of that kind, so the 993 marked rows are unchanged. The 9
  rows in that file that come after a wrap at 04:00 or later stay `after_midnight: false` (known limit, in
  docs/sources.md). These counts were measured by hand on the owner's local file of 2026-11-20.

Docs and repository files:

- README: brand header, badges, a three-line summary, a table of contents, "Quick start" (with other MCP clients) and
  "Tools at a glance" (the 18 tools grouped by area). The existing sections keep their text and move under new
  headings: "Tools" is now "Tool reference", "Run it" is now "Quick start", and the local-file guides sit under
  "Local data files" (`#tools` and `#run-it` still resolve). Every legal and licence section stays.
- README "Collection rules": the 10-minute refusal block is per host, not per path. Removal requests link to the new
  issue form.
- README and docs/sources.md, Carta de Serviços: the server never contacts www.curitiba.pr.gov.br;
  `city_services_search` reads only a copy that you save yourself, by hand, in an ordinary browser session. An
  earlier local copy (2026-11-19/20) was deleted and is not used.
- README and docs/sources.md: the `captured` and `checked_at` examples use `YYYY-MM-DD`; the
  www.curitiba.pr.gov.br row dates its facts (robots.txt read on 2026-11-19; the HTTP 403 to non-browser clients
  observed on 2026-11-19). README and CONTRIBUTING: `scripts/verify` is the required local check, and
  `.github/workflows/verify.yml` is set to run it on pull requests. The removal-request form points sensitive cases
  to the repository's private vulnerability reporting (Security tab), with no e-mail.
- New: `CONTRIBUTING.md`, `SECURITY.md`, `.github/CODEOWNERS`, a pull request template and issue forms (bug, data
  source suggestion, removal request; blank issues off).

## 0.13.2 - 2026-11-21

Legal hygiene: attribution, notices and facts only. No new tool, source or host.

- URBS bus and points-of-interest results (`urbsLicenseNote`, `city_points_search`) and the `local_csv_summary` note
  now carry the Portal de Dados Abertos de Curitiba's required sentence ("O Portal de Dados Abertos de Curitiba e o
  órgão ou entidade ... uso secundário."), as `PORTAL_LICENSE_NOTE` already did.
- `places_search`: `attribution` is now "© OpenStreetMap contributors (ODbL 1.0)" (was "© OpenStreetMap contributors,
  ODbL"), and `license_note` adds the ODbL 1.0 URI (https://opendatacommons.org/licenses/odbl/1-0/) next to the
  copyright page, for live and bundled categories.
- `weather_alerts`: the "no warning" note says the answer may lag INMET by up to 10 minutes (in-memory cache), that it
  is not an official alert service, and to follow Defesa Civil (199).
- `health_units_search`: every note ends with the emergency line the city-points tool already had ("NOT FOR
  EMERGENCIES: in an emergency call 192 (SAMU) or 193 (Corpo de Bombeiros).").
- User-Agent: the server and the events collector append the repository as contact
  (`curitibai-mcp/0.7 (+https://github.com/Bossmann007/curitibai)`, `curitibai-mcp/0.10 (+...)`). robots.txt groups are
  still matched on the `curitibai-mcp` product token.
- Events: confirmed facts only (title, dates, time, place, address, category, link). The collector never reads the
  description; a test now pins that neither `events.json` nor the detail cache holds it.
- Tests and fixtures: CPF-shaped values now have invalid check digits; a test scans every file under `test/` and
  allows only 123.456.789-09 in the two tests that check masking of a valid-looking CPF.
- README: one block on independence, names, "as is" data and emergency numbers (190/192/193/199); the comparison table
  is dated (2026-11-21, public sources) and its "extra" row loses the promotional wording; new "Privacy notice" and
  "Collection rules"; "License" becomes "Licences (code and data)" (URBS CC BY 4.0 with changes made, OSM extract as a
  separate ODbL 1.0 database, terms inherited from PNCP, INMET and CNES, fixtures with real third-party content). The
  Carta de Serviços capture text is reworded.
- `procurement_search`: the object of a credenciamento (modality 12) is withheld (`object: null`,
  `object_withheld: "may_name_a_person"`), like dispensa, inexigibilidade and inaplicabilidade.
- Masking (PNCP objects and every field that uses the same guard: events, bus stops, city points, city services,
  places): two year-like numbers joined by a space, hyphen or dot ("2025 - 2026", "2026-2027") are now masked, because
  an 8-digit phone can look like that. "2025/2026" is kept.
- `local_csv_summary`: groups need at least 5 rows to be listed (was 3); a grouped column is refused
  (`column_not_allowed`) when a value it could return would be changed by the contact-data guard (CPF/CNPJ, e-mail or
  phone shaped, or year ranges that look like phone numbers). Names of people in values are not detected.
- `vaccination_sites_search`, `next_buses_near`, `bus_departures`, `weather_forecast` and `detran_pr_info` notes say to
  confirm on the official channel before you go or act, with its URL; the README disclaimer links them.
- `src/http.ts`: HTTP 401, 403 and a 429 whose HTML page is a CAPTCHA are a final refusal (`SourceRefusedError`,
  returned as `source_unavailable`): never retried, not even by PNCP's single retry. A 429 CAPTCHA was `rate_limited`
  before. The host is then not asked again for 10 minutes in that process, and `procurement_search` and
  `health_units_search` return what they found with `next_page: null` when a later page is refused. The events
  collector already stopped on 403 (tested).
- Carta de Serviços: new local copies must be saved by a person in an ordinary browser session.
- README "Removal requests": open an issue; the content is removed from the next release.

## 0.13.1 - 2026-11-21

- Fixed: times after midnight now follow the service day. URBS files a late-night trip under the day its service
  starts, at the end of that day's table (on the 2026-11-20 file, 677 tables run from 23:xx on to 00:xx in file order,
  measured by hand on the owner's local file of 2026-11-20; see docs/sources.md). A row before 04:00 that comes after such a wrap in its table is an after-midnight row; the
  other rows before 04:00 are read as early trips of their own code's day (not verified).
- `next_buses_near`: a window past 24:00 reads the same day's after-midnight trips plus the next calendar day's early
  trips (it read the next day's code only, so Friday 23:30 missed Friday's 00:03 and showed Saturday night's trips); a
  window starting before 04:00 with an inferred day reads the previous day's after-midnight trips plus today's early
  ones. An explicit `day` is now the service day: past 24:00 the window no longer stops at 23:59 but reads that day's
  after-midnight trips; `cut_at_midnight` now means the next day's early trips were not read. Items and `windows`
  gain `after_midnight`.
- `bus_departures`: items gain `after_midnight`; the note states the rule instead of "not verified". Order and
  filters are unchanged.

## 0.13.0 - 2026-11-21

- Added `next_buses_near` ("next buses near me" in one call): the published URBS departures in the next `window_min`
  minutes (default 60, at most 180) after `at` (HH:MM, default now in Curitiba) at the stops within `radius_m` (default
  400, at most 1000) of `near`, soonest first: `time`, `day`, `minutes_from_now`, `line_code`, `line_name`,
  `directions` (every SENTIDO the stops file lists for the line at that stop: the timetable has no direction field),
  `stop_number`, `stop_name` (masked as a guard), `distance_m`, `adapt`; plus `windows`, `cut_at_midnight`,
  `stops_considered`, `stops_with_times`, `total`, `skipped_rows`. Optional `line_code` and `limit` ≤ 50 (default 20).
  `day` defaults to the code of today's weekday in Curitiba (1 Monday to Friday, 2 Saturday, 3 Sunday; inferred, and
  holidays are not detected). A window past 24:00 reads the times from 00:00 under the next calendar day's code; with
  an explicit `day` it stops at 23:59. Reuses the v0.8 readers (newest file, 5% rule, `skipped_rows`, masking, CC BY
  4.0 note, renamed-field notes) and the v0.11 stop grouping; reads `tabelaLinha`, `pontosLinha` and `linhas`; no
  network call. Timetable as published, not real-time.
- About 73 ms per call (median; the first call in a process about 135 ms) on the real 2026-11-20 files on an Apple M4.
  `scripts/verify` now times the built tool on 17,496 generated stop rows and 71,085 departures and fails above
  600 ms; the smoke test calls it over stdio.

## 0.12.0 - 2026-11-21

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
  429 is `rate_limited`. After a failure the page is not requested again for 60 s (after a 429, the `Retry-After` wait,
  at most 1 hour).
- `imunizaja.curitiba.pr.gov.br` added to `ALLOWED_HOSTS` (robots.txt rechecked 2026-11-21: `/locaisvacinacao/` not
  disallowed). `fetchText` gained `sameHostOnly`, which refuses a redirect to any other host, and `redirectPathPrefix`, which
  refuses one outside a path (here `/locaisvacinacao`); only this tool uses them.
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
