import { z } from "zod";
import { sharedCache, type Cached } from "../cache.js";
import { fetchText, SourceUnavailableError } from "../http.js";
import { htmlToText } from "../text.js";

export const PORTAL_BASE = "https://dadosabertos.curitiba.pr.gov.br";
export const PORTAL_SEARCH_URL = `${PORTAL_BASE}/conjuntodado/`;
export const PAGE_SIZE = 5;
export const FILES_PAGE_SIZE = 50;

/** The sentence the portal's rules ask every reuse of its data to carry, quoted in each note about portal data. */
export const PORTAL_DISCLAIMER =
  "\"O Portal de Dados Abertos de Curitiba e o órgão ou entidade de onde foram acessados os dados não garantem sua " +
  "autenticidade, qualidade, integridade e atualidade após terem sido disponibilizados para uso secundário.\"";

export const PORTAL_LICENSE_NOTE =
  "Data accessed via the Portal de Dados Abertos de Curitiba (https://dadosabertos.curitiba.pr.gov.br/), " +
  "licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Cite the publishing body shown with each dataset. " +
  `${PORTAL_DISCLAIMER} ` +
  "Unofficial; not affiliated with Prefeitura de Curitiba.";

export const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function datasetUrl(id: string): string {
  if (!GUID_RE.test(id)) throw new Error("invalid dataset id");
  return `${PORTAL_BASE}/conjuntodado/detalhe?chave=${id.toLowerCase()}`;
}

// ---------- catalogue search ----------

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

export function parseSearchPage(html: string): SearchPage {
  const totalMatch = /<div class="resultados">\s*(\d+)\s*resultados?/i.exec(html);
  if (!totalMatch && !html.includes('id="resultadosConjunto"')) throw new SourceUnavailableError("unexpected search page");
  const items: DatasetSummary[] = [];
  const cardRe = /<a href="[^"]*\/conjuntodado\/detalhe\/?\?chave=([0-9a-fA-F-]{36})"\s*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(cardRe)) {
    const id = (m[1] ?? "").toLowerCase();
    const card = m[2] ?? "";
    if (!GUID_RE.test(id)) continue;
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
      url: datasetUrl(id),
    });
  }
  const pages = [...html.matchAll(/<button[^>]*class="pagina"[^>]*value="(\d+)"([^>]*)>/g)];
  const current = pages.find((p) => /disabled/.test(p[2] ?? ""));
  const currentNo = current ? Number(current[1]) : 1;
  const has_next = pages.some((p) => Number(p[1]) > currentNo);
  const empty = /Nenhum resultado encontrado/i.test(html);
  return { total: totalMatch ? Number(totalMatch[1]) : empty ? 0 : null, items, has_next };
}

function toIsoDate(ddmmyyyy: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** "03/11/2026 21:58" -> "2026-11-03T21:58" (portal local time, America/Sao_Paulo). */
function toIsoLocal(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  return m[4] ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}` : `${m[3]}-${m[2]}-${m[1]}`;
}

export function getSearchPage(query: string, page: number): Promise<Cached<SearchPage>> {
  const form = { "Parametros.Termo": query, "Parametros.IndicePagina": String(page), cookie: "true" };
  const key = `POST ${PORTAL_SEARCH_URL} ${new URLSearchParams(form).toString()}`;
  return sharedCache.getOrLoad(key, async () =>
    parseSearchPage((await fetchText(PORTAL_SEARCH_URL, { method: "POST", form })).body),
  );
}

// ---------- dataset file links ----------

export interface DownloadKeys {
  dataset: string;
  extension: string;
}

/** Reads the `downloadArquivos('<dataset>', '<extension>')` call of a detail page; null when the dataset has no files. */
export function parseDownloadKeys(html: string): DownloadKeys | null {
  const m = /downloadArquivos\(\s*'([0-9a-fA-F-]{36})'\s*,\s*'([0-9a-fA-F-]{36})'\s*\)/.exec(html);
  if (!m?.[1] || !m[2] || !GUID_RE.test(m[1]) || !GUID_RE.test(m[2])) return null;
  return { dataset: m[1].toLowerCase(), extension: m[2].toLowerCase() };
}

export function filesListUrl(keys: DownloadKeys, page: number): string {
  const q = new URLSearchParams({
    conjuntoDadoChave: keys.dataset,
    conjuntoDadoExtensao: keys.extension,
    pagina: String(page),
    tamanhoPagina: String(FILES_PAGE_SIZE),
  });
  return `${PORTAL_BASE}/ConjuntoDado/DownloadArquivos/?${q.toString()}`;
}

export interface DatasetFile {
  name: string;
  url: string;
  format: string | null;
  dictionary_url: string | null;
  updated: string | null;
  size: string | null;
}

export interface FilesPage {
  page: number;
  total_pages: number;
  total: number;
  files: DatasetFile[];
}

const FilesJson = z.object({
  sucesso: z.boolean(),
  tabela: z.string().nullish(),
  paginacao: z.object({ pagina: z.number(), totalPaginas: z.number(), total: z.number() }).nullish(),
  erro: z.string().nullish(),
});

/** Only https links are kept. They are returned as data; this server never requests them. */
function httpsUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function parseFilesJson(json: unknown): FilesPage {
  const parsed = FilesJson.safeParse(json);
  if (!parsed.success || !parsed.data.sucesso) throw new SourceUnavailableError("unexpected files listing");
  const { tabela, paginacao } = parsed.data;
  const files: DatasetFile[] = [];
  const body = (tabela ?? "").split(/<tbody>/i)[1] ?? "";
  for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(row[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1] ?? "");
    const link = /<a href='([^']*)'>([\s\S]*?)<\/a>/i.exec(cells[0] ?? "");
    const url = httpsUrl(link?.[1]);
    if (!url) continue;
    const name = htmlToText(link?.[2] ?? "") || url.split("/").pop() || url;
    const ext = /\.([a-z0-9]{1,6})$/i.exec(name)?.[1];
    files.push({
      name,
      url,
      format: ext ? ext.toLowerCase() : null,
      dictionary_url: httpsUrl(/<a href='([^']*)'/i.exec(cells[1] ?? "")?.[1]),
      updated: toIsoLocal(htmlToText(cells[2] ?? "")),
      size: htmlToText(cells[3] ?? "") || null,
    });
  }
  return {
    page: paginacao?.pagina ?? 1,
    total_pages: paginacao?.totalPaginas ?? 1,
    total: paginacao?.total ?? files.length,
    files,
  };
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new SourceUnavailableError("invalid JSON");
  }
}

export interface DatasetFilesResult {
  title: string | null;
  keys: DownloadKeys | null;
  listing: FilesPage | null;
  listUrl: string | null;
}

/** Two small requests to the portal: the detail page (for the download keys), then the JSON file listing. */
export function getDatasetFiles(id: string, page: number): Promise<Cached<DatasetFilesResult>> {
  const detail = datasetUrl(id);
  return sharedCache.getOrLoad(`FILES ${detail} ${page}`, async () => {
    const html = (await fetchText(detail)).body;
    const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
    const title = titleMatch?.[1]
      ? htmlToText(titleMatch[1]).replace(/^Detalhes do Conjunto de Dados\s*-\s*/, "").replace(/\s*-\s*Dados Abertos\s*$/, "") || null
      : null;
    const keys = parseDownloadKeys(html);
    if (!keys) return { title, keys: null, listing: null, listUrl: null };
    const listUrl = filesListUrl(keys, page);
    const listing = parseFilesJson(parseJson((await fetchText(listUrl)).body));
    return { title, keys, listing, listUrl };
  });
}
