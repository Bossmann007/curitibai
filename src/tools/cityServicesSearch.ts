import { z } from "zod";
import { closeFile, FileTooLargeError, LocalFileError, openDataFile, readAllCapped } from "../localfs.js";
import { dateInCuritiba } from "../sources/detran.js";
import { MASK, maskObject } from "../sources/pncp.js";
import { fold } from "../text.js";
import { fail, ok, type ToolDef } from "./common.js";

/** The catalog file the user keeps in CURITIBAI_DATA_DIR. This project does not ship or fetch it. */
export const CATALOG_FILE = "carta-servicos.json";
/** A full catalog is about 0.3 MB; anything over this is refused rather than parsed. */
export const CATALOG_MAX_BYTES = 4 * 1024 * 1024;
export const CITY_SERVICES_SOURCE_URL = "https://www.curitiba.pr.gov.br/servicos/";
/** Past this many days since the file's capture date (Curitiba time) the note says the catalog may be outdated. */
export const CITY_SERVICES_MAX_AGE_DAYS = 180;
/** Host of the city's obituary system (lists of deceased people): its links are never returned. */
export const OBITUARY_HOST = "obituarios.curitiba.pr.gov.br";

const OFFICIAL_URL = /^https:\/\/servicos\.curitiba\.pr\.gov\.br\/[a-z0-9-]+\/(\d+)$/;
/** "2026-11-19" or "2026-11-19/20" at the start of `captured`; the rest of that text is never echoed. */
const CAPTURED = /^(\d{4}-\d{2}-\d{2})(?:\/\d{2})?/;

export const CatalogFile = z.object({
  source: z.string().max(500).optional(),
  captured: z.string().max(500),
  count: z.number().int().min(0),
  items: z
    .array(
      z.object({
        cat: z.string().max(100).refine((v) => v.trim() !== ""),
        title: z.string().max(500).refine((v) => v.trim() !== ""),
        what: z.string().max(2000),
        url: z.string().regex(OFFICIAL_URL),
        online: z.string().max(2000).nullable(),
      }),
    )
    .max(5000),
});

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

export interface CityService {
  id: number;
  title: string;
  category: string;
  summary: string;
  official_url: string;
  online_url: string | null;
}

type Indexed = CityService & { folded: { title: string; all: string } };

export interface Catalog {
  services: Indexed[];
  categories: { name: string; count: number }[];
  /** First capture day (YYYY-MM-DD); the staleness warning counts from here. */
  checkedAt: string;
  /** The date part of `captured` as written ("2026-11-19/20"). */
  capturedText: string;
}

export class InvalidCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCatalogError";
  }
}

/** Validates the parsed file and builds the search index. Messages name the problem, never the file's text. */
export function buildCatalog(json: unknown): Catalog {
  const parsed = CatalogFile.safeParse(json);
  if (!parsed.success) {
    const where = parsed.error.issues[0]?.path.join(".") || "(root)";
    throw new InvalidCatalogError(`${CATALOG_FILE} does not have the expected shape (first problem at ${where}).`);
  }
  const { captured, count, items } = parsed.data;
  const date = CAPTURED.exec(captured);
  // Round trip: Date.parse rolls impossible days over ("2026-02-30" -> 2026-03-02), so compare the date back.
  const day = date ? Date.parse(`${date[1]}T00:00:00Z`) : NaN;
  if (!date || Number.isNaN(day) || new Date(day).toISOString().slice(0, 10) !== date[1]) {
    throw new InvalidCatalogError(`${CATALOG_FILE}: "captured" must start with a date (YYYY-MM-DD).`);
  }
  if (count !== items.length) throw new InvalidCatalogError(`${CATALOG_FILE}: "count" does not match the number of items.`);
  const seen = new Set<number>();
  const services = items.map((x): Indexed => {
    const id = Number(OFFICIAL_URL.exec(x.url)![1]);
    if (seen.has(id)) throw new InvalidCatalogError(`${CATALOG_FILE}: service id ${id} appears more than once.`);
    seen.add(id);
    const summary = guardedSummary(x.what);
    return {
      id,
      title: x.title,
      category: x.cat,
      summary,
      official_url: x.url,
      online_url: safeOnlineUrl(x.online),
      // Built from the returned (guarded) summary, so a query cannot probe text the mask hides.
      folded: { title: fold(x.title), all: `${fold(x.title)} ${fold(summary).replace(TEASER_LABEL, "")}` },
    };
  });
  const names = [...new Set(services.map((s) => s.category))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    services,
    categories: names.map((name) => ({ name, count: services.filter((s) => s.category === name).length })),
    checkedAt: date[1]!,
    capturedText: date[0],
  };
}

/** Reads and validates $CURITIBAI_DATA_DIR/carta-servicos.json on every call (the user may replace it at any time). */
export async function loadCatalog(): Promise<Catalog> {
  const { fd } = openDataFile(CATALOG_FILE, ".json");
  let bytes: Buffer;
  try {
    bytes = await readAllCapped(fd, CATALOG_MAX_BYTES);
  } finally {
    closeFile(fd);
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidCatalogError(`${CATALOG_FILE} is not valid UTF-8 JSON.`);
  }
  return buildCatalog(json);
}

