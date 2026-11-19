# CuritibAI

A read-only [MCP](https://modelcontextprotocol.io) server that lets AI assistants search the catalogue of the
[Portal de Dados Abertos de Curitiba](https://dadosabertos.curitiba.pr.gov.br/) (Brazil) and list each dataset's files.

**Unofficial. Not affiliated with, endorsed by or connected to the Prefeitura de Curitiba.**
Data comes from the portal as it is; always confirm important information at the source.

## Tools

Both tools are read-only. A successful call returns `{data, source_url, fetched_at, license_note}`.
When the portal fails, times out or changes format, the tool returns `{"error":"source_unavailable"}` as JSON text with
`isError: true`, and no data.

| Tool | Input | Returns | Source (checked 2026-11-19) |
|---|---|---|---|
| `open_datasets_search` | `query` (2–100 chars), `limit` ≤ 20 | Dataset id, title, publisher, description, formats, last update, detail URL; `total`, and `partial` when a later result page timed out | Portal search form (`POST /conjuntodado/`) |
| `dataset_files` | `dataset_id` (GUID from the search), `page` | The dataset's files: name, format, size, last update, link and data-dictionary link (50 per page). **Links only: the files are not downloaded** | Portal detail page + `/ConjuntoDado/DownloadArquivos/` JSON |

The file links point to `mid-dadosabertos.curitiba.pr.gov.br`. That host's robots.txt says `Disallow: /`, so this
server never opens them; a person can open them in a browser.

Details for each source (format, terms, robots.txt) are in [docs/sources.md](docs/sources.md).

## Deferred

| Tool | Reason |
|---|---|
| `open_dataset_preview` | File hosts disallow automated access (robots.txt) and the 156 CSV is 137 MB; needs permission or an official API |
| `city156_categories` | Same reason |
| `city156_stats` | Same reason |
| Bus lines, timetables and stops | The URBS website is out of scope (it refuses non-browser clients) and its WebService needs a login. See "Alternatives" |
| `health_units_search`, `schools_search`, `markets_fairs_list`, `culture_agenda` | Their files are only on the hosts whose robots.txt disallows automated access |
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

## Privacy and safety

- No telemetry, no secrets, no `.env`, no files written. The cache is in memory only (10 minutes) and is keyed by the
  request sent to the portal.
- The server contacts exactly one host, `https://dadosabertos.curitiba.pr.gov.br`, on the default port and without
  credentials. Every redirect hop is checked against it, and inputs are a search term and a dataset GUID, never a URL.
- Requests use a generic User-Agent, `curitibai-mcp/0.1`, a 10 s timeout per request and an 8 MB response cap.
- Text from the portal is returned as plain data fields with HTML removed. It is never meant as instructions.

## Limits

- The portal is a website, not a documented API. If its HTML or JSON changes, the tools return `source_unavailable`.
- The search matches accents literally ("saude" and "saúde" can differ) and finds nothing for some everyday words
  ("onibus", "feira"). Later result pages can be slow; when one times out, the tool returns what it has with
  `partial: true`.
- `dataset_files` does not check that the links work, and it cannot show the contents of a file.
- Licence: portal data is CC BY 4.0. The portal's usage rules require citing the source and a disclaimer, and each
  result's `license_note` carries both.

## Development

```sh
scripts/verify   # npm ci, tsc --noEmit, eslint, vitest, build, stdio smoke test; npm audit reported separately
```

Tests run offline: every network call is stubbed, and an unstubbed call fails the test. Parser tests use trimmed real
responses in `test/fixtures/`.

## License

Code: [Apache-2.0](LICENSE). The data belongs to its publishers under their own terms (see above).
