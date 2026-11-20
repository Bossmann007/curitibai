# Sources

Checked live on **2026-11-19** from a Brazilian IP with the server's own client: Node.js `fetch`,
User-Agent `curitibai-mcp/0.1`, redirects followed by hand. The CNES API (v0.2) was checked the same day with curl and
User-Agent `curitibai-mcp/0.2`. The PNCP Consulta API (v0.3) was checked the same day with curl and User-Agent
`curitibai-mcp/0.3`. The INMET API (v0.5) was checked the same day with curl and User-Agent `curitibai-mcp/0.5`.

**Rule applied:** a host is contacted only if its robots.txt allows it. Hosts with `Disallow: /` are never fetched,
not even inside the visit hours they list. The browser User-Agent is never imitated.

## robots.txt findings

| Host | `/robots.txt` | Result |
|---|---|---|
| `dadosabertos.curitiba.pr.gov.br` | 404 (HTML "not found" page, rechecked 2026-11-19) | No restriction (RFC 9309: a 4xx robots.txt means no rules). **Contacted.** |
| `apidadosabertos.saude.gov.br` (Ministry of Health open-data API) | 404 (HTML "404 Not Found", checked 2026-11-19) | No restriction. **Contacted** (v0.2, `health_units_search`). |
| `pncp.gov.br` (Portal Nacional de Contratações Públicas) | 404 with the portal's HTML page as body (rechecked 2026-11-19 with curl, User-Agent `curitibai-mcp/0.3`; the first two attempts were connection resets, the third answered 404) | No restriction (RFC 9309). **Contacted** (v0.3, `procurement_search`, `/api/consulta` only) |
| `apiprevmet3.inmet.gov.br` (INMET forecast and warnings API) | 404, body `HttpException: E_ROUTE_NOT_FOUND: Route not found GET /robots.txt` (checked 2026-11-19 with curl, User-Agent `curitibai-mcp/0.5`) | No restriction (RFC 9309). **Contacted** (v0.5, `weather_forecast` and `weather_alerts`, two paths only) |
| `mid-dadosabertos.curitiba.pr.gov.br` (file host the portal links to) | 200: `User-agent: *`, `Request-rate: 1/5`, `Visit-time: 0400-0645` (UTC), `Disallow: /`, plus extension rules | **Disallowed. Never fetched.** |
| `dadosabertos.c3sl.ufpr.br` (UFPR mirror) | `/robots.txt` 404, but `/curitiba/robots.txt` has the same text as above (`Disallow: /`) | **Treated as disallowed. Never fetched.** |
| `www.curitiba.pr.gov.br` | 200; disallows `/App`, `/bin`, `/Cache`, `/Imagem`, `/Include`, some extensions; `/dadosabertos/` not disallowed | Out of scope (Akamai returns 403 to non-browser clients such as curl). Not contacted |
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
written; the built tools were then run once each against the live API.

