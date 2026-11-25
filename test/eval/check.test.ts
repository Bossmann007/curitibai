import { describe, expect, it } from "vitest";
import { mismatches, observe, type Question } from "./check.js";

const ok = (structured: Record<string, unknown>) => ({ content: [], structuredContent: structured });
const err = (error: string, message?: string) => ({ isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error, message }) }] });
const q = (expect: Question["expect"], tool = "useful_phones"): Question => ({ id: "t", question: "pergunta de teste", tool, args: {}, expect });
const LINK = "https://example.org/fonte";

describe("citizen eval checks", () => {
  it("an ok expectation fails on an empty answer list (never vacuous)", () => {
    const obs = observe("useful_phones", ok({ data: { total: 0, items: [] }, source_url: LINK }));
    expect(obs.status).toBe("not_found");
    expect(mismatches(q({ status: "ok" }), obs)).toEqual(["status not_found, expected ok"]);
  });

  it("a missing field and a missing link are reported", () => {
    const obs = observe("useful_phones", ok({ data: { items: [{ name: "x", numbers: [] }] } }));
    expect(mismatches(q({ status: "ok", fields: ["data.items.0.numbers"] }), obs)).toEqual([
      "field data.items.0.numbers missing or empty",
      "link source_url is not an https URL",
    ]);
  });

  it("an outside-Curitiba refusal and other error codes are told apart", () => {
    expect(observe("place_at_point", err("invalid_argument", "The point is outside Curitiba (latitude ...)."))).toEqual({
      status: "outside_curitiba",
      error: "invalid_argument",
    });
    const obs = observe("bus_departures", err("invalid_argument", "give line_code or stop_number"));
    expect(mismatches(q({ status: "error", error: "data_not_available" }), obs)).toEqual(["error invalid_argument, expected data_not_available"]);
  });

  it("a guide must have a consent step with its text and an official link", () => {
    const guide = (steps: object[]) => observe("city_service_guide", ok({ data: { steps }, source_url: LINK }));
    const expectGuide = q({ status: "guide" }, "city_service_guide");
    expect(mismatches(expectGuide, guide([{ step: 1, needs_consent: false, url: LINK }]))).toEqual(["guide has no step that needs consent"]);
    expect(mismatches(expectGuide, guide([{ step: 1, needs_consent: true, consent: "", url: null }]))).toEqual([
      "guide step 1 needs consent but has no consent text",
      "guide has no official https link in its steps",
    ]);
    expect(mismatches(expectGuide, guide([{ step: 1, needs_consent: true, consent: "Abrir o site?", url: LINK }]))).toEqual([]);
  });
});
