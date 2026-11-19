export const USER_AGENT = "curitibai-mcp/0.1";
export const FETCH_TIMEOUT_MS = 10_000;
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
/** Hosts the server may contact. Subdomains count (the open data portal lives on dadosabertos.curitiba.pr.gov.br). */
export const ALLOWED_HOSTS = ["curitiba.pr.gov.br", "urbs.curitiba.pr.gov.br"] as const;
