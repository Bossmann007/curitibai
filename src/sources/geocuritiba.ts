import { TtlCache, type Cached } from "../cache.js";
import { blockHost, fetchText, SourceUnavailableError } from "../http.js";
import { createHostGate, underOwnBudget } from "../hostGate.js";
import { cleanField, MASK } from "../mask.js";
import { fold, foldKey, isObject } from "../text.js";
import { dateInCuritiba } from "./detran.js";

/** IPPUC's GeoCuritiba ArcGIS REST services (anonymous GET; robots.txt 404 when checked on 2026-11-21). */
const SERVICES = "https://geocuritiba.ippuc.org.br/server/rest/services";
export const EQUIPMENT_SERVICE_URL = `${SERVICES}/Publico_GeoCuritiba_Equipamentos_Urbanos/MapServer`;
export const BIKE_SERVICE_URL = `${SERVICES}/GeoCuritiba/CICLOVIA_dashboard/FeatureServer`;
/** SMMA's conservation units (Sistema Municipal de Unidades de Conservação), polygons; read on 2026-11-23. */
export const CONSERVATION_SERVICE_URL = `${SERVICES}/GeoCuritiba/Publico_Sistema_Municipal_de_Unidades_de_Conservacao/FeatureServer`;

/** IPPUC's thematic map service (health unit areas, CRAS territories, voting places, police and fire areas, census), the GeoCuritiba/ folder: the root-level name answers 499. */
export const THEMATIC_SERVICE_URL = `${SERVICES}/GeoCuritiba/Publico_Interno_GeoCuritiba_BaseTematica/MapServer`;

/** Credit of the voting places (TRE-PR's list as published by IPPUC), added in v0.27.0. */
export const VOTING_CREDIT = "Fonte: IPPUC/GeoCuritiba (TRE-PR)";
const VOTING_NOTE =
  "Voting places as listed by TRE-PR (see `updated`); this list cannot tell a voter their own place: that is on the " +
  "título de eleitor, the e-Título app or the TRE-PR site. No voter data is read.";

/** Credit of the types added in v0.24.0 (sport and leisure by SMELJ, conservation units by SMMA). */
export const SPORT_CONSERVATION_CREDIT = "Fonte: IPPUC/GeoCuritiba (SMELJ / SMMA)";
const CONSERVATION_NOTE =
  "A conservation unit is a protected area, not always open to visits: check with SMMA or the 156 before going. " +
  "The layer publishes no update date (`updated` is null).";

/** Health units (v0.44.0): hours are the Secretaria Municipal da Saúde's text, never read as a promise. */
const HEALTH_UNIT_NOTE =
  "Health unit hours are as published by the Secretaria Municipal da Saúde (see `updated`): a day not listed is not " +
  "published as open, which is not a promise that the unit is closed or open; `open_periods` are periods of the day, " +
  "not days. Check before going, by the unit's phone when one is given, or the 156. An ouvidoria@ e-mail is the SMS " +
  "Ouvidoria's, not the unit's own. Only municipal health units: UPAs are type `upa`, public hospitals `hospital " +
  "publico`. Not for emergencies: call 192 (SAMU) or 193.";

/** UPAs, public hospitals and psychiatric stabilisation (v0.45.0): the first sentence of every note for these types. */
export const EMERGENCY_NOTE =
  "Emergency: call 192 (SAMU) or 193 (Bombeiros). This tool lists places, it does not triage or say where to go.";
const SMS_OUVIDORIA = "An ouvidoria@ e-mail is the SMS Ouvidoria's, not the unit's own.";
const UPA_NOTE =
  "UPA hours are as published by the Secretaria Municipal da Saúde (see `updated`); `open_periods.all_day` is the " +
  "layer's 24-hour flag and `hours` the detail (dental urgency hours differ). Check by the UPA's phone or the 156. " +
  `Public hospitals are type \`hospital publico\`. ${SMS_OUVIDORIA}`;
const HOSPITAL_NOTE =
  "Public hospitals as listed by IPPUC (municipal, state, federal and military), not every hospital in Curitiba. The " +
  "24-hour and period flags and hours are uneven in this layer: `all_day` false or no hours does not mean closed or " +
  `not open 24 hours, and being listed does not mean walk-in care. Check \`updated\` and call the hospital. ${SMS_OUVIDORIA}`;
/** CAPS and psychiatric stabilisation (v0.46.0): after the emergency sentence, CVV 188 (read on cvv.org.br, 2026-11-25). */
export const MENTAL_HEALTH_LEAD_NOTE = `${EMERGENCY_NOTE} Emotional support: CVV 188 (24 hours, free call).`;
const CAPS_NOTE =
  "CAPS hours are as published by the Secretaria Municipal da Saúde (see `updated`); `open_periods.all_day` is the " +
  "layer's 24-hour flag and `hours` the detail. A CAPS listed here is not always the one that serves you: ask a " +
  "CAPS Infantil which ages it takes, and some CAPS list in `hours` the regionais they serve. Ask your health " +
  `unit (\`unidade de saude\`) or call the CAPS. ${SMS_OUVIDORIA}`;
const NOT_EMERGENCY = "Not for emergencies: call 192 (SAMU) or 193.";
const MEDICAL_SPECIALTY_NOTE =
  "Municipal and state specialty centres as listed by IPPUC, hours as published (see `updated`; some date from " +
  "2022). Being listed does not mean walk-in care: check with your health unit (`unidade de saude`) whether you " +
  "need a referral, and call the centre before going. Mental health: type `caps`. " +
  `${SMS_OUVIDORIA} ${NOT_EMERGENCY}`;
const DENTAL_SPECIALTY_NOTE =
  "Municipal dental specialty centres, hours as published (see `updated`). As the layer publishes, referral to a " +
  "Centro de Especialidades Odontológicas is through the health units (`unidade de saude`): ask at yours. " +
  `${SMS_OUVIDORIA} ${NOT_EMERGENCY}`;
const PSYCHIATRIC_NOTE =
  "The Secretaria Municipal da Saúde's psychiatric stabilisation unit, hours as published (see `updated`). Check by " +
  `its phone or the 156. ${SMS_OUVIDORIA}`;

/** Health surveillance, zoonoses and the veterinary hospital (v0.47.0): only what the layers publish. */
const SANITARY_NOTE =
  "The Secretaria Municipal da Saúde's Vigilância Sanitária offices, hours as published (see `updated`). Call the " +
  "office before going, or the 156.";
const ZOONOSES_NOTE =
  "The Centro de Controle de Zoonoses e Vetores, hours as published (see `updated`). Call before going, or the 156. " +
  "The Hospital Veterinário Municipal is type `hospital veterinario`.";
const VET_HOSPITAL_NOTE =
  "When read on 2026-11-25, IPPUC's layer published the Hospital Veterinário Municipal's address only: no hours, " +
  "phone, services or who it serves. Empty `hours` or `phones` and all-false `open_periods` mean not published, not " +
  "closed. This tool cannot say who the hospital serves or what it costs: ask the 156 before going. The Centro de " +
  "Controle de Zoonoses e Vetores is type `zoonoses`.";

/**
 * Guarda Municipal modules and regional núcleos (v0.48.0): the first sentence of every note for these types. 153 is in
 * the layers' text; 153 and 190 are in the "Emergências" section of the Turismo "Telefones Úteis" page (2026-11-22).
 */
export const GUARD_EMERGENCY_NOTE =
  "Emergency: call 153 (Guarda Municipal) or 190 (Polícia Militar). This tool lists places, it does not dispatch help.";
const GUARD_MODULE_NOTE =
  "The Guarda Municipal's modules as listed by IPPUC, hours as published (see `updated`); `open_periods.all_day` is " +
  "the layer's 24-hour flag and `hours` the detail. A phone of 153 is the Guarda's emergency line, not the " +
  "module's own. A place with no module here may still be patrolled: an empty result is not a statement about the " +
  "Guarda's presence. The regional núcleos are type `nucleo da guarda`.";
const GUARD_NUCLEUS_NOTE =
  "The Guarda Municipal's regional núcleos, named Núcleo Regional da Defesa Social in the layer; operational and " +
  "administrative hours and the bairros each one covers are in `hours` as published (see `updated`). `bairro` " +
  "filters by where the núcleo is, not by the bairros it covers: to find which núcleo covers a bairro, list them " +
  "all and read the \"Bairros de abrangência\" line in `hours`. The modules are type `modulo da guarda`.";

/**
 * Police units (v0.49.0): the first sentence of every note for these types. 190, 197 and 191 are in the "Emergências"
 * section of the Turismo "Telefones Úteis" page (2026-11-22), labelled as here.
 */
export const POLICE_EMERGENCY_NOTE =
  "Emergency: call 190 (Polícia Militar), 197 (Polícia Civil) or 191 (Polícia Rodoviária Federal). This tool lists " +
  "places, it does not file police reports.";
const POLICE_CIVIL_NOTE =
  "The Polícia Civil's units in Curitiba as listed by IPPUC: the district delegacias (Distrito Policial) and also " +
  "specialised delegacias, divisions and support units; being listed does not mean a unit takes reports from the " +
  "public, so call before going. The district delegacias are named by number (\"13º Distrito Policial\"), not by " +
  "bairro: to find the one in a bairro, filter by `bairro`, not `name`. Hours as published (see `updated`); `open_periods.all_day` is the layer's 24-hour " +
  "flag and `hours` the detail, and they do not always agree. Online reports: the Polícia Civil do Paraná's " +
  "Delegacia Eletrônica (not linked by this tool). Polícia Militar units are not in this list (`places_search`, " +
  "category `police`, has some from OpenStreetMap).";
const POLICE_FEDERAL_NOTE =
  "The Polícia Federal's office in Curitiba as listed by IPPUC, hours as published (see `updated`); call before going.";
const POLICE_HIGHWAY_NOTE =
  "The Polícia Rodoviária Federal's office in Curitiba as listed by IPPUC, hours as published (see `updated`); call " +
  "before going. On a federal highway, call 191.";
const POLICE_SCIENTIFIC_NOTE =
  "The Polícia Científica's units in Curitiba as listed by IPPUC, hours as published (see `updated`); being listed " +
  "does not mean a unit serves the public at the desk, so call before going.";

/**
 * Instituto de Identificação do Paraná (v0.50.0): a state service. The booking page is on a state host that is not on
 * the link allowlist, so it is named, never linked. The layer has no appointment field: the line is in `observacao`.
 */
export const IDENTIFICATION_LEAD_NOTE =
  "Appointments are booked through the Paraná state Instituto de Identificação's channels (not linked by this " +
  "tool); this tool lists places, it does not book.";
const IDENTIFICATION_NOTE =
  "The Instituto de Identificação do Paraná's posts in Curitiba as listed by IPPUC. Days, hours and the appointment " +
  "line are in `hours` as published (see `updated`); a record with no appointment line does not mean no appointment " +
  "is needed, and the head office's hours are administrative, so being listed does not mean a place issues the " +
  "card. Some posts publish \"2ª e 6ª feira\", kept as written: call before going. `open_periods` are the layer's " +
  "flags for periods of the day, not days, and `hours` the detail; they do not always agree. Most posts are named " +
  "after their Rua da Cidadania, which is not always the bairro: filter by `bairro` or `near`.";

/**
 * Registro civil, Junta Militar, Defensoria and Fórum (v0.51.0). The registry offices' and the Defensoria's e-mails
 * are on their own domains and some Defensoria phones are mobiles: the unchanged contact filters drop them.
 */
const CIVIL_REGISTRY_NOTE =
  "The Registro Civil das Pessoas Naturais offices that IPPUC's layer lists, as published, not necessarily every " +
  "registry office in Curitiba. Hours as published (see `updated`). Prices, " +
  "deadlines and which office holds a given record are not in the layer: call the office before going. The offices' " +
  "e-mails are on their own domains and are not shown, and a line in `hours` that mentions the cartório (it can " +
  "carry a person's name) is replaced by a marker: ask the office.";
const MILITARY_BOARD_NOTE =
  "The Juntas de Serviço Militar that IPPUC lists in Curitiba; days, hours and the bairros each one serves are in " +
  "`hours` as published (see `updated`). `bairro` filters by where a junta is, not by the bairros it serves: to find " +
  "yours, list them all and read the \"Atende aos bairros\" line. Call before going.";
const PUBLIC_DEFENDER_NOTE =
  "The Defensoria Pública do Paraná's posts in Curitiba as listed by IPPUC; days, hours, the areas each post handles " +
  "and the bairros it covers are in `hours` as published (see `updated`). `bairro` filters by where a post is, not " +
  "by the bairros it covers. Who can be assisted is not in the layer. Only Curitiba landlines and city e-mails are " +
  "shown, so the Defensoria's own e-mails and its mobile numbers are not, and a post can come back with no phone: " +
  "reach it through the Defensoria Pública do Paraná's own channels (not linked by this tool). Several posts are " +
  "inside a fórum (type `forum`).";
const COURTHOUSE_NOTE =
  "The fóruns IPPUC lists in Curitiba (state courts and the Justiça do Trabalho); hours, the courts each one houses " +
  "and the bairros it covers are in `hours` as published (see `updated`; some records date from 2019 or 2022). " +
  "`bairro` filters by where a fórum is, not by the bairros it covers. Call before going. The Defensoria Pública's " +
  "posts are type `defensoria publica`.";

