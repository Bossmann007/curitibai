import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarResult, cityCalendarOutput } from "../src/tools/cityCalendar.js";
import { connectClient, stubFetch } from "./helpers.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("city_calendar", () => {
  it("holidays: the 19 items of Decreto 2.385/2025 art. 1, in order, with the school caveat", () => {
    const out = cityCalendarOutput.parse(calendarResult("holidays", new Date("2026-06-04T12:00:00-03:00")));
    if (out.data.topic !== "holidays") throw new Error("topic");
    expect(out.data.days).toHaveLength(19);
    expect(out.data.days.find((d) => d.name === "Nossa Senhora da Luz")).toEqual({
      from: "2026-09-08", to: "2026-09-08", name: "Nossa Senhora da Luz", kind: "municipal_holiday", past: false,
    });
    expect(out.data.days.find((d) => d.kind === "recess")).toMatchObject({ from: "2026-12-21", to: "2026-12-31" });
    expect(out.data.days.find((d) => d.name === "Carnaval")).toMatchObject({ kind: "optional_day", past: true });
    // On 2026-06-04 Corpus Christi is today, not past.
    expect(out.data.days.find((d) => d.name === "Corpus Christi")?.past).toBe(false);
    expect(out.data.expired).toBe(false);
    expect(out.note).toMatch(/schools follow their own school calendar/);
    expect(out.source_url).toBe("https://www.normasbrasil.com.br/norma/decreto-2385-2025-curitiba_486274.html");
  });

  it("iptu: the 2026 general rule, marked as secondary source with both Legisweb links", () => {
    const out = cityCalendarOutput.parse(calendarResult("iptu", new Date("2026-11-24T12:00:00Z")));
    expect(out.data).toMatchObject({
      topic: "iptu", cash_discount_pct: 10, cash_due_date: "2026-03-20", max_instalments: 10, secondary_source: true, expired: false,
    });
    expect(out.source_urls).toEqual(["https://www.legisweb.com.br/noticia/?id=32497", "https://www.legisweb.com.br/noticia/?id=32939"]);
    expect(out.note).toMatch(/^Unofficial.*Secondary source/);
  });

  it("says expired from 2027-01-01 in Curitiba time, not before", () => {
    // 2027-01-01T02:00Z is still 2026-12-31 in Curitiba (UTC-3).
    expect(calendarResult("holidays", new Date("2027-01-01T02:00:00Z")).data.expired).toBe(false);
    const after = calendarResult("iptu", new Date("2027-01-01T03:00:00Z"));
    expect(after.data.expired).toBe(true);
    expect(after.note).toMatch(/These are 2026 values: the 2027 ones are not bundled/);
  });

  it("makes no network call; holidays is the default topic", async () => {
    const calls = stubFetch({});
    const client = await connectClient();
    const res = await client.callTool({ name: "city_calendar", arguments: {} });
    expect(cityCalendarOutput.parse(res.structuredContent).data.topic).toBe("holidays");
    expect(calls).toHaveLength(0);
  });
});
