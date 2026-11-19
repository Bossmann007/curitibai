import { z } from "zod";
import { getSearchPage, PAGE_SIZE, PORTAL_LICENSE_NOTE, PORTAL_SEARCH_URL, type DatasetSummary } from "../sources/portal.js";
import { RateLimitedError } from "../http.js";
import { envelope, failFrom, ok, rateLimitedMessage, type ToolDef } from "./common.js";

export const openDatasetsSearchInput = {
  query: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .describe("Search term in Portuguese. The portal matches accents literally: try 'saúde' and 'saude'."),
  limit: z.number().int().min(1).max(20).default(5),
};
export const openDatasetsSearchOutput = envelope(
  z.object({
    total: z.number().int().nullable(),
    partial: z.boolean(),
    note: z.string().optional().describe("Present only when a later result page was refused with HTTP 429: how long to wait."),
    datasets: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        publisher: z.string().nullable(),
        description: z.string().nullable(),
        formats: z.array(z.string()),
        updated: z.string().nullable(),
        url: z.string().url(),
      }),
    ),
  }),
);

export const openDatasetsSearch: ToolDef<typeof openDatasetsSearchInput, typeof openDatasetsSearchOutput> = {
  name: "open_datasets_search",
  title: "Search Curitiba open datasets",
  description:
    "Search the Portal de Dados Abertos de Curitiba catalogue. Returns dataset ids, titles, publishers and detail-page URLs; pass an id to dataset_files. Read-only (the portal search is a form POST).",
  inputSchema: openDatasetsSearchInput,
  outputSchema: openDatasetsSearchOutput,
  handler: async ({ query, limit }) => {
    let datasets: DatasetSummary[] = [];
    let total: number | null = null;
    let fetchedAt = "";
    let partial = false;
    let note: string | undefined;
    const maxPages = Math.ceil(limit / PAGE_SIZE);
    for (let page = 1; page <= maxPages && datasets.length < limit; page++) {
      try {
        const res = await getSearchPage(query, page);
        if (page === 1) {
          total = res.value.total;
          fetchedAt = res.fetchedAt;
        }
        datasets = datasets.concat(res.value.items);
        if (!res.value.has_next) break;
      } catch (err) {
        if (page === 1) return failFrom(err);
        partial = true; // later pages are slow on the portal; keep what we have
        if (err instanceof RateLimitedError) note = rateLimitedMessage(err.retryAfterS);
        break;
      }
    }
    return ok({
      data: { total, partial, ...(note === undefined ? {} : { note }), datasets: datasets.slice(0, limit) },
      source_url: PORTAL_SEARCH_URL,
      fetched_at: fetchedAt,
      license_note: PORTAL_LICENSE_NOTE,
    });
  },
};
