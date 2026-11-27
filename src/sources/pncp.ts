import { sharedCache } from "../cache.js";
import { fetchText, RateLimitedError, REFUSAL_BLOCK_MS, SourceRefusedError, SourceUnavailableError } from "../http.js";
import { createHostGate, OutOfTimeError, underOwnBudget, type HostGateOptions } from "../hostGate.js";
import { maskObject } from "../mask.js";

export const PNCP_CONSULTA = "https://pncp.gov.br/api/consulta";
/** Curitiba, 7-digit IBGE code (PNCP's `codigoMunicipioIbge`). */
export const CURITIBA_IBGE7 = "4106902";
/** The API accepts 10–50; 50 keeps the request count low (a page took 8–13 s on 2026-11-19). */
export const PNCP_PAGE_SIZE = 50;
export const PNCP_TIMEOUT_MS = 25_000;

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

/**
 * Direct awards and credenciamento: their objects often name the contracted or accredited person. Owner decisions
 * 2026-11-19 (8, 9, 14) and 2026-11-21 (12, v0.13.2).
 */
export const OBJECT_WITHHELD_MODALITIES: ReadonlySet<number> = new Set([8, 9, 12, 14]);

/** Fails closed: an unknown modality code withholds the object too. */
export function objectReturnable(modality: number | null): boolean {
  return modality !== null && modality in MODALITIES && !OBJECT_WITHHELD_MODALITIES.has(modality);
}

export const PNCP_LICENSE_NOTE =
  "Source: Portal Nacional de Contratações Públicas (PNCP), API de Consulta (https://pncp.gov.br/api/consulta). " +
  "The PNCP site (https://www.gov.br/pncp/pt-br) is published under CC BY-ND 3.0; no separate licence for the API " +
  "data was found. Selected fields only; no supplier is returned. Values are passed on unchanged, except the object " +
  "text: for dispensa, inexigibilidade, credenciamento and inaplicabilidade it is withheld (it may name a person), and for other " +
  "modalities CPF/CNPJ-shaped numbers, e-mails and phone numbers are replaced by [masked], whitespace is collapsed, " +
  "dashes are normalised and it is cut at 300 characters. Open the link for the official record. Unofficial; not affiliated with PNCP, the Ministério da Gestão " +
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
  const json = parseJson(body);
  const list = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) throw new SourceUnavailableError("unexpected PNCP response");
  const { items, discarded } = parseRecords(list);
  const remaining = (json as { paginasRestantes?: unknown }).paginasRestantes;
  const lastPage = typeof remaining === "number" ? remaining <= 0 : list.length < PNCP_PAGE_SIZE;
  return { items, received: list.length, discarded, lastPage };
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new SourceUnavailableError("PNCP response is not JSON");
  }
}

