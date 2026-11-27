# SPEC: v0.66.0 Electoral zone at a point

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Qual zona eleitoral cobre o Boqueirão?" with the TRE-PR
electoral zone whose area contains a point, as IPPUC publishes it. Zone and published counts only: never the number of
voters, never a given voter's own zone or section.

## Source (read 2026-11-27 UTC)

IPPUC GeoCuritiba, `GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer` layer 13 "Zona Eleitoral" (10
polygons, `data_alteracao` 31/08/2026, `fonte` TRE-PR). robots.txt 404 (2026-11-27 00:06:53 UTC, User-Agent
`curitibai-mcp/0.66`); `description` and `copyrightText` empty, so no licence found (facts only, IPPUC and TRE-PR
cited, like the voting places of layer 12). No new host, no new link. Details:
[docs/sources.md](docs/sources.md#place_at_point-ippuc-geocuritiba-cadastral-map-since-0220).

What the read showed and how this version handles it:

- `num_locais` and `num_secoes` are doubles (45.0): returned as whole numbers, null for anything that is not a
  non-negative whole number.
- `num_eleitores` is a field of the layer: never requested (the voting places' rule). `codigo` and `fonte` are not
  requested either: the credit names TRE-PR from the voting places' constant.

## Changes

1. **Layer** `electoral_zone` in `POINT_LAYERS` (`src/sources/geocuritiba.ts`): thematic layer 13, fields
   `zona_eleitoral,num_locais,num_secoes,data_alteracao`, the same point query, host gate and cache as the other
   layers.
2. **Group** `civic` in `place_at_point` `service_areas` (`src/tools/serviceAreasAtPoint.ts`, `placeAtPoint.ts`):
   `areas: "civic"` returns `electoral_zones: [{zone, polling_places, sections, reference_date}]` (distinct by zone, at
   most 3); every other list null, and `electoral_zones` null for the other groups. The zone layer is asked first;
   when it is empty the bairro layer decides `inside_curitiba`. Source "Fonte: IPPUC/GeoCuritiba (TRE-PR)". Note: the
   zone covers the point and is not necessarily where a person votes (the título de eleitor says that), a bairro can
   span more than one zone, voting places are `city_facilities_search` `local de votacao`; plus the empty, outside and
   boundary notes. `all` stays care and safety. Tool description names `civic` and stays under 400 characters.
3. **Eval**: new q138 → `place_at_point` `{lat: -25.5036, lon: -49.2386, include: ["service_areas"], areas:
   "civic"}`, synthetic zone in `test/eval/world.ts`. Tool contract snapshot updated.
4. **Docs and version**: docs/tools.md (service_areas row, budget line, "which tool" row), docs/sources.md (robots
   recheck, electoral zone paragraph with the hand requests), README row, docs/roadmap-1.0.md, CHANGELOG 0.66.0,
   version 0.66.0 in `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no row for this
   and is unchanged.

## Out of scope

`num_eleitores`, `codigo`, `fonte`, any voter's own zone or section, the voting places (unchanged, layer 12), adding
`civic` to `all`, any new host or link.

## Check

- `npx vitest run test/serviceAreasAtPoint.test.ts test/placeFacade.test.ts test/contracts.test.ts test/eval`: the
  layer 13 URL has only the four fields (no `num_eleitores`); counts are whole numbers or null; the cold `civic` call
  is 1 request; empty inside and outside Curitiba; boundary; a failing zone layer is `source_unavailable`; `all` does
  not ask layer 13 and its `electoral_zones` is null; q138 answered.
- `node scripts/eval-summary.mjs`: `answered 134 / 138`.
- `scripts/verify` exits 0 on the PR head; packed size under the `MAX_PACKED_BYTES` limit.
