import { z } from "zod";
import { CURITIBA_GEOCODE, FORECAST_URL, getForecast, inmetLicenseNote } from "../sources/inmet.js";
import { envelope, failFrom, ok, type ToolDef } from "./common.js";

export const weatherForecastInput = {
  days: z.number().int().min(1).max(5).default(3).describe("Number of forecast days (1–5), from the first day INMET publishes (today when checked)."),
};

const periodSchema = z.object({
  period: z.enum(["morning", "afternoon", "night", "whole_day"]),
  summary: z.string().nullable(),
  temp_min_c: z.number().nullable(),
  temp_max_c: z.number().nullable(),
  humidity_min_pct: z.number().nullable(),
  humidity_max_pct: z.number().nullable(),
  wind_direction: z.string().nullable(),
  wind_intensity: z.string().nullable(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
});

export const weatherForecastOutput = envelope(
  z.object({
    city: z.literal("Curitiba"),
    ibge_code: z.string(),
    days: z.array(
      z.object({
        date: z.string().describe("YYYY-MM-DD (INMET serves dd/mm/yyyy)."),
        weekday: z.string().nullable(),
        periods: z.array(periodSchema),
      }),
    ),
    note: z.string(),
  }),
);

export const FORECAST_NOTE =
  `INMET forecast for Curitiba (IBGE ${CURITIBA_GEOCODE}). INMET gives morning, afternoon and night for the first ` +
  "days and one whole-day entry for later days; both are returned as published. Text is INMET's, unchanged. A field " +
  "INMET left out or empty is null. Confirm on the official channel before you act: https://portal.inmet.gov.br/ (INMET).";

export const weatherForecast: ToolDef<typeof weatherForecastInput, typeof weatherForecastOutput> = {
  name: "weather_forecast",
  title: "Curitiba weather forecast (INMET)",
  description:
    "Weather forecast for Curitiba from INMET (Instituto Nacional de Meteorologia), up to 5 days: per day and period " +
    "(morning, afternoon, night, or whole day for later days) the summary, min/max temperature (°C), min/max humidity " +
    "(%), wind direction and intensity, sunrise and sunset. Read-only.",
  inputSchema: weatherForecastInput,
  outputSchema: weatherForecastOutput,
  handler: async ({ days }) => {
    try {
      const res = await getForecast();
      const selected = res.value.slice(0, days);
      const short = selected.length < days ? ` INMET published ${selected.length} day(s), fewer than the ${days} asked.` : "";
      return ok({
        data: { city: "Curitiba" as const, ibge_code: CURITIBA_GEOCODE, days: selected, note: FORECAST_NOTE + short },
        source_url: FORECAST_URL,
        fetched_at: res.fetchedAt,
        license_note: inmetLicenseNote(FORECAST_URL, res.fetchedAt),
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
