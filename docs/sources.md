# Sources

## Contents

- [robots.txt findings](#robotstxt-findings)
- [Implemented](#implemented)
  - [`open_datasets_search`: Portal de Dados Abertos de Curitiba catalogue search](#open_datasets_search-portal-de-dados-abertos-de-curitiba-catalogue-search)
  - [`dataset_files`: a dataset's file links](#dataset_files-a-datasets-file-links)
  - [`health_units_search`: Ministry of Health CNES open API](#health_units_search-ministry-of-health-cnes-open-api)
  - [`procurement_search`: PNCP Consulta API (contratações of Curitiba municipal bodies)](#procurement_search-pncp-consulta-api-contratações-of-curitiba-municipal-bodies)
  - [`weather_forecast` and `weather_alerts`: INMET forecast and warnings API](#weather_forecast-and-weather_alerts-inmet-forecast-and-warnings-api)
  - [`tax_reform_curitiba`: Receita Federal pilot tax-reform (CBS/IBS) open data](#tax_reform_curitiba-receita-federal-pilot-tax-reform-cbsibs-open-data)
  - [`places_search`: OpenStreetMap via the Overpass API](#places_search-openstreetmap-via-the-overpass-api)
  - [`detran_pr_info`: Detran-PR licensing calendar and units (bundled data)](#detran_pr_info-detran-pr-licensing-calendar-and-units-bundled-data)
  - [`city_services_search`: Prefeitura de Curitiba service catalog (local file, not shipped)](#city_services_search-prefeitura-de-curitiba-service-catalog-local-file-not-shipped)
  - [`bus_lines_search`, `bus_line_stops`, `bus_departures`, `bus_stops_near`, `next_buses_near`: URBS daily exports (local files, not shipped)](#bus_lines_search-bus_line_stops-bus_departures-bus_stops_near-next_buses_near-urbs-daily-exports-local-files-not-shipped)
  - [`city_points_search`: URBS points-of-interest export (local file, not shipped)](#city_points_search-urbs-points-of-interest-export-local-file-not-shipped)
  - [`events_search`: Instituto Municipal de Turismo events calendar (local file written by a separate collector)](#events_search-instituto-municipal-de-turismo-events-calendar-local-file-written-by-a-separate-collector)
  - [`useful_phones`: Instituto Municipal de Turismo "Telefones Úteis" page (local file written by the same collector)](#useful_phones-instituto-municipal-de-turismo-telefones-úteis-page-local-file-written-by-the-same-collector)
  - [Published nightly copy of the events and phones files (since 0.18.0)](#published-nightly-copy-of-the-events-and-phones-files-since-0180)
  - [Credit to the Instituto Municipal de Turismo in the published files (since 0.21.2)](#credit-to-the-instituto-municipal-de-turismo-in-the-published-files-since-0212)
  - [Monthly check of the Receita Federal calculator version (since 0.21.1)](#monthly-check-of-the-receita-federal-calculator-version-since-0211)
  - [`vaccination_sites_search`: Prefeitura "Imuniza Já" vaccination sites page](#vaccination_sites_search-prefeitura-imuniza-já-vaccination-sites-page)
  - [`city_facilities_search`: IPPUC GeoCuritiba urban equipment, parks and bike lanes](#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes)
  - [`place_at_point`: IPPUC GeoCuritiba cadastral map (since 0.22.0)](#place_at_point-ippuc-geocuritiba-cadastral-map-since-0220)
  - [`service_areas_at_point`: IPPUC GeoCuritiba thematic map, health unit areas and CRAS territories (since 0.23.0)](#service_areas_at_point-ippuc-geocuritiba-thematic-map-health-unit-areas-and-cras-territories-since-0230)
  - [`census_at_point`: IBGE 2022 census by sector, via IPPUC GeoCuritiba (since 0.27.0)](#census_at_point-ibge-2022-census-by-sector-via-ippuc-geocuritiba-since-0270)
  - [`city_calendar`: Decreto 2.385/2025 and IPTU 2026 notes (bundled, since 0.27.0)](#city_calendar-decreto-23852025-and-iptu-2026-notes-bundled-since-0270)
  - [`city_calendar`: school calendars 2026 (bundled, since 0.34.0)](#city_calendar-school-calendars-2026-bundled-since-0340)
  - [`city_service_guide`: guides and official links for services that need a login (bundled, since 0.28.0)](#city_service_guide-guides-and-official-links-for-services-that-need-a-login-bundled-since-0280)
  - [URBS transport layers on GeoCuritiba (evaluated 2026-11-24, not used by the bus tools)](#urbs-transport-layers-on-geocuritiba-evaluated-2026-11-24-not-used-by-the-bus-tools)
  - [`river_levels`: ANA telemetry (stations operated by IAT-PR)](#river_levels-ana-telemetry-stations-operated-by-iat-pr)
  - [`guaira_events`: Centro Cultural Teatro Guaíra calendar (live)](#guaira_events-centro-cultural-teatro-guaíra-calendar-live)
  - [`local_csv_summary`: a file the user downloaded](#local_csv_summary-a-file-the-user-downloaded)
- [Deferred](#deferred)
  - [Sources evaluated, not used (2026-11-21)](#sources-evaluated-not-used-2026-11-21)
  - [Bus alternative checked, not adopted](#bus-alternative-checked-not-adopted)

Checked live on **2026-11-19** from a Brazilian IP with the server's own client: Node.js `fetch`,
User-Agent `curitibai-mcp/0.1`, redirects followed by hand. The CNES API (v0.2) was checked the same day with curl and
User-Agent `curitibai-mcp/0.2`. The PNCP Consulta API (v0.3) was checked the same day with curl and User-Agent
`curitibai-mcp/0.3`. The INMET API (v0.5) was checked the same day with curl and User-Agent `curitibai-mcp/0.5`. The
Overpass API instances (v0.7) were checked on 2026-11-21 (UTC) with curl and User-Agent `curitibai-mcp/0.7`. The
"Imuniza Já" vaccination page (v0.12) was checked on 2026-11-21 (UTC) with curl and then with Node.js `fetch` and
User-Agent `curitibai-mcp/0.7`. IPPUC's GeoCuritiba services (v0.15) were checked on 2026-11-21 (UTC) with curl and
User-Agent `curitibai-mcp/0.7`, at most one request per 5 s. ANA's telemetry web service (v0.16) was checked on
2026-11-22 (UTC) with curl and Node.js `fetch`, at most one request per 5 s (one research check on 2026-11-21 by the
owner's researcher, recorded as reported). The Centro Cultural Teatro Guaíra calendar (v0.17) was checked
on 2026-11-22 (06:01–06:03 UTC) with curl and User-Agent `curitibai-mcp/0.7`, GET only, at least 5 s between requests.

**Rule applied:** a host is contacted only if its robots.txt allows it. Hosts with `Disallow: /` are never fetched,
not even inside the visit hours they list. The browser User-Agent is never imitated.

**Collection rules** (since v0.13.2, also in [docs/privacy.md](privacy.md#collection-rules)):

- robots.txt is checked before a host is added, and a host or path it disallows is never fetched. The events
  collector reads robots.txt on every run, stops if it changed, starts requests only inside the site's `Visit-time`
  and makes at most 1 request per 5 s on that host (`Request-rate: 1/5`).
- A 403, a CAPTCHA, a login or any other block is never bypassed: the host is left out, or the tool returns
  `source_unavailable`. Since v0.13.2 this is in code: `src/http.ts` throws `SourceRefusedError` (a final refusal,
  never retried, not even by PNCP's single retry) for HTTP 401, 403 and a 429 whose HTML page (first 16 KB) mentions
  a CAPTCHA or challenge; the host is then not asked again for 10 minutes in that process (the same refusal is
  returned without a network call; since v0.13.3 the error carries the message "the source refused this server; it
  is not asked again for 10 minutes (per host)"), and `procurement_search` and `health_units_search` return what they found with
  `next_page: null`. PNCP's single retry happens only after a connection error or a 429 with `Retry-After` of 5 s or
  less, never after a 401, 403 or CAPTCHA. The events collector stops on any non-200 status, 403 included.
- Requests send the User-Agent `curitibai-mcp/<version> (+https://github.com/Bossmann007/curitibai)`, the repository
  being the contact.
- Removal requests: open an issue at <https://github.com/Bossmann007/curitibai/issues>; the content is removed from
  the next release.

## robots.txt findings

| Host | `/robots.txt` | Result |
|---|---|---|
| `dadosabertos.curitiba.pr.gov.br` | 404 (HTML "not found" page, rechecked 2026-11-19) | No restriction (RFC 9309: a 4xx robots.txt means no rules). **Contacted.** |
| `apidadosabertos.saude.gov.br` (Ministry of Health open-data API) | 404 (HTML "404 Not Found", checked 2026-11-19) | No restriction. **Contacted** (v0.2, `health_units_search`). |
| `pncp.gov.br` (Portal Nacional de Contratações Públicas) | 404 with the portal's HTML page as body (rechecked 2026-11-19 with curl, User-Agent `curitibai-mcp/0.3`; the first two attempts were connection resets, the third answered 404) | No restriction (RFC 9309; rechecked 2026-11-22, 404 with the HTML page again after two connection resets). **Contacted** (v0.3, `procurement_search`, `/api/consulta`; since v0.19.1 also `/api/search` when `query` is set) |
| `apiprevmet3.inmet.gov.br` (INMET forecast and warnings API) | 404, body `HttpException: E_ROUTE_NOT_FOUND: Route not found GET /robots.txt` (checked 2026-11-19 with curl, User-Agent `curitibai-mcp/0.5`; same answer on 2026-11-25) | No restriction (RFC 9309). **Contacted** (v0.5, `weather_forecast` and `weather_alerts`, two paths only) |
| `ovp.dresel.systems` (Overpass API, OpenStreetMap, run by Christian Dresel) | 404, Apache HTML "Not Found" (checked 2026-11-21 03:26 UTC with curl, User-Agent `curitibai-mcp/0.7`) | No restriction (RFC 9309). **Contacted** (v0.7, `places_search`, `POST /api-sa/interpreter` only) |
| `overpass.private.coffee` (formerly `overpass.kumi.systems`) | 404 (checked 2026-11-21 02:43 UTC) | Allowed, and its terms allow "any project", but **it did not answer any Overpass request** from 02:44 to 03:20 UTC on 2026-11-21 (504 "server is probably too busy", then timeouts). Not used |
| `overpass-api.de` (main Overpass instance, FOSSGIS) | 200 (checked 2026-11-21 02:42 UTC): `User-agent: *`, `Disallow: /api/`, `Disallow: /munin/`, `Disallow: /achavi/`. `z.` and `lz4.overpass-api.de` serve the same file | **Disallowed. Never contacted by the server.** One `/api/status` request was sent in the same curl run as the robots.txt check, before the file was read; it timed out with no bytes |
| `overpass.kumi.systems` | 404 (checked 2026-11-21) | Same service as `overpass.private.coffee` (same terms page, same outage); not used |
| `maps.mail.ru` (VK Maps Overpass) | 301 to `https://maps.vk.com/`, which serves an HTML page, not a robots file (checked 2026-11-21) | Rules unreadable: **not used** |
| `overpass.nextgis.com` (NextGIS) | 404 (checked 2026-11-21 03:26 UTC) | The endpoint needs an API key in the path (`/YOUR_API_KEY/api/interpreter`, sign-up at my.nextgis.com): **not used** (no key, no account) |
| `overpass.openstreetmap.fr` | 403, "This service is only available to white-listed usages" | **Not used** |
| `mid-dadosabertos.curitiba.pr.gov.br` (file host the portal links to) | 200: `User-agent: *`, `Request-rate: 1/5`, `Visit-time: 0400-0645` (UTC), `Disallow: /`, plus extension rules | **Disallowed. Never fetched.** |
| `dadosabertos.c3sl.ufpr.br` (UFPR mirror) | Rechecked 2026-11-21 15:53 UTC with Node.js `fetch`, User-Agent `curitibai-mcp/0.7`: `/robots.txt` 404 and `/curitibaurbs/robots.txt` 404; `/curitiba/robots.txt` 200 (`text/plain`, Latin-1 comments): `User-agent: *`, `Request-rate: 1/5`, `Visit-time: 0400-0645` (UTC), `Disallow: /`, `Disallow: /aspnet_client`, `Disallow: /temporario`, extension rules (`*.mdb`, `*.pdf`, `*.dll`, `*.log`, `*.asp`, `*.config`, `*.jpg`, `*.gif`, `*.ascx`, `*.aspx`) and `Allow: *.html` | **Treated as disallowed. Never fetched**, `/curitibaurbs/` included: the bus tools (v0.8) and `city_points_search` (v0.9) read URBS files a person downloads from there in a browser. Owner's note (2026-11-21): the project treats `/curitiba/` as disallowed outside that visit window; the rule at the top (no `Disallow: /` host is fetched, not even inside its visit hours) is stricter and still applies, so nothing in this repository fetches it at any hour |
| `imunizaja.curitiba.pr.gov.br` (Prefeitura, "Imuniza Já") | 200, `text/plain`, `Last-Modified: Tue, 07 Jul 2026 15:12:51 GMT`, fetched 2026-11-21 15:50 UTC (curl) and 15:53 UTC (Node.js `fetch`, User-Agent `curitibai-mcp/0.7`). Group `User-agent: *`: `Disallow: /App`, `/bin`, `/Cache`, `/Imagem`, `/Include`, `*.mdb`, `*.pdf`, `*.dll`, `*.log`, `*.asp`, `*.config`, `*.jpg`, `*.gif`, `*.ascx`; `Allow: *.aspx`, `*.html`, `*.htm`. Other groups: `Twitterbot` and `Googlebot-News` allowed everything; `Yandex`, `Slurp`, `Baidoospider` `Disallow: /`. No `Crawl-delay`, `Request-rate` or `Visit-time`. `Sitemap: http://www.curitiba.pr.gov.br/sitemap.xml` | `/locaisvacinacao/` is not disallowed. **Contacted** (v0.12, `vaccination_sites_search`, that one page only, at most once per 6 hours per server process) |
| `geocuritiba.ippuc.org.br` (IPPUC, GeoCuritiba ArcGIS server) | 404, `text/html; charset=utf-8` (checked 2026-11-21 23:16 UTC with curl, User-Agent `curitibai-mcp/0.7`; also reported 404 by the owner's research the same day) | No restriction (RFC 9309). **Contacted** (v0.15, `city_facilities_search`, fixed layer queries under `/server/rest/services` only, each layer at most once per 6 hours per server process; at most one request per 5 s to the host from a server process (any layer; a call whose turn is more than 10 s away returns `rate_limited` with the wait, without a request); after a failure no request for 60 s, or a 429's `Retry-After` when longer, at most 1 hour (the same error is returned instead); an ArcGIS `error` with code 401, 403, 498 or 499 (sent with HTTP 200) is a final refusal that blocks the host for 10 minutes). Since v0.22 also `place_at_point`: point queries on the cadastral map service, and since v0.23 `service_areas_at_point`: point queries on the thematic map service (since v0.24 also the cadastral bairro layer when no health area contains the point), both with the point rounded to 4 decimals, through the same host gate. Rechecked 2026-11-24 21:00 UTC (404, IIS HTML page): since v0.27 also the thematic layers 12 (voting places, whole layer), 25, 27 and 41 (police and fire areas, point queries) and 43 (census sector, point query and one `outStatistics` query per neighbourhood), and the urban-equipment layers 157 and 158 (bus terminals). Rechecked 2026-11-25 22:19:03 UTC with User-Agent `curitibai-mcp/0.44 (+https://github.com/Bossmann007/curitibai)` (404, IIS HTML page): since v0.44 also the urban-equipment layer 134 (health units). Rechecked 2026-11-25 22:34:17 UTC with User-Agent `curitibai-mcp/0.45 (+https://github.com/Bossmann007/curitibai)` (404, IIS HTML page): since v0.45 also the urban-equipment layers 130 (UPAs), 129 (public hospitals) and 131 (psychiatric stabilisation). Rechecked 2026-11-25 22:50:20 UTC with User-Agent `curitibai-mcp/0.46 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.46 also the urban-equipment layers 135 (CAPS), 132 (medical specialty centres) and 133 (dental specialty centres). Rechecked 2026-11-25 23:06:03 UTC with User-Agent `curitibai-mcp/0.47 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.47 also the urban-equipment layers 167 (Vigilância Sanitária), 136 (zoonoses centre) and 112 (Hospital Veterinário Municipal). Rechecked 2026-11-25 23:22:01 UTC with User-Agent `curitibai-mcp/0.48 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.48 also the urban-equipment layers 139 (Guarda Municipal modules) and 138 (Guarda Municipal regional núcleos). Rechecked 2026-11-25 23:38:47 UTC with User-Agent `curitibai-mcp/0.49 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.49 also the urban-equipment layers 143 (Polícia Civil), 146 (Polícia Federal), 147 (Polícia Rodoviária Federal) and 145 (Polícia Científica). Rechecked 2026-11-25 23:59:21 UTC with User-Agent `curitibai-mcp/0.50 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.50 also the urban-equipment layer 168 (Instituto de Identificação do Paraná). Rechecked 2026-11-26 00:11:55 UTC with User-Agent `curitibai-mcp/0.51 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.51 also the urban-equipment layers 99 (Cartório de Registro Civil), 21 (Junta de Serviço Militar), 105 (Defensoria Pública) and 106 (Fórum). Rechecked 2026-11-26 00:55:10 UTC with User-Agent `curitibai-mcp/0.52 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.52 also the urban-equipment layers 38 (CREAS), 40 (Centro POP), 39 (Central de Encaminhamento Social), 36 (Centro de Atividades para Idosos), 108 (Centro de Referência de Atendimento à Mulher) and 109 (Centro de Referência Afro); the shelter and transit-house layers 45, 46 and 164 are never read. Rechecked 2026-11-26 01:52:02 UTC with User-Agent `curitibai-mcp/0.53 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.53 also the urban-equipment layers 80 (Escola Municipal), 78 (Centro Municipal de Educação Infantil), 81 (Centro Municipal de Atendimento Educacional Especializado) and 79 (Centro de Educação Infantil (contratado)). Rechecked 2026-11-26 19:26:36 UTC with User-Agent `curitibai-mcp/0.57 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.57 also the thematic layers 15 (Circunscrição Imobiliária) and 16 (Registro Civil), point queries. Rechecked 2026-11-26 19:43:20 UTC with User-Agent `curitibai-mcp/0.58 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.58 also the urban-equipment layers 159 (Terminal Rodoviário), 160 (Terminal Ferroviário) and 15 (Administração Regional). Rechecked 2026-11-26 19:59:13 UTC with User-Agent `curitibai-mcp/0.59 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.59 also the urban-equipment layer 29 (Agência de Atendimento da COHAB). Rechecked 2026-11-26 20:53:33 UTC with User-Agent `curitibai-mcp/0.60 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.60 also the urban-equipment layers 7 (Mesa Solidária), 9 (Horta, only `tipo_equi = 'Horta Comunitária Urbana'`), 10 (Fazenda Urbana) and 1 (Núcleo Regional de Segurança Alimentar e Nutricional). Rechecked 2026-11-26 23:30:06 UTC with User-Agent `curitibai-mcp/0.64 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.64 also the urban-equipment layers 150 (Unidade de Atendimento SINE), 151 (Agência do Trabalhador), 149 (Liceu de Ofícios) and 152 (Agência da Previdência Social). Rechecked 2026-11-26 23:48:30 UTC with User-Agent `curitibai-mcp/0.65 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.65 also the Planta Genérica de Valores service, layer 0 (Microrregião (PGV 2025)), point queries. Rechecked 2026-11-27 00:06:53 UTC with User-Agent `curitibai-mcp/0.66 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`, IIS HTML page): since v0.66 also the thematic layer 13 (Zona Eleitoral), point queries. Rechecked 2026-11-27 00:24:30 UTC with User-Agent `curitibai-mcp/0.67 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): since v0.67 also the urban-equipment layers 61 (Casa da Leitura), 60 (Bondinho da Leitura), 52 (Auditório), 57 (Circo) and 58 (Clube de Xadrez). Rechecked 2026-11-27 02:45:18 UTC with User-Agent `curitibai-mcp/0.72 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): v0.72 adds no layer (a re-read of layers 150, 151, 149, 152 and 9 for the name filter). v0.74 adds no layer: on 2026-11-27 the 89 urban-equipment layers were re-read twice each (the first rule and the rule after review) by a one-off check script (not the server, so not through the host gate; 6 s apart, User-Agent `curitibai-mcp/0.7 (+https://github.com/Bossmann007/curitibai)`, the server's fixed query without geometry) to count the e-mails the new filter shape keeps; robots.txt was not rechecked. Rechecked 2026-11-27 15:15:58 UTC with User-Agent `curitibai-mcp/0.76 (+https://github.com/Bossmann007/curitibai)` (404, `text/html; charset=utf-8`): v0.76 adds no layer (one read of layers 150, 151, 149, 152 and 9 for the name filter) |
| `telemetriaws1.ana.gov.br` (ANA, Agência Nacional de Águas e Saneamento Básico, telemetry web service) | 404 (checked 2026-11-21 by the owner's researcher and again 2026-11-22 05:50 UTC with curl) | No restriction (RFC 9309). **Contacted** (v0.16, `river_levels`, `/ServiceANA.asmx/DadosHidrometeorologicos` only, bundled station codes, each at most once per 15 minutes per process) |
| `dadosabertos.ana.gov.br` (ANA open-data portal) | `Crawl-delay: 60` (owner's researcher, 2026-11-21) | Another host; **never contacted** |
| `mid.curitiba.pr.gov.br` (Prefeitura file host: the CGM's "Ouvidoria da CGM – Guia de uso" PDF, since 0.43.0) | 404, IIS HTML "404 - File or directory not found." (checked 2026-11-25 21:55:04 UTC with curl, User-Agent `curitibai-mcp/0.43 (+https://github.com/Bossmann007/curitibai)`; the owner's research desk also read 404 the same day) | No robots.txt, so no restriction (RFC 9309, 2.3.1.3). **Never contacted by the server.** One PDF downloaded by hand once, 2026-11-25 21:55:08 UTC; `city_service_guide` (`ouvidoria`) links it ([how](#city_service_guide-guides-and-official-links-for-services-that-need-a-login-bundled-since-0280)) |
| `www.curitiba.pr.gov.br` | 200 (robots.txt read on 2026-11-19): `User-agent: *`; disallows `/App`, `/bin`, `/Cache`, `/Imagem`, `/Include` and some extensions (`*.pdf`, `*.asp`, `*.jpg`, ...); `/dadosabertos/` and `/servicos/` are **not disallowed** | **The server never contacts this host**: on 2026-11-19 it was observed answering HTTP 403 to non-browser clients. `city_services_search` (v0.6) reads only a local copy of the `/servicos/` listing pages that you save yourself; no copy is in this repository |
| `servicos.curitiba.pr.gov.br` (Carta de Serviços detail pages) | Checked 2026-11-19: `Disallow: /`; re-read 2026-11-25 21:28:40 UTC, same | **Disallowed. Never contacted by the server**; the local copy holds no detail-page content. One request by hand broke this rule by mistake on 2026-11-25 (`/vale-creche/994`, deleted unread, [details](#city_service_guide-guides-and-official-links-for-services-that-need-a-login-bundled-since-0280)). `city_services_search` returns these URLs (from the local file) only as links for people to open |
| `www.urbs.curitiba.pr.gov.br` | 404 | Out of scope, same reason. Not contacted |
| `www.detran.pr.gov.br` (Detran-PR) | 200 (checked 2026-11-19 with curl, User-Agent `curitibai-dev-check`): `User-agent: *`; disallows, among others, `/core/`, `/profiles/`, `/admin/`, `/search/`, four `/user/...` paths (register, password, login, logout), `/print/`, `/external-print/`, `/noticias/aen/`, `/usuario/`, `/celepar-captcha-audio/`, `/webservices/`, `/virada.html`. `/`, `/unidades`, `/Noticia/`, `/Pagina/` and `/servicos/` are **not disallowed** (no explicit Allow either) | Read by hand once for `detran_pr_info` (v0.4): the home page, `/unidades` and three `/Noticia/` pages. **The server never contacts it**: the data is bundled |
| `turismo.curitiba.pr.gov.br` (Instituto Municipal de Turismo, events calendar) | 200, fetched once on 2026-11-21 with the collector's User-Agent (`text/plain`, no charset, Latin-1 comments, `Last-Modified: Tue, 08 Sep 2026`); its only group is `User-agent: *`, recorded in full under "Events" below | Allowed inside the visit hours. **The server never contacts it.** Only the separate collector `scripts/fetch-events.mjs` (v0.10) does (run by the user or, since v0.18, by the nightly GitHub workflow), 02:00–05:50 UTC, one request per 5 s, after comparing the whole robots.txt group with the recorded one on every run |
| `linhaturismo.curitiba.pr.gov.br` (Prefeitura, Linha Turismo site) | 404 (checked 2026-11-25 05:14 UTC with curl, User-Agent `curitibai-mcp/0.10`) | No restriction (RFC 9309). **Never contacted by the server.** Read by hand once on 2026-11-25 for the bundled `ponto turistico` list of `city_facilities_search` ([how](#ponto-turistico-linha-turismo-stops-bundled-since-0400)) |
| `educacao.curitiba.pr.gov.br` (Secretaria Municipal da Educação, SME) | 200, `text/plain`, read 2026-11-25 02:01:10 UTC (inside its own Visit-time) with User-Agent `curitibai-mcp/0.33 (+https://github.com/Bossmann007/curitibai)`. One group, `User-agent: *`: `Request-rate: 1/5`, `Visit-time: 0200-0600` (UT), disallows `/App_Browsers`, `/App_Themes`, `/bin`, `/Cache`, `/Imagem`, `/Include` and `*.mdb`, `*.pdf`, `*.dll`, `*.log`, `*.asp`, `*.config`, `*.jpg`, `*.gif`, `*.ascx`; allows `*.aspx`, `*.html`, `*.htm`. The owner's research desk read it on 2026-11-23 and named the same `Request-rate`, `Visit-time` and `*.pdf` lines | Pages allowed only 02:00–06:00 UTC, one request per 5 s. **Never contacted by the server or a collector.** Read by hand for v0.33 (school calendar), three requests on 2026-11-25: `/robots.txt` at 02:01:10 UTC, `/` at 02:01:16 UTC and `/evento/calendarios-do-ano-letivo-2026/18401/4180` at 02:01:35 UTC. For v0.42, two more on 2026-11-25: `/robots.txt` and `/conteudo/2026-programa-vale-creche/15690` at 21:28:40 UTC, **outside the Visit-time** (a mistake; the page was deleted unread, [details](#city_service_guide-guides-and-official-links-for-services-that-need-a-login-bundled-since-0280)). The 2026 calendar page has no dates, only links to three PDFs, and the 2027 calendars are one PDF; all are on `mid-educacao.curitiba.pr.gov.br`. `*.pdf` is disallowed here, so v0.33 built no tool; v0.34 reads the 2026 PDFs from that other host (next row) |
| `mid-educacao.curitiba.pr.gov.br` (SME file host: the school calendar PDFs; the Vale-Creche law since 0.42.0) | 404 (reported by the owner's assistant, who downloaded the PDFs on 2026-11-25; checked from this project on 2026-11-25 21:28:06 UTC with curl: 404) | No robots.txt, so no restriction (RFC 9309, 2.3.1.3). **Never contacted by the server.** Three PDFs downloaded by hand once on 2026-11-25, 02:16–02:18 UTC, inside the Visit-time of the page that links them; `city_calendar` carries the dates read from them ([how](#city_calendar-school-calendars-2026-bundled-since-0340)). The Vale-Creche law PDF downloaded by hand once on 2026-11-25 at 21:28 UTC; `city_service_guide` (`vale_creche`) links it ([how](#city_service_guide-guides-and-official-links-for-services-that-need-a-login-bundled-since-0280)) |
| `www.teatroguaira.pr.gov.br` (Centro Cultural Teatro Guaíra, Governo do Paraná, served by CELEPAR) | 200, `text/plain`, `Last-Modified: Fri, 20 Mar 2026 14:42:12 GMT`, fetched 2026-11-22 06:01 UTC with curl, User-Agent `curitibai-mcp/0.7`. One group, `User-agent: *` (Drupal default: allows CSS/JS/images under `/core/` and `/profiles/`, disallows `/core/`, `/profiles/`, `/README.txt`, `/web.config`, `/admin/`, `/comment/reply/`, `/filter/tips`, `/node/add/`, `/search/`, four `/user/...` paths, their `/index.php/` forms, `/print/`, `/external-print/`, `/noticias/aen/`, `/usuario/`, `/webservices/`); no `Crawl-delay`, no `Visit-time`, no `Request-rate` (full group in the `guaira_events` section) | `/calendario-eventos` and `/Evento/` allowed. **Contacted** (v0.17, `guaira_events`); robots.txt is re-read every 24 h by the server, which stops if the calendar becomes disallowed |
| `raw.githubusercontent.com` (GitHub raw file host; this repository's `data` branch) | 404, `text/plain` "404: Not Found" (checked 2026-11-22 06:55 UTC with curl) | No restriction (RFC 9309). **Contacted** (v0.18, `events_search` and `useful_phones`), only for the three fixed files `/Bossmann007/curitibai/data/events/events.json`, `/Bossmann007/curitibai/data/phones/phones.json` and `/Bossmann007/curitibai/data/phones/status.json` (v0.18.1), published by this project's own nightly workflow (below) |
| `piloto-cbs.tributos.gov.br` (Receita Federal, pilot "calculadora de tributos do consumo") | 404 (reported in the v0.21.0 brief, 2026-11-23; no rules) | No restriction (RFC 9309). **Contacted** (v0.21, `tax_reform_curitiba`), only fixed `GET` routes under `/servico/calculadora-consumo/api/calculadora/dados-abertos/`, at most one request per 5 s |
| `lp.curitiba.pr.gov.br` (Prefeitura, NFS-e page `/notanacional`) | Has a `Visit-time` 0400-0645 UTC rule (v0.21.0 brief, 2026-11-23) | **The server never contacts it**: `tax_reform_curitiba` carries a fixed, dated note read by hand |
| `www.normasbrasil.com.br` (copy of Decreto 2.385/2025) | 404 (HTML "Página não encontrada", checked 2026-11-24 21:2x UTC with curl, User-Agent `curitibai-mcp/0.7`) | No restriction (RFC 9309). Read by hand once (one page, `/norma/decreto-2385-2025-curitiba_486274.html`). **The server never contacts it**: `city_calendar` carries the dated list |
| `www.legisweb.com.br` (Legisweb news, IPTU 2026 notes) | 200 (checked 2026-11-24 with curl): `User-Agent: *`, `Disallow:` (empty: everything allowed), `Crawl-delay: 10` | Allowed. Read by hand once (`/noticia/?id=32497` and `?id=32939`, 11 s apart). **The server never contacts it**: `city_calendar` carries the dated rule |
| `cvv.org.br` (Centro de Valorização da Vida, CVV; the 188 number in the `caps` and `estabilizacao psiquiatrica` notes, since 0.46.0) | 200, `text/plain; charset=utf-8` (checked 2026-11-25 22:51:21 UTC with curl, User-Agent `curitibai-mcp/0.46 (+https://github.com/Bossmann007/curitibai)`): `User-agent: *`, `Disallow: /wp-admin/`, `Allow: /wp-admin/admin-ajax.php`, a `Sitemap` | `/` is allowed. Read by hand once (the home page `/`, 22:51:32 UTC): "Nosso atendimento é realizado pelo telefone 188 (24 horas por dia e sem custo de ligação)", "Converse gratuitamente com um dos nossos voluntários, em todo o Brasil, 24 horas por dia LIGUE 188". **The server never contacts it** and no link to it is returned: the notes carry the number only |
| `www.gov.br` (Governo Federal portal; the Ministério das Mulheres' "Ligue 180" page, for the 180 and 190 numbers in the `centro de referencia da mulher` note, since 0.52.0) | 200, `text/plain; charset=utf-8` (checked 2026-11-26 00:56:51 UTC with curl, User-Agent `curitibai-mcp/0.52 (+https://github.com/Bossmann007/curitibai)`): a `Sitemap` line, a `Yandex` group and a `User-Agent: *` group whose rules disallow `/economia/pt-br/internet/*`, `/*sendto_form$`, `/*folder_factories$` and paths under `/ebserh/` and `/mre/`; no `Crawl-delay` | `/mulheres/pt-br/ligue180` is not disallowed. Read by hand once (that page, 00:57:01 UTC, 200): "A ligação é gratuita e o serviço funciona 24 horas por dia, todos os dias da semana" and "Em casos de emergência, deve ser acionada a Polícia Militar, por meio do 190"; the page footer says the site's content is under Creative Commons Atribuição-SemDerivações 3.0 (CC BY-ND 3.0). Only the two numbers and their labels are used, the ministry cited. **The server never contacts it** and no link to it is returned; the copy was deleted after reading |
| `www.legislacao.pr.gov.br` (Paraná legislation) | 404 (checked 2026-11-19 with curl) | No restriction (RFC 9309). Read by hand once (Portaria DETRAN 907/2025 page and its annex PDF). **The server never contacts it** |

Some requests were made to `mid-dadosabertos` and the UFPR mirror while these sources were evaluated, before this rule
was set: directory listings, the start of the 156 CSV, two 30-second throughput tests and one aborted full download
(about 170 MB in total). None have been made since, and the code cannot contact either host.

## Implemented

### `open_datasets_search`: Portal de Dados Abertos de Curitiba catalogue search

| Field | Value |
|---|---|
| URL | `POST https://dadosabertos.curitiba.pr.gov.br/conjuntodado/`, form fields `Parametros.Termo`, `Parametros.IndicePagina`, `cookie=true` |
| Format | HTML. 5 dataset cards per page (detail link `conjuntodado/detalhe?chave=<GUID>`, title, publishing body, description, file formats, "Atualizado em"), a "N resultados" total or "Nenhum resultado encontrado", and a pager |
| API | No REST/CKAN API (`/api/3/action` returns 404, per the prior-art check). The search is a read-only form POST |
| Behavior | Accents match literally: "saude" and "transporte" match; "onibus", "feira(s)", "escola(s)", "lixo", "residuos" return nothing. Filtered pages take 1–6 s. Unfiltered pages 2–3 took 20–40+ s. Rechecked 2026-11-22: "saúde"/"saude" and "educação"/"educacao" both matched; "ônibus", "onibus", "escola", "lixo", "resíduos", "feira(s)" still nothing; "transporte coletivo" found "Transporte Coletivo de Curitiba"; "coleta" and "educação" found unrelated datasets, so they are not synonyms |
| What the server does | When page 1 has no results, retries page 1 once with the accent-free query (if different), then once with the synonym in `src/sources/portalSynonyms.ts` (if any); `note` says which query matched. A failed retry keeps the empty answer as `partial` |
| License / terms | Footer: CC BY 4.0. Usage rules (`/informacoes/regrasutilizacao/5`): free use for any lawful purpose. Conditions: cite the source body, say the data was accessed via the Portal de Dados Abertos de Curitiba, and include the sentence "O Portal de Dados Abertos de Curitiba e o órgão ou entidade de onde foram acessados os dados não garantem sua autenticidade, qualidade, integridade e atualidade após terem sido disponibilizados para uso secundário." |
| Fixtures | `test/fixtures/portal_busca_saude.html` (results block for "saude"), `test/fixtures/portal_busca_vazia.html` ("onibus", no results) |

### `dataset_files`: a dataset's file links

| Field | Value |
|---|---|
| Step 1 | `GET https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=<GUID>` (HTML, up to ~200 KB). The DOWNLOAD button calls `downloadArquivos('<dataset GUID>', '<extension GUID>')`. The extension GUID was `377f4e23-0e4f-4f11-954f-ae06ba689558` for all three datasets checked (Unidades de Atendimento, 156, Receitas e Despesas), but it is read from the page. Datasets without files have no such call (e.g. "Transporte Coletivo de Curitiba"). An unknown GUID returns HTTP 500 |
| Step 2 | `GET https://dadosabertos.curitiba.pr.gov.br/ConjuntoDado/DownloadArquivos/?conjuntoDadoChave=<GUID>&conjuntoDadoExtensao=<GUID>&pagina=<n>&tamanhoPagina=50` → JSON `{sucesso, tabela, paginacao:{pagina, totalPaginas, total}, erro}`. `tabela` is an HTML table: file link, data-dictionary link, "Atualização" (dd/mm/yyyy hh:mm), "Tamanho". ~0.5 s |
| Output | Name, https link, format (from the extension), dictionary link, update time, size. **The links point to `mid-dadosabertos.curitiba.pr.gov.br` and are returned without being fetched** |
| Example | Unidades de Atendimento: 25 files, 1 page. 156: 676 files, 14 pages, each daily CSV about 130 MB |
| License / terms | As above |
| Fixtures | `test/fixtures/portal_detalhe_unidades.html` (title and button only), `test/fixtures/portal_detalhe_transporte.html` (no files), `test/fixtures/portal_arquivos_unidades.json` (3 of 25 rows, pagination as served) |

### `health_units_search`: Ministry of Health CNES open API

Checked live on **2026-11-19** with curl, User-Agent `curitibai-mcp/0.2`. The PNCP Consulta API (v0.3) was checked the same day with curl and User-Agent
`curitibai-mcp/0.3`.

| Field | Value |
|---|---|
| URL | `GET https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=410690&status=1&limit=20&offset=<page-1>` (410690 = Curitiba, IBGE). Optional `codigo_tipo_unidade=<code>`. Unit type labels: `GET /cnes/tipounidades` → `{"tipos_unidade":[{codigo_tipo_unidade, descricao_tipo_unidade}]}` (39 types) |
| Documentation | Swagger 2.0 at `https://apidadosabertos.saude.gov.br/static/swagger.json` (UI at `/v1/`), "DEMAS - API de Dados Abertos", version 1.8.32. Filters: `codigo_tipo_unidade`, `codigo_uf`, `codigo_municipio`, `status` (1 active, 0 inactive), surgical/obstetric centre flags, `data_atualizacao`. **No name filter** |
| Format | JSON `{"estabelecimentos":[...]}`, 37 fields per unit (CNES code, trade and legal names, CNPJ, natureza jurídica code, unit type code, address, CEP, neighbourhood, phone, e-mail, coordinates, opening hours, flags, `data_atualizacao`). No total count. ~0.3–1.2 s per page. `Cache-Control: public, max-age=300` |
| Paging | `limit` ≤ 20 (the docs say so; `limit=21` silently returned 20). **`offset` is a page index, not an item offset**: with `limit=3`, `offset=1` returned items 4–6 and `offset=3` items 10–12. Past the end: `[]`. So the server keeps the page size fixed at 20 and resumes with `next_page` plus `next_skip` (matches already returned from that page) |
| What the server does | Requests active units only (`status=1`), pages until `limit` units match, at most 20 per call and none started after 20 s, through the CNES host gate (`src/hostGate.ts`, ADR 0003: at least 400 ms between request starts from the process, a turn more than 5 s away is `rate_limited`, and after a failure no request for 60 s, a 429's Retry-After when longer, at most 1 hour, or the 10-minute block after a refusal), reports how many records it `discarded` as non-public or incomplete, filters names client-side (accents and case ignored), and resolves `unit_type` text through `/cnes/tipounidades` (one code → sent as `codigo_tipo_unidade`; several → filtered client-side) |
| Person names | A sample of 60 active type-22 units ("CONSULTORIO ISOLADO") had 29 with natureza jurídica `4000` (pessoa física, no CNPJ) whose trade name is the practitioner's name. Names of people also appear under `2135` (empresário individual) and `2232` (sociedade simples). **Owner decision (2026-11-19):** return only units whose natureza jurídica code is `1xxx` (public administration); drop every other group and any record with the code missing or malformed (fail closed). No name detection by text. Private clinics, consultórios and non-profit hospitals (3xxx) are therefore out of scope |
| Fields returned | CNES code, trade name (`nome_fantasia`), unit type code and label, address (street + number), neighbourhood, CEP, unit phone, management sphere (`descricao_esfera_administrativa`). Not returned: legal name, CNPJ, e-mail, coordinates, hours, flags |
| Terms / licence | No terms page for the API itself was found. Three notices disagree, each opened on 2026-11-19: (1) the API's Swagger `info.license` is **MIT** (`https://apidadosabertos.saude.gov.br/static/swagger.json`); (2) the Portal de Dados Abertos do SUS home page says "Todo o conteúdo deste site está publicado sob a licença Creative Commons Atribuição-SemDerivações 3.0" (**CC BY-ND 3.0**, `https://dadosabertos.saude.gov.br/`); (3) the portal's Cartilha de Dados Abertos do SUS (2025) says "Esta obra é disponibilizada nos termos da Licença Creative Commons – Atribuição – Não Comercial – Compartilhamento pela mesma licença 4.0 Internacional" (**CC BY-NC-SA 4.0**; it covers the booklet itself, `https://dadosabertos.saude.gov.br/Cartilha-de-Dados-Abertos-do-SUS_ISBN.pdf`). The Ministry's open-data page (`https://www.gov.br/saude/pt-br/acesso-a-informacao/dados-abertos`) was seen only in a search summary, not opened. Nothing found forbids automated access. **Owner decision (2026-11-19):** treat the data under the strictest notice (attribution, non-commercial, no derivatives): query live, return selected fields with values unchanged, attribute in `license_note` (Ministério da Saúde, CNES, Portal de Dados Abertos do SUS, links to the three notices), and commit no real CNES records |
| Fixtures | **Synthetic**: `test/fixtures/cnes_estabelecimentos_synthetic.json` and `test/fixtures/cnes_tipounidades_synthetic.json` have the real JSON shape with invented values (marked in a `_synthetic` key) |

The repository's Apache-2.0 licence covers the code only, not data from any source.

### `procurement_search`: PNCP Consulta API (contratações of Curitiba municipal bodies)

Checked live on **2026-11-19** with curl, User-Agent `curitibai-mcp/0.3`, before any code was written.

| Field | Value |
|---|---|
| URL | `GET https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=<yyyyMMdd>&dataFinal=<yyyyMMdd>&codigoModalidadeContratacao=<code>&codigoMunicipioIbge=4106902&pagina=<n>&tamanhoPagina=50` (4106902 = Curitiba, 7-digit IBGE code). No trailing slash (see notice 11/26 below) |
| Documentation | OpenAPI 3.0.1 at `https://pncp.gov.br/api/consulta/v3/api-docs` (UI at `/api/consulta/swagger-ui/index.html`): "API PNCP CONSULTA", `info.version` **1.0**, contact Serpro. No `license` field. The manual at `https://pncp.gov.br/manual/pt-br/latest/` is the *Manual de Integração do PNCP* v. 2.6 (the publishing API); no Consulta-specific manual was found. Several of its pages (sections 4–6 and `contratacao/index.html`) could not be read: the host reset most connections |
| Date range | 365 days is accepted (2025-11-18 to 2026-11-18 answered 200 in 1.9 s for modality 8, 164 pages; rechecked 2026-11-19); a 687-day range answered 422. 366 days was not tried |
| Parameters | `dataInicial`, `dataFinal` (`yyyyMMdd`, required), `codigoModalidadeContratacao` (**required**: without it the API answers 400 "Required request parameter ... is not present"), `pagina` (required, ≥ 1), `tamanhoPagina` (10–50; 51 answered 400 "Tamanho de página inválido"). Optional filters: `uf`, `codigoMunicipioIbge`, `cnpj`, `codigoUnidadeAdministrativa`, `codigoModoDisputa`, `idUsuario`. A date range over 365 days answers 422 "Período inicial e final maior que 365 dias" |
| Municipality / body filter | `codigoMunicipioIbge=4106902` filters by the buying unit's municipality and returns every sphere (federal, state, municipal, other) with a unit in Curitiba. `cnpj=<14 digits>` filters one body (an 8-digit root answered 422 "CNPJ do Órgão/Entidade inválido"), but it was slower (18 s and 37 s per page against 8–13 s). **The server uses `codigoMunicipioIbge` and keeps only the bodies listed below (client-side, exact 14-digit CNPJ, fail closed)** |
| Format | JSON `{data:[...], totalRegistros, totalPaginas, numeroPagina, paginasRestantes, empty}`. **An empty result is HTTP 204 with no body** (modalities 2, 3, 5, 7, 10, 13, 14 in the window below). `Cache-Control: no-cache, no-store`. No rate-limit headers |
| Record fields | Body (`orgaoEntidade`: `cnpj`, `razaoSocial`, `esferaId`, `poderId`), unit (`unidadeOrgao`: `nomeUnidade`, `codigoIbge`, `municipioNome`, ...), `objetoCompra`, `modalidadeId`/`modalidadeNome`, `situacaoCompraId`/`situacaoCompraNome`, `valorTotalEstimado`, `valorTotalHomologado`, `dataPublicacaoPncp`, `dataAberturaProposta`, `dataEncerramentoProposta`, `numeroControlePNCP`, `anoCompra`, `sequencialCompra`, plus `informacaoComplementar`, `justificativaPresencial`, `processo`, `linkSistemaOrigem`, `usuarioNome` (the publishing platform), `amparoLegal`, `fontesOrcamentarias`. **This endpoint has no supplier (fornecedor) field**; suppliers appear in contracts and price-registration minutes, which are not queried |
| Latency | 8–13 s for a page of 50, about 3 s for a page of 10. The host reset roughly half of the connections during the checks (curl error 56) and answered on a retry |
| Rate limits | None documented in the pages that could be read, no rate-limit headers on 200 responses. **But the API answered HTTP 429** once, after about 20 requests in two minutes (headers of that response not captured); the same request answered 200 a minute later. The server sends at most 5 page requests per call, sequentially, and starts none after 20 s (so usually 2 or 3), through the PNCP host gate (`src/hostGate.ts`, ADR 0003: at least 6 s between request starts from the process, so at most 20 in 2 minutes; a turn more than 10 s away is `rate_limited`; after a failure no request for 60 s, a 429's Retry-After when longer, at most 1 hour, or the 10-minute block after a refusal; following `next_page` inside the wait makes no request and returns the same error), and retries a request once after a connection error (not after a timeout). An HTTP 429 is returned as `rate_limited` (the message gives the `Retry-After` wait, or about 1 minute), retried once only when `Retry-After` is 5 s or less. The 20 s count includes any 429 retry wait; when that budget stops the scan, `note` says so. A 429 on a later page keeps the first page as `partial`, with the wait in `note` (also for CNES and the portal search) |
| Terms / licence | No terms of use for the API were found: `https://pncp.gov.br/app/termos-de-uso` is the single-page app's fallback page, and the app bundle has no terms text. The PNCP site on gov.br (`https://www.gov.br/pncp/pt-br`, its "Dados Abertos" page `https://www.gov.br/pncp/pt-br/acesso-a-informacao/copy_of_dados-abertos`) says "Todas as buscas podem ser feitas sem necessidade de cadastro ou login" and its footer says "Todo o conteúdo deste site está publicado sob a licença Creative Commons Atribuição-SemDerivações 3.0 Não Adaptada" (**CC BY-ND 3.0**; it covers the site, and no other licence names the API data). Nothing found forbids automated access. The server attributes the source in `license_note` |
| Notice | gov.br/pncp communiqué Nº 11/26 (2026-11-17): after a Spring Boot update, API URLs must not end with `/` (HTTP 404); in production from 2026-12-17. The URL above has no trailing slash |
| Modality codes | From `GET https://pncp.gov.br/api/pncp/v1/modalidades` (the domain service the manual's section 7.4 points to), 20 codes: 1 Leilão - Eletrônico, 2 Diálogo Competitivo, 3 Concurso, 4 Concorrência - Eletrônica, 5 Concorrência - Presencial, 6 Pregão - Eletrônico, 7 Pregão - Presencial, 8 Dispensa, 9 Inexigibilidade, 10 Manifestação de Interesse, 11 Pré-qualificação, 12 Credenciamento, 13 Leilão - Presencial, 14 Inaplicabilidade da Licitação, 15 Chamada pública, 16 Concorrência – Eletrônica Internacional, 17 Concorrência – Presencial Internacional, 18 Pregão – Eletrônico Internacional, 19 Pregão – Presencial Internacional, 20 Diálogo Competitivo Internacional |
| Status codes | Manual 7.13 (`tabelas_de_dominio/situacao_da_contratacao.html`): 1 Divulgada no PNCP, 2 Revogada, 3 Anulada, 4 Suspensa |
| Public page | `https://pncp.gov.br/app/editais/<cnpj>/<ano>/<sequencial>`: the app's `editais` route with child path `:cnpj/:ano/:sequencial` (read from the app bundle `src_app_pages_consultas_consultas_module_ts`). Built from validated digits; `linkSistemaOrigem` (free text, sometimes without a scheme) is never returned |
| Fixtures | **Synthetic**: `test/fixtures/pncp_contratacoes_synthetic.json` has the real JSON shape. The CNPJs and names of the listed bodies (and of the excluded test body) are the real public ones, because the allowlist needs them; every other value is invented, with planted supplier keys, a CPF, an e-mail, a phone and person names so the tests can prove they never leave |

Research-only requests on 2026-11-19 (not made by the code): `/api/pncp/v1/modalidades`, `/api/pncp/v3/api-docs`, one
`/api/search/` query, the app's JavaScript bundles, the manual pages, and a walk of every result page for modalities 4,
6, 8, 9, 11 and 12 (62 pages of 50, one request at a time), plus page 1 of every other modality code (1–20) to list the bodies below.

**Text search (v0.19.1, checked 2026-11-22 with curl, User-Agent `curitibai-mcp/0.19.1`, GET only, at least 6 s
between requests).** On 2026-11-22 `procurement_search {query:"merenda"}` took 25 s and returned 0 items, partial,
after 4 Consulta pages: the Consulta API has no text parameter (its OpenAPI lists none), so a query was matched
client-side page by page at 8–13 s per page. Findings:

| Field | Value |
|---|---|
| URL | `GET https://pncp.gov.br/api/search?q=<text>&tipos_documento=edital&ordenacao=-data&status=todos&municipios=4006&modalidades=<code>&pagina=<n>&tam_pagina=100` (no trailing slash: both forms answered 200; notice 11/26) |
| Documentation | **None found**: not in the Consulta OpenAPI (`/api/consulta/v3/api-docs`) nor in the *Manual de Integração*. It is the search behind the public site's "Buscar" page: the app bundle's `environment` sets `searchURL:"/api/search"`, and the result panel (`default-src_app_result-panel_...js`) builds exactly these parameters (`q`, `tipos_documento`, `ordenacao` default `-data`, `pagina`, `tam_pagina`, `status`, `anos`, `orgaos`, `unidades`, `esferas`, `poderes`, `ufs`, `municipios`, `modalidades`, ...) |
| Access | No key, no login, no cookie; `access-control-allow-origin: *`; `cache-control: max-age=120`. The app's CAPTCHA (`usarCaptcha`) guards only the detail of a `compras` record (`getDetail` in the `consultas` chunk), never the search, and the server never asks for that detail. gov.br/pncp: "Todas as buscas podem ser feitas sem necessidade de cadastro ou login". robots.txt: 404 (no rules) |
| Filters | `municipios` takes PNCP's own municipality id, not the IBGE code: **Curitiba is 4006** (read from `municipio_id` of records with `codigo_ibge` 4106902). `modalidades=9` returned only modality 9. `q` matches the object and the body name ("FAS" found FUNDACAO DE ACAO SOCIAL FAS). `tam_pagina=100` worked. `q` matches whole words ("merend" does not find "merenda"). No date filter: `anos` filters by the purchase year (`ano`), not the publication date (with `anos=2024&anos=2025` a 2024 purchase published 2026-03-20 came back), so it is not used and the window is applied client-side. A window far in the past therefore needs more pages: every newer match is read first |
| Order | `ordenacao=-data` sorts by `data_atualizacao_pncp`, newest first (publication dates are not in order: an item published 2026-01-07 sat among items of 2026-11-17 because it was updated then). An update is never before publication, so once a page reaches updates older than `from`, no later item can be in the window and the scan stops |
| Latency | 0.45–1.7 s per page of 50–100 (against 8–13 s for a Consulta page of 50) |
| Record fields | Flat: `numero_controle_pncp`, `orgao_cnpj`, `orgao_nome`, `codigo_ibge`, `municipio_id`, `ano`, `numero_sequencial` (strings), `modalidade_licitacao_id`, `description` (the object), `valor_total_estimado`, `situacao_id`/`situacao_nome`, `data_publicacao_pncp`, `data_atualizacao_pncp`, `data_inicio_recebimento_propostas`, `data_fim_recebimento_propostas`, **plus** `fornecedor_*`, `usuario_nome`, `informacao_complementar`, `link_sistema_origem`. `parseSearch` copies only the first group into the Consulta shape and runs the same field-by-field builder, allow-list and modality gate |
| Live "merenda" (2026-11-22) | `municipios=4006`, all modalities: 21 results, none from a listed Curitiba municipal body except one Fundação Cultural inexigibilidade (modality 9, object withheld, so not matched); the others are federal, state and consortium bodies with a unit in Curitiba |
| Connection resets | As on 2026-11-19, most new connections were reset (curl error 56) and answered on a later attempt; after about 40 requests in 40 minutes every connection was reset for several minutes, and the research stopped. The server keeps its single retry after a connection error and the 6 s gate (since v0.19.2 the site search retries on the gate's next turn instead of at once: on 2026-11-22, after v0.19.1, one `{query:"merenda"}` call failed the search with `network error` and fell back, while a plain curl to the same URL right after answered HTTP 200 and the next request to the home page was reset) |

Decision: `procurement_search` uses the site search when `query` is set (same host, same gate, budget, page cap,
cache and fail-closed parsing; a result is kept only when its returned object or body name contains the query, so a
withheld object never matches), and the Consulta API otherwise. The query is sent accent-stripped and lower-cased.
Owner decision (Enzo, 2026-11-22): the endpoint is undocumented and may change, so when the search fails (network
error, timeout or HTTP error after the single retry) or its format fails the strict check (`layout_changed`), the
same call falls back to the Consulta scan (same gate, same 20 s budget for the whole call, same allow-list and
masking) and `note` says the fast search was unavailable. The search request times out after 8 s
(`PNCP_SEARCH_TIMEOUT_MS`; Consulta keeps 25 s), so the scan's first page can still start within the 20 s budget.
That search failure is not remembered by the gate (the Consulta API is another service on the host); after a timeout,
5xx or changed format the search alone is not asked again for 10 minutes in the process (`SEARCH_DOWN_MS`), and calls
go straight to the scan meanwhile; a 4xx for one page or query is not remembered. Since v0.19.2 a connection error
(reset, empty reply, reset while the body is read) is retried once on the gate's next turn (6 s later), skipped when
that turn would start after the 20 s budget minus the 8 s search timeout and 1 s, and the search is remembered as down only
after two connection errors in a row, across calls; a search answer resets that count.
`next_page_source` says which pages `next_page` counts. A 429 or a refusal never falls back: the gate remembers it for the
whole host and the call returns `rate_limited` or the refusal as before.

**Curitiba municipal bodies, read from PNCP.** Every body with a buying unit in Curitiba (`codigoIbge` 4106902) and
`esferaId` `M` in the results published from 2026-10-01 to 2026-11-18 (modalities 1, 4, 6, 8, 9, 11 and 12 had results;
2, 3, 5, 7, 10 and 13–20 answered 204, no results), plus the two municipal companies PNCP lists
with `esferaId` `N`. A body that published nothing in that window is not in the list and its procurement is not
returned until the list is updated:

| CNPJ | Name in PNCP (`razaoSocial`) | `esferaId` |
|---|---|---|
| 76417005000186 | MUNICIPIO DE CURITIBA | M |
| 76417005001743 | MUNICIPIO DE CURITIBA | M |
| 77636520000110 | CAMARA MUNICIPAL DE CURITIBA | M |
| 13792329000184 | FUNDO MUNICIPAL DA SAUDE | M |
| 14682109000160 | FUNDO DE URBANIZACAO DE CURITIBA | M |
| 14814139000183 | FUNDACAO ESTATAL DE ATENCAO A SAUDE - FEAS | M |
| 03518900000113 | INSTITUTO CURITIBA DE SAÚDE - PR | M |
| 07505809000114 | INSTITUTO MUNICIPAL DE TURISMO - CURITIBA TURISMO | M |
| 75123125000108 | FUNDACAO CULTURAL DE CURITIBA | M |
| 76568930000108 | FUNDACAO DE ACAO SOCIAL FAS | M |
| 76582337000116 | INST DE PESQUISA E PLANEJ URBANO DE CURITIBA IPPUC | M |
| 76608736000109 | INSTITUTO DE PREVIDENCIA DOS SERVIDORES DO MUNICIPIO DE CURITIBA | M |
| 78802394000199 | INSTITUTO MUNICIPAL DE ADMINISTRACAO PUBLICA | M |
| 75076836000179 | URBS URBANIZACAO DE CURITIBA S/A | N |
| 76495696000136 | COMPANHIA DE HABITACAO POPULAR DE CURITIBA | N |

Not included: `81374949000153` "PROMOTOR TESTE BNC" (`esferaId` `M`, unit in Curitiba): a test body of a publishing
platform, with objects such as "teste". This is why the filter is an explicit list and not `esferaId == "M"`.

**Person names in `objetoCompra`.** In the real Curitiba sample, one inexigibilidade object names two public servants,
and objects of direct awards can name a contracted natural person (an instructor, an artist). Text cannot be told apart
from a name by a heuristic (the same lesson as the CSV header check), so the server gates by modality.
**Owner decision (2026-11-19):**

- Modalities **8 (Dispensa), 9 (Inexigibilidade), 12 (Credenciamento; added by owner decision 2026-11-21, v0.13.2,
  because an accreditation can name the accredited person), 14 (Inaplicabilidade da Licitação)** and any code not in
  the table above: `object` is `null` and `object_withheld` is `"may_name_a_person"`. Body, modality, estimated value, status,
  dates and the PNCP link are still returned; the official page is one click away.
- All other modalities: `object` is returned as published, except that CPF/CNPJ-shaped digit runs (10 or more digits,
  dots, slashes and hyphens allowed, or CPF/CNPJ groups split by spaces), e-mail addresses and phone numbers are
  replaced by `[masked]`, whitespace is collapsed, and the text is cut at 300 characters (`object_truncated: true`).
  Before masking, hyphens, dashes and minus signs (U+00AD, U+2010–U+2015, U+2212, U+FE58, U+FE63, U+FF0D) become "-",
  invisible characters (U+200B–U+200D, U+2060–U+2064, U+FEFF) are removed, underscores between digits (with any
  spaces) count as one space, and whitespace is collapsed. Number groups may be split by one or two spaces, or by a
  hyphen, slash or dot with spaces around it; a bare DDD (leading 0 allowed) may be followed by a separator and 8 or 9
  glued digits ("41 999998888", "041 33334444"); e-mails may have spaces around "@" (then only the word next to it is
  masked) and must end in a letters-only label. At most 8,000 raw characters are read, and only the first 2,000
  collapsed characters are examined; when the text is cut, the last 400 masked characters are never shown, so an
  identifier split by the cut cannot leak. These are the
  formats covered, not a guarantee.
  These objects can still, rarely, contain a person's name. The masking fails closed and also hides some public
  numbers: amounts with 10 or more digits, long process numbers, two 4-digit numbers joined by a space or hyphen
  (for example "2026-3333"), and 2 digits (or 0 plus 2 digits) followed by 8 or 9 digits. Since v0.13.2 (owner
  decision 2026-11-21) two year-like numbers joined by a space, hyphen or dot ("2025 - 2026", "2026-2027") are masked
  too, because an 8-digit phone can look like that (fails closed; it was an exemption before). "2025/2026", with a
  slash, is not phone-shaped and is kept. The official text is on the linked page.
- The `query` text matches only the object the tool returns (after masking) and the body name, never a withheld object.
- No supplier is ever returned (the endpoint has none, and the output is built field by field).

**Prior art (2026-11-19, `gh search repos "pncp mcp"`):** `mcp-dir/pncp-mcp` (MIT), `pipeworx-io/mcp-brazil-pncp`
(MIT), `marlonnotebooklm-rgb/pncp-mcp` (no licence). Generic national search servers; none applies a host allowlist,
a Curitiba body list or a person-data gate. Not adopted: the tool is about 430 lines inside this server and reuses its
HTTP client, cache and envelope.

### `weather_forecast` and `weather_alerts`: INMET forecast and warnings API

Checked live on **2026-11-19** with curl, User-Agent `curitibai-mcp/0.5`, one request per URL, before any code was
written; the built tools were then run against the live API twice each (before and after review fixes), four
requests in all.

| Field | Value |
|---|---|
| Forecast URL | `GET https://apiprevmet3.inmet.gov.br/previsao/4106902` (4106902 = Curitiba, 7-digit IBGE code). 200, `application/json`, 268,045 bytes, 2.4 s |
| Forecast format | `{"4106902": {"dd/mm/yyyy": day, ...}}`, 5 dates starting today (America/Sao_Paulo). **The first two days** are `{manha, tarde, noite}`; **the last three** are one whole-day object with the same fields. Fields per entry: `resumo`, `tempo` (empty when checked), `temp_max`, `temp_min`, `umidade_max`, `umidade_min`, `dir_vento`, `int_vento`, `dia_semana`, `nascer`, `ocaso`, temperature trends (`temp_max_tende`, `temp_min_tende`), `estacao`, `hora`, `fonte`, `uf`, `entidade`, and base64 icons (`icone`, `*_tende_icone`, about 4–21 KB each, most of the body) |
| Forecast output | Per day: `date` (ISO), `weekday` (`dia_semana`); per period (`morning`/`afternoon`/`night`, or `whole_day`): summary (`resumo`), min/max temperature, min/max humidity, wind direction and intensity, sunrise (`nascer`) and sunset (`ocaso`), values as served (a plain numeric string such as "28" or "12,5", if INMET ever sends one, is read as its number). Date keys must be real calendar dates. A whole-day entry is never split into periods. Missing or empty fields are `null`. Not returned: icons, trends, `estacao`, `hora`, `tempo`, `fonte`. An unknown day shape is `source_unavailable` |
| Warnings URL | `GET https://apiprevmet3.inmet.gov.br/avisos/ativos`. 200, `application/json`, 754,179 bytes, 3.6 s |
| Warnings format | `{hoje: [...], futuro: [...]}`, nationwide (4 + 6 warnings when checked). Each warning: `id`, `id_aviso`, `codigo` (urn:oid), `descricao`, `severidade`, `inicio`/`fim` (`"YYYY-MM-DD HH:mm"`, no time zone), `data_inicio`/`data_fim` (midnight with a `Z`, not used), `riscos` and `instrucoes` (arrays of strings, some with trailing spaces), `aviso_cor`, `icone` (base64), `poligono`, `municipios`, `microrregioes`, `mesorregioes`, `estados`, `regioes`, and **`geocodes`: one comma-separated string of IBGE codes** (up to about 31,000 characters). The largest warning was 157 KB. **The same warning (id 56460) was in both `hoje` and `futuro`** |
| Warnings output | Only warnings whose `geocodes` contain exactly `4106902` (split on commas, never a substring match). Fields: `id`, `listed_in` (`today` for `hoje`, `upcoming` for `futuro`: INMET's own lists, not recomputed from dates; both when the warning is in both), `description`, `severity`, `start`, `end`, `risks`, `instructions`, as served (a lone `riscos`/`instrucoes` string becomes a one-item list). A warning in both lists is returned once when its `id` and returned fields are identical; copies that differ in any field are all returned as served. Polygons, area lists, codes and icons are dropped while parsing; only the filtered result is cached (in memory, 10 minutes). A warning that is not an object or has missing, empty or unreadable `geocodes`, or a missing `hoje`/`futuro` list, is `source_unavailable`, never "no warning"; this applies to every warning in the national list, so one unreadable warning elsewhere also fails the call. 5 of the 10 warnings covered Curitiba when checked |
| Guards | 15 s timeout per request; size caps 1 MB (forecast) and 6 MB (warnings, about 40 warnings the size of the largest one seen), over which the tool returns `source_unavailable` with a message naming the cap; HTTP 429 is `rate_limited` with the `Retry-After` wait (no retry). One request per call, at most |
| Documentation | None found: no OpenAPI or manual for `apiprevmet3.inmet.gov.br` was found by search (2026-11-19). The paths and shapes above come from the live responses only |
| Rate limits | None documented, none seen in the response headers (session cookies only, no rate-limit headers) |
| Terms / licence | **No terms of use for this API were found.** By search only (summaries, pages not opened): INMET says its data is public and free, and gov.br pages carry "Creative Commons Atribuição-SemDerivações 3.0" (CC BY-ND 3.0). `https://portal.inmet.gov.br/` timed out (20 s, no response) when opened with curl on 2026-11-19, so no INMET terms page was read and no portal link is given in `license_note`. **Treatment (same rule as CNES):** the strictest notice found applies (attribution, no derivatives): selected fields with values unchanged, no rewording of `descricao`, `riscos`, `instrucoes` or `resumo`, and `license_note` names INMET with the source URL and the fetch time |
| Fixtures | **Synthetic**: `test/fixtures/inmet_previsao_synthetic.json` and `test/fixtures/inmet_avisos_synthetic.json` have the real JSON shape with invented values (marked in a `_synthetic` key): invented texts, polygons, areas and icons, a warning whose geocodes are near misses (`41069020`, `14106902`), and a warning listed in both lists. No real INMET response is committed |

Prior art (2026-11-19, `gh search repos "inmet mcp"`: no results; `gh search repos inmet`): R, Python and Julia
clients and scrapers for INMET station data, a Home Assistant alerts integration and a Telegram bot; no MCP server.
Built: about 300 lines inside this server, reusing its HTTP client, cache and envelope.

### `tax_reform_curitiba`: Receita Federal pilot tax-reform (CBS/IBS) open data

Checked live on **2026-11-23** with curl, User-Agent `curitibai-mcp/0.7`, 12 GET requests 6 s apart, before any code
was written (`versao`; the three rates for 2026-11-23; the NBS, NCM and cClassTrib lists; one NBS, one NCM and one
cClassTrib detail; the federal rate for 2024-01-01 and the municipal rate for 2027-01-01). The built tool was then called live twice, once per topic each time (`rates`, `nbs`, `ncm`, `class_trib`;
`nfse` makes no request): 7 requests per run (`versao`, three rates, three lists), 14 in all, through the 5 s gate.
A cold `rates` call took 19.4 s and 20.6 s.

| Field | Value |
|---|---|
| Base | `https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/calculadora/dados-abertos/`. Routes from `DadosAbertosController.java` (`@RequestMapping("calculadora/dados-abertos")`) and the README of <https://github.com/ReceitaFederal/calculadora-rtc-regime-regular> (MIT), not from third parties |
| Routes used | `versao`; `aliquota-uniao?data=`; `aliquota-uf?codigoUf=41&data=`; `aliquota-municipio?codigoMunicipio=4106902&data=`; `nbs/lista?data=`; `ncm/vigentes?data=`; `classificacoes-tributarias/cbs-ibs?data=`. Only the date (validated) and fixed codes are in the URLs |
| Answers on 2026-11-23 | `versao`: `versaoApp` `1.7.2-0d9b30c1`, `versaoDb` `V0073`, `dataVersaoDb` `2026-11-09`, `ambiente` `apr` (passed through as served, never hardcoded). Rates `{"aliquotaReferencia":0.9}` (CBS), `0.1` (IBS UF, PR), `0.0` (IBS municipal, Curitiba): percent, inferred from the values (the 2026 test-year rates). Lists: NBS 920 items (100 KB), NCM 10,516 (730 KB), cClassTrib 170 (148 KB). 1–6 s per request |
| Not found | HTTP 404, `application/problem+json`, "Alíquota não encontrada" for the federal rate on 2024-01-01 and for the municipal rate on 2027-01-01: returned as a `null` rate with a note, not as a host failure |
| Simulated data | The Receita code (`DadosAbertosService.getWarningDadosSimuladosPorData`) marks every date from 2027-01-01 as simulated (`x-warning-dados-simulados` header on the rate routes). The tool returns those values with `simulated: true` and the note "valores simulados pela Receita Federal; não são alíquotas definitivas" (owner decision, 2026-11-23: accept dates from 2027 and flag them instead of refusing); a list answer with the header is flagged the same way. Accepted dates run from 2026-01-01 to 2099-12-31; the upper bound only guards against typos such as 3026, which would send uncached requests to the shared host. Known gap: a missing rate (HTTP 404) is read without its headers, so a simulated mark on it is not seen; the year rule still applies |
| Guards | `fetchText` with the project User-Agent; 15 s timeout; caps 64 KB (versions, rates) and 2 MB (lists); redirects only to the same host and the `dados-abertos` path; JSON only; one host gate (5 s between requests, 30 s queue limit, failures remembered 60 s to 1 hour, an HTML 200 answer included; a missing rate, HTTP 404, is not a failure and is not cached); cache in memory 24 h (lists at most 3). Fail closed on anything else (see `SPEC.md` at tag v0.21.0, "v0.21.0 changes": `git show v0.21.0:SPEC.md`) |
| Terms / licence | The calculator's code repositories are MIT. **No terms of use for the hosted pilot API were found.** Values are passed on unchanged, with the source URL and fetch time in `license_note`, and every answer says "API piloto da Receita Federal; não é orientação fiscal; confirme com o contador" |
| Out of scope | The calculation `POST`, effective-rate arithmetic, any NFS-e or other invoice issuance, Imposto Seletivo data, other cities or states |
| NFS-e note | Fixed text from the owner's v0.21.0 brief, which checked `https://lp.curitiba.pr.gov.br/notanacional` (conferido em 2026-11-23): mandatory issuance on the Emissor Nacional; 01/10/2025 sociedades uniprofissionais, 01/11/2025 Simples Nacional, 01/01/2026 all others; Decreto 1960/2025 and Portaria 33/2025; public lookup `https://www.nfse.gov.br/consultapublica`. Never fetched by the server |
| Fixtures | **Synthetic**: `test/fixtures/receita/*.json`, small, invented codes and descriptions. No real response is committed |

Prior art (2026-11-23, recorded in the brief): build small; tool shape inspired by bispado/mcp-calculadora-rtc (MIT),
ideas only, no code copied.

### `places_search`: OpenStreetMap via the Overpass API

Checked on **2026-11-21** (02:42–03:35 UTC) with curl, User-Agent `curitibai-mcp/0.7`, one request at a time.
Policies were read the same day. The first pick, `overpass.private.coffee`, did not answer (table above); the owner
decided to switch, and the free public instances on the OSM wiki list were checked again.

| Instance (checked 2026-11-21) | Policy (source) | robots.txt | Result |
|---|---|---|---|
| `overpass-api.de` (FOSSGIS) | <https://wiki.openstreetmap.org/wiki/Overpass_API>: "No more than 10,000 queries per day", "download no more than 1 GB data per day", "Commercial use should use self-hosted or paid Overpass servers". Its manual (<https://dev.overpass-api.de/overpass-doc/en/preface/commons.html>) lists "Setting up an app for more than just OSM mappers and relying on the public instances as backend" as problematic use | `Disallow: /api/` | **Excluded** (robots.txt, and the manual's warning) |
| `overpass.private.coffee` = `overpass.kumi.systems` | <https://overpass.private.coffee/> (terms "last updated 10 April 2026"): "Enjoy free and unlimited access to all features without any rate limits.", "Use our endpoints in any project requiring access to OpenStreetMap data, including commercial use.", "Use a meaningful User-Agent header.", "Prefer POST requests over GET requests where possible." | 404 | Allowed, but **down**: no Overpass answer 02:44–03:20 UTC |
| `maps.mail.ru/osm/tools/overpass` (VK Maps) | Wiki: "There are currently no requests limitations and we will try to keep this approach in the future." | 301 to `https://maps.vk.com/` (an HTML page) | **Not used**: robots rules unreadable |
| `ovp.dresel.systems` | Wiki: "Free to use, no API key. Limit of 4 parallel queries per IP address (counted separately per region), queries up to 16 GB RAM. Data is updated once per night from Geofabrik daily diffs [...] Please send a User-Agent or Referer that identifies your app." Operator page <https://ovp.dresel.systems/> (German, paraphrased): no registration and no API key; 4 parallel per IP and region; batch bulk queries instead of looping; no availability guarantee; blocks on abuse; donations voluntary. Impressum <https://ovp.dresel.systems/impressum.html> (paraphrased): run privately, free of charge, no availability promise; queries limited per IP; sustained load or circumventing limits can lead to a block; no application should depend on it where an outage would cause harm (e.g. navigation or emergency apps); reusers must follow the ODbL ("© OpenStreetMap-Mitwirkende") | 404 | **Chosen** |
| `overpass.nextgis.com` (NextGIS) | Wiki: "Payment **not** required. There are currently no requests limitations." plus "Sign up [...] to get an API key". Terms <https://nextgis.com/terms> §3.4: limits may be set and changed | 404 | **Excluded**: needs an API key |

**Why `ovp.dresel.systems`, South America region (`/api-sa/interpreter`):** robots.txt allows it, it is free with no
key or account, and this use fits its rules: one query per tool call, cached 10 minutes, an identifying User-Agent,
and a lookup tool, not navigation or emergency software (the README says the data may be outdated and the service may
be down). The South America region holds Brazil: the Curitiba area resolved there (below). Its data is updated
nightly, so `osm_data_as_of` is up to about a day old.

| Field | Value |
|---|---|
| Endpoint | `POST https://ovp.dresel.systems/api-sa/interpreter`, form field `data` = the Overpass QL query |
| Rate limits | 4 parallel queries per IP and region (operator). Each server process sends at most one request per tool call and never more than one at a time (calls queue; a call that waited over 20 s gives up with `source_unavailable` without a request), and caches the mapped result for 10 minutes. Several MCP sessions on one machine each run their own process, so a few could run in parallel, still under 4; HTTP 429 (Overpass's documented rate-limit answer) is `rate_limited` with the `Retry-After` wait, no retry, and every queued call answers `rate_limited` without a request until that wait (60 s without Retry-After, at most 1 hour) is over |
| Licence and attribution | ODbL 1.0. OSMF attribution guidelines (<https://osmfoundation.org/wiki/Licence/Attribution_Guidelines>): "Attribution must be to “OpenStreetMap”.", "Attribution must also make it clear that the data is available under the Open Database License." and "The historical forms of attribution “© OpenStreetMap contributors” or “© OpenStreetMap” are acceptable." <https://www.openstreetmap.org/copyright>: "you may link to this copyright page". Every result carries `attribution: "© OpenStreetMap contributors (ODbL 1.0)"` (since v0.13.2; was "© OpenStreetMap contributors, ODbL") and a `license_note` with that text, the ODbL 1.0 URI (<https://opendatacommons.org/licenses/odbl/1-0/>), the copyright URL, the Overpass URL, the fetch time and the OSM data time |
| Freshness | `osm3s.timestamp_osm_base` of each response is returned as `osm_data_as_of` and quoted in `license_note` |
| Area | Every query starts with `area["boundary"="administrative"]["admin_level"="8"]["IBGE:GEOCODIGO"="4106902"]->.cwb;.cwb out ids;` (Curitiba's municipal boundary by its IBGE code) and filters with `(area.cwb)`. The area id is printed first: an answer without it (area not built or tag changed) is `source_unavailable`, never "nothing found" |
| Queries | `places_search`: `nwr["<key>"="<value>"](area.cwb);out center;` for one allowlisted tag (`out center` gives node coordinates and way/relation centres). It carries `[out:json][timeout:25]`. No user text enters a query: the category comes from a fixed map; `name` filters the parsed result |
| Category allowlist | park (`leisure=park`), library, school, community_centre, townhall, bus_station, marketplace (`amenity=<same>`). Left out on purpose: shops, offices, doctors, dentists, clinics, pharmacies and any category whose names can be a person's name; and **hospitals** (owner decision 2026-11-21: public health units are covered by `health_units_search`, CNES). **`police` and `fire_station`** (`amenity=<same>`) are served from a bundled list, never live (see "Police and fire stations" below) |
| Fields returned | Places: OSM type/id, `name`, category, `addr:street`, `addr:housenumber`, `addr:suburb`, `addr:postcode`, `addr:city`, lat/lon (node position or way/relation centre), `opening_hours`, `website`, else `contact:website` (http(s) without credentials only, and dropped whole when the PII guard would mask any part of the tag or of the percent-decoded link, e.g. a `wa.me/55...` link; fail-closed, so long digit runs such as some social-media ids drop a link too), OSM URL. Free text (name, street, suburb, city) passes through the PNCP masking as a guard; `opening_hours`, house number and postcode are structured and returned as tagged (the phone mask would turn "Mo-Fr 0800-1700" into "[masked]"). Phone, e-mail and every other tag are dropped |
| Guards | 25 s server timeout in the query, 30 s client timeout, 3 MB response cap (`source_unavailable` naming the cap). A response with a `remark` (Overpass stopped early: timeout or memory) is `source_unavailable`, never a short list |
| Live sample | 2026-11-21 03:26–03:33 UTC, `ovp.dresel.systems/api-sa`, one request at a time, OSM data as of `2026-11-19T21:22:20Z`. The area query returned area `3600297514` (relation 297514, Curitiba), so `IBGE:GEOCODIGO=4106902` matches. Elements and body size per category: park 1,042 (450,052 bytes, 3.2 s), school 556 (257,013 B), library 56 (24,583 B), community_centre 43 (20,207 B), marketplace 41 (13,537 B), bus_station 30 (21,721 B), townhall 5 (3,723 B; includes "Rua da Cidadania Boa Vista"). Nodes carry `lat`/`lon` and ways a `center` under `out center`. Over these 1,773 places the PII mask changed no value, and of their 225 website values the guard dropped none; one more (`www.pr.gov.br`) has no scheme and is rejected as not a link. The 3 MB cap (3,145,728 bytes) is about 7 times the largest body |
| Fixtures | Trimmed real response: `test/fixtures/osm_library_recorded.json` (all 56 libraries of the answer). Only a fixed keep-list of tags remains: the returned ones plus `amenity`, `operator` and `type`; phone, wikidata, building and the like were removed, and the one multipolygon relation keeps its `members` list. OpenStreetMap data, © OpenStreetMap contributors, ODbL (the file keeps Overpass's `osm3s.copyright` line). Edge cases use synthetic responses (`osm_*_synthetic.json`) |

**Police and fire stations (owner decision 2026-11-21).** The instance's Impressum asks that no application depend on
it where an outage would cause harm (navigation or emergency apps), so these two categories are never queried live.
Order tried:

1. Another free public instance, starting with `overpass-api.de`: rechecked 2026-11-21 03:46 UTC, its robots.txt
   still says `Disallow: /api/`, so the repository rule excludes it whatever its policy says. `overpass.private.coffee`
   (terms allow "any project", no emergency clause) still did not answer the fire-station query (45 s timeout, 03:46
   UTC). VK Maps (robots.txt unreadable) and NextGIS (API key) stay excluded. **No instance qualifies.**
2. **Chosen: a bundled list.** `src/sources/osmBundled.ts` holds the 69 `amenity=police` and 10
   `amenity=fire_station` elements of the Curitiba area, taken from the answers this check already fetched from
   `ovp.dresel.systems/api-sa` on 2026-11-21 (fire stations 03:26 UTC, police about 03:28 UTC; OSM data as of
   2026-11-19T21:22:20Z). Per element: OSM type and id, lat/lon (node position or way centre) and only the tags
   `places_search` returns. The file says, in its header, that it is OpenStreetMap data, © OpenStreetMap contributors,
   under the ODbL, and that the Apache-2.0 licence does not cover it. `amenity=police` is kept as tagged: it includes the Guarda Municipal, identification institutes, Casa da
   Mulher Brasileira and one mis-tagged office ("Sede CRMV-PR"); the list is not hand-edited. The PII mask changed
   none of the 79 entries. Results go through the same mapping and guards as
   live answers, with `fetched_at` 03:28 (police) or 03:26 (fire stations), set `bundled: true` and `checked_at: "2026-11-21"` (Curitiba date of the capture), and their `note` starts with "NOT FOR
   EMERGENCIES: in an emergency call 190 (Polícia Militar) or 193 (Corpo de Bombeiros)"; for `police` it then says the
   category is as tagged in OSM and includes Guarda Municipal, identification institutes and some non-police offices
   (0.8.1). After 180 days (Curitiba
   time) the note says the list may be outdated; refreshing it needs a code update.
3. A local OSM extract file was not considered (owner: ask first).

Prior art (2026-11-20, `gh search repos "overpass mcp"` and `"openstreetmap mcp"`): generic OSM/Overpass MCP servers
(`jagan-shanmugam/open-streetmap-mcp` MIT, `NERVsystems/osmmcp` MIT, `cyanheads/openstreetmap-mcp-server` Apache-2.0,
several small ones). Their descriptions offer general OSM or free Overpass queries for any place; they were not run
and their code was not read. Adopting one would add a second server without the fixed public-place allowlist, PII
guard and envelope this project needs. Built: one tool inside this server, reusing its
HTTP client, cache, masking and error shapes.

### `detran_pr_info`: Detran-PR licensing calendar and units (bundled data)

No network. Every value was read by hand on **2026-11-19** with curl (User-Agent `curitibai-dev-check`) and copied
into `src/sources/detran.ts`, with its source URL and that date. Design choice: the calendar is set once a year by a
portaria, so a live fetch would add a host, HTML parsing and failure modes for data that does not change; the tool
says the data may be outdated once the year in America/Sao_Paulo is past 2026.

| Fact | Source | Notes |
|---|---|---|
| Licensing due date by plate final digit (1=14/8, 2=28/8, 3=9/9, 4=18/9, 5=28/9, 6=9/10, 7=20/10, 8=30/10, 9=13/11, 0=27/11, all 2026) | [Portaria DETRAN 907/2025](https://www.legislacao.pr.gov.br/legislacao/listarAtosAno.do?action=exibir&codAto=375224) (DOE nº 12020, 31/10/2025), Anexo I (PDF attached to that page) | Art. 1º sets the calendar "para o exercício de 2026"; the Anexo I heading says "EXERCÍCIO DE 2025", an apparent typo. The [Detran-PR news page of 2026-10-23](https://www.detran.pr.gov.br/Noticia/Alerta-para-placas-com-final-8-9-e-0-calendario-do-licenciamento-de-2026-esta-perto-da) lists the same ten dates as the 2026 calendar |
| Licensing fee R$ 94,61 | Same news page: "O pagamento é no valor único de R$ 94,61" | The page also says IPVA, fines and other debts must be paid first |
| Enforcement calendar (Anexo II, "PRAZO FINAL PARA RENOVAÇÃO": "1 e 2" "Até setembro", "3,4 e 5" "Até outubro", "6,7 e 8" "Até novembro", "9 e 0" "Até dezembro") | Portaria 907/2025, Anexo II; Art. 2º applies it "para os efeitos de fiscalização da regularidade documental dos veículos" | Quoted literally in the calendar `note`, with the Portaria link, to say that `past` only means the Anexo I due date has passed. Not a field and never turned into dates ("até setembro" as a date would be interpretation) |
| 01ª CIRETRAN – Curitiba, Av. Victor Ferreira do Amaral, nº 2940, Capão da Imbuia, 0800 643 7373; PATRANs Vila Hauer, Almirante Tamandaré, Fazenda Rio Grande, Rio Branco do Sul, Colombo, with their service sentences | [detran.pr.gov.br/unidades](https://www.detran.pr.gov.br/unidades), Curitiba block; the CIRETRAN's `services` sentence from the page legend | Text copied as published (the CIRETRAN `services` text is the legend's sentence for CIRETRANs, not a line of the Curitiba block). The block also lists 11 PSTRANs (service posts run by city halls, city-hall phone numbers); they are not bundled, and `note` points to the page |
| Scheduling: "O atendimento em todas as Unidades é mediante agendamento prévio." | `/unidades` | |
| Hours | `/unidades` footer: "Atendimento presencial por agendamento: de segunda a sexta, das 8h às 16h"; [home page](https://www.detran.pr.gov.br/) footer: "… das 8h às 15h30" | **Conflict, not resolved**: both are returned with `hours.conflict: true`. No hours per unit are published. Older news (2023) gives other hours and is not used |

Output details: with no `plate_final`, all ten dates are returned earliest first; each has `past: true` once its due
date (Anexo I) has passed in America/Sao_Paulo; it only means that payment date has passed, and the calendar `note`
quotes Anexo II for enforcement. Each unit's `city` is derived from the unit name and the Curitiba block (the page
does not state it for Vila Hauer); the CIRETRAN's `services` comes from the page legend; every other unit field is
copied as published from the Curitiba block. The units `note` also says the data may be outdated once more than 180
days have passed since `checked_at` (in America/Sao_Paulo); when both this and the year warning apply, it is one
sentence.

Terms: no terms of use or licence was found on the pages read (home, `/unidades`, three `/Noticia/` pages and the
Portaria page, 2026-11-19); their only related link is a LGPD booklet on `cge.pr.gov.br`. Only public facts about public offices are used, each
with its source URL and check date. Out of scope: fees by vehicle and debts by plate (behind login and CAPTCHA) and
the Qlik statistics panel; none of them was accessed.

Prior art (2026-11-19): GitHub searches for "detran", "detran mcp" and `topic:mcp-server detran` found only plate and
fine lookups for other states or behind payment; nothing covers the Detran-PR calendar or units. Built.

### `city_services_search`: Prefeitura de Curitiba service catalog (local file, not shipped)

No network, and **no catalog content in this repository**. The Carta de Serviços belongs to the Prefeitura Municipal
de Curitiba and no terms of use or licence was found for it (not verified further), so the project neither ships nor
fetches it. The tool reads `carta-servicos.json` from `CURITIBAI_DATA_DIR`, through `src/localfs.ts` with the same
rules as `local_csv_summary` (realpath inside the folder, regular file, read-only open, no symlink out), on every call,
with a 4 MB cap. The file is validated with zod: `captured` must start with a date, `count` must match the items, each
`url` must be a service page on `servicos.curitiba.pr.gov.br` and the numeric ids must be unique. A missing variable
or file is `data_not_available`; anything malformed is `invalid_data`, with a message that names the problem, never
the file's text.

The server never contacts `www.curitiba.pr.gov.br`. `city_services_search` reads only a copy that you save yourself, by hand, in an ordinary browser session, into `CURITIBAI_DATA_DIR/carta-servicos.json`. An earlier local copy (2026-11-19/20) was deleted and is not used.
The copy is of the listing pages of <https://www.curitiba.pr.gov.br/servicos/>. The service pages' host
(`servicos.curitiba.pr.gov.br`) has robots.txt `Disallow: /`. The server contacts neither host.

**Rule for whoever provides `carta-servicos.json` (since v0.13.2):** the local copy must be saved by a person in an
ordinary browser session, reading the public listing pages as any visitor does. No script, scheduler or automated
capture of `www.curitiba.pr.gov.br` or `servicos.curitiba.pr.gov.br` is part of this project or documented here, and
none may be added. `scripts/check-no-catalog` keeps any copy out of the repository.

| Field | Value |
|---|---|
| Item shape | `{cat, title, what, url, online}`: the theme (category), the title, the listing's own "O que é?" teaser as published (the site truncates it; some are empty, and those services are found by title only), the detail-page URL and, for some, an online-service link |
| Completeness of the earlier 2026-11-19/20 copy (deleted) | 756 unique services in 18 categories, 96 of them with an empty teaser. The site suggested about 770, so **a few services may be missing** |
| `checked_at` | The first date in the file's `captured` (`YYYY-MM-DD`; when `captured` holds more than one date, the first), so the 180-day staleness warning, counted in America/Sao_Paulo, starts early rather than late. `license_note` repeats the date part of `captured` and never the rest of that text |
| Terms / licence | None found. Treated under the strictest reading: values returned unchanged (except masked text, below), attributed to "Prefeitura Municipal de Curitiba — Carta de Serviços" with the link and capture date in `license_note` |

Privacy: the catalog describes public services. Online links to the city's obituary system
(`obituarios.curitiba.pr.gov.br` or a subdomain, lists of deceased people) are never returned (matched on the parsed
host), while the catalog entry and `official_url` stay; online links that are not http(s) or carry a username or
password are dropped too. As a guard, summaries pass through the PNCP object masking (`maskObject`); a summary is
returned as published unless the mask actually hides something. On the earlier 2026-11-19/20 copy (deleted) that happens twice, both
public text (an office's institutional e-mail and a social-media handle read as an e-mail), and two services link to
the obituary system. Titles are not masked. The tests use a synthetic catalog
(`test/fixtures/carta_servicos_synthetic/`) with invented services that exercise each of these cases.

Search: `query` is split on anything that is not a letter or digit ("segunda-via" = "segunda via"), and every word
must appear in the title or the returned summary (accents and case ignored). The site's own leading "O que é?" / "O
que são?" label and text hidden by the mask are not searched. Results where every word is in the title come first,
then by title (pt-BR order), then by id. Single letters are not ignored, so "a" matches almost everything. The
categories with counts are returned only when no filter (`query`, `category`, `online_only`) is given.

Prior art (2026-11-19, `gh search repos`): "carta de serviços" found the federal gov.br service-letter model
(`servicosgovbr/cartas-de-servico`) and unrelated agency projects; "curitiba mcp", "curitiba servicos mcp" and
"prefeitura curitiba servicos" found nothing. Nothing covers Curitiba's catalog. Built.

### `bus_lines_search`, `bus_line_stops`, `bus_departures`, `bus_stops_near`, `next_buses_near`: URBS daily exports (local files, not shipped)

No network, and **no URBS file in this repository**. The source is the dataset "Transporte Coletivo de Curitiba" on
the Portal de Dados Abertos de Curitiba (publisher URBS — Urbanização de Curitiba S.A.; portal page
`/conjuntodado/detalhe?chave=ca40f13b-ef61-472b-810f-dd705f85fd2e`, used as `source_url`). Its daily exports are
mirrored at <https://dadosabertos.c3sl.ufpr.br/curitibaurbs/> as `YYYY_MM_DD_<kind>.json.xz`. That host is treated as
disallowed (table above), so the server never fetches them; a person downloads `linhas`, `pontosLinha` and
`tabelaLinha` in a browser, decompresses them with `xz -d` and keeps them in `CURITIBAI_DATA_DIR/urbs/`. Licensed
under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/deed.pt_BR), as linked from the dataset's portal page.
That page's body reads "Dados Abertos - Conteúdo licenciado sob uma Licença Creative Commons." with the by/4.0 badge
(checked 2026-11-21 with one GET). `license_note`
attributes URBS and the dataset and names the file (`bus_stops_near`, since 0.11.0, and `next_buses_near`, since 0.13.0, name every file they read).

`bus_stops_near` (0.11.0) reads the newest `pontosLinha` and the newest `linhas` (their dates may differ; `checked_at`
is the stops file's, and `note` names the lines file when its date differs) and groups the stop rows by `NUM`. On the
2026-11-20 file, 17,496 rows give 7,248 stop numbers (4,231 in more than one row, up to 26 lines at one stop); every
stop has coordinates, and exactly one stop number has rows with different names and coordinates. The tool therefore
takes a stop's name, position and type from its first row in the file with both coordinates, and lists each
(line, SENTIDO) pair once; 297 stops have the same pair in more than one row (another itinerary of the same
direction). Distance is the haversine distance of `city_points_search`. Grouping and distance run on every call;
reading and validating the 4.2 MB file is most of the time.

`next_buses_near` (0.13.0) reads the newest `tabelaLinha`, `pontosLinha` and `linhas` (dates may differ; `checked_at`
is the timetable's, and `note` names the other files when their date differs). It finds the stops within the radius
the way `bus_stops_near` does (same grouping and distance), then makes one pass over the timetable rows, keeping those
at a nearby stop under the day code and time range of the window. On the 2026-11-20 files, of the 896 (line, stop)
pairs in the timetable, 621 (51,849 rows, 73%) are at stops where the stops file lists that line in more than one
SENTIDO (terminals and tube stations), 225 in exactly one and 50 in none; so each departure carries `directions`, every
SENTIDO listed for that line at that stop, not one direction. Timetables cover few stops: within 400 m of seven points
checked (Praça Tiradentes, Rua XV, Batel, Portão, Boqueirão, Santa Felicidade, CIC), 55 of 73, 5 of 31, 2 of 14, 13 of
30, 5 of 15, 0 of 7 and 3 of 12 stops had times, hence `stops_with_times` next to `stops_considered`. The day code,
when not given, comes from today's weekday in Curitiba (America/Sao_Paulo), with the inferred reading below; holidays
are not detected. Since 0.13.1 the window follows the service day (see "Times after midnight" below): past 24:00 it
reads that day's after-midnight rows and the next calendar day's other rows before 04:00 (code inferred the same way);
starting before 04:00 with an inferred day, it reads the previous day's after-midnight rows and today's other rows.
An explicit `day` is the service day: its after-midnight rows are read, the next day's early rows are not, and
`cut_at_midnight` says so. No time is moved between codes; `windows` lists each part with `after_midnight`. Measured on the 2026-11-20 files with the built tool (Apple
M4, 15 calls, 400 m around Praça Tiradentes, 08:00 weekday, 60 min): median 73 ms, first call 134 ms; reading and
validating the three files is most of it.

`bus_route_between` (0.41.0) reads the newest `pontosLinha` and `linhas`, groups the stops as `bus_stops_near` does,
keeps the stops within `radius_m` of each point, and for each (line, ITINERARY_ID) looks for a stop near `from` with a
lower `SEQ` than a different stop near `to` ([ADR 0013](adr/0013-direct-bus-lines-between-two-points.md)). Checked on
the 2026-11-20 file on 2026-11-25: each ITINERARY_ID has one SENTIDO and one line code, no itinerary repeats a SEQ, and
40 of 695 have gaps in SEQ (order unchanged). Measured with the built tool (Apple M4, 9 calls, Rodoferroviária to
Parque Barigui, 500 m): median 31 ms.

Each tool lists the names in `urbs/` (no file is opened to choose), takes the newest valid date for its own kind,
and reads that one file through `src/localfs.ts` with the same rules as `city_services_search` (realpath inside the
folder, regular file, read-only open, no symlink out), on every call, with a 20 MB cap. Rows are validated with zod
row by row (strings of bounded length, `HH:MM` times, digit-only stop numbers and day codes, comma-decimal
coordinates or empty). Fields a tool selects or orders by are required (`COD`, `NOME`, `CATEGORIA_SERVICO` in linhas;
`NUM`, `SEQ`, `SENTIDO`, `ITINERARY_ID`, `COD` in pontosLinha; `HORA`, `DIA`, `NUM`, `COD` in tabelaLinha); the descriptive ones may be missing
or null and become "". Each descriptive field (`NOME_COR`, `SOMENTE_CARTAO` in linhas; `NOME`, `TIPO`, `GRUPO` in
pontosLinha; `PONTO`, `TABELA`, `ADAPT` in tabelaLinha) is filled in at least some rows of the 2026-11-20 files
(`GRUPO` in 2,243 of 17,496, the others in all or nearly all), so when one is empty or whitespace in every valid row of
a file, `note` says it looks missing or renamed and names the result field it feeds (for `ADAPT`, the accessibility
note of 0.8.0, unchanged; for the others, since 0.8.2). A row that fails is skipped and the count is given in `note` and in
`data.skipped_rows`. The file is `invalid_data` only
when it is not UTF-8 JSON, not a non-empty list (within a row cap), more than 5% of its rows are invalid, or over
20 MB; the message names the file and the problem (never the file's text) and says to delete the file or change its
name (for example add `.bad`) so the next newest dated one is read. Extra fields are ignored. On the 2026-11-20 files no row is skipped. Measured on the 2026-11-20 files with the built server: about 4 ms (linhas), 32 ms (pontosLinha)
and 54 ms (tabelaLinha) to read and validate.

| File (2026-11-20) | Rows | Fields | Notes |
|---|---|---|---|
| `linhas` (36 KB) | 309 | `COD`, `NOME`, `SOMENTE_CARTAO` (S/N), `CATEGORIA_SERVICO` (10 values), `NOME_COR` (7) | — |
| `pontosLinha` (4.2 MB) | 17,496 | `NOME`, `NUM`, `LAT`, `LON` (comma decimals), `SEQ`, `GRUPO` (often empty), `SENTIDO`, `TIPO` (shelter type, 14 values, a few empty), `ITINERARY_ID`, `COD` | One `ITINERARY_ID` per direction (most lines have 2, some up to 7); `SEQ` is unique within an itinerary. Four codes have stops but no `linhas` row |
| `tabelaLinha` (8.6 MB) | 71,085 | `HORA` (`HH:MM`, 00:00–23:59), `PONTO`, `DIA`, `NUM`, `TABELA`, `ADAPT` (ELEVADOR, RAMPA ELÉTRICA, RAMPA ELETRICA), `COD` | Times exist for 737 stop numbers (19 of them not in `pontosLinha`), not for every stop |

**DIA codes.** The files do not explain them, and a web search (2026-11-21) found no URBS document that does; the
portal's dataset page was not checked for it. The 2026-11-20 file has only 1, 2 and 3 (33,430, 20,750 and 16,905
rows). The reading 1 weekday, 2 Saturday, 3 Sunday or holiday is inferred from the data: 60 lines have times only
under 1, and the direct and express ones among them are reinforcement lines ("REFORÇO ...", "REF. ...") and one to
the university campus (Centro Politécnico); the 4 lines with times only under 3 run to parks or the Batel/Mossunguê
area (Pq. Lago Azul, Parque Náutico, Cabral / Pq. Tanguá, Batel / Mossunguê); row counts fall from 1 to 3; and URBS's
own timetable pages and the city's holiday notices (seen in the same search) use dia útil, sábado and domingo, with
holidays usually on the Sunday timetable. `bus_departures` therefore returns `day`
(the code, as published) and `day_type` (the inferred label, null for any other code), and its note says the label is
inferred.

**Times after midnight.** `HORA` runs from 00:00 to 23:59, none at 24:00 or later (1,186 rows of the 2026-11-20 file
are before 03:00 and 1,291 before 04:00, under all three codes); no field ties a time after midnight to the previous
evening. The file order does (checked 2026-11-21 on the 2026-11-20 file, 71,085 rows; every count in this paragraph
was measured by hand on the owner's local file of 2026-11-20, which is not in this repository): reading each table (same `COD`,
`DIA` and `TABELA`; its rows are interleaved with other tables' and move from stop to stop) in file order, times rise
through the day, and in 677 tables the sequence drops once, every time from 23:xx to 00:xx (for example a weekday
table going 23:51 then 00:03, at the next stop of the same trip). So URBS files a late-night trip under the day its
service starts, at the end of that day's table. Since 0.13.1 a row before 04:00 that comes after such a drop in its
table is an after-midnight row (`after_midnight: true` in `bus_departures` and `next_buses_near`): 993 of the 1,291
rows before 04:00 (972 of them at 00:xx). The other 298 are read as early trips of their own code's day; the file
does not say so, so this reading is not verified: 36 of them sit in 9 tables with no row at or after 04:00 (all-night
service). Since 0.13.3 only a drop from 20:00 or later to before 04:00 counts as the wrap; any other drop (12:00
then 03:00, for example) does not mark later rows. On the 2026-11-20 file every one of the 677 drops is of that kind,
so the 993 rows are unchanged. Known limit: in that file 9 rows, in 3 tables, come after the wrap at 04:00 or later;
they keep `after_midnight: false` and are read as trips of their own code's day, which the file does not confirm.
These 9 rows are a different set from the 36 rows in 9 all-night tables above. A different count, by position, agrees: 1,063 of the 1,291 rows sit in the second half of their table and
228 in the first. The drop is found over the whole file before any filter, since the row before it can be at another
stop. Times are never moved: each stays under its row's code.

Privacy: lines, stops and timetables are public transport data with no personal data. As a guard, stop names
(`NOME`, `PONTO`) pass through the PNCP object masking (`maskObject`, via `guardedSummary`); a name is returned as
published unless the mask hides something. On the 2026-11-20 files (measured before v0.13.2 widened the mask) that happens to 29 of the 6,841 distinct stop
names in `pontosLinha`, all street-number ranges ("1469-1411") read as phone numbers, and to none in `tabelaLinha`.
Line names, directions and types are not masked.

Search: `bus_lines_search` folds accents and case and requires every query word in the code or name; an exact code
comes first, then pt-BR name order. `category` is compared the same way and must be one of the file's categories.
Line codes are compared case-insensitively. Results are capped at 50 per call, with `offset` paging.

Prior art (2026-11-21, `gh search repos "urbs curitiba"`, `gh search code "pontosLinha tabelaLinha"`): one 2020 GPS
map-matching project (`lucianourgal/BusMapMatching`, no licence), nothing that reads these exports for an assistant.
The GTFS options below need a feed built from the same disallowed mirror. Built.

### `city_points_search`: URBS points-of-interest export (local file, not shipped)

No network, and **no URBS file in this repository**. Same source, mirror, folder, licence and reading rules as the bus
tools above: the newest `YYYY_MM_DD_pois.json` in `CURITIBAI_DATA_DIR/urbs/`, downloaded by a person from
<https://dadosabertos.c3sl.ufpr.br/curitibaurbs/> and decompressed with `xz -d`, read through `src/localfs.ts` with
the 20 MB cap, rows validated with zod one by one (`POI_NAME` and `POI_CATEGORY_NAME` required, `POI_LAT`/`POI_LON`
comma decimals or empty, `POI_DESC` optional, up to 10,000 characters), the same 5% rule, `skipped_rows` and fallback hint (both count every row of the file, excluded categories included). There is no missing-field note for `POI_DESC` (the 0.8.2 check), since real rows almost never fill it. `license_note`
credits URBS and the dataset "Transporte Coletivo de Curitiba" (CC BY 4.0 as linked from its portal page) and names
the file. That the portal page lists the POI export itself was not checked (the server never opens the mirror); the
file sits in the same mirror folder as the bus exports.

| File (2026-11-20) | Rows | Fields | Notes |
|---|---|---|---|
| `pois` (380 KB) | 2,536 | `POI_NAME`, `POI_CATEGORY_NAME` (45 values), `POI_LAT`, `POI_LON` (comma decimals, none empty), `POI_DESC` | `POI_DESC` is empty in 2,499 rows; the other 37 are short notes on where transit cards are sold, URBS office hours, and box numbers for urban equipment. No days or hours for feiras |

**Category allowlist.** Only these URBS categories are returned, each under a short id (counts in the 2026-11-20
file). Category names are compared with accents, case and repeated spaces ignored; nothing else is matched.

| id | URBS category (rows) |
|---|---|
| `feira` | ABAST FEIRA (115) |
| `cambio_verde` | ABAST CAMBIO VERDE (88) |
| `restaurante_popular` | ABAST RESTAURANTE POP (4) |
| `regional_office` | ADM REGIONAL (9) |
| `rua_da_cidadania` | ADM RUA DA CIDADANIA (7), RUA DA CIDADANIA - CARTÃO TRANSPORTE (1) |
| `city_office` | ADM UNID PREFEITURA (49) |
| `library` | BIB CASA DA LEITURA (14), BIB FAROL DO SABER (45) |
| `cemetery` | CEMITERIO (3) |
| `cmei` | EDUC CMEI (184) |
| `cmae` | EDUC CMAE (8) |
| `municipal_school` | EDUC ESCOLA MUNICIPAL (178) |
| `state_school` | EDUC ESCOLA ESTADUAL (158) |
| `special_education` | EDUC ESPECIAL (37) |
| `adult_education` | EDUC JOVENS E ADULTOS (8) |
| `vocational_education` | EDUC PROFISSIONAL (13) |
| `cultural_space` | ESPACO CULTURAL (116) |
| `bus_terminal` | TERMINAL DE TRANSPORTE (23), TERMINAL DE TRANSPORTE - CARTÃO TRANSPORTE (8), ESTAÇÃO TUBO - CARTÃO TRANSPORTE (1) |
| `transit_card_office` | POSTOS DE ATENDIMENTO URBS - CARTÃO TRANSPORTE (8) |
| `health_unit` | Unidade Saude Basica (50), Unidade Saude Familia (54) |
| `urgent_care` | Unidade Saude 24H (1), Unidade Saude CMUM (7) |
| `specialized_health_unit` | Unidade Saude Especializada (7), Unidade Saude Complexa (4) |
| `caps` | SAUDE CAPS (10) |
| `health_district` | SAUDE DIST SANITARIO (9) |

Total 1,219 rows. "Open to the public" is the test, not "publicly owned" (owner decision 2026-11-21: keep these three, with a warning): `cultural_space` also holds commercial cinemas
and private theatres and museums, and `special_education` and `vocational_education` hold private or non-profit
schools. They are institutions open to the public, listed by the city under its own categories, not people.

**Excluded** (1,317 rows), dropped when the file is read, before any search, distance or count: EDUC CRECHE (401),
EDUC ESCOLA PARTICULAR (179), HOTEL (152), IGREJA (108), ABAST SUPER MERCADO (174), ABAST MERCADO (49), ECON SHOPPING
(22), ESPORTE CLUBE PART (58), BANCA DE REVISTA - CARTÃO TRANSPORTE (14), SAUDE HOSPITAL (73), SAUDE LABORATORIO (1),
SEG DEFESA SOCIAL (21), SEG POLICIA CIVIL (44), SEG POLICIA MILITAR (16) (police is in `places_search`, with its
emergency note, and since v0.49 in `city_facilities_search` from IPPUC), EQUIPAMENTOS URBANOS (5), and any category not in the allowlist above, including a new or renamed
one. Reason: these are private businesses, and their names can be people's names. `note` gives the count of dropped
rows and names each category id with no row at all in the file (its URBS names look missing or renamed). It is checked
per id, not per URBS name, because three names have a single row in the 2026-11-20 file (Unidade Saude 24H, RUA DA
CIDADANIA - CARTÃO TRANSPORTE, ESTAÇÃO TUBO - CARTÃO TRANSPORTE) and could vanish without a rename. **Known gap:** a
rename of one URBS name of an id that keeps another name is not warned about, and its rows are dropped as an unknown
category; for example, renaming BIB FAROL DO SABER would drop 45 of the 59 `library` rows of the 2026-11-20 file while
`library` still has 14. To make it visible, a call with no filter returns, for each id, `source_categories` as
`{name, count}` per URBS name (matched as above), so such a rename shows as a 0 there. When any match (on any page) is
in `cultural_space`, `special_education` or `vocational_education`, `note` says that those of them among the matches
may include private or non-profit institutions.

Search: `name` folds accents and case and requires every word in the (guarded) name, so a query cannot probe masked
text. `near` keeps points within `radius_m` (great-circle distance, mean Earth radius 6,371,008.8 m; default 1,500 m,
at most 10,000 m), nearest first, with `distance_m` rounded to whole metres; a point with an empty coordinate never
matches `near`. Otherwise results are in pt-BR name order, then category id; remaining ties keep file order, so paging is stable. Results are
capped at 50 per call, with `offset`. `note` always says the file has no days or hours and that the tool is not for
emergencies (192 SAMU, 193).

Guard: names and descriptions pass through the PNCP masking and are returned as published unless it hides something
or the text is over 300 characters (then cut with "…"; the longest 2026-11-20 name is 95 characters, description 73).
On the 2026-11-20 file (measured before v0.13.2) it changes none of the 1,219 public names and none of their 18 non-empty descriptions.
Measured with the built server on that file: about 11–33 ms to read, validate and filter.

Prior art: same as the bus tools (no project reads these exports for an assistant); `places_search` covers some of the
same kinds of place from OpenStreetMap (libraries, schools, bus stations, marketplaces), as tagged there rather than
in the city's own categories. Built.

### `events_search`: Instituto Municipal de Turismo events calendar (local file written by a separate collector)

- **Source:** <https://turismo.curitiba.pr.gov.br/eventos/>, the public events calendar of the Instituto Municipal de
  Turismo de Curitiba. An ASP.NET HTML site (IIS); no feed or API was found. List pages are
  `GET /eventos/DD-MM-AAAA/N` (10 events per page, about 5 pages, from that date onwards); detail pages are
  `GET /evento/<slug>/<id>`. No licence or terms of use were found, so only facts (title, dates, time, place, address,
  category) and the event link are kept. `attribution`: "Instituto Municipal de Turismo de Curitiba (not affiliated)";
  `license_note`: "the site publishes no licence; facts and links only".
- **Structure seen on 2026-11-21** (one list page and one detail page, fetched at 05:21 UTC inside the visit window
  with User-Agent `curitibai-mcp/0.10`; neither page is in the repository). Both answered `Content-Type: text/html;
  charset=utf-8` (not ISO-8859-1 as expected); the detail description writes accents as named HTML entities.
  - List: the date filter `<input ... value="DD-MM-AAAA" id="cphMasterPortal_txtFiltroDataInicio" />`; one
    `<div class="itemEventoConteudo">` per event with day and month spans (no year), `<span class="categoria">` and
    `<h4><a id="cphMasterPortal_rptEventos_hlkEvento_N" href="/evento/<slug>/<id>">title</a></h4>`; the pager
    `<ul id="cphMasterPortal_ucPaginador_ulsPaginacao">` with page numbers.
  - Detail: spans `cphMasterPortal_lblCategoriaEvento`, `lblTitulo`, `lblDatas` (`DD/MM/AAAA`), `lblHorario` (free
    text such as "10h30.") and, when present, `lblLocal` ("place | address"). Also on the page, and never read:
    `lblDescricao` (free HTML: programme, prices, organiser notes), `lblIngresso`, `lblClassificacao`, `hlkSite` (an
    external link), the image gallery and share buttons.
- **Collector** (`scripts/fetch-events.mjs`, Node built-ins only, run by the user): its own exact host allowlist
  (`turismo.curitiba.pr.gov.br`, not in `src/config.ts` `ALLOWED_HOSTS`), https only, `redirect: "manual"` with any
  3xx treated as a stop, User-Agent `curitibai-mcp/0.10 (+https://github.com/Bossmann007/curitibai)` (v0.13.2 added the contact URL; robots.txt groups are still matched on the `curitibai-mcp` product token), never a browser's. The window (02:00–05:50 UTC, inside the
  robots.txt `Visit-time` with a 10-minute margin) and the 30-minute run deadline are checked before every request;
  15 s per request; at least 5 s from the end of one request to the start of the next, or more when a recorded
  `Crawl-delay` (seconds) or `Request-rate` asks for a longer gap. Before any request the run takes an exclusive lock
  (`events/.lock`, created with `wx`; a lock whose start time is 1 hour old or more is stale and replaced); a run that
  finds a fresh lock exits with `locked` and touches no file. robots.txt is fetched next on every run, decoded as
  Windows-1252 when no charset is declared (the site sends `text/plain` with Latin-1 comments), and the run aborts
  (`robots_changed`) unless the `*` group has exactly the recorded directives: every `key: value` line of the group
  (comments removed, keys in lower case, order ignored, repeats counted), so any added, removed or changed directive,
  `Allow`, `Crawl-delay`, `Sitemap` and unknown keys included, is a change. A group naming `curitibai-mcp` would also
  abort it. The group recorded on 2026-11-21 (`RECORDED_ROBOTS`; the file has no other group):

  ```text
  User-agent: *
  Request-rate: 1/5
  Visit-time: 0200-0600
  Disallow: /App_Browsers
  Disallow: /App_Themes
  Disallow: /bin
  Disallow: /Cache
  Disallow: /Imagem
  Disallow: /Include
  Disallow: *.mdb
  Disallow: *.pdf
  Disallow: *.dll
  Disallow: *.log
  Disallow: *.asp
  Disallow: *.config
  Disallow: *.jpg
  Disallow: *.gif
  Disallow: *.ascx
  Allow: *.aspx
  Allow: *.html
  Allow: *.htm
  Disallow: /es/contenido/*/categoria/*/conteudos/*
  ```

  Each path is
  checked against those rules with an RFC 9309 matcher (`*` wildcard, `$` anchor, longest match wins, Allow wins
  ties; `*.asp` matches any path containing `.asp`) and against two path patterns:
  `^/eventos/\d{2}-\d{2}-\d{4}/\d+$` and `^/evento/[a-z0-9-]+/\d+$`. Any non-200 status (403, 429 and 5xx included)
  stops the run without a retry. At most 10 list pages: a pager showing more stops the run (`layout_changed`) rather than
  writing a partial file. Caps: 512 KB per list page, 256 KB per detail page, 64 KB for robots.txt. The body is
  decoded with the charset from `Content-Type`, else from a `<meta>`; UTF-8 and ISO-8859-1/Windows-1252 only.
- **Dates:** the list date and the file's `list_date` are Curitiba's date (America/Sao_Paulo): a run at 02:30 UTC
  reads the list of the previous calendar day (23:30 in Curitiba). Event dates come only from the detail page's
  `lblDatas`; every valid `DD/MM/AAAA` there is read and the earliest and latest become `start_date` and `end_date`.
- **Kept fields:** `id` (numeric), `title`, `start_date`, `end_date`, `time`, `place`, `address`, `category`, `link`.
  The link is built as `https://turismo.curitiba.pr.gov.br/evento/<slug>/<id>` from the slug and id read from the
  list link and validated (`[a-z0-9-]+`, digits), never copied from an href. Text fields: HTML entities decoded,
  Unicode Cc characters turned into spaces and Cf characters (bidi controls, zero-width, tag characters) removed, NFC,
  whitespace collapsed, the existing PII mask (e-mail, phone, CPF/CNPJ shapes → `[masked]`), then cut at 120 code
  points (title, place, address) or 60 (time, category). `place` and `address` are split at the first " | " of
  `lblLocal`.
- **Detail cache** (`events/details.json`, `{format: 1, details: [{fetched_at, event}]}`): every detail page read is
  added with its read time and the file is rewritten atomically at once, so a run stopped by the deadline, the window
  or an error keeps what it read. A detail is read again when it is missing, its link changed, it is 7 days old or more,
  or the event starts from the list date to 3 days after it, but never when it was read less than 20 hours ago (so a
  second run on the same night keeps the first run's progress). A successful run prunes the cache to the ids it listed.
  `fetched_at` stays in the cache: `events.json` keeps exactly the tool's fields. A cache that is missing, over 4 MB,
  not a regular file or not in this shape is ignored (every detail is read again); invalid entries are dropped.
- **Failure rule:** the old `events.json` is kept, and the script exits 1 with a code, when a page lacks a known
  element or repeats it (`layout_changed`), a field fails validation, the run is cut short (`window_closed`,
  `deadline`, `http_error`, `redirect`, `too_large`, `timeout`, `network`), or the event count is 0 or outside 0.3x–3x
  of the previous file's (`layout_changed`). A day with no events is therefore `layout_changed` too: no empty list page
  has been seen, so it cannot be told from a page the parser no longer understands. `locked` exits 1 without writing
  `status.json`. Since v0.19.3 `window_closed` writes neither status file either, and exits 0 when both steps succeeded
  in the last 24 hours (else 1); `already_collected` (only with `CURITIBAI_COLLECT_ONCE_A_DAY=1`) exits 0 and writes
  nothing. Since v0.19.4, with the same switch, a refusal (`http_error` 401, 403 or 429, or `robots_changed`) recorded in either status file on the UTC date ends the night:
  later runs stop with `refused_tonight`, make no request, write nothing and exit as `window_closed` does; the next
  night tries again. `status.json` records `attempt`, `success` (the last successful run) and
  `code` (and `http_status` when one stopped the run). Output is limited to fixed status lines.
- **Needs a live check** (decided from one sample of each page): the text of an empty list page is unknown, so a
  count of 0 always stops the run; date ranges and multi-date events in `lblDatas`, an event without `lblHorario`, and entities in the
  kept fields have not been seen, nor has the date filter value on list pages 2 and later (the parser expects the
  run's date there too).
- **Tool** (`events_search`, no network): reads `events/events.json` through `openDataFile` and `readAllCapped` (2 MB
  cap), validates it with zod on every call (`invalid_data`: wrong shape, extra fields, a link that is not the event
  page of its own id, `count` not matching), sanitizes the text fields again, and filters by date overlap (default
  today to 7 days ahead in Curitiba), words and category. `checked_at` is the collector's run time; `stale: true` after
  3 days; `data_not_available` after 7 days or when the file is missing.

### `useful_phones`: Instituto Municipal de Turismo "Telefones Úteis" page (local file written by the same collector)

- **Source:** <https://turismo.curitiba.pr.gov.br/conteudo/telefones-uteis/92>, a public page of the Instituto
  Municipal de Turismo de Curitiba (same host as `events_search`). **No licence found**: no licence or terms of use
  were found on the site, so only facts (section, organ or company name, numbers) and the page link are kept.
  `attribution`: "Instituto Municipal de Turismo de Curitiba (not affiliated)"; `license_note`: "the site publishes no
  licence; facts and links only".
- **robots.txt:** the same `User-agent: *` group recorded for `events_search` (read 2026-11-21, unchanged on
  2026-11-22): no rule disallows `/conteudo/`, the visit window is 02:00–06:00 UTC and the rate one page per 5 s.
  The collector (`scripts/fetch-events.mjs`) reads the page once per run, after the events pages, with the same
  client: the same window, robots check, 5 s gap, deadline and User-Agent, and only after the events step ended ok or
  with `layout_changed`. After any non-200 status (403 included), a redirect, a timeout or a network error it makes
  no request in that run. The server never contacts this host.
- **Structure seen on 2026-11-22** (one page read at 02:11 UTC inside the visit window; `Content-Type: text/html;
  charset=utf-8`, 65,449 bytes, CRLF line ends, accents as named HTML entities). The content is the one
  `<div class="listaEdital">` under `<h2>Telefones Úteis</h2>`, made of `<address>`, `<p>` and `<div>` blocks with
  `<br />` line breaks and `<strong>`/`<em>` inside. Section headings are lines ending in ":" with no digits
  ("Emergências :", "Serviços :", "Transporte :", "Centrais de Radiotáxi de Curitiba:"); entries are "- Name: numbers"
  lines; "- Operadoras Pedágio:" is a parent of indented lines; one entry ("- Remoções 24h - UTI Móvel / Aérea/")
  continues on the next line; a number is sometimes split across tags ("(41)</strong><strong>&nbsp;3222-7561").
  Numbers appear as 3-digit public numbers (190, 193, 156), "(41) NNNN-NNNN", bare "NNNN-NNNN" after a "/", and
  "0800 NNNNNNN" or "0800-NNNNNN". The test fixture `test/fixtures/useful_phones/telefones_uteis_trimmed.html` is that
  page trimmed to its content column, markup and CRLF kept; nothing else of the page is in the repository.
- **Kept:** per entry `section`, `name` (an indented line gets its parent's name in front) and `numbers` as published;
  per file `source`, `checked_at`, `count` and `dropped`. Notes next to numbers ("Fax", "(demais cidades)", "(postos de
  saúde ...)"), the address line of the tourist police station and everything else on the page are not kept. The
  2026-11-22 page gives 60 entries in 4 sections; some organs appear in two sections (Aeroclube Bacacheri, DER).
- **Personal data:** every entry on the 2026-11-22 page is a public body or a company (police, emergency services,
  utilities, toll road operators, radio taxi associations), checked by hand; no person's name and no personal phone
  was found, so no entry was dropped. Guards with tests: an entry with a 9-digit mobile number, or whose name holds
  e-mail-, phone- or CPF/CNPJ-shaped text after `cleanField`, is dropped and counted in `dropped`. Names of people
  are not detected (a person's name with a landline number would be kept); the by-hand check above is what covers
  them on this page.
- **Fails closed:** an unknown tag in the block, a number in another format (digits left over), an entry before the
  first heading, fewer than 20 or more than 500 entries, or a count outside 0.3x–3x of the previous file's: status
  `layout_changed`, the previous `phones/phones.json` is kept.
- **Not covered:** the page has no Ouvidoria entry, and it was not compared with the Curitiba App's own list. Since
  0.43.0 `city_service_guide` (`ouvidoria`) answers Ouvidoria questions with the CGM's channels, not a phone (below).

### Published nightly copy of the events and phones files (since 0.18.0)

- **What runs:** `.github/workflows/collect.yml`, crons `37 2`, `17 3`, `59 3`, `37 4` and `13 5 * * *` (02:37 UTC and
  four retries since v0.19.3, all inside the Turismo site's robots.txt `Visit-time` 0200-0600; GitHub can delay or drop a
  scheduled run, and the first one, on 2026-11-23, started 8.5 h late) plus `workflow_dispatch`, on `ubuntu-latest` only (standard GitHub-hosted runner, free in
  public repositories per <https://docs.github.com/en/billing/concepts/product-billing/github-actions>), timeout 35
  minutes (above the collector's 30-minute deadline), concurrency group `data-branch` since 0.21.1, shared with `receita-version.yml` (a run never overlaps another; a queued one waits), job permission
  `contents: write` only (workflow default `contents: read`), actions pinned by full commit SHA, and only on
  `Bossmann007/curitibai` `main` (forks and other branches skip the job). No `npm ci`: the collector uses Node
  built-ins only.
- **Same collector rules:** the job runs `scripts/publish-data.sh`, which runs `scripts/fetch-events.mjs` once with
  `CURITIBAI_COLLECT_ONCE_A_DAY=1` (a run on a UTC date when both steps already succeeded makes no request, writes
  nothing and exits 0: `already_collected`; after a refusal, 401, 403, 429 or `robots_changed`, recorded that UTC
  date it makes no request: `refused_tonight`, so a refusal ends the night and the next night tries again) and otherwise the same rules (window 02:00–05:50 UTC, robots.txt group compared on every run, one request per 5 s, 15 s per request,
  no redirect, no retry, User-Agent `curitibai-mcp/0.10 (+https://github.com/Bossmann007/curitibai)`). Before the
  run it copies the previous `events/events.json`, `events/status.json` and `phones/phones.json` from the `data`
  branch into a temporary `CURITIBAI_DATA_DIR`, so the 0.3x–3x ratio check and "a failed run keeps the previous
  file" work as on a local machine. The detail cache (`events/details.json`) is not published, so every run reads
  every detail page again (about 5 minutes for 50 events).
- **What is published:** only `events/events.json`, `events/status.json`, `phones/phones.json` and
  `phones/status.json` (v0.18.1), committed by
  `github-actions[bot]` to the orphan branch `data` (never `main`; the branch is created by the first run) and pushed
  without force; the commit and push are skipped when none changed (a skipped run, or one stopped by the window, writes
  nothing).
  A typical run takes about 5 minutes; 10 list pages of 10 events would be about 112 requests, each followed by
  the 5 s gap, plus response time: about 10 to 15 minutes; the collector's own 30-minute deadline always comes before the
  35-minute job timeout, so a slow run still stops cleanly and publishes `status.json`. `useful_phones` reads
  `phones/status.json` from the same copy as the phones (local or published; a local file never makes a request) and,
  when the last phones run failed (an attempt not older than the phones), names its `code` (and HTTP status) in the
  note; a missing or invalid status file (strict schema, `code` only lower-case letters and `_`) adds nothing and never
  fails the answer; its failures are remembered for that file only (3 s timeout), except a 429 or a final refusal,
  which stay host failures so a Retry-After is kept. A failed run
  changes only the `status.json` files and the job ends
  with the collector's exit code (red in Actions). The GitHub token goes to `git` only (an HTTP header), never to the
  collector. The branch is public and holds facts and links only, from a site that publishes no licence (owner
  approval, 2026-11-22: facts and links).
- **How the server reads it:** `src/sources/publishedData.ts`. A local file in `CURITIBAI_DATA_DIR` always wins
  (errors included); only when the data folder is not set or has no such file, and `CURITIBAI_REMOTE_DATA` is not
  off (`0`, `off`, `false`, `no`), it reads
  `https://raw.githubusercontent.com/Bossmann007/curitibai/data/events/events.json` or `.../phones/phones.json`:
  fixed URLs, `src/http.ts` allowlist, same host and `/Bossmann007/curitibai/data` path only on redirects, 10 s
  timeout, 2 MB / 512 KB caps, the same strict schemas as the local file (`buildEvents`, `buildPhones`; fail closed),
  the validated result cached 1 hour, and one host gate `src/hostGate.ts` (one request per second at most; no
  request for 60 s after a host failure such as a network error, a 5xx or a 429, or for the 429's Retry-After). A
  file's own failure (404, body over the cap, a redirect, not JSON, schema) is remembered 60 s for that file only, so
  it never blocks the other file. HTTP 404 (before the first run) is `data_not_available`.
- **Freshness:** both tools return the file's `checked_at` and `stale: true` after 3 days, with a note that the
  nightly collection may have stopped; `events_search` refuses a file over 7 days old. GitHub says the `schedule`
  event "can be delayed during periods of high loads" and that "some queued jobs may be dropped", and disables scheduled workflows in public repositories after 60 days
  without repository activity
  (<https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule>,
  checked 2026-11-22); [docs/local-data.md](local-data.md#events-instituto-municipal-de-turismo-calendar-collected-by-a-separate-script) says how to re-enable it.

### Credit to the Instituto Municipal de Turismo in the published files (since 0.21.2)

- **What the files carry:** `events/events.json` and `phones/phones.json` (local and on the `data` branch) start with
  `"credit": "Fonte: Instituto Municipal de Turismo de Curitiba"` next to `source`, the page the facts were read from
  (`https://turismo.curitiba.pr.gov.br/eventos/` and `.../conteudo/telefones-uteis/92`); each event also keeps its own
  `link` to its page on the site. Written by `scripts/fetch-events.mjs` (`CREDIT`). The `data` branch gets the line at
  the next successful nightly collection; nobody pushes to it by hand.
- **Per file, not per row:** installed servers check each event and phone row for exact keys (`EventRow`, `PhoneRow`,
  `.strict()`), so a new row field would make their copy invalid; the file level is not strict, so servers before
  0.21.2 read the new files unchanged (`test/publishedData.test.ts`). The tools' answers keep their `attribution` field;
  no tool output schema changed.
- **Only facts:** title, dates, time, place, address, category and link for events; section, name and institutional
  numbers for phones. Descriptions, images, ticket and rating text are never read (`parseDetailPage`) and never written.
- **Premise (owner decision, Enzo, 2026-11-23), recorded as given:** only facts are republished, under Lei 9.610/98
  art. 8º, incisos V and VI; no licence or terms of use were found on the site (not checked again in this change);
  the Instituto was not contacted, by the owner's decision (see also
  [ADR 0001](adr/0001-facts-and-links-from-unlicensed-sources.md)). The credit line and the link to the source page are kept
  even so.

### Monthly check of the Receita Federal calculator version (since 0.21.1)

Not a tool: a scheduled check so the owner hears when the Receita Federal pilot "calculadora de tributos do consumo"
changes (owner request, 2026-11-23: monthly and automatic).

- **What runs:** `.github/workflows/receita-version.yml`, cron `23 9 1 * *` and `23 9 2 * *` (days 1 and 2 of each month, 09:23 UTC; day 2 retries a day-1 run dropped from the `data-branch` queue and changes nothing when day 1 ran) plus
  `workflow_dispatch`, `ubuntu-latest`, timeout 5 minutes, concurrency group `data-branch` (shared with `collect.yml` since 0.21.1), job permissions
  `contents: write` (push to `data`) and `issues: write` (workflow default `contents: read`), actions pinned by full
  commit SHA, only on `Bossmann007/curitibai` `main`. No `npm ci`: Node built-ins only. The job runs
  `scripts/publish-receita-version.sh`, which runs `scripts/check-receita-version.mjs` once.
- **Requests (3 per run):** one GET to
  `https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api/calculadora/dados-abertos/versao` (answer on
  2026-11-23: `versaoApp` `1.7.2-0d9b30c1`, `versaoDb` `V0073`, `dataVersaoDb` `2026-11-09`; its `/robots.txt` was 404,
  an HTML page, checked the same day with curl and User-Agent `curitibai-mcp/0.20`: no rules, RFC 9309) and one GET to
  `https://api.github.com/repos/ReceitaFederal/<repo>/releases/latest` for `calculadora-rtc-regime-regular` (then
  `1.7.2`) and `calculadora-rtc-simples-nacional` (then `1.0.2`). User-Agent
  `curitibai-mcp/0.20 (+https://github.com/Bossmann007/curitibai)`, 15 s timeout, no redirect followed, 64 KB cap (4 MB on GitHub), no
  retry, exact host allowlist. The workflow token goes to `api.github.com` only, never to the Receita host.
- **Fails closed:** a Receita error (network, timeout, non-200, redirect, not JSON) or an answer whose `versaoApp`,
  `versaoDb` (letters, digits, `._+-`, up to 64) or `dataVersaoDb` (YYYY-MM-DD) does not match exits 1 and changes
  nothing (red run in Actions). A Receita body over 64 KB (Content-Length or bytes read) is refused (4 MB for GitHub API answers). A failed release lookup
  keeps the previous tag (no false change); on the first run, with no previous tag, it exits 1 and writes nothing. A
  repository with no release (404) is recorded as `null`.
- **What is published:** only `receita/version.json` on the orphan branch `data` (never `main`; `events/` and `phones/`
  untouched), pushed without force (a push rejected because `data` moved meanwhile is redone once on the new tip): `versaoApp`, `versaoDb`, `dataVersaoDb`, `descricaoVersaoDb` (control characters
  removed, 300 characters at most), each repository's release `tag`, `url` and `published_at`, and `recorded_at`. The
  first run records the baseline and opens no issue. Nothing changed (app, base, base date and release tags compared):
  no write, no commit, no issue.
- **When something changed:** one issue in this repository titled
  `Receita: calculadora mudou (app <a>, base <b> (<date>), regular <r>, simples <s> → ...)`, listing what changed, the
  release links and a reminder to review `tax_reform_curitiba` (the Receita marks 2027+ rates as simulated). No issue
  when an open issue already has the same title (up to 1,000 open issues read; more fails the run). The issue is opened before the file is written, so a failed issue (exit 1) is retried
  the next run. The MCP server never reads this file.
- **Turn it off:** see [docs/development.md](development.md#scheduled-workflows).

### `vaccination_sites_search`: Prefeitura "Imuniza Já" vaccination sites page

- **Source:** <https://imunizaja.curitiba.pr.gov.br/locaisvacinacao/>, the Secretaria Municipal da Saúde's public list
  of vaccination sites ("Imuniza Já", Prefeitura de Curitiba). ASP.NET HTML page; the owner found no feed, API or dataset with hours
  (not searched again here). No personal data: units, addresses, hours and vaccine groups only.
- **Checked live on 2026-11-21** at 15:50 UTC (curl) and 15:53 UTC (Node.js `fetch`, User-Agent `curitibai-mcp/0.7`,
  the server's own client): 200, `text/html; charset=utf-8`, 299,365 bytes (curl, `Content-Length`), 0.25 s (Node.js
  `fetch`), an `ASP.NET_SessionId` cookie (never
  sent back), no rate-limit headers. The page is **not** in this repository; the parser was run on a local copy outside
  it: 101 units, 10 regionals, 0 skipped, 0 masked fields, coordinates for all 101. One live call of the built tool
  followed at 15:58 UTC (101 sites). Requests to the host on 2026-11-21: robots.txt twice and the page three times. The
  UFPR robots check was three requests (root, `/curitiba/`, `/curitibaurbs/`) within about a second.
- **Structure** (ids of an ASP.NET repeater): per regional `<span id="ContentPlaceHolder1_rptRegionais_lblRegional_R">`
  ("Regional Bairro Novo"); per unit `..._rptUnidades_R_lblUnidadeNome_U` (name), `..._lblUnidadeEndereco_U` (street,
  number and neighbourhood in one string, no separator), a schedule block `..._rptHorarios_U_lblEstrategia_K` followed by
  its sibling `..._lblHorario_K` (empty in all 101), and `<a href="https://maps.google.com/?q=LAT,LON"
  id="..._lblVerNoMapa_U">`. Inside the schedule block, normal-weight spans form hours lines ("Horário (segunda a sexta)
  : Das 7h às 19h"; 93 units 7h–19h, 6 units 7h–17h, one 8h–17h, one 7h–22h) and bold spans form vaccine lines
  ("Vacinas (Zero a 11 anos)", "Vacinas (12 anos ou mais)", "Covid-19 (6 meses a 4 anos)", "Covid (12 anos ou mais)"),
  separated by `<br/>`. The page shows **no update date**. Its header asks people to arrive at least 15 minutes before
  the unit closes. A `<select>` filters by regional on the page itself; the tool filters locally instead.
- **Extraction:** by those ids only, never the whole page text. Regional, name, address and each hours or vaccine
  line go through `cleanField` (control characters to spaces, format characters such as bidi and zero-width removed,
  NFC, PII masking as for events, length caps 60/120/160/100). The prefix "Regional " is dropped from the regional.
  A non-empty `lblHorario` is added as one more hours line. Coordinates are read only when the map link matches
  `https://maps.google.com/?q=<lat>,<lon>` exactly and falls inside a box around Curitiba (lat −25.7 to −25.3, lon
  −49.45 to −49.15); otherwise they are null. **No link from the page is returned**; `source_url` is the page URL. Units
  are counted by their name-span id, whatever the span holds. A unit without a name, regional or hours line (after
  cleaning), with a name or address span that does not match or holds a tag (also as `&lt;`), with a schedule block that does not match the known shape, or with
  a block holding anything other than those spans, is skipped and counted (`skipped_units`); no unit, or more than 5%
  skipped, is `source_unavailable`.
- **Guards:** host in `ALLOWED_HOSTS` exactly, https only, redirects to any other host refused (`sameHostOnly`), and same-host redirects only to `/locaisvacinacao` or a path
  below it, case ignored, no encoded slash or backslash (`redirectPathPrefix`), one
  GET per call at most, the parsed result cached in memory for 6 hours; after a failure no new request for 60 s (after
  a 429, the `Retry-After` wait when longer, at most 1 hour), the same error is returned instead; 1 MB cap, 15 s timeout, `text/html` required,
  HTTP 429 is `rate_limited` with the `Retry-After` wait, same User-Agent as the other tools.
- **Terms / licence:** none found on the page or the site; the page metadata says `copyright: Prefeitura de Curitiba`.
  Only facts are returned, with `attribution` "Prefeitura Municipal de Curitiba, Secretaria Municipal da Saúde,
  "Imuniza Já" (not affiliated)" and the page link.
- **Fixture:** `test/fixtures/imunizaja_locais_synthetic.html` is **synthetic** (invented units, addresses and
  coordinates in the real structure), with planted cases: a phone in a name, bidi and zero-width characters, an
  instruction-like vaccine line, a `javascript:` map link, a map link outside Curitiba, a map link on another host,
  text and a link outside the known structure.
- **Prior art** (2026-11-21, `gh search repos imunizaja` and `"vacinacao curitiba"`): one repository without a
  description (`Arthurrfreire/imunizaja-vacinas`, not opened); the search found no MCP server or API client. Built inside this server, reusing its
  HTTP client, cache, masking and paging.

### `city_facilities_search`: IPPUC GeoCuritiba urban equipment, parks and bike lanes

- **Source:** IPPUC (Instituto de Pesquisa e Planejamento Urbano de Curitiba), GeoCuritiba ArcGIS REST
  services (`currentVersion` 11.5), anonymous GET, `f=json`:
  - <https://geocuritiba.ippuc.org.br/server/rest/services/Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer>:
    169 layers (point feature layers in thematic groups), capabilities `Query,Map,Data`, `maxRecordCount` 2,000,
    native spatial reference SIRGAS 2000 / UTM 22S (EPSG 31982). Every point layer has the same fields: `objectid`,
    `cd_equi`, `tema`, `equipament`, `tipo_equi`, `dep_admin`, `nome_completo`, `nome`, `nome_mapa`, `nome_rua`,
    `num_pred`, `compl_end`, `divulgar_endereco`, `indfiscal`, `cd_bairro`, `bairro`, `regional`, `nm_distrito`,
    `func_manha`, `func_tarde`, `func_noite`, `func_24hr`, `telefone`, `ramal`, `email`, `site`, `dt_inauguracao`,
    `dt_atualiz` (epoch ms), `observacao` (days, hours and notes, lines split by CRLF), `fonte`, `ds_mantenedora`,
    `coord_e`, `coord_n`, `lat_sirgas`, `lon_sirgas`, `globalid` (among others).
  - <https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/CICLOVIA_dashboard/FeatureServer>: layer 0
    "ESTRUTURA CICLOVIÁRIA" (polylines: `nome`, `ctba_tipo_ciclovia`, `ctba_localizacao`, `ctba_bairro`,
    `ctba_regional`, `lenght_km` [sic], `operacional`, `situacaofisica`, ...), layer 1 "PARQUES E BOSQUES" (polygons:
    `nome`, `areaoficial`, `ctba_tipounidprotinteg_smuc`, `ctba_bairro`, `ctba_regional`, ..., plus `created_user` and
    `last_edited_user`, never read), layer 2 "BAIRRO". Neighbourhood, regional and kind are coded values; the codes
    and names are copied into `src/sources/geocuritiba.ts` as published on 2026-11-21, except three neighbourhood
    names written as the urban-equipment layers write them in `bairro` (checked in the Academia ao Ar Livre layer:
    "Prado velho" → "Prado Velho", "Barrerinha" → "Barreirinha", "Sitio Cercado" → "Sítio Cercado"), so one `bairro`
    filter matches both services. An unknown code is `null`.
- **Layers used** (id: name, record count on 2026-11-21): MapServer 2 Mercado Municipal (4), 3 Armazém da Família (33),
  4 Sacolão da Família (13), 5 Câmbio Verde (103), 6 Restaurante Popular (6), 8 Feira (80), 14 Rua da Cidadania (10),
  28 Sanitário Público (37), 34 CRAS (39), 54 Museu (38), 55 Teatro (37), 63 Farol do Saber (43), 64 Biblioteca Geral
  (13), 68 Conselho Tutelar (10), 85 Clube da Gente (5), 86 Centro de Esporte e Lazer (25), 91 Academia ao Ar Livre
  (286), 92 Pista de Skate (37), 114 Cemitério Municipal (5), 116 Ecoponto (12), 117 Ecocidadão (40), 156 Posto de
  Atendimento URBS (11), 162 Posto de Informações Turísticas (3), 163 Feira Turística (27); since v0.20, from the
  Cultura group (counts on 2026-11-23): 50 Centro Cultural (24), 51 Espaço Expositivo de Artes (16), 53 Memorial (11),
  56 Cinema (19), 59 Espaço para Espetáculos ao Ar Livre (4), 62 Gibiteca (1); FeatureServer 0 Estrutura
  Cicloviária (838, all `operacional` 1 and `situacaofisica` 5 "Construída") and 1 Parques e Bosques (53). The
  largest answer was about 250 KB (layer 0 with simplified geometry). Layers left out on purpose: health units (see
  `health_units_search`; layer 134 added in v0.44.0, layers 130, 129 and 131 in v0.45.0, layers 135, 132 and 133 in v0.46.0 and layers 167, 136 and 112 in v0.47.0, below), schools (but the layers 80, 78, 81 and 79, added in v0.53.0, below), bus terminals, police (but the Guarda Municipal layers 139 and 138, added in v0.48.0, and the police layers 143, 146, 147 and 145, added in v0.49.0, and the Instituto de Identificação layer 168, added in v0.50.0, and the registro civil, Junta Militar, Defensoria and Fórum layers 99, 21, 105 and 106, added in v0.51.0, and the social assistance layers 38, 40, 39, 36, 108 and 109, added in v0.52.0, below; the shelter and transit-house layers 45, 46 and 164 are never types, their addresses being sensitive), administrative offices and every other layer not in the
  list (not surveyed).
- **Added in v0.24.0** (checked 2026-11-23, one request every 5 s at most):
  - Sport and leisure, MapServer group 83 "Esporte e Lazer": 84 Núcleo Regional do Esporte, Lazer e Juventude (10),
    87 Centro de Atividade Física (2), 88 Centro da Juventude (2), 89 Centro de Iniciação ao Esporte (2), 90 Centro de
    Referência em Esporte e Atividade Física (2), 93 Pista de Ciclismo BMX (1), 94 Centro de Lutas (1), 165 Pista de
    Patinação (1), 166 Velódromo (1); every record `divulgar_endereco` "Sim", `dt_atualiz` 2024-01-04 to 2025-11-18,
    institutional phones and curitiba.pr.gov.br e-mails (one malformed, `@.curitiba.pr.gov.br`, dropped by the
    allowlist). The SMELJ service the roadmap named
    (`GeoCuritiba/Publico_GeoCuritiba_Equipamentos_Urbanos_SMELJ/MapServer`, one point layer of 372 records) holds the
    same records by `tipo_equi` but has **no `divulgar_endereco`**, so the per-type layers above are read instead.
  - Conservation units, <https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_Sistema_Municipal_de_Unidades_de_Conservacao/FeatureServer>
    (Sistema Municipal de Unidades de Conservação, Lei Municipal 15.744/2020 and 15.977/2022; polygons, same coded
    fields as Parques e Bosques, `returnCentroid` works with `outSR=4326`): 1 Estação Ecológica (2), 5 Bosque de
    Conservação da Biodiversidade Urbana (8), 6 Refúgio da Vida Silvestre (1). **No update date is published** (no
    date field, `editingInfo` null): `updated` is null and `note` says so. Left out: 2 Parque Natural Municipal (32),
    3 Parque Linear (1), 4 Bosque Municipal (18) and 8 Específicas (2), the exact content of Parques e Bosques
    (`parque`, 53 records); **7 RPPNM (67) as personal data**: 65 are private property (`administracao` 6
    "Privada"), many are named after people (owners or relatives) and `ctba_localizacao` is the street address of the
    private lot; 10 Área de Proteção Ambiental (2) and 11 Área de Relevante Interesse Ecológico (1), which lack the
    bairro, regional and kind fields and cover areas whose centroid gives no useful distance.
  - Credit "Fonte: IPPUC/GeoCuritiba (SMELJ / SMMA)" in `source` for these types only; the other types keep
    "IPPUC / GeoCuritiba".
- **Added in v0.44.0** (type `unidade de saude`): MapServer layer 134 "Unidade de Saúde", the Secretaria Municipal da
  Saúde's municipal health units. Checked on 2026-11-25 with curl and User-Agent
  `curitibai-mcp/0.44 (+https://github.com/Bossmann007/curitibai)`, three requests at least 5 s apart: `/robots.txt`
  at 22:19:03 UTC (404, IIS HTML page: no rules, RFC 9309), the layer's metadata (`134?f=json`) at 22:19:10 UTC
  (feature layer "Unidade de Saúde", `maxRecordCount` 2,000, the same fields as the other point layers;
  `copyrightText` and `description` empty, so **no licence found**: facts only, IPPUC cited, as for the other
  GeoCuritiba layers) and one whole-layer read with the server's fixed query at 22:19:24 UTC (68,823 bytes). 109
  records, all `divulgar_endereco` "Sim", `dt_atualiz` in 2026 (102) or 2025 (7); every `observacao` starts with
  "Atendimento:" and one line of days and hours, all Monday to Friday ("-2ª a 6ª feira, das 7h às 19h" 101 times,
  "das 7h às 17h" 6, "das 8h às 17h" 1, "das 7h às 22h" 1), then notes such as "Unidade equipada com Clínica
  Odontológica."; no Saturday hours are published. `telefone` is a landline for 103 units; 6 publish only a mobile
  number, dropped by the phone allowlist. `email` is `ouvidoria@sms.curitiba.pr.gov.br` for all 109 (kept: a
  curitiba.pr.gov.br subdomain; the `note` says it is the SMS Ouvidoria's, not the unit's own). Unit names are place names, some honouring a person as public homage (e.g. a law
  named in `observacao`); no staff or patient data is in the fields read. The read was parsed offline by the server's
  own parser (0 records skipped) and not kept; the test fixture is synthetic. Hours are returned as published text,
  never parsed into a promise: the type's `note` says a day not listed is not published as open, which is not a
  promise that the unit is closed or open, to check before going by the unit's phone or the 156, and that
  emergencies go to 192 (SAMU) or a UPA. UPAs and hospitals are not in this layer (not read). No new
  host: `geocuritiba.ippuc.org.br` was already contacted, through the same host gate. Since v0.45.0 the note names
  the `upa` and `hospital publico` types and says 192 (SAMU) or 193.
- **Added in v0.45.0** (types `upa`, `hospital publico`, `estabilizacao psiquiatrica`): MapServer layers 130 "Unidade
  de Pronto Atendimento", 129 "Hospital (público)" and 131 "Unidade de Estabilização Psiquiátrica". Checked on
  2026-11-25 with curl and User-Agent `curitibai-mcp/0.45 (+https://github.com/Bossmann007/curitibai)`, seven GET
  requests at least 6 s apart: `/robots.txt` at 22:34:17 UTC (404, IIS HTML page: no rules, RFC 9309), then for each
  layer its metadata (`<layer>?f=json`) and one whole-layer read with the server's fixed query: 130 at 22:34:24 and
  22:34:30 (7,704 bytes), 129 at 22:34:37 and 22:34:44 (7,678 bytes), 131 at 22:34:50 and 22:34:56 UTC (2,521 bytes).
  Each metadata answer: a feature layer, `maxRecordCount` 2,000, the same fields as the other point layers,
  `copyrightText` and `description` empty, so **no licence found** (facts only, IPPUC cited, as for the other
  GeoCuritiba layers). The reads were parsed offline by the server's own parser (0 records skipped in each) and not
  kept; the test fixtures are synthetic.
  - 130: 9 UPAs (Tatuquara, CIC, Pinheirinho, Fazendinha / Albert Sabin, Boqueirão, Sítio Cercado, Campo Comprido,
    Boa Vista, Cajuru), all `divulgar_endereco` "Sim", `func_24hr` "Sim" (the other period flags "Não"), `dt_atualiz`
    2026-04-15, `observacao` "Atendimento de urgência e emergência médica: -Diariamente, 24 horas", three with dental
    urgency hours that are not 24 hours (e.g. "2ª a 6ª feira, das 19h às 23h"). Landlines for all 9; one second
    number written "3357-2823 (Raio X)" is dropped by the phone allowlist (a part not understood). `email`
    `ouvidoria@sms.curitiba.pr.gov.br` for all 9. The UPA Boqueirão is in the bairro Boqueirão; some others are not
    in the bairro of their name (UPA Pinheirinho is in Capão Raso).
  - 129: 10 public hospitals (municipal, state, federal and military, e.g. Hospital do Idoso Zilda Arns, Hospital do
    Trabalhador, Hospital de Clínicas da UFPR, Hospital Geral de Curitiba, Hospital da Polícia Militar, Hospital
    Cindacta), all `divulgar_endereco` "Sim". The flags and hours are **uneven**: 6 have `func_24hr` "Sim", 4 "Não";
    4 have no `observacao`, and some have every flag "Sim" or every flag "Não" whatever their text; `dt_atualiz` from
    2016-07-05 (two records) to 2026-04-15. So the type's `note` says `all_day` false or no hours does not mean closed
    or not open 24 hours, that being listed does not mean walk-in care, and to check `updated` and call the hospital.
    Landlines for all 10; 6 e-mails outside curitiba.pr.gov.br (state, university, army) are dropped by the e-mail
    allowlist, 2 kept, 2 records have none.
  - 131: 1 unit (Casa Irmã Dulce, Tatuquara), `func_24hr` "Sim", "Diariamente, 24 horas", landline, SMS Ouvidoria
    e-mail, `dt_atualiz` 2026-04-15.
  - Every note of these three types starts with "Emergency: call 192 (SAMU) or 193 (Bombeiros). This tool lists
    places, it does not triage or say where to go." The bare `hospital` is not a type: the layer lists public
    hospitals only. Names are places or public homage (e.g. Zilda Arns, Irmã Dulce); no staff or patient data is in
    the fields read; the hospital visiting-hours text names no one. No new host: `geocuritiba.ippuc.org.br` was
    already contacted, through the same host gate. Since v0.46.0 the `estabilizacao psiquiatrica` note adds, after
    that sentence, "Emotional support: CVV 188 (24 hours, free call)." (number read on cvv.org.br, host table above).
- **Added in v0.46.0** (types `caps`, `centro de especialidades medicas`, `centro de especialidades odontologicas`):
  MapServer layers 135 "Centro de Atenção Psicossocial", 132 "Centro de Especialidades Médicas" and 133 "Centro de
  Especialidades Odontológicas". Checked on 2026-11-25 with curl and User-Agent `curitibai-mcp/0.46
  (+https://github.com/Bossmann007/curitibai)`, seven GET requests at least 6 s apart: `/robots.txt` at 22:50:20 UTC
  (404, `text/html; charset=utf-8`: no rules, RFC 9309), then for each layer its metadata (`<layer>?f=json`) and one
  whole-layer read with the server's fixed query: 135 at 22:50:26 and 22:50:33 (10,371 bytes), 132 at 22:50:40 and
  22:50:47 (8,671 bytes), 133 at 22:50:54 and 22:51:00 UTC (3,589 bytes). Each metadata answer: a feature layer,
  `maxRecordCount` 2,000, `copyrightText` and `description` empty, so **no licence found** (facts only, IPPUC cited,
  as for the other GeoCuritiba layers). The reads were parsed offline by the server's own parser (0 records skipped in
  each; every record keeps at least one landline) and not kept; the test fixtures are synthetic.
  - 135: 13 CAPS (Territorial and Infantil), all `divulgar_endereco` "Sim", `dt_atualiz` 2026-04-15 or 2026-05-04,
    `observacao` such as "Atendimento CAPS Tipo III: -Diariamente, 24 horas" (9 records, `func_24hr` "Sim") or "-2ª a
    6ª feira, das 7h às 19h" / "-Diariamente, das 7h às 19h" (4 records, morning and afternoon flags); three say which
    regionais they serve ("Atende as Regionais ..."), some give a former address or name. Most phones are a landline
    followed by mobiles; the mobiles are dropped by the phone allowlist. `email` `ouvidoria@sms.curitiba.pr.gov.br`
    for all 13. The bairro is often not the one in the name (CAPS Matriz is in Jardim Social; none is in Centro: the
    two nearest to the centre, about 2.6 and 2.9 km from the point -25.4296, -49.2713, are within the eval's 3,000 m radius). The
    note leads with the emergency sentence and CVV 188, says a CAPS listed is not always the one that serves you (ask
    a CAPS Infantil which ages it takes; some list their regionais in `hours`) and to ask the health unit or call the CAPS.
  - 132: 10 records, municipal (Centros de Especialidades Médicas Salgado Filho, Santa Felicidade and Vila Hauer,
    Ambulatório Encantar, Centro de Orientação e Aconselhamento) and state or other (e.g. Centro Psiquiátrico
    Metropolitano, CRAID, Ambulatório Médico de Especialidades Hospital do Trabalhador), all Monday to Friday,
    `dt_atualiz` from 2022-01-19 (three records) to 2026-06-10; some list their specialties. State e-mails
    (`sesa.pr.gov.br`, `pr.gov.br`) are dropped by the e-mail allowlist. No record says how a patient is referred,
    so the note does not say a referral is required: it says being listed does not mean walk-in care, to check with
    the health unit whether a referral is needed, to call before going, and that mental health is type `caps`.
  - 133: 2 municipal dental specialty centres (Sylvio Gevaerd, Portão; Professor Léo Kriger, São Francisco), Monday
    to Friday, landline, SMS Ouvidoria e-mail. One record's `observacao` says "O encaminhamento ao Centro de
    Especialidades Odontológicas se dá por meio das Unidades de Saúde.", so the note says, as the layer publishes,
    that referral is through the health units. Both specialty notes also say not for emergencies, 192 or 193.
  - The bare `centro de especialidades` is not a type (medical or dental), and there is no `caps infantil` or `caps
    ad` alias (no such filter). Names are places, programmes or public homage; no staff or patient data is in the
    fields read. No new host: `geocuritiba.ippuc.org.br` was already contacted, through the same host gate.
- **Added in v0.47.0** (types `vigilancia sanitaria`, `zoonoses`, `hospital veterinario`): MapServer layers 167
  "Vigilância Sanitária", 136 "Centro de Controle de Zoonoses e Vetores" and 112 "Hospital Veterinário Municipal".
  Checked on 2026-11-25 with curl and User-Agent `curitibai-mcp/0.47 (+https://github.com/Bossmann007/curitibai)`,
  ten GET requests at least 6 s apart: `/robots.txt` at 23:06:03 UTC (404, `text/html; charset=utf-8`: no rules, RFC
  9309); three whole-layer reads on a wrong path (`/server/rest/services/GeoCuritiba/Publico_GeoCuritiba_...`, with
  `outFields=*`) at 23:06:10, 23:06:16 and 23:06:23 UTC, each answered with the ArcGIS error 404 "Service not found"
  and no data; one whole-layer read per layer with the server's fixed query, 167 at 23:06:44 (7,838 bytes), 136 at
  23:06:51 (2,692 bytes) and 112 at 23:06:58 UTC (2,451 bytes); then each layer's metadata (`<layer>?f=json`) at
  23:07:36, 23:07:42 and 23:07:49 UTC. Each metadata answer: a feature layer, `maxRecordCount` 2,000, `copyrightText`
  and `description` empty, so **no licence found** (facts only, IPPUC cited, as for the other GeoCuritiba layers). The
  reads were parsed offline by the server's own parser (0 records skipped in each) and not kept; the test fixtures
  are synthetic.
  - 167: 10 Vigilância Sanitária offices of the Secretaria Municipal da Saúde, one per regional (several inside a Rua
    da Cidadania), all `divulgar_endereco` "Sim", "Atendimento: -2ª a 6ª feira, das 8h às 18h", morning and afternoon
    flags, `dt_atualiz` from 2025-08-28 to 2026-04-15. Phones are landlines, some two or three per office ("(41)
    3212-1877 / 3212-5651": both kept); e-mails `visa.<office>@sms.curitiba.pr.gov.br` (kept by the e-mail
    allowlist). One record's `observacao` gives a "Protocolo" phone, which the text mask turns into "[masked]" as for
    every phone inside `hours`. The layer says nothing about what the offices do, so the note says only that hours are
    as published and to call the office or the 156 before going (no office count, which can change).
  - 136: 1 record, the Centro de Controle de Zoonoses e Vetores de Curitiba (Cidade Industrial de Curitiba),
    "-Diariamente, das 8h às 12h e das 13h às 17h", "Nos finais de semana e feriados o atendimento é em regime de
    plantão.", "Também funciona o Centro de Referência para Animais em Situação de Risco.", landline,
    `ccz@sms.curitiba.pr.gov.br`, `dt_atualiz` 2025-10-22. Those lines come back in `hours` as published; the note
    does not restate them (it would go stale if the record changed).
  - 112: 1 record, the Hospital Veterinário Municipal (Parque Municipal São Francisco de Assis, Taboão), with the
    address only: `telefone`, `email` and `observacao` null and all four period flags "Não", `dt_atualiz` 2024-12-18.
    No readable official source says how the hospital works or who it serves: the Prefeitura's pages are on
    `www.curitiba.pr.gov.br` and `servicos.curitiba.pr.gov.br`, which this project never contacts (host table
    above), so none was read. The note says that, when read on 2026-11-25, the layer published the address only (no
    hours, phone, services or who it serves), that empty `hours` or `phones` and all-false `open_periods` mean not
    published, not closed, that the tool cannot say who the hospital serves or what it costs, and to ask the 156
    before going. It promises no free care.
  - No bare `vigilancia`, `veterinario`, `animal` or `pet` alias (they would promise more than these layers). Names
    are places and public homage; no staff or personal data is in the fields read. No new host:
    `geocuritiba.ippuc.org.br` was already contacted, through the same host gate. The link allowlist is unchanged.
- **Added in v0.48.0** (types `modulo da guarda`, `nucleo da guarda`): MapServer layers 139 "Módulo da Guarda
  Municipal" and 138 "Núcleo Regional da Guarda Municipal". Checked on 2026-11-25 with curl and User-Agent
  `curitibai-mcp/0.48 (+https://github.com/Bossmann007/curitibai)`, five GET requests at least 6 s apart: `/robots.txt`
  at 23:22:01 UTC (404, `text/html; charset=utf-8`: no rules, RFC 9309); one whole-layer read per layer with the
  server's fixed query, 139 at 23:22:08 (27,046 bytes) and 138 at 23:22:15 UTC (10,181 bytes); then each layer's
  metadata (`<layer>?f=json`) at 23:22:21 and 23:22:27 UTC. Each metadata answer: a feature layer, `maxRecordCount`
  2,000, `copyrightText` and `description` empty, so **no licence found** (facts only, IPPUC cited, as for the other
  GeoCuritiba layers). The reads were parsed offline by the server's own parser (0 records skipped in each; no
  "[masked]" in any `hours`) and not kept; the test fixtures are synthetic.
  - 139: 40 Guarda Municipal modules (parks, Ruas da Cidadania, squares; "Módulo da Guarda Municipal Parque Tanguá" in
    Taboão among them), all `divulgar_endereco` "Sim", `dt_atualiz` 2026-04-13 or 2026-10-16. Every `observacao`
    starts with "Emergência, ligue 153." (spelling varies); most then say "Diariamente, 24 horas" with only the
    24-hour flag "Sim", two give daytime hours and one gives none. `telefone` is a landline or "153" (11 records;
    kept as a three-digit public number); e-mails `nrgm<regional>@curitiba.pr.gov.br` or `goe@curitiba.pr.gov.br`.
    One module's name honours a guard ("Guarda Municipal Israel Aquino Pimentel"), a public homage kept as published.
  - 138: 10 regional núcleos, one per regional, each named "Núcleo Regional da Defesa Social …" in `nome_completo`
    (hence the aliases `nucleo regional da defesa social` and `nucleos regionais da defesa social`), `dt_atualiz`
    2026-04-09 or 2026-04-13: "Atendimento operacional: -Diariamente, 24 horas", "Atendimento administrativo: -2ª a
    6ª feira, das 8h às 18h", "Emergência, ligue 153." and "Bairros de abrangência: …" (at most 7 lines), landlines and
    `nrgm…@curitiba.pr.gov.br` e-mails. One record also gives its previous address, kept in `hours` as published.
  - Emergency numbers: 153 is in both layers' text. 153 (Guarda Municipal) and 190 (Polícia Militar) are both in the
    "Emergências" section of the Instituto Municipal de Turismo's "Telefones Úteis" page as read on 2026-11-22 for
    `useful_phones` (trimmed copy: `test/fixtures/useful_phones/telefones_uteis_trimmed.html`); that page was not read
    again. Every note for these types starts "Emergency: call 153 (Guarda Municipal) or 190 (Polícia Militar). This
    tool lists places, it does not dispatch help."
  - No bare `guarda`, `guarda municipal` (module or núcleo), `seguranca`, `policia`, `modulo` or `nucleo` alias. No
    staff or personal data is in the fields read. No new host: `geocuritiba.ippuc.org.br` was already contacted,
    through the same host gate. The link allowlist is unchanged.
- **Added in v0.49.0** (types `delegacia`, `policia federal`, `policia rodoviaria federal`, `policia cientifica`):
  MapServer layers 143 "Polícia Civil", 146 "Polícia Federal", 147 "Polícia Rodoviária Federal" and 145 "Polícia
  Científica". Checked on 2026-11-25 with curl and User-Agent `curitibai-mcp/0.49
  (+https://github.com/Bossmann007/curitibai)`, nine GET requests at least 6 s apart: `/robots.txt` at 23:38:47 UTC
  (404, `text/html; charset=utf-8`: no rules, RFC 9309); one whole-layer read per layer with the server's fixed query,
  143 at 23:39:03 (30,325 bytes), 146 at 23:39:10 (2,519 bytes), 147 at 23:39:16 (2,479 bytes) and 145 at 23:39:22 UTC
  (3,589 bytes); then each layer's metadata (`<layer>?f=json`) at 23:39:29, 23:39:35, 23:39:41 and 23:39:48 UTC. Each
  metadata answer: a feature layer, `maxRecordCount` 2,000, `copyrightText` and `description` empty, so **no licence
  found** (facts only, IPPUC cited, as for the other GeoCuritiba layers). The reads were parsed offline by the server's
  own parser (0 records skipped in each; no "[masked]" in any `hours`; every record has an address and a phone) and not
  kept; the test fixtures are synthetic.
  - 143: 49 Polícia Civil units, all `divulgar_endereco` "Sim", `dt_atualiz` from 2024-01-25 to 2025-10-13. Not only
    delegacias: the 13 district delegacias ("Delegacia do 13º Distrito Policial da Capital" in Tatuquara, "2ª a 6ª
    feira, das 8h30 às 18h", among them), specialised delegacias (homicídios, mulher, adolescente, furtos e roubos...),
    the three Centros Integrados de Atendimento ao Cidadão and also divisions and support units (Corregedoria,
    Subdivisão de Transporte e Manutenção, a dog unit, tactical groups). Hence the type's label "Polícia Civil" and the
    note that being listed does not mean a unit takes reports from the public. 17 records have the 24-hour flag "Sim";
    one unit says "Diariamente, 24 horas" with the flag "Não", and two have no `observacao`: the note says the flag
    and `hours` do not always agree. Some `hours` carry a previous address or a service line ("SOS Criança, ligue
    156."), kept as published. Landlines; one record gives two numbers in one field (both kept).
  - 146: 1 record, the Polícia Federal's Superintendência Regional do Paraná (Santa Cândida), "2ª a 6ª feira, das 8h30
    às 12h e das 13h às 17h", two landlines in one field (both kept).
  - 147: 1 record, the Polícia Rodoviária Federal's 7ª Superintendência Regional Paraná, "2ª a 6ª feira, das 8h às
    17h", one landline.
  - 145: 3 records, two Unidades de Execução Técnico-Científica and the Academia de Ciências Forenses do Paraná,
    "2ª a 6ª feira, das 8h às 12h e das 13h às 17h", landlines, no e-mail.
  - **E-mails are not returned for these types.** The layers publish institutional addresses at `pc.pr.gov.br` (48 of
    49 in 143), `pf.gov.br` (146) and `prf.gov.br` (147); the e-mail allowlist keeps `curitiba.pr.gov.br` only, and
    it is unchanged in this release (owner decision: the privacy filters are not widened here), so `emails` is empty
    for every police record.
  - Emergency numbers: 190 (Polícia Militar), 197 (Polícia Civil) and 191 (Polícia Rodoviária Federal) are all in the
    "Emergências" section of the Instituto Municipal de Turismo's "Telefones Úteis" page as read on 2026-11-22 for
    `useful_phones` (trimmed copy: `test/fixtures/useful_phones/telefones_uteis_trimmed.html`), labelled as in the
    note; that page was not read again. One unit's own text in layer 143 also says "Emergência, ligue 190." Every
    note for these types starts "Emergency: call 190 (Polícia Militar), 197 (Polícia Civil) or 191 (Polícia
    Rodoviária Federal). This tool lists places, it does not file police reports."
  - Online reports: the `delegacia` note names the Polícia Civil do Paraná's Delegacia Eletrônica without a link. No
    Polícia Civil host is on the link allowlist and none was opened for this release; the name comes from the task
    brief, not from a page read here.
  - No bare `policia`, `pf`, `dp` or `iml` alias; Polícia Militar units are not in these layers (the note points to
    `places_search`, category `police`, for the OpenStreetMap list). Names are units and places; no staff or personal
    data is in the fields read. No new host: `geocuritiba.ippuc.org.br` was already contacted, through the same host
    gate. The link allowlist is unchanged.
- **Added in v0.50.0** (type `instituto de identificacao`, aliases `rg`, `carteira de identidade` and others):
  MapServer layer 168 "Instituto de Identificação do Paraná". Checked on 2026-11-25 with curl and User-Agent
  `curitibai-mcp/0.50 (+https://github.com/Bossmann007/curitibai)`, three GET requests at least 6 s apart:
  `/robots.txt` at 23:59:21 UTC (404, `text/html; charset=utf-8`: no rules, RFC 9309); the layer's metadata
  (`168?f=json`) at 23:59:28 UTC (10,057 bytes): a feature layer, `maxRecordCount` 2,000, `copyrightText` and
  `description` empty, so **no licence found** (facts only, IPPUC cited, as for the other GeoCuritiba layers), and no
  appointment field among its fields; then one whole-layer read with the server's fixed query at 23:59:40 UTC (9,869
  bytes). The read was parsed offline by the server's own parser (0 records skipped; no "[masked]" in any `hours`;
  every record has an address and a landline) and not kept; the test fixture is synthetic.
  - 168: 12 records, all `divulgar_endereco` "Sim", `dt_atualiz` 2025-10-13 or 2025-11-18: the institute's head
    office in Centro ("Atendimento administrativo: 2ª a 6ª feira, das 8h às 18h", no appointment line), the "001 -
    Central" post, nine posts in Ruas da Cidadania ("037 - Rua da Cidadania Tatuquara", bairro Tatuquara, "2ª e 6ª
    feira, das 8h às 17h", among them) and one in a shopping centre (Jockey Plaza, Tarumã, "2ª a 6ª feira, das 10h às
    19h"). The layer has **no appointment field**: 11 of 12 `observacao` texts end with "Necessário agendamento
    prévio para atendimento.", returned in `hours` as published; the note says a record without that line does not
    mean no appointment is needed. Three posts (Tatuquara, CIC, Cajuru) publish "2ª e 6ª feira",
    kept as written; the note says to call before going. Most posts are named after their Rua da Cidadania, which is not
    always the bairro (Pinheirinho in Capão Raso, Bairro Novo in Sítio Cercado, Boa Vista in Bacacheri).
  - **E-mails are not returned for this type.** Five records publish an `ii.pr.gov.br` address; the e-mail allowlist
    keeps `curitiba.pr.gov.br` only and is unchanged, so `emails` is empty. Phones are Curitiba landlines and are kept.
  - Booking: the note says appointments are booked through the Paraná state Instituto de Identificação's channels,
    without a link. The state booking page is on a state host that is not on the link allowlist; no state host was
    opened for this release.
  - No bare `identidade`, `documento` or `cin` alias. Names are posts and places; no staff or personal data is in the
    fields read. No new host: `geocuritiba.ippuc.org.br` was already contacted, through the same host gate. The link
    allowlist is unchanged.
- **Added in v0.51.0** (types `cartorio de registro civil`, `junta militar`, `defensoria publica` and `forum`):
  MapServer layers 99 "Cartório de Registro Civil", 21 "Junta de Serviço Militar", 105 "Defensoria Pública" and 106
  "Fórum". Checked on 2026-11-26 (UTC) with curl and User-Agent `curitibai-mcp/0.51
  (+https://github.com/Bossmann007/curitibai)`, nine GET requests at least 5 s apart, in this order: `/robots.txt` at
  00:11:55 (404, `text/html; charset=utf-8`: no rules, RFC 9309); one whole-layer read of each layer with the server's
  fixed query at 00:12:00 (99, 4,664 bytes), 00:12:05 (21, 5,113), 00:12:11 (105, 11,824) and 00:12:16 (106, 7,700);
  then each layer's metadata (`<layer>?f=json`) at 00:14:33, 00:14:38, 00:14:44 and 00:14:50 (about 10 KB each): feature
  layers, `maxRecordCount` 2,000, `copyrightText` and `description` empty, so **no licence found** (facts only, IPPUC
  cited, as for the other GeoCuritiba layers). The metadata was read after the layers, not before; nothing in it
  restricts use. The reads were parsed offline by the server's own parser (0 records skipped; no "[masked]" in any
  `hours`; every record has an address) and not kept; the test fixtures are synthetic. No other host was opened.
  - 99: 4 records, the 1º to 4º Cartório de Registro Civil das Pessoas Naturais de Curitiba (three in Centro, one in
    Centro Cívico), `dt_atualiz` 2023-09-29 or 2025-09-15, "2ª a 6ª feira, das 8h30 às 17h30" (one "às 17h"). The
    layer lists four offices; the notes do not claim this is every registry office in Curitiba. Each `observacao`
    ends with "Cartório <surname>.", the office's trade name after a person: **that line is not shown**: any line that mentions "cartório" (any case, anywhere) is replaced by the marker "[a line about the cartório is not shown: it can carry a person's name or a notice; ask the office]" (`hideLine`; a plain substring regex, linear; consecutive markers merged), so no surname is shown and nothing is cut silently; a notice that mentions the cartório ("Cartório Fechado.", "Cartório de plantão aos sábados, das 9h às 12h.") is hidden the same visible way. When read, only the trade-name lines mentioned it. The e-mails are on the
    offices' own domains, one with a person's name in it: dropped by the unchanged allowlist. One landline each, kept.
  - 21: 3 records (Fazendinha, Boqueirão and Cristo Rei, each named by its number and sector), "2ª a 6ª feira, das 8h
    às 12h e das 13h às 17h", "Para fazer o alistamento online é necessário possuir CPF." and an "Atende aos bairros:"
    line of 137 to 503 characters (Centro is served by the Cristo Rei junta). E-mails are unit mailboxes at
    `curitiba.pr.gov.br` (`jsm001@` and similar) and are kept; two landlines each.
  - 105: 14 records, `dt_atualiz` 2025-07-31: posts in fóruns, the Comarca de Curitiba office, the Casa da Mulher
    Brasileira, the Juizado de Violência Doméstica, the Tribunal do Júri and others, with days, hours, the areas
    handled and the bairros covered. E-mails are `defensoria.pr.def.br` and one gmail address: all dropped. 8 of 14
    publish a mobile number, dropped; two of them publish only a mobile, so they come back with no phone, and the
    note says how to reach the Defensoria (its own channels, not linked). The note does not say the service is free.
  - 106: 9 records: the state fóruns (Cível I and II, Criminal, and the regional ones in Sítio Cercado, CIC,
    Boqueirão, Santa Felicidade and Pinheirinho, which list the courts they house and their "Bairros de abrangência")
    and the Fórum da Justiça do Trabalho de Primeiro Grau (its `trt9.jus.br` e-mail dropped), `dt_atualiz` from
    2019-07-04 to 2024-02-05; "2ª a 6ª feira, das 12h às 18h".
  - **Long lines.** The bairro lists run past the 160-character line cut (503, 321, 201 and 186 characters). For
    `junta militar`, `defensoria publica` and `forum` a line over 160 characters is split after its commas into several
    lines of at most 160 (`wrapLines`), so no bairro is cut; masking runs on each part. `bairro` filters by where an
    office is, not by the bairros it serves; the notes say so.
  - No bare `cartorio`, `certidao`, `junta`, `justica` or `tribunal` alias. No new host: `geocuritiba.ippuc.org.br` was
    already contacted, through the same host gate. The link allowlist is unchanged; no Defensoria, court or registry
    office site is linked.
- **Added in v0.52.0** (types `creas`, `centro pop`, `central de encaminhamento social`, `centro de atividades para
  idosos`, `centro de referencia da mulher` and `centro de referencia afro`): MapServer layers 38 "Centro de Referência
  Especializado de Assistência Social", 40 "Centro POP", 39 "Central de Encaminhamento Social", 36 "Centro de
  Atividades para Idosos", 108 "Centro de Referência de Atendimento à Mulher" and 109 "Centro de Referência Afro".
  Checked on 2026-11-26 (UTC) with curl and User-Agent `curitibai-mcp/0.52 (+https://github.com/Bossmann007/curitibai)`,
  13 GET requests at least 5 s apart, in this order: `/robots.txt` at 00:55:10 (404, `text/html; charset=utf-8`: no
  rules, RFC 9309); each layer's metadata (`<layer>?f=json`) at 00:55:15, 00:55:21, 00:55:27, 00:55:33, 00:55:39 and
  00:55:44: feature layers, `maxRecordCount` 2,000, `copyrightText` and `description` empty, so **no licence found**
  (facts only, IPPUC cited, as for the other GeoCuritiba layers); then one whole-layer read of each with the server's
  fixed query at 00:55:58 (36, 4,906 bytes), 00:56:03 (38, 8,645), 00:56:10 (39, 2,520), 00:56:15 (40, 4,146),
  00:56:20 (108, 3,514) and 00:56:26 (109, 2,512). The reads were parsed offline by the built server's own parser (0
  records skipped; no "[masked]" in any `hours`; every record has an address) and deleted; the test fixtures are
  synthetic. The shelter and transit-house layers (45, 46, 164) were not read.
  - 38: 10 CREAS, each named after a regional ("CIC", "Matriz", "Pinheirinho"...), `dt_atualiz` 2026-04-29, "2ª a 6ª
    feira, das 8h às 17h", "Emergências: Central 156." and, for some, previous addresses. No line says which bairros a
    unit serves: the note says so and sends people to their CRAS or the 156, and the citizen question is answered with
    `name`, not `bairro` (the CIC unit's `bairro` is "Cidade Industrial de Curitiba"). Every unit publishes landlines
    and one or two mobiles (dropped); the CIC unit's e-mail is at `curitiba.pr.br` (a typo of the city domain) and is
    dropped by the unchanged allowlist.
  - 40: 3 Centros POP; "Solicitações de atendimento ou emergência são realizadas pelo telefone 156." Two publish only a
    mobile, so they come back with no phone (the note says to call the 156). **One record's text names a transit
    house and its street address**: in these six types and in `cras` any `hours` line that mentions "casa(s) de passagem", "abrigo",
    "albergue", "pernoite", "casa(s) lar", "casa(s)" or "unidade(s)" "de acolhida" or "de acolhimento", "residência(s)
    inclusiva(s)", "acolhimento institucional" or "sigiloso/a" (accents, case, invisible format characters, hyphens and
    repeated spaces ignored; `isShelterLine`, a plain alternation of literals, linear; the whole line is tested, not
    only its first 160 characters, and when such a phrase is split over two lines the whole `hours` becomes the
    marker) is replaced
    by the marker "[a line that may point at a shelter, transit house or confidential unit is not shown; ask the
    156]"; consecutive markers are merged. "Acolhimento" alone (a service, as in the Casa da Mulher Brasileira's list)
    is kept. A city e-mail whose address holds "passagem", "abrigo", "albergue", "acolhi", "pernoite" or "sigilos" is
    dropped. A record of these types whose name, street or complement mentions one is left out and counted in
    `skipped_records`; none did when read. After the review fixes widened this check, the final build re-read layers
    34 (`cras`, 39 records), 36, 38, 39, 40, 108 and 109 on 2026-11-26, seven more GET requests at least 5 s apart
    (01:13:09 to 01:13:43 UTC, same User-Agent, the server's fixed query): 0 records skipped in any layer, and the only
    hidden line in all seven is the Centro POP transit-house line above (no CRAS line changes). The reads were deleted. After
    the second review widened it again, a third round on 2026-11-26: layers 34, 36, 38 and 39 at 01:17:39, 01:17:44,
    01:17:50 and 01:17:57 UTC; layer 40 at 01:18:03 timed out with no bytes; after a pause of more than 60 s, layers
    108 and 109 at 01:19:33 and 01:19:39, then 40, 108 and 109 again at 01:19:55, 01:20:00 and 01:20:06 (ten requests,
    all 200 except the timeout). Same result: 0 records skipped, the Centro POP line the only hidden one, no `hours`
    hidden whole, no e-mail dropped. The reads were deleted.
  - 39: 1 record, the Central de Encaminhamento Social 24 Horas: "Contato: disque 156" and the 156 site's address
    (kept as text, not linked).
  - 36: 5 records, named Espaço ConViver in `nome_completo`, "2ª a 6ª feira, das 8h às 17h" (one with a lunch break).
  - 108: 2 records, the Casa da Mulher Brasileira (24 hours; lists the services inside it) and the CIC centre (no
    `observacao`); both had `divulgar_endereco` "Sim". **When it is anything but exactly "Sim"** (also null or
    another case), a record of this type returns only its name, institutional phones, `updated` and one `hours` line
    "[the address of this place is not published: call its phone if one is shown, or the 180 or the 156]": no
    address, position, `bairro`, `regional`, other hours, e-mail or periods, so `bairro` and `near` never match it
    (synthetic tests with "Não", null and "sim"). Other types keep the older rule (address and position only). The
    note leads with "Emergency: call 190 (Polícia Militar). Central de Atendimento à Mulher: 180 (24 hours, free
    call), both as published by the Ministério das Mulheres. This tool lists places, it does not dispatch help." (the
    `www.gov.br` row above).
  - 109: 1 record, the Centro de Referência Afro Enedina Alves Marques (named after the engineer; a place name),
    "2ª a 6ª feira, das 9h às 19h".
  - The notes promise no service, eligibility or free care: they say who is assisted is not in the layers and to call
    before going. Aliases: `creas` (`centro de referencia especializado de assistencia social`), `centro pop`
    (`centros pop`, `centro de referencia especializado para populacao em situacao de rua`), `central de
    encaminhamento social` (`central de encaminhamento social 24 horas`), `centro de atividades para idosos` (`espaco
    conviver`), `centro de referencia da mulher` (`centro de referencia de atendimento a mulher`, `casa da mulher
    brasileira`), `centro de referencia afro`, and plurals; none was used by another type, and no `abrigo`, `casa de
    passagem` or `acolhimento` name resolves (tested). No new host for the server: `geocuritiba.ippuc.org.br` was
    already contacted, through the same host gate. The link allowlist is unchanged.
- **Added in v0.53.0** (types `escola municipal`, `cmei`, `cmaee` and `cei contratado`): MapServer layers 80 "Escola
  Municipal", 78 "Centro Municipal de Educação Infantil", 81 "Centro Municipal de Atendimento Educacional
  Especializado" and 79 "Centro de Educação Infantil (contratado)". Checked on 2026-11-26 (UTC) with curl and
  User-Agent `curitibai-mcp/0.53 (+https://github.com/Bossmann007/curitibai)`, 9 GET requests at least 5 s apart, in
  this order: `/robots.txt` at 01:52:02 (404, `text/html; charset=utf-8`: no rules, RFC 9309); each layer's metadata
  (`<layer>?f=json`) at 01:52:08 (80), 01:52:13 (78), 01:52:22 (81) and 01:52:27 (79): feature layers,
  `maxRecordCount` 2,000, `copyrightText` and `description` empty, so **no licence found** (facts only, IPPUC cited,
  as for the other GeoCuritiba layers); then one whole-layer read of each with the server's fixed query at 01:52:41
  (80, 126,751 bytes), 01:52:47 (78, 155,909), 01:52:56 (81, 12,092) and 01:53:02 (79, 113,380). No layer reached
  2,000 records. The reads were parsed offline by the built server's own parser (0 records skipped in each; every
  record has an address; `divulgar_endereco` was "Sim" in all 622) and deleted; the test fixtures are synthetic.
  - 80: 188 escolas. Only 2 publish an hours line; `open_periods` is set for all (97 morning and afternoon, 90
    also evening, 1 afternoon and evening). The note says escolas rarely publish hours and to call. 177 records have a line about the school
    library with its e-mail, which the existing masking shows as "[masked]". 8 records publish only a mobile and come
    back with no phone.
  - 78: 241 CMEIs, 237 with "Atendimento:" and a "2ª a 6ª feira, das 7h às 18h"-style line, plus a unit code such as
    "(CMEI-BV-2)". The question's CMEI Bracatinga (Pilarzinho) returns a landline and its hours line. 7 records come
    back with no phone (mobile only); 8 e-mails at misspelt domains (`sme.curitiba.pr.gov.b` and similar) are
    dropped by the unchanged allowlist.
  - 81: 13 CMAEEs, each with an hours line. One record's description line is about 530 characters: `wrapLines` splits
    it after its commas, and the two parts still longer than 160 characters end with "…".
  - 79: 180 contracted CEIs (private or non-profit centres the Prefeitura contracts). 137 publish an hours line, 23
    have no `observacao`. **131 records have a "Mantenedora: …" line**, and some maintainers are sole proprietors
    named after a person: for this type every line that mentions "mantenedor", "mantido/a por/pela/pelo",
    "proprietário/a", "responsável", "diretor/a", "eireli" or "ltda" (any case or accent) or the word "ME" or "MEI"
    (plain regexes, linear), the line after a bare label (the keyword alone, with or without ":"), and, since v0.54.0,
    the one line after a hidden line not ending in "." or a firm suffix when it looks like the rest of a name (up to 4
    words before a digit or ",", no ":", no hours or service word; since v0.55.0 also av, avenida, fone, período, vagas, berçário, short words as whole words), is replaced by the marker "[the maintainer line is not shown: it can carry a person's name]". E-mails at
    gmail, hotmail, yahoo and other private domains, and mobiles, are dropped by the unchanged filters; the kept
    e-mails are unit mailboxes at `educacao.curitiba.pr.gov.br`. The note says the listing does not confirm
    Vale-Creche accreditation and points to `city_service_guide` (`creche`, `vale_creche`); no link is added.
  - No staff name was found in any `observacao` line (checked for diretor, coordenador, responsável, gestor and
    similar words). Unit names honour public figures, as in the other layers. Aliases: `escolas municipais`; `cmeis`,
    `centro municipal de educacao infantil`, `creche municipal`; `cmaees`, `centro municipal de atendimento
    educacional especializado`; `ceis contratados`, `centro de educacao infantil contratado`, `creche contratada`.
    No bare `escola` (state and private schools are not in these layers) or `creche` (either kind); both stay
    unresolved (tested). No new host for the server and the link allowlist is unchanged.
- **Added in v0.58.0** (types `rodoviaria`, `ferroviaria` and `administracao regional`): urban-equipment MapServer
  layers 159 "Terminal Rodoviário", 160 "Terminal Ferroviário" and 15 "Administração Regional" (not the thematic
  layer 15 that `place_at_point` reads since v0.57). Checked on 2026-11-26 (UTC) with curl and User-Agent
  `curitibai-mcp/0.58 (+https://github.com/Bossmann007/curitibai)`, 7 GET requests at least 5 s apart, in this order:
  `/robots.txt` at 19:43:20 (404, `text/html; charset=utf-8`: no rules, RFC 9309); then for each layer its metadata
  (`<layer>?f=json`) and one whole-layer read with the server's fixed query: 159 at 19:43:26 and 19:43:33 (2,628
  bytes), 160 at 19:43:39 and 19:43:45 (2,765), 15 at 19:43:52 and 19:43:58 (10,401). Feature layers,
  `maxRecordCount` 2,000, `copyrightText` and `description` empty, so **no licence found** (facts only, IPPUC cited,
  as for the other GeoCuritiba layers). The reads were parsed offline by the built server's own parser (0 records
  skipped; `divulgar_endereco` "Sim" in all 12) and deleted; the test fixtures are synthetic.
  - 159: 1 record, the Terminal Rodoviário de Curitiba (Av. Pres. Affonso Camargo, 330, Jardim Botânico), updated
    2026-10-14. Hours as published: administrative daily 6h to 24h, operational daily 0h to 24h (`func_24hr` "Sim").
    Two landlines; the e-mail is at `urbs.curitiba.pr.gov.br` (kept). The note says these are the terminal's hours,
    not departures, and that intercity departures, platforms and fares are not in this tool; it names the URBS home
    page `https://www.urbs.curitiba.pr.gov.br/`, the link the bus tools already return (on the allowed zone; never
    fetched: that host answers 403 to non-browser clients). The terminal's own page was not looked for or linked.
  - 160: 1 record, the Terminal Ferroviário de Curitiba (same address, "Bloco Ferroviário"), updated 2026-10-14.
    Hours as published for "alta temporada" and "baixa temporada", with no dates: the note says the layer does not say
    which season applies. The e-mail is at a private train operator's domain and is dropped by the unchanged filter;
    one landline is kept. No train times or tickets.
  - 15: 10 records, one Administração Regional per regional, each inside a Rua da Cidadania; updated 2025-06-06 (one
    2025-11-18). Each `observacao` has general and protocolo hours ("2ª a 6ª feira, das 8h às 18h", Tatuquara to
    17h), a "-Telefone: (41) …" protocolo line, which the unchanged free-text mask shows as "[masked]"; it is not always among the
    record's `telefone` landlines (Tatuquara's is not), so the note says it may not be in `phones`, and a "Bairros de abrangência" line; two of those (Matriz, Santa Felicidade) are over 160 characters, so the type sets
    `wrapLines`. One record adds its former address. Landlines and `@curitiba.pr.gov.br` e-mails only.
  - No person's name, mobile or personal e-mail in the 12 records. Aliases: `rodoferroviaria`, `rodoviaria de
    curitiba`, `rodoferroviaria de curitiba`, `terminal rodoviario`, `terminal rodoviario de curitiba`; `terminal
    ferroviario`, `terminal ferroviario de curitiba`, `estacao ferroviaria`; `administracoes regionais`,
    `administracao regional de curitiba`, `sede da regional`. No bare `regional`, `trem` or new `terminal` (tested).
    No new host for the server and the link allowlist is unchanged.
- **Added in v0.59.0** (type `cohab`): urban-equipment MapServer layer 29 "Agência de Atendimento da COHAB". Checked
  on 2026-11-26 (UTC) with curl and User-Agent `curitibai-mcp/0.59 (+https://github.com/Bossmann007/curitibai)`, 4 GET
  requests by hand, in this order: `/robots.txt` at 19:59:13 (404, `text/html; charset=utf-8`: no rules, RFC 9309);
  layer 29 metadata (`29?f=json`) at about 19:59:19; one whole-layer read of layer 29 at about 19:59:27 with the
  server's `outFields` (less `objectid`) and no geometry; and one read of layer 15 (`nome`, `observacao` only, no geometry) at about
  19:59:53, to check the v0.58 regional offices for lines naming a person. Feature layer, `maxRecordCount` 2,000,
  `copyrightText` and `description` empty, so **no licence found** (facts only, IPPUC cited, as for the other
  GeoCuritiba layers). The reads were inspected offline and deleted; the test fixture is synthetic.
  - 29: 9 records, one COHAB-CT agency in each of nine Ruas da Cidadania (Tatuquara, CIC, Fazendinha, Pinheirinho,
    Bairro Novo, Matriz, Boa Vista, Boqueirão, Cajuru), `divulgar_endereco` "Sim" in all, updated 2026-10-14. Hours as
    published ("2ª a 6ª feira, das 8h às 17h", or with a 12h–13h break in four), "Atendimento acessível em LIBRAS." in
    four, and in all a line saying in-person service is booked through the Agenda Online ("Saiba Mais", a link in the
    `site` field, which is never read). Every record lists the same `telefone`, a landline and a toll-free 0800 number,
    and the same `@curitiba.pr.gov.br` e-mail: the note says these are central contacts, not the agency's own. The
    0800 number was dropped by the phone filter until v0.59; it is now kept (below). Three agencies are named after a
    Rua da Cidadania in another bairro (Pinheirinho in Capão Raso, Bairro Novo in Sítio Cercado, Boa Vista in
    Bacacheri), so the note says to search by `name`. The note also says housing applications, the applicant queue
    and anyone's registration are not in this tool; the `PretendentesCohab` dataset stays avoided (below).
  - No person's name, mobile or personal e-mail in the 9 records, and none in the 10 `observacao` texts of layer 15.
    Still, since v0.59 `cohab` and `administracao regional` replace a line that starts with who is in charge or has
    "<role>:" (responsável, diretor(a), administrador(a), gerente, coordenador(a), chefe), and the name on the line
    after such a label however long, with the marker "[a line naming who is in charge is not shown: it can carry a
    person's name]". This reuses the `cei contratado` label and split-name handling in `hourLines` but not its word
    list: that list also hides any line with MEI, ME, Ltda, Eireli or "responsável" anywhere, which would hide office
    service lines ("Sala do Empreendedor: atendimento ao MEI"; tested). The CEI list gains `administrador`. Aliases: `cohab ct`, `cohab curitiba`, `agencia da
    cohab`, `agencias da cohab`, `agencia de atendimento da cohab`, `agencias de atendimento da cohab`. No new host for
    the server and the link allowlist is unchanged (no Agenda Online or COHAB link is added).
- **Added in v0.60.0** (types `mesa solidaria`, `horta comunitaria`, `fazenda urbana`, `nucleo de seguranca
  alimentar`): urban-equipment MapServer layers 7 "Mesa Solidária", 9 "Horta", 10 "Fazenda Urbana" and 1 "Núcleo
  Regional de Segurança Alimentar e Nutricional". Checked on 2026-11-26 (UTC) with curl and User-Agent
  `curitibai-mcp/0.60 (+https://github.com/Bossmann007/curitibai)`, 10 GET requests by hand, at least 5 s apart:
  `/robots.txt` at 20:53:33 (404, `text/html; charset=utf-8`: no rules, RFC 9309); one whole-layer read (`where=1=1`,
  all fields, geometry) of layers 1, 7, 9 and 10 from 20:53:38 to 20:54:00; the metadata (`?f=json`) of layers 1, 7,
  10 and 9 (the last after 20:54:00 and before 20:58:15); and one read of layer 9 with the fixed `where` at 20:58:15 (56 records, 4 fields).
  `copyrightText` and `description` are empty in all four, so **no licence found** (facts only, IPPUC cited, as for
  the other GeoCuritiba layers). The reads were inspected offline and deleted; the test fixtures are synthetic.
  - 7: 4 records (Centro 1, Jardim Botânico 2, Campo de Santana 1). Two only cook ("produção de refeições") and list
    no serving hours; the Centro one (BASE) has a 190- and a 300-character hours line, so the type splits long lines
    at commas (`wrapLines`) and no time is cut. Every record's `telefone` is "WhatsApp (41) 3350-3821", which the
    phone filter dropped; since v0.60 a leading "WhatsApp" word is removed first (every type), so the landline is
    kept, and the note says it is a WhatsApp line. Same `@curitiba.pr.gov.br` e-mail on all. The `site` field (a
    `www.curitiba.pr.gov.br/servicos/` page) is never requested by the server.
  - 9: 233 records, `tipo_equi` "Horta Comunitária Urbana" 56, "Horta Escolar" 109 (inside schools), "Horta
    Institucional" 68 (inside institutions, among them three Unidades de Acolhimento Institucional, a Casa de
    Passagem, a Casa do Piá and a Casa de Semiliberdade, four of them with `divulgar_endereco` "Sim"). Shelters are
    never listed (v0.52), and school and institutional gardens are not open to the public, so the type asks the layer
    for the community gardens only, with a fixed `where` (`tipo_equi = 'Horta Comunitária Urbana'`, never user input;
    `tipo_equi` is not in `outFields`). Of the 56: no `telefone` in any, no `observacao` in 30, no hours in any
    (`func_*` "Não"); the others say who keeps the garden ("Mantida pela Associação de Moradores …", kept), the
    programme ("Programa Integrado de Desenvolvimento Sustentável Eletrosul") or the planted areas. One
    `@curitiba.pr.gov.br` e-mail on all. The note says there is no phone or hours, gives the two other counts and
    says `source_url` is the whole layer.
  - 10: 3 farms (Cajuru, Tatuquara, CIC), hours "2ª a 6ª feira, das 8h às 12h e das 13h às 17h". `telefone`: a
    landline and two mobiles; nothing; one mobile. Mobiles are dropped as always, and the note says to use the e-mail.
    Each `observacao` names two city pages for enrolment in activities (`guia.curitiba.pr.gov.br` and
    `aprendere.curitiba.pr.gov.br`): returned in `hours` as published text, never fetched or added to any allowlist;
    the note says this tool does not enrol.
  - 1: 10 núcleos, one per regional, in the Ruas da Cidadania (Matriz at the Mercado Municipal, Cajuru at the Mercado
    Regional), hours and a landline each, one shared e-mail.
  - No person's name, mobile or personal e-mail in the 4, 56, 3 and 10 records returned: run through the parser, no
    line was hidden. Since v0.63 the `horta comunitaria` filter is an allowlist: a line is shown only when it is a public label (atendimento, horário, funcionamento, endereço, bairro, pomar, cultivo, área de plantio or lavoura, jardins de mel), an hours or number line (a digit or a weekday, after an optional hours label and de, das or aos), the body that keeps or runs the garden ("Mantida pela Associação …", "A SMSAN coordena …"), the city programme, a partner ("Parceria com …"), "Horta com N canteiros" or exactly "Contato pelo e-mail da secretaria", and has no person in it ("contato", "voluntário/a", "quem cuida/coordena", cuidado/coordenado por or pelo/pela a person, Dona, Seu, Sr(a). or Senhor(a), a word other than a body before cuida(m) or coordena(m), any case, and the offices' person filter); any other line, a lower-case name included, is hidden; a name in the rest of a line that starts as a known kind is caught only by those person words. Run over the 56 records as read on 2026-11-26, no line was hidden (Change Reviewer, v0.60–v0.62 reviews).
    The four types use the offices' person-line filter, whose roles gain secretário/a,
    supervisor/a and gestor/a, titular, coordenação and gestão before ':', and "mantido/a por" anywhere or "mantida
    pelo Sr./Sra./Dona" ("Secretaria Municipal de …", "Titular da conta" and "mantida pela Associação …" stay;
    tested). For `cei contratado`, the line after a hidden "…:" label with no comma is hidden unless it starts with a
    digit or a service word (v0.59 hid "-2ª a 6ª 8h" after "Responsável pela matrícula:"). No new host for the server
    and the link allowlist is unchanged.
- **Added in v0.64.0** (types `sine`, `agencia do trabalhador`, `liceu de oficios`, `inss`): urban-equipment
  MapServer layers 150 "Unidade de Atendimento SINE", 151 "Agência do Trabalhador", 149 "Liceu de Ofícios" and 152
  "Agência da Previdência Social". Checked on 2026-11-26 (UTC) with curl and User-Agent `curitibai-mcp/0.64
  (+https://github.com/Bossmann007/curitibai)`, 9 GET requests by hand, 2 s apart: `/robots.txt` at 23:30:06 (404,
  `text/html; charset=utf-8`: no rules, RFC 9309), then the metadata (`?f=json`) and one whole-layer read
  (`where=1=1`, all fields, geometry) of layers 149, 150, 151 and 152, until 23:30:25. `copyrightText` and
  `description` are empty in all four, so **no licence found** (facts only, IPPUC cited, as for the other GeoCuritiba
  layers). The reads were inspected offline and deleted; the test fixture is synthetic.
  - 150: 12 records, `dep_admin` "Público Municipal". Ten units in the Ruas da Cidadania, named after the Rua da
    Cidadania, not the bairro (SINE Pinheirinho is in bairro Capão Raso, regional Pinheirinho), so the note says to
    search by `name`. The SINE Móvel has `divulgar_endereco` "Não" and no street: no address or position is returned,
    and the note says it has no fixed place. "Economia Popular Solidária" is in this layer without "SINE" in its name.
    Hours "2ª a 6ª feira, das 8h às 12h e das 13h às 17h" on most; a landline and a `@curitiba.pr.gov.br` e-mail each.
  - 151: 1 record, the Paraná state agency in the Centro ("Público Estadual"), a landline and hours. Its e-mail is on
    a state domain and names a person: the e-mail filter drops it (every type keeps only `curitiba.pr.gov.br`). The
    state's own Agência do Trabalhador page on `www.parana.pr.gov.br` is never fetched or linked (its robots.txt
    disallows GPTBot, as read by the owner's research on 2026-11-25).
  - 149: 16 records with hours, a landline (one published as "WhatsApp (41) …", kept since v0.60) and a city e-mail;
    the Liceu das Artes (Memorial Paranista) and the Liceu de Ofícios Criativos are among them. One hours line is
    about 330 characters, so the type splits long lines at commas (`wrapLines`) and nothing is cut.
  - 152: 4 records ("Público Federal"), hours, `telefone` "135" (a three-digit service number, kept) and no e-mail.
    The lead note says benefits and appointments go through Meu INSS or the 135, named as text, with no link.
  - The `site` field (`www.curitiba.pr.gov.br/servicos/…` pages, a state page, `meu.inss.gov.br`) is never read. No
    person's name in the hours lines of the 33 records: run through the parser, no line was hidden. The four types
    still use the offices' person-line filter (tested with a "Responsável:" line). No new host for the server and
    the link allowlist is unchanged.
  - **Name filter, v0.70.0** (a follow-up of the 0.64.0 and 0.63.0 reviews). The four work types hide, besides the
    offices' person lines, a line with professor/a, "Prof.", "Profa." or "Prof.ª", instrutor/a, monitor/a,
    orientador/a, educador/a, tutor/a, atendente or contato (plurals too) anywhere in it, word-bounded ("contato"
    followed by a channel, "entre em contato pelo 156", is kept, so the hours after it are not read as a name) ("Atendimento" is not "atendente"), and the line after such a bare label ("Instrutora:"). This is
    broader on purpose than "a role, or a label before ':'": "Atendimento: atendente Fulana" has the word after the
    colon. The other office types keep the narrower filter. The `horta comunitaria` allowlist now keeps a "Parceria
    com …" or "Programa …" line only when, right after the keyword (and an optional ':', article or "de"), comes a
    body word, an organisation (empresa, instituto, universidade, fundação, cooperativa), a public scope (integrado,
    municipal, estadual, federal) or COPEL, Sanepar or Eletrosul. Generic words a name can follow (projeto, ONG,
    hortas) are left out, and there is no capital-letter rule (a name in capitals would pass); a public partner not
    in the list (a university by its acronym) is hidden, on the safe side. Known limit: a name after that word still passes,
    caught only by the person words. Checked on 2026-11-27 (UTC) with curl and User-Agent `curitibai-mcp/0.7
    (+https://github.com/Bossmann007/curitibai)`, 7 GET requests by hand: `/robots.txt` at 02:06:33 (404,
    `text/html; charset=utf-8`: no rules, RFC 9309), then one read of `objectid,observacao` (no geometry) of layers
    150, 151, 149, 152 and 9, 5 s apart; then, after those reads, the MapServer metadata at 02:09:43 (`copyrightText`
    and `description` empty: **no licence or terms found**, as before). Counts as read: 12, 1, 16 and 4 work records
    and, in layer 9, 233 records of every kind, 45 with an `observacao` (the tool asks only the community gardens).
    No line in them named a person or used a role word; the new filters, run on those reads, changed no record's
    `hours` against 0.69.0. Layer 9 has one "Parceria com COPEL." and 17 "Programa Integrado de Desenvolvimento
    Sustentável Eletrosul …" lines, all kept. The reads were inspected offline and deleted; the test fixture is
    synthetic. No new host for the server and the link allowlist is unchanged.
  - **Name filter, second pass, v0.72.0** (the lows of the 0.70.0 review). The four work types also hide a value
    of an "Atendimento:", "Atendimento ao público:" or "Horário de atendimento:" label (at the start of the line or of a
    sentence, every one in the line) that does not read as hours (a digit; "de/das/às" and a digit; a weekday, its
    abbreviation, "dia" or "feriado" that goes on as hours or has a digit later, so "Domingos da Silva" is not hours;
    an appointment, "não é/há …" or "fechado" sentence), on the same line or, after a bare label with or without ':',
    on the next one ("Local de atendimento: Rua …" is not such a label); a line with docente or facilitador/a
    anywhere, or agente or técnico/a before ':', or at the start or after an article or "com/pelo/pela" when a word
    other than "de", "em", "para" … follows ("aperfeiçoar técnicas", read in layer 149, and "a técnica de solda"
    stay; "Agentes comunitários" is hidden, on the safe side); and "contato" not followed by a channel: "Contato:
    3350-0000" (only phones, channel words and punctuation, then the end or hours that start with a word) and "contato
    pelo/via/no 156, telefone, e-mail, site …" stay, "Contato pela Fulana" and "Contato via Fulano" are hidden (0.70.0
    did the opposite for both). An hours line that starts with a weekday and has a digit is never read as the rest of
    a split name, so the hours after "Contato:" and its hidden value stay. The whole field, read joined to catch a
    keyword split across lines, is checked for the words only. On the safe side: an address after a bare
    "Atendimento:" is hidden. Known limit: a name later in an hours or channel line passes, caught only by the role
    words. The `horta comunitaria` allowlist also checks a "Parceria com" or "Programa" later in the line (an entity
    word must follow each), and "mantida pela" not followed by an entity word hides the line anywhere in it; splitting lines
    into sentences was tried and dropped (it missed " - " and hid "R. Inventada"). Checked on 2026-11-27 (UTC) with
    curl and User-Agent `curitibai-mcp/0.72 (+https://github.com/Bossmann007/curitibai)`, 12 GET requests by hand:
    `/robots.txt` at 02:45:18 (404, `text/html; charset=utf-8`: no rules, RFC 9309), then one read of
    `objectid,observacao` (no geometry) of layers 150, 151, 149, 152 and 9, about 5 s apart, until 02:45:51; then the
    MapServer metadata at 02:55:44 (`copyrightText`, `description` and `serviceDescription` empty: **no licence or
    terms found**, as before); after the review fixes, the same five reads again from 03:02:02 to 03:02:24, same
    sizes. Counts as read: 12, 1, 16 and 4 work records and 45 layer-9 records with an
    `observacao`; no line named a person, and the new filters, run on those reads, changed no record's `hours`
    against 0.71.0. The reads were inspected offline and deleted; the test fixture
    (`liceu_de_oficios_synthetic.json`) is synthetic. No new host for the server and the link allowlist is unchanged.
  - **Name filter, third pass, v0.76.0** (the lows of the 0.72.0 review). The filters now live in
    `src/sources/nameFilter.ts` (moved first, with no behaviour change). The four work types keep a value after an
    attendance label made only of service phrases ("por ordem de chegada", "preferencial/prioritário (para idosos,
    gestantes …)", "gratuito", "carteira de trabalho", "seguro-desemprego", "com agendamento/senha") joined by ",",
    ";", "/", "e" or a space, on the same line or after a bare label; anything else in the value keeps it hidden ("por
    ordem de chegada. Fulana", "gratuito pela Fulana", "Fulana, gratuito"). They also hide a line with palestrante, assistente social or psicólogo/a anywhere
    ("Atendimento psicológico" and "Psicologia" stay), and a channel word followed by "da/do/com", or "falar/fale/
    tratar/procurar com", and then a word that is not a unit or channel word, after an optional article ("Contato no
    WhatsApp da Fulana", "Contato pelo telefone com Fulana", "Falar com Fulana de Tal" are hidden; "Contato pelo e-mail
    da unidade", "telefone do Sine", "WhatsApp do CRAS", "Telefone com DDD" and "Falar com a recepção" stay). The `horta comunitaria`
    allowlist checks the partner or programme phrase up to ".", ";" or " - ": "e", "com" or "da/do/das/dos" there must
    be followed by an entity, place (Paraná, Curitiba, vila, bairro …) or topic word (meio ambiente, segurança,
    agricultura …) ("Parceria com a comunidade e a Fulana de Tal" and "Programa Municipal da Fulana" are hidden;
    "Universidade Federal do Paraná", "Secretaria Municipal do Meio Ambiente" and "Programa Municipal de Agricultura
    Urbana e Segurança Alimentar" stay; a bare "de" is not checked). Known limits: a name later in an hours line ("das
    8h às 17h com a Fulana") or after a comma in a partner phrase ("Parceria com a comunidade, Fulana") still passes;
    the office types keep the narrower filter. Checked on 2026-11-27 (UTC) with curl and
    User-Agent `curitibai-mcp/0.76 (+https://github.com/Bossmann007/curitibai)`, 6 GET requests by hand: `/robots.txt`
    at 15:15:58 (404, `text/html; charset=utf-8`: no rules, RFC 9309), then the server's own query (all its fields,
    with geometry) of layers 150, 151, 149, 152 and 9, about 5 s apart, until 15:16:26. Counts as read: 12, 1, 16 and
    4 work records, all with an `observacao`, and 56 community gardens, 26 with one. The parser hid no line in them
    before the change and none after: every record's `hours` is identical. The reads were inspected offline and
    deleted; the tests use synthetic lines. No new host for the server and the link allowlist is unchanged.
  - **Name filter, fourth pass, v0.80.0** (the lows of the 0.76.0 review). Lines the third pass hid by mistake stay
    visible: "a gente", "Regional", "coordenação" and "RH" are unit words after a channel word or "falar/fale/tratar
    com" ("Dúvidas? Fale com a gente pelo 156", "Telefone da Regional: 156", "E-mail da coordenação", "Tratar com o RH
    da empresa"), but only when the rest of the line holds nothing but numbers, "[masked]", punctuation, channel and
    unit words, "empresa" and connectors; any other word keeps the line hidden, as in 0.79.0 ("Tratar com o RH da
    Fulana", "Telefone da Regional: 3350-0000 - Fulana", "Telefone da Regional: 156, de segunda a sexta").
    "Telefone da coordenação: 3350-0000" stays hidden (the "coordenação:" label of who is in charge). "emissão de
    carteira de trabalho" is a service phrase after "Atendimento:". "agendamento" (optionally "prévio" and ",", "(",
    ":" or "-"), then "com" and a word that is not a unit or channel word or an appointment detail (um/uma, no/pelo,
    até, mínimo, antecedência, hora, horário, documentos, comprovante, carteira, CPF, RG, senha), anywhere in the
    line, hides it: "Atendimento: agendamento com Fulana" and a line "Agendamento com Fulana" are hidden;
    "agendamento com a equipe", "agendamento com antecedência", "com no mínimo 48h" and "agendamento pelo 156" stay.
    Known limits: only the first word after "com" is checked ("agendamento pela Fulana", "agendamento com antecedência,
    Fulana" pass), "presencial com Fulana" and a name later in an hours line still pass, and a name alone on the next
    line after "Fale com a gente" was shown (the whole-field check, which joins the lines with spaces, takes the four words as plain unit words; hidden since 0.81.0). No request was made for this version (the layers were not re-read): the change is
    tested on synthetic lines only. No new host for the server and the link allowlist is unchanged.
  - **Name filter, fifth pass, v0.81.0** (the lows of the 0.80.0 review). A keyword split over two lines ("Mantida" /
    "pela Fulana de Tal", "Assistente" / "social Fulana", "Coordenação" / "geral: Fulano") was hidden only by the
    whole-field check, which is skipped once another line of the record is hidden, so the name showed. Every type
    that hides person lines (contracted CEIs, the office and work types) now reads each line together with the one
    before it, joined by a line break, the way the whole-field check reads the record; when that pair hides, the line
    before does not hide alone and the second line does not read as hours or a service, the second line is hidden (the
    first half stays). The multi-word patterns accept a line break wherever they had a space. The whole-field check is
    skipped only when a line hid on its own rules (not by the split check), so a keyword split over three lines still hides the whole field. The
    garden allowlist already hid both halves and is unchanged. Work types: after a line whose contact phrase ends in "a
    gente", "Regional", "coordenação" or "RH" ("Falar com o RH", "Telefone da Regional:"), the split check hides the
    next line unless it is made only of channel, unit, connector and hours words, numbers and punctuation, or is a
    street address. Known limits: other words on that line are hidden too, on the safe side; after a guarded
    phrase ending in ',' or ';' with no name after it the line is hidden, on the safe side; a guarded phrase complete on the
    first of three lines, then a contact line, then the name ("Telefone da Regional:" / "3350-0000" / "- Fulana")
    shows the name; when the line
    before hides on its own ("Responsável: Fulana. Mantida" / "por Fulano de Tal Souza Lima", "Coordenadora" / "geral:
    Fulana") the pair is not read and the name passes, as in 0.80.0. Checked on 2026-11-27 (UTC) with the server's own
    query and User-Agent, one GET per layer to `geocuritiba.ippuc.org.br` (the 12 layers whose type hides person
    lines; 306 records, 253 with an `observacao`), replayed offline before and after the change: 131 hidden-line
    markers before and 131 after, and every record's `hours` is identical (0.79.0 gives the same). The reads were
    deleted after the check; the tests use synthetic lines. No new host for the server and the link allowlist is
    unchanged. **0.81.0 also fixes leaks 0.80.0 introduced** (Security Reviewer, after the merge): a guarded word's
    rest is read for at most 100 steps and may not end in ',' or ';' (a long `liceu de oficios` line cut at commas
    showed "…, Falar com a gente, Fulana"; a 400 KB line took about 4 s); two lines joined by a line break keep the
    guard ("Telefone da" / "Regional Fulana"); a name on the line after any guarded contact phrase or "agendamento com
    o RH" is hidden, the line before read uncut; "agendamento com Dias/Uma/hora/senha" at the end of a line is hidden.
    The whole next line is read ("3350-0000 - Fulana", "pelo 156 ou com a Fulana"), and the split check also reads
    three lines ("Tratar com" / "o RH" / "Fulana"); that line is kept only when it is made of channel, unit,
    connector and hours words, numbers and punctuation, or is a street address. "whats app" now reads one way only (a
    line of repeated "whats app" backtracked exponentially in 0.80.0). The 0.80.0 known limit "a name alone on the next line after 'Fale com a gente' is shown" was wider than 0.80.0 said: it also covered "Telefone da Regional", "E-mail da coordenação" and "RH", lines ending in ':', "pelo 156" or a phone, and next lines such as "Fulana, das 8h às 17h" or "ou com a Fulana". 0.81.0 closes it for all of these (tested). On 29,400 generated lines 0.79.0 shows a name
    in 6,472, 0.80.0 in 18,980 and 0.81.0 in none; nothing 0.79.0 hid is shown.
  - **Name filter, sixth pass, v0.82.0** (work types). After "agendamento com", um/uma, dia(s), hora and senha count
    as appointment details only before their own detail words (um/uma: semana, dia, hora, minuto, mês; dia(s):
    útil/úteis, corridos, antes, "de antecedência/prazo"; hora: marcada/agendada; senha: retirada, prévia, "na/pela"
    and a place or channel), so "agendamento com Dias de Souza", "com Hora pelo 156" and "com Uma 3350-0000" are
    hidden. On the line after a guarded phrase, "dia(s)" after a number counts as hours only before "de", "hora(s)"
    only after a one- or two-digit number, and "útil/úteis" only after "dia(s)": "156 Dias", "8 Dias", "156 Hora",
    "Util" and "Úteis" are hidden there; "2 dias de antecedência", "24 horas" and "Dias úteis" stay. Known limits:
    "8 Hora" still reads as hours; "100 horas" and "2 dias" alone there are hidden, on the safe side. No request was made for this
    version (synthetic lines only). No new host for the server and the link allowlist is unchanged.
  - **Name filter, seventh pass, v0.84.0** (work types). After "agendamento com", um/uma before dia(s) or hora(s)
    counts as a detail only when útil/úteis, corrido(s), antes or "de antecedência/prazo" follows, as for dia(s), or
    hora(s) marcada/agendada or "e meia de antecedência/prazo": "com Uma Dias", "com Uma Dias Silva" and "com Uma Dias
    de Souza" are hidden; "com um dia de antecedência", "com uma hora antes" and "com uma hora marcada" stay. Senha
    also counts before "de atendimento" and "numerada", only before the end, a digit or punctuation ("com senha
    numerada Fulana" is hidden). Known limits: um/uma and dia(s) or hora(s) before any other word ("com uma hora de
    tolerância") is hidden, on the safe side; a name after a full detail passes, as before; "agendamento com senha
    numerada" followed by a line that starts with a word hides the field (the whole-field check joins lines with
    spaces); "30 dias" and "1 dia" alone on the line after a guarded phrase are hidden, on the safe side,
    while "10 horas" there reads as hours (like "24 horas"). No request was made; no new host.
- **Added in v0.67.0** (types `casa da leitura`, `bondinho da leitura`, `auditorio`, `circo`, `clube de xadrez`):
  urban-equipment MapServer layers 61 "Casa da Leitura", 60 "Bondinho da Leitura", 52 "Auditório", 57 "Circo" and 58
  "Clube de Xadrez". Checked on 2026-11-27 (UTC) with curl and User-Agent `curitibai-mcp/0.67
  (+https://github.com/Bossmann007/curitibai)`, 11 GET requests by hand, 2 s apart: `/robots.txt` at 00:24:30 (404,
  `text/html; charset=utf-8`: no rules, RFC 9309), then the metadata (`?f=json`) and one whole-layer read
  (`where=1=1`, all fields, geometry) of layers 52, 57, 58, 60 and 61, until 00:24:54. `copyrightText` and
  `description` are empty in all five, so **no licence found** (facts only, IPPUC cited, as for the other GeoCuritiba
  layers). The reads were inspected offline and deleted; the test fixture is synthetic.
  - 61: 17 records, all "Público Municipal", each in a different bairro, named after a writer or artist; hours, the
    collection size and the house's history in `observacao` (the queue item said the layers had no hours: most
    records do). None is in Bairro Alto: the nearest is about 3.7 km from its centre, beyond the 3 km `near` limit, so
    q139 is answered "none within 3 km" and the note points at `farol do saber` and `biblioteca`. Five history lines
    over 160 characters are cut with "…" (the hours lines come first and are whole); one birth date in them is masked
    by the generic date mask.
  - 60: 1 record (Centro), hours and the tram's history.
  - 52: 26 records: 20 "Público Municipal", 2 "Público Estadual", 2 "Público Federal" and 2 "Particular", so the
    type carries the mixed-ownership note. Many have no hours. One record's e-mail on a
    `curitiba.pr.gov.br` subdomain is shaped like a person's name; the others are venue or programme addresses or
    outside the city domain (dropped as always). The type returns no e-mail (`noEmails`) and its note says to call.
  - 57: 2 records (Lona Zé Priguiça, Parque Náutico), one programme e-mail; hours on one.
  - 58: 1 record (Centro), hours and a city e-mail shaped like a person's name: no e-mail is returned (`noEmails`).
  - Run through the parser, no line was replaced by a marker and no record was skipped. After review, `clube de
    xadrez` uses the offices' person-line filter (its lines pass it); `auditorio` does not: that filter reads
    "Atendimento Secretaria:" as a role label and would hide the real hours of two records, and no auditorium line
    named anyone. The `site` field is never
    read. No new host for the server and the link allowlist is unchanged. Since the review of
    this version the shared e-mail filter (every type, old and new) also drops a `curitiba.pr.gov.br` address whose
    local part is two or more words joined by ".", "_" or (since v0.74.0) "-" ("fulana.silva"), unless the first
    word is a unit prefix. Since v0.74.0 the first word may be a single letter ("j.silva"), each word may end in
    digits ("maria2.souza", "maria.souza2"), a number may close it ("maria.souza.2", "maria_souza_01") and "-" is a
    separator too ("ana-lima"). Since v0.78.0 separators may repeat ("maria..silva"), a middle word may be a single
    letter when the last has 2+ letters ("ana.c.lima", "joao.e.silva"), and a final
    single letter is a surname initial when the first word and the word just before it have 2+ letters
    ("maria.s", "maria.silva.s", "maria.s.2"; letter codes such as "sme.d.p.e" stay);
    exactly two single letters ("a.b") or a word and a number ("sec.2") never match. The unit prefixes are checked first and
    keep an address whose first word (trailing digits ignored) they are (biblioteca, caps, casadepassagem, ccz, cei, cmae, cmaee, cmei, cras, creas, escola, farol,
    nrgm, regional, ruadacidadania, sine, ubs, upa, us, visa). Known limits: a one-letter code before a sector
    word ("r.cic"), two acronyms joined by "-" ("sme-dpe") and, since v0.78.0, a word and a single letter ("sala.a", "ti.a", "sme.d"), a word, a letter and a number ("sec.e.2") or a connector address ("esporte.e.lazer") are dropped like names (none was read). A one-word local part shaped like a name
    ("fulanasilva") or one ending in a separator ("maria.silva.") , ending in two initials ("joao.p.s", read like the letter code "fas.n.s") or with a word starting with a number ("2maria.silva", "maria.2silva") is not caught by this rule; `noEmails` covers the two types where one was read. The v0.74.0 shapes were
    checked on 2026-11-27 against a re-read of the 89 urban-equipment layers (2,167 records, 1,765 city e-mails, 776
    distinct, one request per layer, read again for the final rule with the same counts): 1,763 are kept before and
    after, none newly hidden. The v0.78.0 shapes were checked the same way on 2026-11-27 (one re-read, same counts): 1,763 kept
    with the old rule and with the first draft of the new one (the final rule drops less than that draft and more
    than the old rule, so the count holds).
  - Live call of the built handler on 2026-11-27 from 00:31:16 UTC (3 processes, 1 request each to layer 61): `casa
    da leitura` near Bairro Alto (-25.4055, -49.2035), `radius_m` 3000: `total` 0 in 562 ms, the note naming `farol do
    saber` and `biblioteca`; with `bairro` "bacacheri": the Casa da Leitura Dario Vellozo, 5 lines, 1 phone, 1 e-mail.
- **Query:** one fixed URL per layer: `where=1=1` (since v0.60 `horta comunitaria` sends a fixed `tipo_equi` filter instead), a fixed `outFields` list (`indfiscal`, `dep_admin`, `site`,
  `globalid`, edit users and every other field are never asked for), `outSR=4326` (WGS84), `f=json`; points with
  `returnGeometry=true`; parks with `returnCentroid=true` and no geometry; bike lanes with geometry simplified
  (`maxAllowableOffset=0.00005`, about 5 m, `geometryPrecision=5`). The user's `bairro` and position never enter the
  URL or the cache key: the whole layer is read and filtered in the server. One request per call at most (none when
  cached), 6-hour cache per layer, 2 MB cap, 15 s timeout, JSON content type required, redirects only to the same host
  under `/server/rest/services`.
- **Rate and failures** (the host gate in `src/hostGate.ts`, used by `src/sources/geocuritiba.ts`): at most one request per 5 s to the host from a server process (any layer; a call whose turn is more than 10 s away returns `rate_limited` with the wait, without a request); after a failure no request for 60 s, or a 429's `Retry-After` when longer, at most 1 hour (the same error is returned instead); an ArcGIS `error` with code 401, 403, 498 or 499 (sent with HTTP 200) is a final refusal that blocks the host for 10 minutes (`blockHost` in `src/http.ts`, the same
  block as an HTTP 401/403). A cached layer never waits.
- **Fails closed** (`source_unavailable`, never an empty list) on: an `error` object (ArcGIS answers errors with HTTP
  200; codes 401, 403, 498 and 499 are a refusal, above), `exceededTransferLimit`, a spatial reference other than 4326, no `features` array, 2,000 records or more, or
  invalid JSON.
- **Fields returned:** name (`nome_completo`, else `nome`), address (`nome_rua`, `num_pred`, `compl_end`), `bairro`,
  `regional`, hours (`observacao` split by lines; in every text field 8 to 11 digits with no separator, such as
  "Tel 33334444", are masked first, then each line goes through `cleanField`: control and format characters, NFC, PII
  masking, 160 characters, at most 30 lines), `open_periods` (`func_*`: "Sim" true, "Não" false, else null),
  `updated` (`dt_atualiz` as a Curitiba date), phones, e-mails, position. When `divulgar_endereco` is not "Sim" the
  address **and** the position are null (no record had another value on 2026-11-21). Coordinates outside a box around
  Curitiba (lat −25.7 to −25.3, lon −49.45 to −49.15) are null. Bike lanes not `operacional` = 1, records without a
  name and (since v0.52) social-assistance records whose name or address mentions a shelter are skipped and counted
  (`skipped_records`).
- **Contacts (privacy):** `telefone` and `email` are not masked text but filtered by an allowlist, because some layers
  hold contacts that look personal. Survey of the 24 point layers above on 2026-11-21: Ecocidadão (associations of
  waste pickers) lists mobiles and Gmail/Hotmail addresses; Museu and Teatro list university, company and personal-name
  addresses (e.g. a `firstname.lastname@` university address); CRAS, Mercado Municipal, Sacolão and Biblioteca list
  mobiles next to landlines; Feira has one typo domain (`curitiba.pr.gpv.br`). Kept: three-digit service numbers
  ("156"), Curitiba landlines (DDD 41 or none, 8 digits starting 2–5), formatted "(41) XXXX-XXXX", and (since
  v0.59) toll-free numbers, "0800" and 6 or 7 digits however grouped, formatted "0800 XXX XXXX" or "0800 XXX XXX" (a company's or public body's line,
  never a person's own; the COHAB agencies publish one), at most 8 in all; since v0.60 a leading "WhatsApp", "Whats" or "Zap"
  word is removed from a part first (the Mesa Solidária landline is published as "WhatsApp (41) …");
  e-mails at `curitiba.pr.gov.br` or a subdomain, lowercased, at most 3. Dropped: mobiles, other area
  codes, any part not understood, and every other e-mail domain (state and federal government addresses too). A
  landline of a non-municipal institution (an association, a university) is kept. `ramal` and `site` are not read.
  The kept e-mails of all 24 point layers (136 distinct on 2026-11-21) were listed: role or unit mailboxes (CRAS,
  Conselho Tutelar, Faróis do Saber named after their patrons, cemeteries, regional offices). Known limit: the local
  part of a city address is not checked, and 2 of them could not be told apart from a person's initials and name.
  Owner decision (2026-11-22): all 136 kept, including two that may be personal staff mailboxes; they are official
  addresses published by the Prefeitura on a public map. No name detection is added.
- **Distance:** straight line; to the point, to a park's centroid (not its edge or gate), to the nearest point of a
  bike segment (local flat projection). `radius_m` at most 3,000.
- **Terms / licence:** none found on the services, the REST directory or IPPUC's GeoCuritiba pages (owner's research,
  2026-11-21). Facts only, with `source` "IPPUC / GeoCuritiba", the layer URL and `license_note` "No licence found;
  facts only; IPPUC cited."
  Owner approval (2026-11-21): publishing facts from these layers with no licence found, IPPUC cited.
- **Requests to the host on 2026-11-21:** the two layer lists (once each), 27 count queries and 27 small samples or
  contact surveys while building, three live calls of the built tool (Ecocidadão: 40 records, 26 landlines kept, no
  mobile and no webmail address returned; Parques within 3 km of the centre: 5; Estrutura Cicloviária within 3 km: 215)
  and robots.txt once; at most one request per 5 s.
- **Cultura layers (v0.20, 2026-11-23):** the six layers have the same fields as the other point layers (read from
  each layer's `?f=json`), so they use the same query, parser and contact allowlist. Every record had
  `divulgar_endereco` "Sim" and a name; `observacao` was filled in 55 of the 75 records. They include venues the city
  does not run: the Cinema layer lists commercial cinemas, and the e-mail field holds addresses of a bank's cultural
  centre, associations and cinema companies (all dropped by the allowlist). Criterion for the `mixedOwnership`
  note ("may include private or non-profit venues"): a layer whose survey showed an e-mail domain outside the
  city's (here 50, 51, 56 and 59; Museu and Teatro from the 2026-11-21 survey). Whether each such venue is private
  was not checked: the domain alone does not tell (59's is an institute). The e-mails kept by the built tool were 20
  distinct `curitiba.pr.gov.br` role or unit mailboxes (cultural centres, memorials, the Cinemateca, the Gibiteca, a
  Farol do Saber named after its patron); none was added to the 2026-11-22 owner decision's count above.
  Owner decisions (Enzo, 2026-11-23): those 20 institutional e-mails are approved, in addition to the 136 of the
  2026-11-22 decision; the `mixedOwnership` note ("confirm days and hours with the venue, not the 156") stays,
  including its change to `museu` and `teatro`.
  Requests to the host on 2026-11-23: six layer descriptions, six field surveys and six live calls of the built tool
  (one per new type, one at a time), at most one request per 5 s.
- **Bus terminals and voting places (since 0.27.0, read 2026-11-24):** urban-equipment layers 157 "Terminal Urbano"
  (22 records) and 158 "Terminal Metropolitano" (1, Guadalupe) have the same fields as the other equipment layers;
  every record had `divulgar_endereco` "Sim", `telefone` "156" (or none) and `dt_atualiz` from 2025-10-09 to
  2026-09-16. Their `observacao` lists the integrated lines (Pinheirinho 65 lines, Guadalupe 51), so up to 80 lines are
  kept for them; since 0.27.0 any longer text ends with a line saying how many were cut (before, a silent cut at 30).
  The URBS service's own terminal layer (below) was not used: it has `indfiscal` and no update date.
  Voting places: thematic layer 12 "Locais de Votação" (group Eleição; points; 422 records, all `fonte` "TRE-PR" and
  `data_alteracao` "31/08/2026"; the whole layer is about 177 KB with geometry). Fields read: `nome_local`,
  `endereco`, `bairro`, `regional`, `num_secoes`, `zona_eleitoral`, `data_alteracao`. **Never read:** `num_eleitores`
  (number of voters per place), `codigo`, `cod_tre`, `cod_zona`, `nome_mapa`, `fonte`, `last_edited_date`; the
  zone layer 13 is not used. The place names sampled were schools, colleges, faculties and clubs, no person. A point
  query at -25.4284, -49.2733 returns nothing (points never intersect a point), so the whole layer is read and
  filtered in the server (bairro, `name`, distance), as for the other types. The list cannot tell a voter their own
  place (the note says so).
- **Fixtures:** `test/fixtures/geocuritiba/feira.json`, `rua_da_cidadania.json`, `parques.json` and `ciclovia.json` are
  real records (4, 2, 3 and 4) trimmed to the fields the tool reads (plus geometry or centroid); they hold only institutional contacts ("156", landlines,
  curitiba.pr.gov.br addresses). `ecocidadao_synthetic.json` is **synthetic**, with planted cases: a mobile, a webmail
  address, a phone and an e-mail inside `observacao`, a bidi character in a name, an instruction-like line, an address
  marked not to be shown, a look-alike domain, a point outside Curitiba, 9 landlines and 40 hour lines.
  `centro_cultural_synthetic.json` (v0.20) is **synthetic**: one complete record, one with most fields missing and a
  non-municipal e-mail, and one with no name. `local_de_votacao_synthetic.json` and `terminal_synthetic.json` (v0.27)
  are **synthetic** (invented names; an impossible date; a nameless record; a 65-line `observacao`).
  `teatro.json` (v0.40) holds the real Teatro Ópera de Arame record of layer 55 as read on 2026-11-25 (a public
  venue: address, periods, institutional landline; no `observacao`) and one invented theatre ("Ficticio").

#### `ponto turistico`: Linha Turismo stops (bundled, since 0.40.0)

- **Source:** <https://linhaturismo.curitiba.pr.gov.br/onde-embarcar>, the "Onde Embarcar" page of the Prefeitura's
  Linha Turismo site (developed by the Instituto das Cidades Inteligentes). Its 25 boarding points, in page order, are
  the bundled list `TOUR_STOPS` in `src/sources/linhaTurismo.ts`. The site's own attractions page
  (`/atracoes-turisticas`, and the `POST /atracoes-turisticas/Listar` its script calls) answered "Nenhuma atração
  turística foi encontrada" when read, so the boarding points are the official list used. No licence found; only the
  stop names are kept (no description, image or audio).
- **robots.txt:** `https://linhaturismo.curitiba.pr.gov.br/robots.txt` answered 404 on 2026-11-25 05:14 UTC (no
  restriction, RFC 9309). **The server never contacts this host** (it is not in `ALLOWED_HOSTS`): the list is bundled.
  Read by hand once on 2026-11-25, 05:15–05:18 UTC, with User-Agent `curitibai-mcp/0.10 (+https://github.com/Bossmann007/curitibai)`:
  `/robots.txt`, `/atracoes-turisticas`, `/js/atracaoturistica/index.js`, `POST /atracoes-turisticas/Listar` (empty
  form), `/` and `/onde-embarcar`.
- **Lookups:** each stop's `lookup` (`{type, name}`) was matched by hand on 2026-11-25 to the record of that GeoCuritiba
  layer (museu 54, teatro 55, memorial 53, mercado municipal 2, informações turísticas 162, parks) whose name contains
  every word; 7 stops (Rua 24 Horas, Praça Tiradentes, Rua das Flores, Paço da Liberdade, Centro Cívico, Portal Italiano,
  Santa Felicidade) have no record in those layers and keep `lookup: null`. "Bosque do Papa" points to the Memorial da
  Imigração Polonesa, which the Instituto Municipal de Turismo's "Parques e Natureza" page
  (`turismo.curitiba.pr.gov.br/conteudo/parques-e-natureza/2722`, read the same morning inside its Visit-time) places
  in the Bosque João Paulo II. A test keeps every lookup type one the tool resolves.
- **Not used:** that "Parques e Natureza" page and the "Guia de Museus e Memoriais" (`/conteudo/guia-de-museus-e-memoriais/2723`)
  are prose; neither gives the Ópera de Arame's visiting hours, and GeoCuritiba gives only its periods
  (`func_manha`, `func_tarde`, `func_noite`: yes) and phone. On 2026-11-25 05:14 UTC
  `turismo.curitiba.pr.gov.br/robots.txt` answered 302 to `/Erro/404` (the events collector compares that file on
  every run; not changed here).

### `place_at_point`: IPPUC GeoCuritiba cadastral map (since 0.22.0)

- **Source:** IPPUC, GeoCuritiba ArcGIS REST, anonymous GET, `f=json`:
  <https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_GeoCuritiba_MapaCadastral/MapServer>
  (`currentVersion` 11.5, native spatial reference EPSG 31982, `maxRecordCount` 2,000; checked 2026-11-23 with curl).
  The same name at the services root (`/services/Publico_GeoCuritiba_MapaCadastral/MapServer`) answers error 499
  "Token Required" with HTTP 200; the tool uses the `GeoCuritiba/` folder only (pinned in a test), since a 499 blocks
  the host for every GeoCuritiba tool. No licence or terms found: live queries only, nothing copied to this repository
  or the `data` branch, credit "Fonte: IPPUC/GeoCuritiba" in `source`.
- **Layers used** (checked 2026-11-23): 2 Bairro (75 polygons; `nome`, `nm_regional`), 41 Áreas - Zoneamento (143
  polygons, in the group "Áreas para Empreendimentos em Parceria com a COHAB-CT (Dec. 297 / 2026)"; `sg_zona`,
  `nm_zona`, `legislacao`, `data_versao`), 36 Zoneamento Lei 15.511/2019 (223 polygons, same fields) and 12 Logradouro
  (polylines; `gtm_nm_logradouro`). Layer 41 covers about 266 of the city's 435 km² (sum of `st_area`): at 9 sample
  points it was empty at 3 where layer 36 gave ZS-2, ZI and UC, and where both answered the zone was the same and 41's
  `legislacao` added "DECRETO Nª 297 / 2026" (e.g. "LEI Nº 15511 / 2019 - DECRETO Nª 297 / 2026"). So 41 is read first
  and 36 only when 41 has no polygon at the point. Layer 3 Regional is not read: layer 2 carries `nm_regional`, and
  layer 3's `sigla` was null at the three points tried. Layer 25 (the Zoneamento group) answers error 400 to a point
  query. Example (Centro, -25.4296, -49.2713): CENTRO, REGIONAL MATRIZ, ZH-1 "ZONA HISTÓRICA 1", version 2020-08.
- **Query:** one fixed URL per layer: `geometry=<lon>,<lat>` (the point rounded to 4 decimals, about 11 m),
  `geometryType=esriGeometryPoint`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, a fixed `outFields` list,
  `returnGeometry=false`; the street layer adds `distance=100&units=esriSRUnit_Meter`, `returnGeometry=true`,
  `outSR=4326`, `geometryPrecision=6`, and the nearest line is measured in the server (straight line, local flat
  projection). The rounded point is the only user input in the URL and the cache key.
- **Requests and failures:** in order bairro, zoning 41, zoning 36 (only when 41 is empty), street; none after the
  bairro when no neighbourhood contains the point. Same host gate, timeout (15 s), cap (2 MB), redirect rule and
  refusal handling as `city_facilities_search`; each answer cached 6 hours (at most 500 entries). No request starts
  later than about 20 s after the call began. The bairro layer failing is an error; a zoning or street failure after it
  keeps what was read (`partial: true`). The gate is shared with `city_facilities_search` on purpose: after a zoning
  failure the street layer is not asked (the failure is remembered for 60 s, a refusal blocks the host for 10 minutes,
  and `note` says which), and two calls at once, or a busy host, can make the later layers miss the time budget
  (`partial`; a retry reads the cached layers). The box check runs on the rounded point. A street line keeps vertices
  outside the Curitiba box (a road can run past it); only invalid pairs are dropped.
- **Fails closed** on an `error` object (codes 401, 403, 498 and 499 are a refusal), `exceededTransferLimit`, no
  `features` array, 2,000 records or more, invalid JSON, a non-JSON content type, and, for the street layer only (the
  others return no geometry and no spatial reference), a spatial reference other than 4326.
- **Fields returned:** as published, through the same cleaning and masking as the other GeoCuritiba text fields. A
  missing field is null; a feature with none of the fields read is skipped.
- **Planta Genérica de Valores (since 0.65.0):** the `pgv` field of the `place` part reads layer 0 "Microrregião (PGV
  2025)" of <https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_GeoCuritiba_Planta_Generica_Valores/MapServer>
  (`currentVersion` 11.5, EPSG 31982, `maxRecordCount` 2,000; read 2026-11-26 23:48 UTC with User-Agent
  `curitibai-mcp/0.65`). The service has two layers: 0, the micro-regions (polygons), and 1 "Indice de Infraestrutura
  Urbana (PGV 2025)", not read. Its `description` and `copyrightText` are empty: no licence or terms found, so facts
  only, live, credit "Fonte: IPPUC/GeoCuritiba". Layer 0's fields: `chave`, `sg_zona`, `nm_zona`, `cd_microbairro`,
  `nm_bairro`, `cd_microrregiao`, `cod_vukt` and `vukt` (alias "VUKT (Valor Unit. Característico de Terreno)"), area
  and perimeter. Requested: `sg_zona`, `nm_zona`, `nm_bairro`, `cd_microbairro`, `cd_microrregiao`, in one point query
  (same URL rules as above), read last so the call budget cuts it first. Never requested: `vukt` and `cod_vukt` (the
  alias names a land unit value, but the layer publishes no unit, date or use, so the tool never shows it and never
  presents anything as the value of a property), `chave` (it is `sg_zona`-`cd_microbairro`-`cd_microrregiao`, e.g.
  "EE-27.0-0"), and no lots (lotes) or parcel layer of any service. `cd_microrregiao` alone is not an identifier: it
  is a small index inside a zone and micro-bairro (0 for 870 of the 1,062 polygons, then 1, 2, 3, and null for 34), so
  the answer gives the zone, micro-bairro and micro-region codes together. To learn this, three whole-layer queries
  without geometry were run by hand once on 2026-11-26 (a count, a count by `cd_microrregiao`, and 12 rows of the codes
  above); the tool never sends a `where` query to this layer. Example (Portão, -25.4766, -49.2925): `EE` "EIXO
  ESTRUTURAL", PORTÃO, micro-bairro 27.0, micro-region 0. Since 0.71.0 the tool also reads `cd_microbairro` as a
  number (returned in its JSON form, 27.0 as "27") and `cd_microrregiao` as text of 1 to 6 digits; the layer's field
  types were not re-read for this (no host contacted). Since 0.77.0 the `microbairro` field description gives that
  returned form ("27"), not "27.0" (no host contacted).

### `service_areas_at_point`: IPPUC GeoCuritiba thematic map, health unit areas and CRAS territories (since 0.23.0)

Since 0.32.0 this is the `service_areas` part of `place_at_point` ([ADR 0011](adr/0011-one-place-facade.md)).

- **Source:** IPPUC, GeoCuritiba ArcGIS REST, anonymous GET, `f=json`:
  <https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer>
  (`currentVersion` 11.5, layers in EPSG 31982, `maxRecordCount` 2,000; checked 2026-11-23 with curl). The same name
  at the services root answers error 499 "Token Required" with HTTP 200; the tool uses the `GeoCuritiba/` folder only
  (pinned in a test), since a 499 blocks the host for every GeoCuritiba tool. The areas are drawn by the Secretaria
  Municipal da Saúde (`fonte` "SMS-PMC") and the Fundação de Ação Social (`fonte` "Fundação de Ação Social - FAS"). No
  licence or terms found: live queries only, nothing copied to this repository or the `data` branch, credit
  "Fonte: IPPUC/GeoCuritiba (SMS e FAS)" in `source`.
- **Layers used** (checked 2026-11-23): 19 Unidade de Saúde - Abrangência (group Saúde; `nome`, `distrito`, `data`,
  `fonte`, `geometriaaproximada`) and 5 CRAS - Território (group Assistência Social; `nome`, `tipo`, `regional`,
  `data`, `fonte`, `geometriaaproximada`). Not read: `us` (an internal code, e.g. "su0"), `contrato`, `codigo`, area
  and perimeter. Example (Centro, -25.4296, -49.2713): US MÃE CURITIBANA, district MATRIZ, "março/2022", SMS-PMC; CRAS
  MATRIZ, regional MATRIZ, "MAR-2019". At a CIC point (-25.52, -49.32): US TAIZ VIVIANE MACHADO, "fevereiro/2011";
  CRAS NOSSA SENHORA DA LUZ, "MAR-2019". A point in the box outside the city (-25.35, -49.20) matched nothing in
  either layer. `geometriaaproximada` (an integer field) was null at every point tried; the tool reads 1 as true and 0 as
  false.
- **Reference dates vary by area.** `data` is a text field per polygon, not per layer: distinct values on 2026-11-23
  included "janeiro/2019", "junho/2019", "março/2021", "julho/2021" and "março/2022" in layer 19 (and "fevereiro/2011"
  at the CIC point), and "MAR-2019", "DEZ-2023" and "JAN-2025" in layer 5. The tool returns each area's own `data` as
  `reference_date`, unparsed, and its `note` always says the area may have changed since and to confirm with the
  unit, the CRAS or 156.
- **Query:** one fixed URL per layer: `geometry=<lon>,<lat>` (the point rounded to 4 decimals, about 11 m),
  `geometryType=esriGeometryPoint`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, a fixed `outFields` list,
  `returnGeometry=false`. The rounded point is the only user input in the URL and the cache key.
- **Requests and failures:** health area, then CRAS territory (2 requests, 5 s apart: both fit the 20 s budget). Since
  0.24.0 a health area means `inside_curitiba` true; when the point has none, the bairro layer (cadastral layer 2, the
  same point query and cache as `place_at_point`) is asked in between and decides (3 requests: slots 0, 5 and 10 s);
  outside, the CRAS layer is not asked. The bairro layer was not put first: that made every call 3 requests, two
  concurrent cold calls then pushed a CRAS slot past the budget, and a gap in the bairro layer would hide a health
  area. The bairro layer failing is an error. Same
  host gate, timeout (15 s), cap (2 MB), redirect rule, refusal handling and fail-closed parser as `place_at_point`;
  each answer cached 6 hours (at most 500 entries). The health layer failing is an error; a CRAS failure after it keeps
  what was read (`partial: true`). Each list has one area per name (the first row kept; a nameless row only when no row
  has a name), sorted by name, at most 3; the boundary note needs two names. A missing field is null; a feature
  with none of the fields read is skipped.
- **Why not in `place_at_point`:** that tool already makes up to 4 requests 5 s apart; two more would put the sixth
  at 25 s, past the 20 s budget, so it would come back partial wherever zoning layer 41 is empty (about 39% of the
  city), and every caller would wait 10 s more (SPEC v0.23.0).
- **Police and fire areas (`areas: "safety"`, since 0.27.0; read 2026-11-24):** layers of the Segurança group, all
  polygons with no description: 26 Polícia Militar - Área do Batalhão (5 areas), 27 Polícia Militar - Área da
  Companhia (13: `nm_comando`, `sg_comando`, `nm_batalhao`, `sg_batalhao`, `nm_companhia`, `sg_companhia`, `fonte`
  "POLÍCIA MILITAR DO PARANÁ, 2025", `data_atualizacao` "09/2025"), 25 Polícia Civil - Área Distrital (13: `tipo`,
  `nm_divisao` "Divisão Policial da Capital", `nm_distrito`, `sg_distrito`, `fonte` "POLÍCIA CIVIL DO PARANÁ"), 21
  Bombeiro - Área da Unidade (19 **statewide** battalions and independent companies; Curitiba is "1° Batalhão de
  Bombeiro Militar - Curitiba"), 42 Bombeiro - Companhia (3) and 41 Bombeiro - Pelotão (9: `batalhao`, `companhia`,
  `pelotao`, `sigla`, `fonte` "Corpo de Bombeiros Militar do Paraná, 2025"). Used: 27 (it carries the battalion of 26),
  25 and 41 (it carries the company and battalion of 42 and 21). Not used: 21 (statewide), 26, 42, `tipo` ("ÁREA DE
  ATUAÇÃO" everywhere), `bbm_cia_pel`, areas, perimeters. Example (-25.4284, -49.2733, Centro): 33º BPM Companhia
  Única; 3º Distrito Policial; Pelotão de Bombeiro Central (1ª Pel. BM, 3º Companhia, 1° Batalhão). A cold `safety`
  call took 16.0 s live (3 requests). Order: PM company first (its 13 areas cover Curitiba only; when empty the
  bairro layer decides `inside_curitiba`), then the Polícia Civil district and the fire platoon, each failure
  `partial`. An area says who covers the point, not where the nearest station is.
- **Registry areas (`areas: "registry"`, since 0.57.0; read 2026-11-26 UTC with User-Agent
  `curitibai-mcp/0.57 (+https://github.com/Bossmann007/curitibai)`):** robots.txt 404 at 19:26:36; layer metadata
  (`/16?f=json` 19:26:42, `/15?f=json` 19:26:48), one point query each in the Batel (-25.4425, -49.288; 19:27:02 and
  19:27:08) and one `returnCountOnly` query each (19:28:55, 19:29:02), at least 6 s apart. Layer 16 "Registro Civil"
  (19 polygons: `codigo`, `servicos`, `fonte`, `nome`, `geometriaaproximada`) and layer 15 "Circunscrição Imobiliária"
  (12 polygons: `codigo`, `circunscricao`, `fonte`, `nome`, `geometriaaproximada`, `created_user`, `created_date`,
  `last_edited_user`, `last_edited_date`). Empty `copyrightText` and `description`: no licence found, facts only,
  IPPUC cited, like the other GeoCuritiba layers. The Batel point answered "4º SERVIÇO DE REGISTRO CIVIL" (`fonte`
  "Leis Estaduais 4667/1962, 5409/1966, 5481/1967, 5809/1968, 8894/1988 e Acordo 10156/2005") and "6ª CIRCUNSCRIÇÃO"
  (`fonte` "Tribunal de Justiça, 1968"); `nome` and `geometriaaproximada` were null. Used: `circunscricao`,
  `servicos` and `fonte` only. Never requested: `nome` (content unknown; it could name a person), the editor fields
  `created_user` and `last_edited_user` (user names) and their dates. The layers name an area, not an office address
  or phone, and the answer is not a certidão. Order: the property layer first (when empty the bairro layer decides
  `inside_curitiba`), then the registro civil layer, whose failure is `partial`. Not in `all`: a cold `all` (care and
  safety) already uses the 5 requests that fit the 20 s call budget. A cold `registry` call of the built server took 5.2 s live
  (2 requests, 2026-11-26 19:32 UTC) and returned the same two areas.
- **Electoral zones (`areas: "civic"`, since 0.66.0; read 2026-11-27 UTC, which was still 2026-11-26 in Curitiba,
  with User-Agent `curitibai-mcp/0.66 (+https://github.com/Bossmann007/curitibai)`):** robots.txt 404 at 00:06:53;
  layer metadata (`/13?f=json`, 00:07:03); one whole-layer query with `where=1=1`, `outFields=codigo,zona_eleitoral,
  num_locais,num_secoes,data_alteracao,fonte` and `returnGeometry=false` (00:07:16), to count the zones and read their
  dates; one point query in the Boqueirão (-25.5036, -49.2386; `outFields=zona_eleitoral,num_locais,num_secoes,
  data_alteracao`, 00:07:22); and one point query of the cadastral bairro layer (`outFields=nome,nm_regional`,
  00:09:39) to confirm the point is in the Boqueirão ("BOQUEIRÃO", "REGIONAL BOQUEIRÃO"); at least 5 s apart.
  `num_eleitores` was never requested. Layer 13 "Zona Eleitoral" (polygons; fields `objectid`, `codigo`,
  `zona_eleitoral`, `num_locais`, `num_secoes`, `num_eleitores`, `data_alteracao`, `fonte`, and shape area and
  perimeter). Empty `copyrightText` and `description`: no licence found, facts only, IPPUC and TRE-PR cited, like the
  voting places (layer 12). 10 zones (1ª, 2ª, 3ª, 4ª, 145ª, 174ª to 178ª), each with `data_alteracao` "31/08/2026" and
  `fonte` "TRE-PR"; `num_locais` 35 to 49 and `num_secoes` 388 to 445, sent as doubles (45.0). The Boqueirão point
  answered "174ª" (45 places, 415 sections). Used: `zona_eleitoral`, `num_locais`, `num_secoes` and
  `data_alteracao` only; the credit names TRE-PR from the voting places' constant, so `fonte` and `codigo` are not
  requested. Never requested: `num_eleitores` (number of voters, the same rule as the voting places). The zone of an
  area is not the zone of a voter, whose título de eleitor names it. Order: the zone layer first (when empty the
  bairro layer decides `inside_curitiba`). Not in `all`: a cold `all` (care and safety) already uses the 5 requests
  that fit the 20 s call budget. A cold `civic` call of the built server took 1.6 s live (1 request, 2026-11-27
  00:14 UTC) and returned the same zone.

### `census_at_point`: IBGE 2022 census by sector, via IPPUC GeoCuritiba (since 0.27.0)

Since 0.32.0 this is the `census` part of `place_at_point` ([ADR 0011](adr/0011-one-place-facade.md)).

- **Source:** the same thematic service, group Censo Demográfico, read 2026-11-24: layer 43 "Setor Censitário - 2022"
  (3,190 sectors, all `nm_mun` "Curitiba", all `situacao` "Urbana"; `supportsStatistics` true). Layers 44
  "Densidade Populacional (IBGE 2022)" and 45 "Renda Média (IBGE 2022)" hold the same sectors with subsets of 43's
  fields, so only 43 is read. Fields read: `cd_setor`, `nm_bairro`, `v0001` (residents), `v0007` (occupied private
  households), `area_km2`, `dens_pop_km2`, `renda_media` (mean monthly nominal income of the household heads with
  income in occupied permanent private households). **Never read:** `v0005` (mean residents per household), `v0006`
  (share of imputed households), `nm_fcu`/`cd_fcu` (favela or community), the other codes and names.
- **Privacy check (2026-11-24, all 3,190 sectors without geometry, 2 pages):** 21 sectors have fewer than 5 occupied
  households, and there IBGE publishes no income (22 null `renda_media` in all); income appears from 6 households up;
  one sector has `v0007 = 1` with `v0005 = 8.0`. 29 sectors have fewer than 20 households. Floor:
  [ADR 0009](adr/0009-census-household-floor.md) (20 households for sector figures and for neighbourhood totals).
- **Queries:** the sector at the rounded point (point query, like the other areas) and, for its neighbourhood, one
  `where=nm_bairro='<name>' AND v0007 >= 20` query with `outStatistics` (sums of `v0001`, `v0007`, `area_km2` and
  the count of sectors), so withheld sectors are not in the sums (checked live: Cidade Industrial de Curitiba, 285 of
  290 sectors, 172,457 residents and 62,819 households, equal to the survey's sums over those 285). The name comes from the sector answer and must be one of the 75 IBGE names bundled in the code (IBGE
  spells "Botiatuvinha" and "Tinguí"); any other name sends nothing. Example (-25.4284, -49.2733): sector
  410690205010084, São Francisco, 231 residents, 129 households, 1,229.99 per km², R$ 4,583.33; São Francisco: 12
  sectors, 5,008 residents, 2,395 households, 1.305 km² (the statistics query matched the sum of the 12 sectors read
  in the survey). A cold call took 5.3 s live (2 requests).

### `city_calendar`: Decreto 2.385/2025 and IPTU 2026 notes (bundled, since 0.27.0)

- **Holidays:** Decreto 2.385/2025 (Diário Oficial do Município of 2025-11-11), read on 2026-11-24 at
  <https://www.normasbrasil.com.br/norma/decreto-2385-2025-curitiba_486274.html> (robots.txt 404). Art. 1 lists 19
  items for the municipal administration (direct, autarchic and foundational), keeping essential services open; art. 3
  says the SME's schools follow their own school calendar. The text was copied by hand into
  `src/tools/cityCalendar.ts` in its order. An official act (Lei 9.610/1998, art. 8, IV: not protected by copyright).
  Not checked against the Diário Oficial itself (its index pages are on `www.curitiba.pr.gov.br`, 403 to robots); the
  note says to confirm there.
- **IPTU 2026:** two Legisweb notes that mirror Prefeitura releases, read on 2026-11-24 (robots.txt allows all,
  `Crawl-delay: 10`; the two pages were read 11 s apart):
  <https://www.legisweb.com.br/noticia/?id=32497> (2026-02-03: 10% cash discount kept, due 20 March, up to ten
  instalments, about 990 thousand taxable units) and <https://www.legisweb.com.br/noticia/?id=32939> (2026-03-18:
  instalments March to December on day 20; DAM at partner banks, cash machines or internet banking, PIX or automatic
  debit, first debit on 27 March). Marked `secondary_source: true`; facts only, the notes' text is not copied.
- **Dates:** the data is of 2026 only; from 2027-01-01 (Curitiba time) the answer says `expired: true`. No network
  call, no error of its own.

### `city_calendar`: school calendars 2026 (bundled, since 0.34.0)

- **Source:** the Secretaria Municipal da Educação's page "Calendários do ano letivo 2026"
  (<https://educacao.curitiba.pr.gov.br/evento/calendarios-do-ano-letivo-2026/18401/4180>, read in its robots.txt
  Visit-time for v0.33) links three one-page PDFs, each signed "Curitiba, 30 de outubro de 2025":

  | Unit | PDF | sha256 |
  |---|---|---|
  | `escolas` ("Calendário 2026_ESCOLAS") | <https://mid-educacao.curitiba.pr.gov.br/2025/12/pdf/00522557.pdf> | `dd08e4ac591ef2ac96908c9a9fbcff4b99d042fa3c316b680846e7b348ecfe05` |
  | `cmeis` ("Calendário 2026_CMEIs") | <https://mid-educacao.curitiba.pr.gov.br/2025/12/pdf/00522558.pdf> | `1402ddb5c0cb5250c0ea1aa285fb144a2fd7d6a058f9638574a10322bd906e79` |
  | `cmaees` ("Calendário 2026_CMAEEs") | <https://mid-educacao.curitiba.pr.gov.br/2025/12/pdf/00522559.pdf> | `3641c77ea7b678a58c164a1fde340c92e903f54a4f856cf08cfb0571692f478e` |

  The CMAEE file is byte-identical to `.../2026/1/pdf/00522625.pdf`, linked from the same host.
- **How and when:** the owner approved this on 2026-11-24. The owner's assistant downloaded the three PDFs once on
  2026-11-25, 02:16–02:18 UTC (2026-11-24 in Curitiba: `checked_at` is that date), with an honest User-Agent; `mid-educacao.curitiba.pr.gov.br` has no robots.txt
  ([robots.txt findings](#robotstxt-findings)). The PDFs are not committed. `scripts/extract-school-calendar.py`
  (dev only, Python with pdfplumber, not in the package) reads them locally and writes
  `src/tools/schoolCalendarData.ts`: only the dates, holiday names, counts, URL and sha256 (facts of an official act).
- **What the PDF says and how it is read:** the meaning is in cell colours and drawn shapes. The script matches each
  cell fill to a legend swatch of the same PDF and each shape (triangle, diamond, circle, hexagon) to the legend shape
  of the same geometry, and stops on anything unmatched. One exception, reported in its output: the escolas PDF
  paints its "Conselho de Classe Anos Iniciais e Anos Finais" cells in a 50% tint of that legend swatch; a colour is
  accepted as a tint only when it is the tint of exactly one swatch. No cell carries the "Sábado de Integração com as
  Famílias" fill in any of the three PDFs, so no such Saturday is listed. The "Semana de Estudos Pedagógicos" diamond
  marks two single days (2026-02-21 and 2026-08-01), not a week. The printed holiday lists also name
  2026-03-29 (Aniversário de Curitiba, a Sunday), which has no red cell, so it is not a period.
- **School days:** the rule is not printed; it is fitted to the counts. A day with the triangle (início /
  encerramento com crianças e estudantes) is a school day; otherwise Monday to Friday is a school day unless its fill
  is férias, recesso, recessos (feriados), feriados, início/encerramento com professores or Dia do Professor; a
  Saturday is a school day only with the Sábado de Integração or Avaliação dos Parâmetros fill. The script fails
  unless the rule gives each month's printed "Letivos" and the printed total (199) for all three PDFs, and
  `test/cityCalendar.test.ts` checks the bundled copy the same way.
- **Dates:** 2026 only; from 2027-01-01 (Curitiba time) the answer says `expired: true`. No network call.

### `city_service_guide`: guides and official links for services that need a login (bundled, since 0.28.0)

The steps are written by this project and bundled in `src/tools/cityServiceGuide.ts`. The server makes no request:
it reads only the user's Carta copy (`carta-servicos.json`, as `city_services_search` does). Links, consent design and
the host allowlist: [docs/tools.md](tools.md#city_service_guide-consent-and-links) and
[ADR 0010](adr/0010-service-guides-consent-at-every-step.md). Since 0.37.0 a guide generated for any Carta service
(`carta_id`) uses fixed steps written by this project and quotes the user's copy, cleaned; no new host and no request
([ADR 0012](adr/0012-generated-carta-guides.md)).

What was requested by hand on 2026-11-24 (curl, User-Agent `curitibai-dev-check`, from the developer's machine, to
write and check the steps; a few requests per host, never by the server):

- `dig` (A records) for `www`, `servicos`, `ecidadao`, `saudeja`, `156`, `central156`, `agendaonline`, `educacao`,
  `www.urbs` and `urbs` under `curitiba.pr.gov.br`, plus `www.detran.pr.gov.br`, `detran.pr.gov.br` and
  `www.gov.br`; `cidadao`, `e-cidadao`, `agenda`, `iptu` and `cartao.urbs` under `curitiba.pr.gov.br` do not
  resolve. `dig NS curitiba.pr.gov.br`: the zone has its own name servers.
- `GET /` (status only) on each host that resolved: `www.curitiba.pr.gov.br` 403, `www.urbs` and `urbs` 403,
  `servicos.curitiba.pr.gov.br` 200 (one probe of `/`; that host's robots.txt is recorded as `Disallow: /` and it is
  still never contacted by the server or used for content), `ecidadao` 302 to `/login` (which redirects to
  `autenticacao-ecidadao.curitiba.pr.gov.br`; `/` there answered 200), `saudeja`, `156`, `agendaonline`, `educacao`
  and `www.detran.pr.gov.br` 200, `detran.pr.gov.br` 302 to `www.detran.pr.gov.br`, `www.gov.br` 301 to `/pt-br`,
  `central156` no answer.
- The page title of `saudeja`, `156`, `agendaonline` and `educacao`, and the menu links of `educacao` ("Cadastro
  Online" points to `cadastro-online.curitiba.pr.gov.br`, which answered 403). `robots.txt` of `saudeja`, `156`,
  `agendaonline` and `educacao`: status 200 only, not read; `ecidadao`: 404.
- `156.curitiba.pr.gov.br/Solicitacao/Abra-sua-solicitacao-servico-informacao-na-prefeitura-de-curitiba` and
  `www.agendamento.detran.pr.gov.br/detran-agendamento/portal`: status 200.
- Read once with a page fetcher: the home pages of `156` (e-Cidadão login, "Abrir Pedido"), `saudeja` (e-Cidadão login
  with "CPF ou número do cartão SUS" and password), `agendaonline` (a script page; its services were not visible) and
  `www.detran.pr.gov.br` (links to `www.agendamento.detran.pr.gov.br`). The Autorização Digital news page and
  `www.urbs.curitiba.pr.gov.br` answered 403 and were not read.

Not verified: which services the Agenda Online schedules; which Educação menu item is the creche-vacancy registration;
what the URBS site offers for the Cartão Transporte; the Autorização Digital page's text (date and summary from the
owner's brief). The guides say so or send the citizen to the official service page.

Lê Digital and EstaR guides (since 0.38.0, written 2026-11-25): the official pages were found by web search only
(the search engine's index, not a request from this project); `www.curitiba.pr.gov.br` was not requested, and one
`curl` status probe of `https://www.urbs.curitiba.pr.gov.br/EstaR` (browser User-Agent) answered 403, as the URBS
site does to non-browser clients. Nothing was read from either site, so each guide's `note` says which page was not
read and falls back to the Carta step and the Central 156. Used:

- `https://www.urbs.curitiba.pr.gov.br/EstaR`: indexed with the title "Est@R - URBS"; the index summary names the
  credentialed apps and sales points. Linked in the EstaR guide (step 3).
- `https://www.curitiba.pr.gov.br/noticias/curitiba-app-ganha-nova-interface-para-facilitar-acesso-aos-servicos-da-prefeitura/85129`
  (2026-09-23): already cited in [docs/tools.md](tools.md#compared-with-the-curitiba-app) for Curitiba Lê Digital
  ("plataforma gratuita acessada pelo aplicativo", more than 200 books), read in a browser on 2026-11-23. Linked in the
  Lê Digital guide (step 3).
- Index summaries of the Prefeitura's EstaR news pages (`/noticias/estar-eletronico-esclareca-suas-duvidas/57271`,
  `/noticias/motorista-que-estacionar-sem-ativar-creditos-do-estar-sera-multado/57220`) and Lê Digital news
  (`/noticias/aplicativo-da-acesso-gratuito-a-200-livros-da-literatura-universal/56086`,
  `/noticias/novas-obras-de-autores-curitibanos-estao-disponiveis-no-curitiba-le-digital/75493`): buy credits in a
  URBS-credentialed app or at a sales point, activate with plate, place and time; Lê Digital is inside the Curitiba
  App, free, with a registration and a download. Not linked. Prices, fines, hours and time limits in those summaries
  are from 2020 and 2021 and disagree, so the guides state no number and point to the street signs and the URBS page.
- Curitiba App store seller (since 0.38.1, web search on 2026-11-25, pages not read): the App Store listing
  `https://apps.apple.com/br/app/curitiba-app/id1447887852` names "Prefeitura Municipal de Curitiba" as seller in the
  index summary; for Android, no Google Play page was in the results, and the third-party tracker
  `https://appgoblin.info/apps/br.org.curitiba.ici.appcuritiba` names the same publisher for package
  `br.org.curitiba.ici.appcuritiba`. The Lê Digital guide (step 4) asks the citizen to check the seller in the store;
  no store link is given.

Defesa Civil alerts guide (`defesa_civil`, since 0.39.0, written 2026-11-25). Found by web search, then read once
each with a web fetch on 2026-11-25 (the server never contacts these hosts):

- `https://www.parana.pr.gov.br/servicos/Seguranca/Defesa-Civil/Receber-alertas-da-Defesa-Civil-por-SMS-ERrZ4PN6`
  ("Receber alertas da Defesa Civil por SMS", Governo do Paraná): "Basta enviar SMS com o CEP da sua região para o
  número 40199", "A Defesa Civil responde com mensagem de confirmação do seu cadastro", "Gratuito". Source of the
  SMS steps (6 and 7 since 0.39.1). Not linked: `www.parana.pr.gov.br` is not on the guide's link allowlist, and the allowlist was not widened.
- `https://www.gov.br/anatel/pt-br/dados/utilidade-publica/alertas-de-desastres/defesa-civil-alerta` ("Defesa Civil
  Alerta", Anatel, modified 2025-11-17): alerts reach "celulares compatíveis, conectados às redes 4G ou 5G" as a pop-up
  on the screen; its rollout table lists "04/12/2024 | Sul e Sudeste | Todos os municípios | Sistema disponível".
  The parent page `https://www.gov.br/anatel/pt-br/dados/utilidade-publica/alertas-de-desastres` says it was
  implanted for good in the South and Southeast in December 2024. Linked in step 4 (host `www.gov.br`, already allowed).
- `https://www.gov.br/pt-br/servicos/solicitar-cadastro-para-recebimento-de-avisos-e-alertas-de-desastres` (since
  0.39.1; found by web search, read once with a web fetch on 2026-11-25): its title is "Solicitar o recebimento de
  avisos e alertas de riscos de desastres e eventos adversos, da Defesa Civil", a service of the Ministério da
  Integração e do Desenvolvimento Regional, modified 2025-12-15; SMS: "Envie mensagem para o número 40199, com o CEP
  da área de interesse"; it also lists WhatsApp, Telegram and pay TV. Linked in step 5, a step of its own (host
  `www.gov.br`, already allowed), so the CEP step still opens nothing.
- Not used (not verified on an official page that loaded): a WhatsApp sign-up number, the `CONSULTAR` and `SAIR`
  SMS commands and silent-mode behaviour, seen only in news results (Bem Paraná, Correio Braziliense, Olhar Digital).
  The Prefeitura's Defesa Civil news pages (`/noticias/defesa-civil-de-curitiba-alerta-para-fortes-chuvas-nesta-sexta-feira/84977`,
  `/noticias/populacao-aprende-com-a-defesa-civil-de-curitiba-como-agir-em-extremos-climaticos/85650`) answered 403 to
  the fetch and were not read.
- INMET's warnings portal, named in the `weather_alerts` note as plain hosts with no scheme (since 0.39.1, so clients
  do not autolink a page that was not read): `avisos.inmet.gov.br`, named as "o portal oficial de AVISOS" by INMET's
  news "INMET aprimora interface de avisos meteorológicos"
  (`https://portal.inmet.gov.br/noticias/inmet-aprimora-interface-de-avisos-meteorol%C3%B3gicos`, published
  2026-06-09, read with a web fetch on 2026-11-25); and the older `alertas2.inmet.gov.br`, named in older INMET news in
  web search results, whose connection was reset by the server on 2026-11-25 (curl and web fetch). Neither portal was
  read; the server never contacts them.

Vale-Creche guide (`vale_creche`, since 0.42.0, written 2026-11-25). Requested by hand on 2026-11-25 with curl,
User-Agent `curitibai-research/1.0 (read-only; +https://github.com/Bossmann007/curitibai)`, from the developer's
machine (never by the server):

- `https://mid-educacao.curitiba.pr.gov.br/robots.txt` at 21:28:06 UTC: 404, so no rule applies (RFC 9309, 2.3.1.3).
  Then `https://mid-educacao.curitiba.pr.gov.br/2025/4/pdf/00517415.pdf`: 200, `application/pdf`, 97,747 bytes, 2
  pages, created 2025-03-11. It is **Lei municipal nº 16.492** of 11 March 2025 (Palácio 29 de Março, signed by the
  Prefeito), which creates the Programa Voucher Educacional "Vale-Creche". An official act, not protected by copyright
  (Lei 9.610/1998, art. 8, IV). Used, in the guide's own words: art. 1 (children 0 to 3 years, "em caráter
  excepcional, que estejam na fila de espera"), art. 3 (the family picks and enrols in a private school with its
  regulatory acts in force; §1 the family cannot choose between voucher and place, the SME decides by criteria set
  by decree; §2 a child moves to a CMEI place at the end of the school year), art. 4 (value set every year by decree;
  no value is stated) and art. 6 (priority: family income up to 3 state minimum wages, registered in the SME's online
  system, greater social vulnerability). Linked in step 4; the server never contacts the host. Its publication date
  in the Diário Oficial was not checked.
- Not verified: whether the program is open in 2026, its current value (a Decreto 1.030 appears in search results and
  was not read), the age range and deadlines in force, and how families are called. A web search on 2026-11-25 (the
  search engine's index) listed an SME page titled "2026 - Programa Vale - Creche"
  (`educacao.curitiba.pr.gov.br/conteudo/2026-programa-vale-creche/15690`) and a Carta page "Vale-Creche - Serviços"
  (`servicos.curitiba.pr.gov.br/vale-creche/994`); nothing from their index summaries (a value, an age, a deadline, a
  phone or an e-mail) is bundled. The guide links the Educação portal root, not the 2026 page.
- **Two requests broke this project's robots rules, by mistake, and their content was not used.** In the same command
  as each robots.txt request, before reading it, at 21:28:40 UTC: `GET /conteudo/2026-programa-vale-creche/15690` on
  `educacao.curitiba.pr.gov.br` (200, 36,141 bytes; the path is allowed, but the request was outside that host's
  `Visit-time: 0200-0600` UT, row above) and `GET /vale-creche/994` on `servicos.curitiba.pr.gov.br` (200, 4,371 bytes;
  that host is `Disallow: /`, re-read at the same time: `Request-rate: 1/5`, `Visit-time: 0400-0645`, `Disallow: /`,
  extension rules, `Allow: *.html`). Both files were deleted unread and neither page was requested again. The
  `educacao` robots.txt read at 21:28:40 UTC was the same as the row above.

Ouvidoria guide (`ouvidoria`, since 0.43.0, written 2026-11-25). Requested by hand on 2026-11-25 with curl,
User-Agent `curitibai-mcp/0.43 (+https://github.com/Bossmann007/curitibai)`, from the developer's machine (never by the
server):

- `https://mid.curitiba.pr.gov.br/robots.txt` at 21:55:04 UTC: 404, so no rule applies (RFC 9309, 2.3.1.3). Then
  `https://mid.curitiba.pr.gov.br/2024/00446690.pdf` at 21:55:08 UTC: 200, `application/pdf`, 318,716 bytes, 4 pages,
  created 2024-05-10 (Microsoft Word). It is "Ouvidoria da CGM – Guia de uso", from the Controladoria Geral do
  Município (CGM). An official document: only facts and the link are used, in this project's own words. Used: the
  Ouvidoria takes requests for information, suggestions, complaints, praise and denúncias; by subject, public
  services (Saúde, Educação, Ação Social, Meio Ambiente and others) go to the Portal Curitiba Ouve
  (`https://www.curitiba.pr.gov.br/lei13460/`) and illicit acts against the municipal administration or unethical
  conduct of servants to `falecomacgm@curitiba.pr.gov.br` (an institutional address); the three forms (identified:
  e-Cidadão account and a Central 156 protocol; confidential: e-Cidadão, personal data kept secret, the answer by the
  registered e-mail; anonymous: no account, no answer or follow-up); a denúncia can also be registered on the
  Curitiba Ouve site, where the citizen picks the identified or anonymous form (the only two the PDF's site steps
  show) and may attach photos and documents; the CGM answers within 30 days (Lei federal 13.460/2017), extendable once when
  announced. **The PDF gives no phone number for the Ouvidoria**; the guide says so and gives none. The PDF was
  deleted after reading; it is not in the repository.
- Not opened: the Portal Curitiba Ouve page (`www.curitiba.pr.gov.br`, which the project never contacts); its address
  is the one the PDF gives, and the guide's consent for that step says it was not opened. Not verified: whether these
  channels are unchanged since 2024, and whether the "Ouvidoria da CGM" is what a citizen calls the
  "Ouvidoria-Geral do Município" (the PDF does not use that name).

Ouvidoria anonymity follow-up (`ouvidoria`, since 0.69.0, written 2026-11-27). **No request was made**: no host was
contacted, by hand or by the server, so no robots.txt or terms were re-read; `mid.curitiba.pr.gov.br`,
`www.curitiba.pr.gov.br` and `servicos.curitiba.pr.gov.br` were not opened. Everything comes from the 0.43.0 record
above:

- The CGM e-mail spelling `falecomacgm@curitiba.pr.gov.br` matches the 0.43.0 record (and the constant `CGM_EMAIL`
  written from it); the PDF was not re-read.
- Registration: the record says the identified and confidential forms need an e-Cidadão account and the anonymous form
  none, and that the Curitiba Ouve site steps show only the identified and anonymous forms. The guide says so and
  says what the site asks today was not verified.
- The record gives the three forms with the denúncia channels; whether a plain reclamação (not a denúncia) can be
  anonymous is not in it, and the guide says that was not verified.
- That an e-mail shows the sender's address, so e-mail is not an anonymous channel, is this project's own
  observation, not a fact from the PDF; the guide's `what`, step 5 and `note` say so.

Ouvidoria anonymity wording (`ouvidoria`, since 0.75.0, written 2026-11-27; the Security Reviewer's R1-R5 on
0.69.0). **No request was made**: no host was contacted, by hand or by the server; `mid.curitiba.pr.gov.br`,
`www.curitiba.pr.gov.br` and `servicos.curitiba.pr.gov.br` were not opened, and the PDF was not re-read. Each changed
sentence rests on the 0.43.0 record above or is marked as the project's own:

- Step 6, "a denúncia é registrada, mas sem resposta nem acompanhamento" (was "é apurada"): the record says a denúncia
  "can also be registered" and the anonymous form has "no account, no answer or follow-up"; it does not say the
  denúncia is investigated.
- `what`, "forma anônima (sem resposta nem acompanhamento)", and step 8, "(não vale para a forma anônima, que não
  recebe resposta)" after the 30 days: the record's "anonymous: no account, no answer or follow-up".
- Step 5, "segundo o guia de 2024, que o CuritibAI não conferiu hoje no site": the record's anonymous form is the
  PDF's; the site was not opened (the "Not opened" line above).
- Step 4 and the `note`, that the anonymous form skips the registration but what the citizen writes or attaches (name,
  address, phone, a face, the location saved in a photo, the file name) can identify them: this project's own
  observation, marked "(observação do CuritibAI, não do guia de 2024)"; the record only says photos and documents
  may be attached. Since 0.79.0 step 4 says the "no registration" part in its own sentence, as the 2024 guide's
  (below).

Ouvidoria anonymity wording, second pass (`ouvidoria`, since 0.79.0, written 2026-11-27; the Security Reviewer's
R1-R3 on 0.75.0). **No request was made**: no host was contacted, by hand or by the server; `mid.curitiba.pr.gov.br`,
`www.curitiba.pr.gov.br` and `servicos.curitiba.pr.gov.br` were not opened, and the PDF was not re-read. Each changed
sentence rests on the 0.43.0 record above or is marked as the project's own:

- Step 4, "Pelo guia de 2024, a forma anônima não pede cadastro e não recebe resposta nem acompanhamento (o CuritibAI
  não conferiu isso hoje no site)": the record's "anonymous: no account, no answer or follow-up". It is the 2024
  guide's, not the project's; the Curitiba Ouve site was not opened, so what it asks today is not verified.
- Step 4, a separate sentence that starts "Observação do CuritibAI, não do guia de 2024": the text and the
  attachments (name, address, phone, a face, the location saved in a photo, the file name) can identify the
  citizen. This project's own observation; the record only says photos and documents may be attached.
- `what` ("Mesmo na forma anônima, o texto e os anexos podem identificar o cidadão") and step 5 ("O texto e os anexos
  do e-mail também podem identificar o cidadão"): the same observation, marked "(observação do CuritibAI, não do
  guia de 2024)"; the `note` says it is the project's own for the summary and steps 4 and 5.
- Tested: each step 5 sentence that names anonymity or identification (`/anônim|identific/`) carries either the
  2024-guide hedge or the project's own marker.

Ouvidoria anonymity wording, third pass (`ouvidoria`, since 0.83.0, written 2026-11-27; the Security Reviewer's R1-R2
on 0.79.0). **No request was made**: no host was contacted, by hand or by the server; `mid.curitiba.pr.gov.br`,
`www.curitiba.pr.gov.br` and `servicos.curitiba.pr.gov.br` were not opened, and the PDF was not re-read. Both changed
sentences are marked as the project's own:

- Step 4, R1: the observation now names what to leave out instead of "deixe isso de fora": "o texto e os anexos podem
  identificar o cidadão; para continuar anônimo, deixe de fora nome, endereço, telefone, rosto, a localização gravada
  na foto e o nome do arquivo". The same list as the 0.79.0 sentence, still marked "Observação do CuritibAI, não do
  guia de 2024"; the record only says photos and documents may be attached.
- Step 4, R2, a new sentence: "Observação do CuritibAI, não do guia de 2024: a forma anônima não garante anonimato, e
  o CuritibAI não sabe o que o site registra sobre o acesso." This project's own observation: the record describes
  the anonymous form (no account, no answer or follow-up), not what the site logs, and the site was not opened. The
  `note` says so.
- Tested: the step 4 sentences are pinned with their marker, and no text of the guide says "deixe isso de fora".

Ouvidoria anonymity wording, fourth pass (`ouvidoria`, since 0.85.0, written 2026-11-27; the Security Reviewer's
R1-R4 on 0.83.0). **No request was made**: no host was contacted, by hand or by the server; `mid.curitiba.pr.gov.br`,
`www.curitiba.pr.gov.br` and `servicos.curitiba.pr.gov.br` were not opened, and the PDF was not re-read. Each changed
sentence rests on the 0.43.0 record above or is marked as the project's own:

- Step 4, R1-R2: "para reduzir o risco de ser identificado, deixe de fora o que a denúncia não precisa: nome,
  endereço, telefone, rosto, a localização gravada na foto, o nome do arquivo, nomes ou rostos de outras pessoas,
  placas de carro, números de documentos, e-mail, datas ou lugares e qualquer detalhe que só você conheça" (was "para
  continuar anônimo, deixe de fora …" with the first six items). "o que a denúncia não precisa" keeps the facts a
  denúncia needs (who, when, where) out of the list (review of this PR). Still in the sentence marked "Observação do CuritibAI, não do guia de
  2024"; the record only says photos and documents may be attached.
- Step 4, R4: "Observação do CuritibAI, não do guia de 2024: o CuritibAI não pode garantir que a forma anônima
  proteja a sua identidade, e não sabe o que o site registra sobre o acesso" (was "a forma anônima não garante
  anonimato"). This project's own observation; the record describes the anonymous form, not what the site logs.
- `what`, R3, a new sentence: "O CuritibAI não pode garantir que a forma anônima proteja a identidade do cidadão
  (observação do CuritibAI, não do guia de 2024)". The same observation; the `note` names the summary and step 4.
- Hedges where a sentence named anonymity or identification without one: step 4 joins its two "Pelo guia de 2024"
  sentences into one, "o cidadão escolhe a forma (identificada ou anônima) e pode anexar fotos e documentos, e a forma
  anônima não pede cadastro e não recebe resposta nem acompanhamento (o CuritibAI não conferiu isso hoje no site)";
  `what` says "no Portal Curitiba Ouve (o CuritibAI não conferiu isso hoje no site)" after the 2024 guide's denúncia
  clause. Both rest on the record's three forms and the "Not opened" line above.
- Tested: each sentence of `what` and step 4 that names anonymity or identification (`/anônim|identific/`) carries
  either the 2024-guide hedge in the same clause ("guia de 2024 … o CuritibAI não conferiu hoje no site", no ";"
  between) or the project's own marker; no text of the guide says "continuar anônimo" or "não garante anonimato".

Prior art for 0.43.0: the existing `city_service_guide` (a new guide id in the same table, the same consent steps,
`fromDocument` from 0.42.0) and `useful_phones` (no Ouvidoria entry) are reused. No outside search for an
Ouvidoria tool was made: the change is one guide entry in an existing table.

Prior art for 0.42.0: the existing `city_service_guide` and its `creche` guide are reused (a new guide id in the same
table, the same consent steps); no tool or library for Curitiba's Vale-Creche exists to adopt.

Prior art for 0.39.0 (web search 2026-11-25, "INMET avisos alertas API MCP server"): no MCP server or library for
INMET warnings, Alerta-AS or Defesa Civil alerts; a hosted INMET MCP listing covers stations, forecasts and imagery,
not warnings; `Felipeandradee/INMET-API-REST` wraps station data. INMET's warnings are already read by
`weather_alerts` (since 0.5). Decision: reuse `weather_alerts`, build the guide.

Prior art (2026-11-24): `gh search repos "mcp server government services guide"` found nothing;
`gh search repos "topic:mcp-server gov.br"` found only unrelated general projects. Decision: build.

### URBS transport layers on GeoCuritiba (evaluated 2026-11-24, not used by the bus tools)

- **Source:** <https://geocuritiba.ippuc.org.br/server/rest/services/GeoCuritiba/URBS_Transporte_Publico/MapServer>
  (document title "URBS_Transporte_Coletivo", no description, no update date in the service or layer metadata):
  layer 0 Terminal (23 points, with `indfiscal` and `dt_inauguracao`, no `dt_atualiz`), 1 Parada de Ônibus (7,249
  points: `nome_ponto`, `num`, `lat`, `lon`, `tipo`), 2 Linha de Ônibus (665 polylines: `cod`, `nome_linha`,
  `somente_cartao`, `categoria_servico`, `nome_cor`, `shp`).
- **Compared with the URBS export of 2026-11-20** (the owner's local files): stops 7,249 against 7,248 distinct
  `NUM` in `pontosLinha`; the first 2,000 GeoCuritiba stops (by `objectid`) were all in the export (the other
  5,249 were not compared). Lines: 311 distinct codes against 309 (in the export only: X37, X43; on GeoCuritiba only:
  370, 811, X50, X51).
- **Not used:** GeoCuritiba has no timetable (`tabelaLinha`), no stop order per line and direction (`pontosLinha`
  `SEQ`, `SENTIDO`, `ITINERARY_ID`) and no update date, so `bus_departures`, `bus_line_stops` and `next_buses_near`
  still need the export, and freshness cannot be proven from the metadata. The terminals come from the
  urban-equipment layers 157 and 158 instead (above). Layer 0 is never read (it carries `indfiscal`).
- **Used since v0.29.0 by `bus_stops_near`, only when no local `pontosLinha` file exists and
  `CURITIBAI_REMOTE_DATA` is not off (`0`, `off`, `false`, `no`; since v0.30.0):** layer 1, fixed query
  `where=1=1&outFields=num,nome_ponto,tipo&returnGeometry=true&outSR=4326&geometryPrecision=6&orderByFields=objectid`
  with `resultOffset` 0, 2,000, 4,000, 6,000 and `resultRecordCount=2000` (`maxRecordCount` 2,000, pagination
  supported). Re-checked on 2026-11-24 before coding: `robots.txt` answers 404 (IIS "Not Found" page, so no rule
  applies); `returnCountOnly` gave 7,249; the four pages gave 2,000, 2,000, 2,000 and 1,249 features (311 KB, 310 KB,
  307 KB and 197 KB, 0.8–3.2 s each, 5 s apart), `exceededTransferLimit: true` on the three full pages only,
  spatial reference 4326; 7,248 distinct `num` (one repeated), every record with a name and a position inside the
  Curitiba box, 18 with `tipo` null. Guards: a short page that still says `exceededTransferLimit`, a fifth page that
  is still full, an `error` object, a spatial reference other than 4326 or anything not JSON fails closed
  (`source_unavailable`), and so does a layer that yields no stop or more than 5% unusable records (a changed shape);
  the tool never answers from part of the layer. Same host gate, cache period (the assembled layer, 6 hours) and time
  budget as the other GeoCuritiba reads; pages are kept 10 minutes so a call stopped by the budget resumes, and one
  answer never joins pages read further apart. A record without a positive integer `num`, a name or a position in the Curitiba box
  is skipped and counted; a repeated `num` keeps its first record (by `objectid`). The tool says in `data.source`
  and `note` which source answered, and that freshness cannot be proved.
- **Live check, built server, 2026-11-24** (stops within the radius; same counts from the export of 2026-11-20 and
  from the layer): Praça Tiradentes (-25.4296, -49.2713) 38 / 72 / 217 within 200 / 400 / 1,000 m, nearest stop
  101012 at 25 m; Terminal Pinheirinho (-25.5126, -49.2954) 48 / 51 / 95, nearest 105702 at 20 m. First layer call
  15.3 s (4 pages), later calls under 10 ms; export calls 35–52 ms.

### `river_levels`: ANA telemetry (stations operated by IAT-PR)

Owner approval: 2026-11-22 (river levels and rain from ANA's public telemetry; no licence found, facts only, ANA
cited, the approach the owner approved for no-licence sources).

- **Source:** ANA (Agência Nacional de Águas e Saneamento Básico) telemetry web service
  <https://telemetriaws1.ana.gov.br/ServiceANA.asmx> (ASP.NET `.asmx`, anonymous GET, XML, no key). Operation used:
  `DadosHidrometeorologicos?codEstacao=<code>&dataInicio=dd/mm/yyyy&dataFim=dd/mm/yyyy`. Answer: an ADO.NET
  `DataTable` (`xmlns="http://MRCS/"`) with an inline XML schema and one `DadosHidrometereologicos` [sic] row per
  15-minute reading, newest first: `CodEstacao`, `DataHora` ("2026-11-22 02:00:00 ", Brasília time, UTC−3, no
  daylight saving since 2019), `Vazao` (flow, m³/s), `Nivel` (level, cm), `Chuva` (rain of the interval, mm). An
  empty element (`<Vazao />`) is no value. A station with no rows answers HTTP 200 with an `ErrorTable`: "Sem dados
  para esta estação (Código: X) no período solicitado!" (the same text for a code that does not exist).
- **Scheme:** the owner's research (2026-11-21) found plain http only. On 2026-11-22 `https://` answered 200
  `text/xml; charset=utf-8` with a valid certificate (curl on macOS and Node.js 26 `fetch`), so the server uses https
  like every other host and the https-only allowlist is unchanged. If https stops working the tool returns
  `source_unavailable`; it never falls back to http.
- **robots.txt:** 404 (no rules). `dadosabertos.ana.gov.br` has `Crawl-delay: 60`; it is a different host and is not
  used. **Licence:** none found: "No licence found; facts only; ANA cited." (owner decision, 2026-11-22).
- **Live check on 2026-11-22** (one request per ≥ 5 s, period 21–22 Nov): 65010000 Fazendinha (rio Pequeno) and
  65019980 ETE Araucária (rio Iguaçu) sent 105 rows each, latest 02:00 (05:00 UTC, fetched 05:50 UTC); 02549127,
  65009000, 02549086, 02549090, 65006040 and 02549125 answered "Sem dados". The owner's researcher found 4 of 8
  stations with readings on 2026-11-21. Many stations send nothing on a given day.
- **Station list (bundled, `STATIONS` in `src/sources/ana.ts`):** never downloaded at runtime. Built once on
  2026-11-22 from `ServiceANA.asmx/ListaEstacoesTelemetricas?statusEstacoes=&origem=` (4,048,777 bytes, 5,477
  stations): every station with latitude −25.75 to −25.25 and longitude −49.55 to −49.00 (25 stations, all operated by
  IAT-PR, all "Ativo"), with `NomeEstacao`, `CodEstacao`, `NomeRio` (empty for the 0254xxxx rain gauges: `river`
  null) and `Municipio-UF` without "-PR", coordinates as published. To rebuild: download the list once, filter by
  that box (e.g. Python `xml.etree` over the `Table` rows), and replace the array with the date.
- **Matching:** `station` is a code (leading zeros optional, or the start of a code) or text in the name, river or
  municipality; nearest to `near` (default Praça Tiradentes) first; without `station`, river stations (which report a
  level) come before the 0254xxxx rain gauges.
- **Query:** one URL per station: its bundled code, `dataInicio` yesterday and `dataFim` today as Curitiba dates
  (at least 24 h of rows). User text and position never enter the URL or the cache key (`ana:<code>`).
- **Limits:** at most **3 stations per call** (N = 3): uncached, the requests start at 0, 5 and 10 s. Time budget
  (v0.18.1): no request starts later than 20 s after the call began, plus 1 s of slack for the call's first request
  starting a few ms late (only requests of other calls sharing the gate
  can push a slot that far); stations left out are listed first in `more_matches` with `partial: true` and a note.
  A station the gate refuses mid-call (`rate_limited`, v0.18.2) is handled the same way when at least one station was
  read in the call or is cached (later stations are still tried, so cached ones are returned); the call returns
  `rate_limited` only when none is available. Since v0.18.3 a final refusal (401/403 or a CAPTCHA) on a later station
  is handled the same way: the stations read are returned with `partial: true` and a note that the host refused (the
  10-minute block stays in force); `source_unavailable` only when none is available. A
  request already started is never cut, so the bound is 21 s plus the 10 s timeout. A call that joins another call's
  in-flight load of a station (or, for `guaira_events`, of robots.txt), which ran out of that other call's budget, asks
  again under its own (`underOwnBudget` in `src/hostGate.ts`). Cache 15 minutes per station; 512 KB cap (two days were about 34 KB);
  XML content type required; redirects only to the same host under `/ServiceANA.asmx`.
- **Rate and failures** (`src/hostGate.ts`, the same gate as GeoCuritiba): at least 5 s between request starts to the
  host; a call whose turn is more than 10 s away gets `rate_limited` without a request; after a failure no request
  for 60 s (a 429's `Retry-After` when longer, at most 1 hour) and the same error is returned; 401, 403 and a CAPTCHA
  429 block the host for 10 minutes (`src/http.ts`). Never retried in a loop. Inside the gate (v0.18.1), an answer
  that is not ANA's XML document (a non-XML content type, an empty body, no XML declaration, a DOCTYPE, ENTITY or
  CDATA, a root other than `DataTable xmlns="http://MRCS/"`, a truncated document; for example an HTML maintenance,
  WAF or CAPTCHA page sent with HTTP 200) is a host failure: remembered 60 s like an HTTP error, and a page with the
  CAPTCHA or challenge markers of `src/http.ts` blocks the host for 10 minutes. An XML document whose content cannot
  be read (below) marks only that station `unavailable`, is not cached, and that station is not asked again for 60 s;
  other stations are still read. A transfer or host failure (v0.18.4) leaves its station and the stations after it
  unread (the failure is remembered 60 s): the stations already read or cached are returned with `partial: true`, the
  failed ones first in `more_matches` and a note naming the failure; `source_unavailable` only when none is
  available. A station that was not read is never shown as `no_recent_data`. While the host is blocked after a
  refusal, an uncached station fails before the gate (no slot, no wait, no request).
- **Fails closed** (station `unavailable`, values null) on, inside ANA's XML document: an `Error` other than the
  exact "no data" text for the requested code, an error table next to rows, a row for another station, a row with
  nested markup or over 2,000 characters, an unparsable date or number (comma decimals included), or neither rows nor
  an error table.
- **Fields returned:** station facts from the bundled list, `reading_time` (the newest row with at least one value,
  by time, row order not trusted; rows more than 15 minutes after the read time are ignored; Curitiba time with
  `-03:00`), `level_cm`, `flow_m3s`, `rain_mm` of that reading; `rain_1h_mm` / `rain_24h_mm` (sum
  of the readings in (latest − 1 h, latest] / (latest − 24 h, latest] that have a rain value; null when none, or when
  the window starts before yesterday 00:00; gaps are not filled, so the sum is a lower bound); `stale` (latest reading
  older than 2 h, computed at answer time, not cached); `status` `no_recent_data` for the "Sem dados" answer.
- **Data quality (v0.16.1, owner request 2026-11-22):** readings are automatic telemetry that nobody has checked (ANA also
  publishes validated (consistidos) series after deeper analysis, <https://www.gov.br/ana/pt-br/assuntos/noticias-e-eventos/noticias/agencia-disponibiliza-series-historicas-de-dados-de-niveis-e-vazoes-de-estacoes-em-todo-o-pais>;
  this tool reads only the raw telemetry); a station can stop or send wrong values (stuck sensor,
  spikes, maintenance). `quality` (`ok` | `suspect` | `unknown`) and `quality_reasons` come only from the readings of
  the 24 h ending at the latest one, already read (no new request); values are never changed. Checks
  (`assessQuality` in `src/sources/ana.ts`): `out_of_range` (negative level, flow or rain, or rain over 150 mm in one
  reading; a negative level can be a legitimate gauge zero in a dry spell; the flag errs on the side of caution), `level_spike` (a jump over 100 cm between readings ≤ 15 minutes apart that comes back within 50 cm within
  1 h), `level_jump_unconfirmed` (that jump in the last hour, not back yet), `level_stuck` (identical level for ≥ 6 h and ≥ 20
  readings while ≥ 10 mm of rain fell). `unknown`: no reading, or under 8 readings in the 24 h (`too_few_readings`; level readings for a station that reports a level).
  Level and flow are not cross-checked (flow is missing at ETE Araucária and follows the level at Fazendinha). The
  thresholds are judgement calls; both real samples stay `ok` (ETE Araucária moves up to about 40 cm in 15 minutes).
  `ok` does not prove a value is right. `ok` does not cover a jump that stays (for example a flood wave rising 150 cm
  in 15 minutes, then receding slowly) or a spike whose return takes over 1 h. Not for emergencies (Defesa Civil 199); official flood alerts come from
  Defesa Civil and INMET (`weather_alerts`).

### `guaira_events`: Centro Cultural Teatro Guaíra calendar (live)

- **Source:** <https://www.teatroguaira.pr.gov.br/calendario-eventos>, the public events calendar of the Centro
  Cultural Teatro Guaíra (Governo do Paraná), a Drupal view: 15 cards per page with a "Carregar mais" link
  (`rel="next"`, `?combine=&field_categoria_target_id=All&celepar_evento_periodo_filter=All&page=N`). On 2026-11-22:
  32 cards on 3 pages (15, 15, 2; page 2 has no next link), starts from 12/11/2026 to 21/02/2027, one card in
  Cascavel (a Balé Teatro Guaíra tour), the rest in Curitiba. The listing is ordered by start and includes events
  that started earlier and are still running.
- **Listing fields read** (each card, `<li class="card ...">`): the title link `<h3><a href="/Evento/<slug>">title</a></h3>`,
  `Início: dd/mm/yyyy - HH:MM`, `Término: dd/mm/yyyy - HH:MM` and `Local: <city>- <UF>`. The listing's `Local` is the
  **city**, not the venue. The card image is never read. Titles carry HTML entities (`&quot;`), decoded before
  cleaning.
- **Event page fields read** (`/Evento/<slug>`, about 65 KB): only three lines of the body field
  (`field--name-field-texto`): `Local:` (written `<strong>Local:</strong>` or `<strong>Local</strong>:`; the same for the other two) (the venue, e.g. "Auditório Salvador de Ferrante (Guairinha)", "Auditório
  Bento Munhoz da Rocha Neto (Guairão)"), `Classificação etária:` (e.g. "14 anos") and `Ingressos:` (e.g.
  "R$20,00 (inteira) | R$10,00 (meia-entrada)"). The same body lists cast, directors, guest soloists and the
  programme; they are never read. The page also has `<time datetime>` start and end in UTC, the address of the
  venue and a "Categoria" link, not used. No JSON-LD, no .ics, no API.
- **Requests** (`src/sources/guaira.ts`): robots.txt first (cached 24 h); then the listing pages at fixed URLs only
  (the bare path, `?page=1`, `?page=2`; the next link is checked to point to the next page, never followed), at most 3
  per load, the whole listing cached 1 hour; then at most 2 uncached event pages per call, only for the items of the
  page being returned, cached 6 hours each (at most 500 pages: expired ones are swept and the oldest evicted on
  insert). The user's `text`, `city` and dates never reach the source. 1 MB cap
  (robots.txt 512 KB), 15 s timeout, `text/html` required (robots.txt `text/plain`), redirects only to the same host
  under the requested path. Time budget (v0.18.1): no event page (nor robots.txt for it) is asked for later than 20 s after the call began, plus 1 s of slack;
  those items stay `details: "not_read"`. Since v0.18.2 the listing is the complete answer and event-page details
  are an optional enrichment: items not read yet (budget, the 2-page cap, a refusal) are counted in `details_pending`
  with a note to call again for venue and price, and `partial: true` means only that listing pages are missing
  (`truncated`); since v0.18.3 `partial` is documented as a deprecated alias of `truncated`. The listing load (robots.txt and up to 3
  pages, starts at 0 to 15 s) is never cut, since a partial listing would be cached 1 hour, and a request already
  started is never cut. A cold call: 5 requests 5 s apart (the first event page at 20 s, the second left for the
  next call), about 20 s plus network time; the bound is 21 s plus the 15 s timeout.
- **Rate and failures** (the shared gate `src/hostGate.ts`, one per host): request starts at least 5 s apart per
  server process; a request whose turn is more than 10 s away is not made (`rate_limited`); after any failure inside
  `gate.run` (an HTTP error, a layout change, or a 200 event page that is not a page of the site, such as a WAF page
  without Drupal's settings script) no request for 60 s, or a 429's `Retry-After` when longer, at most 1 hour; 401,
  403, a CAPTCHA 429, or a 200 page that does not parse, is not a Drupal page of the site (no
  `drupal-settings-json` script) and matches the same CAPTCHA/challenge markers (none on the real pages) blocks the
  host 10 minutes (`blockHost`), and the gate then remembers that refusal for 10 minutes from when it saw it (it can
  outlast the `src/http.ts` block; conservative on purpose). Never retried. A robots.txt 404/410 means no rules;
  any other 4xx, a 5xx, a network error or a non-text answer fails closed (stricter than RFC 9309 on purpose). If robots.txt disallows `/calendario-eventos` the tool
  returns `source_unavailable` ("robots.txt now disallows the calendar"); if it disallows `/Evento/`, no event page
  is read.
- **Fails closed** (`layout_changed`, nothing returned) when a listing page has no single `view-content` block, no
  card, a card without exactly one title link, start, end and city, a date not `dd/mm/yyyy - HH:MM` or not real, an
  end before the start, a slug outside `[A-Za-z0-9-]`, markup inside a title, two different event links in a card, or
  a next link that does not point to the next page, a pager or "Carregar mais" without that `rel="next"` link, or a
  second `<ul>` inside the card list. Markup after the card
  list's `</ul>` is not read. A page 3 that still has a next link is returned with
  `truncated: true` and `partial: true`. An event page without exactly one body field, or with a nested `<div>` inside it, is `details: "not_recognised"`; a 404/410 page is
  `unavailable` for that event only (cached 6 h, no host failure); any other failure is `unavailable`, is remembered
  by the gate and ends event-page reading for that call (later items stay `not_read`).
- **Strict event-page values:** `venue` only when exactly one `Local:` line that ends at a line break or the end of the paragraph, list item or cell; `age_rating` only "Livre" or "N anos" (the whole value);
  `price` only a run of `R$` amounts with an optional short label in parentheses, separated by `|`, or "Gratuito",
  "Entrada gratuita", "Entrada franca"; the value must be the whole text up to a line break or the end of the
  paragraph, list item or table cell, or end a sentence (". ") before any inline tag, so "R$ 40,00 /
  R$ 20,00", "R$ 30,00 e R$ 15,00" or "Gratuito para menores..." give null, never a part; anything else (for
  example "Consulte a bilheteria") is null.
- **Privacy:** returned fields are title, start, end, city, state, venue, age rating, price and link only; every text
  goes through `cleanField` (control and format characters, NFC, the PII mask, caps of 120 characters).
- **Terms / licence:** none found on the site (owner's research and this check, 2026-11-22). Facts and links only,
  `source` "Centro Cultural Teatro Guaíra / Governo do Paraná", `license_note` "No licence found; facts and links
  only; Teatro Guaíra / Governo do Paraná cited." Owner approval (2026-11-22, task brief for v0.17.0): publishing
  facts and links from this no-licence source with that citation.
- **robots.txt** (fetched 2026-11-22 06:01 UTC; comments above the group left out):

  ```text
  User-agent: *
  # CSS, JS, Images
  Allow: /core/*.css$
  Allow: /core/*.css?
  Allow: /core/*.js$
  Allow: /core/*.js?
  Allow: /core/*.gif
  Allow: /core/*.jpg
  Allow: /core/*.jpeg
  Allow: /core/*.png
  Allow: /core/*.svg
  Allow: /profiles/*.css$
  Allow: /profiles/*.css?
  Allow: /profiles/*.js$
  Allow: /profiles/*.js?
  Allow: /profiles/*.gif
  Allow: /profiles/*.jpg
  Allow: /profiles/*.jpeg
  Allow: /profiles/*.png
  Allow: /profiles/*.svg
  # Directories
  Disallow: /core/
  Disallow: /profiles/
  # Files
  Disallow: /README.txt
  Disallow: /web.config
  # Paths (clean URLs)
  Disallow: /admin/
  Disallow: /comment/reply/
  Disallow: /filter/tips
  Disallow: /node/add/
  Disallow: /search/
  Disallow: /user/register/
  Disallow: /user/password/
  Disallow: /user/login/
  Disallow: /user/logout/
  # Paths (no clean URLs)
  Disallow: /index.php/admin/
  Disallow: /index.php/comment/reply/
  Disallow: /index.php/filter/tips
  Disallow: /index.php/node/add/
  Disallow: /index.php/search/
  Disallow: /index.php/user/password/
  Disallow: /index.php/user/register/
  Disallow: /index.php/user/login/
  Disallow: /index.php/user/logout/

  Disallow: /print/
  Disallow: /index.php/print/

  # Noticias Externas
  Disallow: /external-print/
  Disallow: /noticias/aen/

  # Login personalizado
  Disallow: /usuario/

  # Webservices
  Disallow: /webservices/
  ```

- **Requests to the host on 2026-11-22:** robots.txt, the three listing pages and two event pages, once each, at least
  5 s apart (curl, GET); then one cold call of the built tool (robots.txt, 3 listing pages, 2 event pages; 25.5 s):
  22 Curitiba events from 2026-11-22 to 2026-12-22, 1 Cascavel row left out, venue, age rating and price read for the
  first two. After the review fixes, a second cold call (`offset: 2`, `limit: 2`, 25.4 s) read two other event
  pages: the concert page gave venue, "7 anos" and "R$20,00 (inteira) | R$10,00"; the Festival Mia Cara page gave
  the venue only, because it writes `Classificação etária</strong>: Livre` (colon after the tag, now accepted) and
  `Entrada gratuita, com distribuição...` (not a whole value, so `price` stays null). That page was fetched once more
  by hand to see why.
- **Fixtures:** `test/fixtures/guaira/list_page0.html` (4 real cards: one running since 12/11, one with `&quot;` in the
  title, one on the check day, the Cascavel card; next link to page 1), `list_page1.html` (2 cards, next link to page
  2), `list_page2.html` (the real last page: 2 cards, no next link), `event_muito_barulho.html` and
  `event_concerto_osp.html` (the body field only; the guest conductor line and the programme removed) and
  `robots.txt` (the real file). Image tags and all other page markup were removed.

### `local_csv_summary`: a file the user downloaded

No network. The user downloads a file in a browser (for example the 156 CSV from the portal, about 137 MB) into the
folder named by `CURITIBAI_DATA_DIR`. The tool streams it and returns column names, row counts and grouped counts.
Data rows (after the first line) are never returned.
The values of the grouped column are returned; groups under 5 rows (3 before v0.13.2, owner decision 2026-11-21) are
counted only in `other_count` (`"<5"` when it is 1 to 4, since v0.21.3). Since v0.21.1 a filter that matches fewer
than 5 rows (0 included) returns `"<5"` as `matched_rows`. Since v0.21.3 a filter and `group_by` in one call are
refused (`filter_with_group_by_not_allowed`, owner decision 2026-11-23); what is still derivable is listed in
[ADR 0008](adr/0008-local-csv-summary-small-counts.md). Since v0.13.2 a grouped column is
refused (`column_not_allowed`) when any value that could be returned would be changed by the contact-data guard
(`guardedSummary`: CPF/CNPJ-, e-mail- or phone-shaped text, or year ranges that look like phone numbers such as
"2025 - 2026"). It does not detect names of people.

**Owner decision (2026-11-19), same rule as CNES (no person names):** `group_by` and `filter_column` are refused
(`column_not_allowed`) when the column name, accents and case ignored, matches nome, name, cpf, cnpj, rg, email/e-mail,
telefone/fone/celular, `tel`, matricula, endereco/logradouro/rua, cep, nascimento/`nasc`, servidor, beneficiario,
paciente, mae, pai, solicitante, requerente, cidadao, contribuinte, titular, responsavel, documento, identidade,
contato, whatsapp, usuario, morador, placa or inscricao (camelCase names are split into words first). The guard is
name-based and therefore not perfect, and it fails closed on look-alikes.

The first line is returned as column names. A first line that looks like data (digits, CPF/CNPJ, e-mail, phone, date,
CEP, long text) is refused with `no_header_detected`; a first line made only of text cannot be told apart from a
header and is returned as column names. This cannot be decided by a heuristic, so [docs/local-data.md](local-data.md#summarising-a-file-you-downloaded-for-example-the-156-file) tells users to use files
with a header row.

Its licence is the publisher's (portal data: CC BY 4.0 with the portal's citation rules). The automated tests use
synthetic files only. Checked on 2026-11-19 against the 2026-11-18 daily 156 file: header accepted, UTF-8, `;`
delimiter, 12 columns (the last is empty because the header ends with `;`), 0 malformed rows.

## Deferred

| Tool | Reason |
|---|---|
| `open_dataset_preview` | File hosts disallow automated access (robots.txt) and the 156 CSV is 137 MB; needs permission or an official API. The 20-row table embedded in portal detail pages also holds individual records (156 tickets with street names; the payroll dataset names people) |
| `city156_categories`, `city156_stats` | File hosts disallow automated access (robots.txt) and the 156 CSV is 137 MB. Measured: 136,902,324 bytes (2026-11-18 file), ~1 MB/s from the mirror (~140 s) and ~0.4 MB/s from `mid` (>300 s). The 156 API (`api-156.curitiba.pr.gov.br`) is not public. Owner decision (2026-11-19): no permission request will be sent; a person downloads the file and uses `local_csv_summary` |
| Bus lines, timetables, stops fetched by the server; real-time positions, fares | `www.urbs.curitiba.pr.gov.br` is out of scope (403 to non-browser clients). The URBS WebService redirects to a login page. The export mirror is treated as disallowed. Since v0.8 the bus tools read the exports from local files instead (above) |
| `schools_search`, `markets_fairs_list` | Covered since v0.9 by `city_points_search` (URBS `pois` export: feiras, Câmbio Verde, CMEIs, municipal and state schools and more), with no days or hours for feiras. The other sources are stale (below). Health units moved to the CNES API in v0.2 |
| `culture_agenda` | Covered since v0.10 by `events_search` (Instituto Municipal de Turismo calendar, local file written by the separate collector), and since v0.17 by `guaira_events` for the Teatro Guaíra (live). The portal's "Eventos PMC" stops in 2022 and the mirror's AgendaPMC in 2024 (below) |
| Private and non-profit health units | CNES names of non-public units can be people's names (see above) |
| `garbage_collection_by_street` | No published dataset or API (portal searches for "lixo", "coleta", "residuos"). Only an undocumented form exists, `coletalixo.curitiba.pr.gov.br` (owner's finding, 2026-11-21); not used |
| Detran-PR fees by vehicle, debts, fines and IPVA by plate | Behind login and CAPTCHA on Detran-PR; per-owner data. Not accessed |
| Detran-PR statistics (Qlik panel) | Interactive dashboard, not a published dataset. Not accessed |
| PNCP suppliers, contracts, price-registration minutes (`/v1/contratos`, `/v1/atas`) | Suppliers can be natural persons (CPF); `procurement_search` stays on the procurement notice, which has no supplier field |

### Sources evaluated, not used (2026-11-21)

Recorded so they are not checked again. Rows marked "owner's finding" were evaluated by the owner on 2026-11-21 and
are recorded as reported, not re-checked here.

| Source | Finding | Decision |
|---|---|---|
| "Eventos PMC" (portal dataset `471e0496-6f97-4c20-a32f-76af61372584`, daily CSV on `mid-dadosabertos`) | Regenerated daily but frozen. On the 2026-11-20 file (Latin-1, `;`-separated): 1,595 events, starts from 2015 to 2022, newest `EVE_DATA_CADASTRO` 2022-04-18 | Not used: stale |
| UFPR mirror `/curitiba/AgendaPMC/` | Files stop at 2024-12-17 | Not used: stale |
| UFPR mirror `/curitiba/FeirasCuritiba/` | Newest file 2017-03-29 (`.xls`) | Not used: stale |
| Portal searches "Feiras" and "Escolas" | 0 datasets | Feiras, Câmbio Verde and schools come from the URBS `pois` export via `city_points_search` (no days or hours for feiras) |
| UFPR mirror `/curitiba/MobiliarioUrbano/` | Newest data 2014 (owner's finding) | Not used: stale |
| UFPR mirror `/curitiba/PesquisaLinhaTurismo/` | Newest data 2013/2014 (owner's finding) | Not used: stale |
| UFPR mirror `/curitiba/UnidadesAtendimentoCuritiba/` | Newest data 2022 (owner's finding) | Not used: stale |
| EstaR (parking) and air quality | No open source found (owner's finding) | Not used as data; EstaR has a hand-written `city_service_guide` since 0.38.0 |
| Garbage collection (`coletalixo.curitiba.pr.gov.br`) | Only an undocumented form, no dataset or API (owner's finding) | Not used |
| `Sigesguarda` (Guarda Municipal) and `PretendentesCohab` (housing applicants) datasets | Personal-data risk (owner's finding) | Avoided |
| URBS mirror `dadosabertos.c3sl.ufpr.br/curitibaurbs/` | Daily exports since 2017: `linhas`, `pois`, `pontosLinha`, `shapeLinha`, `tabelaLinha`, `tabelaVeiculo`, `trechosItinerarios`, `veiculos`. Root `/robots.txt` 404, none in `/curitibaurbs/`; `/curitiba/robots.txt` asks `Request-rate: 1/5` (and `Disallow: /`, table above) | Treated as disallowed; never fetched. `linhas`, `pontosLinha`, `tabelaLinha` and `pois` are read from local copies a person downloads; the other four are not used |

### Bus alternative checked, not adopted

- **urbs-gtfs** (`github.com/benaytms/urbs-gtfs`, pipeline code Apache-2.0): one release, tag `latest`, asset
  `gtfs_curitiba.zip` (11,568,234 bytes, sha256 `0af00b386fb42dce75b014afff8ae9caf31c45bcd0ce2af1c434bffbe11fdf42`,
  published 2026-10-27). Its README says the data is built from C3SL/UFPR open data "subject to their terms", which is
  the host disallowed above. `feed_info.txt` has `feed_end_date` 20261102, so the feed **expired on 2026-11-02**.
  No release since 2026-10-27, although the project describes itself as weekly.
- **gtfs-mcp** (`github.com/jdamcd/gtfs-mcp`, MIT): a generic GTFS MCP server. Not run here.
