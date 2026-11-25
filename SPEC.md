# SPEC: v0.38.0 Lê Digital and EstaR guides

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.38.0, phase B of docs/roadmap-1.0.md"). **This change publishes
nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): close the Curitiba App gaps Curitiba Lê Digital and EstaR with
hand-written guides in `city_service_guide`, with the same per-step consent as the existing guides
([ADR 0010](docs/adr/0010-service-guides-consent-at-every-step.md)).

## Changes

1. **Guides** (`src/tools/cityServiceGuide.ts`): `le_digital` (open the Carta page, the Prefeitura's news page that
   names Lê Digital, install the Curitiba App, log in or register, find and download the book) and `estar` (Carta
   page, the URBS EstaR page, install a URBS-credentialed app or go to a sales point, log in or register, register the
   plate, buy credits, activate the time, a notice of irregularity through the URBS page or the Central 156). Every
   step that leaves the conversation has `needs_consent` and a fixed consent text; login, personal data (CPF, plate),
   payment and activation are separate steps. EstaR's payment step names the app or the sales point, not the bank.
   No price, fine, hour or time limit is stated (the sources are from 2020–2021 and disagree).
2. **Guide note and date**: `GuideDef` gains optional `note` (said before the consent rule, also with `open_step` and
   on the `carta_id` route) and `fromWebSearchAt` (the envelope's `checked_at`, 2026-11-25 for the new guides, and a
   licence note saying the guide was written from web search results and its official pages were not all read). The
   EstaR note says the URBS page was not read (403 to non-browser clients); the Lê Digital note says no web page of
   Lê Digital itself was found, so the in-app steps were not checked. Both fall back to the Carta step and the
   Central 156. EstaR's app login step is conditional ("Se usar o aplicativo"), since a sales point needs none.
3. **Links**: only hosts the allowlist already accepts (`www.urbs.curitiba.pr.gov.br`, `www.curitiba.pr.gov.br`,
   `156.curitiba.pr.gov.br`). No app-store link. The server makes no request; no new host in `src/`.
4. **Carta words** (narrow, because a hand-written guide overrides a generated one): `le_digital` `[["le",
   "digital"]]`, `estar` `[["estar", "estacionamento", "regulamentado"]]` (not the verb "estar" alone, and not other services such
   as a credential that only say "estacionamento regulamentado"); since 0.38.1 also `["est", "r", "estacionamento"]`
   ("Est@R"), and a title with `aviso`, `irregularidade`, `recurso`, `notificacao`, `multa`, `defesa` (or a plural)
   never gets `estar` (`notFor`); same Carta words in
   `scripts/coverage-report.mjs` `GUIDE_TERMS`.
5. **`cleanCartaText`**: after the masks and markers, every `]:` becomes `] :` too, so no Markdown reference
   definition forms (low finding of the v0.37 reviews); the text is cut again when those breaks take it over the cap.
6. **Eval**: q100, q101 (`le_digital`), q104, q105 (`estar`) move from gaps to guide answers.
7. **Docs and version**: `docs/tools.md` (row, fixed-link table, the comparison table rows), `docs/sources.md`,
   `docs/roadmap-1.0.md`, README, CHANGELOG 0.38.0, version 0.38.0 in `package.json`, `package-lock.json`,
   `server.json`, tool contract snapshot (the `service` enum).

## Out of scope

A catalogue of Lê Digital titles; EstaR prices, hours or areas; any fetch of `www.curitiba.pr.gov.br` or
`servicos.curitiba.pr.gov.br`; the other Curitiba App gaps (Defesa Civil alerts, real-time buses).

## Check

- `npx vitest run test/cityServiceGuide.test.ts test/cartaGuide.test.ts`: the guide invariants over the new guides,
  EstaR's four separate consent steps (login, plate, payment, activation), no number in EstaR, the notes, the narrow
  Carta words, `]:` never in cleaned text (also after a cut).
- `node scripts/eval-summary.mjs`: `citizen eval: answered 108 / 119`; `node scripts/coverage-report.mjs`: 13 of 18
  Curitiba App rows covered.
- `scripts/check-no-catalog` passes; `scripts/verify` exits 0 on the PR head.
