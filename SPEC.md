# SPEC: v0.18.0 nightly collection of events and useful phones

Approved: Enzo 2026-11-22 (task brief "curitibai v0.18.0 — events and useful phones update themselves"; owner request
"era pra ele pegar automático", only if free; design approved in the brief, including the public `data` branch with
facts and links only from a site with no licence). Scope frozen. The owner creates nothing by hand: the first
scheduled (or manual) run after merge creates the `data` branch.

## Goal

`events_search` and `useful_phones` stay up to date with nobody running `scripts/fetch-events.mjs` by hand, at no
cost.

## Design

- **Workflow** `.github/workflows/collect.yml`: `schedule` cron `37 2 * * *` (02:37 UTC, an odd minute inside the
  Turismo site's robots.txt `Visit-time` 0200-0600; since v0.19.3 also `17 3`, `59 3`, `37 4` and `13 5`, see "v0.19.3
  changes") and `workflow_dispatch`. `runs-on: ubuntu-latest` only (standard
  runner, free in public repositories per <https://docs.github.com/en/billing/concepts/product-billing/github-actions>;
  never a larger runner). Workflow permissions `contents: read`; the job alone `contents: write`. Actions pinned by
  full commit SHA (the same two as `verify.yml`). `timeout-minutes: 35` (above the collector's 30-minute deadline). Concurrency group `collect`,
  `cancel-in-progress: false`. Job only when `github.repository == 'Bossmann007/curitibai'` and the ref is `main`. No
  `npm ci` (the collector uses Node built-ins only, so no dependency code runs with write access).
- **Publish** `scripts/publish-data.sh`: fetch `data` (when it exists) into a temporary folder; copy the previous
  `events/events.json`, `events/status.json`, `phones/phones.json` into a temporary `CURITIBAI_DATA_DIR`; run
  `scripts/fetch-events.mjs` once, unchanged, without the token in its environment; copy those three files back; commit
  them as `github-actions[bot]`, skipping the commit when none changed (rare: `status.json` records every attempt); push `HEAD:refs/heads/data` without force; exit with the
  collector's code. No `data` branch yet: create it as an orphan. A `ls-remote` failure other than "no such branch"
  stops before collecting (so a network error never makes a new orphan). The collector already keeps the previous
  `events.json` / `phones.json` on any failure and always writes `status.json` (since v0.19.3, not on `window_closed`
  or `already_collected`; see "v0.19.3 changes").
- **Timing:** typical run about 5 minutes (50 events); with 10 list pages of 10 events, about 112 requests with a
  5 s gap after each plus response time, about 10–15 minutes, more when the site is slow. The job timeout is 35
  minutes (owner decision, 2026-11-22), above the collector's unchanged 30-minute deadline, so the collector always
  stops first, keeps the previous files and writes `status.json`, and the run still publishes.
- **Server** `src/sources/publishedData.ts`: `loadLocalOrPublished` reads the local file first (today's behaviour,
  every error kept); only `data_dir_not_set` or `file_not_found` fall through to the published copy, unless
  `CURITIBAI_REMOTE_DATA` is `0` or `off`. Published copy: fixed URLs
  `https://raw.githubusercontent.com/Bossmann007/curitibai/data/{events/events.json,phones/phones.json}` (new host in
  `ALLOWED_HOSTS`), `fetchText` with the existing caps (2 MB, 512 KB), 10 s timeout, `sameHostOnly`,
  `redirectPathPrefix: /Bossmann007/curitibai/data`; JSON parse then the existing `buildEvents` / `buildPhones`
  (strict schemas, fail closed); the validated result cached 1 hour; one `createHostGate` for the host (1 s apart,
  5 s queue limit, failure memory 60 s or a 429's Retry-After) for host failures (network, timeout, HTTP errors
  other than 404, 429); a separate 60 s memory per file for that file's own failures (404, body over the cap, a
  redirect, not JSON, schema), so one file's problem never blocks the other and is not asked again for 60 s. HTTP 404 → `data_not_available` "no published copy yet".
- **Freshness**: `checked_at` from the file; `stale: true` after 3 days with a note that the nightly collection may
  have stopped (published copy); `events_search` keeps refusing files over 7 days old. `useful_phones` gains
  `checked_at` and `stale` (keeps `fetched_at`) and, like `events_search`, refuses a `checked_at` in the future. A too-old local file's error now says to remove it to use the
  published copy.
- Tool metadata: titles say "nightly copy", descriptions and notes say which copy answered; `openWorldHint` true.

## Prior art

The "git scraping" pattern (a scheduled GitHub Actions job committing collected JSON to the repository) is adopted; no extra action or service is used. The collector, schemas, HTTP client and host gate are reused.

## Files

