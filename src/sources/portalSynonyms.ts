/**
 * Fallback terms for the portal search, tried only when the query and its accent-free form both return nothing.
 * Keys are folded (lowercase, no accents). Each target was checked live on 2026-11-22 and returned the dataset named
 * in the comment; add an entry only after the same check. Accents alone need no entry: "saúde" is retried as "saude".
 */
export const PORTAL_SYNONYMS: Readonly<Record<string, string>> = {
  onibus: "transporte coletivo", // "Transporte Coletivo de Curitiba" (URBS)
  busao: "transporte coletivo",
};
