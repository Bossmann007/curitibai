import { z } from "zod";
import {
  getPublicationPage,
  MODALITIES,
  PNCP_LICENSE_NOTE,
  publicationUrl,
  type Procurement,
} from "../sources/pncp.js";
import { fold } from "../text.js";
import { RateLimitedError, SourceRefusedError } from "../http.js";
import { OutOfTimeError } from "../hostGate.js";
import { CALL_START_BUDGET_MS, envelope, fail, failFrom, ok, rateLimitedMessage, refusedPageNote, type ToolDef } from "./common.js";

/**
 * Upstream pages requested per call, at most, and none starts after CALL_START_BUDGET_MS: at 8–13 s per page
 * (2026-11-19) that is usually 2 or 3 pages. Kept low because PNCP answered 429 after about 20 requests in 2 minutes.
 */
export const MAX_PNCP_REQUESTS = 5;
export const DEFAULT_MODALITY = 6;
export const DEFAULT_DAYS = 30;
/** PNCP refuses a range over 365 days (HTTP 422). */
export const MAX_RANGE_DAYS = 365;

export const SCOPE_NOTE =
  "Procurement published in PNCP by Curitiba municipal bodies (the city, its câmara, funds, foundations, institutes, " +
  "URBS and COHAB-CT, as listed in docs/sources.md). Suppliers are never returned. Objects of dispensa, inexigibilidade, " +
  "credenciamento and inaplicabilidade are withheld because they may name a person; other objects are returned as published with " +
  "CPF/CNPJ-shaped numbers, e-mails and phones masked, and may still, rarely, contain a person's name.";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), {
    message: "invalid date",
  });

export const procurementSearchInput = {
  query: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .describe("Text in the returned object or the body name, accents and case ignored (e.g. 'medicamentos', 'FAS')."),
  from: isoDate.optional().describe(`First publication date, YYYY-MM-DD. Default: ${DEFAULT_DAYS} days before 'to'.`),
  to: isoDate.optional().describe("Last publication date, YYYY-MM-DD. Default: today (Brasília). Range ≤ 365 days."),
  modality: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(DEFAULT_MODALITY)
    .describe(
      "PNCP modality code (PNCP needs exactly one per query): " +
        Object.entries(MODALITIES)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ") +
        `. Default ${DEFAULT_MODALITY}.`,
    ),
  limit: z.number().int().min(1).max(20).default(10),
  page: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(1)
    .describe("Upstream page to start scanning from; pass the previous result's next_page to continue."),
  skip: z
    .number()
    .int()
    .min(0)
    .max(50)
    .default(0)
    .describe("Matches to skip on the first scanned page; pass the previous result's next_skip to continue."),
};

const itemSchema = z.object({
  pncp_id: z.string(),
  body_cnpj: z.string(),
  body_name: z.string(),
  modality_code: z.number().int().nullable(),
  modality: z.string().nullable(),
  object: z.string().nullable(),
  object_withheld: z.literal("may_name_a_person").nullable(),
  object_truncated: z.boolean(),
  estimated_value: z.number().nullable(),
  status_code: z.number().int().nullable(),
  status: z.string().nullable(),
  published_at: z.string().nullable(),
  proposals_open_at: z.string().nullable(),
  proposals_close_at: z.string().nullable(),
  link: z.string().url(),
});

export const procurementSearchOutput = envelope(
  z.object({
    items: z.array(itemSchema),
    from: z.string(),
    to: z.string(),
    modality: z.number().int(),
    scanned_pages: z.object({ from: z.number().int(), to: z.number().int() }),
    next_page: z.number().int().nullable(),
    next_skip: z.number().int(),
    partial: z.boolean(),
    discarded: z.number().int().describe("Records of a listed body dropped because a required field was missing or malformed."),
    note: z.string(),
  }),
);

