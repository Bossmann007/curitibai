import { sharedCache } from "../cache.js";
import { fetchText, SourceUnavailableError } from "../http.js";

export const PNCP_CONSULTA = "https://pncp.gov.br/api/consulta";
/** Curitiba, 7-digit IBGE code (PNCP's `codigoMunicipioIbge`). */
export const CURITIBA_IBGE7 = "4106902";
/** The API accepts 10–50; 50 keeps the request count low (a page took 8–13 s on 2026-11-19). */
export const PNCP_PAGE_SIZE = 50;
export const PNCP_TIMEOUT_MS = 25_000;
export const OBJECT_MAX_CHARS = 300;
export const MASK = "[masked]";

/**
 * Curitiba municipal bodies, read from PNCP (docs/sources.md): every body with esferaId M and a buying unit in
 * Curitiba in the results published 2026-10-01..2026-11-18, plus URBS and COHAB-CT (esferaId N), minus a platform's
 * test body. Exact 14-digit CNPJ; anything else is not returned (fail closed).
 */
export const CURITIBA_BODIES: ReadonlySet<string> = new Set([
  "76417005000186", // MUNICIPIO DE CURITIBA
  "76417005001743", // MUNICIPIO DE CURITIBA
  "77636520000110", // CAMARA MUNICIPAL DE CURITIBA
  "13792329000184", // FUNDO MUNICIPAL DA SAUDE
  "14682109000160", // FUNDO DE URBANIZACAO DE CURITIBA
  "14814139000183", // FUNDACAO ESTATAL DE ATENCAO A SAUDE - FEAS
  "03518900000113", // INSTITUTO CURITIBA DE SAUDE
  "07505809000114", // INSTITUTO MUNICIPAL DE TURISMO
  "75123125000108", // FUNDACAO CULTURAL DE CURITIBA
  "76568930000108", // FUNDACAO DE ACAO SOCIAL
  "76582337000116", // IPPUC
  "76608736000109", // INSTITUTO DE PREVIDENCIA DOS SERVIDORES DO MUNICIPIO DE CURITIBA
  "78802394000199", // INSTITUTO MUNICIPAL DE ADMINISTRACAO PUBLICA
  "75076836000179", // URBS URBANIZACAO DE CURITIBA S/A
  "76495696000136", // COMPANHIA DE HABITACAO POPULAR DE CURITIBA
]);

/** PNCP domain table "Modalidade de Contratação" (GET /api/pncp/v1/modalidades, 2026-11-19). */
export const MODALITIES: Readonly<Record<number, string>> = {
  1: "Leilão - Eletrônico",
  2: "Diálogo Competitivo",
  3: "Concurso",
  4: "Concorrência - Eletrônica",
  5: "Concorrência - Presencial",
  6: "Pregão - Eletrônico",
  7: "Pregão - Presencial",
  8: "Dispensa",
  9: "Inexigibilidade",
  10: "Manifestação de Interesse",
  11: "Pré-qualificação",
  12: "Credenciamento",
  13: "Leilão - Presencial",
  14: "Inaplicabilidade da Licitação",
  15: "Chamada pública",
  16: "Concorrência – Eletrônica Internacional",
  17: "Concorrência – Presencial Internacional",
  18: "Pregão – Eletrônico Internacional",
  19: "Pregão – Presencial Internacional",
  20: "Diálogo Competitivo Internacional",
};

/** Direct awards: their objects often name the contracted person. Owner decision 2026-11-19. */
export const OBJECT_WITHHELD_MODALITIES: ReadonlySet<number> = new Set([8, 9, 14]);

/** Fails closed: an unknown modality code withholds the object too. */
export function objectReturnable(modality: number | null): boolean {
  return modality !== null && modality in MODALITIES && !OBJECT_WITHHELD_MODALITIES.has(modality);
}

export const PNCP_LICENSE_NOTE =
  "Source: Portal Nacional de Contratações Públicas (PNCP), API de Consulta (https://pncp.gov.br/api/consulta). " +
  "The PNCP site (https://www.gov.br/pncp/pt-br) is published under CC BY-ND 3.0; no separate licence for the API " +
  "data was found. Selected fields only; no supplier is returned. Values are passed on unchanged, except the object " +
  "text: for dispensa, inexigibilidade and inaplicabilidade it is withheld (it may name a person), and for other " +
  "modalities CPF/CNPJ-shaped numbers, e-mails and phone numbers are replaced by [masked], whitespace is collapsed " +
  "and it is cut at 300 characters. Open the link for the official record. Unofficial; not affiliated with PNCP, the Ministério da Gestão " +
  "e Inovação em Serviços Públicos (MGI) or Prefeitura de Curitiba.";

