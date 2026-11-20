import { z } from "zod";
import { dateInCuritiba } from "../sources/detran.js";
import { CATEGORIES, ROWS } from "../sources/cityServicesData.js";
import { MASK, maskObject } from "../sources/pncp.js";
import { fold } from "../text.js";
import { fail, ok, type ToolDef } from "./common.js";

/** First day of the capture (it ran 2026-11-19/20); the staleness warning counts from here. */
export const CITY_SERVICES_CHECKED_AT = "2026-11-19";
export const CITY_SERVICES_SOURCE_URL = "https://www.curitiba.pr.gov.br/servicos/";
/** Past this many days since CITY_SERVICES_CHECKED_AT (Curitiba time) the note says the catalog may be outdated. */
export const CITY_SERVICES_MAX_AGE_DAYS = 180;
/** Host of the city's obituary system (lists of deceased people): its links are never returned. */
export const OBITUARY_HOST = "obituarios.curitiba.pr.gov.br";

export const CITY_SERVICES_LICENSE_NOTE =
  "Source: Prefeitura Municipal de Curitiba — Carta de Serviços (https://www.curitiba.pr.gov.br/servicos/), " +
  "listing pages captured 2026-11-19/20 (America/Sao_Paulo) with a scripted browser session; detail pages were never " +
  "opened. No terms of use or licence was found for the " +
  "site content; titles and summaries are returned unchanged and attributed to the Prefeitura, except that e-mail-, " +
  "phone- and CPF/CNPJ-shaped text in a summary is replaced by [masked] (two summaries in this snapshot). Unofficial; not " +
  "affiliated with the Prefeitura de Curitiba.";

const BASE_NOTE =
  "Bundled snapshot; this tool makes no network call. `summary` is the listing's own short \"O que é?\" teaser, " +
  "often cut off by the site; open `official_url` for the full page. The capture found 756 services while the site's " +
  "paginator suggested about 770, so a few services may be missing. Confirm at the source before acting.";

export interface CityService {
  id: number;
  title: string;
  category: string;
  summary: string;
  official_url: string;
  online_url: string | null;
}

/** `online` unless it points to the obituary system. Unparseable, non-http(s) and credential-bearing URLs are dropped too. */
export function safeOnlineUrl(online: string | null): string | null {
  if (online === null) return null;
  try {
    const u = new URL(online);
    const host = u.hostname.toLowerCase().replace(/\.$/, "");
    const obituary = host === OBITUARY_HOST || host.endsWith(`.${OBITUARY_HOST}`);
    const credentials = u.username !== "" || u.password !== "";
    return (u.protocol === "https:" || u.protocol === "http:") && !obituary && !credentials ? online : null;
  } catch {
    return null;
  }
}

/** The teaser as published, unless the PII guard finds something to mask; only then the masked text. */
export function guardedSummary(what: string): string {
  const masked = maskObject(what);
  return masked.text.includes(MASK) || masked.truncated ? masked.text : what;
}

/** The site's own "O que é?" / "O que são?" label (spacing and "?" vary); left out of the search text only. */
const TEASER_LABEL = /^\s*o que (?:sao|e)\??/;

export const SERVICES: readonly (CityService & { folded: { title: string; all: string } })[] = ROWS.map(
  ([cat, title, what, url, online]) => {
    const summary = guardedSummary(what);
    return {
      id: Number(url.slice(url.lastIndexOf("/") + 1)),
      title,
      category: CATEGORIES[cat]!,
      summary,
      official_url: url,
      online_url: safeOnlineUrl(online),
      // Built from the returned (guarded) summary, so a query cannot probe text the mask hides.
      folded: { title: fold(title), all: `${fold(title)} ${fold(summary).replace(TEASER_LABEL, "")}` },
    };
  },
);

const CATEGORY_COUNTS = CATEGORIES.map((name) => ({ name, count: SERVICES.filter((s) => s.category === name).length }));

export const cityServicesSearchInput = {
  query: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .describe("Words to find in the service title or summary; accents and case are ignored, every word must match."),
  category: z
    .string()
    .max(100)
    .optional()
    .describe(`Exact category name, one of: ${CATEGORIES.join("; ")}.`),
  online_only: z.boolean().optional().describe("true: only services with an online link."),
  limit: z.number().int().min(1).max(20).default(10),
  offset: z.number().int().min(0).max(10_000).default(0).describe("Results to skip, for paging."),
};