- `.github/workflows/collect.yml`, `scripts/publish-data.sh` (new).
- `src/sources/publishedData.ts` (new), `src/tools/eventsSearch.ts`, `src/tools/usefulPhones.ts`, `src/config.ts`
  (host), `src/server.ts` and `package*.json` (0.18.0).
- `test/publishedData.test.ts`, `test/workflows.test.ts` (new), `test/eventsSearch.test.ts`,
  `test/usefulPhones.test.ts`, `test/tools.test.ts`, `test/setup.ts`, `scripts/smoke.mjs`, `scripts/verify` (label).
- README, docs/sources.md, SECURITY.md, CHANGELOG 0.18.0.

## v0.18.1 changes (task brief "curitibai v0.18.1 — close the open Low findings", 2026-11-22)

- `phones/status.json` is now published (`scripts/publish-data.sh` `FILES`) and read by `useful_phones` from the same
  copy as the phones (third fixed URL); a failed last phones run's `code` goes into the note. A missing or invalid
  status (strict schema, `code` matching `^[a-z_]{1,40}$`) adds nothing and never fails the answer. This lifts the
  "publishing `phones/status.json`" exclusion below.
- `river_levels`: an HTTP 200 answer that is not ANA's XML document is a host failure inside the gate (60 s memory;
  CAPTCHA/challenge markers block the host 10 minutes); a station whose XML content cannot be read is remembered 60 s
  for that station only.
- `guaira_events`: the event-page details cache holds at most 500 entries (expired swept, oldest evicted on insert).
- `river_levels` and `guaira_events`: per-call start budget of 20 s (`CALL_START_BUDGET_MS`, plus 1 s
  `CALL_START_SLACK_MS`); no request starts after
  it, what is ready is returned with `partial: true` and a note; a request in flight is never cut, and the Guaíra
  listing load is never cut (a partial listing would be cached 1 hour).

## v0.18.2 changes (task brief "curitibai v0.18.2 — the two Lows left by the v0.18.1 review", 2026-11-22)

- `river_levels`: a `rate_limited` from the host gate in the middle of a call no longer discards the stations read.
  When at least one station was read in the call or is cached, those are returned with `partial: true` and a note
  (the same shape as the time-budget partial, refused stations first in `more_matches`); `rate_limited` is returned
  only when no station is available. Other host or transfer failures still failed the whole call (until v0.18.4).
- `guaira_events`: the listing (title, dates, city, link) is the complete answer; venue, age rating and price are an
  optional enrichment. `partial: true` only when listing pages are missing (`truncated`); items whose event page was
  not read yet (time budget, the 2-page cap, a refusal) are counted in `details_pending` with the note "call again for
  venue and price". Gate, cache and budget unchanged.

## v0.18.3 changes (task brief "curitibai v0.18.3 — three Lows from the v0.18.2 review", 2026-11-22)

- `river_levels`: the note and code comment no longer claim when ANA publishes validated data (the delay was not
  verified); they say ANA also publishes validated (consistidos) series after deeper analysis and this tool reads
  only the raw telemetry. A test asserts the note has no "month".
- `river_levels`: a final refusal (401/403 or a CAPTCHA) on a later station no longer drops the stations already
  read: they are returned with `partial: true` and a note that the host refused; the 10-minute block stays in force.
  `source_unavailable` only when no station is available. Other host or transfer failures still failed the whole
  call (until v0.18.4).
- `guaira_events`: `partial` is documented as a deprecated alias of `truncated` (both kept this version); README
  example of a cold and a warm call.

## v0.18.4 changes (task brief "curitibai v0.18.4 — two river_levels fixes", 2026-11-22)

- `river_levels`: while the ANA host is blocked after a refusal (10 minutes), an uncached station fails before the
  host gate (`checkNotRefused` in `src/http.ts`): no slot reserved, no wait, no request. Cached stations are still
  returned with `partial: true`.
- `river_levels`: a host or transfer failure (5xx, timeout, network error, a 200 answer that is not ANA's XML
  document) on a later station returns the stations read or cached with `partial: true`, the failed stations first in
  `more_matches` and a note naming the failure; `source_unavailable` only when no station is available.

## v0.18.5 changes (task brief "curitibai v0.18.5 — ADRs + PR-size guard", 2026-11-22)

