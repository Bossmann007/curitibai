# Roadmap to 1.0

The owner's rule (2026-11-24): 1.0 comes only when CuritibAI is better than the Curitiba App, with every service of the
Prefeitura and more, useful to the citizen and about the city of Curitiba. This page turns that rule into a gate that
a script can count. CuritibAI stays read-only: where a service needs a login, a payment or a registration, "covered"
means a guide with the official link, and the citizen acts ([ADR 0010](adr/0010-service-guides-consent-at-every-step.md)).

## The 1.0 gate

1.0 is released only when all of these hold:

1. **Every Curitiba App row is covered.** Each row of the table in
   [Compared with the Curitiba App](tools.md#compared-with-the-curitiba-app) has the status ✓ (a data tool answers it)
   or "guide + official link, citizen acts" (`city_service_guide`, for a service that needs a login). A row marked
   `partial` or `—` is not covered. A row can also leave the table only when the app no longer offers it, with the
   source that says so.
2. **Every Carta de Serviços service is reachable.** Each service of the Prefeitura's Carta de Serviços is either
   answered by a data tool or covered by a `city_service_guide` guide with its official link. `city_services_search`
   finding the service page is not enough on its own.
3. **The extras stay.** The rows marked "extra" in the same table (weather, procurement, Detran-PR, tax reform, city
   facilities, rivers, voting places, census, holidays and others) keep working at 1.0.
4. **Useful to the citizen first.** Uncovered services are worked on in order of usefulness to a person who lives in
   or visits Curitiba, not in order of how many services a category has. The score, from the words of the service
   title and its category:
   - **3, everyday need:** health, transport, school, taxes and documents, social assistance, safety, waste and
     utilities (for example vacina, ônibus, escola, IPTU, certidão, CRAS, Guarda Municipal, coleta de lixo, poda).
   - **2, other:** everything not in the two other groups.
   - **1, business-only or internal:** services for companies, suppliers or city staff (for example empresa,
     fornecedor, servidor, licitação, credenciamento). A business word wins over an everyday one.

   The word lists are `EVERYDAY_WORDS` and `BUSINESS_WORDS` in `scripts/coverage-report.mjs`.
5. **Curitiba only.** In scope are services and data of the city of Curitiba: the Prefeitura's own, plus state or
   federal services delivered in Curitiba (for example the Detran-PR units in the city, INMET's forecast for Curitiba,
   PNCP notices of Curitiba bodies). A tool or guide that is generic for any city, or that serves another city, does
   not count toward the gate.

## The scoreboard

```sh
CURITIBAI_DATA_DIR=/path/to/your/data node scripts/coverage-report.mjs
# or: node scripts/coverage-report.mjs --carta /path/to/carta-servicos.json [--tools docs/tools.md]
```

A dev script, not in the package; it reads and never writes or fetches. It prints:

- **Part (a):** the Curitiba App rows by status (data, guide, partial, none, extras), how many are covered and which
  are not.
- **Part (b)**, only when your local Carta copy exists (the same `carta-servicos.json` that `city_services_search`
  reads, [Local data files](local-data.md)): each service classed data, guide or none, with counts and percentages
  per category (since v0.37.0 also `guide_generated` and `reachable_without_generated_pct`), the uncovered count per
  usefulness score, the 30 most useful uncovered services and the 30 most useful services only the generated guide
  reaches. Those titles go
  to the terminal only.
- **A JSON summary** with numbers per category (category labels, counts and percentages, no service title), safe to
  paste in a pull request.

How a service is classed, from the words of its title (accents and case ignored, whole words):

- **guide:** the title has the words of one of `city_service_guide`'s Carta queries (the same match the tool uses;
  a test keeps the script's copy equal to the tool's), or, since v0.37.0, the service's `url` is a Carta service page
  that the generated guide reaches (`city_service_guide` with `carta_id`, [ADR 0012](adr/0012-generated-carta-guides.md);
  the same URL pattern as the tool, kept equal by a test). The second kind is also counted as `guide_generated`, in
  total and per category, with `reachable_without_generated_pct` beside `reachable_pct`; the terminal lists the 30
  most useful services reached only by the generated guide (candidates for a hand-written guide, titles terminal only).
- **data:** the title matches one of the script's narrow rules (for example "vacina", "feira", "linhas de ônibus",
  "feriado") and has no word that asks the citizen to act (matrícula, inscrição, solicitação, agendamento, emissão,
  licença, segunda via and similar).
- **none:** anything else (with a valid copy, only an item whose `url` is not a Carta service page).

The rules err toward none: the scoreboard can understate coverage, never overstate it. Since v0.37.0 every service of a
valid copy is at least a generated guide, so reachable reads 100%; `reachable_without_generated_pct` is the number to
watch for hand-written coverage. A service wrongly counted as
none is fixed by adding a rule and a test, not by changing the gate.

