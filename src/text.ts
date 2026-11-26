const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

/** Decodes numeric entities and a few named ones; unknown entities are left as they are. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

/** Plain text from an HTML fragment: tags dropped, entities decoded, whitespace collapsed. */
export function htmlToText(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** A JSON object (not null, not an array). */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Lowercase, accents removed, for matching. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** fold(), with every run of characters that are not letters or digits made one space, trimmed: the key names are compared on. */
export function foldKey(s: string): string {
  return fold(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
