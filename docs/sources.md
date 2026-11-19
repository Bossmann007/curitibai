# Sources

Checked live on **2026-11-19** from a Brazilian IP with the server's own client: Node.js `fetch`,
User-Agent `curitibai-mcp/0.1`, redirects followed by hand.

**Rule applied:** a host is contacted only if its robots.txt allows it. Hosts with `Disallow: /` are never fetched,
not even inside the visit hours they list. The browser User-Agent is never imitated.

## robots.txt findings

| Host | `/robots.txt` | Result |
|---|---|---|
| `dadosabertos.curitiba.pr.gov.br` | 404 (HTML "not found" page, rechecked 2026-11-19) | No restriction (RFC 9309: a 4xx robots.txt means no rules). **The only host this server contacts.** |
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

## Deferred

| Tool | Reason |
|---|---|
| `open_dataset_preview` | File hosts disallow automated access (robots.txt) and the 156 CSV is 137 MB; needs permission or an official API. The 20-row table embedded in portal detail pages also holds individual records (156 tickets with street names; the payroll dataset names people) |
| `city156_categories`, `city156_stats` | File hosts disallow automated access (robots.txt) and the 156 CSV is 137 MB; needs permission or an official API. Measured: 136,902,324 bytes (2026-11-18 file), ~1 MB/s from the mirror (~140 s) and ~0.4 MB/s from `mid` (>300 s). The 156 API (`api-156.curitiba.pr.gov.br`) is not public |
| Bus lines, timetables, stops | `www.urbs.curitiba.pr.gov.br` is out of scope (403 to non-browser clients). The URBS WebService redirects to a login page. Alternative: see below |
| `health_units_search`, `schools_search`, `markets_fairs_list`, `culture_agenda` | Their files exist only on the two disallowed hosts |
| `garbage_collection_by_street` | No source found (portal searches for "lixo", "coleta", "residuos") |

### Bus alternative checked, not adopted

- **urbs-gtfs** (`github.com/benaytms/urbs-gtfs`, pipeline code Apache-2.0): one release, tag `latest`, asset
  `gtfs_curitiba.zip` (11,568,234 bytes, sha256 `0af00b386fb42dce75b014afff8ae9caf31c45bcd0ce2af1c434bffbe11fdf42`,
  published 2026-10-27). Its README says the data is built from C3SL/UFPR open data "subject to their terms", which is
  the host disallowed above. `feed_info.txt` has `feed_end_date` 20261102, so the feed **expired on 2026-11-02**.
  No release since 2026-10-27, although the project describes itself as weekly.
- **gtfs-mcp** (`github.com/jdamcd/gtfs-mcp`, MIT): a generic GTFS MCP server. Not run here.
