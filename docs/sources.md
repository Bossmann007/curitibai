# Sources

Checked live on **2026-11-19** from a Brazilian IP with the server's own client: Node.js `fetch`,
User-Agent `curitibai-mcp/0.1`, redirects followed by hand. The CNES API (v0.2) was checked the same day with curl and
User-Agent `curitibai-mcp/0.2`. The PNCP Consulta API (v0.3) was checked the same day with curl and User-Agent
`curitibai-mcp/0.3`. The INMET API (v0.5) was checked the same day with curl and User-Agent `curitibai-mcp/0.5`. The
Overpass API instances (v0.7) were checked on 2026-11-21 (UTC) with curl and User-Agent `curitibai-mcp/0.7`.

**Rule applied:** a host is contacted only if its robots.txt allows it. Hosts with `Disallow: /` are never fetched,
not even inside the visit hours they list. The browser User-Agent is never imitated.

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
| `dadosabertos.c3sl.ufpr.br` (UFPR mirror) | `/robots.txt` 404, but `/curitiba/robots.txt` has the same text as above (`Disallow: /`) | **Treated as disallowed. Never fetched**, `/curitibaurbs/` included: the bus tools (v0.8) read URBS files a person downloads from there in a browser |
| `www.curitiba.pr.gov.br` | 200 (checked 2026-11-19): `User-agent: *`; disallows `/App`, `/bin`, `/Cache`, `/Imagem`, `/Include` and some extensions (`*.pdf`, `*.asp`, `*.jpg`, ...); `/dadosabertos/` and `/servicos/` are **not disallowed** | The host answers 403 to non-browser clients such as curl, so **the server never contacts it**. For the owner's local copy used by `city_services_search` (v0.6), the `/servicos/` listing pages were read on 2026-11-19/20 with a scripted browser session (a real browser, one listing page at a time, about one page every few seconds). That copy is **not** in this repository |
| `servicos.curitiba.pr.gov.br` (Carta de Serviços detail pages) | Checked 2026-11-19: `Disallow: /` | **Disallowed. Never contacted**: the capture never opened a detail page. `city_services_search` returns these URLs (from the local file) only as links for people to open |
| `www.urbs.curitiba.pr.gov.br` | 404 | Out of scope, same reason. Not contacted |
| `www.detran.pr.gov.br` (Detran-PR) | 200 (checked 2026-11-19 with curl, User-Agent `curitibai-dev-check`): `User-agent: *`; disallows, among others, `/core/`, `/profiles/`, `/admin/`, `/search/`, four `/user/...` paths (register, password, login, logout), `/print/`, `/external-print/`, `/noticias/aen/`, `/usuario/`, `/celepar-captcha-audio/`, `/webservices/`, `/virada.html`. `/`, `/unidades`, `/Noticia/`, `/Pagina/` and `/servicos/` are **not disallowed** (no explicit Allow either) | Read by hand once for `detran_pr_info` (v0.4): the home page, `/unidades` and three `/Noticia/` pages. **The server never contacts it**: the data is bundled |
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