// v0.52.0: shelters (layers 45, 46, 164) are never types.
const NO_SHELTERS = "Shelters and transit houses are not listed by this tool.";
export const HIDDEN_SHELTER_LINE =
  "[a line that may point at a shelter, transit house or confidential unit is not shown; ask the 156]";
export const PRIVATE_ADDRESS_LINE =
  "[the address of this place is not published: call its phone if one is shown, or the 180 or the 156]";
const CREAS_NOTE =
  "The CREAS that IPPUC lists in Curitiba, hours as published (see `updated`). Each is named after a regional " +
  "(\"CIC\"): find it with `name`; `bairro` is where it is. Which bairros a CREAS serves is not in the layer: ask your " +
  "CRAS (type `cras`) or the 156. Who is assisted is not in the layer: call before going. " +
  NO_SHELTERS;
const STREET_CENTRE_NOTE =
  "The Centros POP (for people living on the street) IPPUC lists, hours as published (see `updated`); as published, " +
  `requests go through the 156. A unit with only a mobile has \`phones\` empty: call the 156. ${NO_SHELTERS}`;
const SOCIAL_REFERRAL_NOTE =
  "The Central de Encaminhamento Social 24 Horas as listed by IPPUC (see `updated`); as the layer publishes, contact " +
  `is through the 156. ${NO_SHELTERS}`;
const ELDERLY_CENTRE_NOTE =
  "The Centros de Atividades para Idosos that IPPUC lists in Curitiba (named Espaço ConViver in the layer), hours as " +
  "published (see `updated`). Who can take part and how to join are not in the layer: call the unit or the 156 " +
  "before going.";
/** As on the Ministério das Mulheres' Ligue 180 page (docs/sources.md). */
export const WOMEN_EMERGENCY_NOTE =
  "Emergency: call 190 (Polícia Militar). Central de Atendimento à Mulher: 180 (24 hours, free call), both as " +
  "published by the Ministério das Mulheres. This tool lists places, it does not dispatch help.";
const WOMEN_CENTRE_NOTE =
  "The women's reference centres IPPUC lists (the Casa da Mulher Brasileira among them), hours and services as " +
  "published (see `updated`). A record whose address is not marked public returns only its name and phones, so " +
  `\`bairro\` and \`near\` never match it: call it or the 180. Who is assisted is not in this tool. ${NO_SHELTERS}`;
const AFRO_CENTRE_NOTE = "The Centro de Referência Afro as listed by IPPUC, hours as published (see `updated`); call before going.";
// v0.53.0.
const SCHOOL_NOTE =
  "Municipal units as listed by IPPUC, hours as published (see `updated`); most escolas publish only `open_periods`: call. " +
  "Enrolment and vacancies are not in the layer.";
const CEI_NOTE =
  "Private or non-profit centres contracted by the Prefeitura, as listed by IPPUC; this does not confirm Vale-Creche " +
  "accreditation (see city_service_guide `creche` and `vale_creche`). Hours as published; call before going.";
/** v0.58.0. The URBS home page is the link the bus tools already return (busCommon.ts); never fetched. */
const BUS_STATION_NOTE =
  "The Terminal Rodoviário de Curitiba (the bus side of the Rodoferroviária) as listed by IPPUC; its hours are the " +
  "terminal's, as published (see `updated`), not departures. Intercity and interstate departures, platforms and " +
  "fares are not in this tool: ask the bus company or the terminal, or see https://www.urbs.curitiba.pr.gov.br/. " +
  "The rail side is type `ferroviaria`; city buses to it: bus_route_between.";
const RAIL_STATION_NOTE =
  "The Terminal Ferroviário de Curitiba (the rail side of the Rodoferroviária) as listed by IPPUC; hours as published " +
  "by season (see `updated`): the layer does not say which season applies, so call before going. Its " +
  "e-mail is the train operator's and is not shown. Train times and tickets are not in this tool.";
const REGIONAL_OFFICE_NOTE =
  "The Prefeitura's Administrações Regionais (one per regional) as listed by IPPUC; hours and the bairros each one " +
  "serves are in `hours` as published (see `updated`). `bairro` filters by where an office is, not by the bairros it " +
  "serves: list them all and read the \"Bairros de abrangência\" line, or use place_at_point for a point's regional. " +
  "A phone inside `hours` (the protocolo line) is masked and may not be in `phones`: call the office or the 156.";
/** v0.59.0. Read on 2026-11-26: the 9 agencies share one landline, one 0800 and one e-mail; `site` is never read. */
const COHAB_NOTE =
  "The COHAB-CT (Companhia de Habitação Popular de Curitiba) service agencies, in the Ruas da Cidadania, as listed by " +
  "IPPUC; hours as published (see `updated`). When read, every agency listed the same phones and e-mail: central " +
  "contacts, not the agency's own. The layer says in-person service is booked through the Agenda Online (\"Saiba " +
  "Mais\"): this tool does not book (city_service_guide `agenda_online`). Housing applications, " +
  "the applicant queue and anyone's registration are not in this tool. Agencies are named after their Rua da " +
  "Cidadania, not always the bairro they are in: search by `name` (e.g. \"tatuquara\").";
/** v0.60.0. Read on 2026-11-26: 4 records, one phone published as "WhatsApp (41) …" on all; two only cook. */
const MESA_SOLIDARIA_NOTE =
  "Mesa Solidária places (Prefeitura de Curitiba), as listed by IPPUC; hours and serving " +
  "times as published (see `updated`). Some are kitchens that only cook meals and list no serving hours: check " +
  "`hours` before going. The phone is published as a WhatsApp line (the same on every record when read). Who may eat " +
  "there and any registration are not in this tool: ask the place or the 156.";
/** v0.60.0. Layer 9 read on 2026-11-26: 233 gardens, 56 community ones; none has a phone or published hours. */
const COMMUNITY_GARDEN_NOTE =
  "Community gardens (Horta Comunitária Urbana) as listed by IPPUC; some are kept by residents' associations. The " +
  "layer also lists 109 school and 68 institutional gardens (counts read on 2026-11-26), inside schools and " +
  "institutions and not open to the public: they are not listed here. When read, the gardens had no phone and no " +
  "hours: only the e-mail the layer publishes, the same city address on every record. A line naming who is in " +
  "charge is hidden; how to join a garden is not in this tool: ask the e-mail or the 156. `source_url` is the whole " +
  "layer, school and institutional gardens included.";
/** v0.60.0. Layer 10 read on 2026-11-26: 3 farms; two list mobiles only or a landline plus mobiles. */
const URBAN_FARM_NOTE =
  "The Fazendas Urbanas (urban farms) of the Prefeitura's food-security secretariat, as listed by IPPUC; hours as " +
  "published (see `updated`). Mobiles are dropped, so a farm may show no phone: use the e-mail. Enrolment in the " +
  "farms' courses and activities is through the city pages named in `hours`; this tool does not enrol.";
/** v0.60.0. Layer 1 read on 2026-11-26: 10 núcleos, one per regional, each with a landline; one shared e-mail. */
const FOOD_SECURITY_OFFICE_NOTE =
  "The Núcleos Regionais de Segurança Alimentar e Nutricional (the food-security secretariat's office in each " +
  "regional, mostly in the Rua da Cidadania; Matriz at the Mercado Municipal), as listed by IPPUC; hours as published " +
  "(see `updated`). Programmes, benefits and anyone's registration are not in this tool: ask the núcleo or the 156.";
/** v0.64.0. Layer 150 read on 2026-11-26: 12 records; one SINE Móvel with no published address, one Economia Popular Solidária. */
const SINE_NOTE =
  "The Prefeitura's SINE units (job placement), as listed by IPPUC; hours as published (see `updated`). Units are " +
  "named after their Rua da Cidadania, not always the bairro they are in: search by `name` (e.g. \"pinheirinho\"). " +
  "When read, the layer published no address for the SINE Móvel, which it says goes to a different point each day. The layer " +
  "also lists the Economia Popular Solidária office. Vacancies and anyone's registration are not in this tool. The " +
  "Paraná state agency is type `agencia do trabalhador`.";
/** v0.64.0. Layer 151 read on 2026-11-26: one record; its e-mail is on a state domain and is dropped. */
const WORKER_AGENCY_NOTE =
  "The Paraná state Agência do Trabalhador in Curitiba, as listed by IPPUC; hours as published (see `updated`). When " +
  "read, its e-mail was not a city address and was not shown: call. Vacancies and anyone's registration are not in this tool. " +
  "The Prefeitura's units are type `sine`.";
/** v0.64.0. Layer 149 read on 2026-11-26: 16 records; one hours line about 330 characters (wrapLines). */
const LICEU_NOTE =
  "The Prefeitura's Liceus de Ofícios (free courses), as listed by IPPUC, the Liceu das Artes among them; hours as " +
  "published (see `updated`). Courses, dates and enrolment are not in this tool: call the Liceu or the 156.";
/** v0.64.0. Layer 152 read on 2026-11-26: 4 federal agencies; phone 135, no e-mail. Meu INSS and 135 are in the layer. */
const INSS_LEAD_NOTE =
  "The INSS is a federal service: benefits and appointments go through Meu INSS (app or site) or the 135 phone line " +
  "(not linked by this tool); this tool lists places, it does not book.";
const INSS_NOTE =
  "The INSS agencies (Agência da Previdência Social) in Curitiba as listed by IPPUC; hours as published (see " +
  "`updated`). A phone of 135 is the INSS's central line, not the agency's own.";
/** v0.67.0. Layer 61 read on 2026-11-27: 17 records in 17 bairros, hours and the collection size in `observacao`. */
const READING_HOUSE_NOTE =
  "The Prefeitura's Casas da Leitura (neighbourhood reading rooms), as listed by IPPUC; hours as published (see " +
  "`updated`). Not every bairro has one: when none is near, try type `farol do saber` or `biblioteca`.";
const READING_TRAM_NOTE =
  "The Bondinho da Leitura, a reading room in an old tram, as listed by IPPUC; hours as published (see `updated`). " +
  "The neighbourhood reading rooms are type `casa da leitura`.";
/**
 * v0.67.0. Layer 52 read on 2026-11-27: 26 records, city, state, federal and private; one city e-mail named a person. No
 * line named anyone, and the person-line filter would hide real hours ("Atendimento Secretaria:"), so it is not used.
 */
const AUDITORIUM_NOTE =
  "Auditoriums as listed by IPPUC; hours as published (see `updated`), many with none. E-mails are not shown for " +
  "this type (some are a person's own): call. Programmes and bookings are not in this tool.";
const CIRCUS_NOTE =
  "The Prefeitura's circus spaces, as listed by IPPUC; hours as published (see `updated`). Shows and dates are not " +
  "in this tool.";
/** v0.67.0. Layer 58 read on 2026-11-27: one record, whose e-mail was a person's own. */
const CHESS_NOTE =
  "The Prefeitura's chess club, as listed by IPPUC; hours as published (see `updated`). Its e-mail is not shown (it " +
  "can be a person's own): call.";
/** Every CEI line naming its maintainer, owner or head, or a firm (ME, MEI, Eireli, Ltda): some are a person's name. */
export const HIDDEN_MAINTAINER_LINE = "[the maintainer line is not shown: it can carry a person's name]";
/** v0.59.0: the same lines hidden for an office (Administração Regional, COHAB), where "maintainer" is the wrong word. */
export const HIDDEN_PERSON_LINE = "[a line naming who is in charge is not shown: it can carry a person's name]";
const MAINTAINER = "mantenedor|mantid[ao]s? p(?:or|el[ao])|proprietari|responsavel|\\bdiretora?\\b|\\badministradora?\\b";
const MAINTAINER_LINE = new RegExp(`${MAINTAINER}|eireli|ltda`);
const isMaintainerLine = (line: string): boolean => MAINTAINER_LINE.test(fold(line)) || /\bME\b/.test(line) || /\bmei\b/i.test(line);
/**
 * v0.59.0, offices (Administração Regional, COHAB): a line that starts with who is in charge, or has "<role>:"
 * anywhere ("Responsável: Fulana", "Administrador Regional: Fulano", "Diretor(a):"). Narrower than isMaintainerLine,
 * whose MEI, ME, Ltda and "responsável" anywhere rules would hide office service lines ("atendimento ao MEI").
 */
const ROLE = "responsavel|diretora?|administradora?|gerente|coordenadora?|chefe|secretario|supervisora?|gestora?";
/**
 * v0.60.0: the roles gain secretário/a, supervisor/a and gestor/a; titular, coordenação and gestão count only before
 * ':' ("Titular da conta" stays). "Secretaria" without the accent is an office ("Secretaria Municipal de …"): a role
 * only right before ':'; with the accent it is the role, read as "secretario" before folding (NFC first). "Mantido/a
 * por" anywhere hides the line (a person follows "por" with no article), and so does "mantida pelo Sr./Sra./Dona";
 * "mantida pela Associação" stays.
 */
