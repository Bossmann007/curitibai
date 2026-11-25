import { z } from "zod";
import {
  ALIQUOTA_MUNICIPIO_URL,
  ALIQUOTA_UF_URL,
  ALIQUOTA_UNIAO_URL,
  CURITIBA_IBGE,
  DISCLAIMER,
  getList,
  getRate,
  getVersion,
  isSimulatedDate,
  LIST_URL,
  NFSE_CHECKED,
  NFSE_CHECKED_AT,
  NFSE_NOTE,
  NFSE_SOURCE_URL,
  RECEITA_BASE,
  receitaLicenseNote,
  SIMULATED_FROM,
  SIMULATED_NOTE,
  VERSAO_URL,
  type CodeItem,
} from "../sources/receita.js";
import { fold } from "../text.js";
import { fail as baseFail, failFrom as baseFailFrom, ok, type ErrorCode, type ToolDef } from "./common.js";

/** The reform's first year; earlier dates have no rate in the Receita base. */
const FIRST_DATE = "2026-01-01";
/** A guard against typos (e.g. 3026): a far date would send uncached requests to the shared pilot host. */
const LAST_DATE = "2099-12-31";

export const taxReformCuritibaInput = {
  topic: z
    .enum(["rates", "nbs", "ncm", "class_trib", "nfse"])
    .default("rates")
    .describe(
      "rates: CBS, IBS UF (PR) and IBS municipal (Curitiba) reference rates on the date. nbs / ncm / class_trib: find a " +
        "service code (NBS), product code (NCM) or tax classification (cClassTrib) by code or words. nfse: fixed note on " +
        "NFS-e in Curitiba (no network).",
    ),
  query: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .describe("Required for nbs, ncm and class_trib: a code (digits; dots and dashes allowed) or words of the description."),
  date: z
    .string()
    .optional()
    .describe(`YYYY-MM-DD, ${FIRST_DATE} to ${LAST_DATE}; default today in Curitiba. From ${SIMULATED_FROM} the Receita serves simulated values (simulated: true).`),
  limit: z.number().int().min(1).max(25).default(10).describe("Lookup topics: at most this many items (1–25)."),
};

const itemSchema = z.object({
  code: z.string(),
  description: z.string(),
  rate_type: z.string().nullable(),
  treatment: z.string().nullable(),
  nomenclature: z.string().nullable(),
  reduction_cbs_pct: z.number().nullable(),
  reduction_ibs_uf_pct: z.number().nullable(),
  reduction_ibs_municipal_pct: z.number().nullable(),
});

export const taxReformCuritibaOutput = z.object({
  data: z.object({
    topic: z.enum(["rates", "nbs", "ncm", "class_trib", "nfse"]),
    city: z.literal("Curitiba"),
    ibge_code: z.literal(CURITIBA_IBGE),
    uf: z.literal("PR"),
    date: z.string().nullable(),
    receita_version: z
      .object({
        app_version: z.string(),
        db_version: z.string(),
        db_date: z.string().nullable(),
        db_description: z.string().nullable(),
      })
      .nullable(),
    rates: z
      .object({
        cbs_pct: z.number().nullable(),
        ibs_uf_pct: z.number().nullable(),
        ibs_municipal_pct: z.number().nullable(),
      })
      .nullable(),
    items: z.array(itemSchema).nullable(),
    total: z.number().int().nullable(),
    skipped: z.number().int().nullable(),
    nfse: z
      .object({
        text: z.string(),
        schedule: z.array(z.object({ from: z.string(), who: z.string() })),
        legal_basis: z.array(z.string()),
        public_lookup: z.string().url(),
        source_url: z.string().url(),
        checked: z.string(),
      })
      .nullable(),
    disclaimer: z.literal(DISCLAIMER),
    simulated: z
      .boolean()
      .nullable()
      .describe(`true: values simulated by the Receita (its header, or a date from ${SIMULATED_FROM}); null for topic nfse.`),
  }),
  source_url: z.string().url(),
  checked_at: z.string(),
  license_note: z.string(),
  note: z.string(),
});

const BASE = { city: "Curitiba" as const, ibge_code: CURITIBA_IBGE, uf: "PR" as const, disclaimer: DISCLAIMER };
const EMPTY = { receita_version: null, rates: null, items: null, total: null, skipped: null, nfse: null, simulated: null };

const RATES_NOTE =
  "Reference rates in percent, as the Receita base serves them (CBS = União, IBS UF = Paraná, IBS municipal = " +
  "Curitiba). A cClassTrib may reduce them (topic class_trib); no effective rate is computed here. For NFS-e in " +
  "Curitiba use topic nfse.";

/** Today in America/Sao_Paulo as YYYY-MM-DD. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function validDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d && d >= FIRST_DATE && d <= LAST_DATE;
}

/** Digits (dots, dashes, spaces dropped) match a code prefix; other text matches when every word is in the description. */
function matcher(query: string): (i: CodeItem) => boolean {
  if (/^[\d.\-\s]+$/.test(query)) {
    const digits = query.replace(/\D/g, "");
    return (i) => i.code.replace(/\D/g, "").startsWith(digits);
  }
  const words = fold(query).split(/\s+/).filter((w) => w !== "");
  return (i) => {
    const d = fold(i.description);
    return words.every((w) => d.includes(w));
  };
}

const older = (a: string, b: string) => (a < b ? a : b);

