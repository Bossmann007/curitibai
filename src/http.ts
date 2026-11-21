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
      url = next.href;
      // 301/302/303 turn a POST into a GET, as browsers do.
      if (res.status !== 307 && res.status !== 308) {
        method = "GET";
        body = undefined;
      }
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      if (res.status === 429) {
        const ra = res.headers.get("retry-after")?.trim() ?? "";
        throw new RateLimitedError(/^\d{1,6}$/.test(ra) ? Number(ra) : null);
      }
      throw new SourceUnavailableError(`HTTP ${res.status}`);
    }
    return { url, contentType: res.headers.get("content-type") ?? "", body: await readCapped(res, maxBytes) };
  }
  throw new SourceUnavailableError("too many redirects");
}