const LABEL_ONLY = "titular|coordenacao|gestao";
/** Folded, with "secretária" (a person's role, NFC first) read as "secretario": not the office "Secretaria". */
const roleFold = (t: string): string => fold(t.normalize("NFC").replace(/secretária/giu, "secretario"));
const PERSON_IN_CHARGE = new RegExp(
  `^[^\\p{L}]*(?:${ROLE})\\b|\\b(?:${ROLE}|${LABEL_ONLY})(?:\\(a\\))?(?: [a-z]+)?\\s*:|\\bsecretaria\\s*:` +
    `|\\bmantid[ao]s? (?:por|pel[ao] (?:sra?|senhora?|seu|dona))\\b`,
  "u",
);
export const isPersonInChargeLine = (line: string): boolean => PERSON_IN_CHARGE.test(roleFold(line));
/**
 * v0.63.0, community gardens (run with residents): an allowlist. A line is shown only when it is one of the kinds in
 * GARDEN_LINE (a public label; an hours or number line; the body that keeps the garden, "Mantida pela Associação …";
 * the city programme; a partner; "Horta com N canteiros") or exactly "Contato pelo e-mail da secretaria", and has no
 * person in it (GARDEN_PERSON, any case: a contact, a volunteer, "quem cuida", cuidado/coordenado por or pelo/pela a
 * person, an honorific, cuida(m)/coordena(m) after anything but a body word; and isPersonInChargeLine). Any other line,
 * a lower-case name included, is hidden. Replaces the v0.60–v0.61 denylist, which a lower-case name passed. Folded
 * with roleFold, so "secretária Fulana" is a person, not the body "secretaria".
 */
const BODY = "associacao|moradores|comunidade|prefeitura|secretaria|escola|igreja|lar|smsan";
const GARDEN_LINE = new RegExp(
  "^(?:" +
    [
      "(?:atendimento|horarios?|funcionamento|endereco|bairro|pomar|cultivos?|area de (?:plantio|lavoura)[a-z ]*|jardins? de mel)\\s*:",
      "(?:(?:atendimento|horarios?(?: de funcionamento)?|funcionamento)\\s*:?\\s*)?(?:(?:de|das?|aos?) )?(?:\\d|(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)s?\\b)",
      `(?:(?:mantid|coordenad|cuidad)[ao]s? pel[ao]|a coordenacao da horta e d[ao]|an?|o) (?:${BODY})\\b`,
      "programa\\b|parceria com\\b|horta com \\d",
    ].join("|") +
    ")",
);
const GARDEN_CONTACT = /^contatos? pel[ao] e-?mail d[ao] secretaria\.?$/;
const GARDEN_PERSON = new RegExp(
  `\\bcontatos?\\b|\\bvoluntari|\\bquem (?:cuida|coordena)|\\b(?:coordenad|cuidad)[ao]s? (?:por\\b|pel[ao] (?!(?:${BODY})\\b))` +
    `|\\b(?:dona|seu|sra?|senhora?)\\b\\.?\\s+[a-z]|(?<!\\b(?:${BODY}) )\\b(?:cuidam?|coordenam?)\\b`,
);
export const isGardenPersonLine = (line: string): boolean => {
  const f = roleFold(line).replace(/^[^\p{L}\p{N}]+/u, "").trim();
  if (GARDEN_CONTACT.test(f)) return false;
  return !GARDEN_LINE.test(f) || GARDEN_PERSON.test(f) || isPersonInChargeLine(line);
};
/** v0.54.0: only the keyword, with or without ':' ("Mantenedora", "Mantida pela:"); its value follows. */
const MAINTAINER_LABEL = new RegExp(`^(?:${MAINTAINER})[a-z]*(?:\\(a\\))?\\s*:?$`);
/** One layer is about 250 KB at most when checked (bike structure, 838 segments, simplified geometry). */
export const GEOCURITIBA_MAX_BYTES = 2 * 1024 * 1024;
export const GEOCURITIBA_TIMEOUT_MS = 15_000;
/** dt_atualiz changes a few times a year; 6 hours keeps the load to a few requests a day per layer. */
export const GEOCURITIBA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** The services' maxRecordCount. A layer that reaches it may be cut: fail closed. */
const MAX_RECORDS = 2000;

export const NAME_MAX = 150;
export const ADDRESS_MAX = 200;
export const LINE_MAX = 160;
export const MAX_HOUR_LINES = 30;
export const MAX_PHONES = 8;
export const MAX_EMAILS = 3;

/** Loose bounding box around Curitiba; a coordinate outside it is treated as missing. */
const LAT_RANGE = [-25.7, -25.3] as const;
const LON_RANGE = [-49.45, -49.15] as const;

export type LayerKind = "facility" | "park" | "bike" | "voting";

export interface FacilityType {
  /** The canonical type name accepted by the tool (folded, Portuguese). */
  id: string;
  /** The layer's name as IPPUC publishes it. */
  label: string;
  /** Other accepted names (folded). */
  aliases: string[];
  kind: LayerKind;
  /** The layer's REST URL (cited in results). */
  layerUrl: string;
  /** The layer also lists private or non-profit venues (commercial cinemas, private theatres); results say so. */
  mixedOwnership?: true;
  /** The result's `source` when set (types added in v0.24.0); otherwise FACILITIES_SOURCE. */
  credit?: string;
  /** A sentence added to the result's note for this type. */
  note?: string;
  /** A sentence put first in the result's note, before the general one (the emergency numbers since v0.45.0; the RG booking channel, v0.50.0). */
  leadNote?: string;
  /** Lines of `observacao` kept (default MAX_HOUR_LINES); a longer text ends with a line saying how many were cut. */
  maxHourLines?: number;
  /** A line longer than LINE_MAX is split after its commas into several lines, not cut (bairro lists, v0.51.0). */
  wrapLines?: true;
  /** True when an `observacao` line (after cleaning) is replaced by `hiddenLineMarker`: a line that may carry a name or point at a shelter. */
  hideLine?: (line: string) => boolean;
  /** Default HIDDEN_NAME_LINE. */
  hiddenLineMarker?: string;
  /**
   * The hidden lines may name a person whose name runs on (hourLines): the value after a hidden label and the end of a
   * split name are hidden too. "maintainer" (CEI, v0.54.0); "person" (offices and gardens, v0.59.0) also reads a hidden
   * line ending in ':' with no comma as a label.
   */
  nameLines?: "maintainer" | "person";
  /**
   * v0.63.0: `hideLine` is an allowlist (community gardens): it hides every line that is not a known public kind, so the
   * whole-field test of hourLines (a keyword split across lines) is skipped: several good lines joined are no kind. So is
   * the split-name tail rule: a line of no kind is hidden anyway, and a public line after a hidden one stays.
   */
  allowlist?: true;
  /** v0.63.0, social assistance: a record whose name or address points at a shelter is skipped, and shelter e-mails dropped. */
  shelter?: true;
  /** A fixed `where` sent instead of "1=1" (never user input): v0.60.0, the community gardens of the horta layer. */
  where?: string;
  /** `divulgar_endereco` not "Sim": name, phones and PRIVATE_ADDRESS_LINE only. */
  privateAddress?: true;
  /** v0.67.0: no e-mail is returned (a layer where city addresses can be a person's own name). */
  noEmails?: true;
}

/** What an entry may set besides its identity and layer (equipment(), social()). */
type TypeOptions = Partial<Omit<FacilityType, "id" | "label" | "aliases" | "kind" | "layerUrl">>;

const sport = (id: string, layer: number, label: string, aliases: string[]): FacilityType => ({
  ...equipment(id, layer, label, aliases),
  credit: SPORT_CONSERVATION_CREDIT,
});

const conservation = (id: string, layer: number, label: string, aliases: string[]): FacilityType => ({
  id,
  label,
  aliases,
  kind: "park",
  layerUrl: `${CONSERVATION_SERVICE_URL}/${layer}`,
  credit: SPORT_CONSERVATION_CREDIT,
  note: CONSERVATION_NOTE,
});

const equipment = (id: string, layer: number, label: string, aliases: string[] = [], extra: TypeOptions = {}): FacilityType => ({
  id,
  label,
  aliases,
  kind: "facility",
  layerUrl: `${EQUIPMENT_SERVICE_URL}/${layer}`,
  ...extra,
});

/** Lines that may point at a shelter (social assistance) or name the person in charge (offices) are replaced by a marker. */
const HIDE_SHELTER = { hideLine: isShelterLine, hiddenLineMarker: HIDDEN_SHELTER_LINE, shelter: true } as const;
const HIDE_PERSON = { hideLine: isPersonInChargeLine, hiddenLineMarker: HIDDEN_PERSON_LINE, nameLines: "person" } as const;

const social = (id: string, layer: number, label: string, aliases: string[], note: string): FacilityType =>
  equipment(id, layer, label, aliases, { note, ...HIDE_SHELTER });

/**
 * The curated subset of layers (ids read from the services on 2026-11-21; the Cultura layers added in v0.20.0 on
 * 2026-11-23). Every layer had under 300 records then (bike structure 838), far below the 2,000-record limit, so one
 * request reads a whole layer.
 */
