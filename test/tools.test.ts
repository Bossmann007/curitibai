import { describe, expect, it } from "vitest";
import { tools } from "../src/tools/index.js";
import { datasetUrl, PORTAL_SEARCH_URL } from "../src/sources/portal.js";
import { connectClient, errorOf, FILES_UNIDADES, happyRoutes, ID_TRANSPORTE, ID_UNIDADES, SAMPLE_CALLS, stubFetch, type Route } from "./helpers.js";

const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

describe("tools/list", () => {
  it("lists exactly the eleven read-only tools with input and output schemas", async () => {
    const client = await connectClient();
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name).sort()).toEqual([
      "bus_lines",
      "city_services_search",
      "dataset_files",
      "detran_pr_info",
      "health_units_search",
      "local_csv_summary",
      "open_datasets_search",
      "places_search",
      "procurement_search",
      "weather_alerts",
      "weather_forecast",
    ]);
    for (const t of listed) {
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(t.outputSchema).toBeDefined();
      expect(t.inputSchema.type).toBe("object");
    }
    expect(listed.find((t) => t.name === "local_csv_summary")?.annotations?.openWorldHint).toBe(false);
    expect(listed.find((t) => t.name === "detran_pr_info")?.annotations?.openWorldHint).toBe(false);
    expect(listed.find((t) => t.name === "city_services_search")?.annotations?.openWorldHint).toBe(false);
  });
});

describe("each tool returns the envelope, valid against its output schema", () => {
  it.each(SAMPLE_CALLS)("$name", async (call) => {
    stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool(call);
    expect(res.isError).toBeFalsy();
    const parsed = byName[call.name]!.outputSchema.parse(res.structuredContent) as {
      fetched_at: string;
      source_url: string;
      license_note: string;
    };
    expect(Object.keys(parsed).sort()).toEqual(["data", "fetched_at", "license_note", "source_url"]);
    expect(Date.parse(parsed.fetched_at)).not.toBeNaN();
    if (call.name === "health_units_search") {
      expect(new URL(parsed.source_url).hostname).toBe("apidadosabertos.saude.gov.br");
      expect(parsed.license_note).toMatch(/CNES/);
      expect(parsed.license_note).toMatch(/CC BY-NC-SA 4\.0/);
      expect(parsed.license_note).toMatch(/CC BY-ND 3\.0/);
    } else if (call.name === "procurement_search") {
      expect(new URL(parsed.source_url).hostname).toBe("pncp.gov.br");
      expect(parsed.license_note).toMatch(/PNCP/);
      expect(parsed.license_note).toMatch(/CC BY-ND 3\.0/);
    } else if (call.name === "places_search" || call.name === "bus_lines") {
      expect(new URL(parsed.source_url).hostname).toBe("overpass.private.coffee");
      expect(parsed.license_note).toContain("© OpenStreetMap contributors, ODbL");
      expect(parsed.license_note).toContain(`fetched at ${parsed.fetched_at}`);
    } else if (call.name.startsWith("weather_")) {
      expect(new URL(parsed.source_url).hostname).toBe("apiprevmet3.inmet.gov.br");
      expect(parsed.license_note).toMatch(/INMET/);
      expect(parsed.license_note).toMatch(/CC BY-ND 3\.0/);
      expect(parsed.license_note).toContain(`fetched at ${parsed.fetched_at}`);
      expect(parsed.license_note).toContain(parsed.source_url);
    } else {
      expect(new URL(parsed.source_url).hostname).toBe("dadosabertos.curitiba.pr.gov.br");
      expect(parsed.license_note).toMatch(/CC BY 4\.0/);
    }
    expect(parsed.license_note).toMatch(/Unofficial; not affiliated with/);
  });

  it("dataset_files lists links without requesting them", async () => {
    const calls = stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "dataset_files", arguments: { dataset_id: ID_UNIDADES.toUpperCase() } });
    const data = (res.structuredContent as { data: { total_files: number; files: { url: string }[]; note: string } }).data;
    expect(data.total_files).toBe(25);
    expect(data.files).toHaveLength(3);
    expect(data.note).toMatch(/does not download/);
    expect(calls.map((c) => c.url)).toEqual([datasetUrl(ID_UNIDADES), FILES_UNIDADES]);
    for (const f of data.files) expect(calls.some((c) => c.url === f.url)).toBe(false);
  });

  it("dataset_files returns an empty list for a dataset without files", async () => {
    const calls = stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "dataset_files", arguments: { dataset_id: ID_TRANSPORTE } });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ data: { files: [], total_files: 0 } });
    expect(calls).toHaveLength(1);
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

  it("open_datasets_search says how long to wait when a later page is refused with HTTP 429", async () => {
    let n = 0;
    stubFetch(happyRoutes());
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      n++;
      if (n > 1) return new Response("", { status: 429, headers: { "retry-after": "30" } });
      return inner(input, init);
    }) as typeof fetch;
    const client = await connectClient();
    const res = await client.callTool({ name: "open_datasets_search", arguments: { query: "saude", limit: 10 } });
    expect(res.structuredContent).toMatchObject({
      data: { partial: true, total: 10, note: "The source is limiting requests; wait 30 s before trying again." },
    });
  });

  it("open_datasets_search has no note when nothing was refused", async () => {
    stubFetch(happyRoutes());
    const client = await connectClient();
    const res = await client.callTool({ name: "open_datasets_search", arguments: { query: "saude", limit: 5 } });
    expect((res.structuredContent as { data: object }).data).not.toHaveProperty("note");
  });
});

