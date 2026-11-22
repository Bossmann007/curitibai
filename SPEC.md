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
  Turismo site's robots.txt `Visit-time` 0200-0600) and `workflow_dispatch`. `runs-on: ubuntu-latest` only (standard
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
  `events.json` / `phones.json` on any failure and always writes `status.json`.
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
  the 20 s per-call budget (`CALL_START_BUDGET_MS`); `note` says which limit stopped the scan.
- `open_datasets_search` retries an empty query without accents, then with `src/sources/portalSynonyms.ts`;
  no retry or later page after 20 s.
- `river_levels` lists stations with status `ok` first (stable, so distance order is kept in each group).
- `local_csv_summary` `file_not_found`, `events_search` and `useful_phones` `data_not_available` messages point to
  `docs/local-data.md` and the nightly run.

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