export const FACILITY_TYPES: readonly FacilityType[] = [
  equipment("feira", 8, "Feira", ["feiras", "feira livre", "feiras livres"]),
  equipment("feira turistica", 163, "Feira Turística", ["feiras turisticas", "feira de artesanato"]),
  equipment("rua da cidadania", 14, "Rua da Cidadania", ["ruas da cidadania"]),
  equipment("ecoponto", 116, "Ecoponto", ["ecopontos"]),
  equipment("ecocidadao", 117, "Ecocidadão", ["ecocidadaos", "parque ecocidadao"]),
  equipment("cambio verde", 5, "Câmbio Verde"),
  equipment("armazem da familia", 3, "Armazém da Família"),
  equipment("sacolao da familia", 4, "Sacolão da Família", ["sacolao"]),
  equipment("mercado municipal", 2, "Mercado Municipal", ["mercado"]),
  equipment("restaurante popular", 6, "Restaurante Popular", ["restaurantes populares"]),
  equipment("banheiro publico", 28, "Sanitário Público", ["banheiros publicos", "sanitario publico", "sanitarios publicos", "banheiro"]),
  equipment("biblioteca", 64, "Biblioteca Geral", ["bibliotecas", "biblioteca geral"]),
  equipment("farol do saber", 63, "Farol do Saber", ["farois do saber"]),
  equipment("museu", 54, "Museu", ["museus"], { mixedOwnership: true }),
  equipment("teatro", 55, "Teatro", ["teatros"], { mixedOwnership: true }),
  // Cultura group, added in v0.20.0 (ids and counts read on 2026-11-23; at most 24 records each).
  equipment("centro cultural", 50, "Centro Cultural", ["centros culturais"], { mixedOwnership: true }),
  equipment("espaco expositivo", 51, "Espaço Expositivo de Artes", [
    "espacos expositivos", "espaco expositivo de artes", "espaco expositivo de arte", "espacos expositivos de artes",
  ], { mixedOwnership: true }),
  equipment("memorial", 53, "Memorial", ["memoriais"]),
  equipment("cinema", 56, "Cinema", ["cinemas"], { mixedOwnership: true }),
  equipment("espetaculos ao ar livre", 59, "Espaço para Espetáculos ao Ar Livre", [
    "espetaculo ao ar livre", "espaco para espetaculos ao ar livre", "espacos para espetaculos ao ar livre",
    "espaco para espetaculo ao ar livre",
  ], { mixedOwnership: true }),
  equipment("gibiteca", 62, "Gibiteca", ["gibitecas"]),
  // Neighbourhood culture, added in v0.67.0 (read on 2026-11-27 UTC: layers 61, 60, 52, 57 and 58; 17, 1, 26, 2 and 1 records).
  equipment("casa da leitura", 61, "Casa da Leitura", [
    "casas da leitura", "casa de leitura", "casas de leitura",
  ], { note: READING_HOUSE_NOTE }),
  equipment("bondinho da leitura", 60, "Bondinho da Leitura", ["bondinho"], { note: READING_TRAM_NOTE }),
  equipment("auditorio", 52, "Auditório", ["auditorios"], { mixedOwnership: true, noEmails: true, note: AUDITORIUM_NOTE }),
  equipment("circo", 57, "Circo", ["circos", "lona de circo"], { note: CIRCUS_NOTE }),
  equipment("clube de xadrez", 58, "Clube de Xadrez", ["xadrez", "clubes de xadrez"], { noEmails: true, note: CHESS_NOTE, ...HIDE_PERSON }),
  equipment("academia ao ar livre", 91, "Academia ao Ar Livre", ["academias ao ar livre", "academia"]),
  equipment("clube da gente", 85, "Clube da Gente"),
  equipment("centro de esporte e lazer", 86, "Centro de Esporte e Lazer"),
  equipment("pista de skate", 92, "Pista de Skate", ["skate", "pistas de skate"]),
  // Esporte e Lazer group (83), added in v0.24.0 (ids and counts read on 2026-11-23; at most 10 records each). The
  // SMELJ service holds the same records in one layer but without divulgar_endereco, so these layers are read instead.
  sport("nucleo regional do esporte", 84, "Núcleo Regional do Esporte, Lazer e Juventude", [
    "nucleos regionais do esporte", "nucleo regional do esporte lazer e juventude", "nucleos regionais do esporte lazer e juventude",
  ]),
  sport("centro de atividade fisica", 87, "Centro de Atividade Física", ["centros de atividade fisica"]),
  sport("centro da juventude", 88, "Centro da Juventude", ["centros da juventude"]),
  sport("centro de iniciacao ao esporte", 89, "Centro de Iniciação ao Esporte", ["centros de iniciacao ao esporte"]),
  sport("centro de referencia em esporte", 90, "Centro de Referência em Esporte e Atividade Física", [
    "centro de referencia em esporte e atividade fisica", "centros de referencia em esporte",
  ]),
  sport("pista de bmx", 93, "Pista de Ciclismo BMX", ["bmx", "pista de ciclismo bmx", "pistas de bmx"]),
  sport("centro de lutas", 94, "Centro de Lutas", ["centros de lutas"]),
  sport("pista de patinacao", 165, "Pista de Patinação", ["patinacao", "pistas de patinacao"]),
  sport("velodromo", 166, "Velódromo", ["velodromos"]),
  // Municipal health units (SMS), added in v0.44.0 (read on 2026-11-25: 109 records, every one with its hours in
  // `observacao`). health_units_search (CNES) has no hours; UPAs and hospitals are the next layers.
  equipment("unidade de saude", 134, "Unidade de Saúde", [
    "unidades de saude", "ubs", "unidade basica", "unidades basicas", "unidade basica de saude", "unidades basicas de saude",
    "posto de saude", "postos de saude",
  ], { note: HEALTH_UNIT_NOTE }),
  // UPAs, public hospitals and psychiatric stabilisation, added in v0.45.0 (read on 2026-11-25: 9, 10 and 1 records).
  // Layer 129's flags and hours are uneven (some records all "Não" with no text), so its note says what they do not mean.
  equipment("upa", 130, "Unidade de Pronto Atendimento", [
    "upas", "unidade de pronto atendimento", "unidades de pronto atendimento", "pronto atendimento", "upa 24h", "upa 24 horas",
  ], { note: UPA_NOTE, leadNote: EMERGENCY_NOTE }),
  equipment("hospital publico", 129, "Hospital (público)", ["hospitais publicos"], { note: HOSPITAL_NOTE, leadNote: EMERGENCY_NOTE }),
  equipment("estabilizacao psiquiatrica", 131, "Unidade de Estabilização Psiquiátrica", [
    "unidade de estabilizacao psiquiatrica", "unidades de estabilizacao psiquiatrica",
  ], { note: PSYCHIATRIC_NOTE, leadNote: MENTAL_HEALTH_LEAD_NOTE }),
  // CAPS and specialty centres, added in v0.46.0 (read on 2026-11-25: 13, 10 and 2 records). The bare
  // "centro de especialidades" stays unresolved (medical or dental); no "caps infantil" alias (no such filter).
  equipment("caps", 135, "Centro de Atenção Psicossocial", ["centro de atencao psicossocial", "centros de atencao psicossocial"], {
    note: CAPS_NOTE,
    leadNote: MENTAL_HEALTH_LEAD_NOTE,
  }),
  equipment("centro de especialidades medicas", 132, "Centro de Especialidades Médicas", [
    "centros de especialidades medicas", "especialidades medicas",
  ], { note: MEDICAL_SPECIALTY_NOTE }),
  equipment("centro de especialidades odontologicas", 133, "Centro de Especialidades Odontológicas", [
    "centros de especialidades odontologicas", "ceo", "especialidades odontologicas",
  ], { note: DENTAL_SPECIALTY_NOTE }),
  // Health surveillance, zoonoses and the veterinary hospital, added in v0.47.0 (read on 2026-11-25: 10, 1 and 1
  // records). No bare "vigilancia", "veterinario", "animal" or "pet" alias: they would promise more than these layers.
  equipment("vigilancia sanitaria", 167, "Vigilância Sanitária", [
    "vigilancias sanitarias", "vigilancia sanitaria municipal",
  ], { note: SANITARY_NOTE }),
  equipment("zoonoses", 136, "Centro de Controle de Zoonoses e Vetores", [
    "centro de controle de zoonoses", "centro de controle de zoonoses e vetores", "controle de zoonoses",
    "centro de zoonoses", "centros de zoonoses", "zoonose", "centro de zoonose", "ccz",
  ], { note: ZOONOSES_NOTE }),
  equipment("hospital veterinario", 112, "Hospital Veterinário Municipal", [
    "hospital veterinario municipal", "hospitais veterinarios",
  ], { note: VET_HOSPITAL_NOTE }),
  // Guarda Municipal modules and regional núcleos, added in v0.48.0 (read on 2026-11-25: 40 and 10 records). No bare
  // "guarda", "guarda municipal" (module or núcleo), "seguranca", "policia", "modulo" or "nucleo" alias.
  equipment("modulo da guarda", 139, "Módulo da Guarda Municipal", [
    "modulos da guarda", "modulo da guarda municipal", "modulos da guarda municipal",
  ], { note: GUARD_MODULE_NOTE, leadNote: GUARD_EMERGENCY_NOTE }),
  equipment("nucleo da guarda", 138, "Núcleo Regional da Guarda Municipal", [
    "nucleos da guarda", "nucleo da guarda municipal", "nucleos da guarda municipal",
    "nucleo regional da guarda municipal", "nucleos regionais da guarda municipal",
    "nucleo regional da defesa social", "nucleos regionais da defesa social",
  ], { note: GUARD_NUCLEUS_NOTE, leadNote: GUARD_EMERGENCY_NOTE }),
  // Police units, added in v0.49.0 (read on 2026-11-25: 49, 1, 1 and 3 records). No bare "policia", "pf", "dp" or
  // "iml" alias; Polícia Militar units are not in these layers.
  equipment("delegacia", 143, "Polícia Civil", [
    "delegacias", "delegacia de policia", "delegacias de policia", "delegacia da policia civil",
    "delegacias da policia civil", "policia civil", "distrito policial", "distritos policiais",
  ], { note: POLICE_CIVIL_NOTE, leadNote: POLICE_EMERGENCY_NOTE }),
  equipment("policia federal", 146, "Polícia Federal", ["superintendencia da policia federal"], { note: POLICE_FEDERAL_NOTE, leadNote: POLICE_EMERGENCY_NOTE }),
  equipment("policia rodoviaria federal", 147, "Polícia Rodoviária Federal", [
    "prf", "superintendencia da policia rodoviaria federal",
  ], { note: POLICE_HIGHWAY_NOTE, leadNote: POLICE_EMERGENCY_NOTE }),
  equipment("policia cientifica", 145, "Polícia Científica", [
    "policia cientifica do parana", "unidade de execucao tecnico cientifica",
    "unidades de execucao tecnico cientifica",
  ], { note: POLICE_SCIENTIFIC_NOTE, leadNote: POLICE_EMERGENCY_NOTE }),
  // Instituto de Identificação do Paraná, added in v0.50.0 (read on 2026-11-25: 12 records). No bare "identidade",
  // "documento" or "cin" alias.
  equipment("instituto de identificacao", 168, "Instituto de Identificação do Paraná", [
    "instituto de identificacao do parana", "rg", "carteira de identidade", "carteira de identidade nacional",
    "posto de identificacao",
    "postos de identificacao",
  ], { note: IDENTIFICATION_NOTE, leadNote: IDENTIFICATION_LEAD_NOTE }),
  // Registro civil, Junta Militar, Defensoria Pública and Fórum, added in v0.51.0 (read on 2026-11-26 UTC: 4, 3, 14
  // and 9 records). No bare "cartorio" (other kinds of cartório exist), "junta", "justica" or "tribunal" alias. Each
  // registry record ends with a "Cartório <surname>." line, a person's name: replaced by a marker (isRegistryNameLine).
  equipment("cartorio de registro civil", 99, "Cartório de Registro Civil", [
    "cartorios de registro civil", "registro civil", "cartorio de registro civil das pessoas naturais",
    "cartorios de registro civil das pessoas naturais", "certidao de nascimento", "certidao de casamento",
    "certidao de obito",
  ], { note: CIVIL_REGISTRY_NOTE, hideLine: isRegistryNameLine }),
  equipment("junta militar", 21, "Junta de Serviço Militar", [
    "juntas militares", "junta de servico militar", "juntas de servico militar", "alistamento militar",
  ], { note: MILITARY_BOARD_NOTE, wrapLines: true }),
  equipment("defensoria publica", 105, "Defensoria Pública", [
    "defensoria", "defensorias", "defensorias publicas", "defensoria publica do parana", "defensoria publica do estado",
  ], { note: PUBLIC_DEFENDER_NOTE, wrapLines: true }),
  equipment("forum", 106, "Fórum", ["foruns"], { note: COURTHOUSE_NOTE, wrapLines: true }),
  // v0.52.0.
  social("creas", 38, "Centro de Referência Especializado de Assistência Social", [
    "centro de referencia especializado de assistencia social", "centros de referencia especializados de assistencia social",
  ], CREAS_NOTE),
  social("centro pop", 40, "Centro POP", [
    "centros pop", "centro de referencia especializado para populacao em situacao de rua",
  ], STREET_CENTRE_NOTE),
  social("central de encaminhamento social", 39, "Central de Encaminhamento Social", [
    "central de encaminhamento social 24 horas", "centrais de encaminhamento social",
  ], SOCIAL_REFERRAL_NOTE),
  social("centro de atividades para idosos", 36, "Centro de Atividades para Idosos", [
    "centros de atividades para idosos", "espaco conviver", "espacos conviver",
  ], ELDERLY_CENTRE_NOTE),
  {
    ...social("centro de referencia da mulher", 108, "Centro de Referência de Atendimento à Mulher", [
      "centros de referencia da mulher", "centro de referencia de atendimento a mulher",
      "centros de referencia de atendimento a mulher", "casa da mulher brasileira",
    ], WOMEN_CENTRE_NOTE),
    leadNote: WOMEN_EMERGENCY_NOTE,
    privateAddress: true,
  },
  social("centro de referencia afro", 109, "Centro de Referência Afro", ["centros de referencia afro"], AFRO_CENTRE_NOTE),
  // v0.53.0. No bare "escola" or "creche".
  equipment("escola municipal", 80, "Escola Municipal", ["escolas municipais"], { note: SCHOOL_NOTE }),
  equipment("cmei", 78, "Centro Municipal de Educação Infantil", ["cmeis", "centro municipal de educacao infantil", "creche municipal"], { note: SCHOOL_NOTE }),
  equipment("cmaee", 81, "Centro Municipal de Atendimento Educacional Especializado", ["cmaees", "centro municipal de atendimento educacional especializado"], {
    note: SCHOOL_NOTE,
    wrapLines: true,
  }),
  equipment("cei contratado", 79, "Centro de Educação Infantil (contratado)", ["ceis contratados", "centro de educacao infantil contratado", "creche contratada"], {
    note: CEI_NOTE,
    hideLine: isMaintainerLine,
    hiddenLineMarker: HIDDEN_MAINTAINER_LINE,
    nameLines: "maintainer",
  }),
  equipment("cemiterio", 114, "Cemitério Municipal", ["cemiterios", "cemiterio municipal"]),
  equipment("cras", 34, "Centro de Referência de Assistência Social", ["centro de referencia de assistencia social"], HIDE_SHELTER),
  equipment("conselho tutelar", 68, "Conselho Tutelar", ["conselhos tutelares"]),
  equipment("posto urbs", 156, "Posto de Atendimento URBS", ["posto de atendimento urbs", "urbs"]),
  equipment("informacoes turisticas", 162, "Posto de Informações Turísticas", ["posto de informacoes turisticas", "turismo"]),
  // Bus terminals, added in v0.27.0 (read on 2026-11-24: 22 and 1 records). `observacao` lists the integrated lines
  // (Pinheirinho: 65 lines), so up to 80 lines are kept.
  equipment("terminal", 157, "Terminal Urbano", ["terminais", "terminal urbano", "terminal de onibus", "terminais de onibus"], { maxHourLines: 80 }),
  equipment("terminal metropolitano", 158, "Terminal Metropolitano", ["terminais metropolitanos", "guadalupe"], { maxHourLines: 80 }),
  // Rodoferroviária and administrações regionais, added in v0.58.0 (read on 2026-11-26 UTC: 1, 1 and 10 records). No
  // bare "regional", "terminal" (the urban bus terminals) or "trem" alias.
  equipment("rodoviaria", 159, "Terminal Rodoviário", [
    "rodoferroviaria", "rodoviaria de curitiba", "rodoferroviaria de curitiba", "terminal rodoviario",
    "terminal rodoviario de curitiba",
  ], { note: BUS_STATION_NOTE }),
  equipment("ferroviaria", 160, "Terminal Ferroviário", [
    "terminal ferroviario", "terminal ferroviario de curitiba", "estacao ferroviaria",
  ], { note: RAIL_STATION_NOTE }),
  equipment("administracao regional", 15, "Administração Regional", [
    "administracoes regionais", "administracao regional de curitiba", "sede da regional",
  ], { note: REGIONAL_OFFICE_NOTE, wrapLines: true, ...HIDE_PERSON }),
  // COHAB agencies, added in v0.59.0 (read on 2026-11-26 UTC: 9 records, no line naming a person; hidden if one comes).
  equipment("cohab", 29, "Agência de Atendimento da COHAB", [
    "cohab ct", "cohab curitiba", "agencia da cohab", "agencias da cohab", "agencia de atendimento da cohab",
    "agencias de atendimento da cohab",
  ], { note: COHAB_NOTE, ...HIDE_PERSON }),
  // Food security, added in v0.60.0 (read on 2026-11-26 UTC: layers 7, 9, 10 and 1; 4, 233 (56 community), 3, 10).
  equipment("mesa solidaria", 7, "Mesa Solidária", ["mesas solidarias", "mesa solidaria curitiba"], { note: MESA_SOLIDARIA_NOTE, wrapLines: true, ...HIDE_PERSON }),
  equipment("horta comunitaria", 9, "Horta Comunitária Urbana", [
    "hortas comunitarias", "horta comunitaria urbana", "hortas comunitarias urbanas", "horta urbana", "hortas urbanas",
  ], { where: "tipo_equi = 'Horta Comunitária Urbana'", note: COMMUNITY_GARDEN_NOTE, hideLine: isGardenPersonLine, hiddenLineMarker: HIDDEN_PERSON_LINE, nameLines: "person", allowlist: true }),
  equipment("fazenda urbana", 10, "Fazenda Urbana", ["fazendas urbanas"], { note: URBAN_FARM_NOTE, ...HIDE_PERSON }),
  equipment("nucleo de seguranca alimentar", 1, "Núcleo Regional de Segurança Alimentar e Nutricional", [
    "nucleos de seguranca alimentar", "nucleo regional de seguranca alimentar", "nucleos regionais de seguranca alimentar",
    "nucleo regional de seguranca alimentar e nutricional", "nucleos regionais de seguranca alimentar e nutricional",
  ], { note: FOOD_SECURITY_OFFICE_NOTE, ...HIDE_PERSON }),
  // Work, added in v0.64.0 (read on 2026-11-26 UTC: layers 150, 151, 149 and 152; 12, 1, 16 and 4 records).
  equipment("sine", 150, "Unidade de Atendimento SINE", [
    "sine municipal", "sine curitiba", "unidade do sine", "unidades do sine", "unidade de atendimento sine",
    "unidades de atendimento sine", "agencia do sine",
  ], { note: SINE_NOTE, ...HIDE_PERSON }),
  equipment("agencia do trabalhador", 151, "Agência do Trabalhador", [
    "agencias do trabalhador", "agencia do trabalhador de curitiba",
  ], { note: WORKER_AGENCY_NOTE, ...HIDE_PERSON }),
  equipment("liceu de oficios", 149, "Liceu de Ofícios", ["liceu", "liceus", "liceus de oficios", "liceu de oficio"], {
    note: LICEU_NOTE, wrapLines: true, ...HIDE_PERSON,
  }),
  equipment("inss", 152, "Agência da Previdência Social (INSS)", [
    "agencia do inss", "agencias do inss", "agencia da previdencia social", "agencias da previdencia social",
    "previdencia social",
  ], { leadNote: INSS_LEAD_NOTE, note: INSS_NOTE, ...HIDE_PERSON }),
  // Voting places, added in v0.27.0 (BaseTematica layer 12, 422 records, data_alteracao 31/08/2026 when read).
  {
    id: "local de votacao",
    label: "Locais de Votação",
    aliases: ["locais de votacao", "votacao", "secao eleitoral", "secoes eleitorais", "onde votar"],
    kind: "voting",
    layerUrl: `${THEMATIC_SERVICE_URL}/12`,
    credit: VOTING_CREDIT,
    note: VOTING_NOTE,
  },
  {
    id: "parque",
    label: "Parques e Bosques",
    aliases: ["parques", "bosque", "bosques", "parques e bosques"],
    kind: "park",
    layerUrl: `${BIKE_SERVICE_URL}/1`,
  },
  // Conservation units added in v0.24.0. Layers 2, 3, 4 and 8 are already in "parque"; 7 (RPPNM, private land, often
  // named after people) is left out as personal data; 10 and 11 (APA, ARIE) lack the bairro and kind fields.
  conservation("estacao ecologica", 1, "Estação Ecológica", ["estacoes ecologicas"]),
  conservation("bosque de conservacao", 5, "Bosque de Conservação da Biodiversidade Urbana", [
    "bcbu", "bosques de conservacao", "bosque de conservacao da biodiversidade urbana",
  ]),
  conservation("refugio da vida silvestre", 6, "Refúgio da Vida Silvestre", ["refugio", "refugios da vida silvestre"]),
  {
    id: "ciclovia",
    label: "Estrutura Cicloviária",
    aliases: ["ciclovias", "ciclofaixa", "ciclofaixas", "estrutura cicloviaria"],
    kind: "bike",
    layerUrl: `${BIKE_SERVICE_URL}/0`,
  },
];

