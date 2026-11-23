# 0005. Extend an existing tool before adding a new one

Status: Accepted (v0.20.0 and v0.21.0 briefs, owner approval 2026-11-23)

## Context

Every tool adds a name, a description and two schemas that each MCP client loads, and one more thing a model has to
choose between. Two features in a row could have been new tools: the GeoCuritiba Cultura layers (v0.20.0) and the
Receita Federal CBS/IBS open data, whose rates, code lookups and NFS-e note share one host (v0.21.0).

## Decision

When new data shares the host, the request path, the parser, the guards and the envelope of an existing tool, it
becomes a new value of that tool's selector, not a new tool:

- v0.20.0: six new `type` values of `city_facilities_search` (centro cultural, espaço expositivo, memorial, cinema,
  espetáculos ao ar livre, gibiteca). The layers have the same fields as the current point layers, so the same query,
  parser, contact allowlist, cache and gate apply with no new surface; the tool count stayed 22.
- v0.21.0: one tool, `tax_reform_curitiba`, with a `topic` (`rates`, `nbs`, `ncm`, `class_trib`, `nfse`), not one tool
  for rates and one for codes: they share the host, gate, cache, date rule, disclaimer and envelope (as
  `detran_pr_info` does with its `topic`); 22 → 23 tools.

A new tool is right when the source, the guards or the answer shape differ.

Where it is written: `SPEC.md` at tag v0.21.0 (`git show v0.21.0:SPEC.md`), "v0.20.0 changes" and "v0.21.0 changes";
CHANGELOG 0.20.0 and 0.21.0; `docs/tools.md`.

## Consequences

- Tool descriptions grow (the selector values and their notes); `docs/tools.md` lists them in the tool's row.
- A topic that needs a different rule than its siblings (for example the `nfse` note, which makes no request) is
  spelled out in the tool's description and tests.
