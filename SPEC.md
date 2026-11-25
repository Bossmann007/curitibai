# SPEC: v0.46.0 CAPS and specialty centres with hours

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo.
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Onde fica o CAPS mais perto do Centro e qual o
horário?" with the CAPS's address, hours as published, 24-hour flag and phone, and give the hours of the municipal and
state specialty centres (medical and dental). The tool lists places; it does not triage or say which CAPS serves a
person. Every CAPS (and psychiatric stabilisation) answer starts with 192 (SAMU) or 193, then CVV 188.

## Source (read 2026-11-25)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` layers 135 "Centro de Atenção Psicossocial"
(13 records: 9 with `func_24hr` "Sim" and "Diariamente, 24 horas", 4 from 7h to 19h; some say which regionais they
serve), 132 "Centro de Especialidades Médicas" (10 records, municipal and state, Monday to Friday) and 133 "Centro de
Especialidades Odontológicas" (2 records; one record says "O encaminhamento ao Centro de Especialidades Odontológicas
se dá por meio das Unidades de Saúde."). robots.txt 404, no licence found (facts only, IPPUC cited, like the other
GeoCuritiba layers). CVV 188 (emotional support, 24 hours, no call cost) read by hand on cvv.org.br (robots.txt
allows `/`); the server never contacts it and no link is added. No new host. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same query, fields, host gate, cache and phone and
   e-mail allowlist as the other urban-equipment layers:
   - `caps` (135), aliases `centro de atencao psicossocial`, `centros de atencao psicossocial`;
   - `centro de especialidades medicas` (132), aliases `centros de especialidades medicas`, `especialidades
     medicas`;
   - `centro de especialidades odontologicas` (133), aliases `centros de especialidades odontologicas`, `ceo`,
     `especialidades odontologicas`.
   The bare `centro de especialidades` stays unresolved (medical or dental). No alias that implies a filter the tool
   does not apply (`caps infantil`, `caps ad`).
2. **Notes**. `caps` and `estabilizacao psiquiatrica` lead with the v0.45 emergency sentence followed by "Emotional
   support: CVV 188 (24 hours, free call)." CAPS: hours as published; `all_day` is the layer's flag; the nearest CAPS
   is not always the one that serves you (CAPS Infantil are for children and adolescents, some list the regionais
   they serve in `hours`): ask your health unit or call the CAPS. Medical specialty centres: municipal and state units
   as listed by IPPUC, some last updated in 2022; access usually needs a referral, check with your health unit
   (unidade de saude) and call before going. Dental: the layer says referral is through the health units. Both
   specialty notes say not for emergencies, 192 or 193, and that an ouvidoria@ e-mail is the SMS Ouvidoria's.
3. **Descriptions**: the `type` description names `caps` and the two specialty types; both descriptions within 400
   characters. Tool contract snapshot updated.
4. **Eval**: q124 "Onde fica o CAPS mais perto do Centro e qual o horário?" → `city_facilities_search` `{type:
   "caps", near: (a point in Centro), radius_m: 3000}`, synthetic fixture `test/fixtures/geocuritiba/caps_synthetic.json`
   (plus `centro_de_especialidades_medicas_synthetic.json` and `centro_de_especialidades_odontologicas_synthetic.json`
   for the unit tests). On the real layer two CAPS are within 3 km of that point.
5. **Docs and version**: README, docs/tools.md (row, which-tool row, Health information App row), docs/sources.md
   (layers 135, 132, 133, the robots.txt recheck, the cvv.org.br hand read), docs/roadmap-1.0.md, CHANGELOG 0.46.0,
   version 0.46.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Which CAPS serves an address (regional areas); filtering CAPS by kind (infantil, AD); scheduling or referrals; other
health layers; parsing hours into days or times; any new host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the aliases, bare `centro de
  especialidades` not a type, hours and flags as published, mobiles dropped, CVV 188 in the `caps` and
  `estabilizacao psiquiatrica` notes after the emergency sentence, the referral sentences, q124 answered.
- `node scripts/eval-summary.mjs`: `answered 120 / 124`.
- `scripts/verify` exits 0 on the PR head.
