# 0004. No automated access to hosts that disallow robots or refuse non-browsers

Status: Accepted (rule set 2026-11-19 to 2026-11-21; owner's note 2026-11-21 in `docs/sources.md:52`)

## Context

Some of the most useful Curitiba data sits on hosts this project may not read automatically:

- `mid-dadosabertos.curitiba.pr.gov.br` (the open-data portal's file host, where the 156 file is) and the UFPR
  mirror's `/curitiba/` answer robots.txt with `Disallow: /`. The mirror's `/curitibaurbs/` (the URBS bus exports) has
  no robots.txt of its own (404) and is treated as disallowed too.
- `servicos.curitiba.pr.gov.br` (Carta de Serviços detail pages) answers robots.txt with `Disallow: /`.
- `www.curitiba.pr.gov.br` allows `/servicos/` in robots.txt but answered HTTP 403 to non-browser clients on
  2026-11-19.

Fetching anyway, inside a visit window, with browser headers or with an automated browser, would ignore what the
publisher asked for.

## Decision

The server and the collector never contact a host whose robots.txt disallows the path, at any hour (stricter than
the UFPR mirror's own `Visit-time`), and never work around a refusal. Instead the user downloads the file in a browser
and puts it in `CURITIBAI_DATA_DIR`: URBS exports for the bus and points-of-interest tools, a saved copy of the Carta
de Serviços listing for `city_services_search`, any CSV for `local_csv_summary`. Those tools make no network call and
return Carta de Serviços URLs only as links for people to open.

Where it is written: `docs/sources.md:36-69` ("robots.txt findings", rows at lines 51, 52, 57, 58), README "Local data
files" (URBS and Carta de Serviços sections) and "Collection rules", `CONTRIBUTING.md` "Regras". In code: `src/http.ts`
treats 401, 403 and a CAPTCHA as a final refusal (`src/http.ts:17-31`), and the disallowed hosts are not in
`ALLOWED_HOSTS` (`src/config.ts`).

## Consequences

- Bus, points-of-interest and city-services data are only as fresh as the user's last download; tools say so
  (`checked_at`, a note after 30 or 180 days).
- Setup takes manual steps, documented in the README; the files never enter the repository
  ([0001](0001-facts-and-links-from-unlicensed-sources.md), `scripts/check-no-catalog`).
- If a host later allows access (robots.txt changes, 403 lifted), using it is a new decision with its own record and
  `docs/sources.md` entry.
