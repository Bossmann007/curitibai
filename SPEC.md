# SPEC: v0.70.0 Name filter for the work types

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), a follow-up of the 0.64.0 and 0.63.0 reviews: answer "Onde fica
o SINE do Pinheirinho? (sem expor nome de pessoa)" with the existing `city_facilities_search` work types (`sine`,
`agencia do trabalhador`, `liceu de oficios`, `inss`), and hide a line that may name a teacher, an instructor, an
attendant or a contact person. On the safe side: a line is hidden when unsure.

## Source

No new source. The GeoCuritiba urban-equipment layers 150, 151, 149, 152 (work) and 9 (gardens), already recorded in
[docs/sources.md](docs/sources.md). robots.txt re-checked on 2026-11-27 02:06 UTC (404, no restriction); then one
read of `objectid,observacao` per layer, 5 s apart, to check the new rules against today's lines; then the service
metadata (no terms, no licence text). No new host, no new link.

## Changes

1. **Work person filter** (`src/sources/geocuritiba.ts`): `isWorkPersonLine` = the offices' `isPersonInChargeLine`, or
   the words professor/a ("Prof.", "Profa.", "Prof.ª"), instrutor/a, monitor/a, orientador/a, educador/a, tutor/a,
   atendente or contato (plurals and "(a)" included) anywhere in the line, word-bounded; "contato" followed by a
   channel ("entre em contato pelo 156") is kept, so the hours after it are not read as the rest of a name. Broader on purpose than "as a role or a label before ':'": "Atendimento: atendente Fulana" has the
   word after the colon. "Atendimento" is not "atendente". The four work types use it; the other `HIDE_PERSON` types
   (regional offices, COHAB, fazenda urbana, núcleos, mesa solidária, chess club) keep `isPersonInChargeLine`. The
   label rule of `hourLines` is unchanged, so after a hidden "Instrutora:" the next line is hidden too.
2. **Garden allowlist** (`isGardenPersonLine`): "Parceria com" and "Programa" are a known kind only when an entity
   word follows right after the keyword (and an optional ':', article or "de"): a body (`BODY`), an organisation
   word (empresa, instituto, universidade, fundação, cooperativa), a public scope (integrado, municipal, estadual,
   federal) or a named public company (COPEL, Sanepar, Eletrosul). Generic words a name can follow (projeto, ONG,
   hortas) are left out. Otherwise the line is of no known kind and hidden. Known limit: a name after the
   entity word still passes ("Parceria com a Associação e Fulana"), caught only by the existing person words.
3. **Tests** (`test/cityFacilities.test.ts`): the role words in each position, a label then a name on the next line,
   "Atendimento:" kept; the other person types unchanged; garden "Parceria com Fulana" and "Programa Fulana" hidden,
   the live kinds kept.
4. **Eval**: q142 → `city_facilities_search` `{type: "sine", name: "pinheirinho"}`. The synthetic Pinheirinho record
   gains an "Atendente: Fulana Inventada" line; the eval checks shape (`hours.3`, the marker), the unit test the text.
5. **Docs and version**: docs/tools.md, docs/sources.md, docs/roadmap-1.0.md, CHANGELOG 0.70.0, version 0.70.0 in
   `package.json`, `package-lock.json`, `server.json`. Tool contract snapshot only if a description changes.

## Out of scope

Adding the words to the offices' global `ROLE` (would change six other types), name detection by capital letters,
any new type, host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/eval`: new tests pass; q142 answers.
- The new predicates over today's lines of layers 149–152 and 9: no line hidden that was shown before.
- `node scripts/eval-summary.mjs`: answered count from the run.
- `scripts/verify` exits 0 on the PR head; packed size under the `MAX_PACKED_BYTES` limit.
