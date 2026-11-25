# SPEC: v0.37.0 generated guides for every Carta service

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.37.0, phase C of docs/roadmap-1.0.md"). **This change publishes
nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Gate 2 of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): every Carta de Serviços service reachable. When a citizen asks
how to get a Prefeitura service with no hand-written guide, `city_service_guide` builds one from the user's local Carta
copy (`CURITIBAI_DATA_DIR/carta-servicos.json`), with the same per-step consent markers as the hand-written guides
([ADR 0012](docs/adr/0012-generated-carta-guides.md)).

## Changes

1. **Input** (`src/tools/cityServiceGuide.ts`): `service` becomes optional; new optional `carta_id` (integer, the `id`
   of `city_services_search`). Exactly one of the two, else `invalid_argument`. Why not a new tool: same answer shape,
   consent rule, allowlist and `open_step` ([ADR 0005](docs/adr/0005-extend-a-tool-before-adding-one.md)).
2. **Priority**: when the service title has every word of a hand-written guide's Carta query (`handWrittenFor`), that
   guide is returned, with a note.
3. **Generated guide** (`cartaGuideResult`, `generatedGuide`): fixed steps only: the first step in the conversation,
   the official Carta page, the online service when its link passes `allowedUrl`, then login, data and documents,
   send, pay, each "if the site asks" with `needs_consent` and a fixed consent text. `service` `carta`, `generated`
   (`carta_id`, `captured`, `reviewed_by_hand: false`), `carta_text`, `checked_at` the copy's date, the Carta licence
   note. The elicitation message names the Carta id and the host, never Carta text.
4. **Untrusted text** (`cleanCartaText`): control and format characters removed; entities decoded, then tags and
   `<`/`>` removed; Markdown links reduced to their text; link-like tokens that fail `allowedUrl` become
   `[link removido]`; `cleanField` masks contact and CPF/CNPJ shapes and cuts at 300 code points (title 120).
5. **No copy / invalid copy / unknown id**: no steps; `carta.status` and `carta.message` (`CARTA_HOW_TO` when absent)
   and `available_guides`. No network call, no new host.
6. **Copy format** (`src/tools/cityServicesSearch.ts`): optional item fields `who`, `how`, `documents`, `channels`,
   `cost` (string or list of strings; anything else ignored; kept raw up to 8,000 characters, cleaned on output).
   `city_services_search` output unchanged. `OFFICIAL_URL` exported.
7. **Scoreboard** (`scripts/coverage-report.mjs`): `classifyService(title, url)`; a service whose `url` matches
   `GENERIC_GUIDE_URL` (equal to `OFFICIAL_URL`, test) and has no data rule or hand-written guide is guide via
   `city_service_guide carta_id (generated)`, counted also as `guide_generated`.
8. **Eval**: q115–q119 in `test/eval/citizen-questions.json` (synthetic ids 9008, 9005, 9004, 9009, 9008 with
   `open_step`). The fixture gains the optional fields on 9008 and item 9009 ("IPTU inventado para teste"); its pin in
   `scripts/check-no-catalog` is updated.
9. **Docs and version**: `docs/tools.md` (row and the consent steps table), `docs/local-data.md`, `docs/privacy.md`,
   `docs/sources.md`, `docs/roadmap-1.0.md`, README, ADR 0012, CHANGELOG 0.37.0, version 0.37.0 in `package.json`,
   `package-lock.json`, `server.json`, tool contract snapshot.

## Out of scope

New hand-written guides; reading full service pages (the copy stays a file the user saves by hand); any fetch of
`www.curitiba.pr.gov.br` or `servicos.curitiba.pr.gov.br`.

## Check

- `npx vitest run test/cartaGuide.test.ts test/cityServiceGuide.test.ts test/eval`: generated guide shape, cleaning
  cases, hand-written priority, no copy, hostile Carta text kept out of steps and elicitation, the guide invariants
  over generated guides, the scoreboard rule equal to the tool's; `citizen eval: answered 104 / 119`.
- `scripts/check-no-catalog` passes; `scripts/verify` exits 0 on the PR head.
