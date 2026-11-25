# SPEC: v0.32.0 one place facade

Approved: Enzo 2026-11-24 (task brief "curitibai v0.32.0": "seguimos com emode", roadmap step "1.0 com fachada única de
lugares"). **This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

One tool answers "what is at this point": `place_at_point` gives the place, the service areas and the census of a
Curitiba point, so a client calls one tool instead of three and tools/list gets smaller. Proposed in PR #43.

## Changes

1. **Facade** (`src/tools/placeAtPoint.ts`, [ADR 0011](docs/adr/0011-one-place-facade.md)). Input `lat`, `lon`,
   `include?: ("place"|"service_areas"|"census")[]` (non-empty, default all), `areas?: "care"|"safety"|"all"`
   (default `care`). Output `{data: {point, place, service_areas, census, partial}, notes, license_note}`; each part
   is the old tool's `data` without the point, plus `source`, `source_url`, `checked_at`.
2. **One turn at the host gate per call** (`pointReads` in `src/sources/geocuritiba.ts`): the parts' requests go one
   at a time in the order asked, under one `startBy`. A part whose first request is cut, or fails while another
   answers, is null, `partial` true, with a note; no part answered is the first part's error.
3. **Removed from tools/list**: `service_areas_at_point`, `census_at_point`. Their code stays as the parts
   (`serviceAreasAt`, `censusAt`); `MIN_HOUSEHOLDS` = 20 and the withholding are unchanged (ADR 0009).
4. **Budget wording**: the place and care parts name a time-budget cut with `missingNote`, as safety and census did.
5. **Docs and version**: README (tool table, empty `CURITIBAI_REMOTE_DATA` line), docs/tools.md, docs/privacy.md,
   ADR 0011, CHANGELOG 0.32.0 (breaking), version 0.32.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

New layers or fields; changes to the host gate's limits; publishing; tags.

## Check

- `test/placeFacade.test.ts`: each `include` combination asks only its layers, first layer of each part first; a cold
  call reads every part's first layer and the budget cuts later layers (exact request order); a part past the budget
  is null with `partial` and the note; a point outside Curitiba answers `inside_curitiba` false in every part; a
  sector of 19 or 0 households stays withheld through the facade; every part failing is `source_unavailable`.
- `test/placeAtPoint.test.ts`, `test/serviceAreasAtPoint.test.ts`, `test/censusAtPoint.test.ts`: the old behaviour
  through `place_at_point` with one part in `include`.
- `test/contracts.test.ts`: the rewritten snapshot; every description at most 400 characters, the sum at most 9,600.
- `scripts/verify` exits 0 on the PR head.
