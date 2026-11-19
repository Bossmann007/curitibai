import { afterEach, describe, expect, it, vi } from "vitest";
import { detranPrInfo, detranPrInfoOutput, detranPrInfoResult } from "../src/tools/detranPrInfo.js";
import { DETRAN_HOME_URL, DETRAN_UNITS_URL, LICENSING_NEWS_URL, PORTARIA_907_URL } from "../src/sources/detran.js";
import { connectClient, errorOf, stubFetch } from "./helpers.js";

// Anexo I of Portaria DETRAN 907/2025, checked 2026-11-19.
const EXPECTED: Record<number, string> = {
  1: "2026-08-14",
  2: "2026-08-28",
  3: "2026-09-09",
  4: "2026-09-18",
  5: "2026-09-28",
  6: "2026-10-09",
  7: "2026-10-20",
  8: "2026-10-30",
  9: "2026-11-13",
  0: "2026-11-27",
};

type Calendar = { data: { deadlines: { plate_final: number; due_date: string; source_url: string; checked_at: string }[]; fee: { amount_brl: number; source_url: string } } };

afterEach(() => {
  vi.useRealTimers();
});

describe("detran_pr_info licensing_calendar", () => {
  it.each(Object.entries(EXPECTED).map(([d, date]) => ({ d: Number(d), date })))(
    "plate final $d is due $date, with no network call",
    async ({ d, date }) => {
      const calls = stubFetch({});
      const client = await connectClient();
      const res = await client.callTool({ name: "detran_pr_info", arguments: { topic: "licensing_calendar", plate_final: d } });
      expect(res.isError).toBeFalsy();
      const parsed = detranPrInfoOutput.parse(res.structuredContent) as unknown as Calendar & { source_url: string; checked_at: string };
      expect(parsed.data.deadlines).toEqual([
        { plate_final: d, due_date: date, past: expect.any(Boolean), source_url: PORTARIA_907_URL, checked_at: "2026-11-19" },
      ]);
      expect(parsed.data.fee).toMatchObject({ amount_brl: 94.61, source_url: LICENSING_NEWS_URL });
      expect(parsed.source_url).toBe(PORTARIA_907_URL);
      expect(parsed.checked_at).toBe("2026-11-19");
      expect(calls).toHaveLength(0);
    },
  );

  it("without plate_final returns all ten dates in calendar order", () => {
    const r = detranPrInfoResult({ topic: "licensing_calendar" }, new Date("2026-11-19T12:00:00Z")) as unknown as Calendar;
    expect(r.data.deadlines.map((x) => x.plate_final)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
    expect(Object.fromEntries(r.data.deadlines.map((x) => [x.plate_final, x.due_date]))).toEqual(
      Object.fromEntries(Object.entries(EXPECTED).map(([k, v]) => [Number(k), v])),
    );
  });
});

describe("detran_pr_info past flag", () => {
  const past = (iso: string, d: number) =>
    (detranPrInfoResult({ topic: "licensing_calendar", plate_final: d }, new Date(iso)) as unknown as Calendar & {
      data: { deadlines: { past: boolean }[] };
    }).data.deadlines[0]!.past;

  it("the due date itself is not past; the next day in Curitiba is", () => {
    expect(past("2026-11-27T23:00:00Z", 0)).toBe(false); // 20:00 on 27/11 in Curitiba
    expect(past("2026-11-28T02:59:00Z", 0)).toBe(false); // 23:59 on 27/11 in Curitiba
    expect(past("2026-11-28T03:00:00Z", 0)).toBe(true);
    expect(past("2026-11-19T12:00:00Z", 8)).toBe(true);
    expect(past("2026-11-19T12:00:00Z", 9)).toBe(true);
    expect(past("2026-11-13T12:00:00Z", 9)).toBe(false);
  });
});

describe("detran_pr_info stale-year note", () => {
  const note = (iso: string) => detranPrInfoResult({ topic: "licensing_calendar", plate_final: 1 }, new Date(iso)).note;

  it("no warning during the bundled year", () => {
    expect(note("2026-11-19T12:00:00Z")).not.toMatch(/outdated/);
  });

  it("no warning on 31 Dec in Curitiba even when UTC is already the next year", () => {
    expect(note("2027-01-01T02:00:00Z")).not.toMatch(/outdated/);
  });

  it("warns once the year in Curitiba is past the bundled year", () => {
    expect(note("2027-01-01T03:00:00Z")).toMatch(/The bundled calendar is for 2026; it is now 2027, so this data may be outdated/);
  });

  it("units carry the same warning", () => {
    expect(detranPrInfoResult({ topic: "units" }, new Date("2027-06-01T12:00:00Z")).note).toMatch(
      /Units and hours were checked on 2026-11-19; it is now 2027, so this data may be outdated/,
    );
    expect(detranPrInfoResult({ topic: "units" }, new Date("2026-06-01T12:00:00Z")).note).not.toMatch(/outdated/);
  });

  it("the tool uses the current clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2028-03-01T12:00:00Z"));
    const client = await connectClient();
    const res = await client.callTool({ name: "detran_pr_info", arguments: { topic: "licensing_calendar" } });
    expect((res.structuredContent as { note: string }).note).toMatch(/it is now 2028, so this data may be outdated/);
  });
});

