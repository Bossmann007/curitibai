# SPEC: v0.25.0 quality block, part 2 (shorter tool descriptions, size ceiling)

Approved: Enzo 2026-11-23 (roadmap "bloco de qualidade", task brief "curitibai v0.25.0 — bloco de qualidade, parte
2"). Scope frozen: tool and input-field description text, a size guard, docs and the version. No tool behaviour, name,
title, type, required field, enum, output or `outputSchema` changes.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Every `tools/list` costs the client's context window. At v0.24.1 the 25 descriptions take 15,561 characters and the
longest is 1,651 (raw length). Make each description say what the tool does, when to use it and its main input, in at most 400
characters, keep only what the model needs before calling (privacy, safety, preconditions), and add a guard so the
text cannot grow back unnoticed.

## Changes

1. **Descriptions** (`src/tools/*.ts`): every tool description is at most 400 characters (`description.length`, raw
   string). Kept in the description: what is sent where before the call (the rounded point sent to IPPUC, the search
   word sent to PNCP, "your position is never sent"), that `local_csv_summary` never returns data rows and refuses
   personal-looking columns, "not for emergencies" with the number, "not real-time", "not tax advice", the
   untrusted-text warning (short form), the local file a tool needs, and the cold-call time of `place_at_point`,
   `service_areas_at_point` and `guaira_events`. Moved out: the OSM licence credit of `places_search` (in its
   `attribution` and `license_note`), paging and timing
   details, and edge-case rules. Each moved clause is either already in `docs/tools.md` or added there under
   "Notes moved out of the tool descriptions". Response text (`note`, `license_note`) is not changed.
2. **Place tools** (`places_search`, `city_points_search`, `city_facilities_search`): one "Prefer this when…" sentence
   in each, so each overlapping kind of place has one tool:
   - `city_facilities_search`: any kind it has a type for (feiras, Ruas da Cidadania, libraries, parks, museums,
     Câmbio Verde, popular restaurants, cemeteries...), or when days, hours or a phone are needed. Live (IPPUC).
   - `city_points_search`: CMEIs, schools, bus terminals, regional offices, or every kind of city point near a
     position at once. Local URBS file, no hours.
   - `places_search`: police and fire stations, or when the other two find nothing (its other OSM categories,
     parks, libraries, schools, community centres, town halls, bus stations and marketplaces, overlap kinds the other
     two own).
   Public health units go to `health_units_search` (named in `places_search`). Names are a contract: no tool is merged or renamed.
3. **Input-field descriptions**: only redundant text is cut (a clause repeated in the field and in the tool
   description, or OSM tag names repeated per category). No type, name, required flag, enum or default changes.
   The contract snapshot is rewritten on purpose with `npm run contracts:update`; CHANGELOG says only text changed.
   Proof: the old and new `test/fixtures/tool-contracts.json` are deep-equal once every `description` key is removed.
4. **Size guard** (`test/contracts.test.ts`): fails when any description is over 400 characters (naming the tool and
   its length) or when the descriptions sum (same measure as the baseline: `JSON.stringify(description).length`
   summed) is over the ceiling below. The test also prints the 5 numbers of the baseline.
5. **outputSchemas in the client's context**: assessed, not changed (see below).
6. `test/osm.test.ts`: the `places_search` description no longer carries the police note (it stays in every police
   result's `note`); the assertion on the description is removed on purpose.
7. Docs: `docs/tools.md` (moved notes), `docs/development.md` (the guard), CHANGELOG 0.25.0, version 0.25.0 in
   `package.json` and `package-lock.json`.

## Size (`tools/list`, 25 tools, characters)

| Part | v0.24.1 | v0.25.0 |
|---|---|---|
| tools | 25 | 25 |
| descriptions | 15,561 | 8,694 (−44%) |
| inputSchemas | 19,636 | 19,532 |
| outputSchemas | 63,226 | 63,226 (unchanged) |
| total (`tools/list` result) | 107,011 | 100,040 |

Ceiling on the descriptions sum: 9,600 (8,694 plus about 10%, rounded up to a hundred), below the 25 × 400 = 10,000
that the per-tool limit alone would allow, so a new tool or a longer description needs a deliberate change to it.
Longest description (raw `description.length`): 400 or fewer for all 25 (v0.24.1: 1,651).

## outputSchemas in the client's context

Não verificado. No client was checked against this server in this version for whether it puts `outputSchema` in the
model's context (Claude Code's own MCP tool definitions shown to the model in the working session carried only name,
description and input parameters, but none of the servers loaded there was confirmed to declare an `outputSchema`, so
that does not settle it). outputSchemas are not cut in this version.

## Out of scope

Changing outputSchemas, response text, tool behaviour, names or titles; merging the place tools; a ceiling on
inputSchemas or the total; creating the `v0.25.0` tag.

## Check

- `scripts/verify` exits 0 (the guard runs in its vitest step).
- The guard fails with the expected message when one description is made 401 characters long, and passes again when
  restored. Output in the PR body.
- Old and new contract snapshots are deep-equal without `description` keys; `outputSchemas` is still 63,226.
