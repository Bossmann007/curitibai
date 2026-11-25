import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutOfTimeError } from "../src/hostGate.js";
import { DATA_DIR_ENV } from "../src/localfs.js";
import {
  clearGeoCuritibaCache,
  getUrbsStops,
  URBS_STOPS_LAYER_URL,
  URBS_STOPS_MAX_PAGES,
  URBS_STOPS_PAGE_SIZE,
  urbsStopsPageUrl,
} from "../src/sources/geocuritiba.js";
import { MASK } from "../src/sources/pncp.js";
import { REMOTE_DATA_ENV } from "../src/sources/publishedData.js";
import { busStopsNearOutput } from "../src/tools/busStopsNear.js";
import { connectClient, errorOf, stubFetch, type Route } from "./helpers.js";

// Invented stops written into a temporary CURITIBAI_DATA_DIR/urbs/ at run time, in the real pontosLinha shape; the lines
// file is the shared synthetic fixture (901, X91, 092, 903). No real URBS rows.
const FIXTURES = new URL("./fixtures/urbs_synthetic/", import.meta.url).pathname;
const CENTRE = { lat: -25.5, lon: -49.3 };
const M_PER_DEG_LAT = 111_195; // mean Earth radius 6,371,008.8 m
const north = (m: number) => CENTRE.lat + m / M_PER_DEG_LAT;
const east = (m: number) => CENTRE.lon + m / (M_PER_DEG_LAT * Math.cos((CENTRE.lat * Math.PI) / 180));
const coord = (n: number) => n.toFixed(12).replace(".", ",");

let seq = 0;
function row(num: string, cod: string, sentido: string, lat: number | null, lon: number | null, extra: Record<string, unknown> = {}) {
  seq += 1;
  return {
    NOME: `Parada Fictícia ${num}`,
    NUM: num,
    LAT: lat === null ? "" : coord(lat),
    LON: lon === null ? "" : coord(lon),
    SEQ: String(seq),
    GRUPO: "",
    SENTIDO: sentido,
    TIPO: "Domus",
    ITINERARY_ID: `8${cod.length}${seq}`,
    COD: cod,
    ...extra,
  };
}

function stopRows() {
  seq = 0;
  return [
    // 100 m north: three lines, one of them listed twice in the same direction (another itinerary) and once in the other.
    row("990101", "901", "Terminal Imaginário", north(100), CENTRE.lon),
    row("990101", "X91", "Centro Fictício", north(100), CENTRE.lon),
    row("990101", "901", "Bairro Inventado", north(100), CENTRE.lon),
    row("990101", "901", "Terminal Imaginário", north(100), CENTRE.lon, { ITINERARY_ID: "9999" }),
    row("990101", "x91", "Centro Fictício", north(100), CENTRE.lon), // same line, code in lower case
    // 300 m east, a name with an e-mail address, served by a line that the lines file does not have.
    row("990102", "777", "Vila Inexistente", CENTRE.lat, east(300), {
      NOME: "Praça Inventada - contato ficticio@example.invalid",
      TIPO: "Estação tubo",
    }),
    // 600 m north: outside the default 400 m.
    row("990103", "903", "Bairro Inventado", north(600), CENTRE.lon),
    // 400.4 m: outside 400 m although its distance_m would round to 400.
    row("990109", "903", "Bairro Inventado", north(400.4), CENTRE.lon),
    // No coordinates in any row: never returned.
    row("990104", "903", "Bairro Inventado", null, null),
    // First row without coordinates, then 200 m south, then a different position: the first row with coordinates wins.
    row("990105", "092", "Água Imaginária", null, null),
    row("990105", "903", "Bairro Inventado", north(-200), CENTRE.lon, { TIPO: "Plataforma" }),
    row("990105", "901", "Bairro Inventado", north(5000), CENTRE.lon, { TIPO: "Sem demarcação", NOME: "Outro nome" }),
    // Two stops 250 m away (west and east): ordered by stop number.
    row("990107", "092", "Água Imaginária", CENTRE.lat, east(-250)),
    row("990106", "092", "Água Imaginária", CENTRE.lat, east(250)),
    // One invalid row (stop number with letters), skipped and counted.
    row("99A108", "901", "Terminal Imaginário", north(50), CENTRE.lon),
    // Far filler, so the one invalid row stays under 5%.
    ...Array.from({ length: 20 }, (_, i) => row(String(991000 + i), "X91", "Centro Fictício", north(50_000 + i * 100), CENTRE.lon)),
  ];
}

