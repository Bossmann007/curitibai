# SPEC: v0.39.0 Defesa Civil alerts

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.39.0, phase B of docs/roadmap-1.0.md"). **This change publishes
nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): close the Curitiba App gap "Defesa Civil alerts". A citizen
who asks "tem alerta de chuva/temporal em Curitiba?" gets the active official weather warnings that cover Curitiba
(`weather_alerts`, INMET, since v0.5) and, with `city_service_guide` (`defesa_civil`), how to receive Defesa Civil
alerts on the phone, with consent at every step ([ADR 0010](docs/adr/0010-service-guides-consent-at-every-step.md)).

## Prior art

`weather_alerts` already reads INMET's warnings API (`apiprevmet3.inmet.gov.br/avisos/ativos`) filtered to IBGE
4106902, with a synthetic fixture and no network in tests: reused, not rebuilt. No MCP server or library for INMET
warnings, Alerta-AS or Defesa Civil alerts was found (web search 2026-11-25: a hosted INMET station/forecast MCP
listing with no warnings tool, an INMET REST wrapper for station data, NWS-only alert servers). Decision: reuse
`weather_alerts`, build the guide.

## Changes

1. **Guide** (`src/tools/cityServiceGuide.ts`): `defesa_civil`. Steps: ask the citizen (no personal data in the
   conversation); the Carta page (as `le_digital` and `estar`); read INMET's warnings with `weather_alerts` (stays in
   the conversation); open the Anatel "Defesa Civil Alerta" page on `www.gov.br` (cell broadcast: compatible phones on 4G or 5G in the risk area, no sign-up);
   since 0.39.1, open the federal sign-up service page on `www.gov.br` (consent; nothing typed);
   type the CEP in the phone's SMS app to 40199 (consent; nothing sent); send the SMS (consent; the citizen sends it,
   the assistant never sends anything). The CEP is never asked in the conversation and is not a tool input.
   Emergencies: Defesa Civil 199 (in `what`). `fromWebSearchAt` 2026-11-25; the `note` says the SMS steps come from
   the Paraná government's page (`www.parana.pr.gov.br`, not on the link allowlist, so no link), that list/cancel
   commands and other channels were not verified, and that no per-bairro alert feed exists here.
2. **Links**: the Carta step, plus only `https://www.gov.br/anatel/pt-br/dados/utilidade-publica/alertas-de-desastres/defesa-civil-alerta`
   and, since 0.39.1, `https://www.gov.br/pt-br/servicos/solicitar-cadastro-para-recebimento-de-avisos-e-alertas-de-desastres`
   (host `www.gov.br`, already in `EXACT_HOSTS`). `EXACT_HOSTS` and `ALLOWED_HOSTS` unchanged; no new network host.
3. **Carta words**: `[["alerta", "defesa", "civil"], ["alertas", "defesa", "civil"]]`, mirrored in
   `scripts/coverage-report.mjs` `GUIDE_TERMS`. Since 0.39.1 the title also needs a subscription word (`cadastro`,
   `sms`, `receber`, `recebimento`) or is the bare "Alerta(s) (da) Defesa Civil" (`needs`, mirrored in `GUIDE_NEEDS`).
4. **`weather_alerts`**: its note also names INMET's warnings page (since 0.39.1 `avisos.inmet.gov.br`, plain host
   with no scheme, and the older `alertas2.inmet.gov.br`; text only, outside the
   guide allowlist, as `weather_forecast` names `portal.inmet.gov.br`) and the `defesa_civil` guide.
5. **Eval**: q102 ("is there an alert now") moves to `weather_alerts` (city-wide; no per-bairro feed), q103 ("how do
   I receive alerts") to the guide. The tool title and description name sign-ups and phone alerts, not only logins.
6. **Docs and version**: `docs/tools.md` (row, fixed-link table, comparison row "Defesa Civil alerts" covered by
   guide), `docs/sources.md`, `docs/roadmap-1.0.md`, README, CHANGELOG 0.39.0, version 0.39.0 in `package.json`,
   `package-lock.json`, `server.json`, tool contract snapshot (the `service` enum, the tool title and description).

## Out of scope

A per-bairro or Defesa Civil alert feed (IDAP is restricted, SISDC-PR is for public bodies); any request to
`alertas2.inmet.gov.br`, `www.parana.pr.gov.br` or `www.gov.br`; sending SMS or storing a CEP.

## Check

- `npx vitest run test/cityServiceGuide.test.ts test/inmet.test.ts`: the guide invariants, the CEP and send as two
  separate consent steps with nothing sent by the assistant, the link host, narrow Carta words, the alerts note.
- `node scripts/eval-summary.mjs`: Defesa Civil gaps gone; `node scripts/coverage-report.mjs`: 14 of 18 Curitiba App
  rows covered.
- `scripts/verify` exits 0 on the PR head.