describe("detran_pr_info units", () => {
  it("returns the Curitiba units, the scheduling rule and both conflicting hours", async () => {
    const calls = stubFetch({});
    const client = await connectClient();
    const res = await client.callTool({ name: "detran_pr_info", arguments: { topic: "units" } });
    expect(res.isError).toBeFalsy();
    const parsed = detranPrInfoOutput.parse(res.structuredContent);
    if (parsed.data.topic !== "units") throw new Error("wrong topic");
    expect(parsed.source_url).toBe(DETRAN_UNITS_URL);
    expect(parsed.data.units[0]).toMatchObject({
      kind: "CIRETRAN",
      name: "01ª CIRETRAN – Curitiba",
      address: "Av. Victor Ferreira do Amaral, nº 2940, Capão da Imbuia",
      phone: "0800 643 7373",
      source_url: DETRAN_UNITS_URL,
      checked_at: "2026-11-19",
    });
    expect(parsed.data.units.map((u) => u.name)).toContain("PATRAN – Colombo");
    expect(parsed.data.hours.conflict).toBe(true);
    expect(parsed.data.hours.statements.map((s) => [s.source_url, /8h às (\S+)$/.exec(s.text)?.[1]])).toEqual([
      [DETRAN_UNITS_URL, "16h"],
      [DETRAN_HOME_URL, "15h30"],
    ]);
    expect(parsed.note).toMatch(/two different general hours/);
    expect(calls).toHaveLength(0);
  });
});

describe("detran_pr_info input validation", () => {
  it.each([
    { topic: "licensing_calendar", plate_final: 10 },
    { topic: "licensing_calendar", plate_final: -1 },
    { topic: "licensing_calendar", plate_final: 1.5 },
    { topic: "licensing_calendar", plate_final: "7" },
    { topic: "fees" },
    { topic: "debts", plate_final: 1 },
    {},
  ])("rejects %j", async (args) => {
    const calls = stubFetch({});
    const client = await connectClient();
    const res = await client.callTool({ name: "detran_pr_info", arguments: args });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it("rejects plate_final with topic units", async () => {
    const client = await connectClient();
    const res = await client.callTool({ name: "detran_pr_info", arguments: { topic: "units", plate_final: 3 } });
    expect(errorOf(res)).toEqual({ error: "invalid_argument", message: "plate_final applies only to topic licensing_calendar." });
  });

  it("is annotated read-only with no open world", () => {
    expect(detranPrInfo.annotations).toEqual({ openWorldHint: false });
  });
});
