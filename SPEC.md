# SPEC: v0.87.0 Ouvidoria anonymity wording, fifth pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): the fifth and final wording pass on the `city_service_guide`
`ouvidoria` guide (`src/tools/cityServiceGuide.ts`), the review follow-ups of 0.85.0 (PR #100). Text and tests only.
No new citizen question; the eval count is unchanged.

## Source

None new. No request was made: Curitiba Ouve and the 2024 PDF were not opened. Every changed sentence is the
project's own observation, marked "(observação do CuritibAI, não do guia de 2024)" or "Observação do CuritibAI, não
do guia de 2024".

## Changes

1. **No promise of anonymity** (test): no text of the guide (title, `what`, `note`, every step's action and consent)
   matches the brief's pattern (`garante( o seu)? anonimato|protege (você|a sua identidade)|ninguém saberá|totalmente
   anônim`), widened in review to other indicative forms ("garante seu anonimato", "assegura o anonimato", "protege
   sua identidade", "protege o cidadão", "ninguém vai saber", "100% anônim"), even in a sentence with the CuritibAI
   mark. Only indicative verbs match, so the guide's own "não pode garantir que … proteja" does not; the test asserts
   both sides.
2. **Step 4 list**: "datas ou lugares" becomes "datas ou lugares que identifiquem o cidadão" (the denúncia needs who,
   when and where). docs/sources.md says so in a fifth-pass entry.
3. **Step 5**: the sentence that sends a citizen who does not want to be identified to the anonymous form ends with
   "; o CuritibAI não pode garantir que a forma anônima proteja a identidade do cidadão (observação do CuritibAI, não
   do guia de 2024)". The `note` names the summary and steps 4 and 5.
4. **One grammatical person**: "o cidadão" in `what` and steps 4 and 5 (step 4's "a sua identidade", "deixe de fora"
   and "só você conheça" become "a identidade do cidadão", "o cidadão pode deixar de fora" and "só o cidadão
   conheça"). The brief gave item 2 as "que identifiquem você" and let this item pick the person; "o cidadão" was
   picked because `what` and the other steps already use it, so item 2 reads "que identifiquem o cidadão". Tested: no
   "você", "deixe", "sua identidade" or "seu nome" in those three fields.
5. **Docs and version**: docs/sources.md, docs/tools.md, docs/roadmap-1.0.md, CHANGELOG 0.87.0, version 0.87.0 in
   `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Any new tool, host, link, step or question. Opening Curitiba Ouve or the 2024 PDF. Rewording earlier passes'
entries in docs/sources.md and CHANGELOG.md.

## Check

- `npx vitest run test/cityServiceGuide.test.ts`: every existing caveat test, the 0.85.0 hedge test included, and
  the three new 0.87.0 tests pass.
- The no-promise test fails on a copy of the guide with "A forma anônima garante o seu anonimato (observação do
  CuritibAI, não do guia de 2024)." in step 5, and passes again after the copy is restored.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