- Modalities **8 (Dispensa), 9 (Inexigibilidade), 14 (Inaplicabilidade da Licitação)** and any code not in the table
  above: `object` is `null` and `object_withheld` is `"may_name_a_person"`. Body, modality, estimated value, status,
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
  (for example "2026-3333"), and 2 digits (or 0 plus 2 digits) followed by 8 or 9 digits. Two year-like numbers
  (`(19|20)\d{2}`) joined by a space, hyphen or dot with no DDD, "+55" or parentheses before them ("2025 - 2026",
  "2026-2027") are kept, so an 8-digit phone shaped like that is not masked (fails open, by owner decision);
  with one of those before them ("41 2025-2026", "(041) 2025-2026"), or a contact word right before them (tel, tels,
  telef, cel, fone, telefone(s), celular, contato(s), whatsapp, whats, zap, fax, ramal, any case, not inside a longer
  word such as "hotel", "Excel" or "Marcel", optional "." and ":", as in "Tel. 2025-2026"), they are still masked. The cue covers only the number right after
  it ("tel 2025-2026 2027-2028" keeps the second pair) and only the words listed (not "fones" or "cels"). The
  official text is on the linked page.
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
| Licence and attribution | ODbL 1.0. OSMF attribution guidelines (<https://osmfoundation.org/wiki/Licence/Attribution_Guidelines>): "Attribution must be to “OpenStreetMap”.", "Attribution must also make it clear that the data is available under the Open Database License." and "The historical forms of attribution “© OpenStreetMap contributors” or “© OpenStreetMap” are acceptable." <https://www.openstreetmap.org/copyright>: "you may link to this copyright page". Every result carries `attribution: "© OpenStreetMap contributors, ODbL"` and a `license_note` with that text, the copyright URL, the Overpass URL, the fetch time and the OSM data time |
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
   EMERGENCIES: in an emergency call 190 (Polícia Militar) or 193 (Corpo de Bombeiros)". After 180 days (Curitiba
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

The owner's copy: the listing pages of <https://www.curitiba.pr.gov.br/servicos/> were read with a scripted browser
session (a real browser, one listing page at a time, about one page every few seconds) on **2026-11-19/20**
(America/Sao_Paulo); detail pages on `servicos.curitiba.pr.gov.br` were never opened. The `www` host answers 403 to
non-browser clients such as curl; the service pages' host has robots.txt `Disallow: /`. The server contacts neither.

| Field | Value |
|---|---|
| Item shape | `{cat, title, what, url, online}`: the theme (category), the title, the listing's own "O que é?" teaser as published (the site truncates it; some are empty, and those services are found by title only), the detail-page URL and, for some, an online-service link |
| Completeness of the 2026-11-19/20 copy | 756 unique services in 18 categories, 96 of them with an empty teaser. The listing paginates through ASP.NET postbacks and its order is not stable between requests; a full pass plus one pass per theme gave 756, while the paginator suggested about 770, so **a few services may be missing** |
| `checked_at` | The first date in the file's `captured` (for "2026-11-19/20", `2026-11-19`), so the 180-day staleness warning, counted in America/Sao_Paulo, starts early rather than late. `license_note` repeats the date part of `captured` and never the rest of that text |
| Terms / licence | None found. Treated under the strictest reading: values returned unchanged (except masked text, below), attributed to "Prefeitura Municipal de Curitiba — Carta de Serviços" with the link and capture date in `license_note` |

Privacy: the catalog describes public services. Online links to the city's obituary system
(`obituarios.curitiba.pr.gov.br` or a subdomain, lists of deceased people) are never returned (matched on the parsed
host), while the catalog entry and `official_url` stay; online links that are not http(s) or carry a username or
password are dropped too. As a guard, summaries pass through the PNCP object masking (`maskObject`); a summary is
returned as published unless the mask actually hides something. On the 2026-11-19/20 copy that happens twice, both
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

### `bus_lines_search`, `bus_line_stops`, `bus_departures`: URBS daily exports (local files, not shipped)

No network, and **no URBS file in this repository**. The source is the dataset "Transporte Coletivo de Curitiba" on
the Portal de Dados Abertos de Curitiba (publisher URBS — Urbanização de Curitiba S.A.; portal page
`/conjuntodado/detalhe?chave=ca40f13b-ef61-472b-810f-dd705f85fd2e`, used as `source_url`). Its daily exports are
mirrored at <https://dadosabertos.c3sl.ufpr.br/curitibaurbs/> as `YYYY_MM_DD_<kind>.json.xz`. That host is treated as
disallowed (table above), so the server never fetches them; a person downloads `linhas`, `pontosLinha` and
`tabelaLinha` in a browser, decompresses them with `xz -d` and keeps them in `CURITIBAI_DATA_DIR/urbs/`. Licence:
licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/deed.pt_BR), as linked from the dataset's portal
page (its body reads "Dados Abertos - Conteúdo licenciado sob uma Licença Creative Commons." with the by/4.0 badge;
checked 2026-11-21 with one GET). `license_note`
attributes URBS and the dataset and names the file.

