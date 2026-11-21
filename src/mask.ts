// PII masking shared by the server and scripts/fetch-events.mjs. No imports and only erasable TypeScript, so Node can
// load this file directly (type stripping) from the collector script, which uses Node built-ins only.

export const OBJECT_MAX_CHARS = 300;
export const MASK = "[masked]";

/** Collapsed characters examined at most; the output is cut at OBJECT_MAX_CHARS anyway. Bounds the regex work. */
export const OBJECT_MAX_RAW_CHARS = 2000;
/**
 * When the collapsed text is cut at OBJECT_MAX_RAW_CHARS, this many characters before the cut are never shown, so an
 * identifier split by the cut (a spaced CPF, an e-mail) cannot leak its first half.
 */
const RAW_CUT_GUARD = 400; // masked characters: a mask (8) replaces at least 6 originals, so this covers 300+ originals
/** Coarse cap before normalising, so every pass stays bounded while whitespace padding still does not count. */
const PRE_CAP_CHARS = 4 * OBJECT_MAX_RAW_CHARS;
/** Hyphens, dashes and minus signs read as "-": U+00AD, U+2010–U+2015, U+2212, U+FE58, U+FE63, U+FF0D. */
const DASHES = /[­‐-―−﹘﹣－]/g;
/** Invisible characters removed: zero-width space/non-joiner/joiner, U+2060–U+2064, BOM. */
const INVISIBLE = /[​-‍⁠-⁤﻿]/g;
/** Underscores (with any spaces) between digits read as one space: "123_456", "123__456", "123 _ 456". */
const DIGIT_UNDERSCORE = /(?<=\d)\s*_[\s_]*(?=\d)/g; // unambiguous: linear
/**
 * Bounded parts (RFC 5321 sizes) keep it linear; spaces around "@" are allowed ("maria @ exemplo.com"); the last
 * domain label must be letters, so "preço @ 10.50" is not an e-mail.
 */
const EMAIL = /[\p{L}\p{N}._%+-]{1,64}\s*@\s*[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63}){0,7}\.\p{L}{2,24}(?!\p{L})/gu;
/** A digit run with dots, slashes or hyphens inside; masked when it holds 10+ digits (CPF 11, CNPJ 14, phone with DDD 10–11). */
const DIGIT_RUN = /\d(?:[\d./-]*\d)?/g;
/** Separator between number groups: a hyphen, slash or dot with optional spaces around it, or one or two spaces. */
const SEP = String.raw`(?:\s*[-/.]\s*|\s{1,2})`;
/** CPF / CNPJ whose groups are split by spaces or spaced separators ("123 456 789 09", "123 . 456 . 789 - 09"). */
const SPACED_ID = new RegExp(String.raw`\b(?:\d{3}${SEP}\d{3}${SEP}\d{3}${SEP}\d{2}|\d{2}${SEP}\d{3}${SEP}\d{3}${SEP}\d{4}${SEP}\d{2})\b`, "g");
/** Phone separator: like SEP but without "/", so "2025/2026" stays. */
const PSEP = String.raw`(?:\s*[-.]\s*|\s{1,2})`;
/** Two year-like groups ("2025 - 2026", "2026-2027"): not taken as a bare phone when nothing comes before them. */
const YEAR_PAIR = String.raw`(?:19|20)\d{2}${PSEP}(?:19|20)\d{2}\b`;
/**
 * A contact word right before the number ("Tel.", "Fone:", "WhatsApp", "ramal"), not inside a longer word ("hotel");
 * optional "." and ":" after it. Whitespace is already collapsed to one space.
 */
const PHONE_CUE = String.raw`(?<=(?<![\p{L}\p{N}])(?:tels?|telef|cel|fone|telefones?|celular|contatos?|whatsapp|whats|zap|fax|ramal)\.? ?:? ?)`;
/**
 * Brazilian phone numbers (a DDD may have a leading 0): optional +55; a DDD in parentheses with 8 or 9 digits,
 * separator optional; an optional bare DDD with 8 or 9 digits split by a separator ("41 3333-4444",
 * "41 - 3333 - 4444"); or a bare DDD and a separator before 8 or 9 glued digits ("41 999998888", "041 33334444").
 * A match that would start with a year pair is skipped unless a contact word comes right before it ("tel 2025-2026");
 * with a DDD, +55 or parentheses before it, it is still masked.
 */
