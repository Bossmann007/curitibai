# SPEC: v0.74.0 E-mail filter, second pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the low of the v0.67.0 review: the filter that drops a
`curitiba.pr.gov.br` e-mail shaped like a person's name (`city_facilities_search`, every type) misses an initial
before the surname ("j.silva"), digits after the surname ("maria.souza2") and "-" as a separator ("ana-lima").
Generic sector and unit addresses ("falecomacgm", "sine", "cras.boqueirao") stay visible.

## Source

No new source and no new host or link. To count what the new shape changes, the 89 urban-equipment layers the tool
already reads were re-read once each from `geocuritiba.ippuc.org.br` (already allowed) by a one-off script, 6 s
apart, with the server's User-Agent and fixed query.

## Changes

1. **Name shape** (`src/sources/geocuritiba.ts`, `PERSON_LOCAL`): `^[a-z]+(?:[._-][a-z]{2,}\d*)+$`. The first word
   may be one letter; each later word has 2+ letters and optional trailing digits; ".", "_" and "-" join words. No
   accent folding: `CITY_EMAIL` already rejects a non-ASCII local part, so such an address is dropped before.
2. **Unit and sector words** (`UNIT_PREFIXES`), checked first: the first word (split on ".", "_" or "-") in the list
   keeps the address. Added: atendimento, contato, falecom, ouvidoria, secretaria.
3. **Tests** (`test/cityFacilities.test.ts`): each new hidden shape; generic sector and unit addresses kept,
   `cras.boqueirao` and `cras-cajuru` included; an accented local part dropped.
4. **Docs and version**: docs/sources.md (the filter paragraph and the host row), docs/roadmap-1.0.md, CHANGELOG
   0.74.0, version 0.74.0 in `package.json`, `package-lock.json`, `server.json`. Tool contract snapshot unchanged.

## Out of scope

A rule for a unit word followed by a name ("secretaria.fulana", "cras.fulana"): Enzo's decision. Such an address is
kept, and with the new words also when the first word is atendimento, contato, falecom, ouvidoria or secretaria (in
0.73.0 those were dropped as name-shaped). A one-word name ("fulanasilva"). Any new question, source, host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts`: new tests pass.
- Real records (re-read 2026-11-27): 89 layers, 2,167 records, 1,765 city e-mails (776 distinct); kept 1,763 by the
  0.73.0 rule and 1,763 by the 0.74.0 one; none newly hidden, none newly shown.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
