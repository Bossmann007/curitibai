# SPEC: v0.78.0 E-mail filter, third pass (middle initial, surname initial, repeated separator)

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the low of the 0.74.0 review: three person-shaped city
addresses still passed the `city_facilities_search` e-mail filter and must be dropped: a middle initial
("ana.c.lima", "joao.p.silva"), a surname written as an initial ("maria.s") and a doubled separator
("maria..silva"). Institutional addresses (ouvidoria@, sine@, unit and regional addresses) stay. No new citizen
question; the eval count is unchanged.

## Source

No new source and no new host or link. To count what the new shape changes, the 89 urban-equipment layers the tool
already reads were re-read once each from `geocuritiba.ippuc.org.br` (already allowed) by a one-off script, 5.5 s
apart, through the server's own `fetchText` (its User-Agent, same-host redirects only) and fixed query.

## Changes

1. **`PERSON_LOCAL`** (`src/sources/geocuritiba.ts`): separators may repeat (`[._-]+`); a middle word may be a
   single letter other than the connectors a, e and o when the last word has 2+ letters ("ana.c.lima",
   "j.p.silva"; "esporte.e.lazer" stays); a first word of 2+ letters followed by exactly one letter is a surname
   initial ("maria.s"; "sme.d.p.e" and "sec.e.2" stay). Unchanged: the unit prefixes are checked first and keep the
   address; a single word, a word and a number ("sec.2", "sec..2") and exactly two single letters ("a.b", "a1.b")
   never match. The local part is at most 64 characters (`CITY_EMAIL` runs first), so the regex has no long-input
   cost.
2. **Tests** (`test/cityFacilities.test.ts`): each new shape is dropped; ouvidoria, sine, falecomacgm, bare
   regional names (boqueirao, cic), regional and unit addresses with a single-letter middle word or a doubled
   separator, connector addresses ("esporte.e.lazer", "saude.a.domicilio"), letter codes ("sme.d.p.e", "fas.n.s"),
   two single letters and a word and a number stay.
3. **Docs and version**: docs/sources.md (the e-mail filter paragraph), docs/roadmap-1.0.md, CHANGELOG 0.78.0,
   version 0.78.0 in `package.json`, `package-lock.json`, `server.json`. docs/tools.md and the tool contract do not
   describe the name shapes and do not change.

## Out of scope

A trailing separator ("maria.silva.") and a one-word name ("fulanasilva") still pass (known limits, written down);
sector words in the unit list; any new type, host, link or question.

## Check

- `scripts/verify` exit 0; the tool contract snapshot is unchanged.
- The old `PERSON_LOCAL` keeps every new dropped case of the tests (checked by hand with node).
- Real records: the re-read above keeps the same number of city e-mails with the old rule and with the first draft
  of the new rule. The final rule (after review: connectors excluded, the surname initial limited to two words)
  drops a subset of what that draft dropped and a superset of what the old rule dropped, so the count holds.
