# 0013. `bus_route_between`: direct lines between two points, from the stops file only

Status: Accepted (v0.41.0 brief, roadmap phase B, "close the citizen-eval gap `route_planning`"; no owner present in
the session, so the choices below are the brief's own and are open to review on the pull request).

## Context

Citizen eval q111 asks "Qual ônibus eu pego para ir da Rodoferroviária até o Parque Barigui?". `bus_stops_near`,
`next_buses_near` and `bus_line_stops` answer parts of it, but a model had to cross two stop lists by hand and could
not tell which way a line runs. Any route planner that models transfers and times (OpenTripPlanner, a GTFS feed, the
URBS site) needs a new host, a new dependency or a source the project treats as disallowed (docs/tools.md,
"Deferred").

The 2026-11-20 `pontosLinha` file (17,496 rows) was checked on 2026-11-25: 695 (line, ITINERARY_ID) pairs; each
ITINERARY_ID has one SENTIDO and one line code; no itinerary repeats a SEQ; 40 have gaps in SEQ, which does not change
the order.

## Decision

- A new tool, `bus_route_between`, not a new mode of `bus_stops_near`: it takes two points and its answer is a pair
  of stops per line, a different shape ([ADR 0005](0005-extend-a-tool-before-adding-one.md): "a new tool is right when
  ... the answer shape differ[s]").
- Input: `from` and `to` as `{lat, lon}`, `radius_m` (default 500, at most 1000) for both ends, `limit` and `offset`.
  No place-name lookup: the repository's lookups (`places_search`, `city_facilities_search`) are network tools, and
  a name parser here would guess. The model gets coordinates from those tools first.
- A line is listed when one of its itineraries (same ITINERARY_ID) has a stop within the radius of `from` with a lower
  SEQ than a different stop within the radius of `to`. Per line, the pair with the least straight-line walking wins
  (then the shorter ride, so on a tie or a stop passed twice the later boarding stop; then the itinerary id); lines are
  sorted by that walking. Lines with an itinerary that has stops near both ends but none in that order (a loop line
  that passes its end first, or one direction only) are named in `other_lines` (at most 50), never presented as a
  route. A line whose two directions use different streets, one near each end, is in neither list.
- When the two points are within twice the radius, the note gives their straight-line distance: walking may be
  shorter than any bus listed.
- Direct lines only: no transfers, no integration terminals, no times, no fares. The note says so and points to
  `bus_departures`, `next_buses_near` and `city_facilities_search` `terminal`.
- Data: the newest local `pontosLinha` and `linhas` files, through `loadUrbsOrFail`; a missing file is
  `data_not_available`, as in `next_buses_near`. No GeoCuritiba fallback (that layer has no lines per stop) and no new
  host.
- Privacy: the two points are only compared in memory; they are not sent, cached, logged or returned.

Where it is written: `src/tools/busRouteBetween.ts`, `test/busRouteBetween.test.ts`,
`scripts/perf-bus-route-between.mjs`, CHANGELOG 0.41.0.

## Consequences

- 26 → 27 tools; one more description in every tools/list.
- On the real 2026-11-20 files, from the Rodoferroviária (-25.437, -49.257) to the Parque Barigui (-25.422, -49.308),
  both points taken from the URBS `pois` file of that day: at 500 m, one line, 979 TURISMO (the Linha Turismo, a
  loop), and the way back none in order (979 in `other_lines`); at 1000 m, 979 and 464 A. MUNHOZ / JD. BOTÂNICO one
  way (alighting 913 m from the park), 464 back. Trips like this one mostly need a transfer, which this tool does
  not model; transfers would be a later, separate decision.
- A circular line whose itinerary starts after `from` and ends before `to` is missed; `other_lines` names it.
