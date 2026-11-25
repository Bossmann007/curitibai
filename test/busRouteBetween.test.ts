import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATA_DIR_ENV } from "../src/localfs.js";
import { MASK } from "../src/mask.js";
import { busRouteBetweenOutput } from "../src/tools/busRouteBetween.js";
import { connectClient, errorOf } from "./helpers.js";

// Invented stops written into a temporary CURITIBAI_DATA_DIR/urbs/ at run time, in the real pontosLinha shape; the
// lines file is the shared synthetic fixture (901, X91, 092, 903). No real URBS rows.
const FIXTURES = new URL("./fixtures/urbs_synthetic/", import.meta.url).pathname;
const FROM = { lat: -25.5, lon: -49.3 };
const M_PER_DEG_LAT = 111_195;
/** A point `m` metres north of FROM (the destination area is 3 km north). */
const north = (m: number) => FROM.lat + m / M_PER_DEG_LAT;
const TO = { lat: north(3000), lon: FROM.lon };
const coord = (n: number) => n.toFixed(12).replace(".", ",");

function stop(num: string, cod: string, itinerary: string, seq: number, sentido: string, metresNorth: number, extra: Record<string, unknown> = {}) {
  return {
    NOME: `Parada Fictícia ${num}`,
    NUM: num,
    LAT: coord(north(metresNorth)),
    LON: coord(FROM.lon),
    SEQ: String(seq),
    GRUPO: "",
    SENTIDO: sentido,
    TIPO: "Domus",
    ITINERARY_ID: itinerary,
    COD: cod,
    ...extra,
  };
}

const stopRows = () => [
  // 901 northbound: two boarding stops (100 m and 300 m), a middle stop, two alighting stops (2,950 m and 3,400 m).
  stop("990301", "901", "8101", 1, "Terminal Imaginário", 300),
  stop("990302", "901", "8101", 2, "Terminal Imaginário", 100),
  stop("990303", "901", "8101", 3, "Terminal Imaginário", 1500),
  stop("990304", "901", "8101", 4, "Terminal Imaginário", 2950),
  stop("990305", "901", "8101", 5, "Terminal Imaginário", 3400),
  // 901 southbound: the same stops the other way, so it never takes you north.
  stop("990305", "901", "8102", 1, "Bairro Inventado", 3400),
  stop("990304", "901", "8102", 2, "Bairro Inventado", 2950),
  stop("990302", "901", "8102", 3, "Bairro Inventado", 100),
  // X91 serves both areas, but only southbound: it goes to other_lines.
  stop("990306", "X91", "8201", 1, "Centro Fictício", 3050),
  stop("990307", "X91", "8201", 2, "Centro Fictício", 50),
  // 777 (not in the lines file) northbound, with a masked stop name: 400 m + 100 m of walking.
  stop("990308", "777", "8301", 1, "Vila Inexistente", -400, { NOME: "Praça Inventada - contato ficticio@example.invalid" }),
  stop("990309", "777", "8301", 2, "Vila Inexistente", 3100),
  // 903 serves only the origin area.
  stop("990310", "903", "8401", 1, "Bairro Inventado", 200),
  stop("990311", "903", "8401", 2, "Bairro Inventado", 10_000),
  // 092 stops once at a stop that is in both areas (radius 1000): it must not be paired with itself.
  stop("990312", "092", "8501", 1, "Água Imaginária", 1500),
];

