# 0002. Nightly GitHub Actions collection to an orphan `data` branch

Status: Accepted (owner approval 2026-11-22, task brief for v0.18.0)

## Context

`events_search` and `useful_phones` read files written by `scripts/fetch-events.mjs`, which crawls
`turismo.curitiba.pr.gov.br`. That site's robots.txt allows visits only inside a `Visit-time` window (0200-0600 UTC)
and at one request per 5 s. A user rarely runs the collector at 02:00 UTC, so the files went stale. The owner asked for
automatic updates ("era pra ele pegar automático"), but only if free.

## Decision

- `.github/workflows/collect.yml` runs at 02:37 UTC (inside the window) and on `workflow_dispatch`, on the standard
  `ubuntu-latest` runner only (free for public repositories, never a larger runner), with `timeout-minutes: 35`, above
  the collector's own 30-minute deadline (`scripts/fetch-events.mjs:25`). Only the job has `contents: write`; actions are
  pinned by SHA; no `npm ci`, so no dependency code runs with write access.
- `scripts/publish-data.sh` runs the collector unchanged and pushes four files (events, phones and their status) to an
  orphan `data` branch, never `main`, never forced.
- The server reads the local file first; only when there is none does it read the published copy from
  `raw.githubusercontent.com` (`src/sources/publishedData.ts:133`). `CURITIBAI_REMOTE_DATA=0` (or `off`) turns that off
  (`src/sources/publishedData.ts:19`).

Where it is written: `SPEC.md:1-47` (design, approved 2026-11-22, 35-minute timeout as an owner decision at
`SPEC.md:31`), `.github/workflows/collect.yml`, README "Events (Instituto Municipal de Turismo calendar, collected by a
separate script)", CHANGELOG 0.18.0, PR [#10](https://github.com/Bossmann007/curitibai/pull/10).
`test/workflows.test.ts` pins the runner, SHAs, cron, timeout and the push rules.

## Consequences

- No cost and nobody runs the collector by hand; the site still sees at most one request per 5 s inside its window.
- The `data` branch is public, so it holds facts and links only ([0001](0001-facts-and-links-from-unlicensed-sources.md)).
- GitHub disables scheduled workflows in a public repository after 60 days with no repository activity. This is
  documented (README, same section; `docs/sources.md:735`), not worked around with keep-alive commits
  (`SPEC.md`, "Out of scope"). `stale: true` after 3 days is the first sign; the fix is `gh workflow enable collect.yml`.
- Scheduled runs can start late or be dropped under GitHub load; a run after 05:50 UTC publishes only its status and
  the tools keep the last good copy.
- The server gains one network host (`raw.githubusercontent.com`, three fixed paths).
