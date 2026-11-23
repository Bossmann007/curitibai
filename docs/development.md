# Development

```sh
scripts/verify   # no tracked carta-servicos.json, URBS export, events output or HTML capture, relative Markdown links resolve, npm ci, tsc --noEmit, eslint, vitest, build, stdio smoke test; npm audit reported separately
```

`scripts/verify` is the required local check. The CI workflow `.github/workflows/verify.yml` is set to run it on every
pull request and on pushes to `main`: one Ubuntu job, Node from `.nvmrc`, actions pinned by commit SHA, read-only token, no secrets, 10-minute timeout. It sets
`CURITIBAI_SKIP_AUDIT=1`, so the separate `npm audit` step is skipped there: it never changes the result, and new
advisories would only add noise to unrelated CI runs (Dependabot, `.github/dependabot.yml`, opens weekly npm and
GitHub Actions update PRs instead).

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

## Scheduled workflows

| Workflow | When | What it does |
|---|---|---|
| `.github/workflows/collect.yml` | Nightly, 02:37 UTC plus four retries | Events and useful phones to the `data` branch ([docs/sources.md](sources.md#published-nightly-copy-of-the-events-and-phones-files-since-0180)) |
| `.github/workflows/receita-version.yml` | Day 1 of each month, 09:23 UTC | Receita calculator version check: `receita/version.json` on `data`, one issue when it changed ([docs/sources.md](sources.md#monthly-check-of-the-receita-federal-calculator-version-unreleased)) |

Both also run by hand (Actions, "Run workflow", or `gh workflow run <file>`) and only on `Bossmann007/curitibai`
`main`. To turn one off: Actions, select the workflow, "..." menu, "Disable workflow", or
`gh workflow disable receita-version.yml` (`gh workflow enable` turns it back on). Removing its `schedule:` block in
a PR turns it off for good. GitHub also disables scheduled workflows in public repositories after 60 days without
repository activity.
