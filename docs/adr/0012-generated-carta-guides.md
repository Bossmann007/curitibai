# 0012. `city_service_guide` generates a guide for any Carta service, from fixed steps

Status: Accepted (v0.37.0 brief, phase C of [the 1.0 roadmap](../roadmap-1.0.md), 2026-11-25). Extends
[ADR 0010](0010-service-guides-consent-at-every-step.md).

## Context

The 1.0 gate needs every service of the Prefeitura's Carta de Serviços reachable by a data tool or a guide with its
official link. Seven services have a hand-written guide; the Carta lists hundreds. The only source for the rest is the
user's own copy of the Carta (`CURITIBAI_DATA_DIR/carta-servicos.json`), which this project never ships or fetches.
That copy is text saved from a web page: untrusted.

## Decision

- **Extend `city_service_guide`, not a new tool** ([ADR 0005](0005-extend-a-tool-before-adding-one.md)): the answer
  shape, the consent rule, the host allowlist and `open_step` are the same. A new optional input, `carta_id` (the
  numeric id `city_services_search` returns), is given instead of `service`; exactly one of the two. The input stays
  an enum and integers, so no free text can carry personal data.
- **Hand-written guides keep priority.** When the service title has every word of a hand-written guide's Carta query,
  that guide is returned, with a note.
- **Fixed steps only.** Every generated guide has the same server-written steps: the first step in the conversation,
  the official Carta page, the online service when its link is allowed, then login, data and documents, sending and
  payment, each "if the site asks" and each with `needs_consent` and a fixed consent text. Carta text can never add,
  drop or reword a step, an action, a consent text or the elicitation message (which names the Carta id, not its title).
- **Carta text is quoted data.** It goes only to `title` (after a fixed prefix), `carta.matches` and `carta_text`
  (category, what, who, how, documents, channels, cost; the last five are new optional fields of the copy). Each field
  is cleaned: control and format characters removed, entities decoded and then tags and `<`/`>` removed, Markdown links
  reduced to their text, every link-like token that is not an https link on an allowed host replaced by
  "[link removido]", e-mail, phone and CPF/CNPJ shapes masked, cut at 300 code points (titles at 120).
- **Marked as generated.** `data.generated` holds the Carta id, the copy's capture date and `reviewed_by_hand: false`;
  `checked_at` is the copy's date; `license_note` attributes the text to the Prefeitura.
- **No copy, no guide.** Without a copy (or with an invalid one, or an unknown id) the answer says why, how to save the
  copy, and lists the hand-written guides. The server never contacts `www.curitiba.pr.gov.br`.
- **The scoreboard counts it apart.** `scripts/coverage-report.mjs` classes a service the generated guide reaches as
  guide, and also counts it as `guide_generated`, so the share of hand-written guides stays visible.

## Consequences

- Every service of a valid copy becomes reachable: gate 2 can pass on the generated guide alone. A generated guide is
  thinner than a hand-written one (no service-specific step or fixed link), so the most useful services should still
  get hand-written guides; `guide_generated` shows how many depend on the generic one.
- Undo: drop `carta_id` and `cartaGuideResult`; the copy's new optional fields are ignored again.
