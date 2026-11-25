import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarResult, cityCalendarOutput, isSchoolDay } from "../src/tools/cityCalendar.js";
import { SCHOOL_CALENDARS } from "../src/tools/schoolCalendarData.js";
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

  it("school: the rule counts each month's printed school days (Letivos) and the total of 199, for the three units", () => {
    for (const unit of ["escolas", "cmeis", "cmaees"] as const) {
      const perMonth = Array<number>(12).fill(0);
      for (let d = new Date("2026-01-01T12:00:00Z"); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 1)) {
        if (isSchoolDay(unit, d.toISOString().slice(0, 10))) perMonth[d.getUTCMonth()]! += 1;
      }
      expect(perMonth, unit).toEqual([...SCHOOL_CALENDARS[unit].school_days_per_month]);
      expect(perMonth.reduce((a, b) => a + b), unit).toBe(SCHOOL_CALENDARS[unit].total_school_days);
    }
    // As printed on the CMAEE PDF (00522559.pdf): the "Letivos" of each month and "Total dias letivos = 199".
    expect(SCHOOL_CALENDARS.cmaees.school_days_per_month).toEqual([0, 11, 22, 19, 20, 20, 12, 21, 20, 20, 20, 14]);
    expect(SCHOOL_CALENDARS.cmaees.total_school_days).toBe(199);
  });

  it("school: start, July recess and whether there is class on a date, per unit", () => {
    const out = cityCalendarOutput.parse(calendarResult("school", new Date("2026-11-24T12:00:00Z"), { unit: "cmaees", date: "2026-11-28" }));
    if (out.data.topic !== "school") throw new Error("topic");
    const [u] = out.data.units;
    expect(u).toMatchObject({ unit: "cmaees", first_day_with_students: "2026-02-10", last_day_with_students: "2026-12-18", total_school_days: 199 });
    expect(u?.periods.filter((p) => p.kind === "recess" && p.from.startsWith("2026-07"))).toEqual([
      { from: "2026-07-13", to: "2026-07-27", kind: "recess", label: "Recesso", name: null },
    ]);
    expect(u?.periods.find((p) => p.from === "2026-09-08")).toMatchObject({ kind: "holiday", name: "Nossa Sra da Luz dos Pinhais" });
    // A Saturday with the Avaliação dos Parâmetros fill counts as a school day.
    expect(u?.on_date).toEqual({ date: "2026-11-28", school_day: true, kinds: ["quality_evaluation"] });
    expect(out.source_urls).toEqual(["https://mid-educacao.curitiba.pr.gov.br/2025/12/pdf/00522559.pdf"]);
    expect(out.note).toMatch(/state schools follow the Paraná state calendar and private schools their own/);
    expect(out.note).toMatch(/No Sábado de Integração com as Famílias is marked/);

    expect(isSchoolDay("escolas", "2026-02-09")).toBe(false); // teachers only
    expect(isSchoolDay("escolas", "2026-02-10")).toBe(true); // first day with students
    expect(isSchoolDay("cmeis", "2026-10-13")).toBe(false); // Dia do Professor
    expect(isSchoolDay("escolas", "2026-11-07")).toBe(true); // Saturday, Avaliação
    expect(isSchoolDay("cmeis", "2026-11-07")).toBe(false); // plain Saturday there
    expect(isSchoolDay("escolas", "2026-05-20")).toBe(true); // Conselho de Classe week
    expect(isSchoolDay("escolas", "2026-12-21")).toBe(false); // recess
    expect(isSchoolDay("escolas", "2027-02-10")).toBeNull();

    const all = cityCalendarOutput.parse(calendarResult("school", new Date("2027-01-01T03:00:00Z")));
    if (all.data.topic !== "school") throw new Error("topic");
    expect(all.data.units.map((x) => x.unit)).toEqual(["escolas", "cmeis", "cmaees"]);
    expect(all.data.units[0]?.on_date).toBeNull();
    expect(all.data.expired).toBe(true);
    expect(all.note).toMatch(/These are 2026 values/);
  });

  it("makes no network call; holidays is the default topic", async () => {
    const calls = stubFetch({});
    const client = await connectClient();
    const res = await client.callTool({ name: "city_calendar", arguments: {} });
    expect(cityCalendarOutput.parse(res.structuredContent).data.topic).toBe("holidays");
    // `date` with no topic selects the school topic.
    const school = await client.callTool({ name: "city_calendar", arguments: { unit: "escolas", date: "2026-07-20" } });
    const data = cityCalendarOutput.parse(school.structuredContent).data;
    if (data.topic !== "school") throw new Error("topic");
    expect(data.units[0]?.on_date).toEqual({ date: "2026-07-20", school_day: false, kinds: ["recess"] });
    expect(calls).toHaveLength(0);
  });

  it("holidays or iptu with unit or date: invalid_argument, not silently ignored", async () => {
    const client = await connectClient();
    for (const topic of ["holidays", "iptu"] as const) {
      for (const extra of [{ unit: "escolas" }, { date: "2026-07-20" }]) {
        const res = await client.callTool({ name: "city_calendar", arguments: { topic, ...extra } });
        expect(res.isError, `${topic} ${JSON.stringify(extra)}`).toBe(true);
        const [first] = res.content as { text: string }[];
        expect(JSON.parse(first!.text)).toEqual({
          error: "invalid_argument",
          message: `unit and date apply to topic "school" only; leave them out for topic "${topic}".`,
        });
      }
    }
  });

  it("school note: the evaluation Saturday counts as a school day, inferred from the printed counts", () => {
    const out = cityCalendarOutput.parse(calendarResult("school", new Date("2026-11-24T12:00:00Z")));
    expect(out.note).toMatch(/quality evaluation Saturday counts as a school day.*inferred from the printed per-month counts/);
  });
});
