# 0003. Shared per-host request gate (`src/hostGate.ts`)

Status: Accepted (introduced in v0.16.0, PR [#7](https://github.com/Bossmann007/curitibai/pull/7); shared from then on)

## Context

Live tools that query small hosts (`river_levels`, `guaira_events`, `city_facilities_search`) must stay
polite to small public hosts: space requests, stop asking after a failure, never retry a refusal, and still answer an
MCP client within a reasonable time. Each source writing its own spacing and failure logic had drifted.

## Decision

One gate per host, created with `createHostGate` (`src/hostGate.ts:65`), for ANA, GeoCuritiba, Teatro Guaíra and the
published `data` copy. Overpass (`src/sources/osm.ts:136-163`) predates it and keeps its own queue.

- **Spacing:** at least `minIntervalMs` between two request starts from the process; slots are reserved, so calls
  queue. Third-party hosts use 5 s (`src/sources/ana.ts:19`, `src/sources/geocuritiba.ts:436`,
  `src/sources/guaira.ts:272`); this project's own published copy uses 1 s (`src/sources/publishedData.ts:58`). A slot
  more than `maxQueueWaitMs` away (10 s for the 5 s hosts) returns `rate_limited` with the wait, without a request.
- **Failure memory:** after a failure, no request for 60 s, or a 429's `Retry-After` when longer, at most 1 hour; the
  same error is returned instead (`src/hostGate.ts:3-5`). The gate never retries.
- **Refusal block:** a final refusal (HTTP 401/403 or a CAPTCHA) blocks the host for 10 minutes in the process
  (`REFUSAL_BLOCK_MS`, `src/http.ts:31`); `refusalWaitMs` lets a gate remember it as long
  (`src/sources/guaira.ts:306`), and `river_levels` checks the block before the gate (CHANGELOG 0.18.4).
- **Time budget:** a `startBy` option refuses a slot later than the call's budget with `OutOfTimeError`, before
  reserving it and without counting it as a host failure (`src/hostGate.ts:19-30`). `river_levels` and `guaira_events`
  use a 20 s start budget (`CALL_START_BUDGET_MS`, `src/tools/common.ts:12-17`).
- **Partial results:** when the budget, a rate limit, a refusal or a host failure stops a call midway, what was already
  read is returned with `partial: true` and a note (`src/tools/riverLevels.ts:240`, `src/tools/common.ts:94-99`,
  `src/tools/guairaEvents.ts:187`); an error only when nothing was read.

Where it is written: README "Collection rules", `docs/sources.md:54` (GeoCuritiba), CHANGELOG 0.16.0 to 0.18.4, PRs
[#7](https://github.com/Bossmann007/curitibai/pull/7), [#9](https://github.com/Bossmann007/curitibai/pull/9),
[#12](https://github.com/Bossmann007/curitibai/pull/12), [#14](https://github.com/Bossmann007/curitibai/pull/14).

## Consequences

- A cold call can take about 20 s plus one request timeout; callers see `partial`, `rate_limited` or the remembered
  error instead of waiting longer.
- The gate is per process: two server processes each keep their own spacing.
- A new live host reuses `createHostGate` instead of its own timer; the tests use fake timers against it.
