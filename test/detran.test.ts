import { afterEach, describe, expect, it, vi } from "vitest";
import { detranPrInfo, detranPrInfoOutput, detranPrInfoResult, UNITS_MAX_AGE_DAYS, unitsStaleNote } from "../src/tools/detranPrInfo.js";
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

describe("detran_pr_info past note", () => {
  it("says past is only the Anexo I due date and quotes Anexo II literally with the Portaria link", () => {
    const { note } = detranPrInfoResult({ topic: "licensing_calendar" }, new Date("2026-11-19T12:00:00Z"));
    expect(note).toContain("`past: true` only means the payment due date in Anexo I has passed (Curitiba time)");
    expect(note).toContain(`Anexo II of the same Portaria (${PORTARIA_907_URL})`);
    expect(note).toContain(
      '"CALENDÁRIO PARA EFEITOS DE FISCALIZAÇÃO DA REGULARIDADE DOCUMENTAL DOS VEÍCULOS" – "PRAZO FINAL PARA RENOVAÇÃO": ' +
        '"1 e 2": "Até setembro"; "3,4 e 5": "Até outubro"; "6,7 e 8": "Até novembro"; "9 e 0": "Até dezembro".',
    );
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
    expect(detranPrInfoResult({ topic: "units" }, new Date("2027-03-01T12:00:00Z")).note).toMatch(
      /Units and hours were checked on 2026-11-19; it is now 2027, so this data may be outdated/,
    );
    expect(detranPrInfoResult({ topic: "units" }, new Date("2026-06-01T12:00:00Z")).note).not.toMatch(/outdated/);
  });

  it(`units warn once ${UNITS_MAX_AGE_DAYS} days have passed since checked_at (Curitiba time)`, () => {
    const units = (iso: string) => detranPrInfoResult({ topic: "units" }, new Date(iso)).note;
    expect(units("2026-11-19T12:00:00Z")).not.toMatch(/days ago/);
    expect(units("2027-05-18T12:00:00Z")).not.toMatch(/days ago/); // exactly 180 days
    expect(units("2027-05-19T02:59:00Z")).not.toMatch(/days ago/); // still 18/5 in Curitiba
    expect(units("2027-05-19T03:00:00Z")).toMatch(/Units and hours were checked on 2026-11-19, 181 days ago \(more than 180\), and it is now 2027, so this data may be outdated\./);
  });

  describe("unitsStaleNote merges the year and age warnings", () => {
    it("neither", () => {
      expect(unitsStaleNote("2026-12-31", "2026-11-19", 2026)).toBe("");
    });
    it("year only", () => {
      expect(unitsStaleNote("2027-01-01", "2026-11-19", 2026)).toBe(
        " Units and hours were checked on 2026-11-19; it is now 2027, so this data may be outdated.",
      );
      expect(unitsStaleNote("2026-03-01", "2026-02-01", 2025)).toBe(
        " Units and hours were checked on 2026-02-01; it is now 2026, so this data may be outdated.",
      );
    });
    it("age only", () => {
      expect(unitsStaleNote("2026-12-31", "2026-01-01", 2026)).toBe(
        " Units and hours were checked 364 days ago (more than 180); they may be outdated.",
      );
    });
    it("both, as one sentence", () => {
      const n = unitsStaleNote("2027-06-01", "2026-11-19", 2026);
      expect(n).toBe(
        " Units and hours were checked on 2026-11-19, 194 days ago (more than 180), and it is now 2027, so this data may be outdated.",
      );
      expect(n.match(/outdated/g)).toHaveLength(1);
    });
  });

  it("the calendar has no age warning", () => {
    expect(note("2027-06-01T12:00:00Z")).not.toMatch(/days ago/);
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
    expect(parsed.note).toContain("Confirm on the official channel before you go or act: https://www.detran.pr.gov.br/ (Detran-PR).");
    expect(calls).toHaveLength(0);
  });
});

// The Curitiba block of detran.pr.gov.br/unidades, checked 2026-11-19, text as published.
const PATRAN_SERVICES =
  "Realizam todos os serviços de habilitação (exceto exames práticos de direção) e todos os serviços na área de veículos.";
const EXPECTED_UNITS = [
  ["CIRETRAN", "01ª CIRETRAN – Curitiba", "Curitiba", "Av. Victor Ferreira do Amaral, nº 2940, Capão da Imbuia", "Todos os serviços do DETRAN."],
  ["PATRAN", "PATRAN – Vila Hauer", "Curitiba", "Rua Frederico Maurer, nº 1748", PATRAN_SERVICES],
  ["PATRAN", "PATRAN – Almirante Tamandaré", "Almirante Tamandaré", "Rua Bertolina kendrik de Oliveira, nº 681 - Centro", PATRAN_SERVICES],
  ["PATRAN", "PATRAN – Fazenda Rio Grande", "Fazenda Rio Grande", "Avenida Paraná, nº 1408, Pioneiros, Centro Comercial, Sala 05", PATRAN_SERVICES],
  ["PATRAN", "PATRAN – Rio Branco do Sul", "Rio Branco do Sul", "Rua Doutor Zoni nº 103, Centro", PATRAN_SERVICES],
  [
    "PATRAN",
    "PATRAN – Colombo",
    "Colombo",
    "Rua André Scrok, nº 100, São Gabriel",
    "Realiza todos os serviços nas áreas de veículo e habilitação, inclusive exames práticos de direção.",
  ],
].map(([kind, name, city, address, services]) => ({
  kind,
  name,
  city,
  address,
  phone: "0800 643 7373",
  services,
  source_url: DETRAN_UNITS_URL,
  checked_at: "2026-11-19",
}));

describe("detran_pr_info unit table", () => {
  it("returns exactly the six Curitiba units, in order, as published", () => {
    const r = detranPrInfoResult({ topic: "units" }, new Date("2026-11-19T12:00:00Z"));
    if (r.data.topic !== "units") throw new Error("wrong topic");
    expect(r.data.units).toEqual(EXPECTED_UNITS);
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
