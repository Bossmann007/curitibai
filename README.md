<!-- ENZO-PORTFOLIO-BRAND -->
<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:111111,100:7751FF&height=165&section=header&text=CuritibAI&fontSize=42&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=Read-only%20MCP%20server%20for%20public%20data%20about%20Curitiba%2C%20Brazil&descAlignY=57&descSize=14" alt="CuritibAI: read-only MCP server for public data about Curitiba, Brazil" />
</p>

<p align="center"><strong>TypeScript · MCP · Dados abertos de Curitiba</strong></p>

<div align="center">

[![License](https://img.shields.io/badge/License-Apache--2.0%20%2B%20ODbL%20%28OSM%20extract%29-blue?style=for-the-badge)](docs/licences.md)
[![Node](https://img.shields.io/badge/Node-%3E%3D26.13.1-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](.nvmrc)
[![MCP](https://img.shields.io/badge/MCP-stdio-7751FF?style=for-the-badge&logo=modelcontextprotocol&logoColor=white)](https://modelcontextprotocol.io)
[![verify](https://img.shields.io/github/actions/workflow/status/Bossmann007/curitibai/verify.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=verify)](https://github.com/Bossmann007/curitibai/actions/workflows/verify.yml)
[![Não oficial](https://img.shields.io/badge/N%C3%A3o%20oficial-no%20link%20with%20the%20Prefeitura-lightgrey?style=for-the-badge)](#curitibai)

</div>

---

# CuritibAI

CuritibAI is a read-only [MCP](https://modelcontextprotocol.io) server. It gives AI assistants 27 tools over public
data about Curitiba (Brazil): buses, public health units, vaccination sites, city services, city facilities, voting places, police and fire areas, census figures, places, events, weather, river levels and rain, Teatro Guaíra events,
municipal holidays, municipal procurement, Detran-PR, the city's open-data portal, and step-by-step guides with official links to city services that need a login (the citizen acts, with consent at every step). The server writes no files, needs no account and does not store or log queries.

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
- [How data stays updated](#how-data-stays-updated)
- [Privacy notice](#privacy-notice)
- [Documentation](#documentation)
- [Contributing, security and removal requests](#contributing-security-and-removal-requests)
- [Licences](#licences)

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

### Install from npm (after the first release)

Not on npm yet: this works once `curitibai-mcp` 0.26.1 or later is published ([release steps](docs/development.md#release)).
Then no clone or build is needed; `npx` downloads the package and runs its `curitibai-mcp` command (Node.js 26.13.1
or newer, as above):

```sh
npx -y curitibai-mcp   # speaks MCP over stdio
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "curitibai": {
      "command": "npx",
      "args": ["-y", "curitibai-mcp"]
    }
  }
}
```

Claude Code: `claude mcp add curitibai -- npx -y curitibai-mcp`

The server will also be listed in the [MCP Registry](https://registry.modelcontextprotocol.io/) as
`io.github.Bossmann007/curitibai` (`server.json`).

To use `local_csv_summary`, `city_services_search`, `city_points_search`, `events_search`, `useful_phones` or the bus tools, add `"env": {"CURITIBAI_DATA_DIR": "/absolute/path/to/a/folder"}` next to `args`
(Claude Code: `claude mcp add curitibai -e CURITIBAI_DATA_DIR=/absolute/path/to/a/folder -- node ...`). Without it,
`local_csv_summary` returns `{"error":"data_dir_not_set"}`, `city_services_search` returns
`{"error":"data_not_available"}` (the bus tools and `city_points_search` too, except `bus_stops_near`, which then
lists the nearby stops without their lines from IPPUC's GeoCuritiba layer), and the other tools work as usual.
`events_search` and `useful_phones` work without it: they then read the copy the nightly collection publishes
([Events and useful phones](#events-and-useful-phones)). [Local data files](docs/local-data.md) says what to put in that folder.

**Turn remote reading off** with `CURITIBAI_REMOTE_DATA=0` (or `off`, `false`, `no`; `1`, `on`, `true`, `yes` or unset
leave it on; any other value stops the server at start with a configuration error) in the server's environment: `events_search` and
`useful_phones` then read only the local file, as before 0.18.0, and `bus_stops_near` only the URBS export, as before
0.29.0 (`data_not_available` without it); these three then make no network call. The live tools still ask their sources.
An empty `CURITIBAI_REMOTE_DATA` (some MCP clients pass empty variables by default) also stops the server, with the configuration error on stderr: unset it, or set it to `0` or `1`.

<a id="tools"></a>

## Tools at a glance

All 27 tools are read-only. "Live" tools ask the source on each call (cached in memory for 10 minutes; 6 hours for
the vaccination page and the GeoCuritiba layers; 15 minutes per ANA station; 1 hour for the Teatro Guaíra calendar; 24 hours for the Receita tax-reform data). "Local" tools read a file you keep in `CURITIBAI_DATA_DIR` and "Bundled" tools read data bundled in the code; both
make no network call. "Nightly" tools read your local file when there is one, else the copy this project's
nightly GitHub workflow publishes (cached 1 hour; `CURITIBAI_REMOTE_DATA=0` turns it off). [Tool reference](docs/tools.md) has every input, output and error.

| Area | Tool | What it answers | Data |
|---|---|---|---|
| Transport | `bus_lines_search` | Find URBS bus lines by name, code or category | Local (URBS file) |
| Transport | `bus_line_stops` | The stops of one line, per direction, in itinerary order | Local (URBS file) |
| Transport | `bus_departures` | Published departure times for a line, a stop or both | Local (URBS file) |
| Transport | `bus_stops_near` | Stops near a point and the lines that serve each one | Local (URBS files); without them, stops only from GeoCuritiba (live) |
| Transport | `next_buses_near` | The next published departures at the stops near a point | Local (URBS files) |
| Transport | `bus_route_between` | Direct bus lines (no transfers) from stops near one point to stops near another | Local (URBS files) |
| Health | `health_units_search` | Public-administration health units in Curitiba (CNES); no hours (municipal UBS, UPA and public hospital hours: `city_facilities_search`) | Live (Ministry of Health) |
| Health | `vaccination_sites_search` | Public vaccination sites with hours and vaccines, by distance | Live (Imuniza Já page) |
| City | `city_services_search` | Prefeitura services from the Carta de Serviços | Local (your copy) |
| City | `city_service_guide` | Steps and official links to use 156, Saúde Já, IPTU, Cartão Transporte, Agenda Online, creche, Detran-PR, Curitiba Lê Digital, EstaR parking, Defesa Civil alerts on the phone, the Vale-Creche law or the Ouvidoria's channels (no phone is published), or a guide generated from your Carta copy for any other Carta service; the citizen acts, with consent at every step | Bundled, plus links and text from your Carta copy |
| City | `city_facilities_search` | Feiras, Ruas da Cidadania, ecopontos, libraries, cultural centres, cinemas, memorials, outdoor gyms and sport centres, public toilets, parks and conservation units, bike lanes, bus terminals (with their integrated lines), municipal health units (since v0.44), UPAs and public hospitals (since v0.45), CAPS and specialty centres (since v0.46), Vigilância Sanitária offices, the zoonoses centre and the Hospital Veterinário Municipal (since v0.47), Guarda Municipal modules and regional núcleos (since v0.48), Polícia Civil delegacias and the Polícia Federal, Polícia Rodoviária Federal and Polícia Científica offices (since v0.49), Instituto de Identificação posts for the RG, with the appointment line as published (since v0.50), cartórios de registro civil, Juntas Militares, Defensoria Pública posts and fóruns (since v0.51), CREAS, Centros POP, the Central de Encaminhamento Social, centres for older people, women's and Afro reference centres (since v0.52; no shelters), municipal schools, CMEIs, CMAEEs and contracted CEIs (since v0.53), the Rodoferroviária (bus and rail terminals) and the Administrações Regionais (since v0.58), COHAB agencies (since v0.59), Mesas Solidárias, community gardens, Fazendas Urbanas and the food-security núcleos (since v0.60), SINE units, the Agência do Trabalhador, Liceus de Ofícios and INSS agencies (since v0.64), voting places (TRE-PR list) and more, with days and hours as published; tourist attractions (the Linha Turismo's stops) | Live (IPPUC GeoCuritiba); attractions bundled |
| City | `place_at_point` | One answer for a point (`include` picks the parts): neighbourhood, regional, zoning, nearest street and IPTU Planta Genérica de Valores micro-region; health unit and CRAS areas, or (`areas: safety`) Polícia Militar company, Polícia Civil district and fire platoon areas, or (`areas: registry`) circunscrição imobiliária and registro civil serviço; IBGE 2022 census figures of its sector (withheld under 20 households) and neighbourhood | Live (IPPUC GeoCuritiba) |
| City | `city_calendar` | The Prefeitura's 2026 holidays, optional days and closures (Decreto 2.385/2025), the 2026 calendars of the municipal escolas, CMEIs and CMAEEs (is there class on a date), and the IPTU 2026 general rule (secondary source) | Bundled (dated 2026) |
| City | `city_points_search` | Points open to the public: feiras, schools, libraries, health units and more | Local (URBS file) |
| City | `places_search` | Parks, libraries, schools and other public places mapped in OpenStreetMap | Live (Overpass); police and fire stations Bundled |
| City | `events_search` | Events from the Instituto Municipal de Turismo calendar | Nightly (GitHub `data` branch), or your local file |
| City | `guaira_events` | What is on at the Teatro Guaíra (dates, city, venue, age rating, price, event page) | Live (Teatro Guaíra calendar) |
| City | `useful_phones` | Useful public phone numbers (emergencies, city services, transport, radio taxis) | Nightly (GitHub `data` branch), or your local file |
| Weather | `weather_forecast` | INMET's forecast for Curitiba, up to 5 days | Live (INMET) |
| Weather | `weather_alerts` | INMET's active warnings that cover Curitiba | Live (INMET) |
| Weather | `river_levels` | Latest river level, flow and rain (last reading, 1 h, 24 h) at ANA telemetry stations around Curitiba, with a `quality` flag for suspect readings (see [Data quality](docs/tools.md#river_levels-data-quality)); not for emergencies (Defesa Civil 199) | Live (ANA telemetry) |
| Procurement | `procurement_search` | Procurement published by Curitiba municipal bodies in PNCP, never the supplier | Live (PNCP) |
| Taxes | `tax_reform_curitiba` | Tax reform (CBS/IBS) reference rates in Curitiba on a date (from 2027 flagged as Receita-simulated), NBS/NCM/cClassTrib codes, and a note on NFS-e in Curitiba; not tax advice | Live (Receita Federal pilot API); NFS-e note Bundled |
| Detran | `detran_pr_info` | Detran-PR's 2026 licensing calendar and its units in and around Curitiba | Bundled (snapshot) |
| Open data | `open_datasets_search` | Search the Portal de Dados Abertos de Curitiba catalogue | Live (portal) |
| Open data | `dataset_files` | List one dataset's files as links (never downloads them) | Live (portal) |
| Open data | `local_csv_summary` | Column names and grouped counts of a CSV you downloaded | Local (your file) |

## How data stays updated

- **Live tools** ask the source on each call and keep the answer in memory only (10 minutes; 6 hours for the
  vaccination page and the GeoCuritiba layers; 15 minutes per ANA station; 1 hour for the Teatro Guaíra calendar; 24 hours for the Receita tax-reform data). When
  a source fails, times out or changes format, the tool returns `{"error":"source_unavailable"}` and no data; some tools return what they
  already read with `partial: true`, or `rate_limited` ([Tool reference](docs/tools.md#tool-reference)).
- **Nightly tools** (`events_search`, `useful_phones`) read a copy that a GitHub Actions workflow collects every night
  and publishes on this repository's `data` branch (details below).
- **Local tools** read files you download yourself into `CURITIBAI_DATA_DIR`: the URBS daily exports (bus tools and
  `city_points_search`), a copy of the Carta de Serviços (`city_services_search`) and any CSV (`local_csv_summary`).
  The server never downloads these files. [Local data files](docs/local-data.md) has the steps.
- **Bundled tools** (`detran_pr_info`, `city_calendar`, and the police and fire stations of `places_search`) use data taken once by
  hand and shipped in the code; a code update refreshes it.

### Events and useful phones

**How updating works (since 0.18.0): nobody has to run anything.** A GitHub Actions workflow,
[`.github/workflows/collect.yml`](.github/workflows/collect.yml), runs the collector `scripts/fetch-events.mjs` every
night at 02:37 UTC (23:37 in Curitiba), retried at four later times inside the site's window until one run succeeds. `events_search` and `useful_phones` read the local file in
`CURITIBAI_DATA_DIR` when it exists, otherwise the published copy (cached 1 hour). Both tools return the file's
`checked_at`; after 3 days they say `stale: true`, with a note that the nightly collection may have stopped. The
schedule, the published files, how to turn it back on and how to run the collector yourself are in
[Local data files](docs/local-data.md#events-and-useful-phones).

## Privacy notice

- No user accounts; the server does not store or log queries. Search terms go only to the source they query, and
  the only copy is an in-memory cache entry (10 minutes; 6 hours for the vaccination page, the GeoCuritiba layers and the rounded points of `place_at_point`; 15 minutes per ANA station;
  1 hour for the Teatro Guaíra calendar, 6 hours for its event pages; 1 hour for the published events and phones copy).
  `events_search` and `useful_phones` never send search terms: they read a whole published file and filter it in the
  server.
  `guaira_events` sends no search term at all: it reads the whole calendar and filters it in the server.
  `city_facilities_search` never sends the user's position or neighbourhood: it reads a whole layer and filters it in
  the server. `place_at_point` sends IPPUC only the point rounded to 4 decimals (about 11 m); that rounded point is the
  only one cached and returned, and it is never logged or written. `river_levels` never sends the user's text or position: only bundled station codes and dates reach ANA.
- Names of natural persons are dropped or withheld where the source's structure allows (suppliers, direct-award
  objects, private health units) and contact-shaped text is masked; a name can still, rarely, pass through ([details](docs/privacy.md#details)).
- Contact and removal requests: [GitHub issues of this repository](https://github.com/Bossmann007/curitibai/issues);
  for removal, use the [removal request form](https://github.com/Bossmann007/curitibai/issues/new?template=removal-request.yml).

<!-- Sections that moved to docs/ keep their old ids here, so saved links land on this list. -->
<a id="tool-reference"></a><a id="compared-with-the-curitiba-app"></a><a id="deferred"></a><a id="limits"></a>
<a id="local-data-files"></a><a id="privacy-and-safety"></a><a id="collection-rules"></a><a id="development"></a>

## Documentation

- [docs/tools.md](docs/tools.md): every tool's inputs, outputs and errors, the
  [`river_levels` data quality](docs/tools.md#river_levels-data-quality) checks, the comparison with the Curitiba App,
  deferred tools and the limits of each source.
- [docs/local-data.md](docs/local-data.md): the files to put in `CURITIBAI_DATA_DIR` (CSV summaries, Carta de
  Serviços, URBS exports) and the nightly events and phones collection.
- [docs/privacy.md](docs/privacy.md): collection rules, the hosts the server contacts and how each tool handles
  personal data.
- [docs/sources.md](docs/sources.md): each source's format, terms and robots.txt.
- [docs/development.md](docs/development.md): `scripts/verify`, CI and the test fixtures.
- [docs/licences.md](docs/licences.md): licences of the code, the data and the test fixtures.
- [docs/roadmap-1.0.md](docs/roadmap-1.0.md): the 1.0 gate (every Curitiba App row and Carta service covered) and
  the coverage scoreboard.
- [CHANGELOG.md](CHANGELOG.md): what changed in each version.

## Contributing, security and removal requests

- [CONTRIBUTING.md](CONTRIBUTING.md): how to run `scripts/verify`, the collection rules a change must keep, and the
  pull request flow.
- [docs/adr/](docs/adr/README.md): architecture decision records (why the project works the way it does).
- [SECURITY.md](SECURITY.md): report a vulnerability privately through
  [GitHub security advisories](https://github.com/Bossmann007/curitibai/security/advisories/new), never in a public
  issue.
- Issue forms: [something does not work](https://github.com/Bossmann007/curitibai/issues/new?template=bug.yml),
  [suggest a data source](https://github.com/Bossmann007/curitibai/issues/new?template=data-source.yml) and
  [ask for content removal](https://github.com/Bossmann007/curitibai/issues/new?template=removal-request.yml).

<a id="licences-code-and-data"></a>

## Licences

The code is under [Apache-2.0](LICENSE); it covers the code only. The bundled OpenStreetMap extract
(`src/sources/osmBundled.ts`) is under the ODbL 1.0, and the data belongs to its publishers under their own terms.
[docs/licences.md](docs/licences.md) has the details for each source and test fixture.
