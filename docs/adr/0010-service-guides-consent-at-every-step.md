# 0010. Guides to services that need a login: the citizen acts, with consent at every step

Status: Accepted (v0.28.0 brief, owner approval 2026-11-24: "sim mas apenas se ele autorizar")

## Context

Many city services a citizen asks about need a login: the 156, Saúde Já, IPTU, Cartão Transporte, the Agenda Online,
creche registration and Detran-PR. Until v0.27 they were out of scope ([docs/tools.md](../tools.md#compared-with-the-curitiba-app)).
The citizen's own assistant can help them use these services in their own browser, but only if they authorize it.
CuritibAI must stay read-only and must never hold a credential or personal data.

The MCP specification gives a host-side consent tool for links. URL-mode elicitation (`elicitation/create` with
`mode: "url"`, since 2025-11-25) lets a server ask the client to show a URL. Clients MUST show the target domain and
gather consent before navigation, and MUST NOT pre-fetch the URL. Servers MUST NOT use form mode for passwords or
payment credentials, and MUST NOT put personal data in the URL. The 2026-07-28 revision keeps these rules but moves
server requests during a call into an `InputRequiredResult` (multi round-trip requests). `@modelcontextprotocol/sdk`
1.32.2 (the latest on npm on 2026-11-24) implements 2025-11-25 at most: `Server.elicitInput` sends URL mode when the
client declared `elicitation.url`, and the SDK has no `InputRequiredResult`.

## Decision

- **A new tool, `city_service_guide`, not a new selector of `city_services_search`.** It shares only the Carta
  reader with that tool. Its answer shape is different (numbered steps with consent fields), its guards are
  different (host allowlist, consent invariants) and so are its inputs (a guide id, a step number). ADR 0005 allows
  a new tool in that case. 27 → 28 tools.
- **Read-only by construction.** The input is an enum and an integer only, so no free text can carry personal data.
  The server never logs in, submits, opens or fetches anything and makes no network call. The guides are bundled in
  the code; the only file read is the user's local Carta copy.
- **Consent at every step.** Every step that leaves the conversation has `needs_consent: true` and a one-line
  plain-Portuguese `consent` text. The text says what will happen and what the citizen will type on the official
  site. The first step stays in the conversation and says not to ask for personal data there. `note` gives the rule:
  one step at a time, ask before each consent step, stop without a yes, never type passwords, CPF or payment data.
  Tests check these invariants on the handler output of every guide, with and without a Carta copy.
- **Official links only.** A link must be https, with no credentials, no port and no punycode label. Its host must be
  a subdomain of `curitiba.pr.gov.br` (except the obituary system), `www.detran.pr.gov.br`,
  `www.agendamento.detran.pr.gov.br` or `www.gov.br`. Fixed links were checked by hand on 2026-11-24 (table in
  docs/tools.md). Carta links pass the same check, and only a unique Carta match gives a link. No link comes from
  search results or third parties.
- **`open_step` through URL-mode elicitation, with a fallback.** The 2025-11-25 mechanism fits: the client shows the
  URL and host and opens it only after the user agrees, and nothing the user types reaches this server. The spec's
  "verify the identity of the user who opens the URL" rule protects servers that accept information through the
  URL; this server accepts none. The message is fixed server text, never Carta text. A client without
  `elicitation.url` gets `not_supported` with the link and the instruction to ask in the conversation first. Decline
  and cancel return no link. No form-mode elicitation is used.
- **Delegation is information only.** The Prefeitura's Autorização Digital (a citizen authorizes a person or company
  in e-Cidadão; news of 2025-10-26) is mentioned as something the citizen does there. CuritibAI does not do it or
  check it.

## Options considered

1. Do nothing (keep "out of scope"): rejected by the owner's approval.
2. Extend `city_services_search` with a `guide` value: rejected because the answer shape and guards differ (ADR 0005).
3. A new tool with steps and links, no elicitation: the fallback path of the chosen design.
4. A new tool with optional URL-mode elicitation: chosen.
5. Form-mode elicitation to collect data: rejected. Passwords and payment data are forbidden in form mode, and any
   personal data would reach this server.
6. A server that logs in for the citizen: rejected. It breaks the read-only rule and would hold credentials.

## Consequences

- When the SDK adds `InputRequiredResult` (protocol 2026-07-28), `open_step` must move to it; until then, clients on
  that revision negotiate down to 2025-11-25 with this server or get the fallback.
- The guides are dated (checked 2026-11-24) and the official sites may change; the license note says to follow the
  official page.
- Undo: remove `city_service_guide` from `src/tools/index.ts` (28 → 27 tools); no data or state to migrate.
