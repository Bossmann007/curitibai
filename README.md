# CuritibAI

A read-only [MCP](https://modelcontextprotocol.io) server that lets AI assistants search the catalogue of the
[Portal de Dados Abertos de Curitiba](https://dadosabertos.curitiba.pr.gov.br/) (Brazil), list each dataset's files,
look up public health units in the Ministry of Health's CNES open API, search procurement of Curitiba municipal bodies
in the national PNCP portal, give Detran-PR's vehicle licensing calendar and its units in and around Curitiba, give INMET's weather forecast and
active weather warnings for Curitiba, search the Prefeitura's service catalog (Carta de Serviços), find public places in
OpenStreetMap, and summarise a CSV file the user downloaded by hand.

**Unofficial. Not affiliated with, endorsed by or connected to the Prefeitura de Curitiba, the Ministério da Saúde,
PNCP / the Ministério da Gestão e Inovação em Serviços Públicos, Detran-PR / the Governo do Paraná, or INMET
(Instituto Nacional de Meteorologia), or OpenStreetMap / the OSM Foundation.**
Data comes from the sources as it is; always confirm important information at the source.

## Tools

All tools are read-only. The seven network tools return `{data, source_url, fetched_at, license_note}`.
When a source fails, times out or changes format, the tool returns `{"error":"source_unavailable"}` as JSON text with
`isError: true`, and no data. `local_csv_summary` makes no network call and returns `{data, source: "local_file",
read_at, note}`; its errors are `data_dir_not_set`, `file_not_allowed`, `file_not_found`, `no_header_detected`,
`column_not_found`, `column_not_allowed` and `invalid_csv`. `detran_pr_info` makes no network call either: it returns
`{data, source_url, checked_at, note}` from data bundled in the code, and `invalid_argument` when `plate_final` is
given with `topic: "units"`. `city_services_search` also makes no network call: it reads a catalog file you keep in
`CURITIBAI_DATA_DIR` (see below) and returns `{data, source_url, checked_at, license_note, note}`; its errors are
`data_not_available` (no `CURITIBAI_DATA_DIR` or no `carta-servicos.json` in it), `invalid_data` (not UTF-8 JSON, the
wrong shape, or over 4 MB), `file_not_allowed`, and `invalid_argument` (listing the file's categories) for an unknown
`category`. `procurement_search` also returns `invalid_date_range`
(`from` after `to`, or more than 365 days apart). A network tool returns `rate_limited` when the source answers HTTP 429
to its first request; the message gives the wait from `Retry-After`, or about 1 minute. When a later page is refused,
`procurement_search`, `health_units_search` and `open_datasets_search` return what they found as `partial`, with the
wait in `note`.

| Tool | Input | Returns | Source (checked 2026-11-19) |
|---|---|---|---|
| `open_datasets_search` | `query` (2–100 chars), `limit` ≤ 20 | Dataset id, title, publisher, description, formats, last update, detail URL; `total`, and `partial` when a later result page failed (with `note` giving the wait when it was refused with HTTP 429) | Portal search form (`POST /conjuntodado/`) |
| `dataset_files` | `dataset_id` (GUID from the search), `page` | The dataset's files: name, format, size, last update, link and data-dictionary link (50 per page). **Links only: the files are not downloaded** | Portal detail page + `/ConjuntoDado/DownloadArquivos/` JSON |
| `health_units_search` | optional `name` (text in the unit name), optional `unit_type` (CNES type code or text in its label), `limit` ≤ 20, `page`, `skip` | Active **public-administration** health units in Curitiba: CNES code, name, unit type, address, neighbourhood, CEP, unit phone, management sphere; `next_page` and `next_skip` to continue, `partial` when the 5-request cap stopped the scan, and `discarded` (non-public records skipped) | Ministry of Health CNES API (`GET apidadosabertos.saude.gov.br/cnes/estabelecimentos`, `/cnes/tipounidades`) |
| `procurement_search` | optional `query` (text in the returned object or the body name), `from`/`to` (YYYY-MM-DD, ≤ 365 days apart; default the last 30 days), `modality` (PNCP code 1–20, default 6 Pregão - Eletrônico), `limit` ≤ 20, `page`, `skip` | Contratações published by **Curitiba municipal bodies**: PNCP id, body CNPJ and name, modality, object (withheld for direct awards, see below), estimated value, status, publication and proposal dates, link to the official PNCP page; `next_page`/`next_skip`, `partial` when the 2-request cap stopped the scan, `discarded`. **Never the supplier** | PNCP Consulta API (`GET pncp.gov.br/api/consulta/v1/contratacoes/publicacao`) |
| `detran_pr_info` | `topic`: `licensing_calendar` or `units`; optional `plate_final` (0–9, calendar only) | Calendar: the 2026 licensing due date for one plate final digit (or all ten, earliest first, each with `past`, which only means the Anexo I due date has passed; `note` quotes the Anexo II enforcement calendar as published) and the fee (R$ 94,61). Units: the 01ª CIRETRAN (Curitiba) and its five PATRANs (address, phone, services as published), the scheduling rule, and the site's two conflicting general hours (8h–16h and 8h–15h30), both returned. Each item has `source_url` and `checked_at`. **No network call**; for both topics `note` says the data may be outdated once the year in Curitiba is past 2026, and for units also once more than 180 days have passed since `checked_at` | Portaria DETRAN 907/2025 (Anexos I and II), a Detran-PR news page, `detran.pr.gov.br/unidades` and its home page, checked by hand |
| `weather_forecast` | optional `days` 1–5 (default 3) | INMET's forecast for Curitiba, per day (`date`, `weekday`) and period: `morning`, `afternoon` and `night` for the first days, one `whole_day` entry for later days, as INMET publishes them. Each period: summary, min/max temperature (°C), min/max humidity (%), wind direction and intensity, sunrise and sunset. A field INMET leaves out or empty is `null` | INMET forecast API (`GET apiprevmet3.inmet.gov.br/previsao/4106902`) |
| `weather_alerts` | optional `when`: `today`, `upcoming` or `all` (default) | INMET's active warnings whose area includes Curitiba (IBGE 4106902): id, which INMET lists it is in (`listed_in`: `today`, `upcoming` or both), description, severity, start, end (as published, no time zone given), risks and instructions, and `count`. A warning listed identically in both lists is returned once. When none covers Curitiba, `count` is 0 and `note` says so. Polygons, area lists and icons are dropped | INMET warnings API (`GET apiprevmet3.inmet.gov.br/avisos/ativos`) |
| `places_search` | `category` (one of `park`, `library`, `school`, `hospital`, `police`, `fire_station`, `community_centre`, `townhall`, `bus_station`, `marketplace`), optional `name` (2–100 chars; every word must appear in the name, accents and case ignored), `limit` ≤ 20 (default 10), `offset` | Public places in Curitiba mapped in OpenStreetMap: OSM type and id, name, category, address as tagged (`addr:street`, `housenumber`, `suburb`, `postcode`, `city`), lat/lon (a way's or relation's centre), `opening_hours` as tagged, `website` (http(s) without credentials only), OSM link; `total`, `next_offset`, `attribution`, `osm_data_as_of`. **No shops, offices, doctors, dentists or clinics** | OpenStreetMap via the Overpass API (`POST ovp.dresel.systems/api-sa/interpreter`), ODbL |
| `city_services_search` | optional `query` (2–100 chars; every word must appear in the title or summary, accents, case and punctuation ignored), optional `category` (one of the file's categories, exact), optional `online_only`, `limit` ≤ 20 (default 10), `offset` | Prefeitura de Curitiba services: numeric id, title, category, `summary` (the listing's short "O que é?" teaser as published, often cut off), `official_url` and `online_url` (or null); `total` and `next_offset`; with no `query`, `category` or `online_only`, also the `categories` with counts. Title matches come first, then by title. **No network call**; `checked_at` is the first date in the file's `captured`, and `note` says the catalog may be outdated once more than 180 days have passed since it | A local copy of the Carta de Serviços listing (`www.curitiba.pr.gov.br/servicos/`) that **you provide**: `carta-servicos.json` in `CURITIBAI_DATA_DIR`. Not shipped, not fetched |
| `local_csv_summary` | `file` (name inside `CURITIBAI_DATA_DIR`), optional `group_by`, `top` ≤ 50, optional `filter_column` + `filter_value` | Column names, row count, malformed-row count, and the largest groups of one column with their values (optionally filtered by `column = value`). Data rows after the first line are never returned; a text-only first line is returned as column names (see below); refuses personal-looking columns | A file you downloaded yourself; no network |

The file links point to `mid-dadosabertos.curitiba.pr.gov.br`. That host's robots.txt says `Disallow: /`, so this
server never opens them; a person can open them in a browser, and `local_csv_summary` can then summarise the file.

`health_units_search` returns only units whose natureza jurídica is in group 1 (public administration: municipal,
state and federal bodies, autarquias, public foundations); a record without that code is dropped. **Private clinics,
consultórios and non-profit hospitals are deliberately out of scope**, because in CNES their names can be people's
names (individual practitioners register under their own name). Each call scans at most 5 upstream pages of 20 units.

`procurement_search` asks PNCP for procurement whose buying unit is in Curitiba and keeps only the 15 CNPJs (14 municipal bodies; the city has two)
listed in [docs/sources.md](docs/sources.md) (the city, the câmara, municipal funds, foundations and institutes, URBS,
COHAB-CT), read from PNCP's own results; a body missing from that list is not returned. PNCP needs one modality per
query, so `modality` picks it. Each call scans at most 2 upstream pages of 50 records (the second only if the first
took under 15 s), and PNCP took 8–13 s per page when checked.

`weather_forecast` and `weather_alerts` pass INMET's values on unchanged (no rewording of summaries, descriptions, risks
or instructions; only the selected fields are returned). The warnings list is national (about 750 KB when checked);
the server reads it, keeps the warnings whose `geocodes` contain exactly `4106902`, and returns only their text fields.
A warning the server cannot read makes the tool return `source_unavailable` rather than "no warning".

Details for each source (format, terms, robots.txt) are in [docs/sources.md](docs/sources.md).

## Deferred

| Tool | Reason |
|---|---|
| `open_dataset_preview` | File hosts disallow automated access (robots.txt), and file rows hold individual records |
| `city156_categories`, `city156_stats` | Same reason. Download the 156 file by hand and use `local_csv_summary` (see below) |
| Bus lines, stops, timetables, real-time positions and fares | The URBS website is out of scope (it refuses non-browser clients) and its WebService needs a login; bus lines, stops and timetables are planned for v0.8 from URBS files the user keeps locally. See "Alternatives" |
| `schools_search`, `markets_fairs_list`, `culture_agenda` | Their files are only on the hosts whose robots.txt disallows automated access. `local_csv_summary` can count a file you download yourself |
| Private and non-profit health units | CNES names of private units can be people's names; `health_units_search` returns public-administration units only |
| `garbage_collection_by_street` | No source found |
| Suppliers, contracts and price-registration minutes (PNCP `/v1/contratos`, `/v1/atas`) | Suppliers can be natural persons (CPF); `procurement_search` returns the procurement notice only |
| Detran-PR fees by vehicle, debts, fines and IPVA by plate | The Detran-PR pages that show them need a login and a CAPTCHA; automating them would bypass that, and the results are about one owner's vehicle |
| Detran-PR statistics (Qlik panel) | An interactive Qlik dashboard, not a published dataset; not used |
| Detran-PR hours per unit | The site does not publish them; it states two different general hours, and `detran_pr_info` returns both |
| Procurement of Curitiba bodies missing from the list | The list was read from PNCP results published 2026-10-01 to 2026-11-18; a body that published nothing then is not in it |

### Alternatives (not recommended, not tested)

- [gtfs-mcp](https://github.com/jdamcd/gtfs-mcp) (MIT) is a generic GTFS MCP server, and
  [urbs-gtfs](https://github.com/benaytms/urbs-gtfs) (Apache-2.0 pipeline code) publishes a third-party GTFS feed for
  Curitiba. Two facts, checked 2026-11-19:
  - urbs-gtfs builds its feed from C3SL/UFPR data "subject to their terms"; that host's robots.txt disallows
    automated access.
  - The latest feed (published 2026-10-27) **expired on 2026-11-02** (`feed_end_date` in `feed_info.txt`).
- gtfs-mcp was not run here.

Out of scope by design: gov.br/CPF login, payments, scheduling, opening or looking up 156 tickets, personal data,
any tool that writes, and real-time feeds that need a key.

## Run it

Requires Node.js 22.12 or newer.

```sh
git clone https://github.com/Bossmann007/curitibai.git
cd curitibai
npm ci
npm run build
node dist/server.js   # speaks MCP over stdio; it prints nothing else
```

MCP client configuration (for example Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "curitibai": {
      "command": "node",
      "args": ["/absolute/path/to/curitibai/dist/server.js"]
    }
  }
}
```

Claude Code: `claude mcp add curitibai -- node /absolute/path/to/curitibai/dist/server.js`

To use `local_csv_summary` or `city_services_search`, add `"env": {"CURITIBAI_DATA_DIR": "/absolute/path/to/a/folder"}` next to `args`
(Claude Code: `claude mcp add curitibai -e CURITIBAI_DATA_DIR=/absolute/path/to/a/folder -- node ...`). Without it,
`local_csv_summary` returns `{"error":"data_dir_not_set"}`, `city_services_search` returns
`{"error":"data_not_available"}`, and the other tools work as usual.

### Summarising a file you downloaded (for example the 156 file)

The server never downloads data files. A person does it in a browser:

1. Make a folder for the files, for example `~/curitibai-data`, and point `CURITIBAI_DATA_DIR` at it (above).
2. Open <https://dadosabertos.curitiba.pr.gov.br/> in a browser and search for "156" (or call `open_datasets_search`
   with `156`, then `dataset_files` with the dataset id, to get the links).
3. On the dataset page, click DOWNLOAD and choose a CSV file (the daily 156 file is about 137 MB). Save it into the
   folder. Keep the `.csv` extension.
4. Ask the assistant, for example: "with local_csv_summary, count `156.csv` by `ASSUNTO`, only where `BAIRRO` is
   `CENTRO`". Use the column names the tool returns (call it with just `file` first).

The tool streams the file (it never loads it whole), detects `;` or `,` and UTF-8 or Latin-1, and returns column
names and counts. Data rows (after the first line) are never returned. What it does return, and what it refuses:

- **Values of the grouped column are returned** (for example each `ASSUNTO` with its count). Groups with fewer than 3
  rows are added to `other_count` instead of being listed, so that a filter on a unique column cannot reveal a single
  record.
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

### Finding a city service (Carta de Serviços)

`city_services_search` answers "how do I ... at the Prefeitura?" from a local copy of the city's service catalog.
**This project does not ship or fetch the catalog**: its content belongs to the Prefeitura Municipal de Curitiba, and no
terms of use or licence for it was found. To use the tool, put a file named `carta-servicos.json` in the folder set by
`CURITIBAI_DATA_DIR` (the same folder `local_csv_summary` uses), with this shape:

```json
{
  "source": "https://www.curitiba.pr.gov.br/servicos/",
  "captured": "2026-11-19/20",
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

## Privacy and safety

- No telemetry, no secrets, no `.env`, no files written. The cache is in memory only (10 minutes) and is keyed by the
  request sent to the source.
- The server contacts exactly five hosts, `https://dadosabertos.curitiba.pr.gov.br`,
  `https://apidadosabertos.saude.gov.br`, `https://pncp.gov.br`, `https://apiprevmet3.inmet.gov.br` and
  `https://ovp.dresel.systems`, on the default port and without credentials. Every redirect hop is checked
  against them (the redirect body is discarded first), and inputs are search terms, codes and a dataset GUID, never a URL.
  No user text ever enters an Overpass query: the query is built from the category allowlist, and name filters are
  applied to the result.
- Requests use a generic User-Agent, `curitibai-mcp/0.7`, a 10 s timeout per request (25 s for PNCP, which is slow;
  15 s for INMET; 30 s for Overpass, whose queries carry a 25 s server timeout) and an 8 MB response cap (1 MB for the
  INMET forecast, 6 MB for the INMET warnings list, 3 MB for Overpass). A body over the cap is `source_unavailable`
  with a message naming the cap.
- `places_search` returns only the tags listed in the table; phone, e-mail, operator and other contact tags of
  places are never returned. Names, street, suburb and city pass through the same masking as PNCP objects as a guard (opening hours, house number and postcode are returned as
  tagged), and a name filter matches the masked text only. The category allowlist leaves
  out shops, offices, doctors, dentists and clinics, whose names can be people's names. OSM does not reliably say
  whether a school or hospital is public, so `school` and `hospital` can include private ones (their names are
  institutions', not people's).
- `procurement_search` never returns the supplier: its output is built field by field, and the PNCP endpoint it uses
  has no supplier field. The object text can name people, and a name cannot be told apart from other text by a rule,
  so the gate is by modality: for **dispensa (8), inexigibilidade (9), inaplicabilidade (14)** and any unknown modality
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
  Two year-like numbers (19xx/20xx) joined by a space, hyphen or dot with no DDD, "+55" or parentheses before them
  ("2025 - 2026", "2026-2027") are kept, so an 8-digit phone that looks like that is not masked. `query` never matches a withheld object.
- `city_services_search` never returns a link to the city's obituary system (`obituarios.curitiba.pr.gov.br`, lists
  of deceased people): such services keep their catalog entry and `official_url`, with `online_url: null`. Online
  links that are not http(s) or carry a username or password are dropped too. Summaries pass through the same
  masking as PNCP objects as a guard; on the 2026-11-19/20 capture it changes two summaries, both public text (an
  office's institutional e-mail, and a social-media handle that looks like an e-mail).
- Local files are read only from `CURITIBAI_DATA_DIR`, only through one module (`src/localfs.ts`: realpath, stat, a read-only
  open, fstat, positional reads and close). CSV files are returned only as aggregates; `carta-servicos.json` is the
  one file whose entries are returned (it is a public service catalog with no personal data).
- Text from the sources is returned as plain data fields with HTML removed, except INMET's text, which is passed on
  unchanged (it had no HTML when checked). It is never meant as instructions.

## Limits

- The portal is a website, not a documented API. If its HTML or JSON changes, the tools return `source_unavailable`.
- The search matches accents literally ("saude" and "saúde" can differ) and finds nothing for some everyday words
  ("onibus", "feira"). Later result pages can be slow; when one times out, the tool returns what it has with
  `partial: true`.
- `dataset_files` does not check that the links work, and it cannot show the contents of a file.
- Licence: portal data is CC BY 4.0. The portal's usage rules require citing the source and a disclaimer, and each
  result's `license_note` carries both.
- CNES: the Ministry's licence notices disagree (CC BY-ND 3.0, CC BY-NC-SA 4.0, MIT; see
  [docs/sources.md](docs/sources.md)). This server treats the data under the strictest one: values are passed on
  unchanged, with attribution in `license_note`. The CNES API has no name filter and no total; `name` is matched on the
  pages scanned, so a search may need several calls: pass `next_page` and `next_skip` back as `page` and `skip`.
- PNCP: no licence for the API data was found; the PNCP site on gov.br is CC BY-ND 3.0, and `license_note` attributes
  the source and says how the object text was changed. PNCP has no text search in this endpoint and no Curitiba-only
  filter, so `query` and the body list are applied to the pages scanned (most records on a Curitiba page belong to
  state and federal bodies); continue with `next_page` and `next_skip`.
  PNCP is slow (8–13 s per page) and answered HTTP 429 once during checks; a refused or failed request is returned as
  `source_unavailable` (a connection reset is retried once), and an HTTP 429 as `rate_limited` (retried once only when
  Retry-After is 5 s or less).
- INMET: no documentation and no terms of use were found for `apiprevmet3.inmet.gov.br` (see
  [docs/sources.md](docs/sources.md)). This server treats the data under the strictest notice found, gov.br's CC BY-ND
  3.0: values are passed on unchanged and `license_note` attributes INMET with the source URL and the fetch time. The
  endpoints are undocumented, so a format change returns `source_unavailable`. Results are cached in memory for 10
  minutes, so a warning issued in that window appears on a later call.
- Carta de Serviços: the catalog's content belongs to the Prefeitura Municipal de Curitiba. No terms of use or
  licence was found for it, so this repository does not include it and the server never fetches it.
  `city_services_search` returns the titles and summaries of your local file unchanged (except masked text, see
  "Privacy and safety") and attributes them to "Prefeitura Municipal de Curitiba — Carta de Serviços" with the link
  and the capture date in `license_note`. The `www.curitiba.pr.gov.br` host answers 403 to non-browser clients, and
  the service pages' host (`servicos.curitiba.pr.gov.br`) has robots.txt `Disallow: /`; the server contacts neither.
  For the owner's own copy, the listing pages were read with a scripted browser session on 2026-11-19/20 (details in
  [docs/sources.md](docs/sources.md)); that copy may miss a few services, and its summaries are the site's short
  teasers, some of them empty (those services are found by title only).
- OpenStreetMap: data © OpenStreetMap contributors, under the [ODbL](https://www.openstreetmap.org/copyright).
  Every result carries that attribution in `attribution` and `license_note`, with the time of the OSM copy
  (`osm_data_as_of`, from Overpass `osm3s.timestamp_osm_base`). OSM is edited by volunteers: places can be missing,
  misplaced or outdated. The Overpass instance is a free service run privately
  by dresel.systems, with no availability guarantee and a limit of 4 parallel queries per IP; each server process sends
  one query at a time (a call that waited over 20 s in line gives up; after an HTTP 429 no request is sent until the
  wait is over) and returns `source_unavailable` when the instance is down. Its data is refreshed nightly, so
  `osm_data_as_of` is up to about a day old. Do not rely on these tools where an outage would cause harm. Results
  are cached in memory for 10 minutes; a call reads a whole category or the whole route list once and filters it.
- Detran-PR: no terms of use or licence was found on `detran.pr.gov.br` or `legislacao.pr.gov.br`, so
  `detran_pr_info` carries only public facts (dates, a fee, addresses and phone numbers of public offices), each with
  its source URL and check date. The data is a snapshot taken by hand on 2026-11-19 and is not refreshed: the
  calendar covers 2026 only, and units or hours can change without this server knowing. A new year's calendar needs a
  code update (see [docs/sources.md](docs/sources.md)).

## Development

```sh
scripts/verify   # no tracked carta-servicos.json, npm ci, tsc --noEmit, eslint, vitest, build, stdio smoke test; npm audit reported separately
```

Tests run offline: every network call is stubbed, and an unstubbed call fails the test. Portal parser tests use
trimmed real responses in `test/fixtures/`. CNES tests use **synthetic** fixtures (`test/fixtures/cnes_*_synthetic.json`:
the real JSON shape with invented values), PNCP tests use a synthetic fixture with planted supplier keys, CPF, e-mail,
phone and names (`test/fixtures/pncp_contratacoes_synthetic.json`), INMET tests use synthetic fixtures with the real
shape (`test/fixtures/inmet_*_synthetic.json`: invented texts, polygons and icons, a near-miss geocode, a warning listed
twice), OSM tests use trimmed real Overpass responses recorded on 2026-11-21 (`test/fixtures/osm_*_recorded.json`: the
libraries answer; OpenStreetMap data, © OpenStreetMap contributors, ODbL) and synthetic responses
for edge cases (`test/fixtures/osm_*_synthetic.json`, with planted e-mail, phone, credential and `javascript:` links),
and CSV tests use synthetic files.
`city_services_search` tests and the smoke test use a small synthetic catalog
(`test/fixtures/carta_servicos_synthetic/carta-servicos.json`: invented services in the real file shape, with an
e-mail to mask, an empty summary, obituary, `javascript:` and credential links); no real catalog text is in the
repository. `.gitignore` ignores `carta-servicos.json` in any folder, and `scripts/check-no-catalog` (the first verify
step) fails if git tracks one anyway (e.g. after `git add -f`); only that synthetic fixture is exempt, and the guard
also fails if that fixture is modified in the work tree. It must run at the top of a checkout (exit 2 elsewhere).

## License

Code: [Apache-2.0](LICENSE). The Apache-2.0 licence covers the code only; the data belongs to its publishers under
their own terms (see above). The Carta de Serviços catalog is not part of this repository.
