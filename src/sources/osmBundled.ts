/*! Kept in dist/ (removeComments keeps /*! blocks; scripts/check-pack.mjs requires it).
 * Curitiba police and fire stations, taken once from OpenStreetMap for places_search (v0.7). No network call.
 * Data © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0,
 * https://opendatacommons.org/licenses/odbl/1-0/); see https://www.openstreetmap.org/copyright. This file is a derived database of that data and is under the ODbL;
 * the Apache-2.0 licence of this repository does not apply to it.
 * Source: POST https://ovp.dresel.systems/api-sa/interpreter on 2026-11-21 (fire stations 03:26 UTC, police about 03:28 UTC),
 * query `nwr["amenity"="<fire_station|police>"](area.cwb);out center;` with the Curitiba area (IBGE 4106902);
 * OSM data as of 2026-11-19T21:22:20Z. Only the tags places_search returns were kept. Not refreshed automatically.
 */

/** Day the list was taken, in Curitiba time (00:26–00:28 BRT); the note warns once more than 180 days have passed. */
export const OSM_BUNDLED_CHECKED_AT = "2026-11-21";
/** Overpass `osm3s.timestamp_osm_base` of the captured answers. */
export const OSM_BUNDLED_DATA_AS_OF = "2026-11-19T21:22:20Z";
/** When each answer was fetched (police approximate to the minute); used as `fetched_at`. */
export const OSM_BUNDLED_FETCHED_AT = { police: "2026-11-21T03:28:00Z", fire_station: "2026-11-21T03:26:00Z" } as const;

