import { z } from "zod";
import { getActiveLines, URBS_LICENSE_NOTE, URBS_SCHEDULE_PAGE_URL } from "../sources/urbs.js";
import { fold } from "../text.js";
import { envelope, failFrom, ok, type ToolDef } from "./common.js";

const Line = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  color: z.string().nullable(),
  card_only: z.boolean().nullable(),
});

export const busLinesSearchInput = {
  query: z.string().trim().min(1).max(100).optional().describe("Part of the line code or name, e.g. '182' or 'Barreirinha'. Accents optional."),
  limit: z.number().int().min(1).max(50).default(20),
};
export const busLinesSearchOutput = envelope(z.object({ total_matches: z.number().int(), lines: z.array(Line) }));

export const busLinesSearch: ToolDef<typeof busLinesSearchInput, typeof busLinesSearchOutput> = {
  name: "bus_lines_search",
  title: "Search Curitiba bus lines",
  description: "Search active URBS bus lines in Curitiba by code or name. Read-only; data from the URBS timetable page.",
  inputSchema: busLinesSearchInput,
  outputSchema: busLinesSearchOutput,
  handler: async ({ query, limit }) => {
    try {
      const { value, fetchedAt } = await getActiveLines();
      const q = query ? fold(query) : null;
      const matches = q ? value.filter((l) => fold(l.code).includes(q) || fold(l.name).includes(q)) : value;
      return ok({
        data: { total_matches: matches.length, lines: matches.slice(0, limit) },
        source_url: URBS_SCHEDULE_PAGE_URL,
        fetched_at: fetchedAt,
        license_note: URBS_LICENSE_NOTE,
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
