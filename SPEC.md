# SPEC: v0.28.0 service guides with consent at every step ("route 2")

Approved: Enzo 2026-11-24 (task brief "curitibai v0.28.0, route 2": "sim mas apenas se ele autorizar"). **This change
publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

The citizen's own assistant can help them use city services that need a login (156, Saúde Já, IPTU, Cartão
Transporte, Agenda Online, creche registration, Detran-PR), only with the citizen's explicit authorization at every
step. CuritibAI stays read-only: guidance and official links only; the citizen acts.

## Changes

1. **New tool `city_service_guide`** (`src/tools/cityServiceGuide.ts`; [ADR 0010](docs/adr/0010-service-guides-consent-at-every-step.md)).
   Input: `service` (enum of 7 guide ids), optional `open_step` (1–10). Output `{data, source_url, checked_at,
   license_note, note}`. `data.steps` is a numbered list; each step has `needs_consent`, a plain-Portuguese `consent`
   line (what happens and what the citizen types on the official site), `citizen_types_on_site`, `url`, `url_host` and
   `link_source`. `data.carta` gives the status of the user's local Carta copy, and `data.delegation` mentions the
   Autorização Digital as information. Annotations: `readOnlyHint: true`, `destructiveHint: false`,
   `idempotentHint: true`, `openWorldHint: true` (the server makes no network call, but `open_step` can lead the
   client to open an external site). Description within the size guard (each ≤ 400
   characters, sum ≤ 9,600; now 9,588).
2. **Host allowlist** `isAllowedUrl`: https only, no credentials, no port, no punycode label. Hosts: subdomains of
   `curitiba.pr.gov.br` except `obituarios.curitiba.pr.gov.br`, plus `www.detran.pr.gov.br`,
   `www.agendamento.detran.pr.gov.br` and `www.gov.br`. Fixed links and how each was checked: docs/tools.md,
   "`city_service_guide` consent and links".
3. **Carta copy** (`carta-servicos.json`, never committed; `scripts/check-no-catalog` unchanged): a guide's title query
   must match exactly one service to give a Carta link. Several matches are returned as candidates with no link.
   Without the file, the guide keeps its fixed links and `carta.message` says how to save the copy.
4. **`open_step`**: `ToolContext.elicitUrl` (built per call in `src/server.ts`) sends a URL-mode elicitation only when
   the client declared `elicitation.url` (SDK 1.32.2, protocol 2025-11-25), with a 55 s timeout (under the 60 s default tools/call timeout of SDK clients). The message is
   fixed server text. Results: `accepted` (link returned), `declined` / `cancelled` / `no_answer` (no link, told to
   stop), `not_supported` (link returned, told to ask in the conversation first).
5. **Docs and version**: README (28 tools, row), docs/tools.md (reference row, consent and links section, Curitiba
   App rows 156, scheduling, IPTU, Cartão Transporte and creche), docs/privacy.md, docs/local-data.md, ADR 0010 and the
   index, CHANGELOG 0.28.0, version 0.28.0 in `package.json`, `package-lock.json` and `server.json`, this SPEC.

## Out of scope

Logging in, submitting, paying or fetching any page; form-mode elicitation; the 2026-07-28 `InputRequiredResult`
mechanism (not in the SDK yet; ADR 0010); following a 156 protocol; Vale Creche; publishing; tags.

## Check

- `test/cityServiceGuide.test.ts`, on handler output for every guide with and without a Carta copy: consent flags
  on every outward step, no URL outside the allowlist (and the allowlist refuses lookalike hosts), no personal-data
  request in steps and an input of an enum and an integer only, the behaviour without the Carta file, and
  `open_step` with accept, decline, cancel, no capability and out-of-range steps over `InMemoryTransport`.
- `scripts/smoke.mjs` calls `open_step` over stdio with a client that has no elicitation capability (fallback).
- `scripts/verify` exits 0 (in a clone without tags, as CI runs it).
