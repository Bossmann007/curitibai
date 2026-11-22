# Sources

Checked live on **2026-11-19** from a Brazilian IP with the server's own client: Node.js `fetch`,
User-Agent `curitibai-mcp/0.1`, redirects followed by hand. The CNES API (v0.2) was checked the same day with curl and
User-Agent `curitibai-mcp/0.2`. The PNCP Consulta API (v0.3) was checked the same day with curl and User-Agent
`curitibai-mcp/0.3`. The INMET API (v0.5) was checked the same day with curl and User-Agent `curitibai-mcp/0.5`. The
Overpass API instances (v0.7) were checked on 2026-11-21 (UTC) with curl and User-Agent `curitibai-mcp/0.7`. The
"Imuniza Já" vaccination page (v0.12) was checked on 2026-11-21 (UTC) with curl and then with Node.js `fetch` and
User-Agent `curitibai-mcp/0.7`. IPPUC's GeoCuritiba services (v0.15) were checked on 2026-11-21 (UTC) with curl and
User-Agent `curitibai-mcp/0.7`, at most one request per 5 s. ANA's telemetry web service (v0.16) was checked on
2026-11-22 (UTC) with curl and Node.js `fetch`, at most one request per 5 s (one research check on 2026-11-21 by the
owner's researcher, recorded as reported).

**Rule applied:** a host is contacted only if its robots.txt allows it. Hosts with `Disallow: /` are never fetched,
not even inside the visit hours they list. The browser User-Agent is never imitated.

**Collection rules** (since v0.13.2, also in the README "Privacy and safety"):

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
| `pncp.gov.br` (Portal Nacional de Contratações Públicas) | 404 with the portal's HTML page as body (rechecked 2026-11-19 with curl, User-Agent `curitibai-mcp/0.3`; the first two attempts were connection resets, the third answered 404) | No restriction (RFC 9309). **Contacted** (v0.3, `procurement_search`, `/api/consulta` only) |
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
| `geocuritiba.ippuc.org.br` (IPPUC, GeoCuritiba ArcGIS server) | 404, `text/html; charset=utf-8` (checked 2026-11-21 23:16 UTC with curl, User-Agent `curitibai-mcp/0.7`; also reported 404 by the owner's research the same day) | No restriction (RFC 9309). **Contacted** (v0.15, `city_facilities_search`, fixed layer queries under `/server/rest/services` only, each layer at most once per 6 hours per server process; at most one request per 5 s to the host from a server process (any layer; a call whose turn is more than 10 s away returns `rate_limited` with the wait, without a request); after a failure no request for 60 s, or a 429's `Retry-After` when longer, at most 1 hour (the same error is returned instead); an ArcGIS `error` with code 401, 403, 498 or 499 (sent with HTTP 200) is a final refusal that blocks the host for 10 minutes) |
| `telemetriaws1.ana.gov.br` (ANA, Agência Nacional de Águas e Saneamento Básico, telemetry web service) | 404 (checked 2026-11-21 by the owner's researcher and again 2026-11-22 05:50 UTC with curl) | No restriction (RFC 9309). **Contacted** (v0.16, `river_levels`, `/ServiceANA.asmx/DadosHidrometeorologicos` only, bundled station codes, each at most once per 15 minutes per process) |
| `dadosabertos.ana.gov.br` (ANA open-data portal) | `Crawl-delay: 60` (owner's researcher, 2026-11-21) | Another host; **never contacted** |
| `www.curitiba.pr.gov.br` | 200 (robots.txt read on 2026-11-19): `User-agent: *`; disallows `/App`, `/bin`, `/Cache`, `/Imagem`, `/Include` and some extensions (`*.pdf`, `*.asp`, `*.jpg`, ...); `/dadosabertos/` and `/servicos/` are **not disallowed** | **The server never contacts this host**: on 2026-11-19 it was observed answering HTTP 403 to non-browser clients. `city_services_search` (v0.6) reads only a local copy of the `/servicos/` listing pages that you save yourself; no copy is in this repository |
| `servicos.curitiba.pr.gov.br` (Carta de Serviços detail pages) | Checked 2026-11-19: `Disallow: /` | **Disallowed. Never contacted**; the local copy holds no detail-page content. `city_services_search` returns these URLs (from the local file) only as links for people to open |
| `www.urbs.curitiba.pr.gov.br` | 404 | Out of scope, same reason. Not contacted |
| `www.detran.pr.gov.br` (Detran-PR) | 200 (checked 2026-11-19 with curl, User-Agent `curitibai-dev-check`): `User-agent: *`; disallows, among others, `/core/`, `/profiles/`, `/admin/`, `/search/`, four `/user/...` paths (register, password, login, logout), `/print/`, `/external-print/`, `/noticias/aen/`, `/usuario/`, `/celepar-captcha-audio/`, `/webservices/`, `/virada.html`. `/`, `/unidades`, `/Noticia/`, `/Pagina/` and `/servicos/` are **not disallowed** (no explicit Allow either) | Read by hand once for `detran_pr_info` (v0.4): the home page, `/unidades` and three `/Noticia/` pages. **The server never contacts it**: the data is bundled |
| `turismo.curitiba.pr.gov.br` (Instituto Municipal de Turismo, events calendar) | 200, fetched once on 2026-11-21 with the collector's User-Agent (`text/plain`, no charset, Latin-1 comments, `Last-Modified: Tue, 08 Sep 2026`); its only group is `User-agent: *`, recorded in full under "Events" below | Allowed inside the visit hours. **The server never contacts it.** Only the separate collector `scripts/fetch-events.mjs` (v0.10) does, 02:00–05:50 UTC, one request per 5 s, after comparing the whole robots.txt group with the recorded one on every run |
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
| Behavior | Accents match literally: "saude" and "transporte" match; "onibus", "feira(s)", "escola(s)", "lixo", "residuos" return nothing. Filtered pages take 1–6 s. Unfiltered pages 2–3 took 20–40+ s |
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
| What the server does | Requests active units only (`status=1`), at most 5 pages per call, reports how many records it `discarded` as non-public or incomplete, filters names client-side (accents and case ignored), and resolves `unit_type` text through `/cnes/tipounidades` (one code → sent as `codigo_tipo_unidade`; several → filtered client-side) |
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
| Rate limits | None documented in the pages that could be read, no rate-limit headers on 200 responses. **But the API answered HTTP 429** once, after about 20 requests in two minutes (headers of that response not captured); the same request answered 200 a minute later. The server sends at most 2 upstream requests per call, sequentially, and retries a request once after a connection error (not after a timeout). An HTTP 429 is returned as `rate_limited` (the message gives the `Retry-After` wait, or about 1 minute), retried once only when `Retry-After` is 5 s or less. The second page is requested only if the first took under 15 s, counting any 429 retry wait; when that budget stops the scan, `note` says so. A 429 on the second page keeps the first page as `partial`, with the wait in `note` (also for CNES and the portal search) |
| Terms / licence | No terms of use for the API were found: `https://pncp.gov.br/app/termos-de-uso` is the single-page app's fallback page, and the app bundle has no terms text. The PNCP site on gov.br (`https://www.gov.br/pncp/pt-br`, its "Dados Abertos" page `https://www.gov.br/pncp/pt-br/acesso-a-informacao/copy_of_dados-abertos`) says "Todas as buscas podem ser feitas sem necessidade de cadastro ou login" and its footer says "Todo o conteúdo deste site está publicado sob a licença Creative Commons Atribuição-SemDerivações 3.0 Não Adaptada" (**CC BY-ND 3.0**; it covers the site, and no other licence names the API data). Nothing found forbids automated access. The server attributes the source in `license_note` |
| Notice | gov.br/pncp communiqué Nº 11/26 (2026-11-17): after a Spring Boot update, API URLs must not end with `/` (HTTP 404); in production from 2026-12-17. The URL above has no trailing slash |
| Modality codes | From `GET https://pncp.gov.br/api/pncp/v1/modalidades` (the domain service the manual's section 7.4 points to), 20 codes: 1 Leilão - Eletrônico, 2 Diálogo Competitivo, 3 Concurso, 4 Concorrência - Eletrônica, 5 Concorrência - Presencial, 6 Pregão - Eletrônico, 7 Pregão - Presencial, 8 Dispensa, 9 Inexigibilidade, 10 Manifestação de Interesse, 11 Pré-qualificação, 12 Credenciamento, 13 Leilão - Presencial, 14 Inaplicabilidade da Licitação, 15 Chamada pública, 16 Concorrência – Eletrônica Internacional, 17 Concorrência – Presencial Internacional, 18 Pregão – Eletrônico Internacional, 19 Pregão – Presencial Internacional, 20 Diálogo Competitivo Internacional |
| Status codes | Manual 7.13 (`tabelas_de_dominio/situacao_da_contratacao.html`): 1 Divulgada no PNCP, 2 Revogada, 3 Anulada, 4 Suspensa |
| Public page | `https://pncp.gov.br/app/editais/<cnpj>/<ano>/<sequencial>`: the app's `editais` route with child path `:cnpj/:ano/:sequencial` (read from the app bundle `src_app_pages_consultas_consultas_module_ts`). Built from validated digits; `linkSistemaOrigem` (free text, sometimes without a scheme) is never returned |
| Fixtures | **Synthetic**: `test/fixtures/pncp_contratacoes_synthetic.json` has the real JSON shape. The CNPJs and names of the listed bodies (and of the excluded test body) are the real public ones, because the allowlist needs them; every other value is invented, with planted supplier keys, a CPF, an e-mail, a phone and person names so the tests can prove they never leave |

Research-only requests on 2026-11-19 (not made by the code): `/api/pncp/v1/modalidades`, `/api/pncp/v3/api-docs`, one
`/api/search/` query, the app's JavaScript bundles, the manual pages, and a walk of every result page for modalities 4,
6, 8, 9, 11 and 12 (62 pages of 50, one request at a time), plus page 1 of every other modality code (1–20) to list the bodies below.

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
  `status.json`. `status.json` records `attempt`, `success` (the last successful run) and
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
  Atendimento URBS (11), 162 Posto de Informações Turísticas (3), 163 Feira Turística (27); FeatureServer 0 Estrutura
  Cicloviária (838, all `operacional` 1 and `situacaofisica` 5 "Construída") and 1 Parques e Bosques (53). The
  largest answer was about 250 KB (layer 0 with simplified geometry). Layers left out on purpose: health units (see
  `health_units_search`), schools, bus terminals, police, administrative offices and every other layer not in the
  list (not surveyed).
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
- **Fixtures:** `test/fixtures/geocuritiba/feira.json`, `rua_da_cidadania.json`, `parques.json` and `ciclovia.json` are
  real records (4, 2, 3 and 4) trimmed to the fields the tool reads (plus geometry or centroid); they hold only institutional contacts ("156", landlines,
  curitiba.pr.gov.br addresses). `ecocidadao_synthetic.json` is **synthetic**, with planted cases: a mobile, a webmail
  address, a phone and an e-mail inside `observacao`, a bidi character in a name, an instruction-like line, an address
  marked not to be shown, a look-alike domain, a point outside Curitiba, 9 landlines and 40 hour lines.

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
- **Limits:** at most **3 stations per call** (N = 3): uncached, the requests start at 0, 5 and 10 s, and with the
  10 s timeout the worst case is about 30 s. Cache 15 minutes per station; 512 KB cap (two days were about 34 KB);
  XML content type required; redirects only to the same host under `/ServiceANA.asmx`.
- **Rate and failures** (`src/hostGate.ts`, the same gate as GeoCuritiba): at least 5 s between request starts to the
  host; a call whose turn is more than 10 s away gets `rate_limited` without a request; after a failure no request
  for 60 s (a 429's `Retry-After` when longer, at most 1 hour) and the same error is returned; 401, 403 and a CAPTCHA
  429 block the host for 10 minutes (`src/http.ts`). Never retried in a loop. Only the transfer runs inside the gate:
  an answer that cannot be read (below) marks that station `unavailable` and is not remembered as a host failure nor
  cached. A transfer or host failure fails the whole call, so a station that was not read is never shown as
  `no_recent_data`.
- **Fails closed** (station `unavailable`, values null) on: a non-XML content type, an empty body, no XML declaration, a DOCTYPE,
  ENTITY or CDATA, a root other than `DataTable xmlns="http://MRCS/"`, a truncated document, an `Error` other than the
  exact "no data" text for the requested code, an error table next to rows, a row for another station, a row with
  nested markup or over 2,000 characters, an unparsable date or number (comma decimals included), or neither rows nor
  an error table.
- **Fields returned:** station facts from the bundled list, `reading_time` (the newest row with at least one value,
  by time, row order not trusted; rows more than 15 minutes after the read time are ignored; Curitiba time with
  `-03:00`), `level_cm`, `flow_m3s`, `rain_mm` of that reading; `rain_1h_mm` / `rain_24h_mm` (sum
  of the readings in (latest − 1 h, latest] / (latest − 24 h, latest] that have a rain value; null when none, or when
  the window starts before yesterday 00:00; gaps are not filled, so the sum is a lower bound); `stale` (latest reading
  older than 2 h, computed at answer time, not cached); `status` `no_recent_data` for the "Sem dados" answer.

### `local_csv_summary`: a file the user downloaded

No network. The user downloads a file in a browser (for example the 156 CSV from the portal, about 137 MB) into the
folder named by `CURITIBAI_DATA_DIR`. The tool streams it and returns column names, row counts and grouped counts.
Data rows (after the first line) are never returned.
The values of the grouped column are returned; groups under 5 rows (3 before v0.13.2, owner decision 2026-11-21) are
counted only in `other_count`, so a filter plus a group-by cannot reveal one record. Since v0.13.2 a grouped column is
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
header and is returned as column names. This cannot be decided by a heuristic, so the README tells users to use files
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
| `culture_agenda` | Covered since v0.10 by `events_search` (Instituto Municipal de Turismo calendar, local file written by the separate collector). The portal's "Eventos PMC" stops in 2022 and the mirror's AgendaPMC in 2024 (below) |
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
