// Types for scripts/pr-size.mjs, so the tests can import it (the script itself is plain JavaScript).

export interface NumstatRow {
  path: string;
  lines: number;
  /** Old path of a rename. */
  from?: string;
}
export const LIMIT: number;
export const EXPLANATION: string;
export function isExcluded(path: string): boolean;
export function parseNumstat(text: string): NumstatRow[];
export function hasExplanation(body: string | undefined): boolean;
export function checkPrSize(
  rows: NumstatRow[],
  body: string | undefined,
  limit?: number,
  fullLines?: (path: string) => number,
): { total: number; counted: NumstatRow[]; ok: boolean; explained: boolean };
