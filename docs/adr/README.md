# Architecture decision records

Short records of decisions that shape this project, in the
[Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Status, Context, Decision,
Consequences). Each one cites where the decision is already written in the code or docs. A decision that changes gets
a new record that supersedes the old one; the old one stays, marked "Superseded by".

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-facts-and-links-from-unlicensed-sources.md) | Publish facts and links only from sources with no licence found | Accepted |
| [0002](0002-nightly-collection-to-data-branch.md) | Nightly GitHub Actions collection to an orphan `data` branch | Accepted |
| [0003](0003-shared-per-host-request-gate.md) | Shared per-host request gate (`src/hostGate.ts`) | Accepted |
| [0004](0004-user-downloads-for-blocked-hosts.md) | No automated access to hosts that disallow robots or refuse non-browsers | Accepted |
| [0005](0005-extend-a-tool-before-adding-one.md) | Extend an existing tool (a `type` or `topic` value) before adding a new one | Accepted |
| [0006](0006-spec-holds-the-current-version.md) | `SPEC.md` describes the current version only; releases are checked | Accepted |
| [0007](0007-data-branch-writers.md) | Two writers of the `data` branch: one concurrency group, one retry, never forced | Accepted |
| [0008](0008-local-csv-summary-small-counts.md) | `local_csv_summary`: a floor of 5 rows, and no filter with `group_by` | Accepted |
| [0009](0009-census-household-floor.md) | `census_at_point`: a floor of 20 occupied households per figure | Proposed |