/** Words that ask for the list of types instead of a search. */
export const LIST_WORDS = ["list", "list types", "lista", "listar", "tipos", "listar tipos"];

/** The type for a name or alias (accents, case and punctuation ignored), or null. */
export function resolveType(input: string): FacilityType | null {
  const key = foldKey(input);
  return FACILITY_TYPES.find((t) => t.id === key || t.aliases.includes(key)) ?? null;
}

export function isListRequest(input: string): boolean {
  return LIST_WORDS.includes(foldKey(input));
}

/** Fields read from the urban-equipment layers; every other field (indfiscal, dep_admin, site...) is never asked for. */
const EQUIPMENT_FIELDS = [
  "objectid", "nome", "nome_completo", "nome_rua", "num_pred", "compl_end", "divulgar_endereco", "bairro", "regional",
  "func_manha", "func_tarde", "func_noite", "func_24hr", "telefone", "email", "dt_atualiz", "observacao",
].join(",");
const PARK_FIELDS = "objectid,nome,ctba_bairro,ctba_regional,ctba_tipounidprotinteg_smuc,areaoficial";
const BIKE_FIELDS = "objectid,nome,ctba_tipo_ciclovia,ctba_localizacao,ctba_bairro,ctba_regional,lenght_km,operacional";
/** Voting places: the place, never `num_eleitores` (number of voters) nor any other field. */
export const VOTING_FIELDS = "objectid,nome_local,endereco,bairro,regional,num_secoes,zona_eleitoral,data_alteracao";

/**
 * The one fixed URL read for a type: the whole layer (where 1=1), fixed fields, WGS84 (outSR=4326). Nothing from the
 * user's input (neighbourhood, coordinates) is ever sent: filtering happens in this server. (place_at_point's point
 * queries, below, send a point rounded to 4 decimals.)
 */
export function layerQueryUrl(t: FacilityType): string {
  const p = new URLSearchParams({ where: t.where ?? "1=1" });
  if (t.kind === "facility" || t.kind === "voting") {
    p.set("outFields", t.kind === "voting" ? VOTING_FIELDS : EQUIPMENT_FIELDS);
    p.set("returnGeometry", "true");
  } else if (t.kind === "park") {
    p.set("outFields", PARK_FIELDS);
    p.set("returnGeometry", "false");
    p.set("returnCentroid", "true");
  } else {
    p.set("outFields", BIKE_FIELDS);
    p.set("returnGeometry", "true");
    p.set("maxAllowableOffset", "0.00005");
    p.set("geometryPrecision", "5");
  }
  p.set("outSR", "4326");
  p.set("f", "json");
  return `${t.layerUrl}/query?${p.toString()}`;
}

/** Coded values of the bike and park layers' domains, as published on 2026-11-21 (codes are not contiguous). */
const BAIRROS: Record<number, string> = {
  1: "Centro", 2: "São Francisco", 3: "Centro Cívico", 4: "Alto da Glória", 5: "Alto da Rua XV", 6: "Cristo Rei",
  7: "Jardim Botânico", 8: "Rebouças", 9: "Água Verde", 10: "Batel", 11: "Bigorrilho", 12: "Mercês", 13: "Bom Retiro",
  14: "Ahú", 15: "Juvevê", 16: "Cabral", 17: "Hugo Lange", 18: "Jardim Social", 19: "Tarumã", 20: "Capão da Imbuia",
  21: "Cajuru", 22: "Jardim das Américas", 23: "Guabirotuba", 24: "Prado Velho", 25: "Parolin", 26: "Guaíra",
  27: "Portão", 28: "Vila Izabel", 29: "Seminário", 30: "Campina do Siqueira", 31: "Vista Alegre", 32: "Pilarzinho",
  33: "São Lourenço", 34: "Boa Vista", 35: "Bacacheri", 36: "Bairro Alto", 37: "Uberaba", 38: "Hauer", 39: "Fanny",
  40: "Lindóia", 41: "Novo Mundo", 42: "Fazendinha", 43: "Santa Quitéria", 44: "Campo Comprido", 45: "Mossunguê",
  46: "Santo Inácio", 47: "Cascatinha", 48: "São João", 49: "Taboão", 50: "Abranches", 51: "Cachoeira",
  52: "Barreirinha", 53: "Santa Cândida", 54: "Tingui", 55: "Atuba", 56: "Boqueirão", 57: "Xaxim", 58: "Capão Raso",
  59: "Orleans", 60: "São Braz", 61: "Butiatuvinha", 62: "Lamenha Pequena", 63: "Santa Felicidade",
  64: "Alto Boqueirão", 65: "Sítio Cercado", 66: "Pinheirinho", 67: "São Miguel", 68: "Augusta", 69: "Riviera",
  70: "Caximba", 71: "Campo de Santana", 72: "Ganchinho", 73: "Umbará", 74: "Tatuquara",
  75: "Cidade Industrial de Curitiba",
};
const REGIONAIS: Record<number, string> = {
  1: "Matriz", 2: "Boqueirão", 3: "Cajuru", 4: "Boa Vista", 5: "Santa Felicidade", 7: "Portão", 8: "Pinheirinho",
  10: "Bairro Novo", 11: "CIC", 12: "Tatuquara",
};
const BIKE_KINDS: Record<number, string> = {
  0: "Descaracterizada", 1: "Ciclovia", 2: "Ciclofaixa", 3: "Ciclofaixa (Via Calma)", 4: "Ciclofaixa Sobre a Calçada",
  5: "Passeio Compartilhado", 6: "Ciclorrota",
};
const PARK_KINDS: Record<number, string> = {
  1: "Estação Ecológica", 2: "Parque Natural Municipal", 3: "Reserva Biológica", 4: "Parque Linear",
  5: "Área Verde de Lazer", 6: "Bosque Municipal", 7: "Bosque de Conservação da Biodiversidade Urbana",
  8: "Refúgio da Vida Silvestre", 9: "Reserva Particular do Patrimônio Natural Municipal", 10: "Específicas",
};

export interface OpenPeriods {
  morning: boolean | null;
  afternoon: boolean | null;
  night: boolean | null;
  all_day: boolean | null;
}

export interface Facility {
  name: string;
  /** Park or bike-lane kind from the layer's domain; null for urban equipment. */
  kind: string | null;
  address: string | null;
  bairro: string | null;
  regional: string | null;
  /** `observacao` as published, one entry per line (days and hours, notes). */
  hours: string[];
  open_periods: OpenPeriods | null;
  phones: string[];
  emails: string[];
  /** dt_atualiz as YYYY-MM-DD (Curitiba time). */
  updated: string | null;
  length_km: number | null;
  area: string | null;
  /** Voting places only: número de seções and zona eleitoral as published; null for other types. */
  sections: number | null;
  electoral_zone: string | null;
  /** A point, a park's centroid, or null. */
  lat: number | null;
  lon: number | null;
  /** Bike segments only: the simplified line, [lon, lat] pairs; used for distance, never returned. */
  paths: [number, number][][] | null;
}

/** A record with `name` and the given fields; every other field empty. Key order is the output order. */
export const facility = (name: string, fields: Partial<Omit<Facility, "name">> = {}): Facility => ({
  name,
  kind: null,
  address: null,
  bairro: null,
  regional: null,
  hours: [],
  open_periods: null,
  phones: [],
  emails: [],
  updated: null,
  length_km: null,
  area: null,
  sections: null,
  electoral_zone: null,
  lat: null,
  lon: null,
  paths: null,
  ...fields,
});