let tmp: string;
beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-near-")));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
  vi.stubEnv(REMOTE_DATA_ENV, undefined); // remote reading on, whatever the developer's shell has; one test turns it off
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function dataDir({ stops = "2026_11_20", lines = "2026_11_20" as string | null } = {}) {
  mkdirSync(join(tmp, "urbs"), { recursive: true });
  writeFileSync(join(tmp, "urbs", `${stops}_pontosLinha.json`), JSON.stringify(stopRows()));
  if (lines !== null) copyFileSync(join(FIXTURES, "linhas.json"), join(tmp, "urbs", `${lines}_linhas.json`));
}

async function call(args: Record<string, unknown>) {
  vi.stubEnv(DATA_DIR_ENV, tmp);
  const client = await connectClient();
  return client.callTool({ name: "bus_stops_near", arguments: args });
}

async function near(args: Record<string, unknown>) {
  const res = await call({ near: CENTRE, ...args });
  expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
  return busStopsNearOutput.parse(res.structuredContent);
}

describe("bus_stops_near", () => {
  it("returns the stops within 400 m by default, nearest first, one item per stop with its lines deduplicated", async () => {
    dataDir();
    const out = await near({});
    expect(out.data.items.map((s) => [s.stop_number, s.distance_m])).toEqual([
      ["990101", 100],
      ["990105", 200],
      ["990106", 250],
      ["990107", 250],
      ["990102", 300],
    ]);
    expect(out.data).toMatchObject({ total: 5, offset: 0, next_offset: null, skipped_rows: 1 });
    expect(out.data.items[0]).toEqual({
      stop_number: "990101",
      stop_name: "Parada Fictícia 990101",
      lat: Number(north(100).toFixed(12)),
      lon: Number(CENTRE.lon.toFixed(12)),
      distance_m: 100,
      type: "Domus",
      lines: [
        { line_code: "901", line_name: "VILA FICTÍCIA / JD. INVENTADO", direction: "Bairro Inventado" },
        { line_code: "901", line_name: "VILA FICTÍCIA / JD. INVENTADO", direction: "Terminal Imaginário" },
        { line_code: "X91", line_name: "REFORÇO FICTÍCIO", direction: "Centro Fictício" },
      ],
    });
    expect(out.checked_at).toBe("2026-11-20");
    expect(out.note).toContain("not real-time");
    expect(out.note).toContain("bus_departures");
    expect(out.note).toContain("1 row of the file did not match");
    expect(out.license_note).toContain("2026_11_20_pontosLinha.json and 2026_11_20_linhas.json");
    expect(out.license_note).toContain("CC BY 4.0");
  });

  it("widens with radius_m; a stop without coordinates is never returned", async () => {
    dataDir();
    const out = await near({ radius_m: 1000 });
    expect(out.data.items.map((s) => s.stop_number)).toEqual(["990101", "990105", "990106", "990107", "990102", "990109", "990103"]);
    expect(out.data.items.find((s) => s.stop_number === "990109")?.distance_m).toBe(400);
    expect(out.data.items.some((s) => s.stop_number === "990104")).toBe(false);
    const tight = await near({ radius_m: 99 });
    expect(tight.data).toMatchObject({ total: 0, items: [], next_offset: null });
  });

  it("masks contact data in the stop name; a line missing from the lines file has line_name null", async () => {
    dataDir();
    const stop = (await near({})).data.items.find((s) => s.stop_number === "990102");
    expect(stop?.stop_name).toBe(`Praça Inventada - contato ${MASK}`);
    expect(stop?.stop_name).not.toContain("example.invalid");
    expect(stop?.lines).toEqual([{ line_code: "777", line_name: null, direction: "Vila Inexistente" }]);
  });

  it("takes name, position and type from the stop's first row with coordinates", async () => {
    dataDir();
    const stop = (await near({})).data.items.find((s) => s.stop_number === "990105");
    expect(stop).toMatchObject({ stop_name: "Parada Fictícia 990105", distance_m: 200, type: "Plataforma" });
    expect(stop?.lines?.map((l) => [l.line_code, l.direction])).toEqual([
      ["092", "Água Imaginária"],
      ["901", "Bairro Inventado"],
      ["903", "Bairro Inventado"],
    ]);
  });

  it("line_code keeps only the stops that line serves, with every line of each stop; case ignored", async () => {
    dataDir();
    const out = await near({ line_code: "x91" });
    expect(out.data.items.map((s) => s.stop_number)).toEqual(["990101"]);
    expect(out.data.items[0]?.lines).toHaveLength(3);
    // A known line with no stop in the radius is an empty page, not an error.
    expect((await near({ line_code: "903", radius_m: 150 })).data).toMatchObject({ total: 0, items: [] });
    const unknown = errorOf(await call({ near: CENTRE, line_code: "404" })) as { error: string; message: string };
    expect(unknown).toMatchObject({ error: "invalid_argument" });
    expect(unknown.message).toContain("bus_lines_search");
  });

  it("pages over stops, not rows", async () => {
    dataDir();
    const p = await near({ limit: 2, offset: 1 });
    expect(p.data.items.map((s) => s.stop_number)).toEqual(["990105", "990106"]);
    expect(p.data).toMatchObject({ total: 5, offset: 1, next_offset: 3 });
    expect((await near({ limit: 2, offset: 4 })).data).toMatchObject({ next_offset: null });
  });

  it("names the lines file in the note when its date differs", async () => {
    dataDir({ lines: "2026_11_19" });
    const out = await near({});
    expect(out.checked_at).toBe("2026-11-20");
    expect(out.note).toContain("2026_11_19_linhas.json");
    expect(out.note).toContain("2026-11-19");
  });

  it("validates its input", async () => {
    dataDir();
    expect((await call({})).isError).toBe(true);
    expect((await call({ near: CENTRE, radius_m: 2001 })).isError).toBe(true);
    expect((await call({ near: CENTRE, radius_m: 0 })).isError).toBe(true);
    expect((await call({ near: CENTRE, limit: 51 })).isError).toBe(true);
    expect((await call({ near: { lat: 91, lon: 0 } })).isError).toBe(true);
    expect((await call({ near: CENTRE, line_code: "9 01" })).isError).toBe(true);
    expect((await near({ radius_m: 2000, limit: 50 })).data.total).toBe(7);
  });

  it("data_not_available without the lines file; without the stops file, line_code is data_not_available", async () => {
    dataDir({ lines: null });
    expect(errorOf(await call({ near: CENTRE }))).toMatchObject({ error: "data_not_available" });
    rmSync(join(tmp, "urbs"), { recursive: true });
    mkdirSync(join(tmp, "urbs"));
    copyFileSync(join(FIXTURES, "linhas.json"), join(tmp, "urbs", "2026_11_20_linhas.json"));
    // Without the stops file the GeoCuritiba layer is asked (v0.29.0); here the test fetch stub fails.
    expect(errorOf(await call({ near: CENTRE }))).toMatchObject({ error: "source_unavailable" });
    const withLine = errorOf(await call({ near: CENTRE, line_code: "901" })) as { error: string; message: string };
    expect(withLine).toMatchObject({ error: "data_not_available" });
    expect(withLine.message).toContain("pontosLinha");
  });
});

