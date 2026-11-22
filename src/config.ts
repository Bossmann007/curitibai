export const USER_AGENT = "curitibai-mcp/0.7 (+https://github.com/Bossmann007/curitibai)";
export const FETCH_TIMEOUT_MS = 10_000;
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
/**
 * The only hosts the server contacts (exact match, redirects included). The first five robots.txt return 404 (no
 * restriction); imunizaja.curitiba.pr.gov.br's robots.txt does not disallow /locaisvacinacao/; geocuritiba.ippuc.org.br's robots.txt
 * returns 404 (checked 2026-11-21); www.teatroguaira.pr.gov.br's robots.txt does not disallow /calendario-eventos or
 * /Evento/ (checked 2026-11-22, and re-read by the guaira_events source every 24 h) (docs/sources.md).
 * The file hosts mid-dadosabertos.curitiba.pr.gov.br and dadosabertos.c3sl.ufpr.br are excluded on purpose:
 * their robots.txt says `Disallow: /`. www.urbs.curitiba.pr.gov.br is out of scope. overpass-api.de is excluded too:
 * its robots.txt disallows /api/.
 */
export const ALLOWED_HOSTS = [
  "dadosabertos.curitiba.pr.gov.br",
  "apidadosabertos.saude.gov.br",
  "pncp.gov.br",
  "apiprevmet3.inmet.gov.br",
  "ovp.dresel.systems",
  "imunizaja.curitiba.pr.gov.br",
  "geocuritiba.ippuc.org.br",
  "www.teatroguaira.pr.gov.br",
] as const;