export interface FacilityLayer {
  facilities: Facility[];
  /** Records left out: no name, (bike) not operational, or (social) naming a shelter. */
  skipped: number;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
/**
 * 8 to 11 digits with no separator ("Tel 33334444", "41999998888"): a phone the shared mask misses below 10 digits.
 * Format characters are removed first so an invisible character cannot split a run; coordinates are numeric fields
 * and never pass here.
 */
const GLUED_DIGITS = /(?<!\d)\d{8,11}(?!\d)/g;
/** cleanField (control and format characters, NFC, PII mask, cap) after masking glued digit runs. */
export function cleanText(raw: string, max: number): string {
  return cleanField(raw.replace(/\p{Cf}/gu, "").replace(GLUED_DIGITS, MASK), max);
}
const clean = (v: unknown, max: number): string | null => {
  const s = str(v);
  if (s === null) return null;
  const t = cleanText(s, max);
  return t === "" ? null : t;
};
const code = (v: unknown, map: Record<number, string>): string | null => (typeof v === "number" ? (map[v] ?? null) : null);
const yesNo = (v: unknown): boolean | null => (v === "Sim" ? true : v === "Não" ? false : null);

function inside(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ok = lat >= LAT_RANGE[0] && lat <= LAT_RANGE[1] && lon >= LON_RANGE[0] && lon <= LON_RANGE[1];
  return ok ? { lat, lon } : null;
}

/**
 * Institutional phone numbers only, formatted "(41) XXXX-XXXX", plus three-digit public service numbers ("156") and,
 * since v0.59.0, toll-free numbers ("0800 XXX XXXX", or "0800 XXX XXX" for six digits: a company's or public body's
 * line, never a person's own), however their digits are grouped.
 * A Curitiba landline (DDD 41 or none, 8 digits starting 2–5) is kept; a mobile or another DDD, and any part not
 * understood, is dropped: a mobile in this field can be a person's own number.
 */
export function institutionalPhones(raw: unknown): string[] {
  const s = str(raw);
  if (s === null) return [];
  const out: string[] = [];
  for (const part of s.split(/\s*[/;,]\s*|\s+ou\s+|\s+e\s+/i)) {
    // v0.60.0: "WhatsApp (41) 3350-3821" (the Mesa Solidária line) is a landline too; a WhatsApp mobile is still dropped.
    const p = part.trim().replace(/^(?:whats(?:app)?|zap)\s*[:\-–]?\s*/i, "");
    if (/^1\d{2}$/.test(p)) {
      out.push(p);
      continue;
    }
    if (/^0800(?:[-\s]?\d){6,7}$/.test(p)) {
      const d = p.replace(/\D/g, "");
      out.push(`0800 ${d.slice(4, 7)} ${d.slice(7)}`);
      continue;
    }
    if (!/^(?:\(41\)\s?)?\d{4}[-\s]?\d{4}$/.test(p)) continue;
    const d = p.replace(/\D/g, "").replace(/^41(?=\d{8}$)/, "");
    if (/^[2-5]\d{7}$/.test(d)) out.push(`(41) ${d.slice(0, 4)}-${d.slice(4)}`);
  }
  return [...new Set(out)].slice(0, MAX_PHONES);
}

const CITY_EMAIL = /^[a-z0-9][a-z0-9._-]{0,63}@(?:[a-z0-9-]{1,63}\.){0,3}curitiba\.pr\.gov\.br$/;

/** v0.67.0: a local part of two or more alphabetic words of 2+ letters joined by "." or "_" ("fulana.silva") is a person's. */
const PERSON_LOCAL = /^[a-z]{2,}(?:[._][a-z]{2,})+$/;
/** First words of such local parts that name a unit, not a person ("visa.boqueirao", "cras.cajuru"); kept. */
const UNIT_PREFIXES = new Set([
  "biblioteca", "caps", "casadepassagem", "ccz", "cei", "cmae", "cmaee", "cmei", "cras", "creas", "escola", "farol",
  "nrgm", "regional", "ruadacidadania", "sine", "ubs", "upa", "us", "visa",
]);

function isPersonShaped(email: string): boolean {
  const local = email.slice(0, email.indexOf("@"));
  return PERSON_LOCAL.test(local) && !UNIT_PREFIXES.has(local.split(/[._]/)[0]!);
}

/**
 * Institutional e-mails only: an address at curitiba.pr.gov.br or one of its subdomains. Any other domain (webmail,
 * universities, private companies, other governments, typos such as "gpv.br") is dropped: it can be a person's own.
 * Since v0.67.0 a city address shaped like a person's name (PERSON_LOCAL, unless UNIT_PREFIXES) is dropped too.
 */
export function institutionalEmails(raw: unknown): string[] {
  const s = str(raw);
  if (s === null) return [];
  const out = s
    .toLowerCase()
    .split(/[\s;,/]+/)
    .filter((e) => CITY_EMAIL.test(e) && !isPersonShaped(e));
  return [...new Set(out)].slice(0, MAX_EMAILS);
}

/**
 * A line longer than `max` split after its commas and semicolons into lines of at most `max` characters (a part longer than that
 * stays whole and is cut later). Phones, e-mails and CPFs hold no ", " or "; ", so no masked shape is split.
 */
export function wrapAtCommas(line: string, max: number): string[] {
  if (line.length <= max) return [line];
  const out: string[] = [];
  let cur = "";
  for (const part of line.trim().split(/(?<=[,;])\s+/)) {
    const next = cur === "" ? part : `${cur} ${part}`;
    if (next.length <= max || cur === "") cur = next;
    else {
      out.push(cur);
      cur = part;
    }
  }
  if (cur !== "") out.push(cur);
  return out;
}

/** Shown instead of a registry line that mentions the cartório (v0.51.0): never a silent cut. */
export const HIDDEN_NAME_LINE = "[a line about the cartório is not shown: it can carry a person's name or a notice; ask the office]";

/**
 * A registry line that may name a person (v0.51.0): any line that mentions "cartório" (any case, anywhere), like the
 * trade-name line "Cartório Taborda." every record ends with. When read, no other line mentioned it. A notice that
 * does ("Cartório Fechado.", "-Cartório Souza, plantão das 9h às 12h") is hidden too, visibly (HIDDEN_NAME_LINE), so no
 * surname is guessed past. A plain substring regex, linear; hourLines merges consecutive markers.
 */
export function isRegistryNameLine(line: string): boolean {
  return /cart[oó]rio/iu.test(line);
}

/** Shelter, transit house or confidential unit (v0.52.0); linear. */
export function isShelterLine(line: string): boolean {
  return /casas? de passagem|abrigo|albergue|pernoite|sigilos|casas? lar|casas? de acolhi|unidades? de acolhi|residencias? inclusivas?|acolhimento institucional/.test(
    fold(line).replace(/\p{Cf}/gu, "").replace(/[\s-]+/g, " "),
  );
}

/**
 * v0.60.0: a line after a CEI's "…:" label that is about the service, not a name (see hourLines `soft`): it starts
 * (after an optional dash) with a digit or a service word. Only the start counts: "Fulana de Tal, das 7h às 18h" is a
 * name.
 */
const SERVICE_PART = "atendimento|encaminhamento|funcionamento|horario|telefone|periodo|bercario|matricula|secretaria";
const SERVICE_WORD = "rua|av|avenida|fones?|vagas?";
const SERVICE_LINE = new RegExp(`^[-\\s]*(?:\\d|integral\\b|${SERVICE_PART}|(?:${SERVICE_WORD})\\b)`);
/** The rest of a split name after a hidden line is never a service line: any service word anywhere (v0.54.0 tail). */
const NOT_A_NAME = new RegExp(`^[-\\d]|:|^integral\\b|${SERVICE_PART}|\\b(?:${SERVICE_WORD})\\b`);

/**
 * `observacao` split into lines, each cleaned and masked (phones and e-mails inside it become "[masked]"). More than
 * `max` lines: the first max - 1 and a last line saying how many were not shown (never a silent cut).
 */
export function hourLines(
  raw: unknown,
  max: number = MAX_HOUR_LINES,
  wrap = false,
  hide?: (line: string) => boolean,
  marker: string = HIDDEN_NAME_LINE,
  names?: FacilityType["nameLines"],
  allowlist = false,
): string[] {
  const s = str(raw);
  if (s === null) return [];
  const lines: string[] = [];
  let label = false; // the last line was a hidden bare label ("Mantenedora:"): its value follows
  // v0.54.0, a type with nameLines only: one next line may end a split name (see docs/sources.md); a third line stays
  // visible.
  let rest = false;
  // v0.60.0, nameLines "maintainer" (CEI) only: the last line was a hidden "…:" label with no comma ("Diretora
  // responsável:"); the next line is hidden unless it starts with a digit or a service word (SERVICE_LINE):
  // "Responsável pela matrícula:" keeps "-2ª a 6ª 8h" and "Período parcial", and a name of any length after "Diretora
  // responsável:" is hidden.
  let soft = false;
  for (const line of s.split(/\r\n|\r|\n/)) {
    for (const part of wrap ? wrapAtCommas(line, LINE_MAX) : [line]) {
      const t = cleanText(part, LINE_MAX);
      if (t === "") continue;
      const tail: boolean = !allowlist && rest && !NOT_A_NAME.test(roleFold(t)) && (t.split(/[,\d]/)[0] ?? "").trim().split(/\s+/).length <= 4;
      const named = soft && !SERVICE_LINE.test(roleFold(t));
      if (!hide || !(label || named || tail || hide(t) || hide(cleanText(part, Infinity)))) {
        lines.push(t);
        label = rest = soft = false;
      } else {
        const m = names !== undefined;
        rest = m && (label || !tail) && !/\.$|\b(ltda|eireli|mei?)$/i.test(t);
        // v0.59.0: a hidden line ending in ':' with no comma ("Administrador Regional:") is a label too: for an office
        // its value, however long, follows; for a CEI (v0.60.0) see `soft`. "Responsável pelo atendimento, horário:"
        // is not a label: the hours after it stay.
        const colon: boolean = m && !label && /^[^,]*:$/.test(t);
        label = m ? MAINTAINER_LABEL.test(fold(t)) || (colon && names === "person") : t.endsWith(":") && !label;
        soft = colon && !label;
        if (lines[lines.length - 1] !== marker) lines.push(marker);
      }
    }
  }
  if (hide && !allowlist && !lines.includes(marker) && hide(s.replace(/\s+/g, " "))) return [marker];
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max - 1);
  return [...kept, `[${lines.length - kept.length} more lines not shown: ask the 156]`];
}

function updated(v: unknown): string | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? dateInCuritiba(new Date(v)) : null;
}

function privateRecord(name: string, a: Record<string, unknown>): Facility {
  return facility(name, { hours: [PRIVATE_ADDRESS_LINE], phones: institutionalPhones(a.telefone), updated: updated(a.dt_atualiz) });
}

function equipmentRecord(a: Record<string, unknown>, g: Record<string, unknown> | null, t: FacilityType): Facility | null {
  const name = clean(a.nome_completo, NAME_MAX) ?? clean(a.nome, NAME_MAX);
  if (name === null) return null;
  if (t.shelter && [a.nome_completo, a.nome, a.nome_rua, a.compl_end].some((v) => typeof v === "string" && isShelterLine(v))) return null;
  // The publisher marks whether the address may be shown; anything but "Sim" hides the address and the position.
  const show = a.divulgar_endereco === "Sim";
  if (!show && t.privateAddress) return privateRecord(name, a);
  const street = [str(a.nome_rua)?.trim(), str(a.num_pred)?.trim()].filter(Boolean).join(", ");
  const compl = str(a.compl_end)?.trim();
  const at = show && g ? inside(g.y, g.x) : null;
  const periods: OpenPeriods = {
    morning: yesNo(a.func_manha),
    afternoon: yesNo(a.func_tarde),
    night: yesNo(a.func_noite),
    all_day: yesNo(a.func_24hr),
  };
  return facility(name, {
    address: show ? clean(compl ? `${street} - ${compl}` : street, ADDRESS_MAX) : null,
    bairro: clean(a.bairro, 60),
    regional: clean(a.regional, 60),
    hours: hourLines(a.observacao, t.maxHourLines ?? MAX_HOUR_LINES, t.wrapLines === true, t.hideLine, t.hiddenLineMarker, t.nameLines, t.allowlist),
    open_periods: Object.values(periods).every((v) => v === null) ? null : periods,
    phones: institutionalPhones(a.telefone),
    emails: t.noEmails ? [] : institutionalEmails(a.email).filter((e) => !t.shelter || !/passagem|abrigo|albergue|acolhi|pernoite|sigilos/.test(e)),
    updated: updated(a.dt_atualiz),
    lat: at?.lat ?? null,
    lon: at?.lon ?? null,
  });
}

