// The offline "world" of the citizen eval (test/eval/citizen-questions.json): one fixed clock, one temporary data
// folder and, per tool, the stubbed routes its arguments reach. Synthetic fixtures only; nothing here reaches the
// network (test/setup.ts fails any request a route does not cover).
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePhonesPage } from "../../scripts/fetch-events.mjs";
import { STATIONS, stationDataUrl } from "../../src/sources/ana.js";
import { censusBairroUrl, layerQueryUrl, pointQueryUrl, resolveType, roundPoint, type PointLayer } from "../../src/sources/geocuritiba.js";
import { listingPageUrl, ROBOTS_URL } from "../../src/sources/guaira.js";
import { VACCINATION_URL } from "../../src/sources/imunizaja.js";
import { ALIQUOTA_MUNICIPIO_URL, ALIQUOTA_UF_URL, ALIQUOTA_UNIAO_URL, CLASS_TRIB_URL, NBS_URL, NCM_URL, VERSAO_URL } from "../../src/sources/receita.js";
import { PHONES_SOURCE_URL } from "../../src/tools/usefulPhones.js";
import { fixture, happyRoutes, pncpSearchRoutes, type Route } from "../helpers.js";

/** The eval's one clock: 02:50 on 2026-11-22 in Curitiba, 50 minutes after the ANA fixtures' latest reading. */
export const NOW = Date.parse("2026-11-22T05:50:00Z");
/** The date in Curitiba at NOW (UTC-3, no daylight saving). */
export const TODAY = "2026-11-22";

const JSON_TYPE = "application/json";
const GEO_JSON = "application/json; charset=UTF-8";
const HTML = "text/html; charset=UTF-8";
const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url));

type Args = Record<string, unknown>;

/** City facility types the fixtures cover (the name the tool resolves → fixture file). */
const FACILITY_FIXTURES: Record<string, string> = {
  feira: "feira.json",
  parque: "parques.json",
  "rua da cidadania": "rua_da_cidadania.json",
  ciclovia: "ciclovia.json",
  "centro cultural": "centro_cultural_synthetic.json",
  "estacao ecologica": "estacao_ecologica_synthetic.json",
  "local de votacao": "local_de_votacao_synthetic.json",
  velodromo: "velodromo_synthetic.json",
  teatro: "teatro.json",
  "unidade de saude": "unidade_de_saude_synthetic.json",
};

/** Invented events (titles, places and addresses made up), dated around NOW. */
const EVENTS = [
  { id: 1, title: "Feira de Natal Sintética", start_date: "2026-11-20", end_date: "2026-12-23", place: "Praça Imaginária", category: "Natal" },
  { id: 2, title: "Concerto Fictício de Primavera", start_date: "2026-11-27", end_date: "2026-11-27", place: "Teatro Inventado", category: "Música" },
  { id: 3, title: "Oficina Inventada de Leitura", start_date: "2026-11-24", end_date: "2026-11-24", place: "Biblioteca Exemplo", category: "Literatura" },
  { id: 4, title: "Corrida Sintética do Parque", start_date: "2026-11-29", end_date: "2026-11-29", place: "Parque Exemplo", category: "Esporte" },
].map((e) => ({
  ...e,
  time: "19h.",
  address: "Rua Inventada, 1, Centro",
  link: `https://turismo.curitiba.pr.gov.br/evento/evento-sintetico-${e.id}/${e.id}`,
}));

/**
 * A temporary CURITIBAI_DATA_DIR with every local file the tools read: the synthetic Carta copy, the URBS exports
 * under the dated names the tools look for, the phones and events files the collector would write (built here: those
 * folders are never tracked) and the synthetic CSV.
 */
