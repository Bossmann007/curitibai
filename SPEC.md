# SPEC: v0.68.0 Annual procurement plan (PCA)

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Answer "O que a Prefeitura planeja comprar em 2027?" from the Plano de Contratações Anual (PCA) that Curitiba municipal
bodies publish in PNCP: how much each body plans to spend in a year, split by category (material, service, works) and
by requesting unit (secretaria, departamento). Never supplier data. Smallest change: a `plan` mode of
`procurement_search`.

## Source (read 2026-11-27 UTC)

`pncp.gov.br`, already contacted by `procurement_search` (same host, same gate, no new host or link). robots.txt 404
(2026-11-27 00:54:17 UTC, User-Agent `curitibai-mcp/0.68`). gov.br/pncp "Dados Abertos" page, reread 01:01:54 UTC:
the APIs give "itens do plano de contratações anual" and "Todas as buscas podem ser feitas sem necessidade de cadastro
ou login"; the site is under CC BY-ND 3.0; no API terms found.

The briefed route, Consulta `/api/consulta/v1/pca/atualizacao?cnpj=...`, timed out twice at 40 s and then answered
in 27.8 s with 9,015 item rows (902 pages of 10) for one CNPJ and no year filter: unusable inside a 20 s call. Its two
other PCA routes need a platform user id or a catalogue class. The PNCP API's own read routes (no auth in its OpenAPI)
answer in about 0.1 s:

- `GET /api/pncp/v1/orgaos/{cnpj}/pca/{ano}/consolidado/unidades?pagina=1&tamanhoPagina=500`: one row per requesting
  unit (name, item count, total value, publication and update dates). Município de Curitiba 2027: 31 units, 4,897
  items, R$ 4,161,572,267.52, equal to its `/consolidado` total.
- `GET /api/pncp/v1/orgaos/{cnpj}/pca/{ano}/valorescategoriaitem`: item count and total per category (Material,
  Serviço, Obra, ...).
- No plan for that body and year: HTTP 404 (the units route says "CNPJ do Órgão/Entidade inválido" even for a listed
  body) or 422 "Nenhum Plano de Contratação Anual cadastrado para o ano informado".

Item rows (descriptions) are not read: thousands per body, and free text.

## Changes

1. **Mode** `plan` of `procurement_search` (`src/tools/procurementPlan.ts`, one early branch in the handler). Inputs
   `mode` (`search` default, unchanged), `year` (default next year in Brasília, at most next year), `body_cnpj`
   (default `76417005000186`, Município de Curitiba; only the 15 listed bodies); `limit` caps the units. Search-only
   arguments in plan mode, and `year`/`body_cnpj` without it, are `invalid_argument`. Output `data` is the search
   object (unchanged) or the plan object: body, year, `plan_found`, item count, total, first publication and last
   update, `categories[]`, the `units[]` with the largest totals, `units_total`, `discarded`, note. Two requests at
   most, through the PNCP gate: units first; no plan stops there.
   Why a mode and not a sibling tool: tool descriptions sum to 9,586 of the 9,600 ceiling (`test/contracts.test.ts`);
   a sibling needed about 225 characters cut from other tools. The brief named the mode first, and ADR 0005's own
   example (`tax_reform_curitiba`) has topics with different answer shapes. The rewritten description is 398
   characters; the sum is 9,593.
2. **Source** (`src/sources/pncp.ts`): URLs, a strict parser (rows of another CNPJ or year, or with a missing field,
   are dropped and counted; a body that is not an array, or rows that all fail, is `source_unavailable`), unit and
   body names through `maskObject`, and a 404/422 returned as "no plan" inside the gate's turn, so the gate does not
   hold back the host.
3. **Eval**: q140 "O que a Prefeitura planeja comprar em 2027?" → `procurement_search {mode: "plan", year: 2027}`,
   expect `ok` with `data.units` and `data.categories`; synthetic fixtures. `RESULT_PATH` reads `data.items` or
   `data.units`.
4. **Docs and version**: docs/tools.md (row and Curitiba App "extra" row), docs/sources.md (robots rows, PCA section
   with every request), README row, docs/roadmap-1.0.md, CHANGELOG 0.68.0, version 0.68.0 in `package.json`,
   `package-lock.json`, `server.json`. Still 27 tools.

## Out of scope

Item lists, a search inside a plan, other years' comparisons, every listed body in one call, the PCA CSV (bulk
download), a public PNCP page link (the app route was not read).

## Check

- `npx vitest run test/procurementPlan.test.ts test/contracts.test.ts test/eval`: plan with categories and the top
  units sorted by total; masked unit names; dropped foreign rows; no plan → `plan_found: false` and the host still
  answers the next call; unlisted CNPJ, a future year and mixed search/plan arguments → `invalid_argument`; q140 ok;
  descriptions ≤ 9,600.
- `node scripts/eval-summary.mjs`: `answered 136 / 140`.
- `scripts/verify` exits 0 on the PR head; packed size under the `MAX_PACKED_BYTES` limit.