const PHONE = new RegExp(
  String.raw`(?:${PHONE_CUE}|(?!${YEAR_PAIR}))(?:\+?55${PSEP}?)?(?:\(0?\d{2}\)\s?9?\d{4}${PSEP}?\d{4}\b|(?:\b0?\d{2}${PSEP}?)?\b9?\d{4}${PSEP}\d{4}\b|\b0?\d{2}${PSEP}9?\d{8}\b)`,
  "giu",
);

/**
 * Masks CPF/CNPJ-shaped numbers, e-mails and phone numbers in the formats above, collapses whitespace and caps the
 * length. First, dashes are normalised to "-", invisible characters removed and "_" between digits read as a space.
 * Covers common formats only; it is not a guarantee.
 */
export function maskObject(raw: string): { text: string; truncated: boolean } {
  let t = (raw.length > PRE_CAP_CHARS ? raw.slice(0, PRE_CAP_CHARS) : raw).replace(INVISIBLE, "").replace(DASHES, "-").replace(DIGIT_UNDERSCORE, " ").replace(/\s+/g, " ").trim();
  const rawCut = t.length > OBJECT_MAX_RAW_CHARS || raw.length > PRE_CAP_CHARS;
  if (rawCut) t = t.slice(0, OBJECT_MAX_RAW_CHARS);
  t = t.replace(EMAIL, MASK);
  t = t.replace(DIGIT_RUN, (m) => (m.replace(/\D/g, "").length >= 10 ? MASK : m));
  t = t.replace(SPACED_ID, MASK);
  t = t.replace(PHONE, MASK);
  let chars = Array.from(t); // code points: never split a surrogate pair
  if (rawCut) chars = chars.slice(0, Math.max(0, chars.length - RAW_CUT_GUARD));
  else if (chars.length <= OBJECT_MAX_CHARS) return { text: t, truncated: false };
  let cut = chars.slice(0, OBJECT_MAX_CHARS).join("");
  const open = cut.lastIndexOf("[");
  // `cut` is a prefix of `t`, so the same index tells whether a mask token starts there.
  if (open > cut.lastIndexOf("]") && t.startsWith(MASK, open)) cut = cut.slice(0, open); // never show half a mask
  return { text: `${cut.trimEnd()}…`, truncated: true };
}

/** Caps for event text fields, shared by scripts/fetch-events.mjs and events_search (code points). */
export const EVENT_TITLE_MAX = 120;
export const EVENT_PLACE_MAX = 120;
export const EVENT_SHORT_MAX = 60;

/** Control (Cc: C0, DEL, C1) characters; each becomes a space. */
const CONTROL = /\p{Cc}/gu;
/** Format (Cf) characters: bidi controls and isolates, zero-width characters, soft hyphen, tag characters; removed. */
const FORMAT = /\p{Cf}/gu;

/**
 * Cleans one short third-party text field (events): control characters become spaces, format characters (bidi, zero
 * width, tags) are removed, the text is NFC-normalised and whitespace collapsed, PII is masked with maskObject, and
 * the result is cut at `max` code points with "…" (never inside a mask token). Applying it again changes nothing.
 */
export function cleanField(raw: string, max: number): string {
  const plain = raw.replace(CONTROL, " ").replace(FORMAT, "").normalize("NFC").replace(/\s+/g, " ").trim();
  const t = maskObject(plain).text;
  const chars = Array.from(t);
  if (chars.length <= max) return t;
  let cut = chars.slice(0, max - 1).join("");
  const open = cut.lastIndexOf("[");
  if (open > cut.lastIndexOf("]") && t.startsWith(MASK, open)) cut = cut.slice(0, open);
  return `${cut.trimEnd()}…`;
}
