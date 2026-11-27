# SPEC: v0.76.0 Person-name filter, third pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the lows of the 0.72.0 review: the `city_facilities_search`
person-name filter shows public service lines it hides today and hides names it still lets through. No new citizen
question; the tool contract does not change.

## Source

None new. The only request is a re-read of the five layers the filter changes for (urban-equipment layers 150, 151,
149, 152 and 9 on `geocuritiba.ippuc.org.br`, already allowed), to count hidden lines before and after.

## Changes

1. **Module move, its own commit, no behaviour change**: the role lists, the work-type and garden person-line tests
   and the service-line words hourLines uses move from `src/sources/geocuritiba.ts` to `src/sources/nameFilter.ts`.
   Tests unchanged and green; contract snapshots byte-identical.
2. **Service values after "Atendimento:"** (work types `sine`, `agencia do trabalhador`, `liceu de oficios`,
   `inss`): a value that starts with a service phrase ("por ordem de chegada", "preferencial", "prioritário",
   "gratuito", "carteira de trabalho", "seguro-desemprego") is not read as a name, on the same line or after a bare
   label. The role, contact and new name rules still run on the line.
3. **Names that still passed** (work types): a channel word followed by "da/do/com" and a word that is not a unit or
   channel word ("Contato no WhatsApp da Fulana", "Contato pelo telefone com Fulana"); "falar/fale/tratar/procurar
   com" and such a word ("Falar com Fulana de Tal"); palestrante, assistente social and psicólogo/a anywhere.
4. **Gardens** (`horta comunitaria`): in a "Parceria com" or "Programa" phrase (up to ".", ";" or " - "), "e", "com"
   or "da/do/das/dos" followed by a word that is not an entity word hides the line ("Parceria com a comunidade e a
   Fulana de Tal", "Programa Municipal da Fulana"); bare "de" stays ("Programa Municipal de Agricultura Urbana").
5. **CHANGELOG 0.76.0** names every type the 0.72.0 NOT_A_NAME/WEEKDAY_START change reached (the eleven types with
   `nameLines` and no allowlist).
6. **Docs and version**: docs/sources.md (filter paragraph and host row), docs/roadmap-1.0.md, docs/tools.md row,
   CHANGELOG 0.76.0, version 0.76.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

A name later in an hours line ("das 8h às 17h com a Fulana"); the office types' narrower filter; any new type, host,
link or question.

## Check

- `scripts/verify` exit 0; each case in 2-4 tested kept or hidden through `hourLines` with the real type.
- A 50 KB worst-shape input for each new regex runs in well under a second.
- The five real layers, re-read once: hours of every record identical before and after (no public line newly hidden).
