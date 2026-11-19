import { describe, expect, it } from "vitest";
import { fetchText, isAllowedUrl, SourceUnavailableError, UrlNotAllowedError } from "../src/http.js";
import { MAX_RESPONSE_BYTES, USER_AGENT } from "../src/config.js";
import { stubFetch } from "./helpers.js";

const OK = "https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=1";

describe("host allowlist (SSRF)", () => {
  it.each([
    "https://dadosabertos.curitiba.pr.gov.br/conjuntodado",
    "https://DADOSABERTOS.CURITIBA.PR.GOV.BR/",
    "https://dadosabertos.curitiba.pr.gov.br:443/",
    "https://dadosabertos.curitiba.pr.gov.br./",
  ])("allows %s", (u) => expect(isAllowedUrl(u)).toBe(true));

  it.each([
    // hosts whose robots.txt disallows automated access
    "https://mid-dadosabertos.curitiba.pr.gov.br/156/2026-11-18_156_-_Base_de_Dados.csv",
    "https://dadosabertos.c3sl.ufpr.br/curitiba/",
    // hosts dropped from scope
    "https://www.curitiba.pr.gov.br/dadosabertos/",
    "https://www.urbs.curitiba.pr.gov.br/portal/",
    "https://curitiba.pr.gov.br/",
    "https://github.com/benaytms/urbs-gtfs/releases/download/latest/gtfs_curitiba.zip",
    // look-alikes and tricks
    "http://dadosabertos.curitiba.pr.gov.br/",
    "https://x.dadosabertos.curitiba.pr.gov.br/",
    "https://evildadosabertos.curitiba.pr.gov.br/",
    "https://dadosabertos.curitiba.pr.gov.br.evil.com/",
    "https://dadosabertos.curitiba.pr.gov.br@evil.com/",
    "https://user:pass@dadosabertos.curitiba.pr.gov.br/",
    "https://dadosabertos.curitiba.pr.gov.br:8443/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
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
      [`GET ${OK}`]: { status: 302, headers: { location: "https://mid-dadosabertos.curitiba.pr.gov.br/156/" } },
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
      "GET https://dadosabertos.curitiba.pr.gov.br/old": { status: 301, headers: { location: "/" } },
      [`GET ${target}`]: { body: "home" },
    });
    const res = await fetchText("https://dadosabertos.curitiba.pr.gov.br/old");
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
