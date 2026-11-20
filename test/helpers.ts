import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { datasetUrl, filesListUrl, PORTAL_SEARCH_URL } from "../src/sources/portal.js";
import { CNES_TYPES_URL, establishmentsUrl } from "../src/sources/cnes.js";
import { publicationUrl } from "../src/sources/pncp.js";
import { ALERTS_URL, FORECAST_URL } from "../src/sources/inmet.js";

export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

export interface Route {
  status?: number;
  body?: string;
  contentType?: string;
  headers?: Record<string, string>;
  error?: boolean;
}

export interface FetchCall {
  url: string;
  method: string;
}

/** Replaces global fetch with a router keyed by "METHOD url". Unknown requests fail the test. */
export function stubFetch(routes: Record<string, Route>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      const route = routes[`${method} ${url}`];
      if (!route) throw new Error(`unexpected network call in test: ${method} ${url}`);
      if (route.error) throw new TypeError("fetch failed");
      const status = route.status ?? 200;
      // 204/304 responses must have a null body.
      return new Response(status === 204 || status === 304 ? null : (route.body ?? ""), {
        status,
        headers: { "content-type": route.contentType ?? "text/html; charset=utf-8", ...(route.headers ?? {}) },
      });
    }),
  );
  return calls;
}

export const ID_UNIDADES = "680ed5ed-c8b7-4e81-a2af-637d2757027a";
export const ID_TRANSPORTE = "ca40f13b-ef61-472b-810f-dd705f85fd2e";
export const EXT_CSV = "377f4e23-0e4f-4f11-954f-ae06ba689558";
export const FILES_UNIDADES = filesListUrl({ dataset: ID_UNIDADES, extension: EXT_CSV }, 1);

export function happyRoutes(): Record<string, Route> {
  return {
    [`POST ${PORTAL_SEARCH_URL}`]: { body: fixture("portal_busca_saude.html") },
    [`GET ${datasetUrl(ID_UNIDADES)}`]: { body: fixture("portal_detalhe_unidades.html") },
    [`GET ${FILES_UNIDADES}`]: { body: fixture("portal_arquivos_unidades.json"), contentType: "application/json; charset=utf-8" },
    [`GET ${datasetUrl(ID_TRANSPORTE)}`]: { body: fixture("portal_detalhe_transporte.html") },
    ...cnesRoutes(),
    ...pncpRoutes(),
    ...inmetRoutes(),
  };
}

const JSON_TYPE = "application/json";

/** CNES routes backed by the synthetic fixtures (invented values). One page of 7 records: the last page. */
export function cnesRoutes(): Record<string, Route> {
  return {
    [`GET ${CNES_TYPES_URL}`]: { body: fixture("cnes_tipounidades_synthetic.json"), contentType: JSON_TYPE },
    [`GET ${establishmentsUrl(1, null)}`]: { body: fixture("cnes_estabelecimentos_synthetic.json"), contentType: JSON_TYPE },
  };
}

export const PNCP_FROM = "2026-11-01";
export const PNCP_TO = "2026-11-18";
/** The PNCP URL the tool requests for the sample dates (modality 6 unless given). */
export function pncpUrl(page = 1, modality = 6): string {
  return publicationUrl(PNCP_FROM.replaceAll("-", ""), PNCP_TO.replaceAll("-", ""), modality, page);
}

/** PNCP route backed by the synthetic fixture (invented values, planted personal data). One page: the last. */
export function pncpRoutes(): Record<string, Route> {
  return { [`GET ${pncpUrl()}`]: { body: fixture("pncp_contratacoes_synthetic.json"), contentType: JSON_TYPE } };
}

/** INMET routes backed by the synthetic fixtures (invented values, real shape). */
export function inmetRoutes(): Record<string, Route> {
  return {
    [`GET ${FORECAST_URL}`]: { body: fixture("inmet_previsao_synthetic.json"), contentType: JSON_TYPE },
    [`GET ${ALERTS_URL}`]: { body: fixture("inmet_avisos_synthetic.json"), contentType: JSON_TYPE },
  };
}

/** A synthetic PNCP page: `listed` records of the Município (pregão), then `others` of a non-listed body. */
export function syntheticPncpPage(start: number, listed: number, remaining: number, others = 50 - listed): string {
  const rec = (seq: number, cnpj: string) => ({
    numeroControlePNCP: `${cnpj}-1-${String(seq).padStart(6, "0")}/2026`,
    orgaoEntidade: { cnpj, razaoSocial: cnpj === "76417005000186" ? "MUNICIPIO DE CURITIBA" : "OUTRO ORGAO FICTICIO", esferaId: "M" },
    unidadeOrgao: { codigoIbge: "4106902", municipioNome: "Curitiba" },
    anoCompra: 2026,
    sequencialCompra: seq,
    objetoCompra: `Objeto ficticio ${seq}`,
    modalidadeId: 6,
    situacaoCompraId: 1,
    situacaoCompraNome: "Divulgada no PNCP",
    valorTotalEstimado: 10,
    dataPublicacaoPncp: "2026-11-03T08:00:00",
  });
  const data = [
    ...Array.from({ length: listed }, (_, i) => rec(start + i, "76417005000186")),
    ...Array.from({ length: others }, (_, i) => rec(start + 1000 + i, "11111111000191")),
  ];
  return JSON.stringify({ data, totalRegistros: 9999, totalPaginas: 99, numeroPagina: 1, paginasRestantes: remaining, empty: false });
}

/** A full upstream page (20 records) of synthetic public units named `${prefix} <n>`. */
export function syntheticPage(prefix: string, start: number, count = 20, typeCode = 2): string {
  const template = (JSON.parse(fixture("cnes_estabelecimentos_synthetic.json")) as { estabelecimentos: Record<string, unknown>[] })
    .estabelecimentos[0]!;
  const list = Array.from({ length: count }, (_, i) => ({
    ...template,
    codigo_cnes: 9800000 + start + i,
    nome_fantasia: `${prefix} ${start + i}`,
    codigo_tipo_unidade: typeCode,
  }));
  return JSON.stringify({ estabelecimentos: list });
}

export const SAMPLE_CALLS: { name: string; arguments: Record<string, unknown> }[] = [
  { name: "open_datasets_search", arguments: { query: "saude", limit: 5 } },
  { name: "dataset_files", arguments: { dataset_id: ID_UNIDADES } },
  { name: "health_units_search", arguments: {} },
  { name: "procurement_search", arguments: { from: PNCP_FROM, to: PNCP_TO } },
  { name: "weather_forecast", arguments: {} },
  { name: "weather_alerts", arguments: {} },
];

/** Error results carry their JSON in the text content only. */
export function errorOf(res: object): unknown {
  const r = res as { isError?: unknown; content?: { type: string; text: string }[]; structuredContent?: unknown };
  if (r.isError !== true || r.structuredContent !== undefined) return undefined;
  const first = r.content?.[0];
  return first?.type === "text" ? JSON.parse(first.text) : undefined;
}

export async function connectClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  await client.listTools(); // as real clients do; enables client-side outputSchema validation
  return client;
}
