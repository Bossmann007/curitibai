# SPEC: v0.57.0 Registry areas at a point (registro civil and registro de imóveis)

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Qual cartório de registro de imóveis atende uma casa
no Batel?" with the circunscrição imobiliária and the registro civil serviço whose area covers the point, as IPPUC
publishes them, with the legal basis field. The answer names the area only: no office address or phone (the layers
have none), no certidão, no promise that the area is current.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `Publico_Interno_GeoCuritiba_BaseTematica/MapServer` (the thematic service `place_at_point`
already reads), layers 16 "Registro Civil" (19 polygons, `returnCountOnly`) and 15 "Circunscrição Imobiliária" (12).
robots.txt 404 (19:26:36 UTC); the layers' metadata has empty `copyrightText` and `description`, so no licence found
(facts only, IPPUC cited, like the other GeoCuritiba layers). No new host, no new link. A point query in the Batel
(-25.4425, -49.288) answered `servicos` "4º SERVIÇO DE REGISTRO CIVIL" with `fonte` "Leis Estaduais 4667/1962, 5409/1966,
5481/1967, 5809/1968, 8894/1988 e Acordo 10156/2005" (layer 16) and `circunscricao` "6ª CIRCUNSCRIÇÃO" with `fonte`
"Tribunal de Justiça, 1968" (layer 15). Layer 15 also has `created_user` and `last_edited_user` (user names) and both
have a `nome` field (null in the sample; unknown content): none of them is ever requested.

## Changes

1. **Layers** in `POINT_LAYERS` (`src/sources/geocuritiba.ts`): `property_registry` (15, `outFields`
   `circunscricao,fonte`) and `civil_registry` (16, `servicos,fonte`). Same point query, host gate and cache.
2. **Group** `registry` in `place_at_point` `areas` (`src/tools/placeAtPoint.ts`, `src/tools/serviceAreasAtPoint.ts`):
   the property layer first; when it has no area, the bairro layer decides `inside_curitiba` (as `safety`); then the
   civil layer, whose failure is only `partial`. New lists `property_registry` (`circumscription`, `legal_basis`) and
   `civil_registry` (`service`, `legal_basis`), distinct, at most 3; null when the group was not asked. `legal_basis`
   is `fonte` as published, kept up to 254 characters. 2 requests cold (3 when no property area contains the point).
3. **`all` stays care and safety.** A cold `all` today fits its 5 requests in the 20 s call budget (5 s apart);
   adding registry would cut the fire layer on every cold call. The enum and the docs say `all` is care and safety and
   that `registry` is asked on its own.
4. **Note**: the areas are as IPPUC publishes them with their legal basis and may have changed; they name the
   registry that covers the point, not its address; they do not replace a certidão from the registry itself; for
   registro civil office addresses and hours, `city_facilities_search` `cartorio de registro civil`.
5. **Eval**: new q132 "Qual cartório de registro de imóveis atende uma casa no Batel?" → `place_at_point`
   `{lat: -25.4425, lon: -49.288, include: ["service_areas"], areas: "registry"}`, expecting
   `data.service_areas.property_registry.0.circumscription` and its `legal_basis`; synthetic bodies in
   `test/eval/world.ts`. Tool contract snapshot updated.
6. **Docs and version**: docs/tools.md, docs/sources.md, docs/roadmap-1.0.md, CHANGELOG 0.57.0, version 0.57.0 in
   `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no registry row and is unchanged.

## Out of scope

Which tabelionato or office name holds a property's matrícula; office addresses or phones for registro de imóveis;
certidões, prices or deadlines; mapping the circunscrição ordinal to a named office; adding registry to `all`; any
new host or link.

## Check

- `npx vitest run test/serviceAreasAtPoint.test.ts test/placeFacade.test.ts test/contracts.test.ts test/eval`: the
  registry layers are asked with `outFields` `circunscricao,fonte` and `servicos,fonte` only (no `created_user`,
  `last_edited_user` or `nome`); `areas: "registry"` returns both lists in 2 requests; outside Curitiba the civil layer
  is not asked; a civil-layer failure is partial; `all` still asks care and safety only; q132 answered.
- `node scripts/eval-summary.mjs`: `answered 128 / 132`.
- `scripts/verify` exits 0 on the PR head; packed size under 252,000 bytes.
