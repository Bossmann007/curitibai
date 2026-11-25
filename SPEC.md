# SPEC: v0.31.0 quality round (v0.30 review follow-ups and a subtraction pass)

Approved: Enzo 2026-11-24 (task brief "curitibai v0.31.0": "seguimos com emode faz uma rodada de pstack"). **This change
publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Close the findings left by the v0.30 reviews (PR #42), then remove code from `src/` without changing what any tool
answers: A (follow-ups, version, this SPEC), then B (the subtraction pass). Together they stay under the 400-line size
check, so they ship as one pull request.

## Changes

### A. Follow-ups

1. **`CURITIBAI_REMOTE_DATA` fails closed** (`src/sources/publishedData.ts`, `src/server.ts`). `remoteDataSetting()`
   is the one parser: `0`, `off`, `false`, `no` are off; `1`, `on`, `true`, `yes` are on (case and spaces ignored);
   unset is on; any other value, empty included, is `null`. The server checks it at start and exits 1 with
   `curitibai: configuration error: CURITIBAI_REMOTE_DATA must be ...` on `stderr` for `null`; it never echoes the
   value. `remoteDataEnabled()` is true only for on, so an invalid value that reaches a tool (tests, in-process use)
   keeps remote reading off.
2. **`server.json`**: the `CURITIBAI_REMOTE_DATA` description names `bus_stops_near` and the accepted values.
3. **Grammar** (`cartaFor` in `src/tools/cityServiceGuide.ts`): "1 of their links is not ... and is not listed".
4. **`bus_stops_near` description unchanged**: the switch does not fit (369 of 400 characters; sum 9,593 of 9,600).
5. **Docs and version**: README, docs/local-data.md, docs/tools.md, docs/sources.md, CHANGELOG 0.31.0, version 0.31.0
   in `package.json`, `package-lock.json` and `server.json`, this SPEC.

### B. Subtraction pass (behaviour-preserving)

Each item deletes more than it adds and changes no tool name, schema, output or message:

- `failFrom` takes an optional hint appended to its message, so `bus_stops_near` and `tax_reform_curitiba` stop
  re-parsing the JSON text of a `failFrom` result (`failurePayload`, `withDisclaimer`).
- GeoCuritiba: one request helper for the four identical `fetchText` calls and their "not JSON" check.
- GeoCuritiba: one ArcGIS answer check (JSON, `error` with the host block, WGS84) for the three layer parsers.
- One `isObject` in `src/text.ts` instead of four copies; imports of `mask.js` directly instead of through the
  `pncp.ts` re-export.

A larger change (one handler for the point tools, a place facade for 1.0) is a proposal in the pull request body only.

## Out of scope

New tools; new behaviour; any change to `test/fixtures/tool-contracts.json`; publishing; tags.

## Check

- `test/publishedData.test.ts`: `remoteDataSetting()` for every accepted value, unset, and invalid values (empty,
  `2`, `enabled`, `constructor`, `__proto__`); events and phones make no request for off words and invalid values,
  and read the published copy for `true`, ` Yes `, `1`.
- `test/busStopsNear.test.ts`: off words and invalid values give `data_not_available` with no request; unset reads
  the layer.
- `test/cityServiceGuide.test.ts`: two matches with one refused give the singular message.
- `scripts/smoke.mjs`: the built server started with `CURITIBAI_REMOTE_DATA=maybe` exits 1 with the configuration
  error.
- `test/contracts.test.ts` passes with the snapshot unchanged; `scripts/verify` exits 0 on each PR head.