| Field | Value |
|---|---|
| Forecast URL | `GET https://apiprevmet3.inmet.gov.br/previsao/4106902` (4106902 = Curitiba, 7-digit IBGE code). 200, `application/json`, 268,045 bytes, 2.4 s |
| Forecast format | `{"4106902": {"dd/mm/yyyy": day, ...}}`, 5 dates starting today (America/Sao_Paulo). **The first two days** are `{manha, tarde, noite}`; **the last three** are one whole-day object with the same fields. Fields per entry: `resumo`, `tempo` (empty when checked), `temp_max`, `temp_min`, `umidade_max`, `umidade_min`, `dir_vento`, `int_vento`, `dia_semana`, `nascer`, `ocaso`, temperature trends (`temp_max_tende`, `temp_min_tende`), `estacao`, `hora`, `fonte`, `uf`, `entidade`, and base64 icons (`icone`, `*_tende_icone`, about 4–21 KB each, most of the body) |
| Forecast output | Per day: `date` (ISO), `weekday` (`dia_semana`); per period (`morning`/`afternoon`/`night`, or `whole_day`): summary (`resumo`), min/max temperature, min/max humidity, wind direction and intensity, sunrise (`nascer`) and sunset (`ocaso`), values as served (a plain numeric string, if INMET ever sends one, is read as its number). A whole-day entry is never split into periods. Missing or empty fields are `null`. Not returned: icons, trends, `estacao`, `hora`, `tempo`, `fonte`. An unknown day shape is `source_unavailable` |
| Warnings URL | `GET https://apiprevmet3.inmet.gov.br/avisos/ativos`. 200, `application/json`, 754,179 bytes, 3.6 s |
| Warnings format | `{hoje: [...], futuro: [...]}`, nationwide (4 + 6 warnings when checked). Each warning: `id`, `id_aviso`, `codigo` (urn:oid), `descricao`, `severidade`, `inicio`/`fim` (`"YYYY-MM-DD HH:mm"`, no time zone), `data_inicio`/`data_fim` (midnight with a `Z`, not used), `riscos` and `instrucoes` (arrays of strings, some with trailing spaces), `aviso_cor`, `icone` (base64), `poligono`, `municipios`, `microrregioes`, `mesorregioes`, `estados`, `regioes`, and **`geocodes`: one comma-separated string of IBGE codes** (up to about 31,000 characters). The largest warning was 157 KB. **The same warning (id 56460) was in both `hoje` and `futuro`** |
| Warnings output | Only warnings whose `geocodes` contain exactly `4106902` (split on commas, never a substring match). Fields: `id`, `listed_as` (`today` for `hoje`, `upcoming` for `futuro`, INMET's own lists, not recomputed from dates), `description`, `severity`, `start`, `end`, `risks`, `instructions`, as served. With `when: all`, a warning in both lists is returned once (by `id`). Polygons, area lists, codes and icons are dropped while parsing; only the filtered result is cached (in memory, 10 minutes). A warning that is not an object or has no `geocodes`, or a missing `hoje`/`futuro` list, is `source_unavailable`, never "no warning". 5 of the 10 warnings covered Curitiba when checked |
| Guards | 15 s timeout per request; size caps 1 MB (forecast) and 6 MB (warnings, about 40 warnings the size of the largest one seen), over which the tool returns `source_unavailable` with a message naming the cap; HTTP 429 is `rate_limited` with the `Retry-After` wait (no retry). One request per call, at most |
| Documentation | None found: no OpenAPI or manual for `apiprevmet3.inmet.gov.br` was found by search (2026-11-19). The paths and shapes above come from the live responses only |
| Rate limits | None documented, none seen in the response headers (session cookies only, no rate-limit headers) |
| Terms / licence | **No terms of use for this API were found.** By search only (summaries, pages not opened): INMET says its data is public and free, and gov.br pages carry "Creative Commons Atribuição-SemDerivações 3.0" (CC BY-ND 3.0). `https://portal.inmet.gov.br/` timed out (20 s, no response) when opened with curl on 2026-11-19, so no INMET terms page was read and no portal link is given in `license_note`. **Treatment (same rule as CNES):** the strictest notice found applies (attribution, no derivatives): selected fields with values unchanged, no rewording of `descricao`, `riscos`, `instrucoes` or `resumo`, and `license_note` names INMET with the source URL and the fetch time |
| Fixtures | **Synthetic**: `test/fixtures/inmet_previsao_synthetic.json` and `test/fixtures/inmet_avisos_synthetic.json` have the real JSON shape with invented values (marked in a `_synthetic` key): invented texts, polygons, areas and icons, a warning whose geocodes are near misses (`41069020`, `14106902`), and a warning listed in both lists. No real INMET response is committed |

Prior art (2026-11-19, `gh search repos "inmet mcp"`: no results; `gh search repos inmet`): R, Python and Julia
clients and scrapers for INMET station data, a Home Assistant alerts integration and a Telegram bot; no MCP server.
Built: about 300 lines inside this server, reusing its HTTP client, cache and envelope.

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
| Bus lines, timetables, stops | `www.urbs.curitiba.pr.gov.br` is out of scope (403 to non-browser clients). The URBS WebService redirects to a login page. Alternative: see below |
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