/** DD/MM/YYYY (data_alteracao) as YYYY-MM-DD; null when not a real date. */
export function dayMonthYear(v: unknown): string | null {
  const m = typeof v === "string" ? /^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/.exec(v) : null;
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

function votingRecord(a: Record<string, unknown>, g: Record<string, unknown> | null): Facility | null {
  const name = clean(a.nome_local, NAME_MAX);
  if (name === null) return null;
  const at = g ? inside(g.y, g.x) : null;
  const n = a.num_secoes;
  return facility(name, {
    address: clean(a.endereco, ADDRESS_MAX),
    bairro: clean(a.bairro, 60),
    regional: clean(a.regional, 60),
    updated: dayMonthYear(a.data_alteracao),
    sections: typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null,
    electoral_zone: clean(a.zona_eleitoral, 20),
    lat: at?.lat ?? null,
    lon: at?.lon ?? null,
  });
}

function parkRecord(a: Record<string, unknown>, centroid: Record<string, unknown> | null): Facility | null {
  const name = clean(a.nome, NAME_MAX);
  if (name === null) return null;
  const at = centroid ? inside(centroid.y, centroid.x) : null;
  return facility(name, {
    kind: code(a.ctba_tipounidprotinteg_smuc, PARK_KINDS),
    bairro: code(a.ctba_bairro, BAIRROS),
    regional: code(a.ctba_regional, REGIONAIS),
    area: clean(a.areaoficial, 40),
    lat: at?.lat ?? null,
    lon: at?.lon ?? null,
  });
}

function bikePaths(g: Record<string, unknown> | null): [number, number][][] | null {
  if (!g || !Array.isArray(g.paths)) return null;
  const paths: [number, number][][] = [];
  for (const path of g.paths as unknown[]) {
    if (!Array.isArray(path)) return null;
    const pts: [number, number][] = [];
    for (const p of path as unknown[]) {
      if (!Array.isArray(p)) return null;
      const at = inside(p[1], p[0]);
      if (at === null) return null;
      pts.push([at.lon, at.lat]);
    }
    if (pts.length > 0) paths.push(pts);
  }
  return paths.length > 0 ? paths : null;
}

function bikeRecord(a: Record<string, unknown>, g: Record<string, unknown> | null): Facility | null {
  if (a.operacional !== 1) return null;
  const kind = code(a.ctba_tipo_ciclovia, BIKE_KINDS);
  const where = clean(a.ctba_localizacao, ADDRESS_MAX);
  const name = clean(a.nome, NAME_MAX) ?? where ?? kind;
  if (name === null) return null;
  const paths = bikePaths(g);
  const first = paths?.[0]?.[0];
  const km = a.lenght_km;
  return facility(name, {
    kind,
    address: where,
    bairro: code(a.ctba_bairro, BAIRROS),
    regional: code(a.ctba_regional, REGIONAIS),
    length_km: typeof km === "number" && Number.isFinite(km) && km >= 0 ? Math.round(km * 1000) / 1000 : null,
    lat: first ? first[1] : null,
    lon: first ? first[0] : null,
    paths,
  });
}

/**
 * The JSON object of an ArcGIS answer (f=json), or source_unavailable: not JSON, not an object, an `error` object
 * (ArcGIS sends errors with HTTP 200; code 401/403, 498 invalid token or 499 token required is a final refusal and
 * blocks the host for 10 minutes), or, with `wgs84`, a spatial reference other than 4326.
 */
function arcgisAnswer(body: string, url: string, wgs84: boolean): Record<string, unknown> {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new SourceUnavailableError("invalid JSON");
  }
  if (!isObject(json)) throw new SourceUnavailableError("query error");
  if ("error" in json) {
    const code = isObject(json.error) ? json.error.code : undefined;
    if (code === 401 || code === 403 || code === 498 || code === 499) blockHost(url, code);
    throw new SourceUnavailableError("query error");
  }
  const sr = json.spatialReference;
  if (wgs84 && (!isObject(sr) || (sr.wkid !== 4326 && sr.latestWkid !== 4326))) throw new SourceUnavailableError("not WGS84");
  return json;
}

/**
 * Reads one ArcGIS query answer (f=json). Fails closed (source_unavailable) on anything that is not a complete WGS84
 * feature set: an `error` object (ArcGIS sends errors with HTTP 200), `exceededTransferLimit`, a spatial reference
 * other than 4326, no `features` array, or 2,000 records or more. An `error` with code 401, 403, 498 or 499 is a final
 * refusal: the host is blocked for 10 minutes (blockHost). Records without a name are skipped and counted.
 */
export function parseLayer(t: FacilityType, body: string, url: string = t.layerUrl): FacilityLayer {
  const json = arcgisAnswer(body, url, true);
  if (json.exceededTransferLimit === true) throw new SourceUnavailableError("layer cut by the record limit");
  if (!Array.isArray(json.features) || json.features.length >= MAX_RECORDS) throw new SourceUnavailableError("no features");
  const facilities: Facility[] = [];
  let skipped = 0;
  for (const f of json.features as unknown[]) {
    const a = isObject(f) && isObject(f.attributes) ? f.attributes : null;
    const geo = isObject(f) && isObject(f.geometry) ? f.geometry : null;
    const centroid = isObject(f) && isObject(f.centroid) ? f.centroid : null;
    const rec =
      a === null
        ? null
        : t.kind === "facility"
          ? equipmentRecord(a, geo, t)
          : t.kind === "voting"
            ? votingRecord(a, geo)
            : t.kind === "park"
              ? parkRecord(a, centroid)
              : bikeRecord(a, geo);
    if (rec === null) skipped++;
    else facilities.push(rec);
  }
  return { facilities, skipped };
}

const cache = new TtlCache(GEOCURITIBA_CACHE_TTL_MS);
/** Point answers: keys are `GET <url>` with the rounded point; at most 500 kept (user positions are unbounded). */
const pointCache = new TtlCache(GEOCURITIBA_CACHE_TTL_MS, () => Date.now(), 500);

/** At least this long between two requests to the GeoCuritiba host from this process (any layer). */
export const GEOCURITIBA_MIN_INTERVAL_MS = 5_000;
/** A call whose turn would come later than this gives up without a request (rate_limited with the wait). */
export const GEOCURITIBA_MAX_QUEUE_WAIT_MS = 10_000;

/** 5 s between requests, failures remembered 60 s to 1 hour (see createHostGate). */
const gate = createHostGate({ minIntervalMs: GEOCURITIBA_MIN_INTERVAL_MS, maxQueueWaitMs: GEOCURITIBA_MAX_QUEUE_WAIT_MS });

/** Tests only. */
export function clearGeoCuritibaCache(): void {
  cache.clear();
  stopPageCache.clear();
  pointCache.clear();
  gate.reset();
}

/** Body of one GET to the host, same host and path only on redirects; not JSON is source_unavailable. */
async function fetchJsonText(url: string): Promise<string> {
  const res = await fetchText(url, {
    timeoutMs: GEOCURITIBA_TIMEOUT_MS,
    maxBytes: GEOCURITIBA_MAX_BYTES,
    sameHostOnly: true,
    redirectPathPrefix: "/server/rest/services",
  });
  if (!/json/i.test(res.contentType)) throw new SourceUnavailableError("not JSON");
  return res.body;
}

/**
 * One GET of the type's fixed layer URL per cache period (6 hours), through the gate (5 s between requests to the host,
 * failures remembered); same host and path only on redirects. A cached layer makes no request and never waits.
 */
export function getFacilityLayer(t: FacilityType): Promise<Cached<FacilityLayer>> {
  const url = layerQueryUrl(t);
  return cache.getOrLoad(`GET ${url}`, () => gate.run(async () => {
    return parseLayer(t, await fetchJsonText(url), url);
  }));
}

// ---- Point queries: place_at_point (v0.22.0; service areas v0.23.0, one facade v0.32.0) ----

/** IPPUC's cadastral map service (the GeoCuritiba/ folder: the root-level name answers 499 "Token Required"). */
export const CADASTRAL_SERVICE_URL = `${SERVICES}/GeoCuritiba/Publico_GeoCuritiba_MapaCadastral/MapServer`;
/** IPPUC's Planta Genérica de Valores service (v0.65.0): layer 0 only (PGV 2025 micro-regions), never the lots. */
export const PGV_SERVICE_URL = `${SERVICES}/GeoCuritiba/Publico_GeoCuritiba_Planta_Generica_Valores/MapServer`;
/** Streets are looked for within this distance of the point. */
export const STREET_RADIUS_M = 100;

export type PointLayer =
  | "bairro"
  | "zoning_decree"
  | "zoning_law"
  | "street"
  | "pgv"
  | "health_area"
  | "cras_territory"
  | "pm_company"
  | "civil_district"
  | "fire_platoon"
  | "property_registry"
  | "civil_registry"
  | "electoral_zone"
  | "census_sector";

const ZONING_FIELDS = "sg_zona,nm_zona,legislacao,data_versao";
/** Service, layer id and fixed fields, read from the services on 2026-11-23 (see docs/sources.md). */
export const POINT_LAYERS: Record<PointLayer, { service: string; id: number; fields: string }> = {
  bairro: { service: CADASTRAL_SERVICE_URL, id: 2, fields: "nome,nm_regional" },
  zoning_decree: { service: CADASTRAL_SERVICE_URL, id: 41, fields: ZONING_FIELDS },
  zoning_law: { service: CADASTRAL_SERVICE_URL, id: 36, fields: ZONING_FIELDS },
  street: { service: CADASTRAL_SERVICE_URL, id: 12, fields: "gtm_nm_logradouro" },
  // v0.65.0, read on 2026-11-26: 1,062 micro-regions (PGV 2025). Never vukt or cod_vukt (a land unit value whose unit
  // and use the layer does not publish), never chave (it repeats these codes).
  pgv: { service: PGV_SERVICE_URL, id: 0, fields: "sg_zona,nm_zona,nm_bairro,cd_microbairro,cd_microrregiao" },
  health_area: { service: THEMATIC_SERVICE_URL, id: 19, fields: "nome,distrito,data,fonte,geometriaaproximada" },
  cras_territory: { service: THEMATIC_SERVICE_URL, id: 5, fields: "nome,tipo,regional,data,fonte,geometriaaproximada" },
  // v0.27.0, read on 2026-11-24: Polícia Militar companies (13 areas), Polícia Civil districts (13), fire platoons (9).
  pm_company: { service: THEMATIC_SERVICE_URL, id: 27, fields: "nm_batalhao,sg_batalhao,nm_companhia,sg_companhia,data_atualizacao,fonte" },
  civil_district: { service: THEMATIC_SERVICE_URL, id: 25, fields: "nm_divisao,nm_distrito,sg_distrito,fonte" },
  fire_platoon: { service: THEMATIC_SERVICE_URL, id: 41, fields: "batalhao,companhia,pelotao,sigla,fonte" },
  // v0.57.0, read on 2026-11-26: circunscrições imobiliárias (12 areas), registro civil serviços (19). Never nome,
  // created_user or last_edited_user (layer 15's editor fields hold user names).
  property_registry: { service: THEMATIC_SERVICE_URL, id: 15, fields: "circunscricao,fonte" },
  civil_registry: { service: THEMATIC_SERVICE_URL, id: 16, fields: "servicos,fonte" },
  // v0.66.0, read on 2026-11-27 UTC: 10 electoral zones (TRE-PR). Never num_eleitores (same rule as the voting places).
  electoral_zone: { service: THEMATIC_SERVICE_URL, id: 13, fields: "zona_eleitoral,num_locais,num_secoes,data_alteracao" },
  // IBGE 2022 census sector (3,190 sectors): never v0005, v0006 (household-level averages) or nm_fcu.
  census_sector: { service: THEMATIC_SERVICE_URL, id: 43, fields: "cd_setor,nm_bairro,v0001,v0007,area_km2,dens_pop_km2,renda_media" },
};

export interface Point {
  lat: number;
  lon: number;
}

/** True inside the loose box used for every GeoCuritiba coordinate (LAT_RANGE, LON_RANGE). */
export function inCuritibaBox(lat: number, lon: number): boolean {
  return inside(lat, lon) !== null;
}

/** 4 decimals (about 11 m): the only precision sent to the source, cached or returned. */
export function roundPoint(lat: number, lon: number): Point {
  const r = (v: number) => Math.round(v * 1e4) / 1e4;
  return { lat: r(lat), lon: r(lon) };
}

/**
 * The fixed point query of one layer: the rounded point is the only user input in the URL. The street layer also asks
 * for the lines within STREET_RADIUS_M in WGS84, so the nearest one is measured in this server.
 */
