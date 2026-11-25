import { z } from "zod";
import {
  CNES_LICENSE_NOTE,
  CNES_PAGE_SIZE,
  establishmentsUrl,
  getEstablishmentsPage,
  getUnitTypes,
  resolveUnitTypes,
  type HealthUnit,
} from "../sources/cnes.js";
import { fold } from "../text.js";
import { RateLimitedError, SourceRefusedError } from "../http.js";
import { OutOfTimeError } from "../hostGate.js";
import { HEALTH_NOTE } from "./cityPointsSearch.js";
import { CALL_START_BUDGET_MS, envelope, failFrom, ok, rateLimitedMessage, refusedPageNote, type ToolDef } from "./common.js";

/**
 * Upstream pages requested per call, at most (0.3–1.2 s each on 2026-11-19), and none starts after
 * CALL_START_BUDGET_MS. Curitiba has thousands of units; one call never walks them all.
 */
export const MAX_CNES_REQUESTS = 20;

export const SCOPE_NOTE =
  "Public-administration units only (natureza jurídica group 1: municipal, state and federal bodies, autarquias, " +
  "public foundations), active units in Curitiba (IBGE 410690). Private clinics, consultórios and non-profit hospitals " +
  "are deliberately left out because their names can be people's names.";

export const healthUnitsSearchInput = {
  name: z.string().trim().min(2).max(100).optional().describe("Text in the unit name, accents and case ignored (e.g. 'UMS', 'CAPS')."),
  unit_type: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .optional()
    .describe("CNES unit type: a numeric code or text in its label (e.g. 'unidade basica', 'pronto atendimento', '2')."),
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
    .max(20)
    .default(0)
    .describe("Matches to skip on the first scanned page; pass the previous result's next_skip to continue."),
};

const unitSchema = z.object({
  cnes_code: z.string(),
  name: z.string(),
  unit_type_code: z.number().int().nullable(),
  unit_type: z.string().nullable(),
  address: z.string().nullable(),
  neighbourhood: z.string().nullable(),
  cep: z.string().nullable(),
  phone: z.string().nullable(),
  management_sphere: z.string().nullable(),
});

export const healthUnitsSearchOutput = envelope(
  z.object({
    units: z.array(unitSchema),
    scanned_pages: z.object({ from: z.number().int(), to: z.number().int() }),
    next_page: z.number().int().nullable(),
    next_skip: z.number().int(),
    partial: z.boolean(),
    discarded: z
      .number()
      .int()
      .describe(
        "Records dropped as non-public or incomplete on the pages this call scanned (a page resumed with skip is not " +
          "counted again); a sudden jump can mean a format change.",
      ),
    note: z.string(),
  }),
);

export const healthUnitsSearch: ToolDef<typeof healthUnitsSearchInput, typeof healthUnitsSearchOutput> = {
  name: "health_units_search",
  title: "Search Curitiba public health units (CNES)",
  description:
    "Find active public-administration health units in Curitiba (Ministry of Health CNES open API) by name or " +
    "unit type: CNES code, name, type, address, neighbourhood, CEP, phone, management sphere; no hours " +
    "(city_facilities_search \"unidade de saude\" has them). Up to 20 s per call. " +
    "No position: for units near me use city_points_search with near; for vaccines, vaccination_sites_search. " +
    "Read-only.",
  inputSchema: healthUnitsSearchInput,
  outputSchema: healthUnitsSearchOutput,
  handler: async ({ name, unit_type, limit, page, skip }) => {
    const started = Date.now(); // the unit-type load counts toward the time budget too
    const startBy = started + CALL_START_BUDGET_MS;
    try {
      const types = await getUnitTypes(startBy);
      let serverType: number | null = null;
      let clientTypes: Set<number> | null = null;
      if (unit_type !== undefined) {
        const codes = resolveUnitTypes(unit_type, types.value);
        if (codes.length === 0) {
          return ok({
            data: {
              units: [],
              scanned_pages: { from: page, to: page - 1 },
              next_page: null,
              next_skip: 0,
              partial: false,
              discarded: 0,
              note: `No CNES unit type matches unit_type. ${SCOPE_NOTE} ${HEALTH_NOTE}`,
            },
            source_url: establishmentsUrl(page, null),
            fetched_at: types.fetchedAt,
            license_note: CNES_LICENSE_NOTE,
          });
        }
        if (codes.length === 1) serverType = codes[0]!;
        else clientTypes = new Set(codes);
      }
      const needle = name === undefined ? null : fold(name);

      const units: HealthUnit[] = [];
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
      for (;;) {
        if (scanned === MAX_CNES_REQUESTS) {
          partial = true; // capped: more pages may hold matches
          nextPage = p;
          break;
        }
        if (scanned > 0 && Date.now() - started > CALL_START_BUDGET_MS) {
          partial = true; // return what we have rather than risk the client's timeout
          budgetReached = true;
          nextPage = p;
          break;
        }
        let res;
        try {
          res = await getEstablishmentsPage(p, serverType, startBy);
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
        // A call resuming inside a page (skip > 0) already had that page's discards counted by the previous call.
        if (!(scanned === 1 && skip > 0)) discarded += res.value.received - res.value.units.length;
        const skipped = scanned === 1 ? skip : 0;
        const matches = res.value.units.filter(
          (u) =>
            (needle === null || fold(u.name).includes(needle)) &&
            (clientTypes === null || (u.unit_type_code !== null && clientTypes.has(u.unit_type_code))),
        );
        const room = limit - units.length;
        const taken = matches.slice(skipped, skipped + room);
        for (const u of taken) {
          units.push({ ...u, unit_type: u.unit_type_code === null ? null : (types.value.get(u.unit_type_code) ?? null) });
        }
        const lastPage = res.value.received < CNES_PAGE_SIZE;
        if (matches.length > skipped + taken.length) {
          // More matches on this page than fit: the next call resumes on it, after the ones returned.
          nextPage = p;
          nextSkip = skipped + taken.length;
          break;
        }
        if (lastPage) break;
        if (units.length === limit) {
          nextPage = p + 1;
          break;
        }
        p++;
      }
      const notes = [SCOPE_NOTE, HEALTH_NOTE];
      if (refusedNote !== null) notes.unshift(refusedNote);
      else if (partial) {
        const why = budgetReached ? ` (the ${CALL_START_BUDGET_MS / 1000} s time budget was reached)` : "";
        notes.unshift(`Stopped after ${scanned} upstream page(s)${why}; continue with next_page.`);
      }
      if (rateLimitNote !== null) notes.unshift(rateLimitNote);
      return ok({
        data: {
          units,
          scanned_pages: { from: page, to: page + scanned - 1 },
          next_page: nextPage,
          next_skip: nextSkip,
          partial,
          discarded,
          note: notes.join(" "),
        },
        source_url: establishmentsUrl(page, serverType),
        fetched_at: fetchedAt,
        license_note: CNES_LICENSE_NOTE,
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
