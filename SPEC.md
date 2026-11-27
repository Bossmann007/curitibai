# SPEC: v0.83.0 Ouvidoria anonymity wording, third pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the Security Reviewer's R1-R2 on v0.79.0: in the
`city_service_guide` `ouvidoria` guide, step 4 tells the citizen concretely what to leave out to stay anonymous, and
says that the anonymous form does not guarantee anonymity. No new citizen question; the eval count is unchanged.

## Source

None new. No request is made: `mid.curitiba.pr.gov.br` and the Curitiba Ouve site are not opened. Both changed
sentences are marked as the CuritibAI's own observation; every 2024-guide fact and hedge stays as it was.

## Changes (`src/tools/cityServiceGuide.ts`, text only)

1. **R1, step 4**: "o texto e os anexos (nome, ...) podem identificar o cidadão; para continuar anônimo, deixe isso de
   fora" becomes "o texto e os anexos podem identificar o cidadão; para continuar anônimo, deixe de fora nome,
   endereço, telefone, rosto, a localização gravada na foto e o nome do arquivo", still marked "Observação do
   CuritibAI, não do guia de 2024".
2. **R2, step 4**: a new sentence, "Observação do CuritibAI, não do guia de 2024: a forma anônima não garante
   anonimato, e o CuritibAI não sabe o que o site registra sobre o acesso." The `note` says it is the project's own.
3. **Test** (`test/cityServiceGuide.test.ts`): both step 4 sentences are pinned with their marker in the same
   sentence; no text of the guide says "deixe isso de fora"; the `note` line is pinned. The step 5 hedge test and the
   step 4 mixing check are unchanged and green.
4. **Docs and version**: docs/sources.md (a 0.83.0 paragraph), docs/tools.md (the Curitiba Ouve link row),
   docs/roadmap-1.0.md, CHANGELOG 0.83.0, version 0.83.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Any new step, question, source, host or link; any change to what the citizen types or what the assistant sends (it
still writes and sends nothing). Re-reading the 2024 PDF or the Curitiba Ouve site. The `what` and step 5 wording.

## Check

- `npx vitest run test/cityServiceGuide.test.ts`: the pinned step 4 test fails on the 0.82.0 text and passes on 0.83.0.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
