import { describe, expect, it } from "vitest";
import {
  ALERTS_MAX_BYTES,
  ALERTS_URL,
  FORECAST_MAX_BYTES,
  FORECAST_URL,
  parseAlerts,
  parseForecast,
} from "../src/sources/inmet.js";
import { weatherAlertsOutput } from "../src/tools/weatherAlerts.js";
import { weatherForecastOutput } from "../src/tools/weatherForecast.js";
import { connectClient, errorOf, fixture, inmetRoutes, stubFetch, type Route } from "./helpers.js";

const JSON_TYPE = "application/json";
const forecastJson = () => JSON.parse(fixture("inmet_previsao_synthetic.json")) as Record<string, Record<string, unknown>>;
const alertsJson = () => JSON.parse(fixture("inmet_avisos_synthetic.json")) as { hoje: Record<string, unknown>[]; futuro: Record<string, unknown>[] };

async function call(name: string, args: Record<string, unknown> = {}) {
  const client = await connectClient();
  return client.callTool({ name, arguments: args });
}

describe("weather_forecast", () => {
  it("returns 3 days by default, periods as published, nothing invented", async () => {
    const calls = stubFetch(inmetRoutes());
    const res = await call("weather_forecast");
    expect(res.isError).toBeFalsy();
    const out = weatherForecastOutput.parse(res.structuredContent);
    expect(calls).toEqual([{ url: FORECAST_URL, method: "GET" }]);
    expect(out.data.days.map((d) => d.date)).toEqual(["2030-02-01", "2030-02-02", "2030-02-03"]);
    expect(out.data.days[0]!.periods.map((p) => p.period)).toEqual(["morning", "afternoon", "night"]);
    expect(out.data.days[0]!.weekday).toBe("Dia Ficticio 1");
    expect(out.data.days[0]!.periods[0]).toEqual({
      period: "morning",
      summary: "Resumo ficticio D1 manha",
      temp_min_c: 15,
      temp_max_c: 25,
      humidity_min_pct: 50,
      humidity_max_pct: 95,
      wind_direction: "NE",
      wind_intensity: "Vento ficticio",
      sunrise: "05h00",
      sunset: "19h00",
    });
    // A whole-day entry stays one entry; it is never copied into periods.
    expect(out.data.days[2]!.periods).toHaveLength(1);
    expect(out.data.days[2]!.periods[0]!.period).toBe("whole_day");
    // A field INMET left out stays null.
    expect(out.data.days[1]!.periods[2]!.humidity_min_pct).toBeNull();
    expect(out.data.note).toMatch(/null/);
  });

  it("returns up to 5 days; an empty summary is null, not invented", async () => {
    stubFetch(inmetRoutes());
    const out = weatherForecastOutput.parse((await call("weather_forecast", { days: 5 })).structuredContent);
    expect(out.data.days).toHaveLength(5);
    expect(out.data.days[4]!.periods[0]!.summary).toBeNull();
    expect(out.data.days[4]!.periods[0]!.temp_max_c).toBe(31);
  });

  it("drops icons and fields that were not asked for", async () => {
    stubFetch(inmetRoutes());
    const res = await call("weather_forecast", { days: 5 });
    const text = JSON.stringify(res.structuredContent);
    expect(text).not.toMatch(/base64|icone|tende|estacao|fonte/);
  });

  it("orders days by date and says when INMET published fewer days than asked", async () => {
    const json = forecastJson();
    const city = json["4106902"]!;
    json["4106902"] = { "03/02/2030": city["03/02/2030"], "01/02/2030": city["01/02/2030"] };
    stubFetch({ [`GET ${FORECAST_URL}`]: { body: JSON.stringify(json), contentType: JSON_TYPE } });
    const out = weatherForecastOutput.parse((await call("weather_forecast", { days: 4 })).structuredContent);
    expect(out.data.days.map((d) => d.date)).toEqual(["2030-02-01", "2030-02-03"]);
    expect(out.data.note).toMatch(/published 2 day\(s\), fewer than the 4 asked/);
  });

  it.each<[string, unknown]>([
    ["no Curitiba key", { "4100000": {} }],
    ["an unknown day shape", { "4106902": { "01/02/2030": { foo: 1 } } }],
    ["a malformed date key", { "4106902": { "2030-02-01": { resumo: "x" } } }],
    ["an impossible date", { "4106902": { "31/02/2030": { resumo: "x" } } }],
    ["a month 13", { "4106902": { "01/13/2030": { resumo: "x" } } }],
    ["no days", { "4106902": {} }],
    ["an array", []],
  ])("a forecast with %s is source_unavailable", async (_label, body) => {
    stubFetch({ [`GET ${FORECAST_URL}`]: { body: JSON.stringify(body), contentType: JSON_TYPE } });
    const res = await call("weather_forecast");
    expect(res.structuredContent).toBeUndefined();
    expect(errorOf(res)).toEqual({ error: "source_unavailable" });
  });

  it("reads a plain numeric string as that number and anything else as null", () => {
    const json = forecastJson();
    const day = json["4106902"]!["03/02/2030"] as Record<string, unknown>;
    day.temp_max = "29";
    day.umidade_min = "12,5";
    day.temp_min = "frio";
    const p = parseForecast(json)[2]!.periods[0]!;
    expect(p.temp_max_c).toBe(29);
    expect(p.humidity_min_pct).toBe(12.5);
    expect(p.temp_min_c).toBeNull();
  });

  it("parseForecast rejects non-object input", () => {
    expect(() => parseForecast(null)).toThrow(/source_unavailable/);
  });
});

