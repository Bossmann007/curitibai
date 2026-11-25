import { fold } from "../text.js";

/**
 * The Prefeitura's Linha Turismo boarding points, as listed on its "Onde Embarcar" page. Bundled: the server never
 * contacts this host. The page's own attractions list ("/atracoes-turisticas") answered "Nenhuma atração turística foi
 * encontrada" when read, so the boarding points are the official list of attractions used here.
 */
export const TOUR_SOURCE_URL = "https://linhaturismo.curitiba.pr.gov.br/onde-embarcar";
export const TOUR_CHECKED_AT = "2026-11-25T05:20:00Z";
export const TOUR_CREDIT = "Linha Turismo, Prefeitura de Curitiba (onde embarcar)";
export const TOUR_TYPE_ID = "ponto turistico";
export const TOUR_LABEL = "Pontos turísticos (paradas da Linha Turismo)";
export const TOUR_ALIASES = [
  "pontos turisticos",
  "ponto turistico",
  "atracao turistica",
  "atracoes turisticas",
  "linha turismo",
  "linha de turismo",
];

/** A city_facilities_search call that gives the stop's address, hours as published and phone; null when no layer has it. */
export interface TourLookup {
  type: string;
  name: string;
}

export interface TourStop {
  /** The stop's name as published on the page, in page order (upper case and abbreviations kept). */
  name: string;
  lookup: TourLookup | null;
}

/**
 * The 25 stops in page order, read on 2026-11-25. `lookup` was matched by hand to one record of the named GeoCuritiba
 * layer on the same day (test/linhaTurismo.test.ts keeps every lookup type valid); null where no layer of the tool holds
 * the place (streets, squares, neighbourhoods).
 */
export const TOUR_STOPS: readonly TourStop[] = [
  { name: "RUA 24 HORAS", lookup: null },
  { name: "MUSEU FERROVIARIO", lookup: { type: "museu", name: "ferroviario" } },
  { name: "TEATRO PAIOL", lookup: { type: "teatro", name: "paiol" } },
  { name: "PARQUE JARDIM BOTANICO", lookup: { type: "parque", name: "jardim botanico" } },
  { name: "MUSEU OSCAR NIEMEYER", lookup: { type: "museu", name: "museu oscar niemeyer" } },
  { name: "MERC.MUNICIPAL/RODOFERROVIARIA", lookup: { type: "mercado municipal", name: "mercado municipal de curitiba" } },
  { name: "PRACA TIRADENTES", lookup: null },
  { name: "TEATRO GUAIRA/UNIV.FEDERAL PR", lookup: { type: "teatro", name: "teatro guaira" } },
  { name: "RUA DAS FLORES", lookup: null },
  { name: "BOSQUE ALEMAO", lookup: { type: "parque", name: "bosque alemao" } },
  { name: "PACO DA LIBERDADE", lookup: null },
  { name: "UNIV.LIVRE DO MEIO AMBIENTE", lookup: { type: "parque", name: "bosque zaninelli" } },
  { name: "MEMORIAL ARABE", lookup: { type: "memorial", name: "arabe" } },
  { name: "CENTRO CIVICO", lookup: null },
  { name: "PQ.SAO LOURENCO (SENT.BARREIRINHA)", lookup: { type: "parque", name: "sao lourenco" } },
  { name: "BOSQUE DO PAPA", lookup: { type: "memorial", name: "polonesa" } },
  { name: "OPERA DE ARAME", lookup: { type: "teatro", name: "opera de arame" } },
  { name: "PARQUE TANGUA", lookup: { type: "parque", name: "tangua" } },
  { name: "PARQUE TINGUI", lookup: { type: "parque", name: "tingui" } },
  { name: "MEMORIAL UCRANIANO", lookup: { type: "memorial", name: "ucraniana" } },
  { name: "PORTAL ITALIANO", lookup: null },
  { name: "SANTA FELICIDADE", lookup: null },
  { name: "PARQUE BARIGUI", lookup: { type: "parque", name: "barigui" } },
  { name: "TORRE PANORAMICA", lookup: { type: "informacoes turisticas", name: "torre panoramica" } },
  { name: "SETOR HISTORICO", lookup: { type: "informacoes turisticas", name: "setor historico" } },
];

const norm = (s: string) => fold(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function isTourRequest(input: string): boolean {
  const key = norm(input);
  return key === TOUR_TYPE_ID || TOUR_ALIASES.includes(key);
}

/** Stops whose name contains every word of `name` (accents, case and punctuation ignored), in page order. */
export function tourStops(name?: string): TourStop[] {
  const words = name === undefined ? [] : norm(name).split(" ").filter(Boolean);
  return TOUR_STOPS.filter((s) => words.every((w) => norm(s.name).includes(w)));
}