export function cityServicesLicenseNote(catalog: Catalog): string {
  return (
    "Source: Prefeitura Municipal de Curitiba — Carta de Serviços (https://www.curitiba.pr.gov.br/servicos/), from a " +
    `local copy of its listing pages captured ${catalog.capturedText} (date from ${CATALOG_FILE}). The content belongs ` +
    "to the Prefeitura; no terms of use or licence was found for it. Titles and summaries are returned unchanged and " +
    "attributed to the Prefeitura, except that e-mail-, phone- and CPF/CNPJ-shaped text in a summary is replaced by " +
    "[masked]. Unofficial; not affiliated with the Prefeitura de Curitiba."
  );
}

const BASE_NOTE =
  `Read from the local file ${CATALOG_FILE} in CURITIBAI_DATA_DIR; this tool makes no network call. \`summary\` is ` +
  "the listing's own short \"O que é?\" teaser, often cut off and sometimes empty (those services are found by title " +
  "only); open `official_url` for the full page. The listing may not include every service. Confirm at the source " +
  "before acting.";

export const cityServicesSearchInput = {
  query: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .describe("Words to find in the service title or summary; accents, case and punctuation are ignored, every word must match."),
  category: z
    .string()
    .max(100)
    .optional()
    .describe("Exact category name. Call with no arguments to get the list."),
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
export function cityServicesStaleNote(today: string, checkedAt: string): string {
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${checkedAt}T00:00:00Z`)) / 86_400_000;
  return days > CITY_SERVICES_MAX_AGE_DAYS
    ? ` The catalog was captured ${days} days ago (more than ${CITY_SERVICES_MAX_AGE_DAYS}); it may be outdated.`
    : "";
}

/** Query words: folded, split on anything that is not a letter or digit ("segunda-via" = "segunda via"). */
export function queryWords(query: string): string[] {
  return fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export interface CityServicesSearchArgs {
  query?: string | undefined;
  category?: string | undefined;
  online_only?: boolean | undefined;
  limit: number;
  offset: number;
}

export function cityServicesSearchResult(catalog: Catalog, args: CityServicesSearchArgs, now: Date) {
  const words = args.query === undefined ? [] : queryWords(args.query);
  const matches = catalog.services.filter(
    (s) =>
      (args.category === undefined || s.category === args.category) &&
      (!args.online_only || s.online_url !== null) &&
      words.every((w) => s.folded.all.includes(w)),
  );
  // Title hits first, then by title; ids break ties so paging is stable.
  const inTitle = new Set(words.length > 0 ? matches.filter((s) => words.every((w) => s.folded.title.includes(w))) : []);
  const rank = (s: Indexed) => (inTitle.has(s) ? 0 : 1);
  matches.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, "pt-BR") || a.id - b.id);
  const page = matches.slice(args.offset, args.offset + args.limit);
  const end = args.offset + page.length;
  const noFilter = args.query === undefined && args.category === undefined && args.online_only === undefined;
  return {
    data: {
      total: matches.length,
      offset: args.offset,
      next_offset: end < matches.length ? end : null,
      items: page.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        summary: s.summary,
        official_url: s.official_url,
        online_url: s.online_url,
      })),
      ...(noFilter ? { categories: catalog.categories.map((c) => ({ ...c })) } : {}),
    },
    source_url: CITY_SERVICES_SOURCE_URL,
    checked_at: catalog.checkedAt,
    license_note: cityServicesLicenseNote(catalog),
    note: BASE_NOTE + cityServicesStaleNote(dateInCuritiba(now), catalog.checkedAt),
  };
}

const NOT_AVAILABLE =
  `The catalog is not shipped with this server. Put ${CATALOG_FILE} in the folder set by CURITIBAI_DATA_DIR ` +
  "(see the README).";

export const cityServicesSearch: ToolDef<typeof cityServicesSearchInput, typeof cityServicesSearchOutput> = {
  name: "city_services_search",
  title: "Curitiba city services catalog (Carta de Serviços)",
  description:
    "Search the Prefeitura de Curitiba service catalog (Carta de Serviços): what each city service is, its category, " +
    "the official page and the online link when there is one. Filter by words, by category or to online services. " +
    `Call with no arguments to list the categories. Reads a local copy (${CATALOG_FILE} in CURITIBAI_DATA_DIR) that ` +
    "the user provides; no network call. Read-only.",
  inputSchema: cityServicesSearchInput,
  outputSchema: cityServicesSearchOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    if (args.query !== undefined && queryWords(args.query).length === 0) {
      return fail("invalid_argument", "query must contain at least one letter or digit.");
    }
    let catalog: Catalog;
    try {
      catalog = await loadCatalog();
    } catch (err) {
      if (err instanceof LocalFileError) {
        return err.code === "file_not_allowed" ? fail("file_not_allowed") : fail("data_not_available", NOT_AVAILABLE);
      }
      if (err instanceof FileTooLargeError) {
        return fail("invalid_data", `${CATALOG_FILE} is larger than ${CATALOG_MAX_BYTES / (1024 * 1024)} MB.`);
      }
      if (err instanceof InvalidCatalogError) return fail("invalid_data", err.message);
      return fail("invalid_data", `${CATALOG_FILE} could not be read.`);
    }
    if (args.category !== undefined && !catalog.categories.some((c) => c.name === args.category)) {
      return fail("invalid_argument", `category must be one of: ${catalog.categories.map((c) => c.name).join("; ")}.`);
    }
    return ok(cityServicesSearchResult(catalog, args, new Date()));
  },
};