describe("weather_alerts", () => {
  it("returns only Curitiba's warnings, deduplicated, with INMET's text unchanged", async () => {
    const calls = stubFetch(inmetRoutes());
    const res = await call("weather_alerts");
    expect(res.isError).toBeFalsy();
    const out = weatherAlertsOutput.parse(res.structuredContent);
    expect(calls).toEqual([{ url: ALERTS_URL, method: "GET" }]);
    // 900002 lists 41069020 and 14106902 (near misses), not 4106902; 900001 is in both lists and is returned once.
    expect(out.data.alerts.map((a) => [a.id, a.listed_in])).toEqual([
      [900001, ["today", "upcoming"]],
      [900003, ["upcoming"]],
    ]);
    expect(out.data.count).toBe(2);
    expect(out.data.alerts[0]).toEqual({
      id: 900001,
      listed_in: ["today", "upcoming"],
      description: "Fenomeno Ficticio A",
      severity: "Severidade Ficticia 1",
      start: "2030-02-01 08:00",
      end: "2030-02-01 23:59",
      // trailing spaces kept: values are passed on unchanged
      risks: ["Risco ficticio do aviso 900001. "],
      instructions: ["Instrucao ficticia 1 do aviso 900001. ", "Instrucao ficticia 2 do aviso 900001."],
    });
    expect(out.data.note).not.toMatch(/No active INMET warning/);
  });

  it("drops polygons, area lists, geocodes and icons", async () => {
    stubFetch(inmetRoutes());
    const text = JSON.stringify((await call("weather_alerts")).structuredContent);
    for (const planted of ["SYNTHETIC-POLYGON", "Municipio Ficticio", "Micro Ficticia", "U1lOVEhFVElD", "41069020", "#000000", "fora de Curitiba", "urn:oid"]) {
      expect(text).not.toContain(planted);
    }
    expect(text).not.toMatch(/"(poligono|municipios|geocodes|icone|aviso_cor|codigo)"/);
  });

  it.each([
    ["today", [900001]],
    ["upcoming", [900001, 900003]],
  ] as const)("when=%s uses INMET's own list", async (when, ids) => {
    stubFetch(inmetRoutes());
    const out = weatherAlertsOutput.parse((await call("weather_alerts", { when })).structuredContent);
    expect(out.data.when).toBe(when);
    expect(out.data.alerts.map((a) => a.id)).toEqual(ids);
    expect(out.data.count).toBe(ids.length);
  });

  it("says clearly when no warning covers Curitiba", async () => {
    const json = alertsJson();
    json.hoje = json.hoje.filter((a) => a.id === 900002);
    json.futuro = [];
    stubFetch({ [`GET ${ALERTS_URL}`]: { body: JSON.stringify(json), contentType: JSON_TYPE } });
    const out = weatherAlertsOutput.parse((await call("weather_alerts")).structuredContent);
    expect(out.data.count).toBe(0);
    expect(out.data.alerts).toEqual([]);
    expect(out.data.note).toMatch(/^No active INMET warning covers Curitiba in INMET's lists for today or upcoming as of /);
    expect(out.data.note).toContain(out.fetched_at);
  });

  it("accepts geocodes served as an array", () => {
    const json = alertsJson();
    json.hoje[0]!.geocodes = [4100103, 4106902];
    json.futuro = [];
    expect(parseAlerts(json).map((a) => a.id)).toEqual([900001]);
  });

  it("splits array elements on commas too", () => {
    const json = alertsJson();
    json.hoje[0]!.geocodes = ["4100103,4106902"];
    json.futuro = [];
    expect(parseAlerts(json).map((a) => a.id)).toEqual([900001]);
  });

  it("returns a warning listed twice without an id once, with both lists", () => {
    const json = alertsJson();
    for (const a of [...json.hoje, ...json.futuro]) delete a.id;
    const out = parseAlerts(json);
    expect(out.map((a) => [a.description, a.listed_in])).toEqual([
      ["Fenomeno Ficticio A", ["today", "upcoming"]],
      ["Fenomeno Ficticio C", ["upcoming"]],
    ]);
    expect(out.every((a) => a.id === null)).toBe(true);
  });

  it("keeps a lone risks string as a one-item list", () => {
    const json = alertsJson();
    json.futuro[0]!.riscos = "Risco ficticio unico. ";
    expect(parseAlerts(json).find((a) => a.id === 900003)!.risks).toEqual(["Risco ficticio unico. "]);
  });

  it("missing text fields stay null", () => {
    const json = alertsJson();
    delete json.futuro[0]!.riscos;
    json.futuro[0]!.descricao = "";
    const a = parseAlerts(json).find((x) => x.id === 900003)!;
    expect(a.risks).toBeNull();
    expect(a.description).toBeNull();
  });

  it.each<[string, (j: ReturnType<typeof alertsJson>) => unknown]>([
    ["no hoje list", (j) => ({ futuro: j.futuro })],
    ["futuro not a list", (j) => ({ hoje: j.hoje, futuro: {} })],
    ["a warning without geocodes", (j) => ({ hoje: [{ ...j.hoje[1], geocodes: undefined }], futuro: [] })],
    ["a warning with blank geocodes", (j) => ({ hoje: [{ ...j.hoje[1], geocodes: " , " }], futuro: [] })],
    ["a warning with an empty geocodes list", (j) => ({ hoje: [], futuro: [{ ...j.futuro[0], geocodes: [] }] })],
    ["a warning that is not an object", () => ({ hoje: ["x"], futuro: [] })],
  ])("%s is source_unavailable, never 'no warning'", async (_label, mutate) => {
    stubFetch({ [`GET ${ALERTS_URL}`]: { body: JSON.stringify(mutate(alertsJson())), contentType: JSON_TYPE } });
    const res = await call("weather_alerts");
    expect(res.structuredContent).toBeUndefined();
    expect(errorOf(res)).toEqual({ error: "source_unavailable" });
  });
});

describe("INMET guards", () => {
  it.each([
    ["weather_forecast", FORECAST_URL, FORECAST_MAX_BYTES, "1 MB"],
    ["weather_alerts", ALERTS_URL, ALERTS_MAX_BYTES, "6 MB"],
  ] as const)("%s refuses a body over its cap with a clear source_unavailable", async (name, url, cap, label) => {
    stubFetch({ [`GET ${url}`]: { body: " ".repeat(cap + 1), contentType: JSON_TYPE } });
    const res = await call(name);
    expect(res.structuredContent).toBeUndefined();
    expect(errorOf(res)).toEqual({
      error: "source_unavailable",
      message: `The source response was larger than this tool's ${label} cap; no data was returned.`,
    });
  });

  it.each([
    ["weather_forecast", FORECAST_URL],
    ["weather_alerts", ALERTS_URL],
  ])("%s maps HTTP 429 to rate_limited with the Retry-After wait, without retrying", async (name, url) => {
    const calls = stubFetch({ [`GET ${url}`]: { status: 429, headers: { "retry-after": "30" } } });
    const res = await call(name);
    expect(errorOf(res)).toEqual({ error: "rate_limited", message: "The source is limiting requests; wait 30 s before trying again." });
    expect(calls).toHaveLength(1);
  });

  it.each<[string, string, Route]>([
    ["weather_forecast", FORECAST_URL, { status: 503 }],
    ["weather_forecast", FORECAST_URL, { body: "<html>maintenance</html>" }],
    ["weather_alerts", ALERTS_URL, { error: true }],
    ["weather_alerts", ALERTS_URL, { status: 404 }],
  ])("%s: a failing or non-JSON source is source_unavailable", async (name, url, route) => {
    stubFetch({ [`GET ${url}`]: route });
    expect(errorOf(await call(name))).toEqual({ error: "source_unavailable" });
  });

  it("caches only in memory: a second call within the TTL makes no request", async () => {
    const calls = stubFetch(inmetRoutes());
    await call("weather_alerts");
    await call("weather_alerts", { when: "today" });
    expect(calls).toHaveLength(1);
  });
});
