import { z } from "zod";
import { ALERTS_URL, getCuritibaAlerts, inmetLicenseNote, type WeatherAlert } from "../sources/inmet.js";
import { envelope, failFrom, ok, type ToolDef } from "./common.js";

export const weatherAlertsInput = {
  when: z
    .enum(["today", "upcoming", "all"])
    .default("all")
    .describe("INMET's own lists: 'today' (hoje), 'upcoming' (futuro) or 'all' (both)."),
};

const alertSchema = z.object({
  id: z.number().int().nullable(),
  listed_as: z.enum(["today", "upcoming"]),
  description: z.string().nullable(),
  severity: z.string().nullable(),
  start: z.string().nullable().describe("As published by INMET (\"YYYY-MM-DD HH:mm\", no time zone given)."),
  end: z.string().nullable().describe("As published by INMET (\"YYYY-MM-DD HH:mm\", no time zone given)."),
  risks: z.array(z.string()).nullable(),
  instructions: z.array(z.string()).nullable(),
});

export const weatherAlertsOutput = envelope(
  z.object({
    city: z.literal("Curitiba"),
    ibge_code: z.string(),
    when: z.enum(["today", "upcoming", "all"]),
    count: z.number().int(),
    alerts: z.array(alertSchema),
    note: z.string(),
  }),
);

const SCOPE: Record<"today" | "upcoming" | "all", string> = {
  today: "in INMET's list for today",
  upcoming: "in INMET's list of upcoming warnings",
  all: "in INMET's lists for today or upcoming",
};

const ALERTS_NOTE =
  "Only warnings whose area lists Curitiba (IBGE 4106902) are returned; areas, polygons and icons are left out. " +
  "Text is INMET's, unchanged.";

export const weatherAlerts: ToolDef<typeof weatherAlertsInput, typeof weatherAlertsOutput> = {
  name: "weather_alerts",
  title: "Curitiba weather warnings (INMET)",
  description:
    "Active INMET (Instituto Nacional de Meteorologia) weather warnings that cover Curitiba: description, severity, " +
    "start, end, risks and instructions, as published. 'when' picks INMET's today list, its upcoming list, or both. " +
    "Says so when no warning covers Curitiba. Read-only.",
  inputSchema: weatherAlertsInput,
  outputSchema: weatherAlertsOutput,
  handler: async ({ when }) => {
    try {
      const res = await getCuritibaAlerts();
      const picked: WeatherAlert[] =
        when === "today" ? res.value.today : when === "upcoming" ? res.value.upcoming : [...res.value.today, ...res.value.upcoming];
      // INMET can list the same warning (same id) in both lists; return it once, as listed first.
      const seen = new Set<number>();
      const alerts = picked.filter((a) => a.id === null || (!seen.has(a.id) && (seen.add(a.id), true)));
      const note =
        alerts.length === 0
          ? `No active INMET warning covers Curitiba ${SCOPE[when]} as of ${res.fetchedAt}. ${ALERTS_NOTE}`
          : ALERTS_NOTE;
      return ok({
        data: { city: "Curitiba" as const, ibge_code: "4106902", when, count: alerts.length, alerts, note },
        source_url: ALERTS_URL,
        fetched_at: res.fetchedAt,
        license_note: inmetLicenseNote(ALERTS_URL, res.fetchedAt),
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
