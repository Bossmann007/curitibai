# SPEC: v0.81.0 Person-name filter, fifth pass

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the lows of the v0.80.0 review on the `city_facilities_search`
person-name filter. L2 (a real leak, older than 0.80): "Mantida\npela Fulana de Tal" in a contracted CEI shows the
name. L1: "Falar com o RH\nFulano de Tal" shows the name. No new citizen question; the eval count is unchanged.

## Source

None new. The 12 GeoCuritiba layers whose type hides person lines were read once (one GET each, the server's own
query and User-Agent) to count hidden lines before and after; the tests use synthetic lines.

## Cause

The brief named the literal spaces in the multi-word patterns. Every line is split on line breaks and cleaned
(whitespace runs become one space) before a pattern runs, so a space in a pattern never meets a line break there. The
only reader of two lines at once is the whole-field check in `hourLines` (lines joined with spaces), and it is skipped
once any line of the record is hidden. So "Mantida\npela Fulana de Tal" alone was hidden, and after another hidden
line ("Responsável: Fulana.") the name showed. The brief's "cmei" is read as `cei contratado`: the `cmei` type has no
line filter, and only `cei contratado` reads maintainer lines.

## Changes

1. **L2, `hourLines` (`src/sources/geocuritiba.ts`)**: for a type with `nameLines` (not the garden allowlist, not
   the shelter types), each line that does not read as hours or a service (`isServiceText`) is also tested joined
   with the line before it by a line break, in the whole-field mode (`prev` null); when that pair hides and the line
   before does not hide alone, the line is hidden. The line before stays as it was. The whole-field check is skipped
   only when a line hid on its own rules (`other`: not by the split check, nor only as a label value or the rest of
   a name after it), so a keyword split over three lines still hides the whole field.
2. **L2, patterns (`src/sources/nameFilter.ts`)**: the multi-word hide patterns use `\s+` where they had a space
   (`MAINTAINER`, `PERSON_IN_CHARGE`, `WORK_PERSON`, `GARDEN_PERSON`), so the joined pair matches. The keep-side
   patterns (service values, hours, garden kinds) are unchanged.
3. **L1, `isWorkPersonLine`** in the split check's mode (`prev` null, lines joined by a line break): when the line
   before ends in a contact phrase or "agendamento com" naming a guarded unit (`GUARDED_END`; the phrase may span the
   two lines before), the last line is hidden unless it is made only of channel, unit, connector and hours words,
   numbers and punctuation (`REST_ONLY`) or is a street address (`ADDRESS_START`). Being part of the split check, it
   leaves the whole-field check on. "Dia(s)"/"hora(s)" are hours words only after a number or before "útil/úteis". No
   word is both a rest step and an hours step (each word reads one way, so the check stays linear; a test times every
   word repeated). Known limits: other words there are hidden too; a guarded phrase ending in ',' or ';' is hidden;
   when the line before hides on its own, the pair is not read; a guarded phrase complete on the first of three lines, then a contact line, then the name 
   ("Telefone da Regional:" / "3350-0000" / "- Fulana") shows the name.
4. **Tests** (`test/cityFacilities.test.ts`, a v0.81.0 block): the split keyword after a hidden line, per type that
   uses each pattern; L1 hidden and kept lines for the four work types; the pair check does not drag a line after
   one that hides alone, nor hours or a service after a keyword; a three-line split still hides the whole field; the
   real service lines of 0.76/0.80 stay; 50 KB of short lines in under 2 s.
5. **Docs and version**: docs/sources.md (a v0.81.0 paragraph), docs/tools.md (the `city_facilities_search` row),
   docs/roadmap-1.0.md, CHANGELOG 0.81.0, version 0.81.0 in `package.json`, `package-lock.json`, `server.json`.

6. **Regressions of 0.80.0 (Security Reviewer, priority)**: `GUARDED_UNIT` reads at most 100 steps and its rest may not
   end in ',' or ';' (O1, wrapped Liceu lines; the 400 KB quadratic case). `isWorkPersonLine` in the split check's
   mode (a line break in the text) uses the guarded `NAMED_CHANNEL`/`APPOINTMENT_NAMED`, not the `*_JOINED` ones
   (O2). `GUARDED_END` is any channel, "falar com" or "agendamento com" anchor followed by a guarded unit, so a name
   after "Fale com a gente pelo 156" is hidden; `hourLines` keeps the uncut line as `prev`. `um/uma/dia(s)/hora/senha`
   are appointment details only before a number or a detail word (semana, úteis, marcada, retirada …). A name anywhere on the next line is read (`REST_ONLY`), and the split
   check also reads the last three lines. The line after a guarded phrase is kept only when it is
   made of rest and hours steps (`REST_ONLY`) or is a street address; "whats" never matches before "app", so the
   steps read one way only. Checked on 29,400 generated lines against 0.79.0
   (no line 0.79.0 hid is shown) and timed on 400 KB lines.

7. **The 0.80.0 "next line" limit, stated in full**: The 0.80.0 known limit "a name alone on the next line after 'Fale com a gente' is shown" was wider than 0.80.0 said:
   it also covered "Telefone da Regional", "E-mail da coordenação" and "RH", lines ending in ':', "pelo 156" or a phone,
   and next lines such as "Fulana, das 8h às 17h" or "ou com a Fulana". 0.81.0 closes it for all of these (tested).

## Out of scope

A filter for `cmei`; the shelter types' split phrases; "agendamento pela …"; names later in an hours line; any new
question, source, host or link.

## Check

- `npx vitest run test/cityFacilities.test.ts`: the v0.81.0 block fails on 0.80.0 and passes on 0.81.0; every
  earlier block still passes.
- Replay of the 12 re-read layers: 131 hidden-line markers before and after, every record's `hours` identical.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