/** `from`/`to` as yyyyMMdd. */
export function publicationUrl(from: string, to: string, modality: number, page: number): string {
  const params = new URLSearchParams({
    dataInicial: from,
    dataFinal: to,
    codigoModalidadeContratacao: String(modality),
    codigoMunicipioIbge: CURITIBA_IBGE7,
    pagina: String(page),
    tamanhoPagina: String(PNCP_PAGE_SIZE),
  });
  return `${PNCP_CONSULTA}/v1/contratacoes/publicacao?${params.toString()}`;
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
/** A digit run with dots, slashes or hyphens inside; masked when it holds 10+ digits (CPF 11, CNPJ 14, phone with DDD 10–11). */
const DIGIT_RUN = /\d(?:[\d./-]*\d)?/g;
/** Brazilian phone numbers: optional +55, optional DDD in parentheses, 8 or 9 digits split by a space, dot or hyphen. */
const PHONE = /(?:\+?55[\s.-]?)?(?:\(\d{2}\)\s?|\b\d{2}[\s.-]?)?\b9?\d{4}[\s.-]\d{4}\b/g;

/** Masks CPF/CNPJ-shaped numbers, e-mails and phone numbers, collapses whitespace and caps the length. */
export function maskObject(raw: string): { text: string; truncated: boolean } {
  let t = raw.replace(/\s+/g, " ").trim();
  t = t.replace(EMAIL, MASK);
  t = t.replace(DIGIT_RUN, (m) => (m.replace(/\D/g, "").length >= 10 ? MASK : m));
  t = t.replace(PHONE, MASK);
  if (t.length <= OBJECT_MAX_CHARS) return { text: t, truncated: false };
  return { text: `${t.slice(0, OBJECT_MAX_CHARS).trimEnd()}…`, truncated: true };
}

export interface Procurement {
  pncp_id: string;
  body_cnpj: string;
  body_name: string;
  modality_code: number | null;
  modality: string | null;
  object: string | null;
  object_withheld: "may_name_a_person" | null;
  object_truncated: boolean;
  estimated_value: number | null;
  status_code: number | null;
  status: string | null;
  published_at: string | null;
  proposals_open_at: string | null;
  proposals_close_at: string | null;
  link: string;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function int(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^\d{1,9}$/.test(v.trim())) return Number(v.trim());
  return null;
}

function dateTime(v: unknown): string | null {
  const s = str(v);
  return s !== null && /^\d{4}-\d{2}-\d{2}(T[\d:.]+)?$/.test(s) ? s : null;
}

export interface ParsedPage {
  items: Procurement[];
  /** Records on the upstream page (every body). */
  received: number;
  /** Records of a Curitiba body dropped because a required field was missing or malformed. */
  discarded: number;
  lastPage: boolean;
}

/**
 * Builds each item field by field from an allowlisted body's record. Nothing else in the record (supplier keys,
 * free-text notes, the origin system link, the publishing user) can reach the output.
 * An empty body is PNCP's HTTP 204 for "no results".
 */
export function parseContratacoes(body: string): ParsedPage {
  if (body.trim() === "") return { items: [], received: 0, discarded: 0, lastPage: true };
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new SourceUnavailableError("PNCP response is not JSON");
  }
  const list = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) throw new SourceUnavailableError("unexpected PNCP response");
  const items: Procurement[] = [];
  let discarded = 0;
  for (const rec of list) {
    if (typeof rec !== "object" || rec === null) continue;
    const r = rec as Record<string, unknown>;
    const org = (r.orgaoEntidade ?? null) as Record<string, unknown> | null;
    const unit = (r.unidadeOrgao ?? null) as Record<string, unknown> | null;
    const cnpj = str(org?.cnpj);
    if (cnpj === null || !CURITIBA_BODIES.has(cnpj)) continue;
    const year = int(r.anoCompra);
    const seq = int(r.sequencialCompra);
    const id = str(r.numeroControlePNCP);
    // Control number "<cnpj>-<n>-<seq 6 digits>/<year>"; anything else is not passed on.
    const pncpId = id !== null && /^\d{14}-\d{1,2}-\d{6}\/\d{4}$/.test(id) ? id : null;
    const bodyName = str(org?.razaoSocial);
    if (str(unit?.codigoIbge) !== CURITIBA_IBGE7 || year === null || seq === null || seq <= 0 || pncpId === null || bodyName === null) {
      discarded++;
      continue;
    }
    const modality = int(r.modalidadeId);
    const rawObject = str(r.objetoCompra);
    let object: string | null = null;
    let truncated = false;
    let withheld: Procurement["object_withheld"] = null;
    if (!objectReturnable(modality)) withheld = "may_name_a_person";
    else if (rawObject !== null) ({ text: object, truncated } = maskObject(rawObject));
    const value = r.valorTotalEstimado;
    items.push({
      pncp_id: pncpId,
      body_cnpj: cnpj,
      body_name: bodyName,
      modality_code: modality,
      modality: modality !== null ? (MODALITIES[modality] ?? null) : null,
      object,
      object_withheld: withheld,
      object_truncated: truncated,
      estimated_value: typeof value === "number" && Number.isFinite(value) ? value : null,
      status_code: int(r.situacaoCompraId),
      status: str(r.situacaoCompraNome),
      published_at: dateTime(r.dataPublicacaoPncp),
      proposals_open_at: dateTime(r.dataAberturaProposta),
      proposals_close_at: dateTime(r.dataEncerramentoProposta),
      link: `https://pncp.gov.br/app/editais/${cnpj}/${year}/${seq}`,
    });
  }
  const remaining = (json as { paginasRestantes?: unknown }).paginasRestantes;
  const lastPage = typeof remaining === "number" ? remaining <= 0 : list.length < PNCP_PAGE_SIZE;
  return { items, received: list.length, discarded, lastPage };
}

export function getPublicationPage(from: string, to: string, modality: number, page: number) {
  const url = publicationUrl(from, to, modality, page);
  return sharedCache.getOrLoad(`GET ${url}`, async () =>
    parseContratacoes((await fetchText(url, { timeoutMs: PNCP_TIMEOUT_MS })).body),
  );
}
