import { sharedCache, type Cached } from "../cache.js";
import { fetchText, SourceUnavailableError } from "../http.js";
import { htmlToText } from "../text.js";

export const PORTAL_BASE = "https://dadosabertos.curitiba.pr.gov.br";
export const PORTAL_SEARCH_URL = `${PORTAL_BASE}/conjuntodado/`;
export const PAGE_SIZE = 5;

export const PORTAL_LICENSE_NOTE =
  "Data accessed via the Portal de Dados Abertos de Curitiba (https://dadosabertos.curitiba.pr.gov.br/), " +
  "licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Cite the publishing body shown with each dataset. " +
  "\"O Portal de Dados Abertos de Curitiba e o órgão ou entidade de onde foram acessados os dados não garantem sua " +
  "autenticidade, qualidade, integridade e atualidade após terem sido disponibilizados para uso secundário.\" " +
  "Unofficial; not affiliated with Prefeitura de Curitiba.";

export interface DatasetSummary {
  id: string;
  title: string;
  publisher: string | null;
  description: string | null;
  formats: string[];
  updated: string | null;
  url: string;
}

export interface SearchPage {
  total: number | null;
  items: DatasetSummary[];
  has_next: boolean;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSearchPage(html: string): SearchPage {
  const totalMatch = /<div class="resultados">\s*(\d+)\s*resultados?/i.exec(html);
  if (!totalMatch && !html.includes('id="resultadosConjunto"')) throw new SourceUnavailableError("unexpected search page");
  const items: DatasetSummary[] = [];
  const cardRe = /<a href="[^"]*\/conjuntodado\/detalhe\/?\?chave=([0-9a-fA-F-]{36})"\s*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(cardRe)) {
    const id = (m[1] ?? "").toLowerCase();
    const card = m[2] ?? "";
    if (!GUID.test(id)) continue;
    const pick = (re: RegExp) => {
      const r = re.exec(card);
      return r?.[1] !== undefined ? htmlToText(r[1]) || null : null;
    };
    const updated = pick(/Atualizado em:\s*([0-9/]+)/);
    items.push({
      id,
      title: pick(/<h3>([\s\S]*?)<\/h3>/) ?? "",
      publisher: pick(/<div class="secretaria">([\s\S]*?)<\/div>/),
      description: pick(/<div class="descricao">([\s\S]*?)<\/div>/),
      formats: [...card.matchAll(/<span class="files [^"]*">([^<]*)<\/span>/g)].map((f) => htmlToText(f[1] ?? "")).filter(Boolean),
      updated: updated ? toIsoDate(updated) : null,
      url: `${PORTAL_BASE}/conjuntodado/detalhe?chave=${id}`,
    });
  }
  const pages = [...html.matchAll(/<button[^>]*class="pagina"[^>]*value="(\d+)"([^>]*)>/g)];
  const current = pages.find((p) => /disabled/.test(p[2] ?? ""));
  const currentNo = current ? Number(current[1]) : 1;
  const has_next = pages.some((p) => Number(p[1]) > currentNo);
  return { total: totalMatch ? Number(totalMatch[1]) : null, items, has_next };
}

function toIsoDate(ddmmyyyy: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function getSearchPage(query: string, page: number): Promise<Cached<SearchPage>> {
  const form = { "Parametros.Termo": query, "Parametros.IndicePagina": String(page), cookie: "true" };
  const key = `POST ${PORTAL_SEARCH_URL} ${new URLSearchParams(form).toString()}`;
  return sharedCache.getOrLoad(key, async () =>
    parseSearchPage((await fetchText(PORTAL_SEARCH_URL, { method: "POST", form })).body),
  );
}

export interface DatasetPreview {
  title: string | null;
  columns: string[];
  rows: string[][];
  note: string | null;
}

/** Reads the preview table (`div.tabelaBaseDados#tabela_*`) that dataset detail pages embed. Data dictionaries are ignored. */
export function parseDatasetPreview(html: string, maxRows: number): DatasetPreview {
  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1] ? htmlToText(titleMatch[1]).replace(/^Detalhes do Conjunto de Dados\s*-\s*/, "").replace(/\s*-\s*Dados Abertos\s*$/, "") || null : null;
  const block = /<div class="tabelaBaseDados" id="tabela_[^"]*">\s*<table[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!block?.[1]) {
    return { title, columns: [], rows: [], note: "No preview table on this page (the dataset may have no tabular base)." };
  }
  const table = block[1];
  const cells = (row: string, tag: "th" | "td") =>
    [...row.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((c) => htmlToText(c[1] ?? ""));
  const headRow = /<thead>\s*<tr[^>]*>([\s\S]*?)<\/tr>/i.exec(table);
  const columns = headRow?.[1] ? cells(headRow[1], "th") : [];
  const bodyPart = table.split(/<\/thead>/i)[1] ?? table;
  const rows = [...bodyPart.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((r) => cells(r[1] ?? "", "td"))
    .filter((r) => r.length > 0)
    .slice(0, maxRows);
  return { title, columns, rows, note: null };
}

export function getDatasetPage(url: string): Promise<Cached<{ url: string; html: string }>> {
  return sharedCache.getOrLoad(`GET ${url}`, async () => {
    const res = await fetchText(url);
    if (!/text\/html/i.test(res.contentType)) throw new SourceUnavailableError("not an HTML dataset page");
    return { url: res.url, html: res.body };
  });
}
