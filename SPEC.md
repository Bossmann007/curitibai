# SPEC: v0.60.0 Food security: Mesa Solidária, community gardens, Fazenda Urbana

Approved: task brief from Boss (routine run under Enzo's standing go-ahead of 2026-11-25, "continua até pelo menos a 0.60"), not reviewed by Enzo
**This change publishes nothing**: no workflow run, no tag, no merge.

This file describes the current version only ([ADR 0006](docs/adr/0006-spec-holds-the-current-version.md)). Earlier
versions: `CHANGELOG.md`, `git show v<version>:SPEC.md` and the ADRs in `docs/adr/`.

## Goal

Phase B of [docs/roadmap-1.0.md](docs/roadmap-1.0.md): answer "Onde tem Mesa Solidária no Centro?" with the Mesa
Solidária places IPPUC lists, their address, hours and contacts as published. Also list the community gardens, the
Fazendas Urbanas and the Núcleos Regionais de Segurança Alimentar e Nutricional. Places and public contacts only:
never a volunteer's or coordinator's name or personal phone.

## Source (read 2026-11-26 UTC)

IPPUC GeoCuritiba, `Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer` (urban-equipment) layers 7 "Mesa Solidária"
(4 records), 9 "Horta" (233), 10 "Fazenda Urbana" (3) and 1 "Núcleo Regional de Segurança Alimentar e Nutricional"
(10). robots.txt 404 (20:53:33 UTC, User-Agent `curitibai-mcp/0.60`); the layers' metadata has empty `copyrightText`
and `description`, so no licence found (facts only, IPPUC cited, like the other GeoCuritiba layers). No new host, no
new link. Details:
[docs/sources.md](docs/sources.md#city_facilities_search-ippuc-geocuritiba-urban-equipment-parks-and-bike-lanes).

What the read showed and how this version handles it:

- **Mesa Solidária (7)**: one in Centro (BASE, Al. Dr. Muricy), two in Jardim Botânico, one in Campo de Santana. Two
  are only kitchens ("produção de refeições") with no serving hours; the note says so. BASE's weekday and weekend lines
  are 190 and 300 characters, over the 160-character line cap: the type wraps long lines at commas and semicolons
  (`wrapLines`), so no time is cut. Every record's phone is "WhatsApp (41) 3350-3821", which the phone filter dropped:
  a leading "WhatsApp" word is now removed before the landline test (every type); the note says the number is
  published as a WhatsApp line. Mobiles are still dropped.
- **Hortas (9)**: 56 "Horta Comunitária Urbana", 109 "Horta Escolar" (inside schools) and 68 "Horta Institucional"
  (inside institutions, among them three Unidades de Acolhimento Institucional, a Casa de Passagem, a Casa do Piá and
  a Casa de Semiliberdade, most with the address published). Shelters are never listed (v0.52), so `horta comunitaria`
  asks the layer only for the community gardens, with a fixed `where` (`tipo_equi = 'Horta Comunitária Urbana'`, no
  user input, 56 records when tried); the note gives the other two counts as not listed and says `source_url` is the whole layer. None of the 56 has a phone,
  30 have no `observacao` and none publishes hours: the note says there is no phone or hours and gives the published
  e-mail (the same city address on every record). Some lines name the association that keeps the garden ("Mantida
  pela Associação de Moradores …"): kept. Other lines are filtered by an allowlist since v0.63 (see docs/sources.md): a line is shown only when it is a public label (atendimento, horário, funcionamento, endereço, bairro, pomar, cultivo, área de plantio or lavoura, jardins de mel), an hours or number line (a digit or a weekday, after an optional hours label), the body that keeps or runs the garden ("Mantida pela Associação …", "A SMSAN coordena …"), the city programme, a partner ("Parceria com …"), "Horta com N canteiros" or exactly "Contato pelo e-mail da secretaria", and has no person in it ("contato", "voluntário/a", "quem cuida/coordena", cuidado/coordenado por or pelo/pela a person, Dona, Seu, Sr(a). or Senhor(a), a word other than a body before cuida(m) or coordena(m), any case, and the offices' person filter); any other line, a lower-case name included, is hidden.
- **Fazenda Urbana (10)**: three farms with hours. One lists a landline and two mobiles, one only a mobile (dropped,
  as always), one nothing: the note says to use the e-mail. Their hours say enrolment in activities is through two
  city pages, given as published text (never fetched); the note says this tool does not enrol.
- **Núcleos (1)**: ten, one per regional, in the Ruas da Cidadania (Matriz at the Mercado Municipal), hours and a
  landline each.
- No person's name, mobile or personal e-mail in the 4, 56, 3 and 10 records returned.

## Changes

1. **Types** in `FACILITY_TYPES` (`src/sources/geocuritiba.ts`), same fields, host gate, cache and e-mail allowlist as
   the other urban-equipment layers:
   - `mesa solidaria` (7), aliases `mesas solidarias`, `mesa solidaria curitiba`; `wrapLines`.
   - `horta comunitaria` (9), aliases `hortas comunitarias`, `horta comunitaria urbana`, `hortas comunitarias urbanas`,
     `horta urbana`, `hortas urbanas`; fixed `where` on `tipo_equi`; garden person filter
     (`isGardenPersonLine`: since v0.63 an allowlist of public line kinds, plus the office filter and person words).
   - `fazenda urbana` (10), alias `fazendas urbanas`; person filter.
   - `nucleo de seguranca alimentar` (1), aliases `nucleos de seguranca alimentar`, `nucleo regional de seguranca
     alimentar`, `nucleo regional de seguranca alimentar e nutricional`, `nucleos regionais de seguranca alimentar`;
     person filter.
2. **`FacilityType.where`** (optional, a fixed string in the code): sent instead of `1=1`. Only `horta comunitaria`
   uses it.
3. **Notes** for the four types as above.
4. **Phones**: a leading "WhatsApp", "Whats" or "Zap" (any case, optional ':' or '-') is removed from a part before
   the existing tests.
5. **Person lines** (v0.59 review Low):
   - The role words gain secretário/a, supervisor/a and gestor/a (coordenador/a was there); titular, coordenação and
     gestão count only before ':' ("Titular da conta" stays). "Mantido/a por" anywhere in a line hides it (a person's
     name follows "por" without an article), and so does "mantida pelo Sr./Sra./Dona"; "mantida pela Associação"
     stays. "Secretaria" without the accent is an office ("Secretaria Municipal de …"), so it counts only right before
     ':' ("Secretaria:"); "Secretária" with the accent is the role (the line is NFC-normalised first).
   - Regression: after the v0.59 rule, a CEI's hidden "…:" line with no comma hid the next line whatever it was
     ("Responsável pela matrícula:" hid "-2ª a 6ª 8h" and "Período parcial"). For a CEI the next line is now hidden
     only when it does not start (after an optional dash) with a digit or a service word such as período, horário,
     atendimento, matrícula, so a name of any length after "Diretora responsável:" is still hidden, even with hours
     later in the line (found in review). Offices keep the v0.59 rule. One service word list (`SERVICE_PART`, `SERVICE_WORD`) now serves this test and
     the v0.54 split-name rule, so "Matrículas abertas em janeiro" and "Secretaria da escola" stay after a hidden
     maintainer line; "Secretária Fulana" (the accented role) is still hidden.
6. **Eval**: new q135 → `city_facilities_search` `{type: "mesa solidaria", bairro: "centro"}`, synthetic fixture
   `test/fixtures/geocuritiba/mesa_solidaria_synthetic.json` with a line over 160 characters. Tool contract snapshot
   updated (`type` description).
7. **Docs and version**: docs/tools.md, docs/sources.md, README row, docs/roadmap-1.0.md, CHANGELOG 0.60.0, version
   0.60.0 in `package.json`, `package-lock.json`, `server.json`. The Curitiba App table has no row for this and is
   unchanged.

## Out of scope

School and institutional gardens, enrolment in Fazenda Urbana activities, the Mesa Solidária service page link, the
`site` field, Armazém da Família and other food layers, any new host.

## Check

- `npx vitest run test/cityFacilities.test.ts test/contracts.test.ts test/eval`: the four types resolve with their
  aliases to layers 7, 9, 10 and 1; the horta query carries the fixed `where`; the synthetic Centro Mesa Solidária
  comes back with address, every hours line uncut and the WhatsApp landline; mobiles still dropped; new role words
  hidden and "Secretaria Municipal de …" kept; the two CEI regression examples keep their hours line and a long name
  after "Diretora responsável:" is hidden; q135 answered.
- `node scripts/eval-summary.mjs`: `answered 131 / 135`.
- `scripts/verify` exits 0 on the PR head; packed size under 252,000 bytes.
