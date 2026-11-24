# Development

```sh
scripts/verify   # no tracked carta-servicos.json, URBS export, events output or HTML capture, relative Markdown links resolve, npm ci, tsc --noEmit, eslint, vitest, build, package contents (npm pack --dry-run), stdio smoke test; npm audit reported separately
```

`scripts/verify` is the required local check. The CI workflow `.github/workflows/verify.yml` is set to run it on every
pull request and on pushes to `main`: one Ubuntu job, Node from `.nvmrc`, actions pinned by commit SHA, read-only token, no secrets, 10-minute timeout. It sets
`CURITIBAI_SKIP_AUDIT=1`, so the separate `npm audit` step is skipped there: it never changes the result, and new
advisories would only add noise to unrelated CI runs (Dependabot, `.github/dependabot.yml`, opens weekly npm and
GitHub Actions update PRs instead).

Tool names, `inputSchema` and `outputSchema` are a public contract: `test/contracts.test.ts` compares what the real
server sends in `tools/list` with the committed snapshot `test/fixtures/tool-contracts.json` and fails naming each tool
added, removed or changed. When the change is on purpose, rewrite the snapshot with `npm run contracts:update` and add
a `CHANGELOG.md` entry in the same pull request. The same test prints the size of `tools/list` in characters
(descriptions, inputSchemas, outputSchemas, total) and fails when a tool description is over 400 characters or
the descriptions sum is over its ceiling (`MAX_DESCRIPTION` and `MAX_DESCRIPTIONS_SUM` in the test; numbers and
reason in `SPEC.md`). Move long notes to `docs/tools.md` or the response instead of raising the ceiling.

