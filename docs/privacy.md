# Privacy and safety

The privacy notice is in the [README](../README.md#privacy-notice). This page has the collection rules and the details
behind it.

## Collection rules

- Each host's robots.txt was checked before the host was added (recorded in [docs/sources.md](sources.md)); a
  host or path it disallows is never fetched. The events collector (the only collector) reads robots.txt on every run,
  stops if it changed, starts requests only inside the site's `Visit-time` and makes at most 1 request per 5 s
  (`Request-rate: 1/5`). The server makes one request per tool call and page, cached in memory (see [Details](#details) and the [privacy notice](../README.md#privacy-notice)).
  `guaira_events` reads the Teatro Guaíra robots.txt itself (cached 24 h), stops if the calendar becomes disallowed
  and reads no event page if `/Evento/` does; a cold call makes up to 5 requests, at least 5 s apart (no event page
  starts after about 20 s; the listing load is never cut).
- A 403, a CAPTCHA, a login or any other block is never bypassed. In code: `src/http.ts` treats HTTP 401, 403 and a
  429 whose HTML page is a CAPTCHA as a final refusal (`guaira_events` also treats a 200 page that does not parse and
  looks like a CAPTCHA or challenge that way) (`source_unavailable` with the message "the source refused
  this server; it is not asked again for 10 minutes (per host)"; no retry, no other headers, no browser
  fallback; the host is then not asked again for 10 minutes in that process, and a paged tool returns what it found
  with `next_page: null`). The block is per host, not per path: a 403 on one portal path pauses every tool that uses
  that host. The events collector stops the run on any non-200 answer, 403 included, and a refusal (401, 403, 429 or a
  changed robots.txt) ends the night (since 0.19.4): the later nightly schedule entries make no request; the next night tries again. Another 429 is
  returned as `rate_limited` with the source's wait. PNCP alone retries once: after a connection error, or after a
  429 whose `Retry-After` is 5 s or less; never after a 401, 403 or CAPTCHA.
- Requests identify the project and its contact: User-Agent `curitibai-mcp/<version> (+https://github.com/Bossmann007/curitibai)`.
- Removal requests: open an issue in this repository with the
  [removal request form](https://github.com/Bossmann007/curitibai/issues/new?template=removal-request.yml); the content
  is removed from the next release.

## Details

- No telemetry, no secrets, no `.env`. The server writes no files; only the separate events collector
  (`scripts/fetch-events.mjs`, run by you or by the nightly workflow on GitHub) writes, and only inside `CURITIBAI_DATA_DIR/events/` (`events.json`,
  `status.json`, its detail cache `details.json` and its lock `.lock`). The cache is in
  memory only (10 minutes; 6 hours for the vaccination page and the GeoCuritiba layers, 15 minutes per ANA station; 1 hour
  for the Teatro Guaíra calendar, 6 hours for its event pages and 24 hours for its robots.txt; parsed result only) and is keyed by the request sent to
  the source.
- The server contacts exactly ten hosts, `https://dadosabertos.curitiba.pr.gov.br`,
  `https://apidadosabertos.saude.gov.br`, `https://pncp.gov.br`, `https://apiprevmet3.inmet.gov.br`,
  `https://ovp.dresel.systems` and `https://imunizaja.curitiba.pr.gov.br` (one page, `/locaisvacinacao/`; redirects to
  any other host, or outside `/locaisvacinacao`, are refused) and `https://geocuritiba.ippuc.org.br` (fixed layer
  queries under `/server/rest/services`; redirects to any other host or outside that path are refused) and
  `https://telemetriaws1.ana.gov.br` (`/ServiceANA.asmx/DadosHidrometeorologicos` for bundled station codes; ANA documents
  plain http, but https answered with a valid certificate on 2026-11-22, so https is used; redirects to any other host
  or outside `/ServiceANA.asmx` are refused) and `https://www.teatroguaira.pr.gov.br` (robots.txt, the calendar pages
  under `/calendario-eventos` and event pages under `/Evento`; redirects to any other host or outside those paths are
  refused) and `https://raw.githubusercontent.com` (only the three fixed files of this repository's `data` branch,
  `/Bossmann007/curitibai/data/events/events.json`, `/Bossmann007/curitibai/data/phones/phones.json` and
  `/Bossmann007/curitibai/data/phones/status.json`; redirects to
  any other host or outside `/Bossmann007/curitibai/data` are refused; `CURITIBAI_REMOTE_DATA=0` turns it off), on the
  default port and without credentials. Every redirect hop is checked
  against them (the redirect body is discarded first), and inputs are search terms, codes and a dataset GUID, never a URL.
  No user text ever enters an Overpass query: the query is built from the category allowlist, and name filters are
  applied to the result.
- The events collector (`scripts/fetch-events.mjs`) is separate from the server and contacts only
  `https://turismo.curitiba.pr.gov.br`, from its own allowlist, and only paths of the list and event pages plus
  robots.txt.
- Requests use the User-Agent `curitibai-mcp/0.7 (+https://github.com/Bossmann007/curitibai)` (the repository as contact), a 10 s timeout per request (25 s for PNCP, which is slow;
  15 s for INMET, the vaccination page, GeoCuritiba and the Teatro Guaíra pages; 30 s for Overpass, whose queries carry a 25 s server timeout) and an 8 MB
  response cap (1 MB for the INMET forecast and the vaccination page, 6 MB for the INMET warnings list, 3 MB for Overpass, 2 MB for GeoCuritiba, 1 MB for the Teatro Guaíra pages and 512 KB for its robots.txt). A body over the cap is `source_unavailable`
  with a message naming the cap.
- `vaccination_sites_search` reads the page by its known element ids only (region headers, unit name, address,
  schedule spans, map link), never its whole text. Each text field has control and format characters (bidi, zero
  width) removed, is NFC-normalised, masked like the events fields and length-capped. Coordinates are read from the
  map link only when it is a `https://maps.google.com/?q=lat,lon` link inside Curitiba, and no link from the page is
  returned; `source_url` is the page itself. A unit that does not fit the known structure is skipped and counted; more
  than 5% skipped, or no unit at all, is `source_unavailable`. After a failure the page is not requested again for 60 s
  (after a 429, the `Retry-After` wait, at most 1 hour).
- `places_search` returns only the tags listed in the table; phone, e-mail, operator and other contact tags of
  places are never returned. Names, street, suburb and city pass through the same masking as PNCP objects as a guard (opening hours, house number and postcode are returned as
  tagged), and a name filter matches the masked text only. The category allowlist leaves
  out shops, offices, doctors, dentists and clinics, whose names can be people's names. Hospitals are left out too
  (`health_units_search` covers public health units). Police and fire stations are never queried live, because the
  Overpass operator asks that no emergency or safety application depend on the service, and the only other free
  instance that allowed it (`overpass.private.coffee`) was not reachable: they come from a list taken once from OSM and bundled, and every such result starts with "NOT FOR
  EMERGENCIES" and the numbers 190 and 193. The list is as tagged in OSM: `police` includes the Guarda Municipal,
  identification institutes and the odd mis-tagged office (one veterinary council seat when taken).
  OSM does not reliably say whether a school is public, so `school` can include private ones (their names are
  institutions', not people's). A `website` that the guard would mask, as written or percent-decoded (for example a `wa.me/55...` link), is dropped;
  this fails closed, so a link with a long digit run (some social-media ids) or over 300 characters is dropped too.
- `procurement_search` never returns the supplier: its output is built field by field, and the PNCP Consulta endpoint it uses
  has no supplier field. Since 0.19.1 a `query` is sent to PNCP's site search (`pncp.gov.br/api/search`), whose
  records do carry supplier, publishing-user and free-text fields; only the fields the Consulta path reads are copied
  from them, so none of those can reach the output, and a result is kept only when the returned object or body name
  contains the query. **The search word is sent to PNCP** (accent-stripped and lower-cased, in the URL, so it may be
  in PNCP's logs); without `query` no user text leaves the server. The object text can name people, and a name cannot be told apart from other text by a rule,
  so the gate is by modality: for **dispensa (8), inexigibilidade (9), credenciamento (12, since 0.13.2), inaplicabilidade (14)** and any unknown modality
  the object is withheld (`object: null`, `object_withheld: "may_name_a_person"`); body, modality, value, status, dates
  and the PNCP link are still returned. For the other (competitive) modalities the object is returned as published,
  with CPF/CNPJ-shaped numbers, e-mail addresses and phone numbers replaced by `[masked]` and a 300-character cap.
  Before masking, Unicode hyphens, dashes and minus signs (soft and fullwidth hyphens included) become "-", invisible
  characters are removed and underscores between digits count as a space; number groups may be split by one or two
  spaces or by a hyphen, slash or dot with spaces around it ("123 . 456 . 789 - 09"), a DDD (leading 0 allowed) may be
  followed by a separator and 8 or 9 glued digits ("41 999998888", "041 33334444"), and spaces around "@" are allowed. This covers common
  formats; it is not a guarantee. With spaces around "@" only the word next to it is masked
  ("Maria Silva @ x.com" keeps "Maria").
  **These objects may still, rarely, contain a person's name.** The masking fails closed, so it also hides some public
  numbers (amounts of 10+ digits, long process numbers, 2 digits or 0 plus 2 digits followed by 8 or 9 digits).
  Since 0.13.2 two year-like numbers joined by a space, hyphen or dot ("2025 - 2026", "2026-2027") are masked too,
  because an 8-digit phone can look like that; "2025/2026" is kept. `query` never matches a withheld object.
- `city_services_search` never returns a link to the city's obituary system (`obituarios.curitiba.pr.gov.br`, lists
  of deceased people): such services keep their catalog entry and `official_url`, with `online_url: null`. Online
  links that are not http(s) or carry a username or password are dropped too. Summaries pass through the same
  masking as PNCP objects as a guard; on the earlier 2026-11-19/20 copy (deleted; measured before 0.13.2 widened the mask) it changes two summaries, both public text (an
  office's institutional e-mail, and a social-media handle that looks like an e-mail).
- The bus tools pass stop names through the same masking as a guard. It fails closed: on the 2026-11-20 files (measured before 0.13.2 widened the mask) it
  changes 29 of the 6,841 stop names in `pontosLinha`, all street-number ranges read as phone numbers
  ("R. Exemplo, 1469-1411" becomes "R. Exemplo, [masked]"), and none in `tabelaLinha`. Line names are not masked.
  `city_points_search` passes names and descriptions through the same masking; on the 2026-11-20 `pois` file (measured before 0.13.2) it
  changes none of the 1,219 allowlisted points. It drops every row outside its category allowlist before searching.
- Local files are read only from `CURITIBAI_DATA_DIR`, only through one module (`src/localfs.ts`: realpath, stat, a read-only
  open, fstat, positional reads, close, and listing the names in `urbs/`). CSV files are returned only as aggregates;
  `carta-servicos.json` and the URBS files are the files whose entries are returned (a public service catalog,
  public lines, stops and timetables, and points of interest open to the public, with no personal data).
- Text from the sources is returned as plain data fields with HTML removed, except INMET's text, which is passed on
  unchanged (it had no HTML when checked). It is never meant as instructions.