The catalog itself is never committed (`scripts/check-no-catalog`); this page and the pull requests carry only
numbers per category. Exit code: 0 when the report is printed (an open gate is not an error), 2 when an input cannot be
read (a `--carta` file that does not exist included; only the `CURITIBAI_DATA_DIR` copy may be absent) or the table
has a status the script does not know.

## The citizen eval

"Useful to the citizen" is measured by a bank of realistic questions (`test/eval/citizen-questions.json`, since
v0.36.0): about 100 questions in Brazilian Portuguese, invented, with no personal data and places named only by public
landmarks. Each names the tool that should answer it, the arguments, and the shape of the answer expected:

- `status`: `ok` (the tool's answer list is non-empty), `not_found` (it is empty), `outside_curitiba` (the place is
  not in Curitiba), `guide` (a `city_service_guide` answer) or `error` with its code;
- `fields`: paths that must be present and non-empty; `link`: the path of the source or official link (`source_url`
  unless given; `null` for `local_csv_summary`, which reads a local file and has none);
- for a guide, at least one step that needs consent, each such step with its consent text, and an official link.

Shape only, never exact text. `test/eval/citizenEval.test.ts` runs every question offline in `scripts/verify`
(synthetic fixtures, one fixed clock, every request stubbed): the tool exists, the arguments pass its input schema
with no unknown key, and the answer has the shape. A question no tool answers yet has `tool: null` and a `gap` label
(`realtime_bus`, `useful_phones` for the Curitiba App rows not covered, and others;
`le_digital` and `estar` until v0.38.0, `defesa_civil` until v0.39.0, `cultural_spaces` until v0.40.0, `route_planning` until v0.41.0); gaps are counted, not failed. A question tagged
`outside_curitiba` to a tool with no city check of its own (a bus stop or a feira near a point in São Paulo) expects
`not_found`; `place_at_point` refuses such a point and expects `outside_curitiba`. `node scripts/eval-summary.mjs` prints the one-line count
that `scripts/verify` shows. Closing a gap means a tool, its fixture and the question moved from `tool: null` to that
tool in the same pull request.

## Where it stands

At v0.35.0, part (a) from this repository: 18 Curitiba App rows, 11 covered (6 data, 5 guide); not covered: AI
assistant, useful phones and cultural spaces (partial); Curitiba Lê Digital, Defesa Civil alerts, EstaR and real-time
buses (none). Part (b) depends on each owner's local Carta copy; run the scoreboard for the current numbers.
At v0.36.0 the citizen eval answers 99 of 114 questions; 15 are gaps (Lê Digital, Defesa Civil alerts, EstaR and
real-time buses 2 each, cultural spaces 2, useful phones 1, route planning 1, Vale Creche 1, other cities 2).
At v0.37.0 (phase C) every service of a valid Carta copy is reachable through `city_service_guide`: a hand-written
guide, or the guide generated from the copy (`carta_id`). The citizen eval answers 104 of 119 questions (5 new
questions on generated guides); the 15 gaps are unchanged.
At v0.38.0 (phase B) Curitiba Lê Digital and EstaR have hand-written guides (`le_digital`, `estar`): 18 Curitiba App
rows, 13 covered (6 data, 7 guide). The citizen eval answers 108 of 119 questions; 11 are gaps (Defesa Civil alerts,
real-time buses and cultural spaces 2 each, other cities 2, useful phones 1, route planning 1, Vale Creche 1).
At v0.39.0 (phase B) Defesa Civil alerts are covered: `weather_alerts` (INMET) for the active warnings and the
`defesa_civil` guide for receiving alerts on the phone: 18 Curitiba App rows, 14 covered (6 data, 8 guide). The
citizen eval answers 110 of 119 questions; 9 are gaps (real-time buses and cultural spaces 2 each, other cities 2,
useful phones 1, route planning 1, Vale Creche 1).
At v0.40.0 (phase B) cultural spaces and attractions are covered by data: `city_facilities_search` `ponto turistico`
lists the Linha Turismo's 25 stops (bundled), each pointing to its IPPUC record. Useful phones stays partial: no
readable public source gives the Ouvidoria-Geral's phone. 18 Curitiba App rows, 15 covered (7 data, 8 guide). The
citizen eval answers 112 of 119 questions; 7 are gaps (real-time buses 2, other cities 2, useful phones 1, route
planning 1, Vale Creche 1).
At v0.41.0 (phase B) route planning is covered for direct lines: `bus_route_between` lists the URBS lines whose
itinerary passes a stop near the origin before a stop near the destination (no transfers, not real-time; ADR 0013).
The Curitiba App rows are unchanged (18, 15 covered). The citizen eval answers 114 of 120 questions (q111 moved from the gap, q120 asks the way back); 6 are gaps
(real-time buses 2, other cities 2, useful phones 1, Vale Creche 1).