/** Today's date in Brasília (UTC-3, no daylight saving since 2019), as YYYY-MM-DD. */
export function todayBrasilia(now: number = Date.now()): string {
  return new Date(now - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

const compact = (iso: string) => iso.replaceAll("-", "");

export const procurementSearch: ToolDef<typeof procurementSearchInput, typeof procurementSearchOutput> = {
  name: "procurement_search",
  title: "Search procurement of Curitiba municipal bodies (PNCP)",
  description:
    "Search contratações (licitações, dispensas, inexigibilidades...) published in the national PNCP portal by " +
    "Curitiba municipal bodies: body, modality, object, estimated value, status, publication and proposal dates, link " +
    "to the official PNCP page. One modality per call (default 6, Pregão - Eletrônico), publication dates up to 365 " +
    "days apart (default the last 30 days). Never returns suppliers. Objects of dispensa, inexigibilidade, " +
    "credenciamento and inaplicabilidade are withheld (object null, object_withheld set) because they may name a person; other objects " +
    "are returned as published with CPF/CNPJ-shaped numbers, e-mails and phones masked, and may rarely still contain " +
    "a name. Scans upstream pages of 50 until limit items match, at most 5 pages and no new page after 20 s per call (PNCP takes " +
    "8–13 s per page); continue with next_page and next_skip. Read-only.",
  inputSchema: procurementSearchInput,
  outputSchema: procurementSearchOutput,
  handler: async ({ query, from, to, modality, limit, page, skip }) => {
    const end = to ?? todayBrasilia();
    const start = from ?? addDays(end, -DEFAULT_DAYS);
    const span = (Date.parse(end) - Date.parse(start)) / 86_400_000;
    if (span < 0) return fail("invalid_date_range", "'from' is after 'to'.");
    if (span > MAX_RANGE_DAYS) return fail("invalid_date_range", `PNCP accepts at most ${MAX_RANGE_DAYS} days.`);
    const f = compact(start);
    const t = compact(end);
    const needle = query === undefined ? null : fold(query).replace(/\s+/g, " ");
    const matches = (it: Procurement) =>
      needle === null || fold(it.body_name).includes(needle) || (it.object !== null && fold(it.object).includes(needle));

    try {
      const items: Procurement[] = [];
      let fetchedAt = "";
      let nextPage: number | null = null;
      let nextSkip = 0;
      let partial = false;
      let discarded = 0;
      let p = page;
      let scanned = 0;
      let rateLimitNote: string | null = null;
      let refusedNote: string | null = null;
      let budgetReached = false;
      const started = Date.now();
      for (;;) {
        if (scanned === MAX_PNCP_REQUESTS) {
          partial = true; // capped: more pages may hold matches
          nextPage = p;
          break;
        }
        // Wall clock since the first request, so a 429 retry wait counts too.
        if (scanned > 0 && Date.now() - started > CALL_START_BUDGET_MS) {
          partial = true; // the source is slow: return what we have rather than risk the client's timeout
          budgetReached = true;
          nextPage = p;
          break;
        }
        let res;
        try {
          res = await getPublicationPage(f, t, modality, p, started + CALL_START_BUDGET_MS);
        } catch (err) {
          if (err instanceof OutOfTimeError && scanned > 0) {
            partial = true; // the host gate's next turn comes after the time budget
            budgetReached = true;
            nextPage = p;
            break;
          }
          if (scanned === 0) throw err;
          partial = true;
          if (err instanceof SourceRefusedError) {
            refusedNote = refusedPageNote(p, err.status);
            break; // next_page stays null: following it would ask the host again
          }
          nextPage = p;
          if (err instanceof RateLimitedError) rateLimitNote = rateLimitedMessage(err.retryAfterS);
          break;
        }
        if (scanned === 0) fetchedAt = res.fetchedAt;
        scanned++;
        if (!(scanned === 1 && skip > 0)) discarded += res.value.discarded;
        const skipped = scanned === 1 ? skip : 0;
        const found = res.value.items.filter(matches);
        const room = limit - items.length;
        const taken = found.slice(skipped, skipped + room);
        items.push(...taken);
        if (found.length > skipped + taken.length) {
          nextPage = p;
          nextSkip = skipped + taken.length;
          break;
        }
        if (res.value.lastPage) break;
        if (items.length === limit) {
          nextPage = p + 1;
          break;
        }
        p++;
      }
      const notes = [`Modality ${modality} (${MODALITIES[modality]}), published ${start} to ${end}.`, SCOPE_NOTE];
      if (refusedNote !== null) notes.unshift(refusedNote);
      else if (partial) {
        const why = budgetReached ? ` (the ${CALL_START_BUDGET_MS / 1000} s time budget was reached)` : "";
        notes.unshift(`Stopped after ${scanned} upstream page(s)${why}; continue with next_page.`);
      }
      if (rateLimitNote !== null) notes.unshift(rateLimitNote);
      return ok({
        data: {
          items,
          from: start,
          to: end,
          modality,
          scanned_pages: { from: page, to: page + scanned - 1 },
          next_page: nextPage,
          next_skip: nextSkip,
          partial,
          discarded,
          note: notes.join(" "),
        },
        source_url: publicationUrl(f, t, modality, page),
        fetched_at: fetchedAt,
        license_note: PNCP_LICENSE_NOTE,
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
