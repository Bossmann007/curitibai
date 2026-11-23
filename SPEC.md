# SPEC: v0.24.1 quality block, part 1 (contract test, tools/list size, gate and cache tests)

Approved: Enzo 2026-11-23 (roadmap "bloco de qualidade", task brief "curitibai v0.24.1 — bloco de qualidade, parte
1"). Scope frozen: tests, guards, docs and the version only. No tool behaviour, name, title, description or schema
changes; `git diff main -- src` is empty.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Tool names and schemas are a public contract (Hyrum's law): a client depends on every field it can see. Make a change
to them fail a test with a clear message instead of passing unnoticed, measure the size of `tools/list` as a baseline
for a ceiling in part 2, and cover the two shared pieces every live source relies on (`src/hostGate.ts`,
`src/cache.ts`) with unit tests on a fake clock.

## Changes

1. **Contract snapshot** (`test/contracts.test.ts`, `test/fixtures/tool-contracts.json`). The test connects a client
   to the real server (`createServer()` over the in-memory transport, as the other tool tests do), calls
   `tools/list`, and keeps, per tool sorted by name: `name`, `inputSchema` and `outputSchema` as sent on the wire.
   It compares them with the committed snapshot tool by tool and fails naming each tool added, removed or changed
   (and the changed part), with the instruction to update the snapshot on purpose (`npm run contracts:update`) and
   add a `CHANGELOG.md` entry for the change. A missing snapshot fails too; the test writes the file only when
   `CURITIBAI_UPDATE_CONTRACTS=1` is set, which is what `npm run contracts:update` does. Titles, descriptions and
   annotations are not in the snapshot (wording may change in a patch release); they are counted in the size below.
2. **`tools/list` size** (same test, printed, no ceiling yet). Characters of `JSON.stringify` of: every tool's
   `description` summed, every `inputSchema` summed, every `outputSchema` summed, and the whole `tools/list` result
   (`total`, which also holds names, titles and annotations, so it is more than the sum of the three). Baseline below.
3. **`src/hostGate.ts` unit tests** (`test/hostGate.test.ts`), own `createHostGate` instances on a fake clock (not the
   source gates that `test/setup.ts` adjusts): request starts at least `minIntervalMs` apart, in call order; a turn
   more than `maxQueueWaitMs` away is refused with `rate_limited` and the wait, reserves no slot and is not remembered
   as a failure (a turn exactly `maxQueueWaitMs` away is accepted); a failure is remembered 60 s, a 429's Retry-After
   when longer, at most 1 hour, and a remembered 429 returns the remaining seconds; a request that was waiting when an
   earlier one failed is refused without running (`failedMeanwhile`).
4. **`src/cache.ts` unit tests** (`test/cache.test.ts`), small `TtlCache` instances with an injected clock: concurrent
   calls for one key share one load; a failed load is not stored (both waiting callers get the error, the next call
   loads again); an entry expires exactly at its TTL; with `maxEntries` the oldest stored entry is dropped first.
5. **`partial` removal date.** `guaira_events`' `partial` (deprecated alias of `truncated` since 0.18.3) is removed
   no earlier than 2027-03-01, in the first minor release on or after that date, with its own CHANGELOG entry. Written
   in `CHANGELOG.md` and `docs/tools.md`; the tool's description and schema are unchanged in this version.
6. Docs: `docs/development.md` (the snapshot and its update command), CHANGELOG 0.24.1, version 0.24.1 in
   `package.json` and `package-lock.json`.

## Baseline: `tools/list` size at v0.24.1 (25 tools, characters)

| Part | Characters |
|---|---|
| descriptions | TBD |
| inputSchemas | TBD |
| outputSchemas | TBD |
| total (`tools/list` result) | TBD |

## Out of scope

A ceiling on the size (part 2), shortening any description or schema, removing `partial`, changing the gate or the
cache, snapshotting descriptions, creating the `v0.24.1` tag.

## Check

- `scripts/verify` exits 0 (the new tests run in its vitest step).
- The contract test fails with the expected message when the snapshot is changed by hand (one property removed from
  one tool's `inputSchema`), and passes again when restored. Output in the PR body.
- `git diff main...HEAD -- src` is empty.
