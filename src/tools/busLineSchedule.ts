import { z } from "zod";
import { DAY_TYPES, getActiveLines, getScheduleJson, LINE_CODE_RE, parseSchedule, scheduleUrl, URBS_LICENSE_NOTE } from "../sources/urbs.js";
import { envelope, fail, failFrom, ok, type ToolDef } from "./common.js";

export const busLineScheduleInput = {
  line_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(LINE_CODE_RE, "line_code must be 1-5 letters or digits, e.g. 182 or X43")
    .describe("URBS line code from bus_lines_search, e.g. '182'."),
  day_type: z.enum(DAY_TYPES).describe("weekday, saturday or sunday (sunday also covers holidays)."),
};
export const busLineScheduleOutput = envelope(
  z.object({
    line_code: z.string(),
    line_name: z.string(),
    payment: z.string().nullable(),
    notes: z.string().nullable(),
    day_type: z.enum(DAY_TYPES),
    runs_on_day: z.boolean(),
    valid_from: z.string().nullable(),
    valid_to: z.string().nullable(),
    departures: z.array(
      z.object({
        stop: z.string(),
        times: z.array(z.object({ time: z.string(), accessible: z.boolean().nullable() })),
      }),
    ),
  }),
);

export const busLineSchedule: ToolDef<typeof busLineScheduleInput, typeof busLineScheduleOutput> = {
  name: "bus_line_schedule",
  title: "Curitiba bus line timetable",
  description:
    "Planned departure times of one URBS bus line for a day type, grouped by departure stop. `accessible` marks an adapted vehicle. Read-only.",
  inputSchema: busLineScheduleInput,
  outputSchema: busLineScheduleOutput,
  handler: async ({ line_code, day_type }) => {
    try {
      const lines = await getActiveLines();
      if (!lines.value.some((l) => l.code === line_code)) return fail("line_not_found");
      const { value, fetchedAt } = await getScheduleJson(line_code);
      return ok({
        data: parseSchedule(value, day_type),
        source_url: scheduleUrl(line_code),
        fetched_at: fetchedAt,
        license_note: URBS_LICENSE_NOTE,
      });
    } catch (err) {
      return failFrom(err);
    }
  },
};
