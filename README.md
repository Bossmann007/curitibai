<!-- ENZO-PORTFOLIO-BRAND -->
<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:111111,100:7751FF&height=165&section=header&text=CuritibAI&fontSize=42&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=Read-only%20MCP%20server%20for%20public%20data%20about%20Curitiba%2C%20Brazil&descAlignY=57&descSize=14" alt="CuritibAI: read-only MCP server for public data about Curitiba, Brazil" />
</p>

<p align="center"><strong>TypeScript · MCP · Dados abertos de Curitiba</strong></p>

<div align="center">

[![License](https://img.shields.io/badge/License-Apache--2.0%20%2B%20ODbL%20%28OSM%20extract%29-blue?style=for-the-badge)](#licences-code-and-data)
[![Node](https://img.shields.io/badge/Node-%3E%3D26.13.1-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](.nvmrc)
[![MCP](https://img.shields.io/badge/MCP-stdio-7751FF?style=for-the-badge&logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io)
[![Tests](https://img.shields.io/badge/Tests-720%20passed-2ea44f?style=for-the-badge&logo=vitest&logoColor=white)](#development)
[![Não oficial](https://img.shields.io/badge/N%C3%A3o%20oficial-no%20link%20with%20the%20Prefeitura-lightgrey?style=for-the-badge)](#curitibai)

</div>

---

# CuritibAI

CuritibAI is a read-only [MCP](https://modelcontextprotocol.io) server. It gives AI assistants 22 tools over public
data about Curitiba (Brazil): buses, public health units, vaccination sites, city services, city facilities, places, events, weather, river levels and rain, Teatro Guaíra events,
municipal procurement, Detran-PR and the city's open-data portal. The server writes no files, needs no account and does not store or log queries.

**Independent, unofficial project. It has no link with the Prefeitura Municipal de Curitiba and is not affiliated
with, endorsed by or connected to it, URBS, the Ministério da Saúde, PNCP / the Ministério da Gestão e Inovação em
Serviços Públicos, Detran-PR / the Governo do Paraná, INMET (Instituto Nacional de Meteorologia), the Instituto
Municipal de Turismo de Curitiba, IPPUC (Instituto de Pesquisa e Planejamento Urbano de Curitiba), ANA (Agência Nacional de Águas e Saneamento Básico), IAT-PR (Instituto Água e Terra), the Centro Cultural Teatro Guaíra, or OpenStreetMap / the OSM Foundation.** Names cited here (for example "Curitiba
App") belong to their owners and appear only to identify them. Data is provided as is, with no warranty: it may be
incomplete or outdated, so confirm anything important on the official channels before you go or act:
[URBS](https://www.urbs.curitiba.pr.gov.br/) (buses), [Imuniza Já](https://imunizaja.curitiba.pr.gov.br/locaisvacinacao/)
(vaccination), [INMET](https://portal.inmet.gov.br/) (weather), [Detran-PR](https://www.detran.pr.gov.br/) (vehicles)
or the 156 (Prefeitura). **Not for emergencies: call 190 (Polícia Militar), 192 (SAMU), 193 (Corpo de Bombeiros) or
199 (Defesa Civil).**

## Contents

- [Quick start](#quick-start)
- [Tools at a glance](#tools-at-a-glance)
- [Tool reference](#tool-reference)
- [Compared with the Curitiba App](#compared-with-the-curitiba-app)
- [Deferred](#deferred)
- [Local data files](#local-data-files): [CSV summaries](#summarising-a-file-you-downloaded-for-example-the-156-file),
  [Carta de Serviços](#finding-a-city-service-carta-de-serviços),
  [URBS files](#bus-lines-stops-timetables-and-points-of-interest-urbs-files-you-download),
  [events](#events-instituto-municipal-de-turismo-calendar-collected-by-a-separate-script)
- [Privacy and safety](#privacy-and-safety): [privacy notice](#privacy-notice), [collection rules](#collection-rules)
- [Limits](#limits)
- [Development](#development)
- [Contributing, security and removal requests](#contributing-security-and-removal-requests)
- [Licences (code and data)](#licences-code-and-data)

<a id="run-it"></a>

## Quick start

Requires Node.js 26.13.1 or newer (the version CI tests, from `.nvmrc`).

```sh
git clone https://github.com/Bossmann007/curitibai.git
cd curitibai
npm ci
npm run build
node dist/server.js   # speaks MCP over stdio; it prints nothing else
```

Then add the server to your MCP client. Every client starts the same command, `node` with the absolute path to
`dist/server.js`, and talks to it over stdio.

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

Other MCP clients: configure a stdio server with the command `node` and the single argument
`/absolute/path/to/curitibai/dist/server.js`. Check your client's documentation for where that setting goes.

To use `local_csv_summary`, `city_services_search`, `city_points_search`, `events_search`, `useful_phones` or the bus tools, add `"env": {"CURITIBAI_DATA_DIR": "/absolute/path/to/a/folder"}` next to `args`
(Claude Code: `claude mcp add curitibai -e CURITIBAI_DATA_DIR=/absolute/path/to/a/folder -- node ...`). Without it,
`local_csv_summary` returns `{"error":"data_dir_not_set"}`, `city_services_search` returns
`{"error":"data_not_available"}` (the bus tools and `city_points_search` too), and the other tools work as usual.
`events_search` and `useful_phones` work without it: they then read the copy the nightly collection publishes
([Events](#events-instituto-municipal-de-turismo-calendar-collected-by-a-separate-script)). [Local data files](#local-data-files) says what to put in that folder.

## Tools at a glance

All 22 tools are read-only. "Network" tools ask the source on each call (cached in memory for 10 minutes; 6 hours for
the vaccination page and the GeoCuritiba layers; 15 minutes per ANA station; 1 hour for the Teatro Guaíra calendar). "Local" tools read a file you keep in `CURITIBAI_DATA_DIR` or data bundled in the code, and
make no network call. "Nightly copy" tools read your local file when there is one, else the copy this project's
nightly GitHub workflow publishes (cached 1 hour; `CURITIBAI_REMOTE_DATA=0` turns it off). [Tool reference](#tool-reference) has every input, output and error.

| Area | Tool | What it answers | Data |
|---|---|---|---|
| Transport | `bus_lines_search` | Find URBS bus lines by name, code or category | Local (URBS file) |
| Transport | `bus_line_stops` | The stops of one line, per direction, in itinerary order | Local (URBS file) |
| Transport | `bus_departures` | Published departure times for a line, a stop or both | Local (URBS file) |
| Transport | `bus_stops_near` | Stops near a point and the lines that serve each one | Local (URBS files) |
| Transport | `next_buses_near` | The next published departures at the stops near a point | Local (URBS files) |
| Health | `health_units_search` | Public-administration health units in Curitiba (CNES) | Network (Ministry of Health) |
| Health | `vaccination_sites_search` | Public vaccination sites with hours and vaccines, by distance | Network (Imuniza Já page) |
| City | `city_services_search` | Prefeitura services from the Carta de Serviços | Local (your copy) |
| City | `city_facilities_search` | Feiras, Ruas da Cidadania, ecopontos, libraries, outdoor gyms, public toilets, parks, bike lanes and more, with days and hours as published | Network (IPPUC GeoCuritiba) |
| City | `city_points_search` | Points open to the public: feiras, schools, libraries, health units and more | Local (URBS file) |
| City | `places_search` | Parks, libraries, schools and other public places mapped in OpenStreetMap | Network (Overpass); police and fire stations bundled |
| City | `events_search` | Events from the Instituto Municipal de Turismo calendar | Nightly copy (GitHub `data` branch), or your local file |
| City | `guaira_events` | What is on at the Teatro Guaíra (dates, city, venue, age rating, price, event page) | Network (Teatro Guaíra calendar) |
| City | `useful_phones` | Useful public phone numbers (emergencies, city services, transport, radio taxis) | Nightly copy (GitHub `data` branch), or your local file |
| Weather | `weather_forecast` | INMET's forecast for Curitiba, up to 5 days | Network (INMET) |
| Weather | `weather_alerts` | INMET's active warnings that cover Curitiba | Network (INMET) |
| Weather | `river_levels` | Latest river level, flow and rain (last reading, 1 h, 24 h) at ANA telemetry stations around Curitiba, with a `quality` flag for suspect readings (see [Data quality](#river_levels-data-quality)); not for emergencies (Defesa Civil 199) | Network (ANA telemetry) |
| Procurement | `procurement_search` | Procurement published by Curitiba municipal bodies in PNCP, never the supplier | Network (PNCP) |
| Detran | `detran_pr_info` | Detran-PR's 2026 licensing calendar and its units in and around Curitiba | Local (bundled snapshot) |
| Open data | `open_datasets_search` | Search the Portal de Dados Abertos de Curitiba catalogue | Network (portal) |
| Open data | `dataset_files` | List one dataset's files as links (never downloads them) | Network (portal) |
| Open data | `local_csv_summary` | Column names and grouped counts of a CSV you downloaded | Local (your file) |

<a id="tools"></a>

## Tool reference

All tools are read-only. Seven of the eleven network tools return `{data, source_url, fetched_at, license_note}`;
`vaccination_sites_search` returns `{data, source_url, checked_at, attribution, license_note, note}`, with `checked_at`
the time the server read the page, and `city_facilities_search`, `river_levels` and `guaira_events` return `{data, source,
source_url, checked_at, license_note, note}`, with `checked_at` the time the server read the layer (for `river_levels`,
the oldest read time among the returned stations; for `guaira_events`, the calendar). `guaira_events` also returns
`layout_changed` (nothing returned) when the calendar's HTML no longer has the expected shape.
When a source fails, times out or changes format, the tool returns `{"error":"source_unavailable"}` as JSON text with
`isError: true`, and no data. `local_csv_summary` makes no network call and returns `{data, source: "local_file",
read_at, note}`; its errors are `data_dir_not_set`, `file_not_allowed`, `file_not_found`, `no_header_detected`,
`column_not_found`, `column_not_allowed` and `invalid_csv`. `detran_pr_info` makes no network call either: it returns
`{data, source_url, checked_at, note}` from data bundled in the code, and `invalid_argument` when `plate_final` is
given with `topic: "units"`. `city_services_search` also makes no network call: it reads a catalog file you keep in
`CURITIBAI_DATA_DIR` (see below) and returns `{data, source_url, checked_at, license_note, note}`; its errors are
`data_not_available` (no `CURITIBAI_DATA_DIR` or no `carta-servicos.json` in it), `invalid_data` (not UTF-8 JSON, the
wrong shape, or over 4 MB), `file_not_allowed`, and `invalid_argument` (listing the file's categories) for an unknown
`category`. The five bus tools (`bus_lines_search`, `bus_line_stops`, `bus_departures`, `bus_stops_near`, `next_buses_near`) and `city_points_search` make no network call either:
they read URBS files you keep in `CURITIBAI_DATA_DIR/urbs/` (see below) and return the same envelope; their errors are
`data_not_available` (no folder or no file of the kind needed), `invalid_data` (not UTF-8 JSON, not a non-empty list,
more than 5% of the rows invalid, or over 20 MB; the message says to delete that file or change its name to fall back
to the next newest), `file_not_allowed`, and `invalid_argument`. Single invalid rows are skipped, counted in `note` and in `data.skipped_rows`.
`useful_phones` reads `CURITIBAI_DATA_DIR/phones/phones.json`, written by the collector `scripts/fetch-events.mjs`,
when it exists, else the copy the nightly collection publishes (see [Events](#events-instituto-municipal-de-turismo-calendar-collected-by-a-separate-script)),
and returns `{data, source_url, fetched_at, checked_at, stale, attribution, license_note, note}` (`fetched_at` and
`checked_at` both hold the file's `checked_at`; `stale: true` after 3 days); its errors are
`data_not_available` (no local file and no published copy, or `CURITIBAI_REMOTE_DATA=0`; the message says how to run
the collector), `invalid_data` (not UTF-8 JSON, the wrong shape, a number in an unknown format, `checked_at` in the
future, or over 512 KB),
`source_unavailable` and `rate_limited` (the published copy could not be read), `file_not_allowed` and
`invalid_argument`.
`events_search` reads `CURITIBAI_DATA_DIR/events/events.json` the same way (local file first, else the published
copy), and returns `{data, source_url, checked_at, stale, attribution, license_note, note}`; its errors are
`data_not_available` (no local file and no published copy, or `checked_at` more than 7 days ago),
`invalid_data` (not UTF-8 JSON, the wrong shape, a link that is not the event page of its id, `checked_at` in the
future, or over 2 MB), `source_unavailable` and `rate_limited` (the published copy could not be read),
`invalid_date_range` (`from` after `to`, or more than 366 days apart), `file_not_allowed` and `invalid_argument`. `procurement_search` also returns `invalid_date_range`
(`from` after `to`, or more than 365 days apart). A network tool returns `rate_limited` when the source answers HTTP 429
to its first request; the message gives the wait from `Retry-After`, or about 1 minute. When a later page is refused,
`procurement_search`, `health_units_search` and `open_datasets_search` return what they found as `partial`, with the
wait in `note`.

| Tool | Input | Returns | Source (checked 2026-11-19) |
|---|---|---|---|
| `open_datasets_search` | `query` (2–100 chars), `limit` ≤ 20 | Dataset id, title, publisher, description, formats, last update, detail URL; `total`, and `partial` when a later result page failed (with `note` giving the wait when it was refused with HTTP 429) | Portal search form (`POST /conjuntodado/`) |
| `dataset_files` | `dataset_id` (GUID from the search), `page` | The dataset's files: name, format, size, last update, link and data-dictionary link (50 per page). **Links only: the files are not downloaded** | Portal detail page + `/ConjuntoDado/DownloadArquivos/` JSON |
| `health_units_search` | optional `name` (text in the unit name), optional `unit_type` (CNES type code or text in its label), `limit` ≤ 20, `page`, `skip` | Active **public-administration** health units in Curitiba: CNES code, name, unit type, address, neighbourhood, CEP, unit phone, management sphere; `next_page` and `next_skip` to continue, `partial` when the 5-request cap stopped the scan, and `discarded` (non-public records skipped) | Ministry of Health CNES API (`GET apidadosabertos.saude.gov.br/cnes/estabelecimentos`, `/cnes/tipounidades`) |
| `procurement_search` | optional `query` (text in the returned object or the body name), `from`/`to` (YYYY-MM-DD, ≤ 365 days apart; default the last 30 days), `modality` (PNCP code 1–20, default 6 Pregão - Eletrônico), `limit` ≤ 20, `page`, `skip` | Contratações published by **Curitiba municipal bodies**: PNCP id, body CNPJ and name, modality, object (withheld for direct awards and credenciamento, see below), estimated value, status, publication and proposal dates, link to the official PNCP page; `next_page`/`next_skip`, `partial` when the 2-request cap stopped the scan, `discarded`. **Never the supplier** | PNCP Consulta API (`GET pncp.gov.br/api/consulta/v1/contratacoes/publicacao`) |
| `detran_pr_info` | `topic`: `licensing_calendar` or `units`; optional `plate_final` (0–9, calendar only) | Calendar: the 2026 licensing due date for one plate final digit (or all ten, earliest first, each with `past`, which only means the Anexo I due date has passed; `note` quotes the Anexo II enforcement calendar as published) and the fee (R$ 94,61). Units: the 01ª CIRETRAN (Curitiba) and its five PATRANs (address, phone, services as published), the scheduling rule, and the site's two conflicting general hours (8h–16h and 8h–15h30), both returned. Each item has `source_url` and `checked_at`. **No network call**; for both topics `note` says the data may be outdated once the year in Curitiba is past 2026, and for units also once more than 180 days have passed since `checked_at` | Portaria DETRAN 907/2025 (Anexos I and II), a Detran-PR news page, `detran.pr.gov.br/unidades` and its home page, checked by hand |
| `weather_forecast` | optional `days` 1–5 (default 3) | INMET's forecast for Curitiba, per day (`date`, `weekday`) and period: `morning`, `afternoon` and `night` for the first days, one `whole_day` entry for later days, as INMET publishes them. Each period: summary, min/max temperature (°C), min/max humidity (%), wind direction and intensity, sunrise and sunset. A field INMET leaves out or empty is `null` | INMET forecast API (`GET apiprevmet3.inmet.gov.br/previsao/4106902`) |
| `weather_alerts` | optional `when`: `today`, `upcoming` or `all` (default) | INMET's active warnings whose area includes Curitiba (IBGE 4106902): id, which INMET lists it is in (`listed_in`: `today`, `upcoming` or both), description, severity, start, end (as published, no time zone given), risks and instructions, and `count`. A warning listed identically in both lists is returned once. When none covers Curitiba, `count` is 0 and `note` says so. Polygons, area lists and icons are dropped | INMET warnings API (`GET apiprevmet3.inmet.gov.br/avisos/ativos`) |
| `places_search` | `category` (one of `park`, `library`, `school`, `community_centre`, `townhall`, `bus_station`, `marketplace`, `police`, `fire_station`), optional `name` (2–100 chars; every word must appear in the name, accents and case ignored), `limit` ≤ 20 (default 10), `offset` | Public places in Curitiba mapped in OpenStreetMap: OSM type and id, name, category, address as tagged (`addr:street`, `housenumber`, `suburb`, `postcode`, `city`), lat/lon (a way's or relation's centre), `opening_hours` as tagged, `website` (http(s) without credentials only; dropped when the contact-data guard would mask any part of it), OSM link; `total`, `next_offset`, `attribution`, `osm_data_as_of`, `bundled`, `checked_at`. `police` and `fire_station` come from a list bundled once from OSM on 2026-11-21 (**no network call**; `note` warns after 180 days). For `police`, `note` also says the category is as tagged in OSM and includes Guarda Municipal, identification institutes and some non-police offices. **Not for emergencies: call 190 (Polícia Militar) or 193 (Corpo de Bombeiros).** No shops, offices, doctors, dentists, clinics or hospitals (use `health_units_search` for public health units) | OpenStreetMap via the Overpass API (`POST ovp.dresel.systems/api-sa/interpreter`); police and fire stations from the bundled copy (`src/sources/osmBundled.ts`, ODbL), ODbL |
| `city_services_search` | optional `query` (2–100 chars; every word must appear in the title or summary, accents, case and punctuation ignored), optional `category` (one of the file's categories, exact), optional `online_only`, `limit` ≤ 20 (default 10), `offset` | Prefeitura de Curitiba services: numeric id, title, category, `summary` (the listing's short "O que é?" teaser as published, often cut off), `official_url` and `online_url` (or null); `total` and `next_offset`; with no `query`, `category` or `online_only`, also the `categories` with counts. Title matches come first, then by title. **No network call**; `checked_at` is the first date in the file's `captured`, and `note` says the catalog may be outdated once more than 180 days have passed since it | A local copy of the Carta de Serviços listing (`www.curitiba.pr.gov.br/servicos/`) that **you provide**: `carta-servicos.json` in `CURITIBAI_DATA_DIR`. Not shipped, not fetched |
| `bus_lines_search` | optional `query` (1–100 chars; every word must appear in the line name or code, accents, case and punctuation ignored), optional `category` (one of the file's categories, accents and case ignored), `limit` ≤ 50 (default 20), `offset` | URBS bus lines: `code`, `name`, `category`, `color`, `card_only` (SOMENTE_CARTAO: S true, N false, else null); `total` and `next_offset`; with no filter, also the `categories` with counts. An exact code comes first, then by name. **No network call**; `checked_at` is the file's date, and `note` warns once it is more than 30 days old | The newest `YYYY_MM_DD_linhas.json` in `CURITIBAI_DATA_DIR/urbs/`, which **you download** (see below). Not shipped, not fetched |
| `bus_line_stops` | `line_code` (case ignored), optional `itinerary_id` (one direction), `limit` ≤ 50 (default 50), `offset` | The line's `directions` (direction name, `itinerary_id`, stop count) and its stops in itinerary order: direction, `seq`, `stop_number`, `name` (masked as a guard, see "Privacy and safety"), `lat`/`lon` (decimal; null when empty), shelter `type` and URBS's `group`, as published | The newest `YYYY_MM_DD_pontosLinha.json`, same folder |
| `bus_departures` | `line_code` and/or `stop_number` (at least one), optional `day` (URBS DIA code), optional `from`/`to` (HH:MM, inclusive, `from` ≤ `to`), `limit` ≤ 50 (default 20), `offset` | Published departure times, ordered by day, time, line and stop: `time`, `day` (the code), `day_type` (`weekday`, `saturday`, `sunday_or_holiday` for 1, 2, 3, **inferred from the data, not stated by URBS**; null for any other code), `line_code`, `stop_number`, `stop_name` (masked as a guard), `table` (TABELA) and `adapt` (ADAPT, the accessibility equipment), as published, and `after_midnight` (true when the row continues the previous evening's service past midnight). Not real-time | The newest `YYYY_MM_DD_tabelaLinha.json`, same folder |
| `bus_stops_near` | `near` (`{lat, lon}`, required), `radius_m` (default 400, at most 2000), optional `line_code` (only stops that line serves; case ignored), `limit` ≤ 50 (default 20), `offset` | "Which buses stop near me": the stops within the radius, nearest first, **one item per stop number** however many lines serve it: `stop_number`, `stop_name` (masked as a guard), `lat`/`lon`, `distance_m` (straight line, not walking), shelter `type`, and `lines` (`line_code`, `line_name` from the lines file, null when the code is not there, and `direction` = SENTIDO), one entry per line and direction; `total` (stops, not rows) and `next_offset`. A stop's name, position and type come from its first row with coordinates; stops with no coordinates are never returned. Not real-time: for times, call `bus_departures` with the `stop_number`. No network call; `checked_at` is the stops file's date, and `note` names the lines file when its date differs. About 50 ms per call (median; the first call in a process about 105 ms) on the 17,496-row 2026-11-20 file (Apple M4); `scripts/verify` fails above 400 ms on 17,496 generated rows | The newest `YYYY_MM_DD_pontosLinha.json` and `YYYY_MM_DD_linhas.json`, same folder (both needed) |
| `next_buses_near` | `near` (`{lat, lon}`, required), `radius_m` (default 400, at most 1000), optional `at` (HH:MM, default now in Curitiba), optional `day` (URBS DIA code; default from today's weekday in Curitiba), `window_min` (default 60, at most 180), optional `line_code` (case ignored), `limit` ≤ 50 (default 20) | "Next buses near me" in one call: the published departures in the window at the stops within the radius, soonest first: `time`, `day` (the code), `minutes_from_now` (from `at`), `line_code`, `line_name`, `directions` (every SENTIDO the stops file gives for that line at that stop: the timetable has no direction, and most timetable stops are served in both), `stop_number`, `stop_name` (masked as a guard), `distance_m` (straight line), `adapt`, `after_midnight`; plus `windows` searched, `stops_considered`, `stops_with_times` (URBS publishes times only at some stops), `total` and `skipped_rows`. **The day code is inferred** (Monday to Friday 1, Saturday 2, Sunday 3) and **holidays are not detected**: pass `day` on a holiday. URBS files a late-night trip under the day its service starts, so a window past 24:00 reads that day's after-midnight trips plus the next calendar day's early trips, and a window starting before 04:00 reads the previous day's after-midnight trips plus today's early ones; an explicit `day` is read as the service day (its after-midnight trips are read, the next day's early trips are not: `cut_at_midnight`). Timetable as published, not real-time. No network call; `checked_at` is the timetable's date. About 73 ms per call (median; the first call in a process about 135 ms) on the 2026-11-20 files (Apple M4); `scripts/verify` fails above 600 ms on 17,496 generated stop rows and 71,085 departures | The newest `YYYY_MM_DD_tabelaLinha.json`, `YYYY_MM_DD_pontosLinha.json` and `YYYY_MM_DD_linhas.json`, same folder (all three needed) |
| `city_points_search` | optional `category` (one of 23 ids, e.g. `feira`, `cambio_verde`, `library`, `cmei`, `municipal_school`, `bus_terminal`, `health_unit`, `urgent_care`; [docs/sources.md](docs/sources.md) maps each to URBS's category names), optional `name` (1–100 chars; every word must appear in the name, accents, case and punctuation ignored), optional `near` (`{lat, lon}`) with `radius_m` (default 1500, at most 10000), `limit` ≤ 50 (default 20), `offset` | Points of interest **open to the public** from URBS's export: `name` and `desc` (masked as a guard), `category` (the id), `source_category` (URBS's name), `lat`/`lon` (decimal; null when empty), and `distance_m` when `near` is given (nearest first; otherwise by name); `total` and `next_offset`; with no filter, also the `categories` with counts, each split per URBS name (`source_categories`: `{name, count}`). **Only an allowlist of categories**: private schools and crèches, hotels, churches, supermarkets and markets, shopping centres, private clubs, newsstands, hospitals, laboratories, police and security (use `places_search`), urban equipment and any unknown category are dropped before searching. `cultural_space`, `special_education` and `vocational_education` are open to the public but may include private or non-profit institutions (commercial cinemas, private theatres and museums, private schools); `note` says so, naming only those among the matches. `note` warns when a whole category id has no row in the file, but **not** when only one of its URBS names is renamed: renaming BIB FAROL DO SABER would drop 45 of the 59 libraries in the 2026-11-20 file with no warning, so check `source_categories` for a 0 after downloading a new file. The file has **no days or hours** (not even for feiras). **Not for emergencies** (192 SAMU, 193). No network call; `checked_at` is the file's date | The newest `YYYY_MM_DD_pois.json`, same folder |
| `events_search` | optional `from`/`to` (YYYY-MM-DD; default today to 7 days ahead, Curitiba time), optional `text` (2–100 chars; every word must appear in the title, place, address or category, accents and case ignored), optional `category` (as published, accents and case ignored), `limit` ≤ 50 (default 20), `offset` | Events overlapping the range, earliest first: `id`, `title`, `start_date`, `end_date`, `time`, `place`, `address`, `category` and `link` (the event page); `checked_at` (when the collector ran) and `stale: true` after 3 days. Every field is untrusted third-party text | Instituto Municipal de Turismo de Curitiba, public events calendar (`turismo.curitiba.pr.gov.br/eventos/`), via `scripts/fetch-events.mjs` (nightly on GitHub, or run by you); not affiliated; the site publishes no licence, so only facts and links are kept |
| `useful_phones` | optional `query` (2–100 chars; every word must appear in the name, section or number, accents and case ignored; digits also match a number without its punctuation), `limit` ≤ 50 (default 20) | Entries in page order: `name` (organ, service or company as published; an indented line gets its parent's name in front, as in "Polícia Federal - imigração/passaporte"), `section` (the page's heading: Emergências, Serviços, Transporte, Centrais de Radiotáxi de Curitiba) and `numbers` (as published, such as "193", "(41) 3350-6456", "0800 5100116"); `total`, `skipped_rows` (file rows dropped because the name or section was empty after cleaning), `source_url` (the page), `fetched_at` and `checked_at` (when the collector read it) and `stale: true` after 3 days. Notes next to numbers ("Fax", "(demais cidades)") and addresses are not kept. Never contacts the Turismo site. In an emergency call 190, 192 or 193 directly | Instituto Municipal de Turismo de Curitiba, "Telefones Úteis" page (`turismo.curitiba.pr.gov.br/conteudo/telefones-uteis/92`), via `scripts/fetch-events.mjs` (nightly on GitHub, or run by you); not affiliated; the site publishes no licence, so only facts and the link are kept |
| `vaccination_sites_search` | optional `text` (2–100 chars; every word must appear in the unit name, the address, which ends with the neighbourhood, or the regional; accents and case ignored), optional `vaccine` (2–100 chars; every word must appear in the same vaccine line), optional `near` (`{lat, lon}`), `limit` ≤ 50 (default 20), `offset` | Curitiba's public vaccination sites (about 100 municipal health units): `name`, `address`, `regional`, `hours` and `vaccines` **as published** (e.g. "Horário (segunda a sexta) : Das 7h às 19h", "Vacinas (12 anos ou mais)"), `lat`/`lon` (read from the page's map link, which is never returned; null when missing or outside Curitiba), and `distance_m` with `near` (nearest first, straight line; sites without coordinates are left out and counted in `note`); `total`, `next_offset`, `skipped_units`. Every text field is untrusted third-party text, cleaned and masked. The page shows **no update date**: `note` says to confirm by phone or with the 156 before going. **Not for emergencies** (192 SAMU). One page read per call at most, cached 6 hours | The Prefeitura's "Imuniza Já" page (`GET imunizaja.curitiba.pr.gov.br/locaisvacinacao/`, HTML, checked 2026-11-21); no licence found |
| `city_facilities_search` | `type` (Portuguese, accents and case ignored: `feira`, `feira turistica`, `rua da cidadania`, `ecoponto`, `ecocidadao`, `cambio verde`, `armazem da familia`, `sacolao da familia`, `mercado municipal`, `restaurante popular`, `banheiro publico`, `biblioteca`, `farol do saber`, `museu`, `teatro`, `academia ao ar livre`, `clube da gente`, `centro de esporte e lazer`, `pista de skate`, `cemiterio`, `cras`, `conselho tutelar`, `posto urbs`, `informacoes turisticas`, `parque`, `ciclovia`, or an alias; `list types` returns them all with no network call), optional `bairro` (2–60 chars; the whole name, accents and case ignored), optional `near` (`{lat, lon}`) with `radius_m` (default 1000, at most 3000), `limit` ≤ 50 (default 20), `offset` | Facilities of one IPPUC layer: `name`, `kind` (park or bike-lane kind), `address` (null when the record says the address is not to be shown, and then no position either), `bairro`, `regional`, `hours` (the record's `observacao`, one line each, **as published**: days, hours and notes), `open_periods` (`morning`, `afternoon`, `night`, `all_day` from `func_manha`, `func_tarde`, `func_noite`, `func_24hr`), `phones` (Curitiba landlines and three-digit service numbers only; mobiles, 0800 and other area codes dropped), `emails` (curitiba.pr.gov.br addresses only), `updated` (`dt_atualiz`, YYYY-MM-DD), `length_km` (bike lanes), `area` (parks, as published), `lat`/`lon` (WGS84; a park's centroid, a bike segment's first point) and `distance_m` with `near` (straight line; to a park's centroid, to the nearest point of a bike segment); `total`, `next_offset`, `skipped_records`. Text is cleaned and masked. Hours can be outdated: `note` says to confirm with the 156. One layer read per call at most, cached 6 hours; at most one request per 5 s to the host (a call that would wait over 10 s gets `rate_limited`), no request for 60 s after a failure (a 429's Retry-After when longer, at most 1 hour), and an ArcGIS auth error is a refusal (10-minute host block); the user's position and `bairro` are never sent | IPPUC, GeoCuritiba ArcGIS REST (`GET geocuritiba.ippuc.org.br/server/rest/services/Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer/<layer>/query` and `.../GeoCuritiba/CICLOVIA_dashboard/FeatureServer/<0 or 1>/query`, checked 2026-11-21); no licence found |
| `river_levels` | optional `station` (2–60 chars: a station code, leading zeros optional, or the start of a code, or text matched against the station name, river and municipality, accents and case ignored, e.g. `iguacu`, `fazendinha`, `araucaria`), optional `near` (`{lat, lon}`; default Curitiba centre) | Up to 3 stations of the 25 bundled ANA telemetry stations around Curitiba (all operated by IAT-PR), nearest first (without `station`, river stations before rain gauges): `code`, `name`, `river` (null for rain gauges), `municipality`, `lat`/`lon`, `distance_km`, `status` (`ok`; `no_recent_data` when the station sent nothing since yesterday 00:00 Curitiba time; `unavailable` when its XML answer could not be read, that station not asked again for 60 s; values null in both, never invented), `reading_time` (newest reading with a value, Curitiba time, ISO with `-03:00`), `stale` (latest reading older than 2 h, computed at answer time), `level_cm`, `flow_m3s`, `rain_mm` (latest 15-minute reading), `rain_1h_mm` and `rain_24h_mm` (sum of the readings in the hour / 24 h ending at the latest reading; null when no rain value, or when the 24 h window starts before yesterday 00:00; a lower bound when readings are missing), `checked_at`, `quality` (`ok`: no check fired, which does not prove a value is right; `suspect`: treat the values with caution; `unknown`: no reading or under 8 readings in the 24 h) and `quality_reasons` (`out_of_range`, `level_spike`, `level_jump_unconfirmed`, `level_stuck`, `too_few_readings`; see [Data quality](#river_levels-data-quality)), separate from `stale`; `total_matches`, `more_matches` (matching stations not read) and `partial`. `note` starts with "Not for emergencies: Defesa Civil 199." and names the suspect stations. At most 3 stations per call, each cached 15 minutes; at most one request per 5 s to the host (a call that would wait over 10 s gets `rate_limited`), no request for 60 s after a failure (a 429's Retry-After when longer, at most 1 hour), 401/403/CAPTCHA blocks the host 10 minutes (while blocked, an uncached station fails at once: no wait, no request); an HTTP 200 answer that is not ANA's XML document is a host failure (an HTML maintenance or WAF page: remembered 60 s; a CAPTCHA or challenge page blocks the host 10 minutes and is a refusal, see below). A station not read is never shown as `no_recent_data`. Time budget: no request starts after 20 s (plus 1 s of slack); stations left out come first in `more_matches`, with `partial: true` and a note (worst case 21 s plus the 10 s timeout). When the host gate refuses a station mid-call (`rate_limited`: its turn is more than 10 s away, or a 429 is remembered), the stations already read in this call or found in the cache are returned the same way (`partial: true`, a note with the wait); `rate_limited` is returned only when no station is available. A final refusal on a later station (401/403 or a CAPTCHA) is handled the same way: the stations already read are returned with `partial: true` and a note that the host refused (the 10-minute block stays in force); `source_unavailable` is returned only when no station is available. A host or transfer failure on a later station (HTTP 5xx, a timeout, a network error, a non-XML 200 answer) is handled the same way: the stations already read or cached are returned with `partial: true`, the failed stations first in `more_matches`, and a note naming the failure (not asked again for up to about 1 minute); `source_unavailable` only when no station is available. No match: `invalid_argument`. The user's text and position are never sent | ANA telemetry web service (`GET telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos`, checked 2026-11-22); no licence found |
| `guaira_events` | optional `from`/`to` (YYYY-MM-DD; default today to 30 days ahead, Curitiba time; at most 366 days), optional `text` (2–100 chars; every word must appear in the title, accents and case ignored; never sent to the source), optional `city` (whole name, accents and case ignored; default `Curitiba`, `all` for every city), `limit` ≤ 50 (default 20), `offset` | Events overlapping the range, earliest first: `title`, `start` and `end` (`YYYY-MM-DDTHH:MM`, Curitiba local time, as listed), `city`, `state`, `venue`, `age_rating` ("Livre" or "N anos") and `price` (amounts as published, or "Gratuito"/"Entrada franca"), `details` (`read`, `not_read`, `not_recognised`, `unavailable`) and `link` (the event page); `total`, `next_offset`, `other_city_rows`, `truncated`, `partial` (deprecated alias of `truncated`, always equal; kept for compatibility and may be removed later), `details_pending`. The listing (title, dates, city, link) is the complete answer; venue, age rating and price are an optional enrichment from event pages, at most 2 new ones per call (cached 6 hours, at most 500 pages), and are null otherwise: items whose page was not read yet, or failed in this call, are counted in `details_pending`, with a note to call again for venue and price; cast, directors and programme are never read. Text is cleaned and masked. Calendar cached 1 hour (at most 3 listing pages); at most one request per 5 s to the host (a call that would wait over 10 s gets `rate_limited`), no request for 60 s after a failure (a 429's Retry-After when longer, at most 1 hour), 10-minute block on 401/403 or a CAPTCHA; robots.txt read first (cached 24 h) and the tool stops if the calendar becomes disallowed. Time budget: no event page is asked for after 20 s, plus 1 s of slack (those items stay `not_read` and count in `details_pending`, never `partial`; the listing load is never cut); a cold call takes about 20 s and reads 1 event page (worst case 21 s plus the 15 s timeout) | Centro Cultural Teatro Guaíra (`GET www.teatroguaira.pr.gov.br/calendario-eventos`, `?page=1`, `?page=2` and `/Evento/<slug>`, checked 2026-11-22); no licence found |
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

### `guaira_events` cold and warm calls

The listing (title, dates, city, link) is the complete answer on every call; `truncated: true` means listing pages are
missing. Venue, age rating and price come from event pages, at most 2 new ones per call, so they fill in over a few
calls. A first (cold) call reads the calendar and about one event page:

```json
{ "data": { "total": 8, "truncated": false, "partial": false, "details_pending": 7, "items": ["..."] } }
```

A call a little later (warm: the calendar and the event page already read are cached) reads up to 2 more event pages:

```json
{ "data": { "total": 8, "truncated": false, "partial": false, "details_pending": 5, "items": ["..."] } }
```

`partial` is a deprecated alias of `truncated`: read `truncated` for missing listing pages and `details_pending > 0`
to decide whether to call again for venue and price.

### `river_levels` data quality

`river_levels` readings are automatic telemetry: nobody has checked them. ANA also publishes validated (consistidos)
series after deeper analysis ([ANA](https://www.gov.br/ana/pt-br/assuntos/noticias-e-eventos/noticias/agencia-disponibiliza-series-historicas-de-dados-de-niveis-e-vazoes-de-estacoes-em-todo-o-pais)); this tool reads only the raw telemetry. A station can stop sending, or send wrong values (a stuck sensor, a
spike, maintenance). Each station gets a `quality` computed only from the readings of the last 24 h that the tool has
already read (no extra request), and the raw values are never hidden or changed:

- `out_of_range`: a negative level, flow or rain, or more than 150 mm of rain in one 15-minute reading. A negative
  level can be a legitimate gauge zero in a dry spell; the flag errs on the side of caution.
- `level_spike`: the level jumps more than 100 cm between readings 15 minutes apart and comes back (within 50 cm of the
  level before) within the next hour. A jump that stays is not flagged, since it may be a real rise.
- `level_jump_unconfirmed`: the same jump in the last hour, not back yet (it has had no time to come back).
- `level_stuck`: the level is identical for 6 h or more (at least 20 readings) while 10 mm or more of rain fell at the
  station. A flat level on a dry day is normal and is not flagged.

Any of these makes the station `suspect`, and the note says to treat its values with caution. `ok` only means that no
check fired: the tool flags suspicious readings but cannot prove that a value is right. `ok` does not cover a jump
that stays (for example a flood wave rising 150 cm in 15 minutes, then receding slowly) or a spike whose return takes
over 1 h. `unknown` means no reading, or
fewer than 8 readings in the 24 h (level readings, for a station that reports a level). Level and flow are not compared with each other (flow is missing at some stations and
follows the level where present). `stale` (latest reading older than 2 h) is a separate flag.

**Not for emergencies: call Defesa Civil on 199.** Official flood alerts come from Defesa Civil and INMET (the
`weather_alerts` tool), not from this tool.

Details for each source (format, terms, robots.txt) are in [docs/sources.md](docs/sources.md).

## Compared with the Curitiba App

The Prefeitura's official app is [Curitiba App](https://apps.apple.com/br/app/curitiba-app/id1447887852) (Prefeitura
Municipal de Curitiba; App Store listing, version 4.5.2 of 2026-10-06). Its listing describes it as bringing together
the Prefeitura's apps and services, with "consultas, agendamentos, informações sobre transportes, saúde e educação, entre
outros". Rows marked * are features the owner noted in the app itself; the listing text does not name them (it
says "agendamentos" but not Saúde Já). The app itself was not tested here, so no row claims CuritibAI is better:
the listing's "entre outros" means a feature missing from it may still be in the app.
CuritibAI is a read-only assistant tool, not a replacement: anything that needs a login is out of scope by design.
Compared on 2026-11-21 with public sources (the App Store listing above), not with the app itself.

| Curitiba App feature | CuritibAI | Why |
|---|---|---|
| Consultas / services catalogue | ✓ | `city_services_search` searches the Carta de Serviços by words and category (from a copy you keep) |
| Transport information | ✓ | `next_buses_near` answers "next buses near me" in one call (published departures at the stops within a radius, soonest first); `bus_stops_near`, `bus_departures` and `bus_line_stops` give the stops, timetables and itineraries; all from the URBS files you download; no real-time positions |
| Health information | ✓ | Public health units (`health_units_search`), vaccination sites with hours and vaccines, by distance (`vaccination_sites_search`), and urgent-care points (`city_points_search`) |
| Education information | ✓ | Municipal and state schools and CMEIs from the URBS points export (`city_points_search`); no enrolment |
| Events * | ✓ | `events_search` over the Instituto Municipal de Turismo calendar (through the separate collector) |
| Useful phones * | partial | `useful_phones` returns the 60 entries of the Instituto Municipal de Turismo's "Telefones Úteis" page (emergencies such as SAMU, Defesa Civil and Guarda Municipal, services, transport, radio taxis; through the separate collector). The app's own list was not compared, and that page has no Ouvidoria entry, so this is not claimed to match it |
| 156 * (requests and their protocols) | — | Opening and following 156 requests needs a login; out of scope. `local_csv_summary` can summarise the 156 open-data file you download |
| Scheduling (agendamentos; Saúde Já *) | — | Needs a login; out of scope |
| Curitiba Lê * | — | Not covered (not checked what it offers); `city_points_search` and `places_search` list library locations only |
| Cartão Transporte * | — | Needs a login; out of scope |
| — | extra (not named in the listing) | Also in CuritibAI, not named in the listing (the app may still have them): INMET forecast and warnings, procurement (PNCP), Detran-PR licensing calendar, open-data catalogue search |
| — | extra (not named in the listing) | City facilities from IPPUC's GeoCuritiba (`city_facilities_search`): feiras with days and hours, Ruas da Cidadania, ecopontos, outdoor gyms, public toilets, parks and bike lanes, by neighbourhood or distance |
| — | extra (not named in the listing) | River level, flow and rain from ANA's telemetry stations around Curitiba (`river_levels`); not for emergencies (Defesa Civil 199) |

## Deferred

| Tool | Reason |
|---|---|
| `open_dataset_preview` | File hosts disallow automated access (robots.txt), and file rows hold individual records |
| `city156_categories`, `city156_stats` | Same reason. Download the 156 file by hand and use `local_csv_summary` (see below) |
| Bus lines, timetables and stops **fetched by the server** | The URBS website is out of scope (it refuses non-browser clients), its WebService needs a login, and the export mirror is treated as disallowed. The bus tools read files you download instead (see below); for a GTFS route, see "Alternatives" |
| Real-time bus positions and fares | Not in the daily exports the bus tools read |
| `schools_search`, `markets_fairs_list`, `culture_agenda` | Covered since v0.9 by `city_points_search` (feiras, schools) and since v0.10 by `events_search` (the Instituto Municipal de Turismo calendar, through the separate collector), plus since v0.17 `guaira_events` (the Teatro Guaíra calendar, live); the portal's own files for them are stale and only on hosts whose robots.txt disallows automated access |
| Private and non-profit health units | CNES names of private units can be people's names; `health_units_search` returns public-administration units only |
| `garbage_collection_by_street` | Only an undocumented form (`coletalixo.curitiba.pr.gov.br`), no published dataset or API; not used |
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

## Local data files

Nine tools read files you keep in the folder set by `CURITIBAI_DATA_DIR` ([Quick start](#quick-start) shows how to
set it). The server never downloads these files. This section says what each tool needs and how to get it.

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

- **Values of the grouped column are returned** (for example each `ASSUNTO` with its count). Groups with fewer than 5
  rows (3 before 0.13.2) are added to `other_count` instead of being listed, so that a filter on a unique column
  cannot reveal a single record.
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

### Finding a city service (Carta de Serviços)

`city_services_search` answers "how do I ... at the Prefeitura?" from a local copy of the city's service catalog.
The server never contacts `www.curitiba.pr.gov.br`. `city_services_search` reads only a copy that you save yourself, by hand, in an ordinary browser session, into `CURITIBAI_DATA_DIR/carta-servicos.json`. An earlier local copy (2026-11-19/20) was deleted and is not used.
No automated capture of that host is part of this project (see [docs/sources.md](docs/sources.md)). **This project does not ship or fetch the catalog**: its content belongs to the Prefeitura Municipal de Curitiba, and no
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

### Bus lines, stops, timetables and points of interest (URBS files you download)

`bus_lines_search`, `bus_line_stops`, `bus_departures`, `bus_stops_near`, `next_buses_near` and `city_points_search` read URBS's daily exports from the dataset "Transporte
Coletivo de Curitiba" (publisher URBS) of the Portal de Dados Abertos de Curitiba. **The server never downloads them**:
their mirror, `dadosabertos.c3sl.ufpr.br`, is treated as disallowed for automated access (see
[docs/sources.md](docs/sources.md)). A person downloads them in a browser:

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
category names is in [docs/sources.md](docs/sources.md)). Rows in any other category, which name private businesses
or people, are dropped when the file is read, so no `name`, `near` or count can reach them; `note` gives how many were
dropped and names any category id with no row at all in the file (its URBS names look missing or renamed).
`cultural_space`, `special_education` and `vocational_education` may include private or non-profit institutions. Ask, for
example: "feiras near -25.43, -49.27", "health units near -25.50, -49.29 within 3 km", or call it with no arguments for the counts.

URBS's `DIA` codes are not explained in the files. `bus_departures` returns the code as published and, next to it,
`day_type`: 1 `weekday`, 2 `saturday`, 3 `sunday_or_holiday`. That reading is **inferred from the data** (see
[docs/sources.md](docs/sources.md)), not stated by URBS. On holidays URBS announces which timetable applies.
Times are returned as published (00:00 to 23:59, each under its row's code) and `from`/`to` never wrap past
midnight. URBS files a late-night trip under the day its service starts, at the end of that day's table (checked on
the 2026-11-20 file, see [docs/sources.md](docs/sources.md)): a row before 04:00 that comes after its table has run
from 20:00 or later on to before 04:00 (any other drop in its times is not a wrap) has `after_midnight: true` and runs on the calendar day after a day of its code. Other rows
before 04:00 are read as early trips of their own code's day (not verified).

<a id="events-and-useful-phones"></a>

### Events (Instituto Municipal de Turismo calendar, collected by a separate script)

**How updating works (since 0.18.0): nobody has to run anything.** A GitHub Actions workflow,
[`.github/workflows/collect.yml`](.github/workflows/collect.yml), runs the collector `scripts/fetch-events.mjs` every
night at 02:37 UTC (23:37 in Curitiba) on a standard GitHub-hosted runner (`ubuntu-latest`; "The use of standard
GitHub-hosted runners is free" in public repositories, per
[GitHub's billing page](https://docs.github.com/en/billing/concepts/product-billing/github-actions); no larger runner
is used). It follows exactly the rules below (window, robots.txt check, 5 s gap, no retry) and then
`scripts/publish-data.sh` commits only `events/events.json`, `events/status.json`, `phones/phones.json` and `phones/status.json` to the
orphan branch [`data`](https://github.com/Bossmann007/curitibai/tree/data) of this repository (never `main`). It skips
the commit when none of them changed, which is rare: the `status.json` files record every attempt, so most nights add
one small commit. A run that fails (`window_closed`, `robots_changed`, `http_error`, ...) keeps the previous
files, updates only the `status.json` files, shows as failed in the Actions tab and is not retried until the next night.
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
  some queued jobs may be dropped" (same page). A run that starts after 05:50 UTC records `window_closed` and
  publishes only `events/status.json`; the tools keep answering from the last good copy.
- A manual run: `gh workflow run collect.yml` (or **Run workflow** in the Actions tab). Outside 02:00–05:50 UTC it
  makes no request to the site and only records `window_closed`.
- The detail cache (`events/details.json`) is not published, so every nightly run reads every detail page again:
  about 5 minutes for the 50 or so events seen on 2026-11-21. With 10 list pages of 10 events (a pager showing more
  stops the run) it is about 112 requests, each followed by the 5 s gap, plus the site's response time: about 10
  to 15 minutes, more when the site is slow. The collector stops itself at its 30-minute deadline (or 05:50 UTC),
  keeps the previous files and records the code in `status.json`, before the job's 35-minute timeout.
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
  02:00 and 06:00 and at most one request every 5 seconds. Outside the window the script makes no request and exits
  with `code=window_closed`. A scheduler (cron, launchd) can run it once a night inside the window.
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
  the code of what stopped it). It prints only fixed status lines with counts and the exit code, never page text. If the
  site really changes size (fewer or more than 0.3x–3x the previous count), every run keeps failing this way: check the
  site, then delete `events/events.json` to accept the new count on the next run.
- **A day with no events also stops with `code=layout_changed`** and keeps the previous `events.json`. The script has
  never seen the site's empty list page, so it cannot tell "no events today" from a page it no longer understands, and
  it fails closed. On such a night `events_search` keeps answering from the last good file (marked `stale` after 3
  days); open the list page in a browser to check which case it is.

**When robots.txt changes** (`code=robots_changed`): open <https://turismo.curitiba.pr.gov.br/robots.txt> in a browser
and read the `User-agent: *` group. If the new rules still allow the list and event pages, edit `RECORDED_ROBOTS` (one
`"key: value"` per directive, key in lower case, no comment) and `ROBOTS_RECORDED_ON` in `scripts/fetch-events.mjs`,
update the copy in [docs/sources.md](docs/sources.md) and the test robots in `test/fetchEvents.test.ts`, and run
`npm test` (or `scripts/verify`). If they no longer allow them, or move the visit window, do not run the collector until
the script follows them.

The parser was built from one list page and one detail page seen on 2026-11-21; multi-day date formats and an empty
day have not been seen yet (see [docs/sources.md](docs/sources.md)), so the first real runs may stop with
`layout_changed` until the script is updated. Ask, for example: "events in Curitiba this weekend" or "concerts next
week".

**Useful phones (same collector, since 0.14.0).** After the events pages, the same run reads one more page,
<https://turismo.curitiba.pr.gov.br/conteudo/telefones-uteis/92> (1 GET per run, same window, robots.txt check, 5 s
gap, deadline and User-Agent; robots.txt allows `/conteudo/`). It runs only after the events step ended `ok` or with
`layout_changed`; after any other stop (an error status such as 403, 429 or 5xx, a redirect, a timeout, a network
error, the window or the deadline) it makes no request, so the host is not asked again after a refusal, and
`phones/status.json` gets the same code. It never changes the events files. It writes `phones/phones.json` and `phones/status.json` in
`CURITIBAI_DATA_DIR` and prints one more fixed line, `fetch-events: phones_code=<code> phones=<n> phones_dropped=<n>`;
the exit code is 0 only when both steps are ok.

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

## Privacy and safety

### Privacy notice

- No user accounts; the server does not store or log queries. Search terms go only to the source they query, and
  the only copy is an in-memory cache entry (10 minutes; 6 hours for the vaccination page and the GeoCuritiba layers; 15 minutes per ANA station;
  1 hour for the Teatro Guaíra calendar, 6 hours for its event pages; 1 hour for the published events and phones copy).
  `events_search` and `useful_phones` never send search terms: they read a whole published file and filter it in the
  server.
  `guaira_events` sends no search term at all: it reads the whole calendar and filters it in the server.
  `city_facilities_search` never sends the user's position or neighbourhood: it reads a whole layer and filters it in
  the server. `river_levels` never sends the user's text or position: only bundled station codes and dates reach ANA.
- Names of natural persons are dropped or withheld where the source's structure allows (suppliers, direct-award
  objects, private health units) and contact-shaped text is masked; a name can still, rarely, pass through (below).
- Contact and removal requests: [GitHub issues of this repository](https://github.com/Bossmann007/curitibai/issues);
  for removal, use the [removal request form](https://github.com/Bossmann007/curitibai/issues/new?template=removal-request.yml).

### Collection rules

- Each host's robots.txt was checked before the host was added (recorded in [docs/sources.md](docs/sources.md)); a
  host or path it disallows is never fetched. The events collector (the only collector) reads robots.txt on every run,
  stops if it changed, starts requests only inside the site's `Visit-time` and makes at most 1 request per 5 s
  (`Request-rate: 1/5`). The server makes one request per tool call and page, cached in memory (above).
  `guaira_events` reads the Teatro Guaíra robots.txt itself (cached 24 h), stops if the calendar becomes disallowed
  and reads no event page if `/Evento/` does; a cold call makes up to 5 requests, at least 5 s apart (no event page
  starts after about 20 s; the listing load is never cut).
- A 403, a CAPTCHA, a login or any other block is never bypassed. In code: `src/http.ts` treats HTTP 401, 403 and a
  429 whose HTML page is a CAPTCHA as a final refusal (`guaira_events` also treats a 200 page that does not parse and
  looks like a CAPTCHA or challenge that way) (`source_unavailable` with the message "the source refused
  this server; it is not asked again for 10 minutes (per host)"; no retry, no other headers, no browser
  fallback; the host is then not asked again for 10 minutes in that process, and a paged tool returns what it found
  with `next_page: null`). The block is per host, not per path: a 403 on one portal path pauses every tool that uses
  that host. The events collector stops the run on any non-200 answer, 403 included. Another 429 is
  returned as `rate_limited` with the source's wait. PNCP alone retries once: after a connection error, or after a
  429 whose `Retry-After` is 5 s or less; never after a 401, 403 or CAPTCHA.
- Requests identify the project and its contact: User-Agent `curitibai-mcp/<version> (+https://github.com/Bossmann007/curitibai)`.
- Removal requests: open an issue in this repository with the
  [removal request form](https://github.com/Bossmann007/curitibai/issues/new?template=removal-request.yml); the content
  is removed from the next release.

### Details

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
- `procurement_search` never returns the supplier: its output is built field by field, and the PNCP endpoint it uses
  has no supplier field. The object text can name people, and a name cannot be told apart from other text by a rule,
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
  and the capture date in `license_note`. The server contacts neither `www.curitiba.pr.gov.br` nor the service
  pages' host (`servicos.curitiba.pr.gov.br`, robots.txt `Disallow: /`). An earlier local copy (2026-11-19/20) was
  deleted and is not used (details in [docs/sources.md](docs/sources.md)). A copy of the listing may miss a few
  services, and its summaries are the site's short teasers, some of them empty (those services are found by title only).
- OpenStreetMap: data © OpenStreetMap contributors, under the [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
  (see <https://www.openstreetmap.org/copyright>). Every result carries that attribution in `attribution` and `license_note`, with the time of the OSM copy
  (`osm_data_as_of`, from Overpass `osm3s.timestamp_osm_base`). OSM is edited by volunteers: places can be missing,
  misplaced or outdated. The Overpass instance is a free service run privately
  by dresel.systems, with no availability guarantee and a limit of 4 parallel queries per IP; each server process sends
  one query at a time (a call that waited over 20 s in line gives up; after an HTTP 429 no request is sent until the
  wait is over, at most 1 hour) and returns `source_unavailable` when the instance is down. Its data is refreshed nightly, so
  `osm_data_as_of` is up to about a day old. Do not rely on this tool where an outage would cause harm; it is not for emergencies (call 190 or 193). The
  bundled police and fire station list (`src/sources/osmBundled.ts`, © OpenStreetMap contributors, ODbL 1.0; the
  Apache-2.0 licence does not cover it) was taken on 2026-11-21 and is not refreshed; after 180 days `note` says it
  may be outdated, and a code update is needed to refresh it. Results
  are cached in memory for 10 minutes; a call reads a whole category once and filters it.
- URBS: Licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/deed.pt_BR), as linked from the dataset's portal page. The bus tools and `city_points_search` return the
  values of your local files as published (coordinates converted from comma decimals; stop names masked as above)
  and attribute them to URBS and the portal dataset, with the file name, in `license_note`. Timetables are as
  published, not real-time, and the files can be days or weeks old.
- IPPUC / GeoCuritiba: no licence or terms of use was found for the GeoCuritiba services (checked 2026-11-21; robots.txt
  is 404). `city_facilities_search` returns only facts (names, addresses, days and hours, institutional contacts,
  positions) with `source` "IPPUC / GeoCuritiba", the layer URL and `license_note` "No licence found; facts only; IPPUC
  cited." Contact fields are filtered to institutional values (see [docs/sources.md](docs/sources.md)). The layers'
  update dates vary (`updated`); a facility can have moved or changed hours.
- ANA telemetry: no licence or terms of use was found for the `telemetriaws1.ana.gov.br` web service (checked
  2026-11-22; robots.txt is 404). `river_levels` returns only facts (station, time, level, flow, rain) with `source`
  naming ANA and IAT-PR, the service URL and `license_note` "No licence found; facts only; ANA cited." Readings are
  automatic and unvalidated; the tool is not for emergencies (Defesa Civil 199).
- Teatro Guaíra: no licence or terms of use was found for the calendar (checked 2026-11-22; robots.txt allows
  `/calendario-eventos` and `/Evento/`). `guaira_events` returns only facts and links (title, dates, city, venue, age
  rating, price, event page) with `source` "Centro Cultural Teatro Guaíra / Governo do Paraná" and `license_note` "No
  licence found; facts and links only; Teatro Guaíra / Governo do Paraná cited." The calendar is a web page, not an
  API: a layout change returns `layout_changed`, and dates, venues and prices can change after they are read.
- Detran-PR: no terms of use or licence was found on `detran.pr.gov.br` or `legislacao.pr.gov.br`, so
  `detran_pr_info` carries only public facts (dates, a fee, addresses and phone numbers of public offices), each with
  its source URL and check date. The data is a snapshot taken by hand on 2026-11-19 and is not refreshed: the
  calendar covers 2026 only, and units or hours can change without this server knowing. A new year's calendar needs a
  code update (see [docs/sources.md](docs/sources.md)).

## Development

```sh
scripts/verify   # no tracked carta-servicos.json, URBS export, events output or HTML capture, npm ci, tsc --noEmit, eslint, vitest, build, stdio smoke test; npm audit reported separately
```

`scripts/verify` is the required local check. The CI workflow `.github/workflows/verify.yml` is set to run it on every
pull request and on pushes to `main`: one Ubuntu job, Node from `.nvmrc`, actions pinned by commit SHA, read-only token, no secrets, 10-minute timeout. It sets
`CURITIBAI_SKIP_AUDIT=1`, so the separate `npm audit` step is skipped there: it never changes the result, and new
advisories would only add noise to unrelated CI runs (Dependabot, `.github/dependabot.yml`, opens weekly npm and
GitHub Actions update PRs instead).

Tests run offline: every network call is stubbed, and an unstubbed call fails the test. Portal parser tests use
trimmed real responses in `test/fixtures/`. CNES tests use **synthetic** fixtures (`test/fixtures/cnes_*_synthetic.json`:
the real JSON shape with invented values), PNCP tests use a synthetic fixture with planted supplier keys, CPF, e-mail,
phone and names (`test/fixtures/pncp_contratacoes_synthetic.json`), INMET tests use synthetic fixtures with the real
shape (`test/fixtures/inmet_*_synthetic.json`: invented texts, polygons and icons, a near-miss geocode, a warning listed
twice), OSM tests use trimmed real Overpass responses recorded on 2026-11-21 (`test/fixtures/osm_*_recorded.json`: the
libraries answer; OpenStreetMap data, © OpenStreetMap contributors, ODbL 1.0) and synthetic responses
for edge cases (`test/fixtures/osm_*_synthetic.json`, with planted e-mail, phone, credential and `javascript:` links),
and CSV tests use synthetic files.
`city_services_search` tests and the smoke test use a small synthetic catalog
(`test/fixtures/carta_servicos_synthetic/carta-servicos.json`: invented services in the real file shape, with an
e-mail to mask, an empty summary, obituary, `javascript:` and credential links); no real catalog text is in the
repository. `.gitignore` ignores `carta-servicos.json` in any folder, and `scripts/check-no-catalog` (the first verify
step) fails if git tracks one anyway (e.g. after `git add -f`); only that synthetic fixture is exempt, and the guard
also fails if that fixture is modified in the work tree. The same guard fails if git tracks a URBS daily export
(`YYYY_MM_DD_*.json` or `.json.xz`, any folder, any case), with no exemption; `.gitignore` ignores those names too. The
bus tests and the smoke test use small synthetic files in the URBS shape (`test/fixtures/urbs_synthetic/`: invented
lines, stops and times, with a planted e-mail, phone and street-number range, an empty coordinate and an unknown day
code); they have no date in their names and are copied to a temporary folder under dated names when used. The guard
also fails if git tracks anything in a folder named `events` (the collector's output) or an `.html`, `.htm`, `.mhtml` or
`.har` file outside `test/fixtures/`, and `.gitignore` ignores them. The events tests use synthetic pages
(`test/fixtures/events_synthetic/`: invented events in the site's markup, with a planted description, contacts, ticket
and external link that must not be kept) and run the collector with a fake clock and a fake network. The guard
must run at the top of a checkout (exit 2 elsewhere).

## Contributing, security and removal requests

- [CONTRIBUTING.md](CONTRIBUTING.md): how to run `scripts/verify`, the collection rules a change must keep, and the
  pull request flow.
- [SECURITY.md](SECURITY.md): report a vulnerability privately through
  [GitHub security advisories](https://github.com/Bossmann007/curitibai/security/advisories/new), never in a public
  issue.
- Issue forms: [something does not work](https://github.com/Bossmann007/curitibai/issues/new?template=bug.yml),
  [suggest a data source](https://github.com/Bossmann007/curitibai/issues/new?template=data-source.yml) and
  [ask for content removal](https://github.com/Bossmann007/curitibai/issues/new?template=removal-request.yml).

## Licences (code and data)

- **Code**: [Apache-2.0](LICENSE). It covers the code only; the data belongs to its publishers under their own terms.
- **URBS data** (bus and points-of-interest tools): by URBS — Urbanização de Curitiba S.A., dataset
  ["Transporte Coletivo de Curitiba"](https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=ca40f13b-ef61-472b-810f-dd705f85fd2e)
  on the [Portal de Dados Abertos de Curitiba](https://dadosabertos.curitiba.pr.gov.br/),
  licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt_BR). Changes made: coordinates converted
  to decimal numbers, contact-shaped text masked, long fields cut, only allowlisted categories and fields returned.
  The same applies to other portal datasets (`open_datasets_search`, `dataset_files`), with the portal's notice: "O
  Portal de Dados Abertos de Curitiba e o órgão ou entidade de onde foram acessados os dados não garantem sua
  autenticidade, qualidade, integridade e atualidade após terem sido disponibilizados para uso secundário." The URBS
  files are not part of this repository.
- **OpenStreetMap extract**: `src/sources/osmBundled.ts` (and its compiled copy in `dist/`) is a separate database,
  © OpenStreetMap contributors, under the [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) (see
  <https://www.openstreetmap.org/copyright>), not under Apache-2.0. Live `places_search` results are OSM data under
  the same licence and carry "© OpenStreetMap contributors (ODbL 1.0)" with that link.
- **Terms inherited by anyone reusing the server's output**: PNCP and INMET data are treated under CC BY-ND 3.0 (the
  gov.br notice: attribution, no derivatives); CNES data under the strictest of the Ministry's notices (CC BY-ND 3.0,
  CC BY-NC-SA 4.0, MIT: attribution, non-commercial, no derivatives). Each tool's `license_note` says which applies.
  The Carta de Serviços catalog (no licence found) is not part of this repository. The events calendar and the
  "Telefones Úteis" page of the Instituto Municipal de Turismo (no licence published) are not on `main`; since 0.18.0
  the nightly workflow publishes facts and links only from them (event titles, dates, times, places, categories and
  links; phone names, sections and numbers) on the separate public branch `data`, with the Instituto cited in each
  tool's `attribution` (owner approval, 2026-11-22).
- **IPPUC / GeoCuritiba data** (`city_facilities_search`): no licence found (checked 2026-11-21); facts only, with
  IPPUC cited as "IPPUC / GeoCuritiba" and the layer URL in every result.
- **ANA telemetry data** (`river_levels`): no licence found (checked 2026-11-22); facts only, with ANA cited and the
  service URL in every result.
- **Teatro Guaíra calendar** (`guaira_events`): no licence found (checked 2026-11-22); facts and links only, with
  "Centro Cultural Teatro Guaíra / Governo do Paraná" cited and the calendar URL in every result.
- **Test fixtures with real third-party content**:

| File | Source | Licence |
|---|---|---|
| `test/fixtures/portal_busca_saude.html`, `portal_busca_vazia.html`, `portal_detalhe_unidades.html`, `portal_detalhe_transporte.html` | Trimmed pages of the [Portal de Dados Abertos de Curitiba](https://dadosabertos.curitiba.pr.gov.br/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with the portal's notice above |
| `test/fixtures/portal_arquivos_unidades.json` | 3 rows of a dataset's file list on the [same portal](https://dadosabertos.curitiba.pr.gov.br/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with the portal's notice above |
| `test/fixtures/geocuritiba/feira.json`, `rua_da_cidadania.json`, `parques.json`, `ciclovia.json` | A few records of IPPUC's [GeoCuritiba](https://geocuritiba.ippuc.org.br/server/rest/services) layers (Feira, Rua da Cidadania, Parques e Bosques, Estrutura Cicloviária), recorded 2026-11-21, trimmed to institutional fields | No licence found; facts only, IPPUC cited |
| `test/fixtures/ana/65010000_fazendinha.xml`, `65019980_ete_araucaria.xml`, `02549127_no_data.xml` | Answers of ANA's [telemetry web service](https://telemetriaws1.ana.gov.br/ServiceANA.asmx) (`DadosHidrometeorologicos`, 21–22 Nov 2026), recorded 2026-11-22; the two data samples without the XML schema block (only station code, time, flow, level and rain; no personal data) | No licence found; facts only, ANA cited |
| `test/fixtures/guaira/list_page0.html`, `list_page1.html`, `list_page2.html`, `event_muito_barulho.html`, `event_concerto_osp.html`, `robots.txt` | Pages of the [Teatro Guaíra calendar](https://www.teatroguaira.pr.gov.br/calendario-eventos), recorded 2026-11-22, trimmed to the cards and the body-field lines read (images, cast and programme left out), and its robots.txt | No licence found; facts and links only, Teatro Guaíra / Governo do Paraná cited |
| `test/fixtures/osm_library_recorded.json` | Overpass answer from [OpenStreetMap](https://www.openstreetmap.org/), recorded 2026-11-21 | © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |

  Every other fixture is synthetic (invented values).