/** Records in the Consulta API shape; see parseContratacoes. */
function parseRecords(list: unknown[]): { items: Procurement[]; discarded: number } {
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
    const pncpId = id !== null && id.startsWith(`${cnpj}-`) && /^\d{14}-\d{1,2}-\d{6}\/\d{4}$/.test(id) ? id : null;
    const bodyName = str(org?.razaoSocial);
    if (str(unit?.codigoIbge) !== CURITIBA_IBGE7 || year === null || year < 2000 || year > 2100 || seq === null || seq <= 0 || pncpId === null || bodyName === null) {
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
  return { items, discarded };
}

/**
 * The search behind the pncp.gov.br site (`/api/search`, docs/sources.md): no key or login, a page of 100 in about 1 s.
 * Not in the Consulta OpenAPI. Filtered to Curitiba (PNCP's own municipality id 4006, not the IBGE code) and one
 * modality; results come newest update first (`ordenacao=-data` sorts by `data_atualizacao_pncp`).
 */
export const PNCP_SEARCH = "https://pncp.gov.br/api/search";
export const PNCP_SEARCH_PAGE_SIZE = 100;
export const CURITIBA_SEARCH_MUNICIPIO = "4006";

export function searchUrl(query: string, modality: number, page: number): string {
  const params = new URLSearchParams({
    q: query,
    tipos_documento: "edital",
    ordenacao: "-data",
    status: "todos",
    municipios: CURITIBA_SEARCH_MUNICIPIO,
    modalidades: String(modality),
    pagina: String(page),
    tam_pagina: String(PNCP_SEARCH_PAGE_SIZE),
  });
  return `${PNCP_SEARCH}?${params.toString()}`;
}

export interface SearchPage extends ParsedPage {
  /** Date (YYYY-MM-DD) of the oldest `data_atualizacao_pncp` on the page; null when none was readable. */
  oldestUpdate: string | null;
}

/**
 * Copies only the fields parseRecords reads from each search record into the Consulta shape, so the search's
 * supplier, user and free-text fields (`fornecedor_*`, `usuario_nome`, `informacao_complementar`) never reach it.
 */
export function parseSearch(body: string): SearchPage {
  if (body.trim() === "") return { items: [], received: 0, discarded: 0, lastPage: true, oldestUpdate: null };
  const json = parseJson(body) as { items?: unknown; total?: unknown } | null;
  const list = json?.items;
  if (!Array.isArray(list) || typeof json?.total !== "number") throw new SourceUnavailableError("unexpected PNCP response");
  let oldestUpdate: string | null = null;
  const records = list.map((rec: unknown) => {
    if (typeof rec !== "object" || rec === null) return null;
    const r = rec as Record<string, unknown>;
    const updated = dateTime(r.data_atualizacao_pncp)?.slice(0, 10) ?? null;
    if (updated !== null && (oldestUpdate === null || updated < oldestUpdate)) oldestUpdate = updated;
    return {
      numeroControlePNCP: r.numero_controle_pncp,
      orgaoEntidade: { cnpj: r.orgao_cnpj, razaoSocial: r.orgao_nome },
      unidadeOrgao: { codigoIbge: r.codigo_ibge },
      anoCompra: r.ano,
      sequencialCompra: r.numero_sequencial,
      modalidadeId: r.modalidade_licitacao_id,
      objetoCompra: r.description,
      valorTotalEstimado: r.valor_total_estimado,
      situacaoCompraId: r.situacao_id,
      situacaoCompraNome: r.situacao_nome,
      dataPublicacaoPncp: r.data_publicacao_pncp,
      dataAberturaProposta: r.data_inicio_recebimento_propostas,
      dataEncerramentoProposta: r.data_fim_recebimento_propostas,
    };
  });
  const { items, discarded } = parseRecords(records);
  return { items, received: list.length, discarded, lastPage: list.length < PNCP_SEARCH_PAGE_SIZE, oldestUpdate };
}

/** Longest Retry-After (seconds) the server waits for before its single retry; anything longer is returned as rate_limited. */
export const MAX_RETRY_AFTER_S = 5;

/**
 * One retry at most: after a connection error (PNCP reset about half of the connections on 2026-11-19), or after an
 * HTTP 429 whose Retry-After is at most 5 s. Never after a timeout or any other HTTP error. `retryReset` false: no
 * retry after a connection error (the site search retries it on the gate's next turn instead, getSearchPage).
 */
async function fetchPncp(url: string, timeoutMs = PNCP_TIMEOUT_MS, retryReset = true): Promise<string> {
  try {
    return (await fetchText(url, { timeoutMs })).body;
  } catch (err) {
    if (err instanceof RateLimitedError) {
      if (err.retryAfterS === null || err.retryAfterS > MAX_RETRY_AFTER_S) throw err;
      await new Promise((r) => setTimeout(r, err.retryAfterS! * 1000));
    } else if (!retryReset || !(err instanceof SourceUnavailableError) || err.reason !== "network error") throw err;
    return (await fetchText(url, { timeoutMs })).body;
  }
}

/**
 * The PNCP host gate (src/hostGate.ts, ADR 0003): 6 s between request starts, so at most 20 in 2 minutes (PNCP
 * answered 429 after about 20 requests in two minutes on 2026-11-19); a turn more than 10 s away is rate_limited;
 * after a failure no request for 60 s (a 429's Retry-After when longer, at most 1 hour; a refusal for the 10-minute
 * host block). The single retry of fetchPncp runs inside the same turn; the site search's retry after a connection
 * reset takes the next turn (getSearchPage). Exported so tests can set the spacing to 0
 * (test/setup.ts); production code never changes it.
 */
export const PNCP_MIN_INTERVAL_MS = 6_000;
export const PNCP_GATE: HostGateOptions = { minIntervalMs: PNCP_MIN_INTERVAL_MS, maxQueueWaitMs: 10_000, refusalWaitMs: REFUSAL_BLOCK_MS };
const gate = createHostGate(PNCP_GATE);

/** Tests only. */
export function resetPncpGate(): void {
  gate.reset();
  searchDownUntil = 0;
  searchDownReason = "";
  searchResets = 0;
}

/** `startBy`: no request starts after it (OutOfTimeError, no request). */
export function getPublicationPage(from: string, to: string, modality: number, page: number, startBy?: number) {
  const url = publicationUrl(from, to, modality, page);
  return underOwnBudget(startBy, () =>
    sharedCache.getOrLoad(`GET ${url}`, async () => parseContratacoes(await gate.run(() => fetchPncp(url), { startBy }))),
  );
}

/**
 * The site search failed (network error, timeout or HTTP error after the single retry) or its format changed
 * (`layout_changed`): the caller falls back to the Consulta scan. The gate does not remember it, because the Consulta
 * API is another service on the host. A 429 or a refusal is never this: those stay host failures.
 */
export class SearchUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`search_unavailable: ${reason}`);
    this.name = "SearchUnavailableError";
  }
}

