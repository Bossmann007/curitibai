# SPEC: v0.85.0 Ouvidoria anonymity wording, fourth pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the Security Reviewer's R1-R4 on v0.83.0, in the
`city_service_guide` `ouvidoria` guide (`src/tools/cityServiceGuide.ts`). Text and tests only. No new citizen
question; the eval count is unchanged.

## Source

None new. No request is made; every changed sentence rests on the 0.43.0 record of the CGM's 2024 guide in
[docs/sources.md](docs/sources.md) or is marked as the CuritibAI's own observation.

## Changes

1. **R1** (step 4): "para continuar anônimo, deixe de fora …" becomes "para reduzir o risco de ser identificado,
   deixe de fora …".
2. **R2** (step 4): the list is "o que a denúncia não precisa", adds other people's names or faces, car plates,
   document numbers, e-mail, dates or places, and ends with "e qualquer detalhe que só você conheça".
3. **R4** (step 4): "a forma anônima não garante anonimato" becomes "o CuritibAI não pode garantir que a forma
   anônima proteja a sua identidade", still marked "Observação do CuritibAI, não do guia de 2024".
4. **R3** (`what`): one short sentence with the R4 wording, said of "a identidade do cidadão", and the "(observação do CuritibAI, não do guia de 2024)"
   marker. The `note` names the summary and step 4.
5. **Hedge test**: each sentence of `what` and step 4 that matches `/anônim|identific/` carries the 2024-guide hedge
   in the same clause ("guia de 2024 … o CuritibAI não conferiu hoje no site", no ";" between) or the
   CuritibAI-observation marker. Step 4's two "Pelo guia de 2024" sentences become one with one hedge; the summary's
   denúncia clause gains the hedge.
6. **Docs and version**: docs/sources.md, docs/tools.md, docs/roadmap-1.0.md, CHANGELOG 0.85.0, version 0.85.0 in
   `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Any new source, host, link or question. Opening the Curitiba Ouve site or the 2024 PDF. Any step that types or sends
something for the citizen.

## Check

- `npx vitest run test/cityServiceGuide.test.ts`: the 0.85.0 tests fail on 0.84.0 and pass on 0.85.0.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
