import { z } from "zod";
import {
  CALENDAR_YEAR,
  CHECKED_AT,
  CURITIBA_UNITS,
  DETRAN_UNITS_URL,
  HOURS_STATEMENTS,
  LICENSING_DUE_DATES,
  LICENSING_FEE_BRL,
  LICENSING_NEWS_URL,
  PORTARIA_907_URL,
  yearInCuritiba,
} from "../sources/detran.js";
import { fail, ok, type ToolDef } from "./common.js";

export const DETRAN_BASE_NOTE =
  "Unofficial; not affiliated with Detran-PR. Public facts copied by hand from the Detran-PR and Paraná legislation " +
  "websites (no terms of use or licence was found there); each item has its source URL and the date it was checked. " +
  "This tool makes no network call. Confirm at the source before acting.";

const Dated = { source_url: z.string().url(), checked_at: z.string().date() };

export const detranPrInfoInput = {
  topic: z
    .enum(["licensing_calendar", "units"])
    .describe("licensing_calendar: annual licensing due dates and fee; units: Detran-PR units in Curitiba and nearby."),
  plate_final: z
    .number()
    .int()
    .min(0)
    .max(9)
    .optional()
    .describe("Last digit of the plate (0-9), only for licensing_calendar. Omit to get all ten dates."),
};

export const detranPrInfoOutput = z.object({
  data: z.discriminatedUnion("topic", [
    z.object({
      topic: z.literal("licensing_calendar"),
      year: z.number().int(),
      deadlines: z.array(z.object({ plate_final: z.number().int(), due_date: z.string().date(), ...Dated })),
      fee: z.object({ amount_brl: z.number(), ...Dated }),
    }),
    z.object({
      topic: z.literal("units"),
      units: z.array(
        z.object({
          kind: z.enum(["CIRETRAN", "PATRAN"]),
          name: z.string(),
          city: z.string(),
          address: z.string(),
          phone: z.string(),
          services: z.string(),
          ...Dated,
        }),
      ),
      scheduling: z.object({ text: z.string(), ...Dated }),
      hours: z.object({ conflict: z.boolean(), statements: z.array(z.object({ text: z.string(), ...Dated })) }),
    }),
  ]),
  source_url: z.string().url(),
  checked_at: z.string().date(),
  note: z.string(),
});

function staleNote(now: Date): string {
  const year = yearInCuritiba(now);
  return year > CALENDAR_YEAR
    ? ` This data was checked on ${CHECKED_AT} and the bundled calendar is for ${CALENDAR_YEAR}; it is now ${year}, ` +
        "so this data may be outdated."
    : "";
}

export function detranPrInfoResult(
  { topic, plate_final }: { topic: "licensing_calendar" | "units"; plate_final?: number | undefined },
  now: Date,
) {
  const dated = (source_url: string) => ({ source_url, checked_at: CHECKED_AT });
  if (topic === "licensing_calendar") {
    const digits = plate_final === undefined ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] : [plate_final];
    return {
      data: {
        topic,
        year: CALENDAR_YEAR,
        deadlines: digits.map((d) => ({ plate_final: d, due_date: LICENSING_DUE_DATES[d]!, ...dated(PORTARIA_907_URL) })),
        fee: { amount_brl: LICENSING_FEE_BRL, ...dated(LICENSING_NEWS_URL) },
      },
      ...dated(PORTARIA_907_URL),
      note:
        `${DETRAN_BASE_NOTE} Dates are from Portaria DETRAN 907/2025, Anexo I (calendar for ${CALENDAR_YEAR}). ` +
        "Per the Detran-PR news page, the fee is paid only after the vehicle's IPVA, fines and other debts are paid; " +
        "debts by plate are not available here." +
        staleNote(now),
    };
  }
  return {
    data: {
      topic,
      units: CURITIBA_UNITS.map((u) => ({ ...u, ...dated(DETRAN_UNITS_URL) })),
      scheduling: {
        text: "O atendimento em todas as Unidades é mediante agendamento prévio.",
        ...dated(DETRAN_UNITS_URL),
      },
      hours: { conflict: true, statements: HOURS_STATEMENTS.map((h) => ({ ...h, checked_at: CHECKED_AT })) },
    },
    ...dated(DETRAN_UNITS_URL),
    note:
      `${DETRAN_BASE_NOTE} Units of the 01ª CIRETRAN (Curitiba) block of the Detran-PR units page; the PSTRAN service ` +
      `posts run by city halls are listed only at ${DETRAN_UNITS_URL}. The site publishes no hours per unit and ` +
      "states two different general hours (both in hours.statements); confirm at 0800 643 7373." +
      staleNote(now),
  };
}

export const detranPrInfo: ToolDef<typeof detranPrInfoInput, typeof detranPrInfoOutput> = {
  name: "detran_pr_info",
  title: "Detran-PR licensing calendar and Curitiba units",
  description:
    "Public Detran-PR facts useful in Curitiba: the annual vehicle licensing due date by plate final digit and the " +
    "licensing fee, or the Detran-PR units in Curitiba and nearby (address, phone, services). Bundled, dated data with " +
    "source URLs; no network call. No fees by vehicle, debts or plate lookup. Read-only.",
  inputSchema: detranPrInfoInput,
  outputSchema: detranPrInfoOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    if (args.topic === "units" && args.plate_final !== undefined) {
      return fail("invalid_argument", "plate_final applies only to topic licensing_calendar.");
    }
    return ok(detranPrInfoResult(args, new Date()));
  },
};
