import { describe, expect, it } from "vitest";
import { fetchText, isAllowedUrl, SourceUnavailableError, UrlNotAllowedError } from "../src/http.js";
import { MAX_RESPONSE_BYTES, USER_AGENT } from "../src/config.js";
import { connectClient, stubFetch } from "./helpers.js";

const OK = "https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=1";

describe("host allowlist (SSRF)", () => {
  it.each([
    "https://curitiba.pr.gov.br/x",
    "https://www.curitiba.pr.gov.br/dadosabertos/",
    "https://dadosabertos.curitiba.pr.gov.br/conjuntodado",
    "https://urbs.curitiba.pr.gov.br/",
    "https://www.urbs.curitiba.pr.gov.br/portal/",
    "https://WWW.CURITIBA.PR.GOV.BR/",
    "https://www.curitiba.pr.gov.br:443/",
  ])("allows %s", (u) => expect(isAllowedUrl(u)).toBe(true));

  it.each([
    "http://www.curitiba.pr.gov.br/",
    "https://evilcuritiba.pr.gov.br/",
    "https://curitiba.pr.gov.br.evil.com/",
    "https://www.curitiba.pr.gov.br@evil.com/",
    "https://user:pass@www.curitiba.pr.gov.br/",
    "https://www.curitiba.pr.gov.br:8443/",
    "https://dadosabertos.c3sl.ufpr.br/curitiba/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "ftp://www.curitiba.pr.gov.br/",
    "javascript:alert(1)",
    "not a url",
    "",
  ])("rejects %s", (u) => expect(isAllowedUrl(u)).toBe(false));
});

describe("fetchText", () => {
  it("sends the generic User-Agent and no other identifying header", async () => {
    const calls: RequestInit[] = [];
    stubFetch({ [`GET ${OK}`]: { body: "hi" } });
    const spy = globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } };
    await fetchText(OK);
    calls.push(spy.mock.calls[0]![1]);
    expect(calls[0]?.headers).toMatchObject({ "user-agent": USER_AGENT });
    expect(Object.keys(calls[0]?.headers as object).sort()).toEqual(["accept", "user-agent"]);
    expect(calls[0]?.redirect).toBe("manual");
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses a disallowed URL without any network call", async () => {
    const calls = stubFetch({});
    await expect(fetchText("https://example.com/")).rejects.toBeInstanceOf(UrlNotAllowedError);
    expect(calls).toHaveLength(0);
  });

  it("refuses a redirect to a disallowed host and never requests it", async () => {
    const calls = stubFetch({
      [`GET ${OK}`]: { status: 302, headers: { location: "https://dadosabertos.c3sl.ufpr.br/curitiba/" } },
    });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(UrlNotAllowedError);
    expect(calls.map((c) => c.url)).toEqual([OK]);
  });

  it("refuses a redirect to an internal address", async () => {
    const calls = stubFetch({ [`GET ${OK}`]: { status: 301, headers: { location: "http://169.254.169.254/" } } });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(UrlNotAllowedError);
    expect(calls).toHaveLength(1);
  });

  it("follows a redirect inside the allowlist", async () => {
    const target = "https://dadosabertos.curitiba.pr.gov.br/";
    stubFetch({
      "GET https://www.curitiba.pr.gov.br/dadosabertos/": { status: 301, headers: { location: target } },
      [`GET ${target}`]: { body: "home" },
    });
    const res = await fetchText("https://www.curitiba.pr.gov.br/dadosabertos/");
    expect(res).toMatchObject({ url: target, body: "home" });
  });

  it("stops after too many redirects", async () => {
    stubFetch({ [`GET ${OK}`]: { status: 302, headers: { location: OK } } });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(SourceUnavailableError);
  });

  it("maps network errors and HTTP errors to SourceUnavailableError", async () => {
    stubFetch({ [`GET ${OK}`]: { error: true } });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(SourceUnavailableError);
    stubFetch({ [`GET ${OK}`]: { status: 403, body: "Access Denied" } });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(SourceUnavailableError);
  });

  it("caps the response size", async () => {
    stubFetch({ [`GET ${OK}`]: { body: "x".repeat(MAX_RESPONSE_BYTES + 1) } });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(SourceUnavailableError);
  });
});

describe("open_dataset_preview allowlist", () => {
  it.each([
    "https://example.com/data.csv",
    "http://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=1",
    "https://dadosabertos.c3sl.ufpr.br/curitiba/156/",
    "https://localhost/",
  ])("rejects %s with url_not_allowed and no fetch", async (dataset_url) => {
    const calls = stubFetch({});
    const client = await connectClient();
    const res = await client.callTool({ name: "open_dataset_preview", arguments: { dataset_url } });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toEqual({ error: "url_not_allowed" });
    expect(calls).toHaveLength(0);
  });

  it("rejects an allowlisted URL that redirects off the allowlist", async () => {
    const calls = stubFetch({ [`GET ${OK}`]: { status: 302, headers: { location: "https://evil.example/" } } });
    const client = await connectClient();
    const res = await client.callTool({ name: "open_dataset_preview", arguments: { dataset_url: OK } });
    expect(res.structuredContent).toEqual({ error: "url_not_allowed" });
    expect(calls.map((c) => c.url)).toEqual([OK]);
  });
});
