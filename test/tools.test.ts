import { describe, expect, it } from "vitest";
import { tools } from "../src/tools/index.js";
import { datasetUrl, PORTAL_SEARCH_URL } from "../src/sources/portal.js";
import { connectClient, errorOf, FILES_UNIDADES, happyRoutes, ID_TRANSPORTE, ID_UNIDADES, SAMPLE_CALLS, stubFetch, type Route } from "./helpers.js";

const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

describe("tools/list", () => {
  it("lists exactly the two read-only tools with input and output schemas", async () => {
    const client = await connectClient();
    const { tools: listed } = await client.listTools();
    expect(listed.map((t) => t.name).sort()).toEqual(["dataset_files", "open_datasets_search"]);
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
    expect(new URL(parsed.source_url).hostname).toBe("dadosabertos.curitiba.pr.gov.br");
    expect(parsed.license_note).toMatch(/CC BY 4\.0/);
    expect(parsed.license_note).toMatch(/Unofficial; not affiliated with Prefeitura de Curitiba/);
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
});

describe("input validation", () => {
  it.each([
    { name: "open_datasets_search", arguments: { query: "saude", limit: 21 } },
    { name: "open_datasets_search", arguments: { query: "s" } },
    { name: "dataset_files", arguments: { dataset_id: "https://mid-dadosabertos.curitiba.pr.gov.br/156/" } },
    { name: "dataset_files", arguments: { dataset_id: "../../etc/passwd" } },
    { name: "dataset_files", arguments: { dataset_id: ID_UNIDADES, page: 0 } },
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
