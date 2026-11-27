# SPEC: v0.69.0 Ouvidoria anonymity

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Posso reclamar na Ouvidoria sem me identificar?" with
the existing `city_service_guide` `ouvidoria` guide (since 0.43.0).

## Source

Only the 0.43.0 record of "Ouvidoria da CGM – Guia de uso" (2024) in [docs/sources.md](docs/sources.md). No request
is made: no host is contacted, by hand or by the server. The CGM e-mail spelling matches that record; the PDF is not
re-read.

What the record settles and what it does not:

- Identified and confidential forms need an e-Cidadão account; the anonymous form needs none; the Curitiba Ouve site
  steps show the identified and anonymous forms.
- Not in the record: what the site asks today, and whether a plain reclamação (not a denúncia) can be anonymous.
  The guide says both were not verified.
- That an e-mail shows the sender's address is this project's own observation; the `note` says it is not the PDF's.

## Changes

1. **Guide text** (`src/tools/cityServiceGuide.ts`, `ouvidoria`): `what`, step 5, step 6 and `note` gain the
   sentences above. No new step; step numbers and links unchanged.
2. **Test** (`test/cityServiceGuide.test.ts`): the anonymity answer, its attribution and the not-verified parts.
3. **Eval**: q141 → `city_service_guide` `{service: "ouvidoria"}`, expect `guide`. The guide is bundled and makes no
   network call, so no fixture is needed. q140 is left to v0.68.0 (PR #83).
4. **Docs and version**: docs/tools.md, docs/sources.md, docs/roadmap-1.0.md, CHANGELOG 0.69.0, version 0.69.0 in
   `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Opening the Curitiba Ouve site or re-reading the PDF, a phone for the Ouvidoria, other offices' ouvidorias, any new
host or link.

## Check

- `npx vitest run test/cityServiceGuide.test.ts test/eval`: the anonymity test passes; q141 answers as a guide.
- `node scripts/eval-summary.mjs`: `answered 136 / 140`.
- `scripts/verify` exits 0 on the PR head; packed size under the `MAX_PACKED_BYTES` limit.