const Service = z.object({
  id: z.number().int(),
  title: z.string(),
  category: z.string(),
  summary: z.string(),
  official_url: z.string().url(),
  online_url: z.string().url().nullable(),
});

export const cityServicesSearchOutput = z.object({
  data: z.object({
    total: z.number().int(),
    offset: z.number().int(),
    next_offset: z.number().int().nullable(),
    items: z.array(Service),
    categories: z.array(z.object({ name: z.string(), count: z.number().int() })).optional(),
  }),
  source_url: z.string().url(),
  checked_at: z.string().date(),
  license_note: z.string(),
  note: z.string(),
});

/** Age warning once more than CITY_SERVICES_MAX_AGE_DAYS have passed since checkedAt. `today` is a Curitiba date. */
export function cityServicesStaleNote(today: string, checkedAt: string = CITY_SERVICES_CHECKED_AT): string {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${checkedAt}T00:00:00Z`)) / 86_400_000;
  return days > CITY_SERVICES_MAX_AGE_DAYS
    ? ` The catalog was captured ${days} days ago (more than ${CITY_SERVICES_MAX_AGE_DAYS}); it may be outdated.`
    : "";
}

export interface CityServicesSearchArgs {
  query?: string | undefined;
  category?: string | undefined;
  online_only?: boolean | undefined;
  limit: number;
  offset: number;
}

/** Query words: folded, split on anything that is not a letter or digit ("segunda-via" = "segunda via"). */
export function queryWords(query: string): string[] {
  return fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function cityServicesSearchResult(args: CityServicesSearchArgs, now: Date) {
  const words = args.query === undefined ? [] : queryWords(args.query);
  const matches = SERVICES.filter(
    (s) =>
      (args.category === undefined || s.category === args.category) &&
      (!args.online_only || s.online_url !== null) &&
      words.every((w) => s.folded.all.includes(w)),
  );
  // Title hits first, then by title; ids break ties so paging is stable.
  const inTitle = new Set(words.length > 0 ? matches.filter((s) => words.every((w) => s.folded.title.includes(w))) : []);
  const rank = (s: (typeof SERVICES)[number]) => (inTitle.has(s) ? 0 : 1);
  matches.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, "pt-BR") || a.id - b.id);
  const page = matches.slice(args.offset, args.offset + args.limit);
  const end = args.offset + page.length;
  const noFilter = args.query === undefined && args.category === undefined && args.online_only === undefined;
  return {
    data: {
      total: matches.length,
      offset: args.offset,
      next_offset: end < matches.length ? end : null,
      items: page.map((s) => ({ id: s.id, title: s.title, category: s.category, summary: s.summary, official_url: s.official_url, online_url: s.online_url })),
      ...(noFilter
        ? { categories: CATEGORY_COUNTS.map((c) => ({ ...c })) }
        : {}),
    },
    source_url: CITY_SERVICES_SOURCE_URL,
    checked_at: CITY_SERVICES_CHECKED_AT,
    license_note: CITY_SERVICES_LICENSE_NOTE,
    note: BASE_NOTE + cityServicesStaleNote(dateInCuritiba(now)),
  };
}

export const cityServicesSearch: ToolDef<typeof cityServicesSearchInput, typeof cityServicesSearchOutput> = {
  name: "city_services_search",
  title: "Curitiba city services catalog (Carta de Serviços)",
  description:
    "Search the Prefeitura de Curitiba service catalog (Carta de Serviços): what each city service is, its category, " +
    "the official page and the online link when there is one. Filter by words, by category or to online services. " +
    "Call with no arguments to list the categories. Bundled snapshot; no network call. Read-only.",
  inputSchema: cityServicesSearchInput,
  outputSchema: cityServicesSearchOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    if (args.category !== undefined && !(CATEGORIES as readonly string[]).includes(args.category)) {
      return fail("invalid_argument", `category must be one of: ${CATEGORIES.join("; ")}.`);
    }
    if (args.query !== undefined && queryWords(args.query).length === 0) {
      return fail("invalid_argument", "query must contain at least one letter or digit.");
    }
    return ok(cityServicesSearchResult(args, new Date()));
  },
};
