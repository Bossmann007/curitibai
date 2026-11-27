# SPEC: v0.72.0 Name filter for the work types, second pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the lows of the 0.70.0 review: answer "Onde fica o Liceu de
Ofícios mais perto do Portão? (sem expor nome de pessoa)" with the existing `city_facilities_search` work types, and
close the gaps of their person-line filter. On the safe side: a line is hidden when unsure. No contract change.

## Source

No new source. The GeoCuritiba urban-equipment layers 150, 151, 149, 152 (work) and 9 (gardens), already recorded in
[docs/sources.md](docs/sources.md). robots.txt re-checked on 2026-11-27 02:45:18 UTC (404, no restriction); one read of
`objectid,observacao` per layer, about 5 s apart, to check the new rules against today's lines; then the service
metadata (no terms, no licence text). No new host, no new link.

## Changes

1. **"Atendimento:" value** (`src/sources/geocuritiba.ts`, `isWorkPersonLine`): the value of each "Atendimento:",
   "Atendimento ao público:" or "Horário de atendimento:" label at the start of the line or of a sentence must read as
   hours (`HOURS_VALUE`: a weekday counts only when it goes on as hours or a digit follows), on the same line or,
   after a bare label (with or without ':'), on the next one. The hide predicate gains an optional `prev` argument (the line before, shown or not); `hourLines` passes it,
   and passes `null` for the whole field read joined, where only the words count.
2. **Roles**: docente and facilitador/a anywhere; agente and técnico/a before ':', or at the start or after an article
   or "com/pelo/pela" when a word other than "de", "em", "para" … follows ("aperfeiçoar técnicas" in layer 149 and "a
   técnica de solda" stay).
3. **Contato**: a person unless a channel follows: "Contato: <phones only>" (then the end or hours that start with a
   word) or "contato pelo/via/no <156, telefone,
   e-mail, site …>". "Contato pela Fulana" and "Contato via Fulano" are hidden; "Contato: 3350-0000" stays.
4. **Split-name tail** (`NOT_A_NAME`, every type with `nameLines`): an hours line that starts with a weekday and has a
   digit is not the rest of a name, so the hours after a bare "Contato:" and its hidden value stay. "Domingos da
   Silva" (no digit) is still hidden.
5. **Garden allowlist**: each "Parceria com" or "Programa" in the line, not only at its start, needs an entity word
   after it; "mantida pela" not followed by an entity word is a person anywhere (`GARDEN_PERSON`).
6. **Tests** (`test/cityFacilities.test.ts`): each case above, the live lines kept, the other types unchanged.
7. **Eval**: q144 → `city_facilities_search` `{type: "liceu de oficios", near: Portão, radius_m: 3000}` with a new
   synthetic fixture `liceu_de_oficios_synthetic.json`.
8. **Docs and version**: docs/tools.md, docs/sources.md, docs/roadmap-1.0.md, CHANGELOG 0.72.0, version 0.72.0 in
   `package.json`, `package-lock.json`, `server.json`. Tool contract snapshot unchanged (no description changes).

## Out of scope

Name detection by capital letters, a name later in an hours or channel line (known limit), the offices' global
`ROLE`, any new type, host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts test/eval`: new tests pass; q144 answers.
- The new predicates over today's lines of layers 149–152 and 9 (read again after the review fixes): no record's
  `hours` changed against 0.71.0.
- `node scripts/eval-summary.mjs`: answered 139 / 143.
- `scripts/verify` exits 0 on the PR head; packed size under the `MAX_PACKED_BYTES` limit.
