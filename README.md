# CuritibAI

A read-only [MCP](https://modelcontextprotocol.io) server that gives AI assistants public data about Curitiba, Brazil:
bus lines, timetables and stops from URBS, and the catalogue of the Portal de Dados Abertos de Curitiba.

**Unofficial. Not affiliated with, endorsed by or connected to the Prefeitura de Curitiba or URBS.**
Data comes from their public websites as they are; always confirm important information at the source.

## Tools

All tools are read-only. A successful call returns `{data, source_url, fetched_at, license_note}`.
When a source fails, times out or changes format, the tool returns `{"error":"source_unavailable"}` and no data.
Other errors: `url_not_allowed`, `line_not_found`. Errors are returned as JSON text with `isError: true`.

| Tool | Input | Returns | Source (checked 2026-11-19) |
|---|---|---|---|
| `bus_lines_search` | `query?`, `limit` ≤ 50 | Active lines: code, name, category, colour, card-only | URBS `linhas_ativas.json` (used by [Horário de Ônibus](https://www.urbs.curitiba.pr.gov.br/portal/horario-de-onibus/)) |
| `bus_line_schedule` | `line_code`, `day_type`: `weekday` \| `saturday` \| `sunday` | Planned departures by departure stop, wheelchair-lift flag, validity dates, notes. Picks the period URBS marks current, as its website does | URBS `linha_{code}_v2.json` (same page) |
| `bus_stops_near` | `lat`, `lon`, `radius_m` ≤ 1000 | Stops in the radius, nearest first (max 50), with lines | URBS [Relação de Pontos de Parada](https://www.urbs.curitiba.pr.gov.br/portal/transporte/rede-integrada-de-transporte/relacao-de-pontos-de-parada/) |
| `open_datasets_search` | `query`, `limit` ≤ 20 | Dataset title, publisher, description, formats, last update, detail URL | [Portal de Dados Abertos de Curitiba](https://dadosabertos.curitiba.pr.gov.br/) search |
| `open_dataset_preview` | `dataset_url`, `rows` ≤ 20 | Column names and the first rows of the dataset page's preview table | Portal dataset detail page |

Details for each source (format, terms, robots.txt) are in [docs/sources.md](docs/sources.md).

### Deferred tools

Not implemented, because no source could be confirmed for automated access on 2026-11-19:

| Tool | Reason |
|---|---|
| `health_units_search` | The full "Unidades de Atendimento" CSV is only on the UFPR mirror `dadosabertos.c3sl.ufpr.br`, whose `/curitiba/robots.txt` says `Disallow: /`; that host is also outside the allowlist. The portal page shows a 20-row preview only |
| `schools_search` | Same base and reason as `health_units_search` |
| `markets_fairs_list` | Fairs data is only on the same mirror (latest file from 2017); portal search returns nothing |
| `garbage_collection_by_street` | No source found: portal searches for "lixo", "coleta" and "residuos" return nothing relevant (only "Clique Economia"); not searched elsewhere |
| `culture_agenda` | `AgendaPMC` / `FundacaoCultural` files are only on the same mirror |
| `city156_categories` | 156 data is only on the same mirror; no category-only list was confirmed |

Out of scope by design: gov.br/CPF login, payments, scheduling, opening or looking up 156 tickets, personal data,
any tool that writes, and real-time feeds that need a key (the URBS WebService redirects to a login page).

## Run it

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run build
node dist/server.js   # speaks MCP over stdio; it prints nothing else
```

Add it to an MCP client, for example Claude Desktop (`claude_desktop_config.json`) or any client that takes the
same shape:

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

- No telemetry, no secrets, no `.env`, no files written. The cache is in memory only (10 minutes) and is keyed by
  the request sent to the source (URL, plus the search term for `open_datasets_search`). Coordinates are never part
  of a request or a cache key.
- `bus_stops_near` downloads the whole stop list and computes distances locally. Your coordinates are never sent to
  any server, logged or stored.
- Requests go only to `https://` hosts equal to or under `curitiba.pr.gov.br` (this includes `urbs.curitiba.pr.gov.br`
  and `dadosabertos.curitiba.pr.gov.br`), on the default port, without credentials. Every redirect hop is checked
  against the same list, so `open_dataset_preview` cannot be used to reach other hosts.
- Requests use a generic User-Agent, `curitibai-mcp/0.1`, a 10 s timeout and an 8 MB response cap.
- Text from the sources is returned as plain data fields with HTML removed. It is never meant as instructions.

## Limits

- The sources are websites, not documented APIs. The URBS files are the data behind its own web widgets and can
  change or disappear without notice; the tools then return `source_unavailable`.
- Both sites sit behind an Akamai edge that rejected `curl` with every User-Agent but accepted Node.js `fetch`
  (2026-11-19). A change there can make every tool return `source_unavailable`. This server never imitates a browser.
- Timetables are planned times, not real-time positions. `sunday` also covers holidays.
- The portal search matches accents literally ("saude" and "saúde" can differ) and finds nothing for some
  everyday words ("onibus", "feira"). Later result pages are slow; when one times out, the tool returns the
  results it has with `partial: true`.
- Dataset detail pages can take several seconds (7 s seen), close to the 10 s timeout.
- `open_dataset_preview` shows only the preview table the portal itself publishes (at most 20 rows). It cannot read
  the full files, which live on the UFPR mirror.
- `open_dataset_preview` is generic: some portal datasets (for example the public servants payroll) name people.
  The tool returns what the portal publishes, with no filtering of personal data.
- Licence: portal data is CC BY 4.0 and its usage rules require citing the source and a disclaimer; each result's
  `license_note` carries them. No licence or terms of use were found for the URBS files.

## Development

```sh
scripts/verify   # npm ci, tsc --noEmit, eslint, vitest, build, stdio smoke test; npm audit reported separately
```

Tests run offline: every network call is stubbed and an unstubbed call fails the test. Parser tests use trimmed real
responses in `test/fixtures/` (contact cells removed).

## License

No licence has been chosen for the code yet. The data belongs to its publishers under their own terms (see above).
