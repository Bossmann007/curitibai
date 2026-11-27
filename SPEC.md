# SPEC: v0.75.0 Ouvidoria anonymity wording

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the Security Reviewer's R1-R5 on v0.69.0: the
`city_service_guide` `ouvidoria` guide (q141, "Posso reclamar na Ouvidoria sem me identificar?") says more precisely
what the anonymous form does and does not cover, and every claim stays inside the docs/sources.md record of the 2024
CGM PDF.

## Source

None new. No request is made: `mid.curitiba.pr.gov.br` and the Curitiba Ouve site are not opened. Every fact comes
from the 0.43.0 record in docs/sources.md; the rest is marked as the CuritibAI's own observation.

## Changes (`src/tools/cityServiceGuide.ts`, text only)

1. **R1, step 4**: one sentence, marked "(observação do CuritibAI, não do guia de 2024)": the anonymous form only
   skips the registration; what the citizen writes or attaches (name, address, phone, a face, the location saved in
   a photo, the file name) can identify them, so they leave it out to stay anonymous.
2. **R2, step 5**: the sentence that sends a citizen to the anonymous form carries the hedge "segundo o guia de 2024,
   que o CuritibAI não conferiu hoje no site".
3. **R3, step 6**: the anonymous denúncia "é registrada", not "é apurada" (the record says a denúncia can be
   registered; it does not say it is investigated).
4. **R4, step 8 and `what`**: the 30 days carry "(não vale para a forma anônima, que não recebe resposta)"; `what`
   says "sem resposta nem acompanhamento" next to "forma anônima".
5. **R5, test** (`test/cityServiceGuide.test.ts`): each step 5 sentence that names the anonymous form must carry the
   R2 hedge; the pinned strings for R1, R3 and R4 are tested too.
6. **Docs and version**: docs/sources.md (a 0.75.0 paragraph), docs/roadmap-1.0.md, CHANGELOG 0.75.0, version 0.75.0
   in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Any new step, question, source, host or link; any change to what the citizen types or what the assistant sends (it
still writes and sends nothing). Re-reading the 2024 PDF or the Curitiba Ouve site.

## Check

- `npx vitest run test/cityServiceGuide.test.ts`: the R5 test fails on the 0.74.0 text and passes on 0.75.0.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
