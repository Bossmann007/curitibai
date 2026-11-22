import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assessQuality, getStationData, parseStationData, requestPeriod, STATIONS, stationDataUrl, type Reading, type Station } from "../src/sources/ana.js";
import { OutOfTimeError } from "../src/hostGate.js";
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
    expect(parseStationData("02549127", noData("02549127"), FROM_MS, NOW)).toEqual({ code: "02549127", latest: null, rain_1h_mm: null, rain_24h_mm: null, quality: "unknown", quality_reasons: [] });
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

describe("assessQuality (data quality checks)", () => {
  const MIN = 60_000;
  /** End of the SYNTHETIC series below (not a capture). */
  const END = Date.parse("2026-11-22T05:00:00Z");
  /**
   * SYNTHETIC readings, not a capture: `n` rows 15 minutes apart ending at END, oldest first, level `base(i)` (rising
   * 1 cm per hour, like the real Fazendinha day), flow 5 m³/s and rain 0 unless `f(i)` says otherwise.
   */
  const base = (i: number) => 200 + Math.floor(i / 4);
  const synthetic = (n: number, f: (i: number) => Partial<Reading> = () => ({})): Reading[] =>
    Array.from({ length: n }, (_, i) => ({ at: END - (n - 1 - i) * 15 * MIN, level_cm: base(i), flow_m3s: 5, rain_mm: 0, ...f(i) }));
  const OK = { quality: "ok", quality_reasons: [] };
  const suspect = (...reasons: string[]) => ({ quality: "suspect", quality_reasons: reasons });

  it("keeps both real samples (a normal day at Fazendinha and ETE Araucária) ok", () => {
    expect(parseStationData("65010000", FAZENDINHA, FROM_MS, NOW)).toMatchObject(OK);
    expect(parseStationData("65019980", ARAUCARIA, FROM_MS, NOW)).toMatchObject(OK);
  });

  it("is unknown without readings, and with fewer than 8 readings in the 24 h when no check fires", () => {
    expect(assessQuality([])).toEqual({ quality: "unknown", quality_reasons: [] });
    expect(assessQuality(synthetic(7))).toEqual({ quality: "unknown", quality_reasons: ["too_few_readings"] });
    expect(assessQuality(synthetic(8))).toEqual(OK);
    expect(assessQuality(synthetic(5, (i) => (i === 2 ? { rain_mm: -1 } : {})))).toEqual(suspect("out_of_range"));
    expect(parseStationData("02549127", noData("02549127"), FROM_MS, NOW)).toMatchObject({ quality: "unknown", quality_reasons: [] });
  });

  it.each([
    ["a negative level", { level_cm: -3 }], // also a 200 cm jump that comes back: level_spike too
    ["a negative flow", { flow_m3s: -0.5 }],
    ["negative rain", { rain_mm: -0.2 }],
    ["more than 150 mm of rain in one reading", { rain_mm: 150.2 }],
  ])("flags %s anywhere in the 24 h as out_of_range", (_label, bad) => {
    expect(assessQuality(synthetic(96, (i) => (i === 10 ? bad : {})))).toMatchObject({ quality: "suspect", quality_reasons: expect.arrayContaining(["out_of_range"]) });
  });

  it("accepts 150 mm in one reading and 0 values; ignores a bad reading older than 24 h", () => {
    expect(assessQuality(synthetic(96, (i) => (i === 10 ? { rain_mm: 150, flow_m3s: 0 } : {})))).toEqual(OK);
    expect(assessQuality(synthetic(120, (i) => (i === 10 ? { level_cm: -3 } : {})))).toEqual(OK);
  });

  it("flags a level jump over 100 cm in 15 minutes that comes back within an hour as level_spike", () => {
    expect(assessQuality(synthetic(96, (i) => (i === 50 ? { level_cm: base(i) + 150 } : {})))).toEqual(suspect("level_spike"));
    expect(assessQuality(synthetic(96, (i) => (i === 50 || i === 51 ? { level_cm: base(i) - 180 } : {})))).toEqual(suspect("level_spike"));
  });

  it("does not flag a jump of exactly 100 cm, a step that stays, or a jump across a gap in the readings", () => {
    expect(assessQuality(synthetic(96, (i) => (i === 50 ? { level_cm: base(49) + 100 } : {})))).toEqual(OK);
    expect(assessQuality(synthetic(96, (i) => (i >= 50 ? { level_cm: base(i) + 150 } : {})))).toEqual(OK);
    const gap = synthetic(96, (i) => (i === 50 ? { level_cm: base(i) + 150 } : {})).filter((_, i) => i !== 49);
    expect(assessQuality(gap)).toEqual(OK);
  });

  it("flags a jump over 100 cm on the latest reading as level_jump_unconfirmed (it cannot have come back yet)", () => {
    expect(assessQuality(synthetic(96, (i) => (i === 95 ? { level_cm: base(i) + 101 } : {})))).toEqual(suspect("level_jump_unconfirmed"));
    // Still high 15 and 45 minutes later: not back yet, the hour has not passed.
    expect(assessQuality(synthetic(96, (i) => (i >= 94 ? { level_cm: base(i) + 150 } : {})))).toEqual(suspect("level_jump_unconfirmed"));
    expect(assessQuality(synthetic(96, (i) => (i >= 92 ? { level_cm: base(i) + 150 } : {})))).toEqual(suspect("level_jump_unconfirmed"));
  });

  it("reports a spike that came back on the latest reading only as level_spike (the latest value is the normal one)", () => {
    expect(assessQuality(synthetic(96, (i) => (i === 94 ? { level_cm: base(i) + 200 } : {})))).toEqual(suspect("level_spike"));
  });

  it("ignores two rows with the same time (not two readings 15 minutes apart)", () => {
    const series = synthetic(96);
    series.push({ ...series[95]!, level_cm: series[95]!.level_cm! + 150 });
    expect(assessQuality(series)).toEqual(OK);
  });

  it("judges a station that reports a level on its level readings: 96 rain readings with 6 levels are too few", () => {
    expect(assessQuality(synthetic(96, (i) => (i % 16 === 0 ? {} : { level_cm: null })))).toEqual({ quality: "unknown", quality_reasons: ["too_few_readings"] });
    expect(assessQuality(synthetic(96, () => ({ level_cm: null, flow_m3s: null })))).toEqual(OK); // a rain gauge
  });

  it("flags a level identical for 6 h or more, with at least 20 readings, while 10 mm or more of rain fell, as level_stuck", () => {
    // The last 25 readings (6 h) are flat at 180 cm; 0.5 mm fell in each of them (12.5 mm).
    const flatInRain = (n: number, rain: number) =>
      synthetic(96, (i) => (i < 96 - n ? { level_cm: 150 + i } : { level_cm: 180, rain_mm: rain }));
    expect(assessQuality(flatInRain(25, 0.5))).toEqual(suspect("level_stuck"));
    expect(assessQuality(flatInRain(25, 0))).toEqual(OK); // dry: a flat baseflow is normal
    expect(assessQuality(flatInRain(24, 0.5))).toEqual(OK); // 5 h 45 min
    // 6 h span but only 13 readings (one every 30 minutes): too sparse to call it stuck.
    expect(assessQuality(flatInRain(25, 1).filter((r, i) => i < 71 || i % 2 === 1))).toEqual(OK);
  });

  it("never changes the raw values: a suspect latest reading is returned as sent (real Fazendinha sample, latest level edited)", () => {
    const edited = FAZENDINHA.replace("<Nivel>202.00</Nivel>", "<Nivel>350.00</Nivel>");
    expect(parseStationData("65010000", edited, FROM_MS, NOW)).toMatchObject({
      latest: { level_cm: 350, flow_m3s: 6.98, rain_mm: 0 },
      ...suspect("level_jump_unconfirmed"),
    });
  });

  it("does not trust row order", () => {
    const series = synthetic(96, (i) => (i === 50 ? { level_cm: base(i) + 150 } : {}));
    expect(assessQuality([...series].reverse())).toEqual(suspect("level_spike"));
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
    expect(out.data.stations[0]).toMatchObject({ quality: "ok", quality_reasons: [] });
    expect(out.note).toContain("Not for emergencies: Defesa Civil 199.");
    expect(out.note).not.toMatch(/caution/);
    expect(out.license_note).toBe("No licence found; facts only; ANA cited.");
    expect(out.source_url).toBe("https://telemetriaws1.ana.gov.br/ServiceANA.asmx");
  });

  it("marks a suspect station and says so in the note, with the raw values unchanged (real sample, latest level edited)", async () => {
    stubFetch(route("65010000", { body: FAZENDINHA.replace("<Nivel>202.00</Nivel>", "<Nivel>350.00</Nivel>") }));
    const out = await levels({ station: "65010000" });
    expect(out.data.stations[0]).toMatchObject({ level_cm: 350, flow_m3s: 6.98, stale: false, quality: "suspect", quality_reasons: ["level_jump_unconfirmed"] });
    expect(out.note).toContain("Suspect readings at 65010000 (see quality_reasons): treat these values with caution.");
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
      quality: "unknown",
      quality_reasons: [],
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
    expect(out.data.partial).toBe(false);
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

  it("fails closed on an HTML 200 answer as a host failure: 4 calls within 60 s make 1 request", async () => {
    const calls = stubFetch({ ...route("65010000", { contentType: "text/html; charset=utf-8", body: "<html>maintenance</html>" }), ...route("65019980") });
    for (let i = 0; i < 3; i++) expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "source_unavailable" });
    expect(errorOf(await call({ station: "65019980" }))).toEqual({ error: "source_unavailable" });
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await call({ station: "65019980" })).isError).toBeFalsy();
    expect(calls).toHaveLength(2);
  });

  it("treats an XML content type with a body that is not ANA's document (invalid or truncated XML) as a host failure", async () => {
    const truncated = FAZENDINHA.slice(0, FAZENDINHA.length / 2);
    for (const body of ["<html>not xml</html>", truncated, '<?xml version="1.0" encoding="utf-8"?><Other />']) {
      vi.setSystemTime(Date.now() + 61_000);
      const calls = stubFetch(route("65010000", { body }));
      expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "source_unavailable" });
      expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "source_unavailable" });
      expect(calls).toHaveLength(1);
    }
  });

  it("blocks the host for 10 minutes on a 200 CAPTCHA or challenge page", async () => {
    const page = '<html><div class="cf-turnstile">verify you are human</div></html>';
    const calls = stubFetch({ ...route("65010000", { contentType: "text/html", body: page }), ...route("65019980") });
    expect(errorOf(await call({ station: "65010000" }))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(errorOf(await call({ station: "65019980" }))).toEqual({ error: "source_unavailable", message: expect.stringMatching(/refused/) });
    expect(calls).toHaveLength(1);
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
    expect(out.data.stations[1]).toMatchObject({ level_cm: null, rain_24h_mm: null, checked_at: null, quality: "unknown", quality_reasons: [] });
    expect(calls).toHaveLength(3);
    // Not a host failure: other stations are still asked; the unreadable one is remembered 60 s, then asked again.
    await vi.advanceTimersByTimeAsync(5_000);
    expect((await levels({ station: "65006090" })).data.stations[0]!.status).toBe("unavailable");
    expect(calls).toHaveLength(3);
    vi.setSystemTime(Date.now() + 15 * 60_000); // the readable stations' cache expired too
    expect((await levels({ station: "65009000" })).data.stations[0]!.status).toBe("no_recent_data");
    expect(calls).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(5_000);
    expect((await levels({ station: "65006090" })).data.stations[0]!.status).toBe("unavailable");
    expect(calls).toHaveLength(5);
  });

  it("a station with a bad answer ahead of a healthy one does not stop it, on every call", async () => {
    const bad = noData("65006090").replace("Sem dados", "Erro interno");
    const calls = stubFetch({ ...route("65009000", { body: bad }), ...route("65006090"), ...route("65004995") });
    for (let i = 0; i < 2; i++) {
      const pending = levels({});
      await vi.advanceTimersByTimeAsync(10_000);
      const out = await pending;
      expect(out.data.stations.map((s) => s.status)).toEqual(["unavailable", "no_recent_data", "no_recent_data"]);
      await vi.advanceTimersByTimeAsync(5_000);
    }
    expect(calls).toHaveLength(3); // the bad station remembered, the others cached
  });

  it("starts no request after the 20 s budget: returns the stations read, partial, the rest first in more_matches", async () => {
    // Only other requests sharing the host can push a station's slot past the budget: S1's transfer takes 9 s while
    // three other requests take the slots at 5, 10 and 20 s, so S3's slot (25 s) is after the call's 20 s.
    const delays: Record<string, number> = { "65009000": 9_000 };
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      const code = new URL(url).searchParams.get("codEstacao")!;
      await new Promise((r) => setTimeout(r, delays[code] ?? 0));
      return new Response(noData(code), { status: 200, headers: { "content-type": XML_TYPE } });
    }));
    const pending = levels({});
    await vi.advanceTimersByTimeAsync(1_000);
    const o1 = getStationData(station("02549127"));
    await vi.advanceTimersByTimeAsync(5_000);
    const o2 = getStationData(station("02549118"));
    await vi.advanceTimersByTimeAsync(5_000);
    const o3 = getStationData(station("02549086"));
    await vi.advanceTimersByTimeAsync(20_000);
    const out = await pending;
    await Promise.all([o1, o2, o3]);
    expect(out.data.partial).toBe(true);
    expect(out.data.stations.map((s) => s.code)).toEqual(["65009000", "65006090"]);
    expect(out.data.more_matches[0]).toEqual({ code: "65004995", name: expect.any(String) });
    expect(out.data.more_matches).toHaveLength(STATIONS.length - 2);
    expect(out.note).toMatch(/Partial: 1 station\(s\) not read because the 20 s time budget/);
    expect(out.note).toMatch(/22 more matching station\(s\) not read/);
    expect(urls.some((u) => u.includes("65004995"))).toBe(false);
    expect(urls).toHaveLength(5);
  });

  it("fails the whole call when a later station's transfer fails: a station not read is never shown as no_recent_data", async () => {
    const calls = stubFetch({ ...route("65009000"), ...route("65006090", { status: 503 }), ...route("65004995") });
    const pending = call({});
    await vi.advanceTimersByTimeAsync(10_000);
    expect(errorOf(await pending)).toEqual({ error: "source_unavailable" });
    expect(calls).toHaveLength(2);
  });

  it("a call joining another call's load that ran out of time reads the station under its own budget", async () => {
    const calls = stubFetch({ ...route("02549127"), ...route("65010000") });
    const other = getStationData(station("02549127")); // slot 0; the next slot is 5 s away
    const short = getStationData(station("65010000"), Date.now() + 1_000);
    const own = getStationData(station("65010000"), Date.now() + 20_000); // joins the same load
    await expect(short).rejects.toBeInstanceOf(OutOfTimeError);
    await vi.advanceTimersByTimeAsync(5_000);
    expect((await own).value.latest).not.toBeNull();
    await other;
    expect(calls.map((c) => c.url)).toEqual([urlFor("02549127"), urlFor("65010000")]);
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
