import { z } from "zod";
import { SourceUnavailableError } from "../http.js";
import { getPlanCategories, getPlanUnits, PCA_UNITS_PAGE_SIZE, pcaUnitsUrl, PNCP_PLAN_LICENSE_NOTE, type PlanCategory } from "../sources/pncp.js";
import { CALL_START_BUDGET_MS, failFrom, ok } from "./common.js";

/** procurement_search mode "plan" (v0.68): a listed body's Plano de Contratações Anual (PCA) for one year. */
export const CITY_CNPJ = "76417005000186";

const amounts = { item_count: z.number().int(), total_value: z.number() };

export const planData = z.object({
  mode: z.literal("plan"),
  year: z.number().int(),
  body_cnpj: z.string(),
  body_name: z.string().nullable(),
  plan_found: z.boolean(),
  ...amounts,
  published_at: z.string().nullable().describe("First publication of a unit's plan in PNCP (local time, as published)."),
  updated_at: z.string().nullable().describe("Latest update of a unit's plan."),
  categories: z.array(z.object({ category: z.string(), ...amounts })),
  units: z.array(z.object({ unit: z.string(), ...amounts, published_at: z.string(), updated_at: z.string() })),
  units_total: z.number().int(),
  discarded: z.number().int().describe("Rows dropped because of another body or year, or a missing or malformed field."),
  note: z.string(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

/** At most two requests through the PNCP gate: the units first; no plan stops there. */
export async function answerPlan(year: number, cnpj: string, limit: number) {
  const startBy = Date.now() + CALL_START_BUDGET_MS;
  try {
    const unitsRes = await getPlanUnits(cnpj, year, startBy);
    const scope = `Plan ${year} of this body only (${cnpj}): other listed municipal bodies publish their own plan (pass body_cnpj).`;
    const meta = { source_url: pcaUnitsUrl(cnpj, year), fetched_at: unitsRes.fetchedAt, license_note: PNCP_PLAN_LICENSE_NOTE };
    const empty = { body_name: null, plan_found: false, item_count: 0, total_value: 0, published_at: null, updated_at: null };
    if ("none" in unitsRes.value) {
      const note = `PNCP answered HTTP ${unitsRes.value.none} for this body and year: no plan published (or PNCP changed the route). ${scope}`;
      return ok({ data: { mode: "plan", year, body_cnpj: cnpj, ...empty, categories: [], units: [], units_total: 0, discarded: 0, note }, ...meta });
    }
    const { body_name, units, received, discarded } = unitsRes.value.found;
    // Rows came back and none passed the strict check: a renamed field, not "no plan".
    if (received > 0 && units.length === 0) throw new SourceUnavailableError("layout_changed");
    const catRes = await getPlanCategories(cnpj, year, startBy);
    const cats = "found" in catRes.value ? catRes.value.found : { categories: [] as PlanCategory[], discarded: 0 };
    const dropped = discarded + cats.discarded;
    const notes = [scope, "Totals are the sum of the requesting units' plans; a plan is what the body intends to buy, not a purchase. Values in BRL."];
    if (dropped > 0) notes.push(`${dropped} malformed or foreign row(s) were left out of the totals.`);
    if ("none" in catRes.value) notes.push(`The category totals answered HTTP ${catRes.value.none}; categories is empty.`);
    if (received >= PCA_UNITS_PAGE_SIZE) notes.push(`PNCP returned ${PCA_UNITS_PAGE_SIZE} units, its page size: more may exist.`);
    const stamps = units.flatMap((u) => [u.published_at, u.updated_at]).sort();
    return ok({
      data: {
        mode: "plan",
        year,
        body_cnpj: cnpj,
        body_name,
        plan_found: units.length > 0,
        item_count: units.reduce((n, u) => n + u.item_count, 0),
        total_value: round2(units.reduce((n, u) => n + u.total_value, 0)),
        published_at: units.map((u) => u.published_at).sort()[0] ?? null,
        updated_at: stamps.at(-1) ?? null,
        categories: [...cats.categories].sort((a, b) => b.total_value - a.total_value),
        units: [...units].sort((a, b) => b.total_value - a.total_value).slice(0, limit),
        units_total: units.length,
        discarded: dropped,
        note: notes.join(" "),
      },
      ...meta,
    });
  } catch (err) {
    return failFrom(err);
  }
}
