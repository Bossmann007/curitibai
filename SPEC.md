# SPEC: v0.88.0 Person-name filter after "senha numerada", review follow-ups

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): the follow-ups of the 0.86.0 reviews (PR #101) on the
work-type name filter after "senha numerada" / "senha de atendimento" (`src/sources/nameFilter.ts`, `readsNextLine`
used by `hourLines` in `src/sources/geocuritiba.ts`). Smallest change; no tool contract change; no new citizen
question.

## Source

None new. No request was made; every fixture is synthetic (Fulana, Beltrano).

## Changes

1. **Docs match code**: the 0.86.0 CHANGELOG note and docs/sources.md said that, when the whole-field check is
   skipped, only the next line is read. The split check reads the next two lines (up to the third line from the
   "senha numerada" line). The text is fixed, not the code, and the 0.88.0 entry says so.
2. **KISS**: `APPOINTMENT_DETAIL` no longer builds its senha branch with `.replace("SENHA_REST", SENHA_REST)` on the
   pattern source; `SENHA_REST` is declared first and interpolated. Before item 4, the sources of
   `APPOINTMENT_NAMED`, `APPOINTMENT_NAMED_JOINED` and `SENHA_END` were dumped before and after and were identical.
3. **Known limit, documented**: a name on the fourth line or later after "senha numerada", after two schedule lines,
   when another line hid on its own rules, is shown. Recorded in docs/sources.md and in a test that expects the
   current behaviour, with a comment.
4. **Weekday alone** (optional item, done): in the senha rest only, a weekday word is a step only after
   "a/ao/aos/às" or before "a/ao/aos/às/e", a digit, "das" and a digit, or "fechado". The two alternatives are
   disjoint (one needs the lookbehind, the other its negation), so no word is read two ways. `HOURS_STEP` (and so
   `REST_ONLY`, the line after a guarded phrase) keeps the same words.
5. **Docs and version**: docs/sources.md (ninth-pass entry), docs/roadmap-1.0.md, CHANGELOG 0.88.0, version 0.88.0 in
   `package.json`, `package-lock.json`, `server.json`.

## Out of scope

Fixing the fourth-line limit; any new tool, host, link or question; touching the guarded-phrase rest.

## Check

- `npx vitest run test/cityFacilities.test.ts`: every v0.81.0 to v0.86.0 test passes unchanged; the new v0.88.0
  tests pass ("numerada Domingo" hidden, "Segunda a sexta, 8h às 17h" visible, the known-limit test, the timing test).
- The "hides a weekday word alone" test fails on the 0.87.0 `nameFilter.ts` (4 failures) and passes on 0.88.0.
- `node scripts/eval-summary.mjs`: answered 139 / 143, as before.
- `git diff --stat origin/main` does not list `test/fixtures/tool-contracts.json`.
- `scripts/verify` exits 0 on the PR head.
