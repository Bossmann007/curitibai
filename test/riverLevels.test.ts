import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStationData, parseStationData, requestPeriod, STATIONS, stationDataUrl, type Station } from "../src/sources/ana.js";
import { SourceUnavailableError } from "../src/http.js";
import { riverLevelsOutput } from "../src/tools/riverLevels.js";
import { connectClient, errorOf, fixture, stubFetch, type Route } from "./helpers.js";

const XML_TYPE = "text/xml; charset=utf-8";
/** 50 minutes after the fixtures' latest reading (2026-11-22 02:00 Brasília time = 05:00 UTC). */
const NOW = Date.parse("2026-11-22T05:50:00Z");
const FROM_MS = Date.parse("2026-11-21T00:00:00-03:00");
const station = (code: string): Station => STATIONS.find((s) => s.code === code)!;
const urlFor = (code: string) =>
  `https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=${code}&dataInicio=21%2F11%2F2026&dataFim=22%2F11%2F2026`;
const FAZENDINHA = fixture("ana/65010000_fazendinha.xml");
const ARAUCARIA = fixture("ana/65019980_ete_araucaria.xml");
const noData = (code: string) => fixture("ana/02549127_no_data.xml").replace("Código: 02549127", `Código: ${code}`);
const route = (code: string, r: Route = {}): Record<string, Route> => ({
  [`GET ${urlFor(code)}`]: { body: code === "65010000" ? FAZENDINHA : code === "65019980" ? ARAUCARIA : noData(code), contentType: XML_TYPE, ...r },
});

async function call(args: Record<string, unknown>) {
  const client = await connectClient();
  return client.callTool({ name: "river_levels", arguments: args });
}

async function levels(args: Record<string, unknown>) {
  const res = await call(args);
  expect(res.isError).toBeFalsy();
  return riverLevelsOutput.parse(res.structuredContent);
}