/**
 * The search answered in 0.45–1.7 s per page (2026-11-22); 8 s leaves the fallback scan room in the 20 s budget.
 * A timeout is not retried (fetchPncp).
 */
export const PNCP_SEARCH_TIMEOUT_MS = 8_000;
/** After a search failure, the search is not asked for 10 minutes in the process (the Consulta API still is). */
export const SEARCH_DOWN_MS = 10 * 60_000;
/** Slack between a retry's timeout and the scan's last start (timers and scheduling run late). */
const RETRY_MARGIN_MS = 1_000;
let searchDownUntil = 0;
let searchDownReason = "";
/** Search requests in a row (across calls) that ended in a connection error; a search answer sets it back to 0. */
let searchResets = 0;

const searchFailure = (err: unknown) =>
  err instanceof SourceUnavailableError && !(err instanceof RateLimitedError) && !(err instanceof SourceRefusedError);

/**
 * One page of the site search, through the same PNCP gate (spacing, budget) and cache as the Consulta API. PNCP resets
 * connections at random (docs/sources.md), so a connection error is retried once on the gate's next turn (6 s later),
 * and only when that retry would start by `startBy - PNCP_SEARCH_TIMEOUT_MS - 1 s`, so its timeout still leaves the
 * fallback scan its start; otherwise the retry is skipped (OutOfTimeError of `startBy`). A timeout, 5xx or changed
 * format is never retried.
 */