let tmp: string;
beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "curitibai-route-")));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(tmp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function dataDir({ stops = true, lines = true } = {}) {
  mkdirSync(join(tmp, "urbs"), { recursive: true });
  if (stops) writeFileSync(join(tmp, "urbs", "2026_11_20_pontosLinha.json"), JSON.stringify(stopRows()));
  if (lines) copyFileSync(join(FIXTURES, "linhas.json"), join(tmp, "urbs", "2026_11_20_linhas.json"));
}

async function call(args: Record<string, unknown>) {
  vi.stubEnv(DATA_DIR_ENV, tmp);
  const client = await connectClient();
  return client.callTool({ name: "bus_route_between", arguments: args });
}

async function route(args: Record<string, unknown> = {}) {
  const res = await call({ from: FROM, to: TO, ...args });
  expect(res.isError, JSON.stringify(res.content)).toBeFalsy();
  return busRouteBetweenOutput.parse(res.structuredContent);
}

describe("bus_route_between", () => {
  it("lists direct lines whose itinerary passes a stop near `from` before a stop near `to`, least walking first", async () => {
    dataDir();
    const out = await route();
    expect(out.data.items).toEqual([
      {
        line_code: "901",
        line_name: "VILA FICTÍCIA / JD. INVENTADO",
        direction: "Terminal Imaginário",
        itinerary_id: "8101",
        board: { stop_number: "990302", stop_name: "Parada Fictícia 990302", distance_m: 100 },
        alight: { stop_number: "990304", stop_name: "Parada Fictícia 990304", distance_m: 50 },
        walk_m: 150,
      },
      {
        line_code: "777",
        line_name: null,
        direction: "Vila Inexistente",
        itinerary_id: "8301",
        board: { stop_number: "990308", stop_name: `Praça Inventada - contato ${MASK}`, distance_m: 400 },
        alight: { stop_number: "990309", stop_name: "Parada Fictícia 990309", distance_m: 100 },
        walk_m: 500,
      },
    ]);
    expect(out.data.other_lines).toEqual([{ line_code: "X91", line_name: "REFORÇO FICTÍCIO" }]);
    expect(out.data).toMatchObject({ radius_m: 500, origin_stops: 5, destination_stops: 4, total: 2, next_offset: null });
    expect(out.checked_at).toBe("2026-11-20");
    expect(out.note).toContain("Direct lines only");
    expect(out.note).toContain("not real-time");
    expect(out.note).toContain("straight-line");
    expect(out.note).toContain("SEQ");
    expect(out.license_note).toContain("2026_11_20_pontosLinha.json and 2026_11_20_linhas.json");
  });

  it("the other way round uses the southbound itineraries; never pairs a stop with itself", async () => {
    dataDir();
    const back = await route({ from: TO, to: FROM });
    expect(back.data.items.map((i) => `${i.line_code}/${i.itinerary_id} ${i.board.stop_number}>${i.alight.stop_number}`)).toEqual([
      "X91/8201 990306>990307",
      "901/8102 990304>990302",
    ]);
    expect(back.data.other_lines).toEqual([{ line_code: "777", line_name: null }]);
    // Between points 1 km and 2 km north, at 1000 m both areas hold 990312 (1,500 m north), the only stop of 092.
    const wide = await route({ from: { lat: north(1000), lon: FROM.lon }, to: { lat: north(2000), lon: FROM.lon }, radius_m: 1000 });
    expect(wide.data.items.map((i) => i.line_code)).toContain("901");
    expect(wide.data.items.map((i) => i.line_code)).not.toContain("092");
    expect(wide.data.other_lines.map((l) => l.line_code)).not.toContain("092");
  });

  it("an empty list says transfers and integration terminals are not modelled", async () => {
    dataDir();
    const out = await route({ to: { lat: north(20_000), lon: FROM.lon } });
    expect(out.data.items).toEqual([]);
    expect(out.data.destination_stops).toBe(0);
    expect(out.note).toContain("No direct line");
    expect(out.note).toContain("terminal");
  });

  it("citizen eval q111/q120 world: Rodoferroviária to Parque Barigui and back on the shared synthetic fixture", async () => {
    mkdirSync(join(tmp, "urbs"), { recursive: true });
    for (const kind of ["pontosLinha", "linhas"]) {
      copyFileSync(join(FIXTURES, `${kind}.json`), join(tmp, "urbs", `2026_11_20_${kind}.json`));
    }
    const rodo = { lat: -25.437, lon: -49.257 };
    const barigui = { lat: -25.422, lon: -49.308 };
    const brief = (o: { data: { items: { line_code: string; direction: string; board: { stop_number: string }; alight: { stop_number: string } }[] } }) =>
      o.data.items.map((i) => `${i.line_code} ${i.direction}: ${i.board.stop_number}>${i.alight.stop_number}`);
    expect(brief(await route({ from: rodo, to: barigui }))).toEqual(["903 Parque Barigui: 990101>990103"]);
    expect(brief(await route({ from: barigui, to: rodo }))).toEqual(["903 Rodoferroviária: 990103>990101"]);
  });

  it("pages with limit and offset", async () => {
    dataDir();
    const first = await route({ limit: 1 });
    expect(first.data).toMatchObject({ total: 2, offset: 0, next_offset: 1 });
    expect((await route({ limit: 1, offset: 1 })).data.items[0]?.line_code).toBe("777");
  });

  it("refuses a radius over 1000 m", async () => {
    dataDir();
    expect((await call({ from: FROM, to: TO, radius_m: 1001 })).isError).toBe(true);
  });

  it("data_not_available without the stops or the lines file (no network fallback)", async () => {
    dataDir({ stops: false });
    const noStops = errorOf(await call({ from: FROM, to: TO })) as { error: string; message: string };
    expect(noStops).toMatchObject({ error: "data_not_available" });
    expect(noStops.message).toContain("pontosLinha");
    rmSync(join(tmp, "urbs"), { recursive: true });
    dataDir({ lines: false });
    const noLines = errorOf(await call({ from: FROM, to: TO })) as { error: string; message: string };
    expect(noLines).toMatchObject({ error: "data_not_available" });
    expect(noLines.message).toContain("linhas");
  });
});
