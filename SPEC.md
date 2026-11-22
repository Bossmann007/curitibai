# SPEC: v0.17.0 `guaira_events` (Centro Cultural Teatro Guaíra agenda, live)

Approved: Enzo 2026-11-22 (task brief "curitibai v0.17.0 — live agenda of the Centro Cultural Teatro Guaíra"; owner
approval recorded in the brief, including "no licence found; facts and links only; Teatro Guaíra / Governo do Paraná
cited" for this no-licence source). Scope frozen. Runs in parallel with v0.16.0 (`river_levels`), which merges first;
this branch then merges `origin/main` (never rebase, never force-push).

## Goal

A read-only tool that answers "what is on at the Teatro Guaíra between these dates" from the theatre's public
calendar, live, with a cache and a strict request gate.

## Source (checked 2026-11-22, GET only, at least 5 s between requests)

- Listing: `https://www.teatroguaira.pr.gov.br/calendario-eventos` and `?page=1`, `?page=2` (Drupal view with a
  "Carregar mais" `rel="next"` link). 32 cards on 3 pages (15, 15, 2), starts from 12/11/2026 to 21/02/2027; one card
  in Cascavel. Each card: title (link `/Evento/<slug>`), `Início: dd/mm/yyyy - HH:MM`, `Término: dd/mm/yyyy - HH:MM`,
  `Local: <city>- <UF>`. The listing's `Local` is the city, not the venue.
- Event page `/Evento/<slug>`: free-text body (`field--name-field-texto`) with `Local:` (the venue, e.g. "Auditório
  Bento Munhoz da Rocha Neto (Guairão)"), `Classificação etária:` and `Ingressos:`, plus cast, directors and programme,
  which are never read. No JSON-LD, no .ics.
- robots.txt: `User-agent: *` group only; no `Crawl-delay`, no `Visit-time`; `/calendario-eventos` and `/Evento/` are
  not disallowed (full group copied in docs/sources.md). No key. No licence found.

## Deviation from the brief (recorded on purpose)

The brief lists `venue` among the fields returned from the listing. The listing has no venue (its `Local` is the
city). So `venue`, `age_rating` and `price` are nullable and filled only from event pages read under a cap: at most
2 uncached event pages per call, items of the returned page only, in order, cached 6 hours. Other items keep `null`
with `details: "not_read"`; calling again fills the next ones from the cache plus 2 new reads.

## Design

- Tool `guaira_events`: optional `from`/`to` (YYYY-MM-DD, Curitiba time; default today to today + 30 days; at most
  366 days), optional `text` (every word must match the title, accents and case ignored; never sent
  upstream), optional `city` (default "Curitiba", whole name, accents and case ignored; "all" keeps every city),
  `limit` ≤ 50 and `offset`.
- Returns per item: `title`, `start` and `end` (`YYYY-MM-DDTHH:MM`, Curitiba local time, from the listing), `city`,
  `state`, `venue`, `age_rating`, `price` (nullable), `details` (`read` | `not_read` | `not_recognised` |
  `unavailable`), `link` (event page). Events overlapping the range are returned, earliest first. Also `total`,
  `other_city_rows` (rows left out by `city`), `truncated` (the listing had more pages than the cap).
- Source "Centro Cultural Teatro Guaíra / Governo do Paraná", license_note "No licence found; facts and links only;
  Teatro Guaíra / Governo do Paraná cited."
- Requests: host `www.teatroguaira.pr.gov.br` added to `ALLOWED_HOSTS`; `src/http.ts` reused (https only, refusal
  block on 401/403 or a CAPTCHA 429, size cap); same host only on redirects, below the requested path.
- Gate: the shared `src/hostGate.ts` (merged with v0.16.0), one gate for this host. Requests to the host start at
  least 5 s apart; a call whose turn is more than 10 s away gets `rate_limited` without a request; after a failure
  (inside `gate.run`: a layout change, a 200 answer that is not a page of the site, any HTTP error), no request for 60 s, or a 429's `Retry-After` when longer, at most 1 hour; 401/403, a
  CAPTCHA 429, or a 200 page that does not parse, is not a Drupal page of the site and matches the CAPTCHA/challenge
  markers blocks the host 10 minutes (`blockHost`; the gate remembers it as long, through the new optional
  `refusalWaitMs` of `createHostGate`, unused by the other hosts). Never retried in a loop.
- robots.txt read through the same gate, cached 24 h, before any listing or event page read. Matcher: the group for
  `curitibai-mcp` if present, else `*`; `Allow`/`Disallow` with `*` and `$`, longest match wins, ties allow. If
  `/calendario-eventos` becomes disallowed the tool stops (`source_unavailable`, fixed message); if `/Evento/` does,
  no event page is read. A robots.txt 404/410 allows all; a 5xx, network error or any other answer, other 4xx included,
  fails closed (`source_unavailable`; stricter than RFC 9309 on purpose).
- Listing: fixed URLs only (the bare path, then `?page=1`, `?page=2`); `rel="next"` is a yes/no, its href is never
  followed; cap 3 pages per load; one cache entry for the whole listing, 1 hour. Worst cold call: robots.txt, 3
  listing pages and 2 event pages, 5 s apart, about 25 s plus network time (MCP clients commonly time out at 60 s).
- Fail closed (`layout_changed`, new error code): no `view-content`, zero cards on the first page, a card without
  exactly one title link, start, end and city, a date not `dd/mm/yyyy - HH:MM` or not a real date, end before start,
  a slug not `[A-Za-z0-9-]`, markup inside a title, a second `<ul>` in the card list, or a `rel="next"` link that does not point to the next page.
  Nothing is returned then. An event page that does not have exactly one body field is `not_recognised` (fields
  null); an event page answering 404/410 is `unavailable` for that event only (cached, not a host failure); any
  other failure is `unavailable` (the rest of the call is kept, and no more event pages are read in that call; a
  page the gate refuses before a request stays `not_read`).
- Event page fields are strict: `venue` the text after `Local:` up to the next tag; `age_rating` only "Livre" or
  "N anos"; `price` only a run of "R$ 20,00 (inteira) | R$ 10,00 (meia-entrada)"-shaped amounts, or "Gratuito" /
  "Entrada gratuita" / "Entrada franca"; each value must be the whole text up to a line break or the end of the
  paragraph, or end a sentence before any inline tag, so a known prefix followed by other text is null, never a
  part. Never invented.
- Privacy: only title, dates, city, venue, age rating, price and link are returned; cast, directors, programme,
  contacts and images are never read into the result. Every text field goes through `cleanField` (control and format
  characters, NFC, the existing PII mask, cap); HTML entities are decoded first.

## Prior art

`robots-parser` (npm) would add a third runtime dependency for a 40-line matcher; built in-house and tested instead.
No existing MCP server or feed for this calendar (no .ics, no JSON-LD).

## Files

- `src/sources/guaira.ts` (URLs, robots matcher, listing and event-page parsers, caches), `src/hostGate.ts`
  (optional `refusalWaitMs`, `failing()`),
  `src/tools/guairaEvents.ts`, `src/tools/index.ts`, `src/tools/common.ts` (`layout_changed`), `src/config.ts`
  (host), `src/server.ts` and `package*.json` (0.17.0).
- `test/guaira.test.ts`, `test/fixtures/guaira/*` (real samples trimmed to the fields read), `test/setup.ts`,
  `test/tools.test.ts`, `scripts/smoke.mjs`.
- README, docs/sources.md, CHANGELOG 0.17.0.

## Out of scope

Other cultural calendars (Fundação Cultural de Curitiba, Cinemateca), ticket purchase, images, cast and programme.

## Check

`scripts/verify` exits 0: typecheck, lint, tests (listing and event-page parsers on trimmed real samples, fail-closed
cases, date and city filters, gate spacing and failure memory with fake timers, robots change, caches), build, smoke
(lists the tool). The GitHub `verify` check is green on the PR.