export function pointQueryUrl(layer: PointLayer, p: Point): string {
  const l = POINT_LAYERS[layer];
  const q = new URLSearchParams({
    geometry: `${p.lon},${p.lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: l.fields,
  });
  if (layer === "street") {
    q.set("distance", String(STREET_RADIUS_M));
    q.set("units", "esriSRUnit_Meter");
    q.set("returnGeometry", "true");
    q.set("outSR", "4326");
    q.set("geometryPrecision", "6");
  } else {
    q.set("returnGeometry", "false");
  }
  q.set("f", "json");
  return `${l.service}/${l.id}/query?${q.toString()}`;
}

export interface PointFeature {
  attributes: Record<string, unknown>;
  /** Street layer only: the line as [lon, lat] pairs inside the Curitiba box; null when absent or not understood. */
  paths: [number, number][][] | null;
}

/**
 * Reads a point query answer with parseLayer's fail-closed rules: an `error` object (ArcGIS sends errors with HTTP 200;
 * 401/403/498/499 block the host), `exceededTransferLimit`, no `features` array, or 2,000 records or more. A spatial
 * reference other than 4326 fails only when geometry was asked (answers without geometry carry none).
 */
export function parsePointQuery(body: string, url: string, withGeometry: boolean): PointFeature[] {
  const json = arcgisAnswer(body, url, withGeometry);
  if (json.exceededTransferLimit === true) throw new SourceUnavailableError("answer cut by the record limit");
  if (!Array.isArray(json.features) || json.features.length >= MAX_RECORDS) throw new SourceUnavailableError("no features");
  const out: PointFeature[] = [];
  for (const f of json.features as unknown[]) {
    if (!isObject(f) || !isObject(f.attributes)) continue;
    out.push({ attributes: f.attributes, paths: withGeometry ? streetPaths(isObject(f.geometry) ? f.geometry : null) : null });
  }
  return out;
}

/**
 * A street line as [lon, lat] pairs. Unlike bikePaths, a vertex outside the Curitiba box is kept (a road near the
 * point can run past the box); only a vertex that is not a valid WGS84 pair is dropped. Null when nothing is left.
 */
function streetPaths(g: Record<string, unknown> | null): [number, number][][] | null {
  if (!g || !Array.isArray(g.paths)) return null;
  const valid = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;
  const paths: [number, number][][] = [];
  for (const path of g.paths as unknown[]) {
    if (!Array.isArray(path)) continue;
    const pts: [number, number][] = [];
    for (const p of path as unknown[]) {
      if (Array.isArray(p) && valid(p[0], 180) && valid(p[1], 90)) pts.push([p[0], p[1]]);
    }
    if (pts.length > 0) paths.push(pts);
  }
  return paths.length > 0 ? paths : null;
}

/** cleanText for a point-layer field; null when absent or empty. */
export function cleanPointField(v: unknown, max: number): string | null {
  return clean(v, max);
}

/**
 * One point query through the same host gate as the layers (5 s between requests, failures remembered), cached 6 hours
 * by its URL. `startBy`: no request starts after it (OutOfTimeError).
 */
export function getPointLayer(layer: PointLayer, p: Point, startBy?: number): Promise<Cached<PointFeature[]>> {
  const url = pointQueryUrl(layer, p);
  return underOwnBudget(startBy, () => pointCache.getOrLoad(`GET ${url}`, () => gate.run(async () => {
    return parsePointQuery(await fetchJsonText(url), url, layer === "street");
  }, startBy === undefined ? {} : { startBy })));
}

// ---- Census 2022 by sector (place_at_point census, v0.27.0) ----

/**
 * The 75 neighbourhood names of the census layer (nm_bairro, IBGE spelling: "Botiatuvinha", "Tinguí"), read on
 * 2026-11-24. Only a name in this list is ever sent in a `where`.
 */
export const CENSUS_BAIRROS: readonly string[] = [
  "Abranches", "Ahú", "Alto Boqueirão", "Alto da Glória", "Alto da Rua XV", "Atuba", "Augusta", "Bacacheri",
  "Bairro Alto", "Barreirinha", "Batel", "Bigorrilho", "Boa Vista", "Bom Retiro", "Boqueirão", "Botiatuvinha", "Cabral",
  "Cachoeira", "Cajuru", "Campina do Siqueira", "Campo Comprido", "Campo de Santana", "Capão Raso", "Capão da Imbuia",
  "Cascatinha", "Caximba", "Centro", "Centro Cívico", "Cidade Industrial de Curitiba", "Cristo Rei", "Fanny",
  "Fazendinha", "Ganchinho", "Guabirotuba", "Guaíra", "Hauer", "Hugo Lange", "Jardim Botânico", "Jardim Social",
  "Jardim das Américas", "Juvevê", "Lamenha Pequena", "Lindóia", "Mercês", "Mossunguê", "Novo Mundo", "Orleans",
  "Parolin", "Pilarzinho", "Pinheirinho", "Portão", "Prado Velho", "Rebouças", "Riviera", "Santa Cândida",
  "Santa Felicidade", "Santa Quitéria", "Santo Inácio", "Seminário", "São Braz", "São Francisco", "São João",
  "São Lourenço", "São Miguel", "Sítio Cercado", "Taboão", "Tarumã", "Tatuquara", "Tinguí", "Uberaba", "Umbará",
  "Vila Izabel", "Vista Alegre", "Xaxim", "Água Verde",
];

/** The census sector layer's statistics: sums of persons, occupied private households and area, and the sector count. */
const CENSUS_STATISTICS = JSON.stringify([
  { statisticType: "sum", onStatisticField: "v0001", outStatisticFieldName: "persons" },
  { statisticType: "sum", onStatisticField: "v0007", outStatisticFieldName: "households" },
  { statisticType: "sum", onStatisticField: "area_km2", outStatisticFieldName: "area_km2" },
  { statisticType: "count", onStatisticField: "objectid", outStatisticFieldName: "sectors" },
]);

/**
 * The neighbourhood totals query over its sectors with at least `minHouseholds` occupied households (so a withheld
 * sector cannot be subtracted back), or null when the name is not one of CENSUS_BAIRROS (then nothing is sent).
 */
export function censusBairroUrl(name: string, minHouseholds: number): string | null {
  if (!CENSUS_BAIRROS.includes(name) || !Number.isInteger(minHouseholds) || minHouseholds < 0) return null;
  const where = `nm_bairro='${name.replace(/'/g, "''")}' AND v0007 >= ${minHouseholds}`;
  const q = new URLSearchParams({ where, outStatistics: CENSUS_STATISTICS, f: "json" });
  return `${THEMATIC_SERVICE_URL}/${POINT_LAYERS.census_sector.id}/query?${q.toString()}`;
}

export interface CensusTotals {
  persons: number | null;
  households: number | null;
  area_km2: number | null;
  sectors: number | null;
}

const count = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

/** One request per neighbourhood and cache period, through the same gate; null for a name not in the list. */
export function getCensusBairro(name: string, minHouseholds: number, startBy?: number): Promise<Cached<CensusTotals>> | null {
  const url = censusBairroUrl(name, minHouseholds);
  if (url === null) return null;
  return underOwnBudget(startBy, () => pointCache.getOrLoad(`GET ${url}`, () => gate.run(async () => {
    const rows = parsePointQuery(await fetchJsonText(url), url, false);
    if (rows.length !== 1) throw new SourceUnavailableError("no statistics");
    const a = rows[0]!.attributes;
    const area = a.area_km2;
    return {
      persons: count(a.persons),
      households: count(a.households),
      area_km2: typeof area === "number" && Number.isFinite(area) && area > 0 ? area : null,
      sectors: count(a.sectors),
    };
  }, startBy === undefined ? {} : { startBy })));
}

/** One call's point reads (place_at_point, v0.32.0): its point, its time budget and its turn at the host gate. */
export interface PointReads {
  layer(layer: PointLayer): Promise<Cached<PointFeature[]>>;
  /** Null for a neighbourhood name not in CENSUS_BAIRROS (nothing is sent). */
  censusBairro(name: string, minHouseholds: number): Promise<Cached<CensusTotals>> | null;
}

/**
 * Reads for one call: one request at a time, in the order the call's parts ask, so each request waits at most one gate
 * interval (never past GEOCURITIBA_MAX_QUEUE_WAIT_MS) and the parts' first layers are asked before their later ones.
 */
export function pointReads(p: Point, startBy: number): PointReads {
  let tail: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(read: () => Promise<T>): Promise<T> => {
    const turn = tail.then(read, read);
    tail = turn.catch(() => undefined);
    return turn;
  };
  return {
    layer: (layer) => inTurn(() => getPointLayer(layer, p, startBy)),
    censusBairro: (name, minHouseholds) =>
      censusBairroUrl(name, minHouseholds) === null ? null : inTurn(() => getCensusBairro(name, minHouseholds, startBy)!),
  };
}

// ---- URBS bus stops on GeoCuritiba (bus_stops_near without the local export, v0.29.0) ----

/**
 * URBS_Transporte_Publico layer 1 "Parada de Ônibus" (num, nome_ponto, lat, lon, tipo; 7,249 records, read on
 * 2026-11-24). No update date in the layer or service metadata. Layer 0 (terminals, with `indfiscal`) is never read.
 */
export const URBS_STOPS_LAYER_URL = `${SERVICES}/GeoCuritiba/URBS_Transporte_Publico/MapServer/1`;
/** Records per page: the service's maxRecordCount. */
export const URBS_STOPS_PAGE_SIZE = MAX_RECORDS;
/** Pages read at most (4 were needed on 2026-11-24); a last page still full fails closed instead of cutting. */
export const URBS_STOPS_MAX_PAGES = 5;

/** The fixed query of one page, ordered by objectid; no user input (the position is filtered in this server). */
export function urbsStopsPageUrl(page: number): string {
  const q = new URLSearchParams({
    where: "1=1",
    outFields: "num,nome_ponto,tipo",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "6",
    orderByFields: "objectid",
    resultOffset: String(page * URBS_STOPS_PAGE_SIZE),
    resultRecordCount: String(URBS_STOPS_PAGE_SIZE),
    f: "json",
  });
  return `${URBS_STOPS_LAYER_URL}/query?${q.toString()}`;
}

export interface LayerStop {
  /** `num` as digits. */
  num: string;
  name: string;
  /** `tipo` as published; "" when null. */
  type: string;
  lat: number;
  lon: number;
}

export interface StopsPage {
  stops: LayerStop[];
  /** Records left out: no positive integer `num`, no name, or no position inside the Curitiba box. */
  skipped: number;
  /** A full page: the next page must be read. */
  full: boolean;
}

/**
 * Reads one page with parseLayer's fail-closed rules (an `error` object, 401/403/498/499 block the host, a spatial
 * reference other than 4326, no `features` array, more than a page). `exceededTransferLimit` is expected on a full page
 * only: on a short page it fails closed.
 */
export function parseStopsPage(body: string, url: string): StopsPage {
  const json = arcgisAnswer(body, url, true);
  if (!Array.isArray(json.features) || json.features.length > URBS_STOPS_PAGE_SIZE) {
    throw new SourceUnavailableError("no features");
  }
  const full = json.features.length === URBS_STOPS_PAGE_SIZE;
  if (json.exceededTransferLimit === true && !full) throw new SourceUnavailableError("page cut by the record limit");
  const stops: LayerStop[] = [];
  let skipped = 0;
  for (const f of json.features as unknown[]) {
    const a = isObject(f) && isObject(f.attributes) ? f.attributes : null;
    const g = isObject(f) && isObject(f.geometry) ? f.geometry : null;
    const num = a?.num;
    const name = a === null ? null : clean(a.nome_ponto, NAME_MAX);
    const at = g === null ? null : inside(g.y, g.x);
    if (typeof num !== "number" || !Number.isSafeInteger(num) || num <= 0 || name === null || at === null) {
      skipped++;
      continue;
    }
    stops.push({ num: String(num), name, type: clean(a?.tipo, 100) ?? "", lat: at.lat, lon: at.lon });
  }
  return { stops, skipped, full };
}

export interface UrbsStopsLayer {
  /** One per `num`, the first record in objectid order. */
  stops: LayerStop[];
  skipped: number;
  /** Records whose `num` was already read (one on 2026-11-24). */
  duplicates: number;
  /** When the oldest page used was read (ISO). */
  fetchedAt: string;
  pages: number;
}

/** More than 1 record in this many (5%) without a usable `num`, name or position: the layer is refused (shape changed). */
export const URBS_STOPS_MAX_SKIPPED_ONE_IN = 20;
/**
 * Pages are kept this long for a call stopped by its time budget to resume from; the assembled layer is kept 6 hours.
 * So one answer never joins pages read more than this far apart (offset paging over a layer edited in between could
 * miss or repeat stops).
 */
export const URBS_STOPS_PAGE_TTL_MS = 10 * 60 * 1000;
const stopPageCache = new TtlCache(URBS_STOPS_PAGE_TTL_MS);

/**
 * Every page of the stop layer, read one after another through the GeoCuritiba gate (5 s between requests, failures
 * remembered), assembled once and cached 6 hours. A call stopped by its time budget (`startBy`, OutOfTimeError) leaves
 * the pages it read in a 10-minute page cache, so the next call resumes from them. Never answers from part of the
 * layer: a fifth full page, no stop at all, or more than 5% of records skipped fails closed.
 */
export function getUrbsStops(startBy?: number): Promise<Cached<UrbsStopsLayer>> {
  return underOwnBudget(startBy, () => cache.getOrLoad(`GET ${URBS_STOPS_LAYER_URL} (all pages)`, async () => {
    const byNum = new Map<string, LayerStop>();
    let skipped = 0;
    let duplicates = 0;
    let fetchedAt: string | null = null;
    for (let page = 0; page < URBS_STOPS_MAX_PAGES; page++) {
      const url = urbsStopsPageUrl(page);
      const res = await stopPageCache.getOrLoad(`GET ${url}`, () => gate.run(async () => {
        return parseStopsPage(await fetchJsonText(url), url);
      }, startBy === undefined ? {} : { startBy }));
      if (fetchedAt === null || res.fetchedAt < fetchedAt) fetchedAt = res.fetchedAt;
      skipped += res.value.skipped;
      for (const s of res.value.stops) {
        if (byNum.has(s.num)) duplicates++;
        else byNum.set(s.num, s);
      }
      if (res.value.full) continue;
      const records = byNum.size + duplicates + skipped;
      if (byNum.size === 0 || skipped * URBS_STOPS_MAX_SKIPPED_ONE_IN > records) {
        throw new SourceUnavailableError("stop layer shape changed");
      }
      return { stops: [...byNum.values()], skipped, duplicates, fetchedAt, pages: page + 1 };
    }
    throw new SourceUnavailableError("more stops than expected");
  }));
}
