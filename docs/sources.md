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
| `apiprevmet3.inmet.gov.br` (INMET forecast and warnings API) | 404, body `HttpException: E_ROUTE_NOT_FOUND: Route not found GET /robots.txt` (checked 2026-11-19 with curl, User-Agent `curitibai-mcp/0.5`) | No restriction (RFC 9309). **Contacted** (v0.5, `weather_forecast` and `weather_alerts`, two paths only) |
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
| `geocuritiba.ippuc.org.br` (IPPUC, GeoCuritiba ArcGIS server) | 404, `text/html; charset=utf-8` (checked 2026-11-21 23:16 UTC with curl, User-Agent `curitibai-mcp/0.7`; also reported 404 by the owner's research the same day) | No restriction (RFC 9309). **Contacted** (v0.15, `city_facilities_search`, fixed layer queries under `/server/rest/services` only, each layer at most once per 6 hours per server process; at most one request per 5 s to the host from a server process (any layer; a call whose turn is more than 10 s away returns `rate_limited` with the wait, without a request); after a failure no request for 60 s, or a 429's `Retry-After` when longer, at most 1 hour (the same error is returned instead); an ArcGIS `error` with code 401, 403, 498 or 499 (sent with HTTP 200) is a final refusal that blocks the host for 10 minutes). Since v0.22 also `place_at_point`: point queries on the cadastral map service, and since v0.23 `service_areas_at_point`: point queries on the thematic map service (since v0.24 also the cadastral bairro layer when no health area contains the point), both with the point rounded to 4 decimals, through the same host gate. Rechecked 2026-11-24 21:00 UTC (404, IIS HTML page): since v0.27 also the thematic layers 12 (voting places, whole layer), 25, 27 and 41 (police and fire areas, point queries) and 43 (census sector, point query and one `outStatistics` query per neighbourhood), and the urban-equipment layers 157 and 158 (bus terminals) |
| `telemetriaws1.ana.gov.br` (ANA, Agência Nacional de Águas e Saneamento Básico, telemetry web service) | 404 (checked 2026-11-21 by the owner's researcher and again 2026-11-22 05:50 UTC with curl) | No restriction (RFC 9309). **Contacted** (v0.16, `river_levels`, `/ServiceANA.asmx/DadosHidrometeorologicos` only, bundled station codes, each at most once per 15 minutes per process) |
| `dadosabertos.ana.gov.br` (ANA open-data portal) | `Crawl-delay: 60` (owner's researcher, 2026-11-21) | Another host; **never contacted** |
| `www.curitiba.pr.gov.br` | 200 (robots.txt read on 2026-11-19): `User-agent: *`; disallows `/App`, `/bin`, `/Cache`, `/Imagem`, `/Include` and some extensions (`*.pdf`, `*.asp`, `*.jpg`, ...); `/dadosabertos/` and `/servicos/` are **not disallowed** | **The server never contacts this host**: on 2026-11-19 it was observed answering HTTP 403 to non-browser clients. `city_services_search` (v0.6) reads only a local copy of the `/servicos/` listing pages that you save yourself; no copy is in this repository |
| `servicos.curitiba.pr.gov.br` (Carta de Serviços detail pages) | Checked 2026-11-19: `Disallow: /` | **Disallowed. Never contacted**; the local copy holds no detail-page content. `city_services_search` returns these URLs (from the local file) only as links for people to open |
| `www.urbs.curitiba.pr.gov.br` | 404 | Out of scope, same reason. Not contacted |
| `www.detran.pr.gov.br` (Detran-PR) | 200 (checked 2026-11-19 with curl, User-Agent `curitibai-dev-check`): `User-agent: *`; disallows, among others, `/core/`, `/profiles/`, `/admin/`, `/search/`, four `/user/...` paths (register, password, login, logout), `/print/`, `/external-print/`, `/noticias/aen/`, `/usuario/`, `/celepar-captcha-audio/`, `/webservices/`, `/virada.html`. `/`, `/unidades`, `/Noticia/`, `/Pagina/` and `/servicos/` are **not disallowed** (no explicit Allow either) | Read by hand once for `detran_pr_info` (v0.4): the home page, `/unidades` and three `/Noticia/` pages. **The server never contacts it**: the data is bundled |
| `turismo.curitiba.pr.gov.br` (Instituto Municipal de Turismo, events calendar) | 200, fetched once on 2026-11-21 with the collector's User-Agent (`text/plain`, no charset, Latin-1 comments, `Last-Modified: Tue, 08 Sep 2026`); its only group is `User-agent: *`, recorded in full under "Events" below | Allowed inside the visit hours. **The server never contacts it.** Only the separate collector `scripts/fetch-events.mjs` (v0.10) does (run by the user or, since v0.18, by the nightly GitHub workflow), 02:00–05:50 UTC, one request per 5 s, after comparing the whole robots.txt group with the recorded one on every run |
| `www.teatroguaira.pr.gov.br` (Centro Cultural Teatro Guaíra, Governo do Paraná, served by CELEPAR) | 200, `text/plain`, `Last-Modified: Fri, 20 Mar 2026 14:42:12 GMT`, fetched 2026-11-22 06:01 UTC with curl, User-Agent `curitibai-mcp/0.7`. One group, `User-agent: *` (Drupal default: allows CSS/JS/images under `/core/` and `/profiles/`, disallows `/core/`, `/profiles/`, `/README.txt`, `/web.config`, `/admin/`, `/comment/reply/`, `/filter/tips`, `/node/add/`, `/search/`, four `/user/...` paths, their `/index.php/` forms, `/print/`, `/external-print/`, `/noticias/aen/`, `/usuario/`, `/webservices/`); no `Crawl-delay`, no `Visit-time`, no `Request-rate` (full group in the `guaira_events` section) | `/calendario-eventos` and `/Evento/` allowed. **Contacted** (v0.17, `guaira_events`); robots.txt is re-read every 24 h by the server, which stops if the calendar becomes disallowed |
| `raw.githubusercontent.com` (GitHub raw file host; this repository's `data` branch) | 404, `text/plain` "404: Not Found" (checked 2026-11-22 06:55 UTC with curl) | No restriction (RFC 9309). **Contacted** (v0.18, `events_search` and `useful_phones`), only for the three fixed files `/Bossmann007/curitibai/data/events/events.json`, `/Bossmann007/curitibai/data/phones/phones.json` and `/Bossmann007/curitibai/data/phones/status.json` (v0.18.1), published by this project's own nightly workflow (below) |
| `piloto-cbs.tributos.gov.br` (Receita Federal, pilot "calculadora de tributos do consumo") | 404 (reported in the v0.21.0 brief, 2026-11-23; no rules) | No restriction (RFC 9309). **Contacted** (v0.21, `tax_reform_curitiba`), only fixed `GET` routes under `/servico/calculadora-consumo/api/calculadora/dados-abertos/`, at most one request per 5 s |
| `lp.curitiba.pr.gov.br` (Prefeitura, NFS-e page `/notanacional`) | Has a `Visit-time` 0400-0645 UTC rule (v0.21.0 brief, 2026-11-23) | **The server never contacts it**: `tax_reform_curitiba` carries a fixed, dated note read by hand |
| `www.normasbrasil.com.br` (copy of Decreto 2.385/2025) | 404 (HTML "Página não encontrada", checked 2026-11-24 21:2x UTC with curl, User-Agent `curitibai-mcp/0.7`) | No restriction (RFC 9309). Read by hand once (one page, `/norma/decreto-2385-2025-curitiba_486274.html`). **The server never contacts it**: `city_calendar` carries the dated list |
| `www.legisweb.com.br` (Legisweb news, IPTU 2026 notes) | 200 (checked 2026-11-24 with curl): `User-Agent: *`, `Disallow:` (empty: everything allowed), `Crawl-delay: 10` | Allowed. Read by hand once (`/noticia/?id=32497` and `?id=32939`, 11 s apart). **The server never contacts it**: `city_calendar` carries the dated rule |
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
emergency note), EQUIPAMENTOS URBANOS (5), and any category not in the allowlist above, including a new or renamed
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
- **Not covered:** the page has no Ouvidoria entry, and it was not compared with the Curitiba App's own list.

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
  `0`/`off`, it reads
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
  `health_units_search`), schools, bus terminals, police, administrative offices and every other layer not in the
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
- **Query:** one fixed URL per layer: `where=1=1`, a fixed `outFields` list (`indfiscal`, `dep_admin`, `site`,
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
  Curitiba (lat −25.7 to −25.3, lon −49.45 to −49.15) are null. Bike lanes not `operacional` = 1 and records without a
  name are skipped and counted (`skipped_records`).
- **Contacts (privacy):** `telefone` and `email` are not masked text but filtered by an allowlist, because some layers
  hold contacts that look personal. Survey of the 24 point layers above on 2026-11-21: Ecocidadão (associations of
  waste pickers) lists mobiles and Gmail/Hotmail addresses; Museu and Teatro list university, company and personal-name
  addresses (e.g. a `firstname.lastname@` university address); CRAS, Mercado Municipal, Sacolão and Biblioteca list
  mobiles next to landlines; Feira has one typo domain (`curitiba.pr.gpv.br`). Kept: three-digit service numbers
  ("156") and Curitiba landlines (DDD 41 or none, 8 digits starting 2–5), formatted "(41) XXXX-XXXX", at most 8;
  e-mails at `curitiba.pr.gov.br` or a subdomain, lowercased, at most 3. Dropped: mobiles, 0800 numbers, other area
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

### `service_areas_at_point`: IPPUC GeoCuritiba thematic map, health unit areas and CRAS territories (since 0.23.0)

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

### `census_at_point`: IBGE 2022 census by sector, via IPPUC GeoCuritiba (since 0.27.0)

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

### `city_service_guide`: guides and official links for services that need a login (bundled, since 0.28.0)

The steps are written by this project and bundled in `src/tools/cityServiceGuide.ts`. The server makes no request:
it reads only the user's Carta copy (`carta-servicos.json`, as `city_services_search` does). Links, consent design and
the host allowlist: [docs/tools.md](tools.md#city_service_guide-consent-and-links) and
[ADR 0010](adr/0010-service-guides-consent-at-every-step.md).

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
- **Used since v0.29.0 by `bus_stops_near`, only when no local `pontosLinha` file exists:** layer 1, fixed query
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
| EstaR (parking) and air quality | No open source found (owner's finding) | Not used |
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
