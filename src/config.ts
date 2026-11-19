export const USER_AGENT = "curitibai-mcp/0.3";
export const FETCH_TIMEOUT_MS = 10_000;
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
/**
 * The only hosts the server contacts (exact match, redirects included). All three robots.txt return 404 (no restriction).
 * The file hosts mid-dadosabertos.curitiba.pr.gov.br and dadosabertos.c3sl.ufpr.br are excluded on purpose:
 * their robots.txt says `Disallow: /`. www.urbs.curitiba.pr.gov.br is out of scope.
 */
export const ALLOWED_HOSTS = [
  "dadosabertos.curitiba.pr.gov.br",
  "apidadosabertos.saude.gov.br",
  "pncp.gov.br",
] as const;
