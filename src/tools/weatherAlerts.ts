import { z } from "zod";
import { CACHE_TTL_MS } from "../config.js";
import { ALERTS_URL, CURITIBA_GEOCODE, getCuritibaAlerts, inmetLicenseNote } from "../sources/inmet.js";
import { envelope, failFrom, ok, type ToolDef } from "./common.js";

export const weatherAlertsInput = {
  when: z
    .enum(["today", "upcoming", "all"])
    .default("all")
    .describe("INMET's own lists: 'today' (hoje), 'upcoming' (futuro) or 'all' (both)."),
};

const alertSchema = z.object({
  id: z.number().int().nullable(),
  listed_in: z.array(z.enum(["today", "upcoming"])).describe("INMET's lists this warning is in; a warning can be in both."),
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
  `Only warnings whose area lists Curitiba (IBGE ${CURITIBA_GEOCODE}) are returned; areas, polygons and icons are left out. ` +
  "A warning listed identically in both of INMET's lists is returned once. Text is INMET's, unchanged.";

/** Said with every "no warning" answer: the cache can hide a warning issued since, and this is not an alert service. */
export const NO_WARNING_NOTE =
  `This answer may lag INMET by up to ${CACHE_TTL_MS / 60_000} minutes (in-memory cache). It is not an official alert ` +
  "service: follow Defesa Civil (199) and official channels.";

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
      const alerts = when === "all" ? res.value : res.value.filter((a) => a.listed_in.includes(when));
      const note =
        alerts.length === 0
          ? `No active INMET warning covers Curitiba ${SCOPE[when]} as of ${res.fetchedAt}. ${NO_WARNING_NOTE} ${ALERTS_NOTE}`
          : ALERTS_NOTE;
      return ok({
        data: { city: "Curitiba" as const, ibge_code: CURITIBA_GEOCODE, when, count: alerts.length, alerts, note },
        source_url: ALERTS_URL,
        fetched_at: res.fetchedAt,
        license_note: inmetLicenseNote(ALERTS_URL, res.fetchedAt),
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
