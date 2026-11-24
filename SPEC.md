# SPEC: v0.30.0 follow-ups from the v0.29 reviews

Approved: Enzo 2026-11-24 (task brief "curitibai v0.30.0": "segue com emode"; vision: everything a Curitiba citizen
needs inside their own AI). **This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Close the findings left by the v0.29 reviews (PR #41) and let a user keep `bus_stops_near` fully local. Look at a CEP
lookup through OpenCEP and build it only if its terms allow reuse by a public open-source server.

## Changes

1. **`bus_stops_near` opt-out** (`src/tools/busStopsNear.ts`). With `CURITIBAI_REMOTE_DATA=0` (or `off`; the existing
   switch of `src/sources/publishedData.ts`), a missing `pontosLinha` file gives `data_not_available` with the export
   steps and no request, as before v0.29. Unset, the GeoCuritiba fallback is unchanged. The live tools are not
   affected by the switch. Tool description unchanged (size guard: 9,593 of 9,600 characters).
2. **Fail closed on a non-JSON failure text** (`failurePayload` in `src/tools/busStopsNear.ts`): the `JSON.parse` of
   the `failFrom` text is guarded; on a throw, or JSON without a string `error`, the failure is returned as it is.
3. **`cartaFor` wording** (`src/tools/cityServiceGuide.ts`): one title match whose link fails the allowlist is
   `no_match` with "1 service in the local Carta copy matched, but its link is not on the official-host allowlist; no
   Carta link is given."; two or more title matches with every link refused are `ambiguous`, with no link and a message
   that says none of their links is on the allowlist; with some refused, the message says how many were left out of
   `matches`. No output schema change.
4. **Flaky test**: the `local_csv_summary` sweep in `test/localCsv.test.ts` gets its own 20 s timeout; the global
   `testTimeout` is not changed.
5. **Docs and version**: README (data folder paragraph, remote switch), docs/privacy.md, docs/local-data.md,
   docs/tools.md, docs/sources.md, CHANGELOG 0.30.0, version 0.30.0 in `package.json`, `package-lock.json` and
   `server.json`, this SPEC.

## Not built: CEP lookup (OpenCEP)

Read on 2026-11-24: `https://opencep.com/termos` and `https://opencep.com/terms` answer 404; the home page and the
repository README (`github.com/SeuAliado/OpenCEP`) state no terms of use and no licence for the data, only "Grátis e
sem Limites" and that the base is Correios and IBGE data; the repository's MIT licence covers the software;
`https://opencep.com/robots.txt` has only comments (content-signal definitions, none set). Terms are unclear, so the
brief's rule applies: not built. A CEP tool needs a source whose data licence allows reuse.

## Out of scope

CEP lookup; any new tool; `next_buses_near`, `bus_line_stops` and `bus_departures` (still export only); publishing;
tags.

## Check

- `test/busStopsNear.test.ts`: with `CURITIBAI_REMOTE_DATA` `0`, `off` and ` OFF `, no request and
  `data_not_available`; unset, the layer answers (`geocuritiba_layer`, two page requests); `failurePayload` returns
  null for non-JSON text, JSON without a string `error` and no text. The bus tests stub the switch empty, so a shell
  with `CURITIBAI_REMOTE_DATA=0` does not change them.
- `test/cityServiceGuide.test.ts`: one refused match gives `no_match` with the "matched, but its link is not on the
  official-host allowlist" message; two refused give `ambiguous`; no refused URL anywhere in the output.
- `test/contracts.test.ts` size guard; `scripts/smoke.mjs` unchanged (it sets `CURITIBAI_REMOTE_DATA=0` and has the
  export fixtures).
- `scripts/verify` exits 0.
