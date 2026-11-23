# Local data files

Nine tools read files you keep in the folder set by `CURITIBAI_DATA_DIR` ([Quick start](../README.md#quick-start) shows how to
set it). The server never downloads these files. This section says what each tool needs and how to get it.

## Summarising a file you downloaded (for example the 156 file)

The server never downloads data files. A person does it in a browser:

1. Make a folder for the files, for example `~/curitibai-data`, and point `CURITIBAI_DATA_DIR` at it ([Quick start](../README.md#quick-start)).
2. Open <https://dadosabertos.curitiba.pr.gov.br/> in a browser and search for "156" (or call `open_datasets_search`
   with `156`, then `dataset_files` with the dataset id, to get the links).
3. On the dataset page, click DOWNLOAD and choose a CSV file (the daily 156 file is about 137 MB). Save it into the
   folder. Keep the `.csv` extension.
4. Ask the assistant, for example: "with local_csv_summary, count `156.csv` by `ASSUNTO`, only where `BAIRRO` is
   `CENTRO`". Use the column names the tool returns (call it with just `file` first).

The tool streams the file (it never loads it whole), detects `;` or `,` and UTF-8 or Latin-1, and returns column
names and counts. Data rows (after the first line) are never returned. What it does return, and what it refuses:

- **Values of the grouped column are returned** (for example each `ASSUNTO` with its count). Groups with fewer than 5
  rows (3 before 0.13.2) are added to `other_count` instead of being listed, so that a filter on a unique column
  cannot reveal a single record. A filter that matches fewer than 5 rows (0 included) returns `"<5"` for
  `matched_rows`, `other_count` and `distinct_values` instead of the number (since 0.21.1). Since 0.21.2, with a
  filter, an `other_count` of 1 to 4 is `"<5"` too (0 stays 0), and a filter that leaves 1 to 4 rows out is refused
  (`column_not_allowed`), because `row_count - matched_rows` would give their count. Known limit: `matched_rows`
  and the listed counts stay numbers, so when every group of 5 or more is listed, `matched_rows` minus their sum
  still gives a masked `other_count` back.
- **A grouped column whose values look like contact data is refused** (`column_not_allowed`): when a value that
  could be returned would be changed by the contact-data guard (CPF/CNPJ-, e-mail- or phone-shaped text, or year
  ranges that look like phone numbers such as "2025 - 2026"; the same masking as PNCP objects). Values are returned cut at 120 characters; since 0.13.3 the check runs on the
  whole value before the cut, so a phone or e-mail split by the cut is still found, and a contact value found after
  the 120-character cut also makes the whole column refused, even though that part would not be returned. The check
  reads the first 300 characters of a long value (`maskObject`), so contact data further in is not looked for; it is
  never returned either. This is a guard for contact data only: names of people in values are not detected.
- **Personal-looking columns are refused** (`column_not_allowed`) for both `group_by` and `filter_column`: names
  containing nome, name, cpf, cnpj, email/e-mail, telefone, fone, celular, matricula, endereco, logradouro,
  nasc (nascimento, DTNASC), servidor, beneficiario, paciente, solicitante, requerente, cidadao, contribuinte,
  titular, responsavel, documento, identidade, contato, whatsapp, usuario, morador, placa or inscricao, or the words rg, rua, cep, mae, pai or tel (accents
  and case ignored; camelCase, acronyms and digits are split, so `numeroRG`, `CEPResidencia` and `RG1` are refused). It fails closed on look-alikes (`NOMENCLATURA`,
  `QTD_PACIENTES` are refused too). **This guard is name-based and not perfect**: a column with personal data under an
  innocent or run-together name (`CEPRESIDENCIA`) is not caught.
- **The first line is returned as column names, with one check.** A first line that looks like data (digits,
  CPF/CNPJ, e-mail, phone, date, CEP, long text) is refused (`no_header_detected`, no columns returned); this also
  refuses some real headers (a column named `2024`). **A first line made only of text cannot be told apart from a
  header and is returned as column names**: in a headerless file, `Maria;Rua das Flores;Centro` would come back as
  `columns`. Only use files that have a header row.
- The path must be a `.csv` file inside the folder; anything outside it is `file_not_allowed`, whether or not it
  exists. The file is opened once (without following a final symbolic link, and without blocking, so a named pipe is
  refused instead of hanging the server), checked through that open descriptor and read from it, so swapping the file
  after the check does not change what is read.
- A field over 1 MB (for example an unclosed quote) or a line with more than 300 fields stops the read with
  `invalid_csv`.
The automated tests use small synthetic files; a one-off manual run on a 137 MB synthetic file took about 1 s. It was
also checked once, on 2026-11-19, against the 2026-11-18 daily 156 file: header accepted, 12 columns, 0 malformed
rows.

## Finding a city service (Carta de Serviços)

`city_services_search` answers "how do I ... at the Prefeitura?" from a local copy of the city's service catalog.
The server never contacts `www.curitiba.pr.gov.br`. `city_services_search` reads only a copy that you save yourself, by hand, in an ordinary browser session, into `CURITIBAI_DATA_DIR/carta-servicos.json`. An earlier local copy (2026-11-19/20) was deleted and is not used.
No automated capture of that host is part of this project (see [docs/sources.md](sources.md)). **This project does not ship or fetch the catalog**: its content belongs to the Prefeitura Municipal de Curitiba, and no
terms of use or licence for it was found. To use the tool, put a file named `carta-servicos.json` in the folder set by
`CURITIBAI_DATA_DIR` (the same folder `local_csv_summary` uses), with this shape:

```json
{
  "source": "https://www.curitiba.pr.gov.br/servicos/",
  "captured": "YYYY-MM-DD",
  "count": 1,
  "items": [
    { "cat": "Category", "title": "Service title", "what": "The listing's short description...",
      "url": "https://servicos.curitiba.pr.gov.br/<slug>/<numeric id>", "online": "https://... or null" }
  ]
}
```

`captured` must start with a date (YYYY-MM-DD, optionally `/DD` for a second day); `count` must equal the number of
items; `url` must be a service page on `servicos.curitiba.pr.gov.br` and its numeric ids must be unique. The file is
read again on every call (at most 4 MB), with the same folder rules as `local_csv_summary`. Without it the tool
returns `data_not_available` and the other tools work as usual.

Call it with no arguments to see the categories, then search by words ("iptu", "segunda via", "vacina"), by `category`
("Saúde") or with `online_only: true`. Each result links to the official service page (`official_url`) and, when the
catalog has one, to the online service (`online_url`). The server never opens those links; they are for people. Check
the official page before acting: the summary is only the site's short teaser, and the copy is a dated snapshot.

## Bus lines, stops, timetables and points of interest (URBS files you download)

`bus_lines_search`, `bus_line_stops`, `bus_departures`, `bus_stops_near`, `next_buses_near` and `city_points_search` read URBS's daily exports from the dataset "Transporte
Coletivo de Curitiba" (publisher URBS) of the Portal de Dados Abertos de Curitiba. **The server never downloads them**:
their mirror, `dadosabertos.c3sl.ufpr.br`, is treated as disallowed for automated access (see
[docs/sources.md](sources.md)). A person downloads them in a browser:

1. Make a folder named `urbs` inside the folder set by `CURITIBAI_DATA_DIR` (for example `~/curitibai-data/urbs`).
2. Open <https://dadosabertos.c3sl.ufpr.br/curitibaurbs/> in a browser and download the four files of one day:
   `YYYY_MM_DD_linhas.json.xz` (lines, used by `bus_lines_search` and `bus_stops_near`), `YYYY_MM_DD_pontosLinha.json.xz` (stops, used by
   `bus_line_stops` and `bus_stops_near`), `YYYY_MM_DD_tabelaLinha.json.xz` (timetables, used by `bus_departures` and `next_buses_near`) and
   `YYYY_MM_DD_pois.json.xz` (points of interest, used by `city_points_search`). Save them into `urbs`; a tool only
   needs its own file (`bus_stops_near` needs both `pontosLinha` and `linhas`; `next_buses_near` needs those two and
   `tabelaLinha`).
3. Decompress them there: `xz -d ~/curitibai-data/urbs/*.json.xz` (this leaves `YYYY_MM_DD_linhas.json` and so on;
   `xz` ships with macOS and most Linux distributions). Keep the names as they are: the tools look for exactly
   `YYYY_MM_DD_<kind>.json`.

Each tool reads the newest date present for its own kind, on every call (about 36 KB, 4.2 MB, 8.6 MB and 380 KB for
the 2026-11-20 files; at most 20 MB each), and returns that date as `checked_at`; `note` warns when the file is more than
30 days old. A row that does not match the expected shape (for example a time of "24:10" or a stop number with a
letter), or that lacks a field the tool filters or orders by (such as `CATEGORIA_SERVICO`, `SENTIDO` or `HORA`;
docs/sources.md lists them all), is left out and counted in `note` and `data.skipped_rows`; a missing or null descriptive field (such as `GRUPO`, `TIPO`
or `ADAPT`) becomes an empty string. Real exports fill each descriptive field (`NOME_COR`, `SOMENTE_CARTAO`, `NOME`,
`TIPO`, `GRUPO`, `PONTO`, `TABELA`, `ADAPT`) in at least some rows, so when one is empty in every valid row of the file
`note` says that field looks missing or renamed (for `ADAPT`, that an empty `adapt` does not mean no accessibility
equipment). The whole file is refused (`invalid_data`) only when it is not a
non-empty list or more than 5% of its rows (1 in 20) are invalid; then delete that file or change its name (for example add `.bad`) and the tool reads the newest
remaining dated file. Download a new set from time to time, since lines and timetables change; older files can stay or be
deleted. Ask, for example: "which bus lines go to Jardim Botânico?", then "stops of line 464", then "weekday
departures of line 464 between 07:00 and 08:00".

`city_points_search` returns only an allowlist of categories open to the public (23 ids; the full mapping to URBS's 45
category names is in [docs/sources.md](sources.md)). Rows in any other category, which name private businesses
or people, are dropped when the file is read, so no `name`, `near` or count can reach them; `note` gives how many were
dropped and names any category id with no row at all in the file (its URBS names look missing or renamed).
`cultural_space`, `special_education` and `vocational_education` may include private or non-profit institutions. Ask, for
example: "feiras near -25.43, -49.27", "health units near -25.50, -49.29 within 3 km", or call it with no arguments for the counts.

URBS's `DIA` codes are not explained in the files. `bus_departures` returns the code as published and, next to it,
`day_type`: 1 `weekday`, 2 `saturday`, 3 `sunday_or_holiday`. That reading is **inferred from the data** (see
[docs/sources.md](sources.md)), not stated by URBS. On holidays URBS announces which timetable applies.
Times are returned as published (00:00 to 23:59, each under its row's code) and `from`/`to` never wrap past
midnight. URBS files a late-night trip under the day its service starts, at the end of that day's table (checked on
the 2026-11-20 file, see [docs/sources.md](sources.md)): a row before 04:00 that comes after its table has run
from 20:00 or later on to before 04:00 (any other drop in its times is not a wrap) has `after_midnight: true` and runs on the calendar day after a day of its code. Other rows
before 04:00 are read as early trips of their own code's day (not verified).

<a id="events-and-useful-phones"></a>

## Events (Instituto Municipal de Turismo calendar, collected by a separate script)

**How updating works (since 0.18.0): nobody has to run anything.** A GitHub Actions workflow,
[`.github/workflows/collect.yml`](../.github/workflows/collect.yml), runs the collector `scripts/fetch-events.mjs` every
night at 02:37 UTC (23:37 in Curitiba), with retries at 03:17, 03:59, 04:37 and 05:13 UTC (since 0.19.3), on a standard GitHub-hosted runner (`ubuntu-latest`; "The use of standard
GitHub-hosted runners is free" in public repositories, per
[GitHub's billing page](https://docs.github.com/en/billing/concepts/product-billing/github-actions); no larger runner
is used). It follows exactly the rules below (window, robots.txt check, 5 s gap, no retry) and then
`scripts/publish-data.sh` commits only `events/events.json`, `events/status.json`, `phones/phones.json` and `phones/status.json` to the
orphan branch [`data`](https://github.com/Bossmann007/curitibai/tree/data) of this repository (never `main`). Since 0.21.2 `events.json` and `phones.json` start
with `"credit": "Fonte: Instituto Municipal de Turismo de Curitiba"` next to `source`, the page the facts came from
([docs/sources.md](sources.md#credit-to-the-instituto-municipal-de-turismo-in-the-published-files-since-0212)). It skips
the commit (and the push) when none of them changed. A run that fails inside the window (`robots_changed`,
`http_error`, ...) keeps the previous files, updates only the `status.json` files and shows as failed in the Actions
tab; after another failure (5xx, timeout, network, `layout_changed`, ...) the next schedule entry that night tries
again. **A refusal ends the night:** after a refusal (`http_error` 401, 403 or 429, or `robots_changed`) recorded on the UTC date, the later entries make no
request and change nothing (`code=refused_tonight`; exit 0 only with a success in the last 24 hours); the next night
tries again. Once both steps (events and phones) succeeded on the UTC date, the
later entries exit 0 at once (`code=already_collected`): no request, no file change, no push.
The job has `contents: write` only for itself, a 35-minute timeout (above the collector's own 30-minute deadline, so the collector always stops first and the run still publishes), and never overlaps another run.

`events_search` and `useful_phones` read, in this order:

1. the local file in `CURITIBAI_DATA_DIR` (`events/events.json`, `phones/phones.json`) when it exists, as before. A
   local file that is invalid or more than 7 days old keeps its error; delete it to use the published copy;
2. otherwise the published copy, from two fixed URLs,
   `https://raw.githubusercontent.com/Bossmann007/curitibai/data/events/events.json` and
   `https://raw.githubusercontent.com/Bossmann007/curitibai/data/phones/phones.json`, cached 1 hour, at most 2 MB and
   512 KB, same host and path only, checked against the same strict schema as a local file (anything else is
   `invalid_data` and nothing is returned); after a failure it is not asked again for 60 s (a failure of
   `raw.githubusercontent.com` itself pauses both files, a problem with one file only that file). Before the first nightly
   run has published anything the tools answer `data_not_available`.

**Turn remote reading off** with `CURITIBAI_REMOTE_DATA=0` (or `off`) in the server's environment: the tools then read
only the local file, as before 0.18.0, and make no network call.

Both tools return the file's `checked_at`; after 3 days they say `stale: true`, with a note that the nightly
collection may have stopped, and `events_search` refuses a file more than 7 days old.

- **The `data` branch is public.** It holds only facts and links from a site that publishes no licence (event
  titles, dates, times, places, addresses, categories and event page links; phone names, sections and numbers), plus
  the last run's status. The owner approved publishing facts and links only. No description, image or page HTML.
- **GitHub can turn the schedule off.** "In a public repository, scheduled workflows are automatically disabled when
  no repository activity has occurred in 60 days"
  ([GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)).
  To turn it back on: the repository's **Actions** tab, the `collect` workflow, **Enable workflow**; or
  `gh workflow enable collect.yml`
  ([how](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows#enabling-a-workflow)).
  `stale: true` in the tools' answers is the first sign.
- **Runs can be late or dropped.** "The `schedule` event can be delayed during periods of high loads of GitHub
  Actions workflow runs. High load times include the start of every hour. If the load is sufficiently high enough,
  some queued jobs may be dropped" (same page). The first scheduled run, on 2026-11-23, started 8.5 h late. That is
  why there are five entries. A run that starts outside 02:00–05:50 UTC makes no request, changes no file (neither
  data nor `status.json`, so the last successful record stays) and pushes nothing; the tools keep answering from the
  last good copy. A run that reaches 05:50 mid-way leaves the status of the step it stopped as it was (the events
  step: neither file is written; only the phones request: `phones/status.json` is kept, the finished events files are
  published). Such a run exits 0 when both steps succeeded in the last 24 hours (the `success` times in
  `events/status.json` and `phones/status.json`), and 1 otherwise, so a night with no collection still shows as a
  failed run.
- A manual run: `gh workflow run collect.yml` (or **Run workflow** in the Actions tab). Outside 02:00–05:50 UTC it
  makes no request to the site and changes nothing; on a UTC date when both steps already succeeded it exits 0 with
  `code=already_collected`.
- The detail cache (`events/details.json`) is not published, so every nightly run reads every detail page again:
  about 5 minutes for the 50 or so events seen on 2026-11-21. With 10 list pages of 10 events (a pager showing more
  stops the run) it is about 112 requests, each followed by the 5 s gap, plus the site's response time: about 10
  to 15 minutes, more when the site is slow. The collector stops itself at its 30-minute deadline (or 05:50 UTC),
  keeps the previous files and records the code in `status.json` (a 05:50 stop records nothing, as above), before the
  job's 35-minute timeout.
- `phones/status.json` is published too (since 0.18.1): when the last phones run failed, `useful_phones` names its
  `code` (and HTTP status) in the note, read from the same copy as the phones (a local file never makes a request),
  unless that attempt is older than the numbers. A missing or invalid status file adds nothing and never fails the
  answer; its failures are remembered for that file only (3 s timeout), except a 429 or a final refusal, which pause
  the host as for the other files.

**Running the collector yourself** (optional; a local file always wins over the published copy).
`events_search` then reads `events/events.json` inside `CURITIBAI_DATA_DIR`. **The server never contacts the events
site** (`turismo.curitiba.pr.gov.br` is not one of its hosts). The file is written by the collector:

```sh
CURITIBAI_DATA_DIR=~/curitibai-data node scripts/fetch-events.mjs
```

- **Only between 02:00 and 05:50 UTC** (23:00 to 02:50 in Curitiba). The site's robots.txt asks for visits between
  02:00 and 06:00 and at most one request every 5 seconds. Outside the window the script makes no request, writes no
  file and prints `code=window_closed`; it exits 0 when both steps succeeded in the last 24 hours, else 1. A scheduler
  (cron, launchd) can run it once a night inside the window. With `CURITIBAI_COLLECT_ONCE_A_DAY=1` (what the
  nightly workflow sets) a run on a UTC date when both steps already succeeded exits 0 with `code=already_collected`,
  no request and no file change; without it every run inside the window collects.
- Each run first takes a lock (`events/.lock`, created exclusively): if another run holds it, it exits with
  `code=locked` without any request or file change. A lock older than 1 hour is left by a run that died and is
  replaced.
- It then fetches robots.txt and stops (`robots_changed`) if the `User-agent: *` group differs in any way from the one
  recorded in the script (any added, removed or changed directive, including `Allow` and `Crawl-delay`); then it reads
  the day's list pages (Curitiba's date; a pager showing more than 10 stops the run) and the detail page of each event
  it needs. It waits 5 s between requests (longer if a recorded `Crawl-delay` or `Request-rate` asks for more), stops
  after 30 minutes or at 05:50 UTC, whichever comes first, gives each request 15 s, follows no redirect, and stops
  without retrying on any error status (403, 429, 5xx included). Node built-ins only; User-Agent `curitibai-mcp/0.10 (+https://github.com/Bossmann007/curitibai)` (the repository as contact).
- Detail pages it has read are kept in `events/details.json` with the time each was read (`fetched_at`), written after
  every page, so a run stopped by the deadline, the window or an error keeps its progress and the next run reads only
  the rest. A detail is read again when it is 7 days old or the event starts today or in the next 3 days, but never
  twice within 20 hours. After a successful run the cache keeps only the events still listed.
- It keeps only id, title, start and end dates, time, place, address, category and the event page link, which it
  builds from the id and slug. Descriptions, organisers, contacts, ticket and external links and images are never
  kept. Control and format characters (bidi, zero-width, tag characters) are removed, text is NFC-normalised, title
  and place are cut at 120 characters, and e-mail-, phone- and CPF/CNPJ-shaped text is replaced by `[masked]`.
- Schedule it early in the window (for example 02:30 UTC): a first run reads every detail page, one per 5 s (about 5
  minutes for the 50 or so events seen on 2026-11-21); if it is cut short, the next run continues from the cache.
- It writes `events/events.json` and `events/status.json` (last attempt, last success, result code) atomically. When a
  page does not have the expected structure, a field fails validation, the run is cut short, or the count is 0 or
  outside 0.3x–3x of the previous file's, it keeps the old `events.json` and exits nonzero (`code=layout_changed`, or
  the code of what stopped it; a `window_closed` stop writes no `status.json` and exits as described above). It prints only fixed status lines with counts and the exit code, never page text. If the
  site really changes size (fewer or more than 0.3x–3x the previous count), every run keeps failing this way: check the
  site, then delete `events/events.json` to accept the new count on the next run.
- **A day with no events also stops with `code=layout_changed`** and keeps the previous `events.json`. The script has
  never seen the site's empty list page, so it cannot tell "no events today" from a page it no longer understands, and
  it fails closed. On such a night `events_search` keeps answering from the last good file (marked `stale` after 3
  days); open the list page in a browser to check which case it is.

**When robots.txt changes** (`code=robots_changed`): open <https://turismo.curitiba.pr.gov.br/robots.txt> in a browser
and read the `User-agent: *` group. If the new rules still allow the list and event pages, edit `RECORDED_ROBOTS` (one
`"key: value"` per directive, key in lower case, no comment) and `ROBOTS_RECORDED_ON` in `scripts/fetch-events.mjs`,
update the copy in [docs/sources.md](sources.md) and the test robots in `test/fetchEvents.test.ts`, and run
`npm test` (or `scripts/verify`). If they no longer allow them, or move the visit window, do not run the collector until
the script follows them.

The parser was built from one list page and one detail page seen on 2026-11-21; multi-day date formats and an empty
day have not been seen yet (see [docs/sources.md](sources.md)), so the first real runs may stop with
`layout_changed` until the script is updated. Ask, for example: "events in Curitiba this weekend" or "concerts next
week".

**Useful phones (same collector, since 0.14.0).** After the events pages, the same run reads one more page,
<https://turismo.curitiba.pr.gov.br/conteudo/telefones-uteis/92> (1 GET per run, same window, robots.txt check, 5 s
gap, deadline and User-Agent; robots.txt allows `/conteudo/`). It runs only after the events step ended `ok` or with
`layout_changed`; after any other stop (an error status such as 403, 429 or 5xx, a redirect, a timeout, a network
error, the window or the deadline) it makes no request, so the host is not asked again after a refusal, and
`phones/status.json` gets the same code (except after a window stop, which leaves it as it was, since 0.19.3). It never changes the events files. It writes `phones/phones.json` and `phones/status.json` in
`CURITIBAI_DATA_DIR` and prints one more fixed line, `fetch-events: phones_code=<code> phones=<n> phones_dropped=<n>`;
the exit code is 0 only when both steps are ok (or, since 0.19.3, a window stop after a collection in the last 24 hours).

- It keeps, per entry, the section heading, the organ, service or company name and the numbers as published, plus
  the page link and when it was read. Notes and addresses on the page are not kept.
- It reads only the known structure: the page's one content block, its section headings, "- Name: number" lines,
  "- Name:" parents and their indented lines. An unknown tag, a number in an unknown format, an entry before the first
  heading, fewer than 20 entries, or a count outside 0.3x–3x of the previous file's stops with
  `phones_code=layout_changed` and keeps the previous `phones.json`; the script never guesses.
- Personal data: on the page read on 2026-11-22 every entry is a public body or a company (checked by hand); no
  person's name and no personal phone was found, so nothing was dropped. As a guard, an entry with a 9-digit mobile
  number, or whose name holds e-mail-, phone- or CPF/CNPJ-shaped text, is dropped and counted in `phones_dropped`.
  Names of people are not detected: a person's name with a landline number would be kept.

Ask, for example: "Defesa Civil phone number in Curitiba" or "telefone da Guarda Municipal".
