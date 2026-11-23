# 0008. `local_csv_summary`: a floor of 5 rows, and no filter with `group_by`

Status: Accepted (owner decisions 2026-11-21 and 2026-11-23)

## Context

`local_csv_summary` counts rows of a CSV the user downloaded, such as the 156 open-data file, which describes requests
made by people. A count of 1 to 4 rows for a value can point to one person's request, so the tool must not give one.

- 2026-11-21, owner decision: the minimum group size went from 3 (until 0.13.2) to 5. Groups with fewer than 5 rows
  are not listed, and since v0.21.1 a filter that matches fewer than 5 rows (0 included) gives `"<5"` as its count.
- The v0.21.2 review showed the answer could still be subtracted: in one call with a filter and `group_by`,
  `matched_rows - sum(top)` gave the masked `other_count` back, and a filtered call minus the unfiltered call (or two
  filters on the same column) gave the size of a group of 1 to 4 rows inside the filter.
- 2026-11-23, owner decision ("endurecer"): close the cross-tab instead of masking more fields.

## Decision

- A call with `filter_column`/`filter_value` and `group_by` together is refused with
  `filter_with_group_by_not_allowed`, before the file is read. A filter alone or `group_by` alone still works.
- With `group_by` alone: groups of fewer than 5 rows are not listed; `other_count` of 1 to 4 is `"<5"` (0 stays 0);
  `distinct_values` is a number.
- With a filter alone: `matched_rows` is `"<5"` below 5 (0 included); a filter that leaves 1 to 4 well-formed rows
  out is refused (`column_not_allowed`), because `row_count - malformed_rows - matched_rows` would give their count.

Where it is written: `src/tools/localCsvSummary.ts` (`MIN_GROUP_COUNT`, `BELOW_MIN`, the handler),
`test/localCsv.test.ts`, `docs/local-data.md`, `docs/tools.md`, CHANGELOG 0.21.3.

## Consequences

- Breaking input: a call that worked before 0.21.3 (for example "count by `ASSUNTO` where `BAIRRO` is `CENTRO`") is
  now refused. The user can still filter the file in a spreadsheet, or ask the two questions separately.
- **Not protections**, kept and documented:
  - `"<5"` on `other_count` is for consistency only: `row_count - malformed_rows - sum(top)` gives the number back.
    When exactly one group is unlisted (`distinct_values - top.length == 1`, with `top` large enough), that number is
    the size of that one value. So `group_by` alone on a column with one rare value gives its count, and also the
    count that the "leaves 1 to 4 rows out" refusal hides for a filter on that column.
  - Two allowed filters on the same column can be subtracted from `row_count` (for example a column with three
    values, two of them filtered): one query is checked at a time, so the size of the third value can come back.
  - `row_count`, `malformed_rows` and `distinct_values` describe the whole file and can be small.
- Closing the two-filter and single-unlisted-group derivations would need state across calls, a coarser
  `distinct_values`, or refusing columns with few values; not decided.
