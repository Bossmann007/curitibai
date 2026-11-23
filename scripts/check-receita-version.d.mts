// Types for scripts/check-receita-version.mjs, so the tests can import it (the script itself is plain JavaScript).

export interface ReleaseRecord {
  tag: string;
  url: string;
  published_at: string | null;
}
export interface VersionRecord {
  versaoApp: string;
  versaoDb: string;
  dataVersaoDb: string;
  descricaoVersaoDb: string;
  releases: Record<string, ReleaseRecord | null>;
  recorded_at: string;
}
export interface RunDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now: () => Date;
  env: Record<string, string | undefined>;
  log: (line: string) => void;
}
export interface RunResult {
  code: string;
  exit: number;
  issue?: "created" | "existing";
  status?: number;
}

export const RECEITA_URL: string;
export const GITHUB_API: string;
export const ALLOWED_HOSTS: readonly string[];
export const RELEASE_REPOS: readonly string[];
export const USER_AGENT: string;
export const VERSION_FILE: string;
export const TIMEOUT_MS: number;
export const MAX_BYTES: number;
export const DESCRIPTION_MAX: number;
export function parseReceita(data: unknown): Omit<VersionRecord, "releases" | "recorded_at">;
export function versionLabel(rec: VersionRecord): string;
export function issueTitle(before: VersionRecord, after: VersionRecord): string;
export function run(deps: RunDeps): Promise<RunResult>;
