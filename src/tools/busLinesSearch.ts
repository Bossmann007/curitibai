import { z } from "zod";
import { URBS_SOURCE_URL, type Linha } from "../sources/urbs.js";
import { fold } from "../text.js";
import { busEnvelope, isFailure, loadUrbsOrFail, page, pagingInput, urbsLicenseNote, urbsNote } from "./busCommon.js";
import { queryWords } from "./cityServicesSearch.js";
import { fail, ok, type ToolDef } from "./common.js";

export const busLinesSearchInput = {
  query: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Words to find in the line name or code; accents, case and punctuation are ignored, every word must match."),
  category: z
    .string()
    .trim()
    .max(100)
    .optional()
    .describe('Service category as in the file (e.g. "ALIMENTADOR", "LIGEIRÃO"; accents and case ignored). Call with no arguments to get the list.'),
  ...pagingInput,
};

const Line = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  color: z.string(),
  card_only: z.boolean().nullable(),
});

export const busLinesSearchOutput = busEnvelope(
  z.object({
    total: z.number().int(),
    offset: z.number().int(),
    next_offset: z.number().int().nullable(),
    items: z.array(Line),
    categories: z.array(z.object({ name: z.string(), count: z.number().int() })).optional(),
  }),
);

export interface BusLinesSearchArgs {
  query?: string | undefined;
  category?: string | undefined;
  limit: number;
  offset: number;
}

function categories(rows: readonly Linha[]) {
  const names = [...new Set(rows.map((r) => r.CATEGORIA_SERVICO))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return names.map((name) => ({ name, count: rows.filter((r) => r.CATEGORIA_SERVICO === name).length }));
}

export function busLinesSearchResult(rows: readonly Linha[], file: string, date: string, args: BusLinesSearchArgs, now: Date) {
  const words = args.query === undefined ? [] : queryWords(args.query);
  const category = args.category === undefined ? undefined : fold(args.category);
  const exactCode = args.query === undefined ? "" : fold(args.query.trim());
  const matches = rows.filter((r) => {
    if (category !== undefined && fold(r.CATEGORIA_SERVICO) !== category) return false;
    const hay = `${fold(r.COD)} ${fold(r.NOME)}`;
    return words.every((w) => hay.includes(w));
  });
  // An exact code first ("203"), then by name; codes break ties so paging is stable.
  const rank = (r: Linha) => (fold(r.COD) === exactCode ? 0 : 1);
  matches.sort((a, b) => rank(a) - rank(b) || a.NOME.localeCompare(b.NOME, "pt-BR") || a.COD.localeCompare(b.COD));
  const p = page(matches, args.offset, args.limit);
  const noFilter = args.query === undefined && args.category === undefined;
  return {
    data: {
      ...p,
      items: p.items.map((r) => ({
        code: r.COD,
        name: r.NOME,
        category: r.CATEGORIA_SERVICO,
        color: r.NOME_COR,
        card_only: r.SOMENTE_CARTAO === "S" ? true : r.SOMENTE_CARTAO === "N" ? false : null,
      })),
      ...(noFilter ? { categories: categories(rows) } : {}),
    },
    source_url: URBS_SOURCE_URL,
    checked_at: date,
    license_note: urbsLicenseNote(file),
    note:
      urbsNote(file, date, now) +
      " `card_only` is URBS's SOMENTE_CARTAO flag (S = card payment only; null for any other value).",
  };
}

export const busLinesSearch: ToolDef<typeof busLinesSearchInput, typeof busLinesSearchOutput> = {
  name: "bus_lines_search",
  title: "Curitiba bus lines (URBS, local file)",
  description:
    "Search Curitiba's bus lines (URBS): code, name, service category, colour and whether only the transport card is " +
    "accepted. Filter by words in the name or code and by category; call with no arguments to list the categories. " +
    "Reads the newest YYYY_MM_DD_linhas.json the user downloaded into CURITIBAI_DATA_DIR/urbs/; no network call. Read-only.",
  inputSchema: busLinesSearchInput,
  outputSchema: busLinesSearchOutput,
  annotations: { openWorldHint: false },
  handler: async (args) => {
    if (args.query !== undefined && queryWords(args.query).length === 0) {
      return fail("invalid_argument", "query must contain at least one letter or digit.");
    }
    const loaded = await loadUrbsOrFail("linhas");
    if (isFailure(loaded)) return loaded;
    if (args.category !== undefined) {
      const wanted = fold(args.category);
      const all = categories(loaded.rows);
      if (!all.some((c) => fold(c.name) === wanted)) {
        return fail("invalid_argument", `category must be one of: ${all.map((c) => c.name).join("; ")}.`);
      }
    }
    return ok(busLinesSearchResult(loaded.rows, loaded.file, loaded.date, args, new Date()));
  },
};