describe("parseStationData", () => {
  it("reads a real Fazendinha sample: latest reading by time, rain sums over the hour and 24 h ending at it", () => {
    const d = parseStationData("65010000", FAZENDINHA, FROM_MS, NOW);
    expect(d.latest).toEqual({ at: Date.parse("2026-11-22T05:00:00Z"), flow_m3s: 6.98, level_cm: 202, rain_mm: 0 });
    expect(d.rain_1h_mm).toBe(0);
    // 0.20 at 17:15, 0.60 at 17:30 and 0.20 at 18:00 of the 21st; the 0.20 at 01:30 of the 21st is outside.
    expect(d.rain_24h_mm).toBe(1);
  });

  it("reads an empty element as no value, never 0 (ETE Araucária has no flow)", () => {
    const d = parseStationData("65019980", ARAUCARIA, FROM_MS, NOW);
    expect(d.latest).toMatchObject({ flow_m3s: null, level_cm: 169, rain_mm: 0 });
    expect(d.rain_24h_mm).toBe(2.8);
  });

  it("does not trust row order", () => {
    const rows = FAZENDINHA.match(/<DadosHidrometereologicos\b[\s\S]*?<\/DadosHidrometereologicos>/g)!;
    const reversed = FAZENDINHA.replace(rows.join("\r\n      "), [...rows].reverse().join("\r\n      "));
    expect(reversed).not.toBe(FAZENDINHA);
    expect(parseStationData("65010000", reversed, FROM_MS, NOW)).toEqual(parseStationData("65010000", FAZENDINHA, FROM_MS, NOW));
  });

  it("gives no 24 h sum when the window starts before the requested period, and no sum without rain values", () => {
    const later = Date.parse("2026-11-21T12:00:00-03:00");
    expect(parseStationData("65010000", FAZENDINHA, later, NOW)).toMatchObject({ rain_1h_mm: 0, rain_24h_mm: null });
    const dry = FAZENDINHA.replace(/<Chuva>[^<]*<\/Chuva>/g, "<Chuva />");
    expect(parseStationData("65010000", dry, FROM_MS, NOW)).toMatchObject({ rain_1h_mm: null, rain_24h_mm: null, latest: { rain_mm: null } });
  });

  it("reads ANA's 'no data' answer (with its schema) as no reading, only for the requested code", () => {
    expect(parseStationData("02549127", noData("02549127"), FROM_MS, NOW)).toEqual({ code: "02549127", latest: null, rain_1h_mm: null, rain_24h_mm: null });
    expect(() => parseStationData("02549086", noData("02549127"), FROM_MS, NOW)).toThrow(SourceUnavailableError);
  });

  const head = '<?xml version="1.0" encoding="utf-8"?>\r\n<DataTable xmlns="http://MRCS/">';
  const row = (inner: string) => `${head}<DocumentElement xmlns=""><DadosHidrometereologicos>${inner}</DadosHidrometereologicos></DocumentElement></DataTable>`;
  const ok = "<CodEstacao>65010000</CodEstacao><DataHora>2026-11-22 02:00:00 </DataHora><Vazao>1</Vazao><Nivel>2</Nivel><Chuva>0</Chuva>";
  it.each([
    ["empty body", ""],
    ["an HTML page", "<html><body>Service unavailable</body></html>"],
    ["no XML declaration", '<DataTable xmlns="http://MRCS/"></DataTable>'],
    ["a DOCTYPE", `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE x [<!ENTITY a "b">]><DataTable xmlns="http://MRCS/"></DataTable>`],
    ["another root namespace", row(ok).replace("http://MRCS/", "http://example.org/")],
    ["a truncated document", row(ok).slice(0, -40)],
    ["neither rows nor error", `${head}<DocumentElement xmlns="" /></DataTable>`],
    ["another error text", `${head}<ErrorTable><Error>Erro interno do servidor</Error></ErrorTable></DataTable>`],
    ["an error and rows", row(ok).replace("<DocumentElement", "<ErrorTable><Error>Sem dados para esta estação (Código: 65010000) no período solicitado!</Error></ErrorTable><DocumentElement")],
    ["a row for another station", row(ok.replace("65010000", "65009000"))],
    ["a row without a date", row(ok.replace(/<DataHora>.*<\/DataHora>/, ""))],
    ["an impossible date", row(ok.replace("2026-11-22 02:00:00", "2026-02-30 02:00:00"))],
    ["a comma decimal", row(ok.replace("<Nivel>2</Nivel>", "<Nivel>2,5</Nivel>"))],
    ["an exponent", row(ok.replace("<Nivel>2</Nivel>", "<Nivel>1E-2</Nivel>"))],
    ["markup inside a value", row(ok.replace("<Nivel>2</Nivel>", "<Nivel><b>2</b></Nivel>"))],
    ["an unclosed row", row(ok).replace("</DadosHidrometereologicos>", "")],
  ])("fails closed on %s", (_label, body) => {
    expect(() => parseStationData("65010000", body, FROM_MS, NOW)).toThrow(SourceUnavailableError);
  });

  it("accepts the minimal well-formed row the cases above break, and more decimals or a plus sign", () => {
    expect(parseStationData("65010000", row(ok), FROM_MS, NOW).latest).toMatchObject({ level_cm: 2, flow_m3s: 1, rain_mm: 0 });
    const precise = row(ok.replace("<Vazao>1</Vazao>", "<Vazao>6.98123</Vazao>").replace("<Chuva>0</Chuva>", "<Chuva>+0.2</Chuva>"));
    expect(parseStationData("65010000", precise, FROM_MS, NOW).latest).toMatchObject({ flow_m3s: 6.98123, rain_mm: 0.2 });
  });

  it("takes the newest row with a value: a newer row with every value empty, or dated in the future, is skipped", () => {
    const rows = FAZENDINHA.match(/<DadosHidrometereologicos\b[\s\S]*?<\/DadosHidrometereologicos>/g)!;
    const empty = rows[0]!.replace("02:00:00", "02:15:00").replace(/<(Vazao|Nivel|Chuva)>[^<]*<\/\1>/g, "<$1 />");
    const future = rows[0]!.replace("2026-11-22 02:00:00", "2026-11-23 10:00:00").replace("202.00", "999.00");
    const body = FAZENDINHA.replace(rows[0]!, `${future}${empty}${rows[0]!}`);
    expect(parseStationData("65010000", body, FROM_MS, NOW).latest).toEqual({ at: Date.parse("2026-11-22T05:00:00Z"), flow_m3s: 6.98, level_cm: 202, rain_mm: 0 });
  });
});

