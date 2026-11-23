# 0001. Publish facts and links only from sources with no licence found

Status: Accepted (owner approvals 2026-11-21 and 2026-11-22)

## Context

Several useful Curitiba sources publish no licence or terms of use: IPPUC GeoCuritiba layers, ANA telemetry, the
Teatro Guaíra calendar, and the Instituto Municipal de Turismo events calendar and "Telefones Úteis" page. Copying their
text (descriptions, news, whole pages) could infringe copyright; facts (dates, times, names of public bodies, public
addresses, readings) and links carry much less risk and are what a user needs.

Robots rules and refusals limit what may be read at all; see [0004](0004-user-downloads-for-blocked-hosts.md).

## Decision

From a source with no licence found, the project keeps and returns only facts and links, never copied text. Each tool
cites the publisher in `source` or `attribution` and says so in `license_note` (for example "No licence found; facts
only; ANA cited."). A source is added only after its robots.txt was read and recorded, and a path it disallows is never
fetched. A refusal (HTTP 401/403, a CAPTCHA, a login) is never bypassed. Content can be removed on request.

Where it is written:

- `CONTRIBUTING.md`, "Regras": "Só fatos" and "robots.txt e nada de contornar".
- `docs/licences.md` and `docs/privacy.md`, "Collection rules".
- `docs/sources.md:883` (IPPUC, owner approval 2026-11-21), `docs/sources.md:896` (ANA, 2026-11-22),
  `docs/sources.md:1042` (Teatro Guaíra, 2026-11-22), `docs/sources.md:748` (Turismo events and phones on the `data`
  branch, 2026-11-22).
- `SPEC.md` at tag v0.21.0, line 3 (`git show v0.21.0:SPEC.md`; v0.18.0 approval: the public `data` branch holds
  facts and links only).
- PRs [#5](https://github.com/Bossmann007/curitibai/pull/5) (v0.15.0),
  [#7](https://github.com/Bossmann007/curitibai/pull/7) (v0.16.0),
  [#9](https://github.com/Bossmann007/curitibai/pull/9) (v0.17.0),
  [#10](https://github.com/Bossmann007/curitibai/pull/10) (v0.18.0).

## Consequences

- Tools answer with less than the source shows (no event description, no image); results link to the page instead.
- The Carta de Serviços catalog (no licence found) is not in the repository at all; the user keeps a local copy in
  `CURITIBAI_DATA_DIR`. `scripts/check-no-catalog`, run by `scripts/verify`, fails if it, a URBS export, collector
  output or an HTML capture is tracked.
- Every new or changed source needs a `docs/sources.md` entry (format, terms, robots.txt, date checked); so far each
  no-licence source shipped with an owner approval recorded there.
- Removal requests have a form in the issue tracker; removed content leaves with the next release.
