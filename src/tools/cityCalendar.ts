import { z } from "zod";
import { dateInCuritiba } from "../sources/detran.js";
import { ok, type ToolDef } from "./common.js";

/** The only year bundled; after it ends (Curitiba time) the answer says `expired: true`. */
export const CALENDAR_YEAR = 2026;
export const CALENDAR_CHECKED_AT = "2026-11-24";

/** Decreto 2.385/2025 (DOM of 2025-11-11), read on 2026-11-24 from this copy (robots.txt 404 then). */
export const HOLIDAYS_SOURCE_URL = "https://www.normasbrasil.com.br/norma/decreto-2385-2025-curitiba_486274.html";
/** Legisweb notes of 2026-02-03 and 2026-03-18 mirroring Prefeitura releases, read on 2026-11-24 (robots.txt allows all). */
export const IPTU_SOURCE_URLS = ["https://www.legisweb.com.br/noticia/?id=32497", "https://www.legisweb.com.br/noticia/?id=32939"] as const;

const KINDS = ["national_holiday", "municipal_holiday", "optional_day", "no_office", "no_office_until_14h", "recess"] as const;
type Kind = (typeof KINDS)[number];

/** Art. 1 of Decreto 2.385/2025, in its order. */
const DAYS: readonly { from: string; to?: string; name: string; kind: Kind }[] = [
  { from: "2026-01-01", name: "1º de janeiro", kind: "national_holiday" },
  { from: "2026-01-02", name: "Suspensão do expediente", kind: "no_office" },
  { from: "2026-02-16", to: "2026-02-17", name: "Carnaval", kind: "optional_day" },
  { from: "2026-02-18", name: "Quarta-Feira de Cinzas", kind: "no_office_until_14h" },
  { from: "2026-04-02", name: "Suspensão do expediente", kind: "no_office" },
  { from: "2026-04-03", name: "Sexta-Feira da Paixão", kind: "national_holiday" },
  { from: "2026-04-21", name: "Tiradentes", kind: "national_holiday" },
  { from: "2026-05-01", name: "Dia Mundial do Trabalho", kind: "national_holiday" },
  { from: "2026-06-04", name: "Corpus Christi", kind: "municipal_holiday" },
  { from: "2026-06-05", name: "Suspensão do expediente", kind: "no_office" },
  { from: "2026-09-07", name: "Independência do Brasil", kind: "national_holiday" },
  { from: "2026-09-08", name: "Nossa Senhora da Luz", kind: "municipal_holiday" },
  { from: "2026-10-12", name: "Nossa Senhora Aparecida", kind: "national_holiday" },
  { from: "2026-10-28", name: "Dia do Servidor Público", kind: "optional_day" },
  { from: "2026-11-02", name: "Finados", kind: "national_holiday" },
  { from: "2026-11-15", name: "Proclamação da República", kind: "national_holiday" },
  { from: "2026-11-20", name: "Dia Nacional de Zumbi e da Consciência Negra", kind: "national_holiday" },
  { from: "2026-12-21", to: "2026-12-31", name: "Recesso", kind: "recess" },
  { from: "2026-12-25", name: "Natal", kind: "national_holiday" },
];

const IPTU = {
  cash_discount_pct: 10,
  cash_due_date: "2026-03-20",
  max_instalments: 10,
  instalments: "Up to 10, March to December, each due on day 20.",
  automatic_debit_first_date: "2026-03-27",
  payment: [
    "DAM (Documento de Arrecadação Municipal) at the partner banks, their cash machines or internet banking",
    "PIX",
    "automatic debit (ask your bank 30 days before the instalment is due)",
  ],
  where_to_issue: "Curitiba App or the Prefeitura website; the cash and first-instalment slips are also mailed.",
};

export const cityCalendarInput = {
  topic: z
    .enum(["holidays", "iptu"])
    .optional()
    .describe("holidays (default): municipal administration holidays and closures of 2026; iptu: IPTU 2026 general rule."),
};

const Common = {
  year: z.literal(CALENDAR_YEAR),
  expired: z.boolean().describe(`True after ${CALENDAR_YEAR}-12-31 (Curitiba time): the values are of ${CALENDAR_YEAR} only.`),
};