export function getSearchPage(query: string, modality: number, page: number, startBy?: number) {
  const url = searchUrl(query, modality, page);
  /**
   * Remembered only when the search as a whole looks down: a timeout, 5xx or a changed format at once; a connection
   * error only when it is the second in a row.
   */
  const down = (reason: string) => {
    const reset = reason === "network error" && ++searchResets >= 2;
    if (reset || /^(timeout|HTTP 5\d\d|layout_changed)$/.test(reason)) {
      searchDownUntil = Date.now() + SEARCH_DOWN_MS;
      searchDownReason = reason;
      searchResets = 0;
    }
    return new SearchUnavailableError(reason);
  };
  const attempt = (by: number | undefined) =>
    gate.run(
      async (): Promise<{ body: string } | { failed: string }> => {
        try {
          return { body: await fetchPncp(url, PNCP_SEARCH_TIMEOUT_MS, false) };
        } catch (err) {
          // Returned, not thrown: the gate would remember it for the whole host, Consulta included.
          if (searchFailure(err)) return { failed: (err as SourceUnavailableError).reason };
          throw err;
        }
      },
      { startBy: by },
    );
  return underOwnBudget(startBy, () =>
    sharedCache.getOrLoad(`GET ${url}`, async () => {
      if (Date.now() < searchDownUntil) {
        const left = Math.ceil((searchDownUntil - Date.now()) / 60_000);
        throw new SearchUnavailableError(`${searchDownReason}; not asked again for about ${left} min`);
      }
      let got = await attempt(startBy);
      if ("failed" in got && got.failed === "network error" && searchResets === 0) {
        searchResets = 1;
        const retryBy = startBy === undefined ? undefined : startBy - PNCP_SEARCH_TIMEOUT_MS - RETRY_MARGIN_MS;
        try {
          got = await attempt(retryBy);
        } catch (err) {
          // Skipped: the retry would leave the scan no room. Reported against the call's own budget, so a caller sharing
          // this load asks again under its budget, and procurement_search falls back (first page) or stops as partial.
          // The next connection error is the second in a row.
          if (err instanceof OutOfTimeError && err.startBy === retryBy) throw new OutOfTimeError(startBy!);
          throw err;
        }
      }
      if ("failed" in got) throw down(got.failed);
      searchResets = 0;

      try {
        return parseSearch(got.body);
      } catch (err) {
        if (searchFailure(err)) throw down("layout_changed");
        throw err;
      }
    }),
  );
}

/**
 * The PNCP API's own read routes for the Plano de Contratações Anual (PCA), on the same host and gate as the Consulta
 * API (docs/sources.md, v0.89): no auth in its OpenAPI, about 0.1 s per answer on 2026-11-27. The Consulta PCA route
 * filters by update date, not by year, and took 28 s for one page, so it is not used.
 */
export const PNCP_API = "https://pncp.gov.br/api/pncp";
/** 31 units for the Município de Curitiba in 2027 (2026-11-27); a full page means more may exist (said in the note). */
export const PCA_UNITS_PAGE_SIZE = 500;

export function pcaUnitsUrl(cnpj: string, year: number): string {
  return `${PNCP_API}/v1/orgaos/${cnpj}/pca/${year}/consolidado/unidades?pagina=1&tamanhoPagina=${PCA_UNITS_PAGE_SIZE}`;
}

export function pcaCategoriesUrl(cnpj: string, year: number): string {
  return `${PNCP_API}/v1/orgaos/${cnpj}/pca/${year}/valorescategoriaitem`;
}

export const PNCP_PLAN_LICENSE_NOTE =
  "Source: Portal Nacional de Contratações Públicas (PNCP), Plano de Contratações Anual published by the body " +
  "(https://pncp.gov.br/api/pncp). The PNCP site (https://www.gov.br/pncp/pt-br) is published under CC BY-ND 3.0; no " +
  "separate licence for the API data was found. Totals per category and per requesting unit only; no item and no " +
  "supplier is returned. Unit and body names have CPF/CNPJ-shaped numbers, e-mails and phone numbers replaced by " +
  "[masked] and are cut at 300 characters. A plan is what the body intends to buy, not a purchase. Unofficial; not affiliated with PNCP, the " +
  "Ministério da Gestão e Inovação em Serviços Públicos (MGI) or Prefeitura de Curitiba.";

export interface PlanUnit {
  unit: string;
  item_count: number;
  total_value: number;
  published_at: string;
  updated_at: string;
}

