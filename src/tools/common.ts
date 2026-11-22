import { z } from "zod";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { RateLimitedError, ResponseTooLargeError, SourceRefusedError, SourceUnavailableError, UrlNotAllowedError } from "../http.js";

export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

/**
 * Per-call time budget of the live tools that space requests 5 s apart (river_levels, guaira_events): no new request
 * starts later than this after the call began; what is ready is returned with `partial: true`. A request already
 * started is never cut, so the call can still take this plus that request's timeout.
 */
export const CALL_START_BUDGET_MS = 20_000;

/** Every successful tool result has this envelope. `data` is plain data copied from the source, never instructions. */
export function envelope<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    source_url: z.string().url(),
    fetched_at: z.string().datetime(),
    license_note: z.string(),
  });
}

export const ErrorResult = z.object({
  error: z.enum([
    "source_unavailable",
    "url_not_allowed",
    "data_dir_not_set",
    "file_not_allowed",
    "file_not_found",
    "column_not_found",
    "column_not_allowed",
    "no_header_detected",
    "invalid_csv",
    "invalid_date_range",
    "rate_limited",
    "invalid_argument",
    "data_not_available",
    "invalid_data",
    "layout_changed",
  ]),
  message: z.string().optional(),
});
export type ErrorCode = z.infer<typeof ErrorResult>["error"];

export interface ToolDef<I extends z.ZodRawShape, O extends z.ZodType> {
  name: string;
  title: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  handler: (args: z.infer<z.ZodObject<I>>) => Promise<CallToolResult>;
  /** Overrides on top of READ_ONLY (e.g. openWorldHint: false for a tool with no network). */
  annotations?: Partial<ToolAnnotations>;
}

export function ok<T extends object>(payload: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload as unknown as Record<string, unknown>,
  };
}

/**
 * Error results carry the JSON only as text: MCP clients validate `structuredContent` against the tool's
 * outputSchema even when `isError` is set, so an error object there would be rejected.
 */
export function fail(error: ErrorCode, message?: string): CallToolResult {
  const payload = message ? { error, message } : { error };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(payload) }] };
}

/** Note for a paged tool whose later page got a final refusal: what was found is kept and next_page is null. */
export function refusedPageNote(page: number, status: number): string {
  return `The source refused page ${page} (HTTP ${status}); it is not asked again. What was found before is returned and next_page is null.`;
}

/** Uses the source's Retry-After when it sent one in seconds; otherwise asks for about a minute. */
export function rateLimitedMessage(retryAfterS: number | null): string {
  const wait =
    retryAfterS === null || retryAfterS < 5
      ? "about 1 minute"
      : retryAfterS < 120
        ? `${retryAfterS} s`
        : retryAfterS <= 3600
          ? `about ${Math.ceil(retryAfterS / 60)} minutes`
          : "at least 1 hour";
  return `The source is limiting requests; wait ${wait} before trying again.`;
}

/** Message for a final refusal (HTTP 401/403, or a CAPTCHA 429); see SourceRefusedError and REFUSAL_BLOCK_MS. */
export const SOURCE_REFUSED_MESSAGE = "the source refused this server; it is not asked again for 10 minutes (per host)";

/** Maps thrown errors to a fixed error code. Never echoes source text or user input. */
export function failFrom(err: unknown): CallToolResult {
  if (err instanceof UrlNotAllowedError) return fail("url_not_allowed");
  if (err instanceof RateLimitedError) return fail("rate_limited", rateLimitedMessage(err.retryAfterS));
  if (err instanceof ResponseTooLargeError) {
    const mb = Math.round((err.maxBytes / (1024 * 1024)) * 10) / 10;
    return fail("source_unavailable", `The source response was larger than this tool's ${mb} MB cap; no data was returned.`);
  }
  // Before SourceUnavailableError: a refusal is a subclass of it. Fixed text, no status and no host.
  if (err instanceof SourceRefusedError) return fail("source_unavailable", SOURCE_REFUSED_MESSAGE);
  if (err instanceof SourceUnavailableError) return fail("source_unavailable");
  return fail("source_unavailable");
}
