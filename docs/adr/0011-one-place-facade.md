# 0011. `place_at_point`: one facade for place, service areas and census

Status: Accepted (v0.32.0 brief, owner approval 2026-11-24: "seguimos com emode", roadmap step "1.0 com fachada única
de lugares"). Supersedes nothing; extends [ADR 0005](0005-extend-a-tool-before-adding-one.md).

## Context

Up to 0.31.0, `place_at_point`, `service_areas_at_point` and `census_at_point` each took a point, rounded it, checked
the Curitiba box and asked GeoCuritiba layers through one host gate (5 s between requests, no request after the
call's 20 s budget, and a request whose slot is more than 10 s away refused with `rate_limited`). A client that wanted
"what is here" called three tools and paid three tool descriptions in every tools/list. The package is not published
yet, so merging them breaks no external user.

## Decision

- One tool, `place_at_point`, with `include` (`place`, `service_areas`, `census`; default all) and `areas` (`care`,
  `safety` or `all`). The output is `{data: {point, place, service_areas, census, partial}, notes, license_note}`;
  each part keeps its old fields (without the point) and its own `source`, `source_url` and `checked_at`.
  `service_areas_at_point` and `census_at_point` leave tools/list.
- All parts start together and share one `pointReads(p, startBy)` (`src/sources/geocuritiba.ts`): one request at a
  time per call, in the order the parts ask. A cold call therefore asks the first layer of each part (bairro, health
  or PM area, census sector) before any later layer, and the budget cuts the later layers first. Starting the parts
  at once on the gate without this turn would queue three or more requests per call, and the gate refuses a slot more
  than 10 s away.
- A part whose first request is cut, or fails while another part answered, is null; `partial` is true and `notes`
  names the part and why (`missingNote`: refusal, time budget, or busy host). When no part answers, the call fails
  with the error of the first part (`source_unavailable`, `rate_limited`), as the single tools did.
- Privacy rules stay as they were: only the point rounded to 4 decimals is sent, cached and returned; census sectors
  under `MIN_HOUSEHOLDS` = 20 are withheld and left out of neighbourhood totals ([ADR 0009](0009-census-household-floor.md));
  no voter or household data.

Where it is written: `src/tools/placeAtPoint.ts`, `pointReads` in `src/sources/geocuritiba.ts`,
`test/placeFacade.test.ts`, CHANGELOG 0.32.0.

## Consequences

- A cold call with every part makes about 5 requests and is `partial` (the street, CRAS and neighbourhood totals wait
  for the next call, read from the cache). A caller that needs one part complete asks for it alone with `include`.
- A point inside the box but outside Curitiba costs one request per part included (each part decides on its own
  layer, as before) instead of stopping after the bairro layer.
- Parts stay in their modules (`censusAtPoint.ts`, `serviceAreasAtPoint.ts`); the facade composes them and owns no
  layer logic.
