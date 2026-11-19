# CuritibAI

A read-only [MCP](https://modelcontextprotocol.io) server that lets AI assistants search the catalogue of the
[Portal de Dados Abertos de Curitiba](https://dadosabertos.curitiba.pr.gov.br/) (Brazil), list each dataset's files,
look up public health units in the Ministry of Health's CNES open API, and summarise a CSV file the user downloaded by
hand.

**Unofficial. Not affiliated with, endorsed by or connected to the Prefeitura de Curitiba or the Ministério da Saúde.**
Data comes from the sources as it is; always confirm important information at the source.

## Tools

All tools are read-only. The three network tools return `{data, source_url, fetched_at, license_note}`.
When a source fails, times out or changes format, the tool returns `{"error":"source_unavailable"}` as JSON text with
`isError: true`, and no data. `local_csv_summary` makes no network call and returns `{data, source: "local_file",
read_at, note}`; its errors are `data_dir_not_set`, `file_not_allowed`, `file_not_found`, `column_not_found` and
`invalid_csv`.

| Tool | Input | Returns | Source (checked 2026-11-19) |
|---|---|---|---|
| `open_datasets_search` | `query` (2–100 chars), `limit` ≤ 20 | Dataset id, title, publisher, description, formats, last update, detail URL; `total`, and `partial` when a later result page timed out | Portal search form (`POST /conjuntodado/`) |
| `dataset_files` | `dataset_id` (GUID from the search), `page` | The dataset's files: name, format, size, last update, link and data-dictionary link (50 per page). **Links only: the files are not downloaded** | Portal detail page + `/ConjuntoDado/DownloadArquivos/` JSON |
| `health_units_search` | optional `name` (text in the unit name), optional `unit_type` (CNES type code or text in its label), `limit` ≤ 20, `page`, `skip` | Active **public-administration** health units in Curitiba: CNES code, name, unit type, address, neighbourhood, CEP, unit phone, management sphere; `next_page` and `next_skip` to continue, and `partial` when the 5-request cap stopped the scan | Ministry of Health CNES API (`GET apidadosabertos.saude.gov.br/cnes/estabelecimentos`, `/cnes/tipounidades`) |
| `local_csv_summary` | `file` (name inside `CURITIBAI_DATA_DIR`), optional `group_by`, `top` ≤ 50, optional `filter_column` + `filter_value` | Column names, row count, malformed-row count, and the largest groups of one column (optionally filtered by `column = value`). **Never returns rows** | A file you downloaded yourself; no network |

The file links point to `mid-dadosabertos.curitiba.pr.gov.br`. That host's robots.txt says `Disallow: /`, so this
server never opens them; a person can open them in a browser, and `local_csv_summary` can then summarise the file.

`health_units_search` returns only units whose natureza jurídica is in group 1 (public administration: municipal,
state and federal bodies, autarquias, public foundations); a record without that code is dropped. **Private clinics,
consultórios and non-profit hospitals are deliberately out of scope**, because in CNES their names can be people's
names (individual practitioners register under their own name). Each call scans at most 5 upstream pages of 20 units.

Details for each source (format, terms, robots.txt) are in [docs/sources.md](docs/sources.md).

## Deferred

| Tool | Reason |
|---|---|
| `open_dataset_preview` | File hosts disallow automated access (robots.txt), and file rows hold individual records |
| `city156_categories`, `city156_stats` | Same reason. Download the 156 file by hand and use `local_csv_summary` (see below) |
| Bus lines, timetables and stops | The URBS website is out of scope (it refuses non-browser clients) and its WebService needs a login. See "Alternatives" |
| `schools_search`, `markets_fairs_list`, `culture_agenda` | Their files are only on the hosts whose robots.txt disallows automated access. `local_csv_summary` can count a file you download yourself |
| Private and non-profit health units | CNES names of private units can be people's names; `health_units_search` returns public-administration units only |
| `garbage_collection_by_street` | No source found |

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

## Run it

Requires Node.js 22.12 or newer.

```sh
git clone https://github.com/Bossmann007/curitibai.git
cd curitibai
npm ci
npm run build
node dist/server.js   # speaks MCP over stdio; it prints nothing else
```

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

To use `local_csv_summary`, add `"env": {"CURITIBAI_DATA_DIR": "/absolute/path/to/a/folder"}` next to `args`
(Claude Code: `claude mcp add curitibai -e CURITIBAI_DATA_DIR=/absolute/path/to/a/folder -- node ...`). Without it, that
tool returns `{"error":"data_dir_not_set"}` and the other tools work as usual.

### Summarising a file you downloaded (for example the 156 file)

The server never downloads data files. A person does it in a browser:

1. Make a folder for the files, for example `~/curitibai-data`, and point `CURITIBAI_DATA_DIR` at it (above).
2. Open <https://dadosabertos.curitiba.pr.gov.br/> in a browser and search for "156" (or call `open_datasets_search`
   with `156`, then `dataset_files` with the dataset id, to get the links).
3. On the dataset page, click DOWNLOAD and choose a CSV file (the daily 156 file is about 137 MB). Save it into the
   folder. Keep the `.csv` extension.
4. Ask the assistant, for example: "with local_csv_summary, count `156.csv` by `ASSUNTO`, only where `BAIRRO` is
   `CENTRO`". Use the column names the tool returns (call it with just `file` first).

The tool streams the file (it never loads it whole), detects `;` or `,` and UTF-8 or Latin-1, and returns only
counts. Groups with fewer than 3 rows are added to `other_count` instead of being listed, so that a filter on a unique
column cannot reveal a single record. The first line is always read as the header and returned as `columns`, so use
files that have a header row. The path must resolve (symlinks included) to a `.csv` file inside the folder. A field
over 1 MB (for example an unclosed quote) stops the read with `invalid_csv`.
It was tested on synthetic files (including a 137 MB one: about 1 s), **not on the real 156 file**.

## Privacy and safety

- No telemetry, no secrets, no `.env`, no files written. The cache is in memory only (10 minutes) and is keyed by the
  request sent to the source.
- The server contacts exactly two hosts, `https://dadosabertos.curitiba.pr.gov.br` and
  `https://apidadosabertos.saude.gov.br`, on the default port and without credentials. Every redirect hop is checked
  against them (the redirect body is discarded first), and inputs are search terms, codes and a dataset GUID, never a
  URL.
- Requests use a generic User-Agent, `curitibai-mcp/0.2`, a 10 s timeout per request and an 8 MB response cap.
- Local files are read only from `CURITIBAI_DATA_DIR`, only through one module (`src/localfs.ts`: realpath, stat and a
  read stream), and only as aggregates.
- Text from the sources is returned as plain data fields with HTML removed. It is never meant as instructions.

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

## Development

```sh
scripts/verify   # npm ci, tsc --noEmit, eslint, vitest, build, stdio smoke test; npm audit reported separately
```

Tests run offline: every network call is stubbed, and an unstubbed call fails the test. Portal parser tests use
trimmed real responses in `test/fixtures/`. CNES tests use **synthetic** fixtures (`test/fixtures/cnes_*_synthetic.json`:
the real JSON shape with invented values), and CSV tests use synthetic files.

## License

Code: [Apache-2.0](LICENSE). The Apache-2.0 licence covers the code only; the data belongs to its publishers under
their own terms (see above).