describe("input validation", () => {
  it.each([
    { name: "open_datasets_search", arguments: { query: "saude", limit: 21 } },
    { name: "open_datasets_search", arguments: { query: "s" } },
    { name: "dataset_files", arguments: { dataset_id: "https://mid-dadosabertos.curitiba.pr.gov.br/156/" } },
    { name: "dataset_files", arguments: { dataset_id: "../../etc/passwd" } },
    { name: "dataset_files", arguments: { dataset_id: ID_UNIDADES, page: 0 } },
    { name: "health_units_search", arguments: { limit: 21 } },
    { name: "health_units_search", arguments: { page: 0 } },
    { name: "health_units_search", arguments: { name: "x" } },
    { name: "procurement_search", arguments: { limit: 21 } },
    { name: "procurement_search", arguments: { modality: 0 } },
    { name: "procurement_search", arguments: { modality: 21 } },
    { name: "procurement_search", arguments: { from: "20261101" } },
    { name: "procurement_search", arguments: { to: "2026-02-30" } },
    { name: "procurement_search", arguments: { from: "2026-11-01", to: "2026-10-01" } },
    { name: "procurement_search", arguments: { from: "2025-01-01", to: "2026-11-18" } },
    { name: "procurement_search", arguments: { query: "x" } },
    { name: "local_csv_summary", arguments: { file: "a.csv", top: 51 } },
    { name: "local_csv_summary", arguments: {} },
    { name: "weather_forecast", arguments: { days: 0 } },
    { name: "weather_forecast", arguments: { days: 6 } },
    { name: "weather_forecast", arguments: { days: 2.5 } },
    { name: "weather_alerts", arguments: { when: "tomorrow" } },
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
    [`POST ${PORTAL_SEARCH_URL}`]: { error: true },
    [`GET ${datasetUrl(ID_UNIDADES)}`]: { status: 500 },
  };
  it.each(SAMPLE_CALLS)("$name returns {error: source_unavailable} and no data", async (call) => {
    stubFetch(down);
    const client = await connectClient();
    const res = await client.callTool(call);
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toBeUndefined();
    expect(errorOf(res)).toEqual({ error: "source_unavailable" });
  });

  it("dataset_files fails cleanly when only the file listing is down or malformed", async () => {
    for (const route of [{ status: 503 }, { body: "<html>maintenance</html>" }, { body: '{"sucesso":false,"erro":"x"}' }]) {
      stubFetch({ ...happyRoutes(), [`GET ${FILES_UNIDADES}`]: route });
      const client = await connectClient();
      const res = await client.callTool({ name: "dataset_files", arguments: { dataset_id: ID_UNIDADES } });
      expect(errorOf(res)).toEqual({ error: "source_unavailable" });
    }
  });

  it("a malformed search page is source_unavailable, not invented data", async () => {
    stubFetch({ [`POST ${PORTAL_SEARCH_URL}`]: { status: 403, body: "<H1>Access Denied</H1>" } });
    const client = await connectClient();
    const res = await client.callTool({ name: "open_datasets_search", arguments: { query: "saude" } });
    expect(errorOf(res)).toEqual({ error: "source_unavailable" });
  });
});