export interface BundledElement {
  type: "node" | "way" | "relation";
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export const OSM_BUNDLED_ELEMENTS: readonly BundledElement[] = [
  {"type": "node", "id": 614282456, "lat": -25.510795, "lon": -49.3332797, "tags": {"name": "Corpo de Bombeiros da CIC", "amenity": "fire_station"}},
  {"type": "node", "id": 1826601613, "lat": -25.4154742, "lon": -49.2741417, "tags": {"name": "Bombeiros - 7 Grupamento", "amenity": "fire_station", "addr:street": "Rua Nilo Peçanha", "addr:housenumber": "557", "addr:suburb": "Bom Retiro", "addr:postcode": "80520-176", "addr:city": "Curitiba"}},
  {"type": "node", "id": 3642411215, "lat": -25.4054541, "lon": -49.3357054, "tags": {"name": "Corpo de Bombeiros - Posto Santa Felicidade", "amenity": "fire_station", "addr:street": "Avenida Vereador Toaldo Túlio", "addr:housenumber": "708", "addr:city": "Curitiba"}},
  {"type": "node", "id": 4083278319, "lat": -25.4241951, "lon": -49.2551228, "tags": {"name": "Corpo de Bombeiros", "amenity": "fire_station"}},
  {"type": "way", "id": 253557509, "lat": -25.5480516, "lon": -49.2717252, "tags": {"name": "Posto de Bombeiros Bairro Novo", "amenity": "fire_station", "addr:street": "Rua Lupionópolis", "addr:housenumber": "1255", "addr:suburb": "Sítio Cerrado", "addr:city": "Curitiba"}},
  {"type": "way", "id": 271669531, "lat": -25.4387924, "lon": -49.2752557, "tags": {"name": "Quartel do Comando do Corpo de Bombeiros do Paraná", "amenity": "fire_station", "addr:street": "Rua Nunes Machado", "addr:housenumber": "100"}},
  {"type": "way", "id": 357198557, "lat": -25.4796459, "lon": -49.2909154, "tags": {"name": "1° Grupamento de Bombeiros", "amenity": "fire_station"}},
  {"type": "way", "id": 424144595, "lat": -25.4049875, "lon": -49.247135, "tags": {"name": "Corpo de Bombeiros Cabral/Bacacheri", "amenity": "fire_station"}},
  {"type": "way", "id": 443672997, "lat": -25.452634, "lon": -49.2073715, "tags": {"name": "Corpo de Bombeiros - Cajuru", "amenity": "fire_station"}},
  {"type": "way", "id": 544534878, "lat": -25.3946373, "lon": -49.2853579, "tags": {"amenity": "fire_station"}},
  {"type": "node", "id": 1955893125, "lat": -25.4875613, "lon": -49.2065348, "tags": {"name": "UPS Uberaba", "amenity": "police"}},
  {"type": "node", "id": 3634618581, "lat": -25.411299, "lon": -49.3500238, "tags": {"name": "Polícia Militar", "amenity": "police", "addr:street": "Avenida Vereador Toaldo Túlio", "addr:housenumber": "2372", "addr:city": "Curitiba"}},
  {"type": "node", "id": 4099658265, "lat": -25.4974604, "lon": -49.3405344, "tags": {"name": "PMPR", "amenity": "police"}},
  {"type": "node", "id": 4102276047, "lat": -25.5164447, "lon": -49.3229186, "tags": {"name": "11º DP", "amenity": "police"}},
  {"type": "node", "id": 4133391812, "lat": -25.4530086, "lon": -49.2441912, "tags": {"name": "Superintendência da PRF no Paraná", "amenity": "police", "addr:street": "Marginal Linha Verde", "opening_hours": "Mo-Fr 08:00-16:00"}},
  {"type": "node", "id": 4161230314, "lat": -25.4011143, "lon": -49.3346171, "tags": {"name": "Delegacia Polícia Civil 12ªDP", "amenity": "police"}},
  {"type": "node", "id": 4242773834, "lat": -25.4646333, "lon": -49.3101652, "tags": {"name": "Polícia Militar", "amenity": "police"}},
  {"type": "node", "id": 4469335991, "lat": -25.4533526, "lon": -49.2943122, "tags": {"name": "Denarc Delegacia de Narcóticos", "amenity": "police"}},
  {"type": "node", "id": 4958616822, "lat": -25.4910771, "lon": -49.2583742, "tags": {"name": "COPE - Centro de Operações Policiais Especiais", "amenity": "police", "addr:street": "Rua Conde de São João das Duas Barras", "addr:housenumber": "1274", "opening_hours": "24/7"}},
  {"type": "node", "id": 4958617421, "lat": -25.4884082, "lon": -49.257994, "tags": {"name": "Base QRX", "amenity": "police", "addr:street": "Rua Professor José Nogueira dos Santos", "addr:housenumber": "1092 / B"}},
  {"type": "node", "id": 5664647203, "lat": -25.4523877, "lon": -49.2536849, "tags": {"name": "Corregedoria Geral PMPR", "amenity": "police"}},
  {"type": "node", "id": 5686641135, "lat": -25.5096746, "lon": -49.3094859, "tags": {"name": "Polícia Militar - NEOVILLE", "amenity": "police"}},
  {"type": "node", "id": 5747563512, "lat": -25.4791026, "lon": -49.293722, "tags": {"name": "Guarda Municipal - NDS Portão", "amenity": "police"}},
  {"type": "node", "id": 5747563513, "lat": -25.4798532, "lon": -49.2915065, "tags": {"name": "Instituto de Identificação do Paraná", "amenity": "police"}},
  {"type": "node", "id": 6175227888, "lat": -25.425149, "lon": -49.2463019, "tags": {"name": "Sede CRMV-PR", "amenity": "police", "addr:street": "Rua Fernandes de Barros", "addr:housenumber": "685"}},
  {"type": "node", "id": 6175261842, "lat": -25.4426635, "lon": -49.3003106, "tags": {"name": "NUCRIA/SICRIDE", "amenity": "police", "addr:street": "Avenida Vicente Machado", "addr:housenumber": "2560", "opening_hours": "Mo-Fr 09:00-17:00"}},
  {"type": "node", "id": 6181964448, "lat": -25.4337665, "lon": -49.2697531, "tags": {"name": "Instituto de Identificação do Paraná - IIPR", "amenity": "police", "addr:street": "Rua Pedro Ivo", "addr:housenumber": "386"}},
  {"type": "node", "id": 6358599669, "lat": -25.5742351, "lon": -49.3387524, "tags": {"name": "13º Distrito Policial", "amenity": "police", "addr:street": "Rua Enette Dubard", "addr:housenumber": "1644"}},
  {"type": "node", "id": 10208156381, "lat": -25.5009674, "lon": -49.2369141, "tags": {"name": "Guarda Municipal", "amenity": "police", "addr:street": "Rua da Cidadania do Carmo", "addr:housenumber": "08"}},
  {"type": "node", "id": 10208156400, "lat": -25.5013848, "lon": -49.2381931, "tags": {"name": "Instituto de Identificação", "amenity": "police", "addr:street": "Rua da Cidadania do Carmo", "addr:housenumber": "37", "website": "https://www.policiacivil.pr.gov.br/webservices/iipr/postos"}},
  {"type": "node", "id": 11004096241, "lat": -25.382411, "lon": -49.2652352, "tags": {"name": "Módulo da Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 129411405, "lat": -25.465344, "lon": -49.277872, "tags": {"name": "Guarda Municipal de Curitiba", "amenity": "police"}},
  {"type": "way", "id": 165629334, "lat": -25.3760953, "lon": -49.2278315, "tags": {"name": "Departamento de Polícia Federal", "amenity": "police", "addr:street": "Rua Professora Sandália Monzon", "addr:housenumber": "210", "addr:suburb": "Santa Cândida", "addr:postcode": "82640-040", "addr:city": "Curitiba"}},
  {"type": "way", "id": 171467519, "lat": -25.4165972, "lon": -49.2925894, "tags": {"name": "3º Distrito Policial", "amenity": "police", "addr:street": "Rua Solimões", "addr:housenumber": "1640", "addr:postcode": "80810-070"}},
  {"type": "way", "id": 195556954, "lat": -25.4350486, "lon": -49.2592225, "tags": {"name": "Delegacia de Homicídios da Capital", "amenity": "police", "addr:street": "Avenida Sete de Setembro", "addr:housenumber": "2077", "addr:suburb": "Jardim Botânico", "addr:postcode": "80060-070", "addr:city": "Curitiba", "website": "https://www.policiacivil.pr.gov.br/"}},
  {"type": "way", "id": 241674586, "lat": -25.4335988, "lon": -49.2665406, "tags": {"name": "1º Distrito Policial", "amenity": "police", "addr:street": "Rua André de Barros", "addr:housenumber": "671", "addr:suburb": "Centro", "addr:postcode": "80010-080", "addr:city": "Curitiba"}},
  {"type": "way", "id": 291542488, "lat": -25.4358437, "lon": -49.2675386, "tags": {"name": "Instituto de Criminalística", "amenity": "police", "addr:street": "Avenida Visconde de Guarapuava", "addr:housenumber": "2652"}},
  {"type": "way", "id": 329991384, "lat": -25.4383118, "lon": -49.237951, "tags": {"name": "Delegacia de Furtos e Roubos", "amenity": "police"}},
  {"type": "way", "id": 354631241, "lat": -25.4326749, "lon": -49.2758921, "tags": {"name": "Módulo da Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 356063718, "lat": -25.4546104, "lon": -49.2289947, "tags": {"name": "2ª CIA - 20º Batalhão da Polícia Militar", "amenity": "police", "addr:street": "Rua Rodolpho Senff", "addr:housenumber": "251", "addr:suburb": "Jardim das Américas", "addr:city": "Curitiba"}},
  {"type": "way", "id": 356277681, "lat": -25.3900547, "lon": -49.230992, "tags": {"name": "Módulo da Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 356649607, "lat": -25.4153327, "lon": -49.2525565, "tags": {"name": "Núcleo de Proteção ao Cidadão", "amenity": "police"}},
  {"type": "way", "id": 357198558, "lat": -25.4796967, "lon": -49.2917014, "tags": {"name": "8° Distrito Policial", "amenity": "police", "addr:street": "Avenida Presidente Wenceslau Braz", "addr:housenumber": "3968", "addr:suburb": "Lindóia", "addr:postcode": "80610-905", "addr:city": "Curitiba", "website": "https://www.policiacivil.pr.gov.br/"}},
  {"type": "way", "id": 357229183, "lat": -25.4511232, "lon": -49.2724501, "tags": {"name": "2º Distrito Policial", "amenity": "police", "addr:street": "Rua Baltazar Carrasco dos Reis", "addr:housenumber": "2610", "addr:suburb": "Água Verde", "addr:postcode": "80250-130", "addr:city": "Curitiba"}},
  {"type": "way", "id": 357473722, "lat": -25.3974537, "lon": -49.2344681, "tags": {"name": "5º Distrito Policial", "amenity": "police", "addr:street": "Avenida Prefeito Erasto Gaertner", "addr:housenumber": "1399", "addr:suburb": "Bacacheri", "addr:postcode": "82515-000", "addr:city": "Curitiba"}},
  {"type": "way", "id": 357508421, "lat": -25.4435506, "lon": -49.2241267, "tags": {"name": "6º Distrito Policial", "amenity": "police", "addr:street": "Rua Antônio Meirelles Sobrinho", "addr:housenumber": "519", "addr:suburb": "Cajuru", "addr:postcode": "82900-240", "addr:city": "Curitiba"}},
  {"type": "way", "id": 358187782, "lat": -25.4265813, "lon": -49.2807042, "tags": {"name": "Delegacia Móvel de Atendimento ao Futebol e Eventos (DEMAFE)", "amenity": "police", "addr:street": "Rua Martim Afonso", "addr:housenumber": "280", "addr:suburb": "Bigorrilho", "addr:city": "Curitiba"}},
  {"type": "way", "id": 392701729, "lat": -25.3618817, "lon": -49.2597444, "tags": {"name": "Delegacia de Proteção ao Meio Ambiente", "amenity": "police"}},
  {"type": "way", "id": 422852271, "lat": -25.4301398, "lon": -49.2751297, "tags": {"name": "PMPR - 12 BPM  - 1a Companhia", "amenity": "police", "addr:street": "Rua Saldanha Marinho", "addr:housenumber": "355"}},
  {"type": "way", "id": 459359955, "lat": -25.4265671, "lon": -49.26888, "tags": {"name": "Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 461755574, "lat": -25.459567, "lon": -49.306761, "tags": {"name": "12º Batalhão de Polícia Militar", "amenity": "police", "addr:street": "Rua Curupaitis", "addr:housenumber": "1132", "addr:suburb": "Santa Quitéria", "addr:city": "Curitiba"}},
  {"type": "way", "id": 464443759, "lat": -25.473123, "lon": -49.3224381, "tags": {"name": "3ª Companhia do 23º Batalhão de Polícia Militar", "amenity": "police"}},
  {"type": "way", "id": 472313977, "lat": -25.4553325, "lon": -49.3030561, "tags": {"name": "Polícia Civil - 9º DP", "amenity": "police", "addr:street": "Avenida Presidente Arthur da Silva Bernardes", "addr:housenumber": "371"}},
  {"type": "way", "id": 478234366, "lat": -25.5659762, "lon": -49.3389685, "tags": {"name": "UPS Tatuquara - Polícia Militar", "amenity": "police"}},
  {"type": "way", "id": 487926793, "lat": -25.46569, "lon": -49.2980221, "tags": {"name": "Delegacia de Furtos e Roubos de Veículos", "amenity": "police", "addr:street": "Rua Tamoios", "addr:housenumber": "1250", "addr:suburb": "Vila Izabel", "addr:postcode": "80320-290", "addr:city": "Curitiba"}},
  {"type": "way", "id": 488431779, "lat": -25.4410528, "lon": -49.2763917, "tags": {"amenity": "police"}},
  {"type": "way", "id": 543898927, "lat": -25.3874608, "lon": -49.3034992, "tags": {"amenity": "police"}},
  {"type": "way", "id": 544002456, "lat": -25.4020341, "lon": -49.294877, "tags": {"amenity": "police"}},
  {"type": "way", "id": 546206472, "lat": -25.3785015, "lon": -49.2809438, "tags": {"amenity": "police"}},
  {"type": "way", "id": 598233034, "lat": -25.4238895, "lon": -49.2142617, "tags": {"name": "Polícia Científica do Paraná", "amenity": "police", "addr:street": "Rua Paulo Turkiewicz", "addr:housenumber": "150", "addr:suburb": "Tarumã", "addr:city": "Curitiba"}},
  {"type": "way", "id": 638334507, "lat": -25.3773219, "lon": -49.2078961, "tags": {"name": "Guarda Municipal de Curitiba", "amenity": "police"}},
  {"type": "way", "id": 647551418, "lat": -25.5749498, "lon": -49.2679152, "tags": {"name": "Guarda Municipal", "amenity": "police", "addr:street": "Rua Colomba Merlin", "addr:suburb": "Ganchinho", "addr:city": "Curitiba"}},
  {"type": "way", "id": 650354447, "lat": -25.4944468, "lon": -49.2860353, "tags": {"name": "Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 655200362, "lat": -25.407759, "lon": -49.28285, "tags": {"name": "Módulo Policial", "amenity": "police"}},
  {"type": "way", "id": 685150638, "lat": -25.4482471, "lon": -49.253387, "tags": {"name": "Polícia Militar do Paraná", "amenity": "police"}},
  {"type": "way", "id": 699992493, "lat": -25.4249468, "lon": -49.2680497, "tags": {"name": "Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 714083881, "lat": -25.4275977, "lon": -49.277019, "tags": {"name": "Delegacia de Explosivos, Armas e Munições", "amenity": "police", "addr:street": "Rua Desembargador Ermelino de Leão", "addr:housenumber": "513", "addr:suburb": "São Francisco", "addr:postcode": "80410-230", "addr:city": "Curitiba"}},
  {"type": "way", "id": 715153757, "lat": -25.4302732, "lon": -49.2729913, "tags": {"amenity": "police"}},
  {"type": "way", "id": 739889875, "lat": -25.4299458, "lon": -49.3668357, "tags": {"name": "1ª Companhia de Polícia Rodoviária Estadual", "amenity": "police"}},
  {"type": "way", "id": 752658648, "lat": -25.4046753, "lon": -49.2501707, "tags": {"name": "Casa da Mulher Brasileira", "amenity": "police", "addr:street": "Avenida Paraná", "addr:housenumber": "870"}},
  {"type": "way", "id": 985567414, "lat": -25.4228614, "lon": -49.3080372, "tags": {"name": "Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 1107994483, "lat": -25.5251034, "lon": -49.2227602, "tags": {"name": "Módulo da Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 1133850440, "lat": -25.423043, "lon": -49.214925, "tags": {"name": "Delegacia de Homicídios", "amenity": "police", "addr:street": "Rua Paulo Turkiewicz", "addr:housenumber": "145"}},
  {"type": "way", "id": 1158558309, "lat": -25.5043924, "lon": -49.2483339, "tags": {"name": "Polícia Militar do Paraná", "amenity": "police"}},
  {"type": "way", "id": 1197121118, "lat": -25.4471464, "lon": -49.2740856, "tags": {"name": "Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 1256882356, "lat": -25.4326237, "lon": -49.2749776, "tags": {"name": "Guarda Municipal", "amenity": "police"}},
  {"type": "way", "id": 1366030241, "lat": -25.4806979, "lon": -49.3799788, "tags": {"name": "Guarda Municipal de Curitiba", "amenity": "police"}},
  {"type": "way", "id": 1388063503, "lat": -25.4800305, "lon": -49.1939676, "tags": {"name": "Guarda Municipal de Curitiba", "amenity": "police"}},
  {"type": "way", "id": 1510774561, "lat": -25.4783625, "lon": -49.3115098, "tags": {"amenity": "police"}},
];