// v0.29.0: without a local stops file, the GeoCuritiba stop layer (invented features in the layer's shape, built here).
describe("bus_stops_near without the URBS export (GeoCuritiba layer)", () => {
  type Feature = { attributes: Record<string, unknown>; geometry?: { x: number; y: number } };
  const feature = (num: unknown, lat: number, lon: number, extra: Record<string, unknown> = {}): Feature => ({
    attributes: { num, nome_ponto: `Parada Fictícia ${String(num)}`, tipo: "Domus", ...extra },
    geometry: { x: lon, y: lat },
  });
  const far = (i: number) => feature(800_000 + i, north(20_000 + (i % 100)), CENTRE.lon);
  const pageBody = (features: Feature[], extra: Record<string, unknown> = {}) =>
    JSON.stringify({ spatialReference: { wkid: 4326, latestWkid: 4326 }, features, ...extra });
  const route = (body: string): Route => ({ body, contentType: "application/json; charset=UTF-8" });

  function layerRoutes(): Record<string, Route> {
    const first = Array.from({ length: URBS_STOPS_PAGE_SIZE }, (_, i) => far(i));
    first[0] = feature(990201, north(100), CENTRE.lon);
    first[1] = feature(990202, CENTRE.lat, east(300), { nome_ponto: "Praça Inventada - contato ficticio@example.invalid", tipo: null });
    const second = [
      feature(990203, north(-250), CENTRE.lon, { tipo: "Estação tubo" }),
      feature(990201, north(5000), CENTRE.lon), // repeated number: the first record wins
      feature(990204, north(600), CENTRE.lon), // outside 400 m
      feature(990205, -10, -40), // outside the Curitiba box: skipped
      { attributes: { num: "99A", nome_ponto: "Sem número", tipo: "Domus" }, geometry: { x: CENTRE.lon, y: CENTRE.lat } },
    ];
    return {
      [`GET ${urbsStopsPageUrl(0)}`]: route(pageBody(first, { exceededTransferLimit: true })),
      [`GET ${urbsStopsPageUrl(1)}`]: route(pageBody(second)),
    };
  }

  /** The host gate spaces requests 5 s apart: run the call on fake timers and let them pass. */
  async function layerCall(args: Record<string, unknown>) {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
    vi.stubEnv(DATA_DIR_ENV, tmp); // an empty data folder: no urbs/ at all
    const client = await connectClient();
    const pending = client.callTool({ name: "bus_stops_near", arguments: args });
    await vi.advanceTimersByTimeAsync(60_000);
    return pending;
  }

  it("reads every page once, filters the position here and says which source answered", async () => {
    const calls = stubFetch(layerRoutes());
    const res = await layerCall({ near: CENTRE });
    expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
    const out = busStopsNearOutput.parse(res.structuredContent);
    expect(out.data.source).toBe("geocuritiba_layer");
    expect(out.data.items.map((s) => [s.stop_number, s.distance_m, s.type, s.lines])).toEqual([
      ["990201", 100, "Domus", null],
      ["990203", 250, "Estação tubo", null],
      ["990202", 300, "", null],
    ]);
    expect(out.data.items[2]?.stop_name).toBe(`Praça Inventada - contato ${MASK}`);
    expect(out.data.skipped_rows).toBe(2);
    expect(out.source_url).toBe(URBS_STOPS_LAYER_URL);
    expect(out.checked_at).toBe("2026-11-24");
    expect(out.note).toContain("publishes no update date");
    expect(out.note).toContain("1 repeated stop number(s)");
    expect(out.note).toContain(`Read as 2 page(s), ${URBS_STOPS_PAGE_SIZE + 2} stops`);
    // Two fixed page queries on layer 1; the user's position is never sent, and no other field is asked.
    expect(calls.map((c) => c.url)).toEqual([urbsStopsPageUrl(0), urbsStopsPageUrl(1)]);
    for (const c of calls) {
      const u = new URL(c.url);
      expect(u.pathname).toBe("/server/rest/services/GeoCuritiba/URBS_Transporte_Publico/MapServer/1/query");
      expect(u.searchParams.get("outFields")).toBe("num,nome_ponto,tipo");
      expect(c.url).not.toContain("-25.5");
    }
    // Cached: a second call makes no request.
    await layerCall({ near: CENTRE, radius_m: 2000 });
    expect(calls).toHaveLength(2);
  });

  it("a changed layer shape (num as text) fails closed instead of answering no stops; the error says how to use the export", async () => {
    const routes = layerRoutes();
    const asText = (f: Feature): Feature => ({ ...f, attributes: { ...f.attributes, num: String(f.attributes.num) } });
    for (const p of [0, 1]) {
      const body = JSON.parse(routes[`GET ${urbsStopsPageUrl(p)}`]!.body!) as { features: Feature[] };
      routes[`GET ${urbsStopsPageUrl(p)}`] = route(pageBody(body.features.map(asText), p === 0 ? { exceededTransferLimit: true } : {}));
    }
    stubFetch(routes);
    const err = errorOf(await layerCall({ near: CENTRE })) as { error: string; message: string };
    expect(err.error).toBe("source_unavailable");
    expect(err.message).toMatch(/^Without the network, this tool works from the URBS export\. .*pontosLinha/);
  });

  it("line_code without the export is data_not_available, with no request", async () => {
    const calls = stubFetch(layerRoutes());
    const res = await layerCall({ near: CENTRE, line_code: "901" });
    expect(errorOf(res)).toMatchObject({ error: "data_not_available" });
    expect(calls).toHaveLength(0);
  });

  it(`${REMOTE_DATA_ENV}=0 keeps it local: data_not_available with no request; unset, the layer answers`, async () => {
    const calls = stubFetch(layerRoutes());
    for (const value of ["0", "off", " OFF ", "false", "no", "", "maybe"]) {
      vi.stubEnv(REMOTE_DATA_ENV, value);
      const err = errorOf(await layerCall({ near: CENTRE })) as { error: string; message: string };
      expect(err).toMatchObject({ error: "data_not_available" });
      expect(err.message).toContain(`${REMOTE_DATA_ENV} is off, so this tool stays local`);
      vi.useRealTimers();
    }
    expect(calls).toHaveLength(0);
    vi.stubEnv(REMOTE_DATA_ENV, undefined);
    const res = await layerCall({ near: CENTRE });
    expect(busStopsNearOutput.parse(res.structuredContent).data.source).toBe("geocuritiba_layer");
    expect(calls).toHaveLength(2);
  });


  it("fails closed on a short page cut by the record limit, and on more pages than expected", async () => {
    const routes = layerRoutes();
    routes[`GET ${urbsStopsPageUrl(1)}`] = route(pageBody([far(1)], { exceededTransferLimit: true }));
    stubFetch(routes);
    expect(errorOf(await layerCall({ near: CENTRE }))).toMatchObject({ error: "source_unavailable" });

    clearGeoCuritibaCache();
    vi.useRealTimers();
    const full = route(pageBody(Array.from({ length: URBS_STOPS_PAGE_SIZE }, (_, i) => far(i)), { exceededTransferLimit: true }));
    stubFetch(Object.fromEntries(Array.from({ length: URBS_STOPS_MAX_PAGES }, (_, p) => [`GET ${urbsStopsPageUrl(p)}`, full])));
    expect(errorOf(await layerCall({ near: CENTRE }))).toMatchObject({ error: "source_unavailable" });
  });

  it("a call stopped by its time budget caches the pages read, and the next call resumes from them", async () => {
    const calls = stubFetch(layerRoutes());
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    const first = getUrbsStops(Date.now() + 1_000).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await first).toBeInstanceOf(OutOfTimeError);
    expect(calls).toHaveLength(1);
    const second = getUrbsStops(Date.now() + 20_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await second).value.stops).toHaveLength(URBS_STOPS_PAGE_SIZE + 2);
    expect(calls.map((c) => c.url)).toEqual([urbsStopsPageUrl(0), urbsStopsPageUrl(1)]);
  });

  it("with the export, keeps today's answer (source urbs_export, lines per stop) and makes no request", async () => {
    dataDir();
    const out = await near({});
    expect(out.data.source).toBe("urbs_export");
    expect(out.data.items[0]?.lines).toHaveLength(3);
    expect(out.note).toContain("Source: the local URBS export.");
  });

  it("a stops file that is not valid keeps its error (no fallback to the layer)", async () => {
    mkdirSync(join(tmp, "urbs"), { recursive: true });
    writeFileSync(join(tmp, "urbs", "2026_11_20_pontosLinha.json"), "not json");
    copyFileSync(join(FIXTURES, "linhas.json"), join(tmp, "urbs", "2026_11_20_linhas.json"));
    expect(errorOf(await call({ near: CENTRE }))).toMatchObject({ error: "invalid_data" });
  });
});
