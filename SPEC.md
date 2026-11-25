# SPEC: v0.34.0 municipal school calendar 2026 as dated bundled data

Approved: Enzo 2026-11-24 (he sent the PDF link; task brief "curitibai v0.34.0"). **This change publishes nothing**:
no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

A citizen asks "when do classes start", "when is the July recess" or "is there class on <date>" for the municipal
escolas, CMEIs or CMAEEs, and gets the answer from the Secretaria Municipal da Educação's own 2026 calendars, dated,
with no network call. v0.33 found the calendars only as PDFs; the owner downloaded them once by hand
(`mid-educacao.curitiba.pr.gov.br`, no robots.txt) and approved bundling the dates.

## Changes

1. **Extraction, dev only** (`scripts/extract-school-calendar.py`, not in the package): reads the three local PDFs
   with pdfplumber, maps each cell fill to the legend swatch and each shape to the legend shape of the same PDF,
   asserts every month reads 1..N in its 2026 weekday column, every red cell is in the printed holiday list, and the
   school days per month and total equal the printed "Letivos" and 199; fails otherwise. `--ts` writes the data file.
2. **Data** (`src/tools/schoolCalendarData.ts`, generated): per unit the source URL, sha256, signing date, first and
   last day with students, dated periods per legend kind (holidays with their printed names), school days per month
   and total. The PDFs are not committed.
3. **Tool** (`src/tools/cityCalendar.ts`, ADR 0005: no new tool): `city_calendar` `topic: "school"`, optional `unit`
   and `date` (either one with no `topic` selects `school`); `on_date.school_day` from the rule the script checks; `expired` after 2026-12-31; the note says
   municipal network only, state and private schools follow other calendars. Contract snapshot rewritten.
4. **Docs and version**: docs/tools.md (`city_calendar` row; "School calendar" row covered for the municipal
   network), docs/sources.md (mid-educacao row, how and when the PDFs were downloaded and read), README, CHANGELOG
   0.34.0, version 0.34.0 in `package.json`, `package-lock.json`, `server.json`.

## Out of scope

State (SEED-PR) and private school calendars; the 2027 calendars; the escolas PDF's text-only notes (trimesters,
semesters, EJA class council); any request by the server to SME hosts; committing the PDFs or their renders.

## Check

- `python3 -I scripts/extract-school-calendar.py escolas=… cmeis=… cmaees=…` exits 0 on the three PDFs (per-month
  table in the PR body).
- `test/cityCalendar.test.ts`: the TS rule recomputes each month's school days and the 199 total for all three units;
  start, July recess, holiday name, Saturday evaluation, teachers-only and Dia do Professor days, null outside 2026,
  `expired` from 2027, no network call.
- `test/contracts.test.ts`: the rewritten snapshot; every description at most 400 characters, the sum at most 9,600.
- `scripts/verify` exits 0 on the PR head.