export interface PlanUnits {
  body_name: string | null;
  units: PlanUnit[];
  received: number;
  discarded: number;
}

export interface PlanCategory {
  category: string;
  item_count: number;
  total_value: number;
}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
const amount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const stamp = (v: unknown) => (typeof v === "string" && DATE_TIME.test(v) ? v.slice(0, 19) : null);
const name = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? maskObject(v).text : null);

/** Rows of another body or year, or with a missing or malformed field, are dropped and counted (fail closed). */
export function parsePlanUnits(body: string, cnpj: string, year: number): PlanUnits {
  const list = parseJson(body);
  if (!Array.isArray(list)) throw new SourceUnavailableError("unexpected PNCP response");
  const units: PlanUnit[] = [];
  let bodyName: string | null = null;
  for (const rec of list as unknown[]) {
    const r = (typeof rec === "object" && rec !== null ? rec : {}) as Record<string, unknown>;
    const unit = name(r.nomeUnidade);
    const items = count(r.quantidade);
    const total = amount(r.valorTotal);
    const published = stamp(r.dataPublicacaoPncp);
    const updated = stamp(r.dataAtualizacao);
    if (r.cnpj !== cnpj || r.anoPca !== year || unit === null || items === null || total === null || published === null || updated === null) {
      continue;
    }
    bodyName ??= name(r.razaoSocial);
    units.push({ unit, item_count: items, total_value: total, published_at: published, updated_at: updated });
  }
  return { body_name: bodyName, units, received: list.length, discarded: list.length - units.length };
}

export function parsePlanCategories(body: string): { categories: PlanCategory[]; discarded: number } {
  const list = parseJson(body);
  if (!Array.isArray(list)) throw new SourceUnavailableError("unexpected PNCP response");
  const categories: PlanCategory[] = [];
  for (const rec of list as unknown[]) {
    const r = (typeof rec === "object" && rec !== null ? rec : {}) as Record<string, unknown>;
    const category = name(r.categoriaItemNome);
    const items = count(r.quantidadeItens);
    const total = amount(r.valorTotal);
    if (category !== null && items !== null && total !== null) categories.push({ category, item_count: items, total_value: total });
  }
  return { categories, discarded: list.length - categories.length };
}

/**
 * PNCP answers 404 (units: "CNPJ do Órgão/Entidade inválido", even for a listed body) or 422 ("Nenhum Plano de
 * Contratação Anual cadastrado para o ano informado") when the body has no plan for the year; an empty 204 is read the
 * same way. Returned as a value
 * inside the gate's turn, so the gate does not count it as a host failure and hold back the next request.
 */
export type PlanAnswer<T> = { found: T } | { none: number };

function getPlan<T>(url: string, parse: (body: string) => T, startBy?: number): Promise<{ value: PlanAnswer<T>; fetchedAt: string }> {
  return underOwnBudget(startBy, () =>
    sharedCache.getOrLoad(`GET ${url}`, async () => {
      const got = await gate.run(
        async (): Promise<{ body: string } | { none: number }> => {
          try {
            return { body: await fetchPncp(url) };
          } catch (err) {
            const m = err instanceof SourceUnavailableError && /^HTTP (404|422)$/.exec(err.reason);
            if (m) return { none: Number(m[1]) };
            throw err;
          }
        },
        { startBy },
      );
      if ("none" in got) return got;
      // An empty body is PNCP's HTTP 204 (as in parseContratacoes): nothing published for that body and year.
      return got.body.trim() === "" ? { none: 204 } : { found: parse(got.body) };
    }),
  );
}

export function getPlanUnits(cnpj: string, year: number, startBy?: number) {
  return getPlan(pcaUnitsUrl(cnpj, year), (b) => parsePlanUnits(b, cnpj, year), startBy);
}

export function getPlanCategories(cnpj: string, year: number, startBy?: number) {
  return getPlan(pcaCategoriesUrl(cnpj, year), parsePlanCategories, startBy);
}
