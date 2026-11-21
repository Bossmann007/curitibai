import { describe, expect, it, vi } from "vitest";
import {
  fetchText,
  isAllowedUrl,
  RateLimitedError,
  REFUSAL_BLOCK_MS,
  resetHostRefusals,
  ResponseTooLargeError,
  SourceRefusedError,
  SourceUnavailableError,
  UrlNotAllowedError,
} from "../src/http.js";
import { MAX_RESPONSE_BYTES, USER_AGENT } from "../src/config.js";
import { failFrom, rateLimitedMessage, SOURCE_REFUSED_MESSAGE } from "../src/tools/common.js";
import { errorOf, stubFetch } from "./helpers.js";

const OK = "https://dadosabertos.curitiba.pr.gov.br/conjuntodado/detalhe?chave=1";

describe("host allowlist (SSRF)", () => {
  it.each([
    "https://dadosabertos.curitiba.pr.gov.br/conjuntodado",
    "https://DADOSABERTOS.CURITIBA.PR.GOV.BR/",
    "https://dadosabertos.curitiba.pr.gov.br:443/",
    "https://dadosabertos.curitiba.pr.gov.br./",
    "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=410690",
    "https://APIDADOSABERTOS.SAUDE.GOV.BR/cnes/tipounidades",
    "https://apiprevmet3.inmet.gov.br/previsao/4106902",
    "https://apiprevmet3.inmet.gov.br/avisos/ativos",
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
    // Ministry of Health: only the API host
    "https://dadosabertos.saude.gov.br/",
    "https://saude.gov.br/",
    "http://apidadosabertos.saude.gov.br/cnes/estabelecimentos",
    "https://x.apidadosabertos.saude.gov.br/",
    "https://apidadosabertos.saude.gov.br.evil.com/",
    "https://apidadosabertos.saude.gov.br:8443/",
    // INMET: only the forecast API host
    "https://portal.inmet.gov.br/",
    "https://apiprevmet2.inmet.gov.br/previsao/4106902",
    "http://apiprevmet3.inmet.gov.br/avisos/ativos",
    "https://apiprevmet3.inmet.gov.br.evil.com/",
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

  it("refuses a protocol-relative redirect to another host", async () => {
    const calls = stubFetch({ [`GET ${OK}`]: { status: 302, headers: { location: "//evil.com/x" } } });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(UrlNotAllowedError);
    expect(calls.map((c) => c.url)).toEqual([OK]);
  });

  it("cancels the redirect response body before following the redirect", async () => {
    const target = "https://dadosabertos.curitiba.pr.gov.br/";
    const order: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        order.push(`fetch ${input}`);
        if (input === OK) {
          const body = new ReadableStream({ cancel: () => void order.push("cancel") });
          return new Response(body, { status: 302, headers: { location: target } });
        }
        return new Response("home");
      }),
    );
    await fetchText(OK);
    expect(order).toEqual([`fetch ${OK}`, "cancel", `fetch ${target}`]);
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

  it.each([401, 403])("HTTP %i is a final refusal: one request, SourceRefusedError, never retried", async (status) => {
    const calls = stubFetch({ [`GET ${OK}`]: { status, body: "Access Denied" } });
    const err = await fetchText(OK).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceRefusedError);
    expect(err).toBeInstanceOf(SourceUnavailableError);
    expect(err).not.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(1);
  });

  it("after a refusal the host is not asked again for 10 minutes (same refusal, no network call)", async () => {
    const calls = stubFetch({ [`GET ${OK}`]: { status: 403, body: "Access Denied" } });
    for (let i = 0; i < 3; i++) await expect(fetchText(OK)).rejects.toBeInstanceOf(SourceRefusedError);
    expect(calls).toHaveLength(1);
    const other = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?x=1";
    const otherCalls = stubFetch({ [`GET ${other}`]: { body: "{}", contentType: "application/json" } });
    await fetchText(other); // another host is not blocked
    expect(otherCalls).toHaveLength(1);
    vi.useFakeTimers({ now: Date.now() + REFUSAL_BLOCK_MS + 1, toFake: ["Date"] });
    try {
      const later = stubFetch({ [`GET ${OK}`]: { body: "ok" } });
      await expect(fetchText(OK)).resolves.toMatchObject({ body: "ok" });
      expect(later).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("an HTTP 429 whose HTML page is a CAPTCHA is a final refusal, not rate limiting", async () => {
    const page = '<html><body><div class="g-recaptcha" data-sitekey="x"></div></body></html>';
    stubFetch({ [`GET ${OK}`]: { status: 429, body: page, contentType: "text/html; charset=utf-8", headers: { "retry-after": "1" } } });
    const err = await fetchText(OK).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SourceRefusedError);
    expect(err).not.toBeInstanceOf(RateLimitedError);
    resetHostRefusals(); // the refusal above blocks the host for 10 minutes
    stubFetch({ [`GET ${OK}`]: { status: 429, body: "slow down", contentType: "text/html", headers: { "retry-after": "1" } } });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("caps the response size", async () => {
    stubFetch({ [`GET ${OK}`]: { body: "x".repeat(MAX_RESPONSE_BYTES + 1) } });
    await expect(fetchText(OK)).rejects.toBeInstanceOf(SourceUnavailableError);
  });

  it("applies a lower per-request cap to the streamed body and to a declared content-length", async () => {
    stubFetch({ [`GET ${OK}`]: { body: "x".repeat(101) } });
    await expect(fetchText(OK, { maxBytes: 100 })).rejects.toBeInstanceOf(ResponseTooLargeError);
    stubFetch({ [`GET ${OK}`]: { body: "x".repeat(100) } });
    await expect(fetchText(OK, { maxBytes: 100 })).resolves.toMatchObject({ body: "x".repeat(100) });
    stubFetch({ [`GET ${OK}`]: { body: "x", headers: { "content-length": "5000" } } });
    await expect(fetchText(OK, { maxBytes: 100 })).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it("never raises the cap above MAX_RESPONSE_BYTES", async () => {
    stubFetch({ [`GET ${OK}`]: { body: "x".repeat(MAX_RESPONSE_BYTES + 1) } });
    await expect(fetchText(OK, { maxBytes: MAX_RESPONSE_BYTES * 2 })).rejects.toBeInstanceOf(ResponseTooLargeError);
  });
});

describe("failFrom", () => {
  it("a final refusal says the source refused and is not asked again for 10 minutes per host (no status, no host)", () => {
    expect(SOURCE_REFUSED_MESSAGE).toBe("the source refused this server; it is not asked again for 10 minutes (per host)");
    expect(REFUSAL_BLOCK_MS).toBe(10 * 60 * 1000);
    for (const status of [401, 403, 429]) {
      expect(errorOf(failFrom(new SourceRefusedError(status)))).toEqual({ error: "source_unavailable", message: SOURCE_REFUSED_MESSAGE });
    }
  });

  it("other source failures keep the bare source_unavailable", () => {
    expect(errorOf(failFrom(new SourceUnavailableError("HTTP 500")))).toEqual({ error: "source_unavailable" });
    expect(errorOf(failFrom(new Error("x")))).toEqual({ error: "source_unavailable" });
  });
});

describe("rateLimitedMessage", () => {
  it.each([
    [null, "about 1 minute"],
    [0, "about 1 minute"],
    [4, "about 1 minute"],
    [5, "5 s"],
    [119, "119 s"],
    [120, "about 2 minutes"],
  ])("Retry-After %j -> %s", (s, wait) => {
    expect(rateLimitedMessage(s)).toBe(`The source is limiting requests; wait ${wait} before trying again.`);
  });
});