Each tool lists the names in `urbs/` (no file is opened to choose), takes the newest valid date for its own kind,
and reads that one file through `src/localfs.ts` with the same rules as `city_services_search` (realpath inside the
folder, regular file, read-only open, no symlink out), on every call, with a 20 MB cap. Rows are validated with zod
row by row (strings of bounded length, `HH:MM` times, digit-only stop numbers and day codes, comma-decimal
coordinates or empty). Fields a tool selects or orders by are required (`COD`, `NOME` in linhas; `NUM`, `SEQ`,
`ITINERARY_ID`, `COD` in pontosLinha; `HORA`, `DIA`, `NUM`, `COD` in tabelaLinha); the descriptive ones may be missing
or null and become "". A row that fails is skipped and the count is given in `note`. The file is `invalid_data` only
when it is not UTF-8 JSON, not a non-empty list (within a row cap), more than half of its rows are invalid, or over
20 MB; the message names the file and the problem (never the file's text) and says to remove or rename the file so
the next newest dated one is read. Extra fields are ignored. On the 2026-11-20 files no row is skipped. Measured on the 2026-11-20 files with the built server: about 4 ms (linhas), 32 ms (pontosLinha)
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

**Times after midnight.** `HORA` runs from 00:00 to 23:59 (1,186 rows of the 2026-11-20 file are before 03:00, under
all three codes), and no field ties a time after midnight to the previous evening's service. `bus_departures`
returns times as published under their row's code and never moves them; `from`/`to` do not wrap past midnight.
Whether URBS files a late-night trip under the day it starts or the calendar day of the time is not verified.

Privacy: lines, stops and timetables are public transport data with no personal data. As a guard, stop names
(`NOME`, `PONTO`) pass through the PNCP object masking (`maskObject`, via `guardedSummary`); a name is returned as
published unless the mask hides something. On the 2026-11-20 files that happens to 29 of the 6,841 distinct stop
names in `pontosLinha`, all street-number ranges ("1469-1411") read as phone numbers, and to none in `tabelaLinha`.
Line names, directions and types are not masked.

Search: `bus_lines_search` folds accents and case and requires every query word in the code or name; an exact code
comes first, then pt-BR name order. `category` is compared the same way and must be one of the file's categories.
Line codes are compared case-insensitively. Results are capped at 50 per call, with `offset` paging.

Prior art (2026-11-21, `gh search repos "urbs curitiba"`, `gh search code "pontosLinha tabelaLinha"`): one 2020 GPS
map-matching project (`lucianourgal/BusMapMatching`, no licence), nothing that reads these exports for an assistant.
The GTFS options below need a feed built from the same disallowed mirror. Built.

### `local_csv_summary`: a file the user downloaded

No network. The user downloads a file in a browser (for example the 156 CSV from the portal, about 137 MB) into the
folder named by `CURITIBAI_DATA_DIR`. The tool streams it and returns column names, row counts and grouped counts.
Data rows (after the first line) are never returned.
The values of the grouped column are returned; groups under 3 rows are counted only in `other_count`, so a filter plus
a group-by cannot reveal one record.

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
| `schools_search`, `markets_fairs_list`, `culture_agenda` | Their files exist only on the two disallowed hosts (`local_csv_summary` can count a hand-downloaded file). Health units moved to the CNES API in v0.2 |
| Private and non-profit health units | CNES names of non-public units can be people's names (see above) |
| `garbage_collection_by_street` | No source found (portal searches for "lixo", "coleta", "residuos") |
| Detran-PR fees by vehicle, debts, fines and IPVA by plate | Behind login and CAPTCHA on Detran-PR; per-owner data. Not accessed |
| Detran-PR statistics (Qlik panel) | Interactive dashboard, not a published dataset. Not accessed |
| PNCP suppliers, contracts, price-registration minutes (`/v1/contratos`, `/v1/atas`) | Suppliers can be natural persons (CPF); `procurement_search` stays on the procurement notice, which has no supplier field |

### Bus alternative checked, not adopted

- **urbs-gtfs** (`github.com/benaytms/urbs-gtfs`, pipeline code Apache-2.0): one release, tag `latest`, asset
  `gtfs_curitiba.zip` (11,568,234 bytes, sha256 `0af00b386fb42dce75b014afff8ae9caf31c45bcd0ce2af1c434bffbe11fdf42`,
  published 2026-10-27). Its README says the data is built from C3SL/UFPR open data "subject to their terms", which is
  the host disallowed above. `feed_info.txt` has `feed_end_date` 20261102, so the feed **expired on 2026-11-02**.
  No release since 2026-10-27, although the project describes itself as weekly.
- **gtfs-mcp** (`github.com/jdamcd/gtfs-mcp`, MIT): a generic GTFS MCP server. Not run here.
