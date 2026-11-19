# Sources (Step 0 check)

Checked live on **2026-11-19** from a Brazilian IP, with the server's own client:
Node.js `fetch`, User-Agent `curitibai-mcp/0.1`, redirects followed by hand.

**Network note.** `www.curitiba.pr.gov.br` and `www.urbs.curitiba.pr.gov.br` sit behind an Akamai edge.
`curl` got `403 Access Denied` on every URL, with the generic, a browser-like and the default User-Agent.
Node.js `fetch` with the generic User-Agent got normal responses on the same URLs.
The block follows the client fingerprint, not a published rule, so a future edge change can break every tool.
The tools then return `{"error":"source_unavailable"}`. This server never sends a browser User-Agent to get around it.

## Confirmed sources (implemented)

### 1. URBS active bus lines (`bus_lines_search`, also validates `bus_line_schedule`)

| Field | Value |
|---|---|
| URL | `https://www.urbs.curitiba.pr.gov.br/portal/wp-content/urbs_data/urbs_horarios/linhas_ativas.json` |
| Found via | Script of the "Horário de Ônibus" page `https://www.urbs.curitiba.pr.gov.br/portal/horario-de-onibus/` (the old `/horario-de-onibus/` URL 301-redirects there) |
| Format | JSON array, 309 lines: `COD`, `NOME`, `SOMENTE_CARTAO`, `CATEGORIA_SERVICO`, `NOME_COR` |
| API / CSV / JSON | Static JSON file used by the page widget. Undocumented: no API docs, no versioning promise |
| License / terms | Not found on the URBS site (`wp-json` search for "termos de uso" returned only service pages). The Portal de Dados Abertos lists URBS transport data ("Transporte Coletivo de Curitiba") under CC BY 4.0, but that entry points to the URBS WebService, not to this file |
| robots.txt | `https://www.urbs.curitiba.pr.gov.br/robots.txt` → 404 (no robots file) |
| Fixture | `test/fixtures/urbs_linhas_ativas.json` (8 of 309 entries) |

### 2. URBS line timetable (`bus_line_schedule`)