/** Errors of this tool carry the disclaimer too, at the end of `message` (the error object has no other field). */
const fail = (error: ErrorCode, message?: string) => baseFail(error, [message, `${DISCLAIMER}.`].filter(Boolean).join(" "));
const failFrom = (err: unknown) => baseFailFrom(err, `${DISCLAIMER}.`);

export const taxReformCuritiba: ToolDef<typeof taxReformCuritibaInput, typeof taxReformCuritibaOutput> = {
  name: "tax_reform_curitiba",
  title: "Tax reform (CBS/IBS) rates and codes for Curitiba (Receita pilot API)",
  description:
    "Tax reform (CBS/IBS) for Curitiba only, from the Receita Federal pilot calculator's open data: the reference " +
    "rates on a date (from 2027 simulated: true), a search of NBS, NCM or cClassTrib codes by code or words, or a " +
    "fixed note on NFS-e. Not tax advice; no calculation, no invoice. Read-only.",
  inputSchema: taxReformCuritibaInput,
  outputSchema: taxReformCuritibaOutput,
  handler: async ({ topic, query, date, limit }) => {
    if (topic === "nfse") {
      if (query !== undefined) return fail("invalid_argument", "query is not used with topic nfse.");
      return ok({
        data: { topic, ...BASE, date: null, ...EMPTY, nfse: NFSE_NOTE },
        source_url: NFSE_SOURCE_URL,
        checked_at: NFSE_CHECKED_AT,
        license_note:
          `Facts read by hand from ${NFSE_SOURCE_URL} (Prefeitura de Curitiba) on ${NFSE_CHECKED}; the page is not fetched ` +
          "by this server. Unofficial; not affiliated with Prefeitura de Curitiba.",
        note: "Fixed text, no network call; it may be outdated. Confirm on the official page before you act.",
      });
    }
    const day = date ?? today();
    if (!validDate(day)) {
      return fail("invalid_argument", `date must be a real date (YYYY-MM-DD) from ${FIRST_DATE} to ${LAST_DATE}.`);
    }
    if (topic === "rates" && query !== undefined) return fail("invalid_argument", "query is not used with topic rates.");
    if (topic !== "rates" && query === undefined) return fail("invalid_argument", `topic ${topic} needs a query (a code or words).`);
    if (query !== undefined && /^[\d.\-\s]+$/.test(query) && query.replace(/\D/g, "").length < 2) {
      return fail("invalid_argument", "a code query needs at least 2 digits.");
    }
    try {
      if (topic === "rates") {
        const [version, cbs, uf, mun] = await Promise.all([
          getVersion(),
          getRate(ALIQUOTA_UNIAO_URL(day)),
          getRate(ALIQUOTA_UF_URL(day)),
          getRate(ALIQUOTA_MUNICIPIO_URL(day)),
        ]);
        const missing = [cbs, uf, mun].some((r) => r.value.pct === null);
        const simulated = isSimulatedDate(day) || [cbs, uf, mun].some((r) => r.value.marked);
        const ratesNote = missing ? `${RATES_NOTE} A null rate: the Receita base has no reference rate for that date.` : RATES_NOTE;
        const checkedAt = [version, cbs, uf, mun].map((r) => r.fetchedAt).reduce(older);
        return ok({
          data: {
            topic,
            ...BASE,
            date: day,
            ...EMPTY,
            receita_version: version.value,
            rates: { cbs_pct: cbs.value.pct, ibs_uf_pct: uf.value.pct, ibs_municipal_pct: mun.value.pct },
            simulated,
          },
          source_url: `${RECEITA_BASE}/`,
          checked_at: checkedAt,
          license_note: receitaLicenseNote(
            [VERSAO_URL, ALIQUOTA_UNIAO_URL(day), ALIQUOTA_UF_URL(day), ALIQUOTA_MUNICIPIO_URL(day)].join(", "),
            checkedAt,
          ),
          note: simulated ? `${SIMULATED_NOTE}. ${ratesNote}` : ratesNote,
        });
      }
      const [version, list] = await Promise.all([getVersion(), getList(topic, day)]);
      const found = list.value.items.filter(matcher(query!));
      const url = LIST_URL[topic](day);
      const checkedAt = older(version.fetchedAt, list.fetchedAt);
      const simulated = isSimulatedDate(day) || list.value.marked;
      const notes = [
        simulated ? `${SIMULATED_NOTE}.` : "",
        `Matched here from the Receita list for ${day}; the query is not sent to the Receita.`,
        list.value.items.length === 0 ? "The Receita list for this date is empty." : "",
        found.length > limit ? `Showing ${limit} of ${found.length}.` : "",
        list.value.skipped > 0 ? `${list.value.skipped} item(s) without a code or description were skipped.` : "",
        topic === "ncm" ? "Many NCM descriptions are only \"-- Outros\": search by code when you can." : "",
        topic === "class_trib" ? "Reductions are percent of the reference rates (topic rates); nothing is computed here." : "",
      ];
      return ok({
        data: {
          topic,
          ...BASE,
          date: day,
          ...EMPTY,
          receita_version: version.value,
          items: found.slice(0, limit),
          total: found.length,
          skipped: list.value.skipped,
          simulated,
        },
        source_url: url,
        checked_at: checkedAt,
        license_note: receitaLicenseNote(url, checkedAt),
        note: notes.filter((n) => n !== "").join(" "),
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