export function buildDataDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-eval-")));
  copyFileSync(join(FIXTURES, "carta_servicos_synthetic", "carta-servicos.json"), join(dir, "carta-servicos.json"));
  mkdirSync(join(dir, "urbs"));
  for (const kind of ["linhas", "pontosLinha", "tabelaLinha", "pois"]) {
    copyFileSync(join(FIXTURES, "urbs_synthetic", `${kind}.json`), join(dir, "urbs", `2026_11_20_${kind}.json`));
  }
  copyFileSync(join(FIXTURES, "csv", "synthetic_sample.csv"), join(dir, "synthetic_sample.csv"));
  const checkedAt = new Date(NOW - 3_600_000).toISOString();
  const entries = parsePhonesPage(readFileSync(join(FIXTURES, "useful_phones", "telefones_uteis_trimmed.html"), "utf8")).entries;
  mkdirSync(join(dir, "phones"));
  writeFileSync(
    join(dir, "phones", "phones.json"),
    JSON.stringify({ format: 1, source: PHONES_SOURCE_URL, checked_at: checkedAt, count: entries.length, dropped: 0, entries }),
  );
  mkdirSync(join(dir, "events"));
  writeFileSync(
    join(dir, "events", "events.json"),
    JSON.stringify({
      format: 1,
      source: "https://turismo.curitiba.pr.gov.br/eventos/",
      checked_at: checkedAt,
      list_date: TODAY,
      count: EVENTS.length,
      events: EVENTS,
    }),
  );
  return dir;
}

/** place_at_point layers: synthetic answers with each layer's real fields (as test/placeFacade.test.ts). */
const attrs = (list: Record<string, unknown>[]) => JSON.stringify({ features: list.map((attributes) => ({ attributes })) });
const CENSUS_BAIRRO = "Centro";
function pointRoutes(lat: number, lon: number): Record<string, Route> {
  const p = roundPoint(lat, lon);
  const bodies: Record<PointLayer, string> = {
    bairro: attrs([{ nome: "CENTRO", nm_regional: "MATRIZ" }]),
    zoning_decree: attrs([{ sg_zona: "ZC", nm_zona: "ZONA CENTRAL", legislacao: "DECRETO TESTE", data_versao: "2020-08" }]),
    zoning_law: attrs([]),
    street: JSON.stringify({
      spatialReference: { wkid: 4326 },
      features: [{ attributes: { gtm_nm_logradouro: "RUA TESTE" }, geometry: { paths: [[[p.lon + 0.0001, p.lat - 0.001], [p.lon + 0.0001, p.lat + 0.001]]] } }],
    }),
    health_area: attrs([{ nome: "US TESTE", distrito: "DISTRITO TESTE", data: "março/2022", fonte: "SMS-PMC", geometriaaproximada: 0 }]),
    cras_territory: attrs([{ nome: "CRAS TESTE", tipo: "CRAS", regional: "MATRIZ", data: "MAR-2019", fonte: "FAS", geometriaaproximada: 0 }]),
    pm_company: attrs([{ nm_batalhao: "99º Batalhão", sg_batalhao: "99º BPM", nm_companhia: "1ª Companhia", sg_companhia: "1ª CIA", data_atualizacao: "09/2025", fonte: "PMPR TESTE" }]),
    civil_district: attrs([{ nm_divisao: "Divisão Teste", nm_distrito: "99º Distrito Policial", sg_distrito: "99º DP", fonte: "PCPR TESTE" }]),
    fire_platoon: attrs([{ batalhao: "Batalhão Teste", companhia: "Companhia Teste", pelotao: "Pelotão Teste", sigla: "9ª Pel. BM", fonte: "CBMPR TESTE" }]),
    census_sector: attrs([{ cd_setor: "410690205010084", nm_bairro: CENSUS_BAIRRO, v0001: 231, v0007: 129, area_km2: 0.19, dens_pop_km2: 1229.99, renda_media: 4583.33 }]),
  };
  const out: Record<string, Route> = {};
  const totals = censusBairroUrl(CENSUS_BAIRRO, 20);
  if (totals) out[`GET ${totals}`] = { contentType: GEO_JSON, body: attrs([{ persons: 5008, households: 2395, area_km2: 1.3, sectors: 12 }]) };
  for (const layer of Object.keys(bodies) as PointLayer[]) out[`GET ${pointQueryUrl(layer, p)}`] = { contentType: GEO_JSON, body: bodies[layer] };
  return out;
}

