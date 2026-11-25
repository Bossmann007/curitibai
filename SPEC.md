# SPEC: v0.43.0 Ouvidoria guide

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.43.0, a `city_service_guide` guide `ouvidoria` that closes the
eval gap `useful_phones`"). **This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer citizen eval q110 "Qual o telefone da Ouvidoria Geral do
Município?" and q072 "Qual o telefone da Ouvidoria da Prefeitura?" honestly: the official guide publishes no phone for
the Ouvidoria, so the answer is its channels, with official links and consent at every step
([ADR 0010](docs/adr/0010-service-guides-consent-at-every-step.md)). Never a phone number given as the Ouvidoria's.

## Source (read 2026-11-25)

"Ouvidoria da CGM – Guia de uso", the Prefeitura's PDF `https://mid.curitiba.pr.gov.br/2024/00446690.pdf` (4 pages,
created 2024-05-10; robots.txt 404). An official document: facts and link only, in this project's own words. Used: the
channels by subject (Portal Curitiba Ouve `https://www.curitiba.pr.gov.br/lei13460/`, e-mail
`falecomacgm@curitiba.pr.gov.br`), the three forms (identified, confidential, anonymous), the Central 156 protocol for
the identified form and the 30-day answer (Lei federal 13.460/2017). It names no phone for the Ouvidoria. The Curitiba
Ouve link was not opened (`www.curitiba.pr.gov.br` is never contacted). Details:
[docs/sources.md](docs/sources.md#city_service_guide-guides-and-official-links-for-services-that-need-a-login-bundled-since-0280).

## Changes

1. **Guide** `ouvidoria` (`src/tools/cityServiceGuide.ts`), from the 2024 PDF (`fromDocument`, dated 2026-11-25):
   ask the citizen (no personal data in the conversation); say that the guide publishes no phone and which channel
   fits which subject; the Carta page; the Portal Curitiba Ouve (step 4; a denúncia can also be registered there);
   the CGM e-mail as text the citizen sends from their own e-mail (step 5, consent, no link: the allowlist takes only
   https); the three forms; the Central 156 for the identified form's protocol (step 7); the 30-day answer; the PDF
   (step 9). The `note` says the source is from
   2024 and the channels may have changed.
2. **Carta routing**: `[["ouvidoria", "cgm"], ["ouvidoria", "controladoria"], ["ouvidoria", "geral", "municipio"],
   ["curitiba", "ouve"]]`, not the bare word (other offices have their own ouvidoria); `156` gets
   `notFor: ["ouvidoria"]`. Mirrored in `scripts/coverage-report.mjs` (`GUIDE_TERMS`, `GUIDE_NOT_FOR`).
3. **Eval**: q072 and q110 → `city_service_guide` `ouvidoria`; the `useful_phones` gap is gone; a unit test keeps
   `useful_phones` answering nothing for "ouvidoria" (what q072 pinned before).
4. **Curitiba App table**: the "Useful phones" row becomes "guide + official link, citizen acts": its other phones
   are data (`useful_phones`), and the Ouvidoria, the only reason it stayed partial at v0.40, now has the guide.
5. **Docs and version**: README, docs/tools.md (row, fixed-link table, useful phones row), docs/sources.md (new hand
   host row `mid.curitiba.pr.gov.br`), docs/roadmap-1.0.md, CHANGELOG 0.43.0, version 0.43.0 in `package.json`,
   `package-lock.json`, `server.json`, tool contract snapshot (the `service` enum).

## Out of scope

Any phone number for the Ouvidoria; opening the Curitiba Ouve page or any `www.curitiba.pr.gov.br` page; sending an
e-mail or a form; other offices' ouvidorias (Saúde, URBS); any request by the server; any new host.

## Check

- `npx vitest run test/cityServiceGuide.test.ts test/usefulPhones.test.ts test/coverageReport.test.ts
  test/contracts.test.ts test/eval`: the guide invariants, no phone-shaped number, the e-mail as text, the links at
  the step numbers the notes name, the envelope, Carta routing both ways.
- `node scripts/eval-summary.mjs`: `answered 117 / 121`; `node scripts/coverage-report.mjs --tools docs/tools.md`:
  16 of 18 Curitiba App rows covered.
- `scripts/verify` exits 0 on the PR head.
