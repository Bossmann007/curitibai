# SPEC: v0.26.0 release preparation (npm and MCP Registry)

Approved: Enzo 2026-11-24 ("segue com o curitibaai", roadmap step after v0.25; task brief "curitibai v0.26.0 —
prepare publication to npm and the official MCP Registry"). Scope frozen: package metadata, `server.json`, a manual
publish workflow, a package-contents check, release docs and one docs fix. **Nothing is published by this version**:
no `npm publish`, no `mcp-publisher publish`, no npm login, no new secret, no tag push, no workflow run. The owner
publishes later with his own npm account.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Make `curitibai-mcp` installable with `npx` and listed in the official MCP Registry once the owner publishes it, with
a tarball that holds only what users need and a publish path that needs no stored token.

## Changes

1. **`package.json`**: `private` removed; `files` = `dist/`, `CHANGELOG.md`, `docs/licences.md` (the ODbL notice for
   the bundled OSM extract, with the other data licences; `LICENSE` is Apache-2.0 only); `mcpName`
   `io.github.Bossmann007/curitibai`; `repository`, `homepage`, `bugs`, `keywords`; `publishConfig.access: public`.
   `publishConfig.provenance` is **not** set: npm adds provenance automatically with trusted publishing, and the
   setting would make the manual first publish from a laptop fail (provenance needs a supported CI). `engines`
   unchanged.
2. **`server.json`** (schema `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`): name =
   `mcpName`, description at most 100 characters, version = `package.json`, one npm stdio package, the environment
   variables `CURITIBAI_DATA_DIR` and `CURITIBAI_REMOTE_DATA` (optional, not secret).
3. **`test/serverJson.test.ts`**: validates `server.json` with Ajv (draft-07 + formats) against the schema vendored in
   `test/fixtures/mcp-registry/server.schema.json`, whose `$id` must equal `server.json`'s `$schema`; name, version,
   identifier and repository agree with `package.json`. `ajv` 8.20.0 and `ajv-formats` 3.0.1 become pinned
   devDependencies (already installed through the MCP SDK).
4. **`scripts/check-pack.mjs`** (verify step after the build): `npm pack --dry-run --json` paths must match an
   allowlist (`package.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, `docs/licences.md`, `dist/**.js`), none may
   be `data-local/`, test, fixture, `src/`, `.env*` or `*.local`, and no `dist/` file may lack a `src/` module (a leftover of an earlier build), and the packed size must be at most 250,000 bytes
   (0.26.0: about 179,000; about 40% headroom). Unit tests in `test/checkPack.test.ts`.
5. **`.github/workflows/publish.yml`**: `workflow_dispatch` only, this repository only, on `main` or a `v*` tag, and
   only when the commit is the one tagged `v<version>`; actions pinned by SHA, `mcp-publisher` v1.8.1 checked with
   cosign as the registry docs show. Job `verify` (`contents: read` only): tag, `server.json` version, package exists
   on npm (a 404 says "publish the first version by hand"; other errors are shown as they are), `scripts/verify`,
   `dist/` uploaded. Job `publish` (`id-token: write`, no `npm ci`, no tests): Node ≥ 22.14, npm ≥ 11.5.1, OIDC
   token, `check-pack`, `mcp-publisher validate`, `login github-oidc`, `npm publish --ignore-scripts` (skipped when
   the version is already on npm), wait until npm serves the version's `mcpName`, `mcp-publisher publish`. A refused
   `npm publish` prints which npmjs.com fields to check.
6. **Docs**: README "Install from npm (after the first release)"; `docs/development.md` "Release" (first release by
   hand, then trusted publishing); CHANGELOG 0.26.0; the `docs/tools.md` login rows (156, Scheduling, Cartão
   Transporte) say "needs a registration or login (owner's note; not confirmed in the linked sources); out of scope".

## Out of scope

Publishing anything; changing `engines` (Node 22.12 and 24 results go in the PR body only); tool behaviour; staged
publishing (`npm stage publish`) in the workflow; creating the `v0.26.0` tag.

## Check

- `scripts/verify` exits 0 and prints the package size.
- `test/serverJson.test.ts` fails when `server.json`'s version differs from `package.json` or its description is
  over 100 characters (shown by editing and restoring).
- The packed tarball installed in an empty folder runs `npx --no-install curitibai-mcp` and answers `tools/list` with
  25 tools and version 0.26.0.
- `actionlint` reports nothing on `publish.yml`.
