# Sources

Checked live on **2026-11-19** from a Brazilian IP with the server's own client: Node.js `fetch`,
User-Agent `curitibai-mcp/0.1`, redirects followed by hand. The CNES API (v0.2) was checked the same day with curl and
User-Agent `curitibai-mcp/0.2`.

**Rule applied:** a host is contacted only if its robots.txt allows it. Hosts with `Disallow: /` are never fetched,
not even inside the visit hours they list. The browser User-Agent is never imitated.

## robots.txt findings

| Host | `/robots.txt` | Result |
|---|---|---|
| `dadosabertos.curitiba.pr.gov.br` | 404 (HTML "not found" page, rechecked 2026-11-19) | No restriction (RFC 9309: a 4xx robots.txt means no rules). **Contacted.** |
| `apidadosabertos.saude.gov.br` (Ministry of Health open-data API) | 404 (HTML "404 Not Found", checked 2026-11-19) | No restriction. **Contacted** (v0.2, `health_units_search`). |
| `mid-dadosabertos.curitiba.pr.gov.br` (file host the portal links to) | 200: `User-agent: *`, `Request-rate: 1/5`, `Visit-time: 0400-0645` (UTC), `Disallow: /`, plus extension rules | **Disallowed. Never fetched.** |
| `dadosabertos.c3sl.ufpr.br` (UFPR mirror) | `/robots.txt` 404, but `/curitiba/robots.txt` has the same text as above (`Disallow: /`) | **Treated as disallowed. Never fetched.** |
| `www.curitiba.pr.gov.br` | 200; disallows `/App`, `/bin`, `/Cache`, `/Imagem`, `/Include`, some extensions; `/dadosabertos/` not disallowed | Out of scope (Akamai returns 403 to non-browser clients such as curl). Not contacted |
| `www.urbs.curitiba.pr.gov.br` | 404 | Out of scope, same reason. Not contacted |

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

Checked live on **2026-11-19** with curl, User-Agent `curitibai-mcp/0.2`.

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

### `local_csv_summary`: a file the user downloaded

No network. The user downloads a file in a browser (for example the 156 CSV from the portal, about 137 MB) into the
folder named by `CURITIBAI_DATA_DIR`. The tool streams it and returns column names, row counts and grouped counts.
Data rows (after the first line) are never returned.
The values of the grouped column are returned; groups under 3 rows are counted only in `other_count`, so a filter plus
a group-by cannot reveal one record.

**Owner decision (2026-11-19), same rule as CNES (no person names):** `group_by` and `filter_column` are refused
(`column_not_allowed`) when the column name, accents and case ignored, matches nome, name, cpf, cnpj, rg, email/e-mail,
telefone/fone/celular, matricula, endereco/logradouro/rua, cep, nascimento, servidor, beneficiario, paciente, mae or
pai (also `nasc`, `tel` and split camelCase, added after code review; and solicitante, requerente, cidadao,
contribuinte, titular, responsavel, documento, identidade, contato, whatsapp, usuario, morador, placa and inscricao,
added in review round 2). The guard is name-based and therefore not perfect, and it fails closed on look-alikes.

The first line is returned as column names. A first line that looks like data (digits, CPF/CNPJ, e-mail, phone, date,
CEP, long text) is refused with `no_header_detected`; a first line made only of text cannot be told apart from a
header and is returned as column names. This cannot be decided by a heuristic, so the README tells users to use files
with a header row.

Its licence is the publisher's (portal data: CC BY 4.0 with the portal's citation rules). Tested on synthetic files
only, not on the real 156 file.

## Deferred

| Tool | Reason |
|---|---|
| `open_dataset_preview` | File hosts disallow automated access (robots.txt) and the 156 CSV is 137 MB; needs permission or an official API. The 20-row table embedded in portal detail pages also holds individual records (156 tickets with street names; the payroll dataset names people) |
| `city156_categories`, `city156_stats` | File hosts disallow automated access (robots.txt) and the 156 CSV is 137 MB. Measured: 136,902,324 bytes (2026-11-18 file), ~1 MB/s from the mirror (~140 s) and ~0.4 MB/s from `mid` (>300 s). The 156 API (`api-156.curitiba.pr.gov.br`) is not public. Owner decision (2026-11-19): no permission request will be sent; a person downloads the file and uses `local_csv_summary` |
| Bus lines, timetables, stops | `www.urbs.curitiba.pr.gov.br` is out of scope (403 to non-browser clients). The URBS WebService redirects to a login page. Alternative: see below |
| `schools_search`, `markets_fairs_list`, `culture_agenda` | Their files exist only on the two disallowed hosts (`local_csv_summary` can count a hand-downloaded file). Health units moved to the CNES API in v0.2 |
| Private and non-profit health units | CNES names of non-public units can be people's names (see above) |
| `garbage_collection_by_street` | No source found (portal searches for "lixo", "coleta", "residuos") |

### Bus alternative checked, not adopted

- **urbs-gtfs** (`github.com/benaytms/urbs-gtfs`, pipeline code Apache-2.0): one release, tag `latest`, asset
  `gtfs_curitiba.zip` (11,568,234 bytes, sha256 `0af00b386fb42dce75b014afff8ae9caf31c45bcd0ce2af1c434bffbe11fdf42`,
  published 2026-10-27). Its README says the data is built from C3SL/UFPR open data "subject to their terms", which is
  the host disallowed above. `feed_info.txt` has `feed_end_date` 20261102, so the feed **expired on 2026-11-02**.
  No release since 2026-10-27, although the project describes itself as weekly.
- **gtfs-mcp** (`github.com/jdamcd/gtfs-mcp`, MIT): a generic GTFS MCP server. Not run here.
