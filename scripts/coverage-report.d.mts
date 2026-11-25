// Types for scripts/coverage-report.mjs, so the tests can import it (the script itself is plain JavaScript).

export type AppStatus = "data" | "guide" | "partial" | "none" | "extra";
export type Coverage = "data" | "guide" | "none";
export interface CategoryCount {
  category: string;
  total: number;
  data: number;
  guide: number;
  guide_generated: number;
  none: number;
  reachable_pct: number;
}
export interface AppReport {
  rows: number;
  data: number;
  guide: number;
  partial: number;
  none: number;
  extra: number;
  covered: number;
  covered_pct: number;
  not_covered: string[];
}
export interface CartaReport {
  total: number;
  data: number;
  guide: number;
  guide_generated: number;
  none: number;
  data_pct: number;
  guide_pct: number;
  guide_generated_pct: number;
  none_pct: number;
  reachable_pct: number;
  uncovered_by_usefulness: { everyday: number; other: number; business_or_internal: number };
  categories: CategoryCount[];
  uncovered: { category: string; title: string; usefulness: 1 | 2 | 3 }[];
}
export const TOP_UNCOVERED: number;
export const GUIDE_TERMS: Record<string, string[][]>;
export const GENERIC_GUIDE_URL: RegExp;
export const GENERATED_VIA: string;
export const DATA_RULES: { tool: string; terms: string[][] }[];
export const ACTION_WORDS: Set<string>;
export const EVERYDAY_WORDS: Set<string>;
export const BUSINESS_WORDS: Set<string>;
export function usefulness(item: { cat: string; title: string }): 1 | 2 | 3;
export class InputError extends Error {}
export function titleWords(text: string): string[];
export function classifyService(title: string, url?: string): { coverage: Coverage; via: string | null };
export function parseAppTable(markdown: string): { feature: string; status: AppStatus }[];
export function appReport(rows: { feature: string; status: AppStatus }[]): AppReport;
export function cartaItems(json: unknown): { cat: string; title: string; url?: string }[];
export function cartaReport(items: { cat: string; title: string; url?: string }[]): CartaReport;
export function summary(app: AppReport, carta: CartaReport | null): { app: AppReport; carta: Omit<CartaReport, "uncovered"> | null };
export function main(
  argv: string[],
  env?: Record<string, string | undefined>,
  out?: (line: string) => void,
  err?: (line: string) => void,
): number;
