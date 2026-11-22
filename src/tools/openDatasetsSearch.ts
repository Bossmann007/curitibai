import { z } from "zod";
import { getSearchPage, PAGE_SIZE, PORTAL_LICENSE_NOTE, PORTAL_SEARCH_URL, type DatasetSummary } from "../sources/portal.js";
import { PORTAL_SYNONYMS } from "../sources/portalSynonyms.js";
import { RateLimitedError, SourceUnavailableError } from "../http.js";
import { fold } from "../text.js";
import { envelope, failFrom, ok, rateLimitedMessage, type ToolDef } from "./common.js";

export const openDatasetsSearchInput = {
  query: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .describe(
      "Search term in Portuguese. When it finds nothing, the search is retried once without accents and then with a " +
        "short list of synonyms (e.g. 'ônibus' → 'transporte coletivo'); `note` says which query matched.",
    ),
  limit: z.number().int().min(1).max(20).default(5),
};
export const openDatasetsSearchOutput = envelope(
  z.object({
    total: z.number().int().nullable(),
    partial: z.boolean(),
    note: z
      .string()
      .optional()
      .describe(
        "Present when the query was retried (which query matched, or every query tried) or when a later request was " +
          "refused with HTTP 429 (how long to wait).",
      ),
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
    "Search the Portal de Dados Abertos de Curitiba catalogue. Returns dataset ids, titles, publishers and detail-page URLs; pass an id to dataset_files. " +
    "A query with no results is retried without accents and then with a synonym; `note` says which query matched. Read-only (the portal search is a form POST).",
  inputSchema: openDatasetsSearchInput,
  outputSchema: openDatasetsSearchOutput,
  handler: async ({ query, limit }) => {
    let datasets: DatasetSummary[] = [];
    let total: number | null = null;
    let fetchedAt = "";
    let partial = false;
    const notes: string[] = [];
    // Page 1 of the query, then of its accent-free form, then of its synonym, until one has results.
    const tries = [query];
    const stripped = query.normalize("NFD").replace(/\p{M}/gu, "");
    if (stripped !== query) tries.push(stripped);
    const synonym = PORTAL_SYNONYMS[fold(query).replace(/\s+/g, " ")];
    if (synonym !== undefined && !tries.includes(synonym)) tries.push(synonym);
    let matched = query;
    let hasNext = false;
    for (const [i, q] of tries.entries()) {
      try {
        const res = await getSearchPage(q, 1);
        if (i === 0) fetchedAt = res.fetchedAt;
        if (res.value.items.length === 0 && i < tries.length - 1) continue;
        ({ total, items: datasets, has_next: hasNext } = res.value);
        fetchedAt = res.fetchedAt;
        matched = q;
        if (i > 0) {
          const tried = tries.slice(0, i + 1).map((t) => `"${t}"`);
          notes.push(
            datasets.length > 0
              ? `No results for ${tried.slice(0, -1).join(", ")}; showing results for ${tried.at(-1)}.`
              : `No results for ${tried.slice(0, -1).join(", ")} or ${tried.at(-1)}.`,
          );
        }
        break;
      } catch (err) {
        if (i === 0) return failFrom(err);
        // A retry failed: keep the first query's empty answer.
        total = 0;
        partial = true;
        notes.push(
          err instanceof RateLimitedError
            ? rateLimitedMessage(err.retryAfterS)
            : `Retrying as "${q}" failed (${err instanceof SourceUnavailableError ? err.reason : "error"}).`,
        );
        break;
      }
    }
    const maxPages = Math.ceil(limit / PAGE_SIZE);
    for (let page = 2; hasNext && page <= maxPages && datasets.length < limit; page++) {
      try {
        const res = await getSearchPage(matched, page);
        datasets = datasets.concat(res.value.items);
        hasNext = res.value.has_next;
      } catch (err) {
        partial = true; // later pages are slow on the portal; keep what we have
        if (err instanceof RateLimitedError) notes.push(rateLimitedMessage(err.retryAfterS));
        break;
      }
    }
    return ok({
      data: { total, partial, ...(notes.length === 0 ? {} : { note: notes.join(" ") }), datasets: datasets.slice(0, limit) },
      source_url: PORTAL_SEARCH_URL,
      fetched_at: fetchedAt,
      license_note: PORTAL_LICENSE_NOTE,
    });
  },
};