- `docs/adr/` (index and ADRs 0001-0004); docs and CI only, no runtime change.
- `scripts/pr-size.mjs` in `verify.yml` on `pull_request` (`opened`, `synchronize`, `reopened`, `edited`): diff
  `HEAD^1..HEAD` (GitHub's merge commit and its base), more than 400 counted lines fails unless the body has a
  `Large PR because:` line with a reason; `test/` and lockfiles excluded.

## v0.19.0 changes (task brief "curitibai v0.19.0 — usability fixes found by calling every tool", 2026-11-22)

- `health_units_search` and `procurement_search` scan pages until `limit` matches, a page cap (CNES 20, PNCP 5) or
  the 20 s per-call budget (`CALL_START_BUDGET_MS`); `note` says which limit stopped the scan. Both hosts go through
  `createHostGate` (CNES 400 ms, PNCP 6 s spacing; failure memory 60 s to 1 hour).
- `open_datasets_search` retries an empty query without accents, then with `src/sources/portalSynonyms.ts`;
  no retry or later page after 20 s.
- `river_levels` lists stations with status `ok` first (stable, so distance order is kept in each group).
- `local_csv_summary` `file_not_found`, `events_search` and `useful_phones` `data_not_available` messages point to
  `docs/local-data.md` and the nightly run.

## v0.19.1 changes (task brief "curitibai v0.19.1 — procurement_search should find a text match on the first call", 2026-11-22)

- `procurement_search` with `query`: PNCP site search (`/api/search`, `municipios=4006`, `modalidades`, pages of
  100, `src/sources/pncp.ts` `getSearchPage`/`parseSearch`) through the PNCP gate; window client-side; stop when
  updates are older than `from`; local re-match keeps the "never a withheld object" rule. Choice A of the brief
  (evidence in docs/sources.md); B (in-process index of Consulta pages) not built. Fallback to the Consulta scan in the
  same call when the search fails or its format changes; never on a 429 or refusal. Query sent accent-stripped and
  lower-cased. Search timeout 8 s; search failure remembered 10 minutes (search only; since v0.19.2 a connection reset only when it
  is the second in a row); `next_page_source` /
  `page_source` tag continuations (review round 2).

Approved: Enzo 2026-11-22 — PNCP search endpoint (undocumented, public); the user's query text goes to PNCP; fallback to the page scan when the search fails or its format changes.

## v0.19.2 changes (task brief "curitibai v0.19.2 — the PNCP fast search is switched off for 10 min by a single connection reset", 2026-11-22)

- `getSearchPage` (`src/sources/pncp.ts`): a connection error on a search request is retried once on the PNCP gate's
  next turn (6 s spacing), not at once inside the same turn; the retry is skipped when it would start after the call's
  20 s budget minus the 8 s search timeout and 1 s of slack (the fallback scan must still be able to start; on a later
  page the call stops as `partial` with the search's `next_page`). One attempt is one gate turn (a 429 with
  Retry-After of 5 s or less is still retried inside it). When other calls hold the gate's next turns and the retry's
  turn is more than 10 s away, the call is `rate_limited` (the fallback scan would wait for the same queue). The search is remembered as down for 10 minutes after two connection errors in a row (across
  calls), or at once after a timeout, 5xx or changed format as before; a search answer resets the count; a 4xx neither
  counts nor resets. The Consulta API keeps its immediate single retry.
- `fetchText` (`src/http.ts`): a connection error or timeout while the body is read is `network error` / `timeout`,
  like one before the headers (it escaped as an unknown error before).

## v0.19.3 changes (task brief "curitibai v0.19.3 — the nightly collector must actually collect", 2026-11-23)

The only scheduled run so far was created 2026-11-23T11:08:05Z, 8.5 h after `37 2 * * *`, so it stopped with
`window_closed` and the `data` branch holds only `status.json` files with `success: null`. GitHub: the `schedule` event
"can be delayed during periods of high loads" and queued jobs may be dropped.

- `collect.yml`: five schedule entries, `37 2`, `17 3`, `59 3`, `37 4` and `13 5 * * *` UTC: odd minutes, gaps of 36
  minutes or more (above the 35-minute job timeout), the last start plus the 30-minute deadline before 05:50 UTC.
  `NIGHTLY_RUN_UTC` stays `02:37` (the first entry). Robots.txt checks, the deadline, `persist-credentials: false`,
  `contents: write` on the job only and no `npm ci` are unchanged.
- `scripts/fetch-events.mjs` `run()`: after the lock, "last collection" is the older of the `success` times in
  `events/status.json` and `phones/status.json` (null when either is missing, unparseable or later than the start).
  With `CURITIBAI_COLLECT_ONCE_A_DAY=1` (set by `scripts/publish-data.sh`), a last collection on the start's UTC date
  stops the run with `already_collected`: no request, no file written, exit 0. A `window_closed` stop (at the start or
  mid-run, events or phones step) writes neither status file, so the previous record is never replaced; the run exits
  0 when each step ended `ok` or `window_closed` and the last collection is less than 24 h before the start, else 1.
  Without the switch a by-hand run inside the window collects as before.
- No change to the data files' format, the tools or any other source. This lifts "any change to the collector's
  behaviour" in "Out of scope" below for these points only.
- Consequence: after a 403, 429 or `robots_changed`, the next entry that night asks the site again (at most four more
  runs, each stopping at its first refusal); before, the next attempt was the next night.
- Check: `scripts/verify` exit 0 (new `test/fetchEvents.test.ts` "later schedule entries and late runs" and the cron
  assertions in `test/workflows.test.ts`); `scripts/publish-data.sh` against a local bare repository outside the
  window: success 2 h ago gives `already_collected`, exit 0; 20 h ago `window_closed`, exit 0; 30 h ago or none,
  exit 1; no commit in any case.

## v0.19.4 changes (owner decision "uma recusa do site encerra a coleta da noite", 2026-11-23)

- `scripts/fetch-events.mjs` `run()`: with `CURITIBAI_COLLECT_ONCE_A_DAY=1`, after the `already_collected` check, when
  `events/status.json` or `phones/status.json` records `http_error` 401, 403 or 429 (`REFUSAL_STATUSES`), or
  `robots_changed`, with an `attempt` on the start's UTC date, the run stops with `refused_tonight`: no request,
  nothing written, exit as for `window_closed` (0 only with both steps' success in the last 24 h). Other failures
  (5xx, timeout, network, `layout_changed`) are tried again by the next entry. The next night tries again. This
  replaces the v0.19.3 consequence above (a later entry asked the site again after a refusal). No new headers, no
  workaround.
- Check: `scripts/verify` exit 0 (`test/fetchEvents.test.ts` "a refusal ends the night").

## v0.20.0 changes (task brief "curitibai v0.20.0 — espaços culturais do GeoCuritiba", 2026-11-23)

- Goal: cover the cultural spaces the Curitiba App lists and CuritibAI did not. Source: the Cultura group of the
  MapServer `Publico_GeoCuritiba_Equipamentos_Urbanos` that `city_facilities_search` already reads (robots.txt 404,
  no licence found, same as the current layers).
- Decision: six new `type` values in `city_facilities_search`, not a new tool. Why: the layers have the same fields
  as the current point layers, so the same query, parser, contact allowlist, cache, gate and envelope apply with no
  new surface (the tool count stays 22).
- `src/sources/geocuritiba.ts` `FACILITY_TYPES`: `centro cultural` (layer 50 Centro Cultural), `espaco expositivo`
  (51 Espaço Expositivo de Artes), `memorial` (53 Memorial), `cinema` (56 Cinema), `espetaculos ao ar livre`
  (59 Espaço para Espetáculos ao Ar Livre), `gibiteca` (62 Gibiteca), each with plural or full-name aliases only. Same
  HTTP client (`fetchText`), 6-hour cache, 15 s timeout, 2 MB cap, host gate (5 s, 10 s queue), User-Agent, fixed
  `outFields`, fail-closed rules and contact allowlist as the current point layers. No new dependency.
- `museu`, `teatro`, `centro cultural`, `espaco expositivo` and `cinema` carry `mixedOwnership`: their layers also
  list private or non-profit venues (commercial cinemas, a bank's cultural centre), so `note` says so and to confirm
  with the venue, not the 156 (as `city_points_search` does for `cultural_space`; from the v0.20.0 review).
- An empty layer (`features: []`, WGS84) returns an empty list with `total` 0, not `source_unavailable` (the current
  `parseLayer` rule). A record with no name is skipped and counted; with no `observacao`, `hours` is `[]`; with no
  `divulgar_endereco`, address and position are null.
- Docs: `docs/tools.md` (types in the `city_facilities_search` row; "Compared with the Curitiba App": cultural spaces
  and attractions = partial, plus rows "—" for Defesa Civil alerts, EstaR and real-time buses with the reason from
  the owner's research of 2026-11-23), `docs/sources.md` (the six layers, counts, requests made), CHANGELOG 0.20.0,
  version 0.20.0.
- Out of scope: a tourist-attraction layer (none in the service), Defesa Civil, EstaR, real-time buses.
- Check: `scripts/verify` exit 0 (`test/cityFacilities.test.ts`: type mapping, a synthetic culture layer, an empty
  layer, missing fields); one live call per new type through the built tool, one at a time.

## Out of scope

Creating the `data` branch or running the workflow from this PR (the owner side does the first run after merge);
publishing `details.json` or `phones/status.json`; any change to the collector's behaviour; a keep-alive commit
against GitHub's 60-day rule (documented instead).

## Check

`scripts/verify` exits 0 (typecheck, lint, tests including the remote read path with stubbed fetch, local-first
precedence, schema fail-closed, cache, stale, opt-out, workflow runner and SHA pins; build; smoke with
`CURITIBAI_REMOTE_DATA=0`). `scripts/publish-data.sh` run locally against a bare repository (via a git `insteadOf`
mapping) outside the window: first run creates the orphan `data` with `events/status.json` only; a later run with
previous files keeps `events.json` and `phones.json` and changes only `status.json`. The GitHub `verify` check is
green on the PR.
