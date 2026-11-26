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
(`realtime_bus` for the Curitiba App rows not covered, and others;
`le_digital` and `estar` until v0.38.0, `defesa_civil` until v0.39.0, `cultural_spaces` until v0.40.0, `route_planning` until v0.41.0, `vale_creche` until v0.42.0, `useful_phones` until v0.43.0); gaps are counted, not failed. A question tagged
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
At v0.42.0 (phase B) the Vale-Creche question has a hand-written guide in `city_service_guide` (`vale_creche`),
written from Lei municipal 16.492/2025: who the law is for, that the SME decides, the law and the Educação portal; no
value and no promise, since whether the program is open in 2026 was not verified. The Curitiba App rows are unchanged
(18, 15 covered). The citizen eval answers 116 of 121 questions (q112 moved from the gap, q121 asks it for a child of
2); 5 are gaps (real-time buses 2, other cities 2, useful phones 1).
At v0.43.0 (phase B) the Ouvidoria questions have a hand-written guide in `city_service_guide` (`ouvidoria`), written
from the CGM's "Ouvidoria da CGM – Guia de uso" (2024): that guide publishes no phone for the Ouvidoria, so the answer
is its channels (the Portal Curitiba Ouve, the CGM e-mail, a Central 156 protocol for the identified form), and no
number is given as the Ouvidoria's. The Useful phones row becomes "guide + official link, citizen acts": 18 Curitiba
App rows, 16 covered (7 data, 9 guide). The citizen eval answers 117 of 121 questions (q110 moved from the gap; q072,
already answered by `useful_phones` with nothing found, now asks the guide); 4 are gaps (real-time buses 2, other
cities 2).
At v0.44.0 (phase B) municipal health units have their hours: `city_facilities_search` `unidade de saude` reads
IPPUC's layer 134 (109 units, hours as published, to check before going); `health_units_search` (CNES) has no hours
and points to it. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval answers 118 of 122 questions;
4 are gaps (real-time buses 2, other cities 2).

At v0.45.0 (phase B) UPAs and public hospitals have their 24-hour flag, hours and phone: `city_facilities_search`
`upa`, `hospital publico` and `estabilizacao psiquiatrica` read IPPUC's layers 130, 129 and 131 (9, 10 and 1 records),
and every answer says to call 192 (SAMU) or 193 in an emergency: the tool lists places, it does not triage. 18
Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval answers 119 of 123 questions; 4 are gaps (real-time
buses 2, other cities 2).

At v0.46.0 (phase B) CAPS and specialty centres have their hours: `city_facilities_search` `caps`, `centro de
especialidades medicas` and `centro de especialidades odontologicas` read IPPUC's layers 135, 132 and 133 (13, 10 and 2
records); the CAPS and psychiatric stabilisation answers give 192 or 193 and then CVV 188, and the specialty answers
say to ask the health unit about a referral. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval
answers 120 of 124 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.47.0 (phase B) `city_facilities_search` `vigilancia sanitaria`, `zoonoses` and `hospital veterinario` read
IPPUC's layers 167, 136 and 112 (10, 1 and 1 records), with hours as published. The veterinary hospital's layer has
its address only, so the answer says where it is and that how it works is not published (ask the 156). 18 Curitiba
App rows, 16 covered (7 data, 9 guide). The citizen eval answers 121 of 125 questions; 4 are gaps (real-time buses 2,
other cities 2).

At v0.48.0 (phase B) `city_facilities_search` `modulo da guarda` and `nucleo da guarda` read IPPUC's layers 139 and
138 (40 and 10 records), with hours as published and, for the núcleos, the bairros each covers; every answer starts
with 153 (Guarda Municipal) or 190 (Polícia Militar) and says the tool does not dispatch help. 18 Curitiba App rows, 16
covered (7 data, 9 guide). The citizen eval answers 122 of 126 questions; 4 are gaps (real-time buses 2, other
cities 2).