describe("request period", () => {
  it("uses Curitiba dates, also when the UTC date is already the next day", () => {
    const at = Date.parse("2026-11-22T01:00:00Z"); // 21 Nov, 22:00 in Curitiba
    expect(requestPeriod(at)).toEqual({ from: "2026-11-20", to: "2026-11-21", fromMs: Date.parse("2026-11-20T03:00:00Z") });
    expect(stationDataUrl("65010000", at)).toBe(
      "https://telemetriaws1.ana.gov.br/ServiceANA.asmx/DadosHidrometeorologicos?codEstacao=65010000&dataInicio=20%2F11%2F2026&dataFim=21%2F11%2F2026",
    );
  });
});

describe("river_levels", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns one station by code with one GET: reading in Curitiba time, values, sums, notes and licence", async () => {
    const calls = stubFetch(route("65010000"));
    const out = await levels({ station: "65010000" });
    expect(calls.map((c) => c.url)).toEqual([urlFor("65010000")]);
    expect(out.data.stations).toEqual([
      expect.objectContaining({
        code: "65010000",
        name: "FAZENDINHA",
        river: "RIO PEQUENO",
        municipality: "SÃO JOSÉ DOS PINHAIS",
        status: "ok",
        reading_time: "2026-11-22T02:00:00-03:00",
        stale: false,
        level_cm: 202,
        flow_m3s: 6.98,
        rain_mm: 0,
        rain_1h_mm: 0,
        rain_24h_mm: 1,
      }),
    ]);
    expect(out.note).toContain("Not for emergencies: Defesa Civil 199.");
    expect(out.license_note).toBe("No licence found; facts only; ANA cited.");
    expect(out.source_url).toBe("https://telemetriaws1.ana.gov.br/ServiceANA.asmx");
  });

  it("lists a station without readings as no_recent_data with null values; a code without leading zeros works", async () => {
    stubFetch(route("02549127"));
    const out = await levels({ station: "2549127" });
    expect(out.data.stations[0]).toMatchObject({
      code: "02549127",
      status: "no_recent_data",
      reading_time: null,
      stale: null,
      level_cm: null,
      flow_m3s: null,
      rain_mm: null,
      rain_1h_mm: null,
      rain_24h_mm: null,
    });
  });

  it("matches text in river names, nearest to `near` first, and reads at most 3 stations, 5 s apart", async () => {
    const iguacu = ["65006090", "65009000", "65019980", "65025000"];
    const calls = stubFetch(Object.assign({}, ...iguacu.map((c) => route(c))));
    const pending = levels({ station: "Rio Iguaçu", near: { lat: -25.6, lon: -49.4 } });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5_001);
    const out = await pending;
    expect(calls).toHaveLength(3);
    expect(out.data.stations.map((s) => s.code)).toEqual(["65019980", "65025000", "65009000"]);
    expect(out.data.total_matches).toBe(4);
    expect(out.data.more_matches).toEqual([{ code: "65006090", name: "COMPORTA CANAL ÁGUA LIMPA" }]);
    expect(out.note).toMatch(/1 more matching station\(s\) not read/);
    // Only bundled codes and dates reach the source: never the user's position or text.
    for (const c of calls) expect(c.url).not.toMatch(/iguac|25\.6|49\.4/i);
  });

  it("without arguments reads the 3 river stations nearest to Curitiba centre (rain gauges after them)", async () => {
    const calls = stubFetch({ ...route("65009000"), ...route("65006090"), ...route("65004995") });
    const pending = levels({});
    await vi.advanceTimersByTimeAsync(10_000);
    const out = await pending;
    expect(out.data.stations.map((s) => [s.code, s.distance_km])).toEqual([["65009000", 10.4], ["65006090", 11.2], ["65004995", 15.5]]);
    expect(out.data.more_matches.slice(0, 4).map((m) => m.code)).toEqual(["65006040", "65010000", "65015400", "65019980"]);
    expect(out.data.more_matches).toHaveLength(STATIONS.length - 3);
    expect(calls).toHaveLength(3);
  });

  it("refuses unknown text without a request", async () => {
    const calls = stubFetch({});
    expect(errorOf(await call({ station: "rio amazonas" }))).toEqual({ error: "invalid_argument", message: expect.stringMatching(/No bundled station/) });
    expect(errorOf(await call({ station: "12345678" }))).toMatchObject({ error: "invalid_argument" });
    expect(errorOf(await call({ station: "999" }))).toMatchObject({ error: "invalid_argument" });
    expect(calls).toHaveLength(0);
  });

  it("caches a station 15 minutes and computes `stale` at answer time", async () => {
    vi.setSystemTime(Date.parse("2026-11-22T06:50:00Z")); // 1 h 50 min after the latest reading
    const calls = stubFetch(route("65010000"));
    expect((await levels({ station: "65010000" })).data.stations[0]!.stale).toBe(false);
    await vi.advanceTimersByTimeAsync(14 * 60_000);
    expect((await levels({ station: "fazendinha" })).data.stations[0]!.stale).toBe(true);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60_000);
    await levels({ station: "65010000" });
    expect(calls).toHaveLength(2);
  });

  it("fails closed on a non-XML answer: the station is unavailable, with no values", async () => {
    stubFetch(route("65010000", { contentType: "text/html; charset=utf-8", body: "<html>maintenance</html>" }));
    expect((await levels({ station: "65010000" })).data.stations[0]).toMatchObject({ status: "unavailable", level_cm: null, reading_time: null });
  });

  it("does not ask again for 60 s after a failure (any station), then asks once more", async () => {
    const calls = stubFetch({ ...route("65010000", { status: 500 }), ...route("65019980") });
    for (let i = 0; i < 3; i++) expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "source_unavailable" });
    expect(errorOf(await call({ station: "65019980" }))).toEqual({ error: "source_unavailable" });
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await call({ station: "65019980" })).isError).toBeFalsy();
    expect(calls).toHaveLength(2);
  });

  it("honours a 429's Retry-After without a new request", async () => {
    const calls = stubFetch(route("65010000", { status: 429, headers: { "retry-after": "120" } }));
    expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "rate_limited", message: "The source is limiting requests; wait about 2 minutes before trying again." });
    await vi.advanceTimersByTimeAsync(90_000);
    expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "rate_limited", message: "The source is limiting requests; wait 30 s before trying again." });
    expect(calls).toHaveLength(1);
  });

  it("blocks the host for 10 minutes after a 403, past the 60 s failure memory", async () => {
    const calls = stubFetch({ ...route("65010000", { status: 403 }), ...route("65019980") });
    expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(errorOf(await call({ station: "65019980" }))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    expect(calls).toHaveLength(1);
  });

  it("matches the start of a code", async () => {
    stubFetch(route("65009000"));
    expect((await levels({ station: "65009" })).data.stations.map((s) => s.code)).toEqual(["65009000"]);
  });

  it("marks only a station whose answer cannot be read as unavailable; the host stays open for the others", async () => {
    const calls = stubFetch({
      ...route("65009000"),
      ...route("65006090", { body: noData("65006090").replace("Sem dados", "Erro interno") }),
      ...route("65004995"),
    });
    const pending = levels({});
    await vi.advanceTimersByTimeAsync(10_000);
    const out = await pending;
    expect(out.data.stations.map((s) => [s.code, s.status])).toEqual([["65009000", "no_recent_data"], ["65006090", "unavailable"], ["65004995", "no_recent_data"]]);
    expect(out.data.stations[1]).toMatchObject({ level_cm: null, rain_24h_mm: null, checked_at: null });
    expect(calls).toHaveLength(3);
    // Not a host failure: the next call is not refused (and the unreadable station is asked again, not cached).
    await vi.advanceTimersByTimeAsync(5_000);
    expect((await levels({ station: "65006090" })).data.stations[0]!.status).toBe("unavailable");
    expect(calls).toHaveLength(4);
  });

  it("fails the whole call when a later station's transfer fails: a station not read is never shown as no_recent_data", async () => {
    const calls = stubFetch({ ...route("65009000"), ...route("65006090", { status: 503 }), ...route("65004995") });
    const pending = call({});
    await vi.advanceTimersByTimeAsync(10_000);
    expect(errorOf(await pending)).toEqual({ error: "source_unavailable" });
    expect(calls).toHaveLength(2);
  });

  it("refuses a call whose turn is more than 10 s away, without a request", async () => {
    const calls = stubFetch({ ...route("02549127"), ...route("02549118"), ...route("02549086"), ...route("65010000") });
    // Three requests take the slots at 0, 5 and 10 s: the next one would be 15 s away.
    const pending = ["02549127", "02549118", "02549086"].map((c) => getStationData(station(c)));
    expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "rate_limited", message: "The source is limiting requests; wait 15 s before trying again." });
    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.all(pending);
    expect(calls.map((c) => c.url)).toEqual(["02549127", "02549118", "02549086"].map(urlFor));
  });
});
