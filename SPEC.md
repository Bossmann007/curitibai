# SPEC: v0.36.0 citizen eval

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.36.0, phase A of docs/roadmap-1.0.md"). **This change publishes
nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Measure "useful to a Curitiba citizen" (the 1.0 gate, [docs/roadmap-1.0.md](docs/roadmap-1.0.md)) with a bank of
realistic citizen questions that `scripts/verify` runs offline and that fails on any regression. Fix the v0.35 review
Low on the scoreboard's wording.

## Changes

1. **Question bank** (`test/eval/citizen-questions.json`): 114 questions in Brazilian Portuguese, invented, no
   personal data, places only as public landmarks or coordinates the citizen gives. Each is
   `{ id, question, tool, args, expect, tags? }`; `expect` is shape only: `status` (`ok`, `not_found`,
   `outside_curitiba`, `guide`, `error` with `error` code), `fields` (paths present and non-empty) and `link` (path of
   the https source or official link, `source_url` by default, `null` only for `local_csv_summary`). Every one of the
   26 tools has at least 2 questions; ambiguous and outside-Curitiba questions are tagged. Questions no tool answers
   have `tool: null` and a `gap` label (the Curitiba App gaps `le_digital`, `defesa_civil`, `estar`, `realtime_bus`,
   `cultural_spaces`, `useful_phones`, plus `route_planning`, `vale_creche`, `other_city`).
2. **Runner** (`test/eval/citizenEval.test.ts`, `test/eval/world.ts`, `test/eval/check.ts`): checks the bank (unique
   ids, every tool twice, every App gap present), parses each `args` with its tool's input schema in strict mode,
   calls the handler on fake timers at one fixed clock (2026-11-22 02:50, Curitiba) with a temporary data folder
   (synthetic Carta, URBS, phones, events and CSV) and fetch stubbed per tool from the existing synthetic fixtures,
   derives the status the same way for every question of a tool, and checks the structured result against the tool's
   output schema. A guide answer needs a consent step with its text and an official link. `test/eval/check.test.ts`
   tests the checker (an `ok` expectation fails on an empty list; missing field or link; outside-Curitiba vs other
   errors; guide consent).
3. **Summary** (`scripts/eval-summary.mjs`, dev only): `scripts/verify` prints `citizen eval: answered N / total;
   gaps M: label n, ...` after vitest.
4. **Scoreboard wording** (`scripts/coverage-report.mjs`, `docs/roadmap-1.0.md`): "aggregates only" becomes "numbers
   per category" (the summary keeps Carta category labels). No behaviour change.
5. **Docs and version**: the citizen eval section in `docs/roadmap-1.0.md`, CHANGELOG 0.36.0, version 0.36.0 in
   `package.json`, `package-lock.json`, `server.json`.

Why the shape differs from the brief: `expect` has no per-question "source link present" flag but a `link` path,
because the tools put their link in different places (`place_at_point` per part, `local_csv_summary` none). The
status is derived by the runner from each tool's answer list (`RESULT_PATH` in `test/eval/check.ts`), because the
tools have no common status field.

## Out of scope

New tools or guides to close a gap; live (network) runs of the bank; scoring an assistant's choice of tool (the bank
fixes the tool and arguments; it checks the server's answers, not a model).

## Check

- `npx vitest run test/eval`: the bank checks, 99 questions answered offline with the expected shape, the checker
  tests. A mutation (every guide step `needs_consent: false`) fails 7 guide questions.
- `scripts/check-no-catalog` passes (the phones and events files exist only in the temporary folder);
  `scripts/verify` exits 0 on the PR head and prints the summary line.
