import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { URBS_LINES_URL, URBS_STOPS_URL, scheduleUrl } from "../src/sources/urbs.js";
import { PORTAL_SEARCH_URL } from "../src/sources/portal.js";

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
      return new Response(route.body ?? "", {
        status: route.status ?? 200,
        headers: { "content-type": route.contentType ?? "text/html; charset=utf-8", ...(route.headers ?? {}) },
      });
    }),
  );
  return calls;
}

export const DETAIL_UNIDADES = "https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=680ed5ed-c8b7-4e81-a2af-637d2757027a";
export const DETAIL_TRANSPORTE = "https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=ca40f13b-ef61-472b-810f-dd705f85fd2e";

export function happyRoutes(): Record<string, Route> {
  return {
    [`GET ${URBS_LINES_URL}`]: { body: fixture("urbs_linhas_ativas.json"), contentType: "application/json" },
    [`GET ${scheduleUrl("182")}`]: { body: fixture("urbs_linha_182_v2.json"), contentType: "application/json" },
    [`GET ${URBS_STOPS_URL}`]: { body: fixture("urbs_pontos_parada.html") },
    [`POST ${PORTAL_SEARCH_URL}`]: { body: fixture("portal_busca_saude.html") },
    [`GET ${DETAIL_UNIDADES}`]: { body: fixture("portal_detalhe_unidades.html") },
    [`GET ${DETAIL_TRANSPORTE}`]: { body: fixture("portal_detalhe_transporte.html") },
  };
}

export const SAMPLE_CALLS: { name: string; arguments: Record<string, unknown> }[] = [
  { name: "bus_lines_search", arguments: { query: "botanico" } },
  { name: "bus_line_schedule", arguments: { line_code: "182", day_type: "weekday" } },
  { name: "bus_stops_near", arguments: { lat: -25.4296, lon: -49.2713, radius_m: 300 } },
  { name: "open_datasets_search", arguments: { query: "saude", limit: 5 } },
  { name: "open_dataset_preview", arguments: { dataset_url: DETAIL_UNIDADES, rows: 2 } },
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
