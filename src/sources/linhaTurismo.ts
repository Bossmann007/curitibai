import { foldKey } from "../text.js";

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
  "atracao turistica",
  "atracoes turisticas",
  "linha turismo",
  "linha de turismo",
];

/** A city_facilities_search call that gives the stop's address, hours as published and phone; null when no layer has it. */
export interface TourLookup {
  type: string;
  name: string;
  /** The record's name in that layer when matched (2026-11-25); kept here as evidence, never returned. */
  matched: string;
}

export interface TourStop {
  /** The stop's name as published on the page, in page order (upper case and abbreviations kept). */
  name: string;
  lookup: TourLookup | null;
  /** Extra words a search by `name` also matches (the place's full name where the page abbreviates it). */
  aka?: string;
}

/**
 * The 25 stops in page order, read on 2026-11-25. `lookup` was matched by hand to one record of the named GeoCuritiba
 * layer on the same day (`matched`; test/linhaTurismo.test.ts keeps every lookup type valid and every lookup word in
 * `matched`); null where no layer of the tool holds
 * the place (streets, squares, neighbourhoods).
 */
export const TOUR_STOPS: readonly TourStop[] = [
  { name: "RUA 24 HORAS", lookup: null },
  { name: "MUSEU FERROVIARIO", lookup: { type: "museu", name: "ferroviario", matched: "Museu Ferroviário de Curitiba" } },
  { name: "TEATRO PAIOL", lookup: { type: "teatro", name: "paiol", matched: "Teatro do Paiol" } },
  { name: "PARQUE JARDIM BOTANICO", lookup: { type: "parque", name: "jardim botanico", matched: "Jardim Botânico Francisca Maria Garfunkel Rischibieter" } },
  { name: "MUSEU OSCAR NIEMEYER", lookup: { type: "museu", name: "museu oscar niemeyer", matched: "Museu Oscar Niemeyer" } },
  { name: "MERC.MUNICIPAL/RODOFERROVIARIA", lookup: { type: "mercado municipal", name: "mercado municipal de curitiba", matched: "Mercado Municipal de Curitiba" }, aka: "mercado municipal rodoferroviaria" },
  { name: "PRACA TIRADENTES", lookup: null },
  { name: "TEATRO GUAIRA/UNIV.FEDERAL PR", lookup: { type: "teatro", name: "teatro guaira", matched: "Teatro Guaíra - Auditório Bento Munhoz da Rocha Neto (and 2 more auditoriums)" }, aka: "universidade federal do parana ufpr" },
  { name: "RUA DAS FLORES", lookup: null },
  { name: "BOSQUE ALEMAO", lookup: { type: "parque", name: "bosque alemao", matched: "Bosque Alemão" } },
  { name: "PACO DA LIBERDADE", lookup: null },
  { name: "UNIV.LIVRE DO MEIO AMBIENTE", lookup: { type: "parque", name: "bosque zaninelli", matched: "Bosque Zaninelli" }, aka: "universidade livre unilivre bosque zaninelli" },
  { name: "MEMORIAL ARABE", lookup: { type: "memorial", name: "arabe", matched: "Memorial da Imigração Árabe" } },
  { name: "CENTRO CIVICO", lookup: null },
  { name: "PQ.SAO LOURENCO (SENT.BARREIRINHA)", lookup: { type: "parque", name: "sao lourenco", matched: "Parque São Lourenço" }, aka: "parque sao lourenco" },
  { name: "BOSQUE DO PAPA", lookup: { type: "memorial", name: "polonesa", matched: "Memorial da Imigração Polonesa" }, aka: "bosque joao paulo ii memorial polones" },
  { name: "OPERA DE ARAME", lookup: { type: "teatro", name: "opera de arame", matched: "Teatro Ópera de Arame" }, aka: "parque das pedreiras" },
  { name: "PARQUE TANGUA", lookup: { type: "parque", name: "tangua", matched: "Parque Tanguá" } },
  { name: "PARQUE TINGUI", lookup: { type: "parque", name: "tingui", matched: "Parque Tingui" } },
  { name: "MEMORIAL UCRANIANO", lookup: { type: "memorial", name: "ucraniana", matched: "Memorial da Imigração Ucraniana" } },
  { name: "PORTAL ITALIANO", lookup: null },
  { name: "SANTA FELICIDADE", lookup: null },
  { name: "PARQUE BARIGUI", lookup: { type: "parque", name: "barigui", matched: "Parque Barigui" } },
  { name: "TORRE PANORAMICA", lookup: { type: "informacoes turisticas", name: "torre panoramica", matched: "Posto de Informações Turísticas Torre Panorâmica" } },
  { name: "SETOR HISTORICO", lookup: { type: "informacoes turisticas", name: "setor historico", matched: "Posto de Informações Turísticas Setor Histórico" }, aka: "largo da ordem centro historico" },
];

export function isTourRequest(input: string): boolean {
  const key = foldKey(input);
  return key === TOUR_TYPE_ID || TOUR_ALIASES.includes(key);
}

/**
 * Stops whose name, `aka` words or lookup name contain every word of `name` (accents, case and punctuation ignored), in
 * page order.
 */
export function tourStops(name?: string): TourStop[] {
  const words = name === undefined ? [] : foldKey(name).split(" ").filter(Boolean);
  return TOUR_STOPS.filter((s) => {
    const hay = foldKey(`${s.name} ${s.aka ?? ""} ${s.lookup?.name ?? ""}`);
    return words.every((w) => hay.includes(w));
  });
}
