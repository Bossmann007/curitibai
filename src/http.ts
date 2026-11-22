import { ALLOWED_HOSTS, FETCH_TIMEOUT_MS, MAX_REDIRECTS, MAX_RESPONSE_BYTES, USER_AGENT } from "./config.js";

export class SourceUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`source_unavailable: ${reason}`);
    this.name = "SourceUnavailableError";
  }
}

/** HTTP 429. `retryAfterS` is the Retry-After header in whole seconds, or null when absent or not a number. */
export class RateLimitedError extends SourceUnavailableError {
  constructor(readonly retryAfterS: number | null) {
    super("HTTP 429");
    this.name = "RateLimitedError";
  }
}

/**
 * A final refusal: HTTP 401 or 403, or a 429 whose HTML page is a CAPTCHA. Never retried (not by PNCP's single
 * retry either), never asked again with other headers, and there is no browser fallback. The host is then not asked
 * again for REFUSAL_BLOCK_MS in this process. Paged tools return what they have with next_page null.
 */
export class SourceRefusedError extends SourceUnavailableError {
  constructor(readonly status: number) {
    super(`HTTP ${status} (refused; not retried)`);
    this.name = "SourceRefusedError";
  }
}

/** After a final refusal, the host is not asked again in this process for this long; the same refusal is returned. */
export const REFUSAL_BLOCK_MS = 10 * 60 * 1000;
const refusedHosts = new Map<string, { until: number; status: number }>();

/** Tests only: forget every host refusal. */
export function resetHostRefusals(): void {
  refusedHosts.clear();
}

/** Throws the remembered SourceRefusedError while the URL's host is blocked (REFUSAL_BLOCK_MS); makes no request. */
export function checkNotRefused(url: string): void {
  const host = new URL(url).hostname.toLowerCase();
  const r = refusedHosts.get(host);
  if (r === undefined) return;
  if (Date.now() < r.until) throw new SourceRefusedError(r.status);
  refusedHosts.delete(host);
}

/**
 * Records a final refusal for the URL's host (not asked again for REFUSAL_BLOCK_MS) and throws SourceRefusedError.
 * Also for refusals a source sends inside a 200 answer (e.g. an ArcGIS `error` with code 401/403/498/499).
 */
export function blockHost(url: string, status: number): never {
  refusedHosts.set(new URL(url).hostname.toLowerCase(), { until: Date.now() + REFUSAL_BLOCK_MS, status });
  throw new SourceRefusedError(status);
}

/** Bytes of a 429 HTML body read to look for a CAPTCHA; the rest is discarded. */
const CAPTCHA_SNIFF_BYTES = 16 * 1024;
/** Markers of a CAPTCHA or challenge page (also used by src/sources/guaira.ts on pages that do not parse). */
export const CAPTCHA = /captcha|cf-challenge|challenge-platform|cf-turnstile/i;

/** True when a 429 answer is an HTML page with a CAPTCHA (read at most CAPTCHA_SNIFF_BYTES); the body is released. */
async function isCaptchaPage(res: Response): Promise<boolean> {
  if (!/^text\/html\b/i.test(res.headers.get("content-type")?.trim() ?? "") || !res.body) {
    await res.body?.cancel().catch(() => undefined);
    return false;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < CAPTCHA_SNIFF_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    return false;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return CAPTCHA.test(new TextDecoder().decode(bytes.subarray(0, CAPTCHA_SNIFF_BYTES)));
}

/** The body was larger than the cap for this request (declared or streamed). */
export class ResponseTooLargeError extends SourceUnavailableError {
  constructor(readonly maxBytes: number) {
    super("response too large");
    this.name = "ResponseTooLargeError";
  }
}

export class UrlNotAllowedError extends Error {
  constructor() {
    super("url_not_allowed");
    this.name = "UrlNotAllowedError";
  }
}

/** https only, default port, no credentials, host exactly equal to an allowed host. */
export function isAllowedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return (ALLOWED_HOSTS as readonly string[]).includes(host);
}

export interface FetchResult {
  url: string;
  contentType: string;
  body: string;
}

export interface FetchOptions {
  method?: "GET" | "POST";
  form?: Record<string, string>;
  /** Per-hop timeout; defaults to FETCH_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Body size cap; defaults to MAX_RESPONSE_BYTES and can only lower it. */
  maxBytes?: number;
  /** When true, a redirect to any other host (allowed or not) is refused before it is followed. */
  sameHostOnly?: boolean;
  /**
   * When set, a redirect is followed only when its target path is this prefix or below it ("/a" accepts "/a" and
   * "/a/x", not "/ab"), compared ignoring case (IIS paths are case-insensitive); a path with an encoded slash or
   * backslash is refused. Checks the path only: use it with `sameHostOnly`.
   */
  redirectPathPrefix?: string;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new ResponseTooLargeError(maxBytes);
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ResponseTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/**
 * The only network entry point. Checks the allowlist on the first URL and on every redirect hop,
 * follows at most MAX_REDIRECTS redirects by hand, times out each hop, caps the body size.
 */
export async function fetchText(startUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
  let url = startUrl;
  const maxBytes = Math.min(options.maxBytes ?? MAX_RESPONSE_BYTES, MAX_RESPONSE_BYTES);
  let method = options.method ?? "GET";
  let body: URLSearchParams | undefined = options.form ? new URLSearchParams(options.form) : undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedUrl(url)) throw new UrlNotAllowedError();
    checkNotRefused(url);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        body,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/json;q=0.9,*/*;q=0.5" },
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new SourceUnavailableError(timedOut ? "timeout" : "network error");
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      // Release the connection before the next hop; the redirect body is never read.
      await res.body?.cancel().catch(() => undefined);
      if (!location) throw new SourceUnavailableError("redirect without location");
      const next = new URL(location, url);
      if (options.sameHostOnly && next.hostname.toLowerCase() !== new URL(url).hostname.toLowerCase()) {
        throw new SourceUnavailableError("cross-host redirect");
      }
      if (options.redirectPathPrefix !== undefined) {
        const path = next.pathname.toLowerCase();
        const prefix = options.redirectPathPrefix.toLowerCase();
        const inside = path === prefix || path.startsWith(`${prefix}/`);
        if (!inside || /%2f|%5c|\\/i.test(next.pathname)) throw new SourceUnavailableError("redirect outside the allowed path");
      }
      url = next.href;
      // 301/302/303 turn a POST into a GET, as browsers do.
      if (res.status !== 307 && res.status !== 308) {
        method = "GET";
        body = undefined;
      }
      continue;
    }
    if (!res.ok) {
      if (res.status === 429) {
        if (await isCaptchaPage(res)) blockHost(url, 429);
        const ra = res.headers.get("retry-after")?.trim() ?? "";
        throw new RateLimitedError(/^\d{1,6}$/.test(ra) ? Number(ra) : null);
      }
      await res.body?.cancel().catch(() => undefined);
      if (res.status === 401 || res.status === 403) blockHost(url, res.status);
      throw new SourceUnavailableError(`HTTP ${res.status}`);
    }
    return { url, contentType: res.headers.get("content-type") ?? "", body: await readCapped(res, maxBytes) };
  }
  throw new SourceUnavailableError("too many redirects");
}
