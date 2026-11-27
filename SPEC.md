# SPEC: v0.79.0 Ouvidoria anonymity wording, second pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the Security Reviewer's R1-R3 on v0.75.0: the
`city_service_guide` `ouvidoria` guide keeps what the 2024 CGM guide says apart from what the CuritibAI observes, and
warns in every place it talks about not identifying oneself that the text and the attachments can identify the
citizen. No new citizen question; the eval count is unchanged.

## Source

None new. No request is made: `mid.curitiba.pr.gov.br` and the Curitiba Ouve site are not opened. Every fact comes
from the 0.43.0 record in docs/sources.md; the rest is marked as the CuritibAI's own observation.

## Changes (`src/tools/cityServiceGuide.ts`, text only)

1. **R1, `what` and step 5**: one sentence each, marked "(observação do CuritibAI, não do guia de 2024)": the text
   and the attachments can identify the citizen (in step 5, those of the e-mail). The `note` says the observation is
   the project's own for the summary and steps 4 and 5.
2. **R2, step 4**: "Pelo guia de 2024, a forma anônima não pede cadastro [...] (o CuritibAI não conferiu isso hoje no
   site)" is its own sentence; the CuritibAI's warning follows in a separate sentence that starts "Observação do
   CuritibAI, não do guia de 2024:". docs/sources.md says the same.
3. **R3, step 4**: the same 2024-guide sentence says the anonymous form "não recebe resposta nem acompanhamento".
4. **Test** (`test/cityServiceGuide.test.ts`): each step 5 sentence matching `/anônim|identific/` carries the
   2024-guide hedge or the CuritibAI's own marker; step 4 has no sentence that mixes the registration or the answer
   with the CuritibAI's observation; the new `what`, step 4, step 5 and `note` strings are pinned.
5. **Docs and version**: docs/sources.md (a 0.79.0 paragraph), docs/tools.md (the Curitiba Ouve link row),
   docs/roadmap-1.0.md, CHANGELOG 0.79.0, version 0.79.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Any new step, question, source, host or link; any change to what the citizen types or what the assistant sends (it
still writes and sends nothing). Re-reading the 2024 PDF or the Curitiba Ouve site.

## Check

- `npx vitest run test/cityServiceGuide.test.ts`: the pinned step 4 test fails on the 0.78.0 text and passes on 0.79.0.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
