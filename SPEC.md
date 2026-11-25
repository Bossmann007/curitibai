# SPEC: v0.33.0 null when not asked outside Curitiba; school calendar checked

Approved: Enzo 2026-11-24 (task brief "curitibai v0.33.0": "segue com emode"; vision: everything a Curitiba citizen
needs). **This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

1. An assistant reading `place_at_point` can trust the 0.32.0 rule everywhere: empty means the layer was read and
   nothing covers the point; null means the list was not read. Outside Curitiba, the lists whose layers are not asked
   came back empty; they are now null.
2. The Curitiba App has the municipal school calendar and CuritibAI does not. Find whether the Secretaria Municipal
   da Educação publishes it in a form a tool may read, and build the tool only if it does.

## Changes

1. **Null outside Curitiba** (`src/tools/serviceAreasAtPoint.ts`, `src/tools/placeAtPoint.ts`): when the point is
   outside Curitiba, `cras` (care), `police_civil` and `fire` (safety) and `place.zoning` are null. `health_units`
   and `police_military` stay empty there, because their layers are read to decide `inside_curitiba`. Descriptions
   say so; contract snapshot rewritten.
2. **School calendar: no tool.** educacao.curitiba.pr.gov.br was read by hand on 2026-11-25 inside its robots.txt
   Visit-time (02:00–06:00 UTC), three requests at least 5 s apart: `/robots.txt`, `/` and
   `/evento/calendarios-do-ano-letivo-2026/18401/4180`. The 2026 page has no dates, only links to three PDFs; the
   2027 calendars are one PDF; all on mid-educacao.curitiba.pr.gov.br. The robots.txt disallows `*.pdf`, so the brief's
   stop rule applies: no collector, no tool.
3. **Docs and version**: docs/tools.md (place lists wording, "School calendar" row), docs/sources.md (robots.txt row
   with the read times), CHANGELOG 0.33.0, version 0.33.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Reading any PDF or mid-educacao.curitiba.pr.gov.br (its robots.txt was not read); bundling calendar dates from news
pages; publishing; tags.

## Check

- `test/serviceAreasAtPoint.test.ts`, `test/placeAtPoint.test.ts`, `test/placeFacade.test.ts`: outside Curitiba the
  lists not asked are null with `care`, `safety` and `all`, and `place.zoning` is null; the request order is unchanged.
- `test/contracts.test.ts`: the rewritten snapshot; every description at most 400 characters, the sum at most 9,600.
- `scripts/verify` exits 0 on the PR head.