At v0.49.0 (phase B) `city_facilities_search` `delegacia`, `policia federal`, `policia rodoviaria federal` and
`policia cientifica` read IPPUC's layers 143, 146, 147 and 145 (49, 1, 1 and 3 records), with hours as published;
every answer starts with 190 (Polícia Militar), 197 (Polícia Civil) or 191 (Polícia Rodoviária Federal) and says the
tool does not file police reports. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval answers 123 of
127 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.50.0 (phase B) `city_facilities_search` `instituto de identificacao` (aliases `rg`, `carteira de identidade`)
reads IPPUC's layer 168 (12 records), with days, hours and the appointment line as published; the note says
appointments are booked through the Paraná state Instituto de Identificação's channels (not linked) and that a record
with no appointment line does not mean none is needed. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen
eval answers 124 of 128 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.51.0 (phase B) `city_facilities_search` `cartorio de registro civil` (alias `registro civil`), `junta militar`,
`defensoria publica` and `forum` read IPPUC's layers 99, 21, 105 and 106 (4, 3, 14 and 9 records), hours as
published; the registry note says the list is what the layer publishes, not necessarily every office, and that prices,
deadlines and which office holds a record are not in it; the registry offices' trade-name line (a surname) is replaced by a
visible marker, and long bairro lists are split, not cut. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval
answers 125 of 129 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.52.0 (phase B) `city_facilities_search` `creas`, `centro pop`, `central de encaminhamento social`, `centro de
atividades para idosos`, `centro de referencia da mulher` and `centro de referencia afro` read IPPUC's layers 38, 40,
39, 36, 108 and 109 (10, 3, 1, 5, 2 and 1 records), hours as published; the CREAS note says which bairros a unit serves
is not in the layer. Shelters and transit houses (layers 45, 46 and 164) are never types, and a line that mentions one
is replaced by a marker; a women's centre whose address is not marked public returns only its name and institutional
phones, and that type's note leads with 190 and 180. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen
eval answers 126 of 130 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.53.0 (phase B) `city_facilities_search` `escola municipal`, `cmei`, `cmaee` and `cei contratado` read IPPUC's
layers 80, 78, 81 and 79 (188, 241, 13 and 180 records), hours and landlines as published; escolas rarely publish hours.
A contracted CEI's maintainer line (sometimes a person's name) is replaced by a marker, and its note says the listing does
not confirm Vale-Creche accreditation. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval answers 127
of 131 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.54.0 (phase B) the `cei contratado` maintainer filter also hides "Mantida pela/pelo", "MEI", "Responsável" and
"Diretora" lines, a bare label without ":" and a name split over lines; nothing is un-hidden. The citizen eval answers
127 of 131 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.55.0 (phase B) the `cei contratado` filter keeps Av., Fone, Período, Vagas and Berçário lines after a
hidden maintainer line visible, and matches short service words (rua, av, fone, vagas) as whole words. The citizen eval answers 127 of 131 questions;
4 are gaps (real-time buses 2, other cities 2).

At v0.56.0 the package is smaller with the same behaviour: the build drops source comments (packed 251,583 to
211,163 bytes) and keeps the ODbL notice of the OSM extract. The citizen eval answers 127 of 131 questions; 4 are
gaps (real-time buses 2, other cities 2).

At v0.57.0 (phase B) `place_at_point` `areas: "registry"` names the circunscrição imobiliária (registro de imóveis)
and the registro civil serviço whose area covers a point, with the legal basis as published (IPPUC's thematic layers
15 and 16); not the office's address and not a certidão. The citizen eval answers 128 of 132 questions; 4 are gaps
(real-time buses 2, other cities 2).

At v0.58.0 (phase B) `city_facilities_search` `rodoviaria` (alias `rodoferroviaria`), `ferroviaria` and
`administracao regional` read IPPUC's urban-equipment layers 159, 160 and 15 (1, 1 and 10 records), address, hours and
landlines as published; the notes say the terminal's hours are not departures and that no departure time, platform,
fare or ticket is given. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval answers 129 of 133
questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.59.0 (phase B) `city_facilities_search` `cohab` reads IPPUC's urban-equipment layer 29 (9 COHAB-CT agencies),
address, hours and contacts as published; toll-free 0800 numbers are kept in `phones` for every type; the notes say
the tool does not book and that the applicant queue is not in it. A line naming who is in charge is hidden in the
`administracao regional` and `cohab` hours. 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval
answers 130 of 134 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.60.0 (phase B) `city_facilities_search` reads IPPUC's urban-equipment layers 7 (`mesa solidaria`, 4 places),
9 (`horta comunitaria`, only its 56 community gardens; school and institutional gardens, some in shelters, are never
listed), 10 (`fazenda urbana`, 3) and 1 (`nucleo de seguranca alimentar`, 10), address, hours and contacts as
published; a Mesa Solidária's WhatsApp landline is kept, and the notes say some places only cook and that the gardens
publish no phone or hours. The office person-line filter gains more roles and no longer hides a CEI's hours after a
"Responsável …:" line (v0.59 review). 18 Curitiba App rows, 16 covered (7 data, 9 guide). The citizen eval answers
131 of 135 questions; 4 are gaps (real-time buses 2, other cities 2).

At v0.60.1 the facility source is simpler with no change in behaviour: one record builder and one options argument
replace the copied literals in `src/sources/geocuritiba.ts` (301 lines removed, 155 added). The citizen eval still
answers 131 of 135 questions.

At v0.61.0 the community-garden filter also hides who cares for or coordinates a garden ("Quem cuida:",
"Coordenada por", "Dona Maria cuida da horta") and keeps the bairro, pomar and cultivo labels and "Contato pelo
e-mail da secretaria". The citizen eval still answers 131 of 135 questions.

At v0.62.0 the text key and the line filter are simpler with no change in behaviour: one `foldKey()` replaces five
copies, and a type's `nameLines` flag replaces a check on which filter function it uses (source: 56 lines removed, 57
added). The citizen eval still answers 131 of 135 questions.

At v0.63.0 the community-garden filter is an allowlist: a line is shown only when it is a known public kind (a public
label, an hours line, the body that keeps the garden, the programme, a partner, the secretariat e-mail line) and names
no one, so a lower-case name is hidden and the hours after the secretariat e-mail line stay. Social-assistance types
carry an explicit `shelter` flag. The citizen eval still answers 131 of 135 questions.
