import { sharedCache, type Cached } from "../cache.js";
import { fetchText, REFUSAL_BLOCK_MS, SourceUnavailableError } from "../http.js";
import { createHostGate, underOwnBudget, type HostGateOptions } from "../hostGate.js";
import { fold } from "../text.js";

export const CNES_BASE = "https://apidadosabertos.saude.gov.br";
export const CURITIBA_IBGE = 410690;
/** The API caps `limit` at 20 and `offset` is a page index, so the page size stays fixed to keep `page` stable. */
export const CNES_PAGE_SIZE = 20;
export const CNES_TYPES_URL = `${CNES_BASE}/cnes/tipounidades`;

export const CNES_LICENSE_NOTE =
  "Source: Ministério da Saúde, Cadastro Nacional de Estabelecimentos de Saúde (CNES), via the API de Dados Abertos " +
  "(https://apidadosabertos.saude.gov.br/) of the Portal de Dados Abertos do SUS (https://dadosabertos.saude.gov.br/). " +
  "Values are passed on unchanged; only selected fields are returned. The Ministry's notices differ: the portal home " +
  "says its content is under CC BY-ND 3.0, the portal's Cartilha de Dados Abertos do SUS " +
  "(https://dadosabertos.saude.gov.br/Cartilha-de-Dados-Abertos-do-SUS_ISBN.pdf) is under CC BY-NC-SA 4.0, and the " +
  "API's Swagger (https://apidadosabertos.saude.gov.br/static/swagger.json) says MIT; " +
  "treat the data under the strictest of them (attribution, non-commercial, no derivatives). " +
  "Unofficial; not affiliated with Ministério da Saúde or Prefeitura de Curitiba.";

export function establishmentsUrl(page: number, typeCode: number | null): string {
  const params = new URLSearchParams({ codigo_municipio: String(CURITIBA_IBGE), status: "1" });
  if (typeCode !== null) params.set("codigo_tipo_unidade", String(typeCode));
  params.set("limit", String(CNES_PAGE_SIZE));
  params.set("offset", String(page - 1));
  return `${CNES_BASE}/cnes/estabelecimentos?${params.toString()}`;
}

export interface HealthUnit {
  cnes_code: string;
  name: string;
  unit_type_code: number | null;
  unit_type: string | null;
  address: string | null;
  neighbourhood: string | null;
  cep: string | null;
  phone: string | null;
  management_sphere: string | null;
}

export interface RawUnit {
  cnes_code: string;
  name: string;
  unit_type_code: number | null;
  address: string | null;
  neighbourhood: string | null;
  cep: string | null;
  phone: string | null;
  management_sphere: string | null;
}

/**
 * Public administration only: natureza jurídica group 1 (bodies of the Union, states and municipalities, autarquias,
 * public foundations). Fails closed: a missing, null or malformed code, and every other group (2xxx companies,
 * 3xxx non-profits, 4000 individuals), is dropped, because those units can be named after people.
 */
export function isPublicAdministration(code: unknown): boolean {
  return typeof code === "string" && /^1\d{3}$/.test(code.trim());
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Parses one API page, keeping only public-administration units and only institutional fields. */
export function parseEstablishments(json: unknown): { units: RawUnit[]; received: number } {
  const list = (json as { estabelecimentos?: unknown } | null)?.estabelecimentos;
  if (!Array.isArray(list)) throw new SourceUnavailableError("unexpected CNES response");
  const units: RawUnit[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (!isPublicAdministration(r.descricao_natureza_juridica_estabelecimento)) continue;
    const code = r.codigo_cnes;
    const name = str(r.nome_fantasia);
    if (typeof code !== "number" || !Number.isInteger(code) || code <= 0 || name === null) continue;
    const street = str(r.endereco_estabelecimento);
    const number = str(r.numero_estabelecimento);
    const cep = str(r.codigo_cep_estabelecimento);
    units.push({
      cnes_code: String(code).padStart(7, "0"),
      name,
      unit_type_code: typeof r.codigo_tipo_unidade === "number" ? r.codigo_tipo_unidade : null,
      address: street ? (number ? `${street}, ${number}` : street) : null,
      neighbourhood: str(r.bairro_estabelecimento),
      cep: cep && /^\d{8}$/.test(cep) ? cep : null,
      phone: str(r.numero_telefone_estabelecimento),
      management_sphere: str(r.descricao_esfera_administrativa),
    });
  }
  return { units, received: list.length };
}

export function parseUnitTypes(json: unknown): Map<number, string> {
  const list = (json as { tipos_unidade?: unknown } | null)?.tipos_unidade;
  if (!Array.isArray(list)) throw new SourceUnavailableError("unexpected CNES unit types response");
  const map = new Map<number, string>();
  for (const item of list) {
    const r = item as Record<string, unknown> | null;
    const code = r?.codigo_tipo_unidade;
    const label = str(r?.descricao_tipo_unidade);
    if (typeof code === "number" && label !== null) map.set(code, label);
  }
  if (map.size === 0) throw new SourceUnavailableError("empty CNES unit types");
  return map;
}

/**
 * The CNES host gate (src/hostGate.ts, ADR 0003): 400 ms between request starts (pages took 0.3–1.2 s on 2026-11-19,
 * so a page scan is barely slowed), a turn more than 5 s away is rate_limited, and after a failure no request for
 * 60 s (a 429's Retry-After when longer, at most 1 hour; a refusal for the 10-minute host block). Exported so tests
 * can lower the spacing; nothing else changes it.
 */
export const CNES_MIN_INTERVAL_MS = 400;
export const CNES_GATE: HostGateOptions = { minIntervalMs: CNES_MIN_INTERVAL_MS, maxQueueWaitMs: 5_000, refusalWaitMs: REFUSAL_BLOCK_MS };
const gate = createHostGate(CNES_GATE);

/** Tests only. */
export function resetCnesGate(): void {
  gate.reset();
}

async function getJson(url: string, startBy: number | undefined): Promise<unknown> {
  const res = await gate.run(() => fetchText(url), { startBy });
  try {
    return JSON.parse(res.body) as unknown;
  } catch {
    throw new SourceUnavailableError("CNES response is not JSON");
  }
}

/** `startBy`: no request starts after it (OutOfTimeError, no request). */
export function getUnitTypes(startBy?: number): Promise<Cached<Map<number, string>>> {
  return underOwnBudget(startBy, () =>
    sharedCache.getOrLoad(`GET ${CNES_TYPES_URL}`, async () => parseUnitTypes(await getJson(CNES_TYPES_URL, startBy))),
  );
}

export function getEstablishmentsPage(page: number, typeCode: number | null, startBy?: number) {
  const url = establishmentsUrl(page, typeCode);
  return underOwnBudget(startBy, () =>
    sharedCache.getOrLoad(`GET ${url}`, async () => parseEstablishments(await getJson(url, startBy))),
  );
}

/** Unit type codes whose label contains the text (accents and case ignored), or the code itself when numeric. */
export function resolveUnitTypes(input: string, types: Map<number, string>): number[] {
  const t = input.trim();
  if (/^\d{1,3}$/.test(t)) return types.has(Number(t)) ? [Number(t)] : [];
  const needle = fold(t);
  return [...types].filter(([, label]) => fold(label).includes(needle)).map(([code]) => code);
}