const RIVER_FIXTURES: Record<string, string> = { "65010000": "ana/65010000_fazendinha.xml", "65019980": "ana/65019980_ete_araucaria.xml" };
/** Every bundled station answers: the two with fixtures their readings, the others "no recent data". */
function riverRoutes(): Record<string, Route> {
  const out: Record<string, Route> = {};
  for (const s of STATIONS) {
    const file = RIVER_FIXTURES[s.code];
    const body = file ? fixture(file) : fixture("ana/02549127_no_data.xml").replace("Código: 02549127", `Código: ${s.code}`);
    out[`GET ${stationDataUrl(s.code, NOW)}`] = { body, contentType: "text/xml; charset=utf-8" };
  }
  return out;
}

function guairaRoutes(): Record<string, Route> {
  const event = (slug: string) => `https://www.teatroguaira.pr.gov.br/Evento/${slug}`;
  const out: Record<string, Route> = {
    [`GET ${ROBOTS_URL}`]: { body: fixture("guaira/robots.txt"), contentType: "text/plain" },
    [`GET ${event("Muito-Barulho-por-Nada-Teatro-de-Comedia-do-Parana")}`]: { body: fixture("guaira/event_muito_barulho.html"), contentType: HTML },
  };
  for (const n of [0, 1, 2]) out[`GET ${listingPageUrl(n)}`] = { body: fixture(`guaira/list_page${n}.html`), contentType: HTML };
  return out;
}

function receitaRoutes(args: Args): Record<string, Route> {
  const date = (args.date as string | undefined) ?? TODAY;
  const json = (body: unknown): Route => ({ body: JSON.stringify(body), contentType: JSON_TYPE });
  const file = (name: string): Route => ({ body: fixture(`receita/${name}`), contentType: JSON_TYPE });
  return {
    [`GET ${VERSAO_URL}`]: file("versao.json"),
    [`GET ${ALIQUOTA_UNIAO_URL(date)}`]: json({ aliquotaReferencia: 0.9 }),
    [`GET ${ALIQUOTA_UF_URL(date)}`]: json({ aliquotaReferencia: 0.1 }),
    [`GET ${ALIQUOTA_MUNICIPIO_URL(date)}`]: json({ aliquotaReferencia: 0.0 }),
    [`GET ${NBS_URL(date)}`]: file("nbs_lista.json"),
    [`GET ${NCM_URL(date)}`]: file("ncm_vigentes.json"),
    [`GET ${CLASS_TRIB_URL(date)}`]: file("class_trib.json"),
  };
}

/** The stubbed routes a call of `tool` with `args` may reach. Local-only tools get none. */
export function routesFor(tool: string, args: Args): Record<string, Route> {
  switch (tool) {
    case "open_datasets_search":
    case "dataset_files":
    case "health_units_search":
    case "weather_forecast":
    case "weather_alerts":
    case "places_search":
      return happyRoutes();
    case "procurement_search":
      return typeof args.query === "string" ? pncpSearchRoutes(args.query, (args.modality as number | undefined) ?? 6) : happyRoutes();
    case "vaccination_sites_search":
      return { [`GET ${VACCINATION_URL}`]: { body: fixture("imunizaja_locais_synthetic.html") } };
    case "city_facilities_search": {
      const t = typeof args.type === "string" ? resolveType(args.type) : null;
      const file = Object.entries(FACILITY_FIXTURES).find(([name]) => resolveType(name) === t)?.[1];
      return t && file ? { [`GET ${layerQueryUrl(t)}`]: { body: fixture(`geocuritiba/${file}`), contentType: GEO_JSON } } : {};
    }
    case "river_levels":
      return riverRoutes();
    case "guaira_events":
      return guairaRoutes();
    case "tax_reform_curitiba":
      return receitaRoutes(args);
    case "place_at_point":
      return pointRoutes(args.lat as number, args.lon as number);
    default:
      return {};
  }
}
