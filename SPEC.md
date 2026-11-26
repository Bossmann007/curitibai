# SPEC: v0.65.0 IPTU Planta Genérica de Valores micro-region at a point

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Em qual microrregião da Planta Genérica de Valores do
IPTU fica o Portão?" with the PGV 2025 micro-region that contains a point, as IPPUC publishes it. Codes and names
only: never a land or property value, never an IPTU amount, never a lot.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `GeoCuritiba/Publico_GeoCuritiba_Planta_Generica_Valores/MapServer` layer 0 "Microrregião (PGV
2025)" (1,062 polygons); layer 1 "Indice de Infraestrutura Urbana (PGV 2025)" is not read. robots.txt 404 (2026-11-26
23:48:30 UTC, User-Agent `curitibai-mcp/0.65`); the service's `description` and `copyrightText` are empty, so no
licence found (facts only, IPPUC cited, like the other GeoCuritiba layers). No new host, no new link. Details:
[docs/sources.md](docs/sources.md#place_at_point-ippuc-geocuritiba-cadastral-map-since-0220).

What the read showed and how this version handles it:

- `cd_microrregiao` is not an identifier on its own: it is 0 in 870 of the 1,062 polygons (then 1, 2, 3 and null for
  34), an index inside a zone and micro-bairro (`chave` = `sg_zona`-`cd_microbairro`-`cd_microrregiao`, e.g.
  "EE-27.0-0" at the Portão). So the answer adds `cd_microbairro` to the brief's field list and returns the zone,
  micro-bairro and micro-region codes together. `chave` is not read (it repeats them).
- `vukt` and `cod_vukt` have the alias "VUKT (Valor Unit. Característico de Terreno)" and no unit, date or use in the
  metadata. Their meaning is not confirmed, so they are never requested (the brief's rule).

## Changes

1. **Layer** `pgv` in `POINT_LAYERS` (`src/sources/geocuritiba.ts`): `PGV_SERVICE_URL` layer 0, fields `sg_zona,
   nm_zona,nm_bairro,cd_microbairro,cd_microrregiao`, the same point query, host gate and cache as the other layers.
2. **Field** `pgv` in the `place` part (`src/tools/placeAtPoint.ts`): `{micro_regions: [{zone_code, zone_name,
   bairro, microbairro, microregion}], source_url}`; rows distinct, at most 5; `microregion` an integer or null (0 is
   kept); `[]` when no polygon contains the point; `pgv` null when outside Curitiba or not read (then `partial`). Read
   last, after the street, so the call budget cuts it first. Note: the micro-region is not a property value or an IPTU
   amount (when no row: a note saying no polygon contains the point); a boundary note when more than one row. The missing-layers note lists several layers ("the zoning, street
   and PGV layers"). Tool description names the micro-region and stays under 400 characters.
3. **Eval**: new q137 → `place_at_point` `{lat: -25.4766, lon: -49.2925, include: ["place"]}`, synthetic PGV answer
   in `test/eval/world.ts`. Tool contract snapshot updated.
4. **Docs and version**: docs/tools.md (place row, budget line, "which tool" row), docs/sources.md (robots recheck,
   PGV paragraph with the three whole-layer queries run by hand to learn the codes), README row,
   docs/roadmap-1.0.md, CHANGELOG 0.65.0, version 0.65.0 in `package.json`, `package-lock.json`, `server.json`. The
   Curitiba App table has no row for this and is unchanged.

## Out of scope

`vukt`, `cod_vukt`, layer 1 (infrastructure index), any lots or parcel layer, any IPTU amount or property value, the
IPTU guide (`city_service_guide`), any new host.

## Check

- `npx vitest run test/placeAtPoint.test.ts test/placeFacade.test.ts test/contracts.test.ts test/eval`: the PGV URL is
  layer 0 of the `GeoCuritiba/` folder service with only the five fields (no `vukt`, no `where`); micro-region 0 stays
  0, a missing code is null, rows are distinct; empty is `[]` and not partial; a PGV failure is partial with the rest
  kept; a cold full call cuts the street and PGV layers first; q137 answered.
- `node scripts/eval-summary.mjs`: `answered 133 / 137`.
- `scripts/verify` exits 0 on the PR head; packed size under the `MAX_PACKED_BYTES` limit.
