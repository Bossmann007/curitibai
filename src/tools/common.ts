import { z } from "zod";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { SourceUnavailableError, UrlNotAllowedError } from "../http.js";

export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

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
  error: z.enum(["source_unavailable", "url_not_allowed", "line_not_found", "invalid_input"]),
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
}

export function ok<T>(payload: { data: T; source_url: string; fetched_at: string; license_note: string }): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload as unknown as Record<string, unknown>,
  };
}

export function fail(error: ErrorCode, message?: string): CallToolResult {
  const payload = message ? { error, message } : { error };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
}

/** Maps thrown errors to a fixed error code. Never echoes source text or user input. */
export function failFrom(err: unknown): CallToolResult {
  if (err instanceof UrlNotAllowedError) return fail("url_not_allowed");
  if (err instanceof SourceUnavailableError) return fail("source_unavailable");
  return fail("source_unavailable");
}
