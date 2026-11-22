# Licences (code and data)

- **Code**: [Apache-2.0](../LICENSE). It covers the code only; the data belongs to its publishers under their own terms.
- **URBS data** (bus and points-of-interest tools): by URBS — Urbanização de Curitiba S.A., dataset
  ["Transporte Coletivo de Curitiba"](https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=ca40f13b-ef61-472b-810f-dd705f85fd2e)
  on the [Portal de Dados Abertos de Curitiba](https://dadosabertos.curitiba.pr.gov.br/),
  licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt_BR). Changes made: coordinates converted
  to decimal numbers, contact-shaped text masked, long fields cut, only allowlisted categories and fields returned.
  The same applies to other portal datasets (`open_datasets_search`, `dataset_files`), with the portal's notice: "O
  Portal de Dados Abertos de Curitiba e o órgão ou entidade de onde foram acessados os dados não garantem sua
  autenticidade, qualidade, integridade e atualidade após terem sido disponibilizados para uso secundário." The URBS
  files are not part of this repository.
- **OpenStreetMap extract**: `src/sources/osmBundled.ts` (and its compiled copy in `dist/`) is a separate database,
  © OpenStreetMap contributors, under the [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) (see
  <https://www.openstreetmap.org/copyright>), not under Apache-2.0. Live `places_search` results are OSM data under
  the same licence and carry "© OpenStreetMap contributors (ODbL 1.0)" with that link.
- **Terms inherited by anyone reusing the server's output**: PNCP and INMET data are treated under CC BY-ND 3.0 (the
  gov.br notice: attribution, no derivatives); CNES data under the strictest of the Ministry's notices (CC BY-ND 3.0,
  CC BY-NC-SA 4.0, MIT: attribution, non-commercial, no derivatives). Each tool's `license_note` says which applies.
  The Carta de Serviços catalog (no licence found) is not part of this repository. The events calendar and the
  "Telefones Úteis" page of the Instituto Municipal de Turismo (no licence published) are not on `main`; since 0.18.0
  the nightly workflow publishes facts and links only from them (event titles, dates, times, places, categories and
  links; phone names, sections and numbers) on the separate public branch `data`, with the Instituto cited in each
  tool's `attribution` (owner approval, 2026-11-22).
- **IPPUC / GeoCuritiba data** (`city_facilities_search`): no licence found (checked 2026-11-21); facts only, with
  IPPUC cited as "IPPUC / GeoCuritiba" and the layer URL in every result.
- **ANA telemetry data** (`river_levels`): no licence found (checked 2026-11-22); facts only, with ANA cited and the
  service URL in every result.
- **Teatro Guaíra calendar** (`guaira_events`): no licence found (checked 2026-11-22); facts and links only, with
  "Centro Cultural Teatro Guaíra / Governo do Paraná" cited and the calendar URL in every result.
- **Test fixtures with real third-party content**:

| File | Source | Licence |
|---|---|---|
| `test/fixtures/portal_busca_saude.html`, `portal_busca_vazia.html`, `portal_detalhe_unidades.html`, `portal_detalhe_transporte.html` | Trimmed pages of the [Portal de Dados Abertos de Curitiba](https://dadosabertos.curitiba.pr.gov.br/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with the portal's notice above |
| `test/fixtures/portal_arquivos_unidades.json` | 3 rows of a dataset's file list on the [same portal](https://dadosabertos.curitiba.pr.gov.br/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with the portal's notice above |
| `test/fixtures/geocuritiba/feira.json`, `rua_da_cidadania.json`, `parques.json`, `ciclovia.json` | A few records of IPPUC's [GeoCuritiba](https://geocuritiba.ippuc.org.br/server/rest/services) layers (Feira, Rua da Cidadania, Parques e Bosques, Estrutura Cicloviária), recorded 2026-11-21, trimmed to institutional fields | No licence found; facts only, IPPUC cited |
| `test/fixtures/ana/65010000_fazendinha.xml`, `65019980_ete_araucaria.xml`, `02549127_no_data.xml` | Answers of ANA's [telemetry web service](https://telemetriaws1.ana.gov.br/ServiceANA.asmx) (`DadosHidrometeorologicos`, 21–22 Nov 2026), recorded 2026-11-22; the two data samples without the XML schema block (only station code, time, flow, level and rain; no personal data) | No licence found; facts only, ANA cited |
| `test/fixtures/guaira/list_page0.html`, `list_page1.html`, `list_page2.html`, `event_muito_barulho.html`, `event_concerto_osp.html`, `robots.txt` | Pages of the [Teatro Guaíra calendar](https://www.teatroguaira.pr.gov.br/calendario-eventos), recorded 2026-11-22, trimmed to the cards and the body-field lines read (images, cast and programme left out), and its robots.txt | No licence found; facts and links only, Teatro Guaíra / Governo do Paraná cited |
| `test/fixtures/osm_library_recorded.json` | Overpass answer from [OpenStreetMap](https://www.openstreetmap.org/), recorded 2026-11-21 | © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |

  Every other fixture is synthetic (invented values).
