# SPEC: v0.27.1 ADR 0009 accepted (census privacy floor stays at 20 households)

Approved: Enzo 2026-11-24 (task brief "curitibai v0.27.1, docs only"; in his chat with Boss, after the floor was
explained: "pode confirmar"). **This change publishes nothing**: no workflow run, no tag.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Record the owner's decision on the `census_at_point` privacy floor, so no document still calls it an open question.

## Changes

1. **[ADR 0009](docs/adr/0009-census-household-floor.md)**: status Proposed → Accepted, with "Decided by the owner
   (Enzo) on 2026-11-24: floor = 20 households; 29 of 3,190 sectors withheld at v0.27.0". The wording that left the floor
   undecided is removed; the last consequence says the owner confirmed 20. The ADR index (`docs/adr/README.md`) shows
   Accepted.
2. **Docs and version**: CHANGELOG 0.27.1 (docs only), version 0.27.1 in `package.json`, `package-lock.json` and
   `server.json`, this SPEC.

## Out of scope

Any code, test, tool description or behaviour change (`MIN_HOUSEHOLDS` stays 20); the 0.27.0 CHANGELOG entry (history:
it says "proposed", as it was then); publishing; tags.

## Check

- `git diff main --stat` lists only `SPEC.md`, `CHANGELOG.md`, `docs/adr/`, `package.json`, `package-lock.json` and
  `server.json`.
- `grep -rni "owner question" docs src README.md` finds nothing.
- `scripts/verify` exits 0 in a clone without tags (CI's condition) and in a scratch clone where `v0.27.0` was tagged
  locally at 1bd30d1; in a clone with the real tags, `check-release` stops at the missing `v0.27.0` tag until the
  owner tags the merge of PR #38 (ADR 0006).
