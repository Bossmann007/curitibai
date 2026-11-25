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
  per category, the uncovered count per usefulness score, and the 30 most useful uncovered services. Those titles go
  to the terminal only.
- **A JSON summary** with aggregate numbers only (counts and percentages by category, no service title), safe to
  paste in a pull request.

How a service is classed, from the words of its title (accents and case ignored, whole words):

- **guide:** the title has the words of one of `city_service_guide`'s Carta queries (the same match the tool uses;
  a test keeps the script's copy equal to the tool's).
- **data:** the title matches one of the script's narrow rules (for example "vacina", "feira", "linhas de ônibus",
  "feriado") and has no word that asks the citizen to act (matrícula, inscrição, solicitação, agendamento, emissão,
  licença, segunda via and similar).
- **none:** anything else.

The rules err toward none: the scoreboard can understate coverage, never overstate it. A service wrongly counted as
none is fixed by adding a rule and a test, not by changing the gate.

The catalog itself is never committed (`scripts/check-no-catalog`); this page and the pull requests carry only
aggregate numbers. Exit code: 0 when the report is printed (an open gate is not an error), 2 when an input cannot be
read or the table has a status the script does not know.

## Where it stands

At v0.35.0, part (a) from this repository: 18 Curitiba App rows, 11 covered (6 data, 5 guide); not covered: AI
assistant, useful phones and cultural spaces (partial); Curitiba Lê Digital, Defesa Civil alerts, EstaR and real-time
buses (none). Part (b) depends on each owner's local Carta copy; run the scoreboard for the current numbers.