| Field | Value |
|---|---|
| URL | `https://www.urbs.curitiba.pr.gov.br/portal/wp-content/urbs_data/urbs_horarios/linha_{COD}_v2.json` |
| Found via | Same page script (`block-horario-de-onibus-v2`) |
| Format | JSON `{status, data:{cod_linha, nome, pagamento, info_extra (HTML), simulacoes:[{validade_inicio, validade_fim, is_current, dias:{"1"\|"2"\|"3": {stop: [{hora, adapt}]}}]}}` |
| Day keys | `1` = Dia Útil, `2` = Sábado, `3` = Domingo/Feriado (from the page's `<select>`) |
| Period rule | Each `simulacoes` entry is a validity period with its own days. The page script shows the first period that has the chosen day and `is_current: true`, else the first period with that day; the tool does the same |
| `adapt` | The page script renders `adapt: false` as "veículo sem elevador" and anything else as "com elevador"; the tool exposes it as `wheelchair_lift` (null when absent) |
| Checked | Lines `182`, `464`, `X43` → 200; unknown `X99` → 404 HTML |
| API / CSV / JSON | Static JSON per line, undocumented |
| License / terms | Not found (as above) |
| robots.txt | 404 (as above) |
| Fixture | `test/fixtures/urbs_linha_182_v2.json` (4 departures per stop kept) |

### 3. URBS bus stops (`bus_stops_near`)

| Field | Value |
|---|---|
| URL | `https://www.urbs.curitiba.pr.gov.br/portal/transporte/rede-integrada-de-transporte/relacao-de-pontos-de-parada/` |
| Format | HTML page (≈2.6 MB) whose map element carries a `data-pontos` attribute with an HTML-escaped JSON array of 7,672 stops: `title`, `lat`, `lng`, `tipo`, `linhas` |
| API / CSV / JSON | No API. JSON embedded in the page |
| License / terms | Not found (as above) |
| robots.txt | 404 (as above) |
| Fetch time | ≈3 s for the full page |
| Fixture | `test/fixtures/urbs_pontos_parada.html` (6 stops, page wrapper kept) |

### 4. Portal de Dados Abertos de Curitiba: dataset search (`open_datasets_search`)

| Field | Value |
|---|---|
| URL | `https://www.curitiba.pr.gov.br/dadosabertos/` → 301 → `https://dadosabertos.curitiba.pr.gov.br/`. The old transport group URL `/dadosabertos/busca/?grupo=8` also 301-redirects to the new home; groups no longer exist |
| Search | `POST https://dadosabertos.curitiba.pr.gov.br/conjuntodado/` form fields `Parametros.Termo`, `Parametros.IndicePagina`, `cookie=true`. 5 cards per page plus a "N resultados" total and a pager |
| Format | HTML. Each card: detail link `conjuntodado/detalhe?chave=<GUID>`, title, publishing body, description, file formats, "Atualizado em" |
| API / CSV / JSON | No public API found. The search is a read-only form POST |
| Behavior | Term search matches accents literally: "saude" and "transporte" match, "onibus", "feira(s)", "escola(s)", "lixo" and "residuos" return nothing ("Nenhum resultado encontrado"), "coleta" returns only "Clique Economia", the "cultura" search timed out. Unfiltered page 1 ≈1 s; unfiltered pages 2–3 took 20–40 s+; filtered page 2 ≈6 s |
| License / terms | Footer: "Conteúdo licenciado sob uma Licença Creative Commons" → CC BY 4.0 (`http://creativecommons.org/licenses/by/4.0/deed.pt_BR`). Usage rules (`/informacoes/regrasutilizacao/5`): free use for any purpose within the law; conditions: cite the source body, state the data was accessed via the Portal de Dados Abertos de Curitiba, and include the sentence "O Portal de Dados Abertos de Curitiba e o órgão ou entidade de onde foram acessados os dados não garantem sua autenticidade, qualidade, integridade e atualidade após terem sido disponibilizados para uso secundário." |
| robots.txt | `https://dadosabertos.curitiba.pr.gov.br/robots.txt` → 404 (no robots file). `https://www.curitiba.pr.gov.br/robots.txt` → 200; disallows `/App`, `/bin`, `/Cache`, `/Imagem`, `/Include` and some extensions for `*`; `/dadosabertos/` is not disallowed |
| Fixtures | `test/fixtures/portal_busca_saude.html` (results block of the "saude" search), `test/fixtures/portal_busca_vazia.html` (the "onibus" search, no results) |

### 5. Portal de Dados Abertos de Curitiba: dataset preview (`open_dataset_preview`)

| Field | Value |
|---|---|
| URL | `https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=<GUID>` |
| Format | HTML. Datasets with a base embed a preview table (`div.tabelaBaseDados` with `id="tabela_…"`, header + 20 rows). Data dictionaries use a separate table and are ignored. Datasets without a base (e.g. "Transporte Coletivo de Curitiba") say "Este conjunto não possui bases/dicionário de dados." |
| Full files | Not on an allowlisted host: the "BASE DE DADOS" button links to `http://dadosabertos.c3sl.ufpr.br/curitiba/<Dataset>/` (see "Rejected" below). The `DOWNLOAD` button runs JavaScript (`downloadArquivos(...)`), not checked |
| License / terms | As in 4 |
| robots.txt | As in 4 |
| Fixtures | `test/fixtures/portal_detalhe_unidades.html` (3 rows; phone, extension, email and fax cells blanked), `test/fixtures/portal_detalhe_transporte.html` (no table) |

## Rejected or not used

| Source | Result | Why not used |
|---|---|---|
| `https://dadosabertos.c3sl.ufpr.br/curitiba/` (UFPR mirror holding the full CSV/XLS files: `UnidadesAtendimentoCuritiba`, `FeirasCuritiba`, `AgendaPMC`, `FundacaoCultural`, `156`, `TransporteColetivo`) | 200, Apache listing | `/curitiba/robots.txt` says `User-agent: *`, `Disallow: /`, `Request-rate: 1/5`, `Visit-time: 0400-0645` UTC. The root `/robots.txt` is 404, but the intent is clear. Also not on the allowlist. About 9 requests (listings and robots.txt) were made while checking; none since |
| `http://dadosabertos.c3sl.ufpr.br/curitibaurbs/` (URBS bulk files linked from the portal) | Not fetched | Same host and reason as above |
| URBS WebService `https://transporteservico.urbs.curitiba.pr.gov.br/` | 302 → `login.php` | Redirects to a login page; the portal describes it as a WebService with real-time vehicle positions. Not checked further: a feed behind a login is out of scope |
| `https://mid.curitiba.pr.gov.br/dadosabertos/` | 403 (curl) | Not needed; not checked further |

## Optional tools: status

| Tool | Candidate source | Status |
|---|---|---|
| `health_units_search` | Portal "Unidades de Atendimento de Curitiba - Ativas" (`chave=680ED5ED-…`) | Deferred: the full CSV is only on the UFPR mirror (robots `Disallow: /`); the portal page has a 20-row preview only |
| `schools_search` | Same "Unidades de Atendimento" base (education themes) | Deferred: same reason; the portal search for "escolas" returns nothing |
| `markets_fairs_list` | `FeirasCuritiba` on the UFPR mirror (latest file 2017) | Deferred: mirror robots; portal search for "feira"/"feiras" returns nothing |
| `garbage_collection_by_street` | None found | Deferred: portal searches for "lixo", "coleta", "residuos" found nothing relevant; other sites not searched |
| `culture_agenda` | `AgendaPMC` / `FundacaoCultural` on the UFPR mirror | Deferred: mirror robots |
| `city156_categories` | `156` daily CSVs on the UFPR mirror | Deferred: mirror robots; not checked whether a category-only list exists |
