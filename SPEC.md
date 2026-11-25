# SPEC: v0.45.0 UPAs and public hospitals with hours

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo.
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Qual UPA perto do Boqueirão funciona 24 horas?" with
the UPA's address, hours as published, 24-hour flag and phone. The tool lists places; it does not triage. Every
answer for these types says: in an emergency call 192 (SAMU) or 193 (Bombeiros).

## Source (read 2026-11-25)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 130 "Unidade de Pronto Atendimento"
(9 records, all `func_24hr` "Sim", hours text "Diariamente, 24 horas"), 129 "Hospital (público)" (10 records; the
`func_*` flags and hours text are uneven: some records have every flag "Não" and no text, two were last updated in
2016) and 131 "Unidade de Estabilização Psiquiátrica" (1 record, 24 hours). robots.txt 404, no licence found (facts
only, IPPUC cited, like the other GeoCuritiba layers). No new host. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers:
   - `upa` (130), aliases `upas`, `unidade de pronto atendimento`, `unidades de pronto atendimento`, `pronto
     atendimento`, `upa 24h`, `upa 24 horas`;
   - `hospital publico` (129), aliases `hospitais publicos`. The bare `hospital` stays unresolved:
     the layer is one publisher's list of 10 public hospitals, not every hospital in Curitiba;
   - `estabilizacao psiquiatrica` (131), aliases `unidade de estabilizacao psiquiatrica`, `unidades de estabilizacao
     psiquiatrica`.
   Each type's note starts with the emergency sentence (192 SAMU or 193; this tool lists places, it does not
   triage), through a new optional `leadNote` put before the general note, and says an ouvidoria@ e-mail is the SMS
   Ouvidoria's. UPA: `open_periods.all_day` is the layer's flag, `hours` the detail (dental urgency hours differ).
   Hospital: the flags and hours are uneven, so `all_day: false` or no hours does not mean closed or not 24 hours;
   being listed does not mean open to walk-ins; check `updated` and call the hospital. Psychiatric stabilisation: an
   SMS unit, check by phone or the 156.
2. **Cross-references**: the `unidade de saude` note and `health_units_search` description point to `upa` and
   `hospital publico` instead of "no UPAs or hospitals". Descriptions within 400 characters. Tool contract snapshot
   updated.
3. **Eval**: q123 "Qual UPA perto do Boqueirão funciona 24 horas?" → `city_facilities_search` `{type: "upa", near:
   (a point in Boqueirão), radius_m: 3000}`, with the synthetic fixture `test/fixtures/geocuritiba/upa_synthetic.json`
   (plus `hospital_publico_synthetic.json` and `estabilizacao_psiquiatrica_synthetic.json` for the unit tests).
4. **Docs and version**: README, docs/tools.md, docs/sources.md (layers 130, 129, 131 and the robots.txt recheck),
   docs/roadmap-1.0.md, CHANGELOG 0.45.0, version 0.45.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

CAPS, specialty centres and other health layers; private hospitals; parsing hours into days or times; triage or
"which place should I go to" advice; any new host.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases, bare `hospital` not a
  type, hours and flags returned as published, the emergency sentence in each of the three notes, q123 answered.
- `node scripts/eval-summary.mjs`: `answered 119 / 123`.
- `scripts/verify` exits 0 on the PR head.
