# SPEC: v0.41.0 Direct bus lines between two points

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.41.0, roadmap phase B: close the citizen-eval gap
`route_planning`"). **This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer citizen eval q111 "Qual ônibus eu pego para ir da
Rodoferroviária até o Parque Barigui?" honestly from the data the bus tools already read.

## What was missing (v0.40.0)

`bus_stops_near`, `next_buses_near` and `bus_line_stops` each answer part of the question, but no tool crossed the
stops near two points or told which way a line runs. q111 was the `route_planning` gap.

## Prior art and sources checked (2026-11-25)

- In the repository: `stopsWithin`/`groupStops` (`src/tools/busStopsNear.ts`), `distanceM`, `loadUrbsOrFail`, the
  bus envelope and notes (`src/tools/busCommon.ts`); reused, nothing copied.
- Route planners with transfers and times (OpenTripPlanner, a GTFS feed, the URBS site): each needs a new host, a new
  dependency or a source treated as disallowed; out of scope by the brief.
- The real 2026-11-20 `pontosLinha` file: each ITINERARY_ID has one SENTIDO and one code, no itinerary repeats a SEQ,
  40 of 695 have gaps in SEQ. So "boarding before alighting" can be read from SEQ inside one itinerary.

## Changes

1. **`bus_route_between`** (`src/tools/busRouteBetween.ts`, [ADR 0013](docs/adr/0013-direct-bus-lines-between-two-points.md)):
   `from`, `to`, `radius_m` (500 default, 1000 max), paging. Per line, the (board, alight) pair with the least
   straight-line walking among itineraries where the board stop's SEQ is lower; `other_lines` for lines near both
   ends in no such order. Direct lines only, not real-time. Missing file: `data_not_available`, no fallback.
2. **Eval:** q111 → `bus_route_between`; new q120 (the way back); six invented rows of line 903 in the shared
   synthetic `pontosLinha` fixture; `route_planning` gap gone.
3. **Checks:** `test/busRouteBetween.test.ts`; `scripts/perf-bus-route-between.mjs` in `scripts/verify` (fails over
   400 ms); smoke test calls the tool; tool contract snapshot.
4. **Docs and version:** README, docs/tools.md (row, notes, Curitiba App transport row), docs/sources.md,
   docs/local-data.md, docs/privacy.md, docs/roadmap-1.0.md, CONTRIBUTING, CHANGELOG 0.41.0, version 0.41.0 in
   `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Transfers and integration terminals; times, fares and real-time positions; place-name input; any new host or
dependency; the GeoCuritiba stop layer as a fallback (it has no lines per stop).

## Check

- `npx vitest run test/busRouteBetween.test.ts test/contracts.test.ts test/tools.test.ts test/eval`.
- `node scripts/eval-summary.mjs`: `answered 114 / 120`; `node scripts/coverage-report.mjs --tools docs/tools.md`:
  15 of 18 Curitiba App rows covered (7 data, 8 guide).
- `node scripts/perf-bus-route-between.mjs`: median about 30 ms on 17,496 generated rows.
- `scripts/verify` exits 0 on the PR head.
