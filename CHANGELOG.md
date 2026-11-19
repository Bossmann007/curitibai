# Changelog

Newest first. Current behaviour and its sources are described in [docs/sources.md](docs/sources.md).

## 0.4.4

- Phone masking: "tels", "telef" and "contatos" also count as contact words before a year-pair-shaped phone ("Telef. 2025-2026"); "hotel", "Excel" and "Marcel" stay readable.
- Added this changelog; docs/sources.md now describes only current behaviour.

## 0.4.3

- Phone masking: cel, telefones, whats, zap, fax and ramal also count as contact words, with an optional "." and ":" after the word ("Tel. 2025-2026").
- `detran_pr_info`: when both the year and the 180-day warnings apply, the units note gives one sentence.

## 0.4.2

- Phone masking: a year-pair-shaped phone right after a contact word (tel, fone, telefone, celular, contato, whatsapp) is masked ("tel 2025-2026").
- `detran_pr_info`: the units note warns when the bundled data is more than 180 days old.
- `procurement_search`: the note says when the scan stopped on its 15 s time budget.
- `health_units_search` and `open_datasets_search`: the rate-limit wait message is given in `note` when a later page gets HTTP 429.

## 0.4.1

- Phone masking: a DDD before 8 or 9 glued digits is masked ("41 999998888", "041 33334444"); a leading 0 in the DDD is accepted.
- Phone masking: two year-like groups ("2025 - 2026") with no DDD, "+55" or parentheses before them are kept readable (owner decision).
- `detran_pr_info`: deadlines are marked `past` in Curitiba time and ordered by due date; the calendar note quotes Portaria 907/2025 Anexo II literally.

## 0.4.0

- Added `detran_pr_info`: bundled 2026 Detran-PR licensing calendar, fee and Curitiba units, each with its source URL and check date.

## 0.3.0

- Added `procurement_search`: PNCP procurement of Curitiba municipal bodies, with CPF/CNPJ, e-mail and phone masking in the object and no supplier data.
- Object masking hardened: Unicode dashes and invisible characters are normalised, groups may be split by spaces or spaced separators, e-mails may have spaces around "@", and the work is bounded so it stays linear.
- HTTP 429 becomes a `rate_limited` error with the wait time; a PNCP request is retried once after a connection error.
