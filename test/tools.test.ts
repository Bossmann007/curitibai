import { describe, expect, it } from "vitest";
import { tools } from "../src/tools/index.js";
import { scheduleUrl, URBS_LINES_URL, URBS_STOPS_URL } from "../src/sources/urbs.js";
import { PORTAL_SEARCH_URL } from "../src/sources/portal.js";
import { connectClient, DETAIL_TRANSPORTE, errorOf, happyRoutes, SAMPLE_CALLS, stubFetch, type Route } from "./helpers.js";

const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

describe("tools/list", () => {
  it("lists exactly the five read-only tools with input and output schemas", async () => {
    const client = await connectClient();
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name).sort()).toEqual(
      ["bus_line_schedule", "bus_lines_search", "bus_stops_near", "open_dataset_preview", "open_datasets_search"],
    );
    for (const t of listed) {
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(t.outputSchema).toBeDefined();
      expect(t.inputSchema.type).toBe("object");
    }
  });
});

describe("each tool returns the envelope, valid against its output schema", () => {
  it.each(SAMPLE_CALLS)("$name", async (call) => {
    stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool(call);
    expect(res.isError).toBeFalsy();
    const parsed = byName[call.name]!.outputSchema.parse(res.structuredContent);
    expect(Object.keys(parsed).sort()).toEqual(["data", "fetched_at", "license_note", "source_url"]);
    expect(Date.parse(parsed.fetched_at)).not.toBeNaN();
    expect(new URL(parsed.source_url).hostname.endsWith("curitiba.pr.gov.br")).toBe(true);
    expect(parsed.license_note).toMatch(/Unofficial; not affiliated with Prefeitura de Curitiba/);
  });

  it("bus_lines_search folds accents and honours limit", async () => {
    stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "bus_lines_search", arguments: { query: "botanico" } });
    expect(res.structuredContent).toMatchObject({ data: { total_matches: 1, lines: [{ code: "464" }] } });
    const all = await client.callTool({ name: "bus_lines_search", arguments: { limit: 3 } });
    expect(all.structuredContent).toMatchObject({ data: { total_matches: 8 } });
    expect((all.structuredContent as { data: { lines: unknown[] } }).data.lines).toHaveLength(3);
  });

  it("bus_line_schedule returns line_not_found for a code not in the active list, without fetching a timetable", async () => {
    const calls = stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "bus_line_schedule", arguments: { line_code: "x99", day_type: "sunday" } });
    expect(errorOf(res)).toEqual({ error: "line_not_found" });
    expect(calls.map((c) => c.url)).toEqual([URBS_LINES_URL]);
  });

  it("bus_stops_near sorts by distance and respects the radius", async () => {
    stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "bus_stops_near", arguments: { lat: -25.4296, lon: -49.2713, radius_m: 300 } });
    const data = (res.structuredContent as { data: { total_in_radius: number; stops: { distance_m: number }[] } }).data;
    expect(data.total_in_radius).toBe(3);
    expect(data.stops.map((s) => s.distance_m)).toEqual([...data.stops.map((s) => s.distance_m)].sort((a, b) => a - b));
    expect(data.stops.every((s) => s.distance_m <= 300)).toBe(true);
  });

  it("bus_stops_near fetches the stop list once and caches it by source URL only", async () => {
    const calls = stubFetch(happyRoutes());
    const client = await connectClient();
    await client.callTool({ name: "bus_stops_near", arguments: { lat: -25.43, lon: -49.27 } });
    await client.callTool({ name: "bus_stops_near", arguments: { lat: -25.5, lon: -49.3, radius_m: 1000 } });
    expect(calls.filter((c) => c.url === URBS_STOPS_URL)).toHaveLength(1);
    for (const c of calls) expect(c.url).not.toMatch(/-25\.|49\./);
  });

  it("open_dataset_preview returns empty rows for a dataset without a table", async () => {
    stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "open_dataset_preview", arguments: { dataset_url: DETAIL_TRANSPORTE } });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ data: { rows: [], columns: [] } });
  });

  it("open_datasets_search marks partial results when a later page fails", async () => {
    let n = 0;
    stubFetch(happyRoutes());
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      n++;
      if (n > 1) throw new TypeError("fetch failed");
      return inner(input, init);
    }) as typeof fetch;
    const client = await connectClient();
    const res = await client.callTool({ name: "open_datasets_search", arguments: { query: "saude", limit: 10 } });
    expect(res.structuredContent).toMatchObject({ data: { partial: true, total: 10 } });
  });
});

describe("input validation", () => {
  it.each([
    { name: "bus_lines_search", arguments: { limit: 51 } },
    { name: "bus_line_schedule", arguments: { line_code: "182", day_type: "holiday" } },
    { name: "bus_line_schedule", arguments: { line_code: "../../etc", day_type: "weekday" } },
    { name: "bus_stops_near", arguments: { lat: -25.4, lon: -49.2, radius_m: 1001 } },
    { name: "bus_stops_near", arguments: { lat: 91, lon: -49.2 } },
    { name: "open_datasets_search", arguments: { query: "saude", limit: 21 } },
    { name: "open_dataset_preview", arguments: { dataset_url: "https://dadosabertos.curitiba.pr.gov.br/", rows: 21 } },
  ])("rejects $name $arguments", async (call) => {
    const calls = stubFetch({});
    const client = await connectClient();
    const res = await client.callTool(call);
    expect(res.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("source down", () => {
  const down: Record<string, Route> = {
    [`GET ${URBS_LINES_URL}`]: { status: 503 },
    [`GET ${scheduleUrl("182")}`]: { error: true },
    [`GET ${URBS_STOPS_URL}`]: { status: 403, body: "<H1>Access Denied</H1>" },
    [`POST ${PORTAL_SEARCH_URL}`]: { error: true },
  };
  it.each(SAMPLE_CALLS)("$name returns {error: source_unavailable} and no data", async (call) => {
    stubFetch({ ...down, [`GET ${String(call.arguments.dataset_url)}`]: { status: 500 } });
    const client = await connectClient();
    const res = await client.callTool(call);
    expect(res.isError).toBe(true);
    expect(errorOf(res)).toEqual({ error: "source_unavailable" });
  });

  it("bus_line_schedule fails cleanly when only the timetable is down", async () => {
    stubFetch({ ...happyRoutes(), [`GET ${scheduleUrl("182")}`]: { status: 404, body: "<html>não encontrada</html>" } });
    const client = await connectClient();
    const res = await client.callTool({ name: "bus_line_schedule", arguments: { line_code: "182", day_type: "weekday" } });
    expect(errorOf(res)).toEqual({ error: "source_unavailable" });
  });

  it("a malformed source body is source_unavailable, not invented data", async () => {
    stubFetch({ [`GET ${URBS_LINES_URL}`]: { body: "<html>maintenance</html>" } });
    const client = await connectClient();
    const res = await client.callTool({ name: "bus_lines_search", arguments: {} });
    expect(errorOf(res)).toEqual({ error: "source_unavailable" });
  });
});
