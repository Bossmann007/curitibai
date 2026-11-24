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

Only the owner publishes, by hand: `.github/workflows/publish.yml` runs only from "Run workflow" (never on a tag push
or a push), on `main` or on a `v*` tag, and only when that commit is the one tagged `v<package.json version>`. Its
`verify` job (no OIDC token) checks the tag, `server.json`'s version and that the package exists on npm, runs
`scripts/verify`, writes the tarball's sha256 to the job summary and hands `dist/` on. Its `publish` job runs in the
GitHub environment `release`, so it waits for the owner's approval (see "Approving a run" below). It has the OIDC
token but runs no `npm ci` and no tests; it checks the tag again, Node, npm, the package contents and that the
tarball's sha256 is the one the verify job printed, validates `server.json` with the MCP Registry, hashes that same
tarball again and runs `npm publish` on that file (trusted publishing, so no npm token and automatic
[provenance](https://docs.npmjs.com/trusted-publishers)), waits until npm
serves the version, then runs `mcp-publisher publish` (GitHub OIDC, namespace `io.github.Bossmann007`). It skips
`npm publish` when that version is already on npm, so a run whose MCP Registry step failed can be run again.
`scripts/verify` checks the tarball (`scripts/check-pack.mjs`: allowlist, leftovers, secret-shaped lines, size) and
that `server.json` is valid and has the same version as `package.json` (`test/serverJson.test.ts`). Why the
environment: npm's trusted publisher names only the owner, repository, workflow file and environment, and a workflow
runs from the ref it is started on, so without it a pushed branch with an edited `publish.yml` could publish. Keep
`id-token` out of every other workflow (`test/workflows.test.ts` fails otherwise).

Before the first run, once:

1. GitHub, Settings, Environments, New environment `release`: Required reviewers = Enzo; "Prevent self-review" OFF (Enzo both starts the run and is the only reviewer, so with it on nobody could approve); "Allow administrators to bypass configured protection rules" OFF (by default administrators can bypass the protection rules; [GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)); Deployment branches and tags = Selected branches and tags, only `main` and `v*` (tag).
2. Required: GitHub, Settings, Rules, a tag ruleset on `v*` so only the owner can create, move or delete those tags. The environment trusts any `v*` tag, so without the ruleset anyone with write access could push a `v*` tag at another commit and start a run from it.

Approving a run (every release): approve `release` only when the run is on `main` or on a `v*` tag you pushed
yourself, and the commit shown on the approval screen is the release commit (the merge commit you tagged). The
sha256 in the summary only proves that the tarball did not change between the verify and publish jobs; it does not
prove where it came from. The commit and the ref do. Never approve a run on tag `v0.26.0`: it carries the 0.26.0
`publish.yml` without the 0.26.1 hardening, and the environment admits every `v*` tag. (npm 11.20.0 refuses to publish
0.26.0 without `--tag` once 0.26.1 is on npm, `lib/commands/publish.js`; older npm may not, so do not rely on it.) Deleting that tag, or
excluding it from the environment, is the owner's call; `scripts/check-release.mjs` expects the previous release to
be tagged, so a deletion needs that check changed too.

Accepted risk: the approval can also be given through the GitHub API
([review pending deployments](https://docs.github.com/en/rest/actions/workflow-runs#review-pending-deployments-for-a-workflow-run):
"personal access tokens (classic) need the repo scope"), by any token of Enzo's with that scope. The human gate
therefore holds only while no agent, script or bot holds such a token. Recommended: a separate reviewer account with
a passkey as the required reviewer, or, for agents, fine-grained tokens without the deployments and environments
permissions (that page names no fine-grained permission for the endpoint, so check the token's permissions list).

Not verified: whether the MCP Registry accepts the GitHub OIDC login when the token's `sub` claim has the
`environment:release` form (a job in an environment gets that form instead of the ref). The workflow logs in
(`mcp-publisher login github-oidc`) before `npm publish`, so the first run shows a refusal before anything
irreversible.

First release (0.26.1), once. Tag `v0.26.0` is the commit before this hardening (the merge of PR #36): never publish
from it.

1. Merge the release PR (#37), then tag its merge commit: `git tag v0.26.1 <merge commit> && git push origin v0.26.1`.
2. In a clean clone of that tag, run `scripts/verify` (exit 0; it also builds `dist/`).
3. Log in to npm with your account (2FA on): `npm login`.
4. In that clone, pack once and note the sha256: `npm pack --ignore-scripts`, then `shasum -a 256 curitibai-mcp-0.26.1.tgz`. Publish that file by hand: `npm publish ./curitibai-mcp-0.26.1.tgz --ignore-scripts --access public` (npm's [npm trust](https://docs.npmjs.com/cli/v12/commands/npm-trust) page says a trusted publisher needs a package that already exists). Right after it, run `npm logout`, so no npm session token stays on the machine.
5. On npmjs.com, package `curitibai-mcp`, Settings, Publishing access: "Require two-factor authentication and disallow tokens" (trusted publishing keeps working: [docs](https://docs.npmjs.com/trusted-publishers)).
6. Actions, `publish`, "Run workflow" on tag `v0.26.1`. Before approving, compare the sha256 in the verify job's summary with the one noted in step 4 (a cross-check, not a gate: a build on a Mac may differ from the Linux one; the verify job stops at the npm 404 until step 4 is done, so this comparison can only come after it). Check the ref and the commit on the approval screen (see "Approving a run"), approve `release`: it skips npm (0.26.1 is there) and publishes `server.json` to the MCP Registry; no trusted publisher is needed yet.
7. Check: `npm view curitibai-mcp version` and `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.Bossmann007/curitibai"`.

Every later release:

1. Merge the release PR, tag its merge commit `vX.Y.Z` on `main` and push the tag.
2. First time only, at most 2 days before step 4 (a new trusted publisher expires if its first publish does not happen within 2 days): on npmjs.com, package `curitibai-mcp`, Settings, Trusted publishing: GitHub Actions, owner `Bossmann007`, repository `curitibai`, workflow `publish.yml`, Environment name = `release`.
3. First time only, in the same form, under "Allowed actions", also allow `npm publish` (new configurations allow only `npm stage publish`).
4. Actions, `publish`, "Run workflow" on `main` (or on the tag if `main` moved on), check the ref and the commit on the approval screen (see "Approving a run"), approve `release`; if the trusted publisher is wrong it fails and names the npmjs.com fields to check.

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
