import { TtlCache, type Cached } from "../cache.js";
import { createHostGate, type HostGateOptions } from "../hostGate.js";
import { fetchText, SourceUnavailableError } from "../http.js";

/**
 * Receita Federal "calculadora de tributos do consumo" (CBS/IBS), open-data routes of the pilot API. Paths from
 * `DadosAbertosController.java` (`calculadora/dados-abertos`) of github.com/ReceitaFederal/calculadora-rtc-regime-regular
 * (MIT). robots.txt of the host: 404 (checked 2026-11-23). No terms of use for the hosted API were found.
 */
export const RECEITA_HOST = "piloto-cbs.tributos.gov.br";
const PATH = "/servico/calculadora-consumo/api/calculadora/dados-abertos";
export const RECEITA_BASE = `https://${RECEITA_HOST}${PATH}`;

/** Curitiba's IBGE code and Paraná's IBGE state code, fixed: no input chooses another place. */
export const CURITIBA_IBGE = "4106902";
export const PR_UF_CODE = "41";

export const VERSAO_URL = `${RECEITA_BASE}/versao`;
export const ALIQUOTA_UNIAO_URL = (date: string) => `${RECEITA_BASE}/aliquota-uniao?data=${date}`;
export const ALIQUOTA_UF_URL = (date: string) => `${RECEITA_BASE}/aliquota-uf?codigoUf=${PR_UF_CODE}&data=${date}`;
export const ALIQUOTA_MUNICIPIO_URL = (date: string) =>
  `${RECEITA_BASE}/aliquota-municipio?codigoMunicipio=${CURITIBA_IBGE}&data=${date}`;
export const NBS_URL = (date: string) => `${RECEITA_BASE}/nbs/lista?data=${date}`;
export const NCM_URL = (date: string) => `${RECEITA_BASE}/ncm/vigentes?data=${date}`;
export const CLASS_TRIB_URL = (date: string) => `${RECEITA_BASE}/classificacoes-tributarias/cbs-ibs?data=${date}`;

export const DISCLAIMER = "API piloto da Receita Federal; não é orientação fiscal; confirme com o contador";

/** Requests answered in 1–6 s when checked (2026-11-23). */
export const RECEITA_TIMEOUT_MS = 15_000;
/** `versao` and each rate were under 300 bytes. */
const SMALL_MAX_BYTES = 64 * 1024;
/** The NCM list was 730 KB (10,516 items), the largest of the three lists. */
const LIST_MAX_BYTES = 2 * 1024 * 1024;
export const RECEITA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 5 s between request starts; 20 s queue limit, so a cold `rates` call (slots at 0, 5, 10 and 15 s) fits. */
export const RECEITA_GATE: HostGateOptions = { minIntervalMs: 5_000, maxQueueWaitMs: 20_000 };
const gate = createHostGate(RECEITA_GATE);
/** Versions and rates (a few bytes each). */
const smallCache = new TtlCache(RECEITA_CACHE_TTL_MS, () => Date.now(), 500);
/** Lists are up to 730 KB: at most 3 kept. */
const listCache = new TtlCache(RECEITA_CACHE_TTL_MS, () => Date.now(), 3);

/** Tests only. */
export function clearReceitaState(): void {
  gate.reset();
  smallCache.clear();
  listCache.clear();
}