Tests run offline: every network call is stubbed, and an unstubbed call fails the test. Portal parser tests use
trimmed real responses in `test/fixtures/`. CNES tests use **synthetic** fixtures (`test/fixtures/cnes_*_synthetic.json`:
the real JSON shape with invented values), PNCP tests use a synthetic fixture with planted supplier keys, CPF, e-mail,
phone and names (`test/fixtures/pncp_contratacoes_synthetic.json`), INMET tests use synthetic fixtures with the real
shape (`test/fixtures/inmet_*_synthetic.json`: invented texts, polygons and icons, a near-miss geocode, a warning listed
twice), OSM tests use trimmed real Overpass responses recorded on 2026-11-21 (`test/fixtures/osm_*_recorded.json`: the
libraries answer; OpenStreetMap data, © OpenStreetMap contributors, ODbL 1.0) and synthetic responses
for edge cases (`test/fixtures/osm_*_synthetic.json`, with planted e-mail, phone, credential and `javascript:` links),
and CSV tests use synthetic files.
`city_services_search` tests and the smoke test use a small synthetic catalog
(`test/fixtures/carta_servicos_synthetic/carta-servicos.json`: invented services in the real file shape, with an
e-mail to mask, an empty summary, obituary, `javascript:` and credential links); no real catalog text is in the
repository. `.gitignore` ignores `carta-servicos.json` in any folder, and `scripts/check-no-catalog` (the first verify
step) fails if git tracks one anyway (e.g. after `git add -f`); only that synthetic fixture is exempt, and the guard
also fails if that fixture is modified in the work tree. The same guard fails if git tracks a URBS daily export
(`YYYY_MM_DD_*.json` or `.json.xz`, any folder, any case), with no exemption; `.gitignore` ignores those names too. The
bus tests and the smoke test use small synthetic files in the URBS shape (`test/fixtures/urbs_synthetic/`: invented
lines, stops and times, with a planted e-mail, phone and street-number range, an empty coordinate and an unknown day
code); they have no date in their names and are copied to a temporary folder under dated names when used. The guard
also fails if git tracks anything in a folder named `events` (the collector's output) or an `.html`, `.htm`, `.mhtml` or
`.har` file outside `test/fixtures/`, and `.gitignore` ignores them. The events tests use synthetic pages
(`test/fixtures/events_synthetic/`: invented events in the site's markup, with a planted description, contacts, ticket
and external link that must not be kept) and run the collector with a fake clock and a fake network. The guard
must run at the top of a checkout (exit 2 elsewhere).

## Release

Only the owner publishes, by hand: `.github/workflows/publish.yml` runs only from "Run workflow" on `main` (never on a
tag or a push). It checks the Node and npm versions, the OIDC token and that the package exists on npm, runs
`scripts/verify`, validates `server.json` with the MCP Registry, then runs `npm publish` (trusted publishing, so no
npm token and automatic [provenance](https://docs.npmjs.com/trusted-publishers)) and `mcp-publisher publish` (GitHub
OIDC, namespace `io.github.Bossmann007`). It skips `npm publish` when that version is already on npm, so a run whose
MCP Registry step failed can be run again. `scripts/verify` checks the tarball (`scripts/check-pack.mjs`) and that
`server.json` is valid and has the same version as `package.json` (`test/serverJson.test.ts`).

First release (0.26.0), once:

1. Merge the release PR, then tag its merge commit: `git tag v0.26.0 <merge commit> && git push origin v0.26.0`.
2. In a clean clone of that tag, run `scripts/verify` (exit 0; it also builds `dist/`).
3. Log in to npm with your account (2FA on): `npm login`.
4. Publish the first version by hand: `npm publish --access public` (npm's docs say a trusted publisher can only be configured for a package that exists: [npm trust](https://docs.npmjs.com/cli/v12/commands/npm-trust)).
5. On npmjs.com, package `curitibai-mcp`, Settings, Trusted publishing: GitHub Actions, owner `Bossmann007`, repository `curitibai`, workflow `publish.yml`, no environment.
6. In the same form, under "Allowed actions", also allow `npm publish` (new configurations allow only `npm stage publish`).
7. Actions, `publish`, "Run workflow" on `main`: it skips npm (0.26.0 is there) and publishes `server.json` to the MCP Registry.
8. Check: `npm view curitibai-mcp version` and `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.Bossmann007/curitibai"`.

Every later release:

1. Merge the release PR, tag its merge commit `vX.Y.Z` on `main` and push the tag.
2. Actions, `publish`, "Run workflow" on `main`; it fails with ENEEDAUTH and names the npmjs.com fields if the trusted publisher is wrong.

## Scheduled workflows

| Workflow | When | What it does |
|---|---|---|
| `.github/workflows/collect.yml` | Nightly, 02:37 UTC plus four retries | Events and useful phones to the `data` branch ([docs/sources.md](sources.md#published-nightly-copy-of-the-events-and-phones-files-since-0180)) |
| `.github/workflows/receita-version.yml` | Days 1 and 2 of each month, 09:23 UTC (day 2 is a retry; no change since day 1 means no commit, no issue) | Receita calculator version check: `receita/version.json` on `data`, one issue when it changed ([docs/sources.md](sources.md#monthly-check-of-the-receita-federal-calculator-version-since-0211)) |

Both also run by hand (Actions, "Run workflow", or `gh workflow run <file>`) and only on `Bossmann007/curitibai`
`main`.

Manual run of the Receita check: `gh workflow run receita-version.yml --ref main` (or Actions, `receita-version`,
"Run workflow" on `main`), then `gh run watch`. What to expect, in the job log of `scripts/publish-receita-version.sh`:

- First run (no `receita/version.json` on `data` yet): `code=baseline exit=0`, then `pushed to 'data'`; the `data`
  branch gets one commit with only `receita/version.json`; no issue.
- Later run, same version: `code=unchanged exit=0` and `nothing changed; no commit`; no issue.
- Version changed: `changed ... (issue created)` (or `issue existing` when an open issue has the same
  title), `code=changed exit=0`, then the commit; one issue "Receita: calculadora mudou (...)".
- Receita down or an unexpected answer: `code=receita_unavailable` or `invalid_response`, exit 1 (red run), no commit,
  no issue.
- A corrupt `receita/version.json` on `data` (not JSON or the wrong shape): `code=previous_unreadable`, exit 1, no
  request, no commit and no issue; every monthly run stays red until someone fixes or deletes that file by hand on
  `data` (deleting it makes the next run a new baseline).

To turn one off: Actions, select the workflow, "..." menu, "Disable workflow", or
`gh workflow disable receita-version.yml` (`gh workflow enable` turns it back on). Removing its `schedule:` block in
a PR turns it off for good. GitHub also disables scheduled workflows in public repositories after 60 days without
repository activity.