export const cityCalendarOutput = z.object({
  data: z.discriminatedUnion("topic", [
    z.object({
      topic: z.literal("holidays"),
      ...Common,
      days: z.array(
        z.object({
          from: z.string().date(),
          to: z.string().date().describe("Same as `from` for a single day."),
          name: z.string(),
          kind: z.enum(KINDS).describe(
            "national_holiday, municipal_holiday (religious, municipal law), optional_day (ponto facultativo), no_office " +
              "(suspensão do expediente), no_office_until_14h, recess.",
          ),
          past: z.boolean().describe("`to` is before today (Curitiba time)."),
        }),
      ),
    }),
    z.object({
      topic: z.literal("iptu"),
      ...Common,
      cash_discount_pct: z.number(),
      cash_due_date: z.string().date(),
      max_instalments: z.number().int(),
      instalments: z.string(),
      automatic_debit_first_date: z.string().date(),
      payment: z.array(z.string()),
      where_to_issue: z.string(),
      secondary_source: z.literal(true).describe("Legisweb notes mirroring Prefeitura releases, not the Prefeitura itself."),
    }),
  ]),
  source_url: z.string().url(),
  source_urls: z.array(z.string().url()),
  checked_at: z.string().date(),
  note: z.string(),
});

type Output = z.infer<typeof cityCalendarOutput>;

const BASE_NOTE = `Unofficial; not affiliated with the Prefeitura. Copied by hand and checked on ${CALENDAR_CHECKED_AT}; this tool makes no network call.`;
const HOLIDAYS_NOTE =
  "Decreto 2.385/2025 (Diário Oficial do Município of 2025-11-11) sets these days for the municipal administration " +
  "only, keeping essential services open; municipal schools follow their own school calendar (art. 3), and shops and " +
  "private employers follow labour rules. Confirm in the Diário Oficial do Município.";
const IPTU_NOTE =
  "Secondary source: Legisweb notes (2026-02-03 and 2026-03-18) that mirror Prefeitura releases. The general rule " +
  "only: your own amount, slip and any exemption are on the Curitiba App or the Prefeitura website; confirm there.";

export function calendarResult(topic: "holidays" | "iptu", now: Date): Output {
  const today = dateInCuritiba(now);
  const expired = today > `${CALENDAR_YEAR}-12-31`;
  const stale = expired ? ` These are ${CALENDAR_YEAR} values: the ${CALENDAR_YEAR + 1} ones are not bundled in this version.` : "";
  if (topic === "iptu") {
    return {
      data: { topic, year: CALENDAR_YEAR, expired, ...IPTU, secondary_source: true },
      source_url: IPTU_SOURCE_URLS[1],
      source_urls: [...IPTU_SOURCE_URLS],
      checked_at: CALENDAR_CHECKED_AT,
      note: `${BASE_NOTE} ${IPTU_NOTE}${stale}`,
    };
  }
  return {
    data: {
      topic,
      year: CALENDAR_YEAR,
      expired,
      days: DAYS.map((d) => ({ from: d.from, to: d.to ?? d.from, name: d.name, kind: d.kind, past: (d.to ?? d.from) < today })),
    },
    source_url: HOLIDAYS_SOURCE_URL,
    source_urls: [HOLIDAYS_SOURCE_URL],
    checked_at: CALENDAR_CHECKED_AT,
    note: `${BASE_NOTE} ${HOLIDAYS_NOTE}${stale}`,
  };
}

export const cityCalendar: ToolDef<typeof cityCalendarInput, typeof cityCalendarOutput> = {
  name: "city_calendar",
  title: "Curitiba 2026 municipal holidays and IPTU rule (dated notes, no network)",
  description:
    "Dated 2026 notes, no network call. `topic` \"holidays\": the Prefeitura's holidays, optional days and closures " +
    "(Decreto 2.385/2025; schools have their own calendar). \"iptu\": IPTU 2026 general rule (10% off in cash by 20 " +
    "March, up to 10 instalments), from a secondary source. Says `expired` after 2026. Read-only.",
  inputSchema: cityCalendarInput,
  outputSchema: cityCalendarOutput,
  handler: async (args) => ok(calendarResult(args.topic ?? "holidays", new Date())),
};