export function receitaLicenseNote(sourceUrl: string, fetchedAt: string): string {
  return (
    `Source: Receita Federal, calculadora de tributos do consumo (pilot API, dados-abertos), ${sourceUrl}, fetched at ${fetchedAt}. ` +
    "Values are passed on unchanged; only selected fields are returned. The calculator's code repositories are published " +
    "under the MIT licence; no terms of use for the hosted API were found. Unofficial; not affiliated with Receita Federal " +
    "or Prefeitura de Curitiba."
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One GET through the gate: same host and the dados-abertos path on redirects, JSON only. A 404 is `null`. */
async function getJson(url: string, maxBytes: number, allow404: boolean): Promise<unknown> {
  return gate.run(async () => {
    let res;
    try {
      res = await fetchText(url, { timeoutMs: RECEITA_TIMEOUT_MS, maxBytes, sameHostOnly: true, redirectPathPrefix: PATH });
    } catch (err) {
      // Handled inside the gate task: a date with no rate is not a failure of the host.
      if (allow404 && err instanceof SourceUnavailableError && err.reason === "HTTP 404") return null;
      throw err;
    }
    if (!/json/i.test(res.contentType)) throw new SourceUnavailableError("not JSON");
    try {
      return JSON.parse(res.body) as unknown;
    } catch {
      throw new SourceUnavailableError("not JSON");
    }
  });
}

export interface ReceitaVersion {
  app_version: string;
  db_version: string;
  db_date: string | null;
  db_description: string | null;
}

export function parseVersion(json: unknown): ReceitaVersion {
  const app = isObject(json) ? str(json.versaoApp) : null;
  const db = isObject(json) ? str(json.versaoDb) : null;
  if (!isObject(json) || app === null || db === null) throw new SourceUnavailableError("unexpected versao");
  return { app_version: app, db_version: db, db_date: str(json.dataVersaoDb), db_description: str(json.descricaoVersaoDb) };
}

export function getVersion(): Promise<Cached<ReceitaVersion>> {
  return smallCache.getOrLoad(`GET ${VERSAO_URL}`, async () => parseVersion(await getJson(VERSAO_URL, SMALL_MAX_BYTES, false)));
}

/** The reference rate (percent, as served), or null when the base has none for the date (HTTP 404). */
export function parseRate(json: unknown): number | null {
  if (json === null) return null;
  const v = isObject(json) ? num(json.aliquotaReferencia) : null;
  if (v === null) throw new SourceUnavailableError("unexpected aliquota");
  return v;
}

export function getRate(url: string): Promise<Cached<number | null>> {
  return smallCache.getOrLoad(`GET ${url}`, async () => parseRate(await getJson(url, SMALL_MAX_BYTES, true)));
}

export type ListKind = "nbs" | "ncm" | "class_trib";

export interface CodeItem {
  code: string;
  description: string;
  rate_type: string | null;
  treatment: string | null;
  nomenclature: string | null;
  reduction_cbs_pct: number | null;
  reduction_ibs_uf_pct: number | null;
  reduction_ibs_municipal_pct: number | null;
}

export interface CodeList {
  items: CodeItem[];
  skipped: number;
}

export const LIST_URL: Record<ListKind, (date: string) => string> = { nbs: NBS_URL, ncm: NCM_URL, class_trib: CLASS_TRIB_URL };

/**
 * An array of `{codigo|ncm, descricao, ...}`. Items without a string code and description are skipped and counted; a
 * non-empty list with no readable item, or anything other than an array, is a format change (source_unavailable).
 */
export function parseList(kind: ListKind, json: unknown): CodeList {
  if (!Array.isArray(json)) throw new SourceUnavailableError("unexpected list");
  const items: CodeItem[] = [];
  let skipped = 0;
  for (const r of json) {
    const code = isObject(r) ? str(kind === "ncm" ? r.ncm : r.codigo) : null;
    const description = isObject(r) ? str(r.descricao) : null;
    if (!isObject(r) || code === null || description === null) {
      skipped++;
      continue;
    }
    const ct = kind === "class_trib";
    items.push({
      code,
      description,
      rate_type: ct ? str(r.tipoAliquota) : null,
      treatment: ct ? str(r.descricaoTratamentoTributario) : null,
      nomenclature: ct ? str(r.nomenclatura) : null,
      reduction_cbs_pct: ct ? num(r.percentualReducaoCbs) : null,
      reduction_ibs_uf_pct: ct ? num(r.percentualReducaoIbsUf) : null,
      reduction_ibs_municipal_pct: ct ? num(r.percentualReducaoIbsMun) : null,
    });
  }
  if (json.length > 0 && items.length === 0) throw new SourceUnavailableError("no readable item");
  items.sort((a, b) => a.code.localeCompare(b.code));
  return { items, skipped };
}

export function getList(kind: ListKind, date: string): Promise<Cached<CodeList>> {
  const url = LIST_URL[kind](date);
  return listCache.getOrLoad(`GET ${url}`, async () => parseList(kind, await getJson(url, LIST_MAX_BYTES, false)));
}

/** Fixed NFS-e note, read by hand on CHECKED; the page is never fetched (its robots.txt sets a Visit-time window). */
export const NFSE_CHECKED = "2026-11-23";
export const NFSE_SOURCE_URL = "https://lp.curitiba.pr.gov.br/notanacional";
export const NFSE_NOTE = {
  text:
    "Em Curitiba, a NFS-e é emitida obrigatoriamente no Emissor Nacional (padrão nacional da NFS-e), conforme o " +
    "Decreto 1960/2025 e a Portaria 33/2025.",
  schedule: [
    { from: "2025-10-01", who: "sociedades uniprofissionais" },
    { from: "2025-11-01", who: "optantes pelo Simples Nacional" },
    { from: "2026-01-01", who: "demais contribuintes" },
  ],
  legal_basis: ["Decreto 1960/2025", "Portaria 33/2025"],
  public_lookup: "https://www.nfse.gov.br/consultapublica",
  source_url: NFSE_SOURCE_URL,
  checked: `conferido em ${NFSE_CHECKED}`,
};
