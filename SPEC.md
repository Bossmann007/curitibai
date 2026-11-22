# SPEC: v0.16.0 `river_levels` (ANA telemetry, IAT-PR stations)

Approved: Enzo 2026-11-22 (river levels and rain in Curitiba from the public ANA telemetry; owner approved the
no-licence approach: facts only, ANA cited). Scope frozen.

## Goal

A read-only tool that answers "how high is the river near me, and how much did it rain in the last hours" from the
public telemetry of ANA (Agência Nacional de Águas e Saneamento Básico), stations operated by IAT-PR around Curitiba.

## Source (checked again on 2026-11-22)

- Web service `telemetriaws1.ana.gov.br/ServiceANA.asmx` (ASP.NET, anonymous GET, XML, no key).
  `DadosHidrometeorologicos?codEstacao=<code>&dataInicio=dd/mm/yyyy&dataFim=dd/mm/yyyy` returns 15-minute rows
  (`CodEstacao`, `DataHora` in Brasília time, `Vazao` m³/s, `Nivel` cm, `Chuva` mm per reading; an empty element is
  no value). A station with no rows answers HTTP 200 with an `ErrorTable` whose `Error` is
  "Sem dados para esta estação (Código: X) no período solicitado!" (also for a code that does not exist).
- Scheme: the research brief said plain http is the only scheme. On 2026-11-22 `https://` answered 200 `text/xml`
  with a valid certificate, from curl and from Node 26 `fetch`. The server uses **https only**, like every other host,
  and `isAllowedUrl` is unchanged.
- robots.txt: 404 (no rules), on 2026-11-21 and 2026-11-22. `dadosabertos.ana.gov.br` (Crawl-delay 60) is another
  host and is not used.
- Licence: none found. Owner decision (2026-11-22): "no licence found; facts only; ANA cited".

## Design

- Tool `river_levels`: optional `station` (a code, with or without leading zeros, or the start of a code, or text
  matched against the station name, river and municipality, accents and case ignored), optional `near` `{lat, lon}`.
  Stations come nearest to `near` (default: Curitiba centre, Praça Tiradentes) first; without `station`, stations on a
  river (which report a level) come before rain gauges.
- Per station: code, name, river, municipality, lat/lon, `distance_km` (with `near`), latest reading time
  (Curitiba time, ISO with `-03:00`), `level_cm`, `flow_m3s`, `rain_mm` of the latest reading, `rain_1h_mm` and
  `rain_24h_mm` (sum of the readings in the hour / 24 h ending at the latest reading; null when no reading in the
  window has a rain value or when the window starts before the fetched period; gaps make it a lower bound),
  `stale: true` when the latest reading is older than 2 h (computed at answer time, not cached), and `status`
  `ok`, `no_recent_data` (no reading since yesterday 00:00 Curitiba time: listed, values null, never invented) or
  `unavailable` (the station's answer could not be read: values null). The latest reading is the newest row with at
  least one value; rows dated more than 15 minutes after the read time are ignored.
  Note: "Not for emergencies: Defesa Civil 199."
- Station list: bundled in code, never downloaded at runtime. Built once on 2026-11-22 from
  `ListaEstacoesTelemetricas` (one 4 MB download by the developer): every station with latitude -25.75 to -25.25
  and longitude -49.55 to -49.00 (25 stations, all IAT-PR). Many of them send nothing on a given day.
- Request period: `dataInicio` = yesterday, `dataFim` = today, both Curitiba dates (≥ 24 h of rows).
- Only codes from the bundled list reach the URL; the user's text and position are never sent.
- Network (same pattern as v0.15, gate extracted to `src/hostGate.ts` and shared with GeoCuritiba): at least 5 s
  between request starts to the host; a call whose turn is more than 10 s away gets `rate_limited` without a request;
  after a failure no request for 60 s (a 429's Retry-After when longer, at most 1 hour) and the same error is
  returned; 401/403/CAPTCHA blocks the host for 10 minutes (`src/http.ts`). Never retried in a loop.
- At most **3 stations per call** (N = 3): uncached, the requests start at 0, 5 and 10 s; with a 10 s timeout each,
  the worst case is about 30 s. More matches are counted in `more_matches` and named in the note.
- Cache: 15 minutes per station code (the URL carries dates). A cached station makes no request and never waits.
- Fail closed: content type not XML, body over 512 KB, no XML declaration, a `<!DOCTYPE`/`<!ENTITY`, a root other
  than `DataTable xmlns="http://MRCS/"`, any `Error` other than the exact "no data" text for the requested code, a row
  whose `CodEstacao` differs, an unparsable date or number, or neither rows nor `ErrorTable`. Such an answer marks
  that station `unavailable` (not cached, not a host failure: only the transfer runs inside the host gate, after
  review). A transfer or host failure (timeout, HTTP error, 429, refusal, gate) fails the whole call, so a station not
  fetched is never shown as `no_recent_data`.

## Files

- `src/hostGate.ts` (new, gate factory), `src/sources/geocuritiba.ts` (uses it; exports unchanged),
  `src/sources/ana.ts` (stations, URL, parser, cache), `src/tools/riverLevels.ts`, `src/tools/index.ts`,
  `src/config.ts` (host), `src/server.ts` and `package*.json` (0.16.0).
- `test/riverLevels.test.ts`, `test/fixtures/ana/*`, `test/setup.ts`, `test/tools.test.ts`, `scripts/smoke.mjs`,
  `scripts/verify` (step label).
- README, docs/sources.md, CHANGELOG 0.16.0.

## Out of scope

Alerts or flood thresholds, history beyond 24 h, charts, other ANA operations, fuel prices (ANP), air quality.

## Check

`scripts/verify` exits 0: typecheck, lint, tests (parser on real XML samples, fail-closed cases, rain sums and
stale flag, no-data stations, station matching, 5 s spacing / 10 s queue / failure memory / refusal with fake timers,
15-minute cache, dates in Curitiba time with the clock at 01:00 UTC), build, smoke (lists 21 tools).
