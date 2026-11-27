# SPEC: v0.77.0 PGV micro-bairro description and the service areas `lists` type

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md), the lows of the 0.73.0 review: the `place_at_point`
`place.pgv` field `microbairro` describes the form the tool returns ("27", not the published "27.0"), and the
service areas helper's `lists` argument cannot hold `undefined`. No new citizen question; no behaviour change.

## Source

None. No request is made and no host is contacted.

## Changes

1. **`microbairro` description** (`src/tools/placeAtPoint.ts`): "Micro-bairro code (cd_microbairro), e.g. "27": a
   number in its JSON form, text of 1 to 6 digits without a trailing ".0", other text unchanged." It no longer says
   "as published" or gives "27.0". The tool contract snapshot changes in this one description.
2. **`lists` type** (`src/tools/serviceAreasAtPoint.ts`): `areasData` takes `Pick<Lists, K>` instead of
   `Partial<Lists>`, so a group passing `undefined` for a list is a type error (with `exactOptionalPropertyTypes`
   off, `Partial` allowed it, and the spread would then drop the key from `data`). The callers and the output do not
   change.
3. **Docs and version**: docs/sources.md (PGV paragraph), docs/roadmap-1.0.md, CHANGELOG 0.77.0, version 0.77.0 in
   `package.json`, `package-lock.json`, `server.json`. docs/tools.md already gives the returned form ("27.0 as
   "27"") and does not change.

## Out of scope

Any change to what `place_at_point` returns, to the other PGV fields' "as published" descriptions, or to
`tsconfig.json` (`exactOptionalPropertyTypes` stays off); any new type, host, link or question.

## Check

- `scripts/verify` exit 0; the snapshot diff is the one `microbairro` description line.
- Passing `{ electoral_zones: undefined }` to `areasData` fails `tsc --noEmit` with this change and passes without
  it (checked by hand, then reverted).
