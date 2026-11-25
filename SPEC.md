# SPEC: v0.42.0 Vale-Creche guide

Approved: Enzo 2026-11-25 (task brief "CuritibAI v0.42.0, Vale-Creche in the creche guide: close the citizen-eval gap
`vale_creche`"). **This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer citizen eval q112 "Como peço o Vale Creche?" (and "Como
eu peço o Vale-Creche pro meu filho de 2 anos?") honestly, with a guide and official links, consent at every step
([ADR 0010](docs/adr/0010-service-guides-consent-at-every-step.md)).

## Source (read 2026-11-25)

Lei municipal nº 16.492 of 2025-03-11, Programa Voucher Educacional "Vale-Creche", the SME's PDF
`https://mid-educacao.curitiba.pr.gov.br/2025/4/pdf/00517415.pdf` (robots.txt 404; official act, Lei 9.610/1998 art. 8
IV). Used: arts. 1, 3, 4 and 6. Not verified: whether the program is open in 2026, its value, deadlines and how
families are called. Details and two hand requests that broke the robots rules (deleted unread):
[docs/sources.md](docs/sources.md#city_service_guide-guides-and-official-links-for-services-that-need-a-login-bundled-since-0280).

## Changes

1. **Guide** `vale_creche` (`src/tools/cityServiceGuide.ts`): ask the citizen (no personal data in the conversation);
   explain the law without promising the voucher (0 to 3 years, on the waiting list, exceptional; the SME decides,
   the family cannot choose voucher over place; no separate application in the law); the Carta page; the law's PDF;
   the Educação portal; the `creche` guide for the waiting list; the law's priorities, private-school enrolment if
   the SME offers the voucher, value set yearly by decree; the Central 156. No value, no deadline, no phone or e-mail.
   A new guide id, not a variant of `creche`: same table, same consent steps, no ADR.
2. **Envelope**: optional `GuideDef.fromDocument` (`checkedAt`, `licenseNote`) so the guide's `checked_at` and licence
   note name the law, not "official sites checked 2026-11-24" nor "web search".
3. **Carta routing**: `vale_creche` `[["vale", "creche"]]`; `creche` gets `notFor: ["vale"]`. Mirrored in
   `scripts/coverage-report.mjs` (`GUIDE_TERMS`, `GUIDE_NOT_FOR`).
4. **Eval**: q112 → `city_service_guide` `vale_creche`; new q121 (child of 2); `vale_creche` gap gone.
5. **Docs and version**: README, docs/tools.md (row, fixed-link table, creche row of the Curitiba App table),
   docs/sources.md, docs/roadmap-1.0.md, CHANGELOG 0.42.0, version 0.42.0 in `package.json`, `package-lock.json`,
   `server.json`, tool contract snapshot (the `service` enum).

## Out of scope

The voucher's value, deadlines or call lists; any request by the server; any new host; linking the SME 2026 page or
the Carta detail page (not read).

## Check

- `npx vitest run test/cityServiceGuide.test.ts test/coverageReport.test.ts test/contracts.test.ts test/eval`: the
  guide invariants, no value and no promise, the law and its date, the envelope, the links, Carta routing both ways.
- `node scripts/eval-summary.mjs`: `answered 116 / 121`; `node scripts/coverage-report.mjs --tools docs/tools.md`:
  15 of 18 Curitiba App rows covered.
- `scripts/verify` exits 0 on the PR head.
